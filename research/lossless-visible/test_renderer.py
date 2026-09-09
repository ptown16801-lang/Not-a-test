#!/usr/bin/env python3
"""Executed evidence suite. Expected inputs never enter the decoder process."""
import copy
import hashlib
import itertools
import json
import math
import os
from pathlib import Path
import platform
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
IMPL=ROOT/'prototypes/lossless-cornfield'
sys.path.insert(0,str(IMPL))
import render
import decode

OUT=Path(os.environ.get('NE_VISIBLE_RESULTS',str(ROOT/'research/lossless-visible/results')))
OUT.mkdir(parents=True,exist_ok=True)
METRICS=[]
TRANSFORMS=[]


def scalar_bits(value):
    if isinstance(value,bool) or value is None or isinstance(value,str):return value
    if isinstance(value,(int,float)):return struct.pack('>d',value).hex()
    if isinstance(value,list):return [scalar_bits(x) for x in value]
    return {k:scalar_bits(v) for k,v in value.items()}


def isolated(image_path):
    with tempfile.TemporaryDirectory(prefix='pixel-inverse-') as temp:
        d=Path(temp)
        # Only these three files exist in the decoder's working directory.
        for name in ('decode.py','rules.json'):shutil.copy2(IMPL/name,d/name)
        shutil.copy2(image_path,d/'image.png')
        before=time.perf_counter()
        p=subprocess.run([sys.executable,'-I','decode.py','image.png'],cwd=d,
                         env={'PATH':os.environ.get('PATH',''),'LANG':'C.UTF-8'},
                         stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=90)
        elapsed=time.perf_counter()-before
        if p.returncode:
            return None,elapsed,p.stderr.strip().splitlines()[-1]
        audit=json.loads(p.stderr)
        if audit['files_opened']!=['image']:raise AssertionError(audit)
        return json.loads(p.stdout),elapsed,audit


