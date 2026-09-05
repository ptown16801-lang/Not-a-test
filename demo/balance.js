import { writeFile } from 'node:fs/promises';
import { ShapeCognitionEngine, primitive, operators } from '../src/engine.js';

const engine = new ShapeCognitionEngine({seed: 20260904, beamWidth: 3});
const left = engine.add(operators.transform(primitive.disk([0,0],.18,{tags:['mass','equal','balance']}),[1,0,0,1,-.42,.22]));
const right = engine.add(operators.transform(primitive.disk([0,0],.18,{tags:['mass','equal','balance']}),[1,0,0,1,.42,.22]));
const bar = engine.add(primitive.segment([-.62,0],[.62,0],{tags:['support','balance','equilibrium']}));
const pair = engine.add(operators.combine(left,right,'union'));
engine.add(operators.compose(bar,pair,'center'));
const goal={id:'goal_balance',tags:['balance','equilibrium','support','equal'],targetSymmetry:'bilateral'};
engine.run(goal,{maxSteps:6,terminationScore:.58,stableSteps:2});
const output=engine.serialize();
await writeFile(new URL('./balance-output.json',import.meta.url),JSON.stringify(output,null,2));
console.log(JSON.stringify({shapes:output.shapes.length,steps:output.steps.length,best:output.steps.at(-1)?.selected[0],output:'demo/balance-output.json'},null,2));

