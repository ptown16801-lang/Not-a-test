#!/usr/bin/env python3
"""Independent inverse. Reads a complete RGB pixel image and public rules only.

No imports from renderer, engine, adapters, fixtures or provenance. The CLI
installs a file-access audit guard after importing its fixed dependencies.
"""
import argparse
import json
import math
import sys
from pathlib import Path
try:
    import numpy as np
    from PIL import Image
except ModuleNotFoundError:
    # Optional fixed public dependencies in the restricted browser preview.
    # This location contains libraries, never renderer input or fixture files.
    sys.path.insert(0, '/site/vendor')
    import numpy as np
    from PIL import Image

R = json.loads(Path(__file__).with_name('rules.json').read_text())


class InvalidImage(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise InvalidImage(message)


def categorical(mask, x, y, count):
    found = []
    region = mask[y:y+42,x:x+18]
    for k in range(count):
        yy,xx = np.indices((42,18))
        index = (yy//7)*4 + xx//5
        expected = (yy%7 < 5) & (xx%5 < 3) & (index <= k)
        if np.array_equal(region, expected):
            found.append(k)
    require(len(found) == 1, 'unknown categorical morphology')
    return found[0]


def scalar(mask):
    """Infer horizontal leaf extents; reconstruct using ldexp, not bit unpacking."""
    require(mask.shape == (160,112), 'incomplete stalk')
    plus = mask[12:15,56:67].all()
    minus = mask[12:15,46:57].all()
    require(plus != minus, 'ambiguous or missing sign tassel')
    digits = []
    for j in range(16):
        yy = 26+7*j
        ink = np.flatnonzero(mask[yy])
        require(len(ink) > 0, 'missing leaf')
        extent = int(ink[-1]-56 if j%2 == 0 else 56-ink[0])
        require(6 <= extent <= 51 and (extent-6)%3 == 0, 'leaf extent is not on the fixed ruler')
        digits.append((extent-6)//3)
    # Check every pixel of the actual geometric component, including blanks.
    yy,xx = np.indices((160,112))
    canonical = (abs(xx-56) <= 1) & (yy >= 16) & (yy <= 148)
    canonical |= (yy >= 12) & (yy <= 14) & (xx >= (56 if plus else 46)) & (xx <= (66 if plus else 56))
    for j,v in enumerate(digits):
        start = 26+7*j
        reach = 6+3*v
        canonical |= (yy >= start) & (yy <= start+2) & (xx >= (56 if j%2 == 0 else 56-reach)) & (xx <= (56+reach if j%2 == 0 else 56))
    require(np.array_equal(mask,canonical), 'stalk pixels do not match public geometry')
    fraction = sum(v*16**(12-j) for j,v in enumerate(digits[:13]))
    scale = digits[13]*256+digits[14]*16+digits[15]
    if scale == 0:
        require(plus and fraction == 0, 'invalid canonical zero')
        return 0.0
    require(1 <= scale <= 2098, 'scale outside finite binary64')
    exponent = scale-1075
    significand = 2**52+fraction
    try:
        x = math.ldexp(float(significand), exponent-52)
    except OverflowError as exc:
        raise InvalidImage('overflow') from exc
    require(math.isfinite(x) and x != 0, 'underflow or nonfinite value')
    m,e = math.frexp(x)
    require(e-1 == exponent and int(math.ldexp(m,53)) == significand, 'noncanonical subnormal or rounded value')
    return x if plus else -x


def rows_from_pixels(image):
    im = image.convert('RGB')
    require(im.width == R['width'], 'native width required')
    h = im.height - R['sky'] - 16
    require(h > 0 and h%R['tile_height'] == 0, 'native height required')
    n = h//R['tile_height']
    require(n <= R['max_rows'], 'image row capacity exceeded')
    # Hue is irrelevant: all useful information is visible foreground geometry.
    rgb = np.asarray(im)
    mask = rgb.astype(np.uint16).sum(axis=2) < 200
    footer = np.zeros((16,im.width),dtype=bool)
    footer[8:11,8:im.width-8] = True
    require(np.array_equal(mask[-16:],footer), 'missing complete bottom boundary (clipping)')
    require(not mask[:R['sky']].any(), 'top coordinate margin altered')
    rows=[]
    for i in range(n):
        y = R['sky']+i*160
        bed = mask[y:y+160]
        if not bed.any():
            rows.append((None,[]))
            continue
        role = R['roles'][categorical(mask,16,y+16,len(R['roles']))]
        clean = bed.copy()
        clean[16:58,16:34] = False
        vals=[]
        ended=False
        for j in range(R['columns']):
            x=R['margin']+j*112
            tile=bed[:,x:x+112]
            if not tile.any():
                ended=True
                continue
            require(not ended, 'gap in ordered field')
            if role == 'symmetry':
                value=R['symmetries'][categorical(mask,x+46,y+62,len(R['symmetries']))]
                check=tile.copy()
                check[62:104,46:64]=False
                require(not check.any(), 'unexpected symbolic geometry')
            else:
                value=scalar(tile)
            vals.append(value)
            clean[:,x:x+112]=False
        require(not clean.any(), 'overlap, unrecognized geometry or border corruption')
        rows.append((role,vals))
    return rows


def reconstruct(rows):
    scene={'schema':R['schema'],'shapes':[],'states':[]}
    if rows == [(None,[])]:
        return scene
    i=0

    def take(role):
        nonlocal i
        require(i < len(rows) and rows[i][0] == role, 'missing semantic field '+str(role))
        values=rows[i][1]
        i+=1
        return values

    def group(role):
        result=[take(role)]
        while i < len(rows) and rows[i][0] == role:
            result.append(take(role))
        return result

    def vector(role):
        parts=group(role)
        require(all(len(v)==12 for v in parts[:-1]) and (len(parts)==1 or len(parts[-1])>0), 'noncanonical array wrapping')
        return [x for row in parts for x in row]

    def integer(x,lo,hi):
        require(x==int(x) and lo<=x<=hi,'invalid semantic integer')
        return int(x)

    while i < len(rows) and rows[i][0] in R['roles'][:9]:
        k=rows[i][0]
        head=take(k)
        require(len(head)==6,'invalid primitive header')
        depth,step,dim,nodes,components,closed=head
        depth=integer(depth,0,128)
        step=integer(step,0,2**53-1)
        dim=integer(dim,0,3)
        nodes=integer(nodes,0,2**53-1)
        components=integer(components,0,2**53-1)
        closed=integer(closed,0,1)
        require(k=='polyline' or closed==0,'unused closure field')
        require(i<len(rows),'missing coordinates')
        if rows[i][0]=='coordinates':
            require(take('coordinates')==[],'empty coordinate bed required')
            pts=[]
        else:
            role=rows[i][0]
            require(role in ('coordinates2','coordinates3'),'coordinate dimension morphology required')
            dimension=int(role[-1])
            coordinates=vector(role)
            require(len(coordinates)>0 and len(coordinates)%dimension==0,'incomplete point')
            pts=[coordinates[j:j+dimension] for j in range(0,len(coordinates),dimension)]
        require(len(pts)<=R['max_vertices'],'vertex capacity exceeded')
        require(all(len(p) in (2,3) for p in pts) and len({len(p) for p in pts})<=1, 'coordinate dimensions')
        g={'kind':k}
        if k=='point':
            require(len(pts)==1,'point coordinate count');g['p']=pts[0]
        elif k in ('segment','ray'):
            require(len(pts)==2,'endpoint count');g.update(a=pts[0],b=pts[1])
        elif k in ('disk','ball'):
            require(len(pts)==1 and len(pts[0])==(2 if k=='disk' else 3),'center dimension')
            radius=take('radius')
            require(len(radius)==1 and radius[0]>=0,'invalid radius')
            g.update(center=pts[0],radius=radius[0])
        elif k=='curve':
            g['controlPoints']=pts
        elif k=='surface':
            require(not pts,'surface uses its exact seed');g['seed']=vector('seed')
        else:
            g['vertices']=pts
            if k=='polyline':g['closed']=bool(closed)
        flat_edges=vector('edges')
        require(len(flat_edges)%2==0,'incomplete edge')
        edges=[flat_edges[j:j+2] for j in range(0,len(flat_edges),2)]
        require(len(edges)<=R['max_vertices'],'edge count')
        edges=[[integer(e,0,nodes-1) for e in pair] for pair in edges]
        require(i<len(rows) and rows[i][0] in R['materials'],'missing material')
        material=rows[i][0]
        attr=take(material)
        require(len(attr)==4,'invalid attributes')
        color='#'+''.join(format(integer(c,0,255),'02x') for c in attr[:3])
        bounds=vector('bounds');curvature=vector('curvature');symmetry=vector('symmetry')
        scene['shapes'].append({'geometry':g,'topology':{'dimension':dim,'nodes':nodes,'edges':edges,'components':components},'attributes':{'color':color,'material':material,'texture':attr[3],'bounds':bounds,'curvature':curvature,'symmetry':symmetry},'depth':depth,'createdAtStep':step})
    while i<len(rows):
        values=vector('state')
        require(len(values)<=R['max_neurons'],'neuron capacity exceeded')
        take(None)
        scene['states'].append(values)
    require(len(scene['shapes'])<=R['max_shapes'] and len(scene['states'])<=R['max_states'],'record capacity exceeded')
    return scene


def decode(image):
    return reconstruct(rows_from_pixels(image))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('image')
    args=p.parse_args()
    target=Path(args.image).resolve()
    # File access after bootstrap: only the image. No seeds, arrays, fixtures,
    # source paths, network or subprocess can be read by the decoder.
    opened=[]
    def audit(event,args):
        if event=='open':
            path=args[0]
            if isinstance(path,(str,bytes)):
                resolved=Path(path).resolve()
                if resolved!=target:
                    raise PermissionError('inverse decoder may open only its image')
                opened.append('image')
        if event in ('socket.__new__','subprocess.Popen','os.system','os.listdir','os.scandir'):
            raise PermissionError('inverse decoder has no external lookup capability')
    # Load PNG/JPEG image plugins before locking filesystem imports.
    Image.init()
    sys.addaudithook(audit)
    with Image.open(target) as im:
        result=decode(im)
    print(json.dumps(result,allow_nan=False,separators=(',',':')))
    print(json.dumps({'files_opened':opened,'decoder':'independent-pixel-inverse/v1'}),file=sys.stderr)


if __name__=='__main__':
    main()
