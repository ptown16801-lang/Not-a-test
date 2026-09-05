import { writeFileSync } from 'node:fs';
import { ShapeCognitionEngine } from '../src/engine.js';
import { projectiveSynestheticThought } from '../src/synesthetic-geometry.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';

const engine=new ShapeCognitionEngine({seed:2026});
const thought=projectiveSynestheticThought();
engine.add(thought);
const paths=bakeShapePaths(thought.id,engine.library);
const points=paths.flat();
const bounds=points.reduce((b,[x,y])=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)],[Infinity,Infinity,-Infinity,-Infinity]);
const width=900,height=500,pad=24,s=Math.min((width-2*pad)/(bounds[2]-bounds[0]),(height-2*pad)/(bounds[3]-bounds[1]));
const svgPaths=paths.map(p=>`<path d="${p.map(([x,y],i)=>`${i?'L':'M'} ${(pad+(x-bounds[0])*s).toFixed(2)} ${(height-pad-(y-bounds[1])*s).toFixed(2)}`).join(' ')}"/>`).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="soft-dirt" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter></defs><rect width="100%" height="100%" fill="#24140d"/><g fill="none" stroke="#e7b65d" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="1" filter="url(#soft-dirt)">${svgPaths}</g><g fill="none" stroke="#f0bd61" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" opacity="1">${svgPaths}</g></svg>\n`;
writeFileSync(new URL('./projective-synesthesia.svg',import.meta.url),svg);
writeFileSync(new URL('./projective-synesthesia-output.json',import.meta.url),JSON.stringify({schema:'synesthetic-thought-demo/v0',thoughtId:thought.id,shapeCount:engine.library.size,pathCount:paths.length,visualStyle:{blurStdDeviationPx:3.2,blurStrokeWidthPx:11,coreStrokeWidthPx:5.5,opacity:1},stream:engine.serialize()},null,2)+'\n');
console.log(JSON.stringify({thoughtId:thought.id,shapeCount:engine.library.size,pathCount:paths.length,svg:'demo/projective-synesthesia.svg'},null,2));
