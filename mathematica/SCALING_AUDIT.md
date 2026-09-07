# Scaling-method audit for the Shriki reconstruction

This audit treats the target model as four inputs, (M=142) outputs, an
unrestricted recurrent matrix, and the published Infomax update. Only 142 is
author-specified. Other even (M\ge6) values are a declared circular-grid
project extension.

## Classification rule

| Class | Meaning | Permitted in current exact cohort? |
|---|---|---:|
| Equation-preserving | Same finite-dimensional equations; only algebraic evaluation order/representation changes | Yes |
| Tolerance-equivalent | Solves the same equation only up to a stated residual/error policy | Separate cohort only |
| Approximate | Deliberately discards numerical information | No |
| Model-changing | Changes architecture, dynamics, statistics, objective, or learning rule | No |

“Algebraically exact” does not mean bitwise-identical floating-point
accumulation.

## Current exact method

For one input sample, the recurrent descent direction factors as

\[
(\chi\Gamma)^T+(\phi^Ta)s^T
=[\Gamma^T,\ b][\chi,\ s]^T,\qquad b=\phi^Ta,
\]

so it has algebraic rank at most (N+1=5). Concatenating the factor pairs for
a predetermined batch and scaling one side represents the batch mean exactly.

From (K=D+LR^T), the fixed-point operator is

\[
I-GK=B-GLR^T,\qquad B=I-GD,
\]

and the implementation uses

\[
(B-GLR^T)^{-1}=B^{-1}+B^{-1}GL
(I-R^TB^{-1}GL)^{-1}R^TB^{-1}.
\]

