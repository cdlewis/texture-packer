import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
class Element{
  constructor(){this.listeners={};this.children=[];this.classList={add(){},remove(){}};}
  addEventListener(event,fn){this.listeners[event]=fn;}
  click(){this.clicks=(this.clicks??0)+1;this.listeners.click?.();}
  replaceChildren(){this.children=[];}
  append(child){this.children.push(child);}
}
test('page IDs, cancel, successful download, repeat selection, and error recovery',async()=>{
  const html=readFileSync('docs/index.html','utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const get=id=>{assert.ok(elements.has(id),`Missing page element ${id}`);return elements.get(id);};
  get('folder').webkitdirectory=true;
  globalThis.document={getElementById:get,createElement:()=>new Element()};
  globalThis.window={Worker:true,addEventListener(){}};
  const workers=[];globalThis.Worker=class{constructor(){workers.push(this);}postMessage(data){this.data=data;}terminate(){this.stopped=true;}};
  await import('../docs/app.js');
  const select=()=>{get('folder').files=[{webkitRelativePath:'MyPack/rt64.json'}];get('folder').listeners.change();};
  select();assert.equal(get('select').disabled,true);get('cancel').click();assert.equal(workers[0].stopped,true);assert.equal(get('select').disabled,false);
  select();workers[1].onmessage({data:{type:'complete',result:{textures:1,warnings:[],blob:new Blob(['zip'])}}});
  assert.equal(get('download').download,'MyPack.rtz');assert.equal(get('download').clicks,1);
  select();assert.equal(get('download').hidden,true);workers[2].onmessage({data:{type:'error',message:'Missing texture'}});
  assert.equal(get('status').textContent,'Missing texture');assert.equal(get('select').disabled,false);
});
