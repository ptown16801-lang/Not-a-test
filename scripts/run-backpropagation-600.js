#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {
  createPaperInputSampler,
  createTwoModalityPaperNetwork,
  invertSquareMatrix
} from '../src/neural-synesthesia.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = fileURLToPath(import.meta.url);
const sourcePath = path.join(root, 'src/neural-synesthesia.js');
const outputPath = path.resolve(process.argv[2] ?? path.join(root,
  'verification/results/backpropagation-600.json'));
const totalOutputs = 600;
const neuronsPerModality = totalOutputs / 2;
const inputSize = 4;
const settle = Object.freeze({
  integrationStep: 1,
  tolerance: 1e-12,
  residualTolerance: 1e-12,
  convergenceCriterion: 'step-and-residual',
  stableIterations: 3,
  maxIterations: 10000
});

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const elapsed = start => (performance.now() - start) / 1000;
const maxAbs = values => {
  let maximum = 0;
  for (const value of values) maximum = Math.max(maximum, Math.abs(value));
  return maximum;
};
const frobeniusNorm = values => {
  let squared = 0;
  for (const value of values) squared += value * value;
  return Math.sqrt(squared);
};
const maxAbsDifference = (left, right) => {
  let maximum = 0;
  for (let index = 0; index < left.length; index++) {
    maximum = Math.max(maximum, Math.abs(left[index] - right[index]));
  }
  return maximum;
};
const rmsDifference = (left, right) => {
  let squared = 0;
  for (let index = 0; index < left.length; index++) {
    const difference = left[index] - right[index];
    squared += difference * difference;
  }
  return Math.sqrt(squared / left.length);
};
const vectorError = (actual, expected) => {
  let maximumAbsoluteError = 0;
  let squaredError = 0;
  let squaredReference = 0;
  for (let index = 0; index < actual.length; index++) {
    const difference = actual[index] - expected[index];
    maximumAbsoluteError = Math.max(maximumAbsoluteError, Math.abs(difference));
    squaredError += difference * difference;
    squaredReference += expected[index] * expected[index];
  }
  return {
    maximumAbsoluteError,
    relativeL2Error: Math.sqrt(squaredError / Math.max(squaredReference, 1e-300))
  };
};

