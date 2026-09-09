import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {extractPrimitiveScene,sceneFromPaths,sceneFromNeuralStates} from '../../prototypes/lossless-cornfield/adapter.js';
import {runAsciiPrototype} from '../../prototypes/ascii-cornfield/prototype.js';
import {renderCornfieldPaths,replayShapePaths,renderCornfieldAscii} from '../../prototypes/ascii-cornfield/renderer.js';
import {textToPerceptualVector} from '../../prototypes/ascii-cornfield/runtime/text-perception.js';

const out='research/lossless-visible/fixtures';
fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=fs.readFileSync('demo/balance-output.json');
const saved=JSON.parse(source);
const extracted=extractPrimitiveScene(saved);
write('saved-balance-primitives',extracted.scene);
write('saved-balance-extraction',{sourcePath:'demo/balance-output.json',sourceSha256:sha(source),...extracted.scope});
const run=runAsciiPrototype('seeing the bright sun evokes feelings of fun while having none.',{steps:24,width:240,height:120});
write('fresh-ascii-24-step-stream',run.stream);
write('fresh-ascii-primitive-extraction',extractPrimitiveScene(run.stream));
const paths=replayShapePaths(run.output.shapeId,new Map(run.stream.shapes.map(s=>[s.id,s])));
write('fresh-ascii-paths',sceneFromPaths(paths));
write('fresh-ascii-scope',{neuralNetworkExecuted:false,boundary:'polylines after existing lossy replay',paths:paths.length,vertices:paths.reduce((a,p)=>a+p.length,0),sourceTextRecoverable:false});

// Concrete collision witnesses in the unchanged renderer, preserved as failures
// of its inversion claim; these are successful negative controls for this task.
const opts={width:88,height:32,seed:7};
const base=[[[-1,-1],[0,1],[1,-1]]];
const art=p=>renderCornfieldPaths(p,opts).art;
const negatives=[];
const witness=(name,a,b)=>negatives.push({name,distinctInputs:JSON.stringify(a)!==JSON.stringify(b),sameVisibleOutput:art(a)===art(b),a,b});
witness('translation',base,base.map(p=>p.map(([x,y])=>[x+8,y+16])));
witness('uniform scale',base,base.map(p=>p.map(([x,y])=>[x*2,y*2])));
witness('independent axis scale',base,base.map(p=>p.map(([x,y])=>[x*2,y*.5])));
witness('duplicates',base,[...base,...base]);
witness('adjacent floating value',base,[[[-1,-1],[Number.MIN_VALUE,1],[1,-1]]]);
const b=structuredClone(saved);b.shapes[0].attributes.texture=.8;
negatives.push({name:'unused attribute',distinctInputs:true,sameVisibleOutput:renderCornfieldAscii(saved,opts).art===renderCornfieldAscii(b,opts).art});
const p=textToPerceptualVector('sun!');const q=textToPerceptualVector('sun?');
negatives.push({name:'text-to-numeric-state collision',distinctInputs:true,sameNumericVector:[...p.input].every((x,i)=>Object.is(x,q.input[i])),qualification:'text strings retained in perception records differ; numeric vector alone cannot recover punctuation'});
fs.writeFileSync('research/lossless-visible/results/legacy-losses.json',JSON.stringify(negatives,null,2)+'\n');
console.log(JSON.stringify({savedPrimitives:extracted.scene.shapes.length,freshShapes:run.stream.shapes.length,freshPaths:paths.length,freshVertices:paths.flat().length,negativeControls:negatives.length}));
