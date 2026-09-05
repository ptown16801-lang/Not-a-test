/** Dirt Inscription Renderer v0 (actuator-neutral, dependency-free). */

import { createStamp } from './stego.js';
import { createGroundTextureRecipe } from './dirt-texture.js';

const EPS = 1e-9;
const round = n => Math.round(n * 1e6) / 1e6;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function transformPoint([x, y], [a, b, c, d, e, f]) {
  return [a * x + c * y + e, b * x + d * y + f];
}

function projectPoint([x,y],m){
  const w=m[6]*x+m[7]*y+m[8];
  return Math.abs(w)<EPS?[x,y]:[(m[0]*x+m[1]*y+m[2])/w,(m[3]*x+m[4]*y+m[5])/w];
}

function circle(center, radius, samples = 40) {
  return [Array.from({length: samples + 1}, (_, i) => {
    const t = i * Math.PI * 2 / samples;
    return [center[0] + Math.cos(t) * radius, center[1] + Math.sin(t) * radius];
  })];
}

function bezier(points, samples = 32) {
  if (points.length < 2) return points.length ? [[...points]] : [];
  return [Array.from({length: samples + 1}, (_, i) => {
    const work = points.map(p => [...p]);
    const t = i / samples;
    for (let k = work.length - 1; k; k--) for (let j = 0; j < k; j++) work[j] = lerp(work[j], work[j + 1], t);
    return work[0];
  })];
}

function neuralPopulationContour({preferredAngles=[],activity=[],baseRadius=1,modulation=.28,smoothingPasses=3,samples=96}){
  if(preferredAngles.length<3||preferredAngles.length!==activity.length)return [];
  let values=activity.map(Number);
  for(let pass=0;pass<Math.max(0,Math.round(smoothingPasses));pass++)values=values.map((value,i)=>(values[(i+values.length-1)%values.length]+2*value+values[(i+1)%values.length])/4);
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length,maxDeviation=Math.max(EPS,...values.map(value=>Math.abs(value-mean)));
  const count=Math.max(preferredAngles.length,Math.round(samples)),phase=preferredAngles[0]||0;
  const path=Array.from({length:count},(_,sample)=>{const position=sample*values.length/count,index=Math.floor(position)%values.length,next=(index+1)%values.length,t=position-Math.floor(position),value=values[index]+(values[next]-values[index])*t,angle=phase+sample*Math.PI*2/count,radius=baseRadius*(1+modulation*(value-mean)/maxDeviation);return [radius*Math.cos(angle),radius*Math.sin(angle)];});
  return [[...path,path[0]]];
}

function neuralCrossModalWeave({edges=[],innerRadius=.72,outerRadius=1,samples=18,bend=.34}){
  const maxWeight=Math.max(EPS,...edges.map(edge=>Math.abs(edge.weight)));
  return edges.map(edge=>{
    const sourceRadius=edge.direction==='1-to-2'?outerRadius:innerRadius,targetRadius=edge.direction==='1-to-2'?innerRadius:outerRadius;
    const a=[sourceRadius*Math.cos(edge.sourceAngle),sourceRadius*Math.sin(edge.sourceAngle)],z=[targetRadius*Math.cos(edge.targetAngle),targetRadius*Math.sin(edge.targetAngle)];
    const dx=z[0]-a[0],dy=z[1]-a[1],length=Math.max(EPS,Math.hypot(dx,dy)),signed=Math.sign(edge.weight)||1,amount=bend*(.3+.7*Math.abs(edge.weight)/maxWeight);
    const control=[(a[0]+z[0])/2-dy/length*amount*signed,(a[1]+z[1])/2+dx/length*amount*signed];
    return Array.from({length:Math.max(4,Math.round(samples))+1},(_,i)=>{const t=i/Math.max(4,Math.round(samples)),u=1-t;return [u*u*a[0]+2*u*t*control[0]+t*t*z[0],u*u*a[1]+2*u*t*control[1]+t*t*z[1]];});
  });
}

