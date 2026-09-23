import {deflateSync,crc32} from 'node:zlib';
export function chunk(type,data) {
  const result=Buffer.alloc(data.length+12);
  result.writeUInt32BE(data.length);result.write(type,4);result.set(data,8);
  result.writeUInt32BE(crc32(result.subarray(4,-4)),result.length-4);return result;
}
export function png(width=8,height=8,pixel=()=>[210,40,80,255]) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)rows.set(pixel(x,y),(width*4+1)*y+1+x*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
