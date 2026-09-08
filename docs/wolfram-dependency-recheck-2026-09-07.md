# Wolfram dependency recheck and strict verification gate

Checked on 7 September 2026 (America/New_York); runtime report timestamp:
2026-09-08T01:47:14.210Z. Baseline: `557ce0553224a8299abecd98cf71be142ad90b35`.

## Outcome: blocked, not mathematically revalidated

The managed Wolfram app was reported installed and enabled. Actual calls to
`WolframContext`, `WolframLanguageEvaluator` (arithmetic and a symbolic derivative),
and `WolframAlpha` each returned `invalid_mcp_response`, HTTP 404, with the message
`MCP SSE probe returned 404 from wolfram.com`. No calculation result was returned.

No `wolframscript`, `WolframKernel`, `math`, or `Mathematica` executable was found
on this worker's PATH. The real local verification command returned
`executable-not-found` (`ENOENT`) and exit code 2. A direct HTTP initialization
attempt could not resolve the endpoint in this execution environment; it did
not reach the server. These are observations about this session, not evidence
that Wolfram is globally unavailable or that the user's license is invalid.

[Wolfram's current connection documentation](https://www.wolfram.com/artificial-intelligence/mcp/cloud/wolfram-mcp-cloud/)
specifies Streamable HTTP as recommended and SSE as deprecated. The observed
SSE-probe error is a diagnostic clue, not proof of the root cause. The exposed
app-management tools do not provide a transport-setting action. No app was
uninstalled, account disconnected, license bypassed, or user credential requested.

## Existing evidence must not be confused with this retry

The baseline already contains genuine-kernel reports from a different worker:
Wolfram Engine 15.0.0; 28 publication-equation checks; 31 MUnit tests; and nine
repeated random fixtures. These are **historical committed evidence**, not tests
rerun in this session. See `scientific-audit-report.md` and
`../mathematica/benchmark-results/environment.json`.

The baseline's optional Node tests skip two live Wolfram gates when their
runtime probe fails. That behavior is useful for ordinary JavaScript development,
but a successful `npm test` alone must not be called fresh Wolfram validation.

## Integrated strict command

```sh
npm run verify:wolfram
# Optional new report; refuses to overwrite an existing evidence file:
npm run verify:wolfram -- --output /path/to/new-report.json
```

`scripts/verify-wolfram.js` first requests a fresh local-kernel computation with
a per-invocation nonce, arithmetic, a symbolic logistic derivative, a linear
solve, and kernel version/system information. A wrapper version banner, stale
reply, malformed reply, process failure, or accidentally selected interpreter
with a non-Wolfram banner does not count as availability. This is a readiness
check, not cryptographic attestation of the configured executable.

After that succeeds, the command runs the existing
`test/mathematica-rewrite.test.js` suite and requires both explicitly named live
gates (MUnit and the independent publication derivation), a complete passing TAP
summary, and zero skips, cancellations, failures, or TODOs. The existing gates
write and read fresh temporary result files. This command does not rerun every
benchmark, repeated-validation experiment, or long training scenario.

`WOLFRAM_KERNEL_EXECUTABLE` and `WOLFRAM_LD_PRELOAD` remain supported. Unknown
process errors are not relabeled as licensing failures. No JavaScript, Mathics,
or cached-report computation is substituted for a failed live gate.

Exit codes: **0** verified; **2** blocked at the kernel probe; **1** downstream
failure or command/output error. `npm test` remains optional-runtime developer
testing; fresh Wolfram-backed claims require this strict command's `verified: true`.

## Testing performed in this session

20 new Node gate tests passed, zero failed or skipped. Their success fixtures
are explicitly synthetic and test orchestration only; one test also runs the
real CLI against a nonexistent executable. The actual local dependency probe
was separately run and correctly reported blocked. The full project suite and
the successful live-Wolfram path were not rerun in this environment.

No neural equations, numerical defaults, prior scientific outputs, benchmarks,
or release version were changed by this work. This change does not regenerate
`MASTER_PROJECT.json` or `PROJECT_LOG.json`; their own provenance defines their
snapshot scope. A concurrent addition of `test:backprop-600` to `package.json`
was preserved when merging the new command.

## Unresolved assumptions and scientific limits

Unavailable computation and missing author protocol are different issues.
The project's publication ledger still identifies unreported seeds, training
endpoints, integration policy, near-zero initialization distribution, and
input-radius conventions. A working kernel can test declared alternatives but
cannot determine which unreported choices the authors used.

The documented near-critical gradient-accuracy problem also remains open:
a small fixed-point residual alone does not certify a small state or gradient
error. No new condition-aware solver or 600-neuron reliability result was
validated by this retry. See `scientific-audit-report.md` sections 4.2 and 6.5.
