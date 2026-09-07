import { join } from 'node:path';
import { tmpdir } from 'node:os';

function optionValue(name) {
  const exact = process.argv.indexOf(name);
  if (exact !== -1) return process.argv[exact + 1];
  const prefix = `${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
}

const host = optionValue('--host');
const port = optionValue('--port');
if (host) process.env.HOST = host;
if (port) process.env.PORT = port;

process.env.THOUGHT_AUTH_MODE ||= 'local';
process.env.THOUGHT_AGENTS_JSON ||= '{"local-preview-token":"local-preview-agent"}';
process.env.THOUGHT_RECEIPT_SECRET ||= 'local-preview-receipt-secret';
process.env.THOUGHT_LEDGER_PATH ||= join(tmpdir(), `not-a-test-preview-${process.pid}.jsonl`);

await import('./intake-server.js');
