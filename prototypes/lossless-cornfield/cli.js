#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractPrimitiveScene,sceneFromPaths} from './adapter.js';
import {runAsciiPrototype} from '../ascii-cornfield/prototype.js';
import {replayShapePaths} from '../ascii-cornfield/renderer.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
const [mode,input,output]=process.argv.slice(2);
if (!output || !['scene','primitives','ascii-paths'].includes(mode)) {
  console.error('Usage: node cli.js scene scene.json output.png\n       node cli.js primitives saved-stream.json output.png\n       node cli.js ascii-paths "sentence" output.png');
  process.exit(2);
}
let scene,scope;
if (mode==='scene') {
  // Pass bytes through: Python owns strict duplicate-key and numeric checks.
  const p=spawnSync(process.env.NE_VISIBLE_PYTHON || 'python3',[path.join(directory,'render.py'),input,output],{stdio:'inherit'});
  process.exit(p.status??1);
} else if (mode==='primitives') {
  ({scene,scope}=extractPrimitiveScene(JSON.parse(fs.readFileSync(input,'utf8'))));
} else {
  const run=runAsciiPrototype(input,{steps:0});
  const paths=replayShapePaths(run.output.shapeId,new Map(run.stream.shapes.map(s=>[s.id,s])));
  scene=sceneFromPaths(paths);
  scope={status:'explicit partial extraction',boundary:'ordered polylines AFTER the existing lossy replay',sourceTextRecoverable:false,neuralNetworkExecuted:false,controlPointsAndAnalyticCurvesRecovered:false};
}
console.error(JSON.stringify(scope,null,2));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'visible-input-'));
try {
  const f=path.join(temp,'scene.json');fs.writeFileSync(f,JSON.stringify(scene));
  const p=spawnSync(process.env.NE_VISIBLE_PYTHON || 'python3',[path.join(directory,'render.py'),f,output],{stdio:'inherit'});
  process.exitCode=p.status??1;
} finally { fs.rmSync(temp,{recursive:true}); }
