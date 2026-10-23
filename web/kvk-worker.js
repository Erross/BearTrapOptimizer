importScripts('./vendor/kvk-highs.js','./kvk-solver.js','./kvk-catalog.js','./kvk-gear.js?v=20261023-widgets1','./kvk-model.js?v=20261023-widgets1');
const ready=Module({locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
self.onmessage=async({data})=>{try{const highs=await ready;postMessage({id:data.id,result:KvKModel.optimize(data.input,KvKSolver.adapter(highs))});}catch(error){postMessage({id:data.id,error:error.message});}};
