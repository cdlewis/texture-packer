const BC = new Map([[71,8],[72,8],[74,16],[75,16],[77,16],[78,16],[80,8],[81,8],[83,16],[84,16],[95,16],[96,16],[98,16],[99,16]]);
const PIXEL = new Map([[2,16],[3,16],[4,16],[6,12],[7,12],[8,12],[10,8],[11,8],[12,8],[13,8],[14,8],[16,8],[17,8],[18,8],[24,4],[25,4],[26,4],[28,4],[29,4],[30,4],[31,4],[32,4],[34,4],[35,4],[36,4],[37,4],[38,4],[41,4],[42,4],[43,4],[49,2],[50,2],[51,2],[52,2],[54,2],[56,2],[57,2],[58,2],[59,2],[61,1],[62,1],[63,1],[64,1],[65,1],[85,2],[86,2],[87,4],[88,4],[91,4],[93,4],[115,2]]);
export function readDDS(bytes) {
  if (bytes.length < 128) throw new Error('Truncated DDS header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u = offset => view.getUint32(offset, true);
  if (u(0) !== 0x20534444 || u(4) !== 124 || u(76) !== 32) throw new Error('Invalid DDS header');
  const width = u(16), height = u(12), mips = Math.max(1,u(28));
  if (!width || !height || width > 16384 || height > 16384 || mips > Math.floor(Math.log2(Math.max(width,height))) + 1) throw new Error('Invalid DDS dimensions or mip count');
  if (u(24) > 1 || (u(112) & (0x200 | 0x200000))) throw new Error('DDS arrays, cubemaps, and volume textures are not supported');
  let format, header = 128;
  const flags = u(80), code = String.fromCharCode(...bytes.subarray(84,88));
  if ((flags & 4) && code === 'DX10') {
    if (bytes.length < 148) throw new Error('Truncated DX10 header');
    format = u(128); header = 148;
    if (u(132) !== 3 || u(140) !== 1 || (u(136) & 6)) throw new Error('Only a single 2D DDS texture is supported');
  } else if (flags & 4) {
    format = {DXT1:71,DXT2:74,DXT3:74,DXT4:77,DXT5:77,ATI1:80,BC4U:80,BC4S:81,ATI2:83,BC5U:83,BC5S:84}[code];
    format ??= {23:85,25:86,26:115,28:61,31:24,36:11,110:13,111:54,112:34,113:10,114:41,115:16,116:2}[u(84)];
  } else {
    const masks = [u(92),u(96),u(100),u(104)];
    const match = values => values.every((v,i)=>v===masks[i]);
    if (flags & 0x40) {
      if (u(88)===32) {
        if (match([255,65280,16711680,4278190080])) format=28;
        else if (match([16711680,65280,255,4278190080])) format=87;
        else if (match([16711680,65280,255,0])) format=88;
        else if (match([1072693248,1047552,1023,3221225472])) format=24;
        else if (match([65535,4294901760,0,0])) format=35;
        else if (match([4294967295,0,0,0])) format=41;
      } else if (u(88)===16) {
        if (match([63488,2016,31,0])) format=85;
        else if (match([31744,992,31,32768])) format=86;
        else if (match([3840,240,15,61440])) format=115;
      }
    } else if (flags & 0x20000) {
      if (u(88)===16 && match([65535,0,0,0])) format=56;
      else if ([8,16].includes(u(88)) && match([255,0,0,65280])) format=49;
      else if (u(88)===8 && match([255,0,0,0])) format=61;
    } else if ((flags & 2) && u(88)===8) format=65;
    else if (flags & 0x80000) {
      if (u(88)===32 && match([255,65280,16711680,4278190080])) format=31;
      else if (u(88)===32 && match([65535,4294901760,0,0])) format=37;
      else if (u(88)===16 && match([255,65280,0,0])) format=51;
    }
  }
  const block = BC.has(format) ? 4 : 1;
  const unit = BC.get(format) ?? PIXEL.get(format);
  if (!unit) throw new Error(`Unsupported DDS format${format ? ` (DXGI ${format})` : ''}`);
  const levels = []; let offset = header;
  for (let i=0;i<mips;i++) {
    const w=Math.max(1,width>>i),h=Math.max(1,height>>i);
    const pitch=Math.ceil(w/block)*unit,rows=Math.ceil(h/block);
    levels.push({offset,pitch,rows}); offset+=pitch*rows;
  }
  if (offset>bytes.length) throw new Error('DDS mip data is truncated');
  return {width,height,mips,format,block,levels};
}
export function appendLowMips(bytes, path, cache) {
  const d=readDDS(bytes);
  let start=0;
  while (start<d.mips-1 && (d.width>>start)*(d.height>>start)>96*96) start++;
  const align=(n,a)=>Math.ceil(n/a)*a;
  const width=align(Math.max(1,d.width>>start),d.block),height=align(Math.max(1,d.height>>start),d.block);
  const count=d.mips-start,pathBytes=new TextEncoder().encode(path);
  const sizes=[],pitches=[],rows=[];
  for(let i=0;i<count;i++) {
    pitches.push(align(d.levels[start+i].pitch,256));
    rows.push(Math.ceil(Math.max(1,height>>i)/d.block));
    sizes.push(rows[i]*pitches[i]);
  }
  const header=new Uint8Array(28+count*8),view=new DataView(header.buffer);
  [0x434d4f4c,3,width,height,d.format,count,pathBytes.length,...sizes,...pitches].forEach((v,i)=>view.setUint32(i*4,v,true));
  cache.push(header); cache.push(pathBytes);
  for(let i=0;i<count;i++) {
    cache.push(new Uint8Array((512-cache.size%512)%512));
    const level=d.levels[start+i];
    if(level.offset+(rows[i]-1)*level.pitch+level.pitch>bytes.length) throw new Error('DDS mip data is too short for RT64 cache alignment');
    const data=new Uint8Array(sizes[i]);
    for(let y=0;y<rows[i];y++) data.set(bytes.subarray(level.offset+y*level.pitch,level.offset+(y+1)*level.pitch),y*pitches[i]);
    cache.push(data);
  }
}
