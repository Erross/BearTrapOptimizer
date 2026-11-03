/* Published Viking wave reference values and difficulty-based point budgets.
   Source: https://kingshotguide.org/data-center/viking-vengeance-data (difficulty 1 enemy counts)
   Source: https://ks-toolkit.com/data/events/vikings-vengeance/ (difficulty 1-21 points)
   Enemy counts for levels 2-21 are intentionally not fabricated. */
(function(root){
'use strict';
const baselineTroops=[300,546,840,1271,1895,2572,3657,4749,5885,7704,9477,12145,16223,22535,38966,62051,89972,124908,173601,241494];
const basePoints=[3000,4200,5400,6600,7800,9000,20400,11400,12600,138000,15000,16200,17400,37200,19800,21000,44400,23400,24600,258000];
function target(wave){return wave===10||wave===20?'HQ':[7,14,17].includes(wave)?'Online':'All members';}
function points(difficulty,wave){
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>21||!Number.isInteger(wave)||wave<1||wave>20)throw Error('Invalid Vikings difficulty or wave.');
 // Toolkit displays a +5% additive increase per difficulty over level 1.
 return Math.round(basePoints[wave-1]*(1+0.05*(difficulty-1)));
}
function waveTable(difficulty,observed={}){
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>21)throw Error('Difficulty must be 1–21.');
 return basePoints.map((_,index)=>{
  const wave=index+1,reported=observed[wave],valid=Number.isInteger(reported)&&reported>0;
  return {wave,target:target(wave),points:points(difficulty,wave),
   enemy:valid?reported:difficulty===1?baselineTroops[index]:null,
   enemySource:valid?'Player observation':difficulty===1?'Published (difficulty 1)':'Not verified'};
 });
}
const api={waveTable,points,target,baselineTroops,basePoints};
if(typeof module!=='undefined')module.exports=api;
root.VikingsDifficulty=api;
})(typeof self!=='undefined'?self:globalThis);
