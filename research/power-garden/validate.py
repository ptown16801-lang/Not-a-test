#!/usr/bin/env python3
"""Executed evidence for Power Garden; input comparison happens after inversion."""
import argparse,copy,datetime,hashlib,itertools,json,math,os,random,shutil,struct,subprocess,sys,tempfile,time,zlib
from pathlib import Path
from PIL import Image,ImageDraw,PngImagePlugin
ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'apps/power-garden'
sys.path.insert(0,str(APP))
from contract import SCHEMA,plan,load,DomainError,CapacityError,SYMMETRIES
from render import save,render

def exact(a,b):
    if type(a) in (int,float) and type(b) in (int,float):
        if type(a) is int and int(float(a))!=a or type(b) is int and int(float(b))!=b:return False
        return struct.pack('>d',a)==struct.pack('>d',b)
    if type(a)!=type(b):return False
    if isinstance(a,dict):return a.keys()==b.keys() and all(exact(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(exact(x,y) for x,y in zip(a,b))
    return a==b

def scene(states=(),shapes=()):return {'schema':SCHEMA,'shapes':list(shapes),'states':list(states)}
def shape(g):
    return {'geometry':g,'topology':{'dimension':2,'nodes':4,'edges':[[0,1],[1,2],[2,3],[3,0]],'components':1},
            'attributes':{'color':'#d8a03f','material':'matte','texture':.2,'curvature':[.125,-0.0],
                          'symmetry':['bilateral','radial','bilateral'],'bounds':[-.5,-1.,1.,2.]},'depth':3,'createdAtStep':17}

def inverse(path):
    # Only two files are present/allowed. Entry/image names carry no source ID.
    # No fixture or renderer permission; no stdin; no inherited NODE_OPTIONS.
    with tempfile.TemporaryDirectory(prefix='garden-inverse-') as td:
        p=Path(td);shutil.copyfile(APP/'inverse.mjs',p/'inverse.mjs');shutil.copyfile(path,p/'observation.png')
        command=[shutil.which('node'),'--permission','--allow-fs-read='+str(p/'inverse.mjs'),
                 '--allow-fs-read='+str(p/'observation.png'),str(p/'inverse.mjs'),str(p/'observation.png')]
        t=time.perf_counter()
        cp=subprocess.run(command,cwd=p,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=90,
                          env={'PATH':os.environ['PATH'],'LANG':'C'})
        elapsed=time.perf_counter()-t
        return cp,elapsed

def jsonwrite(path,x):path.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n')

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=False)
    rows=[];incidents=[]
    source={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in APP.iterdir() if p.is_file()}
    jsonwrite(out/'execution-source.json',{'started_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'git_revision':subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD']).decode().strip(),
       'git_status':subprocess.check_output(['git','-C',str(ROOT),'status','--short']).decode(),'files':source,
       'seed':20260909,'python':sys.version,'node':subprocess.check_output(['node','--version']).decode().strip()})
    def record(x):
        rows.append(x);jsonwrite(out/'results.json',{'cases':rows,'incidents':incidents})
        print(json.dumps({k:v for k,v in x.items() if k in ('name','status','numbers','pixels','decode_seconds','render_seconds')}),flush=True)
    def native(name,s,keep=True):
        try:
            t=time.perf_counter();info=save(s,out/(name+'.png'));rt=time.perf_counter()-t
            cp,dt=inverse(out/(name+'.png'))
            got=json.loads(cp.stdout) if cp.returncode==0 else None
            if got is not None:plan(got)  # decoded JSON must remain an accepted input
            ok=cp.returncode==0 and exact(s,got)
            r={'name':name,'status':'pass' if ok else 'FAIL','kind':'native_exact_recovery',
               'numbers':sum(len(v) for _,v in plan(s)),**info,'render_seconds':rt,'decode_seconds':dt,
               'png_bytes':(out/(name+'.png')).stat().st_size,'exit':cp.returncode,'stderr':cp.stderr}
            if not ok:incidents.append({'name':name,'stdout':cp.stdout,'stderr':cp.stderr})
            if keep or not ok:jsonwrite(out/(name+'.input.json'),s)
            elif ok:(out/(name+'.png')).unlink()
            record(r);return got
        except Exception as e:
            record({'name':name,'status':'FAIL','error':repr(e)});return None
    def rejected(name,s,kind='unsupported'):
        try:plan(s);record({'name':name,'status':'FAIL','kind':kind,'error':'unexpected acceptance'})
        except (DomainError,CapacityError) as e:record({'name':name,'status':'pass','kind':kind,'observed':'rejected','reason':str(e)})

    tiny=scene([[0.0,-0.0,1.,math.nextafter(1.,math.inf),.1,math.ulp(0.)]])
    native('display-sample',tiny)
    native('empty-scene',scene())
    native('large-integer-json-closure',scene([[float(2**60),-float(2**60),math.nextafter(float(2**60),math.inf)]]))
    # Check all 256 members of a signed-zero/subnormal four-coordinate domain,
    # bundled as 16 independent observations at a time. This is a bounded test.
    domain=[-math.ulp(0.),-0.,0.,math.ulp(0.)]
    products=list(itertools.product(domain,repeat=4))
    for i in range(0,len(products),16):native(f'exhaustive-four-values-{i:03d}',scene([list(v) for v in products[i:i+16]]),keep=i==0)
    # Every legal absolute power; positive and negative values, all exponents.
    powers=[math.ldexp(1.,e) for e in range(-1074,1024)]
    for i in range(0,len(powers),512):native(f'every-power-{i:04d}',scene([powers[i:i+512],[-v for v in powers[i:i+512]]]),keep=i==0)
    # Random binary64 bit patterns, consecutive representable neighbors and
    # extrema. Source fixture comparisons use packed bits, never tolerances.
    rng=random.Random(20260909);values=[]
    for _ in range(1024):
        while True:
            v=struct.unpack('>d',rng.getrandbits(64).to_bytes(8,'big'))[0]
            if math.isfinite(v):break
        values.append(v)
        n=math.nextafter(v,math.inf)
        if math.isfinite(n):values.append(n)
    values.extend([sys.float_info.max,-sys.float_info.max,sys.float_info.min,math.nextafter(sys.float_info.min,0),.1,-.1,0.,-0.])
    for i in range(0,len(values),700):native(f'random-adjacent-{i:04d}',scene([values[i:i+700]]))
    poly=shape({'kind':'polyline','vertices':[[-.5,0.,1.],[.5,0.,1.],[.5,1.,1.],[-.5,0.,1.]],'closed':False})
    base=scene(shapes=[poly,copy.deepcopy(poly)])
    native('overlapping-duplicate-paths',base)
    mutants={}
    q=copy.deepcopy(base)
    for s in q['shapes']:
        for v in s['geometry']['vertices']:v[0]+=17;v[1]-=9
    mutants['translation']=q
    q=copy.deepcopy(base)
    for s in q['shapes']:
        for v in s['geometry']['vertices']:v[0]*=2;v[1]*=8;v[2]*=.25
    mutants['independent-axis-scales']=q
    q=copy.deepcopy(base);q['shapes'][1]['geometry']['vertices'][0][0]=math.nextafter(-.5,0);mutants['adjacent-coordinate']=q
    q=copy.deepcopy(base);q['shapes'][1]['geometry']['vertices'][0][1]=1e-12;mutants['below-character-cell']=q
    q=copy.deepcopy(base);q['shapes'][1]['geometry']['vertices'][0][2]=2.;mutants['geometric-depth']=q
    q=copy.deepcopy(base);q['shapes'][1]['depth']=4;mutants['derivation-depth']=q
    q=copy.deepcopy(base);q['shapes'][1]['createdAtStep']=18;mutants['creation-step']=q
    q=copy.deepcopy(base);q['shapes'][1]['topology']['edges']=[[0,1],[0,1],[1,0],[1,1]];mutants['duplicate-self-reversed-edges']=q
    q=copy.deepcopy(base);q['shapes'][1]['geometry']['closed']=True;mutants['closure']=q
    q=copy.deepcopy(base);q['shapes'][1]['attributes'].update(color='#000001',material='glossy',texture=math.nextafter(.2,1),curvature=[2.,1.],symmetry=['radial','bilateral'],bounds=[0.,-0.,1.,-1.]);mutants['all-attributes']=q
    q=copy.deepcopy(mutants['all-attributes']);q['shapes'].reverse();mutants['object-order']=q
    q=copy.deepcopy(base);q['shapes'][1]['geometry']['vertices'].reverse();mutants['vertex-order']=q
    for k,v in mutants.items():native(k,v)
    masks={k:hashlib.sha256(Image.open(out/(k+'.png')).tobytes()).hexdigest() for k in mutants}
    masks['original']=hashlib.sha256(Image.open(out/'overlapping-duplicate-paths.png').tobytes()).hexdigest()
    record({'name':'distinct-geometric-changes','status':'pass' if len(set(masks.values()))==len(masks) else 'FAIL','kind':'pixel-distinction','masks':masks})
    all_shapes=[shape({'kind':'point','p':[0.,-0.]}),shape({'kind':'segment','a':[0.,0.],'b':[0.,0.]}),
        shape({'kind':'ray','a':[0.,1.,2.],'b':[0.,1.,2.]}),shape({'kind':'disk','center':[0.,1.],'radius':-0.}),
        shape({'kind':'ball','center':[0.,1.,2.],'radius':sys.float_info.max}),shape({'kind':'polygon','vertices':[]}),
        shape({'kind':'curve','controlPoints':[[0.,0.],[.125,math.nextafter(.125,1)],[.5,-0.],[1.,0.]]}),
        shape({'kind':'surface','seed':[0.,1.,-1.,math.ulp(0.)]}),shape({'kind':'polyline','vertices':[],'closed':True})]
    all_shapes[0]['attributes']['symmetry']=list(SYMMETRIES)
    native('all-kinds-degeneracies-and-categories',scene(shapes=all_shapes))
    native('maximum-capacity',scene([[rng.random() for _ in range(2382)]]))
    rejected('capacity-one-scalar-over',scene([[0.]*2383]),'capacity')
    rejected('full-600x600-matrix',scene([[0.]*360000]),'capacity')
    rejected('unknown-root',dict(tiny,sourceText='unrecoverable text'))
    for bad in [float('nan'),float('inf'),-float('inf'),2**53+1]:rejected('unsupported-number-'+str(bad),scene([[bad]]))
    q=copy.deepcopy(base);q['shapes'][0]['attributes']['opacity']=.5;rejected('unknown-attribute',q)
    q=copy.deepcopy(base);q['shapes'][0]['geometry']['vertices'][0].append(1.);rejected('mixed-dimensions',q)
    q=copy.deepcopy(base);q['shapes'][0]['depth']=-0.;rejected('structural-negative-zero',q)
    q=copy.deepcopy(base);q['shapes'][0]['geometry']={'kind':'derived','operation':'transform','params':{'matrix':[1,0,0,1,0,0]}};rejected('derived-geometry',q)
    # Genuine saved project fixtures are copied as data, without calling any
    # old engine or rendering code. The extraction scope remains explicit.
    fixtures=ROOT/'research/power-garden/fixtures'
    for f in sorted(fixtures.glob('*.scene.json')):native(f.stem,load(f))
    src=ROOT/'research/lossless-visible/fixtures/fresh-ascii-24-step-stream.json'
    rejected('entire-saved-shape-stream',json.loads(src.read_text()))
    # Native lossless export and reopening, including PNG metadata independence.
    original=Image.open(out/'display-sample.png').convert('RGB')
    for level in [0,1,9]:
        path=out/f'png-reexport-{level}.png';original.save(path,compress_level=level)
        cp,dt=inverse(path);record({'name':path.stem,'status':'pass' if cp.returncode==0 and exact(json.loads(cp.stdout),tiny) else 'FAIL','kind':'lossless-reexport','decode_seconds':dt})
    meta=PngImagePlugin.PngInfo();meta.add_text('answer','THIS IS WRONG AND MUST NEVER BE READ')
    path=out/'wrong-metadata.png';original.save(path,pnginfo=meta)
    cp,dt=inverse(path);record({'name':'metadata-independence','status':'pass' if cp.returncode==0 and exact(json.loads(cp.stdout),tiny) else 'FAIL','kind':'ancillary-data-ignored'})
    chunks=[];raw=(out/'display-sample.png').read_bytes();p=8
    while p<len(raw):n=int.from_bytes(raw[p:p+4],'big');chunks.append(raw[p+4:p+8].decode());p+=n+12
    record({'name':'native-png-chunks','status':'pass' if set(chunks)=={'IHDR','IDAT','IEND'} else 'FAIL','chunks':chunks})
    # Real changes and corrupt observations: measured outcomes, never promoted
    # to a guarantee. Converted RGB pixels are the sole decoder input.
    def altered(name,im,kind,expected=None):
        path=out/(name+'.png');im.save(path)
        cp,dt=inverse(path);recovered=cp.returncode==0 and exact(json.loads(cp.stdout),tiny)
        observed='exact' if recovered else 'valid-but-wrong' if cp.returncode==0 else 'rejected'
        record({'name':name,'status':'measured','kind':kind,'observed':observed,'decode_seconds':dt,'dimensions':list(im.size),'stderr':cp.stderr,'expected':expected})
    for scale in [.25,.5,.75,.99,1.01,1.5,2.]:
        for name,method in [('nearest',Image.Resampling.NEAREST),('lanczos',Image.Resampling.LANCZOS)]:
            resized=original.resize((round(original.width*scale),round(original.height*scale)),method)
            altered(f'resize-{scale}-{name}',resized,'resized-dimensions')
            altered(f'restore-{scale}-{name}',resized.resize(original.size,method),'resize-back-to-native')
    for quality in [100,95,85,70,50,30,10,1]:
        jpg=out/f'jpeg-{quality}.jpg';original.save(jpg,quality=quality)
        altered(f'jpeg-{quality}-pixels',Image.open(jpg).convert('RGB'),'jpeg')
    altered('crop-one-bottom-row',original.crop((0,0,original.width,original.height-1)),'crop')
    altered('crop-one-right-column',original.crop((0,0,original.width-1,original.height)),'crop')
    # Same-size clipping replaces a one-pixel component, illustrating lack of
    # error correction without smuggling in a checksum.
    q=original.copy();d=ImageDraw.Draw(q);j,k=divmod(1023,64);x=64+2*272+4+8*j;y=64+88+12+k
    d.line((x+1,y,x+3,y),fill=(242,237,210))
    altered('erase-complete-unit-leaf',q,'valid-image-mutation','can silently change 1 to 0')
    # Permission negative control: friendly decoder fs calls cannot read even
    # a known source fixture under the exact runtime restriction used above.
    cp=subprocess.run(['node','--permission','-e',"require('node:fs').readFileSync(process.argv[1])",str(out/'display-sample.input.json')],capture_output=True,text=True)
    record({'name':'source-read-permission-denied','status':'pass' if cp.returncode!=0 and 'ERR_ACCESS_DENIED' in cp.stderr else 'FAIL','stderr':cp.stderr})
    unchanged=all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in source.items())
    result={'finished_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_unchanged_during_execution':unchanged,
            'passed':sum(r['status']=='pass' for r in rows),'failed':sum(r['status']=='FAIL' for r in rows),
            'measured':sum(r['status']=='measured' for r in rows),'cases':rows,'incidents':incidents,
            'scientific_validation':'not tested; no semantic or neural improvement claim'}
    jsonwrite(out/'results.json',result)
    print(json.dumps({k:v for k,v in result.items() if k not in ('cases','incidents')}),flush=True)
    return 1 if result['failed'] or not unchanged else 0

if __name__=='__main__':raise SystemExit(main())
