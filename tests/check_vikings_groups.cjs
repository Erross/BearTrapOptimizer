const assert=require('node:assert/strict');
const M=require('../web/vikings-grouping.js');
for(const size of [3,4,5,7]){
 const rows=Array.from({length:19},(_,i)=>({id:String(i),name:'P'+i,x:i*10,y:0}));
 const r=M.group(rows,size),flat=r.groups.flatMap(g=>g.members);
 assert.equal(flat.length,19);assert.equal(new Set(flat.map(p=>p.id)).size,19);
 assert(r.groups.every(g=>g.members.length<=size));
 assert(Math.max(...r.groups.map(g=>g.members.length))-Math.min(...r.groups.map(g=>g.members.length))<=1);
}
assert.equal(M.group([{id:'a',name:'A',x:1,y:1},{id:'b',name:'B',x:null,y:1}],7).missing.length,1);
assert.throws(()=>M.group([],1));
console.log('Vikings proximity grouping tests passed');
