import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {initBasis,pngToDDS} from '../docs/convert.js';
import {png} from './png-fixtures.js';
await initBasis(readFileSync(new URL('../docs/vendor/basis/basis_encoder.wasm',import.meta.url)));
const cases=[
  {name:'solid',w:16,h:16,pixel:()=>[210,40,80,255]},
  {name:'transparent',w:8,h:8,pixel:()=>[80,160,220,0]},
  {name:'translucent',w:4,h:4,pixel:()=>[210,40,80,128]},
  {name:'orientation',w:8,h:8,pixel:(x,y)=>x<4?(y<4?[255,0,0,255]:[0,0,255,255]):(y<4?[0,255,0,255]:[255,255,255,255])},
  {name:'gradient',w:32,h:16,pixel:(x,y)=>[x*8,y*16,96,Math.round(x/31*255)]},
  {name:'odd',w:7,h:9,pixel:()=>[80,160,220,128]},
];
for(const c of cases) {
  writeFileSync(join(process.argv[2],c.name+'.dds'),await pngToDDS(png(c.w,c.h,c.pixel)));
  const pixels=new Uint8Array(c.w*c.h*4);
  for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++)pixels.set(c.pixel(x,y),(y*c.w+x)*4);
  writeFileSync(join(process.argv[2],c.name+'.rgba'),pixels);
}
writeFileSync(join(process.argv[2],'cases.json'),JSON.stringify(cases));
