(* ::Package:: *)

BeginPackage["NeuralEngineTools`"];

NEApprovedToolSpecifications::usage = "NEApprovedToolSpecifications[] returns the only Mathematica functions GPT may request.";
NEOpenAIToolDefinitions::usage = "NEOpenAIToolDefinitions[] returns strict OpenAI function-tool definitions for the approved calculations.";
NEExecuteApprovedTool::usage = "NEExecuteApprovedTool[request, context] validates and executes one approved calculation without arbitrary Wolfram evaluation.";
NEPopulationStatistics::usage = "NEPopulationStatistics[state] returns compact finite population statistics.";
NEGradientComparison::usage = "NEGradientComparison[model,input,indices,epsilon] compares analytic and central finite-difference recurrent gradients.";

Begin["`Private`"];

$NEPackageDirectory = DirectoryName[$InputFileName];
$NEProjectRoot = DirectoryName[$NEPackageDirectory];
Get[FileNameJoin[{$NEProjectRoot, "mathematica", "SynesthesiaModel.wl"}]];

ClearAll[toolFailure, finiteNumberQ, vectorIndexQ, withTimeout];
toolFailure[tag_, message_, data_: <||>] :=
  Failure[tag, Join[<|"MessageTemplate" -> message|>, data]];
finiteNumberQ[x_] := NumericQ[x] &&
  FreeQ[N[x], Indeterminate | ComplexInfinity | DirectedInfinity] &&
  Quiet[TrueQ[Im[N[x]] == 0]];
