#!/usr/bin/env python3
"""Targeted correction and application isolation checks; preserve run-01."""
import hashlib,json,math,random,struct,subprocess,sys,time
from pathlib import Path
from validate import ROOT,APP,exact,scene,jsonwrite
from contract import load,plan,CapacityError,DomainError
from render import save
from isolated import decode_file

out=ROOT/'research/power-garden/results/followup-01';out.mkdir(exist_ok=False)
rows=[]
def log(x):rows.append(x);print(json.dumps(x),flush=True)
def check(name,fn):
    try:fn();log({'name':name,'status':'pass'})
    except Exception as e:log({'name':name,'status':'FAIL','error':repr(e)})
rng=random.Random(2382);s=scene([[rng.random() for _ in range(2382)]])
t=time.perf_counter();info=save(s,out/'capacity-400-rows.png');rt=time.perf_counter()-t
t=time.perf_counter();cp=decode_file(out/'capacity-400-rows.png');dt=time.perf_counter()-t
log({'name':'true-400-row-capacity','status':'pass' if cp.returncode==0 and exact(s,json.loads(cp.stdout)) else 'FAIL',
     'numbers':2382,**info,'png_bytes':(out/'capacity-400-rows.png').stat().st_size,'render_seconds':rt,'decode_seconds':dt,'stderr':cp.stderr})
jsonwrite(out/'capacity-400-rows.input.json',s)
def over():
    p=out/'must-not-exist.png'
    try:save(scene([[0.]*2383]),p)
    except CapacityError as e:
        assert not p.exists();return
    raise AssertionError('expected CapacityError before output')
check('2383-rejected-without-output',over)
def prior():assert len(plan(scene([[0.]*2377])))==400
check('original-failed-test-was-wrong-2377-is-legal',prior)
def strict():
    p=out/'numeric-parse.json';p.write_text('{"schema":"power-garden/v1","shapes":[],"states":[[-0,-0.0,0,0.0,1.0000000000000002]]}')
    s=load(p);assert struct.pack('>d',s['states'][0][0])==struct.pack('>d',-0.)
    target=out/'strict-json.png';save(s,target);cp=decode_file(target)
    assert cp.returncode==0 and exact(s,json.loads(cp.stdout))
check('strict-json-negative-zero-and-adjacent-values',strict)
for name,text in [('duplicate','{"schema":"power-garden/v1","schema":"other","shapes":[],"states":[]}'),
                  ('infinite','{"schema":"power-garden/v1","shapes":[],"states":[[1e999]]}'),
                  ('inexact-integer','{"schema":"power-garden/v1","shapes":[],"states":[[9007199254740993]]}')]:
    def bad(name=name,text=text):
        p=out/(name+'.invalid-json.txt');p.write_text(text)
        try:plan(load(p))
        except DomainError:return
        raise AssertionError('bad input accepted')
    check('reject-'+name,bad)
def cli():
    src=ROOT/'research/power-garden/results/run-01/display-sample.png'
    cp=subprocess.run([sys.executable,str(APP/'app.py'),'decode',str(src)],capture_output=True,text=True)
    assert cp.returncode==0 and exact(json.loads(cp.stdout),load(src.with_suffix('.input.json')))
check('public-cli-isolated-decode',cli)
result={'cases':rows,'passed':sum(x['status']=='pass' for x in rows),'failed':sum(x['status']=='FAIL' for x in rows),
 'correction':'run-01 expected a rejection at 2377 values. The 400-row contract permits through 2382. The renderer was correct; only test expectation/documented single-vector count and CLI isolation wrapper changed.',
 'preserved_failure':'../run-01/results.json',
 'unchanged_core':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [APP/'render.py',APP/'contract.py',APP/'inverse.mjs']}}
jsonwrite(out/'results.json',result)
raise SystemExit(1 if result['failed'] else 0)
