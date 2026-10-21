/* Check shared data automatically; preserve edits made before or during a request. */
(function(){
'use strict';
const $=id=>document.getElementById(id),profile=()=>window.BearPersonalProfiles;
let sequence=0,session=null,online=null,pending=null,saving=false,conflict=false;
function status(title,text,kind='idle'){
 $('cloudbadge').textContent=title;$('cloudstatus').textContent=text;$('cloudfeedback').textContent=text;
 $('personalresultsave').textContent=text;$('cloudstate').dataset.state=kind;
}
function controls(){
 $('cloudsave').disabled=saving;$('cloudsave').textContent=saving?'Saving online…':'Save online & show setup';
 $('cloudsave').setAttribute('aria-busy',String(saving));$('cloudload').disabled=saving;$('cloudretry').disabled=saving;
 $('cloudload').hidden=!online?.input||(!conflict&&!profile()?.hasDraft());
 $('cloudreplace').hidden=!conflict;$('cloudreplace').disabled=saving;
}
function check(force=false){
 const p=profile()?.current(),ticket=sequence,stamp=profile()?.stamp();
 if(!p){status('Choose your name to begin','Your saved online setup will be checked automatically.');controls();return Promise.resolve(null);}
 $('cloudretry').hidden=true;status('Checking online setup…','You can fill in your setup while we check for saved data.','checking');
 const task=(async()=>{
  try{
   const data=await BearCloud.request('/api/players/'+p.governorId,'');
   if(ticket!==sequence||profile().current()?.governorId!==p.governorId)return null;
   if(!Number.isSafeInteger(data.revision))throw Error('The online service returned an invalid profile. Please retry.');
   if(data.input)BearPersonalModel.build(data.input);
   session={id:p.governorId,revision:data.revision};online=data;
   const editing=profile().hasDraft()||profile().stamp()!==stamp;
   if(data.input&&((force&&profile().stamp()===stamp)||!editing)){
    conflict=false;
    profile().load(data.input);
    status('Online setup loaded','Saved online '+new Date(data.updatedAt).toLocaleString()+'. Review or edit your numbers, then save to get your setup.','saved');
   }else if(conflict){
    status('Online copy changed','Someone saved a newer setup. Your entries are preserved. Choose the online copy or explicitly replace it with your entries below.','error');
   }else if(data.input){
    status('Using this device’s draft','Your entries are preserved. An online copy also exists, saved '+new Date(data.updatedAt).toLocaleString()+'. Keep editing these, or use the online copy below.','draft');
   }else status('New online setup','Fill in your troops, limits and heroes, then choose Save online & show setup.','ready');
   controls();return session;
  }catch(error){
   if(ticket===sequence){session=null;$('cloudretry').hidden=false;status('Online check failed',error.message+' You can still preview your setup on this device.','error');controls();}
   return null;
  }
 })();
 pending=task;task.then(()=>{if(pending===task)pending=null;});return task;
}
window.BearCloudSelectionChanged=()=>{sequence++;session=null;online=null;pending=null;conflict=false;controls();return check();};
window.BearCloudDraftChanged=()=>{
 if(!profile()?.current())return;
 status('Unsaved online changes','Draft saved on this device. Choose Save online & show setup when your entries are ready.','draft');controls();
};
$('cloudretry').onclick=()=>check();
$('cloudload').onclick=()=>check(true);
$('cloudreplace').onclick=async()=>{
 const ticket=sequence;const latest=await check();
 if(!latest||ticket!==sequence)return;conflict=false;return window.BearCloudSave();
};
window.BearCloudSave=async()=>{
 if(saving)return;
 if(conflict){status('Choose which copy to keep','The online setup changed. Choose the online copy or replace it with your entries in Step 1.','error');$('cloudstate').scrollIntoView({behavior:'smooth',block:'center'});return;}
 const p=profile()?.current();
 if(!profile()?.build({scroll:false})){
  status('Check the highlighted field','Complete the highlighted field, then try Save online & show setup again.','error');return;
 }
 const input=profile().read(),stamp=profile().stamp(),ticket=sequence;
 saving=true;controls();status('Saving online…','Saving your setup. This should take only a few seconds.','checking');
 try{
  if(pending)await pending;
  if(ticket!==sequence)return;
  if(!session||session.id!==p.governorId)await check();
  if(ticket!==sequence||!session)return;
  const result=await BearCloud.request('/api/players/'+p.governorId,'','PUT',{input,revision:session.revision});
  if(ticket!==sequence)return;
  session.revision=result.revision;online={input,revision:result.revision,updatedAt:result.updatedAt};profile().markSaved(input);
  if(profile().stamp()!==stamp){status('Earlier entries saved','Your earlier entries were saved online. Changes made while saving are still a draft—save again when ready.','draft');return;}
  status('Saved online','Saved online '+new Date(result.updatedAt).toLocaleString()+'. Your joining setup is below. You can load these entries on another device by selecting your name.','saved');
  $('personalresult').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){
  if(ticket!==sequence)return;
  conflict=/changed|Load again/i.test(error.message);
  status('Not saved online',error.message+' Your entries are still on this device. '+(conflict?'Choose which copy to keep in Step 1.':'Retry saving, or preview without saving online.'),'error');
  if(conflict){$('cloudretry').hidden=false;$('cloudstate').scrollIntoView({behavior:'smooth',block:'center'});}
 }finally{saving=false;controls();}
};
controls();if(profile()?.current())check();
})();
