const $=id=>document.getElementById(id);
let worker=null,url=null;
function stop(){worker?.terminate();worker=null;$('select').disabled=false;$('cancel').hidden=true;}
function fail(message){stop();$('status').textContent=message;$('status').classList.add('error');$('progress').hidden=true;}
$('select').addEventListener('click',()=>$('folder').click());
$('cancel').addEventListener('click',()=>{stop();$('status').textContent='Packing cancelled.';$('progress').hidden=true;});
$('folder').addEventListener('change',()=>{
  const files=Array.from($('folder').files);$('folder').value='';if(!files.length)return;
  stop();if(url)URL.revokeObjectURL(url);url=null;
  for(const id of ['download','download-note','issues'])$(id).hidden=true;
  $('issue-list').replaceChildren();$('counts').textContent='';$('result').hidden=false;
  $('status').classList.remove('error');$('status').textContent='Checking your pack…';
  $('progress').hidden=false;$('progress').max=1;$('progress').value=0;
  $('select').disabled=true;$('cancel').hidden=false;
  const name=(files[0].webkitRelativePath.split('/')[0]||'textures').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,100);
  const entries=files.map(file=>({path:file.webkitRelativePath.split('/').slice(1).join('/'),file}));
  try {worker=new Worker(new URL('./worker.js?v=zstd-1',import.meta.url),{type:'module'});}
  catch {fail('This browser could not start the packer. Try a current desktop browser.');return;}
  worker.onerror=()=>fail('The packer stopped unexpectedly. Try a smaller pack or reload this page.');
  worker.onmessage=({data})=>{
    if(data.type==='error')fail(data.message);
    else if(data.type==='progress'){
      $('progress').max=data.total;$('progress').value=data.done;
      $('status').textContent=`Packing ${data.done.toLocaleString()} of ${data.total.toLocaleString()} files`;
    } else if(data.type==='complete'){
      stop();const r=data.result;
      $('status').textContent='Your texture pack is ready';
      $('counts').textContent=`${r.textures.toLocaleString()} textures · ${(r.blob.size/1024/1024).toFixed(1)} MB`;
      $('progress').max=1;$('progress').value=1;
      if(r.warnings.length){$('issues').hidden=false;for(const warning of r.warnings){const li=document.createElement('li');li.textContent=warning;$('issue-list').append(li);}}
      url=URL.createObjectURL(r.blob);$('download').href=url;$('download').download=name+'.rtz';$('download').hidden=false;
      $('download').click();$('download-note').hidden=false;
    }
  };
  worker.postMessage({entries});
});
if(!('webkitdirectory' in $('folder')) || !('Worker' in window)){
  $('result').hidden=false;fail('Folder packing needs a current desktop browser, such as Chrome, Edge, Firefox, or Safari.');$('select').disabled=true;
}
window.addEventListener('pagehide',()=>{stop();if(url)URL.revokeObjectURL(url);});
