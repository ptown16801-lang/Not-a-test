/** Strict local Wolfram verification. No installed-wrapper or cached-report fallback. */
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'NEURAL_ENGINE_WOLFRAM_PROBE:';
const liveTests = [
  'MUnit suite passes when a licensed Wolfram runtime is available',
  'independent Wolfram publication verification executes when a licensed runtime is available'
];

function processFailure(result) {
  if (result.error) return result.error.code === 'ENOENT' ? 'executable-not-found'
    : result.error.code === 'ETIMEDOUT' ? 'timeout' : 'process-error';
  if (result.signal) return 'process-signalled';
  return result.status === 0 ? null : 'nonzero-exit';
}

/** Verify fresh structured output, not an executable's version banner. */
export function assessProbe(result, nonce) {
  const failure = processFailure(result);
  if (failure) return {status: failure, available: false};
  const text = String(result.stdout ?? '');
  const start = text.lastIndexOf(marker);
  if (start < 0) return {status: 'missing-kernel-evidence', available: false};
  try {
    // JSON may span lines; the wrapper must not append unexplained non-whitespace.
    const evidence = JSON.parse(text.slice(start + marker.length).trim());
    const available = evidence.nonce === nonce && evidence.arithmetic === 4
      && evidence.symbolicDerivative === true && evidence.linearSolve === true
      && typeof evidence.version === 'string' && /^\d+\.\d+/.test(evidence.version)
      && typeof evidence.systemID === 'string' && evidence.systemID.length > 0;
    return {status: available ? 'available' : 'invalid-kernel-evidence', available, evidence};
  } catch {
    return {status: 'invalid-kernel-json', available: false};
  }
}

/** Node may exit zero with live Wolfram tests skipped: reject that explicitly. */
export function assessSuite(result) {
  const failure = processFailure(result);
  if (failure) return {status: failure, passed: false};
  const text = String(result.stdout ?? '').replace(/\r\n/g, '\n');
  const summary = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))];
    summary[key] = matches.length === 1 ? Number(matches[0][1]) : null;
  }
  const live = liveTests.map(name => ({name, passed: text.split('\n').some(line =>
    /^ok \d+ - /.test(line) && line.slice(line.indexOf(' - ') + 3) === name)}));
  const passed = summary.tests > 0 && summary.pass === summary.tests
    && ['fail', 'cancelled', 'skipped', 'todo'].every(key => summary[key] === 0)
    && live.every(entry => entry.passed);
  return {status: passed ? 'passed' : 'incomplete-or-skipped', passed, summary, live};
}

/** Spawn is injectable only for unit tests; the CLI always uses real subprocesses. */
export function verifyWolfram({cwd = repository, env = process.env, spawn = spawnSync,
  nonce = randomUUID()} = {}) {
  const environment = {...env};
  if (env.WOLFRAM_LD_PRELOAD) environment.LD_PRELOAD = env.WOLFRAM_LD_PRELOAD;
  const executable = env.WOLFRAM_KERNEL_EXECUTABLE || 'wolframscript';
  const code = `Print["${marker}" <> ExportString[<|"nonce" -> "${nonce}", `
    + '"arithmetic" -> (2+2), "version" -> $Version, "systemID" -> $SystemID, '
    + '"symbolicDerivative" -> TrueQ[Simplify[D[1/(1+Exp[-x]),x] == '
    + '(1/(1+Exp[-x]))(1-1/(1+Exp[-x]))]], '
    + '"linearSolve" -> TrueQ[{{2,1},{1,3}}.LinearSolve[{{2,1},{1,3}},{1,2}] == {1,2}]'
    + '|>,"RawJSON"]];Exit[0]';
  const args = env.WOLFRAM_KERNEL_EXECUTABLE
    ? ['-noprompt', '-run', code] : ['-code', code];
  const probeProcess = spawn(executable, args, {cwd, env: environment, encoding: 'utf8',
    timeout: 30_000, maxBuffer: 2 * 1024 * 1024, shell: false});
  const probe = assessProbe(probeProcess, nonce);
  const report = {schema: 'neural-engine-strict-wolfram-verification/v1',
    checkedAtUtc: new Date().toISOString(), status: 'blocked', verified: false,
    scope: 'Fresh local kernel probe plus existing Mathematica Node/MUnit/publication-derivation gates; not all experiments.',
    executable, probe, suite: null,
    diagnostics: {probeExitCode: probeProcess.status ?? null,
      probeErrorCode: probeProcess.error?.code ?? null,
      probeStderr: String(probeProcess.stderr ?? '').slice(0, 4096)}};
  if (!probe.available) return report;
  const suiteProcess = spawn(process.execPath,
    ['--test', '--test-reporter=tap', 'test/mathematica-rewrite.test.js'],
    {cwd, env: environment, encoding: 'utf8', timeout: 900_000,
      maxBuffer: 32 * 1024 * 1024, shell: false});
  report.suite = assessSuite(suiteProcess);
  report.suite.stdout = String(suiteProcess.stdout ?? '');
  report.suite.stderr = String(suiteProcess.stderr ?? '').slice(0, 4096);
  report.verified = report.suite.passed;
  report.status = report.verified ? 'verified' : 'failed';
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && !(args.length === 2 && args[0] === '--output' && args[1])) {
      throw new Error('Usage: node scripts/verify-wolfram.js [--output report.json]');
    }
    const report = verifyWolfram();
    const json = JSON.stringify(report, null, 2) + '\n';
    if (args.length) fs.writeFileSync(path.resolve(args[1]), json, {flag: 'wx'});
    process.stdout.write(json);
    process.exitCode = report.verified ? 0 : report.status === 'blocked' ? 2 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
