# Wolfram/OpenAI environment report — integration prototype

Date: 2026-09-07 (America/New_York)

## Scope

This report starts the Mathematica + OpenAI integration defined for the Neural Engine. It does not reopen or rewrite the completed historical Wolfram audit. It adds a new integration revision whose governing rule is:

> Mathematica computes; GPT reasons over the computation.

## Repository state at implementation start

- Repository: `ptown16801-lang/Not-a-test`
- Branch: `main`
- Observed head at initial reconciliation: `a8b7243514309ef2cfcbd74fb54351b53155fa7b`
- Observed head immediately before staging: `d199feec5aade48e805650480950c6c156b4465d`
- Software version: `0.8.0`
- Prior audit revision: `0.8.0-audit.20260908.1`
- New integration revision label: `0.8.0-openai-prototype.1`
- Existing scientific model remains in `mathematica/`; this revision does not modify model equations.

## Fresh runtime checks

| Capability | Fresh result | Classification |
|---|---|---|
| Connected Wolfram Language evaluator | HTTP 404 before kernel evaluation | unresolved transport blocker |
| Local `wolframscript` / WolframKernel | not available in active runtime | unresolved dependency blocker |
| OpenAI API key in active runtime | absent | secure configuration required |
| Wolfram-native LLM execution | not executed | skipped/blocked, not a pass |
| `ServiceConnect["OpenAI"]` execution | not executed | skipped/blocked, not a pass |
| Direct OpenAI REST from Wolfram | code implemented, not executed | live-unverified |

The connected Wolfram failure occurred before any Wolfram Language computation. It is therefore evidence about the current integration transport, not evidence that the existing mathematical code fails.

## Static/current interface verification

Current Wolfram documentation still documents `LLMSynthesize`, `LLMFunction`, `LLMConfiguration`, `LLMTool`, `ServiceConnect["OpenAI"]`, and `SystemCredential`.

Current OpenAI documentation supports the Responses API, Structured Outputs with JSON Schema, custom function tools, cached-token usage reporting, and the selected GPT-5.6 model family. This validates the architecture, not the live connectivity.

## Implemented in this prototype

- direct `POST /v1/responses` Wolfram client
- credential lookup using `SystemCredential["OPENAI_API_KEY"]`, then `OPENAI_API_KEY`
- strict compact experiment and GPT-analysis contracts
- GPT model routing (Luna → Terra → Sol)
- dated token-price metadata and cost estimation
- JSONL interaction logging with credential redaction
- tracked cumulative cost ledger
- soft/experiment/hard cost thresholds (USD 10 / 25 / 50 defaults)
- conservative request-cost preflight before the USD 50 hard limit
- approved Mathematica tool allowlist with size/timeout bounds
- no arbitrary Wolfram evaluation surface
- analytic vs selected central finite-difference gradient comparison
- fixed-point, stability, and compact population-statistics tools
- bounded orchestration (maximum five iterations, maximum three follow-up tools)
- explicit stop before claiming a final synthesis when the function-call feedback leg has not yet been live verified

## Scientific qualification

No new 600-neuron scientific result was generated in this implementation step. The existing 600-neuron report remains historical baseline evidence. `NE-GRADIENT-600-001` must be run in a real Mathematica kernel and then analyzed through an authenticated OpenAI call before this integration can satisfy the acceptance criteria.

## Promotion gate

Do not label this integration verified until all of the following are freshly observed:

1. real Wolfram kernel version and arithmetic/symbolic sanity checks;
2. package/MUnit contract tests;
3. authenticated direct OpenAI REST request from Wolfram;
4. one independently recorded Native LLM or `ServiceConnect["OpenAI"]` result, pass or explicit failure;
5. `NE-GRADIENT-600-001` Mathematica result produced from the preserved 600-neuron protocol;
6. GPT structured analysis over that compact result;
7. one approved follow-up calculation requested, validated, executed, returned, and included in a final synthesis;
8. cost ledger and USD 50 hard-stop behavior tested.

Until then the correct state is: **implemented prototype, live verification blocked**.
