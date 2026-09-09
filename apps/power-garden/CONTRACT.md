# Power Garden reconstruction contract

This is a new standalone Python raster application and a separately implemented
JavaScript pixel inverse. It imports and executes no preceding neural engine,
shape engine, renderer, projection, text transform or provenance implementation.
Prior files are evidence and input fixtures only. The dirt renderer is excluded.

## Exact observation and equality

For every accepted input, `decode(render(x)) = x`. The observation is one
complete native 1712-pixel-wide opaque RGB PNG. Height is `80 + 88 R`, where R
is the number of semantic rows (1–400). Only actual visible RGB samples and
fixed public rules enter the inverse. No seed, original object, answer lookup,
array, identifier, hash, SVG parameters, per-image configuration or sidecar is
available to it. The forward writer emits IHDR, IDAT and IEND only. The inverse
ignores ancillary chunks, so metadata cannot supply answers.

Equality preserves every accepted object field, array boundary, array order,
duplicate, category, Boolean and binary64 bit pattern, including signed zero.
Object insertion order and JSON spelling/whitespace are not part of the data
model. There is no quantization, source coordinate rounding, geometric fitting,
curve sampling, projection or change to a neural equation. Inexact conversion
of Python integers to binary64 is rejected. JSON decimal literals denote
binary64 values; arbitrary-precision decimal spelling is not accepted precision.
Integral JSON literals must convert exactly; `-0` and `-0.0` retain their sign.
NaN and infinities are unsupported and rejected. Signed zero in structural
integers is rejected; signed zero in real-valued fields is preserved.

## Renderer boundary

The root has exactly `schema`, `shapes`, `states`. Schema is `power-garden/v1`.
There are no per-run rendering options. Unknown keys are errors.

| Field | Exact accepted domain |
| --- | --- |
| shapes | Ordered list, at most 32 occurrences; identical shapes remain distinct occurrences |
| Each shape | Exactly geometry, topology, attributes, depth, createdAtStep |
| depth | Structural integer 0–128, independent of geometric z |
| createdAtStep | Structural integer 0–2^53−1 |
| point | geometry exactly kind,p; p is a 2D or 3D numeric point |
| segment/ray | Exactly kind,a,b; endpoints of matching dimension 2 or 3 |
| disk/ball | Exactly kind,center,radius; disk is 2D, ball 3D; nonnegative finite radius |
| polygon | Exactly kind,vertices; complete ordered 2D/3D vertices |
| curve | Exactly kind,controlPoints; complete ordered 2D/3D control points, without evaluating a curve |
| surface | Exactly kind,seed; complete ordered finite numeric seed array; no claim about surface interpretation |
| polyline | Exactly kind,vertices,closed; ordered 2D/3D vertices, Boolean closure |
| topology | Exactly dimension,nodes,edges,components; dimension 0–3; counts 0–2^53−1; ordered edge endpoint pairs indexing nodes, at most 1024 edges |
| attributes | Exactly color,material,texture,curvature,symmetry,bounds |
| color | Lowercase #rrggbb, represented by three visible numeric component plants; no pixel color channel carries data |
| material | matte or glossy, represented by the visible categorical row morphology |
| texture | Complete finite binary64 scalar |
| curvature, bounds | Complete ordered finite binary64 arrays; never recomputed |
| symmetry | Ordered list, at most 128, including duplicates, from bilateral, radial, spherical, linear, lattice, radialRotate, dihedral-3 through dihedral-16 |
| states | At most 16 ordered numeric state vectors; every element is represented, no projection or selected neuron |

Lists may be empty. Repeated vertices, zero-length segments, zero radii,
self-edges, duplicate/reversed edges and contradictory supplied topology are
preserved. This is a representation contract, not a geometric validity theorem.
Empty coordinate lists have no dimension field in this boundary and use the
fixed empty-list convention. Every nonempty point list has uniform dimension.
The global 400-row capacity supersedes list maxima. Numeric arrays and point
lists have an additional 2400-entry parser guard; oversized inputs are errors.

## Visible mapping

Every finite binary64 magnitude is an exact sum of distinct powers of two:

`abs(x) = Σ b[p] × 2^p`, for `p = −1074,…,1023`, `b[p] ∈ {0,1}`.

One source variable is one plant of 33 connected-scale stalks. Each stalk has
64 fixed vertical levels. At stalk j and level k the absolute physical scale
is `p = 1023 − 64j − k`. The last 14 positions are invalid. A horizontal leaf
exists exactly when the additive component at that scale exists. All leaves
lean right for positive values and left for negative values. Tassels preserve
the sign even for zero. There is no exponent field, float byte buffer, normalized
mantissa payload, interleaved record stream or serialization-to-image step.
Each leaf has the explicit mathematical meaning of one signed geometric
component. The full plant is the scalar representation, not a second data panel
alongside an otherwise lossy artwork. This is an exact diagram of numbers and
geometry parameters, not a perspective silhouette of the original shapes.

