packageDirectory = DirectoryName[DirectoryName[$InputFileName]];
Get[FileNameJoin[{packageDirectory, "SynesthesiaModel.wl"}]];

VerificationTest[
  With[{s = LogisticActivation[.37], h = 1.*^-5},
    Max[{
      Abs[LogisticPrimeFromOutput[s] -
        (LogisticActivation[.37 + h] - LogisticActivation[.37 - h])/(2 h)],
      Abs[LogisticSecondFromOutput[s] -
        (LogisticPrimeFromOutput[LogisticActivation[.37 + h]] -
          LogisticPrimeFromOutput[LogisticActivation[.37 - h]])/(2 h)]
    }] < 1.*^-8
  ],
  True,
  TestID -> "logistic derivatives"
]

VerificationTest[
  With[{model = CreateTwoModalityPaperNetwork[]},
    {model["InputSize"], model["OutputSize"],
      Lookup[model["Modalities"], "OutputCount"],
      Dimensions[model["W"]], Dimensions[model["K"]],
      Max[Abs[Flatten[model["K"]]]]}
  ],
  {4, 142, {71, 71}, {142, 4}, {142, 142}, 0.},
  TestID -> "reported 4-to-142 architecture"
]

VerificationTest[
  With[{sampler = CreatePaperInputSampler["MeanRadii" -> {.2, 2.}, "Seed" -> 42],
      expected = {
        {.21394052047730416, .003554321168199892, 1.2376221602502606, -1.7175413054935693},
        {.15563069033453064, -.1547737304496701, -1.626418307086404, -.717948873033288},
        {-.02780870476242637, -.18682100300994078, .3856869395615389, -1.6405990241748436}}},
    Max[Abs[Flatten[Table[sampler["Next"][0, 0], {3}] - expected]]] < 2.*^-12
  ],
  True,
  TestID -> "project-compatible seeded polar sampler"
]

VerificationTest[
  With[{model = CreateSimplePaperNetwork["Weights" -> {1.1, .8},
      "CrossTalk" -> {.12, -.07}], input = {.35, -.22}},
    With[{settled = SettleNetwork[model, input, "IntegrationStep" -> .8,
        "Tolerance" -> 1.*^-12]},
      Max[Abs[settled["State"] - LogisticActivation[model["W"].input +
        model["K"].settled["State"]]]] < 1.*^-10
    ]
  ],
  True,
  TestID -> "recurrent fixed point"
]

VerificationTest[
  With[{result = SettleNetwork[CreateSimplePaperNetwork[], {1., 1.},
      "IntegrationStep" -> 1.*^-12, "Tolerance" -> 1.*^-9,
      "ResidualTolerance" -> 1.*^-9, "StableIterations" -> 2,
      "MaxIterations" -> 2, "AllowUnconverged" -> True]},
    {!result["Converged"], result["FixedPointResidual"] > .2,
      result["ConvergenceCriterion"]}
  ],
  {True, True, "StepAndResidual"},
  TestID -> "tiny Euler step cannot cause false convergence"
]

VerificationTest[
  With[{model = CreateSimplePaperNetwork["CrossTalk" -> {8., 8.}],
      input = {-4., -4.}},
    With[{settled = SettleNetwork[model, input, "Tolerance" -> 1.*^-12]},
      With[{stability = LocalStabilityReport[model, input, settled["State"]]},
        {settled["Converged"], settled["StabilityAssessed"],
          Chop[stability["LargestRealPart"]],
          stability["LocallyAsymptoticallyStable"]}
      ]
    ]
  ],
  {True, False, 1., False},
  TestID -> "fixed-point convergence and dynamical stability are distinct"
]

VerificationTest[
  FailureQ[LocalStabilityReport[CreateSimplePaperNetwork[], {0., 0.},
    {.6, .5}, "ResidualTolerance" -> 1.*^-12]],
  True,
  TestID -> "local fixed-point stability rejects a non-equilibrium state"
]

