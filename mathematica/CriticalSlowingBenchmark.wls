#!/usr/bin/env wolframscript

(* Exact critical-slowing experiment for the published continuous recurrent
   dynamics.  No learning rule or model approximation is changed.  We choose

     K = 4 rho (I - 1 1^T/M), x = 0, s* = 1/2 1.

   Since g'(0)=1/4 for the logistic nonlinearity, the fixed-point Jacobian
   G K has eigenvalue rho on every direction orthogonal to 1.  This makes rho
   a controlled distance-to-criticality parameter while retaining the exact
   model equations.  K is stored exactly as diagonal plus rank one. *)

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{directory, "SynesthesiaModel.wl"}]];

output = FileNameJoin[{directory, "benchmark-results",
    "critical-slowing-142.json"}];
If[!DirectoryQ[DirectoryName[output]],
  CreateDirectory[DirectoryName[output], CreateIntermediateDirectories -> True]];

total = 142;
rhos = {0.9, 0.99, 0.999, 0.9995, 0.9999};
integrationStep = 0.5;
tolerance = 1.*^-9;
stableIterations = 2;
maximumIterations = 1000000;
input = ConstantArray[0., 4];
initialState = 0.5 + 0.01 Table[
    Cos[2 Pi (index - 1)/total], {index, total}];

baseModel = CreateScalablePaperNetwork[total, "MaximumRank" -> Infinity,
  "ExcludeSelfCoupling" -> False];

makeCriticalModel[rho_] := Module[{diagonal, left, right, recurrent},
  diagonal = ConstantArray[4. rho, total];
  left = Transpose[{ConstantArray[-4. rho/total, total]}];
  right = Transpose[{ConstantArray[1., total]}];
  recurrent = <|
    "Representation" -> "LowRankPlusDiagonal",
    "Diagonal" -> diagonal,
    "LeftFactors" -> left,
    "RightFactors" -> right,
    "MaximumRank" -> Infinity,
    "Truncations" -> 0,
    "DiscardedSingularValueMass" -> 0.
  |>;
  Join[baseModel, <|
    "Recurrent" -> recurrent,
    "Metadata" -> Join[baseModel["Metadata"], <|
      "CriticalSlowingConstruction" ->
        "K=4 rho (I-11^T/M), represented exactly as diagonal plus rank one",
      "Rho" -> rho
    |>]
  |>]
];

measure[rho_] := Module[
  {model, settleSeconds, settled, analysisSeconds, analysis, direction,
    gradientFrobeniusSquared},
  model = makeCriticalModel[rho];
  settleSeconds = AbsoluteTiming[
    settled = SettleNetwork[model, input,
      "InitialState" -> initialState,
      "Method" -> "Euler", "IntegrationStep" -> integrationStep,
      "Tolerance" -> tolerance, "StableIterations" -> stableIterations,
      "MaxIterations" -> maximumIterations];
  ][[1]];
  If[FailureQ[settled], Return[<|
    "rho" -> rho, "failure" -> ToString[settled, InputForm]|>]];
  analysisSeconds = AbsoluteTiming[
    analysis = AnalyzeNetwork[model, input, "Gradient" -> True,
      "ReturnPhi" -> False, "DerivativeFloor" -> 0.,
      "PivotTolerance" -> 1.*^-13,
      "InitialState" -> initialState,
      "Method" -> "Euler", "IntegrationStep" -> integrationStep,
      "Tolerance" -> tolerance, "StableIterations" -> stableIterations,
      "MaxIterations" -> maximumIterations];
  ][[1]];
  If[FailureQ[analysis], Return[<|
    "rho" -> rho, "failure" -> ToString[analysis, InputForm]|>]];
  direction = analysis["UpdateDirection"];
  gradientFrobeniusSquared = Tr[
    (Transpose[direction["LeftFactors"]].direction["LeftFactors"]).
    (Transpose[direction["RightFactors"]].direction["RightFactors"])
  ];
  <|
    "rho" -> rho,
    "distanceToCriticality" -> 1. - rho,
    "eulerLinearContraction" -> 1. - integrationStep (1. - rho),
    "iterations" -> settled["Iterations"],
    "seconds" -> settleSeconds,
    "microsecondsPerNeuronIteration" ->
      10.^6 settleSeconds/(total settled["Iterations"]),
    "reportedMaxDelta" -> settled["MaxDelta"],
    "fixedPointResidual" -> settled["FixedPointResidual"],
    "stateErrorFromKnownFixedPoint" ->
      Max[Abs[settled["State"] - 0.5]],
    "objective" -> analysis["Objective"],
    "objectiveAndGradientSecondsIncludingSettle" -> analysisSeconds,
    "gradientFrobeniusNorm" -> Sqrt[Max[0., gradientFrobeniusSquared]],
    "gradientRepresentation" -> "exact rank-five factors"
  |>
];

results = measure /@ rhos;
report = <|
  "schema" -> "shriki-2016-critical-slowing/v1",
  "kernel" -> $Version,
  "totalNeurons" -> total,
  "construction" -> <|
    "recurrentMatrix" -> "4 rho (I - 11^T/M)",
    "knownFixedPoint" -> "s=1/2 1 at x=0",
    "fixedPointJacobianSpectralRadius" -> "rho",
    "representation" -> "exact diagonal plus rank one",
    "approximation" -> False
  |>,
  "numericalPolicy" -> <|
    "method" -> "synchronous explicit Euler",
    "integrationStepInTauUnits" -> integrationStep,
    "deltaTolerance" -> tolerance,
    "stableIterations" -> stableIterations,
    "maxIterations" -> maximumIterations
  |>,
  "publicationContext" -> <|
    "reportedEarlySettlingIterations" -> {1000, 4000},
    "reportedNearCriticalSettlingIterations" -> {35000, 45000},
    "comparabilityCaveat" ->
      "The publication does not report its integration step or tolerance."
  |>,
  "results" -> results
|>;

If[Quiet@Check[Export[output, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> output]; Exit[1]];
Print[ExportString[report, "RawJSON", "Compact" -> True]];
