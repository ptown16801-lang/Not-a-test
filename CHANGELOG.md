# Changelog

All notable changes to the neural engine project are recorded here. The project
currently uses a single prototype release line; entries are grouped by the dates
on which they landed in `main`.

## [Unreleased]

### Documentation

- Added this changelog and a consolidated project-change summary.
- Added a project-wide machine-readable history and JSON artifact registry in
  `PROJECT_LOG.json`, with tests that detect missing, invalid, or unindexed
  scientific logs.
- Added a publication-grade source/claim ledger, benchmark qualification gate,
  and manuscript-style scientific audit report.
- Corrected extreme-scale susceptibility evaluation with scaled QR, corrected
  the optional derivative-floor curvature path, and added explicit surrogate
  semantics plus Gram-underflow regression tests.
- Isolated live Wolfram test outputs from committed evidence files so parallel
  manifest verification cannot race with validation-report regeneration.

## [0.7.0] - 2026-09-07

### Neural model and scientific fidelity

- Reconstructed the recurrent Infomax synaesthesia model from Shriki, Sadeh &
  Ward (2016) in dependency-free JavaScript.
- Added an executable Wolfram Language/Mathematica reconstruction with notebook,
  figure builders, headless runners, MUnit tests, and machine-readable parameters.
- Established a publication-first verification gate using an independent Wolfram
  derivation, central finite differences, fixed-point checks, and cross-language
  fixtures.
- Corrected population-vector normalization to use the publication's sum by
  default; retained mean normalization as an explicitly labeled visualization
  option.
- Restored diagonal recurrent learning in the general model, removed the silent
  activation-derivative floor, and corrected best-checkpoint evaluation to use a
  fixed input ensemble.
- Documented unresolved publication details—including integration step,
  tolerance, near-zero initialization, and training length—so reconstructed
  choices are not presented as author-specified parameters.

### Scaling and benchmarks

- Added dense and exact factor-history implementations for scaling experiments.
- Benchmarked the paper-sized declared reconstruction and completed 1,000
  learning updates in 4.03 minutes including validation on the recorded Work
  machine.
- Preserved historical exploratory dense runs through 4,544 output neurons;
  current source-qualified evidence comprises the exact early-training ladder
  through 9,088 neurons and feasibility probes through 72,704 neurons.
- Added a controlled critical-slowing benchmark reaching 129,683 equilibrium
  iterations near the critical point and showing that a nominal `1e-9`
  residual can still yield 62.2% gradient error.
- Published raw JSON/CSV benchmark results, environment metadata, exactness
  labels, source fingerprints, and an evidence-qualified scaling analysis; no
  unsupported sustained cross-size practical limit is claimed.

## [0.7.0] - 2026-09-06

### Browser demo and preview

- Added a zero-configuration local development server.
- Fixed cloud preview state and floating renderer window behavior.
- Corrected renderer sizing, minimize/restore, close/reopen, and fullscreen
  behavior.

## [0.7.0] - 2026-09-05

### Shape cognition and visualization

- Created immutable, content-addressed geometric thoughts with deterministic
  seeded generation, eight legal operators, and a replayable provenance DAG.
- Added complex synesthetic geometry motifs—spirals, tunnels, cobwebs,
  honeycombs, and spatial sequences—without expanding the core operator set.
- Added a neural population-to-shape bridge that turns tuning curves, population
  vectors, and learned cross-modal connections into contours and weave paths.
- Added deterministic text perception and a text-to-neural bridge, runnable demo,
  and `POST /v1/render-text` endpoint.
- Added the initial seed-prompt renderer and floating browser test window.

### Environment artwork and motion

- Added a seamless cloud-drift loop, then hardened its reset boundary,
  crossfade, overlap, opacity, and wrapper styling.
- Added subtle randomized corn-breeze motion.
- Added a shared environment-motion controller and reduced-motion-safe behavior.

### Sensory extensions

- Added dormant thermal-touch perception over a 20–120 °F range centered on
  70 °F, quantized in 3 °F increments.
- Added dormant sound perception for bounded PCM input, including loudness,
  peak, zero-crossing, spectral-centroid, and dominant-frequency features.
- Added artistic heat spirals, cold crystal forms, and sound pulse motifs, all
  expressed through the same legal shape/provenance system.

### Dirt renderer and identification

- Added the Dirt Inscription Renderer v0 with chronological zones, margins,
  density budgets, rounded motion paths, overwrite policies, and actuator-neutral
  commands.
- Added deterministic soil texture recipes with opaque grooves, feathered
  shoulders, and roughness fields.
- Added versioned agent/thought stamps with exact LSB, robust watermark, and
  JPEG-oriented carriers plus CRC and wrong-key rejection tests.

### Intake, authentication, and deployment

- Added the `thought-intake/v1` bounded DAG contract, validator/compiler, and
  authenticated HTTP gateway.
- Added server-owned identities, monotonic per-agent sequences, signed receipts,
  ledger verification/recovery, a public gallery, readiness metadata, and tool
  schema.
- Added dormant Moltbook identity-token verification support.
- Added Docker and Compose deployment files, environment configuration, and
  deployment smoke tests.

### Testing

- Added coverage for the core engine, neural equations and gradients, text
  mapping, sensory encoders, geometry, dirt rendering and texture,
  steganography, Moltbook identity, gateway policy, deployment, and Mathematica
  artifacts.

[Unreleased]: https://github.com/ptown16801-lang/Not-a-test/compare/main...HEAD
[0.7.0]: https://github.com/ptown16801-lang/Not-a-test/releases/tag/v0.7.0
