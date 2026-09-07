# Benchmark evidence registry

All files were produced with Wolfram Engine 15.0 on the machine described in
`environment.json`. The current scientific cohort uses the v2 point schema,
records the benchmark/model source fingerprints, and is admitted only through
`benchmark-qualification.json`.

## Current qualified cohort

- `factorhistory-142-train1000-v2.json` is the 1,000-update, paper-sized
  declared reconstruction trajectory.
- `factorhistory-284-v2.json` through `factorhistory-9088-v2.json` form the
  common 10-update project-family ladder. Every endpoint retains 50 factor
  columns and uses no compression.
- `factorhistory-18176-v2.json`, `factorhistory-36352-v2.json`, and
  `factorhistory-72704-v2.json` are one- or two-update feasibility probes.
- `critical-slowing-142.json` is a controlled known-fixed-point conditioning
  experiment, not a Figure 7 endpoint.

`AggregateScalingResults.wls` verifies every current file's identity, schema,
source hashes, protocol, step-and-residual convergence, exactness switches, and
finite metrics. It regenerates:

- `benchmark-qualification.json`, the per-file admission record;
- `scaling-summary.json`, the evidence-bounded scientific synthesis; and
- `scaling-measurements.csv`, a flat current-and-historical table.

The evidence classes must not be merged. The current data demonstrate 1,000
updates at 142 outputs, 10 updates through 9,088, and one exact update at
72,704. They do not identify a sustained large-model practical limit.

## Historical provenance

Files without the `-v2` suffix and every `dense-*.json` file predate the final
source-fingerprint/protocol gate. They remain in the repository so earlier
measurements are not erased, but the aggregator labels them historical and
excludes them from current performance claims. In particular,
`factorhistory-142-window10.json`, `factorhistory-568-train50.json`, and the
older 1,000-update file have heterogeneous purposes and cannot be treated as a
single controlled ladder.

“Exact” means algebraically uncompressed binary64 evaluation of the declared
full-`K=0` reconstruction condition. A generic dense near-zero recurrent
initialization is normally full rank and cannot enter factor history without a
dense base or an approximation. Only 142 outputs are specified by the target
publication; every larger circular grid is a declared project model-family
extension.

Every run records its numerical integration and convergence policy. The target
paper does not publish those values, so they are reproducible project choices,
not recovered author settings.
