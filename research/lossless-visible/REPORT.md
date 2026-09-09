# Neural Engine: exact visible renderer execution report

The new renderer exactly recovered the declared primitive geometry and numeric neural vectors from native PNG pixels in all executed tests. **This is a partial fulfillment of the broader project request:** full engine streams, derived DAGs, arbitrary text/tags, complete checkpoints and histories remain unsupported. The existing ASCII renderer remains lossy. No seed sentence is recovered.

The implementation uses a new cornfield representation in which visible stalk anatomy directly displays each source variable's sign, dyadic magnitude and scale. It is not a lossless claim for the familiar perspective artwork. Its large static images are the cost of preserving precision, structure and ordering without a hidden or supplemental payload.

## Implementation and provenance

- Remote main verified through GitHub: `c843381f671565ec7b96865bd7ec7f8b0f29e1b4`.
- Original ASCII checkout: `/workspace/scratch/2a39ffd38648/neural-engine-phase1`, branch `research/phase1-separation-local`, HEAD `1d89ec7e1dd818020db0f9d0b0e177e598c29dff`.
- Its 115 modified/untracked files were snapshotted before editing, including incomplete prior experiment files. All file timestamps/sizes and Git status were stable during capture. Backup: `ascii-uncommitted-before-edits.tar.gz`, 341,081,116 bytes. The manifest and tracked diff are retained.
- Work occurred in a separate clone on `research/lossless-visible-v1`. The unchanged ASCII prototype was imported and committed as `41f1b35b8517e7a99eb155dc8389bd38cced9ccc` before the renderer was added.
- Renderer, decoder, public rules and primary test implementation match commit `8e66f97e91d8d08cc33ace5a2f2eedb47a2a7eec` byte-for-byte. Tests ran while these files were uncommitted on the preserved baseline; `executed-source-binding.json` explicitly binds their executed SHA-256 hashes to that later commit. The baseline commit is not misreported as containing the new implementation.
- Separate Phase 2/Android dirty work was left in place. Neither original checkout was edited. Legacy `MASTER_PROJECT.json`, `PROJECT_LOG.json` and old history snapshots in this branch were not overwritten.

The source is `prototypes/lossless-cornfield/`; the complete contract, field inventory, exclusions, capacity calculation and injectivity argument are in `CONTRACT.md`. Reproduction commands are in its `README.md`. The inverse is a separate executable, imports no renderer/engine/adapter code, and reads only the output image after fixed dependency/rule bootstrap. Every fresh test copies just `decode.py`, `rules.json`, and `image.png` into an empty working directory, closes stdin, and enforces the file/network/subprocess audit guard. This is an accidental-leakage guard, not a claim of adversarial OS sandboxing.

## Executed results

The final primary run passed **8/8 test groups and 45 complete-image round trips**, with zero skips or failures, in 176.87 seconds. Comparisons include exact packed binary64 representations and complete accepted object structures, not numeric tolerances. The original ASCII regression suite passed 7/7 tests; the repository's paired-history machinery passed its separate 10/10 checks. Neither count is a neural-science validation result.

| Area | Result | Meaning |
| --- | --- | --- |
| All nine primitive kinds | Passed | Points, endpoints, analytic centers/radii, ordered polygons, original curve controls, complete surface seeds and explicit polylines |
| Structure and attributes | Passed | Array/shape order, duplicate/overlapping paths, duplicate/reversed/self edges, topology counts, colors, materials, texture, bounds, curvature, symmetry, derivation depth and creation step |
| Translation / independent scaling | Passed | Transformed inputs remain distinguishable; no automatic fitting |
| Precision | Passed | 4,153 values including every one of the 2,098 magnitude exponents, finite extrema, subnormal boundaries, 1,024 random finite values and their neighbors toward zero |
| Small exhaustive domain | Passed | All 16 pairs from a four-value floating-coordinate domain, including adjacent values around 1; all 16 digits at each of 13 significand positions; supported symmetry codebook |
| Degeneracy / boundaries | Passed | Empty scene, empty arrays/states, repeated points, zero radius, empty curve/surface, maximum-row image |
| Capacity exhaustion | Explicit rejection | One entry beyond the demonstrated row limit; excessive neuron and shape counts; no truncation |
| Unsupported records | Explicit rejection | Full project streams, derived shapes, tags/IDs/unknown fields, arbitrary strings, NaN/infinity, negative zero, noncanonical colors and nonrepresentable Python integers |
| Lossless PNG reopening | Passed | Exact recovered state after reopening and recompression; RGB only, no ancillary chunks |
| Screenshots / altered images | Mixed or failed | Separate measurements below; no native-image guarantee extended |
| Full engine or sentence recovery | Unsupported / unproved | Not counted as a pass |

The prior four-stalk integer example is not used as proof for binary64. The current finite checks supplement a constructive injectivity argument: disjoint stalks, unique branch extents, canonical normalized binary64 decomposition and unambiguous semantic beds. This is not a machine-verified proof that the implementation has no bugs.

## Real project evidence

Two explicit primitive records were extracted from the already-saved `demo/balance-output.json`, with the original source hash and an omission receipt. Derived shapes and provenance were not silently treated as reconstructed. Saved Phase 1 neural states were recovered from an existing compressed scientific record. Saved Phase 2 data supplied all 13 observations × 12 neurons from a trained recurrent-model trial; the archive hash, key and trial position are recorded outside the decoder.

