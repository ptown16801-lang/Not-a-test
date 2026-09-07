#!/usr/bin/env wolframscript

(*
  Publication-first reconstruction of Shriki, Sadeh & Ward (2016),
  DOI 10.1371/journal.pcbi.1004959, and its S1 Appendix.

  This derivation was written from the publications before the project source
  was inspected. It intentionally imports no project implementation code.
*)

ClearAll["Global`*"];

checks = {};
record[name_String, value_, pass_] := Module[{ok = TrueQ[pass]},
  AppendTo[checks, <|"Name" -> name, "Value" -> value, "Pass" -> ok|>];
  If[!ok, Print["FAILED: " <> name]; Exit[1]]
];

sigmoid[z_] := 1/(1 + Exp[-z]);
sigmoidPrimeFromState[s_] := s (1 - s);
sigmoidSecondFromState[s_] := s (1 - s) (1 - 2 s);
sigmoidThirdFromState[s_] :=
  sigmoidPrimeFromState[s] (1 - 2 s)^2 -
    2 sigmoidPrimeFromState[s]^2;

(* tau sdot=-s+g(Wx+Ks), so at a fixed point
   chi=(I-GK)^-1 GW=(G^-1-K)^-1 W=phi W. *)
gExact = DiagonalMatrix[{2/5, 3/7, 5/11}];
kExact = {{0, 1/13, -1/17}, {2/19, 0, 1/23}, {-1/29, 3/31, 0}};
wExact = {{2/3, -1/5}, {1/7, 3/4}, {-2/9, 5/8}};
phiLeft = Inverse[IdentityMatrix[3] - gExact.kExact].gExact;
phiPublished = Inverse[Inverse[gExact] - kExact];
phiRight = gExact.Inverse[IdentityMatrix[3] - kExact.gExact];
record["susceptibility-factorization", Together[phiLeft - phiPublished],
  Together[phiLeft - phiPublished] === ConstantArray[0, {3, 3}]];
record["susceptibility-factorization-right-ordered-form",
  Together[phiRight - phiPublished],
  Together[phiRight - phiPublished] === ConstantArray[0, {3, 3}]];
chiExact = phiPublished.wExact;
record["published-dimensions", <|
    "W" -> Dimensions[wExact], "K" -> Dimensions[kExact],
    "G" -> Dimensions[gExact], "Phi" -> Dimensions[phiPublished],
    "Chi" -> Dimensions[chiExact],
    "ChiTChi" -> Dimensions[Transpose[chiExact].chiExact]|>,
  Dimensions[wExact] === {3, 2} && Dimensions[kExact] === {3, 3} &&
    Dimensions[chiExact] === {3, 2} &&
    Dimensions[Transpose[chiExact].chiExact] === {2, 2}];

