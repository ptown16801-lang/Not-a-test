import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logPath = path.join(root,
  'mathematica/verification/results/javascript-adversarial-validation.json');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const fileDigest = relative => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, relative))).digest('hex');

test('archived JavaScript scientific validation passed against current source', () => {
  const report = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const source = fs.readFileSync(path.join(root, report.source.path));
  assert.equal(report.schema,
    'shriki-2016-javascript-adversarial-validation/v1');
  assert.equal(report.source.sha256,
    crypto.createHash('sha256').update(source).digest('hex'));
  assert.equal(report.allPassed, true);
  assert.equal(report.crossLanguage.pass, true);
  assert.ok(report.finiteDifferences.length >= 6);
  assert.ok(report.finiteDifferences.every(row => row.pass));
  assert.equal(report.falseConvergence.pass, true);
  assert.equal(report.fixedPointVersusStability.pass, true);
  assert.equal(report.numericalScale.pass, true);
  assert.equal(report.serialization.pass, true);
});

test('all machine-readable scientific claims cite an indexed primary or official source', () => {
  const ledger = readJson('docs/scientific-source-ledger.json');
  const audit = readJson('docs/scientific-claim-audit.json');
  assert.equal(ledger.schema, 'shriki-2016-scientific-source-ledger/v1');
  assert.equal(audit.schema, 'shriki-2016-scientific-claim-audit/v1');
  const sourceIds = new Set(ledger.sources.map(source => source.id));
  assert.equal(sourceIds.size, ledger.sources.length);
  assert.ok(ledger.sources.length >= 20);
  assert.ok(ledger.sources.every(source =>
    source.type.includes('publication') || source.type.includes('documentation') ||
    source.type === 'primary-preprint' || source.type.includes('supporting-information')));
  for (const claim of audit.claims) {
    for (const sourceId of claim.sourceIds) {
      assert.ok(sourceIds.has(sourceId), `${claim.id} cites unknown source ${sourceId}`);
    }
    for (const evidence of claim.projectEvidence) {
      assert.ok(fs.existsSync(path.join(root, evidence)), `${claim.id} evidence: ${evidence}`);
    }
  }
  const verifiedOrScoped = audit.claims.filter(claim =>
    claim.status === 'verified' || claim.status === 'verified-with-scope').length;
  const count = status => audit.claims.filter(claim => claim.status === status).length;
  assert.equal(audit.summary.claimCount, audit.claims.length);
  assert.equal(audit.summary.verifiedOrScoped, verifiedOrScoped);
  assert.equal(audit.summary.projectChoice, count('project-choice'));
  assert.equal(audit.summary.unresolved, count('unresolved'));
  assert.equal(audit.summary.rejected, count('rejected'));
  assert.equal(audit.summary.prospective, count('prospective'));
});

test('Wolfram scientific reports are passing and fingerprint current executable sources', () => {
  const publication = readJson('mathematica/verification/results/wolfram-validation.json');
  const repeated = readJson('mathematica/verification/results/repeated-validation.json');
  const munit = readJson('mathematica/verification/results/wolfram-test-report.json');
  assert.equal(publication.allPassed, true);
  assert.equal(publication.checkCount, 28);
  assert.equal(publication.provenance.projectModelImported, false);
  assert.equal(publication.provenance.scriptSha256,
    fileDigest(publication.provenance.script));
  assert.equal(publication.provenance.sourceManifestSha256,
    fileDigest(publication.provenance.sourceManifest));
  assert.equal(repeated.allPassed, true);
  assert.equal(repeated.randomFixtureCount, 9);
  assert.equal(repeated.provenance.scriptSha256,
    fileDigest(repeated.provenance.script));
  assert.equal(repeated.provenance.modelSourceSha256,
    fileDigest(repeated.provenance.modelSource));
  assert.equal(munit.allPassed, true);
  assert.equal(munit.testCount, 31);
  assert.equal(munit.modelSourceSha256, fileDigest(munit.modelSource));
  assert.equal(munit.testFileSha256, fileDigest(munit.testFile));
  assert.equal(munit.runnerSha256,
    fileDigest('mathematica/tests/RunTests.wls'));
});

test('every current benchmark is source-qualified and every aggregate input hash matches', () => {
  const summary = readJson('mathematica/benchmark-results/scaling-summary.json');
  const qualification = readJson(
    'mathematica/benchmark-results/benchmark-qualification.json');
  for (const [file, expected] of Object.entries(summary.provenance.inputFiles)) {
    assert.equal(fileDigest(`mathematica/benchmark-results/${file}`), expected, file);
  }
  assert.equal(fileDigest('mathematica/ExactBenchmarkPoint.wls'),
    summary.provenance.qualifiedBenchmarkScriptSha256);
  assert.equal(fileDigest('mathematica/SynesthesiaModel.wl'),
    summary.provenance.qualifiedModelSourceSha256);
  assert.equal(fileDigest('mathematica/CriticalSlowingBenchmark.wls'),
    summary.provenance.qualifiedCriticalScriptSha256);
  const current = qualification.runs.filter(row =>
    row.cohort === 'current' || row.cohort === 'current-farther');
  assert.equal(current.length, 10);
  assert.ok(current.every(row => row.status === 'current-qualified'));
  assert.ok(current.every(row => Object.values(row.checks).every(Boolean)));
});
