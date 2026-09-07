# Shriki 2016 reconstruction: qualified modern-compute results

Audit and measurement date: 2026-09-07.

## Result

The paper-sized (M=142) declared reconstruction completed 1,000 recurrent
updates in **239.805 seconds** and the complete run, including fixed validation,
in **241.659 seconds**. The requested size ladder was then executed through
(M=9{,}088) for a common 10-update early window. Algebraically exact
one/two-update feasibility probes reached (M=72{,}704).

These are three different evidence classes:

| Evidence class | Largest (M) | What was actually demonstrated |
|---|---:|---|
| 1,000-update reference trajectory | 142 | Sustained declared reconstruction run |
| Uniform 10-update window | 9,088 | Early factor-history execution and fixed-window scaling |
| One/two-update probe | 72,704 | Bounded execution feasibility only |

No sustained cross-size practical limit was measured, and no controlled
speedup relative to the authors can be calculated from the publication. The
paper reports computation lasting up to a couple of weeks, but does not report
a matched update count, machine, integration step, tolerance, seed, or
checkpoint trajectory. The four-minute observation is therefore a qualitative
contrast, **not a speedup ratio**.

## Qualification gate

The mathematical gate was completed before benchmarking. The independent
Wolfram reconstruction passes 28/28 checks; nine additional random Wolfram
fixtures and six JavaScript fixtures pass finite-difference tests; the Wolfram
MUnit suite passes 31/31 tests. See
[`paper-fidelity-audit.md`](paper-fidelity-audit.md).

`AggregateScalingResults.wls` rejects a current run unless all of the following
match:

- v2 schema and expected file/cohort identity;
- current benchmark-script and model-source SHA-256 fingerprints;
- neuron count, input dimension, backend, update horizon, repeats, and
  validation count;
- step-and-residual convergence and residual within the declared tolerance;
- no truncation, sparsification, clipping, derivative floor, or diagonal
  constraint;
- finite training/validation metrics and the fixed experimental protocol.

All 10 current runs pass. Historical v1 files remain in the repository for
provenance but are excluded from current claims.

## What “exact” means

The factor-history backend stores the published one-sample update as

\[
\Delta K/\eta=[\Gamma^T,\ b][\chi,\ s]^T,
\qquad b=\phi^Ta,
\]

whose algebraic rank is at most (N+1=5). It retains every factor column and
uses an exact Sherman–Morrison–Woodbury identity; no rank truncation is used.
“Exact” here means **algebraically exact execution in floating-point arithmetic
of the declared project condition**, not bitwise equality to a dense summation.

This scalable representation is exact only from (K=0), or from an explicitly
diagonal-plus-low-rank initialization. A generic near-zero dense recurrent
matrix is normally full rank. Because the target paper reports near-zero
cross-talk but does not give its scale/distribution or within-modality
initialization, the scalable runs are exact for the declared full-(K=0)
reconstruction condition, not a uniquely author-specified initialization.

Only (M=142) is specified by the target paper. Larger equal-angle grids are a
scientifically motivated project model family. They are not labeled
paper-equivalent.

## Fixed protocol

All current measurements record the following choices in their JSON:

- logistic reference convention;
- full (K=0) initialization and trained diagonal retained;
- Figure 7E means ((0.2,2.0)) and learning rate (1.5\times10^{-4});
- radius SD (0.1\) times the mean, explicitly borrowed from the companion
  paper rather than the target;
- batch size 1, fixed seeds, and checkpoint restoration disabled for timing;
- synchronous Euler step 0.5 in units of (\tau);
- step and fixed-point-residual tolerances (10^{-9}), two stable iterations;
- binary64 arithmetic, no clipping, sparsity, or approximation.

## Paper-sized reference result

| Metric | (M=142) result |
|---|---:|
| Updates | 1,000 |
| Training time | 239.805 s |
| Time per update | 0.239805 s |
| Total with 16-sample before/after validation | 241.659 s |
| Settling iterations per training sample | 31 |
| Probe fixed-point residual | (1.7474\times10^{-10}) |
| Validation objective, before | -0.795891 |
| Validation objective, after | -0.814696 |
| Final representation | Dense after exact factor handoff |
| Wolfram allocator peak | 234.8 MB |
| Linux process peak resident set | 358.6 MB |

The validation change is evidence for this deterministic 1,000-update
trajectory; it is not a regenerated Figure 7 endpoint or a convergence proof.

## Requested ladder: common 10-update window

The 142 run has a different 1,000-update horizon and is intentionally excluded
from the fixed-window fit.

| (M) | Settle median (s) | Objective incl. settle (s) | Gradient incl. settle/objective (s) | Training s/update | Total incl. validation (s) | Factor columns | Peak RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 284 | 0.0335 | 0.0452 | 0.0497 | 0.2059 | 2.78 | 50 | 195.6 |
| 568 | 0.0670 | 0.0902 | 0.0797 | 0.4148 | 5.35 | 50 | 196.8 |
| 1,136 | 0.1036 | 0.1347 | 0.1465 | 0.7427 | 10.42 | 50 | 201.4 |
| 2,272 | 0.1604 | 0.3159 | 0.3825 | 1.4977 | 21.17 | 50 | 212.3 |
| 4,544 | 0.4158 | 0.6895 | 0.6783 | 3.1146 | 42.94 | 50 | 238.0 |
| 9,088 | 1.0555 | 1.1599 | 1.3720 | 6.5448 | 89.95 | 50 | 291.7 |

