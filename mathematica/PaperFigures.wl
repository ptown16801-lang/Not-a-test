(* ::Package:: *)

BeginPackage["SynesthesiaPaperFigures`", {"SynesthesiaModel`"}];

PaperFigure1::usage = "PaperFigure1[] draws the two-modality recurrent architecture.";
PaperFigure2::usage = "PaperFigure2[] draws the simple two-unit network and independent Gaussian inputs.";
PaperFigure3::usage = "PaperFigure3[] reproduces the analytical phase boundary, plasticity surface, and response examples.";
RunFigure4Simulation::usage = "RunFigure4Simulation[] runs a configurable 27 by 27 numerical simple-model sweep.";
PaperFigure4::usage = "PaperFigure4[result] plots a RunFigure4Simulation result over the analytical boundary.";
PaperFigure5::usage = "PaperFigure5[] draws the population-code architecture and polar input distribution.";
PaperFigure6::usage = "PaperFigure6[model] builds the six analyses used for the learned unidirectional example.";
PaperFigure7::usage = "PaperFigure7[models] compares the five reported input/plasticity regimes.";
TrainPaperScenario::usage = "TrainPaperScenario[name] trains one Figure 7 regime at a requested neuron scale.";
TrainPaperScenarios::usage = "TrainPaperScenarios[] trains all five Figure 7 regimes.";

Begin["`Private`"];

$paperPalette = <|
  "Stable" -> RGBColor[0.15, 0.55, 0.35],
  "Unstable" -> RGBColor[0.75, 0.2, 0.24],
  "Modality1" -> RGBColor[0.82, 0.23, 0.2],
  "Modality2" -> RGBColor[0.15, 0.38, 0.76],
  "Neutral" -> GrayLevel[0.35]
|>;

PaperFigure1[] := Graph[
  {DirectedEdge["Input 1", "Population 1"], DirectedEdge["Input 2", "Population 2"],
    DirectedEdge["Population 1", "Population 1"], DirectedEdge["Population 2", "Population 2"],
    DirectedEdge["Population 1", "Population 2"], DirectedEdge["Population 2", "Population 1"]},
  VertexCoordinates -> <|"Input 1" -> {0, 1}, "Input 2" -> {0, -1},
    "Population 1" -> {2, 1}, "Population 2" -> {2, -1}|>,
  VertexStyle -> {"Input 1" -> LightGray, "Input 2" -> LightGray,
    "Population 1" -> Lighter[$paperPalette["Modality1"], .6],
    "Population 2" -> Lighter[$paperPalette["Modality2"], .6]},
  VertexSize -> .28, VertexLabels -> Placed["Name", Center],
  EdgeStyle -> Directive[GrayLevel[.25], Arrowheads[.025]],
  ImageSize -> 430, PlotLabel -> Style["Two coupled sensory representations", 14, Bold]
];

PaperFigure2[] := Module[{network, distributions},
  network = Graph[
    {DirectedEdge[Subscript[x, 1], Subscript[s, 1]],
      DirectedEdge[Subscript[x, 2], Subscript[s, 2]],
      DirectedEdge[Subscript[s, 1], Subscript[s, 2]],
      DirectedEdge[Subscript[s, 2], Subscript[s, 1]]},
    VertexCoordinates -> {Subscript[x, 1] -> {0, 1}, Subscript[x, 2] -> {0, -1},
      Subscript[s, 1] -> {2, 1}, Subscript[s, 2] -> {2, -1}},
    VertexLabels -> "Name", VertexStyle -> LightGray, VertexSize -> .25,
    EdgeStyle -> Directive[GrayLevel[.2], Arrowheads[.03]], ImageSize -> 360,
    PlotLabel -> "A. Minimal cross-talk network"];
  distributions = Plot[
    Evaluate@Table[PDF[NormalDistribution[0, sigma], x], {sigma, {.35, 1.15}}],
    {x, -3.5, 3.5}, PlotRange -> All,
    PlotStyle -> {$paperPalette["Modality1"], $paperPalette["Modality2"]},
    PlotLegends -> Placed[{"modality 1", "modality 2"}, Above],
    AxesLabel -> {"input", "density"}, ImageSize -> 360,
    PlotLabel -> "B. Independent zero-mean Gaussian inputs"];
  GraphicsRow[{network, distributions}, Spacings -> 20]
];

