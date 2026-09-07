#!/usr/bin/env wolframscript

(* One reproducible exact-model benchmark point. No finite-rank compression,
   sparsity, clipping, derivative floor, or altered learning rule is used. *)

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{directory, "SynesthesiaModel.wl"}]];

arguments = Rest[$ScriptCommandLine];
argumentValue[name_, default_] := Module[{prefix = "--" <> name <> "=", match},
  match = SelectFirst[arguments, StringStartsQ[#, prefix] &, Missing["NotFound"]];
  If[MissingQ[match], default, StringDrop[match, StringLength[prefix]]]
];
parsePositiveInteger[value_] := If[
  StringMatchQ[value, DigitCharacter ..] && FromDigits[value] > 0,
  FromDigits[value], $Failed];
parseNonNegativeInteger[value_] := If[
  StringMatchQ[value, DigitCharacter ..], FromDigits[value], $Failed];

total = parsePositiveInteger[argumentValue["total", "142"]];
repeats = parsePositiveInteger[argumentValue["repeats", "5"]];
trainingSteps = parseNonNegativeInteger[argumentValue["training-steps", "5"]];
validationSamples = parsePositiveInteger[argumentValue["validation-samples", "4"]];
backend = argumentValue["backend", "Dense"];
output = ExpandFileName@argumentValue["output", FileNameJoin[{directory,
    "benchmark-results", ToLowerCase[backend] <> "-" <>
      argumentValue["total", "142"] <> ".json"}]];

If[total === $Failed || total < 6 || OddQ[total] || repeats === $Failed ||
    trainingSteps === $Failed || validationSamples === $Failed ||
    !MemberQ[{"Dense", "FactorHistory"}, backend],
  Print["Use an even --total>=6, positive --repeats, non-negative --training-steps, and --backend=Dense|FactorHistory."];
  Exit[2]
];
If[!DirectoryQ[DirectoryName[output]],
  CreateDirectory[DirectoryName[output], CreateIntermediateDirectories -> True]];

model = If[backend === "Dense",
  CreateTwoModalityPaperNetwork["TotalNeurons" -> total,
    "InitialRecurrentScale" -> 0., "ExcludeSelfCoupling" -> False,
    "RecurrentRepresentation" -> "Dense"],
  CreateScalablePaperNetwork[total, "MaximumRank" -> Infinity,
    "ExcludeSelfCoupling" -> False]
];
If[FailureQ[model], Print[model]; Exit[1]];

sampler = CreatePaperInputSampler["MeanRadii" -> {.2, 2.}, "Seed" -> 8675309];
probe = sampler["Next"][0, 0];
settleOptions = {"Method" -> "Euler", "IntegrationStep" -> .5,
  "Tolerance" -> 1.*^-9, "StableIterations" -> 2,
  "MaxIterations" -> 200000};
analysisOptions = Join[settleOptions, {"DerivativeFloor" -> 0.,
  "PivotTolerance" -> 1.*^-13, "ReturnPhi" -> False}];
trainingAnalysisOptions = DeleteCases[analysisOptions, "ReturnPhi" -> _];

SetAttributes[measureRepeated, HoldFirst];
measureRepeated[expression_] := Module[{times, value},
  expression; (* untimed warm-up *)
  times = Table[AbsoluteTiming[value = expression;][[1]], {repeats}];
  <|"seconds" -> times, "medianSeconds" -> Median[times],
    "minimumSeconds" -> Min[times], "result" -> value|>
];

memoryAtStart = MemoryInUse[];
settleMeasurement = measureRepeated[
  SettleNetwork[model, probe, Sequence @@ settleOptions]];
If[FailureQ[settleMeasurement["result"]],
  Print[settleMeasurement["result"]]; Exit[1]];
memoryAfterSettle = MemoryInUse[];

objectiveMeasurement = measureRepeated[
  AnalyzeNetwork[model, probe, "Gradient" -> False,
    Sequence @@ analysisOptions]];
If[FailureQ[objectiveMeasurement["result"]],
  Print[objectiveMeasurement["result"]]; Exit[1]];
memoryAfterObjective = MemoryInUse[];

gradientMeasurement = measureRepeated[
  AnalyzeNetwork[model, probe, "Gradient" -> True,
    Sequence @@ analysisOptions]];
If[FailureQ[gradientMeasurement["result"]],
  Print[gradientMeasurement["result"]]; Exit[1]];
memoryAfterGradient = MemoryInUse[];

gradientResult = gradientMeasurement["result"];
direction = gradientResult["UpdateDirection"];
directionStorage = If[AssociationQ[direction],
  Total[ByteCount /@ Lookup[direction, {"LeftFactors", "RightFactors"}]],
  ByteCount[direction]];

training = Missing["NotRequested"];
trainingSeconds = 0.;
validationBefore = Missing["NotRequested"];
validationInputs = {};
If[trainingSteps > 0,
  trainingSampler = CreatePaperInputSampler["MeanRadii" -> {.2, 2.},
    "Seed" -> 424242];
  validationSampler = CreatePaperInputSampler["MeanRadii" -> {.2, 2.},
    "Seed" -> 515151];
  validationInputs = Table[validationSampler["Next"][0, i],
    {i, validationSamples}];
  validationBeforeSeconds = AbsoluteTiming[
    validationBefore = Mean[InfomaxObjective[model, #,
        Sequence @@ trainingAnalysisOptions] & /@ validationInputs];
  ][[1]];
  trainingSeconds = AbsoluteTiming[
    training = TrainNetwork[model, trainingSampler,
      "Steps" -> trainingSteps, "BatchSize" -> 1,
      "LearningRate" -> 1.5*^-4, "Policy" -> "fixed-best",
      "RestoreBest" -> False, "ZeroDiagonal" -> False,
      "GradientClip" -> Infinity, "MaxAbsWeight" -> Infinity,
      "MaximumRank" -> Infinity, Sequence @@ trainingAnalysisOptions];
  ][[1]];
  If[FailureQ[training], Print[training]; Exit[1]]
];
memoryAfterTraining = MemoryInUse[];

(* Report exact recurrent statistics without forcing an exact factor-history
   model through an otherwise unnecessary M-by-M materialization.  The
   Frobenius identity is

     ||D + L R^T||_F^2 = ||D||_2^2
       + 2 D . diag(L R^T)
       + tr[(L^T L) (R^T R)].

   A global maximum would require inspecting all M^2 entries; it is therefore
   reported only for an already-dense model. *)
exactRecurrentStatistics[network_] := Module[
  {matrix, recurrent, diagonal, left, right, recurrentDiagonal,
    frobeniusSquared},
  If[KeyExistsQ[network, "K"],
    matrix = network["K"];
    Return[<|
      "frobeniusNorm" -> Norm[matrix, "Frobenius"],
      "sum" -> Total[Flatten[matrix]],
      "maximumAbsolute" -> Max[Abs[Flatten[matrix]]],
      "maximumAbsoluteAvailable" -> True,
      "diagonalMaximumAbsolute" -> Max[Abs[Diagonal[matrix]]]
    |>]
  ];
  recurrent = network["Recurrent"];
  diagonal = recurrent["Diagonal"];
  left = recurrent["LeftFactors"];
  right = recurrent["RightFactors"];
  recurrentDiagonal = diagonal + If[Last@Dimensions[left] == 0,
    ConstantArray[0., Length[diagonal]], Total[left right, {2}]];
  frobeniusSquared = Total[diagonal^2];
  If[Last@Dimensions[left] > 0,
    frobeniusSquared += 2 diagonal . Total[left right, {2}] +
      Tr[(Transpose[left].left).(Transpose[right].right)]];
  <|
    "frobeniusNorm" -> Sqrt[Max[0., frobeniusSquared]],
    "sum" -> Total[diagonal] + If[Last@Dimensions[left] == 0, 0.,
      Total[Total[left, {1}] Total[right, {1}]]],
    "maximumAbsolute" -> Null,
    "maximumAbsoluteAvailable" -> False,
    "diagonalMaximumAbsolute" -> Max[Abs[recurrentDiagonal]]
  |>
];

trainingSummary = If[trainingSteps == 0, Null, Module[
  {history, trainedModel, recurrentStatistics, validationAfter,
    validationAfterSeconds},
  history = training["History"]; trainedModel = training["Model"];
  validationAfterSeconds = AbsoluteTiming[
    validationAfter = Mean[InfomaxObjective[trainedModel, #,
        Sequence @@ trainingAnalysisOptions] & /@ validationInputs];
  ][[1]];
  recurrentStatistics = exactRecurrentStatistics[trainedModel];
  <|"steps" -> trainingSteps, "seconds" -> trainingSeconds,
    "secondsPerStep" -> trainingSeconds/trainingSteps,
    "objectiveFirst" -> First[history]["Objective"],
    "objectiveLast" -> Last[history]["Objective"],
    "settleIterationsMean" -> Mean[Lookup[history, "MeanSettleIterations"]],
    "settleIterationsMaximum" -> Max[Lookup[history, "MeanSettleIterations"]],
    "recurrentRank" -> If[KeyExistsQ[trainedModel, "Recurrent"],
      Last@Dimensions[trainedModel["Recurrent"]["LeftFactors"]], total],
    "truncations" -> If[KeyExistsQ[trainedModel, "Recurrent"],
      trainedModel["Recurrent"]["Truncations"], 0],
    "finalRepresentation" -> If[KeyExistsQ[trainedModel, "Recurrent"],
      "FactorHistory", "Dense"],
    "validationSamples" -> validationSamples,
    "validationObjectiveBefore" -> validationBefore,
    "validationObjectiveAfter" -> validationAfter,
    "validationSecondsBefore" -> validationBeforeSeconds,
    "validationSecondsAfter" -> validationAfterSeconds,
    "totalSecondsIncludingValidation" -> trainingSeconds +
      validationBeforeSeconds + validationAfterSeconds,
    "recurrentFrobeniusNorm" -> recurrentStatistics["frobeniusNorm"],
    "recurrentSum" -> recurrentStatistics["sum"],
    "recurrentMaximumAbsolute" -> recurrentStatistics["maximumAbsolute"],
    "recurrentMaximumAbsoluteAvailable" ->
      recurrentStatistics["maximumAbsoluteAvailable"],
    "recurrentDiagonalMaximumAbsolute" ->
      recurrentStatistics["diagonalMaximumAbsolute"],
    "modelByteCount" -> ByteCount[trainedModel]|>
]];

report = <|
  "schema" -> "shriki-2016-exact-benchmark-point/v1",
  "kernel" -> $Version, "backend" -> backend,
  "totalNeurons" -> total, "inputNeurons" -> 4,
  "neuronsPerModality" -> total/2,
  "exactness" -> <|
    "finiteRankCompression" -> False, "sparsification" -> False,
    "gradientClipping" -> False, "weightClipping" -> False,
    "derivativeFloor" -> 0., "zeroDiagonalConstraint" -> False,
    "initialization" -> "exact-zero condition"|>,
  "numericalPolicy" -> <|"method" -> "synchronous explicit Euler",
    "integrationStepInTauUnits" -> .5, "deltaTolerance" -> 1.*^-9,
    "stableIterations" -> 2, "maxIterations" -> 200000|>,
  "repeats" -> repeats, "probe" -> probe,
  "settle" -> <|"seconds" -> settleMeasurement["seconds"],
    "medianSeconds" -> settleMeasurement["medianSeconds"],
    "minimumSeconds" -> settleMeasurement["minimumSeconds"],
    "iterations" -> settleMeasurement["result"]["Iterations"],
    "fixedPointResidual" -> settleMeasurement["result"]["FixedPointResidual"]|>,
  "objective" -> <|"secondsIncludingSettle" -> objectiveMeasurement["seconds"],
    "medianSecondsIncludingSettle" -> objectiveMeasurement["medianSeconds"],
    "value" -> objectiveMeasurement["result"]["Objective"]|>,
  "gradient" -> <|"secondsIncludingSettleAndObjective" -> gradientMeasurement["seconds"],
    "medianSecondsIncludingSettleAndObjective" -> gradientMeasurement["medianSeconds"],
    "directionStorageBytes" -> directionStorage,
    "representation" -> If[AssociationQ[direction], "exact factors", "dense matrix"]|>,
  "training" -> trainingSummary,
  "memory" -> <|"modelByteCount" -> ByteCount[model],
    "startBytes" -> memoryAtStart, "afterSettleBytes" -> memoryAfterSettle,
    "afterObjectiveBytes" -> memoryAfterObjective,
    "afterGradientBytes" -> memoryAfterGradient,
    "afterTrainingBytes" -> memoryAfterTraining,
    "kernelMaxMemoryUsedBytes" -> MaxMemoryUsed[]|>|>;

If[Quiet@Check[Export[output, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> output]; Exit[1]];
Print[ExportString[KeyTake[report, {"backend", "totalNeurons", "settle",
  "objective", "gradient", "training", "memory"}], "RawJSON", "Compact" -> True]];
