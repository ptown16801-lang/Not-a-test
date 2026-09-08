(* ::Package:: *)

BeginPackage["NeuralEngineOpenAI`"];

NEOpenAIConnect::usage = "NEOpenAIConnect[] inspects or probes NativeLLM, ServiceConnect, and direct REST OpenAI backends without exposing credentials.";
NEOpenAIRequest::usage = "NEOpenAIRequest[payload] sends one bounded OpenAI request and logs token usage and estimated cost.";
NEAnalyzeExperiment::usage = "NEAnalyzeExperiment[result] sends a validated compact scientific result to OpenAI and requires a structured scientific-analysis response.";
NERequestFollowup::usage = "NERequestFollowup[result,analysis,context] lets the model request only approved Mathematica tools.";
NERunToolLoop::usage = "NERunToolLoop[result,context] performs a bounded analysis/tool loop with approved calculations only.";
NEEstimateAPICost::usage = "NEEstimateAPICost[usage,model] estimates token cost from dated project pricing metadata.";
NELogAPIInteraction::usage = "NELogAPIInteraction[record] appends a redacted JSONL interaction record and updates the cost ledger.";
NEValidateResponse::usage = "NEValidateResponse[response] validates an OpenAI scientific-analysis payload.";
NESelectModel::usage = "NESelectModel[class] routes Routine, Moderate, or Difficult scientific work to the configured OpenAI model.";
$NEOpenAIPricing::usage = "$NEOpenAIPricing contains the dated pricing table used for cost estimates.";

Begin["`Private`"];

$NEPackageDirectory = DirectoryName[$InputFileName];
$NEProjectRoot = DirectoryName[$NEPackageDirectory];
Get[FileNameJoin[{$NEPackageDirectory, "NeuralEngineSchemas.wl"}]];
Get[FileNameJoin[{$NEPackageDirectory, "NeuralEngineTools.wl"}]];

$NEOpenAIPricing = <|
  "as_of" -> "2026-09-07",
  "currency" -> "USD",
  "per_million_tokens" -> <|
    "gpt-5.6-luna" -> <|"input" -> 0.20, "cached_input" -> 0.02, "output" -> 1.20|>,
    "gpt-5.6-terra" -> <|"input" -> 2.00, "cached_input" -> 0.20, "output" -> 12.00|>,
    "gpt-5.6-sol" -> <|"input" -> 4.00, "cached_input" -> 0.40, "output" -> 20.00|>
  |>,
  "long_context_threshold_input_tokens" -> 272000,
  "long_context_input_multiplier" -> 2.0,
  "long_context_output_multiplier" -> 1.5,
  "qualification" -> "Estimate from published token prices; cache-write surcharges cannot be inferred from ordinary response usage alone."
|>;

$NEScientificInstructions = StringRiffle[{
  "You are the scientific observer for the Neural Engine project.",
  "Mathematica/Wolfram Language is the numerical and symbolic authority.",
  "Analyze only evidence supplied in the experiment result or approved tool outputs.",
  "Never fabricate, estimate, or silently replace a Mathematica result when an exact calculation is available.",
  "Distinguish measurement, mathematical derivation, interpretation, hypothesis, and unresolved uncertainty.",
  "Identify numerical instability, missing verification, anomalous behavior, and useful follow-up tests.",
  "A model interpretation is a research artifact, not scientific evidence by itself.",
  "Keep recommendations specific enough to map to an approved calculation."
}, "\n"];

ClearAll[openAIFailure, secretStringQ, getAPIKey, sanitize, logPath, ledgerPath,
  responseJSON, responseText, responseToolCalls, usageRecord, readCostLedger,
  updateCostLedger, projectCostFromLog, ensureBudget, restRequest, parseAnalysisText,
  modelPrice, conservativeRequestCost];
openAIFailure[tag_, message_, data_: <||>] :=
  Failure[tag, Join[<|"MessageTemplate" -> message|>, data]];
secretStringQ[value_] := StringQ[value] && StringLength[StringTrim[value]] >= 20;

