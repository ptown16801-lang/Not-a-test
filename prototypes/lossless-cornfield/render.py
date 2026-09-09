#!/usr/bin/env python3
"""Semantic geometry -> visible coordinate stalks. No image payload or metadata.

The strict input contract is documented in CONTRACT.md. This is a different
geometric representation from the approximate perspective ASCII artwork.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

RULES = json.loads(Path(__file__).with_name('rules.json').read_text())
ROLES = RULES['roles']


class Unsupported(ValueError):
    pass


class CapacityError(ValueError):
    pass


def keys(value, expected, where):
    if type(value) is not dict or set(value) != set(expected.split()):
        raise Unsupported(f'{where}: expected exactly {expected}; got {list(value) if isinstance(value, dict) else type(value).__name__}')


def number(x, where='number'):
    if type(x) not in (int, float) or not math.isfinite(x):
        raise Unsupported(f'{where}: finite binary64 required')
    if type(x) is int and float(x) != x:
        raise Unsupported(f'{where}: integer not exactly representable as binary64')
    if x == 0 and math.copysign(1, x) < 0:
        raise Unsupported(f'{where}: negative zero is outside the canonical project domain')
    return float(x)


def integer(x, lo, hi, where):
    number(x, where)
    if int(x) != x or not lo <= x <= hi:
        raise Unsupported(f'{where}: integer in [{lo},{hi}] required')


def vector(xs, where):
    if type(xs) is not list:
        raise Unsupported(f'{where}: dense list required')
    if len(xs) > RULES['max_scalars']:
        raise CapacityError(f'{where}: scalar capacity exceeded')
    for x in xs:
        number(x, where)


def prepare(scene):
    """Validate BEFORE image allocation; plan semantic rows, never byte tokens."""
    keys(scene, 'schema shapes states', 'scene')
    if scene['schema'] != RULES['schema']:
        raise Unsupported('unsupported scene schema; complete engine streams are not accepted')
    if type(scene['shapes']) is not list or type(scene['states']) is not list:
        raise Unsupported('shapes and states must be lists')
    if len(scene['shapes']) > RULES['max_shapes'] or len(scene['states']) > RULES['max_states']:
        raise CapacityError('shape/state capacity exceeded')
    rows = []

    def array(role, values, symbol=False):
        if not symbol:
            vector(values, role)
        for offset in range(0, max(1, len(values)), RULES['columns']):
            rows.append((role, values[offset:offset + RULES['columns']], symbol))

    for s in scene['shapes']:
        keys(s, 'geometry topology attributes depth createdAtStep', 'shape')
        g, t, a = s['geometry'], s['topology'], s['attributes']
        if type(g) is not dict or g.get('kind') not in ROLES[:9]:
            raise Unsupported('geometry: only explicit primitives, curves and polylines; derived DAGs require a separate contract')
        k = g['kind']
        fields = {'point':'p', 'segment':'a b', 'ray':'a b', 'disk':'center radius',
                  'polygon':'vertices', 'curve':'controlPoints', 'ball':'center radius',
                  'surface':'seed', 'polyline':'vertices closed'}[k]
        keys(g, 'kind ' + fields, 'geometry')
        keys(t, 'dimension nodes edges components', 'topology')
        integer(s['depth'], 0, 128, 'depth')
        integer(s['createdAtStep'], 0, 2**53-1, 'createdAtStep')
        integer(t['dimension'], 0, 3, 'topology.dimension')
        integer(t['nodes'], 0, 2**53-1, 'topology.nodes')
        integer(t['components'], 0, 2**53-1, 'topology.components')
        closed = g.get('closed', False)
        if type(closed) is not bool:
            raise Unsupported('closed must be boolean')
        array(k, [s['depth'], s['createdAtStep'], t['dimension'], t['nodes'], t['components'], int(closed)])
        if k in ('polygon', 'polyline', 'curve'):
            pts = g['controlPoints' if k == 'curve' else 'vertices']
        elif k in ('disk', 'ball'):
            pts = [g['center']]
        elif k == 'point':
            pts = [g['p']]
        elif k in ('segment', 'ray'):
            pts = [g['a'], g['b']]
        else:
            pts = []
        if type(pts) is not list or len(pts) > RULES['max_vertices']:
            raise CapacityError('vertex capacity exceeded')
        if len({len(p) for p in pts if type(p) is list}) > 1:
            raise Unsupported('mixed coordinate dimensions')
        if not pts:
            array('coordinates', [])
        for p in pts:
            vector(p, 'coordinate')
            if len(p) not in (2, 3) or (k == 'ball' and len(p) != 3) or (k == 'disk' and len(p) != 2):
                raise Unsupported('coordinates require 2D or 3D; disks 2D, balls 3D')
        if pts:
            array('coordinates'+str(len(pts[0])), [x for p in pts for x in p])
        if k in ('disk', 'ball'):
            number(g['radius'], 'radius')
            if g['radius'] < 0:
                raise Unsupported('negative radius')
            array('radius', [g['radius']])
        if k == 'surface':
            array('seed', g['seed'])
        if type(t['edges']) is not list or len(t['edges']) > RULES['max_vertices']:
            raise CapacityError('edge capacity exceeded')
        for edge in t['edges']:
            if type(edge) is not list or len(edge) != 2:
                raise Unsupported('edges are ordered pairs')
            for n in edge:
                integer(n, 0, t['nodes']-1, 'edge endpoint')
        array('edges', [x for edge in t['edges'] for x in edge])
        keys(a, 'color material texture curvature symmetry bounds', 'attributes')
        c = a['color']
        if not isinstance(c, str) or len(c) != 7 or c[0] != '#' or any(ch not in '0123456789abcdef' for ch in c[1:]):
            raise Unsupported('color must be canonical lowercase #rrggbb')
        if a['material'] not in RULES['materials']:
            raise Unsupported('unsupported material')
        array(a['material'], [int(c[i:i+2], 16) for i in (1, 3, 5)] + [a['texture']])
        array('bounds', a['bounds'])
        array('curvature', a['curvature'])
        if type(a['symmetry']) is not list or any(v not in RULES['symmetries'] for v in a['symmetry']):
            raise Unsupported('unsupported symmetry; no arbitrary string encoding')
        array('symmetry', a['symmetry'], True)
    for state in scene['states']:
        vector(state, 'neural state')
        if len(state) > RULES['max_neurons']:
            raise CapacityError('neuron capacity exceeded')
        # A separated bed for each observation, with an explicit empty gap.
        array('state', state)
        rows.append((None, [], False))
    scalars = sum(len(v) for _, v, symbolic in rows if not symbolic)
    if len(rows) > RULES['max_rows'] or scalars > RULES['max_scalars']:
        raise CapacityError(f'capacity exceeded: {len(rows)} rows / {scalars} scalars; limits {RULES["max_rows"]} / {RULES["max_scalars"]}')
    return rows


def decomposition(value):
    """Exact dyadic coordinate decomposition, using integer arithmetic.

    x = sign * (2**52 + F) * 2**(e-52). The thirteen leaves are
    successively finer dyadic coordinate intervals, NOT bytes of a record.
    """
    x = number(value)
    if x == 0:
        return 1, 0, 0
    n, d = abs(x).as_integer_ratio()
    p = n.bit_length()
    e = p - d.bit_length()
    significand = n << (53-p) if p <= 53 else n >> (p-53)
    return (-1 if x < 0 else 1), e + 1075, significand - 2**52


def stalk(draw, x, y, value):
    sign, scale, fraction = decomposition(value)
    ink = tuple(RULES['ink'])
    cx = x + 56
    draw.rectangle((cx-1,y+16,cx+1,y+148), fill=ink)
    # Tassel leans toward the sign; its position is an actual geometric DOF.
    tip = cx + 10*sign
    draw.rectangle((min(cx,tip), y+12, max(cx,tip), y+14), fill=ink)
    digits = [(fraction // 16**(12-j)) % 16 for j in range(13)]
    digits += [(scale // 16**(2-j)) % 16 for j in range(3)]
    for j, digit in enumerate(digits):
        yy = y+26+7*j
        length = 6+3*digit
        end = cx + length * (1 if j % 2 == 0 else -1)
        draw.rectangle((min(cx,end),yy,max(cx,end),yy+2), fill=ink)


def symbol(draw, x, y, index):
    """Public categorical morphology: one through twenty upright shoots."""
    ink = tuple(RULES['ink'])
    for j in range(index+1):
        xx = x + 5*(j % 4)
        yy = y + 7*(j // 4)
        draw.rectangle((xx,yy,xx+2,yy+4), fill=ink)


def render(scene):
    rows = prepare(scene)
    w, h = RULES['width'], RULES['sky'] + max(1,len(rows))*RULES['tile_height'] + 16
    im = Image.new('RGB', (w,h), tuple(RULES['background']))
    d = ImageDraw.Draw(im)
    d.rectangle((0,0,w-1,RULES['sky']-1), fill=tuple(RULES['sky_color']))
    d.ellipse((w//2-18,9,w//2+18,45), fill=(255,226,139))
    d.rectangle((8,h-8,w-9,h-6), fill=tuple(RULES['ink']))
    # Sunset and field margin are constant and carry no state.
    for i,(role,values,symbolic) in enumerate(rows):
        y = RULES['sky'] + i*RULES['tile_height']
        if role is None:
            continue
        symbol(d, 16, y+16, ROLES.index(role))
        for j,v in enumerate(values):
            x = RULES['margin'] + j*RULES['tile_width']
            if symbolic:
                symbol(d, x+46, y+62, RULES['symmetries'].index(v))
            else:
                stalk(d,x,y,v)
    return im


def strict_json(text):
    def pairs(items):
        out = {}
        for k,v in items:
            if k in out:
                raise Unsupported('duplicate JSON key')
            out[k] = v
        return out
    # Parse every JSON number directly as binary64, as the JavaScript boundary
    # does. Strict programmatic callers also reject nonrepresentable Python ints.
    return json.loads(text, object_pairs_hook=pairs, parse_int=float,
                      parse_constant=lambda s: (_ for _ in ()).throw(Unsupported('non-finite JSON')))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('scene')
    p.add_argument('image')
    a = p.parse_args()
    scene = strict_json(Path(a.scene).read_text())
    im = render(scene)
    # Explicit RGB PNG with no ancillary text, profile, EXIF, alpha or palette.
    im.save(a.image, format='PNG')
    print(json.dumps({'width':im.width,'height':im.height,'pixels':im.width*im.height,
                      'rows':len(prepare(scene)),'bytes':Path(a.image).stat().st_size}))


if __name__ == '__main__':
    main()
