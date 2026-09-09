#!/usr/bin/env node

import { createServer } from 'node:http';
import { runAsciiPrototype } from './prototype.js';

export const DEFAULT_TEXT = 'seeing the bright sun evokes feelings of fun while having none.';

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Neural Engine — ASCII Cornfield</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #160f08; color: #f5d285; }
    main { width: min(1180px, 100%); margin: auto; padding: 20px; }
    h1 { margin: 0 0 6px; font-size: clamp(1.25rem, 4vw, 2rem); }
    .subtitle { margin: 0 0 16px; color: #c8a963; }
    form { display: grid; grid-template-columns: 1fr repeat(3, minmax(82px, 110px)) auto; gap: 10px; align-items: end; }
    label { display: grid; gap: 5px; color: #d7be83; font-size: .82rem; }
    input, textarea, button { font: inherit; border: 1px solid #86662e; border-radius: 6px; }
    input, textarea { width: 100%; padding: 9px; background: #24190e; color: #ffe5a5; }
    textarea { min-height: 62px; resize: vertical; }
    button { padding: 10px 15px; background: #b06b21; color: #fff4d2; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    .status { min-height: 1.4em; margin: 12px 0 5px; color: #d9bb75; overflow-wrap: anywhere; }
    pre { margin: 0; padding: 15px; overflow: auto; min-height: 420px; border: 1px solid #6c5426; border-radius: 8px; background: #0c1208; color: #e1c15e; line-height: 1; font-size: clamp(7px, 1.05vw, 12px); }
    .boundary { margin-top: 10px; color: #9e8a5b; font-size: .78rem; }
    @media (max-width: 760px) { form { grid-template-columns: 1fr 1fr; } .thought { grid-column: 1 / -1; } button { grid-column: 1 / -1; } }
  </style>
</head>
<body>
  <main>
    <h1>Neural Engine: ASCII Cornfield</h1>
    <p class="subtitle">A deterministic thought-to-shape prototype in the cornfield.</p>
    <form id="controls">
      <label class="thought">Thought<textarea id="text" required>${DEFAULT_TEXT}</textarea></label>
      <label>Width<input id="width" type="number" min="40" max="240" value="88"></label>
      <label>Height<input id="height" type="number" min="18" max="120" value="32"></label>
      <label>Steps<input id="steps" type="number" min="0" max="24" value="3"></label>
      <button id="render" type="submit">Render thought</button>
    </form>
    <div class="status" id="status">Starting…</div>
    <pre id="output" aria-label="ASCII cornfield output"></pre>
    <div class="boundary">Artistic/debug output. Scientific outcome: not tested. No dirt-renderer dependency.</div>
  </main>
  <script>
    const form = document.querySelector('#controls');
    const button = document.querySelector('#render');
    const status = document.querySelector('#status');
    const output = document.querySelector('#output');
    async function render(event) {
      event?.preventDefault();
      button.disabled = true;
      status.textContent = 'Rendering…';
      try {
        const response = await fetch('/api/render', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({
          text: document.querySelector('#text').value,
          width: Number(document.querySelector('#width').value),
          height: Number(document.querySelector('#height').value),
          steps: Number(document.querySelector('#steps').value)
        })});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Render failed');
        output.textContent = result.art;
        status.textContent = 'Seed ' + result.seed + ' · ' + result.stepsExecuted + ' steps · ' + result.shapeId;
      } catch (error) {
        output.textContent = '';
        status.textContent = 'Error: ' + error.message;
      } finally { button.disabled = false; }
    }
    form.addEventListener('submit', render);
    render();
  </script>
</body>
</html>`;

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store'});
  response.end(body);
}

export function createAsciiCornfieldServer() {
  return createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(page), 'cache-control': 'no-store'});
      response.end(page);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, {ok: true, service: 'ascii-cornfield'});
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/render') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) request.destroy(new Error('request body too large'));
      });
      request.on('end', () => {
        try {
          const input = JSON.parse(body || '{}');
          const result = runAsciiPrototype(input.text, {
            seed: input.seed, width: input.width, height: input.height, steps: input.steps
          });
          json(response, 200, {
            schema: result.schema, seed: result.seed, stepsExecuted: result.stepsExecuted,
            shapeId: result.output.shapeId, art: result.output.art,
            scientificOutcome: result.scientificOutcome
          });
        } catch (error) {
          json(response, 400, {error: error.message});
        }
      });
      return;
    }
    json(response, 404, {error: 'not found'});
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const argument = name => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const host = argument('--host') || process.env.ASCII_CORNFIELD_HOST || '127.0.0.1';
  const port = Number(argument('--port') || process.env.ASCII_CORNFIELD_PORT || 4317);
  const server = createAsciiCornfieldServer();
  server.listen(port, host, () => console.log(`ASCII cornfield running at http://${host}:${port}`));
}