const pointSegmentDistance = (p,a,b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d<EPS?0:Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d));
  return dist(p,[a[0]+t*dx,a[1]+t*dy]);
};
const isClosed = p => p.length>2&&dist(p[0],p.at(-1))<1e-5;
function pointInPolygon([x,y],polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/**
 * Deterministic, dependency-free approximate polygon union. Geometry is sampled
 * onto a normalized occupancy grid, then only exterior cell edges are traced.
 * Closed input paths are filled; open paths receive a configurable stroke.
 */
function unionPaths(paths,{unionResolution=128,compositionStroke=.08}={}){
  if(!paths.length)return [];
  const b=bounds(paths),pad=compositionStroke, x0=b[0]-pad,x1=b[2]+pad,y0=b[1]-pad,y1=b[3]+pad;
  const span=Math.max(x1-x0,y1-y0,EPS),cell=span/Math.max(16,unionResolution);
  const cols=Math.max(1,Math.ceil((x1-x0)/cell)),rows=Math.max(1,Math.ceil((y1-y0)/cell));
  const closed=paths.filter(isClosed),open=paths.filter(p=>!isClosed(p));
  const occupied=Array.from({length:rows},()=>new Uint8Array(cols));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const p=[x0+(i+.5)*cell,y0+(j+.5)*cell];
    if(closed.some(poly=>pointInPolygon(p,poly))||open.some(line=>line.slice(1).some((q,k)=>pointSegmentDistance(p,line[k],q)<=compositionStroke/2)))occupied[j][i]=1;
  }
  const has=(i,j)=>i>=0&&j>=0&&i<cols&&j<rows&&occupied[j][i];
  const edges=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)if(has(i,j)){
    if(!has(i,j-1))edges.push([[i,j],[i+1,j]]);
    if(!has(i+1,j))edges.push([[i+1,j],[i+1,j+1]]);
    if(!has(i,j+1))edges.push([[i+1,j+1],[i,j+1]]);
    if(!has(i-1,j))edges.push([[i,j+1],[i,j]]);
  }
  const key=p=>`${p[0]},${p[1]}`,next=new Map();
  for(const [a,z] of edges){const k=key(a);if(!next.has(k))next.set(k,[]);next.get(k).push(z);}
  for(const xs of next.values())xs.sort((a,z)=>a[0]-z[0]||a[1]-z[1]);
  const take=(a,z)=>{const xs=next.get(key(a)),i=xs?.findIndex(q=>q[0]===z[0]&&q[1]===z[1]);if(i>=0)xs.splice(i,1);};
  const loops=[];
  for(const edge of edges){if(!(next.get(key(edge[0]))||[]).some(q=>q[0]===edge[1][0]&&q[1]===edge[1][1]))continue;
    const loop=[edge[0]],start=edge[0];let a=edge[0],z=edge[1];take(a,z);loop.push(z);
    while(key(z)!==key(start)){const candidates=next.get(key(z))||[];if(!candidates.length)break;a=z;z=candidates[0];take(a,z);loop.push(z);}
    if(loop.length>3&&key(loop[0])===key(loop.at(-1))){
      const simple=loop.filter((p,i,all)=>{if(i===0||i===all.length-1)return true;const a=all[i-1],z=all[i+1];return (p[0]-a[0])*(z[1]-p[1])!==(p[1]-a[1])*(z[0]-p[0]);});
      loops.push(simple.map(([i,j])=>[round(x0+i*cell),round(y0+j*cell)]));
    }
  }
  return loops;
}

