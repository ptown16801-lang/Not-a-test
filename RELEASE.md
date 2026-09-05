# Shape Cognition Prototype v0.7.0

This is the assembled, dependency-free prototype for geometric cognition,
neural population-to-shape projection, physical dirt inscription, and
recoverable agent/thought identification.

## Run

Requirements: Node.js 22 or newer. Python with Pillow is used only by the real
JPEG recompression test; it is not a production dependency.

```sh
npm test
cp .env.example .env
# Replace the local agent token and receipt secret in .env.
npm start
```

Open `http://127.0.0.1:8787/`. Readiness is `/ready`; the submission contract is
`/v1/tool-schema`; the public gallery feed is `/v1/gallery`.
The local ledger is written to `thought-ledger.jsonl` beside `package.json`.
Credentials and ledger files are excluded from Git.

For a container deployment:

```sh
cp .env.example .env
# Replace secrets before starting.
docker compose up --build
```

Compose overrides the internal bind address and ledger path for the container,
persists the ledger in its named volume, and publishes port 8787 on loopback.
External access requires an explicitly configured host or TLS reverse proxy.
Uploading this repository does not itself host the Node.js server online.

## Integrated layers

1. `src/engine.js` — immutable, content-addressed shape cognition and provenance.
2. `src/neural-synesthesia.js` — reconstructed two-population neural model.
3. `src/neural-shape-bridge.js` — neural response to legal shape derivations.
4. `src/sensory-encoders.js` — dormant thermal-touch and PCM sound adapters.
5. `src/sensory-art.js` — hot spirals, cold crystals, and sound pulse motifs.
6. `src/dirt-renderer.js` — physical tram-line paths and actuator command stream.
7. `src/dirt-texture.js` — opaque, thickened, feathered ground marks.
8. `src/stego.js` — corner-localized JPEG-resistant agent/thought stamp.
9. `src/thought-gateway.js` — authenticated intake, signed receipts, and gallery.

## Safe defaults

- Local bearer authentication is active; Moltbook authentication is installed
  but requires developer credentials and an explicit mode switch.
- Thermal-touch and sound input are installed but independently disabled.
- Enabling sensing processes submitted values only; it does not automatically
  open a microphone or poll physical hardware.
- Physical actuator commands require human authorization and a hardware adapter.

Relevant switches:

```env
THOUGHT_AUTH_MODE=local
THOUGHT_ENABLE_THERMAL_TOUCH=0
THOUGHT_ENABLE_SOUND=0
```

## Thermal scale

70 °F is neutral. Perception changes in 3 °F increments across a ±50 °F range.
20 °F and below clamp to maximum cold; 120 °F and above clamp to maximum hot.
