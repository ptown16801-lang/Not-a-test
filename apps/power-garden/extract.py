#!/usr/bin/env python3
"""Explicit subset extraction from saved data only; never executes an engine."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from contract import SCHEMA,KINDS,load,plan,DomainError,CapacityError

def primitives(source):
    stream=source.get('stream',source)
    if type(stream) is not dict or type(stream.get('shapes')) is not list:
        raise DomainError('saved stream.shapes array required')
    scene={'schema':SCHEMA,'shapes':[],'states':[]}
    omissions=[]
    for index,s in enumerate(stream['shapes']):
        if type(s) is not dict or s.get('geometry',{}).get('kind') not in KINDS:
            omissions.append({'shape_index':index,'reason':'unsupported derived or unknown geometry; entire record omitted'})
            continue
        wanted=('geometry','topology','attributes','depth','createdAtStep')
        if any(k not in s for k in wanted):raise DomainError(f'primitive {index} missing required fields')
        result={k:copy.deepcopy(s[k]) for k in wanted}
        # Unknown attributes or unsupported values abort, never disappear.
        plan({'schema':SCHEMA,'shapes':[result],'states':[]})
        scene['shapes'].append(result)
        omissions.append({'shape_index':index,'kept_fields':list(wanted),'omitted_fields':sorted(set(s)-set(wanted))})
    return scene,{'scope':'supported primitive geometry/topology/attributes/depth/creation-step occurrences only',
                  'complete_source_recoverable':False,'omitted_top_level':sorted(k for k in stream if k!='shapes'),
                  'omitted_wrapper_fields':sorted(k for k in source if k!='stream') if 'stream' in source else [],
                  'shape_receipts':omissions}

def states(source,path):
    selected=source
    for key in path.split('.') if path else []:
        if type(selected) is not dict or key not in selected:raise DomainError('missing state selection path')
        selected=selected[key]
    scene={'schema':SCHEMA,'shapes':[],'states':copy.deepcopy(selected)}
    return scene,{'scope':'only complete numeric vectors at the explicitly selected path','selected_path':path,
                  'complete_source_recoverable':False,'omitted':'all other fields, parameters, metadata, weights, labels and history'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode',choices=['primitives','states']);p.add_argument('source');p.add_argument('output');p.add_argument('receipt');p.add_argument('--path',default='states')
    a=p.parse_args();s=load(a.source)
    scene,receipt=primitives(s) if a.mode=='primitives' else states(s,a.path)
    plan(scene)
    receipt.update(source_filename=Path(a.source).name,source_sha256=hashlib.sha256(Path(a.source).read_bytes()).hexdigest(),decoder_receives_receipt=False)
    # Exclusive creation protects existing input/evidence files.
    with open(a.output,'x') as f:json.dump(scene,f,indent=2,allow_nan=False);f.write('\n')
    with open(a.receipt,'x') as f:json.dump(receipt,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'scene':a.output,'receipt':a.receipt,'complete_source_recoverable':False}))

if __name__=='__main__':main()
