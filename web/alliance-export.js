/* Downloads contain saved provider observations, never simulator estimates. */
(function(root){
 'use strict';
 const common=['governor_id','name','x','y','power','troop_power','troop_power_rank','town_center_level','kills','vip','alliance_tag','kingdom_id','snapshot_at','profile_status','profile_fresh','profile_cached_at','profile_age_seconds'];
 function validate(snapshot){
  if(snapshot?.schema!=='mightpulse-alliance-snapshot'||snapshot.version!==1||!Array.isArray(snapshot.members)||!snapshot.members.length)
   throw Error('No saved alliance API data is available.');
  return snapshot;
 }
 function flatten(value,prefix,out){
  if(value&&typeof value==='object'&&!Array.isArray(value)){
   for(const [key,item]of Object.entries(value))flatten(item,prefix?prefix+'.'+key:key,out);
  }else out[prefix]=Array.isArray(value)?JSON.stringify(value):value;
 }
 function rows(snapshot){
  validate(snapshot);
  const boards=snapshot.troop_power_board?.boards??(snapshot.troop_power_board?.board?[snapshot.troop_power_board.board]:[]);
  return snapshot.members.map(member=>{
   const id=String(member.governor_id??member.fid),profile=snapshot.profiles?.[id]??{},player=profile.player??{};
   const row={governor_id:id,name:player.nick_name??member.nick_name,x:player.x,y:player.y,
    power:player.power??member.power,troop_power:null,troop_power_rank:null,
    town_center_level:player.town_center_level??member.town_center_level,kills:player.kills??member.kills,
    vip:player.vip,alliance_tag:snapshot.alliance_tag,kingdom_id:snapshot.kingdom_id,snapshot_at:snapshot.generated_at,
    profile_status:snapshot.profile_status?.[id],profile_fresh:profile.fresh,
    profile_cached_at:profile.cached_at,profile_age_seconds:profile.age_seconds};
   flatten(snapshot.alliance??{},'alliance',row);flatten(snapshot.roster_freshness??{},'roster_freshness',row);
   flatten(member,'roster',row);flatten(profile,'profile',row);
   for(const board of boards){
    const found=(board.rows??[]).find(entry=>entry.governor_id!=null?String(entry.governor_id)===id:
     entry.uid!=null&&member.uid!=null&&String(entry.uid)===String(member.uid));
    if(!found)continue;
    flatten(found,'boards.'+(board.key??board.type),row);
    row['boards.'+(board.key??board.type)+'.captured_at']=board.captured_at;
    if(board.key==='troop_power'){row.troop_power=found.score;row.troop_power_rank=found.rank;}
   }
   for(const entry of (profile.ranks??player.ranks)?.leaderboards??[]){
    const key=String(entry.key??entry.name??'unnamed').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    flatten(entry,'leaderboards.'+key,row);
    if(key==='troop_power'&&row.troop_power==null){row.troop_power=entry.value;row.troop_power_rank=entry.kingdom_rank;}
   }
   return row;
  });
 }
 function cell(value){
  if(value==null)return '';
  // Preserve Unicode and quotes; prevent names being interpreted as formulas.
  const text=typeof value==='string'&&/^[\s]*[=+@-]/.test(value)?"'"+value:String(value);
  return '"'+text.replace(/"/g,'""')+'"';
 }
 function csv(snapshot){
  const data=rows(snapshot),extra=[...new Set(data.flatMap(row=>Object.keys(row)))].filter(key=>!common.includes(key)).sort();
  const columns=[...common,...extra];
  return '\ufeff'+[columns,...data.map(row=>columns.map(key=>row[key]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
 }
 function filename(snapshot,extension){
  validate(snapshot);
  const tag=String(snapshot.alliance_tag??'alliance').replace(/[^a-zA-Z0-9_-]/g,'_');
  const day=String(snapshot.generated_at??'undated').slice(0,10).replace(/[^a-zA-Z0-9_-]/g,'_');
  return tag+'-'+snapshot.kingdom_id+'-api-data-'+day+'.'+extension;
 }
 const api={rows,csv,filename,json:snapshot=>JSON.stringify(validate(snapshot),null,2)+'\n'};
 root.BearAllianceExport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
