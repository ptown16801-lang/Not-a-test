(* ::Package:: *)

(*
  A Wolfram Language reconstruction of the recurrent Infomax model in:
  Shriki, Sadeh & Ward (2016), PLOS Computational Biology 12(7): e1004959.

  This is an independent implementation of the published equations.  The
  authors' MATLAB source, random seeds, stopping tolerances, and exact training
  lengths were not released.  Every replacement choice is exposed as an
  option and documented in mathematica/README.md.
*)

BeginPackage["SynesthesiaModel`"];

$PaperDOI::usage = "$PaperDOI is the DOI of the reconstructed paper.";
$PaperFigure7Scenarios::usage = "$PaperFigure7Scenarios contains the five parameter regimes printed in Figure 7.";
$ReconstructionDefaults::usage = "$ReconstructionDefaults lists numerical choices not fixed by the publication.";

LogisticActivation::usage = "LogisticActivation[x] is the logistic squashing function used by the model.";
LogisticPrimeFromOutput::usage = "LogisticPrimeFromOutput[s] gives g'[h] from s=g[h].";
LogisticSecondFromOutput::usage = "LogisticSecondFromOutput[s] gives g''[h] from s=g[h].";
LogisticPrimeFromField::usage = "LogisticPrimeFromField[h] evaluates g'[h] without first rounding g[h] to zero or one.";
LogisticSecondFromField::usage = "LogisticSecondFromField[h] evaluates g''[h] stably from the field.";

CreateSimplePaperNetwork::usage = "CreateSimplePaperNetwork[] creates the paper's two-input, two-output model.";
CreateTwoModalityPaperNetwork::usage = "CreateTwoModalityPaperNetwork[] creates the 4-input, 142-output population model.";
CreateScalablePaperNetwork::usage = "CreateScalablePaperNetwork[total] creates an enlarged population model with a matrix-free low-rank recurrent representation.";
CreatePaperInputSampler::usage = "CreatePaperInputSampler[] returns a seeded, stateful sampler for the independent polar inputs.";
PolarProbe::usage = "PolarProbe[modality, angle, radius] makes a four-component probe for modality 1 or 2.";

SettleNetwork::usage = "SettleNetwork[model,input] integrates the rate equation to a fixed point.";
LocalStabilityReport::usage = "LocalStabilityReport[model,input,state] computes the continuous-time fixed-point Jacobian and its local stability; it is an explicit dense diagnostic.";
AnalyzeNetwork::usage = "AnalyzeNetwork[model,input] evaluates equilibrium, susceptibility, objective, and recurrent gradient.";
InfomaxObjective::usage = "InfomaxObjective[model,input] evaluates the information objective epsilon.";
RecurrentUpdateDirection::usage = "RecurrentUpdateDirection[model,inputs] averages the published recurrent update over inputs.";
ApplyRecurrentUpdate::usage = "ApplyRecurrentUpdate[model,direction,eta] returns a model with one recurrent update applied.";
TrainNetwork::usage = "TrainNetwork[model,sampler] trains synchronously; restoring a best checkpoint requires one fixed CheckpointInputs ensemble.";

ModalityActivity::usage = "ModalityActivity[model,state,modality] extracts one population's activity.";
PopulationVector::usage = "PopulationVector[activity,angles] returns the publication-defined circular sum; Normalization->Mean is a project visualization option.";
RespondNetwork::usage = "RespondNetwork[model,input] settles a model and summarizes both modality populations.";
ProbeCrossModalMapping::usage = "ProbeCrossModalMapping[model,source,target] measures population-vector responses across angles.";
CrossTalkSummary::usage = "CrossTalkSummary[model] summarizes signed and absolute weights in both cross-modal blocks.";
MaterializeRecurrentMatrix::usage = "MaterializeRecurrentMatrix[model] returns the dense recurrent matrix, including a low-rank model's diagonal correction.";
NetworkScaleReport::usage = "NetworkScaleReport[model] reports neuron count, factor-column count, storage, and dense-equivalent memory without mislabeling representation size as algebraic rank.";
EstimateNetworkScale::usage = "EstimateNetworkScale[total,rank] estimates dense and low-rank storage without allocating a network.";

SimpleStabilityJacobian::usage = "SimpleStabilityJacobian[v1,v2] is the S1 linearized learning Jacobian at zero cross-talk.";
SimpleStabilityInvariants::usage = "SimpleStabilityInvariants[v1,v2] gives the trace, determinant, and discriminant used in S1.";
SimpleNoCrossTalkStability::usage = "SimpleNoCrossTalkStability[v1,v2,eta] classifies the zero-cross-talk learning fixed point.";
OutputVarianceForGaussian::usage = "OutputVarianceForGaussian[variance] maps zero-mean Gaussian input variance to logistic output variance at K=0.";

ImportJavaScriptNetwork::usage = "ImportJavaScriptNetwork[path] imports a project neural checkpoint into the Wolfram model association.";
ExportJavaScriptNetwork::usage = "ExportJavaScriptNetwork[model,path] exports a network in the project's v1 JSON schema.";

Begin["`Private`"];

$PaperDOI = "10.1371/journal.pcbi.1004959";

$PaperFigure7Scenarios = <|
  "balancedLowPlasticity" -> <|
    "MeanRadii" -> {0.2, 0.2}, "LearningRate" -> 6.*^-5,
    "ReportedOutcome" -> "no-synaesthesia", "PaperPanel" -> "7A"|>,
  "deprivedLowPlasticity" -> <|
    "MeanRadii" -> {0.2, 2.0}, "LearningRate" -> 1.*^-4,
    "ReportedOutcome" -> "no-synaesthesia", "PaperPanel" -> "7B"|>,
  "balancedHighInput" -> <|
    "MeanRadii" -> {2.0, 2.0}, "LearningRate" -> 1.5*^-4,
    "ReportedOutcome" -> "no-synaesthesia", "PaperPanel" -> "7C"|>,
  "balancedHighPlasticity" -> <|
    "MeanRadii" -> {0.2, 0.2}, "LearningRate" -> 1.*^-4,
    "ReportedOutcome" -> "bidirectional", "PaperPanel" -> "7D"|>,
  "deprivedHighPlasticity" -> <|
    "MeanRadii" -> {0.2, 2.0}, "LearningRate" -> 1.5*^-4,
    "ReportedOutcome" -> "modality-2-to-1", "PaperPanel" -> "7E"|>
|>;

$ReconstructionDefaults = <|
  "IntegrationStep" -> 0.5,
  "Tolerance" -> 1.*^-9,
  "ResidualTolerance" -> 1.*^-9,
  "ConvergenceCriterion" -> "StepAndResidual",
  "StableIterations" -> 2,
  "MaxIterations" -> 50000,
  "DerivativeFloor" -> 0.,
  "InitialRecurrentScale" -> 0.0,
  "PivotTolerance" -> 1.*^-13,
  "Seed" -> 1
|>;

ClearAll[modelFailure];
modelFailure[tag_, message_, data_: <||>] :=
  Failure[tag, Join[<|"MessageTemplate" -> message|>, data]];

ClearAll[finiteNumericQ, finiteVectorQ, finiteMatrixQ];
finiteNumericQ[x_] := NumericQ[x] &&
  FreeQ[N[x], Indeterminate | ComplexInfinity | DirectedInfinity] &&
  Quiet[TrueQ[Im[N[x]] == 0]];
finiteVectorQ[x_, n_Integer] := VectorQ[x, finiteNumericQ] && Length[x] == n;
finiteMatrixQ[x_, {rows_Integer, cols_Integer}] :=
  MatrixQ[x, finiteNumericQ] && Dimensions[x] == {rows, cols};

ClearAll[validLowRankRecurrentQ, validModelQ];
validLowRankRecurrentQ[recurrent_, m_Integer] := AssociationQ[recurrent] &&
  Lookup[recurrent, "Representation", None] === "LowRankPlusDiagonal" &&
  finiteVectorQ[Lookup[recurrent, "Diagonal", {}], m] &&
  MatrixQ[Lookup[recurrent, "LeftFactors", {}], finiteNumericQ] &&
  MatrixQ[Lookup[recurrent, "RightFactors", {}], finiteNumericQ] &&
  First@Dimensions[recurrent["LeftFactors"]] == m &&
  First@Dimensions[recurrent["RightFactors"]] == m &&
  Last@Dimensions[recurrent["LeftFactors"]] == Last@Dimensions[recurrent["RightFactors"]];

validModelQ[model_] := Module[{n, m, recurrent},
  If[!AssociationQ[model], Return[False]];
  {n, m} = Lookup[model, {"InputSize", "OutputSize"}, Missing[]];
  If[!IntegerQ[n] || !IntegerQ[m] || !finiteMatrixQ[Lookup[model, "W", {}], {m, n}],
    Return[False]
  ];
  recurrent = Lookup[model, "Recurrent", Missing["Dense"]];
  If[MissingQ[recurrent],
    finiteMatrixQ[Lookup[model, "K", {}], {m, m}],
    validLowRankRecurrentQ[recurrent, m]
  ]
];

ClearAll[lowRankModelQ, scaleRows, recurrentTimes, recurrentState, setRecurrentState,
  recurrentTransposeTimes, recurrentDiagonal, recurrentMaxAbsBound];
lowRankModelQ[model_] := AssociationQ@Lookup[model, "Recurrent", None] &&
  Lookup[model["Recurrent"], "Representation", None] === "LowRankPlusDiagonal";
