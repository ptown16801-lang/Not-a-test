# Rudimentary ASCII Cornfield Engine

This is a small, deterministic vertical slice of the artistic Shape Cognition
pipeline. It accepts text, derives the existing heuristic perceptual profile,
seeds immutable shapes, runs the existing shape-selection engine, replays the
selected shape's provenance directly into 2-D paths, and draws the result in a
terminal cornfield scene.

The scene contains the project’s centered sun, horizon, perspective corn rows,
and central opening. It is monochrome ASCII, so amber sky color, six-foot real
scale, breeze animation, and cloud animation are not yet represented.

The prototype does **not** import or call the dirt-inscription renderer. It does
not create soil/density calculations, actuator commands, steganography, recurrent
network runs, training, or information-retention measurements. Its scientific
outcome is `not-tested`; the display is an approximate artistic/debug view.

Run the original seed phrase:

```sh
node prototypes/ascii-cornfield/cli.js
```

Run a new thought at a chosen size and seed:

```sh
node prototypes/ascii-cornfield/cli.js --text "bright calm circle" --width 90 --height 34 --seed 42
```

Emit a compact machine-readable result:

```sh
node prototypes/ascii-cornfield/cli.js --text "bright calm circle" --json
```

Open the interactive local executable:

```sh
node prototypes/ascii-cornfield/server.js
```

Then visit `http://127.0.0.1:4317`.

Run only the prototype tests:

```sh
node --test test/ascii-prototype.test.js
```

The executable folder is dependency-free and carries an exact local snapshot of
the required Shape Cognition, text-perception, and SHA-256 provenance modules so
the preview remains portable and does not depend on the dirt-renderer pipeline.
