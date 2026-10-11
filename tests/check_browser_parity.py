"""Compare the browser engine with the Python reference. Requires Node for CI only."""
from dataclasses import asdict
import json
import math
from pathlib import Path
import subprocess
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from beartrap.model import Member, Mechanics, Strategy, synthetic_roster
from beartrap.simulator import simulate
from beartrap.analysis import compare, calibrate

ROOT=Path(__file__).resolve().parents[1]


def check(a,b,path='root'):
    if isinstance(a,dict):
        assert set(a)<=set(b),f'{path}: missing keys {set(a)-set(b)}'
        for k,v in a.items():
            check(v,b[k],path+'.'+k)
    elif isinstance(a,(list,tuple)):
        assert len(a)==len(b),f'{path}: length {len(a)} != {len(b)}'
        for i,(x,y) in enumerate(zip(a,b)):
            check(x,y,f'{path}[{i}]')
    elif isinstance(a,(int,float)) and not isinstance(a,bool):
        assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-6),f'{path}: {a} != {b}'
    else:
        assert a==b,f'{path}: {a!r} != {b!r}'


def main():
    members=synthetic_roster(12)
    rows=[asdict(m) for m in members]
    c=Mechanics(duration_s=600,countdown_s=60)
    cases=[]
    for cadence in ('synchronized','staggered','waves','custom'):
        for allocation in ('equal','small','full'):
            for policy in ('next','strength','rate'):
                s=Strategy(host_count=7,cadence=cadence,host_allocation=allocation,join_policy=policy,
                           troop_split='concentrated' if policy=='strength' else 'equal',final_push=True)
                cases.append({'method':'simulate','args':[rows,asdict(c),asdict(s)],'expected':simulate(members,c,s)})
    # Check equal-to-expiration and too-late starts with actual 30-minute settings.
    late=[Member(f'H{i:02d}',join_slots=0,host_strength=2 if i<19 else 1,outbound_s=8) for i in range(20)]
    s=Strategy(host_count=20,cadence='custom',spacing_s=79)
    r=simulate(late,Mechanics(),s)
    assert not any(h['host']=='H19' for h in r['hits']) # phase 19 × 79 = 25:01
    cases.append({'method':'simulate','args':[[asdict(m) for m in late],asdict(Mechanics()),asdict(s)],'expected':r})
    cases.append({'method':'synthetic','args':[{'n':32}],'expected':[asdict(m) for m in synthetic_roster()]})
    p={'synthetic':{'n':8},'host_count':4}
    expected=compare(p)
    expected.pop('assumptions',None)
    cases.append({'method':'compare','args':[p],'expected':expected})
    reports={'reports':[{'host':'H','troops':50000,'damage':1e7},{'host':'H','troops':50000,'damage':1.2e7}]}
    fit=calibrate(reports)
    fit.pop('note')
    cases.append({'method':'calibrate','args':[reports],'expected':fit})
    js="const fs=require('fs'),e=require('./web/engine.js');const cases=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(cases.map(c=>e[c.method](...c.args))));"
    result=subprocess.run(['node','-e',js],input=json.dumps([{k:v for k,v in c.items() if k!='expected'} for c in cases]),
                          text=True,capture_output=True,cwd=ROOT,check=True)
    actual=json.loads(result.stdout)
    for i,(case,value) in enumerate(zip(cases,actual)):
        check(case['expected'],value,f'case {i} {case["method"]}')
    print(f'{len(cases)} browser/Python parity cases passed')


if __name__=='__main__':
    main()