VerificationTest[
  With[{model = CreateSimplePaperNetwork["Weights" -> {1.1, .8},
      "CrossTalk" -> {.12, -.07}], input = {.35, -.22}},
    With[{euler = SettleNetwork[model, input, "IntegrationStep" -> .8,
          "Tolerance" -> 1.*^-11],
        anderson = SettleNetwork[model, input, "Method" -> "Anderson",
          "Tolerance" -> 1.*^-11]},
      Max[Abs[euler["State"] - anderson["State"]]] < 2.*^-9
    ]
  ],
  True,
  TestID -> "Anderson and Euler solve the same fixed point"
]

VerificationTest[
  With[{model = CreateSimplePaperNetwork["Weights" -> {1.2, .8},
      "CrossTalk" -> {.07, -.04}], input = {.35, -.22}, epsilon = 1.*^-6},
    With[{analysis = AnalyzeNetwork[model, input, "IntegrationStep" -> .8,
          "Tolerance" -> 1.*^-12], indices = Tuples[{1, 2}, 2]},
      Max@Table[With[{plus = Join[model, <|"K" -> ReplacePart[model["K"], index ->
                model["K"][[Sequence @@ index]] + epsilon]|>],
            minus = Join[model, <|"K" -> ReplacePart[model["K"], index ->
                model["K"][[Sequence @@ index]] - epsilon]|>]},
          Abs[analysis["UpdateDirection"][[Sequence @@ index]] +
            (InfomaxObjective[plus, input, "IntegrationStep" -> .8, "Tolerance" -> 1.*^-12] -
              InfomaxObjective[minus, input, "IntegrationStep" -> .8, "Tolerance" -> 1.*^-12])/(2 epsilon)]
        ], {index, indices}] < 2.*^-7
    ]
  ],
  True,
  TestID -> "published recurrent update is negative objective gradient"
]

VerificationTest[
  With[{activity = {.2, .7, .4, .1},
      angles = {0., Pi/2, Pi, 3 Pi/2}},
    With[{sum = PopulationVector[activity, angles],
        mean = PopulationVector[activity, angles, "Normalization" -> "Mean"]},
      {Max[Abs[{sum["Real"], sum["Imaginary"]} -
          4 {mean["Real"], mean["Imaginary"]}]] < 1.*^-14,
        Abs[sum["AngleRadians"] - mean["AngleRadians"]] < 1.*^-14,
        sum["Normalization"], mean["Normalization"]}
    ]
  ],
  {True, True, "Sum", "Mean"},
  TestID -> "publication population vector is an unnormalized sum"
]

VerificationTest[
  With[{invariants = SimpleStabilityInvariants[v1, v2]},
    FullSimplify[Det[invariants["Jacobian"]] == invariants["Determinant"]]
  ],
  True,
  TestID -> "S1 Jacobian determinant identity"
]

VerificationTest[
  {SimpleNoCrossTalkStability[.05, .05]["Stable"],
    SimpleNoCrossTalkStability[0., .24]["Stable"]},
  {True, False},
  TestID -> "S1 central and deprivation classifications"
]

VerificationTest[
  With[{dense = CreateTwoModalityPaperNetwork["NeuronsPerModality" -> 9],
      lowRank = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18,
        "RecurrentRepresentation" -> "LowRank"],
      input = PolarProbe[2, .6, 2.]},
    With[{denseAnalysis = AnalyzeNetwork[dense, input],
        lowRankAnalysis = AnalyzeNetwork[lowRank, input]},
      With[{materializedDirection = lowRankAnalysis["UpdateDirection"]["LeftFactors"].
          Transpose[lowRankAnalysis["UpdateDirection"]["RightFactors"]]},
        Max[Abs[Flatten[denseAnalysis["UpdateDirection"] - materializedDirection]]] < 2.*^-10
      ]
    ]
  ],
  True,
  TestID -> "matrix-free and dense gradients agree at K=0"
]

