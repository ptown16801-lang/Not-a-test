#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  InfomaxRecurrentNetwork,
  createSimplePaperNetwork,
  invertSquareMatrix,
  logisticPrimeFromField
} from '../src/neural-synesthesia.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = fileURLToPath(import.meta.url);
const sourcePath = path.join(root, 'src/neural-synesthesia.js');
const referencePath = path.join(root,
  'mathematica/verification/results/wolfram-validation.json');
const outputPath = path.resolve(process.argv[2] ?? path.join(root,
  'mathematica/verification/results/javascript-adversarial-validation.json'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maxAbs = values => Math.max(...Array.from(values, Math.abs));
const maxAbsDifference = (left, right) => {
  if (left.length !== right.length) return Infinity;
  let error = 0;
  for (let index = 0; index < left.length; index++) {
    error = Math.max(error, Math.abs(left[index] - right[index]));
  }
  return error;
};
const flatten = matrix => matrix.flat(Infinity);

const wolfram = readJson(referencePath);
const fixture = wolfram.referenceFixture;
const referenceModel = new InfomaxRecurrentNetwork({
  inputSize: fixture.input.length,
  outputSize: fixture.state.length,
  W: flatten(fixture.W),
  K: flatten(fixture.K),
  metadata: {excludeSelfCoupling: false}
});
const referenceAnalysis = referenceModel.analyze(fixture.input, {
  integrationStep: 0.8,
  tolerance: 1e-12,
  residualTolerance: 1e-12,
  stableIterations: 3
});
const crossLanguage = {
  wolframSchema: wolfram.schema,
  stateMaxAbsoluteError: maxAbsDifference(referenceAnalysis.state, fixture.state),
  objectiveAbsoluteError: Math.abs(referenceAnalysis.objective - fixture.objective),
  susceptibilityMaxAbsoluteError: maxAbsDifference(
    referenceAnalysis.susceptibility, flatten(fixture.susceptibility)),
  descentDirectionMaxAbsoluteError: maxAbsDifference(
    referenceAnalysis.updateDirection, flatten(fixture.descentDirection))
};
crossLanguage.pass = crossLanguage.stateMaxAbsoluteError < 2e-11 &&
  crossLanguage.objectiveAbsoluteError < 2e-10 &&
  crossLanguage.susceptibilityMaxAbsoluteError < 2e-10 &&
  crossLanguage.descentDirectionMaxAbsoluteError < 2e-8;

function generator(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function randomFixture(seed) {
  const random = generator(seed);
  const uniform = (low, high) => low + (high - low) * random();
  const W = Array.from({length: 6}, () => uniform(-0.85, 0.85));
  const K = Array.from({length: 9}, () => uniform(-0.045, 0.045));
  const input = Array.from({length: 2}, () => uniform(-0.7, 0.7));
  return {W, K, input};
}

function finiteDifferenceRow(seed) {
  const {W, K, input} = randomFixture(seed);
  const options = {integrationStep: 0.8, tolerance: 1e-12,
    residualTolerance: 1e-12, stableIterations: 3};
  const makeModel = recurrent => new InfomaxRecurrentNetwork({
    inputSize: 2, outputSize: 3, W, K: recurrent,
    metadata: {excludeSelfCoupling: false}
  });
  const model = makeModel(K);
  const analysis = model.analyze(input, options);
  const parameterStep = 1e-6;
  const finiteDifferenceGradient = new Float64Array(9);
  for (let index = 0; index < 9; index++) {
    const plus = K.slice();
    const minus = K.slice();
    plus[index] += parameterStep;
    minus[index] -= parameterStep;
    finiteDifferenceGradient[index] = (
      makeModel(plus).objective(input, options) -
      makeModel(minus).objective(input, options)) / (2 * parameterStep);
  }
  const gradientResidual = analysis.updateDirection.map(
    (value, index) => value + finiteDifferenceGradient[index]);
  const inputStep = 1e-6;
  const susceptibilityFD = new Float64Array(6);
  for (let column = 0; column < 2; column++) {
    const plus = input.slice();
    const minus = input.slice();
    plus[column] += inputStep;
    minus[column] -= inputStep;
    const plusState = model.settle(plus, options).state;
    const minusState = model.settle(minus, options).state;
    for (let row = 0; row < 3; row++) {
      susceptibilityFD[row * 2 + column] =
        (plusState[row] - minusState[row]) / (2 * inputStep);
    }
  }
  const absoluteError = maxAbs(gradientResidual);
  const relativeError = absoluteError / Math.max(1e-15,
    maxAbs(finiteDifferenceGradient));
  const susceptibilityError = maxAbsDifference(
    susceptibilityFD, analysis.susceptibility);
  return {seed,
    fixedPointResidual: analysis.fixedPointResidual,
    gradientFiniteDifferenceMaxAbsoluteError: absoluteError,
    gradientFiniteDifferenceRelativeError: relativeError,
    susceptibilityFiniteDifferenceMaxAbsoluteError: susceptibilityError,
    pass: analysis.fixedPointResidual < 1e-11 && absoluteError < 5e-7 &&
      relativeError < 5e-6 && susceptibilityError < 2e-8};
}
const finiteDifferences = [101, 202, 303, 1101, 1202, 1303]
  .map(finiteDifferenceRow);

const tinyStep = createSimplePaperNetwork().settle([1, 1], {
  integrationStep: 1e-12, tolerance: 1e-9, residualTolerance: 1e-9,
  stableIterations: 2, maxIterations: 2, allowUnconverged: true
});
const falseConvergence = {converged: tinyStep.converged,
  maxDelta: tinyStep.maxDelta, fixedPointResidual: tinyStep.fixedPointResidual,
  pass: !tinyStep.converged && tinyStep.fixedPointResidual > 0.2};

const unstableModel = createSimplePaperNetwork({crossTalk: [8, 8]});
const unstableExact = unstableModel.settle([-4, -4], {
  initialState: [0.5, 0.5], tolerance: 1e-13,
  residualTolerance: 1e-13});
const unstableHigh = unstableModel.settle([-4, -4], {
  initialState: [0.5001, 0.5001], tolerance: 1e-12,
  residualTolerance: 1e-12, maxIterations: 200000});
const unstableLow = unstableModel.settle([-4, -4], {
  initialState: [0.4999, 0.4999], tolerance: 1e-12,
  residualTolerance: 1e-12, maxIterations: 200000});
const firstAtSymmetry = logisticPrimeFromField(0);
const largestJacobianRealPart = -1 + 8 * firstAtSymmetry;
const stability = {
  exactInitialResidual: unstableExact.fixedPointResidual,
  largestContinuousTimeJacobianRealPart: largestJacobianRealPart,
  locallyAsymptoticallyStable: largestJacobianRealPart < 0,
  positiveUnstableModeEndpoint: Array.from(unstableHigh.state),
  negativeUnstableModeEndpoint: Array.from(unstableLow.state),
  positiveEndpointDistanceFromSymmetricFixedPoint:
    maxAbsDifference(unstableHigh.state, [0.5, 0.5]),
  negativeEndpointDistanceFromSymmetricFixedPoint:
    maxAbsDifference(unstableLow.state, [0.5, 0.5])
};
stability.pass = stability.exactInitialResidual < 1e-14 &&
  !stability.locallyAsymptoticallyStable &&
  stability.positiveEndpointDistanceFromSymmetricFixedPoint > 0.4 &&
  stability.negativeEndpointDistanceFromSymmetricFixedPoint > 0.4 &&
  Math.min(...stability.positiveUnstableModeEndpoint) > 0.9 &&
  Math.max(...stability.negativeUnstableModeEndpoint) < 0.1;

const saturatedModel = new InfomaxRecurrentNetwork({
  inputSize: 2, outputSize: 3,
  W: [300, 0, 0, 1, 1, 0], K: new Array(9).fill(0),
  metadata: {excludeSelfCoupling: false}
});
const saturated = saturatedModel.analyze([1, 0], {
  integrationStep: 1, tolerance: 1e-12, residualTolerance: 1e-12});
const gramUnderflowModel = new InfomaxRecurrentNetwork({
  inputSize: 1, outputSize: 1, W: [1], K: [0],
  metadata: {excludeSelfCoupling: false}
});
const gramUnderflow = gramUnderflowModel.analyze([400], {
  integrationStep: 1, tolerance: 1e-12, residualTolerance: 1e-12});
const derivativeFloor = gramUnderflowModel.analyze([3], {
  derivativeFloor: 0.2, integrationStep: 1, tolerance: 1e-12,
  residualTolerance: 1e-12});
const numericalScale = {
  derivativeAtField300: saturated.firstDerivative[0],
  derivativeIsRepresentable: saturated.firstDerivative[0] > 0,
  objective: saturated.objective,
  scaledCurvatureVectorFinite: [...saturated.scaledA].every(Number.isFinite),
  recurrentGradientFinite: [...saturated.updateDirection].every(Number.isFinite),
  scaledWellConditionedInverse: Array.from(invertSquareMatrix([
    1e-200, 0, 0, 2e-200
  ], 2)),
  gramUnderflow: {
    field: 400,
    gramValue: gramUnderflow.gram[0],
    underflowDetected: gramUnderflow.gramNumericallyUnderflowed,
    objective: gramUnderflow.objective,
    recurrentGradient: gramUnderflow.updateDirection[0]
  },
  derivativeFloorSurrogate: {
    field: 3,
    floor: 0.2,
    floorApplied: derivativeFloor.derivativeFloorApplied,
    equationSemantics: derivativeFloor.equationSemantics,
    recurrentGradient: derivativeFloor.updateDirection[0]
  }
};
numericalScale.pass = numericalScale.derivativeIsRepresentable &&
  numericalScale.scaledCurvatureVectorFinite &&
  numericalScale.recurrentGradientFinite &&
  numericalScale.scaledWellConditionedInverse.every(Number.isFinite) &&
  numericalScale.gramUnderflow.gramValue === 0 &&
  numericalScale.gramUnderflow.underflowDetected &&
  Math.abs(numericalScale.gramUnderflow.objective - 400) < 2e-12 &&
  Math.abs(numericalScale.gramUnderflow.recurrentGradient + 1) < 2e-12 &&
  numericalScale.derivativeFloorSurrogate.floorApplied &&
  numericalScale.derivativeFloorSurrogate.equationSemantics ===
    'project-surrogate-derivative-floor' &&
  Math.abs(numericalScale.derivativeFloorSurrogate.recurrentGradient -
    0.005238719864787106) < 2e-14;

const serializationModel = new InfomaxRecurrentNetwork({
  inputSize: 2, outputSize: 2,
  W: [Math.PI, Number.MIN_VALUE, -Math.E, 1 / 3],
  K: [0, Math.sqrt(2) * 1e-20, -Math.LN2, 0],
  modalities: [], metadata: {ExcludeSelfCoupling: false, policy: 'binary64'}
});
const serialized = JSON.stringify(serializationModel);
const restored = InfomaxRecurrentNetwork.fromJSON(JSON.parse(serialized));
const float64Hex = value => {
  const bytes = new Uint8Array(new Float64Array([value]).buffer);
  return Buffer.from(bytes).toString('hex');
};
const beforeBits = [...serializationModel.W, ...serializationModel.K].map(float64Hex);
const afterBits = [...restored.W, ...restored.K].map(float64Hex);
const serialization = {
  scalarCount: beforeBits.length,
  binary64BitPatternsIdentical: beforeBits.every(
    (value, index) => value === afterBits[index]),
  excludeSelfCoupling: restored.metadata.excludeSelfCoupling
};
serialization.pass = serialization.binary64BitPatternsIdentical &&
  serialization.excludeSelfCoupling === false;

const sections = {crossLanguage, finiteDifferences, falseConvergence,
  fixedPointVersusStability: stability, numericalScale, serialization};
const allPassed = crossLanguage.pass && finiteDifferences.every(row => row.pass) &&
  falseConvergence.pass && stability.pass && numericalScale.pass &&
  serialization.pass;
const report = {
  schema: 'shriki-2016-javascript-adversarial-validation/v1',
  generatedAtUtc: new Date().toISOString(),
  runtime: {node: process.version, platform: process.platform, arch: process.arch},
  source: {
    path: 'src/neural-synesthesia.js',
    sha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex')
  },
  generator: {
    path: path.relative(root, generatorPath),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(generatorPath)).digest('hex')
  },
  wolframReference: {
    path: path.relative(root, referencePath),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(referencePath)).digest('hex'),
    schema: wolfram.schema,
    generatedAtUtc: wolfram.generatedAtUtc
  },
  authorityBoundary: 'Cross-language values come from the independent Wolfram publication derivation; other cases adversarially test the JavaScript implementation.',
  allPassed,
  summary: {
    finiteDifferenceFixtures: finiteDifferences.length,
    maximumGradientFiniteDifferenceAbsoluteError: Math.max(...finiteDifferences
      .map(row => row.gradientFiniteDifferenceMaxAbsoluteError)),
    maximumGradientFiniteDifferenceRelativeError: Math.max(...finiteDifferences
      .map(row => row.gradientFiniteDifferenceRelativeError)),
    maximumSusceptibilityFiniteDifferenceAbsoluteError: Math.max(...finiteDifferences
      .map(row => row.susceptibilityFiniteDifferenceMaxAbsoluteError))
  },
  ...sections
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({allPassed, outputPath,
  summary: report.summary})}\n`);
if (!allPassed) process.exitCode = 1;
