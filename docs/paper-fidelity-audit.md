# Shriki model paper-fidelity audit

Status: **required gate before optimization/scaling results are treated as authoritative**.

Primary authority:

- Shriki, Sadeh & Ward (2016), *The Emergence of Synaesthesia in a Neuronal Network Model via Changes in Perceptual Sensitivity and Plasticity*, PLOS Computational Biology 12(7): e1004959, DOI 10.1371/journal.pcbi.1004959.
- Shriki & Yellin (2016), *Optimal Information Representation and Criticality in an Adaptive Sensory Recurrent Neuronal Network*, PLOS Computational Biology 12(2): e1004698, DOI 10.1371/journal.pcbi.1004698.
- S1 Appendix to Shriki, Sadeh & Ward (2016).
- Shriki, Sompolinsky & Lee (2001), *An Information-Maximization Approach to Overcomplete and Recurrent Representations*.

## Verified mathematical core

The current implementation's central equations match the published model at the notation/matrix level:

- rate dynamics: `tau ds/dt = -s + g(Wx + Ks)`;
- steady state: `s = g(Wx + Ks)`;
- logistic nonlinearity for the 2016 simulations, with `tau = 1`;
- `G_ij = g'_i delta_ij`;
- `phi = (G^-1 - K)^-1`;
- `chi = phi W`;
- objective `epsilon = -1/2 < ln det(chi^T chi) >_x`;
- `Gamma = (chi^T chi)^-1 chi^T phi`;
- `a_k = [chi Gamma]_kk g''_k/(g'_k)^3`;
- recurrent update `Delta K = -eta d epsilon/dK = eta <(chi Gamma)^T + phi^T a s^T>`.

An independent finite-difference numerical check of the published recurrent update was performed on a small nonsymmetric network. The analytical update direction agreed with the negative central-difference objective gradient to approximately `3.2e-10` maximum absolute error on that fixture. This independently supports the sign, transpose placement, and `a_k` derivative term used by the reconstruction.

## Confirmed implementation deviations / unresolved publication details

### 1. Population-vector normalization — confirmed deviation

The papers define the population vector by **summing** the complex numbers associated with the neurons. `src/neural-synesthesia.js` currently divides the real and imaginary sums by population size. This normalization preserves population-vector angle and preserves whether the magnitude is zero or finite, but it changes the magnitude and therefore is not paper-exact.

Required action before paper-exact figure/metric comparisons: expose an unnormalized paper population-vector metric. Any normalized version should be explicitly labeled as a project visualization/size-normalization metric.

### 2. Recurrent initialization — fidelity-sensitive ambiguity

For the high-dimensional synaesthesia model, the 2016 synaesthesia paper says cross-talk connections were initially set to **near-zero**. The abstract also describes initial cross-talk interactions as zero. The companion criticality paper reports an initial recurrent matrix set exactly to zero for its single-hypercolumn simulation.

The current high-dimensional constructor defaults the full recurrent matrix to exactly zero, with optional nonzero jitter. Exact zero is therefore defensible as a reference baseline but must not be silently treated as the unique initialization used for every synaesthesia figure. Near-zero seeded perturbations must be tested because symmetry breaking is part of the reported high-plasticity behavior.

### 3. Numerical integration step — unpublished

The paper specifies continuous first-order rate dynamics and `tau = 1`, but does not provide a precise numerical integrator/time-step in the main text. The project currently uses Euler integration with `integrationStep = 0.5`. This is an explicit reconstruction choice, not a published parameter.

Consequence: the authors' reported `~1,000–4,000` early and `~35,000–45,000` near-critical settling **iterations cannot be compared one-for-one with our iteration counts** until the original time-discretization/stability convention is known or sensitivity to integration step is quantified.

### 4. Equilibrium tolerance / stability window — unpublished

The authors state that convergence required every neuron's activity difference between current and previous time step to be below a predefined small number, but do not report that number in the main paper. The project's `1e-9` tolerance and two consecutive stable iterations are therefore reconstruction choices.

Performance/critical-slowing benchmarks must report the tolerance and cannot claim exact reproduction of the authors' iteration counts solely from matching a count range.

### 5. Radius distribution — supported

The companion paper explicitly states that stimulus magnitude is Gaussian around a characteristic mean with standard deviation `0.1` times the mean. The project default `radiusSdFraction = 0.1` is therefore supported.

### 6. Preferred-angle discretization — mathematically equivalent convention

The authors use equally spaced preferred angles over the full circle. The companion paper writes `phi_i = 2 pi i / M`; the project uses zero-based `i 2 pi / M`. These generate the same circular set up to indexing/rotation and avoid a duplicated endpoint.

### 7. Self-coupling — supported for simple model, preserve as explicit constraint

The S1 Appendix explicitly assumes no self-coupling and sets the diagonal of `K` to zero for the simple model. The project enforces zero diagonal during training. Before declaring this paper-exact for every high-dimensional experiment, the source chain to the general learning implementation should remain documented, but the no-self-coupling convention is directly supported by the analytical model.

## Scientific-intent constraints for optimization

The following may be used only when numerically validated as equivalent:

- linear solves/factorizations instead of explicitly materializing inverses;
- vectorized/BLAS/GPU matrix operations;
- parallel evaluation of independent input samples;
- reuse of invariant/intermediate quantities when mathematically valid.

The following create a modified model and must not be mixed into the paper-exact benchmark:

- sparse recurrent connectivity replacing dense connectivity;
- low-rank approximation of `K`, `phi`, susceptibility, or gradients;
- altered learning objective or learning rule;
- changed activation function;
- changed fixed-point dynamics;
- gradient clipping or weight clipping;
- reduced neuron count presented as a paper-sized result;
- altered stimulus statistics;
- regularization not present in the publications.

Reduced precision is permitted only after error bounds are measured against the Float64/reference result and must be labeled as a numerical implementation variant.

## Gate before scalability claims

Before previous benchmark/scaling work is treated as evidence about the authors' model:

1. Add a paper-exact (unnormalized) population vector and keep project normalization separate.
2. Benchmark exact-zero and seeded near-zero initialization as separate documented conditions.
3. Run convergence sensitivity across integration step and stability tolerance; report physical/model time as well as numerical iteration count.
4. Verify Figure 7 parameter transcription directly against the published figure/source.
5. Validate optimized objective and gradient against an independent reference and finite differences.
6. Reproduce at least one published qualitative regime: no-synaesthesia and synaesthesia, including directionality/cross-talk behavior.
7. Only then benchmark modern-compute speedups.

The fidelity audit is intentionally stricter than the visualization reconstruction. A project feature can remain useful while being labeled a project extension; it must not be attributed to the authors unless supported by the publication.