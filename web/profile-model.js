/* Scenario generation only. The game does not infer these stats from power. */
(function(root){
 'use strict';
 const rounded=x=>{const floor=Math.floor(x);return x-floor===.5?(floor%2===0?floor:floor+1):Math.round(x);};
 function profileRoster(p,parseMember,data){
  data=data||(typeof module!=='undefined'?require('./alliance-profiles.json'):null);
  const n=p.n??40,slots=p.join_slots??5,key=p.profile??'top_four';
  if(!Number.isInteger(n)||n<2||n>100||!Number.isInteger(slots)||slots<0||slots>10)throw Error('Illustrative alliance needs 2–100 players and 0–10 joining marches');
  if(!data?.profiles[key])throw Error('Choose a known alliance profile');
  const profile=data.profiles[key],groups=data.bands.map(()=>[]),roster=[],bands=[];
  for(let i=0;i<n;i++){
   const q=(i+.5)/n;let cumulative=0;
   for(let index=0;index<groups.length;index++){cumulative+=profile.weights[index];if(q<cumulative||index===groups.length-1){groups[index].push(i);break;}}
  }
  for(let index=0;index<groups.length;index++){
   const band=data.bands[index],indices=groups[index];if(!indices.length)continue;
   bands.push({label:band.label,players:indices.length,...Object.fromEntries(['town_level','power_m','troops','march_capacity','rally_capacity','tier','attack','lethality'].map(k=>[k,band[k]]))});
   for(let local=0;local<indices.length;local++){
    const x=indices.length>1?local/(indices.length-1):.5;
    const value=field=>band[field][0]+(band[field][1]-band[field][0])*x;
    const total=rounded(value('troops')),infantry=Math.floor(total*.40),cavalry=Math.floor(total*.25),travel=rounded(value('travel_s'));
    const member={name:'Member '+String(indices[local]+1).padStart(2,'0'),troops:total,infantry,cavalry,archers:total-infantry-cavalry,
     power_m:value('power_m'),town_level:rounded(value('town_level')),join_slots:slots,march_capacity:rounded(value('march_capacity')),
     rally_capacity:rounded(value('rally_capacity')),outbound_s:travel,return_s:travel,join_travel_s:travel};
    for(const troop of ['infantry','cavalry','archers'])Object.assign(member,{[troop+'_tier']:band.tier,[troop+'_attack_bonus']:value('attack'),[troop+'_lethality_bonus']:value('lethality')});
    roster.push(parseMember(member));
   }
  }
  return {roster,profile:{key,label:profile.label,description:profile.description,provenance:data.provenance,bands}};
 }
 if(typeof module!=='undefined')module.exports={profileRoster};root.BearProfiles={profileRoster};
})(typeof self!=='undefined'?self:globalThis);
