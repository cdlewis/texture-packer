export function dds({width=256,height=128,mips=9,format=98,legacy=null}={}) {
  const blocks=[71,72,74,75,77,78,80,81,83,84,95,96,98,99];
  const unit=[71,72,80,81].includes(format)?8:blocks.includes(format)?16:format===61?1:4;
  const block=blocks.includes(format)?4:1;
  const header=legacy?128:148;
  let size=header;
  for(let i=0;i<mips;i++)size+=Math.ceil(Math.max(1,width>>i)/block)*Math.ceil(Math.max(1,height>>i)/block)*unit;
  const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);
  const put=(o,n)=>v.setUint32(o,n,true);
  put(0,0x20534444);put(4,124);put(8,0x21007);put(12,height);put(16,width);put(28,mips);put(76,32);put(80,4);put(108,0x401008);
  bytes.set(new TextEncoder().encode(legacy??'DX10'),84);
  if(!legacy){put(128,format);put(132,3);put(140,1);}
  for(let i=header;i<size;i++)bytes[i]=(i*7+13)&255;
  return bytes;
}
export const hash='0123456789abcdef';
export const db=(textures=[{hashes:{rt64:hash},path:'art/texture'}],configuration={})=>({configuration:{configurationVersion:3,hashVersion:5,...configuration},textures});
export const file=(path,bytes)=>({path,file:new Blob([bytes])});
export function cacheWriter(){return {size:0,parts:[],push(bytes){this.parts.push(bytes);this.size+=bytes.length;}};}
export const merge=parts=>{const all=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let o=0;for(const b of parts){all.set(b,o);o+=b.length;}return all;};