getAPIKey[explicit_] := Module[{credential, env},
  If[secretStringQ[explicit], Return[explicit]];
  credential = Quiet@Check[SystemCredential["OPENAI_API_KEY"], $Failed];
  If[secretStringQ[credential], Return[credential]];
  env = Quiet@Check[Environment["OPENAI_API_KEY"], $Failed];
  If[secretStringQ[env], Return[env]];
  openAIFailure["MissingCredential",
    "No OpenAI API key was found in SystemCredential[\"OPENAI_API_KEY\"] or OPENAI_API_KEY."]
];

sanitize[value_] := value /. {
  Rule["Authorization", _] :> Rule["Authorization", "Bearer <redacted>"],
  Rule["api_key", _] :> Rule["api_key", "<redacted>"],
  Rule["APIKey", _] :> Rule["APIKey", "<redacted>"]
};

logPath[] := FileNameJoin[{$NEProjectRoot, "logs", "api", "openai-interactions.jsonl"}];
ledgerPath[] := FileNameJoin[{$NEProjectRoot, "logs", "api", "cost-ledger.json"}];

responseJSON[http_HTTPResponse] := Quiet@Check[ImportString[http["Body"], "RawJSON"], $Failed];
responseText[response_Association] := Module[{content},
  content = Cases[Lookup[response, "output", {}],
    item_Association /; Lookup[item, "type", ""] === "message" :>
      Cases[Lookup[item, "content", {}],
        c_Association /; Lookup[c, "type", ""] === "output_text" :> Lookup[c, "text", ""], Infinity],
    Infinity];
  StringJoin@Flatten@content
];
responseToolCalls[response_Association] := Cases[
  Lookup[response, "output", {}],
  item_Association /; Lookup[item, "type", ""] === "function_call" :>
    <|"call_id" -> Lookup[item, "call_id", ""], "name" -> Lookup[item, "name", ""],
      "arguments_json" -> Lookup[item, "arguments", "{}"]|>, Infinity];
usageRecord[response_Association] := Module[{u, details},
  u = Lookup[response, "usage", <||>]; details = Lookup[u, "input_tokens_details", <||>];
  <|"input_tokens" -> Lookup[u, "input_tokens", 0],
    "cached_input_tokens" -> Lookup[details, "cached_tokens", 0],
    "output_tokens" -> Lookup[u, "output_tokens", 0],
    "total_tokens" -> Lookup[u, "total_tokens", Lookup[u, "input_tokens", 0] + Lookup[u, "output_tokens", 0]]|>
];

modelPrice[model_String] := Lookup[$NEOpenAIPricing["per_million_tokens"], model, Missing["UnknownModel"]];
NEEstimateAPICost[usage_Association, model_String] := Module[
  {price, input, cached, uncached, output, inputMultiplier = 1., outputMultiplier = 1., cost},
  price = modelPrice[model];
  If[MissingQ[price], Return@openAIFailure["UnknownModelPricing", "No cost table exists for the requested model."]];
  input = Max[0, Lookup[usage, "input_tokens", 0]];
  cached = Clip[Lookup[usage, "cached_input_tokens", 0], {0, input}];
  uncached = input - cached; output = Max[0, Lookup[usage, "output_tokens", 0]];
  If[input > $NEOpenAIPricing["long_context_threshold_input_tokens"],
    inputMultiplier = $NEOpenAIPricing["long_context_input_multiplier"];
    outputMultiplier = $NEOpenAIPricing["long_context_output_multiplier"]];
  cost = inputMultiplier ((uncached price["input"] + cached price["cached_input"])/10.^6) +
    outputMultiplier output price["output"]/10.^6;
  <|"estimated_usd" -> N[cost], "input_tokens" -> input, "cached_input_tokens" -> cached,
    "output_tokens" -> output, "long_context_pricing" -> (inputMultiplier > 1.),
    "pricing_as_of" -> $NEOpenAIPricing["as_of"],
    "qualification" -> $NEOpenAIPricing["qualification"]|>
];
conservativeRequestCost[payload_Association, model_String] := Module[{chars, maxOutput},
  chars = StringLength[ExportString[payload, "RawJSON", "Compact" -> True]];
  maxOutput = Max[0, Lookup[payload, "max_output_tokens", 0]];
  NEEstimateAPICost[<|"input_tokens" -> chars, "cached_input_tokens" -> 0,
    "output_tokens" -> maxOutput|>, model]
];

