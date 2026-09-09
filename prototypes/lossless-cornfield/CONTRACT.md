# Visible cornfield reconstruction contract v1

Status: implemented exact renderer for a **declared primitive-geometry and numeric-state domain**. This does not make the existing perspective ASCII renderer lossless and does not reconstruct complete Shape Cognition streams. This representation replaces the picture's geometry with coordinate stalks; it is not a conventional outline plus a supplementary data panel.

## Equality and observation

For every accepted input `x`, the claim is `decode(render(x)) = x`. Equality means identical object fields, string values, Boolean values, array lengths and ordering, and identical binary64 representations of every number. Object property insertion order, JSON whitespace and numeric spelling (`1` versus `1.0`) are not source variables in the JavaScript data model. Array order IS a source variable. Neither engine equations nor coordinates are changed.

The primary observation is **one complete, reopened, opaque RGB PNG**, at native dimensions. It contains only `IHDR`, `IDAT` and `IEND` chunks. No source text, QR code, watermark, serialized record, alpha channel, hidden color channel, metadata, answer-bearing sidecar or source identifier is written into the image. The sunset is constant. Image dimensions, bed morphology, stalk occupancy and branch geometry are visibly inspectable parts of this representation.

The decoder receives the image and fixed public implementation/rules. It does not receive source arrays, source text, seeds, shape IDs, run IDs, hashes, geometry objects, DOM information, provenance or an original scene. Verification compares the recovered object with the fixture only AFTER the decoder process exits. Fixture names are replaced by `image.png` in its fresh directory.

## Original boundaries, inventoried without claiming support

| Existing boundary | Independent accepted information | Existing visible losses |
| --- | --- | --- |
| `renderCornfieldPaths(paths, options)` | Ordered paths; ordered points; their numeric components; width, height, horizon and decoration seed | Automatic bounds fitting; character rounding; clipping; coordinate projection; merged duplicates and overlaps; no attributes/topology contract |
| `renderCornfieldAscii(stream, options)` | Stream schema, manifest identity, seed, operator list, every shape, all selection steps, active IDs, render conventions; optional shape selection and image settings | Selects a single final/active shape and omits most accepted stream information |
| Each shape | ID, schema, pipeline, stage, numeric conventions, units, coordinate system, geometry, topology, attributes, provenance, depth, tags, created-at step | Tags, provenance, attributes, chronology, identity and much topology are not visibly represented |
| Geometry union | Point `p`; segment/ray `a,b`; disk/ball `center,radius`; polygon `vertices`; curve `controlPoints`; surface `seed`; derived `operation,params` | Ball loses z; curves/circles sampled; some surfaces simplified or empty; derived operations replay approximations |
| Topology | Dimension, node count, ordered edge endpoint pairs including duplicates, component count | Most structural distinctions do not survive drawing |
| Attributes | Color, material, texture, curvature array, ordered symmetry labels, bounds, and arbitrary overrides accepted by the engine | Not reliably visible; overlapping outlines cannot preserve every field |
| Provenance and steps | Operators, parent IDs/order, params, implementation labels; previous-event ID, index, goal ID, candidates/fitness, selected/fitness, candidate count, working set and RNG state | Absent from the picture |
| Prototype wrapper | Source text, derived/explicit seed, requested/executed steps, perception dimensions/populations, stream and output | Heuristic text features plus seeded shape search; **no recurrent network is executed here** |

Current provenance uses `ne-canonical-binary64/v1`: finite binary64, negative zero normalized upstream to positive zero, non-finite values rejected, and explicitly typed strings for higher precision. Existing artistic constructors and fitness computations sometimes round to six decimals. That pre-existing rounding is preserved in the imported baseline; this renderer introduces no rounding of source values. Previously discarded precision cannot be restored.

## Exact new renderer boundary

The root must have **exactly** `schema`, `shapes`, `states`; schema is `visible-cornfield/v1`. No field is silently ignored. No per-run renderer settings are accepted. Public constants live in `rules.json`.

