#!/usr/bin/env wolframscript

directory = DirectoryName[$InputFileName];
Get[FileNameJoin[{directory, "SynesthesiaModel.wl"}]];

arguments = Rest[$ScriptCommandLine];
argumentValue[name_, default_] := Module[{prefix = "--" <> name <> "=", match},
  match = SelectFirst[arguments, StringStartsQ[#, prefix] &, Missing["NotFound"]];
  If[MissingQ[match], default, StringDrop[match, StringLength[prefix]]]
];
parsePositiveInteger[value_] := If[
  StringMatchQ[value, DigitCharacter ..] && FromDigits[value] > 0,
  FromDigits[value], $Failed
];

totalsText = StringSplit[argumentValue["totals", "142,512,2048,8192"], ","];
totals = parsePositiveInteger /@ totalsText;
maximumRankText = argumentValue["maximum-rank", "128"];
maximumRank = If[maximumRankText === "Infinity", Infinity,
  parsePositiveInteger[maximumRankText]];
denseLimit = parsePositiveInteger[argumentValue["dense-limit", "512"]];
output = ExpandFileName@argumentValue["output",
  FileNameJoin[{directory, "scaling-benchmark.json"}]];

If[AnyTrue[totals, # === $Failed &] ||
    AnyTrue[totals, # < 6 || OddQ[#] &] ||
    maximumRank === $Failed || denseLimit === $Failed,
  Print["Totals must be even integers of at least six; rank and dense limit must be positive integers (rank may be Infinity)."];
  Exit[2]
];
If[!DirectoryQ[DirectoryName[output]],
  CreateDirectory[DirectoryName[output], CreateIntermediateDirectories -> True]];

probe = PolarProbe[2, Pi/6, 2.];
rows = Flatten@Table[Module[{model, timing, analysis, report},
    If[representation === "Dense" && total > denseLimit, Return[Nothing]];
    model = If[representation === "Dense",
      CreateTwoModalityPaperNetwork["TotalNeurons" -> total],
      CreateScalablePaperNetwork[total, "MaximumRank" -> maximumRank]
    ];
    If[FailureQ[model],
      Return@<|"TotalNeurons" -> total, "Representation" -> representation,
        "Failure" -> ToString[model, InputForm]|>
    ];
    timing = AbsoluteTiming[
      analysis = AnalyzeNetwork[model, probe, "ReturnPhi" -> False];
    ][[1]];
    If[FailureQ[analysis],
      <|"TotalNeurons" -> total, "Representation" -> representation,
        "Failure" -> ToString[analysis, InputForm]|>,
      report = NetworkScaleReport[model];
      Join[<|"TotalNeurons" -> total, "Representation" -> representation,
        "AnalyzeSeconds" -> timing, "Objective" -> analysis["Objective"],
        "SettleIterations" -> analysis["Iterations"]|>, report]
    ]
  ], {total, totals}, {representation, {"Dense", "LowRank"}}];

payload = <|"schema" -> "shriki-2016-scaling-benchmark/v1",
  "kernelVersion" -> $Version,
  "maximumRank" -> If[maximumRank === Infinity, "Infinity", maximumRank],
  "denseLimit" -> denseLimit,
  "timestamp" -> DateString[Now, "ISODateTime"], "rows" -> rows|>;
If[Quiet@Check[Export[output, payload, "RawJSON"], $Failed] === $Failed,
  Print["Could not export ", output]; Exit[1]];
Print[Dataset[rows]];