Swapping (L) and (R) gives the required transpose operator. The signs and
ordering match the [Sherman–Morrison–Woodbury identity](https://doi.org/10.1137/1031049).
Every solve is checked by a backward residual, and moderate pathological
diagonal-base cases fall back to a dense solve.

The implementation also:

- solves ((I-GK)\phi R=GR) without forming (G^{-1});
- reuses each constructed solver across multiple right-hand sides;
- computes (\Gamma) by scaled QR/least squares rather than an explicit Gram
  inverse;
- computes (Ga) directly to avoid cubic derivative underflow;
- avoids materializing the full (M\times M\) (\phi) in scalable mode;
- retains all factor columns until exact dense handoff; and
- records source hashes, residuals, exactness switches, and OS peak RSS.

[Wolfram `LinearSolve`](https://reference.wolfram.com/language/ref/LinearSolve.html)
supports reusable solver objects, while [LAPACK `DGETRS`](https://www.netlib.org/lapack/explore-html/df/d36/group__getrs_gaacd7a8465c8cc0e4e8b88ba4b453630c.html)
formalizes reuse of an LU factorization for (A) and (A^T) with matrix right
hand sides. [LAPACK `DGELSY`](https://www.netlib.org/lapack/explore-html/d6/d4b/dgelsy_8f_source.html)
uses pivoted QR and supports several least-squares right-hand sides.

## Applicability boundary

Factor history is equation-preserving only when the initial recurrent matrix is
already diagonal-plus-low-rank—especially full (K=0). A generic near-zero
dense matrix is normally full rank. Thus the scalable runs exactly execute the
declared full-(K=0) reconstruction condition, not every initialization
consistent with the target paper's unspecified “near-zero cross-talk.”

No exact general-purpose representation can guarantee subquadratic storage for
an unrestricted matrix after arbitrary updates. Two (M\times r) factors plus
a diagonal use (M(2r+1)) values, so dense storage becomes no larger at

\[
r_{\rm cross}=\left\lceil\frac{M-1}{2}\right\rceil.
\]

For batch-one updates appending at most five columns, handoff occurs at

\[
t_{\rm cross}=\left\lceil\frac{M-1}{10}\right\rceil.
\]

The handoff is update 15 at (M=142), not update 29; it is update 909 at
(M=9{,}088). This is a storage criterion, not necessarily the runtime-optimal
crossover.

## Complexity and evidence boundary

At factor-column count (r), recurrent matrix-vector products cost
(O(M(r+1))), and the Woodbury factor solve has leading work
(O(Mr^2+r^3)). Since (r\le5t) for batch-one training, a 10-update/rank-50
fit cannot be extrapolated to 1,000 updates. After exact dense handoff, storage
is (O(M^2)) and general factorization is cubic.

The current experiment supports:

- one 1,000-update trajectory at (M=142);
- a matched 10-update early window through (M=9{,}088);
- one/two-update feasibility through (M=72{,}704).

It does not measure a sustained cross-size limit or a failed resource boundary.

## Critical conditioning

At (\(\rho=0.9999\)), the controlled critical test reaches fixed-point residual
(9.999\times10^{-10}) but has state error (9.999\times10^{-6}) and
gradient relative error 0.62176. Locally,

\[
e_s\approx(I-GK)^{-1}r_f,
\]

so residual alone cannot bound forward or gradient error as the operator
approaches singularity. The current exact cohort records its fixed policy; it
does not assert that this policy is fidelity-safe for critical endpoint
training. Condition-aware tolerance, higher precision, or direct gradient
error checks are required there. LAPACK's expert drivers explicitly expose
condition estimates and forward/backward error information
([`DGESVXX`](https://www.netlib.org/lapack/explore-html/df/d38/group__gesvxx_ga4b2a7e11fe7425c012ca9eba6c06877f.html)).

## Post-expansion efficiency review

### Equation-preserving opportunities

| Technique | Audit verdict |
|---|---|
| Reuse one factorization for matrix right-hand sides and transpose solves | Correct; current duplicate transpose factorization was removed |
| Combine compatible right-hand sides into a block solve | Correct and still available as a low-level optimization |
| Derive singular values from the small (4\times4) QR factor rather than separately processing the tall susceptibility | Correct; not yet implemented |
| Avoid returning the diagnostic Gram matrix when a caller does not request it | Correct; not yet implemented |
| Empirically choose an earlier dense handoff when memory permits | Same equations, different representation; benchmark separately |
| Parallelize predetermined independent samples/seeds with ordered reduction | Correct; current benchmarks did not use actual sample parallelism |
| FP64 GPU dense algebra after handoff | Correct in model terms; validate residuals and deterministic mode |
| Distributed dense FP64 algebra | Correct in model terms; communication becomes a first-class cost |

NVIDIA documents dense solver support and a deterministic cuSOLVER mode
([cuSOLVER](https://docs.nvidia.com/cuda/cusolver/index.html)); cuBLAS documents
that bitwise reproducibility can change across toolkit versions or concurrent
streams ([cuBLAS](https://docs.nvidia.com/cuda/cublas/index.html)).
[ScaLAPACK](https://www.netlib.org/scalapack/slug/node4.html) provides
distributed-memory dense BLAS/LAPACK. Communication-avoiding QR is relevant to
tall susceptibility matrices and distributed dense handoff
([Demmel et al.](https://arxiv.org/abs/0808.2664)).

### Tolerance-equivalent techniques

| Technique | Required qualification |
|---|---|
| Anderson acceleration | Same fixed point and basin must be demonstrated; it is not the temporal Euler trajectory |
| GMRES/BiCGSTAB | Preconditioned residual plus condition-aware forward/gradient error gate |
| Warm starts | Root/branch invariance in multistable regimes |
| Mixed-precision iterative refinement | Final FP64 backward and forward error comparable to reference |

Anderson's fixed-point role is established by
[Walker & Ni](https://doi.org/10.1137/10078356X); safeguarded variants exist for
nonexpansive problems, so unsafeguarded success on one fixture is insufficient.
[GMRES](https://doi.org/10.1137/0907058) minimizes a Krylov residual, which is
not itself a forward-error guarantee near singularity. LAPACK's
[`DSGESV`](https://www.netlib.org/lapack/explore-html/d8/dc6/group__gesv__mixed_ga2dd852850de165b9150bb7ee4f4ca3e9.html)
falls back to double precision when single-precision iterative refinement
fails; mixed precision is therefore conditional, not automatically equivalent.

### Approximate or model-changing techniques

The current exact cohort excludes:

- finite-rank truncation, randomized compression, and sketching;
- sparsification, pruning, or block-circulant constraints;
- altered recurrent normalization or cross-size learning rules;
- derivative floors, clipping, and surrogate/incompletely settled dynamics;
- changed activation, input statistics, batch objective, or learning rule; and
- mean-normalized population vectors presented as the publication metric.

The companion ring model's continuum argument and plots of (MK_{ij}) support
individual ring weights of order (1/M), but that is evidence for a related
single-ring model, not a published Figure 7 scaling law. Equal-grid
near-invariance in the current 10-update cohort is therefore a diagnostic. Its
rapid agreement is consistent with geometric convergence of periodic
trapezoidal quadrature for analytic functions
([Trefethen & Weideman](https://doi.org/10.1137/130932132)), not proof of
cross-size biological equivalence.

## Previously overstated techniques

- Earlier documentation implied actual compilation, batching, or parallel
  execution. The current measurements use Wolfram packed numerical arrays and
  matrix operations, but no GPU and no parallel sample execution.
- Earlier text treated an incremental Woodbury core update as reusable across
  samples. Because (G) changes with the equilibrium, every old–old core entry
  changes; prior factors may be a preconditioner, not an exact bordered update.
- Earlier 1,136–2,272 “practical limit” and long-horizon projections were based
  on heterogeneous windows and are withdrawn.

## Boundary on unpublished methods

No public author code or complete numerical protocol was located. Unpublished
or proprietary methods cannot be enumerated or ruled out. This audit evaluates
the published equations and the transparent methods in this repository only.
