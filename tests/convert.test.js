import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBasis,pngToDDS,pngDimensions} from '../docs/convert.js';
import {readDDS} from '../docs/dds.js';
import {png,chunk} from './png-fixtures.js';
await initBasis(readFileSync(new URL('../docs/vendor/basis/basis_encoder.wasm',import.meta.url)));
test('PNG becomes BC7 DDS with complete mip chains, including tiny and non-square images',async()=>{
  for(const [w,h] of [[1,1],[2,8],[8,1],[7,9],[128,64]]) {
    const bytes=await pngToDDS(png(w,h,(x,y)=>[x*13%256,y*11%256,90,x%2?128:255]));
    const d=readDDS(bytes);
    assert.equal(d.format,98);assert.equal(d.width,w);assert.equal(d.height,h);
    assert.equal(d.mips,Math.floor(Math.log2(Math.max(w,h)))+1);
    const last=d.levels.at(-1);assert.equal(last.offset+last.pitch*last.rows,bytes.length);
  }
});
test('malformed PNG, oversized dimensions, animation, and corrupt pixels fail',async()=>{
  assert.throws(()=>pngDimensions(new Uint8Array(24)),/signature/);
  const large=png();large.writeUInt32BE(16384,16);large.writeUInt32BE(16384,20);
  assert.throws(()=>pngDimensions(large),/limit/);
  const valid=png(),animated=Buffer.concat([valid.subarray(0,33),chunk('acTL',Buffer.alloc(8)),valid.subarray(33)]);
  await assert.rejects(pngToDDS(animated),/Animated/);
  await assert.rejects(pngToDDS(valid.subarray(0,-3)),/Truncated/);
  const corrupt=png();corrupt[45]^=255;
  await assert.rejects(pngToDDS(corrupt),/checksum/);
});
