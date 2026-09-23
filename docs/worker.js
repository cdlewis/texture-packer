import { pack } from './packer.js?v=dds-1';
self.onmessage=async({data})=>{
  try {self.postMessage({type:'complete',result:await pack(data.entries,progress=>self.postMessage({type:'progress',...progress}))});}
  catch(error){self.postMessage({type:'error',message:error.message||'Packing failed. Try a smaller pack.'});}
};
