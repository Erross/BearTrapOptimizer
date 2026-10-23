/* JSON-model adapter for pinned, locally hosted HiGHS 1.15.4 (MIT).
 * Only proven Optimal or Infeasible results are accepted; time limits are not proofs.
 */
(function(root){'use strict';
function adapter(highs){return {Solve(model){
 const names=Object.keys(model.variables),map=new Map(names.map((id,i)=>[id,'x'+i]));if(!names.length)return {feasible:true,bounded:true};
 const expression=terms=>terms.filter(([,v])=>v!==0).map(([id,v])=>(v<0?' - ':' + ')+Math.abs(v)+' '+map.get(id)).join('').replace(/^ \+ /,'')||'0 x0';
 const lines=[model.opType==='min'?'Minimize':'Maximize',' objective: '+expression(names.map(id=>[id,model.variables[id][model.optimize]||0])),'Subject To'];
 let i=0;for(const [id,bound]of Object.entries(model.constraints)){const expr=expression(names.map(key=>[key,model.variables[key][id]||0]));if(bound.equal!==undefined)lines.push(' c'+i+++': '+expr+' = '+bound.equal);else{if(bound.min!==undefined)lines.push(' c'+i+++': '+expr+' >= '+bound.min);if(bound.max!==undefined)lines.push(' c'+i+++': '+expr+' <= '+bound.max);}}
 lines.push('Bounds',...names.map(id=>' '+map.get(id)+' >= 0'));
 if(Object.keys(model.ints).length)lines.push('Generals',Object.keys(model.ints).map(id=>map.get(id)).join(' '));lines.push('End');
 const result=highs.solve(lines.join('\n'),{output_flag:false,time_limit:5,mip_rel_gap:0,mip_abs_gap:1e-8});
 if(result.Status==='Infeasible')return {feasible:false};if(result.Status!=='Optimal')throw Error('Optimization ended with '+result.Status+'. No proven complete plan is shown. Reduce the enabled shop offers and retry.');
 return {feasible:true,bounded:true,...Object.fromEntries(names.map(id=>[id,result.Columns[map.get(id)]?.Primal||0]))};
}};}
root.KvKSolver={adapter};
})(typeof globalThis!=='undefined'?globalThis:this);
