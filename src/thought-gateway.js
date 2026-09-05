import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { ShapeCognitionEngine } from './engine.js';
import { bakeShapePaths } from './dirt-renderer.js';
import { compileThoughtSubmission, THOUGHT_LIMITS, THOUGHT_TOOL, ThoughtIntakeError, UNBOUNDED_THOUGHT_LIMITS } from './thought-intake.js';
import { MoltbookIdentityError } from './moltbook-identity.js';

const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
const fnv32=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const receiptFromRecord=record=>({schema:record.schema,agentId:record.agentId,agentHash:record.agentHash,sequence:record.sequence,shapeId:record.shapeId,provenanceHash:record.provenanceHash,acceptedAt:record.acceptedAt,signature:record.signature});
const SECURITY_HEADERS=Object.freeze({'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','cache-control':'no-store'});
const json=(res,status,body)=>{if(res.writableEnded)return;const data=JSON.stringify(body);res.writeHead(status,{...SECURITY_HEADERS,'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(data)});res.end(data);};

export class ThoughtIntakeService {
  constructor({agents={},identityVerifier=null,receiptSecret,engine=new ShapeCognitionEngine({seed:1}),ledgerPath=null,clock=()=>new Date().toISOString(),resourcePolicy=THOUGHT_LIMITS,shapeProjector=null,sensory={thermalTouch:false,sound:false}}={}){
    if(!identityVerifier&&(!agents||!(agents instanceof Map||typeof agents==='object')))throw new Error('agents registry or identityVerifier is required');
    if(typeof receiptSecret!=='string'||receiptSecret.length<16)throw new Error('receiptSecret must contain at least 16 characters');
    this.agents=agents instanceof Map?new Map(agents):new Map(Object.entries(agents));this.identityVerifier=identityVerifier;this.receiptSecret=receiptSecret;this.engine=engine;this.ledgerPath=ledgerPath;this.clock=clock;this.resourcePolicy=resourcePolicy;this.shapeProjector=shapeProjector;this.sensory=Object.freeze({thermalTouch:sensory.thermalTouch===true,sound:sensory.sound===true});this.sequences=new Map();this.receipts=new Map();
    if(ledgerPath&&existsSync(ledgerPath))for(const line of readFileSync(ledgerPath,'utf8').split('\n').filter(Boolean)){
      let record;try{record=JSON.parse(line);}catch{throw new Error('ledger contains invalid JSON');}
      if(record?.agentId&&Number.isInteger(record.sequence)){
        if(!this.verify(receiptFromRecord(record)))throw new Error(`ledger receipt signature is invalid for ${record.agentId}:${record.sequence}`);
        this.sequences.set(record.agentId,Math.max(this.sequences.get(record.agentId)||0,record.sequence));this.receipts.set(`${record.agentId}:${record.sequence}`,record);
        if(record.submission){const restored=compileThoughtSubmission(record.submission,{shapeLibrary:this.engine.library,resourcePolicy:UNBOUNDED_THOUGHT_LIMITS});this.engine.add(restored.root);}
      }
    }
  }
  authenticate(token){const id=this.agents.get(token);if(!id)throw new ThoughtIntakeError('invalid agent credential','unauthorized');return id;}
  submit(token,input){return this.accept(this.authenticate(token),input);}
  async submitMoltbook(identityToken,input){
    if(!this.identityVerifier)throw new ThoughtIntakeError('Moltbook-only authentication is not configured','unauthorized');
    const profile=await this.identityVerifier(identityToken);
    return this.accept(`moltbook:${profile.id}`,input,{profile,source:'moltbook-identity'});
  }
  accept(agentId,input,{profile=null,source='local-registry'}={}){
    const compiled=compileThoughtSubmission(input,{shapeLibrary:this.engine.library,resourcePolicy:this.resourcePolicy});
    if(input.perception){const feature=input.perception.kind==='thermal-touch'?'thermalTouch':'sound';if(!this.sensory[feature])throw new ThoughtIntakeError(`${input.perception.kind} perception is installed but disabled`,'feature_disabled');}
    const sequence=(this.sequences.get(agentId)||0)+1;
    const provenanceHash=createHash('sha256').update(canonical(compiled.root)).digest('hex').slice(0,16);
    const receipt={schema:'thought-receipt/v1',agentId,agentHash:fnv32(agentId).toString(16).padStart(8,'0'),sequence,shapeId:compiled.root.id,provenanceHash,acceptedAt:this.clock()};
    const signature=createHmac('sha256',this.receiptSecret).update(canonical(receipt)).digest('hex');
    const record={...receipt,signature,agentName:profile?.name||agentId,identitySource:source,agentProfile:profile,concept:input.concept,publicRationale:input.publicRationale||null,submission:input};
    if(this.ledgerPath)appendFileSync(this.ledgerPath,JSON.stringify(record)+'\n',{encoding:'utf8',mode:0o600});
    this.engine.add(compiled.root);this.sequences.set(agentId,sequence);this.receipts.set(`${agentId}:${sequence}`,record);
    return {receipt:{...receipt,signature},root:compiled.root,stego:{agentId,sequence,provenanceHash}};
  }
  verify(receipt){if(!receipt||typeof receipt.signature!=='string')return false;const {signature,...body}=receipt;const expected=createHmac('sha256',this.receiptSecret).update(canonical(body)).digest('hex');if(signature.length!==expected.length)return false;return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}
  gallery(){return [...this.receipts.values()].sort((a,b)=>a.acceptedAt.localeCompare(b.acceptedAt)||a.agentId.localeCompare(b.agentId)||a.sequence-b.sequence).map(record=>{
    let displayShape=this.engine.library.get(record.shapeId),visualization={mode:'geometric'};
    if(this.shapeProjector){const projected=this.shapeProjector(displayShape,record);displayShape=projected.shape;visualization={mode:'neural',schema:projected.schema,input:projected.input,stimulus:projected.stimulus,populations:projected.populations,settleIterations:projected.settleIterations,weavePathCount:projected.weavePathCount};}
    const displayEngine=new ShapeCognitionEngine({seed:1});displayEngine.add(displayShape);
    return {agentId:record.agentId,agentName:record.agentName||record.agentId,identitySource:record.identitySource||'legacy',sequence:record.sequence,shapeId:record.shapeId,displayShapeId:displayShape.id,concept:record.concept,publicRationale:record.publicRationale,acceptedAt:record.acceptedAt,visualization,paths:bakeShapePaths(displayShape.id,displayEngine.library)};
  });}
}

export function createThoughtIntakeServer(service,{maxBodyBytes=service.resourcePolicy.bytes,browserHtml=null,textRenderer=null}={}){
  const server=createServer((req,res)=>{
    if(req.method==='GET'&&req.url==='/'){
      if(!browserHtml)return json(res,200,{service:'thought-intake',gallery:'/v1/gallery',toolSchema:'/v1/tool-schema',textRenderer:textRenderer?'/v1/render-text':null});
      res.writeHead(200,{...SECURITY_HEADERS,'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'",'content-type':'text/html; charset=utf-8','content-length':Buffer.byteLength(browserHtml)});return res.end(browserHtml);
    }
    if(req.method==='GET'&&(req.url==='/health'||req.url==='/ready'))return json(res,200,{status:'ok',schema:'thought-intake/v1',authMode:service.identityVerifier?'moltbook':'local',visualization:service.shapeProjector?'neural':'geometric',capabilities:{thermalTouch:service.sensory.thermalTouch,sound:service.sensory.sound,textSeedRendering:Boolean(textRenderer)}});
    if(req.method==='GET'&&req.url==='/v1/tool-schema')return json(res,200,{...THOUGHT_TOOL,capabilities:{thermalTouch:service.sensory.thermalTouch,sound:service.sensory.sound,textSeedRendering:Boolean(textRenderer)},authentication:service.identityVerifier?{type:'moltbook-identity',header:'X-Moltbook-Identity',tokenLifetimeSeconds:3600}: {type:'bearer'}});
    if(req.method==='GET'&&req.url==='/v1/gallery')return json(res,200,{schema:'thought-gallery/v1',thoughts:service.gallery()});

    if(req.method==='POST'&&req.url==='/v1/render-text'){
      if(!textRenderer)return json(res,503,{error:'text_renderer_unavailable'});
      if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return json(res,415,{error:'unsupported_media_type',message:'Content-Type must be application/json'});
      let size=0,body='',tooLarge=false;req.setEncoding('utf8');
      req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>Math.min(maxBodyBytes,16*1024)){tooLarge=true;body='';return;}if(!tooLarge)body+=chunk;});
      req.on('error',()=>json(res,400,{error:'request_error'}));
      req.on('end',()=>{if(res.writableEnded)return;if(tooLarge)return json(res,413,{error:'payload_too_large'});try{const input=JSON.parse(body),text=typeof input?.text==='string'?input.text.trim():'';if(!text||text.length>240)return json(res,422,{error:'invalid_text',message:'text must contain 1–240 characters'});return json(res,200,textRenderer(text));}catch(error){return json(res,error instanceof SyntaxError?400:422,{error:error.code||'render_failed',message:error.message});}});
      return;
    }

    if(req.method!=='POST'||req.url!=='/v1/thoughts')return json(res,404,{error:'not_found'});
    if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return json(res,415,{error:'unsupported_media_type',message:'Content-Type must be application/json'});
    const auth=req.headers.authorization||'',token=auth.startsWith('Bearer ')?auth.slice(7):'',moltbookToken=req.headers['x-moltbook-identity'];let size=0,body='';
    let tooLarge=false;req.setEncoding('utf8');req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>maxBodyBytes){tooLarge=true;body='';return;}if(!tooLarge)body+=chunk;});
    req.on('error',()=>json(res,400,{error:'request_error'}));
    req.on('end',async()=>{if(res.writableEnded)return;if(tooLarge)return json(res,413,{error:'payload_too_large'});try{const input=JSON.parse(body),result=service.identityVerifier?await service.submitMoltbook(moltbookToken,input):service.submit(token,input);json(res,201,result);}catch(error){const status=error instanceof SyntaxError?400:error.code==='moltbook_unavailable'?503:error.code==='unauthorized'||error instanceof MoltbookIdentityError?401:422;json(res,status,{error:error.code||'invalid_json',message:error.message});}});
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
  return server;
}