The actual unchanged network implementation separately generated three full 600-neuron equilibrium vectors with nonzero initial recurrence; they converged in 40, 40 and 36 iterations. These particular 600-neuron examples are **untrained**, not a reproduction of a trained 600-neuron research result. Every one of their 1,800 numbers was retained and recovered. Network parameters and integration histories were not renderer inputs.

The 24-step ASCII prototype was freshly executed and produced 78 stored shapes. Its selected replay produced eight paths and 392 vertices; **all eight paths** were passed to the exact renderer and recovered. This shows exactness after that replay boundary, not recovery of the replay's original analytic curves, discarded z coordinates or omitted shapes. A separate 64-control-point 3D curve fixture verifies direct control-point preservation without sampling.

## Measured capacity and performance

Python 3.12.13, NumPy 2.3.5, Pillow 12.3.0; platform `Linux-6.18.35-x86_64-with-glibc2.39`. Node regression tests used v24.19.0. Timings are observations from this runtime, not hardware-independent promises; inverse time includes fresh-process startup, image reopening, validation and output serialization.

| Example | Numeric fields | Native dimensions | PNG bytes | Render s | Export s | Inverse s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Saved balance primitives | 39 | 1488 × 2480 | 22,571 | 0.006 | 0.150 | 1.451 |
| Saved Phase 1 full vectors | 36 | 1488 × 1040 | 11,684 | 0.003 | 0.069 | 0.958 |
| Saved Phase 2 trial: 13 × 12 values | 156 | 1488 × 4240 | 47,296 | 0.050 | 0.252 | 2.279 |
| 64 3D curve controls | 333 | 1488 × 5200 | 71,246 | 0.287 | 0.319 | 3.318 |
| 392 replayed vertices, 8 paths | 1632 | 1488 × 28240 | 360,469 | 1.148 | 1.530 | 15.277 |
| Three complete 600-neuron vectors | 1800 | 1488 × 24560 | 373,911 | 0.794 | 1.368 | 16.786 |
| Maximum 240-row example | 2844 | 1488 × 38480 | 485,869 | 1.601 | 2.488 | 23.181 |

The maximum configured image has 57,258,240 pixels / 171,774,720 RGB bytes before compression. The tested largest scene holds 2,844 numbers in 240 rows; structural beds also consume space. Small compressed PNG size does not mean low display-memory cost. Each canonical finite binary64 variable has nearly 64 bits of possible distinctions; the geometric scalar construction has sufficient distinct sign/branch configurations. A silhouette or one short height ruler does not.

## Failures and limits retained

The unchanged ASCII renderer produced identical visible output for each tested translation, uniform scale, independent-axis scale, duplicate-path insertion, below-cell/adjacent coordinate change, and unused-attribute change. These are concrete negative controls in `legacy-losses.json`, not hypothetical concerns. The strings `sun!` and `sun?` also produced the same numeric text-perception vector; retained source-text records differ, and the ASCII seed can distinguish this particular pair. No universal sentence-to-image inversion is inferred.

For the six-value precision image, native-size JPEG at qualities 100, 95 and 85 decoded exactly; qualities 70, 50, 30, 10 and 1 were rejected. These are empirical results for one fixture and encoder configuration, **not a universal quality threshold**. Some JPEG pixels changed without changing the measured foreground geometry.

Every tested non-native dimension was rejected: scales 0.25, 0.5, 0.75, 0.99, 1.01, 1.5 and 2.0 with nearest-neighbor and Lanczos filters. The 1.0 controls passed. This strict dimension rejection alone does not prove information destruction: an additional resize-then-restore test recovered the sample after nearest-neighbor enlargement at 1.01, 1.5 and 2.0, while all tested reductions and Lanczos round trips failed. Arbitrary resizing remains outside the guarantee. Cropping a single edge pixel or a whole row was rejected.

A real browser viewport capture was JPEG, 1363 × 936. It contained the fitted preview and was rejected (`InvalidImage: native width required`). No DOM coordinates, unseen content, extra frame or original geometry was supplied to its decoder. The browser preview's successful decode button reads the complete PNG, so that button's success is explicitly **not** counted as screenshot recovery.

The first supervised preview start failed because of its restricted filesystem layout; the first decoder-button attempt then failed because NumPy was absent there. Fixed sample/dependency staging repaired those issues, and the numeric sample plus saved-geometry button were subsequently verified. Cross-command loopback checks also failed; a local server and HTTP client in one process group successfully exercised the page, native image and fresh decoder endpoint. All these incidents remain in `development-incidents.json`.

## Scope still incomplete

The full project accepts metadata, identities, arbitrary text/attribute overrides, derived operation DAGs and growing histories for which this finite geometric schema has no representation. A bounded image cannot accommodate an unbounded accepted domain. This implementation therefore rejects the full records and returns explicit receipts when the caller requests a partial extraction. It does not claim that every possible enlarged, redesigned representation is impossible.

The exact result is engineering evidence for a new geometric display contract. It does not establish learned temporal representations, scientific information retention in the old artistic pipeline, semantic understanding, neural superiority, biological equivalence or recovery of an original seed sentence. Those remain separate research questions.
