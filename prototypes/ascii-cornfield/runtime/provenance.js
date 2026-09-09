/** Exact binary64 canonical profile. This is deliberately NOT RFC 8785/JCS. */
export const CANONICAL_VERSION = 'ne-canonical-binary64/v1';
export const HASH_VERSION = 'sha256/v1';
export const CONTENT_ID = /^sha256:[0-9a-f]{64}$/;
export const NUMERIC_CONVENTIONS = Object.freeze({format:'IEEE-754-binary64',negativeZero:'normalize-to-positive-zero',nonFinite:'reject',higherPrecision:'typed-string-with-explicit-precision',canonicalization:CANONICAL_VERSION,hashing:HASH_VERSION});

function unicode(s) {
  for(let i=0;i<s.length;i++) {
    const c=s.charCodeAt(i);
    if(c>=0xd800&&c<=0xdbff){const d=s.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff))throw Error('lone Unicode surrogate');}
    else if(c>=0xdc00&&c<=0xdfff)throw Error('lone Unicode surrogate');
  }
  return s;
}

/** Defensively copy and freeze ALL accepted values; reject unsupported depth. */
export function immutable(value,{maxDepth=128,maxNodes=1000000}={}) {
  const active=new Set();let count=0;
  function copy(v,depth){
    if(depth>maxDepth||++count>maxNodes)throw Error('canonical resource limit');
    if(v===null||typeof v==='boolean')return v;
    if(typeof v==='string')return unicode(v);
    if(typeof v==='number'){if(!Number.isFinite(v))throw Error('non-finite number');return v===0?0:v;}
    if(typeof v!=='object')throw Error('unsupported canonical value');
    if(active.has(v))throw Error('cyclic canonical value');
    if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('only plain data accepted; snapshot numerical arrays explicitly');
    active.add(v);
    const keys=Reflect.ownKeys(v),out=Array.isArray(v)?[]:{};
    if(Array.isArray(v)&&keys.length!==v.length+1)throw Error('sparse or extended array');
    for(const key of keys){
      if(Array.isArray(v)&&key==='length')continue;
      if(typeof key!=='string')throw Error('symbol key');unicode(key);
      const d=Object.getOwnPropertyDescriptor(v,key);
      if(!d.enumerable||!Object.hasOwn(d,'value'))throw Error('hidden field or accessor');
      Object.defineProperty(out,key,{value:copy(d.value,depth+1),enumerable:true,writable:true,configurable:true});
    }
    active.delete(v);return Object.freeze(out);
  }
  return copy(value,0);
}
function binary64(n){const b=new ArrayBuffer(8),d=new DataView(b);d.setFloat64(0,n===0?0:n,false);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function tagged(v){
  if(v===null)return ['null'];
  if(typeof v==='boolean')return ['bool',v];
  if(typeof v==='number')return ['f64',binary64(v)];
  if(typeof v==='string')return ['str',v];
  if(Array.isArray(v))return ['array',v.map(tagged)];
  return ['object',Object.keys(v).sort().map(k=>[k,tagged(v[k])])];
}
export function canonicalize(value){return JSON.stringify([CANONICAL_VERSION,tagged(immutable(value))]);}

// Synchronous browser-compatible SHA-256, checked against Node and Web Crypto.
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rr=(x,n)=>(x>>>n)|(x<<(32-n));
export function sha256(input){
  const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  if(!(bytes instanceof Uint8Array))throw Error('SHA-256 requires bytes or text');
  const data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;
  const dv=new DataView(data.buffer);dv.setUint32(data.length-8,Math.floor(bytes.length/0x20000000));dv.setUint32(data.length-4,(bytes.length*8)>>>0);
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64);
  for(let off=0;off<data.length;off+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(off+4*i);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rr(a,7)^rr(a,18)^(a>>>3))+w[i-7]+(rr(b,17)^rr(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,z]=h;
    for(let i=0;i<64;i++){const t=(z+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,u=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t)>>>0;d=c;c=b;b=a;a=(t+u)>>>0;}
    [a,b,c,d,e,f,g,z].forEach((x,i)=>h[i]=(h[i]+x)>>>0);
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export const contentId=value=>`sha256:${sha256(canonicalize(value))}`;

/** Reject duplicate names BEFORE JSON.parse can discard them. */
export function parseStrictJSON(text){
  let i=0;const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  function str(){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')return JSON.parse(text.slice(start,i));}throw Error('unterminated string');}
  function value(depth=0){if(depth>128)throw Error('JSON depth limit');ws();
    if(text[i]==='{'){i++;ws();const seen=new Set();if(text[i]==='}'){i++;return;}
      for(;;){ws();if(text[i]!=='"')throw Error('expected key');const k=str();if(seen.has(k))throw Error('duplicate JSON key');seen.add(k);ws();if(text[i++]!==':')throw Error('expected colon');value(depth+1);ws();const c=text[i++];if(c==='}')return;if(c!==',')throw Error('expected comma');}}
    if(text[i]==='['){i++;ws();if(text[i]===']'){i++;return;}for(;;){value(depth+1);ws();const c=text[i++];if(c===']')return;if(c!==',')throw Error('expected comma');}}
    if(text[i]==='"'){str();return;}
    const m=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(i));if(!m)throw Error('invalid JSON');i+=m[0].length;
  }
  value();ws();if(i!==text.length)throw Error('trailing JSON');return immutable(JSON.parse(text));
}

export function record({schema,pipeline,stage,payload,parents=[],supersedes=null}){
  if(!['scientific-trace','artistic-translation','shared','control'].includes(pipeline))throw Error('unknown pipeline');
  if(!schema||!stage||parents.some(p=>!CONTENT_ID.test(p.hash)||typeof p.role!=='string'))throw Error('invalid record metadata');
  if(supersedes!==null&&!CONTENT_ID.test(supersedes))throw Error('invalid supersession');
  const body=immutable({schema,pipeline,stage,numeric:NUMERIC_CONVENTIONS,parents,supersedes,payload});return immutable({id:contentId(body),...body});
}
export function verifyRecord(r){const {id,...body}=r;if(!CONTENT_ID.test(id)||contentId(body)!==id)throw Error('record hash mismatch');return true;}
export class ProvenanceStore {
  #records=new Map();
  add(r){verifyRecord(r);for(const p of r.parents)if(!this.#records.has(p.hash))throw Error(`missing parent ${p.hash}`);if(r.supersedes&&!this.#records.has(r.supersedes))throw Error('missing superseded record');const old=this.#records.get(r.id);if(old&&canonicalize(old)!==canonicalize(r))throw Error('same ID with different content');if(!old)this.#records.set(r.id,immutable(r));return r.id;}
  get(id){const r=this.#records.get(id);if(!r)throw Error('missing record');verifyRecord(r);return r;}
  values(){return Object.freeze([...this.#records.values()]);}
  verify(){for(const r of this.#records.values()){verifyRecord(r);for(const p of r.parents)this.get(p.hash);}return true;}
}
