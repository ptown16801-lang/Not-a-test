#!/usr/bin/env wolframscript

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{directory, "SynesthesiaModel.wl"}]];
Get[FileNameJoin[{directory, "PaperFigures.wl"}]];

arguments = Rest[$ScriptCommandLine];
argumentValue[name_, default_] := Module[{prefix = "--" <> name <> "=", match},
  match = SelectFirst[arguments, StringStartsQ[#, prefix] &, Missing["NotFound"]];
  If[MissingQ[match], default, StringDrop[match, StringLength[prefix]]]
];
integerArgument[name_, default_] := Module[{value = argumentValue[name, ToString[default]]},
  If[StringMatchQ[value, DigitCharacter ..], FromDigits[value], $Failed]
];
rankArgument[name_, default_] := Module[{value = argumentValue[name, ToString[default]]},
  Which[value === "Infinity", Infinity,
    StringMatchQ[value, DigitCharacter ..], FromDigits[value],
    True, $Failed]
];

mode = argumentValue["mode", "analytical"];
outputDirectory = ExpandFileName@argumentValue["output", FileNameJoin[{directory, "output"}]];
totalNeurons = integerArgument["total-neurons", 142];
steps = integerArgument["steps", 1000];
maximumRank = rankArgument["maximum-rank", 128];
scenarioName = argumentValue["scenario", "all"];
runFigure4 = ToLowerCase@argumentValue["figure4", "false"] === "true";

If[!MemberQ[{"analytical", "smoke", "full"}, mode],
  Print["Unknown mode. Use analytical, smoke, or full."]; Exit[2]];
If[!IntegerQ[totalNeurons] || totalNeurons < 6 || OddQ[totalNeurons],
  Print["--total-neurons must be an even integer of at least six."]; Exit[2]];
If[!IntegerQ[steps] || steps < 1,
  Print["--steps must be a positive integer."]; Exit[2]];
If[maximumRank =!= Infinity && (!IntegerQ[maximumRank] || maximumRank < 1),
  Print["--maximum-rank must be a positive integer or Infinity."]; Exit[2]];
If[scenarioName =!= "all" && !KeyExistsQ[$PaperFigure7Scenarios, scenarioName],
  Print["--scenario must be all or one of: ", StringRiffle[Keys[$PaperFigure7Scenarios], ", "]];
  Exit[2]
];
If[!DirectoryQ[outputDirectory],
  CreateDirectory[outputDirectory, CreateIntermediateDirectories -> True]];

artifacts = {};
manifest = <|
  "schema" -> "shriki-2016-mathematica-run/v1",
  "paperDOI" -> $PaperDOI,
  "mode" -> mode,
  "scenario" -> scenarioName,
  "totalNeurons" -> totalNeurons,
  "steps" -> steps,
  "maximumRank" -> If[maximumRank === Infinity, "Infinity", maximumRank],
  "started" -> DateString[Now, "ISODateTime"],
  "reconstructionDefaults" -> $ReconstructionDefaults
|>;

saveGraphic[name_, expression_] := Module[
  {path = FileNameJoin[{outputDirectory, name <> ".png"}], exported},
  exported = Quiet@Check[Export[path, expression, ImageResolution -> 160], $Failed];
  If[exported === $Failed, Print["Could not export ", path]; Exit[1]];
  AppendTo[artifacts, FileNameTake[path]];
  path
];
saveData[name_, expression_] := Module[
  {path = FileNameJoin[{outputDirectory, name}], exported},
  exported = Quiet@Check[Export[path, expression, "WXF"], $Failed];
  If[exported === $Failed, Print["Could not export ", path]; Exit[1]];
  AppendTo[artifacts, FileNameTake[path]];
  path
];
jsonSafe[expression_] := expression /. {
  _Missing -> Null,
  Infinity -> "Infinity",
  -Infinity -> "-Infinity",
  failure_Failure :> ToString[failure, InputForm]
};

saveGraphic["figure-1-architecture", PaperFigure1[]];
saveGraphic["figure-2-simple-model", PaperFigure2[]];
saveGraphic["figure-3-stability", PaperFigure3[]];
saveGraphic["figure-5-population-code", PaperFigure5[]];

If[runFigure4,
  figure4 = RunFigure4Simulation["TrainingSteps" -> steps];
  If[FailureQ[figure4], Print[figure4]; Exit[1]];
  saveData["figure-4-data.wxf", figure4];
  saveGraphic["figure-4-simulation", PaperFigure4[figure4]]
];

If[mode === "smoke",
  smokeName = If[scenarioName === "all", "deprivedHighPlasticity", scenarioName];
  smoke = TrainPaperScenario[smokeName,
    "TotalNeurons" -> totalNeurons,
    "RecurrentRepresentation" -> If[totalNeurons <= 512, "Dense", "LowRank"],
    "MaximumRank" -> maximumRank, "Steps" -> steps, "Seed" -> 1];
  If[FailureQ[smoke], Print[smoke]; Exit[1]];
  saveData["smoke-training.wxf", smoke];
  AssociateTo[manifest,
    "scaleReport" -> smoke["ScaleReport"],
    "smokeCrossTalk" -> CrossTalkSummary[smoke["Model"]]
  ]
];

If[mode === "full",
  scenarioNames = If[scenarioName === "all", Keys[$PaperFigure7Scenarios], {scenarioName}];
  trainings = AssociationMap[
    TrainPaperScenario[#,
      "TotalNeurons" -> totalNeurons,
      "RecurrentRepresentation" -> If[totalNeurons <= 512, "Dense", "LowRank"],
      "MaximumRank" -> maximumRank, "Steps" -> steps, "Seed" -> 1] &,
    scenarioNames
  ];
  If[AnyTrue[Values[trainings], FailureQ],
    Print[FirstCase[Values[trainings], _Failure]]; Exit[1]];
  saveData["figure-7-trainings.wxf", trainings];
  saveGraphic["figure-7-scenarios", PaperFigure7[trainings]];
  If[KeyExistsQ[trainings, "deprivedHighPlasticity"],
    figure6 = PaperFigure6[trainings["deprivedHighPlasticity"]["Model"]];
    If[!FailureQ[figure6], saveGraphic["figure-6-unidirectional-mapping", figure6]]
  ];
  AssociateTo[manifest,
    "scaleReports" -> AssociationMap[#1["ScaleReport"] &, trainings]
  ]
];

AssociateTo[manifest,
  "artifacts" -> artifacts,
  "finished" -> DateString[Now, "ISODateTime"]
];
manifestPath = FileNameJoin[{outputDirectory, "run-manifest.json"}];
If[Quiet@Check[Export[manifestPath, jsonSafe[manifest], "RawJSON"], $Failed] === $Failed,
  Print["Could not export ", manifestPath]; Exit[1]];
Print[Dataset[manifest]];
