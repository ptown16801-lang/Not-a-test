# Exact visible cornfield renderer

The renderer and independent decoder recover every field in the declared primitive-geometry / numeric-state contract from one complete native PNG. **Complete engine streams and seed sentences are not supported.** Read `CONTRACT.md` for the field inventory, mathematical argument and limits; the executed report is `research/lossless-visible/REPORT.md`.

From the repository root, using Python 3.12 and Node 24 (the tested versions):

```bash
python3 -m pip install -r prototypes/lossless-cornfield/requirements.txt

python3 prototypes/lossless-cornfield/render.py \
  research/lossless-visible/fixtures/saved-balance-primitives.json \
  /tmp/visible-balance.png

python3 -I prototypes/lossless-cornfield/decode.py \
  /tmp/visible-balance.png > /tmp/recovered-balance.json
```

The image alone supplies the inverse's state-dependent information. `rules.json` is public, fixed and identical for all runs. Its location is relative to `decode.py`; include both files when moving the decoder. Tests copy only those two files plus `image.png` into an empty temporary directory and close standard input. A post-bootstrap audit guard permits only image reads and rejects networking, subprocess creation and filesystem searches.

Use the Node bridge with an exact scene:

```bash
node prototypes/lossless-cornfield/cli.js scene \
  research/lossless-visible/fixtures/fresh-neural-600.json /tmp/neural-600.png
```

Explicitly extract supported primitives from an existing saved stream:

```bash
node prototypes/lossless-cornfield/cli.js primitives \
  demo/balance-output.json /tmp/primitives.png
```

That command prints an omission receipt. It is a partial extraction of the source stream; it does not silently redefine whole-stream recovery. The `ascii-paths` command similarly prints that its exact input is **after** the old lossy path replay, and that no neural network is executed by the ASCII prototype:

```bash
node prototypes/lossless-cornfield/cli.js ascii-paths \
  "seeing the bright sun evokes feelings of fun while having none." /tmp/paths.png
```

Run the evidence suite; the shipped project fixtures are sufficient, including saved Phase 1/2 states and three freshly executed 600-neuron snapshots:

```bash
NE_VISIBLE_RESULTS=/tmp/visible-test-results \
  python3 research/lossless-visible/test_renderer.py

node --test --test-reporter=tap test/ascii-prototype.test.js
```

Using a new result directory preserves the original evidence. The default suite path writes `research/lossless-visible/results`; use the environment override for subsequent investigations. The initial failed preview attempts and the first successful test execution are retained in the committed evidence. Rerunning the suite is about three minutes in the tested environment, with transient memory use substantially exceeding the PNG file sizes.

Start the local working preview:

```bash
python3 prototypes/lossless-cornfield/preview.py
```

Open `http://127.0.0.1:4329` on the machine running the server. The example selector, native-pixel toggle, PNG download and independent decoder button were exercised. A fitted image on screen is a different observation from the complete native PNG. The preview's decoder button reads the PNG, **not** a screenshot.

The optional supervised browser QA setup stages byte-identical samples and fixed dependencies inside the restricted checkout:

```bash
python3 prototypes/lossless-cornfield/prepare-preview.py --vendor-dependencies
```

`samples/` and `vendor/` are generated and ignored. The normal CLI uses installed NumPy/Pillow; the restricted browser preview can fall back to its fixed `/site/vendor` dependency directory. No input fixture or answer record is installed there.

No dirt-inscription dependency, engine-equation change, automatic fitting, coordinate rounding, SVG-parameter recovery, hidden channel, steganography, or source-text overlay is involved. The native representation is intentionally larger and visually different from the old artistic outline.
