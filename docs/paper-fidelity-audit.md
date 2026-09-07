# Shriki model paper-fidelity audit

Status: **publication-first mathematical gate, corrected reference
implementation, and complete test-suite gate passed on 2026-09-07 before the
exact-model benchmark was started**.

Primary authority:

- Shriki, Sadeh & Ward (2016), *The Emergence of Synaesthesia in a Neuronal Network Model via Changes in Perceptual Sensitivity and Plasticity*, PLOS Computational Biology 12(7): e1004959, DOI 10.1371/journal.pcbi.1004959.
- Shriki & Yellin (2016), *Optimal Information Representation and Criticality in an Adaptive Sensory Recurrent Neuronal Network*, PLOS Computational Biology 12(2): e1004698, DOI 10.1371/journal.pcbi.1004698.
- S1 Appendix to Shriki, Sadeh & Ward (2016).
- Shriki, Sompolinsky & Lee (2001), *An Information-Maximization Approach to Overcomplete and Recurrent Representations*.

## Verified mathematical core

The current implementation's central equations match the published model at the notation/matrix level:

- rate dynamics: `tau ds/dt = -s + g(Wx + Ks)`;
- steady state: `s = g(Wx + Ks)`;
- logistic nonlinearity explicitly chosen in the S1 simple-model analysis;
- time expressed in units of the paper's characteristic scale `tau` (the paper
  does not report a numeric value of `tau`);
- `G_ij = g'_i delta_ij`;
- `phi = (G^-1 - K)^-1`;
- `chi = phi W`;
- objective `epsilon = -1/2 < ln det(chi^T chi) >_x`;
- `Gamma = (chi^T chi)^-1 chi^T phi`;
- `a_k = [chi Gamma]_kk g''_k/(g'_k)^3`;
- recurrent update `Delta K = -eta d epsilon/dK = eta <(chi Gamma)^T + phi^T a s^T>`.

`mathematica/verification/PublicationDerivation.wls` was written from the paper
and S1 Appendix before either project implementation was inspected and imports
no project code. Wolfram Engine 15.0 verifies 24 symbolic and numerical checks.
The analytical update direction agrees with the negative central-difference
objective gradient to `3.18385e-10` maximum absolute error and `1.73101e-9`
relative error on a nonsymmetric 3-by-3 fixture. The JavaScript state,
susceptibility, objective, and full 3-by-3 direction then agree with that
independent fixture to below `1e-12`.

The independent derivation also found an internal appendix inconsistency: the
branch sign printed in Eq. 95 does not give the directly derived real-eigenvalue
stability limit, while the final Eq. 97 does. The implementation follows the
derivation and Eq. 97.

## Confirmed implementation deviations / unresolved publication details

### 1. Population-vector normalization — confirmed deviation

The papers define the population vector by **summing** the complex numbers associated with the neurons. The implementation at the resumed commit divided the real and imaginary sums by population size. This normalization preserves population-vector angle and preserves whether the magnitude is zero or finite, but it changes the magnitude and therefore was not paper-exact.

Resolved: the reference default is now the unnormalized sum. `normalization:
'mean'` in JavaScript and `"Normalization" -> "Mean"` in Wolfram Language retain
the old scale-normalized project visualization explicitly. The shape bridge
requests this optional mode and records it.

### 2. Recurrent initialization — fidelity-sensitive ambiguity

For the high-dimensional synaesthesia model, the 2016 synaesthesia paper says cross-talk connections were initially set to **near-zero**. The abstract also describes initial cross-talk interactions as zero. The companion criticality paper reports an initial recurrent matrix set exactly to zero for its single-hypercolumn simulation.

The high-dimensional constructor retains exact zero as a labeled reconstruction
condition and seeded uniform jitter as a second labeled condition. Exact zero is
not described as the authors' unique initialization. The publication does not
report the near-zero scale or distribution, nor does it state the initial
within-modality matrix precisely.

### 3. Numerical integration step — unpublished

