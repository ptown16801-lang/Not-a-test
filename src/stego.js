/** Small deterministic raster stamps. No dependencies; browser-compatible. */
const MAGIC=0x5343, VERSION=1, BYTES=22, BITS=BYTES*8;
const u32=n=>Number(BigInt.asUintN(32,BigInt(n)));
export function hash32(value){let h=2166136261;for(const b of new TextEncoder().encode(String(value)))h=Math.imul(h^b,16777619);return h>>>0;}
function crc16(a){let c=0xffff;for(const b of a){c^=b<<8;for(let i=0;i<8;i++)c=(c&0x8000)?(c<<1)^0x1021:c<<1;}return c&0xffff;}
function hash64(value){let h=0xcbf29ce484222325n;for(const b of new TextEncoder().encode(String(value))){h^=BigInt(b);h=BigInt.asUintN(64,h*0x100000001b3n);}return h;}
export function createStamp({agentId,sequence,provenanceHash=0n}){
  if(!Number.isInteger(sequence)||sequence<0||sequence>0xffffffff)throw new RangeError('sequence must be uint32');
  const agentHash=typeof agentId==='number'?u32(agentId):hash32(agentId);
  let provenance=typeof provenanceHash==='bigint'?provenanceHash:typeof provenanceHash==='number'?BigInt(provenanceHash):hash64(provenanceHash);
  return {version:VERSION,agentHash,sequence:sequence>>>0,provenanceHash:BigInt.asUintN(64,provenance).toString(16).padStart(16,'0')};
}
function pack(stamp){const a=new Uint8Array(BYTES),v=new DataView(a.buffer);v.setUint16(0,MAGIC);a[2]=VERSION;a[3]=0;v.setUint32(4,stamp.agentHash);v.setUint32(8,stamp.sequence);v.setBigUint64(12,BigInt('0x'+stamp.provenanceHash));v.setUint16(20,crc16(a.subarray(0,20)));return a;}
function unpack(a){if(a.length<BYTES)return null;const v=new DataView(a.buffer,a.byteOffset,a.byteLength);if(v.getUint16(0)!==MAGIC||a[2]!==VERSION||v.getUint16(20)!==crc16(a.subarray(0,20)))return null;return {version:a[2],agentHash:v.getUint32(4),sequence:v.getUint32(8),provenanceHash:v.getBigUint64(12).toString(16).padStart(16,'0')};}
const bits=a=>Array.from(a).flatMap(x=>Array.from({length:8},(_,i)=>(x>>(7-i))&1));
const bytes=bs=>Uint8Array.from({length:Math.floor(bs.length/8)},(_,i)=>bs.slice(i*8,i*8+8).reduce((n,b)=>(n<<1)|b,0));
function rng(seed){let x=hash32(seed)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};}
function order(n,key){const a=Array.from({length:n},(_,i)=>i),r=rng(key);for(let i=n-1;i;i--){const j=r()%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function checkRaster(data,width,height,channels){if(!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||data.length<width*height*channels)throw new TypeError('invalid raster');}
function cornerRegion(width,height,{corner='bottom-right',regionSize},unit=1){
  const size=regionSize??64;
  const rw=typeof size==='number'?size:size.width,rh=typeof size==='number'?size:size.height;
  if(!Number.isInteger(rw)||!Number.isInteger(rh)||rw<unit||rh<unit||rw>width||rh>height||rw%unit||rh%unit)throw new RangeError(`corner region must fit the image and be a positive multiple of ${unit}`);
  if(!['top-left','top-right','bottom-left','bottom-right'].includes(corner))throw new RangeError('invalid corner');
  return {x:corner.endsWith('right')?width-rw:0,y:corner.startsWith('bottom')?height-rh:0,width:rw,height:rh,corner};
}

/** Exact lossless carrier. It is intentionally NOT JPEG/photography resistant. */
export function encodeLSB(data,width,height,stamp,{key='shape-cognition',channels=1,corner='bottom-right',regionSize=64}={}){
  checkRaster(data,width,height,channels);const region=cornerRegion(width,height,{corner,regionSize}),out=new data.constructor(data),bs=bits(pack(stamp)),slots=order(region.width*region.height,`${key}:lsb-corner-v1`);
  if(slots.length<bs.length)throw new RangeError(`LSB capacity needs ${bs.length} pixels`);
  bs.forEach((b,i)=>{const s=slots[i],x=region.x+s%region.width,y=region.y+Math.floor(s/region.width),p=(y*width+x)*channels;out[p]=(out[p]&254)|b;});return out;
}
export function decodeLSB(data,width,height,{key='shape-cognition',channels=1,corner='bottom-right',regionSize=64}={}){
  checkRaster(data,width,height,channels);const region=cornerRegion(width,height,{corner,regionSize}),slots=order(region.width*region.height,`${key}:lsb-corner-v1`);if(slots.length<BITS)return null;
  return unpack(bytes(slots.slice(0,BITS).map(s=>{const x=region.x+s%region.width,y=region.y+Math.floor(s/region.width);return data[(y*width+x)*channels]&1;})));
}

/**
 * Blind differential block watermark. Each bit is repeated across paired blocks;
 * pair-mean polarity carries the bit. This tolerates modest blur/noise/codec loss
 * better than LSB, but physical recovery still requires scale/perspective
 * registration of the containing zone before decode.
 */
export function encodeWatermark(data,width,height,stamp,{key='shape-cognition',channels=1,blockSize=4,repetition=5,strength=6,corner='bottom-right',regionSize=192}={}){
  checkRaster(data,width,height,channels);const region=cornerRegion(width,height,{corner,regionSize},blockSize),cols=region.width/blockSize,rows=region.height/blockSize,need=BITS*repetition*2;
  if(cols*rows<need)throw new RangeError(`watermark capacity needs ${need} blocks`);
  const out=new data.constructor(data),blocks=order(cols*rows,`${key}:watermark-corner-v1`),bs=bits(pack(stamp));let k=0;
  const shift=(bi,d)=>{const bx=region.x+(bi%cols)*blockSize,by=region.y+Math.floor(bi/cols)*blockSize;for(let y=by;y<by+blockSize;y++)for(let x=bx;x<bx+blockSize;x++){const p=(y*width+x)*channels;out[p]=Math.max(0,Math.min(255,out[p]+d));}};
  for(const b of bs)for(let r=0;r<repetition;r++){const a=blocks[k++],z=blocks[k++];shift(a,b?strength:-strength);shift(z,b?-strength:strength);}return out;
}
export function decodeWatermark(data,width,height,{key='shape-cognition',channels=1,blockSize=4,repetition=5,corner='bottom-right',regionSize=192}={}){
  checkRaster(data,width,height,channels);const region=cornerRegion(width,height,{corner,regionSize},blockSize),cols=region.width/blockSize,rows=region.height/blockSize,need=BITS*repetition*2;if(cols*rows<need)return null;
  const blocks=order(cols*rows,`${key}:watermark-corner-v1`);let k=0;const mean=bi=>{const bx=region.x+(bi%cols)*blockSize,by=region.y+Math.floor(bi/cols)*blockSize;let n=0;for(let y=by;y<by+blockSize;y++)for(let x=bx;x<bx+blockSize;x++)n+=data[(y*width+x)*channels];return n/(blockSize*blockSize);};
  const out=[];for(let i=0;i<BITS;i++){let vote=0;for(let r=0;r<repetition;r++)vote+=mean(blocks[k++])>mean(blocks[k++])?1:-1;out.push(vote>0?1:0);}return unpack(bytes(out));
}

// Hamming(7,4), positions 1,2,4 parity and 3,5,6,7 data.
function hammingEncode(input){
  const out=[];
  for(let i=0;i<input.length;i+=4){const d=[input[i]||0,input[i+1]||0,input[i+2]||0,input[i+3]||0];out.push(d[0]^d[1]^d[3],d[0]^d[2]^d[3],d[0],d[1]^d[2]^d[3],d[1],d[2],d[3]);}
  return out;
}
function hammingDecode(input){
  const out=[];
  for(let i=0;i+6<input.length;i+=7){const b=input.slice(i,i+7),s1=b[0]^b[2]^b[4]^b[6],s2=b[1]^b[2]^b[5]^b[6],s3=b[3]^b[4]^b[5]^b[6],bad=s1+2*s2+4*s3;if(bad)b[bad-1]^=1;out.push(b[2],b[4],b[5],b[6]);}
  return out;
}

export function jpegWatermarkCapacity(width,height,{blockSize=8,repetition=3,corner='bottom-right',regionSize=256}={}){
  if(!Number.isInteger(blockSize)||blockSize<4||blockSize%4)throw new RangeError('blockSize must be a multiple of 4 and at least 4');
  if(!Number.isInteger(repetition)||repetition<1||repetition%2===0)throw new RangeError('repetition must be a positive odd integer');
  const region=cornerRegion(width,height,{corner,regionSize},blockSize),blocks=region.width/blockSize*(region.height/blockSize);
  return {blocks,requiredBlocks:BITS*7/4*repetition,payloadBytes:Math.floor(blocks/repetition/7)*4/8,region};
}

/**
 * JPEG-resistant blind carrier, adapted from the MIT-licensed ROBUST method in
 * Iman/javid-steganography. A bit is the sign of the luminance difference
 * between the central quarter and surrounding pixels of an 8x8 (default)
 * block. Hamming(7,4) corrects isolated errors; odd repetition supplies a
 * majority vote. Runtime is dependency-free and works on grayscale, RGB or
 * RGBA interleaved rasters. A JPEG codec is deliberately outside this module.
 */
export function encodeJPEGWatermark(data,width,height,stamp,{key='shape-cognition',channels=1,blockSize=8,repetition=3,strength=25,corner='bottom-right',regionSize=256}={}){
  checkRaster(data,width,height,channels);if(channels!==1&&channels!==3&&channels!==4)throw new RangeError('channels must be 1, 3, or 4');
  const cap=jpegWatermarkCapacity(width,height,{blockSize,repetition,corner,regionSize});if(cap.blocks<cap.requiredBlocks)throw new RangeError(`JPEG watermark capacity needs ${cap.requiredBlocks} blocks; got ${cap.blocks}`);
  if(!(strength>0&&strength<=96))throw new RangeError('strength must be in (0,96]');
  const out=new data.constructor(data),cols=cap.region.width/blockSize,placement=order(cap.blocks,`${key}:jpeg-corner-v1`),coded=hammingEncode(bits(pack(stamp)));let slot=0;
  const q=blockSize/4,q3=blockSize-q,delta=strength/2;
  for(const bit of coded)for(let copy=0;copy<repetition;copy++){
    const bi=placement[slot++],bx=cap.region.x+(bi%cols)*blockSize,by=cap.region.y+Math.floor(bi/cols)*blockSize;
    for(let y=0;y<blockSize;y++)for(let x=0;x<blockSize;x++){
      const center=x>=q&&x<q3&&y>=q&&y<q3,sign=(bit?1:-1)*(center?1:-1),p=((by+y)*width+bx+x)*channels;
      const colorChannels=channels===1?1:3;for(let c=0;c<colorChannels;c++)out[p+c]=Math.max(0,Math.min(255,Math.round(out[p+c]+sign*delta)));
    }
  }
  return out;
}

export function decodeJPEGWatermark(data,width,height,{key='shape-cognition',channels=1,blockSize=8,repetition=3,corner='bottom-right',regionSize=256}={}){
  checkRaster(data,width,height,channels);if(channels!==1&&channels!==3&&channels!==4)return null;
  const cap=jpegWatermarkCapacity(width,height,{blockSize,repetition,corner,regionSize});if(cap.blocks<cap.requiredBlocks)return null;
  const cols=cap.region.width/blockSize,placement=order(cap.blocks,`${key}:jpeg-corner-v1`),q=blockSize/4,q3=blockSize-q;let slot=0;
  const lum=p=>channels===1?data[p]:.299*data[p]+.587*data[p+1]+.114*data[p+2],coded=[];
  for(let i=0;i<BITS*7/4;i++){
    let votes=0;
    for(let copy=0;copy<repetition;copy++){
      const bi=placement[slot++],bx=cap.region.x+(bi%cols)*blockSize,by=cap.region.y+Math.floor(bi/cols)*blockSize;let center=0,edge=0,nc=0,ne=0;
      for(let y=0;y<blockSize;y++)for(let x=0;x<blockSize;x++){const v=lum(((by+y)*width+bx+x)*channels);if(x>=q&&x<q3&&y>=q&&y<q3){center+=v;nc++;}else{edge+=v;ne++;}}
      votes+=(center/nc>edge/ne)?1:-1;
    }
    coded.push(votes>0?1:0);
  }
  return unpack(bytes(hammingDecode(coded).slice(0,BITS)));
}