readCostLedger[] := Module[{path = ledgerPath[], value},
  If[!FileExistsQ[path],
    Return@<|"schema" -> "neural-engine-openai-cost-ledger/v1",
      "pricing_as_of" -> $NEOpenAIPricing["as_of"], "project_lifetime_estimated_usd" -> 0.,
      "calls" -> 0, "daily" -> <||>, "experiments" -> <||>|>];
  value = Quiet@Check[Import[path, "RawJSON"], $Failed];
  If[AssociationQ[value], value,
    <|"schema" -> "neural-engine-openai-cost-ledger/v1",
      "pricing_as_of" -> $NEOpenAIPricing["as_of"], "project_lifetime_estimated_usd" -> 0.,
      "calls" -> 0, "daily" -> <||>, "experiments" -> <||>|>]
];
updateCostLedger[record_Association] := Module[
  {path = ledgerPath[], ledger, amount, day, experiment, daily, experiments, updated, tmp},
  ledger = readCostLedger[];
  amount = N@Lookup[Lookup[record, "cost", <||>], "estimated_usd", 0.];
  day = DateString[TimeZoneConvert[Now, 0], "ISODate"];
  experiment = ToString@Lookup[record, "experiment_id", "unspecified"];
  daily = Lookup[ledger, "daily", <||>]; experiments = Lookup[ledger, "experiments", <||>];
  daily = Join[daily, <|day -> (N@Lookup[daily, day, 0.] + amount)|>];
  experiments = Join[experiments, <|experiment -> (N@Lookup[experiments, experiment, 0.] + amount)|>];
  updated = Join[ledger, <|
    "pricing_as_of" -> $NEOpenAIPricing["as_of"],
    "updated_at_utc" -> (DateString[TimeZoneConvert[Now, 0], {"ISODate", "T", "Time"}] <> "Z"),
    "project_lifetime_estimated_usd" -> (N@Lookup[ledger, "project_lifetime_estimated_usd", 0.] + amount),
    "calls" -> (Lookup[ledger, "calls", 0] + 1), "daily" -> daily, "experiments" -> experiments|>];
  tmp = path <> ".tmp";
  Quiet@Check[Export[tmp, updated, "RawJSON"]; RenameFile[tmp, path, OverwriteTarget -> True]; updated,
    openAIFailure["LedgerFailure", "Could not update the API cost ledger."]]
];

NELogAPIInteraction[record_Association] := Module[{path = logPath[], directory, line, stream, ledger},
  directory = DirectoryName[path];
  If[!DirectoryQ[directory], CreateDirectory[directory, CreateIntermediateDirectories -> True]];
  line = ExportString[sanitize[record], "RawJSON", "Compact" -> True] <> "\n";
  stream = Quiet@Check[OpenAppend[path], $Failed];
  If[stream === $Failed, Return@openAIFailure["LogFailure", "Could not open the API interaction log."]];
  If[Quiet@Check[WriteString[stream, line]; Close[stream]; True, False] =!= True,
    Quiet@Check[Close[stream], Null]; Return@openAIFailure["LogFailure", "Could not append the API interaction log."]];
  ledger = updateCostLedger[record]; If[FailureQ[ledger], Return[ledger]];
  <|"interaction_log" -> path, "cost_ledger" -> ledgerPath[],
    "project_lifetime_estimated_usd" -> ledger["project_lifetime_estimated_usd"],
    "experiment_estimated_usd" -> Lookup[ledger["experiments"], ToString@Lookup[record, "experiment_id", "unspecified"], 0.]|>
];
projectCostFromLog[] := N@Lookup[readCostLedger[], "project_lifetime_estimated_usd", 0.];
ensureBudget[hardLimit_?NumericQ] := Module[{spent = projectCostFromLog[]},
  If[spent >= hardLimit,
    openAIFailure["HardCostLimit", "The configured project API cost limit has been reached.",
      <|"SpentUSD" -> spent, "HardLimitUSD" -> hardLimit|>],
    <|"spent_usd" -> spent, "hard_limit_usd" -> hardLimit|>]
];

NESelectModel[class_: "Moderate"] := Switch[class,
  "Routine", "gpt-5.6-luna", "Moderate", "gpt-5.6-terra", "Difficult", "gpt-5.6-sol", _, "gpt-5.6-terra"];

