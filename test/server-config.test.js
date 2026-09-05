import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { isAbsolute } from 'node:path';
import { loadServerConfig } from '../src/server-config.js';

const base={THOUGHT_RECEIPT_SECRET:'configuration-secret',THOUGHT_AGENTS_JSON:'{"token":"agent"}'};

test('example configuration runs locally without a Docker-only data directory',()=>{
  const env=parseEnv(readFileSync(new URL('../.env.example',import.meta.url),'utf8'));
  const config=loadServerConfig(env);
  assert.equal(config.host,'127.0.0.1');assert.equal(config.ledgerPath,'thought-ledger.jsonl');assert.equal(isAbsolute(config.ledgerPath),false);
  assert.equal(config.authMode,'local');assert.deepEqual(config.sensory,{thermalTouch:false,sound:false});
});

test('interim deployment defaults to local authentication',()=>{
  const config=loadServerConfig(base);assert.equal(config.authMode,'local');assert.equal(config.agents.token,'agent');assert.equal(config.moltbook,null);assert.equal(config.visualizer,'neural');assert.equal(config.neuralInducerModality,1);assert.deepEqual(config.sensory,{thermalTouch:false,sound:false});
});

test('sensory adapters require independent explicit switches',()=>{
  const config=loadServerConfig({...base,THOUGHT_ENABLE_THERMAL_TOUCH:'1',THOUGHT_ENABLE_SOUND:'0'});
  assert.deepEqual(config.sensory,{thermalTouch:true,sound:false});
  assert.throws(()=>loadServerConfig({...base,THOUGHT_ENABLE_SOUND:'yes'}),/must be 0 or 1/);
});

test('Moltbook authentication activates with one explicit mode switch',()=>{
  const config=loadServerConfig({...base,THOUGHT_AUTH_MODE:'moltbook',MOLTBOOK_APP_KEY:'moltdev_test',MOLTBOOK_AUDIENCE:'thoughts.example'});
  assert.equal(config.authMode,'moltbook');assert.equal(config.moltbook.audience,'thoughts.example');
});

test('invalid deployment configuration fails before listening',()=>{
  assert.throws(()=>loadServerConfig({...base,THOUGHT_AUTH_MODE:'moltbook'}),/MOLTBOOK_APP_KEY/);
  assert.throws(()=>loadServerConfig({...base,PORT:'70000'}),/PORT/);
  assert.throws(()=>loadServerConfig({...base,THOUGHT_AGENTS_JSON:'nope'}),/JSON object/);
  assert.throws(()=>loadServerConfig({...base,THOUGHT_VISUALIZER:'dream'}),/THOUGHT_VISUALIZER/);
});
