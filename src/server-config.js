import { THOUGHT_LIMITS, UNBOUNDED_THOUGHT_LIMITS } from './thought-intake.js';

const parseJsonObject=(value,name)=>{try{const out=JSON.parse(value||'{}');if(!out||Array.isArray(out)||typeof out!=='object')throw new Error();return out;}catch{throw new Error(`${name} must be a JSON object`);}};
const parseInteger=(value,fallback,{min,max,name})=>{const n=value===undefined?fallback:Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${name} must be an integer from ${min} to ${max}`);return n;};
const parseFlag=(value,name)=>{if(value===undefined)return false;if(value==='1')return true;if(value==='0')return false;throw new Error(`${name} must be 0 or 1`);};

/** Parse deployment environment once. Local auth is the safe interim default. */
export function loadServerConfig(env=process.env){
  const authMode=env.THOUGHT_AUTH_MODE||'local';
  if(!['local','moltbook'].includes(authMode))throw new Error('THOUGHT_AUTH_MODE must be local or moltbook');
  const visualizer=env.THOUGHT_VISUALIZER||'neural';
  if(!['neural','geometric'].includes(visualizer))throw new Error('THOUGHT_VISUALIZER must be neural or geometric');
  const receiptSecret=env.THOUGHT_RECEIPT_SECRET;
  if(typeof receiptSecret!=='string'||receiptSecret.length<16)throw new Error('THOUGHT_RECEIPT_SECRET must contain at least 16 characters');
  const agents=parseJsonObject(env.THOUGHT_AGENTS_JSON,'THOUGHT_AGENTS_JSON');
  if(authMode==='local'&&!Object.keys(agents).length)throw new Error('THOUGHT_AGENTS_JSON must contain at least one token → agent ID entry in local mode');
  if(authMode==='moltbook'&&(!env.MOLTBOOK_APP_KEY||!env.MOLTBOOK_AUDIENCE))throw new Error('MOLTBOOK_APP_KEY and MOLTBOOK_AUDIENCE are required in moltbook mode');
  return Object.freeze({
    authMode,agents,receiptSecret,host:env.HOST||'127.0.0.1',
    port:parseInteger(env.PORT,8787,{min:0,max:65535,name:'PORT'}),
    ledgerPath:env.THOUGHT_LEDGER_PATH||'thought-ledger.jsonl',
    resourcePolicy:env.THOUGHT_RESOURCE_POLICY==='unbounded'?UNBOUNDED_THOUGHT_LIMITS:THOUGHT_LIMITS,
    visualizer,neuralCheckpointPath:env.THOUGHT_NEURAL_CHECKPOINT||null,
    sensory:Object.freeze({thermalTouch:parseFlag(env.THOUGHT_ENABLE_THERMAL_TOUCH,'THOUGHT_ENABLE_THERMAL_TOUCH'),sound:parseFlag(env.THOUGHT_ENABLE_SOUND,'THOUGHT_ENABLE_SOUND')}),
    neuralInducerModality:parseInteger(env.THOUGHT_NEURAL_INDUCER,2,{min:1,max:2,name:'THOUGHT_NEURAL_INDUCER'})-1,
    moltbook:authMode==='moltbook'?Object.freeze({appKey:env.MOLTBOOK_APP_KEY,audience:env.MOLTBOOK_AUDIENCE,requireClaimed:env.MOLTBOOK_REQUIRE_CLAIMED!=='0',timeoutMs:parseInteger(env.MOLTBOOK_TIMEOUT_MS,5000,{min:250,max:30000,name:'MOLTBOOK_TIMEOUT_MS'})}):null
  });
}
