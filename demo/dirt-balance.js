import { readFile, writeFile } from 'node:fs/promises';
import { renderDirtInscription } from '../src/dirt-renderer.js';

const source=JSON.parse(await readFile(new URL('./balance-output.json',import.meta.url),'utf8'));
const output=renderDirtInscription(source,{lengthM:30,widthM:2.4,minTurningRadiusM:.08,maxPathDensity:.12,fade:{mode:'ttl',afterSeconds:86400},stego:{agentId:'balance-agent',sequenceStart:1,carrier:'jpeg-watermark',keyId:'field-key-v1'}});
await writeFile(new URL('./dirt-balance-output.json',import.meta.url),JSON.stringify(output,null,2));
console.log(JSON.stringify({schema:output.schema,stats:output.stats,output:'demo/dirt-balance-output.json'},null,2));