| Field | Accepted values and recovery |
| --- | --- |
| `shapes` | Ordered list of explicit primitive records; duplicates retained as separate occurrences |
| Shape fields | Exactly `geometry`, `topology`, `attributes`, `depth`, `createdAtStep` |
| `geometry.kind` | `point`, `segment`, `ray`, `disk`, `polygon`, `curve`, `ball`, `surface`, `polyline` |
| Point | Exactly `kind,p`; p has 2 or 3 full binary64 coordinates |
| Segment/ray | Exactly `kind,a,b`; endpoints have the same dimension, 2 or 3 |
| Disk/ball | Exactly `kind,center,radius`; disk center 2D, ball center 3D; finite nonnegative radius, including zero |
| Polygon | Exactly `kind,vertices`; ordered 2D or 3D vertices, including repeated/degenerate vertices and empty list |
| Curve | Exactly `kind,controlPoints`; ordered 2D or 3D controls; no curve sampling, including empty/singleton controls |
| Surface | Exactly `kind,seed`; complete numeric seed array, including empty. Recovery of these parameters does not validate the engine's interpretation of a surface |
| Polyline | Exactly `kind,vertices,closed`; ordered 2D or 3D vertices and a Boolean closure flag |
| Topology | Exactly `dimension,nodes,edges,components`; dimension integer 0–3; node/component counts nonnegative safe integers; edges ordered integer pairs indexing nodes. Self-edges, reversed edges and duplicates retained |
| Attributes | Exactly `color,material,texture,curvature,symmetry,bounds` |
| Color | Exact lowercase `#rrggbb`; three visibly represented channel magnitudes, not least-significant pixel channels |
| Material | Exactly `matte` or `glossy`, represented by fixed categorical bed morphology |
| Texture, curvature, bounds | Complete finite scalar / ordered numeric arrays, not recomputed summaries |
| Symmetry | Ordered list, including repeats, from the fixed public list: bilateral, radial, spherical, linear, lattice, radialRotate, dihedral-3 through dihedral-16 |
| `depth` | Integer 0–128; derivation depth is independent of a point's z coordinate |
| `createdAtStep` | Integer 0–2^53−1; preserved as an independent occurrence field |
| `states` | Ordered list of complete numeric vectors; vector position defines neuron index and vector order defines observation index. No neuron is selected or projected away |

Topology is preserved as supplied even when it is inconsistent with geometry; round-trip equality is not a topology-consistency validator. The contract is deliberately explicit about this distinction.

Numbers must be finite binary64. Negative zero is **rejected at this boundary**, rather than silently changed, because project-canonical inputs already have positive zero. NaN and infinities are rejected. Python integers that cannot be represented exactly as binary64 are rejected by the programmatic API. The JSON CLI interprets numeric tokens as JavaScript Number/binary64; decimal lexemes or arbitrary-precision integers are not a separately accepted domain. Unknown fields, IDs, tags, arbitrary strings, arbitrary materials, noncanonical colors, extra attributes and derived DAG records are rejected.

## Visible geometry and its inverse

Each scalar is represented by one stalk in an independently visible, fixed-size orthographic position. These stalks ARE the source-variable representation. There is no second copy of the original artwork or encoded payload beside it. Bed morphology supplies fixed semantic roles, just as different symbols identify different primitives; it does not store record bytes. No JSON serialization is used to create the picture.

For nonzero x there is a unique normalized form:

`x = sign × (2^52 + F) × 2^(e−52)`

with `0 ≤ F < 2^52` and `−1074 ≤ e ≤ 1023`, subject to the existing binary64 subnormal restrictions. The renderer derives this using `as_integer_ratio` and integer shifts/division; it never multiplies a source coordinate by a display scale and rounds the result.

- The tassel leans left for negative and right for positive.
- Thirteen successively finer dyadic coordinate leaves represent the fractional significand. Leaf j is the coefficient at scale `16^−(j+1)`; its visible horizontal extent is `6 + 3d` pixels for d in 0–15.
- Three lower leaves display the exponent's magnitude on the same fixed ruler, with `E=e+1075`, using weights 256, 16 and 1. E=0, positive sign and all-zero fraction leaves uniquely designate positive zero.
- There are no float-bit byte buffers, interleaved records, compressed payloads, color-bit channels or per-image lookups. This is an explicit multi-scale geometric display of a scalar's sign, magnitude and scale. Its practicality comes from displaying the scale hierarchy visibly, not pretending a 53-bit coordinate fits on a single short ruler.
- Points are grouped in fixed two- or three-axis beds. Six 2D points or four 3D points fit in a row; both dimension and every coordinate remain visible. Edges are displayed as ordered endpoint pairs, six per row. Empty lists have a visible empty bed. Shape occurrences and state vectors have distinct beds; a blank separator terminates each state vector.

The independent decoder thresholds visible foreground against the light field, measures branch extents, and uses integer accumulation plus `ldexp` to reconstruct values. It verifies every pixel of each stalk and checks that reconstructed subnormal values reproduce the observed normalized significand/exponent. It does not import renderer helpers. Hue is not needed for inversion. The fixed footer and dimensions check ordinary clipping; this is not authentication against deliberate alteration into another valid image.

## Injectivity argument

