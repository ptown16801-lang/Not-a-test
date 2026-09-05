import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  InfomaxRecurrentNetwork, PAPER_FIGURE_7_SCENARIOS,
  createPaperInputSampler, createTwoModalityPaperNetwork
} from '../src/neural-synesthesia.js';

const values=Object.fromEntries(process.argv.slice(2).map(arg=>{const match=arg.match(/^--([^=]+)=(.*)$/);if(!match)throw new Error(`Expected --name=value, got ${arg}`);return [match[1],match[2]];}));
const integer=(name,fallback,min=1)=>{const value=values[name]===undefined?fallback:Number(values[name]);if(!Number.isInteger(value)||value<min)throw new Error(`--${name} must be an integer >= ${min}`);return value;};
const number=(name,fallback,min=0)=>{const value=values[name]===undefined?fallback:Number(values[name]);if(!Number.isFinite(value)||value<min)throw new Error(`--${name} must be a number >= ${min}`);return value;};
const limit=name=>values[name]===undefined?Infinity:number(name,0);
const scenarioName=values.scenario||'deprivedHighPlasticity',scenario=PAPER_FIGURE_7_SCENARIOS[scenarioName];
if(!scenario)throw new Error(`Unknown scenario ${scenarioName}; choose ${Object.keys(PAPER_FIGURE_7_SCENARIOS).join(', ')}`);
const resumePath=values.resume||null,outputPath=values.output||'neural-experiment-checkpoint.json';
let network,sampler,completedSteps=0,priorExperiment=null;
if(resumePath){
  if(!existsSync(resumePath))throw new Error(`Resume checkpoint not found: ${resumePath}`);
  const prior=JSON.parse(readFileSync(resumePath,'utf8'));network=InfomaxRecurrentNetwork.fromJSON(prior.network);completedSteps=prior.completedSteps||0;priorExperiment=prior.experiment;
  sampler=createPaperInputSampler({meanRadii:prior.experiment.meanRadii,radiusSdFraction:prior.experiment.radiusSdFraction,seed:prior.experiment.inputSeed,randomState:prior.samplerState});
}else{
  network=createTwoModalityPaperNetwork({neuronsPerModality:integer('neurons',71,3),seed:integer('network-seed',1,0),initialRecurrentScale:number('initial-jitter',1e-5)});
  sampler=createPaperInputSampler({meanRadii:scenario.meanRadii,radiusSdFraction:number('radius-sd-fraction',.1),seed:integer('input-seed',2,0)});
}
const experiment=priorExperiment||{scenario:scenarioName,reportedOutcome:scenario.reported,meanRadii:scenario.meanRadii,radiusSdFraction:number('radius-sd-fraction',.1),inputSeed:integer('input-seed',2,0),learningRate:number('learning-rate',scenario.learningRate),policy:values.policy||'fixed-best',batchSize:integer('batch-size',1),integrationStep:number('integration-step',.5,Number.EPSILON),tolerance:number('tolerance',1e-9,Number.EPSILON),maxSettleIterations:integer('max-settle',50000)};
const additionalSteps=integer('steps',100),checkpointEvery=integer('checkpoint-every',Math.max(1,Math.min(100,additionalSteps)));
let latest=null;const startingSteps=completedSteps;
const save=(partial=false,totalSteps=startingSteps+(latest?.step||0))=>writeFileSync(outputPath,JSON.stringify({schema:'neural-experiment-checkpoint/v1',notice:'Equation reconstruction; numerical equality with unpublished MATLAB code is not asserted.',paperDoi:'10.1371/journal.pcbi.1004959',experiment,completedSteps:totalSteps,partial,samplerState:sampler.snapshot(),lastStep:latest,network:network.toJSON()},null,2)+'\n');
const training=network.train({sampler,steps:additionalSteps,batchSize:experiment.batchSize,learningRate:experiment.learningRate,policy:experiment.policy,restoreBest:values['restore-best']!=='0',gradientClip:limit('gradient-clip'),maxAbsWeight:limit('max-weight'),settle:{integrationStep:experiment.integrationStep,tolerance:experiment.tolerance,maxIterations:experiment.maxSettleIterations,allowUnconverged:values['allow-unconverged']==='1'},onStep:record=>{latest=record;if(record.step%checkpointEvery===0){save(true,startingSteps+record.step);console.error(`step ${startingSteps+record.step}: objective=${record.objective} settle=${record.meanSettleIterations}`);}}});
latest=training.history.at(-1);completedSteps=startingSteps+additionalSteps;save(false,completedSteps);
console.log(JSON.stringify({output:outputPath,completedSteps,bestObjective:training.bestObjective,finalLearningRate:training.finalLearningRate,crossTalk:network.crossTalkSummary()},null,2));