ClearAll[simpleResponseData];
simpleResponseData[network_, source_Integer, target_Integer, values_List] := Table[
  With[{input = ReplacePart[{0., 0.}, source -> value]},
    With[{response = SettleNetwork[network, input, "IntegrationStep" -> .8,
        "Tolerance" -> 1.*^-11]},
      {value, If[FailureQ[response], Indeterminate, response["State"][[target]]]}
    ]
  ], {value, values}
];

Options[PaperFigure3] = {"LearningRateCeiling" -> 80., "ResponseRange" -> 5.};

PaperFigure3[OptionsPattern[]] := Module[
  {v1, v2, invariants, trace, determinant, discriminant, lambdaMinimum, critical,
    phase, plasticity, normal, evolved, values, normalCurves, evolvedCurves,
    ceiling = OptionValue["LearningRateCeiling"], range = OptionValue["ResponseRange"]},
  invariants = SimpleStabilityInvariants[v1, v2];
  {trace, determinant, discriminant} =
    Lookup[invariants, {"Trace", "Determinant", "Discriminant"}];
  lambdaMinimum = (trace - Sqrt[discriminant])/2;
  critical = -2/lambdaMinimum;
  phase = RegionPlot[
    Evaluate[trace < 0 && determinant > 0], {v1, 0, .25}, {v2, 0, .25},
    PlotStyle -> Lighter[$paperPalette["Stable"], .65],
    BoundaryStyle -> Directive[Black, Thick], FrameLabel -> {Subscript[V, 1], Subscript[V, 2]},
    PlotPoints -> 80, MaxRecursion -> 2, ImageSize -> 390,
    PlotLabel -> "A. Stability of zero cross-talk"];
  plasticity = Plot3D[
    Evaluate[Min[ceiling, critical]], {v1, 0, .249}, {v2, 0, .249},
    RegionFunction -> Function[{x, y, z},
      With[{inv = SimpleStabilityInvariants[x, y]}, inv["Trace"] < 0 && inv["Determinant"] > 0]],
    PlotRange -> {0, ceiling}, Mesh -> None, ColorFunction -> "SolarColors",
    AxesLabel -> {Subscript[V, 1], Subscript[V, 2], Subscript[eta, critical]},
    ImageSize -> 390, PlotLabel -> "B. Critical learning rate (clipped for display)"];
  normal = CreateSimplePaperNetwork[];
  evolved = CreateSimplePaperNetwork["CrossTalk" -> {-2.91, 14.34}];
  values = N@Subdivide[-range, range, 120];
  normalCurves = ListLinePlot[
    {simpleResponseData[normal, 1, 1, values], simpleResponseData[normal, 2, 1, values],
      simpleResponseData[normal, 2, 2, values], simpleResponseData[normal, 1, 2, values]},
    PlotStyle -> {$paperPalette["Modality1"], Directive[$paperPalette["Modality1"], Dashed],
      $paperPalette["Modality2"], Directive[$paperPalette["Modality2"], Dashed]},
    PlotLegends -> {"1 to 1", "2 to 1", "2 to 2", "1 to 2"},
    Frame -> True, FrameLabel -> {"single input", "steady response"},
    PlotRange -> All, ImageSize -> 390, PlotLabel -> "C. Stable no-cross-talk responses"];
  evolvedCurves = ListLinePlot[
    {simpleResponseData[evolved, 1, 1, values], simpleResponseData[evolved, 2, 1, values],
      simpleResponseData[evolved, 2, 2, values], simpleResponseData[evolved, 1, 2, values]},
    PlotStyle -> {$paperPalette["Modality1"], Directive[$paperPalette["Modality1"], Dashed],
      $paperPalette["Modality2"], Directive[$paperPalette["Modality2"], Dashed]},
    PlotLegends -> {"1 to 1", "2 to 1", "2 to 2", "1 to 2"},
    Frame -> True, FrameLabel -> {"single input", "steady response"},
    PlotRange -> All, ImageSize -> 390,
    PlotLabel -> "D. Example K12=-2.91, K21=14.34"];
  GraphicsGrid[{{phase, plasticity}, {normalCurves, evolvedCurves}}, Spacings -> {15, 15}]
];

