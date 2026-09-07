#!/usr/bin/env wolframscript

(*
  Repeated adversarial validation of the publication-faithful implementation.
  This complements PublicationDerivation.wls: the latter derives the equations
  without importing project code; this file attacks the implementation across
  independent random fixtures, representations, batches, scales and dynamics.
*)

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{DirectoryName[directory], "SynesthesiaModel.wl"}]];

ClearAll[maxAbs, independentState, independentObjective, randomFixture,
  randomFixtureResult, directionNorm, criticalModel];
maxAbs[value_] := Max[Abs[Flatten[N[value]]]];

independentState[k_?MatrixQ, w_?MatrixQ, x_?VectorQ] := Module[
  {m = Length[k], variables, solution},
  variables = Array[independentZ, m];
  solution = FindRoot[
    Thread[variables == 1/(1 + Exp[-(w.x + k.variables)])],
    Evaluate[Transpose[{variables, ConstantArray[.5, m]}]],
    AccuracyGoal -> 13, PrecisionGoal -> 13, MaxIterations -> 300];
  N[variables /. solution, 16]
];

independentObjective[k_?MatrixQ, w_?MatrixQ, x_?VectorQ] := Module[
  {s, field, first, phi, chi, singularValues},
  s = independentState[k, w, x];
  field = w.x + k.s;
  first = Exp[-Abs[field]]/(1 + Exp[-Abs[field]])^2;
  phi = LinearSolve[IdentityMatrix[Length[k]] -
      DiagonalMatrix[first].k, DiagonalMatrix[first]];
  chi = phi.w;
  singularValues = SingularValueList[chi];
  -Total[Log[singularValues]]
];

randomFixture[seed_Integer] := BlockRandom[Module[{w, k},
  SeedRandom[seed];
  w = RandomReal[{-.85, .85}, {3, 2}];
  k = RandomReal[{-.045, .045}, {3, 3}];
  <|"InputSize" -> 2, "OutputSize" -> 3, "W" -> w, "K" -> k,
    "Modalities" -> {}, "Metadata" -> <|"FixtureSeed" -> seed,
      "ExcludeSelfCoupling" -> False|>|>
]];