scaleRows[scales_List, matrix_?MatrixQ] := MapThread[#1 #2 &, {scales, matrix}];
scaleRows[scales_List, vector_?VectorQ] := scales vector;
recurrentTimes[model_, value_] := If[lowRankModelQ[model], Module[{r = model["Recurrent"]},
    If[Last@Dimensions[r["LeftFactors"]] == 0,
      r["Diagonal"] value,
      r["Diagonal"] value + r["LeftFactors"].(Transpose[r["RightFactors"]].value)
    ]
  ], model["K"].value];
recurrentTransposeTimes[model_, value_] := If[lowRankModelQ[model], Module[{r = model["Recurrent"]},
    If[Last@Dimensions[r["LeftFactors"]] == 0,
      r["Diagonal"] value,
      r["Diagonal"] value + r["RightFactors"].(Transpose[r["LeftFactors"]].value)
    ]
  ], Transpose[model["K"]].value];
recurrentState[model_] := If[lowRankModelQ[model], model["Recurrent"], model["K"]];
setRecurrentState[model_, state_] := If[lowRankModelQ[model],
  Join[model, <|"Recurrent" -> state,
    "Metadata" -> Join[Lookup[model, "Metadata", <||>], <|
      "MaximumRank" -> state["MaximumRank"],
      "Approximate" -> (state["Truncations"] > 0)|>]|>],
  Join[model, <|"K" -> state|>]
];
recurrentDiagonal[model_] := If[lowRankModelQ[model], Module[{r = model["Recurrent"]},
    r["Diagonal"] + (Total /@ (r["LeftFactors"] r["RightFactors"]))
  ], Diagonal[model["K"]]];
recurrentMaxAbsBound[model_] := If[lowRankModelQ[model], Module[{r = model["Recurrent"]},
    Max[Abs[r["Diagonal"]]] + If[Last@Dimensions[r["LeftFactors"]] == 0, 0.,
      Max[Abs[r["LeftFactors"]].(Max /@ Transpose[Abs[r["RightFactors"]]])]]
  ], Max[Abs[Flatten[model["K"]]]]];

ClearAll[LogisticActivation, LogisticPrimeFromOutput, LogisticSecondFromOutput,
  LogisticPrimeFromField, LogisticSecondFromField];
SetAttributes[LogisticActivation, Listable];
LogisticActivation[x_?MachineNumberQ] :=
  If[x >= 0., 1./(1. + Exp[-x]), With[{z = Exp[x]}, z/(1. + z)]];
LogisticActivation[x_?NumericQ] := 1/(1 + Exp[-x]);
LogisticActivation[x_] := 1/(1 + Exp[-x]);
LogisticPrimeFromOutput[s_] := s (1 - s);
LogisticSecondFromOutput[s_] := s (1 - s) (1 - 2 s);
SetAttributes[LogisticPrimeFromField, Listable];
LogisticPrimeFromField[h_?NumericQ] := With[{z = Exp[-Abs[h]]}, z/(1 + z)^2];
LogisticPrimeFromField[h_] := Exp[-Abs[h]]/(1 + Exp[-Abs[h]])^2;
SetAttributes[LogisticSecondFromField, Listable];
LogisticSecondFromField[h_?NumericQ] := -LogisticPrimeFromField[h] Tanh[h/2];
LogisticSecondFromField[h_] := -LogisticPrimeFromField[h] Tanh[h/2];

Options[CreateSimplePaperNetwork] = {
  "Weights" -> {1., 1.}, "CrossTalk" -> {0., 0.}
};

CreateSimplePaperNetwork[OptionsPattern[]] := Module[
  {weights = N@OptionValue["Weights"], crossTalk = N@OptionValue["CrossTalk"]},
  If[!finiteVectorQ[weights, 2] || !finiteVectorQ[crossTalk, 2],
    Return@modelFailure["InvalidModel", "The simple model needs two finite feed-forward and cross-talk weights."]
  ];
  <|
    "InputSize" -> 2,
    "OutputSize" -> 2,
    "W" -> {{weights[[1]], 0.}, {0., weights[[2]]}},
    "K" -> {{0., crossTalk[[1]]}, {crossTalk[[2]], 0.}},
    "Modalities" -> {
      <|"Name" -> "modality-1", "InputOffset" -> 1, "InputCount" -> 1,
        "OutputOffset" -> 1, "OutputCount" -> 1, "PreferredAngles" -> {0.}|>,
      <|"Name" -> "modality-2", "InputOffset" -> 2, "InputCount" -> 1,
        "OutputOffset" -> 2, "OutputCount" -> 1, "PreferredAngles" -> {0.}|>
    },
    "Metadata" -> <|"Model" -> "paper-simple-model", "DOI" -> $PaperDOI,
      "ExcludeSelfCoupling" -> True,
      "SelfCouplingProvenance" -> "S1 Appendix explicitly sets the two diagonal entries to zero."|>
  |>
];

Options[CreateTwoModalityPaperNetwork] = {
  "NeuronsPerModality" -> 71,
  "TotalNeurons" -> Automatic,
  "Seed" -> 1,
  "InitialRecurrentScale" -> 0.,
  "ExcludeSelfCoupling" -> False,
  "RecurrentRepresentation" -> "Dense",
  "MaximumRank" -> Infinity
};

CreateTwoModalityPaperNetwork[OptionsPattern[]] := Module[
  {count = OptionValue["NeuronsPerModality"], seed = OptionValue["Seed"],
    scale = N@OptionValue["InitialRecurrentScale"], angles, w, k, modalities,
    outputs, total = OptionValue["TotalNeurons"],
    representation = OptionValue["RecurrentRepresentation"], recurrent, maximumRank,
    excludeSelf = OptionValue["ExcludeSelfCoupling"], initialization},
  If[total =!= Automatic,
    If[!IntegerQ[total] || total < 6 || OddQ[total],
      Return@modelFailure["InvalidModel", "TotalNeurons must be an even integer of at least six."]
    ];
    count = Quotient[total, 2]
  ];
  If[!IntegerQ[count] || count < 3,
    Return@modelFailure["InvalidModel", "NeuronsPerModality must be an integer of at least three."]
  ];
  If[!IntegerQ[seed],
    Return@modelFailure["InvalidModel", "Seed must be an integer."]
  ];
  If[!finiteNumericQ[scale] || scale < 0,
    Return@modelFailure["InvalidModel", "InitialRecurrentScale must be non-negative."]
  ];
  If[!BooleanQ[excludeSelf],
    Return@modelFailure["InvalidModel", "ExcludeSelfCoupling must be True or False."]
  ];
  If[!MemberQ[{"Dense", "LowRank"}, representation],
    Return@modelFailure["InvalidModel", "RecurrentRepresentation must be Dense or LowRank."]
  ];
  maximumRank = OptionValue["MaximumRank"];
  If[maximumRank =!= Infinity && (!IntegerQ[maximumRank] || maximumRank < 1),
    Return@modelFailure["InvalidModel", "MaximumRank must be a positive integer or Infinity."]
  ];
  If[representation === "LowRank" && scale != 0.,
    Return@modelFailure["InvalidModel", "LowRank construction starts exactly at K=0; add low-rank factors through training."]
  ];
  outputs = 2 count;
  angles = N@Table[2 Pi i/count, {i, 0, count - 1}];
  w = ConstantArray[0., {outputs, 4}];
  Do[
    w[[modality count + i, 2 modality + 1 ;; 2 modality + 2]] =
      {Cos[angles[[i]]], Sin[angles[[i]]]},
    {modality, 0, 1}, {i, 1, count}
  ];
  If[representation === "Dense",
    k = If[scale == 0., ConstantArray[0., {outputs, outputs}],
      BlockRandom[SeedRandom[seed]; RandomReal[{-scale, scale}, {outputs, outputs}]]
    ];
    If[TrueQ[excludeSelf], Do[k[[i, i]] = 0., {i, outputs}]],
    recurrent = <|"Representation" -> "LowRankPlusDiagonal",
      "Diagonal" -> ConstantArray[0., outputs],
      "LeftFactors" -> ConstantArray[0., {outputs, 0}],
      "RightFactors" -> ConstantArray[0., {outputs, 0}],
      "MaximumRank" -> maximumRank,
      "Truncations" -> 0, "DiscardedSingularValueMass" -> 0.|>
  ];
  initialization = If[scale == 0., "exact-zero-reconstruction-condition",
    "seeded-uniform-near-zero-reconstruction-condition"];
  modalities = Table[
    <|"Name" -> "modality-" <> ToString[modality + 1],
      "InputOffset" -> 2 modality + 1, "InputCount" -> 2,
      "OutputOffset" -> modality count + 1, "OutputCount" -> count,
      "PreferredAngles" -> angles|>,
    {modality, 0, 1}
  ];
  Join[<|
    "InputSize" -> 4,
    "OutputSize" -> outputs,
    "W" -> w,
    "Modalities" -> modalities,
    "Metadata" -> <|
      "Model" -> "paper-high-dimensional-model",
      "NeuronsPerModality" -> count,
      "FeedForward" -> "unit-vectors-at-equal-angles",
      "Activation" -> "logistic", "TimeUnits" -> "t/tau", "Seed" -> seed,
      "InitialRecurrentScale" -> scale,
      "Initialization" -> initialization,
      "InitializationProvenance" -> "The target paper says cross-talk was near-zero but does not report its scale or distribution.",
      "ExcludeSelfCoupling" -> excludeSelf,
      "SelfCouplingProvenance" -> If[TrueQ[excludeSelf],
        "Optional project constraint borrowed from the simple S1 model.",
        "General published M by M equation; the high-dimensional diagonal policy is not separately reported."],
      "RecurrentRepresentation" -> representation,
      "MaximumRank" -> maximumRank, "DOI" -> $PaperDOI|>
  |>, If[representation === "Dense", <|"K" -> k|>, <|"Recurrent" -> recurrent|>]]
];

Options[CreateScalablePaperNetwork] = Options[CreateTwoModalityPaperNetwork];

CreateScalablePaperNetwork[totalNeurons_Integer : 2048, opts : OptionsPattern[]] :=
  Module[{forwarded},
    forwarded = DeleteCases[
      FilterRules[{opts}, Options[CreateTwoModalityPaperNetwork]],
      ("TotalNeurons" | "RecurrentRepresentation") -> _
    ];
    CreateTwoModalityPaperNetwork[
      Sequence @@ forwarded,
      "TotalNeurons" -> totalNeurons,
      "RecurrentRepresentation" -> "LowRank"
    ]
  ];

ClearAll[xorShift32Step];
xorShift32Step[state_Integer] := Module[{x = BitAnd[state, 16^^FFFFFFFF]},
  x = BitAnd[BitXor[x, BitShiftLeft[x, 13]], 16^^FFFFFFFF];
  x = BitAnd[BitXor[x, BitShiftRight[x, 17]], 16^^FFFFFFFF];
  BitAnd[BitXor[x, BitShiftLeft[x, 5]], 16^^FFFFFFFF]
];

Options[CreatePaperInputSampler] = {
  "MeanRadii" -> {0.2, 2.0},
  "RadiusStandardDeviationFraction" -> 0.1,
  "Seed" -> 1,
  "RandomState" -> Automatic
};

CreatePaperInputSampler[OptionsPattern[]] := Module[
  {means = N@OptionValue["MeanRadii"],
    fraction = N@OptionValue["RadiusStandardDeviationFraction"],
    seed = OptionValue["Seed"], supplied = OptionValue["RandomState"],
    state, spare = None, uniform, normal, next, snapshot},
  If[!finiteVectorQ[means, 2] || AnyTrue[means, Negative],
    Return@modelFailure["InvalidSampler", "MeanRadii must contain two non-negative values."]
  ];
  If[!finiteNumericQ[fraction] || fraction < 0,
    Return@modelFailure["InvalidSampler", "RadiusStandardDeviationFraction must be non-negative."]
  ];
  If[!IntegerQ[seed] || (supplied =!= Automatic && !AssociationQ[supplied]),
    Return@modelFailure["InvalidSampler", "Seed must be an integer and RandomState must be Automatic or an association."]
  ];
  state = BitAnd[seed, 16^^FFFFFFFF];
  If[state == 0, state = 1];
  If[AssociationQ[supplied],
    If[!IntegerQ[Lookup[supplied, "State", Missing["State"]]] ||
        !Between[Lookup[supplied, "State", -1], {0, 16^^FFFFFFFF}] ||
        !MatchQ[Lookup[supplied, "Spare", Null], Null | _?finiteNumericQ],
      Return@modelFailure["InvalidSampler",
        "RandomState must contain a uint32 State and a finite or null Spare."]
    ];
    state = BitAnd[supplied["State"], 16^^FFFFFFFF];
    If[state == 0, state = 1];
    spare = Replace[Lookup[supplied, "Spare", None], Null -> None]
  ];
  uniform[] := (state = xorShift32Step[state]; N[state/4294967296.]);
  normal[] := Module[{u = 0., v = 0., magnitude, angle, value},
    If[spare =!= None, value = spare; spare = None; Return[value]];
    While[u <= $MachineEpsilon, u = uniform[]];
    While[v <= $MachineEpsilon, v = uniform[]];
    magnitude = Sqrt[-2 Log[u]]; angle = 2 Pi v;
    spare = magnitude Sin[angle];
    magnitude Cos[angle]
  ];
  next = Function[{step, sample}, Module[{angle, radius},
    Flatten@Table[
      angle = 2 Pi uniform[];
      radius = means[[modality]] + means[[modality]] fraction normal[];
      {radius Cos[angle], radius Sin[angle]},
      {modality, 1, 2}
    ]
  ]];
  snapshot = Function[Null,
    <|"State" -> state, "Spare" -> Replace[spare, None -> Null]|>
  ];
  <|"Next" -> next, "Snapshot" -> snapshot,
    "MeanRadii" -> means,
    "RadiusStandardDeviationFraction" -> fraction,
    "Seed" -> seed,
    "Algorithm" -> "xorshift32-box-muller/project-compatible"|>
];

ClearAll[sampleFrom];
sampleFrom[sampler_Association, step_Integer, sample_Integer] := sampler["Next"][step, sample];
sampleFrom[sampler_, step_Integer, sample_Integer] := sampler[step, sample];

PolarProbe[modality_Integer : 1, angle_ : 0., radius_ : 1.] := Module[{input},
  If[!MemberQ[{1, 2}, modality] || !finiteNumericQ[angle] || !finiteNumericQ[radius],
    Return@modelFailure["InvalidInput", "PolarProbe expects modality 1 or 2 and finite angle and radius."]
  ];
  input = ConstantArray[0., 4];
  input[[2 modality - 1 ;; 2 modality]] = N@{radius Cos[angle], radius Sin[angle]};
  input
];

Options[SettleNetwork] = {
  "InitialState" -> Automatic,
  "Method" -> "Euler",
  "IntegrationStep" -> 0.5,
  "AndersonDepth" -> 5,
  "AndersonDamping" -> 1.,
  "AndersonRegularization" -> 1.*^-10,
  "Tolerance" -> 1.*^-9,
  "ResidualTolerance" -> Automatic,
  "ConvergenceCriterion" -> "StepAndResidual",
  "StableIterations" -> 2,
  "MaxIterations" -> 50000,
  "AllowUnconverged" -> False
};

SettleNetwork[model_, input_, OptionsPattern[]] := Module[
  {m, n, state, field, direct, next, step = N@OptionValue["IntegrationStep"],
    tolerance = N@OptionValue["Tolerance"],
    residualTolerance = Replace[OptionValue["ResidualTolerance"], Automatic -> OptionValue["Tolerance"]],
    criterion = OptionValue["ConvergenceCriterion"], required = OptionValue["StableIterations"],
    maximum = OptionValue["MaxIterations"], allow = TrueQ@OptionValue["AllowUnconverged"],
    method = OptionValue["Method"], depth = OptionValue["AndersonDepth"],
    damping = N@OptionValue["AndersonDamping"],
    regularization = N@OptionValue["AndersonRegularization"],
    stable = 0, iterations = 0, maxDelta = Infinity, fixedPointResidual, converged,
    mapped, residual, mappedHistory = {}, residualHistory = {}, residualMatrix,
    gram, coefficients, weights, candidate, acceptableResidual, acceptableStep},
  residualTolerance = N@residualTolerance;
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  {n, m} = Lookup[model, {"InputSize", "OutputSize"}];
  If[!finiteVectorQ[input, n],
    Return@modelFailure["InvalidInput", "The input vector has the wrong length or contains a non-finite value."]
  ];
  If[!MemberQ[{"Euler", "Anderson"}, method] ||
      !finiteNumericQ[step] || !(0 < step <= 1) ||
      !IntegerQ[depth] || depth < 1 || !finiteNumericQ[damping] || !(0 < damping <= 1) ||
      !finiteNumericQ[regularization] || regularization < 0 ||
      !finiteNumericQ[tolerance] || tolerance <= 0 ||
      !finiteNumericQ[residualTolerance] || residualTolerance <= 0 ||
      !MemberQ[{"FixedPointResidual", "StepAndResidual"}, criterion] ||
      !IntegerQ[required] || required < 1 || !IntegerQ[maximum] || maximum < 1,
    Return@modelFailure["InvalidIntegrator", "Integrator options are outside their valid ranges."]
  ];
  state = Replace[OptionValue["InitialState"], Automatic -> ConstantArray[0.5, m]];
  state = N@state;
  If[!finiteVectorQ[state, m],
    Return@modelFailure["InvalidState", "InitialState has the wrong length or contains a non-finite value."]
  ];
  direct = N[model["W"].input];
  While[iterations < maximum && stable < required,
    iterations++;
    field = direct + recurrentTimes[model, state];
    mapped = LogisticActivation[field];
    residual = mapped - state;
    fixedPointResidual = Max[Abs[residual]];
    If[method === "Anderson",
      AppendTo[mappedHistory, mapped]; AppendTo[residualHistory, residual];
      If[Length[mappedHistory] > depth + 1, mappedHistory = Rest[mappedHistory]];
      If[Length[residualHistory] > depth + 1, residualHistory = Rest[residualHistory]];
      If[Length[mappedHistory] == 1,
        next = state + damping residual,
        residualMatrix = Transpose[residualHistory];
        gram = Transpose[residualMatrix].residualMatrix +
          regularization IdentityMatrix[Length[residualHistory]];
        coefficients = Quiet@Check[LinearSolve[gram, ConstantArray[1., Length[residualHistory]]], $Failed];
        If[coefficients === $Failed || Abs[Total[coefficients]] < 1.*^-14,
          next = state + step residual,
          weights = coefficients/Total[coefficients];
          candidate = Total[MapThread[#1 #2 &, {weights, mappedHistory}]];
          next = state + damping (candidate - state);
          If[!finiteVectorQ[next, m], next = state + step residual]
        ]
      ],
      next = state + step (mapped - state)
    ];
    maxDelta = Max[Abs[next - state]];
    state = next;
    acceptableResidual = fixedPointResidual < residualTolerance;
    acceptableStep = criterion === "FixedPointResidual" || maxDelta < tolerance;
    If[acceptableResidual && acceptableStep, stable++, stable = 0];
  ];
  field = direct + recurrentTimes[model, state];
  fixedPointResidual = Max[Abs[state - LogisticActivation[field]]];
  converged = stable >= required && fixedPointResidual < residualTolerance &&
    (criterion === "FixedPointResidual" || maxDelta < tolerance);
  If[!converged && !allow,
    Return@modelFailure["DidNotConverge", "The recurrent dynamics did not settle.",
      <|"Iterations" -> iterations, "MaxDelta" -> maxDelta,
        "FixedPointResidual" -> fixedPointResidual|>]
  ];
  <|"State" -> state, "Field" -> field, "Iterations" -> iterations,
    "MaxDelta" -> maxDelta, "FixedPointResidual" -> fixedPointResidual,
    "ResidualTolerance" -> residualTolerance,
    "ConvergenceCriterion" -> criterion,
    "Converged" -> converged, "Method" -> method,
    "StabilityAssessed" -> False|>
];

Options[LocalStabilityReport] = {"ResidualTolerance" -> 1.*^-9};
LocalStabilityReport[model_, input_, state_, OptionsPattern[]] := Module[
  {m, n, field, first, jacobian, eigenvalues, largestReal, residual,
    residualTolerance = N@OptionValue["ResidualTolerance"]},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  {n, m} = Lookup[model, {"InputSize", "OutputSize"}];
  If[!finiteVectorQ[input, n] || !finiteVectorQ[state, m] ||
      !finiteNumericQ[residualTolerance] || residualTolerance <= 0,
    Return@modelFailure["InvalidState", "The input or state has invalid dimensions or values."]
  ];
  field = model["W"].N[input] + recurrentTimes[model, N[state]];
  residual = Max[Abs[LogisticActivation[field] - N[state]]];
  If[residual > residualTolerance,
    Return@modelFailure["NotFixedPoint",
      "Local fixed-point stability is defined only at an equilibrium within the requested residual tolerance.",
      <|"FixedPointResidual" -> residual,
        "ResidualTolerance" -> residualTolerance|>]
  ];
  first = LogisticPrimeFromField[field];
  jacobian = -IdentityMatrix[m] +
    scaleRows[first, MaterializeRecurrentMatrix[model]];
  eigenvalues = Quiet@Check[Eigenvalues[jacobian], $Failed];
  If[eigenvalues === $Failed,
    Return@modelFailure["StabilityFailure", "The local-stability eigenproblem failed."]
  ];
  largestReal = Max[Re[N[eigenvalues]]];
  <|"ContinuousTimeJacobian" -> jacobian, "Eigenvalues" -> eigenvalues,
    "LargestRealPart" -> largestReal, "LocallyAsymptoticallyStable" -> (largestReal < 0),
    "FixedPointResidual" -> residual,
    "ResidualTolerance" -> residualTolerance, "DenseDiagnostic" -> True|>
];

Options[AnalyzeNetwork] = Join[
  {"Gradient" -> True, "DerivativeFloor" -> 0.,
    "PivotTolerance" -> 1.*^-13, "SolveResidualTolerance" -> 1.*^-10,
    "ReturnPhi" -> Automatic},
  Options[SettleNetwork]
];

(* Construct one cached solver for phi or phi^T without explicitly forming
   G^-1.  We solve

     (I-G K) phi R = G R

   (or (I-G K^T) phi^T R = G R).  This is algebraically identical to the
   published phi=(G^-1-K)^-1, but it avoids artificial overflow and poor row
   scaling when a representable logistic derivative is extremely small.

   The low-rank branch uses Woodbury only when its chosen diagonal base is
   invertible.  A dense exact fallback covers moderate pathological cases in
   which the full operator is invertible but that particular split is not.
   Every returned solve is checked against the unscaled fixed-point operator. *)
ClearAll[maxAbsArray, makePhiSolver, solvePhi];
maxAbsArray[value_] := If[Length[Flatten[value]] == 0, 0., Max[Abs[Flatten[value]]]];
makePhiSolver[model_, first_List, transpose_: False,
    solveTolerance_: 1.*^-10] := Module[
  {m = model["OutputSize"], recurrent, diagonal, left, right, base,
    inverseBase, scaledLeft, middle, middleSolver, operator, operatorSolver,
    rawSolver, applyOperator, checkedSolver, badBase, operatorNormBound,
    factorRowBound, denseFallbackLimit = 2048},
  applyOperator[value_] := value - scaleRows[first,
    If[TrueQ[transpose], recurrentTransposeTimes[model, value],
      recurrentTimes[model, value]]];
  checkedSolver = Function[{rightHandSide, rightAlreadyScaled}, Module[
      {scaledRight = If[TrueQ[rightAlreadyScaled], N@rightHandSide,
          scaleRows[first, N@rightHandSide]], solved, residual, denominator},
      solved = Quiet@Check[rawSolver[scaledRight], $Failed];
      If[solved === $Failed, Return[$Failed]];
      residual = applyOperator[solved] - scaledRight;
      denominator = Max[10.^-280,
        operatorNormBound maxAbsArray[solved] + maxAbsArray[scaledRight]];
      If[!finiteNumericQ[maxAbsArray[residual]] ||
          maxAbsArray[residual] > solveTolerance denominator,
        $Failed, solved]
    ]];
  If[!lowRankModelQ[model],
    operator = IdentityMatrix[m] - scaleRows[first,
      If[TrueQ[transpose], Transpose[model["K"]], model["K"]]];
    operatorNormBound = Max[Total /@ Abs[operator]];
    operatorSolver = Quiet@Check[LinearSolve[operator], $Failed];
    If[operatorSolver === $Failed, Return[$Failed]];
    rawSolver = Function[scaledRight, Quiet@Check[operatorSolver[scaledRight], $Failed]];
    Return[checkedSolver]
  ];
  recurrent = model["Recurrent"];
  diagonal = recurrent["Diagonal"];
  {left, right} = If[TrueQ[transpose],
    {recurrent["RightFactors"], recurrent["LeftFactors"]},
    {recurrent["LeftFactors"], recurrent["RightFactors"]}
  ];
  factorRowBound = If[Last@Dimensions[left] == 0, ConstantArray[0., m],
    Abs[left].(Total /@ Transpose[Abs[right]])];
  operatorNormBound = Max[Abs[1 - first diagonal] + first factorRowBound];
  base = 1 - first diagonal;
  badBase = !VectorQ[base, finiteNumericQ] ||
    Min[Abs[base]] <= 100 $MachineEpsilon Max[1., Max[Abs[base]]];
  If[badBase,
    If[m > denseFallbackLimit, Return[$Failed]];
    operator = IdentityMatrix[m] - scaleRows[first,
      If[TrueQ[transpose], Transpose[MaterializeRecurrentMatrix[model]],
        MaterializeRecurrentMatrix[model]]];
    operatorNormBound = Max[Total /@ Abs[operator]];
    operatorSolver = Quiet@Check[LinearSolve[operator], $Failed];
    If[operatorSolver === $Failed, Return[$Failed]];
    rawSolver = Function[scaledRight, Quiet@Check[operatorSolver[scaledRight], $Failed]];
    Return[checkedSolver]
  ];
  inverseBase = 1/base;
  If[Last@Dimensions[left] == 0,
    rawSolver = Function[scaledRight, scaleRows[inverseBase, scaledRight]];
    Return[checkedSolver]
  ];
  scaledLeft = scaleRows[inverseBase first, left];
  middle = IdentityMatrix[Last@Dimensions[left]] - Transpose[right].scaledLeft;
  middleSolver = Quiet@Check[LinearSolve[middle], $Failed];
  If[middleSolver === $Failed, Return[$Failed]];
  rawSolver = Function[scaledRight, Module[{scaled, solved},
    scaled = scaleRows[inverseBase, scaledRight];
    solved = Quiet@Check[middleSolver[Transpose[right].scaled], $Failed];
    If[solved === $Failed, $Failed, scaled + scaledLeft.solved]
  ]];
  checkedSolver
];

solvePhi[model_, first_List, rightHandSide_, transpose_: False,
    solveTolerance_: 1.*^-10] := Module[{solver},
  solver = makePhiSolver[model, first, transpose, solveTolerance];
  If[solver === $Failed, $Failed, solver[rightHandSide, False]]
];

AnalyzeNetwork[model_, input_, opts : OptionsPattern[]] := Module[
  {equilibrium, m, n, s, first, rawFirst, second, phi, chi, gram, singularValues,
    objective, gamma, chiGamma, chiGammaDiagonal, a, aCandidate, scaledA, update,
    gradient = TrueQ@OptionValue["Gradient"],
    floor = N@OptionValue["DerivativeFloor"], pivot = N@OptionValue["PivotTolerance"],
    solveTolerance = N@OptionValue["SolveResidualTolerance"],
    returnPhi = OptionValue["ReturnPhi"], base, phiTQ, b, leftFactors,
    rightFactors, forwardSolver, transposeSolver, qTranspose, r,
    gammaSolver, gammaRight, scaledChi, chiScale, floorApplied,
    gammaResidual, susceptibilityCondition},
  If[!finiteNumericQ[floor] || floor < 0 ||
      !finiteNumericQ[pivot] || pivot <= 0 ||
      !finiteNumericQ[solveTolerance] || solveTolerance <= 0 ||
      !MemberQ[{True, False, Automatic}, returnPhi],
    Return@modelFailure["InvalidAnalysis",
      "DerivativeFloor must be non-negative; numerical tolerances must be positive; ReturnPhi must be True, False, or Automatic."]
  ];
  equilibrium = SettleNetwork[model, input,
    Sequence @@ FilterRules[{opts}, Options[SettleNetwork]]];
  If[FailureQ[equilibrium], Return[equilibrium]];
  {n, m} = Lookup[model, {"InputSize", "OutputSize"}];
  s = equilibrium["State"];
  rawFirst = LogisticPrimeFromField[equilibrium["Field"]];
  first = rawFirst;
  If[floor != 0., first = Map[Max[floor, #] &, first]];
  floorApplied = AnyTrue[MapThread[Unequal, {first, rawFirst}], TrueQ];
  second = LogisticSecondFromField[equilibrium["Field"]];
  If[AnyTrue[first, !finiteNumericQ[#] || # <= 0 &],
    Return@modelFailure["SaturatedDerivative",
      "A logistic derivative underflowed to zero; the exact machine-precision susceptibility is not representable."]
  ];
  forwardSolver = makePhiSolver[model, first, False, solveTolerance];
  If[forwardSolver === $Failed,
    Return@modelFailure["SingularNetwork", "G^-1-K is singular or ill-conditioned."]
  ];
  chi = forwardSolver[model["W"], False];
  If[chi === $Failed || !finiteMatrixQ[chi, {m, n}],
    Return@modelFailure["SingularNetwork", "G^-1-K is singular or ill-conditioned."]
  ];
  gram = Transpose[chi].chi;
  singularValues = Quiet@Check[SingularValueList[chi], $Failed];
  If[singularValues === $Failed || Length[singularValues] != n ||
      !VectorQ[singularValues, finiteNumericQ] || Max[singularValues] <= 0 ||
      Min[singularValues]/Max[singularValues] <= pivot,
    Return@modelFailure["SingularSusceptibility",
      "The susceptibility lacks full column rank at the requested relative tolerance."]
  ];
  susceptibilityCondition = Max[singularValues]/Min[singularValues];
  objective = -Total[Log[singularValues]];
  returnPhi = Replace[returnPhi, Automatic -> (!lowRankModelQ[model] && m <= 256)];
  phi = If[TrueQ[returnPhi], forwardSolver[IdentityMatrix[m], False],
    Missing["NotMaterialized"]];
  If[phi === $Failed,
    Return@modelFailure["SingularNetwork", "The recurrent inverse could not be materialized."]
  ];
  base = Join[equilibrium, <|
    "Input" -> N@input,
    "FirstDerivative" -> first,
    "UnflooredFirstDerivative" -> rawFirst,
    "SecondDerivative" -> second,
    "DerivativeFloor" -> floor,
    "DerivativeFloorApplied" -> floorApplied,
    "EquationSemantics" -> If[floorApplied,
      "ProjectSurrogateDerivativeFloor", "PublicationEquations"],
    "Phi" -> phi,
    "Susceptibility" -> chi,
    "Gram" -> gram,
    "SusceptibilitySingularValues" -> singularValues,
    "SusceptibilityConditionNumber" -> susceptibilityCondition,
    "Objective" -> objective|>];
  If[!gradient, Return[base]];
  transposeSolver = makePhiSolver[model, first, True, solveTolerance];
  If[transposeSolver === $Failed,
    Return@modelFailure["SingularNetwork", "The transposed recurrent operator could not be factored."]
  ];
  chiScale = maxAbsArray[chi];
  If[!finiteNumericQ[chiScale] || chiScale <= 0,
    Return@modelFailure["SingularSusceptibility", "The recurrent gradient scale is not representable."]
  ];
  scaledChi = chi/chiScale;
  {qTranspose, r} = Quiet@Check[QRDecomposition[scaledChi], {$Failed, $Failed}];
  If[qTranspose === $Failed || r === $Failed,
    Return@modelFailure["SingularSusceptibility", "The susceptibility QR factorization failed."]
  ];
  phiTQ = transposeSolver[Transpose[qTranspose], False];
  If[phiTQ === $Failed,
    Return@modelFailure["SingularNetwork", "The transposed recurrent operator could not be solved."]
  ];
  gammaRight = Transpose[phiTQ]/chiScale;
  gammaSolver = Quiet@Check[LinearSolve[r], $Failed];
  gamma = If[gammaSolver === $Failed, $Failed,
    Quiet@Check[gammaSolver[gammaRight], $Failed]
  ];
  gammaResidual = If[gamma === $Failed, Infinity,
    maxAbsArray[r.gamma - gammaRight]/Max[10.^-280,
      Max[Total /@ Abs[r]] maxAbsArray[gamma] + maxAbsArray[gammaRight]]];
  If[gamma === $Failed || !finiteNumericQ[gammaResidual] || gammaResidual > solveTolerance,
    Return@modelFailure["SingularSusceptibility", "The recurrent gradient could not be solved."]
  ];
  chiGammaDiagonal = Total /@ (chi Transpose[gamma]);
  (* Compute G a without the underflow-prone g'^3 denominator from the
     displayed definition of a.  With the publication derivative this reduces
     to g''/g'=-tanh(h/2); an active project derivative floor instead retains
     the literal surrogate ratio g''/g' so the floor is not silently ignored. *)
  scaledA = (chiGammaDiagonal/first) If[floorApplied,
    second/first, -Tanh[equilibrium["Field"]/2]];
  aCandidate = scaledA/first;
  a = If[VectorQ[aCandidate, finiteNumericQ], aCandidate,
    Missing["NumericallyUnrepresentableIntermediate"]];
  b = transposeSolver[scaledA, True];
  If[b === $Failed,
    Return@modelFailure["SingularNetwork", "The recurrent gradient vector could not be solved."]
  ];
  leftFactors = Join[Transpose[gamma], Transpose[{b}], 2];
  rightFactors = Join[chi, Transpose[{s}], 2];
  If[lowRankModelQ[model],
    chiGamma = Missing["MatrixFree"];
    update = <|"Representation" -> "LowRank",
      "LeftFactors" -> leftFactors, "RightFactors" -> rightFactors|>,
    chiGamma = chi.gamma;
    update = leftFactors.Transpose[rightFactors]
  ];
  Join[base, <|"Gamma" -> gamma, "ChiGamma" -> chiGamma,
    "ChiGammaDiagonal" -> chiGammaDiagonal,
    "A" -> a, "ScaledA" -> scaledA,
    "AMaterialized" -> VectorQ[a, finiteNumericQ],
    "GammaQRSolveRelativeResidual" -> gammaResidual,
    "UpdateDirection" -> update|>]
];

InfomaxObjective[model_, input_, opts : OptionsPattern[AnalyzeNetwork]] := Module[{analysis},
  analysis = AnalyzeNetwork[model, input, "Gradient" -> False,
    "ReturnPhi" -> False,
    Sequence @@ FilterRules[{opts}, Options[SettleNetwork]],
    "DerivativeFloor" -> OptionValue["DerivativeFloor"],
    "PivotTolerance" -> OptionValue["PivotTolerance"],
    "SolveResidualTolerance" -> OptionValue["SolveResidualTolerance"]];
  If[FailureQ[analysis], analysis, analysis["Objective"]]
];

Options[RecurrentUpdateDirection] = Options[AnalyzeNetwork];

ClearAll[lowRankDirectionQ, directionToDense, combineDirections, directionMaxAbsBound];
lowRankDirectionQ[direction_] := Module[{left, right},
  If[!AssociationQ[direction] ||
      Lookup[direction, "Representation", None] =!= "LowRank", Return[False]];
  left = Lookup[direction, "LeftFactors", {}];
  right = Lookup[direction, "RightFactors", {}];
  MatrixQ[left, finiteNumericQ] && MatrixQ[right, finiteNumericQ] &&
    First@Dimensions[left] == First@Dimensions[right] &&
    Last@Dimensions[left] == Last@Dimensions[right]
];
directionToDense[direction_] := If[lowRankDirectionQ[direction],
  direction["LeftFactors"].Transpose[direction["RightFactors"]], direction];
combineDirections[directions_List] := If[AllTrue[directions, lowRankDirectionQ],
  <|"Representation" -> "LowRank",
    "LeftFactors" -> Join[Sequence @@
      Map[#1["LeftFactors"]/Length[directions] &, directions], 2],
    "RightFactors" -> Join[Sequence @@ Lookup[directions, "RightFactors"], 2]|>,
  Mean[directionToDense /@ directions]
];
directionMaxAbsBound[direction_] := If[lowRankDirectionQ[direction], Module[
    {left = direction["LeftFactors"], right = direction["RightFactors"]},
    If[Last@Dimensions[left] == 0, 0.,
      Max[Abs[left].(Max /@ Transpose[Abs[right]])]]
  ], Max[Abs[Flatten[direction]]]];
ClearAll[scaleDirection];
scaleDirection[direction_, scale_] := If[lowRankDirectionQ[direction],
  Join[direction, <|"LeftFactors" -> direction["LeftFactors"]/scale|>],
  direction/scale
];

RecurrentUpdateDirection[model_, inputs_List, opts : OptionsPattern[]] := Module[
  {analyses, analysisOptions},
  If[inputs === {}, Return@modelFailure["InvalidTraining", "At least one input is required."]];
  analysisOptions = DeleteCases[
    FilterRules[{opts}, Options[AnalyzeNetwork]],
    ("Gradient" | "ReturnPhi") -> _
  ];
  analyses = AnalyzeNetwork[model, #, "Gradient" -> True,
      "ReturnPhi" -> False, Sequence @@ analysisOptions] & /@ inputs;
  If[AnyTrue[analyses, FailureQ], Return@FirstCase[analyses, _Failure]];
  <|"UpdateDirection" -> combineDirections[Lookup[analyses, "UpdateDirection"]],
    "Objective" -> Mean[Lookup[analyses, "Objective"]],
    "MeanSettleIterations" -> Mean[Lookup[analyses, "Iterations"]],
    "Analyses" -> analyses|>
];

ClearAll[economyColumnBasis, compressLowRankFactors];
economyColumnBasis[matrix_?MatrixQ, tolerance_: 1.*^-12] := Module[{vectors},
  If[Last@Dimensions[matrix] == 0, Return[matrix]];
  vectors = Select[Orthogonalize[Transpose[matrix]], Norm[#] > tolerance &];
  If[vectors === {}, ConstantArray[0., {First@Dimensions[matrix], 0}], Transpose[vectors]]
];
compressLowRankFactors[left_?MatrixQ, right_?MatrixQ, maximum_Integer] := Module[
  {qLeft, qRight, core, u, singular, v, values, keep, roots, newLeft, newRight, discarded},
  If[Last@Dimensions[left] <= maximum,
    Return[<|"LeftFactors" -> left, "RightFactors" -> right,
      "Truncated" -> False, "DiscardedSingularValueMass" -> 0.|>]
  ];
  qLeft = economyColumnBasis[left]; qRight = economyColumnBasis[right];
  If[Last@Dimensions[qLeft] == 0 || Last@Dimensions[qRight] == 0,
    Return[<|"LeftFactors" -> ConstantArray[0., {First@Dimensions[left], 0}],
      "RightFactors" -> ConstantArray[0., {First@Dimensions[right], 0}],
      "Truncated" -> True, "DiscardedSingularValueMass" -> 0.|>]
  ];
  core = (Transpose[qLeft].left).Transpose[Transpose[qRight].right];
  {u, singular, v} = SingularValueDecomposition[core];
  values = Diagonal[singular];
  keep = Min[maximum, Count[values, value_ /; value > 1.*^-12]];
  discarded = Total[Drop[values, keep]];
  If[keep == 0,
    newLeft = ConstantArray[0., {First@Dimensions[left], 0}];
    newRight = ConstantArray[0., {First@Dimensions[right], 0}],
    roots = DiagonalMatrix[Sqrt[Take[values, keep]]];
    newLeft = qLeft.u[[All, 1 ;; keep]].roots;
    newRight = qRight.v[[All, 1 ;; keep]].roots
  ];
  <|"LeftFactors" -> newLeft, "RightFactors" -> newRight,
    "Truncated" -> True, "DiscardedSingularValueMass" -> discarded|>
];

Options[ApplyRecurrentUpdate] = {
  "ZeroDiagonal" -> Automatic, "MaxAbsWeight" -> Infinity,
  "MaximumRank" -> Automatic, "DensifyAtStorageCrossover" -> True,
  "DensifyAtFullRank" -> Automatic
};

ApplyRecurrentUpdate[model_, direction_, learningRate_, OptionsPattern[]] := Module[
  {m, k, maximum = OptionValue["MaxAbsWeight"], recurrent, left, right,
    directionLeft, directionRight, maximumRank = OptionValue["MaximumRank"], compressed,
    diagonal, truncations, discarded, denseDirection,
    zeroDiagonal = OptionValue["ZeroDiagonal"],
    densify = OptionValue["DensifyAtStorageCrossover"],
    legacyDensify = OptionValue["DensifyAtFullRank"], factorColumns},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  m = model["OutputSize"];
  If[(!lowRankDirectionQ[direction] && !finiteMatrixQ[direction, {m, m}]) ||
      (lowRankDirectionQ[direction] &&
        First@Dimensions[direction["LeftFactors"]] != m) ||
      !finiteNumericQ[learningRate] || learningRate < 0,
    Return@modelFailure["InvalidUpdate", "The update matrix or learning rate is invalid."]
  ];
  zeroDiagonal = Replace[zeroDiagonal, Automatic ->
    TrueQ@Lookup[Lookup[model, "Metadata", <||>], "ExcludeSelfCoupling", False]];
  If[!BooleanQ[zeroDiagonal],
    Return@modelFailure["InvalidUpdate", "ZeroDiagonal must be True, False, or Automatic."]
  ];
  If[!MemberQ[{True, False, Automatic}, legacyDensify] || !BooleanQ[densify],
    Return@modelFailure["InvalidUpdate", "Densification switches must be boolean (or Automatic for the deprecated alias)."]
  ];
  If[legacyDensify =!= Automatic, densify = legacyDensify];
  If[learningRate == 0, Return[model]];
  If[lowRankModelQ[model],
    If[!lowRankDirectionQ[direction],
      Return@modelFailure["InvalidUpdate", "A matrix-free model requires a low-rank update direction."]
    ];
    If[maximum =!= Infinity,
      Return@modelFailure["InvalidUpdate", "Elementwise MaxAbsWeight clipping requires Dense representation."]
    ];
    recurrent = model["Recurrent"];
    maximumRank = Replace[maximumRank, Automatic -> recurrent["MaximumRank"]];
    If[maximumRank =!= Infinity && (!IntegerQ[maximumRank] || maximumRank < 1),
      Return@modelFailure["InvalidUpdate", "MaximumRank must be a positive integer or Infinity."]
    ];
    directionLeft = N[learningRate direction["LeftFactors"]];
    directionRight = N[direction["RightFactors"]];
    left = Join[recurrent["LeftFactors"], directionLeft, 2];
    right = Join[recurrent["RightFactors"], directionRight, 2];
    truncations = recurrent["Truncations"];
    discarded = recurrent["DiscardedSingularValueMass"];
    If[maximumRank =!= Infinity && Last@Dimensions[left] > maximumRank,
      compressed = compressLowRankFactors[left, right, maximumRank];
      left = compressed["LeftFactors"]; right = compressed["RightFactors"];
      If[TrueQ@compressed["Truncated"], truncations++];
      discarded += compressed["DiscardedSingularValueMass"]
    ];
    diagonal = recurrent["Diagonal"];
    If[TrueQ[zeroDiagonal],
      diagonal = -(Total /@ (left right))
    ];
    factorColumns = Last@Dimensions[left];
    If[TrueQ[densify] && m (2 factorColumns + 1) >= m^2,
      k = DiagonalMatrix[diagonal] + left.Transpose[right];
      Return@Join[KeyDrop[model, "Recurrent"], <|"K" -> k,
        "Metadata" -> Join[model["Metadata"], <|
          "RecurrentRepresentation" -> "Dense",
          "DensifiedFromExactFactors" -> True,
          "DensificationCriterion" -> "dense-storage-not-larger",
          "FactorColumnsAtDensification" -> factorColumns,
          "Approximate" -> (truncations > 0)|>]|>]
    ];
    recurrent = <|"Representation" -> "LowRankPlusDiagonal",
      "Diagonal" -> diagonal, "LeftFactors" -> left, "RightFactors" -> right,
      "MaximumRank" -> maximumRank, "Truncations" -> truncations,
      "DiscardedSingularValueMass" -> discarded|>;
    Return@Join[model, <|"Recurrent" -> recurrent,
      "Metadata" -> Join[model["Metadata"], <|
        "MaximumRank" -> maximumRank, "Approximate" -> (truncations > 0)|>]|>]
  ];
  denseDirection = directionToDense[direction];
  k = N[model["K"] + learningRate denseDirection];
  If[maximum =!= Infinity,
    If[!finiteNumericQ[maximum] || maximum <= 0,
      Return@modelFailure["InvalidUpdate", "MaxAbsWeight must be positive or Infinity."]
    ];
    k = Clip[k, {-maximum, maximum}]
  ];
  If[TrueQ[zeroDiagonal], Do[k[[i, i]] = 0., {i, m}]];
  Join[model, <|"K" -> k|>]
];

Options[TrainNetwork] = Join[{
    "Steps" -> 1, "BatchSize" -> 1, "LearningRate" -> 1.*^-4,
    "Policy" -> "fixed-best", "RestoreBest" -> True,
    "CheckpointInputs" -> Automatic, "CheckpointInterval" -> 1,
    "LegacyOnlineCheckpoint" -> False,
    "GradientClip" -> Infinity, "MaxAbsWeight" -> Infinity,
    "MaximumRank" -> Automatic, "ZeroDiagonal" -> Automatic,
    "DensifyAtStorageCrossover" -> True,
    "DensifyAtFullRank" -> Automatic, "OnStep" -> None
  }, Options[SettleNetwork], {"DerivativeFloor" -> 0., "PivotTolerance" -> 1.*^-13,
    "SolveResidualTolerance" -> 1.*^-10}];

TrainNetwork[model_, sampler_, opts : OptionsPattern[]] := Module[
  {steps = OptionValue["Steps"], batchSize = OptionValue["BatchSize"],
    eta = N@OptionValue["LearningRate"], initialEta, policy = OptionValue["Policy"],
    restore = TrueQ@OptionValue["RestoreBest"], clip = OptionValue["GradientClip"],
    checkpointInputs = OptionValue["CheckpointInputs"],
    checkpointInterval = OptionValue["CheckpointInterval"],
    legacyCheckpoint = TrueQ@OptionValue["LegacyOnlineCheckpoint"],
    maxWeight = OptionValue["MaxAbsWeight"], callback = OptionValue["OnStep"],
    maximumRank = OptionValue["MaximumRank"], zeroDiagonal = OptionValue["ZeroDiagonal"],
    densify = OptionValue["DensifyAtStorageCrossover"],
    legacyDensify = OptionValue["DensifyAtFullRank"],
    current = model, bestModel,
    bestObjective = Missing["Disabled"], history, inputs, result,
    objective, direction, scale, maxDirection, candidate, proposed, accepted, attempts,
    record, analysisOptions, checkpointObjective, checkpointValues, checkpointMode},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  If[!IntegerQ[steps] || steps < 1 || !IntegerQ[batchSize] || batchSize < 1 ||
      !finiteNumericQ[eta] || eta < 0 || !MemberQ[{"fixed-best", "backtrack"}, policy],
    Return@modelFailure["InvalidTraining", "Training options are invalid."]
  ];
  If[!IntegerQ[checkpointInterval] || checkpointInterval < 1 ||
      !MemberQ[{True, False}, OptionValue["LegacyOnlineCheckpoint"]] ||
      !BooleanQ[densify] || !MemberQ[{True, False, Automatic}, legacyDensify],
    Return@modelFailure["InvalidTraining",
      "CheckpointInterval must be positive; checkpoint and densification switches must be boolean."]
  ];
  If[legacyDensify =!= Automatic, densify = legacyDensify];
  If[checkpointInputs =!= Automatic &&
      (!ListQ[checkpointInputs] ||
        AnyTrue[checkpointInputs, !finiteVectorQ[#, model["InputSize"]] &]),
    Return@modelFailure["InvalidTraining",
      "CheckpointInputs must be Automatic or a list of valid fixed inputs."]
  ];
  If[restore && !legacyCheckpoint &&
      (checkpointInputs === Automatic || checkpointInputs === {}),
    Return@modelFailure["MissingCheckpointEnsemble",
      "RestoreBest requires a non-empty fixed CheckpointInputs ensemble; LegacyOnlineCheckpoint is only for old project runs."]
  ];
  initialEta = eta; bestModel = current;
  zeroDiagonal = Replace[zeroDiagonal, Automatic ->
    TrueQ@Lookup[Lookup[model, "Metadata", <||>], "ExcludeSelfCoupling", False]];
  If[!BooleanQ[zeroDiagonal],
    Return@modelFailure["InvalidTraining", "ZeroDiagonal must be True, False, or Automatic."]
  ];
  history = ConstantArray[Null, steps];
  analysisOptions = FilterRules[{opts}, Options[AnalyzeNetwork]];
  checkpointMode = If[!restore, "disabled",
    If[legacyCheckpoint, "legacy-changing-sample", "fixed-ensemble"]];
  If[restore && !legacyCheckpoint,
    checkpointValues = InfomaxObjective[current, #,
        Sequence @@ analysisOptions] & /@ checkpointInputs;
    If[AnyTrue[checkpointValues, FailureQ],
      Return@FirstCase[checkpointValues, _Failure]];
    bestObjective = Mean[checkpointValues];
    bestModel = current
  ];
  Do[
    inputs = Table[N@sampleFrom[sampler, step - 1, sample - 1], {sample, batchSize}];
    result = RecurrentUpdateDirection[current, inputs, Sequence @@ analysisOptions];
    If[FailureQ[result], Return[result]];
    objective = result["Objective"];
    direction = result["UpdateDirection"];
    If[restore && legacyCheckpoint &&
        (MissingQ[bestObjective] || objective < bestObjective),
      bestObjective = objective; bestModel = current
    ];
    maxDirection = directionMaxAbsBound[direction];
    If[clip =!= Infinity,
      If[!finiteNumericQ[clip] || clip <= 0,
        Return@modelFailure["InvalidTraining", "GradientClip must be positive or Infinity."]
      ];
      scale = Max[1., maxDirection/clip]; direction = scaleDirection[direction, scale];
      maxDirection = directionMaxAbsBound[direction]
    ];
    If[policy === "backtrack",
      accepted = False; attempts = 0;
      While[!accepted && attempts < 24,
        candidate = ApplyRecurrentUpdate[current, direction, eta,
          "ZeroDiagonal" -> zeroDiagonal, "MaxAbsWeight" -> maxWeight,
          "MaximumRank" -> maximumRank,
          "DensifyAtStorageCrossover" -> densify];
        If[FailureQ[candidate], Return[candidate]];
        proposed = InfomaxObjective[candidate, #,
            Sequence @@ analysisOptions] & /@ inputs;
        accepted = FreeQ[proposed, _Failure] && Mean[proposed] <= objective;
        If[accepted, current = candidate, eta = eta/2];
        attempts++;
      ],
      current = ApplyRecurrentUpdate[current, direction, eta,
        "ZeroDiagonal" -> zeroDiagonal, "MaxAbsWeight" -> maxWeight,
        "MaximumRank" -> maximumRank,
        "DensifyAtStorageCrossover" -> densify];
      If[FailureQ[current], Return[current]]
    ];
    checkpointObjective = Missing["NotEvaluated"];
    If[restore && !legacyCheckpoint &&
        (Mod[step, checkpointInterval] == 0 || step == steps),
      checkpointValues = InfomaxObjective[current, #,
          Sequence @@ analysisOptions] & /@ checkpointInputs;
      If[AnyTrue[checkpointValues, FailureQ],
        Return@FirstCase[checkpointValues, _Failure]];
      checkpointObjective = Mean[checkpointValues];
      If[checkpointObjective < bestObjective,
        bestObjective = checkpointObjective; bestModel = current
      ]
    ];
    record = <|"Step" -> step, "Objective" -> objective,
      "CheckpointObjective" -> checkpointObjective,
      "LearningRate" -> eta,
      "MeanSettleIterations" -> result["MeanSettleIterations"],
      "MaxAbsUpdate" -> maxDirection,
      "MaxAbsWeightBound" -> recurrentMaxAbsBound[current],
      "RecurrentRepresentation" -> If[lowRankModelQ[current],
        "LowRankPlusDiagonal", "Dense"],
      "RecurrentFactorColumns" -> If[lowRankModelQ[current],
        Last@Dimensions[current["Recurrent"]["LeftFactors"]],
        Missing["DenseRepresentation"]]|>;
    history[[step]] = record;
    If[callback =!= None, callback[record, current]],
    {step, steps}
  ];
  If[restore, current = bestModel];
  <|"Model" -> current, "Policy" -> policy, "Steps" -> steps,
    "BatchSize" -> batchSize, "InitialLearningRate" -> initialEta,
    "FinalLearningRate" -> eta, "BestObjective" -> bestObjective,
    "CheckpointMode" -> checkpointMode,
    "CheckpointInputCount" -> If[ListQ[checkpointInputs], Length[checkpointInputs], 0],
    "CheckpointInterval" -> checkpointInterval,
    "History" -> history, "RestoredBest" -> restore,
    "ZeroDiagonal" -> zeroDiagonal,
    "SamplerState" -> If[AssociationQ[sampler] && KeyExistsQ[sampler, "Snapshot"],
      sampler["Snapshot"][], Missing["NotAvailable"]]|>
];

ModalityActivity[model_, state_, modality_Integer] := Module[{specification, start, count},
  If[!validModelQ[model] || !finiteVectorQ[state, Lookup[model, "OutputSize", 0]] ||
      !Between[modality, {1, Length@Lookup[model, "Modalities", {}]}],
    Return@modelFailure["InvalidModality", "The modality or state is invalid."]
  ];
  specification = model["Modalities"][[modality]];
  {start, count} = Lookup[specification, {"OutputOffset", "OutputCount"}];
  state[[start ;; start + count - 1]]
];

Options[PopulationVector] = {"Normalization" -> "Sum"};

PopulationVector[activity_List, preferredAngles_List, OptionsPattern[]] := Module[
  {vector, angle, normalization = OptionValue["Normalization"]},
  If[Length[activity] == 0 || Length[activity] != Length[preferredAngles] ||
      !VectorQ[activity, finiteNumericQ] || !VectorQ[preferredAngles, finiteNumericQ],
    Return@modelFailure["InvalidPopulation", "Activity and preferred angles must have equal non-zero lengths."]
  ];
  If[!MemberQ[{"Sum", "Mean"}, normalization],
    Return@modelFailure["InvalidPopulation", "Normalization must be Sum or Mean."]
  ];
  vector = Total[MapThread[#1 {Cos[#2], Sin[#2]} &, {activity, preferredAngles}]];
  If[normalization === "Mean", vector = vector/Length[activity]];
  angle = Mod[ArcTan[vector[[1]], vector[[2]]], 2 Pi];
  <|"Real" -> vector[[1]], "Imaginary" -> vector[[2]],
    "Magnitude" -> Norm[vector], "AngleRadians" -> angle,
    "AngleDegrees" -> angle 180/Pi, "Normalization" -> normalization|>
];

Options[RespondNetwork] = Join[{"PopulationNormalization" -> "Sum"}, Options[SettleNetwork]];

RespondNetwork[model_, input_, opts : OptionsPattern[]] := Module[
  {equilibrium, populations, normalization = OptionValue["PopulationNormalization"]},
  equilibrium = SettleNetwork[model, input, Sequence @@ FilterRules[{opts}, Options[SettleNetwork]]];
  If[FailureQ[equilibrium], Return[equilibrium]];
  populations = MapIndexed[Function[{modality, index}, Module[{activity},
      activity = ModalityActivity[model, equilibrium["State"], First@index];
      <|"Name" -> modality["Name"], "Activity" -> activity,
        "PreferredAngles" -> modality["PreferredAngles"],
        "Population" -> PopulationVector[activity, modality["PreferredAngles"],
          "Normalization" -> normalization]|>
    ]], model["Modalities"]];
  Join[equilibrium, <|"Input" -> N@input, "Modalities" -> populations|>]
];

Options[ProbeCrossModalMapping] = Join[
  {"Angles" -> N@Table[2 Pi i/72, {i, 0, 71}], "ProbeRadius" -> 1.,
    "WarmStart" -> True, "PopulationNormalization" -> "Sum"},
  Options[SettleNetwork]
];

ProbeCrossModalMapping[model_, source_Integer, target_Integer, opts : OptionsPattern[]] := Module[
  {angles = N@OptionValue["Angles"], radius = N@OptionValue["ProbeRadius"], rows,
    response, population, warm = TrueQ@OptionValue["WarmStart"], initial,
    normalization = OptionValue["PopulationNormalization"],
    settleRules},
  If[!MemberQ[{1, 2}, source] || !MemberQ[{1, 2}, target] || source == target ||
      !VectorQ[angles, finiteNumericQ] || !finiteNumericQ[radius],
    Return@modelFailure["InvalidProbe", "Source and target must be different modalities 1 and 2."]
  ];
  settleRules = FilterRules[{opts}, Options[SettleNetwork]];
  initial = Replace["InitialState" /. settleRules, "InitialState" -> Automatic];
  settleRules = DeleteCases[settleRules, "InitialState" -> _];
  rows = Table[
    response = RespondNetwork[model, PolarProbe[source, angle, radius],
      Sequence @@ settleRules, "InitialState" -> initial,
      "PopulationNormalization" -> normalization];
    If[FailureQ[response], Return[response]];
    If[warm, initial = response["State"]];
    population = response["Modalities"][[target]]["Population"];
    <|"StimulusAngleRadians" -> angle,
      "StimulusAngleDegrees" -> angle 180/Pi,
      "Magnitude" -> population["Magnitude"],
      "ResponseAngleRadians" -> population["AngleRadians"],
      "ResponseAngleDegrees" -> population["AngleDegrees"]|>,
    {angle, angles}
  ];
  rows
];

MaterializeRecurrentMatrix[model_] := Module[{recurrent},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  If[!lowRankModelQ[model], Return[model["K"]]];
  recurrent = model["Recurrent"];
  DiagonalMatrix[recurrent["Diagonal"]] +
    recurrent["LeftFactors"].Transpose[recurrent["RightFactors"]]
];

EstimateNetworkScale[total_, rank_ : 128] := Module[
  {perModality, denseNumbers, denseConnections, lowRankNumbers,
    feedForwardNumbers, stateNumbers},
  If[!IntegerQ[total] || total < 6 || OddQ[total] ||
      !IntegerQ[rank] || rank < 0,
    Return@modelFailure["InvalidScale",
      "The output-neuron total must be an even integer of at least six and rank must be a non-negative integer."]
  ];
  perModality = Quotient[total, 2];
  denseNumbers = total^2;
  denseConnections = total (total - 1);
  lowRankNumbers = total (2 rank + 1);
  feedForwardNumbers = 4 total;
  stateNumbers = total;
  <|"InputNeurons" -> 4, "OutputNeurons" -> total,
    "NeuronsPerModality" -> perModality,
    "PreferredAngleSpacingDegrees" -> N[360/perModality],
    "DenseAdaptiveParametersGeneralRule" -> denseNumbers,
    "DenseAdaptiveConnectionsNoSelfOptional" -> denseConnections,
    "DenseAdaptiveConnectionsNoSelf" -> denseConnections,
    "DenseRecurrentNumbers" -> denseNumbers,
    "DenseRecurrentBytesReal64" -> 8 denseNumbers,
    "RequestedFactorColumns" -> rank,
    "LowRankTermAlgebraicRankUpperBound" -> Min[total, rank],
    "LowRankPlusDiagonalNumbers" -> lowRankNumbers,
    "LowRankPlusDiagonalBytesReal64" -> 8 lowRankNumbers,
    "DenseToLowRankStorageRatio" -> N[denseNumbers/lowRankNumbers],
    "FeedForwardNumbers" -> feedForwardNumbers,
    "FeedForwardBytesReal64" -> 8 feedForwardNumbers,
    "OneStateVectorBytesReal64" -> 8 stateNumbers,
    "FactorColumnsAddedPerSampleUpdate" -> 5,
    "PerSampleUpdateAlgebraicRankUpperBound" -> 5,
    "BiologicalEquivalence" -> False,
    "ExactnessNote" -> "A finite rank cap is approximate after truncation; neuron count alone does not make a rate model biologically equivalent to a brain."|>
];

NetworkScaleReport[model_] := Module[
  {m, n, factorColumns, stored, dense, recurrent, exact, maximumRank,
    truncations, discarded, matVecComplexity, solveCoreComplexity},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  {n, m} = Lookup[model, {"InputSize", "OutputSize"}];
  If[lowRankModelQ[model],
    recurrent = model["Recurrent"];
    factorColumns = Last@Dimensions[recurrent["LeftFactors"]];
    stored = m + 2 m factorColumns;
    exact = recurrent["Truncations"] == 0;
    maximumRank = recurrent["MaximumRank"];
    truncations = recurrent["Truncations"];
    discarded = recurrent["DiscardedSingularValueMass"];
    matVecComplexity = "O(M r)";
    solveCoreComplexity = "O(M r^2 + r^3)",
    factorColumns = Missing["DenseRepresentation"]; stored = m^2;
    exact = !TrueQ@Lookup[Lookup[model, "Metadata", <||>], "Approximate", False];
    maximumRank = Missing["DenseRepresentation"];
    truncations = 0; discarded = 0.;
    matVecComplexity = "O(M^2)";
    solveCoreComplexity = "O(M^3)"
  ];
  dense = m^2;
  <|"InputNeurons" -> n, "OutputNeurons" -> m,
    "NeuronsPerModality" -> Quotient[m, 2],
    "RecurrentRepresentation" -> If[lowRankModelQ[model], "LowRankPlusDiagonal", "Dense"],
    "FactorColumns" -> factorColumns,
    "LowRankTermAlgebraicRankUpperBound" -> If[IntegerQ[factorColumns],
      Min[m, factorColumns], Missing["DenseRepresentation"]],
    "MaximumFactorColumns" -> maximumRank,
    "Truncations" -> truncations,
    "DiscardedSingularValueMass" -> discarded,
    "FixedPointMatVecComplexity" -> matVecComplexity,
    "SusceptibilitySolveComplexity" -> solveCoreComplexity,
    "StoredRecurrentNumbers" -> stored,
    "StoredRecurrentBytesReal64" -> 8 stored,
    "DenseEquivalentNumbers" -> dense,
    "DenseEquivalentBytesReal64" -> 8 dense,
    "CompressionRatio" -> N[dense/stored], "AlgebraicallyExactSoFar" -> exact|>
];

Options[CrossTalkSummary] = {"Materialize" -> False};

CrossTalkSummary[model_, OptionsPattern[]] := Module[
  {modalities, first, second, blockSummary, materialize = TrueQ@OptionValue["Materialize"],
    recurrent, signedLowRank},
  If[!validModelQ[model] || Length@Lookup[model, "Modalities", {}] != 2,
    Return@modelFailure["InvalidModel", "CrossTalkSummary requires exactly two modalities."]
  ];
  modalities = model["Modalities"]; {first, second} = modalities;
  recurrent = Lookup[model, "Recurrent", None];
  signedLowRank[target_, source_] := Module[{tr, sr, leftSums, rightSums},
    tr = target["OutputOffset"] ;; target["OutputOffset"] + target["OutputCount"] - 1;
    sr = source["OutputOffset"] ;; source["OutputOffset"] + source["OutputCount"] - 1;
    leftSums = Total /@ Transpose[recurrent["LeftFactors"][[tr, All]]];
    rightSums = Total /@ Transpose[recurrent["RightFactors"][[sr, All]]];
    If[leftSums === {}, 0., leftSums.rightSums]/(target["OutputCount"] source["OutputCount"])
  ];
  blockSummary[target_, source_] := Module[{block, tr, sr},
    tr = target["OutputOffset"] ;; target["OutputOffset"] + target["OutputCount"] - 1;
    sr = source["OutputOffset"] ;; source["OutputOffset"] + source["OutputCount"] - 1;
    If[lowRankModelQ[model] && !materialize,
      <|"MeanAbsolute" -> Missing["RequiresMaterialization"],
        "MeanSigned" -> signedLowRank[target, source]|>,
      block = MaterializeRecurrentMatrix[model][[tr, sr]];
      <|"MeanAbsolute" -> Mean[Abs[Flatten[block]]], "MeanSigned" -> Mean[Flatten[block]]|>
    ]
  ];
  <|"From1To2" -> blockSummary[second, first],
    "From2To1" -> blockSummary[first, second]|>
];

SimpleStabilityJacobian[variance1_, variance2_] := Module[{alpha1, alpha2, coupling},
  alpha1 = variance1 + 1/4; alpha2 = variance2 + 1/4;
  coupling = 3/4 - 2 alpha1 - 2 alpha2 + 5 alpha1 alpha2;
  {{alpha2 (2 alpha1 - 1), coupling},
    {coupling, alpha1 (2 alpha2 - 1)}}
];

SimpleStabilityInvariants[variance1_, variance2_] := Module[
  {alpha1 = variance1 + 1/4, alpha2 = variance2 + 1/4, trace, determinant, discriminant, jacobian},
  jacobian = SimpleStabilityJacobian[variance1, variance2];
  trace = 4 alpha1 alpha2 - alpha1 - alpha2;
  determinant = -9/16 + 3 alpha1 + 3 alpha2 - 4 alpha1^2 - 4 alpha2^2 -
    (29/2) alpha1 alpha2 + 18 alpha1 alpha2^2 + 18 alpha1^2 alpha2 -
    21 alpha1^2 alpha2^2;
  discriminant = trace^2 - 4 determinant;
  <|"SecondMoments" -> {alpha1, alpha2}, "Jacobian" -> jacobian,
    "Trace" -> trace, "Determinant" -> determinant,
    "Discriminant" -> discriminant,
    "DeterminantIdentity" -> Simplify[Det[jacobian] == determinant]|>
];

SimpleNoCrossTalkStability[variance1_?NumericQ, variance2_?NumericQ, learningRate_ : 1.*^-4] := Module[
  {invariants, eigenvalues, spectralRadius, critical = Missing["NotApplicable"],
    infinitesimal, candidates},
  If[!And @@ (0 <= # <= 0.25 & /@ {variance1, variance2}) ||
      !finiteNumericQ[learningRate] || learningRate < 0,
    Return@modelFailure["InvalidVariance", "Output variances must be in [0,0.25] and eta must be non-negative."]
  ];
  invariants = SimpleStabilityInvariants[variance1, variance2];
  eigenvalues = N@Eigenvalues[N@invariants["Jacobian"]];
  spectralRadius = Max[Abs[1 + learningRate eigenvalues]];
  infinitesimal = invariants["Trace"] < 0 && invariants["Determinant"] > 0;
  If[infinitesimal,
    candidates = (-2 Re[#]/Abs[#]^2 &) /@ eigenvalues;
    If[AllTrue[candidates, Positive], critical = Min[candidates]]
  ];
  Join[invariants, <|"Variance1" -> variance1, "Variance2" -> variance2,
    "Eigenvalues" -> eigenvalues, "CriticalLearningRate" -> critical,
    "SpectralRadius" -> spectralRadius, "InfinitesimalStable" -> infinitesimal,
    "Stable" -> (infinitesimal && learningRate > 0 && spectralRadius < 1)|>]
];

OutputVarianceForGaussian[variance_?NumericQ] := Module[{sigma},
  If[!finiteNumericQ[variance] || variance < 0,
    Return@modelFailure["InvalidVariance", "Gaussian input variance must be non-negative."]
  ];
  If[variance == 0, Return[0.]];
  sigma = Sqrt[variance];
  NIntegrate[(LogisticActivation[x] - 1/2)^2 Exp[-x^2/(2 variance)]/(Sqrt[2 Pi] sigma),
    {x, -Infinity, Infinity}, Method -> "GlobalAdaptive"]
];

ImportJavaScriptNetwork[path_] := Module[{payload, source, m, n, modalities, metadata},
  payload = Quiet@Check[Import[path, "RawJSON"], $Failed];
  If[payload === $Failed || !AssociationQ[payload],
    Return@modelFailure["InvalidCheckpoint", "The JSON checkpoint could not be imported."]
  ];
  source = Lookup[payload, "network", payload];
  {n, m} = Lookup[source, {"inputSize", "outputSize"}, Missing[]];
  If[!IntegerQ[n] || !IntegerQ[m] || Length@Lookup[source, "W", {}] != m n ||
      Length@Lookup[source, "K", {}] != m m,
    Return@modelFailure["InvalidCheckpoint", "The JSON network dimensions are inconsistent."]
  ];
  modalities = Map[Function[entry,
    <|"Name" -> entry["name"], "InputOffset" -> entry["inputOffset"] + 1,
      "InputCount" -> entry["inputCount"], "OutputOffset" -> entry["outputOffset"] + 1,
      "OutputCount" -> entry["outputCount"],
      "PreferredAngles" -> N@entry["preferredAngles"]|>], source["modalities"]];
  metadata = Lookup[source, "metadata", <||>];
  If[KeyExistsQ[metadata, "excludeSelfCoupling"],
    metadata = Join[KeyDrop[metadata, "excludeSelfCoupling"],
      <|"ExcludeSelfCoupling" -> TrueQ[metadata["excludeSelfCoupling"]]|>]
  ];
  <|"InputSize" -> n, "OutputSize" -> m,
    "W" -> Partition[N@source["W"], n], "K" -> Partition[N@source["K"], m],
    "Modalities" -> modalities, "Metadata" -> metadata|>
];

ExportJavaScriptNetwork[model_, path_] := Module[{modalities, payload, metadata},
  If[!validModelQ[model], Return@modelFailure["InvalidModel", "The network association is malformed."]];
  modalities = Map[Function[entry,
    <|"name" -> entry["Name"], "inputOffset" -> entry["InputOffset"] - 1,
      "inputCount" -> entry["InputCount"], "outputOffset" -> entry["OutputOffset"] - 1,
      "outputCount" -> entry["OutputCount"],
      "preferredAngles" -> entry["PreferredAngles"]|>], model["Modalities"]];
  metadata = model["Metadata"];
  If[KeyExistsQ[metadata, "ExcludeSelfCoupling"],
    metadata = Join[KeyDrop[metadata, "ExcludeSelfCoupling"],
      <|"excludeSelfCoupling" -> TrueQ[metadata["ExcludeSelfCoupling"]]|>]
  ];
  payload = <|"schema" -> "neural-synaesthesia/shriki-2016/v1",
    "paper" -> <|"doi" -> $PaperDOI|>, "inputSize" -> model["InputSize"],
    "outputSize" -> model["OutputSize"], "W" -> Flatten[model["W"]],
    "K" -> Flatten[MaterializeRecurrentMatrix[model]], "modalities" -> modalities,
    "metadata" -> metadata|>;
  Export[path, payload, "RawJSON"]
];

End[];
EndPackage[];
