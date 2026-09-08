# Neural Engine — Mathematica + OpenAI Integration Project Plan

**Status:** Planned work; not yet implemented or scientifically validated.  
**Project:** Shape Cognition Prototype / Neural Engine  
**Repository:** `ptown16801-lang/Not-a-test`  
**Project release line:** v0.8.0 + Unreleased  
**Plan date:** 2026-09-07 (America/New_York)

## 1. Objective

Implement a reproducible integration between the Neural Engine, Wolfram Mathematica/Wolfram Language, and the OpenAI API so that:

1. Mathematica remains the authoritative numerical and symbolic computation layer.
2. OpenAI models analyze compact, structured scientific results instead of replacing numerical calculation.
3. An OpenAI model can request bounded, approved follow-up Mathematica calculations.
4. Calculations, prompts, model responses, tool requests, errors, provenance, token usage, and estimated cost are logged.
5. The system remains usable when higher-level Wolfram/OpenAI connectors fail by retaining a direct HTTPS fallback.
6. API usage is bounded and measurable.
7. Existing Neural Engine evidence, audits, project history, and prior artifacts remain preserved.

The governing principle is:

> **Mathematica computes; GPT reasons over the computation.**

Conceptual architecture:

```text
Neural Engine
     |
     v
Mathematica / Wolfram Language
     |
     |-- numerical simulation
     |-- symbolic differentiation
     |-- backpropagation
     |-- finite-difference verification
     |-- eigenvalue / stability analysis
     |-- fixed-point analysis
     |-- population-state statistics
     |
     v
Structured Scientific Result
     |
     v
OpenAI API
     |
     |-- interpretation
     |-- anomaly detection
     |-- hypothesis generation
     |-- experiment selection
     |-- scientific summarization
     |
     v
Validated Follow-up Request
     |
     v
Mathematica
```

## 2. Scientific goals

Primary scientific uses:

- independent verification of backpropagation;
- recurrent-gradient verification;
- analytic versus finite-difference gradient comparison;
- fixed-point and attractor analysis;
- eigenvalue and spectral-radius analysis;
- numerical stability testing;
- perturbation experiments;
- network-scaling experiments;
- population-to-shape analysis;
- anomalous population-state detection;
- interpretation of emergent representations;
- automatic generation of follow-up hypotheses;
- revisiting assumptions made when Wolfram functionality was unavailable.

Every output must distinguish:

- freshly measured results;
- mathematically derived results;
- historical evidence;
- GPT interpretation;
- hypotheses;
- blocked/skipped verification;
- unresolved questions.

GPT output must never silently become scientific evidence.

## 3. Three-tier OpenAI connection strategy

### Tier 1 — Native Wolfram LLM interface

Where the installed Wolfram version supports it, test native LLM functionality such as:

- `LLMSynthesize`
- `LLMFunction`
- `LLMConfiguration`
- `LLMTool`
- related native LLM interfaces

This is the preferred route when it works reliably.

### Tier 2 — `ServiceConnect["OpenAI"]`

Test Wolfram's service framework as an independent higher-level route.

Validate:

- authentication;
- basic request/response;
- structured inputs and outputs;
- repeated requests;
- model selection;
- error and rate-limit behavior.

### Tier 3 — Direct OpenAI REST API

Implement a direct HTTPS client in Wolfram Language using facilities such as:

- `HTTPRequest`
- `URLRead` / `URLExecute`
- JSON serialization/deserialization

This route must not depend on Wolfram's OpenAI-specific service layer and is the required fallback.

Required capabilities:

- bearer authentication;
- request-body generation;
- model selection;
- response parsing;
- usage extraction;
- retry/timeout handling;
- HTTP/API error reporting;
- rate-limit handling;
- cost logging.

## 4. Credential security

The OpenAI API key must not be committed to:

- notebooks;
- Git history;
- project JSON;
- reports;
- logs;
- screenshots;
- public posts.

Preferred storage:

1. OS/system credential store;
2. environment variable such as `OPENAI_API_KEY`;
3. local ignored secret file only if necessary.

The repository may contain placeholders but never the real credential.

## 5. Core Wolfram integration package

Create a dedicated integration package so OpenAI-specific behavior is isolated from the core Neural Engine.

Suggested path:

```text
mathematica/NeuralEngineOpenAI.wl
```

Suggested public functions:

```text
NEOpenAIConnect[]
NEOpenAIRequest[]
NEAnalyzeExperiment[]
NERequestFollowup[]
NERunToolLoop[]
NEEstimateAPICost[]
NELogAPIInteraction[]
NEValidateResponse[]
```

