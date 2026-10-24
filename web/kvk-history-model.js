/* Read snapshots without normalizing old inventories into invented zero values. */
(function(root){'use strict';
const C=root.KvKCatalog,G=root.KvKGear;
const groups={materials:'Materials & hero items',speedups:'Speedups',currencies:'Store currencies',governor:'Governor gear',charms:'Charms',hero:'Hero gear',exclusive:'Exclusive gear & widgets',reserves:'Keep-back reserves',days:'Daily scores & targets'};
const value=(p,path)=>{let v=p;for(const key of path)v=v?.[key];return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;};
function metrics(records,group){
 const list=[],add=(id,name,unit,path,format)=>list.push({id,name,unit,read:p=>value(p,path),format});
 if(group==='materials'||group==='speedups')for(const r of C.resources.filter(r=>(r.unit==='minutes')===(group==='speedups')))add(r.id,r.name,r.unit,['resources',r.id,'stock']);
 if(group==='currencies')for(const w of C.wallets)add(w.id,w.name,'currency',['wallets',w.id,'balance']);
 if(group==='reserves'){for(const r of C.resources)add(r.id,r.name+' · keep back',r.unit,['resources',r.id,'reserve']);for(const w of C.wallets)add('wallet_'+w.id,w.name+' · keep back','currency',['wallets',w.id,'reserve']);}
 if(group==='governor')G.slots.forEach((s,i)=>add('gov_'+i,s,'gear level',['gear','governor',i,'level'],n=>G.names[n]||'Level '+n));
 if(group==='charms')for(let i=0;i<18;i++)add('charm_'+i,G.slots[Math.floor(i/3)]+' charm '+(i%3+1),'level',['gear','charms',i,'level']);
 if(group==='hero')for(let i=0;i<12;i++){const name=['Infantry','Cavalry','Archer'][Math.floor(i/4)]+' '+['helmet','gloves','chest','boots'][i%4];add('mastery_'+i,name+' · mastery','level',['gear','heroes',i,'mastery']);add('enhance_'+i,name+' · enhancement','progress index',['gear','heroes',i,'enhancement']);for(const metric of list.slice(-2)){const read=metric.read;metric.read=p=>(p.gear?.heroes?.[i]?.rarity==='other'&&metric.id.startsWith('enhance_')||['mythic','red'].includes(p.gear?.heroes?.[i]?.rarity))?read(p):null;}}
 if(group==='exclusive'){const heroes=new Map();for(const record of records.slice().sort((a,b)=>a.revision-b.revision))for(const h of record.input?.gear?.exclusive||[])if(h.id&&h.hero)heroes.set(h.id,h.hero);for(const [id,name]of heroes)for(const field of ['widgets','level'])list.push({id:id+'_'+field,name:name+(field==='widgets'?' · widgets owned':' · exclusive gear'),unit:field==='widgets'?'widgets':'level',read:p=>{const h=p.gear?.exclusive?.find(h=>h.id===id);return value(h,[field]);}});}
 if(group==='days')for(let d=0;d<5;d++)for(const [field,label]of [['targets','target'],['actual','already scored'],['baseline','expected other points']])add(field+d,'Day '+(d+1)+' · '+label,'points',[field,d]);
 return list;
}
function ordered(records){return records.slice().sort((a,b)=>a.revision-b.revision);}
function series(records,metric,days=0,now=Date.now()){return ordered(records).map(r=>({revision:r.revision,at:r.updatedAt,capturedAt:r.capturedAt,source:r.source,time:Date.parse(r.updatedAt),value:metric.read(r.input||{})})).filter(p=>Number.isFinite(p.time)&&(!days||p.time>=now-days*86400000)).sort((a,b)=>a.time-b.time||a.revision-b.revision);}
function change(points){if(points.length<2||points.some(p=>p.value===null))return null;return points.at(-1).value-points[0].value;}
root.KvKInventoryHistory={groups,metrics,series,change,ordered};if(typeof module!=='undefined')module.exports=root.KvKInventoryHistory;
})(typeof globalThis!=='undefined'?globalThis:this);
