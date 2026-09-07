#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'PROJECT_LOG.json');
const generatorPath = fileURLToPath(import.meta.url);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const exists = relative => fs.existsSync(path.join(root, relative));
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const relativeGenerator = path.relative(root, generatorPath).split(path.sep).join('/');

const excluded = [
  {path: '.git/', reason: 'Git object database and local metadata are represented by commit history, not copied into the content manifest.'},
  {path: 'ignored files', reason: 'Credentials, dependencies, coverage, and local runtime outputs are excluded by .gitignore.'},
  {path: 'PROJECT_LOG.json', reason: 'The manifest excludes itself to avoid an impossible self-referential SHA-256 fixed point.'},
  {path: 'MASTER_PROJECT.json', reason: 'The master aggregate embeds this manifest and is generated after it; excluding the aggregate prevents a circular digest dependency.'},
  {path: 'tmp/', reason: 'Ephemeral render and diagnostic files are not project artifacts.'}
];

const listed = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
  .filter(relative => relative !== 'PROJECT_LOG.json' &&
    relative !== 'MASTER_PROJECT.json' && !relative.startsWith('tmp/'))
  .sort();

function category(relative) {
  if (relative.startsWith('mathematica/benchmark-results/')) return 'benchmark';
  if (relative.startsWith('mathematica/verification/')) return 'scientific-validation';
  if (relative.startsWith('verification/results/')) return 'scientific-validation';
  if (relative === 'mathematica/paper-spec.json' ||
      relative.startsWith('docs/scientific-')) return 'scientific-audit';
  if (relative.startsWith('mathematica/')) return 'wolfram-source';
  if (relative.startsWith('src/')) return 'application-source';
  if (relative.startsWith('test/')) return 'test-source';
  if (relative.startsWith('scripts/')) return 'reproducibility-tooling';
  if (relative.startsWith('docs/') || relative === 'README.md' ||
      relative === 'CHANGELOG.md' || relative === 'RELEASE.md') return 'documentation';
  if (relative.startsWith('output/')) return 'publication-output';
  if (relative.startsWith('assets/')) return 'asset';
  if (relative.startsWith('demo/')) return 'demo';
  if (relative.endsWith('.json') || relative.endsWith('.yaml') ||
      relative.endsWith('.yml')) return 'configuration-or-data';
  return 'project-infrastructure';
}

