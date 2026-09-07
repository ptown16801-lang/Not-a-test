#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRelative = 'MASTER_PROJECT.json';
const outputPath = path.join(root, outputRelative);
const generatorRelative = 'scripts/generate-master-project.js';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

const excludedJson = new Set([outputRelative]);
const jsonPaths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
  .filter(relative => relative.endsWith('.json') && !excludedJson.has(relative))
  .sort();

const artifacts = jsonPaths.map(relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  const content = JSON.parse(bytes.toString('utf8'));
  return {
    path: relative,
    bytes: bytes.length,
    sha256: sha256(bytes),
    schema: typeof content?.schema === 'string' ? content.schema : null,
    content
  };
});
const artifactDigestPayload = artifacts.map(artifact =>
  `${artifact.path}\0${artifact.bytes}\0${artifact.sha256}\n`).join('');

const packageMetadata = readJson('package.json');
const claims = readJson('docs/scientific-claim-audit.json');
const sources = readJson('docs/scientific-source-ledger.json');
const publication = readJson('mathematica/verification/results/wolfram-validation.json');
const repeated = readJson('mathematica/verification/results/repeated-validation.json');
const javascript = readJson(
  'mathematica/verification/results/javascript-adversarial-validation.json');
const munit = readJson('mathematica/verification/results/wolfram-test-report.json');
const policy = readJson(
  'mathematica/verification/results/numerical-policy-sensitivity.json');
const scaling = readJson('mathematica/benchmark-results/scaling-summary.json');
const nodeReport = readJson('verification/results/node-test-report.json');
const releaseNodeReportPath = 'verification/results/node-test-report-v0.8.0.json';
const releaseNodeReport = fs.existsSync(path.join(root, releaseNodeReportPath))
  ? readJson(releaseNodeReportPath) : null;
const critical = readJson('mathematica/benchmark-results/critical-slowing-142.json');
const criticalWorst = critical.results.at(-1);

const master = {
  schema: 'neural-engine-master-project/v1',
  scope: 'all-project-json-artifacts-and-release-evidence',
  generatedAtUtc: new Date().toISOString(),
  project: {
    name: 'Shape Cognition Prototype / Neural Engine',
    package: packageMetadata.name,
    version: packageMetadata.version,
    repository: 'https://github.com/ptown16801-lang/Not-a-test',
    branch: git(['branch', '--show-current']),
    baseCommit: git(['rev-parse', 'HEAD']),
    contentSnapshotIncludesWorkingTree: true
  },
  release: {
    version: packageMetadata.version,
    releaseNotes: 'RELEASE.md',
    changelog: 'CHANGELOG.md',
    publicationAuditPdf: 'output/pdf/shriki-2016-publication-grade-audit.pdf',
    wholeRepositoryManifest: 'PROJECT_LOG.json',
    masterAggregate: outputRelative
  },
  scientificAuthority: {
    targetPaper: 'https://doi.org/10.1371/journal.pcbi.1004959',
    supportingAppendix: 'https://doi.org/10.1371/journal.pcbi.1004959.s001',
    sourceLedger: 'docs/scientific-source-ledger.json',
    indexedSources: sources.sources.length,
    claimAudit: 'docs/scientific-claim-audit.json',
    claimCount: claims.summary.claimCount,
    centralConclusion: claims.summary.centralConclusion
  },
  validationSummary: {
    node: {
      allPassed: nodeReport.allPassed,
      ...nodeReport.summary,
      source: 'verification/results/node-test-report.json'
    },
    currentReleaseNode: releaseNodeReport ? {
      allPassed: releaseNodeReport.allPassed,
      fullyExecuted: releaseNodeReport.fullyExecuted,
      ...releaseNodeReport.summary,
      source: releaseNodeReportPath,
      note: releaseNodeReport.fullyExecuted ?
        'All current release tests executed.' :
        'The reconnect worker lacked Wolfram; live-kernel gates were skipped here and remain covered by the licensed-worker report.'
    } : null,
    independentWolfram: {
      allPassed: publication.allPassed,
      checks: publication.checkCount,
      fixedPointMaxAbsoluteResidual: publication.metrics.fixedPointMaxAbsoluteResidual,
      susceptibilityFiniteDifferenceMaxAbsoluteError:
        publication.metrics.susceptibilityFiniteDifferenceMaxAbsoluteError,
      objectiveGradientFiniteDifferenceMaxAbsoluteError:
        publication.metrics.objectiveGradientFiniteDifferenceMaxAbsoluteError,
      objectiveGradientFiniteDifferenceRelativeError:
        publication.metrics.objectiveGradientFiniteDifferenceRelativeError
    },
    repeatedWolfram: {
      allPassed: repeated.allPassed,
      fixtures: repeated.randomFixtureCount,
      ...repeated.summary
    },
    javascriptAdversarial: {
      allPassed: javascript.allPassed,
      ...javascript.summary
    },
    wolframMUnit: {
      allPassed: munit.allPassed,
      tests: munit.testCount,
      passed: munit.outcomeCounts.Success ?? 0,
      kernel: munit.kernel
    },
    numericalPolicy: {
      allPassed: policy.allPassed,
      settlingPolicyCases: policy.settlingPolicies.length,
      initializationCases: policy.initializationConditions.length,
      ...policy.summary
    }
  },
  scalingSummary: {
    paperSpecifiedOutputNeurons: scaling.claimPolicy.paperSpecifiedNetworkSize,
    requestedProjectFamilyLadder:
      scaling.currentRequestedLadder.map(row => row.totalNeurons),
    sustainedReference: scaling.current142,
    largestUniformTenUpdateOutputNeurons:
      Math.max(...scaling.empiricalScaling.uniformTenUpdateSizes),
    largestOneOrTwoUpdateOutputNeurons:
      scaling.observedBoundaries.largestCurrentExactExecutionNeurons,
    fixedWindowLogLogExponent:
      scaling.empiricalScaling.uniformTenUpdateLogLogExponent,
    sustainedPracticalLimitMeasured:
      scaling.claimPolicy.practicalLimitInferenceAllowed,
    controlledSpeedupRelativeToAuthorsComputable:
      scaling.claimPolicy.controlledSpeedupRelativeToAuthorsComputable,
    worstCriticalCase: {
      rho: criticalWorst.rho,
      iterations: criticalWorst.iterations,
      seconds: criticalWorst.seconds,
      fixedPointResidual: criticalWorst.fixedPointResidual,
      stateErrorFromKnownFixedPoint: criticalWorst.stateErrorFromKnownFixedPoint,
      exactStateGradientRelativeError:
        criticalWorst.numericExactStateGradientRelativeFrobeniusError,
      policySettledGradientRelativeError:
        criticalWorst.policySettledGradientRelativeFrobeniusErrorVsExact
    }
  },
  artifactAggregation: {
    artifactCount: artifacts.length,
    aggregateSha256: sha256(artifactDigestPayload),
    ordering: 'UTF-8 path lexical order',
    digestRecord: 'path NUL byte-count NUL sha256 LF',
    exclusions: [
      {path: outputRelative, reason: 'Excluded to avoid self-reference.'}
    ],
    generator: generatorRelative,
    generatorSha256: sha256(fs.readFileSync(path.join(root, generatorRelative)))
  },
  artifacts
};

fs.writeFileSync(outputPath, `${JSON.stringify(master, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  output: outputRelative,
  version: master.project.version,
  artifactCount: artifacts.length,
  aggregateSha256: master.artifactAggregation.aggregateSha256
})}\n`);
