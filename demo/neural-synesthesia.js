import { readFileSync, writeFileSync } from 'node:fs';
import { ShapeCognitionEngine } from '../src/engine.js';
import { bakeShapePaths } from '../src/dirt-renderer.js';
import { InfomaxRecurrentNetwork } from '../src/neural-synesthesia.js';
import { projectShapeThroughNetwork } from '../src/neural-shape-bridge.js';
import { cobweb, honeycomb, logarithmicSpiral, spatialSequence } from '../src/synesthetic-geometry.js';

const checkpoint=JSON.parse(readFileSync(new URL('../assets/neural-preview-checkpoint.json',import.meta.url),'utf8'));
const network=InfomaxRecurrentNetwork.fromJSON(checkpoint.network);
const sources=[logarithmicSpiral({turns:2.4}),cobweb({rings:4,spokes:9}),honeycomb({rows:2,columns:3}),spatialSequence({count:7})];
const examples=sources.map((source,index)=>{
  const projected=projectShapeThroughNetwork(source,network,{sequence:index+1,stimulus:{inducerModality:1},response:{integrationStep:.5,tolerance:1e-8},projection:{maxWeavePaths:12}});
  const engine=new ShapeCognitionEngine();engine.add(projected.shape);return {...projected,paths:bakeShapePaths(projected.shape.id,engine.library)};
});
const width=1000,height=720,columns=2,cellW=width/columns,cellH=height/2;
const cards=examples.map((example,index)=>{
  const points=example.paths.flat(),bounds=points.reduce((b,[x,y])=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)],[Infinity,Infinity,-Infinity,-Infinity]);
  const scale=Math.min((cellW-70)/Math.max(1e-9,bounds[2]-bounds[0]),(cellH-90)/Math.max(1e-9,bounds[3]-bounds[1])),column=index%columns,row=Math.floor(index/columns),cx=column*cellW+cellW/2,cy=row*cellH+cellH/2-8;
  const data=example.paths.map(path=>`<path d="${path.map(([x,y],i)=>`${i?'L':'M'}${(cx+(x-(bounds[0]+bounds[2])/2)*scale).toFixed(2)},${(cy-(y-(bounds[1]+bounds[3])/2)*scale).toFixed(2)}`).join(' ')}"/>`).join('');
  const pop=example.populations.map((p,i)=>`M${i+1} ${p.magnitude.toFixed(3)} @ ${p.angleDegrees.toFixed(1)}°`).join(' · ');
  return `<g><rect x="${column*cellW+16}" y="${row*cellH+16}" width="${cellW-32}" height="${cellH-32}" rx="18" fill="#2c160c" stroke="#72401f"/><g class="soft">${data}</g><g class="core">${data}</g><text x="${column*cellW+32}" y="${(row+1)*cellH-34}" class="label">Thought ${index+1} · ${pop}</text></g>`;
}).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="soil" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".018 .07" numOctaves="2" seed="27" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="4"/><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="100%" height="100%" fill="#1a0d07"/><style>.soft{fill:none;stroke:#ce7b31;stroke-width:15;stroke-linecap:round;stroke-linejoin:round;opacity:1;filter:url(#soil)}.core{fill:none;stroke:#f1b85c;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;opacity:1}.label{fill:#edc98c;font:15px system-ui,sans-serif}</style>${cards}</svg>\n`;
const output={schema:'neural-synesthetic-thought-demo/v1',checkpoint:{notice:checkpoint.notice,reconstruction:checkpoint.reconstruction},examples:examples.map((x,index)=>({sequence:index+1,shapeId:x.shape.id,input:x.input,populations:x.populations,weavePathCount:x.weavePathCount,pathCount:x.paths.length}))};
writeFileSync(new URL('./neural-synesthesia.svg',import.meta.url),svg);writeFileSync(new URL('./neural-synesthesia-output.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({examples:examples.length,svg:'demo/neural-synesthesia.svg',output:'demo/neural-synesthesia-output.json'},null,2));

