import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(repository, relative), 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('project-wide JSON log is internally consistent and covers every subsystem', () => {
  const log = readJson('PROJECT_LOG.json');
  const packageMetadata = readJson('package.json');
  assert.equal(log.schema, 'neural-engine-project-log/v2');
  assert.equal(log.scope, 'entire-repository');
  assert.equal(log.project.version, packageMetadata.version);
  assert.equal(log.snapshot.commitCount, log.history.length);
  assert.equal(log.history[0].commit, log.snapshot.historyStartsAtCommit);
  assert.equal(log.history.at(-1).commit, log.snapshot.historyThroughCommit);
  assert.equal(log.snapshot.worktreeBaseCommit, log.snapshot.historyThroughCommit);
  assert.equal(new Set(log.history.map(entry => entry.commit)).size, log.history.length);
  assert.equal(log.snapshot.fileCount, log.files.length);
  assert.equal(new Set(log.files.map(entry => entry.path)).size, log.files.length);
  assert.ok(log.snapshot.exclusions.some(row => row.path === 'PROJECT_LOG.json'));
  for (const required of [
    'shape-cognition', 'neural-synesthesia-javascript', 'wolfram-reconstruction',
    'text-perception', 'sensory-inputs', 'synesthetic-geometry', 'dirt-inscription',
    'identity-and-steganography', 'gateway-and-deployment', 'moltbook',
    'environment-motion', 'browser-demo'
  ]) assert.ok(log.subsystems.some(subsystem => subsystem.id === required), required);
});

test('project-wide JSON log hashes every indexed repository artifact', () => {
  const log = readJson('PROJECT_LOG.json');
  for (const entry of log.files) {
    const bytes = fs.readFileSync(path.join(repository, entry.path));
    assert.equal(bytes.length, entry.bytes, `${entry.path} byte count`);
    assert.equal(digest(bytes), entry.sha256, `${entry.path} SHA-256`);
  }
  const payload = log.files.map(entry =>
    `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`).join('');
  assert.equal(digest(payload), log.snapshot.aggregateSha256);
  const generator = fs.readFileSync(path.join(repository, log.generation.generator));
  assert.equal(digest(generator), log.generation.generatorSha256);
});

test('project-wide JSON log indexes every repository JSON artifact except itself', () => {
  const log = readJson('PROJECT_LOG.json');
  const grouped = new Set(Object.values(log.jsonArtifacts).flat());
  const indexed = new Set(log.jsonArtifactIndex.map(entry => entry.path));
  const fromManifest = new Set(log.files.filter(entry => entry.path.endsWith('.json'))
    .map(entry => entry.path));
  assert.deepEqual(indexed, fromManifest);
  assert.deepEqual(grouped, fromManifest);
  for (const entry of log.jsonArtifactIndex) {
    assert.equal(entry.validJson, true, entry.path);
    assert.doesNotThrow(() => readJson(entry.path), `invalid indexed JSON: ${entry.path}`);
    assert.equal(entry.sha256,
      log.files.find(file => file.path === entry.path).sha256, entry.path);
  }
  assert.ok(indexed.has('docs/scientific-source-ledger.json'));
  assert.ok(indexed.has('docs/scientific-claim-audit.json'));
  assert.ok(indexed.has('mathematica/benchmark-results/benchmark-qualification.json'));
  assert.ok(indexed.has('mathematica/verification/results/wolfram-test-report.json'));
});

test('project-wide JSON log preserves the measured scientific gates', () => {
  const log = readJson('PROJECT_LOG.json');
  const validation = readJson('mathematica/verification/results/wolfram-validation.json');
  const sensitivity = readJson('mathematica/verification/results/numerical-policy-sensitivity.json');
  const scaling = readJson('mathematica/benchmark-results/scaling-summary.json');
  const claims = readJson('docs/scientific-claim-audit.json');
  assert.equal(validation.allPassed, true);
  assert.equal(log.validationSnapshot.independentPublicationDerivation.checks,
    validation.checkCount);
  assert.equal(log.validationSnapshot.independentPublicationDerivation
    .objectiveGradientFiniteDifferenceMaxAbsoluteError,
  validation.metrics.objectiveGradientFiniteDifferenceMaxAbsoluteError);
  assert.equal(log.validationSnapshot.numericalPolicySensitivity.settlingPolicyCases,
    sensitivity.settlingPolicies.length);
  assert.equal(log.validationSnapshot.numericalPolicySensitivity.initializationCases,
    sensitivity.initializationConditions.length);
  assert.equal(log.scalingSnapshot.evidenceBoundaries.largestOneOrTwoUpdateOutputNeurons,
    scaling.observedBoundaries.largestCurrentExactExecutionNeurons);
  assert.deepEqual(log.scalingSnapshot.requestedProjectFamilyLadder,
    scaling.currentRequestedLadder.map(row => row.totalNeurons));
  assert.equal(log.scalingSnapshot.evidenceBoundaries.sustainedPracticalLimitMeasured,
    false);
  assert.equal(log.scientificAuditSnapshot.claimCount, claims.summary.claimCount);
  assert.equal(log.scientificAuditSnapshot.centralConclusion,
    claims.summary.centralConclusion);
});

test('archived whole-project Node test log is linked when present', () => {
  const log = readJson('PROJECT_LOG.json');
  const relative = 'verification/results/node-test-report.json';
  if (!fs.existsSync(path.join(repository, relative))) {
    assert.equal(log.validationSnapshot.node.allPassed, null);
    return;
  }
  const report = readJson(relative);
  assert.equal(report.schema, 'neural-engine-node-test-report/v1');
  assert.equal(report.allPassed, true);
  assert.equal(log.validationSnapshot.node.source, relative);
  assert.equal(log.validationSnapshot.node.tests, report.summary.tests);
  assert.equal(log.validationSnapshot.node.passed, report.summary.passed);
  assert.equal(log.validationSnapshot.node.failed, 0);
});