const files = listed.map(relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  return {path: relative, bytes: bytes.length, sha256: sha256(bytes),
    category: category(relative)};
});
const aggregatePayload = files.map(file =>
  `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('');

const history = git(['log', '--reverse',
  '--format=%H%x09%aI%x09%an%x09%ae%x09%s']).split('\n').filter(Boolean).map(line => {
  const [commit, authoredAt, authorName, authorEmail, ...subject] = line.split('\t');
  return {commit, authoredAt, authorName, authorEmail, subject: subject.join('\t')};
});
const head = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']);
const rawStatus = git(['status', '--porcelain=v1', '--untracked-files=all'])
  .split('\n').filter(Boolean)
  .filter(line => !line.endsWith(' PROJECT_LOG.json'));

const jsonPaths = files.filter(file => file.path.endsWith('.json')).map(file => file.path);
const jsonIndex = jsonPaths.map(relative => {
  const value = readJson(relative);
  const file = files.find(item => item.path === relative);
  return {
    path: relative,
    sha256: file.sha256,
    bytes: file.bytes,
    schema: typeof value?.schema === 'string' ? value.schema : null,
    generatedAtUtc: value?.generatedAtUtc ?? value?.generatedUtc ?? null,
    validJson: true
  };
});

const scientificAudits = jsonPaths.filter(relative =>
  relative.startsWith('docs/scientific-'));
const scientificSpecifications = jsonPaths.filter(relative =>
  relative === 'mathematica/paper-spec.json' ||
  relative === 'mathematica/verification/source-manifest.json');
const scientificValidationLogs = jsonPaths.filter(relative =>
  relative.startsWith('mathematica/verification/results/') ||
  relative.startsWith('verification/results/'));
const benchmarkLogs = jsonPaths.filter(relative =>
  relative.startsWith('mathematica/benchmark-results/'));
const projectFixtures = jsonPaths.filter(relative =>
  (relative.startsWith('assets/') || relative.startsWith('demo/')) &&
  !scientificValidationLogs.includes(relative) && !benchmarkLogs.includes(relative));
const knownJson = new Set([...scientificAudits, ...scientificSpecifications,
  ...scientificValidationLogs, ...benchmarkLogs, ...projectFixtures]);

const publication = readJson('mathematica/verification/results/wolfram-validation.json');
const repeated = readJson('mathematica/verification/results/repeated-validation.json');
const javascript = readJson(
  'mathematica/verification/results/javascript-adversarial-validation.json');
const policy = readJson(
  'mathematica/verification/results/numerical-policy-sensitivity.json');
const munit = readJson('mathematica/verification/results/wolfram-test-report.json');
const scaling = readJson('mathematica/benchmark-results/scaling-summary.json');
const qualification = readJson(
  'mathematica/benchmark-results/benchmark-qualification.json');
const critical = readJson('mathematica/benchmark-results/critical-slowing-142.json');
const environment = readJson('mathematica/benchmark-results/environment.json');
const sourceLedger = readJson('docs/scientific-source-ledger.json');
const claimAudit = readJson('docs/scientific-claim-audit.json');
const packageMetadata = readJson('package.json');
const nodeReport = exists('verification/results/node-test-report.json')
  ? readJson('verification/results/node-test-report.json') : null;
const releaseNodeReportPath = 'verification/results/node-test-report-v0.8.0.json';
const releaseNodeReport = exists(releaseNodeReportPath)
  ? readJson(releaseNodeReportPath) : null;
const currentQualifications = qualification.runs.filter(row =>
  row.cohort === 'current' || row.cohort === 'current-farther');
const lastCritical = critical.results.at(-1);

const subsystemDefinitions = [
  ['shape-cognition', 'Immutable content-addressed thought geometry and deterministic operator DAG.', ['src/engine.js', 'src/types.js']],
  ['neural-synesthesia-javascript', 'JavaScript recurrent-infomax reference, training, and checkpoint interoperability.', ['src/neural-synesthesia.js', 'test/neural-synesthesia.test.js']],
  ['wolfram-reconstruction', 'Independent publication derivation, Wolfram model, figures, tests, and benchmarks.', ['mathematica/']],
  ['text-perception', 'Deterministic text-to-perception feature mapping and neural bridge.', ['src/text-perception.js', 'src/text-neural-bridge.js']],
  ['sensory-inputs', 'Optional bounded thermal and PCM sound encoders.', ['src/sensory-encoders.js', 'src/sensory-art.js']],
  ['synesthetic-geometry', 'Neural response to contours, weave paths, and visual motifs.', ['src/synesthetic-geometry.js', 'src/neural-shape-bridge.js']],
  ['dirt-inscription', 'Physical tram-line plan and deterministic soil rendering.', ['src/dirt-renderer.js', 'src/dirt-texture.js']],
  ['identity-and-steganography', 'Thought/agent identity carriers, integrity checks, and watermarking.', ['src/stego.js']],
  ['gateway-and-deployment', 'Validated intake, signed receipts, gallery, server configuration, and containers.', ['src/thought-gateway.js', 'src/thought-intake.js', 'demo/intake-server.js', 'Dockerfile']],
  ['moltbook', 'Optional external identity participation with safe inactive default.', ['src/moltbook-identity.js', 'docs/moltbook-participation.md']],
  ['environment-motion', 'Corn-breeze and seamless-cloud motion controllers.', ['src/environment-motion.js', 'src/corn-breeze.js', 'src/cloud-loop.js']],
  ['browser-demo', 'Interactive test window and runnable visual demonstrations.', ['demo/intake-browser.html', 'demo/']]
];
const subsystems = subsystemDefinitions.map(([id, purpose, prefixes]) => ({
  id, purpose, paths: prefixes,
  indexedFiles: files.filter(file => prefixes.some(prefix =>
    prefix.endsWith('/') ? file.path.startsWith(prefix) : file.path === prefix))
    .map(file => file.path)
}));

const log = {
  schema: 'neural-engine-project-log/v2',
  scope: 'entire-repository',
  project: {
    name: 'Shape Cognition Prototype / Neural Engine',
    package: packageMetadata.name,
    version: packageMetadata.version,
    repository: 'https://github.com/ptown16801-lang/Not-a-test',
    defaultBranch: 'main',
    currentBranch: branch
  },
  snapshot: {
    generatedAtUtc: new Date().toISOString(),
    worktreeBaseCommit: head,
    historyStartsAtCommit: history[0]?.commit ?? null,
    historyThroughCommit: history.at(-1)?.commit ?? null,
    commitCount: history.length,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    aggregateSha256: sha256(aggregatePayload),
    contentSnapshotIncludesWorkingTree: true,
    worktreeChangeCountExcludingThisLog: rawStatus.length,
    exclusions: excluded,
    purpose: 'Machine-readable whole-project history, SHA-256 file manifest, subsystem inventory, scientific evidence snapshot, and complete JSON artifact index.'
  },
  generation: {
    generator: relativeGenerator,
    generatorSha256: sha256(fs.readFileSync(generatorPath)),
    ordering: 'UTF-8 path lexical order',
    aggregateDigestRecord: 'path NUL byte-count NUL sha256 LF for every indexed file',
    regenerate: 'npm run logs:all',
    masterAggregate: 'MASTER_PROJECT.json'
  },
  history,
  subsystems,
  files,
  jsonArtifacts: {
    scientificAudits,
    scientificSpecifications,
    scientificValidationLogs,
    benchmarkLogs,
    projectFixtures,
    other: jsonPaths.filter(relative => !knownJson.has(relative))
  },
  jsonArtifactIndex: jsonIndex,
  validationSnapshot: {
    node: nodeReport ? {
      source: 'verification/results/node-test-report.json',
      allPassed: nodeReport.allPassed,
      ...nodeReport.summary,
      elapsedSeconds: nodeReport.elapsedSeconds
    } : {source: null, allPassed: null, status: 'No archived Node test report present when this manifest was generated.'},
    nodeCurrentRelease: releaseNodeReport ? {
      source: releaseNodeReportPath,
      allPassed: releaseNodeReport.allPassed,
      fullyExecuted: releaseNodeReport.fullyExecuted,
      ...releaseNodeReport.summary,
      elapsedSeconds: releaseNodeReport.elapsedSeconds
    } : {source: null, allPassed: null,
      status: 'No release-specific Node test report present when this manifest was generated.'},
    wolframMUnit: {
      source: 'mathematica/verification/results/wolfram-test-report.json',
      tests: munit.testCount,
      passed: munit.outcomeCounts.Success ?? 0,
      failed: munit.testCount - (munit.outcomeCounts.Success ?? 0),
      allPassed: munit.allPassed,
      kernel: munit.kernel
    },
    independentPublicationDerivation: {
      source: 'mathematica/verification/results/wolfram-validation.json',
      checks: publication.checkCount,
      allPassed: publication.allPassed,
      fixedPointMaxAbsoluteResidual: publication.metrics.fixedPointMaxAbsoluteResidual,
      susceptibilityFiniteDifferenceMaxAbsoluteError:
        publication.metrics.susceptibilityFiniteDifferenceMaxAbsoluteError,
      objectiveGradientFiniteDifferenceMaxAbsoluteError:
        publication.metrics.objectiveGradientFiniteDifferenceMaxAbsoluteError,
      objectiveGradientFiniteDifferenceRelativeError:
        publication.metrics.objectiveGradientFiniteDifferenceRelativeError
    },
    repeatedWolframAdversarial: {
      source: 'mathematica/verification/results/repeated-validation.json',
      randomFixtures: repeated.randomFixtureCount,
      allPassed: repeated.allPassed,
      ...repeated.summary
    },
    javascriptAdversarial: {
      source: 'mathematica/verification/results/javascript-adversarial-validation.json',
      fixtures: javascript.summary.finiteDifferenceFixtures,
      allPassed: javascript.allPassed,
      ...javascript.summary
    },
    numericalPolicySensitivity: {
      source: 'mathematica/verification/results/numerical-policy-sensitivity.json',
      settlingPolicyCases: policy.settlingPolicies.length,
      initializationCases: policy.initializationConditions.length,
      ...policy.summary
    }
  },
  scalingSnapshot: {
    source: 'mathematica/benchmark-results/scaling-summary.json',
    environment,
    paperSpecifiedOutputNeurons: scaling.claimPolicy.paperSpecifiedNetworkSize,
    requestedProjectFamilyLadder: scaling.currentRequestedLadder.map(row => row.totalNeurons),
    currentRunSetComplete: scaling.currentRunSetComplete,
    currentQualifiedRuns: currentQualifications.filter(
      row => row.status === 'current-qualified').length,
    currentQualificationCount: currentQualifications.length,
    paperSizedReference: {
      outputNeurons: scaling.current142.totalNeurons,
      updates: scaling.current142.trainingSteps,
      trainingSeconds: scaling.current142.trainingSecondsPerStep *
        scaling.current142.trainingSteps,
      secondsPerUpdate: scaling.current142.trainingSecondsPerStep,
      totalSecondsIncludingValidation:
        scaling.current142.trainingTotalSecondsIncludingValidation,
      operatingSystemPeakResidentSetBytes:
        scaling.current142.operatingSystemPeakResidentSetBytes
    },
    evidenceBoundaries: {
      sustained1000UpdateOutputNeurons: scaling.current142.totalNeurons,
      largestUniformTenUpdateOutputNeurons: Math.max(...scaling.empiricalScaling.uniformTenUpdateSizes),
      largestOneOrTwoUpdateOutputNeurons:
        scaling.observedBoundaries.largestCurrentExactExecutionNeurons,
      sustainedPracticalLimitMeasured: scaling.claimPolicy.practicalLimitInferenceAllowed,
      controlledSpeedupRelativeToAuthorsComputable:
        scaling.claimPolicy.controlledSpeedupRelativeToAuthorsComputable
    },
    fixedWindowLogLogExponent:
      scaling.empiricalScaling.uniformTenUpdateLogLogExponent,
    fixedWindowInterpretation: scaling.empiricalScaling.interpretation,
    criticalSlowing: {
      source: 'mathematica/benchmark-results/critical-slowing-142.json',
      worstRho: lastCritical.rho,
      iterations: lastCritical.iterations,
      seconds: lastCritical.seconds,
      fixedPointResidual: lastCritical.fixedPointResidual,
      stateErrorFromKnownFixedPoint: lastCritical.stateErrorFromKnownFixedPoint,
      exactKnownStateGradientRelativeFrobeniusError:
        lastCritical.numericExactStateGradientRelativeFrobeniusError,
      policySettledGradientRelativeFrobeniusError:
        lastCritical.policySettledGradientRelativeFrobeniusErrorVsExact
    }
  },
  scientificAuditSnapshot: {
    sourceLedger: 'docs/scientific-source-ledger.json',
    sourceCount: sourceLedger.sources.length,
    searchDate: sourceLedger.scope.searchDate,
    claimAudit: 'docs/scientific-claim-audit.json',
    ...claimAudit.summary,
    publicationReport: 'output/pdf/shriki-2016-publication-grade-audit.pdf'
  },
  unresolvedScientificLimits: [
    'The target publication does not report the exact high-dimensional diagonal policy.',
    'Near-zero cross-talk scale/distribution and within-modality initialization are not reported.',
    'Integrator, time step, equilibrium tolerance, stability window, seeds, update horizon, and checkpoint policy are not reported.',
    'The target paper specifies only M=142; larger circular grids are a project model-family extension.',
    'No controlled numeric speedup relative to the authors can be calculated from their qualitative runtime report.',
    'No sustained cross-size practical failure boundary has been measured.',
    'A fixed residual tolerance is not a reliable gradient-accuracy guarantee near criticality.'
  ]
};

fs.writeFileSync(outputPath, `${JSON.stringify(log, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({output: path.relative(root, outputPath),
  fileCount: files.length, jsonArtifactCount: jsonIndex.length,
  aggregateSha256: log.snapshot.aggregateSha256})}\n`);
