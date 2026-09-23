import createBasis from './vendor/basis/basis_encoder.js';

let ready;
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function initBasis(binary) {
  return ready ??= (async()=>{
    if(!binary) {
      const response=await fetch(new URL('./vendor/basis/basis_encoder.wasm',import.meta.url));
      if(!response.ok)throw new Error('Could not load the DDS encoder. Reload and try again.');
      binary=new Uint8Array(await response.arrayBuffer());
    }
    const module=await createBasis({wasmBinary:binary,print:()=>{},printErr:()=>{}});
    module.initializeBasis();return module;
  })();
}

export function pngDimensions(bytes) {
  const magic=[137,80,78,71,13,10,26,10];
  if(bytes.length<33 || !magic.every((v,i)=>bytes[i]===v))throw new Error('Invalid PNG signature');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(8)!==13 || view.getUint32(12)!==0x49484452)throw new Error('Invalid PNG header');
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width || !height || width>16384 || height>16384 || width*height>16777216)
    throw new Error('PNG exceeds the conversion limit: 16 million pixels, at most 16384 per side.');
  let ended=false;
  for(let offset=8;offset<bytes.length;) {
    if(offset+12>bytes.length)throw new Error('Truncated PNG chunk');
    const length=view.getUint32(offset),type=view.getUint32(offset+4);
    if(length>bytes.length-offset-12)throw new Error('Truncated PNG chunk');
    if(ended || (offset!==8 && type===0x49484452))throw new Error('Invalid PNG chunk order');
    let crc=0xffffffff;
    for(let i=offset+4;i<offset+8+length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
    if(((crc^0xffffffff)>>>0)!==view.getUint32(offset+8+length))throw new Error('PNG checksum failed');
    if(type===0x6163544c)throw new Error('Animated PNGs are not supported');
    if(type===0x49454e44){if(length)throw new Error('Invalid PNG end chunk');ended=true;}
    offset+=length+12;
  }
  if(!ended)throw new Error('Missing PNG end chunk');
  return {width,height};
}

// Encode UASTC without RDO, then transcode its blocks to BC7. PNG decoding and
// mip generation happen in WASM, without browser canvas color/alpha conversion.
export async function pngToDDS(bytes) {
  const {width,height}=pngDimensions(bytes),basis=await initBasis();
  let encoder=new basis.BasisEncoder(),texture;
  try {
    encoder.setUASTC(true);
    encoder.setPackUASTCFlags(basis.cPackUASTCLevelDefault | basis.cPackUASTCFavorBC7Error);
    encoder.setRDOUASTC(false);
    encoder.setPerceptual(true);
    encoder.setCheckForAlpha(true);
    encoder.setMipGen(true);
    encoder.setMipSRGB(true);
    encoder.setMipWrapping(false);
    encoder.setMipSmallestDimension(1);
    if(!encoder.setSliceSourceImage(0,new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),width,height,true))throw new Error('PNG could not be decoded');
    let capacity=65536;
    for(let w=width,h=height;;w=Math.max(1,w>>1),h=Math.max(1,h>>1)) {
      capacity+=Math.ceil(w/4)*Math.ceil(h/4)*16;
      if(w===1 && h===1)break;
    }
    const encoded=new Uint8Array(capacity),length=encoder.encode(encoded);
    if(!length)throw new Error('DDS encoding failed. Try a smaller image.');
    encoder.delete();encoder=null;
    texture=new basis.BasisFile(encoded.subarray(0,length));
    const count=texture.getNumLevels(0),format=basis.transcoder_texture_format.cTFBC7_RGBA.value;
    if(texture.getNumImages()!==1 || count!==Math.floor(Math.log2(Math.max(width,height)))+1 || !texture.startTranscoding())
      throw new Error('DDS encoder produced an invalid mip chain');
    const levels=[];let size=148;
    for(let i=0;i<count;i++) {
      const level=new Uint8Array(texture.getImageTranscodedSizeInBytes(0,i,format));
      if(!texture.transcodeImage(level,0,i,format,0,0))throw new Error('BC7 conversion failed');
      levels.push(level);size+=level.length;
    }
    const dds=new Uint8Array(size),view=new DataView(dds.buffer);
    const put=(offset,value)=>view.setUint32(offset,value,true);
    put(0,0x20534444);put(4,124);put(8,0xA1007);put(12,height);put(16,width);
    put(20,levels[0].length);put(28,count);put(76,32);put(80,4);put(84,0x30315844);
    put(108,count>1?0x401008:0x1000);
    // RT64 samples color textures as UNORM, including PNGs. Do not mark sRGB.
    put(128,98);put(132,3);put(140,1);put(144,1);
    let offset=148;for(const level of levels){dds.set(level,offset);offset+=level.length;}
    return dds;
  } finally {encoder?.delete();if(texture){texture.close();texture.delete();}}
}