Options[restRequest] = {"APIKey" -> Automatic, "Timeout" -> 90};
restRequest[body_Association, OptionsPattern[]] := Module[{key, request, result},
  key = getAPIKey[OptionValue["APIKey"]]; If[FailureQ[key], Return[key]];
  request = HTTPRequest["https://api.openai.com/v1/responses", <|
    "Method" -> "POST",
    "Headers" -> {"Authorization" -> ("Bearer " <> key), "Content-Type" -> "application/json"},
    "Body" -> ExportString[body, "RawJSON", "Compact" -> True]|>];
  result = TimeConstrained[Quiet@Check[URLRead[request], $Failed], OptionValue["Timeout"], $Aborted];
  Which[
    result === $Aborted, openAIFailure["Timeout", "OpenAI request exceeded the configured timeout."],
    result === $Failed, openAIFailure["TransportFailure", "OpenAI HTTPS request failed before an HTTP response was available."],
    !MatchQ[result, _HTTPResponse], openAIFailure["TransportFailure", "OpenAI transport returned an unexpected object."],
    True, result]
];

Options[NEOpenAIConnect] = {"Probe" -> False, "APIKey" -> Automatic, "Model" -> "gpt-5.6-luna", "Timeout" -> 30};
NEOpenAIConnect[OptionsPattern[]] := Module[
  {probe = TrueQ[OptionValue["Probe"]], key, nativeAvailable, serviceAvailable, restAvailable,
    native = "not_probed", service = "not_probed", rest = "not_probed", r, json,
    nativeResult, serviceResult, standardCredentialAvailable},
  key = getAPIKey[OptionValue["APIKey"]];
  nativeAvailable = Length[Names["System`LLMSynthesize"]] > 0;
  serviceAvailable = Length[Names["System`ServiceConnect"]] > 0 && Length[Names["System`ServiceExecute"]] > 0;
  restAvailable = Length[Names["System`URLRead"]] > 0 && Length[Names["System`HTTPRequest"]] > 0;
  standardCredentialAvailable = secretStringQ[Quiet@Check[SystemCredential["OPENAI_API_KEY"], ""]] ||
    secretStringQ[Quiet@Check[Environment["OPENAI_API_KEY"], ""]];
  If[probe && FailureQ[key], Return@<|"credential" -> "missing",
    "NativeLLM" -> <|"symbol_available" -> nativeAvailable, "probe_status" -> "credential_missing"|>,
    "ServiceConnect" -> <|"symbol_available" -> serviceAvailable, "probe_status" -> "credential_missing"|>,
    "REST" -> <|"symbol_available" -> restAvailable, "probe_status" -> "credential_missing"|>|>];
  If[probe && nativeAvailable,
    nativeResult = TimeConstrained[Quiet@Check[
      LLMSynthesize["Connectivity probe. Return exactly OK.", Authentication -> key,
        LLMEvaluator -> <|"Model" -> {"OpenAI", OptionValue["Model"]}, "Temperature" -> 0|>], $Failed],
      OptionValue["Timeout"], $Aborted];
    native = Which[nativeResult === $Aborted, "timeout", nativeResult === $Failed, "failed",
      StringQ[nativeResult], <|"status" -> "verified_response_received", "response" -> StringTake[nativeResult, UpTo[128]]|>,
      True, <|"status" -> "unexpected_result", "head" -> ToString[Head[nativeResult]]|>]];
  If[probe && serviceAvailable,
    If[!standardCredentialAvailable, service = "standard_OPENAI_API_KEY_credential_required_for_ServiceConnect_probe",
      serviceResult = TimeConstrained[Quiet@Check[ServiceExecute["OpenAI", "TestConnection"], $Failed],
        OptionValue["Timeout"], $Aborted];
      service = Which[serviceResult === $Aborted, "timeout", serviceResult === $Failed, "failed",
        MatchQ[serviceResult, _Success], "verified",
        MatchQ[serviceResult, _Failure], <|"status" -> "failed", "result" -> ToString[serviceResult, InputForm]|>,
        True, <|"status" -> "response_received", "result" -> ToString[serviceResult, InputForm]|>]]];
  If[probe && restAvailable,
    r = restRequest[<|"model" -> OptionValue["Model"], "instructions" -> "Connectivity probe. Return exactly OK.",
      "input" -> "OK", "max_output_tokens" -> 8, "store" -> False|>,
      "APIKey" -> key, "Timeout" -> OptionValue["Timeout"]];
    If[FailureQ[r], rest = ToString[r, InputForm], json = responseJSON[r];
      rest = If[IntegerQ[r["StatusCode"]] && 200 <= r["StatusCode"] < 300, "verified",
        <|"http_status" -> r["StatusCode"], "response" -> json|>]]];
  <|"credential" -> If[FailureQ[key], "missing", "available"],
    "NativeLLM" -> <|"symbol_available" -> nativeAvailable, "probe_status" -> native|>,
    "ServiceConnect" -> <|"symbol_available" -> serviceAvailable, "probe_status" -> service|>,
    "REST" -> <|"symbol_available" -> restAvailable, "probe_status" -> rest|>|>
];

