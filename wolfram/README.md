# Neural Engine Mathematica + OpenAI integration

This directory is an additive integration layer. It does **not** replace or modify the scientific model in `mathematica/`.

Permanent rule:

> Mathematica computes; GPT reasons over the computation.

`mathematica/SynesthesiaModel.wl` remains the numerical/symbolic authority. The files here validate compact experiment records, expose a bounded calculation allowlist, call the OpenAI Responses API, account for token cost, and keep GPT interpretations distinct from measured or derived results.

## Files

- `NeuralEngineSchemas.wl` — versioned scientific-result, GPT-analysis, and tool-request contracts.
- `NeuralEngineTools.wl` — approved calculation allowlist; no arbitrary Wolfram evaluation.
- `NeuralEngineVerification.wl` — compact Mathematica-side experiment result builders.
- `NeuralEngineOpenAI.wl` — credential resolution, Responses API transport, structured output, model routing, logging, budget enforcement, and bounded tool orchestration.
- `tests/OpenAIIntegration.wlt` — non-network contract/security tests plus opt-in live checks.

## Credential setup

Preferred:

```wl
SystemCredential["OPENAI_API_KEY"] = "<set locally>"
```

Fallback:

```text
OPENAI_API_KEY=<set externally>
```

Never put the actual key in a notebook, repository file, report, history snapshot, screenshot, or publication.

## Model routing

The project default is:

- routine schema/sanity work → `gpt-5.6-luna`
- moderate scientific reasoning → `gpt-5.6-terra`
- difficult scientific reasoning/publication review → `gpt-5.6-sol`

Pricing metadata is dated inside `NeuralEngineOpenAI.wl`; it is an estimator and must be updated when OpenAI pricing changes.

## Connectivity tiers

The architecture keeps three audit tiers:

1. Wolfram-native LLM functions (`LLMSynthesize`, `LLMFunction`, `LLMConfiguration`, `LLMTool`).
2. `ServiceConnect["OpenAI"]`.
3. Direct HTTPS to `POST /v1/responses`.

The production scientific request wrapper is intentionally pinned to Tier 3 until Tier 1/2 are re-executed successfully in a real local Wolfram kernel. This avoids making a higher-level integration failure a dependency of the Neural Engine.

## Example shape

```wl
Get["wolfram/NeuralEngineVerification.wl"];
Get["wolfram/NeuralEngineOpenAI.wl"];

(* model and input must already be instantiated locally by Mathematica *)
result = NEBuildGradientVerificationResult[
  model, input, "NE-GRADIENT-600-001",
  {{1, 1}, {7, 11}, {53, 89}},
  1.*^-6,
  "Seed" -> 12345,
  "CodeVersion" -> "0.8.0",
  "Commit" -> "<git sha>"
];

analysis = NEAnalyzeExperiment[result, "ReasoningClass" -> "Difficult"];
```

Raw 600-neuron trajectories or full 600×600 gradient tensors are not transmitted. Mathematica sends compact norms, residuals, stability metrics, finite-difference comparisons, anomalies, and only selected representative samples.

## Hard boundaries

- No `ToExpression`, `ReleaseHold`, arbitrary symbol invocation, shell execution, or arbitrary Wolfram code is exposed to GPT.
- Tool sizes, coordinate counts, and time limits are bounded.
- API logging redacts credential fields.
- `.jsonl` API logs are local runtime data and are already excluded by `.gitignore`.
- The tracked cost ledger contains totals, not credentials or raw prompts.
- Default project hard limit is USD 50. A conservative preflight blocks a request that could push the project above the limit.
- A blocked/skipped/live-unverified test is never reported as a pass.
- GPT interpretations never become Mathematica results.

## Current verification state

The package was authored while the available Wolfram MCP transport returned HTTP 404 before kernel execution and the active execution runtime had no local `wolframscript` executable or OpenAI API key. Therefore this revision is an **implemented but live-unverified integration prototype**. It must not be promoted to a verified release until a real Wolfram kernel runs the MUnit suite and at least one authenticated Tier-3 OpenAI request succeeds.
