importScripts('./engine.js');
self.onmessage=function({data}){
  const {id,path,payload}=data;
  try{
    const result=path==='roster'?{roster:BearEngine.synthetic(payload)}:BearEngine[path](payload);
    self.postMessage({id,result});
  }catch(e){self.postMessage({id,error:e.message||String(e)});}
};