The Neural Engine must remain runnable without this package.

## 6. Structured scientific data contract

Do not send raw network state indiscriminately. Define a versioned compact experiment schema.

Example:

```json
{
  "schema": "neural-engine-result-schema-v1",
  "experiment_id": "NE-BP-600-001",
  "network": {
    "neurons": 600,
    "architecture": "...",
    "seed": 12345
  },
  "test": "gradient_verification",
  "results": {
    "loss": 0.0132,
    "gradient_norm": 1.842,
    "finite_difference_max_error": 0.0000031,
    "spectral_radius": 0.917,
    "fixed_point_residual": 0.000021
  },
  "anomalies": [],
  "samples": [],
  "provenance": {
    "code_version": "...",
    "commit": "...",
    "timestamp": "..."
  }
}
```

## 7. GPT scientific-analysis contract

The model must be instructed to:

- analyze only supplied evidence;
- distinguish observation from inference;
- identify potential numerical problems;
- identify missing verification;
- propose additional tests;
- quantify confidence when useful;
- never fabricate Mathematica results;
- request exact calculations instead of estimating when Mathematica can compute them;
- return machine-readable output.

Preferred response shape:

```json
{
  "assessment": "...",
  "confidence": 0.94,
  "anomalies": [],
  "scientific_concerns": [],
  "recommended_tests": [],
  "interpretation": "...",
  "requires_followup": true
}
```

## 8. Controlled Mathematica tool layer

Do not expose arbitrary Wolfram evaluation. Expose a small allowlisted tool set with strict schemas, argument bounds, timeouts, and deterministic seeds where applicable.

Initial tool families:

### Gradient tools
- analytic gradient;
- finite-difference gradient;
- gradient comparison;
- relative gradient error.

### Network dynamics
- forward simulation;
- recurrent simulation;
- fixed-point calculation;
- convergence residual.

### Stability
- Jacobian;
- eigenvalues;
- spectral radius;
- perturbation and recovery.

### Statistics
- activation mean/variance;
- sparsity;
- population correlation;
- entropy;
- gradient distribution;
- saturation statistics.

### Scaling
- runtime benchmark;
- memory benchmark;
- scaling-curve estimation.

### Shape-cognition analysis
- population-vector reduction;
- latent/population projection;
- shape-generation statistics;
- representation-consistency testing.

## 9. Bounded agentic verification loop

After basic connectivity is stable, implement an optional bounded loop:

1. Mathematica executes an experiment.
2. Results are summarized into the structured schema.
3. GPT analyzes the result.
4. GPT proposes follow-up tests.
5. Requested tests are validated against the allowlist.
6. Mathematica executes approved tests.
7. Results are returned for interpretation.
8. Stop when the question is resolved, a confidence threshold is reached, the iteration cap is reached, the cost cap is reached, or an error occurs.

Default maximum agent iterations: **5**.

## 10. First scientific target — 600-neuron backpropagation audit

Use the existing 600-output-neuron work as the first end-to-end scientific integration test.

Required tests:

### A. Forward-pass reproducibility
Fixed seed + identical input must produce identical deterministic results where the model configuration is deterministic.

### B. Analytic gradient
Compute the implemented backpropagation/recurrent gradient.

### C. Finite-difference verification
For selected parameters:

```text
dL/dw ≈ [L(w + ε) - L(w - ε)] / (2 ε)
```

Evaluate multiple epsilon values.

### D. Relative error
Use a normalized comparison such as:

```text
||g_analytic - g_numeric||
--------------------------------
||g_analytic|| + ||g_numeric||
```

### E. Recurrent gradient
Verify recurrence-specific gradients separately when applicable.

### F. Perturbation test
Confirm small parameter perturbations change loss consistently with the local gradient.

### G. Stability analysis
Measure Jacobian/eigenvalues/spectral radius, fixed-point convergence, and relevant attractor behavior.

### H. GPT interpretation
Send only compact summaries plus targeted anomalous samples. GPT should identify suspicious gradients, numerical instability, missing tests, or additional calculations worth performing.

## 11. Population-to-shape integration

After the mathematical layer is verified, extend the architecture into Shape Cognition.

Preferred pipeline:

```text
neuron population
      |
      v
Mathematica feature extraction
      |
      v
population representation
      |
      v
shape transformation system
      |
      v
visual output
```

Initially GPT should observe/analyze rather than generate the authoritative shapes.

Potential questions:

