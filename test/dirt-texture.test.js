import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroundTextureRecipe, rasterizeGroundTexture } from '../src/dirt-texture.js';

test('ground texture is deterministic with an opaque core and feathered edge',()=>{
  const paths=[[[0,.5],[1,.5]]],options={width:128,height:128,bounds:[0,0,1,1],coreWidthPx:7,featherWidthPx:17,seed:'shape_deadbeef'};
  const a=rasterizeGroundTexture(paths,options),b=rasterizeGroundTexture(paths,options);
  assert.deepEqual(a.coverage,b.coverage);assert.deepEqual(a.roughness,b.roughness);
  assert.equal(a.coverage[64*128+64],255);
  assert.ok(a.coverage[58*128+64]>0&&a.coverage[58*128+64]<255);
  assert.equal(a.coverage[45*128+64],0);
});

test('texture recipes vary by shape but remain stable',()=>{
  assert.deepEqual(createGroundTextureRecipe('shape_a'),createGroundTextureRecipe('shape_a'));
  assert.notEqual(createGroundTextureRecipe('shape_a').seed,createGroundTextureRecipe('shape_b').seed);
});