Options[NEOpenAIRequest] = {"Backend" -> "REST", "APIKey" -> Automatic, "Timeout" -> 90,
  "SoftWarningUSD" -> 10., "ExperimentWarningUSD" -> 25., "HardProjectLimitUSD" -> 50.,
  "ExperimentID" -> "unspecified"};
NEOpenAIRequest[payload_Association, OptionsPattern[]] := Module[
  {budget, backend = OptionValue["Backend"], http, json, status, model, usage, cost, record, log,
    preflightCost, hardLimit = N@OptionValue["HardProjectLimitUSD"]},
  budget = ensureBudget[hardLimit]; If[FailureQ[budget], Return[budget]];
  model = Lookup[payload, "model", "gpt-5.6-terra"];
  preflightCost = conservativeRequestCost[payload, model]; If[FailureQ[preflightCost], Return[preflightCost]];
  If[budget["spent_usd"] + preflightCost["estimated_usd"] > hardLimit,
    Return@openAIFailure["HardCostLimitPreflight", "Conservative maximum request cost would exceed the configured hard project limit.",
      <|"SpentUSD" -> budget["spent_usd"], "ConservativeRequestUSD" -> preflightCost["estimated_usd"], "HardLimitUSD" -> hardLimit|>]];
  If[backend =!= "REST", Return@openAIFailure["BackendNotVerified",
    "Production scientific requests are pinned to direct REST until NativeLLM and ServiceConnect pass live-kernel verification.",
    <|"RequestedBackend" -> backend|>]];
  http = restRequest[payload, "APIKey" -> OptionValue["APIKey"], "Timeout" -> OptionValue["Timeout"]];
  If[FailureQ[http], Return[http]]; status = http["StatusCode"]; json = responseJSON[http];
  If[json === $Failed, Return@openAIFailure["MalformedJSON", "OpenAI returned a response body that was not valid JSON.", <|"HTTPStatus" -> status|>]];
  usage = usageRecord[json]; cost = NEEstimateAPICost[usage, model];
  record = <|"timestamp" -> (DateString[TimeZoneConvert[Now, 0], {"ISODate", "T", "Time"}] <> "Z"),
    "experiment_id" -> OptionValue["ExperimentID"], "backend" -> backend, "model" -> model,
    "http_status" -> status, "request" -> sanitize[payload], "response_id" -> Lookup[json, "id", Null],
    "response_status" -> Lookup[json, "status", Null], "usage" -> usage, "cost" -> cost|>;
  log = NELogAPIInteraction[record];
  If[!(IntegerQ[status] && 200 <= status < 300), Return@openAIFailure["OpenAIHTTPError",
    "OpenAI returned a non-success HTTP status.", <|"HTTPStatus" -> status, "APIError" -> Lookup[json, "error", json], "Log" -> log|>]];
  <|"response" -> json, "usage" -> usage, "cost" -> cost, "log" -> log, "budget_before_request" -> budget,
    "warnings" -> DeleteCases[{
      If[budget["spent_usd"] >= N@OptionValue["SoftWarningUSD"], "soft_project_cost_warning", Nothing],
      If[AssociationQ[log] && log["experiment_estimated_usd"] >= N@OptionValue["ExperimentWarningUSD"], "experiment_cost_warning", Nothing]
    }, Nothing]|>
];