VerificationTest[
  With[{dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
      factored = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity],
      inputs = {PolarProbe[1, .2, .8], PolarProbe[2, .7, 1.2]}},
    With[{denseBatch = RecurrentUpdateDirection[dense, inputs],
        factorBatch = RecurrentUpdateDirection[factored, inputs]},
      With[{direction = factorBatch["UpdateDirection"]},
        {Dimensions[direction["LeftFactors"]],
          Dimensions[direction["RightFactors"]],
          Max[Abs[Flatten[denseBatch["UpdateDirection"] -
            direction["LeftFactors"].Transpose[direction["RightFactors"]]]]] < 5.*^-10,
          FailureQ[ApplyRecurrentUpdate[factored, direction, 1.*^-4]]}
      ]
    ]
  ],
  {{18, 10}, {18, 10}, True, False},
  TestID -> "factorized mini-batch joins columns and matches dense mean"
]

VerificationTest[
  With[{dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
      factored = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity],
      inputs = {PolarProbe[1, .2, .8], PolarProbe[2, .7, 1.2],
        PolarProbe[1, 1.3, .5], PolarProbe[2, 2.1, 1.7]}},
    And @@ Table[With[{denseBatch = RecurrentUpdateDirection[dense,
            Take[inputs, batchSize]],
          factorBatch = RecurrentUpdateDirection[factored,
            Take[inputs, batchSize]]},
        With[{direction = factorBatch["UpdateDirection"]},
          Dimensions[direction["LeftFactors"]] === {18, 5 batchSize} &&
          Dimensions[direction["RightFactors"]] === {18, 5 batchSize} &&
          Max[Abs[Flatten[denseBatch["UpdateDirection"] -
            direction["LeftFactors"].Transpose[direction["RightFactors"]]]]] <
            8.*^-10]], {batchSize, {1, 2, 4}}]
  ],
  True,
  TestID -> "factorized batch sizes one two and four are exact"
]

VerificationTest[
  With[{scaled = AnalyzeNetwork[
      CreateSimplePaperNetwork["Weights" -> {1.*^-6, 1.*^-6}], {0., 0.},
      "IntegrationStep" -> 1., "Tolerance" -> 1.*^-14,
      "ResidualTolerance" -> 1.*^-14]},
    {!FailureQ[scaled], scaled["SusceptibilityConditionNumber"],
      Max[Abs[Diagonal[scaled["Gram"]] - 6.25*^-14]] < 1.*^-26}
  ],
  {True, 1., True},
  TestID -> "relative susceptibility test accepts tiny well-conditioned scale"
]

VerificationTest[
  With[{model = <|"InputSize" -> 2, "OutputSize" -> 3,
      "W" -> {{100., 0.}, {0., 1.}, {1., 0.}},
      "K" -> ConstantArray[0., {3, 3}], "Modalities" -> {},
      "Metadata" -> <|"ExcludeSelfCoupling" -> False|>|>},
    With[{analysis = AnalyzeNetwork[model, {1., 0.},
        "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
        "ResidualTolerance" -> 1.*^-12]},
      {!FailureQ[analysis], analysis["FirstDerivative"][[1]] > 0,
        Abs[analysis["Objective"] - 3.012817736156336] < 2.*^-12}
    ]
  ],
  {True, True, True},
TestID -> "field derivatives retain representable saturated sensitivity"
]

VerificationTest[
  With[{model = <|"InputSize" -> 2, "OutputSize" -> 3,
      "W" -> {{300., 0.}, {0., 1.}, {1., 0.}},
      "K" -> ConstantArray[0., {3, 3}], "Modalities" -> {},
      "Metadata" -> <|"ExcludeSelfCoupling" -> False|>|>},
    With[{analysis = AnalyzeNetwork[model, {1., 0.},
        "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
        "ResidualTolerance" -> 1.*^-12]},
      {!FailureQ[analysis],
        VectorQ[analysis["ScaledA"], Internal`RealValuedNumberQ],
        MatrixQ[analysis["UpdateDirection"], Internal`RealValuedNumberQ] &&
          Dimensions[analysis["UpdateDirection"]] === {3, 3}}
    ]
  ],
  {True, True, True},
  TestID -> "scaled curvature avoids cubic derivative underflow"
]

