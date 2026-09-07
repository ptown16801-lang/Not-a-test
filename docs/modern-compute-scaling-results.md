# Shriki 2016 fidelity validation and modern-compute scaling results

## Result in one paragraph

The publication-faithful equations passed an independent 24-check Wolfram
Language derivation before any benchmark was run. On this 9-vCPU Work machine,
the literal 142-output model completed 1,000 Figure 7E-parameter learning
updates in 3.98 minutes including fixed-ensemble validation. An exact
factor-history representation then executed the requested ladder through 9,088
neurons and feasibility probes through 72,704 neurons. That large number is an
**early, low-rank training result**, not a claim that a fully learned 72,704 by
72,704 recurrent matrix is practical. The empirical boundary is accumulated
recurrent rank: dense 4,544-neuron analysis already takes 68.1 seconds per
sample, and a fit to measured training costs projects 1,000 noncritical updates
at 9,088 neurons at about 7.1 days. Critical slowing is more severe still.

## Scientific gate completed first

The scientific authorities were the [target PLOS Computational Biology
paper](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1004959)
and its [S1 Appendix](https://doi.org/10.1371/journal.pcbi.1004959.s001), not the
pre-existing JavaScript. `mathematica/verification/PublicationDerivation.wls`
was written from those sources, imports no project implementation, and was run
in Wolfram Engine 15.0.0 for Linux x86-64.

The gate passed 24 symbolic, dimensional, sign, transpose, derivative,
susceptibility, objective, recurrent-gradient, fixed-point, and numerical
checks. Its numerical residuals were:

| Check | Maximum error |
|---|---:|
| Fixed-point equation | 1.11e-16 |
| Susceptibility versus finite differences | 6.16e-11 |
| Recurrent objective gradient versus finite differences | 3.18e-10 |
| Relative recurrent-gradient error | 1.73e-9 |

For the published definitions

\[
  s=g(Wx+Ks),\qquad
  \phi=(G^{-1}-K)^{-1},\qquad
  \chi=\phi W,
\]

and

\[
  \epsilon=-\tfrac12\left\langle\log\det(\chi^T\chi)\right\rangle,
\]

the independently obtained descent update is

\[
  -\frac{\partial\epsilon}{\partial K}
  =(\chi\Gamma)^T+\phi^T a s^T,
  \quad
  \Gamma=(\chi^T\chi)^{-1}\chi^T\phi,
  \quad
  a_k=(\chi\Gamma)_{kk}\frac{g_k''}{(g_k')^3}.
\]

The derivation uses the implicit differential
`ds = phi dK s`; it was not transcribed from JavaScript. The independently
generated 3 by 3 reference direction subsequently matched the JavaScript
implementation to below 5e-16. S1 Appendix Eq. 95 contains a branch sign that
is inconsistent with direct differentiation and with its own final Eq. 97;
Eq. 97 agrees with the independent derivation.

## Fidelity corrections and authority boundary

The audit found and corrected these genuine project fidelity defects:

- The paper defines each circular population vector as an unnormalized sum.
  JavaScript and Wolfram now default to the sum. Mean normalization remains an
  explicit visualization-only option, and the shape bridge requests it by
  name.
- The general high-dimensional equation includes all `K_ij`; diagonal learning
  is now retained by default. The zero-diagonal constraint remains explicit for
  the S1 two-unit model and optional project experiments.
- A positive activation-derivative floor is no longer silently applied; zero is
  the reference default and any safeguard is opt-in.
- “Best checkpoint” selection now evaluates every candidate on the same fixed
  input ensemble. Comparing objectives from changing random samples is retained
  only as a labeled legacy visualization behavior.
- Exact factor history now hands off to a literal dense matrix at full factor
  rank, without dropping or truncating factors.

Several choices cannot be called paper-exact because the authors did not report
them: the integrator and time step, equilibrium tolerance and stability window,
numeric `tau`, near-zero initialization scale/distribution, the target paper's
radius standard-deviation coefficient, high-dimensional self-coupling policy,
random seeds, training length, or checkpoint ensemble/cadence. The benchmark
therefore labels its reproducible condition explicitly: exact-zero recurrent
initialization, logistic activation, radius SD equal to 0.1 of the mean (from
the related companion model), synchronous Euler step 0.5 in `t/tau`, tolerance
1e-9 for two consecutive iterations, no diagonal removal, derivative floor,
clipping, sparsification, finite-rank truncation, or altered learning rule.

The separate numerical-policy sweep covered exact zero, all-recurrent and
cross-talk-only near-zero initializations at scales 1e-8 through 1e-4, Euler
steps 1, 0.5, and 0.25, and tolerances 1e-6 through 1e-12. All ten one-step
initialization cases decreased the objective. Depending only on the unreported
integration policy, settling took 3 to 90 iterations; the maximum state error
against a tight Anderson root was 2.15e-6.

## Hardware and exact benchmark protocol

Measurements used Wolfram Engine 15.0.0 on 9 logical AMD EPYC 9V74 cores with
16.79 GB RAM, no swap, and no exposed NVIDIA or AMD GPU. Full raw timing arrays,
memory readings, seeds, inputs, policies, and exactness flags are in
`mathematica/benchmark-results/`.

For the requested scaling ladder, every size ran the same deterministic
10-update early-training window and four fixed validation samples. The recurrent
update adds at most five outer products per input (four susceptibility columns
plus one state term). `FactorHistory` stores those outer products without
truncation and uses the exact Woodbury identity. It is an equivalent
factorization of the unrestricted model, not a low-rank approximation.

| Output neurons | Settle (s) | Objective incl. settle (s) | Gradient incl. settle/objective (s) | 10 updates (s) | Updates + validation (s) | Final exact rank | Peak kernel MB |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 142 | 0.0108 | 0.0128 | 0.0194 | 1.31 | 1.70 | 50 | 69.5 |
| 284 | 0.0210 | 0.0260 | 0.0376 | 2.02 | 2.72 | 50 | 69.5 |
| 568 | 0.0465 | 0.0507 | 0.0883 | 3.89 | 5.20 | 50 | 69.5 |
| 1,136 | 0.0811 | 0.0974 | 0.1466 | 6.85 | 9.27 | 50 | 69.5 |
| 2,272 | 0.1577 | 0.1980 | 0.2791 | 13.12 | 17.70 | 50 | 71.9 |
| 4,544 | 0.3205 | 0.4285 | 0.4799 | 24.56 | 33.59 | 50 | 86.4 |
| 9,088 | 0.9347 | 1.0418 | 1.1491 | 52.11 | 73.48 | 50 | 115.4 |

Across 142 through 9,088 neurons, log-log fitted exponents were 1.04 for the
rank-zero objective, 0.95 for the rank-zero gradient, 0.93 for the ten-update
training rate from 568 through 9,088, and 0.99 for final rank-50 model storage.
Thus the exact early-training path was approximately linear in neuron count.

Feasibility probes went farther:

| Output neurons | Exact updates | Gradient evaluation (s) | Updates + validation (s) | Final rank | Peak kernel MB |
|---:|---:|---:|---:|---:|---:|
| 18,176 | 2 | 2.28 | 23.23 | 10 | 92.2 |
| 36,352 | 1 | 4.67 | 20.91 | 5 | 105.0 |
| 72,704 | 1 | 9.02 | 38.67 | 5 | 153.2 |

These rows establish the largest exact model actually executed. They do not
hide the training-horizon problem: with generic updates, exact factor count
grows as `5t` and the implementation materializes the unrestricted dense `K`
at `ceil(M/5)` samples.

## Literal dense measurements

The dense reference stores and applies the full unrestricted recurrent matrix.
No structure, sparsity, or approximation is assumed.

| Output neurons | Dense settle (s) | Dense gradient evaluation (s) | Model MB | Peak kernel MB |
|---:|---:|---:|---:|---:|
| 142 | 0.0816 | 0.100 | 0.19 | 69.5 |
| 284 | 0.224 | 0.291 | 0.70 | 69.5 |
| 568 | 1.042 | 1.000 | 2.68 | 89.7 |
| 1,136 | 3.554 | 3.595 | 10.52 | 183.1 |
| 2,272 | 14.03 | 13.91 | 41.68 | 266.4 |
| 4,544 | 58.87 | 68.06 | 165.95 | 887.8 |

Over 284 through 4,544, the measured exponents were 1.98 for settling, 1.95 for
the gradient evaluation, and 1.97 for stored model bytes. The general dense
linear solve remains cubic asymptotically; at these initial-state sizes the 30
dense recurrent matrix-vector iterations and allocation costs dominate enough
to produce the observed near-quadratic slope.

## Exact 142-neuron sustained training

The 142-output Figure 7E parameter condition (`r={0.2,2}`, `eta=1.5e-4`) ran
for 1,000 updates from exact zero. Training itself took 237.5 seconds; including
16 fixed validation samples before and after took 239.0 seconds (3.98 minutes),
or 0.2375 seconds per update. Mean and maximum equilibrium counts both remained
30 under the declared policy. The fixed validation objective improved from
-0.795891 to -0.814696, and no clipping, approximation, or discarded update was
used.

The paper says its simulations could take “up to a couple of weeks on a
standard PC station,” but gives no hardware, learning-update count, integrator,
or tolerance. Fourteen days divided by this measured 239-second trajectory is
about **5,061 times**, but this is only an experience-relative wall-clock ratio,
not a controlled speedup claim. The workloads cannot be normalized from the
published information.

## Critical slowing measured directly

To isolate mathematical critical slowing, the benchmark used

\[
  K=4\rho(I-\mathbf{1}\mathbf{1}^T/M),\quad x=0,\quad
  s^*=\tfrac12\mathbf{1}.
\]

For logistic `g'(0)=1/4`, the fixed-point Jacobian has spectral radius exactly
`rho` on the subspace orthogonal to the all-ones vector. The diagonal-plus-rank-
one representation is algebraically exact.

| rho | Distance to criticality | Equilibrium iterations | Settle (s) | Objective + gradient incl. settle (s) | Gradient Frobenius norm |
|---:|---:|---:|---:|---:|---:|
| 0.9 | 1e-1 | 258 | 0.099 | 0.109 | 5.00 |
| 0.99 | 1e-2 | 2,160 | 0.923 | 0.985 | 50.0 |
| 0.999 | 1e-3 | 16,908 | 7.16 | 8.26 | 500 |
| 0.9995 | 5e-4 | 30,823 | 16.39 | 14.65 | 1,001 |
| 0.9999 | 1e-4 | 115,820 | 52.63 | 51.33 | 7,979 |

The authors reported about 1,000–4,000 iterations early and 35,000–45,000 near
the optimum in simulations that developed synaesthesia. The controlled
`rho=0.9995` point reaches the same order (30,823 iterations). At its measured
rate, 1,000 independent objective/gradient evaluations take about 4.1 hours;
at `rho=0.9999`, about 14.3 hours. Those are controlled criticality projections,
not reconstructed Figure 7 endpoints, because the publication's numerical
stopping policy and endpoint matrices are unavailable.

## Practical scaling limit on this machine

There are two answers, depending on what “run” means:

1. **Exact inference and the first learning updates:** at least **72,704 output
   neurons** were actually executed, with one exact rank-five update and no
   approximation. At this horizon, computation and storage are still roughly
   linear in `M`.
2. **Sustained generic learning of an unrestricted recurrent matrix:** about
   **1,136 neurons is hour-scale**, **2,272 is half-day-scale**, **4,544 is
   roughly two-day-scale**, and **9,088 is week-scale** for 1,000 noncritical
   updates on this worker. These are log-log projections from measured dense
   per-update costs: 12.2, 45.7, and 171.5 hours for 2,272, 4,544, and 9,088,
   respectively. They exclude validation and critical slowing, so they are
   optimistic.

The evidence-based practical limit for a repeatable, sustained exact experiment
on this 9-vCPU/16.8-GB session is therefore approximately **1,136–2,272
neurons**. A 4,544-neuron exact run is feasible but no longer interactive; a
9,088-neuron long run is a multi-day job even before criticality. At 18,176,
projected dense temporaries approach the machine's no-swap memory ceiling and
1,000 noncritical steps project to about 27 days.

This answers the research question: modern exact factorized algebra removes
the 2016 machine bottleneck for early training and makes the original 142-unit
model minute-scale, but it does not change the scientific model's generic
`M^2` recurrent degrees of freedom, dense-solve asymptotics, five-rank-per-sample
history growth, or divergence of equilibrium time near criticality. Those
mathematical effects—not 2016-era hardware—become dominant well before a fully
trained 9,088-neuron model.

## Reproduction

The key commands are:

```bash
wolframscript -file mathematica/verification/PublicationDerivation.wls
wolframscript -file mathematica/verification/NumericalPolicySensitivity.wls
wolframscript -file mathematica/ExactBenchmarkPoint.wls --total=142 --backend=Dense --repeats=7 --training-steps=100 --validation-samples=8 --output=mathematica/benchmark-results/dense-142.json
wolframscript -file mathematica/ExactBenchmarkPoint.wls --total=9088 --backend=FactorHistory --repeats=3 --training-steps=10 --validation-samples=4 --output=mathematica/benchmark-results/factorhistory-9088.json
wolframscript -file mathematica/CriticalSlowingBenchmark.wls
wolframscript -file mathematica/AggregateScalingResults.wls
npm test
```

`scaling-summary.json` is the machine-readable synthesis and
`scaling-measurements.csv` is the flat measurement table. Every raw benchmark
JSON remains committed so medians can be checked against its individual timing
samples.
