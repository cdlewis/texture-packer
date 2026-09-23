import assert from 'node:assert/strict';
import {inflateRawSync,zstdDecompressSync,crc32} from 'node:zlib';
export function readArchive(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
  assert.equal(v.getUint32(end,true),0x06054b50);
  let at=v.getUint32(end+16,true);
  const count=v.getUint16(end+10,true),files={},methods={};
  for(let i=0;i<count;i++){
    assert.equal(v.getUint32(at,true),0x02014b50);
    const method=v.getUint16(at+10,true),checksum=v.getUint32(at+16,true),packed=v.getUint32(at+20,true),size=v.getUint32(at+24,true),length=v.getUint16(at+28,true),local=v.getUint32(at+42,true);
    const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+length));
    assert.equal(v.getUint32(local,true),0x04034b50);assert.equal(v.getUint16(local+8,true),method);
    assert.equal(v.getUint32(local+14,true),checksum);assert.equal(v.getUint32(local+18,true),packed);assert.equal(v.getUint32(local+22,true),size);
    assert.equal(v.getUint16(at+6,true),method===93?63:20);assert.equal(v.getUint16(local+4,true),method===93?63:20);
    const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),data=bytes.subarray(start,start+packed);
    const decoded=method===93?zstdDecompressSync(data):method===8?inflateRawSync(data):data;
    assert.equal(decoded.length,size);assert.equal(crc32(decoded),checksum);
    files[name]=new Uint8Array(decoded);methods[name]=method;
    at+=46+length+v.getUint16(at+30,true)+v.getUint16(at+32,true);
  }
  assert.equal(at,end);return {files,methods};
}
