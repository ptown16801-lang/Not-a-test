import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bakeShapePaths, renderDirtInscription } from '../src/dirt-renderer.js';

const fixture=JSON.parse(await readFile(new URL('../demo/balance-output.json',import.meta.url),'utf8'));
const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(((poly[i][1]>p[1])!==(poly[j][1]>p[1]))&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])yes=!yes;return yes;};
test('bakes balance composition as one exterior union boundary',()=>{
  const map=new Map(fixture.shapes.map(s=>[s.id,s]));
  const composed=fixture.shapes.find(s=>s.provenance.operator==='compose');
  const paths=bakeShapePaths(composed.id,map);
  assert.equal(paths.length,1); // no internal bar or disk outlines
  assert.deepEqual(paths[0][0],paths[0].at(-1));
  assert.ok(inside([-.42,.22],paths[0]));
  assert.ok(inside([.42,.22],paths[0]));
  assert.ok(inside([0,0],paths[0]));
});
test('union of separated masses emits only their exterior components',()=>{
  const map=new Map(fixture.shapes.map(s=>[s.id,s]));
  const pair=fixture.shapes.find(s=>s.provenance.operator==='combine'&&s.provenance.params.mode==='union');
  const paths=bakeShapePaths(pair.id,map);
  assert.equal(paths.length,2);
  assert.ok(paths.every(p=>p.length>8&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]));
});
test('physical coordinates stay inside tram-line and are chronological',()=>{
  const out=renderDirtInscription(fixture,{lengthM:20,widthM:2});
  assert.equal(out.schema,'dirt-inscription/v0');
  assert.ok(out.inscriptions.every((x,i,a)=>!i||a[i-1].createdAtStep<=x.createdAtStep));
  for(const p of out.inscriptions.flatMap(x=>x.paths))for(const [x,y] of p){assert.ok(x>=0&&x<=2);assert.ok(y>=0&&y<=20);}
  assert.ok(out.commands.every((x,i)=>x.seq===i));
});
test('density budget is never exceeded',()=>{
  const max=.0001,out=renderDirtInscription(fixture,{lengthM:10,widthM:2,maxPathDensity:max,strokeWidthM:.05});
  assert.ok(out.stats.soilUseFraction<=max+1e-6);
  assert.ok(out.inscriptions.some(x=>x.omittedPaths>0));
});
test('rendering is deterministic',()=>{
  const a=renderDirtInscription(fixture),b=renderDirtInscription(fixture);
  assert.deepEqual(a,b);
});
test('overwrite and fade policies become explicit scheduled commands',()=>{
  const out=renderDirtInscription(fixture,{overwrite:'erase-zone',fade:{mode:'ttl',afterSeconds:60}});
  assert.equal(out.commands.filter(x=>x.type==='erase').length,out.inscriptions.length);
  assert.equal(out.commands.filter(x=>x.type==='fade').length,out.inscriptions.length);
  assert.ok(out.commands.every((x,i,a)=>!i||a[i-1].timeS<=x.timeS));
});
