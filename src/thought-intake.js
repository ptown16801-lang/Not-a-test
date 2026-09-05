import { operators, primitive } from './engine.js';
import { OPERATOR_KINDS } from './types.js';

export const THOUGHT_INTAKE_SCHEMA='thought-intake/v1';
export const THOUGHT_LIMITS=Object.freeze({bytes:4*1024*1024,nodes:512,parentsPerNode:8,curvePoints:8192,replicas:4096,depth:128,soundSamples:16384});
export const UNBOUNDED_THOUGHT_LIMITS=Object.freeze({bytes:Infinity,nodes:Infinity,parentsPerNode:Infinity,curvePoints:Infinity,replicas:Infinity,depth:Infinity,soundSamples:Infinity});
const ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SHAPE_ID=/^shape_[0-9a-f]{8}$/;
const finite=(n,min=-1e9,max=1e9)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const vec=(v,n=2)=>Array.isArray(v)&&v.length===n&&v.every(x=>finite(x));
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const cleanText=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&![...v].some(ch=>ch<' '&&ch!=='\n'&&ch!=='\t');

export class ThoughtIntakeError extends Error {
  constructor(message,code='invalid_submission'){super(message);this.name='ThoughtIntakeError';this.code=code;}
}
const requireValue=(ok,message)=>{if(!ok)throw new ThoughtIntakeError(message);};

function validatePerception(perception,limits){
  requireValue(plain(perception),'perception must be an object');
  requireValue(perception.schema==='sensory-perception/v1','perception schema is invalid');
  const keys=Object.keys(perception),allowed=perception.kind==='thermal-touch'?['schema','kind','temperatureF']:['schema','kind','sampleRateHz','samples'];
  requireValue(keys.every(key=>allowed.includes(key)),'perception contains unsupported fields');
  if(perception.kind==='thermal-touch')requireValue(finite(perception.temperatureF,-100,250),'temperatureF must be between -100 and 250');
  else if(perception.kind==='sound'){
    requireValue(finite(perception.sampleRateHz,8000,96000),'sampleRateHz must be between 8000 and 96000');
    requireValue(Array.isArray(perception.samples)&&perception.samples.length>=8&&perception.samples.length<=limits.soundSamples&&perception.samples.every(x=>finite(x,-1,1)),'sound samples must be normalized PCM within the configured limit');
  }else requireValue(false,'perception kind must be thermal-touch or sound');
}

function validatePrimitive(spec,id,limits){
  requireValue(plain(spec),`${id}.primitive must be an object`);
  const kind=spec.kind,args=plain(spec.args)?spec.args:{};
  requireValue(['point','segment','ray','disk','polygon','ball','curve','surface'].includes(kind),`${id} has an illegal primitive`);
  if(kind==='point')requireValue(vec(args.p??[0,0]),`${id}.p must be a bounded Vec2`);
  if(kind==='segment'||kind==='ray'){requireValue(vec(args.a??[0,0])&&vec(args.b??[1,0]),`${id} endpoints must be bounded Vec2 values`);}
  if(kind==='disk')requireValue(vec(args.center??[0,0])&&finite(args.radius??1,.001),`${id} disk is out of bounds`);
  if(kind==='polygon')requireValue(Number.isInteger(args.sides??3)&&(args.sides??3)>=3&&(args.sides??3)<=limits.replicas&&finite(args.radius??1,.001),`${id} polygon is out of bounds`);
  if(kind==='ball')requireValue(vec(args.center??[0,0,0],3)&&finite(args.radius??1,.001),`${id} ball is out of bounds`);
  if(kind==='curve')requireValue(Array.isArray(args.controlPoints)&&args.controlPoints.length>=2&&args.controlPoints.length<=limits.curvePoints&&args.controlPoints.every(p=>vec(p)),`${id} curve is out of bounds`);
  if(kind==='surface')requireValue(Array.isArray(args.seed)&&args.seed.length>=4&&args.seed.length<=limits.curvePoints&&args.seed.every(x=>finite(x)),`${id} surface seed is out of bounds`);
}