randomFixtureResult[seed_Integer, repetition_Integer] := Module[
  {model, inputs, analyses, independentStates, stateError, residual,
    inputStep = 1.*^-6, parameterStep = 1.*^-6, susceptibilityErrors,
    analyticDirection, finiteDifferenceDirection, objectiveForK,
    gradientError, gradientRelativeError},
  model = randomFixture[seed + 10000 repetition];
  inputs = BlockRandom[SeedRandom[seed + 7919 repetition];
    RandomReal[{-.7, .7}, {2, 2}]];
  analyses = AnalyzeNetwork[model, #, "IntegrationStep" -> .8,
      "Tolerance" -> 1.*^-12, "ResidualTolerance" -> 1.*^-12,
      "StableIterations" -> 3, "DerivativeFloor" -> 0.] & /@ inputs;
  If[AnyTrue[analyses, FailureQ], Return[<|"pass" -> False,
    "failure" -> ToString[FirstCase[analyses, _Failure], InputForm]|>]];
  independentStates = independentState[model["K"], model["W"], #] & /@ inputs;
  stateError = maxAbs[Lookup[analyses, "State"] - independentStates];
  residual = Max[Lookup[analyses, "FixedPointResidual"]];
  susceptibilityErrors = MapThread[Function[{input, analysis}, Module[{columns},
    columns = Transpose@Table[
      (independentState[model["K"], model["W"],
          input + inputStep UnitVector[2, j]] -
        independentState[model["K"], model["W"],
          input - inputStep UnitVector[2, j]])/(2 inputStep), {j, 2}];
    maxAbs[analysis["Susceptibility"] - columns]
  ]], {inputs, analyses}];
  analyticDirection = Mean[Lookup[analyses, "UpdateDirection"]];
  objectiveForK[k_] := Mean[independentObjective[k, model["W"], #] & /@ inputs];
  finiteDifferenceDirection = -Table[Module[{basis = ConstantArray[0., {3, 3}]},
    basis[[i, j]] = 1.;
    (objectiveForK[model["K"] + parameterStep basis] -
      objectiveForK[model["K"] - parameterStep basis])/(2 parameterStep)
  ], {i, 3}, {j, 3}];
  gradientError = maxAbs[analyticDirection - finiteDifferenceDirection];
  gradientRelativeError = gradientError/Max[10.^-15, maxAbs[finiteDifferenceDirection]];
  <|"seed" -> seed, "repetition" -> repetition,
    "fixedPointMaxAbsoluteErrorVsIndependentFindRoot" -> stateError,
    "fixedPointMaxResidual" -> residual,
    "susceptibilityFiniteDifferenceMaxAbsoluteError" -> Max[susceptibilityErrors],
    "gradientFiniteDifferenceMaxAbsoluteError" -> gradientError,
    "gradientFiniteDifferenceRelativeError" -> gradientRelativeError,
    "pass" -> (stateError < 2.*^-10 && residual < 1.*^-11 &&
      Max[susceptibilityErrors] < 2.*^-8 && gradientError < 5.*^-7 &&
      gradientRelativeError < 5.*^-6)|>
];

randomRows = Flatten@Table[randomFixtureResult[seed, repetition],
  {repetition, 1, 3}, {seed, {101, 202, 303}}];

batchInputs = {PolarProbe[1, .2, .8], PolarProbe[2, .7, 1.2],
  PolarProbe[1, 1.3, .5], PolarProbe[2, 2.1, 1.7]};
batchRows = Flatten@Table[Module[
  {dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
    factored = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity],
    selected, denseDirection, factorDirection, denseUpdated, factorUpdated,
    directionError, updateError},
  selected = Take[batchInputs, batchSize];
  denseDirection = RecurrentUpdateDirection[dense, selected]["UpdateDirection"];
  factorDirection = RecurrentUpdateDirection[factored, selected]["UpdateDirection"];
  directionError = maxAbs[denseDirection -
    factorDirection["LeftFactors"].Transpose[factorDirection["RightFactors"]]];
  denseUpdated = ApplyRecurrentUpdate[dense, denseDirection, 1.*^-4,
    "ZeroDiagonal" -> zeroDiagonal];
  factorUpdated = ApplyRecurrentUpdate[factored, factorDirection, 1.*^-4,
    "ZeroDiagonal" -> zeroDiagonal, "DensifyAtStorageCrossover" -> False];
  updateError = maxAbs[denseUpdated["K"] - MaterializeRecurrentMatrix[factorUpdated]];
  <|"batchSize" -> batchSize, "zeroDiagonal" -> zeroDiagonal,
    "factorColumns" -> Last@Dimensions[factorDirection["LeftFactors"]],
    "directionMaxAbsoluteError" -> directionError,
    "updatedKMaxAbsoluteError" -> updateError,
    "pass" -> (directionError < 1.*^-9 && updateError < 1.*^-12)|>
], {zeroDiagonal, {False, True}}, {batchSize, {1, 2, 4}}];

multiStepRows = Table[Module[
  {dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
    factored = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity],
    errors = {}, denseDirection, factorDirection},
  Do[
    denseDirection = AnalyzeNetwork[dense, batchInputs[[step]]]["UpdateDirection"];
    factorDirection = AnalyzeNetwork[factored, batchInputs[[step]]]["UpdateDirection"];
    dense = ApplyRecurrentUpdate[dense, denseDirection, 1.*^-4,
      "ZeroDiagonal" -> zeroDiagonal];
    factored = ApplyRecurrentUpdate[factored, factorDirection, 1.*^-4,
      "ZeroDiagonal" -> zeroDiagonal, "DensifyAtStorageCrossover" -> False];
    AppendTo[errors, maxAbs[dense["K"] - MaterializeRecurrentMatrix[factored]]],
    {step, 1, 3}];
  <|"zeroDiagonal" -> zeroDiagonal, "steps" -> 3,
    "factorColumnsAfterSteps" -> Last@Dimensions[factored["Recurrent"]["LeftFactors"]],
    "maxAbsoluteErrorsByStep" -> errors, "pass" -> (Max[errors] < 2.*^-9)|>
], {zeroDiagonal, {False, True}}];

tinyStepResult = SettleNetwork[CreateSimplePaperNetwork[], {1., 1.},
  "IntegrationStep" -> 1.*^-12, "Tolerance" -> 1.*^-9,
  "ResidualTolerance" -> 1.*^-9, "StableIterations" -> 2,
  "MaxIterations" -> 2, "AllowUnconverged" -> True];
tinyStepRow = <|"converged" -> tinyStepResult["Converged"],
  "maxDelta" -> tinyStepResult["MaxDelta"],
  "fixedPointResidual" -> tinyStepResult["FixedPointResidual"],
  "pass" -> (!tinyStepResult["Converged"] &&
    tinyStepResult["FixedPointResidual"] > .2)|>;

unstableModel = CreateSimplePaperNetwork["CrossTalk" -> {8., 8.}];
unstableInput = {-4., -4.};
unstableExact = SettleNetwork[unstableModel, unstableInput,
  "InitialState" -> {.5, .5}, "Tolerance" -> 1.*^-13,
  "ResidualTolerance" -> 1.*^-13];
unstableStability = LocalStabilityReport[unstableModel, unstableInput,
  unstableExact["State"]];
unstableHigh = SettleNetwork[unstableModel, unstableInput,
  "InitialState" -> {.5001, .5001}, "Tolerance" -> 1.*^-12,
  "ResidualTolerance" -> 1.*^-12, "MaxIterations" -> 200000];
unstableLow = SettleNetwork[unstableModel, unstableInput,
  "InitialState" -> {.4999, .4999}, "Tolerance" -> 1.*^-12,
  "ResidualTolerance" -> 1.*^-12, "MaxIterations" -> 200000];
stabilityRow = <|
  "exactInitialFixedPoint" -> unstableExact["State"],
  "exactInitialFixedPointResidual" -> unstableExact["FixedPointResidual"],
  "largestContinuousTimeJacobianRealPart" -> unstableStability["LargestRealPart"],
  "locallyAsymptoticallyStable" -> unstableStability["LocallyAsymptoticallyStable"],
  "positiveUnstableModeEndpoint" -> unstableHigh["State"],
  "negativeUnstableModeEndpoint" -> unstableLow["State"],
  "positiveEndpointDistanceFromSymmetricFixedPoint" ->
    maxAbs[unstableHigh["State"] - {.5, .5}],
  "negativeEndpointDistanceFromSymmetricFixedPoint" ->
    maxAbs[unstableLow["State"] - {.5, .5}],
  "pass" -> (!unstableStability["LocallyAsymptoticallyStable"] &&
    unstableStability["LargestRealPart"] > .9 &&
    maxAbs[unstableHigh["State"] - {.5, .5}] > .4 &&
    maxAbs[unstableLow["State"] - {.5, .5}] > .4 &&
    Min[unstableHigh["State"]] > .9 && Max[unstableLow["State"]] < .1)|>;

tinyAnalysis = AnalyzeNetwork[
  CreateSimplePaperNetwork["Weights" -> {1.*^-6, 1.*^-6}], {0., 0.},
  "IntegrationStep" -> 1., "Tolerance" -> 1.*^-14,
  "ResidualTolerance" -> 1.*^-14];
saturatedModel = <|"InputSize" -> 2, "OutputSize" -> 3,
  "W" -> {{100., 0.}, {0., 1.}, {1., 0.}},
  "K" -> ConstantArray[0., {3, 3}], "Modalities" -> {},
  "Metadata" -> <|"ExcludeSelfCoupling" -> False|>|>;
saturatedAnalysis = AnalyzeNetwork[saturatedModel, {1., 0.},
  "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
  "ResidualTolerance" -> 1.*^-12];
dependentModel = Join[saturatedModel, <|"W" ->
  {{1., 1.}, {2., 2. + 1.*^-15}, {3., 3.}}|>];
dependentAnalysis = AnalyzeNetwork[dependentModel, {0., 0.},
  "PivotTolerance" -> 1.*^-13];
scaleStressRow = <|
  "tinySusceptibilityAccepted" -> !FailureQ[tinyAnalysis],
  "tinySusceptibilityConditionNumber" -> tinyAnalysis["SusceptibilityConditionNumber"],
  "saturatedDerivativeRepresentable" -> saturatedAnalysis["FirstDerivative"][[1]] > 0.,
  "saturatedObjective" -> saturatedAnalysis["Objective"],
  "nearDependentSusceptibilityRejected" -> FailureQ[dependentAnalysis],
  "pass" -> (!FailureQ[tinyAnalysis] &&
    Abs[tinyAnalysis["SusceptibilityConditionNumber"] - 1.] < 1.*^-12 &&
    saturatedAnalysis["FirstDerivative"][[1]] > 0. &&
    FailureQ[dependentAnalysis])|>;

singularDense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 6];
singularFactored0 = CreateScalablePaperNetwork[6, "MaximumRank" -> Infinity];
singularFactored = Join[singularFactored0, <|"Recurrent" -> <|
  "Representation" -> "LowRankPlusDiagonal",
  "Diagonal" -> {4., 0., 0., 0., 0., 0.},
  "LeftFactors" -> Transpose[{{-4., 0., 0., 0., 0., 0.}}],
  "RightFactors" -> Transpose[{{1., 0., 0., 0., 0., 0.}}],
  "MaximumRank" -> Infinity, "Truncations" -> 0,
  "DiscardedSingularValueMass" -> 0.|>|>];
