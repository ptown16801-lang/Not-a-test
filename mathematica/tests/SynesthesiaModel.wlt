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
          "Tolerance" -> 1.*^-12], indices = {{1, 2}, {2, 1}}},
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
      {model["OutputSize"], KeyExistsQ[model, "K"], report["CurrentRank"],
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
        AnalyzeNetwork[model, input]["UpdateDirection"], 1.*^-4]},
      {Last@Dimensions[updated["Recurrent"]["LeftFactors"]],
        updated["Recurrent"]["Truncations"], updated["Metadata"]["Approximate"],
        Max[Abs[Diagonal[MaterializeRecurrentMatrix[updated]]]] < 1.*^-12}
    ]
  ],
  {3, 1, True, True},
  TestID -> "rank cap is explicit and preserves zero self-coupling"
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
  {$PaperFigure7Scenarios["balancedLowPlasticity"]["LearningRate"],
    $PaperFigure7Scenarios["deprivedHighPlasticity"]["MeanRadii"],
    $PaperFigure7Scenarios["deprivedHighPlasticity"]["ReportedOutcome"]},
  {6.*^-5, {.2, 2.}, "modality-2-to-1"},
  TestID -> "Figure 7 transcription"
]