VerificationTest[
  With[{model = <|"InputSize" -> 1, "OutputSize" -> 1,
      "W" -> {{1.}}, "K" -> {{0.}}, "Modalities" -> {},
      "Metadata" -> <|"ExcludeSelfCoupling" -> False|>|>},
    With[{analysis = AnalyzeNetwork[model, {400.},
        "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
        "ResidualTolerance" -> 1.*^-12]},
      {!FailureQ[analysis], Abs[analysis["Objective"] - 400.] < 2.*^-12,
        analysis["Gram"][[1, 1]] == 0.,
        Abs[analysis["UpdateDirection"][[1, 1]] + 1.] < 2.*^-12}
    ]
  ],
  {True, True, True, True},
  TestID -> "scaled QR survives Gram underflow"
]

VerificationTest[
  With[{model = <|"InputSize" -> 1, "OutputSize" -> 1,
      "W" -> {{1.}}, "K" -> {{0.}}, "Modalities" -> {},
      "Metadata" -> <|"ExcludeSelfCoupling" -> False|>|>},
    With[{analysis = AnalyzeNetwork[model, {3.}, "DerivativeFloor" -> .2,
        "IntegrationStep" -> 1., "Tolerance" -> 1.*^-12,
        "ResidualTolerance" -> 1.*^-12]},
      {analysis["DerivativeFloorApplied"], analysis["EquationSemantics"],
        Abs[analysis["UpdateDirection"][[1, 1]] - .005238719864787106] < 2.*^-14}
    ]
  ],
  {True, "ProjectSurrogateDerivativeFloor", True},
  TestID -> "derivative floor is labeled and keeps literal curvature ratio"
]

VerificationTest[
  With[{dense = CreateTwoModalityPaperNetwork["NeuronsPerModality" -> 9],
      lowRank = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18,
        "RecurrentRepresentation" -> "LowRank"], input = PolarProbe[1, .4, 1.], eta = 1.*^-4},
    With[{denseDirection = AnalyzeNetwork[dense, input]["UpdateDirection"],
        lowRankDirection = AnalyzeNetwork[lowRank, input]["UpdateDirection"]},
      With[{updatedDense = ApplyRecurrentUpdate[dense, denseDirection, eta],
          updatedLowRank = ApplyRecurrentUpdate[lowRank, lowRankDirection, eta]},
        Max[Abs[Flatten[updatedDense["K"] - MaterializeRecurrentMatrix[updatedLowRank]]]] < 2.*^-10
      ]
    ]
  ],
  True,
  TestID -> "matrix-free update matches dense update"
]