/** Replay a shape's provenance DAG into normalized 2-D paths. */
export function bakeShapePaths(shapeId, shapeMap, options = {}, cache = new Map()) {
  if (cache.has(shapeId)) return cache.get(shapeId).map(p => p.map(q => [...q]));
  const s = shapeMap.get(shapeId);
  if (!s) throw new Error(`Unknown shape ${shapeId}`);
  const g = s.geometry;
  let paths;
  if (g.kind === 'point') paths = circle(g.p, options.pointRadius ?? .025, 12);
  else if (g.kind === 'segment' || g.kind === 'ray') paths = [[g.a, g.b]];
  else if (g.kind === 'disk') paths = circle(g.center, g.radius, options.curveSamples ?? 40);
  else if (g.kind === 'polygon') paths = [[...g.vertices, g.vertices[0]]];
  else if (g.kind === 'curve') paths = bezier(g.controlPoints, options.curveSamples ?? 32);
  else if (g.kind === 'ball') paths = circle([g.center[0], g.center[1]], g.radius, options.curveSamples ?? 40);
  else if (g.kind === 'surface') {
    const q = g.seed.length >= 4 ? [[g.seed[0],g.seed[1]],[g.seed[2],g.seed[1]],[g.seed[2],g.seed[3]],[g.seed[0],g.seed[3]],[g.seed[0],g.seed[1]]] : [];
    paths = q.length ? [q] : [];
  } else {
    const parents = s.provenance.parents.map(id => bakeShapePaths(id, shapeMap, options, cache));
    const op = g.operation || s.provenance.operator;
    const params = {...s.provenance.params, ...g.params};
    if (op === 'transform') paths = parents[0].map(p => p.map(q => transformPoint(q, params.matrix)));
    else if (op === 'combine') paths = params.mode==='union'||params.mode==='blend' ? unionPaths(parents.flat(),options) : parents.flat();
    else if (op === 'compose') paths = unionPaths(parents.flat(),options);
    else if (op === 'replicateArrange') {
      const count = params.count ?? 2, arrangement = params.arrangement ?? 'bilateral'; paths = [];
      for (let i = 0; i < count; i++) {
        const angle = count === 1 ? 0 : i * Math.PI * 2 / count;
        const columns=params.columns??Math.ceil(Math.sqrt(count)), row=Math.floor(i/columns), col=i%columns;
        const tx = arrangement === 'linear' || arrangement === 'lattice' ? (i - (count - 1) / 2) * .3
          : arrangement==='lattice2d'?(col-(columns-1)/2)*(params.spacingX??.7)+(params.stagger&&row%2?(params.spacingX??.7)/2:0)
          : arrangement==='sequenceCurve'?(i-(count-1)/2)*(params.spacing??.25)
          : Math.cos(angle) * (params.radius??.22);
        const ty = arrangement === 'radial' ? Math.sin(angle) * .22
          : arrangement==='lattice2d'?(row-((params.rows??Math.ceil(count/columns))-1)/2)*(params.spacingY??.7)
          : arrangement==='sequenceCurve'?Math.sin(i*(params.frequency??1)*Math.PI*2/Math.max(1,count-1))*(params.amplitude??.3)
          : 0;
        const sx = arrangement === 'bilateral' && i % 2 ? -1 : 1;
        const scale=arrangement==='concentric'?(params.minScale??.2)+((params.maxScale??1)-(params.minScale??.2))*i/Math.max(1,count-1):1;
        paths.push(...parents[0].map(p => p.map(([x,y]) => {
          if(arrangement==='radialRotate')return [x*Math.cos(angle)-y*Math.sin(angle)+tx,x*Math.sin(angle)+y*Math.cos(angle)+ty];
          return [sx*x*scale+tx,y*scale+ty];
        })));
      }
    } else if (op === 'morph') {
      if(params.parameters?.kind==='logarithmicSpiral'){
        const q=params.parameters, direction=q.clockwise?-1:1, samples=q.samples??160;
        paths=[[...Array(samples+1)].map((_,i)=>{const t=i/samples*Math.PI*2*q.turns, r=q.startRadius*Math.exp(q.growth*t);return [r*Math.cos(direction*t+q.phase),r*Math.sin(direction*t+q.phase)];})];
      }else if(params.parameters?.kind==='neuralPopulationContour')paths=neuralPopulationContour(params.parameters);
      else if(params.parameters?.kind==='neuralCrossModalWeave')paths=neuralCrossModalWeave(params.parameters);
      else{const amount = Number(params.parameters?.[0] ?? 0); paths = parents[0].map(p => p.map(([x,y]) => [x, y + Math.sin(x*Math.PI)*amount*.08]));}
    } else if (op === 'projectSlice') paths = params.mode==='perspective'&&Array.isArray(params.homography)&&params.homography.length===9?parents[0].map(p=>p.map(q=>projectPoint(q,params.homography))):parents[0];
    else if (op === 'dualPolar') paths = parents[0].map(p => [...p].reverse());
    else if (op === 'subdivideSimplify') {
      const level = Math.max(1, params.level ?? 1);
      paths = parents[0].map(p => params.mode === 'simplify' ? p.filter((_,i)=>i%(level+1)===0||i===p.length-1) : p.flatMap((q,i)=>i<p.length-1?[q,...Array.from({length:level},(_,j)=>lerp(q,p[i+1],(j+1)/(level+1)))]:[q]));
    } else paths = parents.flat();
  }
  paths = paths.filter(p => p.length >= 2).map(p => p.map(([x,y]) => [round(x),round(y)]));
  cache.set(shapeId, paths);
  return paths.map(p => p.map(q => [...q]));
}