vectorIndexQ[pair_, m_Integer] := MatchQ[pair, {_Integer, _Integer}] &&
  AllTrue[pair, Between[#, {1, m}] &];
withTimeout[expr_, seconds_Integer] :=
  TimeConstrained[expr, seconds, toolFailure["ToolTimeout", "Approved tool exceeded its time limit."]];

ClearAll[NEPopulationStatistics];
NEPopulationStatistics[state_List] := Module[{v = N@state, n, mean, variance, sd, q, saturated, sparse},
  If[!VectorQ[v, finiteNumberQ] || Length[v] == 0,
    Return@toolFailure["InvalidState", "State must be a non-empty finite numeric vector."]];
  n = Length[v]; mean = Mean[v]; variance = Variance[v]; sd = StandardDeviation[v];
  q = Quantile[v, {0., .01, .05, .25, .5, .75, .95, .99, 1.}];
  saturated = Count[v, x_ /; x <= 10.^-6 || x >= 1. - 10.^-6];
  sparse = Count[v, x_ /; Abs[x] <= 10.^-6];
  <|
    "count" -> n, "mean" -> mean, "variance" -> variance, "standard_deviation" -> sd,
    "minimum" -> First[q], "q01" -> q[[2]], "q05" -> q[[3]], "q25" -> q[[4]],
    "median" -> q[[5]], "q75" -> q[[6]], "q95" -> q[[7]], "q99" -> q[[8]],
    "maximum" -> Last[q], "saturation_fraction" -> N[saturated/n],
    "near_zero_fraction" -> N[sparse/n]
  |>
];

ClearAll[modelWithDenseWeight, centralDifferenceCoordinate, analyticGradientMatrix, NEGradientComparison];
modelWithDenseWeight[model_Association, {i_Integer, j_Integer}, value_?finiteNumberQ] := Module[{k},
  If[AssociationQ@Lookup[model, "Recurrent", None],
    Return@toolFailure["DenseOnly", "Finite-difference coordinate checks require a dense recurrent matrix."]];
  k = Lookup[model, "K", Missing["K"]];
  If[!MatrixQ[k, finiteNumberQ], Return@toolFailure["InvalidModel", "Dense recurrent matrix K is unavailable."]];
  Join[model, <|"K" -> ReplacePart[k, {i, j} -> value]|>]
];

centralDifferenceCoordinate[model_Association, input_List, pair : {i_Integer, j_Integer}, epsilon_?finiteNumberQ] :=
 Module[{base, plus, minus, lp, lm},
  base = model["K"][[i, j]];
  plus = modelWithDenseWeight[model, pair, base + epsilon];
  minus = modelWithDenseWeight[model, pair, base - epsilon];
  If[FailureQ[plus] || FailureQ[minus], Return@FirstCase[{plus, minus}, _Failure]];
  lp = SynesthesiaModel`InfomaxObjective[plus, input];
  lm = SynesthesiaModel`InfomaxObjective[minus, input];
  If[FailureQ[lp] || FailureQ[lm], Return@toolFailure["FiniteDifferenceFailure", "Objective evaluation failed during finite difference."]];
  N[(lp - lm)/(2 epsilon)]
];

analyticGradientMatrix[model_Association, input_List] := Module[{analysis, direct},
  analysis = SynesthesiaModel`AnalyzeNetwork[model, input, "Gradient" -> True, "ReturnPhi" -> False];
  If[FailureQ[analysis], Return[analysis]];
  direct = Lookup[analysis, "Gradient", Missing["Gradient"]];
  If[MatrixQ[direct], Return[direct]];
  direct = Lookup[analysis, "RecurrentGradient", Missing["RecurrentGradient"]];
  If[MatrixQ[direct], Return[direct]];
  direct = Lookup[analysis, "UpdateDirection", Missing["UpdateDirection"]];
  If[MatrixQ[direct],
    (* SynesthesiaModel defines UpdateDirection as the negative objective gradient. *)
    Return[-direct]];
  toolFailure["GradientUnavailable", "AnalyzeNetwork did not expose a dense gradient matrix under a known key."]
];

NEGradientComparison[model_Association, input_List, indices_List, epsilon_: 1.*^-6] := Module[
  {m, analytic, numeric, rows, ga, gn, diff, denom, relative},
  m = Lookup[model, "OutputSize", Missing["OutputSize"]];
  If[!IntegerQ[m] || m < 1, Return@toolFailure["InvalidModel", "OutputSize is invalid."]];
  If[Length[indices] < 1 || Length[indices] > 32 || !AllTrue[indices, vectorIndexQ[#, m] &],
    Return@toolFailure["InvalidIndices", "Provide 1 through 32 valid 1-based {row,column} recurrent coordinates."]];
  If[!finiteNumberQ[epsilon] || !Between[N@epsilon, {1.*^-8, 1.*^-2}],
    Return@toolFailure["InvalidEpsilon", "Finite-difference epsilon must be between 1e-8 and 1e-2."]];
  analytic = analyticGradientMatrix[model, input];
  If[FailureQ[analytic], Return[analytic]];
  numeric = centralDifferenceCoordinate[model, input, #, epsilon] & /@ indices;
  If[AnyTrue[numeric, FailureQ], Return@FirstCase[numeric, _Failure]];
  ga = Extract[analytic, indices]; gn = numeric;
  diff = ga - gn; denom = Norm[ga] + Norm[gn];
  relative = If[denom == 0., 0., Norm[diff]/denom];
  rows = MapThread[
    <|"index" -> #1, "analytic" -> #2, "finite_difference" -> #3,
      "absolute_error" -> Abs[#2 - #3]|> &,
    {indices, ga, gn}
  ];
  <|"epsilon" -> epsilon, "coordinates" -> rows, "relative_error" -> relative,
    "max_absolute_error" -> Max[Abs[diff]], "analytic_norm" -> Norm[ga],
    "finite_difference_norm" -> Norm[gn]|>
];

NEApprovedToolSpecifications[] := <|
  "run_forward_simulation" -> <|"timeout_seconds" -> 120, "max_output_neurons" -> 10000|>,
  "calculate_fixed_point" -> <|"timeout_seconds" -> 120, "max_output_neurons" -> 10000|>,
  "calculate_stability" -> <|"timeout_seconds" -> 180, "max_output_neurons" -> 2048|>,
  "calculate_analytic_gradient" -> <|"timeout_seconds" -> 180, "max_output_neurons" -> 2048|>,
  "compare_gradients" -> <|"timeout_seconds" -> 300, "max_output_neurons" -> 2048, "max_coordinates" -> 32|>,
  "population_statistics" -> <|"timeout_seconds" -> 30, "max_output_neurons" -> 1000000|>
|>;

NEOpenAIToolDefinitions[] := {
  <|"type" -> "function", "name" -> "calculate_fixed_point",
    "description" -> "Settle the already-instantiated Neural Engine model for the supplied project input and return convergence diagnostics. Never estimates a fixed point.",
    "parameters" -> <|"type" -> "object",
      "properties" -> <|"use_context_input" -> <|"type" -> "boolean", "description" -> "Must be true; the tool uses the experiment input already held by Mathematica."|>|>,
      "required" -> {"use_context_input"}, "additionalProperties" -> False|>, "strict" -> True|>,
  <|"type" -> "function", "name" -> "calculate_stability",
    "description" -> "Compute Mathematica local fixed-point stability from the existing model/input using the exact project implementation.",
    "parameters" -> <|"type" -> "object",
      "properties" -> <|"use_context_input" -> <|"type" -> "boolean", "description" -> "Must be true."|>|>,
      "required" -> {"use_context_input"}, "additionalProperties" -> False|>, "strict" -> True|>,
  <|"type" -> "function", "name" -> "calculate_analytic_gradient",
    "description" -> "Compute the exact project analytic recurrent gradient and return only compact norms/extrema.",
    "parameters" -> <|"type" -> "object",
      "properties" -> <|"use_context_input" -> <|"type" -> "boolean", "description" -> "Must be true."|>|>,
      "required" -> {"use_context_input"}, "additionalProperties" -> False|>, "strict" -> True|>,
  <|"type" -> "function", "name" -> "compare_gradients",
    "description" -> "Compare analytic recurrent-gradient entries against central finite differences for at most 32 explicitly requested one-based coordinates.",
    "parameters" -> <|"type" -> "object",
      "properties" -> <|
        "indices" -> <|"type" -> "array", "minItems" -> 1, "maxItems" -> 32,
          "items" -> <|"type" -> "array", "minItems" -> 2, "maxItems" -> 2,
            "items" -> <|"type" -> "integer", "minimum" -> 1|>|>|>,
        "epsilon" -> <|"type" -> "number", "minimum" -> 1.*^-8, "maximum" -> 1.*^-2|>
      |>,
      "required" -> {"indices", "epsilon"}, "additionalProperties" -> False|>, "strict" -> True|>,
  <|"type" -> "function", "name" -> "population_statistics",
    "description" -> "Return compact statistics of the current equilibrium population; no raw state is transmitted.",
    "parameters" -> <|"type" -> "object",
      "properties" -> <|"use_current_state" -> <|"type" -> "boolean", "description" -> "Must be true."|>|>,
      "required" -> {"use_current_state"}, "additionalProperties" -> False|>, "strict" -> True|>
};

ClearAll[NEExecuteApprovedTool];
NEExecuteApprovedTool[request_Association, context_Association] := Module[
  {name, args, model, input, spec, timeout, settled, state, analysis, gradient, stability, fixedMapEigenvalues},
  name = Lookup[request, "tool", Lookup[request, "name", Missing["Tool"]]];
  args = Lookup[request, "arguments", <||>];
  If[!StringQ[name] || !KeyExistsQ[NEApprovedToolSpecifications[], name],
    Return@toolFailure["UnauthorizedTool", "Requested tool is not on the approved Neural Engine allowlist.", <|"Tool" -> name|>]];
  If[!AssociationQ[args], Return@toolFailure["InvalidArguments", "Tool arguments must be an Association."]];
  model = Lookup[context, "model", Missing["Model"]];
  input = Lookup[context, "input", Missing["Input"]];
  If[!AssociationQ[model] || !ListQ[input],
    Return@toolFailure["MissingContext", "Approved tools require an instantiated model and input held locally by Mathematica."]];
  spec = NEApprovedToolSpecifications[][name]; timeout = spec["timeout_seconds"];
  If[Lookup[model, "OutputSize", Infinity] > spec["max_output_neurons"],
    Return@toolFailure["ToolSizeLimit", "Model exceeds the approved size limit for this tool."]];
  withTimeout[
    Switch[name,
      "run_forward_simulation" | "calculate_fixed_point",
        settled = SynesthesiaModel`SettleNetwork[model, input];
        If[FailureQ[settled], settled,
          <|"converged" -> settled["Converged"], "iterations" -> settled["Iterations"],
            "max_delta" -> settled["MaxDelta"], "fixed_point_residual" -> settled["FixedPointResidual"]|>],
      "calculate_stability",
        settled = SynesthesiaModel`SettleNetwork[model, input];
        If[FailureQ[settled], settled,
          stability = SynesthesiaModel`LocalStabilityReport[model, input, settled["State"]];
          If[FailureQ[stability], stability,
            fixedMapEigenvalues = 1. + stability["Eigenvalues"];
            <|"largest_continuous_real_part" -> stability["LargestRealPart"],
              "locally_asymptotically_stable" -> stability["LocallyAsymptoticallyStable"],
              "fixed_point_map_spectral_radius" -> Max[Abs[fixedMapEigenvalues]],
              "fixed_point_residual" -> stability["FixedPointResidual"],
              "eigenvalue_count" -> Length[stability["Eigenvalues"]]|>]],
      "calculate_analytic_gradient",
        analysis = SynesthesiaModel`AnalyzeNetwork[model, input, "Gradient" -> True, "ReturnPhi" -> False];
        If[FailureQ[analysis], analysis,
          gradient = analyticGradientMatrix[model, input];
          If[FailureQ[gradient], gradient,
            <|"dimensions" -> Dimensions[gradient], "frobenius_norm" -> Norm[Flatten[gradient]],
              "maximum_absolute_entry" -> Max[Abs[Flatten[gradient]]],
              "finite_entries" -> Count[Flatten[gradient], x_ /; finiteNumberQ[x]]|>]],
      "compare_gradients",
        NEGradientComparison[model, input, Lookup[args, "indices", {}], Lookup[args, "epsilon", Indeterminate]],
      "population_statistics",
        state = Lookup[context, "state", Missing["State"]];
        If[MissingQ[state],
          settled = SynesthesiaModel`SettleNetwork[model, input];
          If[FailureQ[settled], settled, state = settled["State"]]
        ];
        If[FailureQ[state], state, NEPopulationStatistics[state]],
      _, toolFailure["UnauthorizedTool", "Tool dispatch fell through the approved allowlist."]
    ],
    timeout
  ]
];

End[];
EndPackage[];