singularDenseAnalysis = AnalyzeNetwork[singularDense, {0., 0., 0., 0.}];
singularFactorAnalysis = AnalyzeNetwork[singularFactored, {0., 0., 0., 0.}];
singularFallbackError = maxAbs[singularDenseAnalysis["Susceptibility"] -
  singularFactorAnalysis["Susceptibility"]];

rebalanceBase = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity];
rebalanceDirection = AnalyzeNetwork[rebalanceBase, First[batchInputs]]["UpdateDirection"];
rebalanceModel = ApplyRecurrentUpdate[rebalanceBase, rebalanceDirection, 1.*^-4,
  "DensifyAtStorageCrossover" -> False];
rebalanceReference = AnalyzeNetwork[rebalanceModel, batchInputs[[2]]];
rebalanceFactors = rebalanceModel["Recurrent"];
rebalanceModelScaled = Join[rebalanceModel, <|"Recurrent" ->
  Join[rebalanceFactors, <|
    "LeftFactors" -> 1.*^8 rebalanceFactors["LeftFactors"],
    "RightFactors" -> 1.*^-8 rebalanceFactors["RightFactors"]|>]|>];
rebalanceScaled = AnalyzeNetwork[rebalanceModelScaled, batchInputs[[2]]];
woodburyRow = <|
  "singularBaseDenseFallbackSusceptibilityMaxAbsoluteError" -> singularFallbackError,
  "rebalancedFactorSusceptibilityMaxAbsoluteError" ->
    maxAbs[rebalanceReference["Susceptibility"] - rebalanceScaled["Susceptibility"]],
  "rebalancedFactorObjectiveAbsoluteError" ->
    Abs[rebalanceReference["Objective"] - rebalanceScaled["Objective"]],
  "pass" -> (singularFallbackError < 1.*^-12 &&
    maxAbs[rebalanceReference["Susceptibility"] - rebalanceScaled["Susceptibility"]] <
      2.*^-10 && Abs[rebalanceReference["Objective"] -
        rebalanceScaled["Objective"]] < 2.*^-11)|>;

