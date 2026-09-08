(* ::Package:: *)

BeginPackage["NeuralEngineVerification`"];

NEBuildExperimentResult::usage = "NEBuildExperimentResult[model,input,id] runs compact deterministic verification summaries in Mathematica and builds the v1 scientific result contract.";
NEBuildGradientVerificationResult::usage = "NEBuildGradientVerificationResult[model,input,id,indices,epsilon] builds a compact analytic/finite-difference gradient verification result.";

Begin["`Private`"];

$NEPackageDirectory = DirectoryName[$InputFileName];
Get[FileNameJoin[{$NEPackageDirectory, "NeuralEngineSchemas.wl"}]];
Get[FileNameJoin[{$NEPackageDirectory, "NeuralEngineTools.wl"}]];

ClearAll[verificationFailure, provenanceRecord, resultEnvelope];
verificationFailure[tag_, message_, data_: <||>] :=
  Failure[tag, Join[<|"MessageTemplate" -> message|>, data]];

provenanceRecord[options_Association] := <|
  "code_version" -> Lookup[options, "code_version", "0.8.0"],
  "commit" -> Lookup[options, "commit", "uncommitted"],
  "timestamp" -> DateString[TimeZoneConvert[Now, 0], {"ISODate", "T", "Time"}] <> "Z",
  "mathematica_version" -> ToString[$Version]
|>;

resultEnvelope[model_, experimentId_String, test_String, results_Association, anomalies_List,
    samples_List, options_Association] := <|
  "schema_version" -> NeuralEngineSchemas`$NEResultSchemaVersion,
  "experiment_id" -> experimentId,
  "network" -> <|
    "neurons" -> Lookup[model, "OutputSize", 0],
    "architecture" -> Lookup[Lookup[model, "Metadata", <||>], "Architecture", "Neural Engine recurrent Infomax"],
    "seed" -> Lookup[options, "seed", Null]
  |>,
  "test" -> test,
  "results" -> results,
  "anomalies" -> anomalies,
  "samples" -> samples,
  "provenance" -> provenanceRecord[options]
|>;

Options[NEBuildExperimentResult] = {
  "Seed" -> Null, "CodeVersion" -> "0.8.0", "Commit" -> "uncommitted"
};
NEBuildExperimentResult[model_Association, input_List, experimentId_String, OptionsPattern[]] := Module[
  {context, fixed, stats, stability, options, result, anomalies},
  options = <|"seed" -> OptionValue["Seed"], "code_version" -> OptionValue["CodeVersion"],
    "commit" -> OptionValue["Commit"]|>;
  context = <|"model" -> model, "input" -> input|>;
  fixed = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "calculate_fixed_point", "arguments" -> <|"use_context_input" -> True|>|>, context];
  If[FailureQ[fixed], Return[fixed]];
  stats = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "population_statistics", "arguments" -> <|"use_current_state" -> True|>|>, context];
  If[FailureQ[stats], Return[stats]];
  stability = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "calculate_stability", "arguments" -> <|"use_context_input" -> True|>|>, context];
  If[FailureQ[stability], Return[stability]];
  anomalies = DeleteCases[{
    If[TrueQ[fixed["converged"]], Nothing, "fixed_point_not_converged"],
    If[TrueQ[stability["locally_asymptotically_stable"]], Nothing, "local_instability_detected"],
    If[stability["fixed_point_map_spectral_radius"] < 0.99, Nothing, "near_critical_or_slow_fixed_point_map"]
  }, Nothing];
  result = resultEnvelope[model, experimentId, "mathematica_compact_verification",
    <|"fixed_point" -> fixed, "population" -> stats, "stability" -> stability|>,
    anomalies, {}, options];
  If[TrueQ[NeuralEngineSchemas`NEValidateExperimentResult[result]], result,
    verificationFailure["InvalidGeneratedResult", "Generated experiment result failed its own schema validation."]]
];

Options[NEBuildGradientVerificationResult] = Options[NEBuildExperimentResult];
NEBuildGradientVerificationResult[model_Association, input_List, experimentId_String,
    indices_List, epsilon_: 1.*^-6, OptionsPattern[]] := Module[
  {context, fixed, comparison, stability, options, result, anomalies},
  options = <|"seed" -> OptionValue["Seed"], "code_version" -> OptionValue["CodeVersion"],
    "commit" -> OptionValue["Commit"]|>;
  context = <|"model" -> model, "input" -> input|>;
  fixed = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "calculate_fixed_point", "arguments" -> <|"use_context_input" -> True|>|>, context];
  If[FailureQ[fixed], Return[fixed]];
  comparison = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "compare_gradients", "arguments" -> <|"indices" -> indices, "epsilon" -> epsilon|>|>, context];
  If[FailureQ[comparison], Return[comparison]];
  stability = NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "calculate_stability", "arguments" -> <|"use_context_input" -> True|>|>, context];
  If[FailureQ[stability], Return[stability]];
  anomalies = DeleteCases[{
    If[comparison["relative_error"] <= 1.*^-5, Nothing, "gradient_relative_error_exceeds_1e-5"],
    If[stability["fixed_point_map_spectral_radius"] < 0.99, Nothing, "near_critical_or_slow_fixed_point_map"]
  }, Nothing];
  result = resultEnvelope[model, experimentId, "gradient_verification",
    <|"fixed_point" -> fixed, "gradient_comparison" -> comparison, "stability" -> stability|>,
    anomalies, comparison["coordinates"], options];
  If[TrueQ[NeuralEngineSchemas`NEValidateExperimentResult[result]], result,
    verificationFailure["InvalidGeneratedResult", "Generated gradient result failed its own schema validation."]]
];

End[];
EndPackage[];