parseAnalysisText[response_Association] := Module[{text, parsed},
  text = responseText[response];
  If[StringLength[text] == 0, Return@openAIFailure["MissingOutputText", "OpenAI response contained no output_text item."]];
  parsed = Quiet@Check[ImportString[text, "RawJSON"], $Failed];
  If[!AssociationQ[parsed], Return@openAIFailure["MalformedAnalysis", "Structured analysis could not be parsed as a JSON object."]]; parsed
];
NEValidateResponse[response_] := NeuralEngineSchemas`NEValidateGPTAnalysis[response];

Options[NEAnalyzeExperiment] = Join[Options[NEOpenAIRequest],
  {"ReasoningClass" -> "Moderate", "Model" -> Automatic, "MaxOutputTokens" -> 2500}];
NEAnalyzeExperiment[result_Association, OptionsPattern[]] := Module[{valid, model, body, request, analysis},
  valid = NeuralEngineSchemas`NEValidateExperimentResult[result]; If[FailureQ[valid], Return[valid]];
  model = Replace[OptionValue["Model"], Automatic :> NESelectModel[OptionValue["ReasoningClass"]]];
  body = <|"model" -> model, "instructions" -> $NEScientificInstructions,
    "input" -> ExportString[result, "RawJSON", "Compact" -> True],
    "text" -> <|"format" -> <|"type" -> "json_schema", "name" -> "neural_engine_scientific_analysis",
      "strict" -> True, "schema" -> NeuralEngineSchemas`NEGPTAnalysisJSONSchema[]|>, "verbosity" -> "low"|>,
    "reasoning" -> <|"effort" -> If[OptionValue["ReasoningClass"] === "Difficult", "high", "medium"]|>,
    "max_output_tokens" -> OptionValue["MaxOutputTokens"], "prompt_cache_key" -> "neural-engine-scientific-observer-v1", "store" -> False|>;
  request = NEOpenAIRequest[body, "Backend" -> OptionValue["Backend"], "APIKey" -> OptionValue["APIKey"],
    "Timeout" -> OptionValue["Timeout"], "SoftWarningUSD" -> OptionValue["SoftWarningUSD"],
    "ExperimentWarningUSD" -> OptionValue["ExperimentWarningUSD"], "HardProjectLimitUSD" -> OptionValue["HardProjectLimitUSD"],
    "ExperimentID" -> result["experiment_id"]];
  If[FailureQ[request], Return[request]]; analysis = parseAnalysisText[request["response"]];
  If[FailureQ[analysis], Return[analysis]]; valid = NEValidateResponse[analysis]; If[FailureQ[valid], Return[valid]];
  <|"analysis" -> analysis, "usage" -> request["usage"], "cost" -> request["cost"],
    "warnings" -> request["warnings"], "response_id" -> Lookup[request["response"], "id", Null]|>
];

Options[NERequestFollowup] = Join[Options[NEOpenAIRequest],
  {"ReasoningClass" -> "Moderate", "Model" -> Automatic, "MaxOutputTokens" -> 1800}];
NERequestFollowup[result_Association, analysis_Association, context_Association, OptionsPattern[]] := Module[
  {model, body, request, calls, outputs, parsedArgs, toolResult},
  model = Replace[OptionValue["Model"], Automatic :> NESelectModel[OptionValue["ReasoningClass"]]];
  body = <|"model" -> model, "instructions" -> $NEScientificInstructions,
    "input" -> {<|"role" -> "user", "content" -> ("Experiment:\n" <> ExportString[result, "RawJSON", "Compact" -> True])|>,
      <|"role" -> "assistant", "content" -> ("Initial analysis:\n" <> ExportString[analysis, "RawJSON", "Compact" -> True])|>,
      <|"role" -> "user", "content" -> "If exact additional calculation is warranted, call only an approved tool. Otherwise make no tool call."|>},
    "tools" -> NeuralEngineTools`NEOpenAIToolDefinitions[], "tool_choice" -> "auto", "parallel_tool_calls" -> False,
    "max_output_tokens" -> OptionValue["MaxOutputTokens"], "prompt_cache_key" -> "neural-engine-scientific-observer-v1", "store" -> False|>;
  request = NEOpenAIRequest[body, "Backend" -> OptionValue["Backend"], "APIKey" -> OptionValue["APIKey"],
    "Timeout" -> OptionValue["Timeout"], "SoftWarningUSD" -> OptionValue["SoftWarningUSD"],
    "ExperimentWarningUSD" -> OptionValue["ExperimentWarningUSD"], "HardProjectLimitUSD" -> OptionValue["HardProjectLimitUSD"],
    "ExperimentID" -> result["experiment_id"]];
  If[FailureQ[request], Return[request]]; calls = responseToolCalls[request["response"]];
  outputs = Table[parsedArgs = Quiet@Check[ImportString[call["arguments_json"], "RawJSON"], $Failed];
    toolResult = If[AssociationQ[parsedArgs], NeuralEngineTools`NEExecuteApprovedTool[
      <|"tool" -> call["name"], "arguments" -> parsedArgs|>, context],
      openAIFailure["MalformedToolArguments", "Model returned invalid JSON tool arguments."]];
    <|"call_id" -> call["call_id"], "name" -> call["name"], "result" -> toolResult|>, {call, calls}];
  <|"response_id" -> Lookup[request["response"], "id", Null], "tool_calls" -> outputs,
    "usage" -> request["usage"], "cost" -> request["cost"], "warnings" -> request["warnings"]|>
];

Options[NERunToolLoop] = Join[Options[NEOpenAIRequest],
  {"MaxIterations" -> 5, "MaxFollowupTools" -> 3, "ReasoningClass" -> "Difficult", "Model" -> Automatic}];
NERunToolLoop[result_Association, context_Association, OptionsPattern[]] := Module[
  {max = OptionValue["MaxIterations"], maxTools = OptionValue["MaxFollowupTools"], iteration = 0,
    toolsUsed = 0, first, analysis, steps = {}, follow, calls},
  If[!IntegerQ[max] || !Between[max, {1, 5}] || !IntegerQ[maxTools] || !Between[maxTools, {0, 3}],
    Return@openAIFailure["InvalidLoopLimit", "MaxIterations must be 1..5 and MaxFollowupTools must be 0..3."]];
  first = NEAnalyzeExperiment[result, "Backend" -> OptionValue["Backend"], "APIKey" -> OptionValue["APIKey"],
    "Timeout" -> OptionValue["Timeout"], "SoftWarningUSD" -> OptionValue["SoftWarningUSD"],
    "ExperimentWarningUSD" -> OptionValue["ExperimentWarningUSD"], "HardProjectLimitUSD" -> OptionValue["HardProjectLimitUSD"],
    "ReasoningClass" -> OptionValue["ReasoningClass"], "Model" -> OptionValue["Model"]];
  If[FailureQ[first], Return[first]]; analysis = first["analysis"];
  AppendTo[steps, <|"iteration" -> 0, "analysis" -> analysis, "cost" -> first["cost"]|>];
  While[iteration < max - 1 && toolsUsed < maxTools && TrueQ[analysis["requires_followup"]],
    iteration++;
    follow = NERequestFollowup[result, analysis, context, "Backend" -> OptionValue["Backend"],
      "APIKey" -> OptionValue["APIKey"], "Timeout" -> OptionValue["Timeout"],
      "SoftWarningUSD" -> OptionValue["SoftWarningUSD"], "ExperimentWarningUSD" -> OptionValue["ExperimentWarningUSD"],
      "HardProjectLimitUSD" -> OptionValue["HardProjectLimitUSD"], "ReasoningClass" -> OptionValue["ReasoningClass"],
      "Model" -> OptionValue["Model"]];
    If[FailureQ[follow], Return[follow]]; calls = Take[follow["tool_calls"], UpTo[maxTools - toolsUsed]];
    toolsUsed += Length[calls]; AppendTo[steps, <|"iteration" -> iteration, "tool_calls" -> calls, "cost" -> follow["cost"]|>];
    If[Length[calls] == 0, Break[]];
    (* The approved calls are real local calculations. A live-kernel revision must verify the function_call_output
       feedback/synthesis leg before this prototype labels that final leg complete. *)
    Break[];
  ];
  <|"experiment_id" -> result["experiment_id"], "iterations" -> iteration + 1, "tools_used" -> toolsUsed,
    "steps" -> steps, "status" -> If[toolsUsed > 0,
      "approved_tools_executed_final_synthesis_pending_live_verification", "analysis_complete_no_tool_execution"]|>
];

End[];
EndPackage[];