function validateOperator(node,limits){
  const {id,operator}=node,p=plain(node.params)?node.params:{};
  requireValue(OPERATOR_KINDS.includes(operator),`${id} has an illegal operator`);
  const arity=operator==='combine'||operator==='compose'?2:1;
  requireValue(Array.isArray(node.parents)&&node.parents.length===arity,`${id}.${operator} requires ${arity} parent${arity===1?'':'s'}`);
  if(operator==='transform')requireValue(Array.isArray(p.matrix)&&p.matrix.length===6&&p.matrix.every(x=>finite(x)),`${id} affine matrix is invalid`);
  if(operator==='morph'){
    const q=p.parameters;
    const arrayOk=Array.isArray(q)&&q.length<=limits.curvePoints&&q.every(x=>finite(x));
    const spiralOk=plain(q)&&q.kind==='logarithmicSpiral'&&finite(q.turns,.1)&&finite(q.growth,-10,10)&&finite(q.startRadius,.001)&&(q.samples===undefined||(Number.isInteger(q.samples)&&q.samples>=16&&q.samples<=limits.curvePoints));
    requireValue(arrayOk||spiralOk,`${id} morph parameters are invalid`);
  }
  if(operator==='combine')requireValue(['union','intersection','difference','blend','overlay'].includes(p.mode),`${id} combine mode is invalid`);
  if(operator==='replicateArrange'){
    requireValue(Number.isInteger(p.count)&&p.count>=1&&p.count<=limits.replicas,`${id} replica count is invalid`);
    requireValue(['bilateral','radial','linear','lattice','concentric','radialRotate','lattice2d','sequenceCurve'].includes(p.arrangement),`${id} arrangement is invalid`);
    if(p.rows!==undefined)requireValue(Number.isInteger(p.rows)&&p.rows>=1&&p.rows<=limits.replicas,`${id}.rows is invalid`);
    if(p.columns!==undefined)requireValue(Number.isInteger(p.columns)&&p.columns>=1&&p.columns<=limits.replicas,`${id}.columns is invalid`);
    if(p.rows!==undefined&&p.columns!==undefined)requireValue(p.rows*p.columns<=limits.replicas,`${id} lattice exceeds the configured server resource policy`);
  }
  if(operator==='projectSlice'){
    requireValue(Number.isInteger(p.dimension)&&p.dimension>=0&&p.dimension<=3,`${id} projection dimension is invalid`);
    requireValue(['project','slice','perspective'].includes(p.mode),`${id} projection mode is invalid`);
    if(p.mode==='perspective')requireValue(Array.isArray(p.homography)&&p.homography.length===9&&p.homography.every(x=>finite(x)),`${id} homography is invalid`);
  }
  if(operator==='dualPolar')requireValue(['dual','polar'].includes(p.mode),`${id} dual/polar mode is invalid`);
  if(operator==='subdivideSimplify')requireValue(['subdivide','simplify'].includes(p.mode)&&Number.isInteger(p.level)&&p.level>=1&&p.level<=limits.depth,`${id} subdivision is invalid`);
  if(operator==='compose')requireValue(['center','edge','vertex'].includes(p.anchor),`${id} compose anchor is invalid`);
}

export function validateThoughtSubmission(input,{knownShapeIds=[],resourcePolicy=THOUGHT_LIMITS}={}){
  requireValue(plain(input),'submission must be a plain JSON object');
  let encoded;try{encoded=JSON.stringify(input);}catch{throw new ThoughtIntakeError('submission must be serializable JSON');}
  requireValue(encoded.length<=resourcePolicy.bytes,'submission exceeds byte limit','payload_too_large');
  requireValue(input.schema===THOUGHT_INTAKE_SCHEMA,`expected ${THOUGHT_INTAKE_SCHEMA}`);
  requireValue(cleanText(input.concept,240),'concept must contain 1–240 safe characters');
  requireValue(input.publicRationale===undefined||cleanText(input.publicRationale,500),'publicRationale must contain at most 500 safe characters');
  if(input.perception!==undefined)validatePerception(input.perception,resourcePolicy);
  requireValue(Array.isArray(input.nodes)&&input.nodes.length>=1&&input.nodes.length<=resourcePolicy.nodes,'nodes exceed the configured server resource policy');
  requireValue(ID.test(input.root||''),'root is invalid');
  const available=new Set(knownShapeIds),local=new Set();
  for(const node of input.nodes){
    requireValue(plain(node)&&ID.test(node.id||''),`node id is invalid`);
    requireValue(!local.has(node.id)&&!available.has(node.id),`duplicate node id: ${node.id}`);
    const isPrimitive=node.primitive!==undefined;
    requireValue(isPrimitive!==Boolean(node.operator),'each node must define exactly one primitive or operator');
    if(isPrimitive)validatePrimitive(node.primitive,node.id,resourcePolicy);else{
      validateOperator(node,resourcePolicy);
      for(const ref of node.parents)requireValue(local.has(ref)||available.has(ref)||SHAPE_ID.test(ref)&&available.has(ref),`${node.id} references an unavailable or forward parent: ${ref}`);
    }
    local.add(node.id);available.add(node.id);
  }
  requireValue(local.has(input.root),'root must reference a local node');
  return input;
}

