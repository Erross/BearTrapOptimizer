importScripts('./combat.js?v=20261012-advisor2', './engine.js?v=20261012-advisor2');
self.onmessage=function({data}){
  const {id,path,payload}=data;
  try{
    BearEngine.progress=n=>self.postMessage({id,progress:n});
    const result=path==='roster'?{roster:BearEngine.synthetic(payload)}:BearEngine[path](payload);
    self.postMessage({id,result});
  }catch(e){self.postMessage({id,error:e.message||String(e)});}
};
