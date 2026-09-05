import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShapeCognitionEngine, primitive } from '../src/engine.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';
import {
  InfomaxRecurrentNetwork, PAPER_FIGURE_7_SCENARIOS, createPaperInputSampler,
  createSimplePaperNetwork, createTwoModalityPaperNetwork, logistic,
  logisticPrimeFromOutput, logisticSecondFromOutput, polarProbe,
  populationVector, simpleNoCrossTalkStability
} from '../src/neural-synesthesia.js';
import { projectShapeThroughNetwork, shapeToNeuralStimulus } from '../src/neural-shape-bridge.js';
import { OPERATOR_KINDS } from '../src/types.js';

const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('paper logistic and its derivatives are numerically correct',()=>{
  const x=.37,h=1e-5,s=logistic(x);
  close(logisticPrimeFromOutput(s),(logistic(x+h)-logistic(x-h))/(2*h),1e-9);
  close(logisticSecondFromOutput(s),(logisticPrimeFromOutput(logistic(x+h))-logisticPrimeFromOutput(logistic(x-h)))/(2*h),1e-9);
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

test('Eq. 5 recurrent update matches finite differences of Eq. 3',()=>{
  const network=createSimplePaperNetwork({weights:[1.2,.8],crossTalk:[.07,-.04]}),input=[.35,-.22];
  const analysis=network.analyze(input,{integrationStep:.8,tolerance:1e-12});
  for(const index of [1,2]){
    const epsilon=1e-6,plus=network.clone(),minus=network.clone();plus.K[index]+=epsilon;minus.K[index]-=epsilon;
    const numerical=-(plus.objective(input,{integrationStep:.8,tolerance:1e-12})-minus.objective(input,{integrationStep:.8,tolerance:1e-12}))/(2*epsilon);
    close(analysis.updateDirection[index],numerical,2e-7);
  }
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

test('network serialization round-trips without changing inference',()=>{
  const network=createTwoModalityPaperNetwork({neuronsPerModality:9,seed:7,initialRecurrentScale:1e-4}),copy=InfomaxRecurrentNetwork.fromJSON(network.toJSON()),input=polarProbe({modality:0,angleRadians:.4,radius:1});
  const a=network.respond(input),b=copy.respond(input);assert.deepEqual([...a.state].map(x=>Number(x.toFixed(10))),[...b.state].map(x=>Number(x.toFixed(10))));
});

test('bundled compact checkpoint records and exhibits directional cross-talk',()=>{
  const artifact=JSON.parse(readFileSync(new URL('../assets/neural-preview-checkpoint.json',import.meta.url),'utf8')),network=InfomaxRecurrentNetwork.fromJSON(artifact.network),summary=network.crossTalkSummary();
  assert.match(artifact.notice,/not.*exact reproduction/i);assert.ok(summary.from2To1.meanSigned>0);assert.ok(summary.from1To2.meanSigned<0);
  const response=network.respond(polarProbe({modality:1,angleRadians:.6,radius:1}),{integrationStep:.5,tolerance:1e-8});
  assert.ok(response.modalities[0].population.magnitude>.01);assert.ok(response.modalities[1].population.magnitude>.01);
});

test('training is deterministic and excludes self-coupling',()=>{
  const run=()=>{const network=createTwoModalityPaperNetwork({neuronsPerModality:7,seed:2,initialRecurrentScale:1e-5}),sampler=createPaperInputSampler({meanRadii:[.2,2],seed:9});network.train({sampler,steps:20,learningRate:1.5e-4,restoreBest:false,settle:{integrationStep:1,tolerance:1e-8}});return network;};
  const a=run(),b=run();assert.deepEqual([...a.K],[...b.K]);for(let i=0;i<a.outputSize;i++)assert.equal(a.K[i*a.outputSize+i],0);
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
