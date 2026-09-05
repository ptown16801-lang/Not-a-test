import { operators, primitive } from './engine.js';

/**
 * Research-inspired complex shape macros. These are not additional primitives:
 * each result expands to the existing primitive/operator provenance DAG.
 * “Form constants” are used as mathematical visual motifs, not as a claim that
 * visual hallucinations and synesthesia are the same phenomenon.
 */

const overlay = (shapes) => shapes.slice(1).reduce(
  (root, shape) => operators.combine(root, shape, 'overlay'),
  shapes[0]
);
const positiveInt=(value,min)=>Math.max(min,Math.round(Number(value)||min));

export function logarithmicSpiral({turns=3.25,growth=.18,startRadius=.06,phase=0,clockwise=false,tags=['form-constant','spiral']}={}) {
  const radialSeed=primitive.ray([0,0],[1,0],{tags});
  return operators.morph(radialSeed,{kind:'logarithmicSpiral',turns,growth,startRadius,phase,clockwise,samples:160});
}

export function tunnel({rings=7,minScale=.16,maxScale=1,skew=.16,tags=['form-constant','tunnel']}={}) {
  rings=positiveInt(rings,2);
  const ring=primitive.disk([0,0],1,{tags});
  const nested=operators.replicateArrange(ring,rings,'concentric',{minScale,maxScale});
  return operators.projectSlice(nested,2,'perspective',{
    homography:[1,skew,0,-skew*.35,1,0,.18,.08,1]
  });
}

export function cobweb({rings=6,spokes=12,tags=['form-constant','cobweb']}={}) {
  rings=positiveInt(rings,2); spokes=positiveInt(spokes,4);
  const ringSeed=primitive.disk([0,0],1,{tags});
  const spokeSeed=primitive.segment([0,0],[1,0],{tags});
  const nested=operators.replicateArrange(ringSeed,rings,'concentric',{minScale:.18,maxScale:1});
  const radial=operators.replicateArrange(spokeSeed,spokes,'radialRotate',{radius:0});
  return overlay([nested,radial]);
}

export function honeycomb({rows=3,columns=4,spacingX=1.55,spacingY=1.35,tags=['form-constant','lattice']}={}) {
  rows=positiveInt(rows,1); columns=positiveInt(columns,1);
  const cell=primitive.polygon(6,.5,{tags});
  return operators.replicateArrange(cell,rows*columns,'lattice2d',{rows,columns,spacingX,spacingY,stagger:true});
}

export function spatialSequence({count=9,amplitude=.35,frequency=1.5,perspective=.12,tags=['sequence-space','projected']}={}) {
  count=positiveInt(count,2);
  const mark=primitive.disk([0,0],.075,{tags});
  const sequence=operators.replicateArrange(mark,count,'sequenceCurve',{amplitude,frequency,spacing:.25});
  return operators.projectSlice(sequence,2,'perspective',{
    homography:[1,.08,0,0,1,0,perspective,.04,1]
  });
}

export function projectiveSynestheticThought(options={}) {
  const forms=[
    logarithmicSpiral(options.spiral),
    tunnel(options.tunnel),
    cobweb(options.cobweb),
    honeycomb(options.honeycomb),
    spatialSequence(options.sequence)
  ];
  return overlay(forms);
}
