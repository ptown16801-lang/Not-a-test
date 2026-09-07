# Scaling audit for the recurrent Infomax model

This audit answers a narrower question than “how can a modern neural network be
made larger?” The 2016 model is a fixed-point rate network with four inputs,
`M` logistic output neurons, and an unrestricted `M × M` recurrent matrix. A
method counts as a strict reproduction only if it preserves that fixed-point
equation and the published recurrent update.

`TotalNeurons` in this implementation means total **output** neurons. The four
input coordinates remain fixed at two Cartesian coordinates per modality.
`EstimateNetworkScale[total, rank]` calculates storage and connection counts
without allocating arrays, so even extreme targets can be examined safely.

## The leverage that is specific to this model

For one input sample the published update is

```text
ΔK / η = (χ Γ)^T + (φ^T a) s^T.
```

Here `χ` is `M × 4`, `Γ` is `4 × M`, and the second term is an outer
product. Consequently, the update rank is at most `4 + 1 = 5`; a batch of `B`
samples adds at most `5B` factor columns. This is why the implementation can
store

```text
K = Diagonal[d] + U V^T
```

and use the Woodbury identity without first creating `K`. The diagonal term is
the exact correction that keeps every self-coupling zero. With no rank cap this
is algebraically the same update as the dense model. With a finite cap it
becomes an explicitly recorded truncated-SVD approximation.

The susceptibility objective never needs a large determinant: `χ^T χ` is
always only `4 × 4`. The package also avoids constructing the full `M × M`
matrix `φ` in scalable mode and reuses factorizations for its several
right-hand sides.

## Audited routes

| Route | Classification | Included here | Practical consequence |
|---|---|---:|---|
| Increase the endpoint-exclusive preferred-angle grid | Exact model extension | Yes | Raises circular population resolution at any even output count ≥ 6. |
| Low-rank update history plus diagonal correction | Exact until compression | Yes | Recurrent storage is `O(Mr)`, and a sample adds at most five columns. |
| Woodbury susceptibility solves | Exact until compression | Yes | Replaces an `M × M` solve by diagonal operations and an `r × r` solve. |
| Reuse forward, transpose, and Gram factorizations | Exact | Yes | Avoids refactoring the same operator for each right-hand side. |
| Do not materialize `φ` | Exact | Yes | Removes an unnecessary `M × M` result; set `"ReturnPhi" -> True` when explicitly needed. |
| Warm-start nearby probe angles | Tolerance-equivalent | Yes | Usually cuts fixed-point iterations; it must converge to the same root. |
| Anderson fixed-point acceleration | Tolerance-equivalent | Yes | Addresses critical slowing while retaining a residual/tolerance check. |
| Separate-kernel scenario and seed jobs | Exact apart from floating-point ordering | Yes | `RunAll.wls --scenario=...` supports job arrays; the five scenarios do not share state. |
| Packed machine reals and compiled inner loops | Tolerance-equivalent | Partly | Arrays are machine real; `Compile` is a further backend optimization, not a changed equation. |
| Incrementally update the small Woodbury factorization | Exact | Not yet | Can avoid rebuilding the `r × r` factorization after each five-column append. Worth adding if unbounded-rank runs dominate. |
| Matrix-free GMRES/BiCGSTAB | Tolerance-equivalent | Not yet | Can replace the `r^3` Woodbury core cost at high rank, but needs residual monitoring and preconditioning. |
| Distributed dense factorization/matrix multiplication | Exact apart from floating-point ordering | Not built in | Retains unrestricted dense `K`; useful on an HPC linear-algebra stack when memory is distributed. |
| Finite-rank SVD compression | Approximate | Yes, opt-in | Bounds memory; truncation count and discarded singular-value mass are stored in the model. |
| Randomized SVD or sketching | Approximate | No | Helps only when the factor core itself becomes large; adds stochastic error. |
| Sparse `K`, pruning, or local receptive fields | Model-changing | No | The exact gradient is generally dense, so sparsity is not preserved without a constraint. |
| Four block-circulant recurrent kernels with FFTs | Model-changing, symmetry-restricted | No | Gives roughly `O(M log M)` multiplication and `O(M)` parameters, but ties weights that were unrestricted in the paper. |
| GPU dense algebra | Hardware strategy | No repository-specific kernel | Can accelerate large dense runs without a conceptual change; results still depend on backend and precision. |
| Mixed precision or quantization | Approximate | No | Saves memory/bandwidth but is risky near singular susceptibility and criticality. |
| Unroll fewer rate iterations or use a surrogate network | Approximate/model-changing | No | Faster, but no longer evaluates the paper's converged steady state. |
| Deep-equilibrium implicit differentiation | Already embodied by the paper's rule | N/A | Modern DEQ work validates the strategy, but it does not remove an additional matrix beyond those already eliminated here. |
| Stochastic log-determinant estimators | Not useful here | No | The determinant is only `4 × 4`; estimation would add error without solving the scaling bottleneck. |

An arbitrary, fully trained dense `M × M` matrix contains `M²` independent
numbers. No exact general-purpose format can promise subquadratic storage for
every such matrix. The factorized path wins because early update history is
low rank; indefinite exact training can eventually reach rank `M`, at which
point dense or distributed dense algebra is the honest fallback. A finite rank
cap stays scalable by changing that guarantee from exact to approximate.

## Public-source check

The audit covers the model paper and supplement, Wolfram's documented numerical
and parallel facilities, fixed-point acceleration, implicit differentiation,
randomized factorization, and structured circulant networks:

- [Shriki, Sadeh & Ward model](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1004959)
- [PLOS supplementary-material record](https://plos.figshare.com/articles/journal_contribution/The_Emergence_of_Synaesthesia_in_a_Neuronal_Network_Model_via_Changes_in_Perceptual_Sensitivity_and_Plasticity/3907575)
- [Wolfram `LinearSolve`](https://reference.wolfram.com/language/ref/LinearSolve.html), [`Compile`](https://reference.wolfram.com/language/ref/Compile.html), and [`ParallelTable`](https://reference.wolfram.com/language/ref/ParallelTable.html)
- [Walker & Ni, Anderson acceleration](https://doi.org/10.1137/10078356X)
- [Bai, Kolter & Koltun, deep equilibrium models](https://arxiv.org/abs/1909.01377)
- [Blondel et al., modular implicit differentiation](https://proceedings.neurips.cc/paper_files/paper/2022/file/228b9279ecf9bbafe582406850c57115-Paper-Conference.pdf)
- [Halko, Martinsson & Tropp, randomized matrix decompositions](https://arxiv.org/abs/0909.4061)
- [Cheng et al., circulant neural networks](https://arxiv.org/abs/1502.03436)

## Boundary on “non-public” methods

There is no reproducible way to enumerate trade secrets, unpublished lab code,
or confidential hardware methods. They are unobservable until their owners
disclose them. This project therefore makes the strongest check that can be
independently verified: it audits public primary sources and documented
software capabilities, derives model-specific algebra from the published
equations, and assumes no secret method. If a private method is later supplied
under appropriate authority, it can be evaluated against the exact/approximate
criteria above; its existence cannot honestly be certified or ruled out now.
