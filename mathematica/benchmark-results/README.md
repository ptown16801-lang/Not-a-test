# Exact benchmark data

All JSON files in this directory were produced by Wolfram Engine 15.0 on the
machine described in `environment.json`. `scaling-summary.json` is regenerated
by `../AggregateScalingResults.wls`; `scaling-measurements.csv` is the same core
measurements in flat form.

- `dense-*.json` uses the literal unrestricted dense recurrent matrix.
- `factorhistory-142-window10.json` through `factorhistory-9088.json` is the
  common ten-update requested ladder. No factor was truncated.
- `factorhistory-18176.json`, `factorhistory-36352.json`, and
  `factorhistory-72704.json` are progressively shorter exact feasibility probes;
  their update counts are stored in each file and must not be compared as equal
  training trajectories.
- `factorhistory-142-train1000.json` is the sustained Figure 7E-parameter
  trajectory from the declared exact-zero reconstruction condition.
- `dense-142.json` and `factorhistory-142.json` are matching 100-update reference
  runs used to confirm the exact representation handoff.
- `factorhistory-568-train50.json` measures accumulated-rank cost at rank 250.
- `critical-slowing-142.json` is the controlled exact criticality experiment.

Every benchmark file records the integration and convergence policy. The target
paper did not publish those numerical values, so these are reproducible
publication-faithful reconstruction conditions, not recovered author settings.