function bounds(paths) {
  const pts = paths.flat();
  return pts.reduce((b,[x,y]) => [Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)], [Infinity,Infinity,-Infinity,-Infinity]);
}

function fitIntoZone(paths, zone, padding) {
  const b = bounds(paths), bw=Math.max(EPS,b[2]-b[0]), bh=Math.max(EPS,b[3]-b[1]);
  const zw=Math.max(EPS,zone.x1-zone.x0-2*padding), zh=Math.max(EPS,zone.y1-zone.y0-2*padding);
  const scale=Math.min(zw/bw,zh/bh), cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2;
  const tx=(zone.x0+zone.x1)/2, ty=(zone.y0+zone.y1)/2;
  return paths.map(p => p.map(([x,y]) => [round(tx+(x-cx)*scale),round(ty+(y-cy)*scale)]));
}

// Rounded-corner replacement. This avoids actuator-stopping cusps when adjacent
// segments are long enough; paths that still violate radius are omitted below.
function roundCorners(path, radius, samples=4) {
  if (radius <= 0 || path.length < 3) return path;
  const out=[path[0]];
  for(let i=1;i<path.length-1;i++){
    const a=path[i-1],b=path[i],c=path[i+1], d=Math.min(radius,dist(a,b)/3,dist(b,c)/3);
    if(d<EPS){out.push(b);continue;}
    const p=lerp(b,a,d/dist(a,b)),q=lerp(b,c,d/dist(b,c)); out.push(p);
    for(let j=1;j<samples;j++){const t=j/samples;out.push(lerp(lerp(p,b,t),lerp(b,q,t),t));} out.push(q);
  }
  out.push(path.at(-1)); return out.map(p=>p.map(round));
}

const pathLength = p => p.slice(1).reduce((n,q,i)=>n+dist(p[i],q),0);

/**
 * Map normalized cognition shapes into chronological physical inscription zones.
 * Physical coordinates are [x,y] metres: origin is near-left end, +x crosses
 * the tram-line and +y runs away from its beginning.
 */
