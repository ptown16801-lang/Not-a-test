import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSound, encodeThermalTouch, perceptionToNeuralStimulus } from '../src/sensory-encoders.js';
import { sensoryFeaturesToArtShape } from '../src/sensory-art.js';
import { ShapeCognitionEngine } from '../src/engine.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';

test('thermal touch maps hot and cold to opposite deterministic poles',()=>{
  const hot=encodeThermalTouch({temperatureF:91}),cold=encodeThermalTouch({temperatureF:49}),neutral=encodeThermalTouch({temperatureF:70});
  assert.equal(hot.classification,'hot');assert.equal(cold.classification,'cold');assert.equal(neutral.classification,'neutral');
  assert.ok(hot.vector[0]>0);assert.ok(cold.vector[0]<0);assert.equal(hot.vector[1],0);assert.equal(Math.abs(hot.normalized),Math.abs(cold.normalized));assert.deepEqual(encodeThermalTouch({temperatureF:91}),hot);
});

test('thermal perception uses 3 degree steps and clamps at plus or minus 50',()=>{
  assert.equal(encodeThermalTouch({temperatureF:70}).normalized,0);
  assert.equal(encodeThermalTouch({temperatureF:71}).normalized,0);
  assert.equal(encodeThermalTouch({temperatureF:72}).perceivedTemperatureF,73);
  assert.equal(encodeThermalTouch({temperatureF:68}).perceivedTemperatureF,67);
  assert.equal(encodeThermalTouch({temperatureF:120}).normalized,1);
  assert.equal(encodeThermalTouch({temperatureF:20}).normalized,-1);
  assert.equal(encodeThermalTouch({temperatureF:180}).normalized,1);
  assert.equal(encodeThermalTouch({temperatureF:-20}).normalized,-1);
});

test('sound analysis recovers a stable tone and treats silence as zero intensity',()=>{
  const sampleRateHz=8192,frequency=440,samples=Array.from({length:1024},(_,i)=>.5*Math.sin(2*Math.PI*frequency*i/sampleRateHz));
  const tone=analyzeSound({sampleRateHz,samples}),silence=analyzeSound({sampleRateHz,samples:Array(1024).fill(0)});
  assert.ok(Math.abs(tone.dominantFrequencyHz-frequency)<1);assert.ok(tone.rms>.34&&tone.rms<.36);assert.ok(tone.radius>0);assert.equal(silence.radius,0);assert.equal(silence.dominantFrequencyHz,0);
});

test('sensory vectors occupy only the configured neural modality',()=>{
  const thermal=perceptionToNeuralStimulus({kind:'thermal-touch',temperatureF:95},{inducerModality:0});
  const sound=perceptionToNeuralStimulus({kind:'sound',sampleRateHz:8000,samples:Array.from({length:64},(_,i)=>Math.sin(2*Math.PI*i/8))},{inducerModality:1});
  assert.notEqual(thermal.input[0],0);assert.deepEqual([...thermal.input.slice(2)],[0,0]);assert.deepEqual([...sound.input.slice(0,2)],[0,0]);assert.ok(Math.hypot(sound.input[2],sound.input[3])>0);
});

test('artistic sensory motifs are distinct, deterministic, and legal dirt paths',()=>{
  const hot=encodeThermalTouch({temperatureF:110}),cold=encodeThermalTouch({temperatureF:30});
  const tone=analyzeSound({sampleRateHz:8000,samples:Array.from({length:256},(_,i)=>.7*Math.sin(2*Math.PI*625*i/8000))});
  const a=sensoryFeaturesToArtShape(hot),again=sensoryFeaturesToArtShape(hot),b=sensoryFeaturesToArtShape(cold),c=sensoryFeaturesToArtShape(tone);
  assert.equal(a.id,again.id);assert.notEqual(a.id,b.id);assert.notEqual(a.id,c.id);
  for(const shape of [a,b,c]){const engine=new ShapeCognitionEngine();engine.add(shape);const paths=bakeShapePaths(shape.id,engine.library);assert.ok(paths.length>=2);assert.ok(paths.flat(2).every(Number.isFinite));}
});
