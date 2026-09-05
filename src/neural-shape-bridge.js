/**
 * Explicit artistic bridge from a Shriki-style population response to a legal
 * shape-cognition provenance DAG. The neural equations produce firing-rate
 * profiles, not artwork; this projection is intentionally kept separate.
 */

import { operators, primitive } from './engine.js';
import { NEURAL_SYNAESTHESIA_SCHEMA, NeuralModelError } from './neural-synesthesia.js';
import { perceptionToNeuralStimulus } from './sensory-encoders.js';
import { sensoryFeaturesToArtShape } from './sensory-art.js';

export const NEURAL_SHAPE_BRIDGE_SCHEMA='neural-shape-bridge/v1';
const TWO_PI=Math.PI*2;
const round=n=>Math.round(n*1e6)/1e6;
const clamp01=n=>Math.max(0,Math.min(1,n));
const overlay=shapes=>shapes.slice(1).reduce((root,shape)=>operators.combine(root,shape,'overlay'),shapes[0]);
const fnv32=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

/**
 * Encode an existing geometric thought into two polar modalities without using
 * its language label. Angles come from the content-addressed geometry and
 * topology; intensities come from structural complexity and provenance depth.
 */
export function shapeToNeuralStimulus(shape,{sequence=0,minRadius=.2,maxRadius=2,inducerModality=null}={}){
  if(!shape?.id||!shape.topology||!shape.provenance)throw new NeuralModelError('shapeToNeuralStimulus requires a shape object','invalid_shape');
  const span=Math.max(0,maxRadius-minRadius),hashA=fnv32(`${shape.id}:${sequence}:geometry`),hashB=fnv32(`${shape.id}:${sequence}:provenance`);
  const angle1=hashA/4294967296*TWO_PI,angle2=hashB/4294967296*TWO_PI;
  const structural=clamp01(Math.log1p(shape.topology.nodes+shape.topology.edges.length+shape.topology.components)/Math.log(66));
  const relational=clamp01((shape.depth+(shape.provenance.parents?.length||0)+shape.attributes.symmetry.length)/(shape.depth+8));
  let radius1=minRadius+span*structural,radius2=minRadius+span*relational;
  if(inducerModality===0)radius2=0;if(inducerModality===1)radius1=0;
  const input=Float64Array.of(radius1*Math.cos(angle1),radius1*Math.sin(angle1),radius2*Math.cos(angle2),radius2*Math.sin(angle2));
  return Object.freeze({input,modalities:Object.freeze([{angleRadians:angle1,radius:radius1},{angleRadians:angle2,radius:radius2}]),encoding:'shape-only/content-and-structure'});
}

function strongestCrossModalEdges(network,maxEdges){
  if(network.modalities.length!==2||maxEdges<=0)return [];
  const [one,two]=network.modalities,candidates=[];
  const scan=(source,target,direction)=>{
    for(let i=0;i<target.outputCount;i++)for(let j=0;j<source.outputCount;j++){
      const weight=network.K[(target.outputOffset+i)*network.outputSize+source.outputOffset+j];
      if(weight!==0)candidates.push({sourceAngle:source.preferredAngles[j],targetAngle:target.preferredAngles[i],weight,direction});
    }
  };
  scan(one,two,'1-to-2');scan(two,one,'2-to-1');
  return candidates.sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight)||a.direction.localeCompare(b.direction)||a.sourceAngle-b.sourceAngle||a.targetAngle-b.targetAngle).slice(0,maxEdges).map(x=>({...x,sourceAngle:round(x.sourceAngle),targetAngle:round(x.targetAngle),weight:round(x.weight)}));
}

const contour=(modality,index,{contourModulation,smoothingPasses})=>{
  const seed=primitive.disk([0,0],1,{tags:['neural-synaesthesia',`modality-${index+1}`,'population-code']});
  return operators.morph(seed,{kind:'neuralPopulationContour',preferredAngles:[...modality.preferredAngles].map(round),activity:[...modality.activity].map(round),baseRadius:index===0?1:.72,modulation:contourModulation,smoothingPasses});
};

const vectorMark=(population,index)=>{
  const length=.2+Math.min(.58,population.magnitude*2.4),angle=population.angleRadians;
  return primitive.ray([0,0],[round(Math.cos(angle)*length),round(Math.sin(angle)*length)],{tags:['neural-synaesthesia',`modality-${index+1}`,'population-vector']});
};

/** Convert one settled two-modality response into a replayable thought shape. */
export function neuralResponseToShape(network,response,{originalShape=null,sensoryFeatures=null,maxWeavePaths=16,contourModulation=.28,smoothingPasses=3,includePopulationVectors=true}={}){
  if(!response?.modalities||response.modalities.length!==2)throw new NeuralModelError('the shape bridge currently requires two response modalities','invalid_response');
  const shapes=response.modalities.map((modality,index)=>contour(modality,index,{contourModulation,smoothingPasses}));
  if(includePopulationVectors)response.modalities.forEach((modality,index)=>shapes.push(vectorMark(modality.population,index)));
  const edges=strongestCrossModalEdges(network,maxWeavePaths);
  if(edges.length){const seed=primitive.segment([-1,0],[1,0],{tags:['neural-synaesthesia','cross-modal-weave']});shapes.push(operators.morph(seed,{kind:'neuralCrossModalWeave',edges,innerRadius:.72,outerRadius:1,samples:18,bend:.34}));}
  if(sensoryFeatures)shapes.push(sensoryFeaturesToArtShape(sensoryFeatures));
  if(originalShape)shapes.unshift(originalShape);
  const shape=overlay(shapes);
  return Object.freeze({schema:NEURAL_SHAPE_BRIDGE_SCHEMA,sourceSchema:NEURAL_SYNAESTHESIA_SCHEMA,shape,input:[...response.input].map(round),converged:response.converged,settleIterations:response.iterations,populations:response.modalities.map(x=>({magnitude:round(x.population.magnitude),angleRadians:round(x.population.angleRadians),angleDegrees:round(x.population.angleDegrees)})),weavePathCount:edges.length});
}

/** End-to-end projection of an existing thought through the recurrent network. */
export function projectShapeThroughNetwork(shape,network,{sequence=0,perception=null,stimulus={},response={},projection={}}={}){
  const encoded=perception?perceptionToNeuralStimulus(perception,stimulus):shapeToNeuralStimulus(shape,{sequence,...stimulus});
  const settled=network.respond(encoded.input,response);
  const projected=neuralResponseToShape(network,settled,{originalShape:shape,sensoryFeatures:encoded.features||null,...projection});
  return Object.freeze({...projected,stimulus:{modalities:encoded.modalities,encoding:encoded.encoding,...(encoded.features?{features:encoded.features}:{})}});
}
