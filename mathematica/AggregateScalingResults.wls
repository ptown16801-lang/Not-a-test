#!/usr/bin/env wolframscript

(* Aggregate measured exact-model runs without promoting historical or
   heterogeneous experiments into controlled scaling claims. Version-1 runs
   remain historical because they predate the residual gate and fingerprints. *)

directory = DirectoryName[$InputFileName];
resultsDirectory = FileNameJoin[{directory, "benchmark-results"}];

currentLadderNames = {
  "factorhistory-142-train1000-v2.json",
  "factorhistory-284-v2.json", "factorhistory-568-v2.json",
  "factorhistory-1136-v2.json", "factorhistory-2272-v2.json",
  "factorhistory-4544-v2.json", "factorhistory-9088-v2.json"
};
currentFartherNames = {
  "factorhistory-18176-v2.json", "factorhistory-36352-v2.json",
  "factorhistory-72704-v2.json"
};
historicalFactorNames = {
  "factorhistory-142-window10.json", "factorhistory-142.json",
  "factorhistory-142-train1000.json", "factorhistory-284.json",
  "factorhistory-568.json", "factorhistory-568-train50.json",
  "factorhistory-1136.json", "factorhistory-2272.json",
  "factorhistory-4544.json", "factorhistory-9088.json",
  "factorhistory-18176.json", "factorhistory-36352.json",
  "factorhistory-72704.json"
};
historicalDenseNames = {
  "dense-142.json", "dense-284.json", "dense-568.json",
  "dense-1136.json", "dense-2272.json", "dense-4544.json"
};
criticalName = "critical-slowing-142.json";

benchmarkScriptPath = FileNameJoin[{directory, "ExactBenchmarkPoint.wls"}];
modelSourcePath = FileNameJoin[{directory, "SynesthesiaModel.wl"}];
criticalScriptPath = FileNameJoin[{directory, "CriticalSlowingBenchmark.wls"}];
benchmarkScriptSha256 = IntegerString[FileHash[benchmarkScriptPath, "SHA256"], 16, 64];
modelSourceSha256 = IntegerString[FileHash[modelSourcePath, "SHA256"], 16, 64];
criticalScriptSha256 = IntegerString[FileHash[criticalScriptPath, "SHA256"], 16, 64];
expectedCurrent = <|
  "factorhistory-142-train1000-v2.json" -> {142, 1000, 3, 16},
  "factorhistory-284-v2.json" -> {284, 10, 3, 4},
  "factorhistory-568-v2.json" -> {568, 10, 3, 4},
  "factorhistory-1136-v2.json" -> {1136, 10, 3, 4},
  "factorhistory-2272-v2.json" -> {2272, 10, 3, 4},
  "factorhistory-4544-v2.json" -> {4544, 10, 3, 4},
  "factorhistory-9088-v2.json" -> {9088, 10, 3, 4},
  "factorhistory-18176-v2.json" -> {18176, 2, 1, 1},
  "factorhistory-36352-v2.json" -> {36352, 1, 1, 1},
  "factorhistory-72704-v2.json" -> {72704, 1, 1, 1}|>;

