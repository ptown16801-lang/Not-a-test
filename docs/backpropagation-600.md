# Neural Engine 600-neuron backpropagation test

## Outcome

The 600-output-neuron test passed all ten predefined gates (100/100 weighted
gate points). A conservative reliability score of **95/100** withholds five
points because finite fixtures are not a proof over every recurrent matrix and
because equilibrium tolerances become unsafe very close to criticality.

This score applies when the complete 600-value equilibrium activity and exact
network parameters are available. It does not apply to recovery from a rendered
shape or another lossy projection.

## Tested model

- Four input coordinates and 600 recurrent rate outputs: 300 circularly tuned
  neurons per modality.
- Exact-zero recurrent initialization followed by ten uncompressed Eq. 5
  updates at learning rate `0.00015`.
- Full unrestricted `600 x 600` recurrent matrix (360,000 trainable values),
  including the diagonal.
- Publication equations with no derivative floor, clipping, sparsification, or
  low-rank approximation.
- Synchronous Euler integration with step 1, `1e-12` state and fixed-point
  tolerances, and three stable iterations. These are declared project test
  choices because the publication does not report its numerical policy.

The target paper specifies 142 outputs. The 600-output equal-angle grid is a
project scaling extension, not a reported Figure 7 architecture.

## What “backpropagation” means here

The test covers both relevant operations:

1. The analytical negative gradient of the information objective with respect
   to all 360,000 recurrent weights.
2. Recovery of the original four-dimensional input by backpropagating the raw
   activity residual through the exact fixed-point susceptibility
   `chi = ds/dx`.

Input recovery uses damped Gauss-Newton. Its gradient is
`chi^T (s_candidate - s_target)`. This is a better-conditioned optimizer than a
fixed, hand-tuned gradient-descent step while still exercising the same
backpropagated derivative.

## Measured results

| Check | Result |
|---|---:|
| Finite recurrent-gradient entries | 360,000 / 360,000 |
| Susceptibility entries checked by finite differences | 2,400 per model condition |
| Worst susceptibility relative L2 error | `7.71e-11` |
| Recurrent coordinate finite-difference checks | 16 / 16 passed |
| Worst coordinate relative gradient error | `2.86e-7` |
| Whole-matrix directional checks | 7 / 7 passed |
| Worst scaled directional gradient error | `1.14e-8` |
| Four-sample objective change after gradient step | `-2.19884e-5` |
| Actual/predicted first-order objective-change ratio | `0.9999980` |
| Noiseless input inversions | 6 / 6 passed |
| Worst noiseless absolute input error | `9.59e-13` |
| Output-noise inversions (`+/-1e-4`) | 3 / 3 passed |
| Worst noisy absolute input error | `3.98e-5` |
| Eight-bit raw-activity inversions | 3 / 3 passed |
| Worst eight-bit absolute input error | `6.11e-4` |
| Repeated training/gradient run | bitwise identical |
| Wall time | `155.89 s` |
| Peak resident memory | `404,448 KiB` |

The clean state also admits an independent algebraic inverse. At equilibrium,

```text
logit(s) - K s = W x,
```

so a full-column-rank `W` determines `x` by a four-variable least-squares
solve. The test compares this decoder with iterative backpropagation. This
means backpropagation works, but it is not the most efficient decoder when the
full clean state and exact network are already known.

## Criticality boundary

For the controlled matrix `K = 4 rho (I - 11^T/M)`, the analytical gradient at
the exactly known fixed point remained accurate through `rho=0.9999` (relative
Frobenius error `1.00e-10`). The ordinary tolerance-settled path did not:

| rho | Settling iterations | Fixed-point residual | Gradient relative error |
|---:|---:|---:|---:|
| 0.99 | 2,298 | `9.88e-10` | `5.54e-5` |
| 0.999 | 18,294 | `9.99e-10` | `5.73e-3` |
| 0.9999 | 129,683 | `1.00e-9` | `0.6218` |

This reproduces at 600 neurons the prior 142-neuron warning: a small residual
does not guarantee a correct gradient near a nearly singular fixed-point
operator. Near criticality, the engine needs condition-aware state-error bounds,
tighter or higher-precision settling, and a direct gradient-accuracy gate.

## Reproduce

```sh
npm run test:backprop-600
```

The complete parameters, every individual trial, timings, source fingerprints,
score rubric, and limitations are stored in
`verification/results/backpropagation-600.json`.
