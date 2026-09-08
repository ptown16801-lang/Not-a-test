# Wolfram dependency recheck — additive audit v1

**Audit date:** September 7, 2026 (America/New_York; runtime probe at September 8, 01:48 UTC).

**Baseline:** `ptown16801-lang/Not-a-test`, release `0.8.0`, commit
`557ce0553224a8299abecd98cf71be142ad90b35`.

**Preservation branch:** `audit/wolfram-recheck-20260907-v1`.
This directory is new. No existing source, report, notebook, package version,
master JSON, or changelog is replaced. No force push or merge is performed.

## Result

**BLOCKED: no fresh Wolfram computation was obtained in this session.**
The installed connector was actually invoked through `WolframContext`,
`WolframLanguageEvaluator`, and `WolframAlpha`. Each returned the same
`invalid_mcp_response`: `MCP SSE probe returned 404 from wolfram.com`, for
`https://agenttools.wolfram.com/mcp`.

The local executable check found no `wolframscript`, `WolframKernel`,
`MathKernel`, or `math` on PATH, and no configured kernel environment variable.
Local DNS also failed for the Wolfram service and installer host, preventing a
direct service retry or runtime download from this execution environment.
These observations do not establish a service-wide Wolfram outage, and they do
not establish whether the user's own installation or license works.

The plugin directory showed the existing Wolfram integration enabled and
installed; no distinct replacement was returned. No plugin was uninstalled,
no permissions were changed, and no license/authentication step was fabricated.

Wolfram's current official documentation identifies Streamable HTTP as the
recommended cloud transport, while the observed error names an SSE probe.
A transport mismatch is a **hypothesis**, not a diagnosed or repaired cause.
The connected actions expose no transport-configuration setter. Cloud MCP is
also documented as stateless and without external-file support; even a working
short cloud evaluation must not be equated with a full local repository run.

Sources checked:
- https://www.wolfram.com/artificial-intelligence/mcp/cloud/wolfram-mcp-cloud/
- https://www.wolfram.com/artificial-intelligence/mcp/
- https://www.wolfram.com/engine/faq/

## What was previously skipped, and what was already verified

At the pinned baseline, `test/mathematica-rewrite.test.js` has two live gates
that explicitly skip when a usable runtime is missing:

| Existing live gate | Expected execution |
|---|---|
| `mathematica/tests/RunTests.wls` | 31 MUnit tests |
| `mathematica/verification/PublicationDerivation.wls` | 28 independent publication checks |

This does **not** mean the project never used Wolfram. The preserved MUnit
report records 31/31 passing on Wolfram Engine 15.0.0 for Linux at
`2026-09-07T12:57:36Z`. The existing scientific audit records 28/28 independent
checks and 9/9 repeated Wolfram fixtures. Those are historical repository
artifacts, not freshly repeated results from this session.

The new runner executes the original two entry points without changing them.
It does not install another mathematical implementation or replace Wolfram
with Python, JavaScript arithmetic, an emulator, or generated expectations.
The full notebook, repeated validation, numerical-policy sensitivity, scaling
benchmarks, full Figure 7 training, and a 600-neuron backpropagation experiment
were not run in this recheck.

## Assumptions: different causes require different evidence

**Runtime-dependent verification.** Fresh MUnit and independent-derivation
runs remain blocked. Historical reports are retained but cannot satisfy a
fresh-execution gate.

**Unreported experimental choices.** The existing publication audit identifies
unreported seeds, training lengths, initialization details, integration and
convergence settings, and other Figure 7 numerical choices. A working kernel
can measure sensitivity to declared choices; it cannot recover the authors'
unreported choices by calculation alone. These remain explicitly declared,
not promoted to publication facts.

**Companion-paper conventions.** Logistic activation and the radius standard
deviation coefficient of 0.1 are labeled conventions in the prior audit, not
newly established target-paper parameters. No status is upgraded here.

**Near-critical reliability.** The prior audit reports a constructed case
where small fixed-point residual coexists with a large gradient error.
That finding is historical, but it is enough to prohibit replacing gradient
accuracy with residual-only confidence. No new reliability score is claimed.

**Scaling approximations.** Exact factor history and finite-rank truncation
remain different evidence classes. No approximation is silently enabled and
no measured short run is promoted to sustained scalability.

## Changes in this audit

`verify-live.mjs` (runner version 1.0.0) adds an opt-in, fail-closed path around
the existing Wolfram tests. It requires a real kernel evaluation, checks both
arithmetic and a linear solve, and captures subprocess logs. It executes only
copies of the inputs in a new external run directory. Existing output
directories, source-contained output paths, and input symlinks are rejected.
It checks fresh timestamps, schemas, exact expected counts, individual
outcomes, source SHA-256 values, kernel identity, and the publication's
existing numerical verification thresholds. Missing access is `blocked`,
not success; a probe alone is `runtime-ready-unverified`, never validation.

`verify-live.test.mjs` tests orchestration with explicitly labeled mock kernel
responses. **20/20 orchestration tests passed, with 0 skipped.** This is evidence
about the runner's control flow and preservation safeguards, not independent
Wolfram evidence. The actual local runtime probe returned `blocked`, exit 2.

`audit.json` preserves the recheck observations, historical-evidence labels,
assumption ledger, machine-readable changes, complete test transcript, and
source/file fingerprints. No original log or master project JSON is regenerated.

## Executing the additive gate with a working local runtime

From a complete checkout, choose a NEW output directory outside that checkout:

```sh
node audits/wolfram-recheck-2026-09-07-v1/verify-live.mjs \
  --repository="$PWD" \
  --output="/tmp/neural-wolfram-fresh-UNIQUE-RUN-ID"
```

The parent directory must already exist; the run directory must not.
`WOLFRAM_KERNEL_EXECUTABLE` and the existing optional `WOLFRAM_LD_PRELOAD`
convention are supported. To name a kernel directly:

```sh
node audits/wolfram-recheck-2026-09-07-v1/verify-live.mjs \
  --repository="$PWD" \
  --output="/tmp/neural-wolfram-fresh-ANOTHER-UNIQUE-ID" \
  --executable="/absolute/path/to/WolframKernel" --direct-kernel
```

Exit status 0 means both live gates passed; 1 means failure; 2 means blocked or
probe-only/unverified. Outputs remain saved even when a gate fails. The runner
records the intended baseline and actual input hashes, but intentionally does
not claim it independently verified the checkout's Git commit. It pins the
31/28 expectations to this audit; future suite changes require a new audit
version rather than weakening checks silently.

Run the separate orchestration tests with:

```sh
node --test audits/wolfram-recheck-2026-09-07-v1/verify-live.test.mjs
```

## Remaining completion gate

Fresh scientific incorporation requires successful actual Wolfram evaluation.
After that, rerun the two live gates, then the already-existing repeated and
sensitivity protocols in isolated output locations before changing scientific
claims or model defaults. No unattended continuation or scheduled job was
created by this audit.