The log–log slope of training seconds/update versus (M) over this fixed
rank-50 window is **0.991**. It describes only this early window. It cannot be
extrapolated to long training because the stored column count grows as
(r\le5t), changing both memory and solve cost.

Across these six sizes, three diagnostics agree to floating-point precision:

- the range of (epsilon+2\log M) before validation is
  (1.78\times10^{-15});
- the range of the 10-update validation-objective change is
  (2.66\times10^{-14});
- the range of the recurrent Frobenius norm is
  (6.51\times10^{-19}).

This supports the declared equal-grid refinement on one seed and one early
window. The (epsilon+2\log M) centering follows the symmetric (K=0)
baseline and is a project diagnostic, not a universal invariant or published
normalization law.

## Farther bounded probes

| (M) | Updates | Training s/update | Total incl. validation (s) | Factor columns | Peak RSS (MB) |
|---:|---:|---:|---:|---:|---:|
| 18,176 | 2 | 6.5263 | 18.57 | 10 | 231.6 |
| 36,352 | 1 | 11.3195 | 21.45 | 5 | 251.7 |
| 72,704 | 1 | 26.8300 | 48.99 | 5 | 322.4 |

The differing horizons explain why peak memory is not monotone across the two
tables. These probes establish a lower bound—one exact update was executed at
72,704—not a training endpoint or failure boundary.

## The actual mathematical scaling barrier

For factor-column count (r), storage is approximately (M(2r+1)), while a
dense recurrent matrix uses (M^2) values. The storage crossover is therefore

\[
r_{\rm cross}=\left\lceil\frac{M-1}{2}\right\rceil,
\qquad
t_{\rm cross}=\left\lceil\frac{M-1}{10}\right\rceil
\]

for batch-one updates that append at most five columns. The exact backend
densifies at update 15 for (M=142), 909 for (M=9{,}088), and 7,271 for
(M=72{,}704). This is a storage crossover, not a measured runtime optimum.

Before handoff, a factor solve has leading structure
(O(Mr^2+r^3)), in addition to repeated fixed-point iterations. With
(r\sim5t), fixed-rank early timings cannot represent long-horizon cost. After
handoff, unrestricted recurrent storage is (O(M^2)), and general dense
factorization has cubic arithmetic scaling. These are properties of preserving
the unrestricted scientific model, not limitations unique to 2016 hardware.

The present data do **not** locate where that barrier becomes operational for a
fully trained large model. Establishing a sustained practical limit requires
matched long trajectories, several seeds, a stopping endpoint, condition-aware
settling, and an observed resource failure or crossover. The evidence supports:

- sustained declared execution at 142;
- early-window exact execution through 9,088;
- one-update exact execution through 72,704;
- **no measured sustained cross-size practical limit**.

## Critical slowing and gradient fidelity

A controlled 142-neuron rank-one construction sets the fixed-point Jacobian
spectral radius to (\rho) and has the known equilibrium (s=\tfrac12\mathbf1).
This isolates residual amplification without claiming to reproduce a Figure 7
endpoint.

| (\rho) | Euler iterations | Settle time (s) | State error from exact fixed point | Exact-state gradient relative error | Tolerance-settled gradient relative error |
|---:|---:|---:|---:|---:|---:|
| 0.9 | 272 | 0.122 | (8.72\times10^{-9}) | (2.67\times10^{-16}) | (4.44\times10^{-7}) |
| 0.99 | 2,298 | 1.511 | (9.88\times10^{-8}) | (5.34\times10^{-16}) | (5.54\times10^{-5}) |
| 0.999 | 18,294 | 10.733 | (9.99\times10^{-7}) | (5.60\times10^{-16}) | (5.73\times10^{-3}) |
| 0.9995 | 33,595 | 18.506 | (2.00\times10^{-6}) | (3.50\times10^{-16}) | (2.33\times10^{-2}) |
| 0.9999 | 129,683 | 71.389 | (1.00\times10^{-5}) | (3.56\times10^{-16}) | **0.62176** |

Every exact-state analytical gradient passes. The failure is the use of a
fixed residual tolerance as a proxy for gradient accuracy near a nearly
singular (I-GK). Therefore the current (10^{-9}) policy is acceptable only
as a declared benchmark policy; it is not a universal fidelity guarantee for
critical training.

## Reproducibility artifacts

- `mathematica/benchmark-results/scaling-summary.json`: qualified claim ledger;
- `mathematica/benchmark-results/benchmark-qualification.json`: per-run gate;
- `mathematica/benchmark-results/scaling-measurements.csv`: current and
  historical rows with cohort labels;
- `mathematica/benchmark-results/factorhistory-*-v2.json`: raw current runs;
- `mathematica/benchmark-results/critical-slowing-142.json`: critical test;
- `mathematica/verification/results/`: symbolic, MUnit, repeated, policy, and
  cross-language validation logs.
