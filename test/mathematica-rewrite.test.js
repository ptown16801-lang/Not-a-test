import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  PAPER_DOI,
  PAPER_FIGURE_7_SCENARIOS,
  simpleNoCrossTalkStability
} from '../src/neural-synesthesia.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mathematica = path.join(repository, 'mathematica');
const read = relative => fs.readFileSync(path.join(repository, relative), 'utf8');

function checkWolframDelimiters(source, file) {
  const stack = [];
  const matching = {')': '(', ']': '[', '}': '{', '|>': '<|'};
  let commentDepth = 0;
  let inString = false;
  let line = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const pair = source.slice(index, index + 2);
    if (character === '\n') line += 1;

    if (commentDepth > 0) {
      if (pair === '(*') { commentDepth += 1; index += 1; }
      else if (pair === '*)') { commentDepth -= 1; index += 1; }
      continue;
    }
    if (inString) {
      if (character === '\\') index += 1;
      else if (character === '"') inString = false;
      continue;
    }
    if (pair === '(*') { commentDepth = 1; index += 1; continue; }
    if (character === '"') { inString = true; continue; }
    if (pair === '<|') { stack.push({token: pair, line}); index += 1; continue; }
    if (pair === '|>') {
      const opener = stack.pop();
      assert.equal(opener?.token, matching[pair], `${file}:${line} has unmatched ${pair}`);
      index += 1;
      continue;
    }
    if ('([{'.includes(character)) stack.push({token: character, line});
    if (')]}'.includes(character)) {
      const opener = stack.pop();
      assert.equal(opener?.token, matching[character],
        `${file}:${line} closes ${character} after ${opener?.token ?? 'nothing'}`);
    }
  }
  assert.equal(commentDepth, 0, `${file} has an unterminated comment`);
  assert.equal(inString, false, `${file} has an unterminated string`);
  assert.deepEqual(stack, [], `${file} has unclosed delimiters`);
}

test('all Wolfram source and notebook expressions have balanced delimiters', () => {
  const files = [
    'mathematica/SynesthesiaModel.wl',
    'mathematica/PaperFigures.wl',
    'mathematica/Shriki2016Reproduction.nb',
    'mathematica/RunAll.wls',
    'mathematica/ScalingBenchmark.wls',
    'mathematica/tests/SynesthesiaModel.wlt',
    'mathematica/tests/RunTests.wls'
  ];
  for (const file of files) checkWolframDelimiters(read(file), file);
});

test('the machine-readable paper ledger matches the tested JavaScript transcription', () => {
  const spec = JSON.parse(read('mathematica/paper-spec.json'));
  assert.equal(spec.paper.doi, PAPER_DOI);
  assert.deepEqual(spec.architecture.simple, {inputNeurons: 2, outputNeurons: 2});
  assert.equal(spec.architecture.population.inputNeurons, 4);
  assert.equal(spec.architecture.population.reportedOutputNeurons, 142);
  assert.equal(spec.architecture.population.reportedNeuronsPerModality, 71);
  assert.deepEqual(Object.keys(spec.figure7Scenarios), Object.keys(PAPER_FIGURE_7_SCENARIOS));
  for (const [name, scenario] of Object.entries(PAPER_FIGURE_7_SCENARIOS)) {
    assert.deepEqual(spec.figure7Scenarios[name].meanRadii, scenario.meanRadii, name);
    assert.equal(spec.figure7Scenarios[name].learningRate, scenario.learningRate, name);
    assert.equal(spec.figure7Scenarios[name].reported, scenario.reported, name);
  }
  assert.equal(spec.scaling.rankAddedPerSampleUpdate, 5);
  assert.equal(spec.scaling.exactUntilCompression, true);
  assert.match(spec.scaling.nonPublicBoundary, /cannot be independently enumerated/i);
});