def roundtrip(scene,name,save=True):
    before=time.perf_counter()
    image=render.render(scene)
    drawing=time.perf_counter()-before
    path=OUT/(name+'.png')
    before=time.perf_counter();image.save(path,format='PNG');export=time.perf_counter()-before
    actual,elapsed,audit=isolated(path)
    if scalar_bits(actual)!=scalar_bits(scene):raise AssertionError(f'{name}: {audit}')
    metrics={'case':name,'width':image.width,'height':image.height,'pixels':image.width*image.height,
             'png_bytes':path.stat().st_size,'render_seconds':drawing,'export_seconds':export,
             'inverse_fresh_process_seconds':elapsed,'rows':len(render.prepare(scene)),
             'scalars':sum(len(v) for _,v,s in render.prepare(scene) if not s),
             'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'exact_binary64':True,'audit':audit}
    METRICS.append(metrics)
    if not save:path.unlink()
    return image


def shape(g=None):
    return {'geometry':g or {'kind':'curve','controlPoints':[[-1.,.1],[.25,1.],[1.,.2]]},
            'topology':{'dimension':1,'nodes':3,'edges':[[0,1],[1,2]],'components':1},
            'attributes':{'color':'#d8a03f','material':'matte','texture':.2,'curvature':[0.],
                          'symmetry':['bilateral'],'bounds':[-1.,.1,1.,1.]},'depth':0,'createdAtStep':0}


def scene(shapes=None,states=None):
    return {'schema':'visible-cornfield/v1','shapes':shapes or [],'states':states or []}


class VisibleRendererTests(unittest.TestCase):
    def test_01_all_primitive_kinds_and_topology(self):
        geoms=[{'kind':'point','p':[math.nextafter(1.,2.),2.,3.]},
               {'kind':'segment','a':[0.,0.],'b':[0.,0.]},
               {'kind':'ray','a':[1.,2.,3.],'b':[1.,2.,3.]},
               {'kind':'disk','center':[-.5,1.],'radius':0.},
               {'kind':'polygon','vertices':[[0.,0.],[1.,1.],[0.,0.]]},
               {'kind':'curve','controlPoints':[[0.,0.,1.],[.3,1.,2.],[.8,-.2,0.],[1.,1.,3.]]},
               {'kind':'ball','center':[0.,0.,7.],'radius':.7},
               {'kind':'surface','seed':[0.,0.,0.,1.,math.nextafter(1.,2.)]},
               {'kind':'polyline','vertices':[[1.,2.],[1.,2.]],'closed':True}]
        shapes=[shape(g) for g in geoms]
        shapes[0]['topology']['edges']=[[2,2],[0,1],[0,1],[1,0]]
        roundtrip(scene(shapes),'all-primitives')

    def test_02_transform_order_attribute_distinctions(self):
        base=scene([shape()]);variants=[('original',base)]
        for name,fn in [('translation',lambda p:[p[0]+8,p[1]+16]),('axis-scale',lambda p:[p[0]*2,p[1]*.5]),('subcell',lambda p:[p[0]+2**-30,p[1]]),('nextafter',lambda p:[math.nextafter(p[0],math.inf),p[1]])]:
            s=copy.deepcopy(base);s['shapes'][0]['geometry']['controlPoints']=[fn(p) for p in s['shapes'][0]['geometry']['controlPoints']];variants.append((name,s))
        for name,mutate in [('depth',lambda s:s.update(depth=128)),('created-step',lambda s:s.update(createdAtStep=2**53-1)),('point-order',lambda s:s['geometry']['controlPoints'].reverse()),('edges',lambda s:s['topology']['edges'].reverse()),('attributes',lambda s:s['attributes'].update(texture=math.nextafter(.2,1),color='#d8a040',material='glossy',curvature=[1e-320,1e250],symmetry=['radial','bilateral']))]:
            s=copy.deepcopy(base);mutate(s['shapes'][0]);variants.append((name,s))
        hashes=[]
        for name,s in variants:
            image=roundtrip(s,'change-'+name,save=name=='original');hashes.append(hashlib.sha256(image.tobytes()).hexdigest())
        self.assertEqual(len(hashes),len(set(hashes)))
        a=shape();b=copy.deepcopy(a);b['depth']=1
        roundtrip(scene([a,b,a]),'overlapping-duplicates')
        x=render.render(scene([a,b]));y=render.render(scene([b,a]));self.assertNotEqual(x.tobytes(),y.tobytes())
        roundtrip(scene([b,a]),'shape-order',save=False)

    def test_03_binary64_exponents_adjacent_and_random(self):
        values=[0.,5e-324,-5e-324,sys.float_info.max,-sys.float_info.max,sys.float_info.min,math.nextafter(sys.float_info.min,0)]
        # Every nonzero binary64 magnitude exponent, including all subnormals.
        values += [math.ldexp(1.,e) for e in range(-1074,1024)]
        rng=random.Random(20260909)
        for _ in range(1024):
            while True:
                x=struct.unpack('>d',rng.getrandbits(64).to_bytes(8,'big'))[0]
                if math.isfinite(x) and x!=0:break
            values.extend([x,math.nextafter(x,0.)])
        for i in range(0,len(values),1000):
            roundtrip(scene(states=[values[i:i+1000]]),f'binary64-batch-{i//1000}',save=False)
        (OUT/'binary64-sampling.json').write_text(json.dumps({'cases':len(values),'random_seed':20260909,'every_magnitude_exponent':2098,'random_and_adjacent_pairs':1024,'proof_required_beyond_samples':True},indent=2)+'\n')

    def test_04_exhaustive_reduced_domain_and_morphology(self):
        # Actual floating point coordinates, a finite exhaustive Cartesian domain.
        domain=[0.,.5,1.,math.nextafter(1.,2.)]
        images=[]
        for i,(x,y) in enumerate(itertools.product(domain,repeat=2)):
            s=scene([shape({'kind':'point','p':[x,y]})])
            im=roundtrip(s,f'exhaustive-{i:02}',save=False)
            images.append(hashlib.sha256(im.tobytes()).hexdigest())
        self.assertEqual(len(set(images)),16)
        # Exhaust each leaf digit at each significand position from real f64s.
        for j in range(13):
            for digit in range(16):
                value=1.+math.ldexp(digit, -4*(j+1))
                im=Image.new('RGB',(112,160),tuple(render.RULES['background']))
                render.stalk(ImageDraw.Draw(im),0,0,value)
                mask=np.asarray(im).astype(np.uint16).sum(axis=2)<200
                self.assertEqual(struct.pack('>d',value),struct.pack('>d',decode.scalar(mask)))
        roundtrip(scene([dict(shape(),attributes={**shape()['attributes'],'symmetry':render.RULES['symmetries']})]),'all-symbols')

    def test_05_project_fixtures(self):
        for name in ['saved-balance-primitives','saved-phase1-state','saved-phase2-state','fresh-neural-600','fresh-ascii-paths']:
            s=json.loads((ROOT/'research/lossless-visible/fixtures'/f'{name}.json').read_text())
            roundtrip(s,name)
        complex_shape=shape({'kind':'curve','controlPoints':[[math.sin(i),math.cos(i),math.sin(i*.3)] for i in range(64)]})
        complex_shape['topology'].update(nodes=64,edges=[[i,i+1] for i in range(63)])
        roundtrip(scene([complex_shape]),'complex-3d-control-points')

    def test_06_degenerate_and_capacity(self):
        roundtrip(scene(),'empty-scene')
        roundtrip(scene([shape({'kind':'curve','controlPoints':[]}),shape({'kind':'surface','seed':[]})],states=[[],[0.],[]]),'degenerate')
        at_limit=scene(states=[[0.]*1200,[1.]*1200,[2.]*444])
        self.assertEqual(len(render.prepare(at_limit)),240)
        roundtrip(at_limit,'capacity-240-rows')
        too_big=copy.deepcopy(at_limit);too_big['states'][-1].append(3.)
        with self.assertRaises(render.CapacityError):render.render(too_big)
        with self.assertRaises(render.CapacityError):render.render(scene(states=[[0.]*1201]))
        with self.assertRaises(render.CapacityError):render.render(scene([shape()]*33))

    def test_07_unsupported_rejected_without_output(self):
        bad=[scene(states=[[float('nan')]]),scene(states=[[float('inf')]]),scene(states=[[-0.]]),scene(states=[[2**53+1]])]
        for key,val in [('tags',['unrestricted text']),('id','sha256:answer'),('extra',0)]:
            s=scene([shape()]);s['shapes'][0][key]=val;bad.append(s)
        s=scene([shape()]);s['shapes'][0]['geometry']={'kind':'derived','operation':'compose','params':{}};bad.append(s)
        for attr,val in [('symmetry',['unknown']),('material','velvet'),('color','#D8A03F')]:
            s=scene([shape()]);s['shapes'][0]['attributes'][attr]=val;bad.append(s)
        bad.append(json.loads((ROOT/'demo/balance-output.json').read_text()))
        for s in bad:
            with self.assertRaises(render.Unsupported):render.render(s)
        with self.assertRaises(render.Unsupported):render.strict_json('{"a":0,"a":1}')
        (OUT/'unsupported.json').write_text(json.dumps({'rejections_tested':len(bad)+1,'cases':['NaN','infinity','negative zero','nonrepresentable Python integer','tags','IDs','unknown fields','derived DAG','unknown symmetry','unknown material','noncanonical color','full project stream','duplicate JSON keys'],'no_silent_projection':True},indent=2)+'\n')

    def test_08_export_reopening_and_transforms(self):
        s=scene(states=[[0.,1.,math.nextafter(1.,2.),-.5,5e-324,sys.float_info.max]])
        image=roundtrip(s,'display-sample')
        p=OUT/'display-sample.png';raw=p.read_bytes();offset=8;chunks=[]
        while offset<len(raw):
            n=int.from_bytes(raw[offset:offset+4],'big');chunks.append(raw[offset+4:offset+8].decode());offset+=n+12
        self.assertTrue(set(chunks)<=set(['IHDR','IDAT','IEND']))
        with Image.open(p) as reopened:
            self.assertEqual(reopened.mode,'RGB');self.assertFalse(reopened.info)
            reopened.save(OUT/'reopened.png',compress_level=9)
        got,_,_=isolated(OUT/'reopened.png');self.assertEqual(scalar_bits(got),scalar_bits(s))
        variants=[]
        for factor in [.25,.5,.75,.99,1.,1.01,1.5,2.]:
            size=(round(image.width*factor),round(image.height*factor))
            for method,label in [(Image.Resampling.NEAREST,'nearest'),(Image.Resampling.LANCZOS,'lanczos')]:
                variants.append((f'resize-{factor}-{label}',image.resize(size,method),'PNG',{}))
        for quality in [100,95,85,70,50,30,10,1]:
            variants.append((f'jpeg-{quality}',image,'JPEG',{'quality':quality,'subsampling':0}))
        variants += [('clip-bottom-1',image.crop((0,0,image.width,image.height-1)),'PNG',{}),('clip-whole-row',image.crop((0,0,image.width,image.height-160)),'PNG',{}),('clip-right-1',image.crop((0,0,image.width-1,image.height)),'PNG',{})]
        for name,im,fmt,options in variants:
            file=OUT/(name+('.jpg' if fmt=='JPEG' else '.png'));im.save(file,format=fmt,**options)
            decoded,elapsed,detail=isolated(file)
            exact=scalar_bits(decoded)==scalar_bits(s)
            TRANSFORMS.append({'case':name,'exact':exact,'status':'exact' if exact else ('rejected' if decoded is None else 'wrong-decoding'),'detail':detail,'seconds':elapsed,'dimensions':list(im.size)})
        (OUT/'png-contract.json').write_text(json.dumps({'chunks':chunks,'ancillary_chunks':False,'mode':'RGB','alpha':False,'lossless_reexport_exact':True},indent=2)+'\n')


if __name__=='__main__':
    started=time.time()
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(VisibleRendererTests))
    summary={'tests_run':result.testsRun,'failures':[(str(t),e) for t,e in result.failures],
             'errors':[(str(t),e) for t,e in result.errors],'skipped':result.skipped,
             'all_passed':result.wasSuccessful(),'seconds':time.time()-started,
             'python':sys.version,'numpy':np.__version__,'pillow':Image.__version__,'platform':platform.platform(),
             'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
             'source_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [IMPL/'render.py',IMPL/'decode.py',IMPL/'rules.json',Path(__file__)]},
             'fresh_process_roundtrips':len(METRICS),'metrics':METRICS,'transforms':TRANSFORMS,
             'qualification':'Exactness applies to the declared semantic geometry/state boundary, not complete engine streams, text, or arbitrary screenshots.'}
    (OUT/'test-results.json').write_text(json.dumps(summary,indent=2)+'\n')
    sys.exit(0 if result.wasSuccessful() else 1)
