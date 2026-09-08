(* ::Package:: *)

BeginPackage["NeuralEngineSchemas`"];

$NEResultSchemaVersion::usage = "$NEResultSchemaVersion is the version tag for compact scientific experiment results.";
$NEGPTAnalysisSchemaVersion::usage = "$NEGPTAnalysisSchemaVersion is the version tag for GPT scientific-analysis responses.";
$NEToolRequestSchemaVersion::usage = "$NEToolRequestSchemaVersion is the version tag for logged Mathematica tool requests.";
NEExperimentResultJSONSchema::usage = "NEExperimentResultJSONSchema[] returns the JSON Schema for compact Neural Engine experiment results.";
NEGPTAnalysisJSONSchema::usage = "NEGPTAnalysisJSONSchema[] returns the strict JSON Schema for GPT scientific analysis.";
NEToolRequestJSONSchema::usage = "NEToolRequestJSONSchema[] returns the JSON Schema for a logged approved-tool request.";
NEValidateExperimentResult::usage = "NEValidateExperimentResult[assoc] validates a compact scientific result and returns True or Failure.";
NEValidateGPTAnalysis::usage = "NEValidateGPTAnalysis[assoc] validates a GPT scientific-analysis response and returns True or Failure.";
NEValidateToolRequest::usage = "NEValidateToolRequest[assoc] validates a logged tool request and returns True or Failure.";
NEFiniteNumberQ::usage = "NEFiniteNumberQ[x] is True only for real finite numeric values.";

Begin["`Private`"];

$NEResultSchemaVersion = "neural-engine-result-schema-v1";
$NEGPTAnalysisSchemaVersion = "neural-engine-gpt-analysis-schema-v1";
$NEToolRequestSchemaVersion = "neural-engine-tool-request-schema-v1";

ClearAll[NEFiniteNumberQ];
NEFiniteNumberQ[x_] := NumericQ[x] &&
  FreeQ[N[x], Indeterminate | ComplexInfinity | DirectedInfinity] &&
  Quiet[TrueQ[Im[N[x]] == 0]];

ClearAll[schemaFailure, requiredKeysQ, finiteTreeQ, boundedJSONQ];
schemaFailure[tag_, message_, data_: <||>] :=
  Failure[tag, Join[<|"MessageTemplate" -> message|>, data]];

