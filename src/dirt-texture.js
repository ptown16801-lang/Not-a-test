/** Dependency-free ground-material blending for normalized or physical paths. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smoothstep=t=>t*t*(3-2*t);
const hash32=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const noise=(seed,x,y)=>{let h=seed^Math.imul(x+1,374761393)^Math.imul(y+1,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};

export function createGroundTextureRecipe(shapeId,overrides={}){
  return Object.freeze({schema:'dirt-texture/v0',profile:'feathered-groove',seed:hash32(shapeId),coreWidthM:.035,featherWidthM:.08,coreOpacity:1,edgeOpacity:.62,roughness:.22,grainScale:3,...overrides});
}

const pathBounds=paths=>paths.flat().reduce((b,[x,y])=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)],[Infinity,Infinity,-Infinity,-Infinity]);

/** Produce deterministic 8-bit coverage and roughness fields with a bounded radial brush. */
export function rasterizeGroundTexture(paths,{width=256,height=256,bounds=null,coreWidthPx=5.5,featherWidthPx=11,seed=1,roughness=.22,grainScale=3,maxDimension=4096}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<16||width>maxDimension||height>maxDimension)throw new Error(`texture raster must be 16–${maxDimension} pixels per side`);
  if(!Array.isArray(paths))throw new Error('paths must be an array');
  const coverage=new Uint8ClampedArray(width*height),grain=new Uint8ClampedArray(width*height);
  const b=bounds||pathBounds(paths),spanX=Math.max(1e-9,b[2]-b[0]),spanY=Math.max(1e-9,b[3]-b[1]);
  const toPixel=([x,y])=>[(x-b[0])/spanX*(width-1),(1-(y-b[1])/spanY)*(height-1)];
  const outer=Math.max(coreWidthPx/2,featherWidthPx/2),inner=Math.max(.5,coreWidthPx/2),radius=Math.ceil(outer);
  const stamp=(cx,cy)=>{
    const x0=Math.max(0,Math.floor(cx-radius)),x1=Math.min(width-1,Math.ceil(cx+radius)),y0=Math.max(0,Math.floor(cy-radius)),y1=Math.min(height-1,Math.ceil(cy+radius));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const d=Math.hypot(x-cx,y-cy);if(d>outer)continue;
      const alpha=d<=inner?1:(1-smoothstep(clamp((d-inner)/Math.max(.001,outer-inner),0,1)))*.62;
      const i=y*width+x;coverage[i]=Math.max(coverage[i],Math.round(alpha*255));
    }
  };
  for(const path of paths)for(let i=1;i<path.length;i++){
    const a=toPixel(path[i-1]),z=toPixel(path[i]),length=Math.hypot(z[0]-a[0],z[1]-a[1]),steps=Math.max(1,Math.ceil(length/Math.max(1,inner*.65)));
    for(let j=0;j<=steps;j++){const t=j/steps;stamp(a[0]+(z[0]-a[0])*t,a[1]+(z[1]-a[1])*t);}
  }
  const s=hash32(seed),scale=Math.max(1,Math.round(grainScale));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const coarse=noise(s,Math.floor(x/scale),Math.floor(y/scale)),fine=noise(s^0x9e3779b9,x,y);
    grain[y*width+x]=Math.round(clamp(.72+.28*((coarse*.7+fine*.3)-.5)*2*roughness,0,1)*255);
  }
  return {schema:'dirt-texture-raster/v0',width,height,coverage,roughness:grain,bounds:b};
}
