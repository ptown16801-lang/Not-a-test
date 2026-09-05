/** Artistic sensory motifs built only from the closed primitive/operator set. */
import { operators, primitive } from './engine.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlay=shapes=>shapes.slice(1).reduce((root,shape)=>operators.combine(root,shape,'overlay'),shapes[0]);
const count=(value,min,max)=>Math.round(min+clamp(value,0,1)*(max-min));

function thermalMotif(features){
  const intensity=clamp(Math.abs(features.normalized),0,1),hot=features.classification==='hot';
  if(features.classification==='neutral')return primitive.disk([0,0],.18,{tags:['sensory-art','thermal','neutral','quiet-center']});
  if(hot){
    const ray=primitive.ray([0,0],[1,0],{tags:['sensory-art','thermal','hot','radiant']});
    const spiral=operators.morph(ray,{kind:'logarithmicSpiral',turns:1.4+2.8*intensity,growth:.08+.08*intensity,startRadius:.035,phase:features.normalized*Math.PI/7,clockwise:false,samples:120});
    return operators.replicateArrange(spiral,count(intensity,2,6),'radialRotate',{radius:0});
  }
  const crystal=primitive.polygon(6,.3+.45*intensity,{tags:['sensory-art','thermal','cold','crystalline']});
  const nested=operators.replicateArrange(crystal,count(intensity,2,7),'concentric',{minScale:.24,maxScale:1});
  return operators.dualPolar(nested,'polar');
}

function soundMotif(features){
  const loudness=clamp(features.radius/2,0,1),nyquist=Math.max(1,features.sampleRateHz/2);
  const pitch=features.spectralCentroidHz?clamp(Math.log(Math.max(20,features.spectralCentroidHz)/20)/Math.log(Math.max(1.000001,Math.min(20000,nyquist)/20)),0,1):0;
  if(loudness===0)return primitive.disk([0,0],.1,{tags:['sensory-art','sound','silence','quiet-center']});
  const pulse=primitive.disk([0,0],.24+.36*loudness,{tags:['sensory-art','sound','pulse']});
  const rings=operators.replicateArrange(pulse,count(loudness,2,8),'concentric',{minScale:.2,maxScale:1});
  const spoke=primitive.segment([.18,0],[.46+.4*loudness,0],{tags:['sensory-art','sound','frequency-rays']});
  const rays=operators.replicateArrange(spoke,count(pitch,5,17),'radialRotate',{radius:0});
  return overlay([rings,rays]);
}

export function sensoryFeaturesToArtShape(features){
  if(features?.kind==='thermal-touch')return thermalMotif(features);
  if(features?.kind==='sound')return soundMotif(features);
  throw new TypeError('unsupported sensory art features');
}
