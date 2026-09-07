#!/usr/bin/env wolframscript

(* Prevent a parent-process loader override from leaking into child shell probes. *)
If[StringLength[Environment["LD_PRELOAD"]] > 0,
  SetEnvironment["LD_PRELOAD" -> ""]];

testDirectory = DirectoryName[$InputFileName];
testFile = FileNameJoin[{testDirectory, "SynesthesiaModel.wlt"}];
report = TestReport[testFile];
results = Flatten[Values[report["ResultsByTestID"]], 1];
rows = Map[Function[result, Module[{outcome, row},
    outcome = Replace[result["Outcome"], {
      value_String :> value, value_ :> ToString[value, InputForm]}];
    row = <|
      "testId" -> Replace[result["TestID"], {
        value_String :> value, value_ :> ToString[value, InputForm]}],
      "outcome" -> outcome,
      "absoluteTimeSeconds" ->
        N@QuantityMagnitude[result["AbsoluteTimeUsed"], "Seconds"],
      "memoryBytes" -> QuantityMagnitude[result["MemoryUsed"], "Bytes"]
    |>;
    If[outcome === "Success", row,
      Join[row, <|
        "actualOutput" -> ToString[result["ActualOutput"], InputForm],
        "expectedOutput" -> ToString[result["ExpectedOutput"], InputForm],
        "messages" -> ToString[result["Messages"], InputForm]
      |>]]
  ]], results];
outcomeCounts = Counts[Lookup[rows, "outcome"]];
allPassed = TrueQ[report["ReportSucceeded"]] &&
  Lookup[outcomeCounts, "Success", 0] == Length[rows];
summary = <|
  "schema" -> "shriki-2016-wolfram-test-report/v1",
  "generatedAtUtc" -> DateString[TimeZoneConvert[Now, 0],
    {"Year", "-", "Month", "-", "Day", "T", "Hour", ":", "Minute", ":", "Second", "Z"}],
  "kernel" -> $Version,
  "systemId" -> $SystemID,
  "testFile" -> "mathematica/tests/SynesthesiaModel.wlt",
  "testFileSha256" -> IntegerString[FileHash[testFile, "SHA256"], 16, 64],
  "runnerSha256" -> IntegerString[FileHash[$InputFileName, "SHA256"], 16, 64],
  "modelSource" -> "mathematica/SynesthesiaModel.wl",
  "modelSourceSha256" -> IntegerString[FileHash[
    FileNameJoin[{DirectoryName[testDirectory], "SynesthesiaModel.wl"}],
    "SHA256"], 16, 64],
  "allPassed" -> allPassed,
  "testCount" -> Length[rows],
  "outcomeCounts" -> outcomeCounts,
  "absoluteTimeSeconds" -> N@QuantityMagnitude[report["AbsoluteTimeUsed"], "Seconds"],
  "memoryBytes" -> QuantityMagnitude[report["MemoryUsed"], "Bytes"],
  "tests" -> rows
|>;
requestedOutputPath = Replace[
  Environment["SHRIKI_WOLFRAM_TEST_REPORT_OUTPUT"], Except[_String] -> ""];
defaultOutputPath = FileNameJoin[{DirectoryName[testDirectory], "verification", "results",
  "wolfram-test-report.json"}];
outputPath = If[StringLength[requestedOutputPath] > 0,
  ExpandFileName[requestedOutputPath], defaultOutputPath];
outputDirectory = DirectoryName[outputPath];
If[!DirectoryQ[outputDirectory], CreateDirectory[outputDirectory]];
If[Quiet@Check[Export[outputPath, summary, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> outputPath];
  Scan[Function[key,
    If[Quiet@Check[ExportString[<|key -> summary[key]|>, "RawJSON"], $Failed] === $Failed,
      Print["Non-JSON test-report field: " <> key]]], Keys[summary]];
  Exit[1]];
Print[ExportString[KeyTake[summary,
  {"kernel", "allPassed", "testCount", "outcomeCounts", "absoluteTimeSeconds"}],
  "RawJSON", "Compact" -> True]];
If[allPassed, Exit[0], Exit[1]];
