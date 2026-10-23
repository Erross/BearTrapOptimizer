/* Each row is an incremental upgrade cost and score increase, never account power.
 * References are versioned below. Stage mode is opt-in because server rollout varies.
 */
(function(root){'use strict';
const slots=['Head / Cap','Armor / Coat','Legs / Pants','Staff / Weapon','Ring / Belt','Accessory / Watch'];
const costs=[
 [1500,15,0,1125],[3800,40,0,1875],[7000,70,0,3000],[9700,95,0,4500],[1000,10,45,5100],[1000,10,50,5400],
 [1500,15,60,3230],[1500,15,70,3230],[6500,65,40,3225],[8000,80,50,3225],[10000,95,60,3440],[11000,110,70,3440],[13000,130,85,4085],[15000,160,100,4085],
 [22000,220,40,6250],[23000,230,40,6250],[25000,250,45,6250],[26000,260,45,6250],[28000,280,45,6250],[30000,300,55,6250],[32000,320,55,6250],[35000,340,55,6250],[38000,390,55,6250],[43000,430,75,6250],[45000,460,80,6250],[48000,500,85,6250],
 [60000,600,120,9000],[70000,700,140,9000],[80000,800,160,9000],[90000,900,180,9000],
 [108000,1080,220,12000],[114000,1140,230,12000],[121000,1210,240,12000],[128000,1280,250,12000],[154000,1540,300,12000],[163000,1630,320,12000],[173000,1730,340,12000],[183000,1830,360,12000],
 [220000,2200,430,12000],[233000,2330,460,12000],[247000,2470,490,12000],[264000,2640,520,12000]
];
const names=['Not crafted','Green 0★','Green 1★','Blue 0★','Blue 1★','Blue 2★','Blue 3★','Purple 0★','Purple 1★','Purple 2★','Purple 3★','Purple T1 0★','Purple T1 1★','Purple T1 2★','Purple T1 3★','Gold 0★','Gold 1★','Gold 2★','Gold 3★','Gold T1 0★','Gold T1 1★','Gold T1 2★','Gold T1 3★','Gold T2 0★','Gold T2 1★','Gold T2 2★','Gold T2 3★','Gold T3 0★','Gold T3 1★','Gold T3 2★','Gold T3 3★','Red 0★','Red 1★','Red 2★','Red 3★','Red T1 0★','Red T1 1★','Red T1 2★','Red T1 3★','Red T2 0★','Red T2 1★','Red T2 2★','Red T2 3★'];
const charmCosts=[[5,5],[40,15],[60,40],[80,100],[100,200],[120,300],[140,400],[200,400],[300,400],[420,420],[560,420],[580,600],[610,780],[645,960],[685,1140],[730,1320],[780,1500],[835,1680],[895,1860],[960,2040],[1030,2220]];
const charmScore=[0,625,1875,5000,13750,25000,37500,50000,63000,77000,92000,108000,126000,147000,171000,198000,228000,261000,297000,336000,378000,423000];
function empty(){return {stages:false,governor:slots.map(()=>({level:null,stage:0})),charms:Array.from({length:18},()=>({level:null,stage:0})),heroes:Array.from({length:12},()=>({rarity:'unknown',enhancement:0,mastery:0}))};}
function clean(g){const out=empty();if(!g)return out;out.stages=g.stages===true;
 for(const [key,count,max]of [['governor',6,costs.length],['charms',18,21]]){if(!Array.isArray(g[key])||g[key].length!==count)throw Error('Enter all '+count+' '+key+' slots, or mark them Unknown.');out[key]=g[key].map(v=>{if(v.level===null||v.level==='')return {level:null,stage:0};const n=Number(v.level),s=Number(v.stage||0),eligible=key==='charms'?n>=5:n>=26;if(!Number.isInteger(n)||n<0||n>max||!Number.isInteger(s)||s<0||s>4||(!out.stages||!eligible)&&s!==0)throw Error('Check gear level and partial stage selections.');return {level:n,stage:s};});}
 if(!Array.isArray(g.heroes)||g.heroes.length!==12)throw Error('Enter the 12 hero gear slots, or mark them Unknown.');
 out.heroes=g.heroes.map(v=>{if(!['unknown','other','mythic','red'].includes(v.rarity))throw Error('Choose a hero gear rarity.');const e=Number(v.enhancement),m=Number(v.mastery);if(!Number.isInteger(e)||e<0||e>200||!Number.isInteger(m)||m<0||m>20)throw Error('Hero gear enhancement must be 0–200 and mastery 0–20.');if(v.rarity==='mythic'&&e>100)throw Error('Mythic enhancement stops at 100; select Red for higher gear.');return {rarity:v.rarity,enhancement:e,mastery:m,imbueReady:v.imbueReady===true};});return out;
}
function actions(profile){
 const g=clean(profile.gear),result=[];
 const possible=Object.fromEntries(root.KvKCatalog.resources.map(r=>[r.id,profile.resources[r.id].stock-profile.resources[r.id].reserve+profile.offers.filter(o=>o.enabled&&o.resource===r.id).reduce((n,o)=>n+o.quantity*o.remaining,0)]));
 function chain(key,name,current,rows,make,pieces){if(current.level===null)return;let previous=null,spent={},step=0;for(let level=current.level+1;level<=rows.length;level++){
  const row=rows[level-1],parts=g.stages&&(key.startsWith('charm')?level>5:level>26)?5:1,start=level===current.level+1?current.stage:0;
  for(let part=start;part<parts;part++){
   const {consumes,score}=make(row,level,parts),id='gear_'+key+'_'+level+'_'+part;
   for(const [r,n]of Object.entries(consumes))spent[r]=(spent[r]||0)+n;
   if(Object.entries(spent).some(([r,n])=>n>(possible[r]||0)))return;
   const displayTo=(key.startsWith('charm')?'Lv '+level:names[level])+(parts===5?' · step '+(part+1)+'/5':'');step++;result.push({group:key,pieces,step,displayTo,id,name:name+' → '+(key.startsWith('charm')?'Lv '+level:names[level])+(parts===5?' · step '+(part+1)+'/5':''),consumes,points:key.startsWith('charm')?[score*70,0,score*70,score*70,0]:[0,0,0,0,score*36],limit:pieces.length,dependsOn:previous});previous=id;
  }
 }}
 function groups(values,kind){const by=new Map();values.forEach((v,i)=>{if(v.level===null)return;const key=kind+'_'+v.level+'_'+v.stage;if(!by.has(key))by.set(key,{key,state:v,pieces:[]});by.get(key).pieces.push(kind==='gov'?'Governor '+slots[i]:slots[Math.floor(i/3)]+' charm '+(i%3+1));});return [...by.values()];}
 for(const v of groups(g.governor,'gov'))chain(v.key,'Governor gear',v.state,costs,(row,l,n)=>({consumes:{satin:row[0]/n,threads:row[1]/n,...(row[2]?{visions:row[2]/n}:{})},score:row[3]/n}),v.pieces);
 for(const v of groups(g.charms,'charm'))chain(v.key,'Charms',v.state,charmCosts,(row,l,n)=>({consumes:{guides:row[0]/n,designs:row[1]/n},score:(charmScore[l]-charmScore[l-1])/n}),v.pieces);
 g.heroes.forEach((v,i)=>{if(v.rarity==='red'&&v.imbueReady){const index=[120,140,160,180,200].indexOf(v.enhancement);if(index>=0&&v.mastery>=10){const mithril=[10,20,30,40,50][index],spares=[3,5,5,10,10][index];result.push({id:'gear_imbue_'+i,name:['Infantry','Cavalry','Archer'][Math.floor(i/4)]+' '+['helmet','gloves','chest','boots'][i%4]+' · unpaid Red +'+(v.enhancement-100)+' imbuement',consumes:{mithril,spares},points:[0,0,0,mithril*40000,mithril*40000],limit:1,dependsOn:null});}}if(!['mythic','red'].includes(v.rarity)||v.enhancement<20)return;let previous=null,hammers=0,spares=0;for(let l=v.mastery+1;l<=20;l++){const consume={hammer:l*10,...(l>10?{spares:l-10}:{})};hammers+=consume.hammer;spares+=consume.spares||0;if(hammers>(possible.hammer||0)||spares>(possible.spares||0))break;const id='gear_mastery_'+i+'_'+l;result.push({id,name:['Infantry','Cavalry','Archer'][Math.floor(i/4)]+' '+['helmet','gloves','chest','boots'][i%4]+' → mastery '+l,consumes:consume,points:[0,0,0,consume.hammer*4000,consume.hammer*4000],limit:1,dependsOn:previous});previous=id;}});
 return result;
}
root.KvKGear={slots,names,costs,charmCosts,charmScore,empty,clean,actions,sources:[
 ['Governor material costs','https://ks-toolkit.com/data/gear/governor-gear/'],['Event-specific upgrade scores (first Mythic tiers)','https://kingshotmastery.com/events/kingdom-of-power-kvk-event'],['Charm cumulative scores and materials','https://kingshotdata.com/database/governor-charm/'],['Mastery forging costs and prerequisites','https://kingshotdata.com/database/mastery-forging/'],['Red imbuement material costs','https://www.kingshotcommand.com/tools/mastery-forging'],['Optional partial-stage system','https://kingshotoptimizer.com/charms/references/']
]};
})(typeof globalThis!=='undefined'?globalThis:this);
