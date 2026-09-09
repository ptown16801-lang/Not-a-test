# NumPy/SciPy linear algebra and SHA-256 compatibility

Research record revision: `numpy-scipy-sha256/20260909.1`
Research discussion: September 8–9, 2026
Publication scope: findings and reproducibility artifacts from this conversation.

NumPy and SciPy, using an open-source BLAS backend such as OpenBLAS, are suitable for the numerical linear operations in the Neural Engine. SymPy is a complementary option for symbolic algebra. SHA-256 identifiers do not require 256-bit numerical arithmetic and do not prevent using these libraries.

This is a documentation and research-evidence update. No production equation, activation, learning rule, numerical tolerance, renderer, or random-stream definition is changed. The public baseline inspected for publication is `main` at `1d89ec7e1dd818020db0f9d0b0e177e598c29dff`, with `package.json` version `0.8.0`. The local Phase 1/Phase 2 work inspected during the conversation was ahead of that public baseline. Those local implementations are observations, not a claim that this publication merges them or releases a new engine version.

## Operations and available implementations

| Requirement | Suitable implementation | Scope |
|---|---|---|
| Weighted sums and matrix products | NumPy `W @ x + K @ s` | Numerical computation; optimized BLAS is used where applicable |
| Susceptibility and other general linear systems | SciPy `linalg.solve` | Solve the required right-hand sides without explicitly forming an inverse |
| Repeated right-hand sides for an unchanged operator | SciPy `lu_factor` and `lu_solve` | Factorization reuse is valid only while the coefficient matrix stays unchanged |
| Infomax volume/objective calculation | Scaled, rank-checked QR; SciPy provides pivoted QR | Preserve the existing numerical policy and full-column-rank requirement |
| Symbolic derivation and identities | SymPy, optionally followed by `lambdify` | Recommended option; SymPy was not installed or executed in the original runtime check |
| Numerical backend | OpenBLAS | Free, open-source BLAS implementation; present in the measured runtime |

The locally inspected Phase 2 finite-horizon model already used NumPy batched products and SciPy's `expit`. The original JavaScript equilibrium-analysis path explicitly formed a full inverse; ordinary forward inference already avoided that inversion. The inspected Wolfram implementation also used reusable linear solvers. These observations identify a possible Python implementation route; they do not establish that Python is universally faster than Wolfram or JavaScript.

The sigmoid and recurrent dynamics remain nonlinear. The recommendation concerns linear operations within those equations, not replacement of the nonlinear model with a linear model.

## Direct susceptibility solve

At an equilibrium, let `g` be the vector of sigmoid derivatives, `D = diag(g)`, `K` the recurrent matrix, and `W` the input matrix. The existing algebra is

\[
\chi=(I-DK)^{-1}DW.
\]

For a nonsingular operator, compute the equivalent linear system

\[
(I-DK)\chi=DW.
\]

```python
import numpy as np
from scipy.linalg import solve

# W, K, and the already validated equilibrium field h_star are float64 arrays.
z = np.exp(-np.abs(h_star))
g = z / (1 + z)**2
A = np.eye(K.shape[0]) - g[:, None] * K
chi = solve(A, g[:, None] * W, assume_a="gen")
```

Broadcasting implements diagonal row scaling without materializing `D`. The general solver is appropriate because `I-DK` is not generally symmetric. The snippet is an algebraic illustration, not a replacement for the engine's convergence, conditioning, derivative-representability, and rank gates.

This computes susceptibility directly. The complete original Infomax gradient and callers that require the full `phi` matrix need their own equivalent treatment. Keep the scaled QR objective instead of returning to an explicitly formed normal matrix. Do not silently add pseudoinverses, derivative floors, clipping, rank truncation, or changed learning rules.

## Measurements executed earlier in this thread

The original in-memory run used Python `3.12.13`, NumPy `2.3.5`, SciPy `1.17.0`, and OpenBLAS `0.3.30`, with one BLAS thread and float64 arrays. The operation benchmark used dense synthetic matrices, four right-hand sides, RNG seed `20260908`, warm calls, and medians over seven timing blocks. Each block performed 300, 25, and 3 repetitions at dimensions 12, 142, and 600, respectively. Function order was shuffled between blocks. Matrix construction, import/startup, serialization, and whole-engine execution were excluded. Normal SciPy finite-input checks remained enabled.

| Neurons | Inverse then multiply, ms | General solve including factorization, ms | LU factor + solve, ms | Solve with existing LU only, ms |
|---:|---:|---:|---:|---:|
| 12 | 0.032387 | 0.077600 | 0.047183 | 0.025300 |
| 142 | 1.214487 | 0.587696 | 0.377849 | 0.093461 |
| 600 | 35.296283 | 11.786771 | 10.266627 | 1.041205 |

The 600-dimensional general solve took approximately one-third the time of the inverse-plus-product operation. At dimension 12 it was slower. This negative result is retained. The reused-LU column excludes factorization and is not a fair first-solve comparison. The largest inverse/solve output difference across these synthetic cases was `8.881784197001252e-16`.

