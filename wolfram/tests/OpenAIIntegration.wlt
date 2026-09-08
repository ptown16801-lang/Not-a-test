(* Non-network security/contract tests. Live tests are opt-in. *)

projectRoot = DirectoryName[DirectoryName[DirectoryName[$InputFileName]]];
Get[FileNameJoin[{projectRoot, "wolfram", "NeuralEngineSchemas.wl"}]];
Get[FileNameJoin[{projectRoot, "wolfram", "NeuralEngineOpenAI.wl"}]];
Get[FileNameJoin[{projectRoot, "wolfram", "NeuralEngineTools.wl"}]];

VerificationTest[NeuralEngineOpenAI`NESelectModel["Routine"], "gpt-5.6-luna", TestID -> "routine-model-routing"];
VerificationTest[NeuralEngineOpenAI`NESelectModel["Moderate"], "gpt-5.6-terra", TestID -> "moderate-model-routing"];
VerificationTest[NeuralEngineOpenAI`NESelectModel["Difficult"], "gpt-5.6-sol", TestID -> "difficult-model-routing"];

VerificationTest[
  Sort[Keys[NeuralEngineTools`NEApprovedToolSpecifications[]]],
  Sort[{"run_forward_simulation", "calculate_fixed_point", "calculate_stability",
    "calculate_analytic_gradient", "compare_gradients", "population_statistics"}],
  TestID -> "approved-tool-allowlist"
];

VerificationTest[
  FailureQ@NeuralEngineTools`NEExecuteApprovedTool[
    <|"tool" -> "ToExpression", "arguments" -> <|"code" -> "Run[\"sh\"]"|>|>,
    <|"model" -> <||>, "input" -> {}|>],
  True,
  TestID -> "arbitrary-evaluation-rejected"
];

validAnalysis = <|
  "schema_version" -> NeuralEngineSchemas`$NEGPTAnalysisSchemaVersion,
  "assessment" -> "No anomaly demonstrated by supplied evidence.",
  "confidence" -> .9,
  "anomalies" -> {},
  "scientific_concerns" -> {},
  "recommended_tests" -> {},
  "interpretation" -> "Interpretation only; no replacement for computation.",
  "requires_followup" -> False
|>;

VerificationTest[NeuralEngineSchemas`NEValidateGPTAnalysis[validAnalysis], True,
  TestID -> "valid-analysis-contract"];
VerificationTest[
  FailureQ@NeuralEngineSchemas`NEValidateGPTAnalysis[Join[validAnalysis, <|"confidence" -> 1.5|>]],
  True,
  TestID -> "invalid-confidence-rejected"];
VerificationTest[
  AssociationQ@NeuralEngineOpenAI`NEEstimateAPICost[
    <|"input_tokens" -> 1000, "cached_input_tokens" -> 0, "output_tokens" -> 500|>,
    "gpt-5.6-sol"],
  True,
  TestID -> "cost-estimator-returns-record"];

If[Environment["NE_RUN_LIVE_OPENAI_TESTS"] === "1",
  VerificationTest[
    Lookup[NeuralEngineOpenAI`NEOpenAIConnect["Probe" -> True], "REST", <||>]["probe_status"],
    "verified",
    TestID -> "live-rest-connectivity"]
];
