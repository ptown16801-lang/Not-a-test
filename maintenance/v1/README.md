# Append-only project histories and Wolfram recheck — maintenance v1

This is an additive maintenance layer, not a change to the Neural Engine v0.8.0 equations or its release number. The original project logs and reports remain untouched. The historical baseline for this request is `48f5a19f4434010e1e6def3c3086b98218183b1a`.

## Outputs

Every snapshot has a unique directory under `history/snapshots/` containing:

- `SCIENTIFIC_HISTORY.json`: complete reachable source-commit history, file changes, tracked source fingerprints, original project JSON/document evidence, historical Wolfram source-hash checks, fresh execution status, boundaries, and change notes.
- `NONSCIENTIFIC_HISTORY.json`: matching chronological events, plain-language project story, original change log, limitations, and clearly separated future art directions.
- `CHANGE_NOTES.json` and `INTEGRITY.json`: explicit additive changes and SHA-256 checksums.

Earlier snapshots are indexed by hash rather than recursively embedded. The snapshot records all commits reachable from its exact source commit, including merge ancestry. Unavailable private conversations, unreachable/deleted Git objects, and the later commit saving the snapshot are not claimed included. Supplied conversation milestones are explicitly labeled.

The two legacy aggregates are historical evidence, not silently regenerated current-state containers. New snapshots provide the current maintenance record.

## Execution

```sh
python maintenance/v1/test_history.py
python maintenance/v1/history.py --root . --session-evidence maintenance/v1/session-evidence.json
```

A full, clean Git checkout is required. Existing tracked files are read from the pinned source commit. Existing output paths cannot be overwritten. Both JSON documents are validated before writing; all final output files receive integrity checksums.

The GitHub workflow runs on main-branch source changes and can also be started manually. It checks out full history, runs the existing Node suite and the history tests, probes a real Wolfram kernel, saves an additive pair, uploads a source/history archive, and uses a non-force push to save the new snapshot. It does not install licensed software, invent credentials, or change existing source. If main moves concurrently, the non-force push refuses to replace it; the artifact is retained and the failure is visible.

## What Wolfram statuses mean

The connector rechecks in `session-evidence.json` returned HTTP 404 before kernel execution. Historical reports record 31/31 MUnit tests and 28/28 publication checks on September 7, 2026. The generator independently checks the hashes of the exact source files named in those two reports. Matching hashes qualify their provenance but do not turn them into fresh executions.

If `wolframscript` is available, the generator tests an actual kernel computation, then runs the existing MUnit, independent-publication, repeated-validation, and numerical-policy scripts in a disposable source copy. Copied old outputs are removed before each run, so old results cannot masquerade as new ones. Process failure, timeout, missing output, empty counted tests, and missing `allPassed: true` cannot be promoted to success. Each run and output is preserved in the new scientific history. Kernel absence or activation failure remains explicitly blocked.

A normal hosted runner may have no licensed Wolfram kernel. The history workflow's Node/history checks do not certify Wolfram availability; the scientific JSON retains that separate status. It never substitutes another algebra engine.

## Change notes for this revision

Added the preservation policy, paired-history generator, ten machinery tests, session evidence, and maintenance workflow. No network formula, published claim, old result, artwork, or existing aggregate was overwritten. The test count for the new history machinery is distinct from neural-network tests and from Wolfram tests.
