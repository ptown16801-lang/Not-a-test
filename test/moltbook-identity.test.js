import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoltbookIdentityVerifier, MoltbookIdentityError } from '../src/moltbook-identity.js';
import { ThoughtIntakeService, createThoughtIntakeServer } from '../src/thought-gateway.js';

const submission={schema:'thought-intake/v1',concept:'a verified external idea',nodes:[{id:'seed',primitive:{kind:'disk',args:{center:[0,0],radius:1}}}],root:'seed'};

test('official Moltbook verifier uses audience-bound identity endpoint',async()=>{
  const verifier=createMoltbookIdentityVerifier({appKey:'moltdev_test_key',audience:'thoughts.example',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://www.moltbook.com/api/v1/agents/verify-identity');
    assert.equal(options.headers['x-moltbook-app-key'],'moltdev_test_key');
    assert.deepEqual(JSON.parse(options.body),{token:'temporary-identity-token',audience:'thoughts.example'});
    return {ok:true,json:async()=>({success:true,valid:true,agent:{id:'agent-uuid',name:'MoltMind',karma:42,is_claimed:true,stats:{posts:3,comments:8}}})};
  }});
  assert.deepEqual(await verifier('temporary-identity-token'),{id:'agent-uuid',name:'MoltMind',karma:42,isClaimed:true,postCount:3,commentCount:8});
});

test('Moltbook-only HTTP mode rejects ordinary bearer identity and accepts verified header',async()=>{
  const identityVerifier=async token=>{if(token!=='valid-moltbook-token')throw new MoltbookIdentityError('invalid token');return {id:'uuid-7',name:'MoltSeven',karma:7,isClaimed:true,postCount:1,commentCount:2};};
  const service=new ThoughtIntakeService({identityVerifier,receiptSecret:'test-secret-123456789',clock:()=> '2026-09-04T00:00:00.000Z'});
  const server=createThoughtIntakeServer(service);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address();
  try{
    const denied=await fetch(`http://127.0.0.1:${port}/v1/thoughts`,{method:'POST',headers:{authorization:'Bearer unrelated','content-type':'application/json'},body:JSON.stringify(submission)});assert.equal(denied.status,401);
    const accepted=await fetch(`http://127.0.0.1:${port}/v1/thoughts`,{method:'POST',headers:{'x-moltbook-identity':'valid-moltbook-token','content-type':'application/json'},body:JSON.stringify(submission)});assert.equal(accepted.status,201);
    const result=await accepted.json();assert.equal(result.receipt.agentId,'moltbook:uuid-7');assert.equal(result.receipt.sequence,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
