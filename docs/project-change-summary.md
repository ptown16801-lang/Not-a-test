# Neural engine project: change summary

## What the project has become

The project began as a deterministic geometric thought engine and is now an
integrated neural-synesthesia research and visualization system. It accepts a
text or structured thought, maps perception into neural population activity,
projects that activity into replayable geometry, renders the result as artwork
or a dirt-inscription plan, and preserves identity and provenance throughout
the pipeline.

## Major changes

### 1. A closed, replayable shape-cognition core

- Thoughts are immutable, content-addressed shapes.
- Every derived form records its parents and operator parameters in a provenance
  DAG.
- Generation and tie-breaking are deterministic under a seed.
- Internal construction remains limited to eight legal operators, including
  transform, morph, composition, arrangement, projection, and subdivision.

### 2. The Shriki neural model was reconstructed

- The recurrent Infomax model from Shriki, Sadeh & Ward (2016) was implemented
  in JavaScript.
- A separate neural-to-shape bridge translates population responses into visual
  contours and cross-modal weave paths without pretending the paper itself
  specified artwork.
- Full research runs and a compact trained preview checkpoint are supported.

### 3. Mathematical fidelity was independently checked

- A complete Wolfram Language/Mathematica implementation, notebook, figure
  builders, and tests were added.
- An independent derivation verified the fixed point, susceptibility,
  information objective, and recurrent-learning direction before benchmarking.
- Finite-difference and JavaScript/Wolfram comparisons found sub-nanoscopic
  numerical errors on the verification fixtures.
- The audit corrected population-vector normalization, recurrent diagonal
  handling, derivative-floor behavior, checkpoint selection, and factor-history
  handoff.
- Unknown or unpublished parameters are now explicitly labeled rather than
  silently treated as facts from the paper.

### 4. Scaling was measured instead of guessed

- The literal dense model was benchmarked through 4,544 output neurons.
- Exact early-training factor history was benchmarked through 9,088 neurons,
  with short feasibility probes reaching 72,704 neurons.
- The publication-sized 142-neuron model completed 1,000 updates in 3.98 minutes
  on the recorded Work machine.
- Separate critical-slowing tests showed that proximity to instability—not only
  neuron count—can dominate runtime.

### 5. Text and sensory inputs were added

- Text now has a deterministic perceptual mapper, neural bridge, demo, and HTTP
  rendering endpoint.
- Thermal touch is implemented but disabled by default: 70 °F is neutral,
  20–120 °F spans maximum cold to maximum hot, and perception changes in 3 °F
  increments.
- Sound perception is implemented but disabled by default and extracts bounded
  PCM features such as loudness, peak, zero-crossing rate, centroid, and dominant
  frequency.

### 6. The visual language was expanded

- Neural responses can become contours and cross-modal weave paths.
- Higher-level motifs include spirals, tunnels, cobwebs, honeycombs, spatial
  sequences, hot spirals, cold crystals, and sound pulses.
- The cornfield environment gained a subtle randomized corn breeze and a slow,
  seamless cloud loop with boundary-crossfade fixes.
- The browser renderer gained a floating test window with corrected sizing,
  minimize/restore, close/reopen, and fullscreen state.

### 7. Thoughts can be inscribed and identified

- The Dirt Inscription Renderer converts normalized geometry into physical
  tram-line coordinates and actuator-neutral motion commands.
- Density limits, safe margins, chronological placement, overwrite/fade policy,
  rounded corners, and deterministic soil texture are recorded in each result.
- Agent and thought identity can be embedded using LSB, robust watermark, or a
  JPEG-oriented carrier with error correction and CRC checking.

### 8. The project became a runnable service

- A validated `thought-intake/v1` contract accepts bounded primitive/operator
  DAGs without requesting private chain-of-thought.
- The gateway assigns server-owned identity, monotonic sequence numbers, signed
  receipts, and a verified append-only ledger.
- It exposes a gallery, readiness endpoint, tool schema, and text-rendering API.
- Local authentication is the safe default; Moltbook identity verification is
  installed but inactive until developer credentials and an explicit mode
  switch are supplied.
- Local development, production startup, Docker/Compose configuration, and
  deployment smoke tests are included.

## Current position

The project is functional as an experimental engine and research platform, but
it deliberately separates three levels of claim:

1. **Publication reconstruction:** equations and conditions directly supported
   by the cited papers.
2. **Declared reconstruction choices:** numerical details the papers did not
   publish.
3. **Project extensions:** geometric artwork, sensory motifs, environmental
   animation, dirt inscription, and identity carriers.

That separation is now the central safeguard against mistaking an expressive
visualization for a literal measurement of an agent's private internal thought.