VerificationTest[
  With[{model = CreateScalablePaperNetwork[2048]},
    With[{report = NetworkScaleReport[model]},
      {model["OutputSize"], KeyExistsQ[model, "K"], report["FactorColumns"],
        report["CompressionRatio"], report["AlgebraicallyExactSoFar"]}
    ]
  ],
  {2048, False, 0, 2048., True},
  SameTest -> (First[#1] == First[#2] && #1[[2 ;; 3]] === #2[[2 ;; 3]] &&
      Abs[#1[[4]] - #2[[4]]] < 1.*^-12 && Last[#1] === Last[#2] &),
  TestID -> "2048-neuron model starts matrix-free"
]

VerificationTest[
  With[{estimate = EstimateNetworkScale[2048, 128]},
    {estimate["OutputNeurons"], estimate["NeuronsPerModality"],
      estimate["PreferredAngleSpacingDegrees"],
      estimate["DenseAdaptiveConnectionsNoSelf"],
      estimate["LowRankPlusDiagonalNumbers"],
      estimate["BiologicalEquivalence"]}
  ],
  {2048, 1024, .3515625, 4192256, 526336, False},
  TestID -> "allocation-free scale estimator"
]

VerificationTest[
  With[{model = CreateScalablePaperNetwork[20, "MaximumRank" -> 3],
      input = PolarProbe[2, .2, 1.]},
    With[{updated = ApplyRecurrentUpdate[model,
        AnalyzeNetwork[model, input]["UpdateDirection"], 1.*^-4,
        "ZeroDiagonal" -> True]},
      {Last@Dimensions[updated["Recurrent"]["LeftFactors"]],
        updated["Recurrent"]["Truncations"], updated["Metadata"]["Approximate"],
        Max[Abs[Diagonal[MaterializeRecurrentMatrix[updated]]]] < 1.*^-12}
    ]
  ],
  {3, 1, True, True},
  TestID -> "rank cap is explicit and optional zero diagonal is preserved"
]

VerificationTest[
  With[{model = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
      input = PolarProbe[1, .4, 1.]},
    With[{updated = ApplyRecurrentUpdate[model,
        AnalyzeNetwork[model, input]["UpdateDirection"], 1.*^-4]},
      {model["Metadata"]["ExcludeSelfCoupling"],
        Max[Abs[Diagonal[updated["K"]]]] > 0}
    ]
  ],
  {False, True},
  TestID -> "general high-dimensional rule retains diagonal updates"
]

VerificationTest[
  With[{dense0 = CreateTwoModalityPaperNetwork["TotalNeurons" -> 18],
      lowRank0 = CreateScalablePaperNetwork[18, "MaximumRank" -> Infinity],
      inputs = {PolarProbe[1, .4, 1.], PolarProbe[2, 1.1, 2.]}, eta = 1.*^-4},
    With[{dense1 = ApplyRecurrentUpdate[dense0,
          AnalyzeNetwork[dense0, inputs[[1]]]["UpdateDirection"], eta],
        lowRank1 = ApplyRecurrentUpdate[lowRank0,
          AnalyzeNetwork[lowRank0, inputs[[1]]]["UpdateDirection"], eta]},
      With[{dense2 = ApplyRecurrentUpdate[dense1,
            AnalyzeNetwork[dense1, inputs[[2]]]["UpdateDirection"], eta],
          lowRank2 = ApplyRecurrentUpdate[lowRank1,
            AnalyzeNetwork[lowRank1, inputs[[2]]]["UpdateDirection"], eta]},
        Max[Abs[Flatten[dense2["K"] - MaterializeRecurrentMatrix[lowRank2]]]] < 5.*^-9
      ]
    ]
  ],
  True,
  TestID -> "unbounded factors remain dense-equivalent after multiple updates"
]

VerificationTest[
  With[{dense0 = CreateTwoModalityPaperNetwork["TotalNeurons" -> 6],
      factored0 = CreateScalablePaperNetwork[6, "MaximumRank" -> Infinity],
      inputs = {PolarProbe[1, .4, 1.], PolarProbe[2, 1.1, 2.]}, eta = 1.*^-4},
    With[{dense1 = ApplyRecurrentUpdate[dense0,
          AnalyzeNetwork[dense0, inputs[[1]]]["UpdateDirection"], eta],
        factored1 = ApplyRecurrentUpdate[factored0,
          AnalyzeNetwork[factored0, inputs[[1]]]["UpdateDirection"], eta]},
      With[{dense2 = ApplyRecurrentUpdate[dense1,
            AnalyzeNetwork[dense1, inputs[[2]]]["UpdateDirection"], eta],
          factored2 = ApplyRecurrentUpdate[factored1,
            AnalyzeNetwork[factored1, inputs[[2]]]["UpdateDirection"], eta]},
        {!KeyExistsQ[factored2, "Recurrent"],
          factored2["Metadata"]["DensifiedFromExactFactors"],
          Max[Abs[Flatten[dense2["K"] - factored2["K"]]]] < 5.*^-9}
      ]
    ]
  ],
  {True, True, True},
  TestID -> "factor history densifies at exact storage crossover"
]

VerificationTest[
  With[{dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 6],
      factored0 = CreateScalablePaperNetwork[6, "MaximumRank" -> Infinity]},
    With[{factored = Join[factored0, <|"Recurrent" -> <|
          "Representation" -> "LowRankPlusDiagonal",
          "Diagonal" -> {4., 0., 0., 0., 0., 0.},
          "LeftFactors" -> Transpose[{{-4., 0., 0., 0., 0., 0.}}],
          "RightFactors" -> Transpose[{{1., 0., 0., 0., 0., 0.}}],
          "MaximumRank" -> Infinity, "Truncations" -> 0,
          "DiscardedSingularValueMass" -> 0.|>|>]},
      With[{denseResult = AnalyzeNetwork[dense, {0., 0., 0., 0.}],
          factorResult = AnalyzeNetwork[factored, {0., 0., 0., 0.}]},
        {!FailureQ[factorResult],
          Max[Abs[Flatten[denseResult["Susceptibility"] -
            factorResult["Susceptibility"]]]] < 1.*^-12}
      ]
    ]
  ],
  {True, True},
  TestID -> "singular Woodbury base falls back to equivalent dense operator"
]

VerificationTest[
  With[{model = CreateTwoModalityPaperNetwork["TotalNeurons" -> 10],
      inputs = {PolarProbe[1, .2, .8], PolarProbe[2, .7, 1.2]}},
    With[{missing = TrainNetwork[model, Function[{step, sample}, First[inputs]],
          "Steps" -> 1],
        trained = TrainNetwork[model,
          Function[{step, sample}, inputs[[Mod[step, Length[inputs]] + 1]]],
          "Steps" -> 4, "LearningRate" -> 1.*^-4,
          "CheckpointInputs" -> inputs, "CheckpointInterval" -> 2,
          "IntegrationStep" -> 1., "Tolerance" -> 1.*^-9]},
      {FailureQ[missing], trained["CheckpointMode"],
        Abs[trained["BestObjective"] -
          Mean[InfomaxObjective[trained["Model"], #,
            "IntegrationStep" -> 1., "Tolerance" -> 1.*^-9] & /@ inputs]] < 2.*^-9}
    ]
  ],
  {True, "fixed-ensemble", True},
  TestID -> "best checkpoint compares one fixed objective ensemble"
]

VerificationTest[
  Module[{path = FileNameJoin[{$TemporaryDirectory,
        "shriki-interop-" <> CreateUUID[] <> ".json"}],
      base, model, imported, result},
    base = CreateSimplePaperNetwork[];
    model = Join[base, <|
      "W" -> {{N[1/10], N[-1/3]}, {N[Pi/17], N[Sqrt[2]/9]}},
      "K" -> {{N[2^-47], N[-7/123]}, {N[11/257], N[-2^-49]}},
      "Metadata" -> Join[base["Metadata"], <|
        "Binary64RoundTripFixture" -> True|>]|>];
    result = Quiet@Check[
      ExportJavaScriptNetwork[model, path];
      imported = ImportJavaScriptNetwork[path];
      {SameQ[model["W"], imported["W"]],
        SameQ[model["K"], imported["K"]],
        imported["Metadata"]["ExcludeSelfCoupling"],
        imported["Metadata"]["Binary64RoundTripFixture"]}, $Failed];
    If[FileExistsQ[path], DeleteFile[path]];
    result
  ],
  {True, True, True, True},
  TestID -> "Wolfram JavaScript checkpoint preserves binary64 and metadata policy"
]

VerificationTest[
  {$PaperFigure7Scenarios["balancedLowPlasticity"]["LearningRate"],
    $PaperFigure7Scenarios["deprivedHighPlasticity"]["MeanRadii"],
    $PaperFigure7Scenarios["deprivedHighPlasticity"]["ReportedOutcome"]},
  {6.*^-5, {.2, 2.}, "modality-2-to-1"},
  TestID -> "Figure 7 transcription"
]
