"""Direct signed dyadic-power geometry. Newly implemented; no prior engine."""
from PIL import Image, ImageDraw
import math
from contract import *

def scalar(draw, x, y, value):
    value=number(value,'scalar')
    negative=math.copysign(1,value)<0
    direction=-1 if negative else 1
    # 33 fixed orthographic stalks cover 2098 absolute powers of two.
    # A leaf at (stalk j, level k) IS the additive component 2**(1023-64*j-k).
    # We never serialize a float buffer, a JSON record, or a compressed payload.
    for j in range(33):
        sx=x+4+8*j
        draw.line((sx,y+8,sx,y+78),fill=INK)
        draw.line((sx,y+8,sx+3*direction,y+5),fill=INK)
    draw.line((x+1,y+80,x+267,y+80),fill=INK)
    numerator,denominator=abs(value).as_integer_ratio()
    power=-(denominator.bit_length()-1)
    while numerator:
        low=(numerator & -numerator).bit_length()-1
        p=power+low
        j,k=divmod(1023-p,64)
        sx=x+4+8*j;sy=y+12+k
        draw.line((sx,sy,sx+3*direction,sy),fill=INK)
        numerator &= numerator-1

def render(scene):
    rows=plan(scene)
    im=Image.new('RGB',(WIDTH,TOP+ROW*len(rows)+FOOT),BG)
    d=ImageDraw.Draw(im)
    # Constant unobscuring sunset; no source-dependent decorative input.
    d.rectangle((0,0,WIDTH-1,TOP-1),fill=(226,155,83))
    d.ellipse((WIDTH//2-22,5,WIDTH//2+22,49),fill=(255,220,125))
    d.line((0,TOP-3,WIDTH-1,TOP-3),fill=INK,width=2)
    for i,(role,values) in enumerate(rows):
        y=TOP+i*ROW
        # Public categorical ruler: the row's structural role is the height
        # of its left corn stalk. It is part of the visible grouping grammar.
        h=2*role
        d.rectangle((20,y+74-h,22,y+74),fill=INK)
        d.line((16,y+77,26,y+77),fill=INK)
        for col,v in enumerate(values):scalar(d,LEFT+TILE*col,y,v)
    d.line((0,im.height-8,WIDTH-1,im.height-8),fill=INK,width=2)
    return im

def save(scene,path):
    # Fresh RGB image has no metadata, alpha, palette or hidden channels.
    im=render(scene)
    with open(path,'xb') as f:im.save(f,format='PNG',compress_level=6)
    return {'width':im.width,'height':im.height,'pixels':im.width*im.height,'rgb_bytes':im.width*im.height*3}
