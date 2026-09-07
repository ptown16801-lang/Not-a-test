import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShapeCognitionEngine, primitive } from '../src/engine.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';
import {
  InfomaxRecurrentNetwork, PAPER_FIGURE_7_SCENARIOS, createPaperInputSampler,
  createSimplePaperNetwork, createTwoModalityPaperNetwork, logistic,
  logisticPrimeFromField, logisticPrimeFromOutput, logisticSecondFromField,
  logisticSecondFromOutput, polarProbe,
  populationVector, simpleNoCrossTalkStability
} from '../src/neural-synesthesia.js';
import { projectShapeThroughNetwork, shapeToNeuralStimulus } from '../src/neural-shape-bridge.js';
import { OPERATOR_KINDS } from '../src/types.js';

const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('paper logistic and its derivatives are numerically correct',()=>{
  const x=.37,h=1e-5,s=logistic(x);
  close(logisticPrimeFromOutput(s),(logistic(x+h)-logistic(x-h))/(2*h),1e-9);
  close(logisticSecondFromOutput(s),(logisticPrimeFromOutput(logistic(x+h))-logisticPrimeFromOutput(logistic(x-h)))/(2*h),1e-9);
  close(logisticPrimeFromField(x),logisticPrimeFromOutput(s),1e-15);
  close(logisticSecondFromField(x),logisticSecondFromOutput(s),1e-15);
});

test('default high-dimensional architecture is exactly 4 inputs and 2 x 71 outputs',()=>{
  const network=createTwoModalityPaperNetwork();
  assert.equal(network.inputSize,4);assert.equal(network.outputSize,142);assert.deepEqual(network.modalities.map(x=>x.outputCount),[71,71]);
  close(network.W[0],1);close(network.W[1],0);close(network.W[71*4+2],1);close(network.W[71*4+3],0);
  assert.ok(network.K.every(value=>value===0));
});

test('full 4-to-142 model evaluates a finite objective and recurrent update',()=>{
  const network=createTwoModalityPaperNetwork(),analysis=network.analyze(polarProbe({modality:1,angleRadians:Math.PI/6,radius:2}));
  assert.ok(Number.isFinite(analysis.objective));assert.equal(analysis.susceptibility.length,142*4);assert.equal(analysis.updateDirection.length,142*142);assert.ok([...analysis.updateDirection].every(Number.isFinite));
});

test('paper polar sampler is seeded and uses independent modality draws',()=>{
  const a=createPaperInputSampler({meanRadii:[.2,2],seed:42}),b=createPaperInputSampler({meanRadii:[.2,2],seed:42});
  const prefix=Array.from({length:3},()=>[...a()]),state=a.snapshot(),tail=Array.from({length:5},()=>[...a()]),resumed=createPaperInputSampler({meanRadii:[.2,2],seed:999,randomState:state});
  const samples=[...prefix,...tail];assert.deepEqual(samples,Array.from({length:8},()=>[...b()]));assert.deepEqual(tail,Array.from({length:5},()=>[...resumed()]));
  assert.ok(samples.some(x=>x[0]!==x[2]&&x[1]!==x[3]));
});

test('settled response satisfies the recurrent fixed-point equation',()=>{
  const network=createSimplePaperNetwork({weights:[1.1,.8],crossTalk:[.12,-.07]}),input=[.35,-.22];
  const result=network.settle(input,{integrationStep:.8,tolerance:1e-12});assert.ok(result.converged);
  const expected=[logistic(1.1*input[0]+.12*result.state[1]),logistic(.8*input[1]-.07*result.state[0])];
  close(result.state[0],expected[0],1e-11);close(result.state[1],expected[1],1e-11);
});

test('convergence always requires a fixed-point residual, independent of Euler step',()=>{
  const network=createSimplePaperNetwork(),result=network.settle([1,1],{integrationStep:1e-12,tolerance:1e-9,residualTolerance:1e-9,stableIterations:2,maxIterations:2,allowUnconverged:true});
  assert.equal(result.converged,false);assert.ok(result.fixedPointResidual>.2);assert.equal(result.convergenceCriterion,'step-and-residual');
});

