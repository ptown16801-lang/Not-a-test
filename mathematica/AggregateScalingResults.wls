#!/usr/bin/env wolframscript

(* Aggregate only committed exact-model measurements.  This script performs
   no model execution and makes no approximation to the scientific model; its
   fitted exponents and runtime projections are explicitly empirical. *)

directory = DirectoryName[$InputFileName];
resultsDirectory = FileNameJoin[{directory, "benchmark-results"}];

factorNames = {
  "factorhistory-142-window10.json", "factorhistory-284.json",
  "factorhistory-568.json", "factorhistory-1136.json",
  "factorhistory-2272.json", "factorhistory-4544.json",
  "factorhistory-9088.json"
};
fartherNames = {
  "factorhistory-18176.json", "factorhistory-36352.json",
  "factorhistory-72704.json"
};
denseNames = {
  "dense-142.json", "dense-284.json", "dense-568.json",
  "dense-1136.json", "dense-2272.json", "dense-4544.json"
};

load[name_] := Import[FileNameJoin[{resultsDirectory, name}], "RawJSON"];
If[AnyTrue[Join[factorNames, fartherNames, denseNames],
    !FileExistsQ[FileNameJoin[{resultsDirectory, #}]] &],
  Print["One or more benchmark inputs are missing."]; Exit[1]];

factor = load /@ factorNames;
farther = load /@ fartherNames;
dense = load /@ denseNames;
long142 = load["factorhistory-142-train1000.json"];
critical = load["critical-slowing-142.json"];

logSlope[xs_List, ys_List] := Module[{lx, ly, mx, my},
  lx = Log[N@xs]; ly = Log[N@ys];
  mx = Mean[lx]; my = Mean[ly];
  Total[(lx - mx) (ly - my)]/Total[(lx - mx)^2]
];

nested[report_, outer_, inner_, default_: Null] := Module[{value},
  value = Lookup[report, outer, Null];
  If[AssociationQ[value], Lookup[value, inner, default], default]
];

benchmarkRow[report_] := <|
  "backend" -> report["backend"],
  "totalNeurons" -> report["totalNeurons"],
  "repeats" -> report["repeats"],
  "settleIterations" -> report["settle"]["iterations"],
  "settleMedianSeconds" -> report["settle"]["medianSeconds"],
  "objectiveMedianSecondsIncludingSettle" ->
    report["objective"]["medianSecondsIncludingSettle"],
  "gradientMedianSecondsIncludingSettleAndObjective" ->
    report["gradient"]["medianSecondsIncludingSettleAndObjective"],
  "trainingSteps" -> nested[report, "training", "steps", 0],
  "trainingSecondsPerStep" ->
    nested[report, "training", "secondsPerStep"],
  "trainingTotalSecondsIncludingValidation" ->
    nested[report, "training", "totalSecondsIncludingValidation"],
  "finalRecurrentRank" -> nested[report, "training", "recurrentRank"],
  "initialModelBytes" -> report["memory"]["modelByteCount"],
  "finalModelBytes" -> nested[report, "training", "modelByteCount"],
  "kernelPeakBytes" -> report["memory"]["kernelMaxMemoryUsedBytes"]
|>;

factorSizes = Lookup[factor, "totalNeurons"];
denseTrainingReports = Select[dense, AssociationQ[Lookup[#, "training", Null]] &];
denseTrainingSizes = Lookup[denseTrainingReports, "totalNeurons"];
denseTrainingTimes = nested[#, "training", "secondsPerStep"] & /@
  denseTrainingReports;
denseTrainingSlope = logSlope[denseTrainingSizes, denseTrainingTimes];
denseTrainingIntercept = Mean[
  Log[denseTrainingTimes] - denseTrainingSlope Log[N@denseTrainingSizes]];
denseTrainingPrediction[size_] :=
  Exp[denseTrainingIntercept] size^denseTrainingSlope;
dense4544PeakBytes = Last[dense]["memory"]["kernelMaxMemoryUsedBytes"];

critical9995 = SelectFirst[critical["results"], #["rho"] == 0.9995 &];
critical9999 = SelectFirst[critical["results"], #["rho"] == 0.9999 &];
coupleWeeksSeconds = 14 24 60 60;

summary = <|
  "schema" -> "shriki-2016-scaling-summary/v1",
  "kernel" -> long142["kernel"],
  "hardwareManifest" -> "environment.json",
  "requestedLadder" -> (benchmarkRow /@ factor),
  "fartherExactRuns" -> (benchmarkRow /@ farther),
  "denseReferenceRuns" -> (benchmarkRow /@ dense),
  "empiricalLogLogExponents" -> <|
    "factorHistoryRank0ObjectiveVsNeurons" -> logSlope[factorSizes,
      Lookup[Lookup[factor, "objective"], "medianSecondsIncludingSettle"]],
    "factorHistoryRank0GradientVsNeurons" -> logSlope[factorSizes,
      Lookup[Lookup[factor, "gradient"],
        "medianSecondsIncludingSettleAndObjective"]],
    "factorHistoryTenStepTrainingVsNeurons568Through9088" -> logSlope[
      Rest[Rest[factorSizes]],
      nested[#, "training", "secondsPerStep"] & /@ Rest[Rest[factor]]],
    "factorHistoryRank50ModelBytesVsNeurons" -> logSlope[factorSizes,
      nested[#, "training", "modelByteCount"] & /@ factor],
    "denseSettleVsNeurons284Through4544" -> logSlope[
      Lookup[Rest[dense], "totalNeurons"],
      Lookup[Lookup[Rest[dense], "settle"], "medianSeconds"]],
    "denseGradientVsNeurons284Through4544" -> logSlope[
      Lookup[Rest[dense], "totalNeurons"],
      Lookup[Lookup[Rest[dense], "gradient"],
        "medianSecondsIncludingSettleAndObjective"]],
    "denseModelBytesVsNeurons284Through4544" -> logSlope[
      Lookup[Rest[dense], "totalNeurons"],
      Lookup[Lookup[Rest[dense], "memory"], "modelByteCount"]],
    "denseMeasuredTrainingSecondsPerStep" -> denseTrainingSlope
  |>,
  "sustained142" -> <|
    "trainingSteps" -> long142["training"]["steps"],
    "seconds" -> long142["training"]["seconds"],
    "totalSecondsIncludingValidation" ->
      long142["training"]["totalSecondsIncludingValidation"],
    "secondsPerStep" -> long142["training"]["secondsPerStep"],
    "meanSettleIterations" ->
      long142["training"]["settleIterationsMean"],
    "maximumSettleIterations" ->
      long142["training"]["settleIterationsMaximum"],
    "validationObjectiveBefore" ->
      long142["training"]["validationObjectiveBefore"],
    "validationObjectiveAfter" ->
      long142["training"]["validationObjectiveAfter"],
    "experienceRelativeRatioToFourteenDays" ->
      coupleWeeksSeconds/
        long142["training"]["totalSecondsIncludingValidation"],
    "ratioCaveat" ->
      "Not a controlled speedup: the paper does not report its step count, machine, integrator, or tolerance."
  |>,
  "criticalSlowing" -> <|
    "rho09995Iterations" -> critical9995["iterations"],
    "rho09995GradientSecondsIncludingSettle" ->
      critical9995["objectiveAndGradientSecondsIncludingSettle"],
    "rho09999Iterations" -> critical9999["iterations"],
    "rho09999GradientSecondsIncludingSettle" ->
      critical9999["objectiveAndGradientSecondsIncludingSettle"],
    "projected1000IndependentRho09995EvaluationsHours" ->
      1000 critical9995["objectiveAndGradientSecondsIncludingSettle"]/3600,
    "projected1000IndependentRho09999EvaluationsHours" ->
      1000 critical9999["objectiveAndGradientSecondsIncludingSettle"]/3600,
    "projectionCaveat" ->
      "Controlled rank-one critical K; this isolates critical slowing and is not a claimed Figure 7 endpoint."
  |>,
  "denseTrainingProjection" -> <|
    "fitSizes" -> denseTrainingSizes,
    "fitSecondsPerStep" -> denseTrainingTimes,
    "fitExponent" -> denseTrainingSlope,
    "projectedSecondsPerStep" -> AssociationThread[
      ToString /@ {2272, 4544, 9088, 18176},
      denseTrainingPrediction /@ {2272, 4544, 9088, 18176}],
    "projected1000StepHours" -> AssociationThread[
      ToString /@ {2272, 4544, 9088, 18176},
      (1000 denseTrainingPrediction[#]/3600 &) /@
        {2272, 4544, 9088, 18176}],
    "projectionCaveat" ->
      "Log-log extrapolation of measured noncritical dense training; critical slowing and validation would increase these totals."
  |>,
  "denseMemoryProjection" -> <|
    "measured4544PeakBytes" -> dense4544PeakBytes,
    "projectedPeakBytesAtQuadraticScaling" -> AssociationThread[
      ToString /@ {9088, 18176},
      (dense4544PeakBytes (#/4544.)^2 &) /@ {9088, 18176}],
    "projectionCaveat" ->
      "Quadratic projection from the measured 4,544 peak; allocator and solver workspaces may differ at larger sizes."
  |>,
  "exactRepresentationBoundary" -> AssociationThread[
    ToString /@ {142, 284, 568, 1136, 2272, 4544, 9088, 18176},
    (Ceiling[#/5.] &) /@ {142, 284, 568, 1136, 2272, 4544, 9088, 18176}],
  "largestExactExecutedNeurons" -> Max[Lookup[farther, "totalNeurons"]]
|>;

jsonPath = FileNameJoin[{resultsDirectory, "scaling-summary.json"}];
csvPath = FileNameJoin[{resultsDirectory, "scaling-measurements.csv"}];
Export[jsonPath, summary, "RawJSON"];

rows = benchmarkRow /@ Join[factor, farther, dense];
headers = Keys[First[rows]];
Export[csvPath, Prepend[Lookup[rows, headers], headers], "CSV"];
Print[ExportString[summary, "RawJSON", "Compact" -> True]];
