import { writeFileSync } from 'node:fs';
import { createPaperInputSampler, createTwoModalityPaperNetwork } from '../src/neural-synesthesia.js';

// Compact, reproducible preview checkpoint. It uses the paper's exact dynamics
// and gradient, but only 7 units per modality and an accelerated learning rate;
// it is not presented as a numerical reproduction of a published figure.
const config=Object.freeze({
  neuronsPerModality:7,networkSeed:17,initialRecurrentScale:1e-5,
  inputSeed:99,meanRadii:[.2,2],radiusSdFraction:.1,
  steps:20_000,batchSize:1,learningRate:.001,policy:'fixed-best'
});
const network=createTwoModalityPaperNetwork({neuronsPerModality:config.neuronsPerModality,seed:config.networkSeed,initialRecurrentScale:config.initialRecurrentScale});
const sampler=createPaperInputSampler({meanRadii:config.meanRadii,radiusSdFraction:config.radiusSdFraction,seed:config.inputSeed});
const training=network.train({sampler,steps:config.steps,batchSize:config.batchSize,learningRate:config.learningRate,policy:config.policy,restoreBest:true,gradientClip:50,maxAbsWeight:20,settle:{integrationStep:1,tolerance:1e-7,maxIterations:5000,allowUnconverged:true}});
const artifact={schema:'neural-preview-checkpoint/v1',notice:'Compact visualization checkpoint; not a digitized or exact reproduction of a published figure.',reconstruction:{paperDoi:'10.1371/journal.pcbi.1004959',config,bestObjective:training.bestObjective,crossTalk:network.crossTalkSummary()},network:network.toJSON()};
writeFileSync(new URL('../assets/neural-preview-checkpoint.json',import.meta.url),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({output:'assets/neural-preview-checkpoint.json',bestObjective:training.bestObjective,crossTalk:network.crossTalkSummary()},null,2));

