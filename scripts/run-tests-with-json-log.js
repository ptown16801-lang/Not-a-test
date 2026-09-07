#!/usr/bin/env node

import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredOutput = process.env.NEURAL_NODE_TEST_REPORT_OUTPUT;
const output = configuredOutput
  ? path.resolve(root, configuredOutput)
  : path.join(root, 'verification', 'results', 'node-test-report.json');
const testFiles = fs.readdirSync(path.join(root, 'test'))
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => `test/${name}`);
const started = process.hrtime.bigint();
const result = spawnSync(process.execPath,
  ['--test', '--test-reporter=tap', ...testFiles], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 64 * 1024 * 1024,
  timeout: 20 * 60 * 1000
});
const elapsedSeconds = Number(process.hrtime.bigint() - started) / 1e9;
const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';
const integerMetric = name => {
  const match = stdout.match(new RegExp(`^# ${name} (\\d+)$`, 'm'));
  return match ? Number(match[1]) : null;
};
const testSources = testFiles.map(relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return {
      path: relative,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });
const summary = {
  tests: integerMetric('tests'),
  suites: integerMetric('suites'),
  passed: integerMetric('pass'),
  failed: integerMetric('fail'),
  cancelled: integerMetric('cancelled'),
  skipped: integerMetric('skipped'),
  todo: integerMetric('todo')
};
const exitCode = result.status ?? null;
const report = {
  schema: 'neural-engine-node-test-report/v1',
  generatedAtUtc: new Date().toISOString(),
  command: 'node --test --test-reporter=tap test/*.test.js (expanded in lexical order)',
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    wolframKernelExecutable: process.env.WOLFRAM_KERNEL_EXECUTABLE ?? null,
    wolframRuntimeRequested: Boolean(process.env.WOLFRAM_KERNEL_EXECUTABLE)
  },
  elapsedSeconds,
  exitCode,
  signal: result.signal ?? null,
  spawnError: result.error ? String(result.error.message ?? result.error) : null,
  summary,
  allPassed: exitCode === 0 && summary.failed === 0,
  fullyExecuted: exitCode === 0 && summary.failed === 0 && summary.skipped === 0,
  testSources,
  stdoutSha256: crypto.createHash('sha256').update(stdout).digest('hex'),
  stderrSha256: crypto.createHash('sha256').update(stderr).digest('hex'),
  stdout,
  stderr
};
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({output: path.relative(root, output),
  exitCode, elapsedSeconds, summary})}\n`);
if (!report.allPassed) process.exitCode = exitCode || 1;
