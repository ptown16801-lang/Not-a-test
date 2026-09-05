import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeCognitionEngine } from '../src/engine.js';
import { cobweb, honeycomb, logarithmicSpiral, projectiveSynestheticThought, spatialSequence, tunnel } from '../src/synesthetic-geometry.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';
import { OPERATOR_KINDS } from '../src/types.js';

const bake=(shape)=>{const engine=new ShapeCognitionEngine();engine.add(shape);return {engine,paths:bakeShapePaths(shape.id,engine.library)};};

test('research-inspired macros are deterministic closed derivations',()=>{
  const a=projectiveSynestheticThought(),b=projectiveSynestheticThought();
  assert.equal(a.id,b.id);
  const {engine}=bake(a);
  assert.ok([...engine.library.values()].every(s=>s.provenance.operator==='primitive'||OPERATOR_KINDS.includes(s.provenance.operator)));
  assert.ok([...engine.library.values()].every(s=>s.provenance.parents.every(id=>engine.library.has(id))));
});

test('complex families bake to finite continuous paths',()=>{
  const cases=[[logarithmicSpiral(),1],[tunnel(),7],[cobweb(),18],[honeycomb(),12],[spatialSequence(),9]];
  for(const [shape,minimum] of cases){const {paths}=bake(shape);assert.ok(paths.length>=minimum);assert.ok(paths.flat(2).every(Number.isFinite));assert.ok(paths.every(p=>p.length>=2));}
});

test('perspective projection changes a tunnel while retaining its rings',()=>{
  const shape=tunnel(),{engine,paths}=bake(shape);
  const parent=engine.library.get(shape.provenance.parents[0]);
  const unprojected=bakeShapePaths(parent.id,engine.library);
  assert.equal(paths.length,unprojected.length);
  assert.notDeepEqual(paths,unprojected);
});

test('server-rendered macros accept expanded creative complexity',()=>{
  assert.equal(bake(tunnel({rings:24})).paths.length,24);
  assert.equal(bake(cobweb({rings:20,spokes:40})).paths.length,60);
  assert.equal(bake(honeycomb({rows:12,columns:12})).paths.length,144);
  assert.equal(bake(spatialSequence({count:64})).paths.length,64);
});
