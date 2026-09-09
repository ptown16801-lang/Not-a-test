#!/usr/bin/env node

import { runAsciiPrototype } from './prototype.js';

const DEFAULT_TEXT = 'seeing the bright sun evokes feelings of fun while having none.';

function usage() {
  return `Usage: node demo/ascii-engine.js [text] [options]

Options:
  --text <text>    Thought text (positional text also works)
  --seed <number>  Unsigned 32-bit seed; otherwise derived from the text
  --width <number> Cornfield width from 40 to 240 (default 88)
  --height <number> Cornfield height from 18 to 120 (default 32)
  --steps <number> Shape-selection steps from 0 to 24 (default 3)
  --json           Emit a compact JSON result instead of the display
  --help           Show this help

With no text, the original project seed phrase is used.`;
}

function parse(argv) {
  const result = {positionals: []};
  const valueFlags = new Set(['--text', '--seed', '--width', '--height', '--steps']);
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (valueFlags.has(argument)) {
      if (index + 1 >= argv.length) throw new Error(`${argument} requires a value`);
      result[argument.slice(2)] = argv[++index];
    } else if (argument === '--json') result.json = true;
    else if (argument === '--help' || argument === '-h') result.help = true;
    else if (argument.startsWith('--')) throw new Error(`Unknown option: ${argument}`);
    else result.positionals.push(argument);
  }
  return result;
}

try {
  const args = parse(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const text = args.text || args.positionals.join(' ') || DEFAULT_TEXT;
  const number = key => args[key] === undefined ? undefined : Number(args[key]);
  const result = runAsciiPrototype(text, {
    seed: number('seed'), width: number('width'), height: number('height'), steps: number('steps')
  });
  if (args.json) {
    console.log(JSON.stringify({
      schema: result.schema,
      status: result.status,
      scientificOutcome: result.scientificOutcome,
      sourceText: result.sourceText,
      seed: result.seed,
      stepsExecuted: result.stepsExecuted,
      shapeId: result.output.shapeId,
      width: result.output.width,
      height: result.output.height,
      art: result.output.art,
      qualification: result.output.qualification
    }, null, 2));
  } else {
    console.log(`Thought: ${result.sourceText}`);
    console.log(`Seed: ${result.seed} | Steps: ${result.stepsExecuted} | Shape: ${result.output.shapeId}`);
    console.log('Mode: direct ASCII cornfield prototype; scientific outcome not tested');
    console.log(result.output.art);
  }
} catch (error) {
  console.error(`ASCII prototype error: ${error.message}`);
  console.error(usage());
  process.exitCode = 1;
}