Options[RunFigure4Simulation] = {
  "InputStandardDeviations" -> N@Subdivide[0.05, 5., 26],
  "TrainingSteps" -> 1000,
  "LearningRate" -> 1.*^-4,
  "InitialRingRadius" -> 1.*^-5,
  "CrossTalkThreshold" -> 1.*^-3,
  "Seed" -> 1
};

RunFigure4Simulation[OptionsPattern[]] := Module[
  {deviations = N@OptionValue["InputStandardDeviations"],
    steps = OptionValue["TrainingSteps"], eta = N@OptionValue["LearningRate"],
    ring = N@OptionValue["InitialRingRadius"], threshold = N@OptionValue["CrossTalkThreshold"],
    seed = OptionValue["Seed"], rows, outputVariancesAtZero},
  If[Length[deviations] == 0 ||
      !VectorQ[deviations, Function[value,
        TrueQ[NumericQ[value] && Im[N[value]] == 0 && value >= 0]]] ||
      !IntegerQ[steps] || steps < 1 ||
      !TrueQ[NumericQ[eta] && Im[N[eta]] == 0 && eta >= 0] ||
      !TrueQ[NumericQ[ring] && Im[N[ring]] == 0 && ring >= 0] ||
      !TrueQ[NumericQ[threshold] && Im[N[threshold]] == 0 && threshold >= 0] ||
      !IntegerQ[seed],
    Return@Failure["InvalidFigureOptions", <|
      "MessageTemplate" -> "Figure 4 requires finite non-negative deviations, rates, radii, and thresholds plus positive steps and an integer seed."|>]
  ];
  (* This K=0 transform depends only on each grid coordinate.  Compute its 27
     numerical integrals once rather than repeating two of them in 729 runs. *)
  outputVariancesAtZero = OutputVarianceForGaussian /@ (deviations^2);
  rows = Flatten@Table[Module[{angle, network, sampler, trained, k, outputVariances},
    angle = BlockRandom[SeedRandom[seed + 1009 i + 9176 j]; RandomReal[{0, 2 Pi}]];
    network = CreateSimplePaperNetwork["CrossTalk" -> ring {Cos[angle], Sin[angle]}];
    sampler = Function[{step, sample}, BlockRandom[
      SeedRandom[Mod[seed + 104729 step + 13007 sample + 7919 i + 1543 j, 2^31 - 1]];
      {If[deviations[[i]] == 0, 0.,
          RandomVariate[NormalDistribution[0, deviations[[i]]]]],
        If[deviations[[j]] == 0, 0.,
          RandomVariate[NormalDistribution[0, deviations[[j]]]]]}
    ]];
    trained = TrainNetwork[network, sampler, "Steps" -> steps,
      "LearningRate" -> eta, "RestoreBest" -> False,
      "IntegrationStep" -> .8, "Tolerance" -> 1.*^-10];
    If[FailureQ[trained], Return[trained]];
    k = trained["Model"]["K"];
    outputVariances = outputVariancesAtZero[[{i, j}]];
    <|"InputStandardDeviations" -> deviations[[{i, j}]],
      "OutputVariancesAtK0" -> outputVariances,
      "CrossTalk" -> {k[[1, 2]], k[[2, 1]]},
      "CrossTalkNorm" -> Norm[{k[[1, 2]], k[[2, 1]]}],
      "Classification" -> If[Norm[{k[[1, 2]], k[[2, 1]]}] > threshold,
        "cross-talk", "no-cross-talk"]|>
  ], {i, Length[deviations]}, {j, Length[deviations]}];
  If[AnyTrue[rows, FailureQ], FirstCase[rows, _Failure],
    <|"Rows" -> rows, "GridSize" -> Length[deviations],
      "InputStandardDeviations" -> deviations, "TrainingSteps" -> steps,
      "LearningRate" -> eta, "InitialRingRadius" -> ring,
      "CrossTalkThreshold" -> threshold, "Seed" -> seed,
      "FidelityNote" -> "The paper reports a 27x27 sweep and approximately 0.01 output-variance resolution, but not its exact input grid, seed, step count, or threshold."|>]
];

