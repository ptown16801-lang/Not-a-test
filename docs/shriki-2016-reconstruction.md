# Shriki–Sadeh–Ward neural synaesthesia reconstruction

This project reconstructs the rate-network model described in Shriki, Sadeh &
Ward (2016), rather than claiming access to the authors' original MATLAB code.
The implementation is dependency-free JavaScript and can run in Node or a web
worker. The bundled server performs the computation and sends baked paths to the
browser.

An availability check in September 2026 found the article, its single analytical
DOCX appendix, and an institutional copy of the published paper, but no released
simulation source. The reconstruction therefore treats reported equations and
parameters as authoritative and labels every remaining numerical choice.

Primary sources:

- [The Emergence of Synaesthesia in a Neuronal Network Model via Changes in Perceptual Sensitivity and Plasticity](https://doi.org/10.1371/journal.pcbi.1004959)
- [S1 Appendix: analytical conditions for the simple model](https://doi.org/10.1371/journal.pcbi.1004959.s001)
- [Optimal Information Representation and Criticality in an Adaptive Sensory Recurrent Neuronal Network](https://doi.org/10.1371/journal.pcbi.1004698)
- [An Information-Maximization Approach to Overcomplete and Recurrent Representations](https://proceedings.neurips.cc/paper/2000/hash/09fb05dd477d4ae6479985ca56c5a12d-Abstract.html)

## What the paper does—and does not—specify

The paper models when cross-modal neural responses can emerge while recurrent
connections optimize input sensitivity. It does **not** specify a system that
turns text, concepts, or neural activity into drawn artwork. Accordingly, this
prototype has two separately testable components:

1. `src/neural-synesthesia.js` reconstructs the published neural equations.
2. `src/neural-shape-bridge.js` is our declared artistic projection from a
   population response to a closed geometric thought DAG.

No visual projection choice is attributed to the paper.

## Reconstructed equations

For input \(x\in\mathbb R^N\), activity \(s\in\mathbb R^M\), feed-forward
weights \(W\), recurrent weights \(K\), and logistic nonlinearity \(g\), the
rate dynamics are

\[
\tau\frac{ds_i}{dt}=-s_i+g\!\left(\sum_j W_{ij}x_j+\sum_k K_{ik}s_k\right),
\qquad g(h)=\frac{1}{1+e^{-h}},\quad \tau=1.
\]

At equilibrium,

\[
s=g(Wx+Ks).
\]

Define \(G_{ij}=g'_i\delta_{ij}\),

\[
\phi=(G^{-1}-K)^{-1},\qquad \chi=\frac{\partial s}{\partial x}=\phi W.
\]

The information objective minimized by the model is

\[
\varepsilon=-\frac12\left\langle\ln\det(\chi^T\chi)\right\rangle_x.
\]

For

\[
\Gamma=(\chi^T\chi)^{-1}\chi^T\phi,
\qquad
a_k=[\chi\Gamma]_{kk}\frac{g''_k}{(g'_k)^3},
\]

the recurrent update is

\[
\Delta K=\eta\left\langle(\chi\Gamma)^T+\phi^T a s^T\right\rangle_x.
\]

The implementation evaluates this equation directly. Self-coupling remains
zero, consistent with the paper's \(M^2-M\) adaptive recurrent parameters.

## High-dimensional architecture

`createTwoModalityPaperNetwork()` defaults to the paper's full configuration:

- four input components: two polar coordinates expressed in Cartesian form for
  each of two modalities;
- 142 output units: 71 equally spaced preferred angles per modality;
- a block-diagonal fixed feed-forward matrix of unit vectors;
- an adaptable 142×142 recurrent matrix containing two intra-modal and two
  cross-modal blocks;
- independent angles sampled uniformly from \([0,2\pi)\);
- radius sampled from a normal distribution whose standard deviation is 0.1
  times its mean.

For a stimulus with angle \(\varphi\) and magnitude \(r\), the direct input to a
unit preferring \(\theta_i\) is exactly

\[
r\cos(\theta_i-\varphi).
\]

`PAPER_FIGURE_7_SCENARIOS` transcribes all five parameter combinations printed
in Figure 7. The full-size model is available for research runs; near the
critical point the paper itself reports 35,000–45,000 settling iterations for a
single input and simulations lasting weeks.

## Explicit reconstruction choices

The publications do not provide every executable detail. These choices are
therefore parameters rather than hidden assumptions:

| Detail | Project default | Status |
|---|---:|---|
| Rate integrator | Euler, `integrationStep = 0.5` | Not reported precisely |
| Equilibrium tolerance | `1e-9`, two consecutive steps | Paper describes a small threshold but gives no value |
| Maximum settling iterations | 50,000 | Operational guard |
| Random seed | User supplied, default 1 | Original seeds not reported |
| Initial recurrent jitter | 0 unless requested | Paper says zero or “near-zero” in different experiments |
| Input-radius standard deviation | 0.1 × mean | Reported |
| Preferred-angle endpoint | 360° excluded to avoid duplicate 0° unit | Necessary implementation choice |
| Numerical pivot floor | `1e-13` | Floating-point guard |
| Logistic-derivative floor | `1e-12` | Prevents division overflow only at numerical saturation |

Training supports two policies. `fixed-best` keeps the learning rate constant and
restores the minimum-objective checkpoint, matching the synaesthesia paper.
`backtrack` halves the learning rate when a proposed update raises the objective,
matching the companion criticality paper.

The compact bundled checkpoint uses seven neurons per modality, 20,000 updates,
and an accelerated learning rate of 0.001 so a contributor can reproduce it in
seconds. It is a visualization checkpoint, not an exact numerical recreation of
a published figure. Its metadata records every setting. Run:

```sh
npm run train:neural-preview
```

For a full paper-sized run, the resumable experiment CLI defaults to 71 neurons
per modality and the deprived/high-plasticity Figure 7 scenario:

```sh
npm run experiment:neural -- --steps=1000 --output=experiment.json
node demo/run-neural-experiment.js --resume=experiment.json --steps=1000 --output=experiment-continued.json
```

It writes the network, sampler state, numerical settings, progress, and paper
scenario into each checkpoint. This makes long runs reproducible without
pretending that unreported original random seeds or tolerances are known.

## Neural response to ground shape

The bridge never uses the submitted concept text. It encodes two polar stimuli
from content-addressed geometry, topology, attributes, provenance depth, and the
authoritative thought sequence. For an inducer-only probe, only one modality is
stimulated; activity in the other is therefore a genuine cross-modal response of
the reconstructed recurrent network.

Each circular population code becomes a radial contour:

\[
\rho_i=\rho_0\left(1+c\frac{s_i-\bar{s}}{
\max_j|s_j-\bar{s}|}\right).
\]

Periodic smoothing and interpolation turn these samples into a continuous path.
The population vector becomes a radial mark, and the strongest learned cross-talk
weights become curved paths between the two modality contours. These are all
implemented as ordinary `morph` and `combine(overlay)` derivations from existing
primitives, so closure, content addressing, and the full provenance DAG remain
intact. The dirt renderer still applies its opaque core, broad blur, soil texture,
turning-radius rules, and density budget.

The gallery uses the neural projection by default. Set
`THOUGHT_VISUALIZER=geometric` to display only an agent's submitted geometry, or
set `THOUGHT_NEURAL_CHECKPOINT` to a separately trained compatible checkpoint.
Authentication, receipts, steganographic IDs, and original thought shape IDs do
not change when display projection changes.

## Validation

The tests cover:

- the logistic function and both derivatives;
- the exact 4→142 architecture and unit-vector feed-forward map;
- deterministic Gaussian/polar sampling;
- fixed-point residuals;
- the published recurrent gradient against central finite differences;
- stable and unstable points from the S1 Appendix phase calculation;
- Figure 7 parameter transcription;
- population-vector angle recovery;
- deterministic serialization and training;
- zero self-coupling;
- distinct, finite, provenance-closed dirt paths from distinct thoughts;
- an end-to-end deployed gallery using the neural projector.

The gradient test currently agrees with finite differences to substantially
better than `2e-7`; on the fixed test fixture it is typically near machine
precision.

Run the tests and four-thought visual sample with:

```sh
npm test
npm run demo:neural
```