directionNorm[direction_Association] := Sqrt[Max[0., Tr[
  (Transpose[direction["LeftFactors"]].direction["LeftFactors"]).
  (Transpose[direction["RightFactors"]].direction["RightFactors"])]]];
criticalModel[rho_] := Module[{model, m = 18},
  model = CreateScalablePaperNetwork[m, "MaximumRank" -> Infinity];
  Join[model, <|"Recurrent" -> <|
    "Representation" -> "LowRankPlusDiagonal",
    "Diagonal" -> ConstantArray[4. rho, m],
    "LeftFactors" -> Transpose[{ConstantArray[-4. rho/m, m]}],
    "RightFactors" -> Transpose[{ConstantArray[1., m]}],
    "MaximumRank" -> Infinity, "Truncations" -> 0,
    "DiscardedSingularValueMass" -> 0.|>|>]
];
criticalRows = Table[Module[{model = criticalModel[rho], analysis,
    numericDirection, analyticDirection,
    numericNorm, analyticNorm, normDifference, matrixError},
  analysis = AnalyzeNetwork[model, ConstantArray[0., 4],
    "InitialState" -> ConstantArray[.5, 18], "IntegrationStep" -> .5,
    "Tolerance" -> 1.*^-13, "ResidualTolerance" -> 1.*^-13,
    "StableIterations" -> 2, "ReturnPhi" -> False];
  numericDirection = analysis["UpdateDirection"]["LeftFactors"].
    Transpose[analysis["UpdateDirection"]["RightFactors"]];
  analyticDirection = (1/(4 (1 - rho)))
    model["W"].LinearSolve[Transpose[model["W"]].model["W"],
      Transpose[model["W"]]];
  numericNorm = Norm[numericDirection, "Frobenius"];
  analyticNorm = 1/(2 (1 - rho));
  normDifference = Abs[numericNorm - analyticNorm]/analyticNorm;
  matrixError = Norm[numericDirection - analyticDirection, "Frobenius"]/
    Norm[analyticDirection, "Frobenius"];
  <|"rho" -> rho, "analyticGradientFrobeniusNorm" -> analyticNorm,
    "numericExactStateGradientFrobeniusNorm" -> numericNorm,
    "gradientNormRelativeDifference" -> normDifference,
    "gradientMatrixRelativeFrobeniusError" -> matrixError,
    "pass" -> (matrixError < 2.*^-10)|>
], {rho, {.9, .99, .999, .9999}}];

