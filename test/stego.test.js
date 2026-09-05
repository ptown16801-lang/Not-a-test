import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createStamp,encodeLSB,decodeLSB,encodeWatermark,decodeWatermark,encodeJPEGWatermark,decodeJPEGWatermark,jpegWatermarkCapacity} from '../src/stego.js';
import {renderDirtInscription} from '../src/dirt-renderer.js';

const stamp=createStamp({agentId:'agent-grok',sequence:17,provenanceHash:'shape:17'});

test('LSB round trip, determinism, and corner-only placement',()=>{
  const w=128,h=128,o={regionSize:64},src=new Uint8Array(w*h).fill(128);
  const a=encodeLSB(src,w,h,stamp,o),b=encodeLSB(src,w,h,stamp,o);
  assert.deepEqual(a,b);assert.deepEqual(decodeLSB(a,w,h,o),stamp);
  assertOnlyCornerChanged(src,a,w,h,1,'bottom-right',64);
});

test('watermark round trip, determinism, and corner-only placement',()=>{
  const w=256,h=256,o={blockSize:4,repetition:5,strength:7,regionSize:192},src=new Uint8Array(w*h).fill(128);
  const a=encodeWatermark(src,w,h,stamp,o),b=encodeWatermark(src,w,h,stamp,o);
  assert.deepEqual(a,b);assert.deepEqual(decodeWatermark(a,w,h,o),stamp);
  assertOnlyCornerChanged(src,a,w,h,1,'bottom-right',192);
});

test('watermark tolerates deterministic noise and compression-like quantization',()=>{
  const w=256,h=256,o={blockSize:4,repetition:5,strength:8,regionSize:192},src=new Uint8Array(w*h).fill(128);
  const a=encodeWatermark(src,w,h,stamp,o);
  for(let i=0;i<a.length;i++){const noisy=a[i]+((i*1103515245>>>27)%5)-2;a[i]=Math.max(0,Math.min(255,Math.round(noisy/4)*4));}
  assert.deepEqual(decodeWatermark(a,w,h,o),stamp);
});

test('wrong key fails closed via magic and CRC',()=>{
  const w=256,h=256,o={blockSize:4,repetition:5,strength:8,key:'right',regionSize:192};
  const a=encodeWatermark(new Uint8Array(w*h).fill(128),w,h,stamp,o);
  assert.equal(decodeWatermark(a,w,h,{...o,key:'wrong'}),null);
});

test('JPEG carrier round trip, determinism, capacity, wrong-key failure, and corner-only placement',()=>{
  const w=512,h=512,o={channels:3,key:'right',regionSize:256},src=dirtRaster(w,h);
  const a=encodeJPEGWatermark(src,w,h,stamp,o),b=encodeJPEGWatermark(src,w,h,stamp,o);
  assert.deepEqual(a,b);assert.deepEqual(decodeJPEGWatermark(a,w,h,o),stamp);
  assert.equal(decodeJPEGWatermark(a,w,h,{...o,key:'wrong'}),null);
  const cap=jpegWatermarkCapacity(w,h,o);
  assert.equal(cap.requiredBlocks,924);
  assert.deepEqual(cap.region,{x:256,y:256,width:256,height:256,corner:'bottom-right'});
  assertOnlyCornerChanged(src,a,w,h,3,'bottom-right',256);
  assert.throws(()=>encodeJPEGWatermark(new Uint8Array(256*256*3),256,256,stamp,{...o,regionSize:128}),/capacity/);
});

test('JPEG corner carrier survives real Pillow recompression at Q95, Q85, and Q70',async t=>{
  const python=spawnSync('python3',['-c','import PIL'],{encoding:'utf8'});
  if(python.status!==0){t.skip('Pillow unavailable');return;}
  const w=512,h=512,o={channels:3,key:'jpeg-test',strength:25,regionSize:256},src=dirtRaster(w,h);
  const encoded=encodeJPEGWatermark(src,w,h,stamp,o);
  assertOnlyCornerChanged(src,encoded,w,h,3,'bottom-right',256);
  const dir=await mkdtemp(join(tmpdir(),'shape-stego-'));
  try{
    const ppm=join(dir,'in.ppm'),header='P6\n'+w+' '+h+'\n255\n';
    await writeFile(ppm,Buffer.concat([Buffer.from(header),Buffer.from(encoded)]));
    for(const q of [95,85,70]){
      const jpg=join(dir,'q'+q+'.jpg');
      const r=spawnSync('python3',[new URL('./jpeg_roundtrip.py',import.meta.url).pathname,ppm,jpg,String(q)],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);
      const raw=await readFile(jpg+'.ppm'),start=ppmPayloadOffset(raw);
      assert.deepEqual(decodeJPEGWatermark(raw.subarray(start),w,h,o),stamp,'failed after JPEG Q'+q);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('balance inscriptions receive monotonic optional stamps without changing paths',async()=>{
  const f=JSON.parse(await readFile(new URL('../demo/balance-output.json',import.meta.url),'utf8'));
  const plain=renderDirtInscription(f),marked=renderDirtInscription(f,{stego:{agentId:'agent-grok',sequenceStart:100}});
  assert.deepEqual(marked.inscriptions.map(x=>x.paths),plain.inscriptions.map(x=>x.paths));
  assert.deepEqual(marked.inscriptions.map(x=>x.stego.stamp.sequence),marked.inscriptions.map((_,i)=>100+i));
  assert.ok(marked.inscriptions.every(x=>x.stego.carrier==='jpeg-watermark'));
  assert.ok(marked.inscriptions.every(x=>x.stego.placement.corner==='bottom-right'&&x.stego.placement.regionSize===256));
});

function dirtRaster(w,h){
  const a=new Uint8Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=((x*17+y*31+(x*y)%29)%17)-8,p=(y*w+x)*3;a[p]=154+n+Math.floor(12*y/h);a[p+1]=116+n+Math.floor(8*y/h);a[p+2]=72+n;}
  return a;
}
function assertOnlyCornerChanged(before,after,w,h,channels,corner,size){
  let changed=0;const x0=corner.endsWith('right')?w-size:0,y0=corner.startsWith('bottom')?h-size:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<channels;c++){const p=(y*w+x)*channels+c;if(before[p]!==after[p]){changed++;assert.ok(x>=x0&&x<x0+size&&y>=y0&&y<y0+size,'changed pixel outside '+corner+' region at '+x+','+y);}}
  assert.ok(changed>0);
}
function ppmPayloadOffset(a){
  let i=0,tokens=0;
  while(i<a.length&&tokens<4){while(a[i]===32||a[i]===10||a[i]===13||a[i]===9)i++;while(i<a.length&&a[i]!==32&&a[i]!==10&&a[i]!==13&&a[i]!==9)i++;tokens++;}
  while(a[i]===32||a[i]===10||a[i]===13||a[i]===9)i++;
  return i;
}
