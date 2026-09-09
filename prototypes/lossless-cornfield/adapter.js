/** Explicit upstream projections, NEVER part of the image-only decoder.
 * The caller gets a scope receipt alongside a new renderer input. Recovery of
 * that input is not recovery of the original shape-cognition stream.
 */
export function extractPrimitiveScene(stream) {
  if (!stream || !Array.isArray(stream.shapes)) throw new TypeError('expected a saved shape stream');
  const supported = new Set(['point','segment','ray','disk','polygon','curve','ball','surface','polyline']);
  const omitted = [];
  const shapes = [];
  for (let index=0; index<stream.shapes.length; index++) {
    const shape=stream.shapes[index];
    if (!supported.has(shape.geometry?.kind)) {
      omitted.push({index,field:'whole shape',reason:'derived geometry DAG has no exact primitive contract'});
      continue;
    }
    const {geometry,topology,attributes,depth,createdAtStep}=shape;
    shapes.push({geometry,topology,attributes,depth,createdAtStep});
    const excluded=Object.keys(shape).filter(k=>!['geometry','topology','attributes','depth','createdAtStep'].includes(k));
    omitted.push({index,fields:excluded,reason:'outside the primitive geometry contract'});
  }
  return {scene:{schema:'visible-cornfield/v1',shapes,states:[]},scope:{status:'explicit partial extraction',originalStreamRecoverable:false,omittedTopLevel:Object.keys(stream).filter(k=>k!=='shapes'),omitted}};
}

export function sceneFromPaths(paths) {
  if (!Array.isArray(paths)) throw new TypeError('expected ordered paths');
  return {schema:'visible-cornfield/v1',shapes:paths.map(vertices=>({
    geometry:{kind:'polyline',vertices,closed:false},
    topology:{dimension:1,nodes:vertices.length,edges:vertices.slice(1).map((_,i)=>[i,i+1]),components:1},
    attributes:{color:'#d8a03f',material:'matte',texture:0.2,curvature:[],symmetry:[],bounds:[]},
    depth:0,createdAtStep:0
  })),states:[]};
}

export function sceneFromNeuralStates(states) {
  return {schema:'visible-cornfield/v1',shapes:[],states:states.map(state=>Array.from(state))};
}