- do similar neural states produce similar shapes?
- do distinct states remain distinguishable?
- is temporal evolution preserved visually?
- do stable motifs recur for repeated concepts or states?
- can a separate observer infer source-state classes from visual output alone?

This supports the longer-term visual-observer experiment already contemplated for the project.

## 12. Cost-control system

Every OpenAI API call should log:

- model;
- input tokens;
- cached input tokens where available;
- output tokens;
- estimated call cost;
- experiment ID;
- timestamp.

Maintain cumulative:

- session cost;
- experiment cost;
- daily cost;
- project-lifetime API cost.

Initial development budget:

- target total: **$10–$30**;
- warning threshold: **$10**;
- experiment warning: **$25**;
- hard development cap: **$50** unless explicitly changed.

Exact API prices and model availability are time-sensitive and must be rechecked immediately before implementation or budgeting.

## 13. Model routing

Use an escalation policy instead of the most expensive reasoning model for every request.

### Low-cost routine work
- schema checking;
- anomaly categorization;
- simple summaries.

### Intermediate reasoning
- compare experiment sets;
- identify probable numerical issues;
- choose basic follow-up tests.

### Highest-capability reasoning
- mathematical ambiguity;
- unexpected dynamics;
- architecture decisions;
- publication-grade scientific review;
- disagreement between verification methods.

## 14. Token reduction

Mathematica should summarize large arrays locally rather than transmit every neuron, weight, timestep, or gradient.

Prefer:

- means and standard deviations;
- quantiles and extrema;
- norms;
- correlations;
- histograms;
- anomalous indices;
- representative samples;
- compact spectra;
- convergence/stability statistics.

Transmit raw arrays only when justified.

## 15. Prompt-caching strategy

Keep stable material invariant where possible:

- Neural Engine scientific definition;
- equations;
- experiment protocol;
- schemas;
- tool definitions;
- scientific-assistant rules.

Send only changing experiment results and context per iteration.

## 16. Reproducibility and provenance

Every GPT-assisted experiment should record:

- experiment ID;
- timestamp;
- random seed;
- Mathematica/Wolfram version;
- Neural Engine version;
- Git commit;
- input parameters;
- raw calculated result locations;
- API model identifier;
- prompt/request payload or its content hash where appropriate;
- response;
- follow-up tool calls;
- final scientific conclusion;
- cost/usage metadata.

GPT output is an interpretive research artifact, not the authoritative numerical computation.

## 17. Error inventory

Add/extend a machine-readable Wolfram/OpenAI integration registry.

Suggested fields:

```json
{
  "error_id": "WOLFRAM-OPENAI-001",
  "component": "ServiceConnect",
  "status": "unresolved",
  "symptom": "...",
  "cause": "...",
  "workaround": "...",
  "evidence": "...",
  "first_seen": "...",
  "last_tested": "..."
}
```

Allowed statuses should distinguish at least:

- resolved;
- partially_resolved;
- workaround_available;
- unresolved;
- not_reproducible;
- skipped/blocked.

A skipped or blocked test is not a pass.

## 18. Wolfram audit reconciliation

For each earlier Wolfram limitation or skipped capability:

1. rerun the original test where possible;
2. document current behavior;
3. classify the failure (dependency, authentication, licensing, connector, OS, network, syntax/API mismatch, or unknown);
4. test the OpenAI-in-Mathematica route;
5. test the direct REST fallback;
6. update the error inventory.

Do not replace genuine Wolfram validation with another numerical tool and label it Wolfram validation.

## 19. Test suite

### API
- valid authentication;
- invalid key;
- malformed request;
- timeout;
- rate limit;
- unavailable model;
- malformed response.

### Scientific schema
- valid result;
- missing fields;
- invalid numeric values;
- NaN/infinity;
- oversized data.

### Tool calls
- valid request;
- unauthorized tool;
- invalid arguments;
- oversized arguments;
- timeout.

### Cost accounting
- token accounting;
- cumulative cost;
- hard-cap enforcement.

### Reproducibility
- seeded runs;
- deterministic Wolfram results where expected;
- stored experiment reload.

## 20. Suggested directory additions

```text
mathematica/
    NeuralEngineOpenAI.wl
    NeuralEngineTools.wl
    NeuralEngineSchemas.wl
    NeuralEngineVerification.wl

experiments/
    backprop/
    recurrent/
    stability/
    population_shape/

schemas/
    experiment-result-v1.json
    gpt-analysis-v1.json
    tool-request-v1.json

audit/
    WOLFRAM_OPENAI_ERROR_INVENTORY.json

logs/
    api/
```

