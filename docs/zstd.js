let ready;
const LEVEL=9;
export function initZstd(binary) {
  if(!ready)ready=(async()=>{
    const {Module}=await import('./vendor/zstd/zstd.js');
    if(!binary){
      const response=await fetch(new URL('./vendor/zstd/zstd.wasm',import.meta.url));
      if(!response.ok)throw new Error('Could not load the Zstandard compressor. Reload the page and try again.');
      binary=await response.arrayBuffer();
    }
    await new Promise((resolve,reject)=>{
      Module.onRuntimeInitialized=resolve;
      Module.onAbort=reason=>reject(new Error(`Zstandard initialization failed: ${reason}`));
      Module.instantiateWasm=(imports,receive)=>{
        WebAssembly.instantiate(binary,imports).then(({instance})=>receive(instance)).catch(reject);
        return {};
      };
      Module.init(binary);
    });
    return Module;
  })();
  return ready;
}
export async function compressZstd(parts,size) {
  const module=await initZstd();
  let src=0,dst=0;
  try {
    const bound=module._ZSTD_compressBound(size);
    src=module._malloc(Math.max(1,size));
    dst=module._malloc(bound);
    if(!src || !dst)throw new Error('Not enough memory to compress this pack. Use the native packer for larger packs.');
    let offset=src;
    for(const part of parts){module.HEAPU8.set(part,offset);offset+=part.length;}
    const result=module._ZSTD_compress(dst,bound,src,size,LEVEL);
    if(module._ZSTD_isError(result))throw new Error('Zstandard compression failed. No pack was created.');
    return module.HEAPU8.slice(dst,dst+result);
  } finally {
    if(dst)module._free(dst);
    if(src)module._free(src);
  }
}
