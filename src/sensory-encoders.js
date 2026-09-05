/** Deterministic, dependency-free adapters for optional non-geometric perception. */
export const SENSORY_PERCEPTION_SCHEMA='sensory-perception/v1';
const TWO_PI=Math.PI*2;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const round=n=>Math.round(n*1e6)/1e6;

export function encodeThermalTouch(perception,{neutralF=70,rangeF=50,stepF=3,maxRadius=2}={}){
  const temperatureF=Number(perception?.temperatureF);
  if(!Number.isFinite(temperatureF))throw new TypeError('thermal temperatureF must be finite');
  if(!(rangeF>0)||!(stepF>0))throw new RangeError('thermal rangeF and stepF must be positive');
  const delta=temperatureF-neutralF;
  // Quantize magnitude, not the signed temperature, so hot and cold remain symmetric.
  // A change must cross the midpoint of a 3 °F band before it is perceived.
  const quantizedMagnitude=Math.round(Math.abs(delta)/stepF)*stepF;
  const signed=(delta<0?-1:delta>0?1:0)*clamp(quantizedMagnitude/rangeF,0,1);
  const radius=Math.abs(signed)*maxRadius,angleRadians=signed<0?Math.PI:0;
  return Object.freeze({
    kind:'thermal-touch',temperatureF:round(temperatureF),neutralF:round(neutralF),rangeF:round(rangeF),stepF:round(stepF),
    perceivedTemperatureF:round(neutralF+(signed<0?-1:signed>0?1:0)*Math.min(rangeF,quantizedMagnitude)),classification:radius===0?'neutral':signed<0?'cold':'hot',
    normalized:round(signed),angleRadians:round(angleRadians),radius:round(radius),vector:Object.freeze([round(signed*maxRadius),0])
  });
}

/** Analyze normalized mono PCM. A bounded center window keeps browser work predictable. */
export function analyzeSound(perception,{maxWindow=1024,maxBins=256,maxRadius=2}={}){
  const input=perception?.samples,sampleRateHz=Number(perception?.sampleRateHz);
  if(!Array.isArray(input)||!input.length||!Number.isFinite(sampleRateHz))throw new TypeError('sound requires PCM samples and sampleRateHz');
  const n=Math.min(maxWindow,input.length),start=Math.floor((input.length-n)/2),samples=new Float64Array(n);
  let mean=0,peak=0,energy=0,crossings=0;
  for(let i=0;i<n;i++)mean+=input[start+i];mean/=n;
  for(let i=0;i<n;i++){const v=input[start+i]-mean;samples[i]=v;peak=Math.max(peak,Math.abs(v));energy+=v*v;if(i&&((v>=0)!==(samples[i-1]>=0)))crossings++;}
  const rms=Math.sqrt(energy/n),bins=Math.min(maxBins,Math.floor(n/2)),magnitudes=new Float64Array(bins+1);
  let spectralMass=0,weightedFrequency=0,dominantBin=0,dominantMagnitude=-1;
  if(rms>1e-12)for(let k=1;k<=bins;k++){
    let re=0,im=0;
    for(let i=0;i<n;i++){const window=n===1?1:.5-.5*Math.cos(TWO_PI*i/(n-1)),phase=TWO_PI*k*i/n,v=samples[i]*window;re+=v*Math.cos(phase);im-=v*Math.sin(phase);}
    const magnitude=Math.hypot(re,im);magnitudes[k]=magnitude;const frequency=k*sampleRateHz/n;spectralMass+=magnitude;weightedFrequency+=frequency*magnitude;
    if(magnitude>dominantMagnitude){dominantMagnitude=magnitude;dominantBin=k;}
  }
  const centroid=spectralMass?weightedFrequency/spectralMass:0,dominant=spectralMass?dominantBin*sampleRateHz/n:0,nyquist=sampleRateHz/2;
  const logPosition=centroid>0?clamp(Math.log(centroid/20)/Math.log(Math.max(1.000001,Math.min(20000,nyquist)/20)),0,1):0;
  const angleRadians=logPosition*TWO_PI,radius=clamp(rms*Math.SQRT2,0,1)*maxRadius;
  return Object.freeze({kind:'sound',sampleRateHz:round(sampleRateHz),sampleCount:input.length,rms:round(rms),peak:round(peak),zeroCrossingRate:round(crossings/Math.max(1,n-1)),spectralCentroidHz:round(centroid),dominantFrequencyHz:round(dominant),angleRadians:round(angleRadians),radius:round(radius),vector:Object.freeze([round(radius*Math.cos(angleRadians)),round(radius*Math.sin(angleRadians))])});
}

export function perceptionToNeuralStimulus(perception,{inducerModality=1,maxRadius=2}={}){
  if(inducerModality!==0&&inducerModality!==1)throw new RangeError('inducerModality must be 0 or 1');
  const features=perception?.kind==='thermal-touch'?encodeThermalTouch(perception,{maxRadius}):perception?.kind==='sound'?analyzeSound(perception,{maxRadius}):null;
  if(!features)throw new TypeError('unsupported sensory perception kind');
  const input=new Float64Array(4),offset=inducerModality*2;input[offset]=features.vector[0];input[offset+1]=features.vector[1];
  return Object.freeze({input,features,encoding:`perception/${features.kind}/v1`,modalities:Object.freeze([0,1].map(index=>Object.freeze({angleRadians:index===inducerModality?features.angleRadians:0,radius:index===inducerModality?features.radius:0})))});
}
