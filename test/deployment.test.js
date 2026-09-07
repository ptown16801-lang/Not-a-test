import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const projectRoot=new URL('..',import.meta.url).pathname;
const submission=readFileSync(new URL('../demo/thought-submission.json',import.meta.url),'utf8');

async function startDeployment(ledgerPath,overrides={}){
  const child=spawn(process.execPath,['demo/intake-server.js'],{cwd:projectRoot,env:{...process.env,HOST:'127.0.0.1',PORT:'0',THOUGHT_AUTH_MODE:'',THOUGHT_AGENTS_JSON:'{"deployment-token":"deployment-agent"}',THOUGHT_RECEIPT_SECRET:'deployment-secret-123456',THOUGHT_LEDGER_PATH:ledgerPath,...overrides},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`deployment start timed out: ${stderr}`)),5000);
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`deployment exited ${code}: ${stderr}`));});
    child.stdout.on('data',chunk=>{stdout+=chunk;const match=stdout.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  return {child,base:`http://127.0.0.1:${port}`};
}

async function stopDeployment(child){child.kill('SIGTERM');await once(child,'exit');}

test('deployment serves gallery, text renderer, accepts a thought, and resumes sequence after restart',async()=>{
  const ledgerPath=join(mkdtempSync(join(tmpdir(),'thought-deploy-')),'ledger.jsonl');
  let deployment=await startDeployment(ledgerPath);
  try{
    const health=await fetch(`${deployment.base}/ready`);assert.equal(health.status,200);const ready=await health.json();assert.equal(ready.authMode,'local');assert.equal(ready.visualization,'neural');assert.deepEqual(ready.capabilities,{thermalTouch:false,sound:false,textSeedRendering:true});
    const page=await fetch(`${deployment.base}/`);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src/);

    const render=await fetch(`${deployment.base}/v1/render-text`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'The ducks in the park are free, i have forty of them'})});
    assert.equal(render.status,200);const rendered=await render.json();assert.equal(rendered.schema,'text-seed-render/v1');assert.equal(rendered.perception.quantity,40);assert.ok(rendered.paths.length>0);assert.equal(rendered.neuralPopulations.length,2);

    const rejected=await fetch(`${deployment.base}/v1/thoughts`,{method:'POST',headers:{authorization:'Bearer deployment-token'},body:submission});assert.equal(rejected.status,415);
    const accepted=await fetch(`${deployment.base}/v1/thoughts`,{method:'POST',headers:{authorization:'Bearer deployment-token','content-type':'application/json'},body:submission});assert.equal(accepted.status,201);assert.equal((await accepted.json()).receipt.sequence,1);
    const gallery=await fetch(`${deployment.base}/v1/gallery`).then(r=>r.json());assert.equal(gallery.thoughts.length,1);assert.equal(gallery.thoughts[0].visualization.mode,'neural');assert.equal(gallery.thoughts[0].visualization.populations.length,2);assert.notEqual(gallery.thoughts[0].shapeId,gallery.thoughts[0].displayShapeId);
  }finally{await stopDeployment(deployment.child);}
  deployment=await startDeployment(ledgerPath);
  try{
    const accepted=await fetch(`${deployment.base}/v1/thoughts`,{method:'POST',headers:{authorization:'Bearer deployment-token','content-type':'application/json'},body:submission});assert.equal((await accepted.json()).receipt.sequence,2);
  }finally{await stopDeployment(deployment.child);}
});

test('deployment flips to Moltbook identity without a source change',async()=>{
  const ledgerPath=join(mkdtempSync(join(tmpdir(),'thought-moltbook-')),'ledger.jsonl');
  const deployment=await startDeployment(ledgerPath,{THOUGHT_AUTH_MODE:'moltbook',MOLTBOOK_APP_KEY:'moltdev_placeholder',MOLTBOOK_AUDIENCE:'thoughts.example'});
  try{
    const health=await fetch(`${deployment.base}/ready`).then(r=>r.json());assert.equal(health.authMode,'moltbook');assert.equal(health.capabilities.textSeedRendering,true);
    const tool=await fetch(`${deployment.base}/v1/tool-schema`).then(r=>r.json());assert.equal(tool.authentication.header,'X-Moltbook-Identity');assert.equal(tool.capabilities.textSeedRendering,true);
  }finally{await stopDeployment(deployment.child);}
});

test('development entry accepts forwarded preview host and port flags',async()=>{
  const child=spawn(process.execPath,['demo/dev-server.js','--host','127.0.0.1','--port','0','--strictPort'],{cwd:projectRoot,env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  try{
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error(`development start timed out: ${stderr}`)),5000);
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`development entry exited ${code}: ${stderr}`));});
      child.stdout.on('data',chunk=>{stdout+=chunk;const match=stdout.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    });
    const ready=await fetch(`http://127.0.0.1:${port}/ready`).then(response=>response.json());
    assert.equal(ready.status,'ok');assert.equal(ready.capabilities.textSeedRendering,true);
  }finally{await stopDeployment(child);}
});
