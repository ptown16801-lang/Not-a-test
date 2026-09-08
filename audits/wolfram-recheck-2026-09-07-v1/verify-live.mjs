#!/usr/bin/env node
/** Additive, fail-closed orchestration. Node tests of this file do not verify Wolfram. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const VERSION = '1.0.0';
export const BASE_COMMIT = '557ce0553224a8299abecd98cf71be142ad90b35';
const MARKER = 'NEURAL_WOLFRAM_PROBE:';
const PROBE = 'Print["' + MARKER + '" <> ExportString[<|"kernel" -> $Version, "systemId" -> $SystemID, "arithmetic" -> (2 + 2), "linearSolveResidual" -> N[Norm[{{2, 1}, {1, 3}}.LinearSolve[{{2, 1}, {1, 3}}, {1, 2}] - {1, 2}]]|>, "RawJSON", "Compact" -> True]]';
const GATES = [
  {id: 'munit', script: 'mathematica/tests/RunTests.wls', outputEnv: 'SHRIKI_WOLFRAM_TEST_REPORT_OUTPUT'},
  {id: 'publication', script: 'mathematica/verification/PublicationDerivation.wls', outputEnv: 'SHRIKI_WOLFRAM_VALIDATION_OUTPUT'}
];
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const inside = (parent, child) => {const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));};
const ensure = (condition, message) => {if (!condition) throw new Error(message);};
const finiteBelow = (value, upper) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < upper;

/** Check individual outcomes, source hashes and numerical gates, not just allPassed. */
export function validateReport(id, report, hashes, kernel, startedAtMs) {
  ensure(report?.allPassed === true, 'allPassed must be true');
  ensure(report.kernel === kernel, 'kernel identity mismatch');
  const time = Date.parse(report.generatedAtUtc);
  ensure(Number.isFinite(time) && time >= startedAtMs - 1000 && time <= Date.now() + 1000, 'report is stale or has an invalid timestamp');
  if (id === 'munit') {
    ensure(report.schema === 'shriki-2016-wolfram-test-report/v1', 'MUnit schema mismatch');
    ensure(report.testCount === 31 && report.tests?.length === 31, 'expected 31 MUnit tests');
    ensure(report.tests.every(row => row.outcome === 'Success'), 'individual MUnit failure');
    ensure(report.tests.every(row => typeof row.testId === 'string') && new Set(report.tests.map(row => row.testId)).size === 31, 'duplicate or invalid test IDs');
    ensure(report.outcomeCounts?.Success === 31 && Object.keys(report.outcomeCounts).length === 1, 'MUnit outcome counts mismatch');
    for (const [field, file] of [
      ['testFileSha256', 'mathematica/tests/SynesthesiaModel.wlt'],
      ['runnerSha256', 'mathematica/tests/RunTests.wls'],
      ['modelSourceSha256', 'mathematica/SynesthesiaModel.wl']
    ]) ensure(typeof hashes[file] === 'string' && report[field] === hashes[file], 'source hash mismatch: ' + file);
  } else if (id === 'publication') {
    ensure(report.schema === 'shriki-2016-publication-verification/v2', 'publication schema mismatch');
    ensure(report.checkCount === 28 && report.checks?.length === 28, 'expected 28 publication checks');
    ensure(report.checks.every(row => row.pass === true), 'individual publication failure');
    ensure(report.checks.every(row => typeof row.name === 'string') && new Set(report.checks.map(row => row.name)).size === 28, 'duplicate or invalid check names');
    ensure(report.provenance?.projectModelImported === false, 'independent derivation imported project model');
    for (const [field, file] of [
      ['scriptSha256', 'mathematica/verification/PublicationDerivation.wls'],
      ['sourceManifestSha256', 'mathematica/verification/source-manifest.json']
    ]) ensure(typeof hashes[file] === 'string' && report.provenance[field] === hashes[file], 'source hash mismatch: ' + file);
    for (const [field, limit] of [
      ['fixedPointMaxAbsoluteResidual', 1e-12],
      ['susceptibilityFiniteDifferenceMaxAbsoluteError', 1e-8],
      ['objectiveGradientFiniteDifferenceMaxAbsoluteError', 2e-7],
      ['objectiveGradientFiniteDifferenceRelativeError', 2e-6]
    ]) ensure(finiteBelow(report.metrics?.[field], limit), 'numerical gate failed: ' + field);
    ensure(Number.isFinite(report.metrics.objectiveBeforeStep) && Number.isFinite(report.metrics.objectiveAfterStep) && report.metrics.objectiveAfterStep < report.metrics.objectiveBeforeStep, 'descent sign gate failed');
  } else throw new Error('unknown gate: ' + id);
  return true;
}

function inventory(root, directories = ['mathematica', 'assets']) {
  const hashes = {};
  function visit(relative) {
    const file = path.join(root, relative), stat = fs.lstatSync(file);
    ensure(!stat.isSymbolicLink(), 'refusing symlink in verification inputs: ' + relative);
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(relative, name));
    else if (stat.isFile()) hashes[relative.split(path.sep).join('/')] = digest(file);
    else throw new Error('refusing non-regular verification input: ' + relative);
  }
  for (const directory of directories) if (fs.existsSync(path.join(root, directory))) visit(directory);
  return hashes;
}