The paper specifies continuous first-order rate dynamics with a characteristic
time scale `tau`, but neither a numeric value nor a precise numerical
integrator/time-step. The project measures time in units of `tau` and defaults
to Euler integration with `integrationStep = 0.5`. These are explicit
reconstruction choices, not published parameters.

Consequence: the authors' reported `~1,000–4,000` early and `~35,000–45,000` near-critical settling **iterations cannot be compared one-for-one with our iteration counts** until the original time-discretization/stability convention is known or sensitivity to integration step is quantified.

### 4. Equilibrium tolerance / stability window — unpublished

The authors state that convergence required every neuron's activity difference between current and previous time step to be below a predefined small number, but do not report that number in the main paper. The project's `1e-9` tolerance and two consecutive stable iterations are therefore reconstruction choices.

Performance/critical-slowing benchmarks must report the tolerance and cannot claim exact reproduction of the authors' iteration counts solely from matching a count range.

### 5. Radius distribution — family supported, coefficient unresolved

The target paper states that stimulus magnitude is Gaussian around a
characteristic mean and that its standard deviation is proportional to that
mean. It does not give the coefficient. The companion paper reports `0.1` for
its related single-hypercolumn experiment. The project may use `0.1` as a
cross-publication reconstruction choice, but not as a numeric Figure 7 value.

### 6. Preferred-angle discretization — mathematically equivalent convention

The authors use equally spaced preferred angles over the full circle. The companion paper writes `phi_i = 2 pi i / M`; the project uses zero-based `i 2 pi / M`. These generate the same circular set up to indexing/rotation and avoid a duplicated endpoint.

### 7. Self-coupling — simple model explicit, high-dimensional model unresolved

The S1 Appendix explicitly assumes no self-coupling only for its 2-by-2 simple
model. The target paper describes an M-by-M recurrent matrix, sums over all
`k=1..M`, and says that recurrent connections exist among all output neurons;
it does not separately state that Kii is deleted in the 142-unit simulation.
The general publication-faithful path therefore retains diagonal updates.
Forced zero diagonal remains an explicit simple-model/project option.

### 8. Derivative floor — optional numerical safeguard

The published derivative is the actual `g'`; it is not floored. The reference
default is now zero floor. A positive floor remains available but is labeled as
a numerical convenience that alters saturated cases.

### 9. Expected-objective checkpoint — corrected training defect

The resumed implementation selected its “best” recurrent matrix by comparing
single-sample objective values from different random inputs. Those are draws
from the published expected objective, not comparable evaluations of K. The
reference training API now requires one fixed input ensemble whenever
`RestoreBest` is enabled and compares checkpoints only on that ensemble. Its
size and evaluation interval remain reported reconstruction choices. The former
heuristic is retained only as `legacyOnlineCheckpoint` for reproducing the
compact visualization asset.

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

1. **Passed:** publication population-vector sum separated from project mean normalization.
2. **Passed:** exact-zero and seeded near-zero initialization are distinct labeled conditions.
3. **Passed:** exact 142-unit convergence sensitivity covers three time steps,
   three tolerances, an Anderson reference root, and zero/near-zero conditions;
   results are in `mathematica/verification/results/numerical-policy-sensitivity.json`.
4. **Passed:** all Figure 7 printed values and architecture claims audited in `figure-7-publication-audit.md`.
5. **Passed for the reference:** independent symbolic derivation, finite differences, and cross-language fixture comparison.
6. **Not a mathematical-fidelity gate:** exact Figure 7 endpoints cannot be
   uniquely regenerated because the training length, near-zero realization,
   integration policy, and checkpoint cadence are unpublished. A 1,000-update
   Figure 7E-parameter trajectory is reported as a declared reconstruction
   condition, not as the authors' endpoint.
7. **Passed and unlocked:** the corrected JavaScript/Wolfram reference and all
   tests passed before modern-compute measurements began. Results and raw data
   are in `modern-compute-scaling-results.md` and
   `mathematica/benchmark-results/`.

The fidelity audit is intentionally stricter than the visualization reconstruction. A project feature can remain useful while being labeled a project extension; it must not be attributed to the authors unless supported by the publication.
