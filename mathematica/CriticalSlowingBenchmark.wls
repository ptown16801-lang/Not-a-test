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
residualTolerance = 1.*^-9;
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

directionFrobeniusNorm[direction_Association] := Sqrt[Max[0., Tr[
  (Transpose[direction["LeftFactors"]].direction["LeftFactors"]).
  (Transpose[direction["RightFactors"]].direction["RightFactors"])]]];
directionMatrix[direction_Association] :=
  direction["LeftFactors"].Transpose[direction["RightFactors"]];

measure[rho_] := Module[
  {model, settleSeconds, settled, exactAnalysisSeconds, exactAnalysis,
    policyAnalysisSeconds, policyAnalysis, exactGradientNorm,
    policyGradientNorm, analyticGradientNorm, analyticGradient,
    exactGradient, policyGradient, exactMatrixError, policyMatrixError},
  model = makeCriticalModel[rho];
  settleSeconds = AbsoluteTiming[
    settled = SettleNetwork[model, input,
      "InitialState" -> initialState,
      "Method" -> "Euler", "IntegrationStep" -> integrationStep,
      "Tolerance" -> tolerance, "ResidualTolerance" -> residualTolerance,
      "ConvergenceCriterion" -> "StepAndResidual",
      "StableIterations" -> stableIterations,
      "MaxIterations" -> maximumIterations];
  ][[1]];
  If[FailureQ[settled], Return[<|
    "rho" -> rho, "failure" -> ToString[settled, InputForm]|>]];
  exactAnalysisSeconds = AbsoluteTiming[
    exactAnalysis = AnalyzeNetwork[model, input, "Gradient" -> True,
      "ReturnPhi" -> False, "DerivativeFloor" -> 0.,
      "PivotTolerance" -> 1.*^-13,
      "InitialState" -> ConstantArray[.5, total],
      "Method" -> "Euler", "IntegrationStep" -> integrationStep,
      "Tolerance" -> 1.*^-13, "ResidualTolerance" -> 1.*^-13,
      "ConvergenceCriterion" -> "StepAndResidual",
      "StableIterations" -> stableIterations,
      "MaxIterations" -> maximumIterations];
  ][[1]];
  If[FailureQ[exactAnalysis], Return[<|
    "rho" -> rho, "failure" -> ToString[exactAnalysis, InputForm]|>]];
  policyAnalysisSeconds = AbsoluteTiming[
    policyAnalysis = AnalyzeNetwork[model, input, "Gradient" -> True,
      "ReturnPhi" -> False, "DerivativeFloor" -> 0.,
      "PivotTolerance" -> 1.*^-13, "InitialState" -> initialState,
      "Method" -> "Euler", "IntegrationStep" -> integrationStep,
      "Tolerance" -> tolerance, "ResidualTolerance" -> residualTolerance,
      "ConvergenceCriterion" -> "StepAndResidual",
      "StableIterations" -> stableIterations,
      "MaxIterations" -> maximumIterations];
  ][[1]];
  If[FailureQ[policyAnalysis], Return[<|
    "rho" -> rho, "failure" -> ToString[policyAnalysis, InputForm]|>]];
  exactGradientNorm = directionFrobeniusNorm[exactAnalysis["UpdateDirection"]];
  policyGradientNorm = directionFrobeniusNorm[policyAnalysis["UpdateDirection"]];
  exactGradient = directionMatrix[exactAnalysis["UpdateDirection"]];
  policyGradient = directionMatrix[policyAnalysis["UpdateDirection"]];
  analyticGradient = (1/(4 (1 - rho))) model["W"].
    LinearSolve[Transpose[model["W"]].model["W"], Transpose[model["W"]]];
  analyticGradientNorm = 1/(2 (1 - rho));
  exactMatrixError = Norm[exactGradient - analyticGradient, "Frobenius"]/
    Norm[analyticGradient, "Frobenius"];
  policyMatrixError = Norm[policyGradient - analyticGradient, "Frobenius"]/
    Norm[analyticGradient, "Frobenius"];
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
    "continuousTimeLargestJacobianRealPart" -> rho - 1.,
    "knownFixedPointLocallyAsymptoticallyStable" -> (rho < 1.),
    "exactKnownStateObjective" -> exactAnalysis["Objective"],
    "exactKnownStateObjectiveAndGradientSeconds" -> exactAnalysisSeconds,
    "analyticExactStateGradientFrobeniusNorm" -> analyticGradientNorm,
    "numericExactStateGradientFrobeniusNorm" -> exactGradientNorm,
    "numericExactStateGradientNormRelativeDifference" ->
      Abs[exactGradientNorm - analyticGradientNorm]/analyticGradientNorm,
    "numericExactStateGradientRelativeFrobeniusError" -> exactMatrixError,
    "exactGradientValidationPassed" -> (exactMatrixError < 2.*^-10),
    "policySettledObjectiveAndGradientSecondsIncludingSettle" ->
      policyAnalysisSeconds,
    "policySettledGradientFrobeniusNorm" -> policyGradientNorm,
    "policySettledGradientNormRelativeDifferenceVsExact" ->
      Abs[policyGradientNorm - analyticGradientNorm]/analyticGradientNorm,
    "policySettledGradientRelativeFrobeniusErrorVsExact" -> policyMatrixError,
    "gradientRepresentation" ->
      "five exact factor columns for one sample; algebraic rank at most five"
  |>
];

results = measure /@ rhos;
report = <|
  "schema" -> "shriki-2016-critical-slowing/v2",
  "generatedAtUtc" -> DateString[TimeZoneConvert[Now, 0],
    {"Year", "-", "Month", "-", "Day", "T", "Hour", ":", "Minute", ":", "Second", "Z"}],
  "kernel" -> $Version,
  "provenance" -> <|
    "script" -> "mathematica/CriticalSlowingBenchmark.wls",
    "scriptSha256" -> IntegerString[FileHash[$InputFileName, "SHA256"], 16, 64],
    "modelSource" -> "mathematica/SynesthesiaModel.wl",
    "modelSourceSha256" -> IntegerString[FileHash[
      FileNameJoin[{directory, "SynesthesiaModel.wl"}], "SHA256"], 16, 64]|>,
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
    "fixedPointResidualTolerance" -> residualTolerance,
    "convergenceCriterion" -> "step-and-residual",
    "stableIterations" -> stableIterations,
    "maxIterations" -> maximumIterations
  |>,
  "publicationContext" -> <|
    "reportedEarlySettlingIterations" -> {1000, 4000},
    "reportedNearCriticalSettlingIterations" -> {35000, 45000},
    "comparabilityCaveat" ->
      "The publication does not report its integration step or tolerance."
  |>,
  "interpretation" -> <|
    "settling" ->
      "Perturbed-state iterations measure critical slowing under the declared Euler policy.",
    "gradient" ->
      "The valid gradient benchmark starts at the analytically known fixed point. The tolerance-settled gradient is retained only to quantify residual amplification near criticality.",
    "crossSizeClaim" -> False|>,
  "allExactGradientValidationsPassed" ->
    AllTrue[Lookup[results, "exactGradientValidationPassed", False], TrueQ],
  "results" -> results
|>;

If[Quiet@Check[Export[output, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> output]; Exit[1]];
Print[ExportString[report, "RawJSON", "Compact" -> True]];
If[!TrueQ[report["allExactGradientValidationsPassed"]], Exit[1]];