allRows = Join[randomRows, batchRows, multiStepRows,
  {tinyStepRow, stabilityRow, scaleStressRow, woodburyRow}, criticalRows];
allPassed = AllTrue[Lookup[allRows, "pass"], TrueQ];
report = <|
  "schema" -> "shriki-2016-repeated-adversarial-validation/v1",
  "generatedAtUtc" -> DateString[TimeZoneConvert[Now, 0],
    {"Year", "-", "Month", "-", "Day", "T", "Hour", ":", "Minute", ":", "Second", "Z"}],
  "kernel" -> $Version,
  "provenance" -> <|
    "script" -> "mathematica/verification/RepeatedValidation.wls",
    "scriptSha256" -> IntegerString[FileHash[$InputFileName, "SHA256"], 16, 64],
    "modelSource" -> "mathematica/SynesthesiaModel.wl",
    "modelSourceSha256" -> IntegerString[FileHash[
      FileNameJoin[{DirectoryName[directory], "SynesthesiaModel.wl"}],
      "SHA256"], 16, 64]|>,
  "purpose" -> "Repeated implementation audit after independent publication derivation; not a performance benchmark.",
  "allPassed" -> allPassed,
  "randomFixtureRepetitions" -> 3,
  "randomFixtureCount" -> Length[randomRows],
  "summary" -> <|
    "maximumGradientFiniteDifferenceAbsoluteError" ->
      Max[Lookup[randomRows, "gradientFiniteDifferenceMaxAbsoluteError"]],
    "maximumGradientFiniteDifferenceRelativeError" ->
      Max[Lookup[randomRows, "gradientFiniteDifferenceRelativeError"]],
    "maximumSusceptibilityFiniteDifferenceAbsoluteError" ->
      Max[Lookup[randomRows, "susceptibilityFiniteDifferenceMaxAbsoluteError"]],
    "maximumDenseFactorUpdateAbsoluteError" ->
      Max[Lookup[batchRows, "updatedKMaxAbsoluteError"]],
    "maximumCriticalGradientRelativeError" ->
      Max[Lookup[criticalRows, "gradientMatrixRelativeFrobeniusError"]]|>,
  "randomFixtures" -> randomRows,
  "batchEquivalence" -> batchRows,
  "multiStepRepresentationEquivalence" -> multiStepRows,
  "tinyStepFalseConvergenceCounterexample" -> tinyStepRow,
  "fixedPointVersusDynamicalStability" -> stabilityRow,
  "numericalScaleStress" -> scaleStressRow,
  "woodburyStress" -> woodburyRow,
  "criticalExactStateGradient" -> criticalRows
|>;

outputDirectory = FileNameJoin[{directory, "results"}];
If[!DirectoryQ[outputDirectory], CreateDirectory[outputDirectory]];
outputPath = FileNameJoin[{outputDirectory, "repeated-validation.json"}];
If[Quiet@Check[Export[outputPath, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> outputPath]; Exit[1]];
Print[ExportString[KeyTake[report,
  {"kernel", "allPassed", "randomFixtureCount", "summary"}],
  "RawJSON", "Compact" -> True]];
If[!allPassed, Exit[1]];
