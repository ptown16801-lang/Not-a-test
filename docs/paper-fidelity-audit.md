# Shriki–Sadeh–Ward model: publication-fidelity audit

Status: **the independent mathematical gate passes; the executable reference is
qualified for declared reconstruction experiments, not for claiming an exact
regeneration of unpublished Figure 7 trajectories.**

Audit date: 2026-09-07. The scientific authority order is:

1. [Shriki, Sadeh & Ward (2016), target article](https://doi.org/10.1371/journal.pcbi.1004959);
2. [target S1 Appendix](https://doi.org/10.1371/journal.pcbi.1004959.s001);
3. [Shriki & Yellin (2016), companion model](https://doi.org/10.1371/journal.pcbi.1004698);
4. [Shriki, Sompolinsky & Lee, foundational Infomax derivation](https://proceedings.neurips.cc/paper_files/paper/2000/file/09fb05dd477d4ae6479985ca56c5a12d-Paper.pdf).

Project JavaScript was not used as mathematical authority. The independent
Wolfram script imports no project implementation.

## Mathematical result

For (N) inputs and (M) outputs,

| Quantity | Dimensions |
|---|---:|
| (x) | (N\times1) |
| (s) | (M\times1) |
| (W) | (M\times N) |
| (K,G,\phi) | (M\times M) |
| (\chi) | (M\times N) |
| (\Gamma) | (N\times M) |
| (\Delta K) | (M\times M) |

The reconstructed equations are

\[
\tau\dot s=-s+g(Wx+Ks),\qquad s=g(Wx+Ks),
\]

\[
G_{ij}=g'_i\delta_{ij},\qquad
\phi=(G^{-1}-K)^{-1}=(I-GK)^{-1}G,\qquad
\chi=\phi W,
\]

\[
\epsilon=-\frac12\,\mathbb E_x\!\left[\log\det(\chi^T\chi)\right],
\]

\[
\Gamma=(\chi^T\chi)^{-1}\chi^T\phi,\qquad
a_k=(\chi\Gamma)_{kk}\frac{g''_k}{(g'_k)^3},
\]

\[
-\frac{\partial\epsilon}{\partial K}
=(\chi\Gamma)^T+(\phi^Ta)s^T.
\]

The sign and transpose order match the target paper and foundational
derivation. The S1 expression whose first term is simply (\phi^T) is the
square, full-rank simplification; it is not the general (M>N) rule.

### Objective scope

The foundational paper derives this objective as the zero-output-noise limit
of a manifold-volume expression for mutual information. It assumes a
continuous, single-valued, locally invertible input–output map and full-column
rank (\chi). It is **not** a general finite-noise mutual-information
estimator. The companion paper warns that attractor regimes can make the map
disconnected, discontinuous, or branch-dependent, violating those assumptions.

## Independent verification

`mathematica/verification/PublicationDerivation.wls` passed 28/28 checks in
Wolfram Engine 15.0. It independently checks dimensions, matrix differentials,
signs, transposes, logistic derivatives, susceptibility, the objective,
recurrent gradient, fixed points, and S1 stability algebra.

| Verification | Current result |
|---|---:|
| Independent fixed-point residual | (1.11\times10^{-16}) |
| Susceptibility vs. finite difference | (6.16\times10^{-11}) maximum absolute error |
| Objective gradient vs. finite difference | (3.18\times10^{-10}) maximum absolute error |
| Objective-gradient relative error | (1.73\times10^{-9}) |
| Independent random Wolfram fixtures | 9/9 pass |
| Worst repeated gradient absolute error | (7.85\times10^{-10}) |
| JavaScript random finite-difference fixtures | 6/6 pass |
| Worst JavaScript gradient absolute error | (4.64\times10^{-10}) |
| Wolfram MUnit suite | 31/31 pass |

The numerical implementation uses scaled QR/least-squares algebra for
(\Gamma), rather than explicitly inverting (\chi^T\chi). This is
algebraically equivalent at full column rank and avoids squaring the condition
number or underflowing the Gram matrix. A scalar (h=400) test has a
machine-zero Gram entry while retaining the finite objective (400) and
gradient (-1).

## Fidelity corrections

| Issue at resumed implementation | Resolution | Classification |
|---|---|---|
| Population vector divided by neuron count | Default is the published unnormalized complex sum; mean is explicit | Fidelity correction |
| High-dimensional diagonal always deleted | General reference retains it; deletion is explicit | Target simulation remains unresolved |
| Positive logistic derivative floor always active | Default is zero; positive floor is a labeled surrogate excluded from exact runs | Fidelity correction plus optional model change |
| Best checkpoints compared on changing random samples | Reference comparison uses one fixed input ensemble | Statistical correction; ensemble/cadence remain project choices |
| Explicit/normal-equation inverse paths | Scaled QR and reusable linear solvers | Equation-preserving numerical correction |
| Cubic derivative underflow | Compute (Ga) and solve directly | Equation-preserving numerical correction |
| Floored path reused (g''/g'=-\tanh(h/2)) incorrectly | Active-floor path retains literal (g''/g'_{\rm floor}) and labels surrogate semantics | Optional-path correction |

Retaining high-dimensional self-coupling is a well-supported **reference
convention**, not a uniquely published Figure 7 setting. The general sum permits
(K_{ii}), and the companion numerical model reports no form restriction, but
the target 142-unit simulation does not state its diagonal policy. Only the S1
two-unit analysis explicitly sets the diagonal to zero.

## Published, supported, and unreported details

| Detail | Evidence status | Reference behavior |
|---|---|---|
| 4 inputs; 142 outputs; 71 per modality | Target-paper explicit | Exact at (M=142) |
| Equally spaced circular preferred angles and unit feed-forward rows | Target-paper explicit | Endpoint-exclusive equal grid |
| General high-dimensional nonlinearity | Squashing function only | Logistic is a supported reconstruction convention from S1 and companion, not a printed Figure 7 parameter |
| Time constant | Symbolic (\tau) only | Time measured in units of (\tau) |
| Input angles | Independent uniform draws | Implemented |
| Radius distribution | Gaussian; SD proportional to mean | Coefficient 0.1 is companion-derived and labeled |
| Recurrent initialization | Target says near-zero **cross-talk**; abstract says zero | Full (K=0), all-matrix jitter, and cross-talk-only jitter are distinct conditions |
| Integrator and time step | Unreported | Synchronous Euler, step 0.5, declared project policy |
| Equilibrium tolerance | Only a small step-difference threshold described | Step and fixed-point residual (10^{-9}), two stable iterations |
| Training length, batch, seed | Unreported | Recorded for every run |
| Checkpoint ensemble/cadence | Unreported | Fixed ensemble, explicitly recorded |
| High-dimensional diagonal | Unreported | Retained reference convention; deletion optional |
| Population-vector threshold/classifier | Unreported | No author-exact classifier claimed |

The target reports five displayed Figure 7 simulations, not a replicated study.
It gives no seeds, uncertainty, monotonicity classifier, effective-zero
threshold, probe radius, root/branch initialization, or exact Gaussian
truncation rule. Figure 7D itself is described as sensitive to random
realization/local extrema.

## S1 Appendix internal issues

The audit records these as internal mathematical findings, not author-confirmed
errata:

- Eq. 95 prints a real-branch sign inconsistent with direct eigenvalue algebra
  and S1 Eqs. 93 and 97. The implementation follows the latter result.
- The derived learning Jacobian is symmetric, so
  (D=t^2-4\Delta=(J_{11}-J_{22})^2+4J_{12}^2\ge0); the complex branch is
  unreachable for that Jacobian.
- Eq. 96 should say nonnegative, not strictly positive: (u_1=u_2=0.3)
  gives (D=0).
- Eq. 92's statement that (\gamma_1) does not depend on (\eta) is not
  literally general; in the stable interior it does not cross (+1) for
  positive (\eta).

No correction linked from the official PLOS record was found as of the audit
date.

## Numerical-policy result

The fixed-point sensitivity suite varies Euler step, tolerance, solver, and
initialization. In its tested noncritical cases, Anderson and tight Euler agree
to (3.86\times10^{-14}), and every tested one-step update lowers its matched
objective. This does not make Anderson a simulation of the published temporal
dynamics or prove basin equivalence in a multistable regime.

The controlled critical construction is more restrictive. At
(\rho=0.9999), a fixed-point residual of (9.999\times10^{-10}) corresponds
to a state error of (9.999\times10^{-6}) and a **0.62176 relative gradient
matrix error**. Therefore a fixed residual tolerance is not a fidelity-safe
gradient criterion near criticality. Long critical trajectories require an
adaptive, condition-aware tolerance, higher precision, or an explicit
gradient-accuracy gate.

## Gate decision

The publication-equation implementation is validated and benchmarking is
unlocked. What remains impossible from the record is an author-exact Figure 7
regeneration: too many numerical and stochastic details are unreported. All
experiments therefore identify their reconstruction condition, and all
cross-size runs are labeled project model-family extensions rather than
paper-specified networks.
