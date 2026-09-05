import { OPERATOR_KINDS } from './types.js';

const round = (n) => Math.round(n * 1e6) / 1e6;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};
const hash = (value) => {
  let h = 2166136261;
  for (const ch of canonical(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
};
const parentRefs = new WeakMap();

/** Deterministic PRNG with serializable state. */
export class SeededRandom {
  constructor(seed = 1) { this.state = (seed >>> 0) || 1; }
  next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 4294967296; }
  pick(xs) { return xs[Math.floor(this.next() * xs.length)]; }
}

const defaults = (overrides = {}) => Object.freeze({
  color: '#d8a03f', material: 'matte', texture: 0.2, curvature: [0],
  symmetry: [], bounds: [0, 0, 1, 1], ...overrides
});
const topo = (dimension, nodes, edges = [], components = 1) => Object.freeze({dimension, nodes, edges:Object.freeze(edges), components});

/** Immutable content-addressed shape with immutable provenance. */
function makeShape({geometry, topology, attributes, provenance, depth = 0, createdAtStep = 0, tags = []}) {
  const body = {geometry, topology, attributes, provenance, depth, tags};
  const shape = Object.freeze({id:`shape_${hash(body)}`, ...body, createdAtStep, tags:Object.freeze([...tags])});
  parentRefs.set(shape, Object.freeze([]));
  return shape;
}

export const primitive = Object.freeze({
  point: (p=[0,0], opts={}) => makeShape({geometry:{kind:'point',p},topology:topo(0,1),attributes:defaults(opts.attributes),provenance:{operator:'primitive',parents:[],params:{kind:'point'}},tags:opts.tags||[]}),
  segment: (a=[-0.5,0],b=[0.5,0],opts={}) => makeShape({geometry:{kind:'segment',a,b},topology:topo(1,2,[[0,1]]),attributes:defaults({...opts.attributes,bounds:[a[0],a[1],b[0],b[1]]}),provenance:{operator:'primitive',parents:[],params:{kind:'segment'}},tags:opts.tags||[]}),
  ray: (a=[0,0],b=[1,0],opts={}) => makeShape({geometry:{kind:'ray',a,b},topology:topo(1,2,[[0,1]]),attributes:defaults(opts.attributes),provenance:{operator:'primitive',parents:[],params:{kind:'ray'}},tags:opts.tags||[]}),
  disk: (center=[0,0],radius=1,opts={}) => makeShape({geometry:{kind:'disk',center,radius},topology:topo(2,1),attributes:defaults({...opts.attributes,curvature:[round(1/radius)],bounds:[center[0]-radius,center[1]-radius,center[0]+radius,center[1]+radius],symmetry:['radial']}),provenance:{operator:'primitive',parents:[],params:{kind:'disk'}},tags:opts.tags||[]}),
  polygon: (sides=3,radius=1,opts={}) => { const vertices=Array.from({length:sides},(_,i)=>[round(Math.cos(i*2*Math.PI/sides)*radius),round(Math.sin(i*2*Math.PI/sides)*radius)]); return makeShape({geometry:{kind:'polygon',vertices},topology:topo(2,sides,vertices.map((_,i)=>[i,(i+1)%sides])),attributes:defaults({...opts.attributes,symmetry:[`dihedral-${sides}`],bounds:[-radius,-radius,radius,radius]}),provenance:{operator:'primitive',parents:[],params:{kind:'polygon',sides,radius}},tags:opts.tags||[]}); },
  ball: (center=[0,0,0],radius=1,opts={}) => makeShape({geometry:{kind:'ball',center,radius},topology:topo(3,1),attributes:defaults({...opts.attributes,curvature:[round(1/radius),round(1/radius)],symmetry:['spherical']}),provenance:{operator:'primitive',parents:[],params:{kind:'ball'}},tags:opts.tags||[]}),
  curve: (controlPoints=[[0,0],[0.5,1],[1,0]],opts={}) => makeShape({geometry:{kind:'curve',controlPoints},topology:topo(1,controlPoints.length,controlPoints.slice(1).map((_,i)=>[i,i+1])),attributes:defaults(opts.attributes),provenance:{operator:'primitive',parents:[],params:{kind:'curve'}},tags:opts.tags||[]}),
  surface: (seed=[0,0,0,1],opts={}) => makeShape({geometry:{kind:'surface',seed},topology:topo(2,4,[[0,1],[1,2],[2,3],[3,0]]),attributes:defaults(opts.attributes),provenance:{operator:'primitive',parents:[],params:{kind:'surface'}},tags:opts.tags||[]})
});

function derive(operator, parents, params={}, patch={}) {
  if (!OPERATOR_KINDS.includes(operator)) throw new Error(`Illegal operator: ${operator}`);
  if (!parents.length) throw new Error(`${operator} requires a parent`);
  const depth = 1 + Math.max(...parents.map(p=>p.depth));
  const base = parents[0];
  const attributes = defaults({...base.attributes,...patch.attributes});
  const geometry = patch.geometry || {kind:'derived',operation:operator,params};
  const topology = patch.topology || base.topology;
  const shape = makeShape({geometry,topology,attributes,provenance:{operator,parents:parents.map(p=>p.id),params},depth,tags:patch.tags||[...new Set(parents.flatMap(p=>p.tags))]});
  parentRefs.set(shape, Object.freeze([...parents]));
  return shape;
}

export const operators = Object.freeze({
  transform:(shape,matrix=[1,0,0,1,0,0])=>derive('transform',[shape],{matrix},{geometry:{kind:'derived',operation:'transform',params:{matrix}}}),
  morph:(shape,parameters=[0])=>derive('morph',[shape],{parameters},{attributes:{curvature:Array.isArray(parameters)?parameters.map(round):shape.attributes.curvature}}),
  combine:(a,b,mode='union')=>derive('combine',[a,b],{mode},{topology:topo(Math.max(a.topology.dimension,b.topology.dimension),a.topology.nodes+b.topology.nodes,[...a.topology.edges,...b.topology.edges.map(([x,y])=>[x+a.topology.nodes,y+a.topology.nodes])], mode==='union'?a.topology.components+b.topology.components:1),tags:[...new Set([...a.tags,...b.tags])]}),
  replicateArrange:(shape,count=2,arrangement='bilateral',arrangementParams={})=>derive('replicateArrange',[shape],{count,arrangement,...arrangementParams},{topology:topo(shape.topology.dimension,shape.topology.nodes*count,[],shape.topology.components*count),attributes:{symmetry:[arrangement]},tags:[...shape.tags,'multiplicity']}),
  projectSlice:(shape,dimension=Math.max(0,shape.topology.dimension-1),mode='project',projectionParams={})=>derive('projectSlice',[shape],{dimension,mode,...projectionParams},{topology:topo(dimension,shape.topology.nodes,shape.topology.edges,shape.topology.components),tags:[...shape.tags,'abstraction']}),
  dualPolar:(shape,mode='dual')=>derive('dualPolar',[shape],{mode},{topology:topo(shape.topology.dimension,Math.max(1,shape.topology.edges.length),[],shape.topology.components),tags:[...shape.tags,'inversion']}),
  subdivideSimplify:(shape,mode='subdivide',level=1)=>derive('subdivideSimplify',[shape],{mode,level},{topology:topo(shape.topology.dimension,mode==='subdivide'?shape.topology.nodes*(level+1):Math.max(1,Math.ceil(shape.topology.nodes/(level+1))),[],shape.topology.components),tags:[...shape.tags,mode==='subdivide'?'detail':'gist']}),
  compose:(base,feature,anchor='center')=>derive('compose',[base,feature],{anchor},{topology:topo(Math.max(base.topology.dimension,feature.topology.dimension),base.topology.nodes+feature.topology.nodes,[...base.topology.edges,...feature.topology.edges],1),tags:[...new Set([...base.tags,...feature.tags,'nested'])]})
});

const descriptor = s => [s.topology.dimension/3,Math.min(s.topology.nodes,20)/20,Math.min(s.topology.edges.length,30)/30,Math.min(s.topology.components,10)/10,Math.min(s.depth,12)/12,s.attributes.symmetry.length?1:0,s.attributes.texture];
const distance = (a,b) => Math.sqrt(descriptor(a).reduce((v,x,i)=>v+(x-descriptor(b)[i])**2,0)/descriptor(a).length);
const jaccard = (a,b) => { const A=new Set(a),B=new Set(b),u=new Set([...A,...B]); return u.size?[...A].filter(x=>B.has(x)).length/u.size:0; };

export function scoreShape(shape,{library,workingSet,goal}) {
  const others=[...library.values()].filter(x=>x.id!==shape.id);
  const novelty=others.length?clamp01(Math.min(...others.map(x=>distance(shape,x)))*2):1;
  const coherence=workingSet.length?workingSet.reduce((n,x)=>n+(1-clamp01(distance(shape,x))),0)/workingSet.length:0.5;
  const simplicity=1/(1+0.22*shape.depth+0.025*shape.topology.nodes+0.08*shape.provenance.parents.length);
  const goalRelevance=goal?clamp01(0.65*jaccard(shape.tags,goal.tags||[])+0.35*(goal.targetSymmetry&&shape.attributes.symmetry.includes(goal.targetSymmetry)?1:0)):0.5;
  const symmetry=shape.attributes.symmetry.length?1:0.25;
  const predictivePower=clamp01((shape.provenance.parents.length+shape.topology.dimension)/5);
  const weights={novelty:.2,coherence:.18,simplicity:.17,goalRelevance:.3,symmetry:.08,predictivePower:.07,...goal?.weights};
  const total=round(Object.entries(weights).reduce((n,[k,w])=>n+w*({novelty,coherence,simplicity,goalRelevance,symmetry,predictivePower}[k]??0),0));
  return {novelty:round(novelty),coherence:round(coherence),simplicity:round(simplicity),goalRelevance:round(goalRelevance),symmetry:round(symmetry),predictivePower:round(predictivePower),total};
}

export class ShapeCognitionEngine {
  constructor({seed=1,beamWidth=3,maxWorkingSet=10,noveltyThreshold=.08}={}) { this.rng=new SeededRandom(seed); this.seed=seed; this.beamWidth=beamWidth; this.maxWorkingSet=maxWorkingSet; this.noveltyThreshold=noveltyThreshold; this.library=new Map(); this.workingSet=[]; this.steps=[]; }
  add(shape,{working=true}={}) { for(const parent of parentRefs.get(shape)||[])this.add(parent,{working:false}); this.library.set(shape.id,shape); if(working&&!this.workingSet.some(x=>x.id===shape.id))this.workingSet.push(shape); return shape; }
  generateCandidates(limit=24) {
    const ws=[...this.workingSet].sort((a,b)=>a.id.localeCompare(b.id)); if(!ws.length)return [];
    const out=[];
    while(out.length<limit){const a=this.rng.pick(ws),b=this.rng.pick(ws);const kind=this.rng.pick(OPERATOR_KINDS);const r=this.rng.next(); let c;
      if(kind==='transform')c=operators.transform(a,[1,0,0,1,round((r-.5)*2),round((this.rng.next()-.5)*2)]);
      else if(kind==='morph')c=operators.morph(a,[round(r),round(this.rng.next())]);
      else if(kind==='combine')c=operators.combine(a,b,this.rng.pick(['union','intersection','difference','blend']));
      else if(kind==='replicateArrange')c=operators.replicateArrange(a,2+Math.floor(r*4),this.rng.pick(['bilateral','radial','linear','lattice']));
      else if(kind==='projectSlice')c=operators.projectSlice(a,Math.max(0,a.topology.dimension-1),this.rng.pick(['project','slice']));
      else if(kind==='dualPolar')c=operators.dualPolar(a,this.rng.pick(['dual','polar']));
      else if(kind==='subdivideSimplify')c=operators.subdivideSimplify(a,r<.5?'subdivide':'simplify',1+Math.floor(this.rng.next()*3));
      else c=operators.compose(a,b,this.rng.pick(['center','edge','vertex']));
      if(!out.some(x=>x.id===c.id))out.push(c);
    } return out;
  }
  step(goal,candidateLimit=24){const candidates=this.generateCandidates(candidateLimit).map(shape=>({shape,fitness:scoreShape(shape,{library:this.library,workingSet:this.workingSet,goal})})).sort((a,b)=>b.fitness.total-a.fitness.total||a.shape.id.localeCompare(b.shape.id)); const selected=candidates.slice(0,this.beamWidth); for(const x of selected)if(x.fitness.novelty>=this.noveltyThreshold){this.add(x.shape,{working:false});const committed=Object.freeze({...x.shape,createdAtStep:this.steps.length+1});parentRefs.set(committed,parentRefs.get(x.shape)||[]);this.library.set(x.shape.id,committed);} this.workingSet=[...selected.map(x=>x.shape),...this.workingSet].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,this.maxWorkingSet); const record=Object.freeze({index:this.steps.length+1,goalId:goal.id,selected:selected.map(x=>({shapeId:x.shape.id,fitness:x.fitness})),candidateCount:candidates.length,workingSet:this.workingSet.map(x=>x.id),rngState:this.rng.state}); this.steps.push(record); return record;}
  run(goal,{maxSteps=8,terminationScore=.72,stableSteps=2}={}){let stable=0,last=null;for(let i=0;i<maxSteps;i++){last=this.step(goal);if(last.selected[0]?.fitness.goalRelevance>=terminationScore)stable++;else stable=0;if(stable>=stableSteps)break;}return last;}
  serialize(){return {schema:'shape-cognition/v1',seed:this.seed,operators:OPERATOR_KINDS,shapes:[...this.library.values()],steps:this.steps,active:this.workingSet.map(x=>x.id),render:{coordinateSystem:'normalized-tramline',projection:'ground-plane',order:'createdAtStep'}};}
}
