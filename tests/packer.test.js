import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDDS,appendLowMips} from '../docs/dds.js';
import {resolveDatabase,safePath} from '../docs/database.js';
import {pack} from '../docs/packer.js';
import {readFileSync} from 'node:fs';
import {initZstd} from '../docs/zstd.js';
import {readArchive} from './archive-reader.js';
import {initBasis} from '../docs/convert.js';
import {png} from './png-fixtures.js';
await initZstd(readFileSync(new URL('../docs/vendor/zstd/zstd.wasm',import.meta.url)));
await initBasis(readFileSync(new URL('../docs/vendor/basis/basis_encoder.wasm',import.meta.url)));
const unzipSync=bytes=>readArchive(bytes).files;
import {dds,db,file,hash,cacheWriter,merge} from './fixtures.js';
const lookup=paths=>new Map(paths.map(p=>[p,new Blob()]));
test('DDS legacy and DX10 formats, offsets, and truncated data',()=>{
  for(const [format,legacy] of [[71,'DXT1'],[74,'DXT3'],[77,'DXT5'],[80,'ATI1'],[83,'ATI2'],[98,null],[28,null],[87,null]]){
    const bytes=dds({format,legacy});const d=readDDS(bytes);
    assert.equal(d.format,format);assert.equal(d.levels[0].offset,legacy?128:148);
    assert.throws(()=>readDDS(bytes.subarray(0,bytes.length-1)),/truncated/);
  }
});
test('DDS invalid types, dimensions, mip count, and formats are rejected',()=>{
  for(const [offset,value] of [[16,0],[12,20000],[28,30],[128,999],[132,4],[140,2],[136,4]]){
    const bytes=dds();new DataView(bytes.buffer).setUint32(offset,value,true);
    assert.throws(()=>readDDS(bytes));
  }
});
test('low mip cache dimensions, pitches, placements, and bytes',()=>{
  const bytes=dds(),cache=cacheWriter();appendLowMips(bytes,'art/texture.dds',cache);
  const result=merge(cache.parts),v=new DataView(result.buffer),d=readDDS(bytes);
  assert.equal(v.getUint32(0,true),0x434d4f4c);assert.equal(v.getUint32(4,true),3);
  assert.equal(v.getUint32(8,true),128);assert.equal(v.getUint32(12,true),64);assert.equal(v.getUint32(20,true),8);
  assert.deepEqual(result.subarray(512,512+d.levels[1].pitch),bytes.subarray(d.levels[1].offset,d.levels[1].offset+d.levels[1].pitch));
  appendLowMips(dds({width:32,height:32,mips:6,format:71}),'other.dds',cache);
  assert.ok(cache.size>result.length);
});
test('explicit paths prefer DDS, normalize slashes, and reject case mismatches',()=>{
  assert.equal(resolveDatabase(db([{hashes:{rt64:hash},path:'art\\texture.png'}]),lookup(['art/texture.dds','art/texture.png'])).textures[0].path,'art/texture.dds');
  assert.throws(()=>resolveDatabase(db(),lookup(['Art/texture.dds'])),/case mismatch/);
});
test('RT64 and Rice automatic matching and ambiguous names',()=>{
  const t={hashes:{rt64:hash},path:''};
  assert.equal(resolveDatabase(db([t]),lookup([hash+'.png',hash+'.dds'])).textures[0].path,hash+'.dds');
  const rice={hashes:{rt64:hash,rice:'1234abcd#2#0'},path:''};
  assert.equal(resolveDatabase(db([rice],{autoPath:'rice'}),lookup(['GAME#1234abcd#2#0_all.png'])).textures.length,1);
  assert.throws(()=>resolveDatabase(db([t]),lookup(['a/'+hash+'.dds','b/'+hash+'.dds'])),/Ambiguous/);
});
test('operation filters apply in order, with per-texture override',()=>{
  const database=db();database.operationFilters=[{wildcard:'art/*',operation:'preload'},{wildcard:'art/texture.?ds',operation:'stream'}];
  assert.equal(resolveDatabase(database,lookup(['art/texture.dds'])).textures[0].stream,true);
  database.textures[0].operation='stall';
  assert.equal(resolveDatabase(database,lookup(['art/texture.dds'])).textures[0].stream,false);
});
test('missing explicit mappings, unsafe paths, extras, and duplicate hashes fail',()=>{
  for(const path of ['../bad','/bad','a//b','C:/bad','a/./b'])assert.throws(()=>safePath(path));
  assert.throws(()=>resolveDatabase(db(),lookup([])),/Missing/);
  const database=db();database.extraFiles=['missing.txt'];assert.throws(()=>resolveDatabase(database,lookup(['art/texture.dds'])),/Missing extra/);
  database.extraFiles=[];database.textures.push(database.textures[0]);assert.throws(()=>resolveDatabase(database,lookup(['art/texture.dds'])),/Duplicate/);
});
test('pack contains exact selected files, original database, fresh cache, and Zstandard',async()=>{
  const database=db();database.extraFiles=['credits.txt'];const config=JSON.stringify(database,null,2),bytes=dds();
  const entries=[file('rt64.json',config),file('art/texture.dds',bytes),file('art/texture.png','unused'),file('credits.txt','credit'),file('unused.dds','unused'),file('rt64-low-mip-cache.bin','stale')];
  const progress=[];const r=await pack(entries,p=>progress.push(p));
  const archive=new Uint8Array(await r.blob.arrayBuffer()),zip=unzipSync(archive);
  assert.equal(new DataView(archive.buffer).getUint16(8,true),93);
  assert.deepEqual(Object.keys(zip).sort(),['art/texture.dds','credits.txt','rt64-low-mip-cache.bin','rt64.json']);
  assert.equal(new TextDecoder().decode(zip['rt64.json']),config);assert.deepEqual(zip['art/texture.dds'],bytes);
  assert.ok(zip['rt64-low-mip-cache.bin'].length>100);assert.equal(r.textures,1);assert.equal(progress.at(-1).done,2);
});
test('PNG is converted, renamed, mapped, and included in the fresh cache',async()=>{
  const r=await pack([file('rt64.json',JSON.stringify(db())),file('art/texture.png',png())]);
  const zip=unzipSync(new Uint8Array(await r.blob.arrayBuffer()));
  assert.ok(zip['rt64-low-mip-cache.bin'].length>0);assert.equal(r.pngCount,1);assert.equal(r.ddsCount,1);assert.equal(r.warnings.length,0);
  assert.ok(!zip['art/texture.png']);assert.equal(readDDS(zip['art/texture.dds']).mips,4);
  const database=JSON.parse(new TextDecoder().decode(zip['rt64.json']));
  assert.equal(database.textures[0].path,'art/texture.dds');
  assert.equal(resolveDatabase(database,new Map(Object.keys(zip).map(p=>[p,new Blob()]))).textures[0].stream,true);
});
test('conversion preserves PNG operation filters, shared mappings, Rice paths and extraFiles',async()=>{
  const database=db([{hashes:{rt64:hash,rice:'1234abcd#2#0'}},{hashes:{rt64:'1'},path:'GAME#1234abcd#2#0_all.png',operation:'stall'}],{autoPath:'rice'});
  database.operationFilters=[{wildcard:'*.png',operation:'preload'}];database.extraFiles=['GAME#1234abcd#2#0_all.png'];
  const r=await pack([file('rt64.json',JSON.stringify(database)),file('GAME#1234abcd#2#0_all.png',png())]);
  const zip=unzipSync(new Uint8Array(await r.blob.arrayBuffer())),out=JSON.parse(new TextDecoder().decode(zip['rt64.json']));
  assert.equal(r.cacheBytes,0);assert.equal(r.pngCount,1);
  assert.deepEqual(out.textures.map(t=>t.operation),['preload','stall']);
  assert.deepEqual(out.extraFiles,['GAME#1234abcd#2#0_all.dds']);
  assert.equal(resolveDatabase(out,new Map(Object.keys(zip).map(p=>[p,new Blob()]))).textures.length,1);
});
test('preloaded DDS is packed but excluded from cache',async()=>{
  const r=await pack([file('rt64.json',JSON.stringify(db(undefined,{defaultOperation:'preload'}))),file('art/texture.dds',dds())]);
  assert.equal(r.cacheBytes,0);
});
test('bad config or any invalid selected image prevents download',async()=>{
  await assert.rejects(pack([]),/rt64.json/);
  await assert.rejects(pack([file('rt64.json','{')]),/JSON/);
  await assert.rejects(pack([file('rt64.json',JSON.stringify(db())),file('art/texture.dds','broken')]),/Truncated DDS/);
  await assert.rejects(pack([file('rt64.json','{}'),file('RT64.JSON','{}')]),/case-conflicting/);
});
