/* Editable seed data, not a live game feed. Confirm rules and remaining shop stock in game. */
(function(root){'use strict';
const resources=[
 ['general','General speedups','minutes',null],['construction','Construction speedups','minutes',[30,30,0,0,30]],['research','Research speedups','minutes',[30,30,0,0,30]],['training','Training speedups','minutes',[30,30,0,0,30]],['master','Master skill speedups','minutes',[30,30,0,0,30]],
 ['truegold','Truegold','items',[2000,2000,0,0,2000]],['dust','Truegold Dust','items',[1000,1000,0,0,1000]],['tempered','Tempered Truegold','items',[30000,30000,0,0,30000]],
 ['mythic','Usable Mythic hero shards','shards',[0,3040,3040,0,0]],['epic','Usable Epic hero shards','shards',[0,1220,1220,0,0]],['rare','Usable Rare hero shards','shards',[0,350,350,0,0]],
 ['hammer','Forgehammers','items',[0,0,0,4000,4000]],['widget','Hero exclusive widgets','items',[0,0,0,8000,8000]],['mithril','Mithril','items',[0,0,0,40000,40000]],['common','Common Taming Marks','items',[0,0,1150,0,1150]],['advanced','Advanced Taming Marks','items',[0,0,15000,0,15000]],
 ['roulette','Hero Roulette spins','spins',[0,8000,8000,0,0]],['emblem','Usable Master Emblems (not General)','items',[0,6000,6000,0,0]],['manuscript',"Master’s Manuscripts",'items',[0,60,60,0,0]],
 ['spares','Spare Mythic gear · unequipped, usable as fodder','pieces',null],['guides','Charm Guides','items',null],['designs','Charm Designs','items',null],['satin','Satin','items',null],['threads','Gilded Threads','items',null],['visions',"Artisan’s Visions",'items',null],['growth','Growth Manuals','items',null],['potions','Nutrient Potions','items',null],['medallions','Promotion Medallions','items',null]
].map(([id,name,unit,points])=>({id,name,unit,points}));
const wallets=[['swordland','Swordland · Relic Coins'],['arena','Arena Tokens'],['trial','Trial Crystals'],['tidal','Tidal Stones'],['championship','Championship Badges'],['alliance','Alliance Tokens'],['gems','Gems · opt-in purchases only']].map(([id,name])=>({id,name}));
const offers=[];
function offer(wallet,resource,cost,remaining,quantity=1){offers.push({id:wallet+'_'+resource,name:resources.find(r=>r.id===resource).name,wallet,resource,cost,quantity,remaining,from:1,to:5,enabled:false});}
for(const args of [['mythic',2500,3],['hammer',1250,10],['satin',1,2500],['threads',100,25],['visions',500,15],['designs',500,20],['guides',500,10],['general',250,20,60],['construction',250,20,60],['research',250,20,60],['training',250,20,60]])offer('swordland',...args);
for(const args of [['hammer',2500,5],['mythic',2500,3],['epic',500,5],['rare',250,10],['mithril',10000,3],['advanced',4800,1]])offer('arena',...args);
for(const args of [['mythic',500,5],['designs',250,20],['guides',250,20],['dust',50,300],['mithril',2500,1]])offer('trial',...args);
for(const args of [['advanced',3000,2],['hammer',1250,10],['mythic',2500,3],['designs',500,20],['guides',500,10],['visions',500,15],['satin',1,2500],['threads',100,25],['general',250,20,60]])offer('tidal',...args);
root.KvKCatalog={version:1,resources,wallets,offers,days:['City Construction','Basic Skills Up','Pet Training','Hero Development','Power Boost'],sources:[
 {name:'Preparation scoring · community data extracted from game files',url:'https://ks-toolkit.com/data/events/kingdom-of-power/'},
 {name:'Swordland · prices and age-dependent stock limits',url:'https://ks-toolkit.com/data/systems/swordland-shop/'},
 {name:'Arena · prices and availability',url:'https://ks-toolkit.com/data/systems/arena-shop/'},
 {name:'Trial · prices and age-dependent availability',url:'https://ks-toolkit.com/data/systems/trial-shop/'},
 {name:'Tidal · prices and stock',url:'https://ks-toolkit.com/data/systems/tidal-shop/'}
]};
})(typeof globalThis!=='undefined'?globalThis:this);
