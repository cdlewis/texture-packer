import {deflateSync} from './vendor/fflate.js';
import {compressZstd} from './zstd.js';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function checksum(parts){let crc=0xffffffff;for(const part of parts)for(const byte of part)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function joined(parts,size){if(parts.length===1)return parts[0];const result=new Uint8Array(size);let o=0;for(const p of parts){result.set(p,o);o+=p.length;}return result;}
export class PackArchive {
  constructor(limit){this.limit=limit;this.chunks=[];this.central=[];this.size=0;this.count=0;}
  append(data){this.size+=data.length;if(this.size>this.limit)throw new Error('The archive exceeds 512 MB. Use the native packer for larger packs.');this.chunks.push(data);}
  async add(path,parts,preferDeflate=false){
    const name=new TextEncoder().encode(path);
    if(name.length>65535)throw new Error('Archive filename is too long');
    const size=parts.reduce((n,p)=>n+p.length,0),crc=checksum(parts);
    const compressed=preferDeflate?deflateSync(joined(parts,size),{level:9}):await compressZstd(parts,size);
    const smaller=compressed.length<size;
    const payload=smaller?[compressed]:parts,packed=smaller?compressed.length:size,method=smaller?(preferDeflate?8:93):0;
    const version=method===93?63:20,offset=this.size;
    const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,version,true);lv.setUint16(6,0x800,true);lv.setUint16(8,method,true);
    lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,packed,true);lv.setUint32(22,size,true);lv.setUint16(26,name.length,true);local.set(name,30);
    const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,version,true);cv.setUint16(6,version,true);cv.setUint16(8,0x800,true);cv.setUint16(10,method,true);
    cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,packed,true);cv.setUint32(24,size,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);
    this.append(local);for(const part of payload)this.append(part);
    this.central.push(central);this.count++;
  }
  finish(){
    const start=this.size;for(const part of this.central)this.append(part);
    const length=this.size-start,end=new Uint8Array(22),view=new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);view.setUint16(8,this.count,true);view.setUint16(10,this.count,true);view.setUint32(12,length,true);view.setUint32(16,start,true);this.append(end);
    return new Blob(this.chunks,{type:'application/zip'});
  }
}
