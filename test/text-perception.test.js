import test from 'node:test';
import assert from 'node:assert/strict';
import { textToPerceptualVector } from '../src/text-perception.js';

test('maps the duck seed into deterministic perceptual dimensions and quantity',()=>{
  const seed='The ducks in the park are free, i have forty of them';
  const a=textToPerceptualVector(seed),b=textToPerceptualVector(seed);
  assert.equal(a.quantity,40);
  assert.equal(a.encoding,'text/perceptual-and-semantic');
  assert.deepEqual([...a.input],[...b.input]);
  assert.ok(a.dimensions.openness>.5);
  assert.ok(a.dimensions.repetition>.5);
  assert.ok(a.populations.some(p=>p.label==='freedom'));
  assert.ok(a.populations.some(p=>p.label==='self-possession'));
  assert.ok(a.populations.some(p=>p.label==='animal-life'));
});

test('does not literally encode object drawings',()=>{
  const out=textToPerceptualVector('one duck');
  assert.equal(out.quantity,1);
  assert.ok(!('shape' in out));
  assert.ok(!('image' in out));
});