test('the Wolfram package contains the published equations and guarded scaling path', () => {
  const source = read('mathematica/SynesthesiaModel.wl');
  for (const required of [
    'LogisticActivation[field]',
    'DiagonalMatrix[1/first] - model["K"]',
    'gram = Transpose[chi].chi',
    'objective = -Log[determinant]/2',
    'gamma',
    'a = chiGammaDiagonal second/first^3',
    'leftFactors = Join[Transpose[gamma], Transpose[{b}], 2]',
    'rightFactors = Join[chi, Transpose[{s}], 2]',
    'middle = IdentityMatrix[Last@Dimensions[left]] - Transpose[right].scaledLeft',
    'diagonal = -(Total /@ (left right))',
    'EstimateNetworkScale[total_, rank_ : 128]',
    '"Approximate" -> (truncations > 0)'
  ]) assert.ok(source.includes(required), `missing equation or guard: ${required}`);
  assert.match(source, /returnPhi = Replace\[returnPhi, Automatic -> \(!lowRankModelQ\[model\] && m <= 256\)\]/);
  assert.match(source, /operatorSolver = Quiet@Check\[LinearSolve\[operator\], \$Failed\]/);
  assert.match(source, /exact = recurrent\["Truncations"\] == 0;\s+maximumRank = recurrent\["MaximumRank"\]/);
});

test('the notebook covers the full computational paper and labels reconstruction limits', () => {
  const notebook = read('mathematica/Shriki2016Reproduction.nb');
  for (let section = 0; section <= 15; section += 1) {
    assert.match(notebook, new RegExp(`Cell\\["${section}\\.`), `missing section ${section}`);
  }
  for (let figure = 1; figure <= 7; figure += 1) {
    assert.ok(notebook.includes(`PaperFigure${figure}`), `missing executable Figure ${figure} path`);
  }
  for (const phrase of [
    'S1 Appendix reconstructed symbolically',
    'The authors\' MATLAB code was not released',
    'one outer product',
    'Truly non-public scaling methods cannot be audited',
    'not a model of text-to-image rendering'
  ]) assert.ok(notebook.includes(phrase), `missing notebook disclosure: ${phrase}`);
  assert.ok(fs.existsSync(path.join(repository, 'assets/neural-preview-checkpoint.json')));
});

test('S1 stability cases remain aligned with the analytical implementation', () => {
  assert.equal(simpleNoCrossTalkStability({variance1: .05, variance2: .05}).stable, true);
  assert.equal(simpleNoCrossTalkStability({variance1: 0, variance2: .24}).stable, false);
  const packageSource = read('mathematica/SynesthesiaModel.wl').replace(/\s+/g, ' ');
  assert.match(packageSource,
    /determinant = -9\/16 \+ 3 alpha1 \+ 3 alpha2 - 4 alpha1\^2 - 4 alpha2\^2 - \(29\/2\) alpha1 alpha2/);
});

test('headless Wolfram entry points avoid evaluator-style command-line parsing', () => {
  for (const file of ['mathematica/RunAll.wls', 'mathematica/ScalingBenchmark.wls']) {
    const source = read(file);
    assert.doesNotMatch(source, /\bToExpression\b/);
    assert.doesNotMatch(source, /\bRunProcess\b|\bExternalEvaluate\b/);
  }
  assert.match(read('mathematica/RunAll.wls'), /--scenario/);
});

test('the scaling audit separates fidelity classes and states the non-public boundary', () => {
  const audit = read('mathematica/SCALING_AUDIT.md');
  for (const label of [
    'Exact model extension',
    'Exact until compression',
    'Tolerance-equivalent',
    'Approximate',
    'Model-changing',
    'Boundary on “non-public” methods'
  ]) assert.ok(audit.includes(label), `missing scaling classification: ${label}`);
  assert.match(audit, /No exact general-purpose format can promise subquadratic storage/i);
});

const wolframExecutableProbe = spawnSync('wolframscript', ['-version'], {
  cwd: repository,
  encoding: 'utf8',
  timeout: 15_000
});
const hasWolframExecutable = !wolframExecutableProbe.error && wolframExecutableProbe.status === 0;
const wolframKernelProbe = hasWolframExecutable ? spawnSync('wolframscript', [
  '-code', 'If[NumberQ[$VersionNumber], Exit[0], Exit[1]]'
], {
  cwd: repository,
  encoding: 'utf8',
  timeout: 30_000
}) : null;
const hasWolframRuntime = hasWolframExecutable && wolframKernelProbe?.status === 0;
const wolframSkipReason = hasWolframExecutable
  ? 'wolframscript is installed but Wolfram Engine is not activated on this worker'
  : 'wolframscript is not installed on this worker';

test('MUnit suite passes when a licensed Wolfram runtime is available', {
  skip: hasWolframRuntime ? false : wolframSkipReason
}, () => {
  const result = spawnSync('wolframscript', [
    '-file', path.join(mathematica, 'tests', 'RunTests.wls')
  ], {cwd: repository, encoding: 'utf8', timeout: 600_000});
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
