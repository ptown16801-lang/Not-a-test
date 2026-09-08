import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repository, relative));
const readJson = relative => JSON.parse(read(relative).toString('utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const reportPath = 'verification/results/backpropagation-600.json';

test('600-neuron backpropagation report is source-fingerprinted and passing', () => {
  const report = readJson(reportPath);
  assert.equal(report.schema, 'neural-engine-backpropagation-600/v1');
  assert.equal(report.provenance.testedBaseCommit,
    '557ce0553224a8299abecd98cf71be142ad90b35');
  assert.equal(report.provenance.modelSourceSha256,
    digest(read(report.provenance.modelSource)));
  assert.equal(report.provenance.scriptSha256,
    digest(read(report.provenance.script)));
  assert.equal(report.allPassed, true);
  assert.equal(report.reliability.weightedGateScore, 100);
  assert.equal(report.reliability.conservativeScore, 95);
  assert.ok(report.reliability.gates.every(gate => gate.passed));
});

test('600-neuron test covers recurrent gradients and raw-state inversion', () => {
  const report = readJson(reportPath);
  const results = report.results;
  assert.equal(results.dimensionsAndFiniteness.outputNeurons, 600);
  assert.deepEqual(results.dimensionsAndFiniteness.neuronsPerModality, [300, 300]);
  assert.equal(results.dimensionsAndFiniteness.recurrentParameters, 360000);
  assert.equal(results.dimensionsAndFiniteness.derivativeFloorApplied, false);
  assert.equal(results.coordinateGradient.checks, 16);
  assert.equal(results.coordinateGradient.pass, true);
  assert.equal(results.directionalGradient.directions, 7);
  assert.equal(results.directionalGradient.pass, true);
  assert.equal(results.objectiveDescent.pass, true);
  assert.equal(results.inputInversion.noiseless.successCount, 6);
  assert.equal(results.inputInversion.noisy.successCount, 3);
  assert.equal(results.inputInversion.eightBit.successCount, 3);
  assert.equal(results.inputInversion.pass, true);
  assert.match(report.scope.excludedClaim, /rendered artwork/i);
});

test('600-neuron critical control preserves the numerical warning', () => {
  const report = readJson(reportPath);
  const critical = report.results.critical;
  const exactWorst = critical.exactKnownState.at(-1);
  const settledWorst = critical.policySettled.at(-1);
  assert.equal(exactWorst.rho, 0.9999);
  assert.ok(exactWorst.gradientRelativeFrobeniusError < 2e-9);
  assert.equal(settledWorst.rho, 0.9999);
  assert.ok(settledWorst.fixedPointResidual < 1e-9);
  assert.ok(settledWorst.gradientRelativeFrobeniusError > 0.6);
  assert.match(critical.warning, /not a forward- or gradient-error guarantee/i);
});
