"""Power Garden v1 boundary and layout. No engine dependency."""
import json
import math

SCHEMA = 'power-garden/v1'
WIDTH, TOP, FOOT, ROW, LEFT, TILE, SLOTS, MAX_ROWS = 1712, 64, 16, 88, 64, 272, 6, 400
BG, INK = (242, 237, 210), (24, 65, 38)
KINDS = ('point', 'segment', 'ray', 'disk', 'ball', 'polygon', 'curve', 'surface', 'polyline')
SYMMETRIES = ('bilateral', 'radial', 'spherical', 'linear', 'lattice', 'radialRotate') + tuple(f'dihedral-{i}' for i in range(3, 17))

class DomainError(ValueError): pass
class CapacityError(ValueError): pass

def keys(obj, expected, at):
    if type(obj) is not dict or set(obj) != set(expected.split()):
        raise DomainError(f'{at}: expected exactly {{{expected}}}')

def number(v, at):
    if type(v) not in (int, float):
        raise DomainError(f'{at}: finite binary64 number required')
    try: f = float(v)
    except (OverflowError, ValueError): raise DomainError(f'{at}: not binary64')
    if not math.isfinite(f) or (type(v) is int and int(f) != v):
        raise DomainError(f'{at}: nonfinite or inexact integer conversion')
    return f

def integer(v, lo, hi, at):
    f = number(v, at)
    if f != int(f) or not lo <= f <= hi or (f == 0 and math.copysign(1, f) < 0):
        raise DomainError(f'{at}: integer {lo}..{hi} required; structural -0 unsupported')
    return int(f)

def array(v, at, limit=2400):
    if type(v) is not list: raise DomainError(f'{at}: array required')
    if len(v) > limit: raise CapacityError(f'{at}: {len(v)} entries exceed {limit}; no truncation')
    return v

def numeric(v, at):
    return [number(x, f'{at}[{i}]') for i,x in enumerate(array(v,at))]

def points(v, at):
    a = array(v, at)
    d = len(a[0]) if a and type(a[0]) is list else 2
    if d not in (2,3): raise DomainError(f'{at}: 2D or 3D required')
    out = []
    for i,p in enumerate(a):
        q = numeric(p, f'{at}[{i}]')
        if len(q) != d: raise DomainError(f'{at}: mixed dimensions')
        out.extend(q)
    return d,out

def plan(scene):
    """Validate every accepted field before allocating or opening an output file.

    Returns rows of semantic groups. This plan is never given to the decoder.
    """
    keys(scene, 'schema shapes states', 'root')
    if scene['schema'] != SCHEMA: raise DomainError('unknown schema')
    shapes=array(scene['shapes'],'shapes',32)
    states=array(scene['states'],'states',16)
    rows=[]
    def row(role, vals=()):
        if len(vals)>6: raise AssertionError('internal row overflow')
        rows.append((role, list(vals)))
    def many(role, vals):
        for i in range(0,max(1,len(vals)),6): row(role,vals[i:i+6])
    for si,s in enumerate(shapes):
        at=f'shapes[{si}]'
        keys(s,'geometry topology attributes depth createdAtStep',at)
        g=s['geometry']
        if type(g) is not dict or g.get('kind') not in KINDS: raise DomainError(f'{at}: unsupported geometry')
        kind=g['kind']
        meta=[integer(s['depth'],0,128,at+'.depth'),integer(s['createdAtStep'],0,2**53-1,at+'.createdAtStep')]
        if kind=='polyline':
            if type(g.get('closed')) is not bool: raise DomainError('closed must be boolean')
            meta.append(int(g['closed']))
        row(KINDS.index(kind)+1,meta)
        if kind in ('point','segment','ray','disk','ball'):
            if kind=='point':
                keys(g,'kind p',at+'.geometry'); coords=[g['p']]
            elif kind in ('segment','ray'):
                keys(g,'kind a b',at+'.geometry'); coords=[g['a'],g['b']]
            else:
                keys(g,'kind center radius',at+'.geometry'); coords=[g['center']]
            d,values=points(coords,at+'.coordinates')
            if kind=='disk' and d!=2 or kind=='ball' and d!=3: raise DomainError('disk is 2D; ball is 3D')
            many(10 if d==2 else 11,values)
            if kind in ('disk','ball'):
                rad=number(g['radius'],at+'.radius')
                if rad<0: raise DomainError('negative radius')
                row(13,[rad])
        elif kind=='surface':
            keys(g,'kind seed',at+'.geometry');many(12,numeric(g['seed'],at+'.seed'))
        else:
            field='controlPoints' if kind=='curve' else 'vertices'
            keys(g,'kind '+field+(' closed' if kind=='polyline' else ''),at+'.geometry')
            d,values=points(g[field],at+'.'+field);many(10 if d==2 else 11,values)
        t=s['topology'];keys(t,'dimension nodes edges components',at+'.topology')
        n=integer(t['nodes'],0,2**53-1,at+'.nodes')
        row(14,[integer(t['dimension'],0,3,at+'.dimension'),n,integer(t['components'],0,2**53-1,at+'.components')])
        edges=[]
        for edge in array(t['edges'],at+'.edges',1024):
            if type(edge) is not list or len(edge)!=2: raise DomainError('edge must have two endpoints')
            edges.extend(integer(v,0,n-1,at+'.edge') for v in edge)
        many(15,edges)
        a=s['attributes'];keys(a,'color material texture curvature symmetry bounds',at+'.attributes')
        color=a['color']
        if type(color) is not str or len(color)!=7 or color[0]!='#' or any(c not in '0123456789abcdef' for c in color[1:]):
            raise DomainError('color must be lowercase #rrggbb')
        if a['material'] not in ('matte','glossy'): raise DomainError('unsupported material')
        row(16 if a['material']=='matte' else 17,[int(color[i:i+2],16) for i in (1,3,5)]+[number(a['texture'],at+'.texture')])
        many(18,numeric(a['curvature'],at+'.curvature'))
        sym=array(a['symmetry'],at+'.symmetry',128)
        if any(type(x) is not str or x not in SYMMETRIES for x in sym): raise DomainError('unsupported symmetry')
        many(19,[SYMMETRIES.index(x) for x in sym])
        many(20,numeric(a['bounds'],at+'.bounds'))
        row(21)
    for i,s in enumerate(states):
        vals=numeric(s,f'states[{i}]')
        row(22);many(23,vals);row(24)
    row(25)
    h=TOP+len(rows)*ROW+FOOT
    if len(rows)>MAX_ROWS:
        raise CapacityError(f'{len(rows)} rows require {WIDTH}x{h}={WIDTH*h} pixels; limit {MAX_ROWS} rows; no clipping')
    return rows

def load(path):
    def pairs(items):
        obj={}
        for k,v in items:
            if k in obj: raise DomainError('duplicate JSON key: '+k)
            obj[k]=v
        return obj
    def const(v): raise DomainError('nonfinite JSON constant: '+v)
    # Integral JSON literals must be exactly representable; finite decimal
    # literals denote binary64 values, not recoverable source spellings.
    with open(path,encoding='utf-8') as f:
        return json.load(f,object_pairs_hook=pairs,parse_constant=const,
                         parse_int=lambda s: -0.0 if s=='-0' else int(s))
