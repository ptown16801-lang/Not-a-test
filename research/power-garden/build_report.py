#!/usr/bin/env python3
"""Build the final report from the retained executed measurements."""
import json,math,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
R=ROOT/'research/power-garden'
run=json.loads((R/'results/run-02/results.json').read_text())
assert 'finished_at_utc' in run and run['failed']==0
recovery=json.loads((R/'recovery.json').read_text())
head=json.loads((R/'results/run-02/execution-source.json').read_text())['git_revision']
items={r['name']:r for r in run['cases']}
table=[]
for name,label in [('display-sample','Six-value preview'),('saved-complex-primitives.scene','Saved primitive subset'),
                   ('saved-phase2-vectors.scene','Saved Phase 2 trial'),('saved-sampled-complex-paths.scene','Eight saved complex paths'),
                   ('saved-three-600-neuron-vectors.scene','Three saved 600-neuron vectors'),('maximum-capacity','Maximum single vector')]:
    r=items[name]
    table.append(f"| {label} | {r['numbers']:,} | {r['width']}×{r['height']} | {r['png_bytes']:,} | {r['render_seconds']:.3f} | {r['decode_seconds']:.3f} |")
native=sum(r.get('kind')=='native_exact_recovery' for r in run['cases'])
numbers=sum(r.get('numbers',0) for r in run['cases'])
bits=math.log2(2047*2**53)
report=f'''# Power Garden: lossless visible rendering

## Executed result and scope

Power Garden is a newly implemented standalone Python renderer with a separately
written JavaScript inverse. It reconstructs every accepted geometry parameter,
topology entry, supported attribute, ordering distinction, depth value and
numeric-state element from one complete native PNG. No earlier neural engine,
shape engine, dirt renderer, ASCII renderer, text transform or provenance module
is imported or executed. Previously saved project outputs are used only as data.

The final suite executed **{native}/{native} successful native-image cases**, covering
**{numbers:,} scalar occurrences**. It recorded **{run['passed']} passing assertions,
zero failed assertions, and {run['measured']} separately measured altered-image cases**.
Three complete saved 600-neuron vectors and eight saved complex paths round-tripped
exactly. The numerical comparison checks binary64 representations and rejects
integer coercion that would change the exact input value. Every decoded native
object is also revalidated against the renderer boundary.

The scope is deliberately finite. This result does not recover complete Shape
Cognition streams, derived operation DAGs, arbitrary text/tags, full neural
checkpoints, or source sentences. The native desktop viewer is implemented but
could not be executed without a display server. Actual screenshot measurement
was blocked by two failed browser connections. Complete PNG previews, the CLI,
independent inverse, source adapters and pixel tests were executed. Engineering
completion within this boundary is not scientific validation of the neural model.

## Repository recovery and preservation

The authoritative repository was verified through its authenticated repository
API as `ptown16801-lang/Not-a-test`, default branch `main`. Its observed remote
head was `c843381f671565ec7b96865bd7ec7f8b0f29e1b4`. Public page retrieval had
failed earlier; that failure did not prevent the subsequent API verification.
No remote repository or social service was modified in this work.

Three relevant local contexts existed, and their distinctions were retained:

| Context | Observed revision and state | Treatment |
| --- | --- | --- |
| Original Phase 1 checkout | `1d89ec7e1dd818020db0f9d0b0e177e598c29dff`, branch `research/phase1-separation-local`, tracked and untracked changes | Read-only archive, binary patch, per-file hashes, and status checks |
| Previous visible-renderer branch | `17b6bb7201440239ae3f0c1983f7ca262cfc84de`, clean `research/lossless-visible-v1` | Preserved as the starting Git revision; inspected for scope, not reused as implementation |
| Phase 2c remediation | `c843381f671565ec7b96865bd7ec7f8b0f29e1b4` plus active uncommitted research | Left untouched |

The new branch is `research/power-garden-standalone` in
`/workspace/scratch/e23f8538817b/neural-engine-power-garden`. A separate local
clone avoided changing the existing worktrees. The original checkout snapshot
contains 321 tracked/untracked files totaling 779,209,529 bytes, compressed to
321,483,540 bytes. Two-pass hashing found no changes during capture, and Git
status was stable. Ignored dependencies and Git object storage are not in that
working-tree archive. The retained patch has no matches for the project's
credential-pattern check.

`AGENTS.md` requires additive preservation and paired scientific/plain-language
histories. The legacy `MASTER_PROJECT.json` and `PROJECT_LOG.json` remain
byte-identical to the starting branch. New evidence is appended through the
existing `maintenance/v1/history.py` machinery, with matching events, exact
source commits and integrity hashes. Its ten machinery tests passed. These
history tests are not neural-network tests, and no Wolfram result is substituted
for or inferred from the renderer tests.

The numerical contract and initial implementation were committed at
`63393b5`; the original broad test was pinned by `0a40319`. Two discovered
implementation/test-interface issues and their corrections are preserved below.
The final full run uses source revision `{head}`; its exact executed file
hashes and runtime are in `results/run-02/execution-source.json`. Later report
and history commits are identified by the delivery manifest, rather than
pretending they existed when the tests ran.

## Research findings and design choice

Lossless storage and lossless representation are separate properties. PNG can
preserve its raster samples, but cannot restore distinctions already removed
before those samples were created. W3C specifies PNG as a lossless raster
format and defines the critical chunks and decoding operations used here.
The guarantee consequently begins with this renderer's accepted object and
ends with the complete native raster, not with an arbitrary SVG's retained
internal parameters.[^1]

Floating-point coordinates are a finite, nonuniform numerical domain. Adjacent
values can be much closer than a pixel, and signed zeros have distinct
representations even though ordinary numerical equality treats them as equal.
Goldberg's analysis explains the precision and signed-zero issues that make
naive scaling, rounding and equality checks unsuitable here.[^2] Python's
`as_integer_ratio()` supplies an exact rational representation, which the
forward implementation uses without converting source values to a rounded
display coordinate.[^3]

Information capacity supplies a necessary constraint: a representation needs
at least as many distinguishable outputs as accepted inputs. Shannon's
logarithmic measure of distinguishable alternatives motivates counting rather
than inferring capacity from a picture's apparent complexity.[^4] The concrete
pixel counts, dyadic construction and injectivity argument below are derived
for this implementation; they are not claims made by those sources.

Published invertible-visualization work does not automatically satisfy this
task. InvVis embeds data in visualization images using an invertible neural
network, with the encoded result intended to be perceptually indistinguishable
from the original. Its hidden-data approach is specifically outside the visible
representation requirement, so none of that machinery was adopted.[^5]

| Candidate | Why it is insufficient or how it is used |
| --- | --- |
| Automatic bounding-box fit | Removes absolute translation and independent axis scale |
| Orthographic projection alone | Avoids perspective distortion but still drops unrepresented dimensions and subpixel distinctions |
| Full-rank real linear transform | Does not establish injectivity of floating arithmetic followed by rasterization |
| Sampled curves and rounded character cells | Merge distinct controls/coordinates; exact sampled paths do not imply exact source curves |
| Exact internal SVG numbers | Do not prove that rasterized visible pixels retain those numbers |
| Duplicate outlines on one canvas | Can become visually identical to one outline, losing multiplicity and order |
| Hidden payload, metadata or separate data panel | Excluded; these would change the recovery problem |
| Multiple views/frames | Require the complete declared observation; not used for the primary result |
| Visible signed dyadic components | Implemented; each leaf has a fixed numerical meaning and a disjoint visible footprint |

A single fixed linear ruler covering the entire binary64 range would be
impractical if its pixel spacing had to distinguish the smallest subnormal
increments. The solution is not to round the coordinate. It displays all
relevant absolute scales explicitly as part of the geometry. This changes the
appearance into a parameter diagram: it is not the old shape silhouette with
an extra recovery panel attached.

## Reconstruction boundary and existing losses

The original `renderCornfieldPaths(paths, options)` boundary includes ordered
paths, ordered point components, width, height, horizon and a decoration seed.
Its source computes data bounds, normalizes both axes, projects into a
perspective opening, samples lines into character cells, clips and merges
characters. Its `renderCornfieldAscii(stream, options)` wrapper selects one
shape and uses an approximate geometric replay. Neither is an injective
representation of everything it accepts.

The larger project has substantially more independent state:

| Source area | Independent information | New implementation status |
| --- | --- | --- |
| Primitive geometry | Kind, all endpoints/centers/vertices/control points, radius, full surface seed array, z where present | Supported explicit finite 2D/3D primitive fields |
| Topology | Dimension, node count, ordered endpoint pairs, components, duplicates and self-edges | Preserved as supplied, within explicit size/index limits |
| Appearance attributes | Color, material, texture, curvature, symmetry list, bounds; arbitrary overrides are possible upstream | Exact fixed attribute set supported; arbitrary overrides rejected |
| Ordering and depth | Shape occurrence order, point/edge order, derivation depth, creation step | Preserved; geometric z and derivation depth are distinct |
| Derived shapes | Operation, parameters, ordered parent references and geometry DAG | Unsupported; no approximate replay substitutes for them |
| Shape identity and provenance | IDs, tags, schema/pipeline/stage, conventions, units, coordinate system, parents/operators/parameters | Outside the new root boundary |
| Stream and selection history | Manifest, seed, operators, all steps, active IDs, candidates/fitness, goals, working set, RNG state, render settings | Whole stream rejected |
| Neural vectors | Every numeric neuron value and vector ordering supplied at this boundary | Supported; tested on complete saved 600-element vectors |
| Full neural checkpoint | Weight/input matrices, inputs, integration/adaptation/optimizer/RNG state, parameters, identities, history | Not represented by a vector; unsupported |
| Text prototype | Source text, derived or explicit seed, requested/executed steps, heuristic perceptions and shape stream | No text or sentence-recovery claim |

The inspected ASCII prototype uses heuristic text features and a seeded shape
search; it does not execute the recurrent network. That distinction is based
on the inspected source, not an assumption that all project outputs came from
the neural model. Existing six-decimal artistic rounding and upstream
`ne-canonical-binary64/v1` positive-zero normalization are historical behavior.
This implementation introduces neither. It cannot restore information discarded
upstream. Typed higher-precision strings and nonfinite values remain unsupported.

The new root has exactly `schema`, `shapes` and `states`, with schema
`power-garden/v1`. Every shape has exactly geometry, topology, attributes, depth
and createdAtStep. Supported kinds are point, segment, ray, disk, ball, polygon,
curve, surface and polyline. Point lists are uniformly 2D or 3D; disk is 2D,
ball 3D. Empty lists, repeated controls, zero lengths/radii, duplicate shapes,
reversed edges and degenerate geometry are allowed and preserved. No topology
consistency beyond the stated structural/index checks is invented.

Attributes have exactly color, material, texture, curvature, symmetry and
bounds. Color is lowercase `#rrggbb`; material is matte or glossy. Symmetry is
an ordered list from the public finite category set in `CONTRACT.md`. Unknown
fields are errors. No caller-specific display setting is accepted. Both signed
zeros are retained in real-valued fields; structural negative zero, NaN,
infinities, inexact integer conversion, mixed dimensions and unsupported kinds
are rejected explicitly.

Object key insertion order, JSON whitespace and numerical spelling are not
independent fields in the binary64 data model. Array order is independent and
is retained. Integral JSON literals must exactly represent a binary64 value;
decimal/exponent literals denote binary64 values rather than arbitrary decimal
precision. The inverse now emits exact integer digits for integer-valued floats,
so its JSON output remains valid input to the same contract.

## Visible geometry and independent inverse

For a finite value x, its magnitude has a unique finite dyadic expansion:

`abs(x) = Σ b[p] × 2^p`, with `p = −1074,…,1023` and `b[p] ∈ {{0,1}}`.

One variable is a plant with 33 stalks, each containing 64 fixed levels.
Stalk j, level k has absolute scale `p = 1023 − 64j − k`. A visible horizontal
leaf is present exactly when that signed additive component is present.
Leaves and tassels lean right for positive values and left for negative values;
the tassels distinguish zero signs. The final 14 out-of-range sites are invalid.
No exponent payload or float byte representation is printed or hidden.

The plant itself is the direct source-variable geometry. A leaf for 2^-40
means the additive component 2^-40, not an arbitrary bit in a serialized
record. This is still a digital geometric representation; its legitimacy comes
from that explicit source-variable meaning, not from pretending information is
unencoded. Every variable-bearing geometric degree of freedom is documented.

Each plant occupies 272×88 pixels; six plants occupy a semantic row.
Coordinates and edge endpoints remain grouped as pairs or triples. Separate
shape occurrences prevent overdraw from deleting multiplicity. Fixed categorical
stalk heights identify primitive and field roles. Visible row boundaries,
occupancy and end markers preserve array lengths and ordering. All source
attributes have a specified visible representation. The constant amber sunset
is confined to the top margin and cannot obscure or supply data. The dirt
inscription system is not present.

The forward implementation derives active powers using exact integer ratios
and integer operations, then draws opaque integer-position strokes without
antialiasing. It does not move or round the input's original coordinates.
The JavaScript inverse has its own PNG decompression/filter implementation,
own geometric recognizer, own grammar and own arithmetic. It accumulates
`Q = Σ b[p] × 2^(p+1074)`, rejects sums that exceed binary64 precision, and
reconstructs the number. It does not import a renderer helper or use an original
scene graph. Only built-in Node modules are required.

The inverse validates every plant and structural row against the observed
foreground mask, using the fixed public threshold `R+G+B < 300`. Color channels
do not carry independent information. Native output is opaque RGB and has
only IHDR, IDAT and IEND chunks. An adversarial, incorrect text metadata field
was injected into a separate test image; decoding stayed unchanged because
ancillary metadata is ignored. That test does not add metadata to the native
rendering contract.

Every test inverse runs in a fresh temporary directory with only a generically
named image and the fixed inverse file. Its stdin is closed, its environment
does not inherit source-specific configuration, and Node file-read permissions
are limited to those two files. A negative control confirmed that attempting
to read a known source fixture is denied. Node describes this mechanism as
protection against unintended access by trusted code, not an adversarial OS
sandbox; that is the scope claimed here.[^6] Attempts to use separate OS
namespace/chroot isolation were blocked and remain documented. Source comparison
occurs only after the inverse process exits.

## Injectivity argument and capacity

For supported finite binary64 inputs, distinct magnitudes have different finite
dyadic expansions. Opposite signs have different leaf directions, and the two
zeros have different tassels. Every component's footprint is distinct from
neighboring stalks and variables. Therefore equal native scalar masks determine
equal binary64 values. Canonical structural roles, complete group occupancy
and delimiters then determine one accepted scene, including all duplicate and
ordering distinctions. Thus equal native images imply equal accepted inputs,
and the specified inverse is a left inverse.

This is an argument for the discrete construction, not a machine-checked proof
of the programs. The finite tests address implementation risk; they do not
replace that argument or establish injectivity after arbitrary image edits.
The unproved parts include formal verification, arbitrary image-reader
conformance, human decoding at normal screen size and robustness to capture.

There are `2047 × 2^53` finite binary64 representations including both zeros,
requiring approximately `{bits:.6f}` bits of distinction per unrestricted
scalar. This transparent construction allocates 2098 component sites plus sign
and uses only the binary64-valid subset. At most 53 component leaves occur
in a nonzero value. The many unused sites are the cost of keeping all absolute
scales fixed and public rather than optimizing density.

The executable limit is 400 rows: a 1712×35280 image, 60,399,360 pixels and
181,198,080 uncompressed RGB bytes. A single vector uses a start row, its value
rows, an end row and the scene end, so 2382 values fit and 2383 do not.
Additional shapes and array delimiters consume the same budget. The planner
checks before allocation and output creation; it never truncates, clips,
substitutes a vector summary or silently selects fewer neurons.

A 600×600 weight matrix would require 360,000 plants, at least 60,000 value
rows, and approximately 9.04 billion pixels in this particular layout. Its
rejection is an implementation capacity limit, not a theorem that no finite
image could hold those values. The information-only lower bound would be about
{math.ceil(360000*bits/24):,} fully utilized 24-bit pixels, excluding structure;
this renderer is intentionally far from that bound. No claim is made that an
arbitrary dense-bit image would satisfy the visible-geometry requirement.
Unlimited accepted history cannot fit into a fixed finite observation budget.

## Validation and measured performance

The final run was completed at {run['finished_at_utc']}. It used Python 3.12.13,
Pillow 12.3.0, Node v24.19.0 and runtime bundle 26.826.12353 on Linux x86_64.
Generated tests used seed 20260909, which was never passed to the inverse.
Measurements are elapsed seconds in this shared environment, not controlled
hardware benchmarks. RGB byte counts are allocation-size calculations, not
measured peak resident memory.

| Case | Scalar occurrences | Native dimensions | PNG bytes | Render seconds | Decode seconds |
| --- | ---: | --- | ---: | ---: | ---: |
{chr(10).join(table)}

The suite exhaustively checks all 256 four-coordinate combinations from
`{{−minSubnormal,−0,+0,+minSubnormal}}`, grouping observations in complete PNGs.
It tests all 2098 legal absolute power positions with both signs (4196 values).
It also tests 1024 generated finite bit patterns, their next representable
neighbors, and extreme/subnormal/normal boundaries. Large integer-valued floats
have an explicit strict-JSON closure regression. The earlier four-height,
0–15 experiment is only historical bounded feasibility evidence and is not
used to validate this floating-point renderer.

Geometric tests separately change translation, independent axis scaling,
sub-character displacements, adjacent coordinates, geometric z, derivation
depth, creation step, duplicate/self/reversed edges, closure, attributes,
object order and vertex order. Each recovered object equals its input and each
tested altered source produces a different pixel image. All nine primitive
kinds, empty/degenerate cases and all supported symmetry categories are tested.

Saved-data evidence has distinct scope. Three primitives were explicitly
extracted from a 78-shape saved stream; unsupported derived records and all
other omitted fields are listed in an omission receipt. Eight saved paths
contain 392 vertices and 1632 represented scalars including other fields; their
earlier sampling/projection losses are not undone. The Phase 1 record was
independently found unchanged on line 6 of the original compressed archive.
The Phase 2 float64 NPZ source hash matches the recorded source; trial 0 supplies
13 complete 12-neuron vectors from an array shaped 128×13×12. Three historical
600-neuron snapshots supply all 1800 values. No prior engine was run to generate
replacement data, and these vector tests do not recover weights or history.

Lossless PNG reexports at compression levels 0, 1 and 9 passed after reopening.
The native chunk inventory passed. The custom inverse supports noninterlaced,
8-bit RGB or fully opaque RGBA PNG observations; palette, grayscale, interlaced
or other container variants are not promised as a general PNG-reader suite.

## Negative results, corrections and observation limits

Two development problems are retained, not erased. First, run-01 expected a
capacity rejection at 2377 values. Counting the structural rows correctly
shows that 2382 values fit, so that test expectation was wrong. The renderer
did not truncate. An executed follow-up recovered all 2382 values and verified
that 2383 is rejected before writing a file. The final full suite uses the
correct bound.

Second, the initial inverse used JavaScript's ordinary shortest numerical
formatting. For `2^60`, it emitted `1152921504606847000`, which rounds back to
the same JavaScript Number but is not the exact integer value and is rejected
by this contract's strict integral JSON parser. The original comparator
coerced both values to binary64 and did not expose that interface defect.
A reproduced failing image/output is retained under `serialization-failure`.
The inverse now emits exact integer digits, and the final comparator rejects
inexact integer coercion and revalidates decoded objects. The complete suite
was rerun after this repair. The source coordinates and pixel mapping were
not quantized or changed to make the test pass.

| Observation change | Executed outcome | Claim boundary |
| --- | --- | --- |
| Native RGB PNG and tested lossless reexports | Exact | Covered accepted-domain observation |
| JPEG Q100, Q95, Q85, Q70 | Exact for the six-value test image after decoding JPEG to RGB pixels | Empirical results for one image and encoder |
| JPEG Q50, Q30, Q10, Q1 | Rejected | Q70 is the lowest tested passing quality, not a universal threshold |
| Direct resize at 0.25, 0.5, 0.75, 0.99, 1.01, 1.5, 2, nearest or Lanczos | All rejected because dimensions changed | Fixed protocol refusal alone does not prove lost information |
| Resize back to native, nearest | Exact at 1.01, 1.5 and 2; rejected for tested reductions | Conditional examples, not arbitrary-resize recovery |
| Resize back to native, Lanczos | Exact at 1.5 and 2; other tested factors rejected | Pixel changes can sometimes preserve the foreground mask |
| One-pixel bottom or right crop | Rejected | Complete native dimensions/footer required |
| Erase one complete unit leaf | Valid but wrong reconstruction: a 1 became 0 | No authentication or error correction |
| Actual screenshots | Not executed: browser backend connection failed twice | No screenshot fidelity or failure threshold established |
| Native desktop window | Not executed: no display server | Implemented viewer remains unqualified on this host |

The silent complete-leaf mutation is particularly important. A corrupted image
can become another valid image in the representation. A checksum outside the
image could reveal this in verification, but the inverse receives none. The
native equality claim does not imply corruption detection, JPEG robustness,
photographic recoverability or restoration of cropped content. A screenshot
of one viewport does not inherit offscreen pixels from a taller PNG.

## Delivery and reproducibility

The portable distribution contains the newly written application, independent
inverse, frozen contract, saved fixtures and omission receipts, executable
validation, full retained results, representative PNGs and this report. It
does not include an earlier engine as a runtime dependency. The application
needs local Python/Pillow and Node; it has no web-service runtime dependency.

From the distribution root, render and decode with:

```sh
python apps/power-garden/app.py render research/power-garden/results/run-02/display-sample.input.json /tmp/garden.png
python apps/power-garden/app.py decode /tmp/garden.png > /tmp/recovered.json
python research/power-garden/validate.py --output /tmp/garden-new-validation
```

Use unused output paths. Open `garden.png` in an image viewer at native scale
for the executed static preview. On a machine with Tk and a display,
`python apps/power-garden/app.py preview /tmp/garden.png` launches the implemented
desktop viewer, whose execution limitation above remains explicit. Integration
uses the standalone `extract.py` data readers with mandatory omission receipts;
full streams are never implicitly downgraded to a supported subset by render.

The defensible result is an exact visible native-pixel representation of a
declared finite geometry-and-vector domain. Complete engine-state/history
recovery, dense 600×600 checkpoints in this layout, preserved original shape
appearance, seed-sentence inversion and real screenshot robustness remain
unsupported or unproven. These are concrete remaining boundaries, not passes.

## Sources

[^1]: W3C. [Portable Network Graphics Specification, Third Edition](https://www.w3.org/TR/png-3/), 24 June 2025. Lossless raster storage, critical chunks and decoding rules; accessed 9 September 2026.
[^2]: David Goldberg. [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html), ACM Computing Surveys, March 1991, Oracle-hosted version. Precision, rounding and signed zero; accessed 9 September 2026.
[^3]: Python Software Foundation. [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html). Exact integer-ratio representation; accessed 9 September 2026. Runtime version is separately recorded above.
[^4]: Claude E. Shannon. [A Mathematical Theory of Communication](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf), Bell System Technical Journal 27, 1948, corrected reprint. Distinguishable alternatives and logarithmic information measures; accessed 9 September 2026.
[^5]: Huayuan Ye, Chenhui Li, Yang Li and Changbo Wang. [InvVis: Large-Scale Data Embedding for Invertible Visualization](https://arxiv.org/html/2307.16176v3), 3 September 2023 version; IEEE TVCG 30(1), 2024. Hidden-data approach reviewed and excluded; accessed 9 September 2026.
[^6]: Node.js. [Permissions](https://nodejs.org/api/permissions.html). Resource restrictions and trusted-code limitations; accessed 9 September 2026. The current documentation is newer than the recorded v24 runtime; the actual required file-read restrictions were separately executed and verified on v24.19.0.

Project evidence: `AGENTS.md`; original prototype/runtime source inspected read-only;
`recovery.json`; `phase1-preservation.json`; fixture receipts; `run-01/results.json`;
`followup-01/results.json`; `serialization-failure/failure.json`;
`run-02/results.json`; `saved-source-verification.json`; final paired histories.
These are local source/evidence records, not independent external validation.
'''
(R/'REPORT.md').write_text(report)
print({'report':str(R/'REPORT.md'),'words':len(report.split()),'native_cases':native,'scalar_occurrences':numbers,'passed':run['passed'],'failed':run['failed']})
