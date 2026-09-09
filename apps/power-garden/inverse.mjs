#!/usr/bin/env node
// Independent pixel inverse. Built-in Node modules only. No renderer import,
// fixture paths, project modules, seeds, hashes, JSON inputs or answer lookup.
import fs from 'node:fs';
import zlib from 'node:zlib';

function fail(s) { throw new Error(s); }
const WIDTH=1712, TOP=64, ROW=88, FOOT=16, LEFT=64, TILE=272;

function png(data) {
  if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail('PNG required');
  let pos=8,w,h,channels,ended=false,seenData=false; const parts=[];
  while(pos+12<=data.length) {
    const n=data.readUInt32BE(pos), name=data.toString('ascii',pos+4,pos+8);
    if(pos+12+n>data.length) fail('truncated PNG');
    const raw=data.subarray(pos+8,pos+8+n);
    if(name==='IHDR') {
      if(pos!==8||n!==13) fail('invalid header');
      w=raw.readUInt32BE(0);h=raw.readUInt32BE(4);
      if(w!==WIDTH||h<TOP+ROW+FOOT||(h-TOP-FOOT)%ROW||h>TOP+400*ROW+FOOT) fail('native dimensions required');
      if(raw[8]!==8||![2,6].includes(raw[9])||raw[10]||raw[11]||raw[12]) fail('8-bit noninterlaced RGB/RGBA PNG required');
      channels=raw[9]===2?3:4;
    } else if(name==='IDAT') {if(!w)fail('missing header');seenData=true;parts.push(raw);}
    else if(name==='IEND') {if(n)fail('invalid end');ended=true;pos+=12;break;}
    else if(name[0]===name[0].toUpperCase()) fail('unsupported critical PNG chunk');
    // Ancillary metadata is deliberately neither interpreted nor exposed.
    pos+=n+12;
  }
  if(!ended||!seenData||pos!==data.length) fail('incomplete PNG or trailing bytes');
  const stride=w*channels;
  const raw=zlib.inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*h});
  if(raw.length!==(stride+1)*h) fail('invalid raster length');
  const mask=new Uint8Array(w*h);let previous=new Uint8Array(stride),curr=new Uint8Array(stride);
  for(let y=0;y<h;y++) {
    const type=raw[y*(stride+1)];if(type>4)fail('unknown PNG filter');
    for(let x=0;x<stride;x++) {
      const a=x>=channels?curr[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;
      let prediction=0;
      if(type===1)prediction=a;
      if(type===2)prediction=b;
      if(type===3)prediction=Math.floor((a+b)/2);
      if(type===4) {
        const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
        prediction=pa<=pb&&pa<=pc?a:pb<=pc?b:c;
      }
      curr[x]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
    for(let x=0;x<w;x++) {
      if(channels===4&&curr[x*channels+3]!==255)fail('transparency outside contract');
      mask[y*w+x]=curr[x*channels]+curr[x*channels+1]+curr[x*channels+2]<300?1:0;
    }
    [previous,curr]=[curr,previous];
  }
  return {mask,w,h};
}

function interpret(image) {
  const {mask,w,h}=image, count=(h-TOP-FOOT)/ROW;
  const at=(x,y)=>mask[y*w+x];
  const bit=(m,x,y)=>{m[y*TILE+x]=1;};
  function plant(x,y) {
    let any=false;
    for(let dy=0;dy<ROW&&!any;dy++)for(let dx=0;dx<TILE;dx++)if(at(x+dx,y+dy)){any=true;break;}
    if(!any)return null;
    const sign=at(x+7,y+5)?1:at(x+1,y+5)?-1:fail('missing visible tassel');
    const expected=new Uint8Array(TILE*ROW);
    let q=0n;
    for(let j=0;j<33;j++) {
      const sx=4+8*j;
      for(let yy=8;yy<=78;yy++)bit(expected,sx,yy);
      for(let k=0;k<=3;k++)bit(expected,sx+sign*k,8-k);
      for(let k=0;k<64;k++) {
        if(at(x+sx+3*sign,y+12+k)) {
          const power=1023-64*j-k;
          if(power< -1074)fail('leaf outside binary64 power range');
          q |= 1n<<BigInt(power+1074);
          for(let b=1;b<=3;b++)bit(expected,sx+b*sign,12+k);
        }
      }
    }
    for(let xx=1;xx<=267;xx++)bit(expected,xx,80);
    for(let dy=0;dy<ROW;dy++)for(let dx=0;dx<TILE;dx++)if(at(x+dx,y+dy)!==expected[dy*TILE+dx])fail('damaged or noncanonical plant');
    if(q===0n)return sign<0?-0:0;
    // Derive a representable binary64 from the exact visible dyadic sum.
    // This is independent of Python's ratio-based forward construction.
    const highest=q.toString(2).length-1, shift=Math.max(0,highest-52);
    const lowMask=(1n<<BigInt(shift))-1n;
    if(q&lowMask)fail('visible sum requires more than binary64 precision');
    const value=Number(q>>BigInt(shift))*2**(shift-1074);
    if(!Number.isFinite(value)||value===0)fail('nonrepresentable visible sum');
    return sign*value;
  }
  const rows=[];
  for(let i=0;i<count;i++) {
    const y=TOP+ROW*i;
    let first=-1;for(let dy=0;dy<ROW;dy++)if(at(21,y+dy)){first=dy;break;}
    const role=(74-first)/2;
    if(first<0||!Number.isInteger(role)||role<1||role>25)fail('unknown row role');
    for(let dy=0;dy<ROW;dy++)for(let x=0;x<LEFT;x++) {
      const expected=(x>=20&&x<=22&&dy>=74-2*role&&dy<=74)||(dy===77&&x>=16&&x<=26);
      if(at(x,y+dy)!==Number(expected))fail('damaged row grouping');
    }
    const values=[];let blank=false;
    for(let c=0;c<6;c++) {
      const value=plant(LEFT+c*TILE,y);
      if(value===null)blank=true;
      else {if(blank)fail('noncontiguous occupancy');values.push(value);}
    }
    for(let dy=0;dy<ROW;dy++)for(let x=LEFT+6*TILE;x<w;x++)if(at(x,y+dy))fail('right border obstruction');
    rows.push({role,values});
  }
  for(let y=h-FOOT;y<h;y++)for(let x=0;x<w;x++)if(at(x,y)!==Number(y===h-8||y===h-7))fail('missing complete footer');
  return parseRows(rows);
}

function parseRows(rows) {
  const kinds=['point','segment','ray','disk','ball','polygon','curve','surface','polyline'];
  const sym=['bilateral','radial','spherical','linear','lattice','radialRotate',...Array.from({length:14},(_,i)=>`dihedral-${i+3}`)];
  let i=0;
  const peek=()=>rows[i]?.role;
  function one(role,n) {
    const r=rows[i++];if(!r||r.role!==role||r.values.length!==n)fail(`expected role ${role} with ${n} values`);
    return r.values;
  }
  function many(role,group=1) {
    if(peek()!==role)fail(`missing role ${role}`);
    const out=[];
    while(peek()===role) {
      const v=rows[i++].values;
      if(v.length%group)fail('incomplete grouped coordinates');
      out.push(...v);
      if(peek()===role&&v.length!==6)fail('noncanonical continuation');
    }
    return out;
  }
  function integer(x,a,b) {
    if(!Number.isSafeInteger(x)||Object.is(x,-0)||x<a||x>b)fail('invalid structural integer');return x;
  }
  const scene={schema:'power-garden/v1',shapes:[],states:[]};
  while(peek()>=1&&peek()<=9) {
    if(scene.shapes.length===32)fail('shape capacity');
    const type=peek(),kind=kinds[type-1],meta=one(type,type===9?3:2);
    const s={geometry:{kind},topology:null,attributes:null,depth:integer(meta[0],0,128),createdAtStep:integer(meta[1],0,Number.MAX_SAFE_INTEGER)};
    const g=s.geometry;
    if(kind==='surface')g.seed=many(12);
    else {
      const code=peek();if(code!==10&&code!==11)fail('missing coordinate dimension');
      const dim=code===10?2:3,a=many(code,dim),pts=[];
      for(let j=0;j<a.length;j+=dim)pts.push(a.slice(j,j+dim));
      if(!pts.length&&dim!==2)fail('noncanonical empty coordinate dimension');
      if(['point','disk','ball'].includes(kind)) {
        if(pts.length!==1)fail('one center or point required');
        g[kind==='point'?'p':'center']=pts[0];
      } else if(['segment','ray'].includes(kind)) {
        if(pts.length!==2)fail('two endpoints required');[g.a,g.b]=pts;
      } else g[kind==='curve'?'controlPoints':'vertices']=pts;
      if(kind==='disk'||kind==='ball') {
        if(dim!==(kind==='disk'?2:3))fail('primitive dimension');
        [g.radius]=one(13,1);if(g.radius<0)fail('negative radius');
      }
      if(kind==='polyline')g.closed=!!integer(meta[2],0,1);
    }
    const topo=one(14,3);
    s.topology={dimension:integer(topo[0],0,3),nodes:integer(topo[1],0,Number.MAX_SAFE_INTEGER),edges:[],components:integer(topo[2],0,Number.MAX_SAFE_INTEGER)};
    const endpoints=many(15,2);if(endpoints.length>2048)fail('edge capacity');
    for(let j=0;j<endpoints.length;j+=2)s.topology.edges.push(endpoints.slice(j,j+2).map(x=>integer(x,0,s.topology.nodes-1)));
    const mat=peek();if(mat!==16&&mat!==17)fail('unknown material');
    const a=one(mat,4);
    s.attributes={color:'#'+a.slice(0,3).map(x=>integer(x,0,255).toString(16).padStart(2,'0')).join(''),material:mat===16?'matte':'glossy',texture:a[3],curvature:many(18),symmetry:many(19).map(x=>sym[integer(x,0,sym.length-1)]),bounds:many(20)};
    if(s.attributes.symmetry.length>128)fail('symmetry capacity');
    one(21,0);scene.shapes.push(s);
  }
  while(peek()===22) {
    if(scene.states.length===16)fail('state capacity');
    one(22,0);scene.states.push(many(23));one(24,0);
  }
  one(25,0);if(i!==rows.length)fail('extra rows after scene');
  return scene;
}

function exactJSON(x) {
  if(typeof x==='number') {
    if(Object.is(x,-0))return '-0.0';
    // String(2**60) is "1152921504606847000", which reparses to the same JS
    // Number but is not the exact integer denoted by that Number. Emit exact
    // integer digits so the strict cross-language input contract stays closed.
    return Number.isInteger(x)?BigInt(x).toString():String(x);
  }
  if(Array.isArray(x))return '['+x.map(exactJSON).join(',')+']';
  if(x&&typeof x==='object')return '{'+Object.entries(x).map(([k,v])=>JSON.stringify(k)+':'+exactJSON(v)).join(',')+'}';
  return JSON.stringify(x);
}
try {
  if(process.argv.length!==3)fail('usage: node inverse.mjs image.png');
  const result=interpret(png(fs.readFileSync(process.argv[2])));
  process.stdout.write(exactJSON(result)+'\n');
} catch(e) { process.stderr.write('ImageRejected: '+e.message+'\n');process.exitCode=2; }