(* Independent recurrent-gradient differential.

   For H=dK, implicit differentiation of the fixed point gives
     ds=phi H s, dh=G^-1 ds, dG=diag(g'' dh).
   Applying d log det A=Tr(A^-1 dA) to
     epsilon=-1/2 log det(chi^T chi)
   yields
     -grad_K epsilon=(chi Gamma)^T+(phi^T a)s^T,
     Gamma=(chi^T chi)^-1 chi^T phi,
     a_k=(chi Gamma)_kk g''_k/(g'_k)^3.
*)
sExact = {2/7, 3/8, 5/9};
gSecondExact = {1/11, -2/13, 3/17};
hPerturbation = Array[hh, {3, 3}];
qExact = Transpose[chiExact].chiExact;
gammaExact = Inverse[qExact].Transpose[chiExact].phiPublished;
aExact = Diagonal[chiExact.gammaExact] gSecondExact/Diagonal[gExact]^3;
publishedDescentDirection = Transpose[chiExact.gammaExact] +
  Outer[Times, Transpose[phiPublished].aExact, sExact];
dsExact = phiPublished.hPerturbation.sExact;
dhExact = Inverse[gExact].dsExact;
dGExact = DiagonalMatrix[gSecondExact dhExact];
dPhiExact = phiPublished.(hPerturbation +
    Inverse[gExact].dGExact.Inverse[gExact]).phiPublished;
dChiExact = dPhiExact.wExact;
dEpsilonExact = -Tr[Inverse[qExact].Transpose[chiExact].dChiExact];
gradientDifferentialResidual = Together[dEpsilonExact +
    Tr[Transpose[publishedDescentDirection].hPerturbation]];
record["independent-recurrent-gradient-differential",
  gradientDifferentialResidual, gradientDifferentialResidual === 0];
record["gradient-term-dimensions", <|
    "Gamma" -> Dimensions[gammaExact],
    "ChiGammaTranspose" -> Dimensions[Transpose[chiExact.gammaExact]],
    "a" -> Dimensions[aExact],
    "PhiTasT" -> Dimensions[Outer[Times,
      Transpose[phiPublished].aExact, sExact]]|>,
  Dimensions[gammaExact] === {2, 3} &&
    Dimensions[Transpose[chiExact.gammaExact]] === {3, 3} &&
    Dimensions[aExact] === {3} &&
    Dimensions[Outer[Times, Transpose[phiPublished].aExact, sExact]] === {3, 3}];

(* Square full-rank W implies chi Gamma=phi, recovering the S1 rule. *)
wSquare = {{2/3, 0}, {0, 5/7}};
gSquare = DiagonalMatrix[{3/8, 4/9}];
kSquare = {{0, 1/10}, {-1/12, 0}};
phiSquare = Inverse[Inverse[gSquare] - kSquare];
chiSquare = phiSquare.wSquare;
gammaSquare = Inverse[Transpose[chiSquare].chiSquare].
  Transpose[chiSquare].phiSquare;
record["general-rule-reduces-to-appendix-rule",
  Together[chiSquare.gammaSquare - phiSquare],
  Together[chiSquare.gammaSquare - phiSquare] === ConstantArray[0, {2, 2}]];

record["logistic-first-derivative",
  FullSimplify[D[sigmoid[z], z] - sigmoid[z] (1 - sigmoid[z])],
  FullSimplify[D[sigmoid[z], z] - sigmoid[z] (1 - sigmoid[z])] === 0];
record["logistic-second-derivative",
  FullSimplify[D[sigmoid[z], {z, 2}] -
    D[sigmoid[z], z] (1 - 2 sigmoid[z])],
  FullSimplify[D[sigmoid[z], {z, 2}] -
    D[sigmoid[z], z] (1 - 2 sigmoid[z])] === 0];
record["logistic-third-derivative",
  FullSimplify[D[sigmoid[z], {z, 3}] -
    (D[sigmoid[z], z] (1 - 2 sigmoid[z])^2 - 2 D[sigmoid[z], z]^2)],
  FullSimplify[D[sigmoid[z], {z, 3}] -
    (D[sigmoid[z], z] (1 - 2 sigmoid[z])^2 - 2 D[sigmoid[z], z]^2)] === 0];

gp1 = sigmoidPrimeFromState[s1]; gp2 = sigmoidPrimeFromState[s2];
gpp1 = sigmoidSecondFromState[s1]; gpp2 = sigmoidSecondFromState[s2];
gppp1 = sigmoidThirdFromState[s1]; gppp2 = sigmoidThirdFromState[s2];
j11General = s2^2/gp1 (gppp1 - gpp1^2/gp1);
j22General = s1^2/gp2 (gppp2 - gpp2^2/gp2);
j12General = gp1 gp2 + s1 gp2 gpp1/gp1 + s2 gp1 gpp2/gp2;
j11Published = -2 s1 s2^2 + 2 s1^2 s2^2;
j22Published = -2 s2 s1^2 + 2 s1^2 s2^2;
j12Published = 3 s1 s2 - 4 s1^2 s2 - 4 s1 s2^2 + 5 s1^2 s2^2;
record["appendix-J11-logistic-simplification",
  Factor[Together[j11General - j11Published]],
  Factor[Together[j11General - j11Published]] === 0];
record["appendix-J22-logistic-simplification",
  Factor[Together[j22General - j22Published]],
  Factor[Together[j22General - j22Published]] === 0];
record["appendix-offdiagonal-logistic-simplification",
  Factor[Together[j12General - j12Published]],
  Factor[Together[j12General - j12Published]] === 0];

fixedPointCrossUpdate = {meanS2 (1 - 2 meanS1), meanS1 (1 - 2 meanS2)};
record["zero-cross-talk-learning-fixed-point",
  fixedPointCrossUpdate /. {meanS1 -> 1/2, meanS2 -> 1/2},
  (fixedPointCrossUpdate /. {meanS1 -> 1/2, meanS2 -> 1/2}) === {0, 0}];
record["symmetric-input-logistic-mean",
  FullSimplify[sigmoid[z] + sigmoid[-z]],
  FullSimplify[sigmoid[z] + sigmoid[-z]] === 1];

(* u=E[s1^2], v=E[s2^2], with E[si]=1/2. *)
j11Mean = -2 (1/2 - u) v;
j22Mean = -2 (1/2 - v) u;
j12Mean = 3/4 - 2 u - 2 v + 5 u v;
traceDerived = Expand[j11Mean + j22Mean];
detDerived = Expand[j11Mean j22Mean - j12Mean^2];
traceAppendix = 4 u v - u - v;
detAppendix = -9/16 + 3 u + 3 v - 4 u^2 - 4 v^2 - 29/2 u v +
  18 u v^2 + 18 u^2 v - 21 u^2 v^2;
record["appendix-trace", Expand[traceDerived - traceAppendix],
  Expand[traceDerived - traceAppendix] === 0];
record["appendix-determinant", Expand[detDerived - detAppendix],
  Expand[detDerived - detAppendix] === 0];
learningDiscriminant = Expand[traceDerived^2 - 4 detDerived];
symmetricDiscriminant = Expand[(j11Mean - j22Mean)^2 + 4 j12Mean^2];
record["learning-Jacobian-discriminant-is-nonnegative-square-sum",
  Expand[learningDiscriminant - symmetricDiscriminant],
  Expand[learningDiscriminant - symmetricDiscriminant] === 0];
record["appendix-strict-discriminant-claim-has-equality-case",
  learningDiscriminant /. {u -> 3/10, v -> 3/10},
  (learningDiscriminant /. {u -> 3/10, v -> 3/10}) === 0];

stabilityRootAppendix[sign_] := (36 v^2 - 29 v + 6 +
    sign Sqrt[-6 v (2 v - 1)^3])/(84 v^2 - 72 v + 16);
rootResiduals = FullSimplify[detAppendix /. u -> #,
    Assumptions -> 1/4 <= v <= 1/2] & /@
  {stabilityRootAppendix[-1], stabilityRootAppendix[1]};
record["appendix-stability-curve", rootResiduals, rootResiduals === {0, 0}];

disc = tr^2 - 4 det;
lambdaMinus = (tr - Sqrt[disc])/2;
etaRealDerived = FullSimplify[-2/lambdaMinus];
etaRealAppendixFinal = -(tr + Sqrt[disc])/det;
etaEquation95AsPrinted = -tr/det + Sqrt[disc]/det;
record["real-critical-learning-rate-final-expression",
  FullSimplify[etaRealDerived - etaRealAppendixFinal],
  FullSimplify[etaRealDerived - etaRealAppendixFinal] === 0];
record["appendix-manuscript-line-95-sign-discrepancy",
  FullSimplify[etaEquation95AsPrinted - etaRealDerived],
  FullSimplify[etaEquation95AsPrinted - etaRealDerived] =!= 0];
complexMagnitudeSquared = 1 + eta tr + eta^2 det;
etaComplexDerived = -tr/det;
record["complex-critical-learning-rate",
  Factor[(complexMagnitudeSquared /. eta -> etaComplexDerived) - 1],
  Factor[(complexMagnitudeSquared /. eta -> etaComplexDerived) - 1] === 0];

populationSum = Sum[rho[j] Exp[I theta[j]], {j, 1, neuronCount}];
populationMean = populationSum/neuronCount;
record["population-vector-normalization-effect",
  FullSimplify[Abs[populationMean]/Abs[populationSum],
    Assumptions -> neuronCount > 0],
  FullSimplify[Abs[populationMean]/Abs[populationSum],
    Assumptions -> neuronCount > 0] === 1/neuronCount];

(* Duplicating every output row is not a neutral cross-size operation for the
   unnormalized volume objective.  For N input dimensions it adds
   -(N/2) log 2 even when the represented local map is merely duplicated. *)
qReplicated = Transpose[Join[chiExact, chiExact]].Join[chiExact, chiExact];
replicationShift = FullSimplify[-1/2 Log[Det[qReplicated]] +
  1/2 Log[Det[qExact]]];
record["objective-baseline-changes-under-row-replication", replicationShift,
  replicationShift === -Log[2]];

(* Numerical validation uses FindRoot, avoiding the project's unreported Euler
   step and stopping convention. *)
ClearAll[solveFixedPoint, sampleQuantities, objectiveMean];
solveFixedPoint[k_?MatrixQ, w_?MatrixQ, x_?VectorQ, initial_: Automatic] :=
 Module[{m = Length[k], variables, guess, solution},
  variables = Array[zz, m];
  guess = If[initial === Automatic, ConstantArray[0.5, m], initial];
  solution = FindRoot[Thread[variables == sigmoid[w.x + k.variables]],
    Evaluate[MapThread[List, {variables, guess}]], AccuracyGoal -> 13,
    PrecisionGoal -> 13, MaxIterations -> 200];
  N[variables /. solution, 16]
];

sampleQuantities[k_?MatrixQ, w_?MatrixQ, x_?VectorQ] := Module[
  {s, gp, gpp, g, phi, chi, gram, gamma, a, descent, epsilon},
  s = solveFixedPoint[k, w, x];
  gp = sigmoidPrimeFromState[s]; gpp = sigmoidSecondFromState[s];
  g = DiagonalMatrix[gp]; phi = Inverse[Inverse[g] - k];
  chi = phi.w; gram = Transpose[chi].chi;
  gamma = Inverse[gram].Transpose[chi].phi;
  a = Diagonal[chi.gamma] gpp/gp^3;
  descent = Transpose[chi.gamma] + Outer[Times, Transpose[phi].a, s];
  epsilon = -1/2 Log[Det[gram]];
  <|"State" -> s, "Residual" -> s - sigmoid[w.x + k.s],
    "Phi" -> phi, "Chi" -> chi, "Gamma" -> gamma, "a" -> a,
    "DescentDirection" -> descent, "Gradient" -> -descent,
    "Objective" -> epsilon|>
];
objectiveMean[k_?MatrixQ, w_?MatrixQ, samples_List] :=
  Mean[(sampleQuantities[k, w, #]["Objective"] &) /@ samples];

kNumeric = {{0., .035, -.018}, {.012, 0., .027}, {-.016, .021, 0.}};
wNumeric = {{.82, -.14}, {.21, .73}, {-.31, .46}};
xSamples = {{-.8, .3}, {.2, -.7}, {.9, .6}, {-.35, -.45}, {.55, -.1}};
quantities = (sampleQuantities[kNumeric, wNumeric, #] &) /@ xSamples;
maxFixedPointResidual = Max[Abs[Flatten[quantities[[All, "Residual"]]]]];
record["numerical-fixed-point-residual", maxFixedPointResidual,
  maxFixedPointResidual < 10^-12];

inputStep = 10^-6;
susceptibilityFiniteDifference[x_] := Module[{n = Length[x]},
  Transpose@Table[(solveFixedPoint[kNumeric, wNumeric,
      x + inputStep UnitVector[n, j]] -
    solveFixedPoint[kNumeric, wNumeric,
      x - inputStep UnitVector[n, j]])/(2 inputStep), {j, n}]
];
chiFiniteDifference = susceptibilityFiniteDifference[First[xSamples]];
chiAnalytic = First[quantities]["Chi"];
chiMaxAbsoluteError = Max[Abs[chiFiniteDifference - chiAnalytic]];
record["susceptibility-finite-difference", chiMaxAbsoluteError,
  chiMaxAbsoluteError < 10^-8];

analyticGradient = Mean[quantities[[All, "Gradient"]]];
parameterStep = 10^-6;
finiteDifferenceGradient = Table[Module[{basis = ConstantArray[0.,
      Dimensions[kNumeric]]},
    basis[[i, j]] = 1.;
    (objectiveMean[kNumeric + parameterStep basis, wNumeric, xSamples] -
      objectiveMean[kNumeric - parameterStep basis, wNumeric, xSamples])/
      (2 parameterStep)], {i, Length[kNumeric]}, {j, Length[kNumeric]}];
gradientMaxAbsoluteError = Max[Abs[finiteDifferenceGradient - analyticGradient]];
gradientRelativeError = gradientMaxAbsoluteError/
  Max[10^-15, Max[Abs[finiteDifferenceGradient]]];
record["objective-gradient-finite-difference", <|
    "MaxAbsoluteError" -> gradientMaxAbsoluteError,
    "RelativeError" -> gradientRelativeError|>,
  gradientMaxAbsoluteError < 2 10^-7 && gradientRelativeError < 2 10^-6];

descentDirectionMean = -analyticGradient;
baseObjective = objectiveMean[kNumeric, wNumeric, xSamples];
steppedObjective = objectiveMean[kNumeric + 10^-5 descentDirectionMean,
  wNumeric, xSamples];
record["gradient-sign-decreases-objective", <|
    "Before" -> baseObjective, "After" -> steppedObjective|>,
  steppedObjective < baseObjective];

jsonChecks = Map[<|"name" -> #["Name"],
      "value" -> ToString[#["Value"], InputForm], "pass" -> #["Pass"]|> &, checks];
report = <|
  "schema" -> "shriki-2016-publication-verification/v2",
  "generatedAtUtc" -> DateString[TimeZoneConvert[Now, 0],
    {"Year", "-", "Month", "-", "Day", "T", "Hour", ":", "Minute", ":", "Second", "Z"}],
  "authority" -> <|"paperDoi" -> "10.1371/journal.pcbi.1004959",
    "appendixDoi" -> "10.1371/journal.pcbi.1004959.s001"|>,
  "provenance" -> <|
    "script" -> "mathematica/verification/PublicationDerivation.wls",
    "scriptSha256" -> IntegerString[FileHash[$InputFileName, "SHA256"], 16, 64],
    "sourceManifest" -> "mathematica/verification/source-manifest.json",
    "sourceManifestSha256" -> IntegerString[FileHash[
      FileNameJoin[{DirectoryName[$InputFileName], "source-manifest.json"}],
      "SHA256"], 16, 64],
    "projectModelImported" -> False|>,
  "independence" -> "Written from the paper and S1 Appendix before inspecting project implementations; imports no project model code.",
  "objectiveScope" -> "The displayed log-volume objective is the publication's low-noise approximation; this artifact does not reinterpret it as a general finite-noise mutual-information estimator.",
  "kernel" -> $Version,
  "allPassed" -> And @@ checks[[All, "Pass"]],
  "checkCount" -> Length[checks],
  "metrics" -> <|
    "fixedPointMaxAbsoluteResidual" -> maxFixedPointResidual,
    "susceptibilityFiniteDifferenceMaxAbsoluteError" -> chiMaxAbsoluteError,
    "objectiveGradientFiniteDifferenceMaxAbsoluteError" -> gradientMaxAbsoluteError,
    "objectiveGradientFiniteDifferenceRelativeError" -> gradientRelativeError,
    "objectiveBeforeStep" -> baseObjective,
    "objectiveAfterStep" -> steppedObjective|>,
  "referenceFixture" -> <|"K" -> kNumeric, "W" -> wNumeric,
    "input" -> First[xSamples], "state" -> First[quantities]["State"],
    "objective" -> First[quantities]["Objective"],
    "susceptibility" -> First[quantities]["Chi"],
    "descentDirection" -> First[quantities]["DescentDirection"]|>,
  "checks" -> jsonChecks|>;

requestedOutputPath = Replace[
  Environment["SHRIKI_WOLFRAM_VALIDATION_OUTPUT"], Except[_String] -> ""];
defaultOutputPath = FileNameJoin[{DirectoryName[$InputFileName], "results",
  "wolfram-validation.json"}];
outputPath = If[StringLength[requestedOutputPath] > 0,
  ExpandFileName[requestedOutputPath], defaultOutputPath];
outputDirectory = DirectoryName[outputPath];
If[!DirectoryQ[outputDirectory], CreateDirectory[outputDirectory]];
If[Quiet@Check[Export[outputPath, report, "RawJSON"], $Failed] === $Failed,
  Print["Could not export " <> outputPath]; Exit[1]];
Print[ExportString[KeyTake[report, {"kernel", "allPassed", "checkCount", "metrics"}],
  "RawJSON", "Compact" -> True]];
If[!TrueQ[report["allPassed"]], Exit[1]];