function makePrimitive(spec,tags){
  const a=spec.args||{},o={tags};
  if(spec.kind==='point')return primitive.point(a.p,o);
  if(spec.kind==='segment')return primitive.segment(a.a,a.b,o);
  if(spec.kind==='ray')return primitive.ray(a.a,a.b,o);
  if(spec.kind==='disk')return primitive.disk(a.center,a.radius,o);
  if(spec.kind==='polygon')return primitive.polygon(a.sides,a.radius,o);
  if(spec.kind==='ball')return primitive.ball(a.center,a.radius,o);
  if(spec.kind==='curve')return primitive.curve(a.controlPoints,o);
  return primitive.surface(a.seed,o);
}

function applyOperator(node,parents){
  const p=node.params||{};
  if(node.operator==='transform')return operators.transform(parents[0],p.matrix);
  if(node.operator==='morph')return operators.morph(parents[0],p.parameters);
  if(node.operator==='combine')return operators.combine(parents[0],parents[1],p.mode);
  if(node.operator==='replicateArrange'){const {count,arrangement,...rest}=p;return operators.replicateArrange(parents[0],count,arrangement,rest);}
  if(node.operator==='projectSlice'){const {dimension,mode,...rest}=p;return operators.projectSlice(parents[0],dimension,mode,rest);}
  if(node.operator==='dualPolar')return operators.dualPolar(parents[0],p.mode);
  if(node.operator==='subdivideSimplify')return operators.subdivideSimplify(parents[0],p.mode,p.level);
  return operators.compose(parents[0],parents[1],p.anchor);
}

export function compileThoughtSubmission(input,{shapeLibrary=new Map(),resourcePolicy=THOUGHT_LIMITS}={}){
  validateThoughtSubmission(input,{knownShapeIds:[...shapeLibrary.keys()],resourcePolicy});
  const resolved=new Map(shapeLibrary),local=new Map(),tags=['agent-thought',input.concept.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)];
  for(const node of input.nodes){
    const shape=node.primitive?makePrimitive(node.primitive,tags):applyOperator(node,node.parents.map(ref=>local.get(ref)||resolved.get(ref)));
    local.set(node.id,shape);resolved.set(shape.id,shape);
  }
  return {root:local.get(input.root),nodes:local};
}

export const THOUGHT_TOOL=Object.freeze({
  name:'submit_geometric_thought',
  description:'Submit one public geometric thought as a closed primitive/operator DAG. Returns the authoritative agent sequence and signed receipt.',
  inputSchema:{
    type:'object',additionalProperties:false,required:['schema','concept','nodes','root'],
    properties:{
      schema:{const:THOUGHT_INTAKE_SCHEMA},concept:{type:'string',minLength:1,maxLength:240},publicRationale:{type:'string',maxLength:500},root:{type:'string',pattern:ID.source},
      perception:{oneOf:[{type:'object',additionalProperties:false,required:['schema','kind','temperatureF'],properties:{schema:{const:'sensory-perception/v1'},kind:{const:'thermal-touch'},temperatureF:{type:'number',minimum:-100,maximum:250,description:'Fahrenheit; 70 neutral, 20 maximum cold, 120 maximum hot, perceived in 3 degree increments.'}}},{type:'object',additionalProperties:false,required:['schema','kind','sampleRateHz','samples'],properties:{schema:{const:'sensory-perception/v1'},kind:{const:'sound'},sampleRateHz:{type:'number',minimum:8000,maximum:96000},samples:{type:'array',minItems:8,maxItems:16384,items:{type:'number',minimum:-1,maximum:1}}}}]},
      nodes:{type:'array',minItems:1,items:{type:'object',description:'Topologically ordered primitive node {id,primitive:{kind,args}} or operator node {id,operator,parents,params}.'}}
    }
  }
});
