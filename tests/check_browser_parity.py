"""Compare the browser engine with the Python reference. Requires Node for CI only."""
from dataclasses import asdict, replace
import json
import math
from pathlib import Path
import subprocess
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from beartrap.model import Member, Mechanics, Strategy, synthetic_roster
from beartrap.simulator import simulate
from beartrap.analysis import compare, calibrate, search
from beartrap.combat import formation_plan, effective_components
from beartrap.profiles import profile_roster
from beartrap.wave_planner import optimize_waves

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
    typed = [replace(m, infantry_tier=7+i%3, cavalry_tier=8, archers_tier=9,
                     archers_attack_bonus=40+i*10, cavalry_lethality_bonus=20)
             for i,m in enumerate(members[:5])]
    for model in ('legacy','weighted','sqrt'):
        for scope in ('march','rally'):
            for formation in ('inventory','strict','adaptive','optimized'):
                cfg=replace(c,damage_model=model,damage_scope=scope,archer_volley_bonus=10,bear_attack_bonus=25)
                setting=Strategy(host_count=3,formation=formation,infantry_pct=7,cavalry_pct=13,
                                 host_allocation='small',troop_split='concentrated',final_push=True)
                cases.append({'method':'simulate','args':[[asdict(m) for m in typed],asdict(cfg),asdict(setting)],
                              'expected':simulate(typed,cfg,setting,audit=True)})
    for model in ('weighted','sqrt'):
        for count in (1,5,6):
            p={'member':asdict(typed[2]),'host':asdict(typed[4]),'mechanics':asdict(replace(c,damage_model=model)),
               'marches':count,'march_size':45301}
            cases.append({'method':'formation_plan','args':[p],'expected':formation_plan(p)})
    p={'synthetic':{'n':8,'troops_max':1500000},'host_count':4,'mechanics':{'damage_model':'sqrt'},
       'strategy':{'formation':'adaptive','infantry_pct':5,'cavalry_pct':20}}
    expected=compare(p);expected.pop('assumptions')
    cases.append({'method':'compare','args':[p],'expected':expected})
    cfg=replace(c,damage_model='sqrt',score_per_effective_troop=1)
    mix={'infantry':5000,'cavalry':5000,'archers':40000}
    report_member=replace(typed[0],infantry_tier=8,cavalry_tier=8,archers_tier=8,troop_quality=1)
    damage=sum(effective_components(mix,report_member,typed[0],cfg).values())*2.5
    p={'mechanics':asdict(cfg),'score_scale':1,'roster':[asdict(typed[0])],
       'reports':[dict(host=typed[0].name,troops=50000,damage=damage,**mix)]}
    fit=calibrate(p);fit.pop('note')
    cases.append({'method':'calibrate','args':[p],'expected':fit})
    for repeat in ('ready','fixed'):
        for formation in ('inventory','strict','adaptive','optimized'):
            s=Strategy(host_count=4,cadence='groups',group_size=2,wave_interval_s=30,group_repeat=repeat,
                       host_allocation='small',reserve_lead_troops=True,formation=formation,
                       host_min_relative_score=20,host_min_rally_capacity=350000,final_push=True)
            cfg=replace(c,damage_model='sqrt',duration_s=240)
            cases.append({'method':'simulate','args':[[asdict(m) for m in typed],asdict(cfg),asdict(s)],'expected':simulate(typed,cfg,s,audit=True)})
    spread={'n':8,'rally_capacity_min':450000,'rally_capacity_max':1000000,'march_capacity_min':45301,'march_capacity_max':140000,
            'town_level_min':24,'town_level_max':30,'tier_min':8,'tier_max':10,'attack_min':50,'attack_max':250,'lethality_min':25,'lethality_max':200}
    cases.append({'method':'synthetic','args':[spread],'expected':[asdict(m) for m in synthetic_roster(**spread)]})
    for goal in ('damage','flow','balanced'):
        p={'synthetic':{'n':4},'mechanics':{'duration_s':120,'countdown_s':30,'damage_model':'sqrt'},
           'strategy':{'reserve_lead_troops':True},'search_goal':goal,'opening_limit_s':60}
        cases.append({'method':'search','args':[p],'expected':search(p)})
    for profile in ('top_four','developing','established'):
        for n in (2,7,40):
            inputs={'profile':profile,'n':n}
            cases.append({'method':'profile_roster','args':[inputs],'expected':profile_roster(inputs)})
    for repeat in ('ready','fixed'):
        for cap in (0,25000):
            setting=Strategy(host_count=5,cadence='groups',opening_wave_count=4,group_size=2,
                             wave_interval_s=30,group_repeat=repeat,host_allocation='small',
                             reserve_lead_troops=True,troop_split='concentrated',join_march_cap=cap)
            cfg=replace(c,damage_model='sqrt',duration_s=300)
            cases.append({'method':'simulate','args':[[asdict(m) for m in typed],asdict(cfg),asdict(setting)],
                          'expected':simulate(typed,cfg,setting,audit=True)})
    # Proximity order must affect the actual planned starts in both engines,
    # while selection still takes the strongest or explicitly chosen hosts.
    nearby=[replace(m,host_strength=i+1,outbound_s=t,return_s=t,join_slots=0)
            for i,(m,t) in enumerate(zip(typed,[1,40,10,30,10]))]
    for cadence in ('groups','waves'):
        for selected in ((),tuple(m.name for m in nearby[1:4])):
            setting=Strategy(host_count=4,host_names=selected,cadence=cadence,
                             opening_wave_count=3,wave_interval_s=30)
            cfg=Mechanics(duration_s=600,countdown_s=60)
            cases.append({'method':'simulate','args':[[asdict(m) for m in nearby],asdict(cfg),asdict(setting)],
                          'expected':simulate(nearby,cfg,setting,audit=True)})
    p={'roster':profile_roster({'n':8})['roster'],'mechanics':{'damage_model':'sqrt','duration_s':300,'countdown_s':60},
       'strategies':[{'name':'Everyone together','host_count':8,'cadence':'synchronized'},
                     {'name':'Selected waves','host_count':4,'cadence':'groups','opening_wave_count':3,'wave_interval_s':30,'host_allocation':'small','reserve_lead_troops':True},
                     {'name':'Selected capped','host_count':4,'cadence':'groups','opening_wave_count':3,'wave_interval_s':30,'host_allocation':'small','reserve_lead_troops':True,'join_march_cap':25000}]}
    expected=compare(p);expected.pop('assumptions')
    cases.append({'method':'compare','args':[p],'expected':expected})
    # Degenerate wave schedules must match the simultaneous opening in both
    # engines, including different travel times and filtered starter permissions.
    wave_members=[Member.parse(row) for row in p['roster']]
    wave_members[0]=replace(wave_members[0],can_host=False)
    for scope in ('march','rally'):
        cfg=Mechanics(duration_s=240,countdown_s=45,damage_model='sqrt',damage_scope=scope)
        setting=Strategy(host_count=8,cadence='synchronized',host_allocation='small',
                         troop_split='concentrated',join_policy='next',reserve_lead_troops=True)
        for waves,gap in ((0,60),(1,90),(5,0)):
            candidate=setting if not waves else replace(setting,cadence='groups',
                          opening_wave_count=waves,wave_interval_s=gap)
            cases.append({'method':'simulate','args':[[asdict(m) for m in wave_members],asdict(cfg),asdict(candidate)],
                          'expected':simulate(wave_members,cfg,candidate,audit=True)})
    search_inputs=dict(p,search_goal='balanced',opening_limit_s=60)
    cases.append({'method':'search','args':[search_inputs],'expected':search(search_inputs)})
    # Coordinate times affect every comparison, its normalization baseline and
    # search trials, including travel longer than the legacy 300-second bound.
    coordinate_members = [replace(m, outbound_s=330 if i == 0 else m.outbound_s)
                          for i, m in enumerate(wave_members)]
    travel = {m.name: {host.name: (i + j) * 31 for j, host in enumerate(coordinate_members) if i != j}
              for i, m in enumerate(coordinate_members)}
    cfg = Mechanics(duration_s=600, countdown_s=60, damage_model='sqrt')
    for waves in (0, 1, 3):
        candidate = Strategy(host_count=8, cadence='groups' if waves else 'synchronized',
                             opening_wave_count=waves, wave_interval_s=30, host_allocation='small',
                             troop_split='concentrated', reserve_lead_troops=True)
        cases.append({'method':'simulate','args':[[asdict(m) for m in coordinate_members],asdict(cfg),asdict(candidate),travel],
                      'expected':simulate(coordinate_members,cfg,candidate,audit=True,travel_times=travel)})
    coordinate_payload = {'roster':[asdict(m) for m in coordinate_members], 'mechanics':asdict(cfg),
                          'strategies':[asdict(candidate)], 'travel_times':travel}
    expected = compare(coordinate_payload); expected.pop('assumptions')
    cases.append({'method':'compare','args':[coordinate_payload],'expected':expected})
    small = synthetic_roster(n=4)
    small_travel = {small[0].name:{small[1].name:40},small[1].name:{small[0].name:30}}
    for goal in ('damage','balanced'):
        coordinate_search = {'roster':[asdict(m) for m in small], 'travel_times':small_travel,
                             'mechanics':{'duration_s':120,'countdown_s':30,'damage_model':'sqrt'},
                             'search_goal':goal,'opening_limit_s':60}
        cases.append({'method':'search','args':[coordinate_search],'expected':search(coordinate_search)})
    opening_members=[replace(m,troops=200001,infantry=None,cavalry=None,archers=None,march_capacity=100000,rally_capacity=200001,
                             outbound_s=2,return_s=2,join_travel_s=2) for m in small]
    for fair in (False,True):
        for window in (0,8):
            cfg=Mechanics(duration_s=180,countdown_s=60)
            setting=Strategy(host_count=4,cadence='groups',opening_wave_count=2,wave_interval_s=20,
                             host_allocation='small',small_host_fraction=.00001,reserve_lead_troops=True,
                             troop_split='concentrated',first_wave_join=fair,join_window_s=window)
            cases.append({'method':'simulate','args':[[asdict(m) for m in opening_members],asdict(cfg),asdict(setting)],
                          'expected':simulate(opening_members,cfg,setting,audit=True)})
    wave_payload={'roster':[asdict(m) for m in opening_members],
                  'mechanics':{'duration_s':180,'countdown_s':60},'host_count':4,
                  'normalization':{'enabled':False},'opening_limit_s':120}
    cases.append({'method':'optimize_waves','args':[wave_payload],'expected':optimize_waves(wave_payload)})
    js="const fs=require('fs'),e=require('./web/engine.js');const cases=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(cases.map(c=>e[c.method](...c.args))));"
    result=subprocess.run(['node','-e',js],input=json.dumps([{k:v for k,v in c.items() if k!='expected'} for c in cases]),
                          text=True,capture_output=True,cwd=ROOT,check=True)
    actual=json.loads(result.stdout)
    for i,(case,value) in enumerate(zip(cases,actual)):
        check(case['expected'],value,f'case {i} {case["method"]}')
    print(f'{len(cases)} browser/Python parity cases passed')


if __name__=='__main__':
    main()