PaperFigure4[result_Association] := Module[{rows, stable, unstable, v1, v2, invariants},
  rows = result["Rows"];
  stable = Lookup[Select[rows, #["Classification"] === "no-cross-talk" &], "OutputVariancesAtK0"];
  unstable = Lookup[Select[rows, #["Classification"] === "cross-talk" &], "OutputVariancesAtK0"];
  invariants = SimpleStabilityInvariants[v1, v2];
  Show[
    ListPlot[{stable, unstable}, PlotStyle -> {$paperPalette["Stable"], $paperPalette["Unstable"]},
      PlotMarkers -> {{"*", 9}, {"*", 9}},
      PlotLegends -> {"returns to zero", "cross-talk grows"}],
    ContourPlot[Evaluate[invariants["Determinant"] == 0], {v1, 0, .25}, {v2, 0, .25},
      ContourStyle -> Directive[Black, Thick]],
    Frame -> True, FrameLabel -> {Subscript[V, 1], Subscript[V, 2]},
    PlotRange -> {{0, .25}, {0, .25}}, ImageSize -> 520,
    PlotLabel -> "Numerical learning sweep and analytical boundary"
  ]
];

Options[PaperFigure5] = {"NeuronsPerModality" -> 71, "MeanRadius" -> .1, "Seed" -> 1};

PaperFigure5[OptionsPattern[]] := Module[
  {count = OptionValue["NeuronsPerModality"], mean = OptionValue["MeanRadius"],
    seed = OptionValue["Seed"], angles, vectors, samples},
  If[!IntegerQ[count] || count < 3 ||
      !TrueQ[NumericQ[mean] && Im[N[mean]] == 0 && mean >= 0] || !IntegerQ[seed],
    Return@Failure["InvalidFigureOptions", <|
      "MessageTemplate" -> "Figure 5 requires at least three neurons, a non-negative radius, and an integer seed."|>]
  ];
  angles = N@Table[2 Pi i/count, {i, 0, count - 1}];
  vectors = Graphics[{Directive[$paperPalette["Modality1"], Opacity[.65]],
      Arrow[{{0, 0}, {Cos[#], Sin[#]}}] & /@ angles},
    Frame -> True, PlotRange -> 1.1, AspectRatio -> 1, ImageSize -> 390,
    PlotLabel -> Row[{"A. ", count, " equally spaced feed-forward unit vectors"}]];
  samples = BlockRandom[SeedRandom[seed]; Table[With[
      {angle = RandomReal[{0, 2 Pi}],
        radius = If[mean == 0, 0., RandomVariate[NormalDistribution[mean, .1 mean]]]},
      radius {Cos[angle], Sin[angle]}], {400}]];
  GraphicsRow[{vectors,
    ListPlot[samples, AspectRatio -> 1, Frame -> True,
      PlotStyle -> Directive[$paperPalette["Modality2"], PointSize[.009], Opacity[.55]],
      PlotRange -> All, ImageSize -> 390,
      PlotLabel -> "B. Uniform angle and Gaussian radius"]}, Spacings -> 20]
];

ClearAll[circularInteractionProfile];
circularInteractionProfile[block_?MatrixQ] := Module[{n = Length[block]},
  Table[Mean@Table[block[[i, Mod[i + offset - 2, n] + 1]], {i, n}],
    {offset, 1, n}]
];

Options[PaperFigure6] = {"ProbeRadius" -> 2., "ProbeAngles" -> N@Table[2 Pi i/72, {i, 0, 71}],
  "MaximumMaterializedNeurons" -> 2000};

PaperFigure6[model_, OptionsPattern[]] := Module[
  {m, n, k, within1, within2, cross21, cross12, profile, response, activity,
    map21, map12, magnitudes, mapping, limit = OptionValue["MaximumMaterializedNeurons"],
    angles = OptionValue["ProbeAngles"], radius = OptionValue["ProbeRadius"]},
  If[!AssociationQ[model],
    Return@Failure["InvalidFigureOptions", <|
      "MessageTemplate" -> "Figure 6 requires a network association."|>]
  ];
  m = Lookup[model, "OutputSize", 0]; n = Quotient[m, 2];
  If[!IntegerQ[m] || m < 6 || OddQ[m] || !IntegerQ[limit] || limit < 1 ||
      !VectorQ[angles, NumericQ] || !TrueQ[NumericQ[radius] && Im[N[radius]] == 0],
    Return@Failure["InvalidFigureOptions", <|
      "MessageTemplate" -> "Figure 6 requires a valid two-modality model and a positive materialization limit."|>]
  ];
  If[m > limit,
    Return@Failure["FigureMaterializationLimit", <|
      "MessageTemplate" -> "Figure 6 matrix panels require dense materialization; raise MaximumMaterializedNeurons deliberately or plot sampled blocks.",
      "OutputNeurons" -> m, "Limit" -> limit|>]
  ];
  k = MaterializeRecurrentMatrix[model]; If[FailureQ[k], Return[k]];
  within1 = k[[1 ;; n, 1 ;; n]]; within2 = k[[n + 1 ;; 2 n, n + 1 ;; 2 n]];
  cross21 = k[[1 ;; n, n + 1 ;; 2 n]]; cross12 = k[[n + 1 ;; 2 n, 1 ;; n]];
  profile = ListLinePlot[{circularInteractionProfile[within1], circularInteractionProfile[within2]},
    PlotStyle -> {$paperPalette["Modality1"], $paperPalette["Modality2"]},
    PlotLegends -> {"within modality 1", "within modality 2"},
    Frame -> True, FrameLabel -> {"preferred-angle offset", "mean weight"},
    PlotLabel -> "C. Intra-modal interaction profiles"];
  response = RespondNetwork[model, PolarProbe[2, Pi/6, radius]];
  If[FailureQ[response], Return[response]];
  activity = response["Modalities"][[1]]["Activity"];
  map21 = ProbeCrossModalMapping[model, 2, 1, "Angles" -> angles, "ProbeRadius" -> radius];
  map12 = ProbeCrossModalMapping[model, 1, 2, "Angles" -> angles, "ProbeRadius" -> radius];
  If[FailureQ[map21] || FailureQ[map12], Return[If[FailureQ[map21], map21, map12]]];
  magnitudes = ListLinePlot[
    {Lookup[map21, {"StimulusAngleDegrees", "Magnitude"}],
      Lookup[map12, {"StimulusAngleDegrees", "Magnitude"}]},
    PlotStyle -> {$paperPalette["Modality1"], $paperPalette["Modality2"]},
    PlotLegends -> {"2 to 1", "1 to 2"}, Frame -> True,
    FrameLabel -> {"stimulus angle (degrees)", "population magnitude"},
    PlotLabel -> "E. Directionality"];
  mapping = ListLinePlot[Lookup[map21, {"StimulusAngleDegrees", "ResponseAngleDegrees"}],
    PlotStyle -> $paperPalette["Modality1"], Frame -> True,
    FrameLabel -> {"modality 2 angle", "modality 1 response angle"},
    PlotLabel -> "F. Emergent cross-modal mapping"];
  GraphicsGrid[{{
      Labeled[GraphicsRow[{MatrixPlot[within1, Frame -> False],
          MatrixPlot[within2, Frame -> False]}], "A. Within-modality blocks", Top],
      Labeled[GraphicsRow[{MatrixPlot[cross21, Frame -> False],
          MatrixPlot[cross12, Frame -> False]}], "B. Cross-modality blocks", Top], profile},
    {ListLinePlot[Transpose[{Range[0, n - 1] 360/n, activity}], Frame -> True,
        FrameLabel -> {"preferred angle", "activity"},
        PlotLabel -> "D. Modality 1 response to modality 2 at 30 degrees"],
      magnitudes, mapping}}, Spacings -> {12, 12}]
];

Options[TrainPaperScenario] = {
  "TotalNeurons" -> 142, "RecurrentRepresentation" -> Automatic,
  "MaximumRank" -> 128, "Steps" -> 1000, "BatchSize" -> 1,
  "Seed" -> 1, "InitialRecurrentScale" -> 1.*^-5,
  "RestoreBest" -> True
};

TrainPaperScenario[name_String, OptionsPattern[]] := Module[
  {scenario, total = OptionValue["TotalNeurons"], representation = OptionValue["RecurrentRepresentation"],
    maximumRank = OptionValue["MaximumRank"], seed = OptionValue["Seed"], scale,
    network, sampler, training},
  scenario = Lookup[$PaperFigure7Scenarios, name, Missing["UnknownScenario"]];
  If[MissingQ[scenario], Return@Failure["UnknownScenario", <|"Name" -> name|>]];
  representation = Replace[representation, Automatic -> If[total <= 512, "Dense", "LowRank"]];
  scale = If[representation === "LowRank", 0., OptionValue["InitialRecurrentScale"]];
  network = CreateTwoModalityPaperNetwork["TotalNeurons" -> total,
    "Seed" -> seed, "InitialRecurrentScale" -> scale,
    "RecurrentRepresentation" -> representation, "MaximumRank" -> maximumRank];
  If[FailureQ[network], Return[network]];
  sampler = CreatePaperInputSampler["MeanRadii" -> scenario["MeanRadii"], "Seed" -> seed];
  If[FailureQ[sampler], Return[sampler]];
  training = TrainNetwork[network, sampler,
    "Steps" -> OptionValue["Steps"], "BatchSize" -> OptionValue["BatchSize"],
    "LearningRate" -> scenario["LearningRate"], "Policy" -> "fixed-best",
    "RestoreBest" -> OptionValue["RestoreBest"], "MaximumRank" -> maximumRank];
  If[FailureQ[training], Return[training]];
  Join[training, <|"ScenarioName" -> name, "Scenario" -> scenario,
    "ScaleReport" -> NetworkScaleReport[training["Model"]]|>]
];

Options[TrainPaperScenarios] = Options[TrainPaperScenario];

TrainPaperScenarios[opts : OptionsPattern[]] := AssociationMap[
  TrainPaperScenario[#, Sequence @@ FilterRules[{opts}, Options[TrainPaperScenario]]] &,
  Keys[$PaperFigure7Scenarios]
];

Options[PaperFigure7] = {"ProbeRadius" -> 2., "ProbeAngles" -> N@Table[2 Pi i/36, {i, 0, 35}]};

PaperFigure7[models_Association, OptionsPattern[]] := Module[
  {angles = OptionValue["ProbeAngles"], radius = OptionValue["ProbeRadius"], panels},
  If[Length[models] == 0 ||
      Complement[Keys[models], Keys[$PaperFigure7Scenarios]] =!= {} ||
      !VectorQ[angles, NumericQ] || !TrueQ[NumericQ[radius] && Im[N[radius]] == 0],
    Return@Failure["UnknownScenario", <|
      "MessageTemplate" -> "Figure 7 needs reported scenario keys and finite probe options."|>]
  ];
  panels = KeyValueMap[Function[{name, value}, Module[{model, map21, map12, scenario},
      model = Lookup[value, "Model", value]; scenario = $PaperFigure7Scenarios[name];
      map21 = ProbeCrossModalMapping[model, 2, 1, "Angles" -> angles, "ProbeRadius" -> radius];
      map12 = ProbeCrossModalMapping[model, 1, 2, "Angles" -> angles, "ProbeRadius" -> radius];
      If[FailureQ[map21] || FailureQ[map12], Return[If[FailureQ[map21], map21, map12]]];
      Labeled[GraphicsColumn[{
        ListLinePlot[{Lookup[map21, {"StimulusAngleDegrees", "Magnitude"}],
          Lookup[map12, {"StimulusAngleDegrees", "Magnitude"}]},
          PlotStyle -> {$paperPalette["Modality1"], $paperPalette["Modality2"]},
          Frame -> True, FrameLabel -> {None, "magnitude"}, ImageSize -> 300],
        ListLinePlot[Lookup[map21, {"StimulusAngleDegrees", "ResponseAngleDegrees"}],
          PlotStyle -> $paperPalette["Modality1"], Frame -> True,
          FrameLabel -> {"stimulus angle", "response angle"}, ImageSize -> 300]
      }], Row[{scenario["PaperPanel"], ": r=", scenario["MeanRadii"],
        ", eta=", ScientificForm[scenario["LearningRate"]]}], Top]
    ]], models];
  If[AnyTrue[panels, FailureQ], Return@FirstCase[panels, _Failure]];
  GraphicsGrid[Partition[PadRight[panels, 6, Spacer[1]], 3], Spacings -> {10, 15}]
];

End[];
EndPackage[];