function generator(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function solveSmall(matrix, vector) {
  const inverse = invertSquareMatrix(matrix, vector.length, 1e-14);
  const result = new Float64Array(vector.length);
  for (let row = 0; row < vector.length; row++) {
    for (let column = 0; column < vector.length; column++) {
      result[row] += inverse[row * vector.length + column] * vector[column];
    }
  }
  return result;
}

function outputLoss(actual, target) {
  let squared = 0;
  let maximumAbsoluteResidual = 0;
  for (let index = 0; index < actual.length; index++) {
    const residual = actual[index] - target[index];
    squared += residual * residual;
    maximumAbsoluteResidual = Math.max(maximumAbsoluteResidual,
      Math.abs(residual));
  }
  return {
    halfMeanSquaredError: 0.5 * squared / actual.length,
    rootMeanSquaredError: Math.sqrt(squared / actual.length),
    maximumAbsoluteResidual
  };
}

/*
 * Recover x from a target equilibrium state by backpropagating the activity
 * residual through chi=ds/dx. Damped Gauss-Newton uses the same backpropagated
 * gradient chi^T(s-target), but is much better conditioned than a fixed
 * hand-tuned gradient-descent step for the four-dimensional inverse problem.
 */
function backpropagateInput(network, target, initialInput) {
  let input = Float64Array.from(initialInput);
  let damping = 1e-10;
  const history = [];
  let stopReason = 'iteration-limit';
  for (let iteration = 0; iteration < 15; iteration++) {
    const analysis = network.analyze(input, {...settle, gradient: false});
    const loss = outputLoss(analysis.state, target);
    const normal = new Float64Array(inputSize * inputSize);
    const backpropagatedGradient = new Float64Array(inputSize);
    for (let output = 0; output < totalOutputs; output++) {
      const residual = analysis.state[output] - target[output];
      for (let left = 0; left < inputSize; left++) {
        const derivative = analysis.susceptibility[output * inputSize + left];
        backpropagatedGradient[left] += derivative * residual;
        for (let right = 0; right < inputSize; right++) {
          normal[left * inputSize + right] += derivative *
            analysis.susceptibility[output * inputSize + right];
        }
      }
    }
    history.push({iteration, ...loss,
      backpropagatedGradientL2Norm: frobeniusNorm(backpropagatedGradient)});
    if (loss.maximumAbsoluteResidual < 1e-11) {
      stopReason = 'output-residual';
      break;
    }
    for (let diagonal = 0; diagonal < inputSize; diagonal++) {
      normal[diagonal * inputSize + diagonal] += damping;
    }
    const step = solveSmall(normal, backpropagatedGradient);
    if (frobeniusNorm(step) < 1e-12) {
      stopReason = 'parameter-step';
      break;
    }
    let accepted = false;
    for (let lineSearch = 0; lineSearch < 16; lineSearch++) {
      const scale = 2 ** -lineSearch;
      const candidate = Float64Array.from(input,
        (value, index) => value - scale * step[index]);
      const candidateState = network.settle(candidate, settle).state;
      if (outputLoss(candidateState, target).halfMeanSquaredError <
          loss.halfMeanSquaredError) {
        input = candidate;
        damping = Math.max(1e-14, damping * 0.3);
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      stopReason = 'line-search-stationary';
      break;
    }
  }
  const finalState = network.settle(input, settle).state;
  return {input: Array.from(input), output: outputLoss(finalState, target),
    iterations: history.length - 1, stopReason, history};
}

/* The fixed-point identity logit(s)-Ks=Wx provides an independent exact
 * decoder when the full state and the known model are available. */
function algebraicInput(network, state) {
  const gram = new Float64Array(inputSize * inputSize);
  const rhs = new Float64Array(inputSize);
  for (let output = 0; output < totalOutputs; output++) {
    let recurrent = 0;
    for (let source = 0; source < totalOutputs; source++) {
      recurrent += network.K[output * totalOutputs + source] * state[source];
    }
    const clipped = Math.max(Number.EPSILON,
      Math.min(1 - Number.EPSILON, state[output]));
    const directField = Math.log(clipped / (1 - clipped)) - recurrent;
    for (let left = 0; left < inputSize; left++) {
      const weight = network.W[output * inputSize + left];
      rhs[left] += weight * directField;
      for (let right = 0; right < inputSize; right++) {
        gram[left * inputSize + right] += weight *
          network.W[output * inputSize + right];
      }
    }
  }
  return Array.from(solveSmall(gram, rhs));
}

function finiteDifferenceSusceptibility(network, input) {
  const analysis = network.analyze(input, {...settle, gradient: false});
  const numerical = new Float64Array(totalOutputs * inputSize);
  const step = 1e-5;
  for (let column = 0; column < inputSize; column++) {
    const plus = Float64Array.from(input);
    const minus = Float64Array.from(input);
    plus[column] += step;
    minus[column] -= step;
    const plusState = network.settle(plus, settle).state;
    const minusState = network.settle(minus, settle).state;
    for (let row = 0; row < totalOutputs; row++) {
      numerical[row * inputSize + column] =
        (plusState[row] - minusState[row]) / (2 * step);
    }
  }
  const error = vectorError(numerical, analysis.susceptibility);
  return {parameterStep: step, comparedEntries: numerical.length, ...error,
    pass: error.maximumAbsoluteError < 1e-8 && error.relativeL2Error < 1e-7};
}

function coordinateGradientChecks(network, input, analyticDirection) {
  const coordinates = [
    [0, 0, 'modality-1 self'],
    [0, 299, 'modality-1 within'],
    [0, 300, 'modality-2 to modality-1'],
    [299, 599, 'modality-2 to modality-1 boundary'],
    [300, 0, 'modality-1 to modality-2'],
    [599, 299, 'modality-1 to modality-2 boundary'],
    [300, 300, 'modality-2 self'],
    [599, 300, 'modality-2 within']
  ];
  const rows = [];
  for (const parameterStep of [1e-4, 1e-5]) {
    for (const [target, source, classification] of coordinates) {
      const index = target * totalOutputs + source;
      const plus = network.clone();
      const minus = network.clone();
      plus.K[index] += parameterStep;
      minus.K[index] -= parameterStep;
      const finiteDifferenceDescent = -(
        plus.objective(input, settle) - minus.objective(input, settle)) /
        (2 * parameterStep);
      const analyticalDescent = analyticDirection[index];
      const absoluteError = Math.abs(analyticalDescent - finiteDifferenceDescent);
      const relativeError = absoluteError / Math.max(1e-15,
        Math.abs(analyticalDescent), Math.abs(finiteDifferenceDescent));
      rows.push({target, source, classification, parameterStep,
        analyticalDescent, finiteDifferenceDescent, absoluteError,
        relativeError});
    }
  }
  return {checks: rows.length,
    maximumAbsoluteError: Math.max(...rows.map(row => row.absoluteError)),
    maximumRelativeError: Math.max(...rows.map(row => row.relativeError)),
    signMatches: rows.every(row => Math.sign(row.analyticalDescent) ===
      Math.sign(row.finiteDifferenceDescent)), rows,
    pass: rows.every(row => row.absoluteError < 1e-7 &&
      row.relativeError < 1e-5)};
}

function directionalGradientChecks(network, input, analyticDirection) {
  const gradientNorm = frobeniusNorm(analyticDirection);
  const directions = [{name: 'gradient-aligned', values:
    Float64Array.from(analyticDirection, value => value / gradientNorm)}];
  const blockDirection = (name, rowStart, columnStart) => {
    const values = new Float64Array(totalOutputs * totalOutputs);
    const scale = 1 / neuronsPerModality;
    for (let row = rowStart; row < rowStart + neuronsPerModality; row++) {
      for (let column = columnStart;
        column < columnStart + neuronsPerModality; column++) {
        values[row * totalOutputs + column] = scale;
      }
    }
    directions.push({name, values});
  };
  blockDirection('modality-2-to-1 block', 0, neuronsPerModality);
  blockDirection('modality-1-to-2 block', neuronsPerModality, 0);
  const random = generator(246813579);
  for (let direction = 0; direction < 4; direction++) {
    directions.push({name: `deterministic-rademacher-${direction + 1}`,
      values: Float64Array.from({length: totalOutputs * totalOutputs},
        () => (random() < 0.5 ? -1 : 1) / totalOutputs)});
  }
  const parameterStep = 1e-4;
  const rows = directions.map(({name, values}) => {
    const plus = network.clone();
    const minus = network.clone();
    let analyticalDescent = 0;
    for (let index = 0; index < values.length; index++) {
      plus.K[index] += parameterStep * values[index];
      minus.K[index] -= parameterStep * values[index];
      analyticalDescent += analyticDirection[index] * values[index];
    }
    const finiteDifferenceDescent = -(
      plus.objective(input, settle) - minus.objective(input, settle)) /
      (2 * parameterStep);
    const absoluteError = Math.abs(analyticalDescent - finiteDifferenceDescent);
    const scaledRelativeError = absoluteError / Math.max(1e-15,
      Math.abs(analyticalDescent), Math.abs(finiteDifferenceDescent),
      gradientNorm / totalOutputs);
    return {name, parameterStep, analyticalDescent, finiteDifferenceDescent,
      absoluteError, scaledRelativeError};
  });
  return {directions: rows.length, gradientFrobeniusNorm: gradientNorm,
    maximumAbsoluteError: Math.max(...rows.map(row => row.absoluteError)),
    maximumScaledRelativeError:
      Math.max(...rows.map(row => row.scaledRelativeError)), rows,
    pass: rows.every(row => row.absoluteError < 1e-7 &&
      row.scaledRelativeError < 1e-5)};
}

function criticalModel(rho) {
  const network = createTwoModalityPaperNetwork({neuronsPerModality});
  for (let row = 0; row < totalOutputs; row++) {
    for (let column = 0; column < totalOutputs; column++) {
      network.K[row * totalOutputs + column] = 4 * rho *
        ((row === column ? 1 : 0) - 1 / totalOutputs);
    }
  }
  return network;
}

function criticalGradientError(network, rho, options) {
  const analysis = network.analyze([0, 0, 0, 0], options);
  const referenceScale = 1 / (4 * (1 - rho) * (neuronsPerModality / 2));
  let squaredError = 0;
  let squaredReference = 0;
  let maximumAbsoluteError = 0;
  for (let row = 0; row < totalOutputs; row++) {
    for (let column = 0; column < totalOutputs; column++) {
      let feedforwardDot = 0;
      for (let input = 0; input < inputSize; input++) {
        feedforwardDot += network.W[row * inputSize + input] *
          network.W[column * inputSize + input];
      }
      const reference = referenceScale * feedforwardDot;
      const difference = analysis.updateDirection[row * totalOutputs + column] -
        reference;
      squaredError += difference * difference;
      squaredReference += reference * reference;
      maximumAbsoluteError = Math.max(maximumAbsoluteError,
        Math.abs(difference));
    }
  }
  return {iterations: analysis.iterations,
    fixedPointResidual: analysis.fixedPointResidual,
    stateErrorFromKnownFixedPoint:
      maxAbs(Array.from(analysis.state, value => value - 0.5)),
    numericalGradientFrobeniusNorm: frobeniusNorm(analysis.updateDirection),
    analyticalGradientFrobeniusNorm: 1 / (2 * (1 - rho)),
    gradientRelativeFrobeniusError:
      Math.sqrt(squaredError / squaredReference), maximumAbsoluteError};
}

const runStart = performance.now();
const timings = {};
const stage = (name, operation) => {
  const start = performance.now();
  const result = operation();
  timings[name] = elapsed(start);
  return result;
};

const zeroModel = createTwoModalityPaperNetwork({neuronsPerModality,
  seed: 1, initialRecurrentScale: 0, excludeSelfCoupling: false});
const trainedModel = zeroModel.clone();
const training = stage('tenUpdateTraining', () => trainedModel.train({
  sampler: createPaperInputSampler({meanRadii: [0.2, 2], seed: 8675309}),
  steps: 10,
  batchSize: 1,
  learningRate: 1.5e-4,
  restoreBest: false,
  zeroDiagonal: false,
  settle
}));
const trainedKHash = sha256(Buffer.from(trainedModel.K.buffer));
const repeatModel = createTwoModalityPaperNetwork({neuronsPerModality,
  seed: 1, initialRecurrentScale: 0, excludeSelfCoupling: false});
stage('repeatTraining', () => repeatModel.train({
  sampler: createPaperInputSampler({meanRadii: [0.2, 2], seed: 8675309}),
  steps: 10, batchSize: 1, learningRate: 1.5e-4, restoreBest: false,
  zeroDiagonal: false, settle
}));
const repeatKHash = sha256(Buffer.from(repeatModel.K.buffer));

const fixedInputs = [
  [0.2 * Math.cos(0.3), 0.2 * Math.sin(0.3),
    2 * Math.cos(1.1), 2 * Math.sin(1.1)],
  [2 * Math.cos(2.4), 2 * Math.sin(2.4),
    0.2 * Math.cos(0.8), 0.2 * Math.sin(0.8)],
  [2 * Math.cos(0.2), 2 * Math.sin(0.2),
    2 * Math.cos(4.1), 2 * Math.sin(4.1)],
  [0.2 * Math.cos(5.3), 0.2 * Math.sin(5.3),
    0.2 * Math.cos(2.2), 0.2 * Math.sin(2.2)]
];
for (const [meanRadii, seed] of [[[0.2, 2], 101], [[2, 0.2], 202]]) {
  fixedInputs.push(Array.from(createPaperInputSampler({meanRadii, seed})()));
}
const gradientInput = fixedInputs[0];
const zeroAnalysis = stage('zeroAnalysis', () =>
  zeroModel.analyze(gradientInput, settle));
const trainedAnalysis = stage('trainedAnalysis', () =>
  trainedModel.analyze(gradientInput, settle));
const repeatedAnalysis = stage('repeatedAnalysis', () =>
  trainedModel.analyze(gradientInput, settle));

const dimensionsAndFiniteness = {
  inputDimensions: trainedModel.inputSize,
  outputNeurons: trainedModel.outputSize,
  neuronsPerModality: trainedModel.modalities.map(row => row.outputCount),
  recurrentParameters: trainedModel.K.length,
  susceptibilityEntries: trainedAnalysis.susceptibility.length,
  allStateFinite: [...trainedAnalysis.state].every(Number.isFinite),
  allSusceptibilityFinite:
    [...trainedAnalysis.susceptibility].every(Number.isFinite),
  allRecurrentGradientFinite:
    [...trainedAnalysis.updateDirection].every(Number.isFinite),
  derivativeFloorApplied: trainedAnalysis.derivativeFloorApplied,
  equationSemantics: trainedAnalysis.equationSemantics
};
dimensionsAndFiniteness.pass = dimensionsAndFiniteness.inputDimensions === 4 &&
  dimensionsAndFiniteness.outputNeurons === 600 &&
  dimensionsAndFiniteness.neuronsPerModality.every(value => value === 300) &&
  dimensionsAndFiniteness.recurrentParameters === 360000 &&
  dimensionsAndFiniteness.susceptibilityEntries === 2400 &&
  dimensionsAndFiniteness.allStateFinite &&
  dimensionsAndFiniteness.allSusceptibilityFinite &&
  dimensionsAndFiniteness.allRecurrentGradientFinite &&
  !dimensionsAndFiniteness.derivativeFloorApplied &&
  dimensionsAndFiniteness.equationSemantics === 'publication-equations';

const fixedPoint = {
  exactZero: {iterations: zeroAnalysis.iterations,
    residual: zeroAnalysis.fixedPointResidual, converged: zeroAnalysis.converged},
  trained: {iterations: trainedAnalysis.iterations,
    residual: trainedAnalysis.fixedPointResidual,
    converged: trainedAnalysis.converged}
};
fixedPoint.pass = fixedPoint.exactZero.converged && fixedPoint.trained.converged &&
  fixedPoint.exactZero.residual < settle.residualTolerance &&
  fixedPoint.trained.residual < settle.residualTolerance;

const susceptibility = {
  exactZero: stage('zeroSusceptibilityFiniteDifference', () =>
    finiteDifferenceSusceptibility(zeroModel, gradientInput)),
  trained: stage('trainedSusceptibilityFiniteDifference', () =>
    finiteDifferenceSusceptibility(trainedModel, gradientInput))
};
susceptibility.pass = susceptibility.exactZero.pass && susceptibility.trained.pass;

const coordinateGradient = stage('coordinateGradientFiniteDifferences', () =>
  coordinateGradientChecks(trainedModel, gradientInput,
    trainedAnalysis.updateDirection));
const directionalGradient = stage('directionalGradientFiniteDifferences', () =>
  directionalGradientChecks(trainedModel, gradientInput,
    trainedAnalysis.updateDirection));

const batchInputs = fixedInputs.slice(0, 4);
const batchDirection = new Float64Array(totalOutputs * totalOutputs);
let batchObjectiveBefore = 0;
stage('batchGradient', () => {
  for (const input of batchInputs) {
    const analysis = trainedModel.analyze(input, settle);
    batchObjectiveBefore += analysis.objective / batchInputs.length;
    for (let index = 0; index < batchDirection.length; index++) {
      batchDirection[index] += analysis.updateDirection[index] /
        batchInputs.length;
    }
  }
});
const learningRate = 1.5e-4;
const descendedModel = trainedModel.clone();
descendedModel.applyUpdate(batchDirection, learningRate,
  {zeroDiagonal: false, maxAbsWeight: Infinity});
let batchObjectiveAfter = 0;
stage('batchObjectiveAfterUpdate', () => {
  for (const input of batchInputs) {
    batchObjectiveAfter += descendedModel.objective(input, settle) /
      batchInputs.length;
  }
});
const predictedObjectiveChange = -learningRate *
  frobeniusNorm(batchDirection) ** 2;
const actualObjectiveChange = batchObjectiveAfter - batchObjectiveBefore;
const objectiveDescent = {batchSize: batchInputs.length, learningRate,
  objectiveBefore: batchObjectiveBefore, objectiveAfter: batchObjectiveAfter,
  actualObjectiveChange, predictedFirstOrderChange: predictedObjectiveChange,
  actualToPredictedRatio: actualObjectiveChange / predictedObjectiveChange,
  pass: actualObjectiveChange < 0 && predictedObjectiveChange < 0 &&
    Math.abs(actualObjectiveChange / predictedObjectiveChange - 1) < 1e-3};

const initialGuesses = [
  [0, 0, 0, 0],
  [1, -1, -1, 1],
  [-2, 2, 2, -2]
];
const noiselessTrials = stage('noiselessInputInversion', () =>
  fixedInputs.map((expectedInput, index) => {
    const target = trainedModel.settle(expectedInput, settle).state;
    const initialInput = initialGuesses[index % initialGuesses.length];
    const inversion = backpropagateInput(trainedModel, target, initialInput);
    const backpropagationError = vectorError(inversion.input, expectedInput);
    const algebraic = algebraicInput(trainedModel, target);
    const algebraicError = vectorError(algebraic, expectedInput);
    return {trial: index + 1, expectedInput, initialInput,
      recoveredInput: inversion.input, iterations: inversion.iterations,
      stopReason: inversion.stopReason, outputError: inversion.output,
      backpropagationError, algebraicRecoveredInput: algebraic,
      algebraicError,
      pass: backpropagationError.maximumAbsoluteError < 1e-9 &&
        inversion.output.rootMeanSquaredError < 1e-10 &&
        algebraicError.maximumAbsoluteError < 1e-10};
  }));

const noiseRandom = generator(97531);
const noisyTrials = stage('noisyInputInversion', () =>
  fixedInputs.slice(0, 3).map((expectedInput, index) => {
    const clean = trainedModel.settle(expectedInput, settle).state;
    const target = Float64Array.from(clean, value => Math.max(0, Math.min(1,
      value + (noiseRandom() * 2 - 1) * 1e-4)));
    const inversion = backpropagateInput(trainedModel, target, [0, 0, 0, 0]);
    const inputError = vectorError(inversion.input, expectedInput);
    return {trial: index + 1, outputNoiseDistribution:
      'deterministic uniform [-1e-4,1e-4]',
    realizedOutputNoiseRms: rmsDifference(target, clean),
    recoveredInput: inversion.input, iterations: inversion.iterations,
    stopReason: inversion.stopReason, outputError: inversion.output, inputError,
    pass: inputError.maximumAbsoluteError < 5e-4};
  }));

const quantizedTrials = stage('eightBitInputInversion', () =>
  fixedInputs.slice(0, 3).map((expectedInput, index) => {
    const clean = trainedModel.settle(expectedInput, settle).state;
    const target = Float64Array.from(clean, value => Math.round(value * 255) / 255);
    const inversion = backpropagateInput(trainedModel, target, [0, 0, 0, 0]);
    const inputError = vectorError(inversion.input, expectedInput);
    return {trial: index + 1, quantization: 'round each raw activity to 8-bit',
      realizedOutputQuantizationRms: rmsDifference(target, clean),
      recoveredInput: inversion.input, iterations: inversion.iterations,
      stopReason: inversion.stopReason, outputError: inversion.output, inputError,
      pass: inputError.maximumAbsoluteError < 5e-3};
  }));

const inputInversion = {
  algorithm: 'damped Gauss-Newton using the backpropagated gradient chi^T(s-target)',
  rawActivityRequired: true,
  noiseless: {trials: noiselessTrials,
    successCount: noiselessTrials.filter(row => row.pass).length,
    maximumInputAbsoluteError: Math.max(...noiselessTrials.map(row =>
      row.backpropagationError.maximumAbsoluteError)),
    maximumOutputRmsError: Math.max(...noiselessTrials.map(row =>
      row.outputError.rootMeanSquaredError)),
    pass: noiselessTrials.every(row => row.pass)},
  noisy: {trials: noisyTrials,
    successCount: noisyTrials.filter(row => row.pass).length,
    maximumInputAbsoluteError: Math.max(...noisyTrials.map(row =>
      row.inputError.maximumAbsoluteError)),
    pass: noisyTrials.every(row => row.pass)},
  eightBit: {trials: quantizedTrials,
    successCount: quantizedTrials.filter(row => row.pass).length,
    maximumInputAbsoluteError: Math.max(...quantizedTrials.map(row =>
      row.inputError.maximumAbsoluteError)),
    pass: quantizedTrials.every(row => row.pass)}
};
inputInversion.pass = inputInversion.noiseless.pass &&
  inputInversion.noisy.pass && inputInversion.eightBit.pass;

const criticalExact = [];
for (const rho of [0.9, 0.99, 0.999, 0.9999]) {
  const network = criticalModel(rho);
  const start = performance.now();
  const row = criticalGradientError(network, rho, {...settle,
    initialState: new Float64Array(totalOutputs).fill(0.5),
    integrationStep: 0.5, tolerance: 1e-13, residualTolerance: 1e-13,
    stableIterations: 2, maxIterations: 1000});
  criticalExact.push({rho, seconds: elapsed(start), ...row,
    pass: row.gradientRelativeFrobeniusError < 2e-9});
}
timings.criticalExactState = criticalExact.reduce((sum, row) =>
  sum + row.seconds, 0);

const criticalPolicy = [];
for (const rho of [0.99, 0.999, 0.9999]) {
  const network = criticalModel(rho);
  const initialState = Float64Array.from({length: totalOutputs}, (_, index) =>
    0.5 + 0.01 * Math.cos(2 * Math.PI * index / totalOutputs));
  const start = performance.now();
  const row = criticalGradientError(network, rho, {
    initialState, integrationStep: 0.5, tolerance: 1e-9,
    residualTolerance: 1e-9, convergenceCriterion: 'step-and-residual',
    stableIterations: 2, maxIterations: 1000000});
  criticalPolicy.push({rho, seconds: elapsed(start), ...row});
}
timings.criticalPolicySettling = criticalPolicy.reduce((sum, row) =>
  sum + row.seconds, 0);
const critical = {
  construction: 'K=4 rho (I-11^T/M), x=0, known equilibrium s=0.5',
  purpose: 'Separate analytical backpropagation correctness from error introduced by a tolerance-settled state near criticality.',
  exactKnownState: criticalExact,
  policySettled: criticalPolicy,
  exactKnownStatePass: criticalExact.every(row => row.pass),
  warning: 'A small fixed-point residual is not a forward- or gradient-error guarantee near a singular fixed-point operator.'
};

const repeatability = {
  trainingKHashFirst: trainedKHash,
  trainingKHashRepeat: repeatKHash,
  trainedWeightsBitwiseIdentical: trainedKHash === repeatKHash,
  repeatedStateMaximumAbsoluteDifference:
    maxAbsDifference(trainedAnalysis.state, repeatedAnalysis.state),
  repeatedGradientMaximumAbsoluteDifference:
    maxAbsDifference(trainedAnalysis.updateDirection,
      repeatedAnalysis.updateDirection)
};
repeatability.pass = repeatability.trainedWeightsBitwiseIdentical &&
  repeatability.repeatedStateMaximumAbsoluteDifference === 0 &&
  repeatability.repeatedGradientMaximumAbsoluteDifference === 0;

const robustnessPass = inputInversion.noisy.pass && inputInversion.eightBit.pass;
const gates = [
  {id: 'architecture-dimensions-and-finiteness', weight: 5,
    passed: dimensionsAndFiniteness.pass},
  {id: 'fixed-point-convergence', weight: 10, passed: fixedPoint.pass},
  {id: 'susceptibility-finite-differences', weight: 10,
    passed: susceptibility.pass},
  {id: 'recurrent-gradient-coordinate-finite-differences', weight: 15,
    passed: coordinateGradient.pass},
  {id: 'recurrent-gradient-whole-matrix-directions', weight: 15,
    passed: directionalGradient.pass},
  {id: 'gradient-sign-and-objective-descent', weight: 10,
    passed: objectiveDescent.pass},
  {id: 'noiseless-output-to-input-backpropagation', weight: 15,
    passed: inputInversion.noiseless.pass},
  {id: 'noisy-and-eight-bit-output-robustness', weight: 5,
    passed: robustnessPass},
  {id: 'near-critical-exact-state-analytical-gradient', weight: 10,
    passed: critical.exactKnownStatePass},
  {id: 'bitwise-repeatability', weight: 5, passed: repeatability.pass}
];
const weightedGateScore = gates.reduce((sum, gate) =>
  sum + (gate.passed ? gate.weight : 0), 0);
const conservativeReliabilityScore = Math.max(0, weightedGateScore - 5);
const allPassed = gates.every(gate => gate.passed);

const report = {
  schema: 'neural-engine-backpropagation-600/v1',
  generatedAtUtc: new Date().toISOString(),
  purpose: 'Reproducible 600-output-neuron recurrent-gradient and raw-output-to-input inversion validation.',
  scope: {
    interpretationOfNeuronCount: '600 recurrent output/rate neurons, 300 per modality, plus four input coordinates',
    publicationStatus: 'M=600 is an even-grid project scaling extension. The publication specifies M=142; it does not specify a cross-size scaling law.',
    backpropagationMeaningsTested: [
      'negative gradient of the publication information objective with respect to all recurrent weights',
      'gradient/Jacobian-based recovery of the four-dimensional input from all 600 equilibrium activities'
    ],
    excludedClaim: 'This does not test recovery from the rendered artwork, population-vector summaries, or another lossy representation.'
  },
  provenance: {
    testedBaseCommit: '557ce0553224a8299abecd98cf71be142ad90b35',
    modelSource: 'src/neural-synesthesia.js',
    modelSourceSha256: sha256(fs.readFileSync(sourcePath)),
    script: path.relative(root, scriptPath).split(path.sep).join('/'),
    scriptSha256: sha256(fs.readFileSync(scriptPath)),
    runtime: {node: process.version, platform: process.platform,
      architecture: process.arch}
  },
  numericalPolicy: {...settle,
    provenance: 'Declared project test policy; the paper does not report its integrator step, tolerance, stable-iteration count, or seed.'},
  modelPreparation: {
    initialization: 'exact K=0 reconstruction condition',
    trainingUpdates: 10,
    trainingScenario: 'mean radii [0.2,2]',
    trainingSeed: 8675309,
    learningRate: 1.5e-4,
    batchSize: 1,
    zeroDiagonal: false,
    derivativeFloor: 0,
    finalMaximumAbsoluteWeight: maxAbs(trainedModel.K),
    finalWeightFrobeniusNorm: frobeniusNorm(trainedModel.K),
    lastTrainingRecord: training.history.at(-1)
  },
  results: {dimensionsAndFiniteness, fixedPoint, susceptibility,
    coordinateGradient, directionalGradient, objectiveDescent, inputInversion,
    critical, repeatability},
  reliability: {
    weightedGateScore,
    possiblePoints: 100,
    gates,
    conservativeScore: conservativeReliabilityScore,
    conservativeScoreRationale: [
      'The weighted gate score is a deterministic test score, not a probability of correctness.',
      'Five points are withheld because finite fixtures cannot prove every input/recurrent matrix and fixed residual tolerances become unreliable extremely near criticality.',
      'The conservative score applies only when the full 600-value equilibrium state and the exact known network parameters are available.'
    ],
    testedRegimeVerdict: allPassed ? 'high reliability' : 'failed validation',
    nearCriticalOperationalVerdict:
      'condition-dependent; require condition-aware settling and a direct gradient-accuracy gate'
  },
  limitations: [
    'The six noiseless, three noisy, and three 8-bit trials are deterministic coverage, not a statistical population guarantee.',
    'Raw-state inversion is overdetermined because 600 activities encode four inputs and W has full column rank; exact recovery is expected when the state and model are known.',
    'The fixed-point identity admits a faster algebraic decoder; iterative backpropagation was retained here because that is the requested test.',
    'A rendered synesthetic shape is a lossy downstream projection and cannot be assumed to preserve enough information for exact input recovery.',
    'Near a critical or unstable recurrent fixed point, state selection, conditioning, and equilibrium error can dominate an otherwise correct analytical gradient.'
  ],
  timingsSeconds: {...timings, total: elapsed(runStart)},
  resourceUsage: {maxRssKilobytes: process.resourceUsage().maxRSS,
    finalProcessMemoryBytes: process.memoryUsage()},
  allPassed
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  output: path.relative(root, outputPath).split(path.sep).join('/'),
  allPassed: report.allPassed,
  weightedGateScore: report.reliability.weightedGateScore,
  conservativeScore: report.reliability.conservativeScore,
  maximumNoiselessInputAbsoluteError:
    report.results.inputInversion.noiseless.maximumInputAbsoluteError,
  maximumCoordinateGradientRelativeError:
    report.results.coordinateGradient.maximumRelativeError,
  maximumDirectionalGradientScaledRelativeError:
    report.results.directionalGradient.maximumScaledRelativeError,
  criticalPolicyWorstGradientRelativeError:
    Math.max(...report.results.critical.policySettled.map(row =>
      row.gradientRelativeFrobeniusError)),
  elapsedSeconds: report.timingsSeconds.total
})}\n`);
if (!allPassed) process.exitCode = 1;