1. Distinct supported categorical morphologies have distinct fixed foreground masks. Exhaustive finite morphology checks support the implementation of this finite codebook.
2. Each stalk has a disjoint footprint. Its sign, 16 leaf extents, and occupancy are uniquely measurable; no neighboring point/path can erase them. Consecutive leaf extents differ by three whole pixels and are never anti-aliased in the native raster.
3. Positional expansion of the 13 fraction coefficients and three exponent coefficients is unique. Canonical binary64 normalized form is unique; noncanonical subnormal forms, negative zero and non-finite values are excluded. Thus a valid stalk determines exactly one accepted number, even for adjacent floats.
4. Fixed semantic bed order, point dimension, exact list occupancy, shape-kind morphology and state separators determine the complete accepted object structure. Repeated values, paths and edges occupy repeated positions rather than being merged.
5. Consequently equal native images imply equal accepted input objects. Applying the independent decoder gives the left inverse. PNG's lossless export/reopening preserves those pixel samples.

This is a mathematical argument for the specified discrete construction, **not a machine-checked proof of the Python implementation**, an unrestricted continuous-coordinate linear projection claim, or a proof for all image-processing systems. A full-rank real matrix alone would not prevent rounding and raster collisions; this renderer avoids that argument by constructing integer pixel geometry exactly.

## Capacity and explicit bounds

There are `2047 × 2^53 − 1 = 18,437,736,874,454,810,623` canonical finite binary64 values. A scalar requires nearly 64 bits of distinction. A glyph's 16 sixteen-way branch extents plus its sign provide 65 bits of potential geometric distinctions before invalid combinations are excluded. A single short stalk HEIGHT would not have that capacity; the multi-scale branches are essential.

Fixed tile: 112 × 160 pixels. Fixed image width: 1488. Twelve numeric positions per row. Image height: `64 + 160 × max(1, rows) + 16`. Maximum 240 rows, 2880 numeric entries, 32 shapes, 256 vertices/edges per shape, 32 state vectors, 1200 neurons per vector. These limits interact: structural rows and separators consume rows too. The executable planner checks the **whole** input before allocating an image, and raises `CapacityError` instead of trimming anything. The tested maximum-row example contains 2844 numbers in three vectors.

Maximum accepted image: 1488 × 38480 = 57,258,240 pixels (171,774,720 uncompressed RGB bytes). Raw 24-bit image capacity is an upper bound, not a claim that all bit patterns are used. The constructive stalk argument establishes adequate distinctions for the actual accepted domain. Arrays, history and images cannot be unbounded under this finite operational budget. The image can be very tall: fitting it onto a phone display is a separate, generally lossy observation.

## Upstream integration and unsupported scope

`adapter.js` provides explicit, named extraction routes:

- `extractPrimitiveScene(stream)` retains every supported explicit primitive and its supported topology/attributes/depth/creation step; returns a detailed omission receipt for all other shape fields, derived records and top-level stream fields. It does not claim whole-stream equality.
- `sceneFromPaths(paths)` retains all supplied ordered paths exactly. When these paths came from the old replay, prior sampling/projection is already lossy. The CLI prints that limitation. A source curve's control points cannot be recovered from its sampled polyline through this adapter.
- `sceneFromNeuralStates(states)` snapshots every supplied neuron value. Weights, inputs, integration state, step labels, random generators, network identity and history are outside its boundary.

Full Shape Cognition streams, full neural-engine checkpoints (including the 600×600 recurrent matrix), arbitrary tags/strings and complete provenance/history are **unsupported**, not silently dropped by `render`. Building a representation for those fields is additional work. No impossibility claim is made for every conceivable enlarged geometric representation. Seed-sentence recovery remains unproved and is not claimed; the upstream heuristic numeric text transform has demonstrated collisions.

## Export and observation limits

Native complete RGB PNG is the guarantee. Unchanged lossless reopening/re-export is covered. Other dimensions are explicitly rejected by this decoder; rejection of a 2× nearest-neighbor enlargement is a protocol limitation, not evidence that such enlargement destroyed information. JPEG is assessed empirically and may pass particular samples even though its pixels changed. Screenshots include display scaling, cropping and capture compression; they must be measured separately and receive no inherited native-PNG guarantee. Neither internal SVG parameters nor offscreen content are decoder observations.

References for the underlying representation and export properties: [Python's exact floating-point representations](https://docs.python.org/3/tutorial/floatingpoint.html), [Python math functions](https://docs.python.org/3/library/math.html), and the [W3C PNG specification](https://www.w3.org/TR/png-3/). The injectivity construction and project measurements above are this implementation's work, not results claimed by those references.
