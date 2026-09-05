import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileThoughtSubmission, UNBOUNDED_THOUGHT_LIMITS, validateThoughtSubmission } from '../src/thought-intake.js';
import { ThoughtIntakeService, createThoughtIntakeServer } from '../src/thought-gateway.js';

const submission=()=>({schema:'thought-intake/v1',concept:'cooperation under uncertainty',publicRationale:'Distinct paths converge.',nodes:[
  {id:'seed',primitive:{kind:'segment',args:{a:[0,0],b:[.8,0]}}},
  {id:'spiral',operator:'morph',parents:['seed'],params:{parameters:{kind:'logarithmicSpiral',turns:3,growth:.14,startRadius:.05,samples:120}}},
  {id:'root',operator:'replicateArrange',parents:['spiral'],params:{count:5,arrangement:'radialRotate',radius:.1}}
],root:'root'});

test('agent submissions compile deterministically through legal operators',()=>{
  const a=compileThoughtSubmission(submission()),b=compileThoughtSubmission(submission());
  assert.equal(a.root.id,b.root.id);assert.equal(a.nodes.size,3);assert.equal(a.root.provenance.operator,'replicateArrange');
});

test('intake rejects forward parents and browser-exhausting replicas',()=>{
  const forward=submission();forward.nodes[1].parents=['root'];assert.throws(()=>validateThoughtSubmission(forward),/forward parent/);
  const huge=submission();huge.nodes[2].params.count=10000;assert.throws(()=>validateThoughtSubmission(huge),/replica count/);
});

test('trusted server policy can remove creative count limits',()=>{
  const expanded=submission();expanded.nodes[2].params.count=10000;
  assert.doesNotThrow(()=>validateThoughtSubmission(expanded,{resourcePolicy:UNBOUNDED_THOUGHT_LIMITS}));
});

test('sensory payloads are validated but remain disabled by default',()=>{
  const thermal={...submission(),perception:{schema:'sensory-perception/v1',kind:'thermal-touch',temperatureF:105}};
  const sound={...submission(),perception:{schema:'sensory-perception/v1',kind:'sound',sampleRateHz:8000,samples:Array(64).fill(0)}};
  assert.doesNotThrow(()=>validateThoughtSubmission(thermal));assert.doesNotThrow(()=>validateThoughtSubmission(sound));
  const invalid={...sound,perception:{...sound.perception,samples:[...sound.perception.samples.slice(0,63),2]}};assert.throws(()=>validateThoughtSubmission(invalid),/normalized PCM/);
  const service=new ThoughtIntakeService({agents:{token:'agent'},receiptSecret:'test-secret-123456789'});
  assert.throws(()=>service.submit('token',thermal),error=>error.code==='feature_disabled');
  assert.throws(()=>service.submit('token',sound),error=>error.code==='feature_disabled');
});

test('thermal touch and sound activate independently with explicit switches',()=>{
  const thermal={...submission(),perception:{schema:'sensory-perception/v1',kind:'thermal-touch',temperatureF:35}};
  const sound={...submission(),perception:{schema:'sensory-perception/v1',kind:'sound',sampleRateHz:8000,samples:Array(64).fill(0)}};
  const service=new ThoughtIntakeService({agents:{token:'agent'},receiptSecret:'test-secret-123456789',sensory:{thermalTouch:true,sound:false}});
  assert.equal(service.submit('token',thermal).receipt.sequence,1);assert.throws(()=>service.submit('token',sound),error=>error.code==='feature_disabled');
});

test('gateway authenticates, sequences, signs, and appends receipts',()=>{
  const ledger=join(mkdtempSync(join(tmpdir(),'thought-intake-')),'ledger.jsonl');
  const service=new ThoughtIntakeService({agents:{'agent-token':'grok'},receiptSecret:'test-secret-123456789',ledgerPath:ledger,clock:()=> '2026-09-04T00:00:00.000Z'});
  const first=service.submit('agent-token',submission()),second=service.submit('agent-token',submission());
  assert.equal(first.receipt.agentId,'grok');assert.equal(first.receipt.sequence,1);assert.equal(second.receipt.sequence,2);assert.ok(service.verify(first.receipt));assert.throws(()=>service.submit('wrong',submission()),/credential/);
  assert.equal(readFileSync(ledger,'utf8').trim().split('\n').length,2);
  const restarted=new ThoughtIntakeService({agents:{'agent-token':'grok'},receiptSecret:'test-secret-123456789',ledgerPath:ledger,clock:()=> '2026-09-04T00:00:01.000Z'});
  assert.equal(restarted.submit('agent-token',submission()).receipt.sequence,3);
});

test('gateway refuses a tampered persistent ledger',()=>{
  const ledger=join(mkdtempSync(join(tmpdir(),'thought-tamper-')),'ledger.jsonl');
  const service=new ThoughtIntakeService({agents:{token:'agent'},receiptSecret:'test-secret-123456789',ledgerPath:ledger});service.submit('token',submission());
  const record=JSON.parse(readFileSync(ledger,'utf8'));record.sequence=999;writeFileSync(ledger,JSON.stringify(record)+'\n');
  assert.throws(()=>new ThoughtIntakeService({agents:{token:'agent'},receiptSecret:'test-secret-123456789',ledgerPath:ledger}),/signature is invalid/);
});

test('HTTP tool endpoint accepts an authenticated geometric thought',async()=>{
  const service=new ThoughtIntakeService({agents:{token:'claude'},receiptSecret:'test-secret-123456789',clock:()=> '2026-09-04T00:00:00.000Z'});
  const server=createThoughtIntakeServer(service,{browserHtml:'<main>Thought gallery</main>'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{
    const page=await fetch(`http://127.0.0.1:${port}/`).then(r=>r.text());assert.match(page,/Thought gallery/);
    const tool=await fetch(`http://127.0.0.1:${port}/v1/tool-schema`).then(r=>r.json());assert.equal(tool.name,'submit_geometric_thought');
    const response=await fetch(`http://127.0.0.1:${port}/v1/thoughts`,{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(submission())});
    assert.equal(response.status,201);const result=await response.json();assert.equal(result.receipt.agentId,'claude');assert.equal(result.receipt.sequence,1);
    const gallery=await fetch(`http://127.0.0.1:${port}/v1/gallery`).then(r=>r.json());assert.equal(gallery.thoughts.length,1);assert.ok(gallery.thoughts[0].paths.length>=5);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
