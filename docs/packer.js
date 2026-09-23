import { PackArchive } from './archive.js';
import { safePath, resolveDatabase } from './database.js?v=dds-1';
import { readDDS, appendLowMips } from './dds.js';
import { pngToDDS } from './convert.js';
const LIMIT=512*1024*1024;
class Cache {
  constructor(){this.parts=[];this.size=0;}
  push(bytes){this.size+=bytes.length;if(this.size>LIMIT)throw new Error('The mip cache exceeds 512 MB. Use the native packer for this pack.');this.parts.push(bytes);}
}
export async function pack(entries,onProgress=()=>{}) {
  const files=new Map(),folded=new Set();
  for(const {path:raw,file} of entries) {
    const path=safePath(raw);
    if(folded.has(path.toLowerCase()))throw new Error(`Duplicate or case-conflicting file: ${path}`);
    files.set(path,file);folded.add(path.toLowerCase());
  }
  const config=files.get('rt64.json');
  if(!config)throw new Error('Choose the pack folder containing rt64.json and its texture images.');
  if(config.size>32*1024*1024)throw new Error('rt64.json exceeds the 32 MB browser limit.');
  const configBytes=new Uint8Array(await config.arrayBuffer());
  let db;
  try {db=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(configBytes));}
  catch {throw new Error('rt64.json is not valid UTF-8 JSON.');}
  const {textures,extras,warnings,mappings}=resolveDatabase(db,files);
  const converted=new Map(textures.filter(t=>/\.png$/i.test(t.path)).map(t=>[t.path,t.path.replace(/\.png$/i,'.dds')]));
  const outputs=new Set();
  for(const path of [...textures.map(t=>converted.get(t.path)??t.path),...extras]) {
    if(outputs.has(path.toLowerCase()))throw new Error(`DDS conversion would overwrite another file: ${path}`);
    outputs.add(path.toLowerCase());
  }
  // Pin resolved operations when extensions change, including *.png filters.
  for(const {texture,path,operation} of mappings)if(converted.has(path)) {
    texture.path=converted.get(path);texture.operation=operation;
  }
  if(db.extraFiles)db.extraFiles=db.extraFiles.map(path=>converted.get(safePath(path))??path);
  if(textures.length+extras.length+2>60000)throw new Error('This pack has too many files for the browser packer. Use the native tool.');
  const selected=[...textures.map(t=>t.path),...extras];
  if(selected.reduce((n,path)=>n+files.get(path).size,0)>LIMIT)throw new Error('The selected pack exceeds 512 MB. Use the native packer for larger packs.');
  const zip=new PackArchive(LIMIT);
  const cache=new Cache();let done=0,ddsCount=0,pngCount=0;
  for(const t of textures) {
    let bytes=new Uint8Array(await files.get(t.path).arrayBuffer());
    const output=converted.get(t.path)??t.path;
    try {
      if(converted.has(t.path)) {
        onProgress({done,total:selected.length,path:t.path,stage:'converting'});
        bytes=await pngToDDS(bytes);pngCount++;
      }
      readDDS(bytes);ddsCount++;
      if(t.stream)appendLowMips(bytes,output,cache);
    } catch(error){throw new Error(`${t.path}: ${error.message}`);}
    await zip.add(output,[bytes]);onProgress({done:++done,total:selected.length,path:t.path});
  }
  for(const path of extras){await zip.add(path,[new Uint8Array(await files.get(path).arrayBuffer())],true);onProgress({done:++done,total:selected.length,path});}
  await zip.add('rt64.json',[converted.size?new TextEncoder().encode(JSON.stringify(db,null,2)):configBytes]);
  // Rebuild from the selected DDS files; never reuse a potentially stale input cache.
  await zip.add('rt64-low-mip-cache.bin',cache.parts);
  cache.parts=[];
  const blob=zip.finish();
  return {blob,textures:textures.length,ddsCount,pngCount,cacheBytes:cache.size,warnings};
}
