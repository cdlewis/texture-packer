import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {zstdDecompressSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {initZstd,compressZstd} from '../docs/zstd.js';
import {PackArchive} from '../docs/archive.js';
import {readArchive} from './archive-reader.js';
await initZstd(readFileSync(new URL('../docs/vendor/zstd/zstd.wasm',import.meta.url)));
test('WASM Zstandard frames decode through native Node zstd, including empty and large input',async()=>{
  for(const data of [new Uint8Array(),new Uint8Array([1]),randomBytes(65536),new Uint8Array(20*1024*1024).fill(57)]){
    const compressed=await compressZstd([data],data.length);
    assert.deepEqual(new Uint8Array(zstdDecompressSync(compressed)),new Uint8Array(data));
  }
});
test('mixed ZIP methods, CRCs, UTF-8 names, and multipart cache data',async()=>{
  const archive=new PackArchive(1024*1024),image=new Uint8Array(100000).fill(3),random=randomBytes(4096);
  await archive.add('art/雪.dds',[image.subarray(0,50000),image.subarray(50000)]);
  await archive.add('credits.txt',[new TextEncoder().encode('credit '.repeat(1000))],true);
  await archive.add('random.bin',[random]);await archive.add('empty.bin',[]);
  const {files,methods}=readArchive(new Uint8Array(await archive.finish().arrayBuffer()));
  assert.equal(methods['art/雪.dds'],93);assert.equal(methods['credits.txt'],8);assert.equal(methods['random.bin'],0);assert.equal(methods['empty.bin'],0);
  assert.deepEqual(files['art/雪.dds'],image);assert.deepEqual(files['random.bin'],new Uint8Array(random));assert.equal(files['empty.bin'].length,0);
});
test('archive limit fails without a downloadable partial result',async()=>{
  const archive=new PackArchive(40);
  await assert.rejects(archive.add('long-name.bin',[randomBytes(100)]),/exceeds/);
});
test('invalid WASM initialization rejects instead of hanging',()=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',"import {initZstd} from './docs/zstd.js'; try { await initZstd(new Uint8Array([1,2,3])); process.exitCode=1; } catch { console.log('rejected'); }"],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/rejected/);
});