test('fixed-point convergence is not mislabeled as a stability assessment',()=>{
  const network=createSimplePaperNetwork({crossTalk:[8,8]}),result=network.settle([-4,-4],{tolerance:1e-12});
  assert.equal(result.converged,true);assert.equal(result.fixedPointResidual,0);assert.equal(result.stabilityAssessed,false);
  // At s=(.5,.5), GK-I has eigenvalues 1 and -3; the fixed point is unstable.
  assert.equal(8*logisticPrimeFromField(0)-1,1);
});

test('Eq. 5 recurrent update matches finite differences of Eq. 3',()=>{
  const network=createSimplePaperNetwork({weights:[1.2,.8],crossTalk:[.07,-.04]}),input=[.35,-.22];
  const analysis=network.analyze(input,{integrationStep:.8,tolerance:1e-12});
  for(const index of [0,1,2,3]){
    const epsilon=1e-6,plus=network.clone(),minus=network.clone();plus.K[index]+=epsilon;minus.K[index]-=epsilon;
    const numerical=-(plus.objective(input,{integrationStep:.8,tolerance:1e-12})-minus.objective(input,{integrationStep:.8,tolerance:1e-12}))/(2*epsilon);
    close(analysis.updateDirection[index],numerical,2e-7);
  }
});

test('JavaScript matches the independent Wolfram reference fixture',()=>{
  const report=JSON.parse(readFileSync(new URL('../mathematica/verification/results/wolfram-validation.json',import.meta.url),'utf8')),fixture=report.referenceFixture;
  assert.equal(report.allPassed,true);assert.equal(report.checkCount,28);
  const network=new InfomaxRecurrentNetwork({inputSize:2,outputSize:3,W:fixture.W.flat(),K:fixture.K.flat(),metadata:{excludeSelfCoupling:false}});
  const analysis=network.analyze(fixture.input,{integrationStep:.8,tolerance:1e-13,stableIterations:3,pivotTolerance:1e-14});
  const maxError=(actual,expected)=>Math.max(...actual.map((value,index)=>Math.abs(value-expected[index])));
  assert.ok(maxError([...analysis.state],fixture.state)<1e-12);
  assert.ok(Math.abs(analysis.objective-fixture.objective)<1e-12);
  assert.ok(maxError([...analysis.susceptibility],fixture.susceptibility.flat())<1e-12);
  assert.ok(maxError([...analysis.updateDirection],fixture.descentDirection.flat())<1e-12);
});

test('S1 phase calculation separates a central stable point from deprivation edge',()=>{
  const central=simpleNoCrossTalkStability({variance1:.05,variance2:.05});assert.equal(central.stable,true);assert.ok(central.criticalLearningRate>0);
  assert.equal(simpleNoCrossTalkStability({variance1:.05,variance2:.05,learningRate:central.criticalLearningRate*1.01}).stable,false);
  assert.equal(simpleNoCrossTalkStability({variance1:0,variance2:.24}).stable,false);
});

test('Figure 7 parameter cases are transcribed exactly',()=>{
  assert.deepEqual(PAPER_FIGURE_7_SCENARIOS.deprivedHighPlasticity,{meanRadii:[.2,2],learningRate:.00015,reported:'modality-2-to-1'});
  assert.equal(PAPER_FIGURE_7_SCENARIOS.balancedLowPlasticity.learningRate,6e-5);
});

test('population vector recovers the angle of a direct polar probe',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:17}),angle=.73,response=network.respond(polarProbe({modality:1,angleRadians:angle,radius:2}));
  close(response.modalities[1].population.angleRadians,angle,1e-9);assert.ok(response.modalities[1].population.magnitude>.15);assert.ok(response.modalities[0].population.magnitude<1e-12);
});

test('paper population vector is an unnormalized sum and mean is opt-in',()=>{
  const activity=[.2,.7,.4,.1],angles=[0,Math.PI/2,Math.PI,3*Math.PI/2];
  const summed=populationVector(activity,angles),mean=populationVector(activity,angles,{normalization:'mean'});
  close(summed.real,mean.real*activity.length,1e-14);close(summed.imaginary,mean.imaginary*activity.length,1e-14);
  close(summed.magnitude,mean.magnitude*activity.length,1e-14);close(summed.angleRadians,mean.angleRadians,1e-14);
  assert.equal(summed.normalization,'sum');assert.equal(mean.normalization,'mean');
});

