import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runVerification, validateReport} from './verify-live.mjs';

// Every simulated success below tests orchestration ONLY, never Wolfram mathematics.
const kernel = 'MOCK KERNEL - NOT SCIENTIFIC EVIDENCE';
const probe = () => ({status: 0, stdout: 'NEURAL_WOLFRAM_PROBE:' + JSON.stringify({kernel, systemId: 'mock', arithmetic: 4, linearSolveResidual: 0}) + '\n', stderr: ''});
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wolfram-gate-test-'));
  t.after(() => fs.rmSync(base, {recursive: true, force: true}));
  const repository = path.join(base, 'source'), output = path.join(base, 'run');
  fs.mkdirSync(repository);
  const hashes = {};
  for (const file of ['mathematica/tests/RunTests.wls', 'mathematica/tests/SynesthesiaModel.wlt', 'mathematica/SynesthesiaModel.wl', 'mathematica/verification/PublicationDerivation.wls', 'mathematica/verification/source-manifest.json', 'mathematica/verification/results/wolfram-validation.json']) {
    const full = path.join(repository, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, 'TEST FIXTURE ONLY ' + file);
    hashes[file] = createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  }
  return {repository, output, hashes};
}
function report(id, hashes) {
  const common = {kernel, allPassed: true, generatedAtUtc: new Date().toISOString()};
  return id === 'munit' ? {...common, schema: 'shriki-2016-wolfram-test-report/v1', testCount: 31, outcomeCounts: {Success: 31}, tests: Array.from({length: 31}, (_, i) => ({testId: String(i), outcome: 'Success'})), testFileSha256: hashes['mathematica/tests/SynesthesiaModel.wlt'], runnerSha256: hashes['mathematica/tests/RunTests.wls'], modelSourceSha256: hashes['mathematica/SynesthesiaModel.wl']} : {...common, schema: 'shriki-2016-publication-verification/v2', checkCount: 28, checks: Array.from({length: 28}, (_, i) => ({name: String(i), pass: true})), provenance: {projectModelImported: false, scriptSha256: hashes['mathematica/verification/PublicationDerivation.wls'], sourceManifestSha256: hashes['mathematica/verification/source-manifest.json']}, metrics: {fixedPointMaxAbsoluteResidual: 1e-16, susceptibilityFiniteDifferenceMaxAbsoluteError: 1e-11, objectiveGradientFiniteDifferenceMaxAbsoluteError: 1e-10, objectiveGradientFiniteDifferenceRelativeError: 1e-9, objectiveBeforeStep: 2, objectiveAfterStep: 1}};
}
function mockSuccess(f, mutate = () => {}) {
  return (_executable, args, options) => {
    if (args.includes('-code') || args.includes('-run')) return probe();
    const id = options.env.SHRIKI_WOLFRAM_TEST_REPORT_OUTPUT ? 'munit' : 'publication';
    const destination = options.env.SHRIKI_WOLFRAM_TEST_REPORT_OUTPUT || options.env.SHRIKI_WOLFRAM_VALIDATION_OUTPUT;
    const value = report(id, f.hashes);
    mutate(id, value);
    fs.writeFileSync(destination, JSON.stringify(value));
    return {status: 0, stdout: '', stderr: ''};
  };
}
test('missing runtime is BLOCKED, not passed or skipped, and retains evidence', t => {
  const f = fixture(t);
  const result = runVerification({...f, spawn: () => ({status: null, error: Object.assign(new Error('missing executable'), {code: 'ENOENT'})})});
  assert.equal(result.status, 'blocked'); assert.equal(result.freshScientificValidation, false);
  assert.equal(result.gates.length, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.output, 'summary.json'))).status, 'blocked');
});
test('pre-existing output is refused without overwriting anything', t => {
  const f = fixture(t); fs.mkdirSync(f.output); fs.writeFileSync(path.join(f.output, 'keep'), 'original');
  assert.throws(() => runVerification({...f, spawn: mockSuccess(f)}), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(f.output, 'keep'), 'utf8'), 'original');
});
test('output inside original source is refused', t => {
  const f = fixture(t); assert.throws(() => runVerification({...f, output: path.join(f.repository, 'new')}), /outside/);
});
for (const [name, spawn] of [
  ['timeout', () => ({status: null, error: Object.assign(new Error('timed out'), {code: 'ETIMEDOUT'})})],
  ['nonzero probe', () => ({status: 1, stdout: '', stderr: 'activation required'})],
  ['malformed probe', () => ({status: 0, stdout: '4', stderr: ''})],
  ['wrong arithmetic', () => ({status: 0, stdout: 'NEURAL_WOLFRAM_PROBE:{"kernel":"mock","systemId":"mock","arithmetic":5,"linearSolveResidual":0}'})]
]) test(name + ' cannot count as validation', t => {
  const f = fixture(t), result = runVerification({...f, spawn});
  assert.equal(result.status, 'blocked'); assert.equal(result.freshScientificValidation, false);
});
test('probe-only success cannot count as scientific validation', t => {
  const f = fixture(t), result = runVerification({...f, probeOnly: true, spawn: mockSuccess(f)});
  assert.equal(result.status, 'runtime-ready-unverified'); assert.equal(result.freshScientificValidation, false);
});
test('MOCK happy path: both fresh reports pass, original sources and old reports unchanged', t => {
  const f = fixture(t), result = runVerification({...f, spawn: mockSuccess(f)});
  assert.equal(result.status, 'passed'); assert.equal(result.gates.length, 2);
  assert.equal(result.originalInputsUnchanged, true);
  for (const [file, hash] of Object.entries(f.hashes)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(f.repository, file))).digest('hex'), hash);
});
for (const [name, mutate] of [
  ['individual failure hidden by allPassed', (id, r) => {if (id === 'munit') r.tests[0].outcome = 'Failure';}],
  ['stale report', (_id, r) => {r.generatedAtUtc = '2020-01-01T00:00:00Z';}],
  ['source hash mismatch', (id, r) => {if (id === 'munit') r.runnerSha256 = 'wrong';}],
  ['count mismatch', (id, r) => {if (id === 'publication') r.checkCount = 27;}],
  ['duplicate check names', (id, r) => {if (id === 'publication') r.checks[1].name = r.checks[0].name;}],
  ['numerical tolerance failure', (id, r) => {if (id === 'publication') r.metrics.objectiveGradientFiniteDifferenceMaxAbsoluteError = 1;}],
  ['non-independent publication report', (id, r) => {if (id === 'publication') r.provenance.projectModelImported = true;}]
]) test(name + ' fails the live gate', t => {
  const f = fixture(t), result = runVerification({...f, spawn: mockSuccess(f, mutate)});
  assert.equal(result.status, 'failed'); assert.equal(result.freshScientificValidation, false);
});
test('missing fresh report cannot be replaced by archived report', t => {
  const f = fixture(t), result = runVerification({...f, spawn: (_e, args) => args.includes('-code') ? probe() : {status: 0, stdout: ''}});
  assert.equal(result.status, 'failed'); assert.equal(result.gates[0].status, 'failed');
});
test('source symlinks are refused before running tests', t => {
  const f = fixture(t); fs.symlinkSync('/tmp', path.join(f.repository, 'mathematica', 'unsafe'));
  const result = runVerification({...f, spawn: mockSuccess(f)});
  assert.equal(result.status, 'failed'); assert.match(result.reason, /symlink/);
});
test('explicit direct-kernel mode uses -run and preserves configured preload', t => {
  const f = fixture(t), result = runVerification({...f, executable: '/mock/kernel', directKernel: true, probeOnly: true, env: {WOLFRAM_LD_PRELOAD: '/mock/shim'}, spawn: (_e, args, opts) => {
    assert.ok(args.includes('-run')); assert.equal(opts.env.LD_PRELOAD, '/mock/shim'); return probe();
  }});
  assert.equal(result.status, 'runtime-ready-unverified');
});
test('nonfinite gradient metric is rejected', t => {
  const f = fixture(t), value = report('publication', f.hashes); value.metrics.objectiveGradientFiniteDifferenceRelativeError = NaN;
  assert.throws(() => validateReport('publication', value, f.hashes, kernel, Date.now()), /numerical gate/);
});
