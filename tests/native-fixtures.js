import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {dds,cacheWriter,merge} from './fixtures.js';
import {appendLowMips} from '../docs/dds.js';
import {initBasis,pngToDDS} from '../docs/convert.js';
import {png} from './png-fixtures.js';
await initBasis(readFileSync(new URL('../docs/vendor/basis/basis_encoder.wasm',import.meta.url)));
const cache=cacheWriter();
const cases=[{}, {format:71,legacy:'DXT1'}, {format:77,legacy:'DXT5'}, {format:28}, {format:87,width:64,height:32,mips:7}, {format:98,width:130,height:66,mips:8}, {format:71,width:1,height:256,mips:9}, {format:83,width:16,height:16,mips:1}];
for(let i=0;i<cases.length;i++){const bytes=dds(cases[i]),path=`fixture-${i}.dds`;writeFileSync(join(process.argv[2],path),bytes);appendLowMips(bytes,path,cache);}
for(const [i,w,h] of [[8,128,64],[9,7,9],[10,1,256]]) {
  const bytes=await pngToDDS(png(w,h)),path=`fixture-${i}.dds`;
  writeFileSync(join(process.argv[2],path),bytes);appendLowMips(bytes,path,cache);
}
writeFileSync(join(process.argv[2],'javascript.bin'),merge(cache.parts));
