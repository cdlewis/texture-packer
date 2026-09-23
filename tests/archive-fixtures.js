import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {initZstd} from '../docs/zstd.js';
import {pack} from '../docs/packer.js';
import {dds,db,file} from './fixtures.js';
import {readArchive} from './archive-reader.js';
await initZstd(readFileSync(new URL('../docs/vendor/zstd/zstd.wasm',import.meta.url)));
const database=db();database.extraFiles=['credits.txt','empty.txt'];
const result=await pack([file('rt64.json',JSON.stringify(database)),file('art/texture.dds',dds()),file('credits.txt','Test credits.\n'.repeat(1000)),file('empty.txt','')]);
const bytes=new Uint8Array(await result.blob.arrayBuffer());
writeFileSync(join(process.argv[2],'test.rtz'),bytes);
for(const [path,data] of Object.entries(readArchive(bytes).files)){
  const output=join(process.argv[2],'expected',path);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,data);
}
