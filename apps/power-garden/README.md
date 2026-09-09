# Power Garden

A new standalone renderer for exact, visible binary64 geometry and numeric
state vectors. The image is a cornfield of signed power-of-two components.
No previous engine or renderer is imported. No data is hidden in color bits,
metadata, watermarks, text, QR codes, or sidecars.

This is a geometric diagram of the accepted source parameters. It does not
recreate the perspective silhouette of a Shape Cognition stream. Complete
engine checkpoints, derived operation DAGs, arbitrary tags/attributes and
history are unsupported. See [CONTRACT.md](CONTRACT.md) before integrating it.

## Run

Requires Python 3.10+ with Pillow and Node 24+. Tested with Python 3.12.13,
Pillow 12.3.0, and Node 24.19.0. There is no web server or network dependency
at runtime. Installation requires obtaining dependencies if absent.

From the repository or the extracted distribution root:

```sh
python -m pip install -r apps/power-garden/requirements.txt
python apps/power-garden/app.py plan research/power-garden/results/run-02/display-sample.input.json
python apps/power-garden/app.py render research/power-garden/results/run-02/display-sample.input.json /tmp/power-garden.png
python apps/power-garden/app.py decode /tmp/power-garden.png > /tmp/recovered.json
```

Use an unused output filename; rendering never overwrites an existing file.
The decode command launches a fresh process in a temporary directory, allowing
file reads only for a generically named image and the fixed public inverse.
Its stdin is closed. No fixture, source object or source filename is supplied.
The inverse itself is self-contained and uses only built-in Node modules.

Open the generated PNG in a local image viewer at 100% for a working static
preview. A native desktop viewer with scrolling and a pixel-only decode button
is also implemented:

```sh
python apps/power-garden/app.py preview /tmp/power-garden.png
```

The desktop window requires Tk and a desktop display. It could not be executed
in the delivery environment, which has no display server. Actual screenshot
capture was also blocked by the browser connection. These are untested parts;
the included static PNGs and command-line rendering/decoding were executed.
Scrolling inspects the image; a cropped viewport is not the complete recovery
observation. Do not infer recovery from an offscreen portion.

## Use saved source data

The integration layer reads data files; it never calls an engine. Explicit
primitive extraction creates a scene and an omission receipt:

```sh
python apps/power-garden/extract.py primitives saved-stream.json scene.json omissions.json
python apps/power-garden/extract.py states saved-record.json states.json omissions.json --path record.payload.states
```

Primitive extraction retains geometry, topology, supported attributes, depth
and creation step for every supported primitive occurrence. Derived records,
IDs, tags and other fields are listed as omissions. Unsupported attributes
abort extraction. Receipts are evidence for the caller and are never available
to the inverse. Root `render` accepts only the exact contract and rejects extra
fields; it does not perform implicit subset extraction.

## Reproduce the evidence

```sh
python research/power-garden/validate.py --output /tmp/power-garden-validation-new
```

Choose a new output directory. The final harness includes the corrected
capacity expectation. The original run and its failed test expectation are
retained under `results/run-01`; corrected checks are under `followup-01`.
The renderer and boundary validator are unchanged. A later interface check
found a large-integer JSON formatting defect in the inverse; that failure is
also preserved. The serializer was repaired and the comparator strengthened.
The final full run (`run-02`) has 47/47 native cases, 66 passing assertions,
zero failed assertions, and 39 separately measured altered-image cases.
Eight earlier targeted follow-up checks also passed. Histories are generated
with the repository's existing append-only maintenance tool.

Three saved 600-neuron vectors round-tripped exactly. The actual maximum test
recovered 2,382 values from a 1712×35280 PNG; 2,383 were rejected before writing.
This does not support a 600×600 weight matrix, a complete engine checkpoint,
or original seed-sentence recovery. JPEG and resizing results are empirical,
not extensions of the native guarantee. Deliberately removing a complete leaf
can change a number into another valid number without detection.

The full research analysis, source references, limitations and measurements
are in `research/power-garden/REPORT.md`.