test('network serialization round-trips without changing inference',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:9,seed:7,initialRecurrentScale:1e-4}),copy=InfomaxRecurrentNetwork.fromJSON(network.toJSON()),input=polarProbe({modality:0,angleRadians:.4,radius:1});
  const a=network.respond(input),b=copy.respond(input);assert.ok(Math.max(...a.state.map((x,index)=>Math.abs(x-b.state[index])))<2e-10);
});

test('checkpoint serialization preserves binary64 values and coupling policy',()=>{
  const value=1.2345678901234567e-14,network=new InfomaxRecurrentNetwork({inputSize:1,outputSize:1,W:[value],K:[-value],metadata:{ExcludeSelfCoupling:true}});
  const payload=JSON.parse(JSON.stringify(network.toJSON())),copy=InfomaxRecurrentNetwork.fromJSON(payload);
  assert.equal(payload.W[0],value);assert.equal(payload.K[0],-value);
  assert.equal(copy.W[0],value);assert.equal(copy.K[0],-value);
  assert.equal(copy.metadata.excludeSelfCoupling,true);assert.equal(Object.hasOwn(payload.metadata,'ExcludeSelfCoupling'),false);
  copy.applyUpdate([1],1e-3);assert.equal(copy.K[0],0);
});

test('field-based derivatives keep a representable saturated susceptibility finite',()=>{
  const network=new InfomaxRecurrentNetwork({inputSize:2,outputSize:3,W:[100,0,0,1,1,0],K:new Float64Array(9)});
  const analysis=network.analyze([1,0],{integrationStep:1,tolerance:1e-12,residualTolerance:1e-12});
  assert.ok(analysis.firstDerivative[0]>0);assert.ok(Number.isFinite(analysis.objective));close(analysis.objective,3.012817736156336,2e-12);
});

test('scaled curvature evaluation keeps the saturated recurrent gradient finite',()=>{
  const network=new InfomaxRecurrentNetwork({inputSize:2,outputSize:3,W:[300,0,0,1,1,0],K:new Float64Array(9)});
  const analysis=network.analyze([1,0],{integrationStep:1,tolerance:1e-12,residualTolerance:1e-12});
  assert.ok(analysis.firstDerivative[0]>0);
  assert.ok([...analysis.scaledA,...analysis.updateDirection].every(Number.isFinite));
  assert.equal(analysis.aMaterialized,true);
});

test('scaled QR retains the finite objective and gradient after Gram underflow',()=>{
  const network=new InfomaxRecurrentNetwork({inputSize:1,outputSize:1,W:[1],K:[0]});
  const analysis=network.analyze([400],{integrationStep:1,tolerance:1e-12,residualTolerance:1e-12});
  close(analysis.objective,400,2e-12);assert.equal(analysis.gram[0],0);assert.equal(analysis.gramNumericallyUnderflowed,true);
  assert.ok(Number.isFinite(analysis.updateDirection[0]));close(analysis.updateDirection[0],-1,2e-12);
});

test('an active derivative floor is labeled and retains the displayed curvature ratio',()=>{
  const network=new InfomaxRecurrentNetwork({inputSize:1,outputSize:1,W:[1],K:[0]});
  const analysis=network.analyze([3],{derivativeFloor:.2,integrationStep:1,tolerance:1e-12,residualTolerance:1e-12});
  assert.equal(analysis.derivativeFloorApplied,true);assert.equal(analysis.equationSemantics,'project-surrogate-derivative-floor');
  close(analysis.updateDirection[0],.005238719864787106,2e-14);
});

test('relative matrix thresholds accept a scaled well-conditioned susceptibility',()=>{
  const network=createSimplePaperNetwork({weights:[1e-6,1e-6]}),analysis=network.analyze([0,0],{integrationStep:1,tolerance:1e-14,residualTolerance:1e-14});
  assert.ok(Number.isFinite(analysis.objective));close(analysis.gram[0],6.25e-14,1e-27);close(analysis.gram[3],6.25e-14,1e-27);
});

