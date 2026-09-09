/** Minimal text -> shape cognition -> ASCII vertical slice. */

import { ShapeCognitionEngine, operators, primitive } from './runtime/engine.js';
import { renderCornfieldAscii } from './renderer.js';
import { sha256 } from './runtime/provenance.js';
import { textToPerceptualVector } from './runtime/text-perception.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round = value => Math.round(value * 1e6) / 1e6;

function derivedSeed(text) {
  return Number.parseInt(sha256(text).slice(0, 8), 16) || 1;
}

function tagsFrom(perception) {
  const semantic = perception.populations.map(population => population.label);
  const dimensions = perception.dimensions;
  return [...new Set([
    ...semantic,
    dimensions.valence >= .5 ? 'positive-valence' : 'negative-valence',
    dimensions.arousal >= .5 ? 'high-arousal' : 'low-arousal',
    dimensions.order >= .5 ? 'ordered' : 'irregular'
  ])];
}

function seedGeometry(engine, perception, tags) {
  const d = perception.dimensions;
  const radius = round(.2 + d.scale * .22);
  const separation = round(.28 + d.openness * .32);
  const sides = clamp(3 + Math.floor(d.complexity * 6), 3, 8);
  const vertical = round((d.valence - .5) * .7);
  const bend = round((d.arousal - .5) * 1.1);

  const left = operators.transform(
    primitive.disk([0, 0], radius, {tags}),
    [1, 0, 0, 1, -separation, vertical]
  );
  const right = operators.transform(
    primitive.polygon(sides, radius, {tags: [...tags, 'faceted']}),
    [1, 0, 0, 1, separation, -vertical]
  );
  const curve = primitive.curve([
    [-.9, 0], [-.35, bend], [.35, -bend], [.9, 0]
  ], {tags: [...tags, 'continuity']});

  engine.add(left);
  engine.add(right);
  engine.add(curve);
  const pair = engine.add(operators.combine(left, right, 'union'));
  return engine.add(operators.compose(curve, pair, 'center'));
}

/**
 * Run a deliberately rudimentary artistic prototype.
 * No recurrence, training, semantic decoding, or scientific validation is
 * inferred from this view.
 */
export function runAsciiPrototype(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('text must be a non-empty string');
  const seed = options.seed === undefined ? derivedSeed(text) : Number(options.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  const steps = options.steps ?? 3;
  if (!Number.isInteger(steps) || steps < 0 || steps > 24) {
    throw new RangeError('steps must be an integer from 0 to 24');
  }

  const perception = textToPerceptualVector(text);
  const tags = tagsFrom(perception);
  const engine = new ShapeCognitionEngine({
    seed, beamWidth: options.beamWidth ?? 3,
    maxWorkingSet: options.maxWorkingSet ?? 10,
    noveltyThreshold: 0
  });
  const initial = seedGeometry(engine, perception, tags);
  const goal = Object.freeze({
    id: `ascii-goal:${sha256(text)}`,
    tags,
    targetSymmetry: perception.dimensions.order >= .5 ? 'bilateral' : undefined
  });
  if (steps > 0) engine.run(goal, {maxSteps: steps, terminationScore: 1, stableSteps: steps + 1});
  const stream = engine.serialize();
  const shapeId = stream.steps.at(-1)?.selected?.[0]?.shapeId || initial.id;
  const output = renderCornfieldAscii(stream, {
    shapeId,
    seed,
    width: options.width,
    height: options.height,
    horizon: options.horizon
  });

  return Object.freeze({
    schema: 'ascii-cornfield-prototype/v1',
    status: 'engineering-prototype',
    scientificOutcome: 'not-tested',
    sourceText: text,
    seed,
    stepsExecuted: stream.steps.length,
    perception: Object.freeze({
      schema: perception.schema,
      dimensions: perception.dimensions,
      populations: perception.populations,
      encoding: perception.encoding
    }),
    stream,
    output
  });
}
