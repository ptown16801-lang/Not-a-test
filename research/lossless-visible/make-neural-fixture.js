#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createTwoModalityPaperNetwork} from '../../src/neural-synesthesia.js';
import {sceneFromNeuralStates} from '../../prototypes/lossless-cornfield/adapter.js';
const out=process.argv[2];
if(!out)throw Error('Provide a NEW output directory; saved evidence is never overwritten');
fs.mkdirSync(out,{recursive:false});
const config={neuronsPerModality:300,seed:410,initialRecurrentScale:.001};
const net=createTwoModalityPaperNetwork(config);
const inputs=[[.1,.2,.3,.4],[.2,-.1,.5,-.4],[.01,.02,.03,.04]];
const settle={maxIterations:10000,tolerance:1e-12,residualTolerance:1e-12};
const results=inputs.map(input=>net.settle(input,settle));
fs.writeFileSync(path.join(out,'fresh-neural-600.json'),JSON.stringify(sceneFromNeuralStates(results.map(r=>r.state)),null,2)+'\n');
const source=new URL('../../src/neural-synesthesia.js',import.meta.url);
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({config,inputs,settle,trained:false,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),results:results.map(({iterations,converged,fixedPointResidual})=>({iterations,converged,fixedPointResidual}))},null,2)+'\n');