These are proposed paths only; implementation should fit the repository's current organization rather than silently moving existing evidence.

## 21. Project-history integration

Continue using the repository's append-only paired history machinery.

### Scientific history must record
- hypotheses;
- methods;
- equations;
- experiments;
- validation;
- failures;
- blocked/skipped tests;
- results;
- uncertainties;
- interpretation changes.

### Non-scientific history must record
- user intent;
- design decisions;
- implementation milestones;
- project direction;
- feature additions;
- architecture decisions;
- practical blockers.

Never silently overwrite prior history.

## 22. Versioning

This planning change does **not** by itself change the Neural Engine release version or equations.

When implementation begins, exact version changes should be based on the live repository state and must document:

- what was added;
- what was verified;
- what changed scientifically;
- what assumptions were removed;
- what remains unresolved.

## 23. Implementation phases

### Phase 1 — Environment audit
Determine Mathematica/Wolfram Engine version, licensing/activation state, project commit/branch, current Wolfram failures, and available LLM functions.

### Phase 2 — Minimal API proof
Test:
1. native Wolfram LLM route;
2. `ServiceConnect["OpenAI"]`;
3. direct OpenAI REST call.

Produce a connectivity matrix.

### Phase 3 — Secure credential handling
Implement secret retrieval with no credential in Git.

### Phase 4 — Structured request layer
Implement schemas, request wrapper, response validation, token/cost accounting, and error handling.

### Phase 5 — Scientific tool interface
Expose the approved Wolfram calculations as bounded tools.

### Phase 6 — 600-neuron backpropagation audit
Run analytic-gradient, finite-difference, recurrent-gradient, perturbation, and stability checks, then obtain GPT interpretation of structured summaries.

### Phase 7 — Bounded agentic follow-up loop
Allow validated follow-up experiment requests under iteration and cost limits.

### Phase 8 — Population-to-shape experiments
Use verified neural representations in Shape Cognition and visual-observer experiments.

### Phase 9 — Cost optimization
Measure real token use, batching, caching, call frequency, and routing.

### Phase 10 — Wolfram audit reconciliation
Update the error inventory and append scientific/non-scientific histories with resolved issues and remaining blockers.

## 24. Acceptance criteria

The integration is not complete until:

- Mathematica can successfully call an OpenAI model;
- at least one fallback connection path works;
- credentials are absent from Git;
- structured scientific results are exchanged;
- GPT can request an allowlisted Mathematica calculation;
- arbitrary Wolfram evaluation is not exposed;
- usage/cost is logged;
- a hard spending limit is enforced;
- 600-neuron gradient verification is reproduced through the new pipeline;
- Mathematica remains numerical authority;
- prior Wolfram assumptions are revisited;
- unresolved failures remain explicit;
- paired project histories are appended;
- prior artifacts are preserved.

## 25. Recommended first end-to-end experiment

Experiment ID:

```text
NE-GRADIENT-600-001
```

Procedure:

1. instantiate the existing 600-neuron configuration;
2. use a fixed random seed;
3. run forward propagation;
4. calculate loss;
5. calculate analytic gradients;
6. calculate finite differences on a representative parameter sample;
7. calculate relative gradient error;
8. calculate stability statistics;
9. create a compact JSON result;
10. send the structured result to the selected OpenAI reasoning model;
11. request identification of potential errors, suspicious gradients, missing tests, and numerical instability;
12. allow up to three approved follow-up calculations for this initial trial;
13. execute them in Mathematica;
14. return results;
15. produce a final verification assessment;
16. preserve all artifacts and provenance.

This single experiment serves as an integration, scientific-verification, tool-use, cost, and reproducibility benchmark.

## 26. Long-term architecture

Potential four-layer architecture:

```text
Layer 1 — Neural Engine
Representation and dynamics

Layer 2 — Mathematica
Numerical and symbolic scientific authority

Layer 3 — OpenAI model
Scientific observer and bounded experiment planner

Layer 4 — Optional visual observer
Attempts to infer source-state properties from generated visual output
```

This enables comparisons between actual Neural Engine state, Mathematica-derived representation, GPT scientific interpretation, and observer interpretation of visual output.

## 27. Permanent scientific rule

> **No GPT interpretation may replace a calculation that Mathematica can perform directly.**

GPT can help decide what to investigate and interpret the evidence. Mathematica determines the authoritative numerical result.

## 28. Current status

This file records a **planned implementation** generated from the 2026-09-07 project discussion. It does not claim that the OpenAI/Mathematica integration has already been implemented, that an API key has been configured, or that any new Wolfram verification has passed.
