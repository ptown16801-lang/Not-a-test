#!/usr/bin/env wolframscript

(* Sensitivity audit for numerical and initialization details not reported by
   Shriki, Sadeh & Ward (2016). This is validation, not a speed benchmark. *)

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{DirectoryName[directory], "SynesthesiaModel.wl"}]];

count = 71; total = 2 count; seed = 271828;
base = CreateTwoModalityPaperNetwork["TotalNeurons" -> total];
randomMatrix[scale_] := BlockRandom[SeedRandom[seed];
  RandomReal[{-scale, scale}, {total, total}]];
initializedModel[scope_, scale_] := Module[{k, metadata},
  k = If[scale == 0., ConstantArray[0., {total, total}], randomMatrix[scale]];
  If[scope === "cross-talk-only",
    k[[1 ;; count, 1 ;; count]] = 0.;
    k[[count + 1 ;; total, count + 1 ;; total]] = 0.
  ];
  metadata = Join[base["Metadata"], <|
    "InitializationScope" -> scope, "InitialRecurrentScale" -> scale,
    "InitializationProvenance" ->
      "Seeded uniform sensitivity condition; target paper reports near-zero cross-talk but neither scale nor distribution."|>];
  Join[base, <|"K" -> k, "Metadata" -> metadata|>]
];

sampler = CreatePaperInputSampler["MeanRadii" -> {.2, 2.}, "Seed" -> 314159];
input = sampler["Next"][0, 0];
models = <|
  "exact-zero" -> initializedModel["all-recurrent", 0.],
  "all-recurrent-1e-5" -> initializedModel["all-recurrent", 1.*^-5],
  "cross-talk-only-1e-5" -> initializedModel["cross-talk-only", 1.*^-5]|>;

policies = Flatten@Table[<|"integrationStep" -> step,
    "tolerance" -> tolerance|>,
  {step, {1., .5, .25}}, {tolerance, {1.*^-6, 1.*^-9, 1.*^-12}}];

settleRows = Flatten@KeyValueMap[Function[{name, model}, Module[{reference},
    reference = SettleNetwork[model, input, "Method" -> "Anderson",
      "Tolerance" -> 1.*^-13, "StableIterations" -> 3,
      "MaxIterations" -> 200000];
    If[FailureQ[reference], Print[reference]; Exit[1]];
    Map[Function[policy, Module[{result},
      result = SettleNetwork[model, input, "Method" -> "Euler",
        "IntegrationStep" -> policy["integrationStep"],
        "Tolerance" -> policy["tolerance"], "StableIterations" -> 2,
        "MaxIterations" -> 200000];
      If[FailureQ[result], Print[result]; Exit[1]];
      Join[<|"initialization" -> name|>, policy, <|
        "iterations" -> result["Iterations"],
        "reportedMaxDelta" -> result["MaxDelta"],
        "fixedPointResidual" -> result["FixedPointResidual"],
        "stateMaxAbsoluteErrorVsAnderson" ->
          Max[Abs[result["State"] - reference["State"]]],
        "andersonFixedPointResidual" -> reference["FixedPointResidual"]|>]
    ]], policies]
  ]], models];

scales = {0., 1.*^-8, 1.*^-6, 1.*^-5, 1.*^-4};
initializationRows = Flatten@Table[Module[{model, analysis, direction,
    updated, updatedObjective},
    model = initializedModel[scope, scale];
    analysis = AnalyzeNetwork[model, input, "IntegrationStep" -> 1.,
      "Tolerance" -> 1.*^-12, "StableIterations" -> 2,
      "DerivativeFloor" -> 0., "ReturnPhi" -> False];
    If[FailureQ[analysis], Print[analysis]; Exit[1]];
    direction = analysis["UpdateDirection"];
    updated = ApplyRecurrentUpdate[model, direction, 1.5*^-4,
      "ZeroDiagonal" -> False];
    updatedObjective = InfomaxObjective[updated, input,
      "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
      "DerivativeFloor" -> 0.];
    <|"scope" -> scope, "scale" -> scale,
      "initialKMaxAbsolute" -> Max[Abs[Flatten[model["K"]]]],
      "objective" -> analysis["Objective"],
      "gradientFrobeniusNorm" -> Norm[direction, "Frobenius"],
      "gradientDiagonalMaxAbsolute" -> Max[Abs[Diagonal[direction]]],
      "objectiveAfterOnePublishedStep" -> updatedObjective,
      "oneStepObjectiveChange" -> updatedObjective - analysis["Objective"],
      "fixedPointResidual" -> analysis["FixedPointResidual"]|>
  ], {scope, {"all-recurrent", "cross-talk-only"}}, {scale, scales}];

summary = <|
  "maxStateErrorVsAnderson" -> Max[Lookup[settleRows,
    "stateMaxAbsoluteErrorVsAnderson"]],
  "maxFixedPointResidual" -> Max[Lookup[settleRows, "fixedPointResidual"]],
  "iterationRange" -> MinMax[Lookup[settleRows, "iterations"]],
  "allOneStepObjectivesDecreased" ->
    AllTrue[Lookup[initializationRows, "oneStepObjectiveChange"], Negative]|>;

report = <|
  "schema" -> "shriki-2016-numerical-policy-sensitivity/v1",
  "kernel" -> $Version,
  "model" -> <|"inputNeurons" -> 4, "outputNeurons" -> 142,
    "neuronsPerModality" -> 71|>,
  "authorityBoundary" -> <|
    "reported" -> {"continuous first-order dynamics", "near-zero cross-talk"},
    "unreported" -> {"integrator", "step", "tolerance", "stability window",
      "near-zero scale", "near-zero distribution", "within-modality initialization"}|>,
  "input" -> input, "summary" -> summary,
  "settlingPolicies" -> settleRows,
  "initializationConditions" -> initializationRows|>;

outputDirectory = FileNameJoin[{directory, "results"}];
If[!DirectoryQ[outputDirectory], CreateDirectory[outputDirectory]];
outputPath = FileNameJoin[{outputDirectory, "numerical-policy-sensitivity.json"}];
If[Quiet@Check[Export[outputPath, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> outputPath]; Exit[1]];
Print[ExportString[summary, "RawJSON", "Compact" -> True]];
