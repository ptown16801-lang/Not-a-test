import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {assessProbe, assessSuite, verifyWolfram} from '../scripts/verify-wolfram.js';

// Synthetic fixtures test control flow only. They are never Wolfram evidence.
const nonce = 'fixture-nonce';
const names = [
  'MUnit suite passes when a licensed Wolfram runtime is available',
  'independent Wolfram publication verification executes when a licensed runtime is available'
];
const evidence = {nonce, arithmetic: 4, symbolicDerivative: true, linearSolve: true,
  version: '15.0.0 synthetic unit-test fixture', systemID: 'synthetic-fixture'};
const okProbe = (changes = {}) => ({status: 0, stdout:
  `NEURAL_ENGINE_WOLFRAM_PROBE:${JSON.stringify({...evidence, ...changes})}`, stderr: ''});
const okSuite = () => ({status: 0, stdout: `TAP version 13\n`
  + names.map((name, i) => `ok ${i + 1} - ${name}\n`).join('')
  + '1..2\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n', stderr: ''});

test('strict probe rejects a missing executable without claiming a licensing cause', () => {
  assert.deepEqual(assessProbe({error: {code: 'ENOENT'}, status: null}, nonce),
    {status: 'executable-not-found', available: false});
});
test('strict probe distinguishes timeout from unavailable executable', () => {
  assert.equal(assessProbe({error: {code: 'ETIMEDOUT'}}, nonce).status, 'timeout');
});
test('strict probe preserves unknown runtime failure instead of assuming activation failure', () => {
  assert.equal(assessProbe({status: 1, stderr: 'unknown failure'}, nonce).status, 'nonzero-exit');
});
test('strict probe rejects a successful wrapper banner without computation', () => {
  assert.equal(assessProbe({status: 0, stdout: 'WolframScript 15.0'}, nonce).available, false);
});
test('strict probe rejects malformed kernel JSON', () => {
  assert.equal(assessProbe({status: 0, stdout: 'NEURAL_ENGINE_WOLFRAM_PROBE:{'}, nonce).status,
    'invalid-kernel-json');
});
test('strict probe rejects stale evidence from another invocation', () => {
  assert.equal(assessProbe(okProbe({nonce: 'old'}), nonce).available, false);
});
test('strict probe requires arithmetic, derivative and linear solve checks', () => {
  for (const change of [{arithmetic: 5}, {symbolicDerivative: false}, {linearSolve: false}]) {
    assert.equal(assessProbe(okProbe(change), nonce).available, false);
  }
});
test('strict probe rejects an accidentally selected non-Wolfram interpreter banner', () => {
  assert.equal(assessProbe(okProbe({version: 'Mathics3 9.0'}), nonce).available, false);
});
test('strict probe accepts a matching complete synthetic evidence record', () => {
  assert.equal(assessProbe(okProbe(), nonce).available, true);
});
test('strict suite rejects zero-exit with missing TAP evidence', () => {
  assert.equal(assessSuite({status: 0, stdout: ''}).passed, false);
});
test('strict suite rejects a skipped live check despite zero exit', () => {
  const result = okSuite();
  result.stdout = result.stdout.replace('# skipped 0', '# skipped 1');
  assert.equal(assessSuite(result).passed, false);
});
test('strict suite requires both named live tests, not just aggregate success', () => {
  const result = okSuite();
  result.stdout = result.stdout.replace(names[1], 'a cached-file-only check');
  assert.equal(assessSuite(result).passed, false);
});
test('strict suite rejects contradictory duplicate summaries', () => {
  const result = okSuite();
  result.stdout += '# skipped 0\n';
  assert.equal(assessSuite(result).passed, false);
});
test('strict suite accepts complete unskipped synthetic test output', () => {
  assert.equal(assessSuite(okSuite()).passed, true);
});
test('strict suite process failure overrides apparently passing output', () => {
  assert.equal(assessSuite({...okSuite(), status: 1}).passed, false);
});
test('blocked kernel prevents running or trusting the existing test suite', () => {
  let calls = 0;
  const report = verifyWolfram({env: {}, nonce, spawn: () => {
    calls += 1;
    return {error: {code: 'ENOENT'}};
  }});
  assert.equal(calls, 1);
  assert.equal(report.status, 'blocked');
  assert.equal(report.verified, false);
  assert.equal(report.suite, null);
});
test('verified control flow requires a fresh probe and both live tests', () => {
  let calls = 0;
  const report = verifyWolfram({env: {}, nonce, spawn: () => ++calls === 1 ? okProbe() : okSuite()});
  assert.equal(calls, 2);
  assert.equal(report.status, 'verified');
});
test('a successful probe does not conceal skipped downstream Wolfram tests', () => {
  let calls = 0;
  const skipped = okSuite();
  skipped.stdout = skipped.stdout.replace(names[0], names[0] + ' # SKIP disconnected');
  const report = verifyWolfram({env: {}, nonce, spawn: () => ++calls === 1 ? okProbe() : skipped});
  assert.equal(report.status, 'failed');
  assert.equal(report.verified, false);
});
test('explicit kernel and library-preload configuration are preserved without a shell', () => {
  const env = {WOLFRAM_KERNEL_EXECUTABLE: '/fixture/WolframKernel', WOLFRAM_LD_PRELOAD: '/fixture/lib.so'};
  verifyWolfram({env, nonce, spawn: (exe, args, options) => {
    assert.equal(exe, env.WOLFRAM_KERNEL_EXECUTABLE);
    assert.deepEqual(args.slice(0, 2), ['-noprompt', '-run']);
    assert.equal(options.env.LD_PRELOAD, env.WOLFRAM_LD_PRELOAD);
    assert.equal(options.shell, false);
    return {error: {code: 'ENOENT'}};
  }});
  assert.equal(env.LD_PRELOAD, undefined);
});
test('actual CLI exits blocked for a nonexistent configured kernel', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync(process.execPath, ['scripts/verify-wolfram.js'], {cwd: root,
    env: {...process.env, WOLFRAM_KERNEL_EXECUTABLE: path.join(root, '__nonexistent_test_kernel__')},
    encoding: 'utf8', timeout: 10_000});
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'blocked');
  assert.equal(report.verified, false);
});
