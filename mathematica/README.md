# Complete Wolfram Language reconstruction

This directory rewrites the computational content of Shriki, Sadeh, and Ward
(2016) as an executable Mathematica project. It includes the rate dynamics, the
information-maximization objective, the exact recurrent learning rule, the S1
stability derivation, both network architectures, all five Figure 7 regimes,
population-vector analyses, and figure builders for Figures 1–7.

The work is an independent implementation of the published model, not a claim
to possess the authors' MATLAB source. The article states that the simulations
were written in MATLAB, but the source, random seeds, exact integration step,
stopping threshold, Figure 4 input grid, and training lengths were not released.
Those gaps remain named options; they are never silently presented as reported
parameters.

Primary sources:

- [paper](https://doi.org/10.1371/journal.pcbi.1004959)
- [S1 analytical appendix](https://doi.org/10.1371/journal.pcbi.1004959.s001)
- [companion criticality paper](https://doi.org/10.1371/journal.pcbi.1004698)

## Files

| File | Purpose |
|---|---|
| `SynesthesiaModel.wl` | Reusable model, sampling, fixed-point solver, objective, gradient, training, stability analysis, scaling backend, and JSON interop |
| `PaperFigures.wl` | Figure 1–7 constructors and scenario runners |
| `Shriki2016Reproduction.nb` | Full executable paper walkthrough with original explanatory prose |
| `RunAll.wls` | Headless runner for analytical, smoke, or full experiments |
| `ScalingBenchmark.wls` | Dense-versus-low-rank scaling report and timing harness |
| `SCALING_AUDIT.md` | Exact, tolerance-equivalent, approximate, model-changing, and unavailable-method audit |
| `paper-spec.json` | Machine-readable map of reported values, reconstruction choices, omissions, and figure coverage |
| `tests/SynesthesiaModel.wlt` | MUnit equation, parity, gradient, stability, and scaling tests |
| `tests/RunTests.wls` | Headless MUnit entry point |

## Open the notebook

Open `Shriki2016Reproduction.nb` in Mathematica and choose **Evaluation →
Evaluate Notebook**. The first cell loads both local packages. Expensive cells
are opt-in: the notebook builds analytical figures immediately, while the
27×27 learning sweep and the five long population-network trainings are clearly
marked.

The command-line path requires both the `wolframscript` wrapper and an activated
local Mathematica or Wolfram Engine kernel. `wolframscript --version` checks only
the wrapper; use `wolframscript -code '$Version'` to verify the kernel. A fresh
free developer engine prompts for its one-time Wolfram ID activation through
`wolframscript -activate`.

For a command-line kernel:

```sh
wolframscript -file mathematica/tests/RunTests.wls
wolframscript -file mathematica/RunAll.wls --mode=analytical --output=mathematica/output
wolframscript -file mathematica/RunAll.wls --mode=smoke --total-neurons=40 --steps=2 --output=mathematica/output
```

The literal paper-sized experiment is:

```sh
wolframscript -file mathematica/RunAll.wls --mode=full --total-neurons=142 --steps=1000 --output=mathematica/output
```

Independent runs can be distributed without sharing mutable state by selecting
one scenario per kernel, for example:

```sh
wolframscript -file mathematica/RunAll.wls --mode=full --scenario=deprivedHighPlasticity --total-neurons=2048 --maximum-rank=192 --steps=1000 --output=mathematica/output-deprived
```

`1000` is an explicit run length, not a value reported by the paper. Near the
critical point, the paper reports 35,000–45,000 rate-integration iterations for
a single sample and experiments lasting up to weeks. A serious reproduction
should therefore checkpoint and extend training until the objective and
cross-modal probes stabilize.

## Scaling beyond 142 output neurons

Both constructors accept any even total of at least six:

```wl
dense = CreateTwoModalityPaperNetwork["TotalNeurons" -> 512];
large = CreateScalablePaperNetwork[4096, "MaximumRank" -> 128];
NetworkScaleReport /@ {dense, large}
```

Estimate a proposed size without allocating it:

```wl
EstimateNetworkScale[1000000, 192]
EstimateNetworkScale[86000000000, 192]  (* cost estimate only *)
```

The second call is useful for a scale comparison, but the result explicitly
sets `"BiologicalEquivalence" -> False`. An output rate unit is not a biological
neuron, and increasing this two-modality angular code does not reproduce the
brain's cell types, sparse anatomy, temporal dynamics, or learning mechanisms.
The 86-billion comparison uses the approximate neuronal count reported by
[Azevedo et al. (2009)](https://doi.org/10.1002/cne.21974), not a target that
this implementation claims can be allocated.

The preferred angles are always recomputed as an endpoint-exclusive uniform
grid, so increasing the neuron count raises angular resolution without changing
the four-dimensional stimulus definition.

There are two recurrent backends:

| Backend | Intended use | Storage | Gradient status |
|---|---|---:|---|
| `"Dense"` | strict paper reproduction and moderate scales | (O(M^2)) | exact |
| `"LowRank"` | enlarged populations | (O(Mr)) | exact until rank compression |

The scalable backend follows directly from the published update. With four
inputs, its first term has rank at most four and its second term is an outer
product of rank one. Each sample update can therefore be stored as five factor
columns instead of an (M\times M) array. The fixed-point susceptibility is
solved through the Woodbury identity against the low-rank-plus-diagonal
recurrent operator. Repeated right-hand sides reuse the same factorization, and
the full (M\times M) matrix phi is not materialized in scalable mode.

Unbounded rank is algebraically equivalent to materializing every dense update:

```wl
exactLarge = CreateScalablePaperNetwork[2048, "MaximumRank" -> Infinity];
```

Its rank grows by at most five per single-sample step, so indefinite exact
training eventually loses the storage advantage. Setting `"MaximumRank"` runs
a factor-space truncated SVD when the cap is exceeded:

```wl
bounded = CreateScalablePaperNetwork[8192, "MaximumRank" -> 192];
```

That truncation is a modern approximation, not part of the 2016 paper. The
model increments `"Truncations"`, accumulates discarded singular-value mass,
and sets `Metadata["Approximate"]` so an approximate run cannot be mistaken for
an exact reproduction. The diagonal correction continues to enforce the
paper's no-self-coupling constraint.

Use `NetworkScaleReport[model]` before long runs. It reports current rank,
stored `Real64` numbers, dense-equivalent bytes, compression ratio, and whether
the trajectory is still algebraically exact. Dense matrix panels in Figure 6
are intentionally guarded for very large models; population probes remain
matrix-free.

## Fidelity boundaries

The Mathematica code owns only the neural computation. It does not turn text
or population activity into artwork, and it does not attribute the repository's
synesthetic geometry renderer to the paper. A compact project checkpoint can be
loaded with `ImportJavaScriptNetwork`, but it remains labeled as a visualization
checkpoint rather than a published result.

The full parameter ledger is in `paper-spec.json`. Every notebook result should
be interpreted under that ledger: reported values are transcriptions;
integration guards and seeds are reconstruction choices; rank truncation is a
scaling extension.

The broader method-by-method review is in `SCALING_AUDIT.md`. It includes the
important negative result: an unrestricted dense recurrent matrix can contain
M² independent values, so no representation can guarantee exact subquadratic
storage for every trained endpoint. It also states the epistemic boundary
directly—private and unpublished methods cannot be independently enumerated or
ruled out; no such method is assumed by this implementation.
