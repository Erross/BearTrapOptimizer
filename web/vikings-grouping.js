/* Vikings proximity grouping. No troop allocation or wave changes. */
(function(root){
  'use strict';
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function normalize(rows){
    if(!Array.isArray(rows))throw Error('Roster must be a list.');
    const seen=new Set();
    return rows.map((r,i)=>{
      const id=String(r.governor_id??r.governorId??r.id??i);
      if(seen.has(id))throw Error('Duplicate player ID: '+id);
      seen.add(id);
      const x=r.x==null||r.x===''?NaN:Number(r.x), y=r.y==null||r.y===''?NaN:Number(r.y);
      return {id,name:String(r.name??r.nick_name??r.nick??id),x,y,active:r.active!==false&&r.attending!==false};
    });
  }
  function group(rows,size=7){
    if(!Number.isInteger(size)||size<2||size>20)throw Error('Group size must be between 2 and 20.');
    const members=normalize(rows).filter(r=>r.active);
    const located=members.filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.x>=0&&r.y>=0);
    const missing=members.filter(r=>!located.includes(r));
    const count=Math.ceil(located.length/size);
    if(!count)return {groups:[],missing,groupSize:size};
    const capacities=Array.from({length:count},(_,i)=>Math.floor(located.length/count)+(i<located.length%count?1:0));
    // Farthest-first seeds, then capacity-constrained nearest-center assignment.
    const ordered=located.slice().sort((a,b)=>a.id.localeCompare(b.id));
    const centroid={x:ordered.reduce((s,p)=>s+p.x,0)/ordered.length,y:ordered.reduce((s,p)=>s+p.y,0)/ordered.length};
    const seeds=[ordered.slice().sort((a,b)=>distance(b,centroid)-distance(a,centroid)||a.id.localeCompare(b.id))[0]];
    while(seeds.length<count){
      const candidates=ordered.filter(p=>!seeds.includes(p));
      candidates.sort((a,b)=>Math.min(...seeds.map(s=>distance(b,s)))-Math.min(...seeds.map(s=>distance(a,s)))||a.id.localeCompare(b.id));
      seeds.push(candidates[0]);
    }
    const groups=seeds.map((seed,i)=>({id:i+1,members:[seed],capacity:capacities[i]}));
    const unassigned=ordered.filter(p=>!seeds.includes(p));
    while(unassigned.length){
      // Prioritize members with the clearest nearby group to prevent stranding remote members.
      let best=null;
      for(let p=0;p<unassigned.length;p++)for(let g=0;g<groups.length;g++){
        const target=groups[g];if(target.members.length>=target.capacity)continue;
        const cost=target.members.reduce((s,m)=>s+distance(unassigned[p],m),0)/target.members.length;
        const choice={p,g,cost};
        if(!best||cost<best.cost-1e-9||Math.abs(cost-best.cost)<1e-9&&(p<best.p||p===best.p&&g<best.g))best=choice;
      }
      groups[best.g].members.push(unassigned.splice(best.p,1)[0]);
    }
    // Improve proximity without changing group sizes by swapping members.
    const spread=arr=>arr.reduce((sum,p,i)=>sum+arr.slice(i+1).reduce((s,q)=>s+distance(p,q),0),0);
    for(let pass=0;pass<4;pass++){
      let changed=false;
      for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
        const a=groups[i].members,b=groups[j].members;
        let baseline=spread(a)+spread(b),swap=null;
        for(let ai=0;ai<a.length;ai++)for(let bi=0;bi<b.length;bi++){
          const nextA=a.slice(),nextB=b.slice();nextA[ai]=b[bi];nextB[bi]=a[ai];
          const score=spread(nextA)+spread(nextB);
          if(score<baseline-1e-7){baseline=score;swap={ai,bi};}
        }
        if(swap){[a[swap.ai],b[swap.bi]]=[b[swap.bi],a[swap.ai]];changed=true;}
      }
      if(!changed)break;
    }
    for(const g of groups){
      g.members.sort((a,b)=>a.name.localeCompare(b.name));
      g.maxDistance=Math.max(0,...g.members.flatMap((p,i)=>g.members.slice(i+1).map(q=>distance(p,q))));
    }
    groups.sort((a,b)=>a.members.reduce((s,p)=>s+p.x,0)/a.members.length-b.members.reduce((s,p)=>s+p.x,0)/b.members.length);
    groups.forEach((g,i)=>g.id=i+1);
    return {groups,missing,groupSize:size};
  }
  function fromSnapshot(snapshot){
    if(!snapshot||!Array.isArray(snapshot.members))throw Error('Invalid alliance snapshot.');
    return snapshot.members.map(m=>{
      const id=String(m.governor_id??m.fid);
      const profile=snapshot.profiles?.[id];
      const p=profile?.player??{};
      return {governor_id:id,name:m.nick_name??p.nick_name??id,x:p.x??null,y:p.y??null,active:true};
    });
  }
  const api={group,normalize,fromSnapshot,distance};
  if(typeof module!=='undefined')module.exports=api;
  root.VikingsGrouping=api;
})(typeof self!=='undefined'?self:globalThis);
