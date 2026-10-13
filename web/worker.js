importScripts('./combat.js?v=20261012-simple1', './profile-model.js?v=20261012-simple1', './engine.js?v=20261013-alliance1');
let profilesPromise;
self.onmessage=async function({data}){
  const {id,path,payload}=data;
  try{
    BearEngine.progress=n=>self.postMessage({id,progress:n});
    let result;
    if(path==='alliance_roster'){
      profilesPromise=profilesPromise||fetch('./alliance-profiles.json?v=20261012-simple1').then(response=>{if(!response.ok)throw Error('Cannot load alliance profiles');return response.json();});
      result=BearEngine.profile_roster(payload,await profilesPromise);
    }else result=path==='roster'?{roster:BearEngine.synthetic(payload)}:BearEngine[path](payload);
    self.postMessage({id,result});
  }catch(e){self.postMessage({id,error:e.message||String(e)});}
};
