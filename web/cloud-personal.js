(function(){
'use strict';
const $=id=>document.getElementById(id);let connected=null,busy=false;
const status=text=>{$('cloudstatus').textContent=text;};
function reset(){connected=null;$('cloudsave').disabled=true;$('cloudcode').value='';status('Enter your private player code, then load your shared profile.');}
window.BearCloudSelectionChanged=reset;
async function action(fn){if(busy)return;busy=true;$('cloudload').disabled=true;$('cloudsave').disabled=true;try{await fn();}catch(error){status(error.message);}finally{busy=false;$('cloudload').disabled=false;$('cloudsave').disabled=!connected;}}
$('cloudload').onclick=()=>action(async()=>{
 const player=window.BearPersonalProfiles?.current();if(!player)throw Error('Choose your player name first.');
 const key=$('cloudcode').value.trim();if(!key)throw Error('Enter the player code supplied by your organizer.');
 connected=null;const data=await BearCloud.request('/api/players/'+player.governorId,key);
 if($('cloudcode').value.trim()!==key)throw Error('Code changed. Load again with the intended code.');
 if(window.BearPersonalProfiles.current()?.governorId!==player.governorId)throw Error('Player changed. Load again for the selected name.');
 if(data.input){BearPersonalModel.build(data.input);window.BearPersonalProfiles.load(data.input);}
 connected={id:player.governorId,key,revision:data.revision};
 status(data.input?'Shared profile loaded · saved '+new Date(data.updatedAt).toLocaleString()+'.':'Code accepted. No shared setup yet: enter your numbers, build your setup, then save online.');
});
$('cloudsave').onclick=()=>action(async()=>{
 const p=window.BearPersonalProfiles?.current(),session=connected;
 if(!session||session.id!==p?.governorId)throw Error('Load with your player code before saving.');
 if($('cloudcode').value.trim()!==session.key)throw Error('Player code changed. Load again before saving.');
 const input=window.BearPersonalProfiles.read();BearPersonalModel.build(input);
 const result=await BearCloud.request('/api/players/'+session.id,session.key,'PUT',{input,revision:session.revision});
 if(connected!==session)return;
 connected.revision=result.revision;status('Saved online · '+new Date(result.updatedAt).toLocaleString()+'. You can load this profile on another device with your code.');
});
$('cloudcode').addEventListener('input',()=>{connected=null;$('cloudsave').disabled=true;});
})();