These are isolated CPU operation timings from one environment, not whole-engine speedups, GPU comparisons, model-training benchmarks, or scientific validation of network representations. There are no original per-block timing samples or confidence intervals retained from that in-memory run. The packaged reproduction records fresh samples separately; it must not replace the original reported measurements.

Five saved-state susceptibility cases were also evaluated using SciPy's direct solve:

| Saved case | Maximum absolute difference from saved susceptibility | Within existing tolerance |
|---|---:|---|
| stable-coupled | 5.551115123125783e-17 | Yes |
| no-recurrence | 0 | Yes |
| saturated-finite | 4.336808689942018e-19 | Yes |
| critical-0.9 | 3.3306690738754696e-16 | Yes |
| critical-0.9999 | 1.609805622138083e-10 | Yes |

The normalized linear-system residuals were at most `6.704917232031943e-17`. The most critical case had operator condition number approximately 10,000. Agreement at saved fields is not a new equilibrium solve, a finite-difference gradient check, or a certificate of correctness near criticality. In particular, two runtimes can agree at an insufficiently accurate equilibrium.

## SHA-256 and numerical compatibility

The locally inspected provenance implementation separates `sha256/v1` identity from the `ne-canonical-binary64/v1` numeric serialization profile. Network arithmetic remains IEEE-754 binary64. SHA-256 produces a 256-bit digest of a record's canonical bytes; it does not increase the precision or mathematical complexity of matrix arithmetic.

Python's existing canonical implementation used standard-library `hashlib.sha256`. NumPy arrays must be converted to the accepted plain-data representation before canonicalization. JavaScript and Python must preserve the same numeric encoding, key ordering, array ordering, negative-zero policy, and rejection of nonfinite values. Ordinary JSON formatting alone is not the project's canonical format. Higher-precision or symbolic values require an explicit typed representation rather than an unannounced float64 conversion.

Numerical equivalence and record identity are separate checks. A different solver or operation ordering can change the last floating-point bits while remaining within scientific tolerances. Different canonical values should then produce different content identifiers. Preserve the prior records and compare numerical results with the registered tolerances; do not round records merely to force matching hashes.

The inspected project also used SHA-256 in random-stream construction. Preserving the seed, path, counter, and version definitions matters for reproducing inputs, projections, and artistic choices. Porting a library without preserving those stream definitions would change the experiment. Hashing and serialization have their own execution and storage costs; this thread did not benchmark them, so no total-performance claim is made for the SHA-256 migration.

## Evidence and reproduction

The research artifacts are in [`research/numpy-scipy-sha256/20260909`](../../research/numpy-scipy-sha256/20260909):

- `thread-results.json` preserves values captured from the earlier tool output in this thread, explicitly labeled as a retrospective conversation record.
- `susceptibility-corpus.json` is a publication-time copy of the local Phase 1 corpus used to make the saved-state check reproducible. Its earlier embedded Wolfram-availability wording is historical metadata, not a fresh status claim. Its original-run SHA-256 was not recorded at execution time.
- `reproduce.py` reproduces the numerical operations and records new timings and runtime details in a new file.
- `source-evidence.json` identifies the publication baseline and fingerprints locally inspected provenance sources and the copied corpus. Publication-time hashes are not backdated evidence.
- `publication-replay.json` records the separate publication-time execution, including its own timing samples and limits.

From the repository root, with NumPy, SciPy, and threadpoolctl available:

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 -B \
  research/numpy-scipy-sha256/20260909/reproduce.py \
  --output /tmp/neural-linear-algebra-replay-new.json
```

The output path must be new. Timings depend on hardware, process load, library versions, threading, and array layout. The original measurements remain evidence of that run only. A future engine implementation needs its own acceptance tests and end-to-end measurements.

Paired scientific and plain-language histories are generated with the existing maintenance workflow. The legacy `MASTER_PROJECT.json`, `PROJECT_LOG.json`, prior reports, and prior snapshots remain intact. This research record is independent of any separately queued Phase 1/Phase 2 implementation publication.

## Primary references consulted in the research thread

- [NumPy project and open-source status](https://numpy.org/about/)
- [NumPy matrix multiplication and BLAS behavior](https://numpy.org/doc/stable/reference/generated/numpy.matmul.html)
- [SciPy project](https://scipy.org/about/)
- [SciPy general linear solve](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.solve.html)
- [SciPy LU factorization](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.lu_factor.html)
- [SciPy solve using an LU factorization](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.lu_solve.html)
- [SciPy pivoted QR](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.qr.html)
- [SymPy project and BSD license](https://www.sympy.org/en/index.html)
- [SymPy symbolic-to-numerical conversion](https://docs.sympy.org/latest/modules/utilities/lambdify.html)
- [OpenBLAS documentation and BSD license](https://www.openmathlib.org/OpenBLAS/docs/)
