const image = path => /\.(dds|png)$/i.test(path);
const base = path => path.replace(/\.(dds|png)$/i,'');
export function safePath(path) {
  if(typeof path!=='string') throw new Error('File path must be text');
  path=path.replaceAll('\\','/');
  if(!path || path.includes('\0') || path.includes(':') || path.split('/').some(p=>!p || p==='.' || p==='..')) throw new Error(`Invalid relative path: ${path}`);
  return path;
}
function wildcard(path,pattern) {
  let p=0,s=0,star=-1,mark=0;
  while(s<path.length) {
    if(pattern[p]==='?' || pattern[p]===path[s]) {p++;s++;}
    else if(pattern[p]==='*') {star=p++;mark=s;}
    else if(star!==-1) {p=star+1;s=++mark;}
    else return false;
  }
  while(pattern[p]==='*')p++;
  return p===pattern.length;
}
export function resolveDatabase(db,files) {
  if(!db || typeof db!=='object' || !Array.isArray(db.textures)) throw new Error('rt64.json must contain a textures array');
  const config=db.configuration??{};
  if(config.configurationVersion!==undefined && ![1,2,3].includes(config.configurationVersion)) throw new Error('Unsupported database configuration version');
  const auto=config.autoPath??'rt64',defaultOp=config.defaultOperation??'stream';
  if(!['rt64','rice'].includes(auto)) throw new Error('Unknown autoPath setting');
  if(!['stream','preload','stall'].includes(defaultOp)) throw new Error('Unknown default loading operation');
  const filters=db.operationFilters??[];
  if(!Array.isArray(filters)) throw new Error('operationFilters must be an array');
  for(const f of filters) if(!f || typeof f.wildcard!=='string' || !['stream','preload','stall'].includes(f.operation??'stream')) throw new Error('Invalid operation filter');
  const automatic=new Map();
  for(const path of [...files.keys()].filter(image).sort()) {
    const name=path.split('/').at(-1);
    const first=name.indexOf('#'),last=name.lastIndexOf('_');
    const key=auto==='rt64'?name.split('.')[0].toLowerCase():(first!==-1&&last>first?name.slice(first+1,last).toLowerCase():null);
    if(!key)continue;
    const list=automatic.get(key)??[];list.push(path);automatic.set(key,list);
  }
  const selected=new Map(),hashes=new Set();
  const warnings=[];
  for(const t of db.textures) {
    if(!t || !/^[0-9a-fA-F]{1,16}$/.test(t.hashes?.rt64??'')) throw new Error('Each texture needs a valid RT64 hash');
    const hash=BigInt('0x'+t.hashes.rt64).toString(16);
    if(hashes.has(hash)) throw new Error(`Duplicate RT64 hash: ${t.hashes.rt64}`);
    hashes.add(hash);
    let path;
    if(t.path) {
      const wanted=base(safePath(t.path));
      const matches=[...files.keys()].filter(p=>image(p)&&base(p)===wanted);
      path=matches.find(p=>p.toLowerCase().endsWith('.dds'))??matches.find(p=>p.toLowerCase().endsWith('.png'));
      if(!path) throw new Error(`Missing texture or case mismatch: ${t.path}`);
    } else {
      const candidates=automatic.get(auto==='rice'?t.hashes.rice:t.hashes.rt64)??[];
      const choices=candidates.filter(p=>/\.dds$/i.test(p));
      const preferred=choices.length?choices:candidates;
      if(preferred.length>1) throw new Error(`Ambiguous automatic mapping: ${t.hashes.rt64}`);
      path=preferred[0];
      if(!path) {warnings.push(`No matching image for ${t.hashes.rt64}`);continue;}
    }
    let operation=t.operation??'auto';
    if(!['auto','preload','stream','stall'].includes(operation)) throw new Error(`Invalid loading operation: ${path}`);
    if(operation==='auto') {
      operation=defaultOp;
      for(const filter of filters)if(wildcard(path,filter.wildcard.replaceAll('\\','/')))operation=filter.operation??'stream';
    }
    const entry=selected.get(path)??{path,stream:false};
    entry.stream ||= operation==='stream';selected.set(path,entry);
  }
  if(!selected.size)throw new Error('No texture files match rt64.json');
  const extra=db.extraFiles??[];
  if(!Array.isArray(extra))throw new Error('extraFiles must be an array');
  const extras=[];
  for(const raw of extra){const path=safePath(raw);if(!files.has(path))throw new Error(`Missing extra file: ${path}`);if(!['rt64.json','rt64-low-mip-cache.bin'].includes(path)&&!selected.has(path))extras.push(path);}
  return {textures:[...selected.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),extras:[...new Set(extras)].sort(),warnings};
}