/** Always uses a new, external output directory and copies inputs before executing them. */
export function runVerification({repository, output, executable, directKernel = false, probeOnly = false, env = process.env, spawn = spawnSync}) {
  const root = fs.realpathSync(repository);
  const parent = fs.realpathSync(path.dirname(path.resolve(output)));
  const destination = path.join(parent, path.basename(path.resolve(output)));
  ensure(!inside(root, destination), 'output must be outside the source repository');
  fs.mkdirSync(destination); // Intentionally non-recursive: refuses every pre-existing run.
  const startedAt = new Date().toISOString();
  const summary = {schema: 'neural-engine-wolfram-live-gate/v1', runnerVersion: VERSION, targetBaseCommit: BASE_COMMIT, baseCommitVerifiedLocally: false, startedAtUtc: startedAt, mode: probeOnly ? 'runtime-probe-only' : 'two-live-gates', status: 'blocked', freshScientificValidation: false, gates: []};
  const runtime = executable || env.WOLFRAM_KERNEL_EXECUTABLE || 'wolframscript';
  const kernelMode = directKernel || (!executable && !!env.WOLFRAM_KERNEL_EXECUTABLE);
  const environment = {...env};
  if (env.WOLFRAM_LD_PRELOAD) environment.LD_PRELOAD = env.WOLFRAM_LD_PRELOAD;
  function invoke(name, args, workingDirectory, extraEnv, timeout) {
    const result = spawn(runtime, args, {cwd: workingDirectory, env: {...environment, ...extraEnv}, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024});
    fs.writeFileSync(path.join(destination, name + '.stdout.txt'), result.stdout ?? '', {flag: 'wx'});
    fs.writeFileSync(path.join(destination, name + '.stderr.txt'), result.stderr ?? '', {flag: 'wx'});
    const receipt = {executable: runtime, args, exitStatus: result.status ?? null, signal: result.signal ?? null, errorCode: result.error?.code ?? null, error: result.error?.message ?? null};
    writeJSON(path.join(destination, name + '.process.json'), receipt);
    return result;
  }
  try {
    const args = kernelMode ? ['-noprompt', '-run', PROBE + ';Exit[]'] : ['-code', PROBE];
    const probe = invoke('kernel-probe', args, destination, {}, 30000);
    ensure(!probe.error && probe.status === 0, 'live kernel evaluation unavailable; see kernel-probe logs');
    const line = (probe.stdout ?? '').split(/\r?\n/).find(line => line.startsWith(MARKER));
    ensure(line, 'live kernel probe returned no structured result');
    const identity = JSON.parse(line.slice(MARKER.length));
    ensure(typeof identity.kernel === 'string' && identity.kernel.length > 0 && typeof identity.systemId === 'string' && identity.systemId.length > 0 && identity.arithmetic === 4 && finiteBelow(identity.linearSolveResidual, 1e-12), 'kernel arithmetic/linear-solve/identity check failed');
    summary.kernel = identity;
    if (probeOnly) {summary.status = 'runtime-ready-unverified'; return summary;}
    summary.status = 'failed';
    const hashes = inventory(root);
    const required = [...GATES.map(gate => gate.script), 'mathematica/tests/SynesthesiaModel.wlt', 'mathematica/SynesthesiaModel.wl', 'mathematica/verification/source-manifest.json'];
    ensure(required.every(file => typeof hashes[file] === 'string'), 'source checkout is incomplete');
    writeJSON(path.join(destination, 'input-sha256.json'), hashes);
    const snapshot = path.join(destination, 'snapshot');
    fs.mkdirSync(snapshot);
    for (const directory of ['mathematica', 'assets']) if (fs.existsSync(path.join(root, directory))) fs.cpSync(path.join(root, directory), path.join(snapshot, directory), {recursive: true, errorOnExist: true, force: false});
    ensure(JSON.stringify(inventory(snapshot)) === JSON.stringify(hashes), 'snapshot copy integrity mismatch');
    for (const gate of GATES) {
      const reportPath = path.join(destination, gate.id + '.json');
      const begin = Date.now();
      const args = [kernelMode ? '-script' : '-file', path.join(snapshot, gate.script)];
      const result = invoke(gate.id, args, snapshot, {[gate.outputEnv]: reportPath}, 600000);
      try {
        ensure(!result.error && result.status === 0, 'Wolfram process did not succeed');
        ensure(fs.existsSync(reportPath), 'no fresh report was produced');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        validateReport(gate.id, report, hashes, identity.kernel, begin);
        summary.gates.push({id: gate.id, status: 'passed', report: gate.id + '.json', sha256: digest(reportPath)});
      } catch (error) {summary.gates.push({id: gate.id, status: 'failed', reason: error.message});}
    }
    summary.originalInputsUnchanged = JSON.stringify(inventory(root)) === JSON.stringify(hashes);
    ensure(summary.originalInputsUnchanged, 'original input fingerprint changed during run');
    if (summary.gates.length === 2 && summary.gates.every(gate => gate.status === 'passed')) {
      summary.status = 'passed'; summary.freshScientificValidation = true;
    }
  } catch (error) {summary.reason = error.message;}
  finally {summary.finishedAtUtc = new Date().toISOString(); writeJSON(path.join(destination, 'summary.json'), summary);}
  return summary;
}

function main() {
  const args = process.argv.slice(2), values = {};
  for (const arg of args) {
    if (arg === '--probe-only') values.probeOnly = true;
    else if (arg === '--direct-kernel') values.directKernel = true;
    else {
      const match = /^--(repository|output|executable)=(.+)$/.exec(arg);
      ensure(match, 'usage: node verify-live.mjs --repository=/path/to/repo --output=/existing/parent/NEW-run [--executable=/path/to/kernel --direct-kernel] [--probe-only]');
      values[match[1]] = match[2];
    }
  }
  ensure(values.repository && values.output, '--repository and --output are required');
  const result = runVerification(values);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {main();} catch (error) {console.error(error.message); process.exitCode = 1;}
}
