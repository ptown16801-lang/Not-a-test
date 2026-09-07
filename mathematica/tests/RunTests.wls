#!/usr/bin/env wolframscript

testDirectory = DirectoryName[$InputFileName];
report = TestReport[FileNameJoin[{testDirectory, "SynesthesiaModel.wlt"}]];
Print[report];
If[TrueQ[report["TestsFailedCount"] == 0 && report["TestsNotEvaluatedCount"] == 0],
  Exit[0], Exit[1]];