Each plant occupies 272×88 pixels. Stalk j is at x=4+8j, from y=8 to 78;
its tassel spans (x,8) to (x±3,5). A component leaf spans (x,12+k) to
(x±3,12+k). The baseline is y=80, x=1…267. All arithmetic determining
pixel positions is integer arithmetic. Pixels are opaque, without antialiasing.

The six plants in a semantic row occupy columns starting at x=64+272c.
Rows start at y=64+88r. A left categorical corn stalk identifies the row's
meaning: x=20…22, y=74−2t…74, with a baseline x=16…26,y=77,
for role t. These finite categorical structures and group separators belong
to the source representation. They are not arbitrary strings or a payload header.

| Role | Meaning |
| --- | --- |
| 1–9 | point, segment, ray, disk, ball, polygon, curve, surface, polyline; depth and creation step, plus closure for polyline |
| 10,11 | Ordered 2D or 3D points; pairs or triples stay together |
| 12,13 | Surface seeds; radius |
| 14,15 | Topology dimension/node/component counts; ordered endpoint pairs |
| 16,17 | Matte/glossy attributes; red,green,blue,texture plants |
| 18,19,20 | Curvature; symmetry categories in the fixed listed order; bounds |
| 21 | Shape end |
| 22,23,24 | State start; complete ordered values; state end |
| 25 | Scene end |

Repeated rows continue an array, with six plants in every nonfinal row. The
last row's occupancy gives the exact length. Empty arrays have one empty row.
No object is selected as the final winner. Every accepted occurrence is visible.
Fixed sunset decoration occupies only the top 64 pixels; it cannot cover data.
The fixed bottom border checks ordinary clipping. No decoration carries a
state-dependent variable. Color is unnecessary for inversion: the public
threshold is `R+G+B < 300`. The native colors are safely on opposite sides.

## Injectivity and capacity

Distinct binary64 values have distinct signed finite dyadic expansions. The
two zeros have different tassels. Different coefficients change a visible
leaf in a disjoint footprint. No leaf is occluded by another stalk, row or
object. An unchanged pixel mask uniquely determines all coefficients and sign.
The inverse accumulates an integer `Q = Σ b[p] × 2^(p+1074)` and rejects sums
that are not exactly representable as binary64. It independently reconstructs
the value from Q. Disjoint semantic groups, exact occupancy, delimiters and
categorical roles then determine one accepted object. Thus equal images imply
equal accepted inputs. Lossless PNG export/reopening preserves that implication.

This is a mathematical argument for the stated construction, not a formal
proof of either program or a universal claim about photographs and screenshots.
The implementation must still be tested independently.

The finite binary64 domain including both zeros has `2047 × 2^53` members.
Each unrestricted scalar needs `log2(2047 × 2^53) ≈ 63.9993` bits of distinction.
This construction allocates 2098 visible component sites plus sign, using only
the valid binary64 subset; it favors transparent fixed scales over compression.
At most 53 component leaves are present in a nonzero binary64 plant.

Maximum image: 1712×35280 = 60,399,360 pixels; 181,198,080 uncompressed RGB
bytes. A single vector can hold 2382 numbers within 400 rows (including its
start/end and the scene end). This is an operational limit, not an information
theoretic optimum. Repeated shape structure consumes additional rows. The
planner validates the whole input before writing; it never clips or truncates.
An unlimited history cannot fit in a fixed finite image. A 600×600 matrix would
need at least 360,000 plants, 60,000 numeric rows and about 9.04 billion pixels
in this layout, before structural rows. It is unsupported by this implementation.

## Actual project and excluded scope

The earlier ASCII boundary accepts ordered paths and width,height,horizon,seed
options; fitting destroys absolute position/scale, rasterization merges nearby
coordinates/duplicates and projection removes depth. Its stream wrapper also
accepts schema, seed, operator list, every shape, selection steps, active IDs,
render conventions and an optional selected shape ID. That larger boundary is
not preserved by either the ASCII picture or this narrower new API.

Original shape records additionally carry IDs, tags, pipeline/stage/unit/numeric
conventions, coordinate system, provenance parents/operators/params, and derived
operation records. Stream steps additionally carry previous-event identity,
goal, candidate fitness, selection fitness/count, working set and random state.
The text prototype includes source text, seed, perception and requested/run steps.
Arbitrary attribute overrides and typed higher-precision strings are possible
upstream. These are explicitly unsupported here; complete streams are rejected.

Saved primitive extraction and numeric-state extraction are named, separately
documented operations with omission receipts. They do not make the whole source
stream or neural checkpoint lossless. A state vector is not weights, inputs,
integration settings, optimizer, RNG state or history. No original sentence
recovery is claimed. The earlier text prototype used heuristic features and a
seeded shape search, not the recurrent network. Its existing rounding and
canonical positive-zero convention precede this renderer and cannot be undone.

Screenshots, resizing, JPEG, crop recovery, arbitrary PNG variants and human
readability at fit-to-screen scale receive no native guarantee. Exact integer
nearest-neighbor enlargement is reversible in principle; a fixed-dimension
decoder rejecting it does not prove information loss. Altering an entire leaf
can produce a different valid number: this is not authentication or an error
correcting code. Verification hashes remain outside the image and inverse.
