# Figure 7 publication audit

Authority: Shriki, Sadeh & Ward (2016), DOI
`10.1371/journal.pcbi.1004959`, especially Figures 5–7 and Materials and
Methods, plus the paper's S1 Appendix. The source files used for transcription
are identified by hashes in `mathematica/verification/source-manifest.json`.

This ledger distinguishes a printed value from an executable choice. A blank in
the paper is not filled by the previous JavaScript implementation.

## Values printed in Figure 7

| Panel | Paper condition | r1 | r2 | eta | Reported result |
|---|---|---:|---:|---:|---|
| 7A | balanced, low plasticity | 0.2 | 0.2 | 0.00006 | no synaesthesia |
| 7B | deprived modality 1, low plasticity | 0.2 | 2 | 0.0001 | no synaesthesia |
| 7C | balanced high input | 2 | 2 | 0.00015 | no synaesthesia |
| 7D | balanced, higher plasticity | 0.2 | 0.2 | 0.0001 | bidirectional synaesthesia |
| 7E | deprived modality 1, high plasticity | 0.2 | 2 | 0.00015 | modality 2 induces modality 1 |

All 15 numeric values above were read directly from the published Figure 7.
The outcome descriptions were checked against the figure caption and the text
immediately before and after the figure. They match both
`PAPER_FIGURE_7_SCENARIOS` and `$PaperFigure7Scenarios`.

## Architecture and stimulus assumptions

| Item | Publication evidence | Reference implementation |
|---|---|---|
| Input dimension | Four input neurons: a two-dimensional polar stimulus for each modality | 4 |
| Output dimension | 71 output neurons per modality in the numerical simulations | 142 total |
| Feed-forward blocks | Fixed unit vectors at equally spaced preferred angles spanning the circle; no cross-modal feed-forward weights | Two block-diagonal 71-by-2 circular codes |
| Direct drive | `r cos(theta_i - phi)` | Exact dot product with the unit vectors |
| Input angle | Uniformly distributed | Uniform on an endpoint-exclusive circle |
| Input magnitude | Normal about its characteristic mean; SD proportional to that mean | Family and relationship are exact; coefficient is an exposed choice |
| Between-modality statistics | Inputs are uncorrelated | Independent random draws |
| Recurrent matrix | M-by-M K; recurrent connections among all output neurons, within and between modalities | Dense unrestricted K in the reference path |
| Plasticity | One learning rate for all recurrent interactions | One scalar eta |
| Nonlinearity | General Methods gives an unspecified monotone squashing function; S1 explicitly chooses logistic for the concrete simple-model analysis | Logistic, labeled as supported by S1 rather than a separately printed Figure 7 parameter |
| Time | Paper gives a characteristic time scale tau | Code measures time in units of tau; no claimed numeric tau |
| Checkpoint policy | Fixed learning rate; retain the interaction pattern with minimum objective if the objective rises substantially | `fixed-best` |
| Population vector | Target paper refers to the companion Methods; that definition sums the activity-weighted complex preferred directions | Unnormalized sum by default |

## Details the publication does not determine

These cannot be called “Figure 7 parameters” without additional author data:

- numeric integration method and step;
- numeric equilibrium threshold, required consecutive stable steps, and maximum
  iteration guard;
- number of learning updates, sampling/batch policy, checkpoint cadence, and
  random seed;
- the proportionality coefficient for radius standard deviation in this target
  paper (the project's value 0.1 comes from the related single-hypercolumn
  publication);
- the scale and distribution meant by “near-zero” cross-talk;
- the initial within-modality recurrent matrix;
- whether the high-dimensional diagonal Kii was constrained (only the simple
  two-neuron S1 model explicitly prohibits self-coupling);
- whether the equally spaced angular grid includes a duplicated 0/360-degree
  endpoint;
- probe sampling density and most probe magnitudes used to draw Figure 7;
- machine-precision guards such as derivative floors or pivot cutoffs.

## Executable conditions used here

The publication-faithful reference keeps the general M-by-M gradient, including
its diagonal, and uses the unnormalized population-vector sum. Two initialization
conditions are retained for sensitivity analysis:

1. exact zero, a reproducible symmetry-preserving baseline;
2. seeded uniform near-zero jitter with an explicitly reported scale.

Neither condition is claimed to recover the authors' unreported realization.
Euler step/tolerance combinations are likewise reported as numerical policies,
not paper parameters. The optional mean-normalized population vector and forced
zero diagonal remain available only as clearly labeled project behaviors.
