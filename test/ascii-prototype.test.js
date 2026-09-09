import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runAsciiPrototype } from '../prototypes/ascii-cornfield/prototype.js';
import { renderCornfieldPaths } from '../prototypes/ascii-cornfield/renderer.js';
import { createAsciiCornfieldServer } from '../prototypes/ascii-cornfield/server.js';

const phrase = 'seeing the bright sun evokes feelings of fun while having none.';

test('ASCII thought prototype is deterministic for identical inputs', () => {
  const first = runAsciiPrototype(phrase, {width: 64, height: 24, steps: 2});
  const second = runAsciiPrototype(phrase, {width: 64, height: 24, steps: 2});
  assert.equal(first.seed, second.seed);
  assert.equal(first.output.shapeId, second.output.shapeId);
  assert.equal(first.output.art, second.output.art);
  assert.equal(first.scientificOutcome, 'not-tested');
});

test('ASCII canvas has fixed dimensions and visible geometry', () => {
  const result = runAsciiPrototype('calm ordered light over a wide field', {width: 58, height: 20, steps: 1});
  const rows = result.output.art.split('\n');
  assert.equal(rows.length, 20);
  assert.ok(rows.every(row => row.length <= 58));
  assert.match(result.output.art, /Y/u);
  assert.match(result.output.art, /\*/u);
  assert.match(result.output.shapeId, /^sha256:[0-9a-f]{64}$/u);
});

test('cornfield renderer includes sky, corn, corridor, and thought paths', () => {
  const rendered = renderCornfieldPaths([
    [[-1, 0], [1, 0]],
    [[0, -1], [0, 1]]
  ], {width: 60, height: 22, seed: 7});
  assert.match(rendered.art, /O/u);
  assert.match(rendered.art, /Y/u);
  assert.match(rendered.art, /\*/u);
});

test('invalid renderer bounds fail explicitly', () => {
  assert.throws(() => renderCornfieldPaths([[[0, 0], [1, 1]]], {width: 4}), /width/u);
  assert.throws(() => runAsciiPrototype('', {}), /non-empty/u);
  assert.throws(() => runAsciiPrototype('shape', {steps: 25}), /steps/u);
});

test('prototype has no dirt-renderer dependency', () => {
  const root = new URL('../prototypes/ascii-cornfield/', import.meta.url);
  for (const name of ['renderer.js', 'prototype.js', 'cli.js']) {
    const source = readFileSync(new URL(name, root), 'utf8');
    assert.doesNotMatch(source, /(?:from|import\s*\()\s*['"][^'"]*dirt-renderer/u);
  }
});

test('CLI renders end to end and supports compact JSON output', () => {
  const script = fileURLToPath(new URL('../prototypes/ascii-cornfield/cli.js', import.meta.url));
  const display = execFileSync(process.execPath, [script, '--text', 'bright calm circle', '--width', '50', '--height', '18', '--steps', '1'], {encoding: 'utf8'});
  assert.match(display, /Mode: direct ASCII cornfield prototype/u);
  assert.match(display, /Shape: sha256:[0-9a-f]{64}/u);
  const json = JSON.parse(execFileSync(process.execPath, [script, '--text', 'bright calm circle', '--json', '--steps', '0'], {encoding: 'utf8'}));
  assert.equal(json.schema, 'ascii-cornfield-prototype/v1');
  assert.equal(json.stepsExecuted, 0);
  assert.match(json.art, /Y/u);
  assert.match(json.art, /\*/u);
  const failure = spawnSync(process.execPath, [script, '--steps', 'wrong'], {encoding: 'utf8'});
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /ASCII prototype error/u);
});

test('web executable serves the cornfield UI and render API', async t => {
  const server = createAsciiCornfieldServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const {port} = server.address();
  const root = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.match(html, /Neural Engine: ASCII Cornfield/u);
  assert.doesNotMatch(html, /src\/dirt-renderer/u);
  const rendered = await fetch(`http://127.0.0.1:${port}/api/render`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({text: 'bright calm circle', width: 50, height: 18, steps: 1})
  });
  assert.equal(rendered.status, 200);
  const result = await rendered.json();
  assert.equal(result.schema, 'ascii-cornfield-prototype/v1');
  assert.match(result.shapeId, /^sha256:[0-9a-f]{64}$/u);
  assert.match(result.art, /Y/u);
  assert.match(result.art, /\*/u);
});