test('bundled compact checkpoint records and exhibits directional cross-talk',()=>{
  const artifact=JSON.parse(readFileSync(new URL('../assets/neural-preview-checkpoint.json',import.meta.url),'utf8')),network=InfomaxRecurrentNetwork.fromJSON(artifact.network),summary=network.crossTalkSummary();
  assert.match(artifact.notice,/not.*exact reproduction/i);assert.ok(summary.from2To1.meanSigned>0);assert.ok(summary.from1To2.meanSigned<0);
  const response=network.respond(polarProbe({modality:1,angleRadians:.6,radius:1}),{integrationStep:.5,tolerance:1e-8});
  assert.ok(response.modalities[0].population.magnitude>.01);assert.ok(response.modalities[1].population.magnitude>.01);
});

test('high-dimensional training includes the general-rule diagonal by default',()=>{
  const run=()=>{const network=createTwoModalityPaperNetwork({neuronsPerModality:7,seed:2,initialRecurrentScale:1e-5}),sampler=createPaperInputSampler({meanRadii:[.2,2],seed:9});network.train({sampler,steps:20,learningRate:1.5e-4,restoreBest:false,settle:{integrationStep:1,tolerance:1e-8}});return network;};
  const a=run(),b=run();assert.deepEqual([...a.K],[...b.K]);assert.ok(Array.from({length:a.outputSize},(_,i)=>Math.abs(a.K[i*a.outputSize+i])).some(x=>x>0));
});

test('zero diagonal remains an explicit simple-model/project option',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:7,seed:2,initialRecurrentScale:1e-5,excludeSelfCoupling:true}),sampler=createPaperInputSampler({meanRadii:[.2,2],seed:9});
  const training=network.train({sampler,steps:3,learningRate:1.5e-4,restoreBest:false,settle:{integrationStep:1,tolerance:1e-8}});
  assert.equal(training.zeroDiagonal,true);for(let i=0;i<network.outputSize;i++)assert.equal(network.K[i*network.outputSize+i],0);
});

test('best checkpoint uses one fixed objective ensemble',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:5}),sampler=createPaperInputSampler({meanRadii:[.2,2],seed:31}),checkpointSampler=createPaperInputSampler({meanRadii:[.2,2],seed:32});
  const checkpointInputs=Array.from({length:4},()=>checkpointSampler());
  assert.throws(()=>network.clone().train({sampler:createPaperInputSampler({seed:1}),steps:1}),error=>error.code==='missing_checkpoint_ensemble');
  const training=network.train({sampler,steps:4,learningRate:1e-4,checkpointInputs,checkpointInterval:2,settle:{integrationStep:1,tolerance:1e-9}});
  const restoredObjective=checkpointInputs.reduce((sum,input)=>sum+network.objective(input,{integrationStep:1,tolerance:1e-9}),0)/checkpointInputs.length;
  close(training.bestObjective,restoredObjective,2e-10);assert.equal(training.checkpointMode,'fixed-ensemble');assert.equal(training.checkpointInputCount,4);
});

test('neural projection is shape-only, deterministic, closed, and visibly input-sensitive',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:12}),n=network.outputSize,per=network.modalities[0].outputCount;
  for(let i=0;i<per;i++)for(let j=0;j<per;j++){const difference=network.modalities[0].preferredAngles[i]-network.modalities[1].preferredAngles[j];network.K[i*n+per+j]=.04*Math.cos(difference-.4);network.K[(per+i)*n+j]=-.015*Math.cos(difference+.2);}
  const first=primitive.polygon(5,1),second=primitive.polygon(8,1),encoded=shapeToNeuralStimulus(first,{sequence:3});assert.equal(encoded.input.length,4);assert.equal(encoded.encoding,'shape-only/content-and-structure');
  const a=projectShapeThroughNetwork(first,network,{sequence:3}),again=projectShapeThroughNetwork(first,network,{sequence:3}),b=projectShapeThroughNetwork(second,network,{sequence:4});
  assert.equal(a.shape.id,again.shape.id);assert.notEqual(a.shape.id,b.shape.id);assert.ok(a.weavePathCount>0);
  const engine=new ShapeCognitionEngine();engine.add(a.shape);const paths=bakeShapePaths(a.shape.id,engine.library);assert.ok(paths.length>=20);assert.ok(paths.flat(2).every(Number.isFinite));
  assert.ok([...engine.library.values()].every(shape=>shape.provenance.operator==='primitive'||OPERATOR_KINDS.includes(shape.provenance.operator)));
});