export function renderDirtInscription(stream, config = {}) {
  if (stream.schema !== 'shape-cognition/v1') throw new Error(`Expected shape-cognition/v1, got ${stream.schema}`);
  const c={lengthM:30,widthM:2.4,edgeMarginM:.15,longitudinalMarginM:.5,minTurningRadiusM:.08,maxPathDensity:.12,strokeWidthM:.02,travelSpeedMps:.8,drawSpeedMps:.2,selection:'active-and-selected',fade:{mode:'none'},overwrite:'preserve',groundTexture:{enabled:true},...config};
  if(c.lengthM<=0||c.widthM<=0)throw new Error('lengthM and widthM must be positive');
  const map=new Map(stream.shapes.map(s=>[s.id,s]));
  const chronology=new Map();
  for(const step of stream.steps||[]) for(const x of step.selected||[]) if(!chronology.has(x.shapeId))chronology.set(x.shapeId,step.index);
  for(const id of stream.active||[]) if(!chronology.has(id))chronology.set(id,map.get(id)?.createdAtStep||0);
  const entries=[...chronology].filter(([id])=>map.has(id)).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]));
  const usableLength=c.lengthM-2*c.longitudinalMarginM, zoneLength=usableLength/Math.max(1,entries.length);
  const commands=[]; const inscriptions=[]; let timeS=0, usedArea=0, current=[0,0];
  if(c.overwrite==='erase-all'){commands.push({seq:commands.length,timeS:0,type:'erase',region:{x0:0,y0:0,x1:c.widthM,y1:c.lengthM}});}
  for(let i=0;i<entries.length;i++){
    const [shapeId,createdAtStep]=entries[i]; const normalized=bakeShapePaths(shapeId,map,c);
    const zone={x0:c.edgeMarginM,x1:c.widthM-c.edgeMarginM,y0:c.longitudinalMarginM+i*zoneLength,y1:c.longitudinalMarginM+(i+1)*zoneLength};
    if(c.overwrite==='erase-zone')commands.push({seq:commands.length,timeS:round(timeS),type:'erase',region:zone,shapeId});
    let physical=fitIntoZone(normalized,zone,Math.min(.08,zoneLength*.08)).map(p=>roundCorners(p,c.minTurningRadiusM));
    const accepted=[]; let omitted=0;
    for(const p of physical){const len=pathLength(p), area=len*c.strokeWidthM;if((usedArea+area)/(c.lengthM*c.widthM)>c.maxPathDensity){omitted++;continue;} accepted.push(p);usedArea+=area;}
    for(let pi=0;pi<accepted.length;pi++){
      const p=accepted[pi],start=p[0];
      timeS+=dist(current,start)/c.travelSpeedMps;
      commands.push({seq:commands.length,timeS:round(timeS),type:'move',to:start,speedMps:c.travelSpeedMps,shapeId,pathIndex:pi});
      commands.push({seq:commands.length,timeS:round(timeS),type:'tool',state:'down',shapeId,pathIndex:pi});
      for(let j=1;j<p.length;j++){timeS+=dist(p[j-1],p[j])/c.drawSpeedMps;commands.push({seq:commands.length,timeS:round(timeS),type:'draw',to:p[j],speedMps:c.drawSpeedMps,minimumTurningRadiusM:c.minTurningRadiusM,shapeId,pathIndex:pi});}
      commands.push({seq:commands.length,timeS:round(timeS),type:'tool',state:'up',shapeId,pathIndex:pi});
      current=p.at(-1);
    }
    if(c.fade?.mode==='ttl'&&Number.isFinite(c.fade.afterSeconds))commands.push({seq:commands.length,timeS:round(timeS+c.fade.afterSeconds),type:'fade',region:zone,shapeId,method:c.fade.method||'natural'});
    const stegoStamp=c.stego?.agentId===undefined?undefined:createStamp({agentId:c.stego.agentId,sequence:(c.stego.sequenceStart??0)+i,provenanceHash:shapeId});
    const stegoCarrier=c.stego?.carrier||'jpeg-watermark';
    const stegoRegionSize=c.stego?.regionSize??(stegoCarrier==='jpeg-watermark'?256:stegoCarrier==='watermark'?192:64);
    const groundTexture=c.groundTexture?.enabled===false?undefined:createGroundTextureRecipe(shapeId,c.groundTexture?.recipe);
    inscriptions.push({shapeId,createdAtStep,zone,paths:accepted,omittedPaths:omitted,fade:c.fade,...(groundTexture?{groundTexture}:{}),...(stegoStamp?{stego:{stamp:stegoStamp,carrier:stegoCarrier,keyId:c.stego.keyId||null,placement:{corner:c.stego.corner||'bottom-right',regionSize:stegoRegionSize}}}:{})});
  }
  commands.sort((a,b)=>a.timeS-b.timeS||a.seq-b.seq).forEach((x,i)=>x.seq=i);
  return {schema:'dirt-inscription/v0',sourceSchema:stream.schema,units:'metres',coordinateSystem:{origin:'near-left-end',x:'across-width',y:'forward-from-origin',bounds:[0,0,c.widthM,c.lengthM]},config:c,stats:{shapeCount:entries.length,pathCount:inscriptions.reduce((n,x)=>n+x.paths.length,0),drawLengthM:round(usedArea/c.strokeWidthM),soilUseFraction:round(usedArea/(c.lengthM*c.widthM)),durationS:round(timeS)},inscriptions,commands};
}