requiredKeysQ[assoc_Association, keys_List] := AllTrue[keys, KeyExistsQ[assoc, #] &];

finiteTreeQ[value_] := Which[
  AssociationQ[value], AllTrue[Values[value], finiteTreeQ],
  ListQ[value], AllTrue[value, finiteTreeQ],
  NumericQ[value], NEFiniteNumberQ[value],
  MatchQ[value, _String | True | False | Null | Missing[__]], True,
  True, False
];

boundedJSONQ[value_, maxBytes_Integer] := Quiet@Check[
  StringLength[ExportString[value, "RawJSON", "Compact" -> True]] <= maxBytes,
  False
];

NEExperimentResultJSONSchema[] := <|
  "type" -> "object",
  "properties" -> <|
    "schema_version" -> <|"type" -> "string", "const" -> $NEResultSchemaVersion|>,
    "experiment_id" -> <|"type" -> "string", "minLength" -> 1, "maxLength" -> 128|>,
    "network" -> <|
      "type" -> "object",
      "properties" -> <|
        "neurons" -> <|"type" -> "integer", "minimum" -> 1, "maximum" -> 10000000|>,
        "architecture" -> <|"type" -> "string", "minLength" -> 1, "maxLength" -> 512|>,
        "seed" -> <|"type" -> {"integer", "null"}|>
      |>,
      "required" -> {"neurons", "architecture", "seed"},
      "additionalProperties" -> False
    |>,
    "test" -> <|"type" -> "string", "minLength" -> 1, "maxLength" -> 128|>,
    "results" -> <|"type" -> "object"|>,
    "anomalies" -> <|"type" -> "array", "maxItems" -> 128|>,
    "samples" -> <|"type" -> "array", "maxItems" -> 128|>,
    "provenance" -> <|
      "type" -> "object",
      "properties" -> <|
        "code_version" -> <|"type" -> "string"|>,
        "commit" -> <|"type" -> "string"|>,
        "timestamp" -> <|"type" -> "string"|>,
        "mathematica_version" -> <|"type" -> "string"|>
      |>,
      "required" -> {"code_version", "commit", "timestamp", "mathematica_version"},
      "additionalProperties" -> False
    |>
  |>,
  "required" -> {"schema_version", "experiment_id", "network", "test", "results",
    "anomalies", "samples", "provenance"},
  "additionalProperties" -> False
|>;

NEGPTAnalysisJSONSchema[] := <|
  "type" -> "object",
  "properties" -> <|
    "schema_version" -> <|"type" -> "string", "const" -> $NEGPTAnalysisSchemaVersion|>,
    "assessment" -> <|"type" -> "string"|>,
    "confidence" -> <|"type" -> "number", "minimum" -> 0., "maximum" -> 1.|>,
    "anomalies" -> <|"type" -> "array", "items" -> <|"type" -> "string"|>, "maxItems" -> 64|>,
    "scientific_concerns" -> <|"type" -> "array", "items" -> <|"type" -> "string"|>, "maxItems" -> 64|>,
    "recommended_tests" -> <|"type" -> "array", "items" -> <|"type" -> "string"|>, "maxItems" -> 32|>,
    "interpretation" -> <|"type" -> "string"|>,
    "requires_followup" -> <|"type" -> "boolean"|>
  |>,
  "required" -> {"schema_version", "assessment", "confidence", "anomalies",
    "scientific_concerns", "recommended_tests", "interpretation", "requires_followup"},
  "additionalProperties" -> False
|>;

NEToolRequestJSONSchema[] := <|
  "type" -> "object",
  "properties" -> <|
    "schema_version" -> <|"type" -> "string", "const" -> $NEToolRequestSchemaVersion|>,
    "tool" -> <|"type" -> "string", "minLength" -> 1, "maxLength" -> 128|>,
    "arguments" -> <|"type" -> "object"|>,
    "rationale" -> <|"type" -> "string", "maxLength" -> 4096|>
  |>,
  "required" -> {"schema_version", "tool", "arguments", "rationale"},
  "additionalProperties" -> False
|>;

NEValidateExperimentResult[value_] := Module[{keys, network, provenance},
  If[!AssociationQ[value], Return@schemaFailure["InvalidResult", "Experiment result must be an Association."]];
  keys = {"schema_version", "experiment_id", "network", "test", "results", "anomalies", "samples", "provenance"};
  If[!requiredKeysQ[value, keys] || Sort[Keys[value]] =!= Sort[keys],
    Return@schemaFailure["InvalidResultKeys", "Experiment result keys do not match the v1 contract."]];
  If[value["schema_version"] =!= $NEResultSchemaVersion,
    Return@schemaFailure["InvalidResultVersion", "Experiment result schema version is unsupported."]];
  network = value["network"]; provenance = value["provenance"];
  If[!AssociationQ[network] || !requiredKeysQ[network, {"neurons", "architecture", "seed"}],
    Return@schemaFailure["InvalidNetwork", "Network metadata is incomplete."]];
  If[!IntegerQ[network["neurons"]] || !Between[network["neurons"], {1, 10000000}],
    Return@schemaFailure["InvalidNeuronCount", "Neuron count is outside the allowed range."]];
  If[!(IntegerQ[network["seed"]] || network["seed"] === Null),
    Return@schemaFailure["InvalidSeed", "Seed must be an integer or Null."]];
  If[!AssociationQ[value["results"]] || !ListQ[value["anomalies"]] || !ListQ[value["samples"]],
    Return@schemaFailure["InvalidPayload", "Results must be an Association; anomalies and samples must be Lists."]];
  If[Length[value["anomalies"]] > 128 || Length[value["samples"]] > 128,
    Return@schemaFailure["OversizedPayload", "Anomaly or sample count exceeds the v1 limit."]];
  If[!AssociationQ[provenance] || !requiredKeysQ[provenance,
      {"code_version", "commit", "timestamp", "mathematica_version"}],
    Return@schemaFailure["InvalidProvenance", "Provenance metadata is incomplete."]];
  If[!finiteTreeQ[value["results"]] || !finiteTreeQ[value["samples"]],
    Return@schemaFailure["NonFiniteResult", "Scientific result contains a non-finite or unsupported value."]];
  If[!boundedJSONQ[value, 1000000],
    Return@schemaFailure["OversizedPayload", "Compact experiment JSON exceeds 1 MB."]];
  True
];

NEValidateGPTAnalysis[value_] := Module[{keys},
  If[!AssociationQ[value], Return@schemaFailure["InvalidAnalysis", "GPT analysis must be an Association."]];
  keys = {"schema_version", "assessment", "confidence", "anomalies", "scientific_concerns",
    "recommended_tests", "interpretation", "requires_followup"};
  If[!requiredKeysQ[value, keys] || Sort[Keys[value]] =!= Sort[keys],
    Return@schemaFailure["InvalidAnalysisKeys", "GPT analysis keys do not match the v1 contract."]];
  If[value["schema_version"] =!= $NEGPTAnalysisSchemaVersion,
    Return@schemaFailure["InvalidAnalysisVersion", "GPT analysis schema version is unsupported."]];
  If[!NEFiniteNumberQ[value["confidence"]] || !Between[N@value["confidence"], {0., 1.}],
    Return@schemaFailure["InvalidConfidence", "Confidence must be a finite value from 0 through 1."]];
  If[!And @@ (ListQ[value[#]] & /@ {"anomalies", "scientific_concerns", "recommended_tests"}),
    Return@schemaFailure["InvalidAnalysisLists", "Analysis list fields must be Lists."]];
  If[!BooleanQ[value["requires_followup"]],
    Return@schemaFailure["InvalidFollowupFlag", "requires_followup must be Boolean."]];
  True
];

NEValidateToolRequest[value_] := Module[{keys},
  If[!AssociationQ[value], Return@schemaFailure["InvalidToolRequest", "Tool request must be an Association."]];
  keys = {"schema_version", "tool", "arguments", "rationale"};
  If[!requiredKeysQ[value, keys] || Sort[Keys[value]] =!= Sort[keys],
    Return@schemaFailure["InvalidToolRequestKeys", "Tool request keys do not match the v1 contract."]];
  If[value["schema_version"] =!= $NEToolRequestSchemaVersion || !StringQ[value["tool"]] ||
      !AssociationQ[value["arguments"]] || !StringQ[value["rationale"]],
    Return@schemaFailure["InvalidToolRequest", "Tool request contains invalid field types."]];
  If[!boundedJSONQ[value, 65536],
    Return@schemaFailure["OversizedToolRequest", "Tool request exceeds 64 KB."]];
  True
];

End[];
EndPackage[];