path[name_] := FileNameJoin[{resultsDirectory, name}];
load[name_] := Import[path[name], "RawJSON"];
sha256[name_] := IntegerString[FileHash[path[name], "SHA256"], 16, 64];
nested[report_, outer_, inner_, default_: Null] := Module[{value},
  value = Lookup[report, outer, Null];
  If[AssociationQ[value], Lookup[value, inner, default], default]
];
existing[names_List] := Select[names, FileExistsQ[path[#]] &];

requiredHistorical = Join[historicalFactorNames, historicalDenseNames,
  {criticalName}];
If[AnyTrue[requiredHistorical, !FileExistsQ[path[#]] &],
  Print["One or more historical or critical-slowing inputs are missing."];
  Exit[1]
];

currentNames = existing[Join[currentLadderNames, currentFartherNames]];
missingCurrentNames = Complement[
  Join[currentLadderNames, currentFartherNames], currentNames];
allNames = DeleteDuplicates@Join[currentNames, requiredHistorical];
reports = AssociationThread[allNames, load /@ allNames];

logSlope[xs_List, ys_List] := Module[{lx, ly, mx, my},
  If[Length[xs] < 2 || Length[xs] =!= Length[ys], Return[Null]];
  lx = Log[N@xs]; ly = Log[N@ys];
  mx = Mean[lx]; my = Mean[ly];
  Total[(lx - mx) (ly - my)]/Total[(lx - mx)^2]
];

benchmarkRow[name_, cohort_] := Module[
  {report, training, representation, steps, factorColumns, rankBound,
    currentPolicy, validationBefore, validationAfter},
  report = reports[name];
  training = Lookup[report, "training", Null];
  representation = If[AssociationQ[training],
    Lookup[training, "finalRepresentation", Null], Null];
  steps = If[AssociationQ[training], Lookup[training, "steps", 0], 0];
  factorColumns = If[AssociationQ[training],
    Lookup[training, "factorColumns",
      If[representation === "FactorHistory",
        Lookup[training, "recurrentRank", Null], Null]], Null];
  rankBound = If[AssociationQ[training],
    Lookup[training, "lowRankTermAlgebraicRankUpperBound",
      If[IntegerQ[steps], Min[report["totalNeurons"], 5 steps], Null]],
    Null];
  validationBefore = If[AssociationQ[training],
    Lookup[training, "validationObjectiveBefore", Null], Null];
  validationAfter = If[AssociationQ[training],
    Lookup[training, "validationObjectiveAfter", Null], Null];
  currentPolicy = nested[report, "numericalPolicy", "convergenceCriterion"] ===
    "step-and-residual";
  <|
    "file" -> name,
    "fileSha256" -> sha256[name],
    "schema" -> report["schema"],
    "cohort" -> cohort,
    "qualification" -> If[currentPolicy,
      "current-step-and-residual-measurement",
      "historical-step-only-measurement"],
    "backend" -> report["backend"],
    "totalNeurons" -> report["totalNeurons"],
    "repeats" -> report["repeats"],
    "settleIterations" -> report["settle"]["iterations"],
    "settleFixedPointResidual" ->
      Lookup[report["settle"], "fixedPointResidual", Null],
    "settleMedianSeconds" -> report["settle"]["medianSeconds"],
    "objectiveMedianSecondsIncludingSettle" ->
      report["objective"]["medianSecondsIncludingSettle"],
    "gradientMedianSecondsIncludingSettleAndObjective" ->
      report["gradient"]["medianSecondsIncludingSettleAndObjective"],
    "trainingSteps" -> steps,
    "trainingHorizonClass" -> Which[
      steps >= 1000, "1000-update-reference-trajectory",
      steps == 10, "uniform-ten-update-window",
      0 < steps <= 2, "one-or-two-update-feasibility-probe",
      steps > 0, "other-observed-window",
      True, "analysis-only"],
    "trainingSecondsPerStep" -> If[AssociationQ[training],
      Lookup[training, "secondsPerStep", Null], Null],
    "trainingTotalSecondsIncludingValidation" -> If[AssociationQ[training],
      Lookup[training, "totalSecondsIncludingValidation", Null], Null],
    "validationObjectiveBefore" -> validationBefore,
    "validationObjectiveAfter" -> validationAfter,
    "validationObjectiveChange" -> If[
      NumericQ[validationBefore] && NumericQ[validationAfter],
      validationAfter - validationBefore, Null],
    "sizeCenteredValidationObjectiveBefore" -> If[NumericQ[validationBefore],
      validationBefore + 2 Log[report["totalNeurons"]], Null],
    "finalRepresentation" -> representation,
    "factorColumns" -> factorColumns,
    "lowRankTermAlgebraicRankUpperBound" -> rankBound,
    "initialModelBytes" -> report["memory"]["modelByteCount"],
    "finalModelBytes" -> If[AssociationQ[training],
      Lookup[training, "modelByteCount", Null], Null],
    "recurrentFrobeniusNorm" -> If[AssociationQ[training],
      Lookup[training, "recurrentFrobeniusNorm", Null], Null],
    "kernelPeakBytes" -> report["memory"]["kernelMaxMemoryUsedBytes"],
    "operatingSystemPeakResidentSetBytes" ->
      Lookup[report["memory"], "operatingSystemPeakResidentSetBytes", Null],
    "memoryMetric" ->
      "Both Wolfram allocator peak and Linux process peak resident set are retained when available.",
    "crossSizeScientificEquivalence" ->
      nested[report, "exactness", "crossSizeScientificEquivalence", False]
  |>
];

qualification[name_, cohort_] := Module[
  {report, currentPolicy, fingerprints, limitations, current, expected,
    training, residual, residualTolerance, checks, exactness, protocol,
    status},
  report = reports[name];
  current = KeyExistsQ[expectedCurrent, name];
  expected = Lookup[expectedCurrent, name, {Null, Null, Null, Null}];
  training = Lookup[report, "training", Null];
  exactness = Lookup[report, "exactness", <||>];
  protocol = Lookup[report, "experimentalProtocol", <||>];
  residual = nested[report, "settle", "fixedPointResidual"];
  residualTolerance = nested[report, "numericalPolicy",
    "fixedPointResidualTolerance"];
  currentPolicy = nested[report, "numericalPolicy", "convergenceCriterion"] ===
    "step-and-residual";
  fingerprints = AssociationQ[Lookup[report, "provenance", Null]] &&
    KeyExistsQ[report["provenance"], "scriptSha256"] &&
    KeyExistsQ[report["provenance"], "modelSourceSha256"];
  checks = <|
    "expectedCurrentFile" -> current,
    "schema" -> (Lookup[report, "schema", Null] ===
      "shriki-2016-exact-benchmark-point/v2"),
    "scriptFingerprint" -> (fingerprints &&
      report["provenance"]["scriptSha256"] === benchmarkScriptSha256),
    "modelFingerprint" -> (fingerprints &&
      report["provenance"]["modelSourceSha256"] === modelSourceSha256),
    "fileCohortIdentity" -> (Lookup[report, "totalNeurons", Null] === expected[[1]] &&
      Lookup[report, "backend", Null] === "FactorHistory" &&
      Lookup[report, "inputNeurons", Null] === 4 &&
      Lookup[report, "neuronsPerModality", Null] === expected[[1]]/2),
    "declaredHorizon" -> (AssociationQ[training] &&
      Lookup[training, "steps", Null] === expected[[2]] &&
      Lookup[report, "repeats", Null] === expected[[3]] &&
      Lookup[training, "validationSamples", Null] === expected[[4]]),
    "stepAndResidualConvergence" -> currentPolicy,
    "residualWithinDeclaredTolerance" -> (NumericQ[residual] &&
      NumericQ[residualTolerance] && residual <= residualTolerance),
    "exactnessFlags" -> (AssociationQ[exactness] &&
      Lookup[exactness, "finiteRankCompression", Null] === False &&
      Lookup[exactness, "sparsification", Null] === False &&
      Lookup[exactness, "gradientClipping", Null] === False &&
      Lookup[exactness, "weightClipping", Null] === False &&
      Lookup[exactness, "derivativeFloor", Null] == 0. &&
      Lookup[exactness, "zeroDiagonalConstraint", Null] === False &&
      Lookup[exactness, "crossSizeScientificEquivalence", Null] === False),
    "successfulFiniteTraining" -> (AssociationQ[training] &&
      Lookup[training, "truncations", Null] === 0 &&
      And @@ (NumericQ /@ Lookup[training,
        {"seconds", "secondsPerStep", "validationObjectiveBefore",
          "validationObjectiveAfter", "totalSecondsIncludingValidation"},
        {Null, Null, Null, Null, Null}])),
    "fixedExperimentalProtocol" -> (AssociationQ[protocol] &&
      Lookup[protocol, "batchSize", Null] === 1 &&
      Lookup[protocol, "learningRate", Null] == 1.5*^-4 &&
      Lookup[protocol, "restoreBest", Null] === False)
  |>;
  status = If[current && And @@ Values[checks], "current-qualified",
    "historical-qualified-only"];
  limitations = If[status === "current-qualified",
    {
      "The target paper specifies only M=142; other sizes are a declared project model-family extension.",
      "Exact factor history depends on exact-zero or explicitly low-rank initialization.",
      "Integrator, step and tolerances are project numerical policies because the paper does not report them."
    },
    {
      "Historical run predates the mandatory fixed-point-residual convergence gate.",
      "Historical run lacks complete source fingerprints.",
      "May support implementation history or exploratory timing only; it is not the current benchmark baseline."
    }];
  <|
    "file" -> name,
    "fileSha256" -> sha256[name],
    "schema" -> report["schema"],
    "cohort" -> cohort,
    "status" -> status,
    "checks" -> checks,
    "stepAndResidualConvergence" -> currentPolicy,
    "sourceFingerprintsPresent" -> fingerprints,
    "usableFor" -> If[status === "current-qualified",
      {"observed runtime", "observed memory", "declared exact-model execution"},
      {"historical context", "exploratory timing"}],
    "notUsableFor" -> {
      "controlled speedup relative to the authors",
      "a paper-specified cross-size normalization claim",
      "an evidence-free practical scaling limit"
    },
    "limitations" -> limitations
  |>
];

currentLadderExisting = Select[currentLadderNames, MemberQ[currentNames, #] &];
currentFartherExisting = Select[currentFartherNames, MemberQ[currentNames, #] &];
currentRows = benchmarkRow[#, "current"] & /@ currentLadderExisting;
fartherRows = benchmarkRow[#, "current-farther"] & /@ currentFartherExisting;
historicalRows = Join[
  benchmarkRow[#, "historical-factor"] & /@ historicalFactorNames,
  benchmarkRow[#, "historical-dense"] & /@ historicalDenseNames];

currentUniformTrainingRows = Select[currentRows,
  Lookup[#, "trainingSteps"] == 10 &&
    NumericQ[Lookup[#, "trainingSecondsPerStep"]] &];
uniformSizes = Lookup[currentUniformTrainingRows, "totalNeurons", {}];
uniformTrainingTimes = Lookup[currentUniformTrainingRows,
  "trainingSecondsPerStep", {}];
numericRange[values_List] := If[values === {} || !VectorQ[values, NumericQ],
  Null, Max[values] - Min[values]];
uniformObjectiveChanges = Lookup[currentUniformTrainingRows,
  "validationObjectiveChange", {}];
uniformCenteredObjectives = Lookup[currentUniformTrainingRows,
  "sizeCenteredValidationObjectiveBefore", {}];
uniformRecurrentNorms = Lookup[currentUniformTrainingRows,
  "recurrentFrobeniusNorm", {}];

critical = reports[criticalName];
criticalQualification = <|
  "schema" -> (Lookup[critical, "schema", Null] ===
    "shriki-2016-critical-slowing/v2"),
  "scriptFingerprint" -> (nested[critical, "provenance", "scriptSha256"] ===
    criticalScriptSha256),
  "modelFingerprint" -> (nested[critical, "provenance", "modelSourceSha256"] ===
    modelSourceSha256),
  "totalNeurons" -> (Lookup[critical, "totalNeurons", Null] === 142),
  "exactKnownStateGradients" ->
    TrueQ@Lookup[critical, "allExactGradientValidationsPassed", False]|>;
critical9995 = SelectFirst[critical["results"], Lookup[#, "rho"] == 0.9995 &];
critical9999 = SelectFirst[critical["results"], Lookup[#, "rho"] == 0.9999 &];
current142 = SelectFirst[currentRows,
  Lookup[#, "totalNeurons"] == 142 &, Null];

qualificationRows = Join[
  qualification[#, "current"] & /@ currentLadderExisting,
  qualification[#, "current-farther"] & /@ currentFartherExisting,
  qualification[#, "historical-factor"] & /@ historicalFactorNames,
  qualification[#, "historical-dense"] & /@ historicalDenseNames];

failedCurrentQualifications = Select[qualificationRows,
  MemberQ[{"current", "current-farther"}, Lookup[#, "cohort"]] &&
    Lookup[#, "status"] =!= "current-qualified" &];
If[missingCurrentNames =!= {} || failedCurrentQualifications =!= {} ||
    !And @@ Values[criticalQualification],
  Print[ExportString[<|
    "error" -> "current benchmark cohort failed qualification",
    "missing" -> missingCurrentNames,
    "failed" -> failedCurrentQualifications,
    "criticalChecks" -> criticalQualification|>,
    "RawJSON", "Compact" -> True]];
  Exit[2]
];

summary = <|
  "schema" -> "shriki-2016-scaling-summary/v2",
  "generatedAtUtc" -> DateString[TimeZoneConvert[Now, 0],
    {"Year", "-", "Month", "-", "Day", "T", "Hour", ":", "Minute", ":", "Second", "Z"}],
  "provenance" -> <|
    "script" -> "mathematica/AggregateScalingResults.wls",
    "scriptSha256" -> IntegerString[FileHash[$InputFileName, "SHA256"], 16, 64],
    "inputFiles" -> AssociationThread[allNames, sha256 /@ allNames],
    "qualifiedBenchmarkScriptSha256" -> benchmarkScriptSha256,
    "qualifiedModelSourceSha256" -> modelSourceSha256,
    "qualifiedCriticalScriptSha256" -> criticalScriptSha256
  |>,
  "claimPolicy" -> <|
    "paperSpecifiedNetworkSize" -> 142,
    "crossSizeScientificEquivalence" -> False,
    "crossSizeClassification" ->
      "scientifically motivated project model-family extension",
    "controlledSpeedupRelativeToAuthorsComputable" -> False,
    "speedupReason" ->
      "The paper reports a couple of weeks of computation but not a matched machine, update count, integrator, step, tolerance, random seed or checkpoint trajectory.",
    "practicalLimitInferenceAllowed" -> False,
    "limitReason" ->
      "Heterogeneous short horizons and one-update probes establish execution feasibility, not sustained end-to-end training limits."
  |>,
  "currentRunSetComplete" -> (missingCurrentNames === {}),
  "missingCurrentRuns" -> missingCurrentNames,
  "currentRequestedLadder" -> currentRows,
  "currentFartherRuns" -> fartherRows,
  "historicalRuns" -> historicalRows,
  "current142" -> If[AssociationQ[current142], current142, Null],
  "observedBoundaries" -> <|
    "largestCurrentRequestedLadderNeurons" -> If[currentRows === {}, Null,
      Max[Lookup[currentRows, "totalNeurons"]]],
    "largestCurrentExactExecutionNeurons" -> If[
      Join[currentRows, fartherRows] === {}, Null,
      Max[Lookup[Join[currentRows, fartherRows], "totalNeurons"]]],
    "boundaryMeaning" ->
      "Largest actually executed current run only; this is not a failure boundary or practical limit.",
    "largestHistoricalExactExecutionNeurons" ->
      Max[Lookup[historicalRows, "totalNeurons"]]
  |>,
  "empiricalScaling" -> <|
    "uniformTenUpdateSizes" -> uniformSizes,
    "uniformTenUpdateSecondsPerStep" -> uniformTrainingTimes,
    "uniformTenUpdateLogLogExponent" ->
      logSlope[uniformSizes, uniformTrainingTimes],
    "interpretation" ->
      "Descriptive fit over current ten-update factor-history runs only; factor-history cost grows with accumulated columns and this is not an asymptotic training-law estimate."
  |>,
  "circularRefinementInvariants" -> <|
    "sizes" -> uniformSizes,
    "objectiveCenteringFormula" -> "epsilon + 2 log(M)",
    "centeredValidationObjectiveBeforeRange" ->
      numericRange[uniformCenteredObjectives],
    "validationObjectiveChangeRange" ->
      numericRange[uniformObjectiveChanges],
    "recurrentFrobeniusNormAfterTenUpdatesRange" ->
      numericRange[uniformRecurrentNorms],
    "interpretation" ->
      "Observed near-invariance supports the declared circular-grid refinement on this fixed seed/window. It is evidence about this project model family, not a normalization rule reported by Shriki et al."
  |>,
  "criticalSlowing" -> <|
    "sourceFile" -> criticalName,
    "sourceFileSha256" -> sha256[criticalName],
    "qualificationChecks" -> criticalQualification,
    "allExactKnownStateGradientsValidated" ->
      Lookup[critical, "allExactGradientValidationsPassed", False],
    "rho09995Iterations" -> critical9995["iterations"],
    "rho09995ExactKnownStateObjectiveAndGradientSeconds" ->
      critical9995["exactKnownStateObjectiveAndGradientSeconds"],
    "rho09995PolicySettledObjectiveAndGradientSecondsIncludingSettle" ->
      critical9995["policySettledObjectiveAndGradientSecondsIncludingSettle"],
    "rho09999Iterations" -> critical9999["iterations"],
    "rho09999ExactKnownStateObjectiveAndGradientSeconds" ->
      critical9999["exactKnownStateObjectiveAndGradientSeconds"],
    "rho09999PolicySettledObjectiveAndGradientSecondsIncludingSettle" ->
      critical9999["policySettledObjectiveAndGradientSecondsIncludingSettle"],
    "rho09999PolicySettledGradientRelativeFrobeniusErrorVsExact" ->
      Lookup[critical9999,
        "policySettledGradientRelativeFrobeniusErrorVsExact", Null],
    "interpretation" ->
      "Controlled construction isolates critical slowing and residual amplification; it is not claimed to be a Figure 7 endpoint."
  |>,
  "exactRepresentationStorageCrossoverFactorColumns" -> AssociationThread[
    ToString /@ {142, 284, 568, 1136, 2272, 4544, 9088, 18176,
      36352, 72704},
    Ceiling[#/2.] & /@ {142, 284, 568, 1136, 2272, 4544, 9088,
      18176, 36352, 72704}],
  "batchOneStorageCrossoverUpdate" -> AssociationThread[
    ToString /@ {142, 284, 568, 1136, 2272, 4544, 9088, 18176,
      36352, 72704},
    Ceiling[(# - 1)/10.] & /@ {142, 284, 568, 1136, 2272, 4544,
      9088, 18176, 36352, 72704}],
  "representationCaveat" ->
    "For equal-precision dense arrays, two M-by-r factor arrays match one M-by-M dense array at r=M/2. This is a storage crossover, not an algebraic-rank measurement or a runtime optimum."
|>;

qualificationReport = <|
  "schema" -> "shriki-2016-benchmark-qualification/v1",
  "generatedAtUtc" -> summary["generatedAtUtc"],
  "provenance" -> summary["provenance"],
  "rules" -> summary["claimPolicy"],
  "runs" -> qualificationRows
|>;

jsonPath = FileNameJoin[{resultsDirectory, "scaling-summary.json"}];
qualificationPath = FileNameJoin[{resultsDirectory,
    "benchmark-qualification.json"}];
csvPath = FileNameJoin[{resultsDirectory, "scaling-measurements.csv"}];
Export[jsonPath, summary, "RawJSON"];
Export[qualificationPath, qualificationReport, "RawJSON"];

allRows = Join[currentRows, fartherRows, historicalRows];
If[allRows =!= {},
  headers = Keys[First[allRows]];
  csvRows = Lookup[#, headers, Null] & /@ allRows;
  csvCell[value_] := Which[
    value === Null, "",
    StringQ[value], "\"" <> StringReplace[value, "\"" -> "\"\""] <> "\"",
    TrueQ[value], "true",
    value === False, "false",
    NumericQ[value], ToString[CForm[value]],
    True, ToString[value, InputForm]
  ];
  csvText = StringRiffle[
      (StringRiffle[csvCell /@ #, ","] &) /@ Prepend[csvRows, headers], "\n"] <> "\n";
  csvStream = OpenWrite[csvPath, BinaryFormat -> False];
  WriteString[csvStream, csvText];
  Close[csvStream]
];
Print[ExportString[KeyTake[summary, {"schema", "currentRunSetComplete",
  "missingCurrentRuns", "current142", "observedBoundaries",
  "empiricalScaling", "circularRefinementInvariants", "criticalSlowing"}],
  "RawJSON", "Compact" -> True]];
