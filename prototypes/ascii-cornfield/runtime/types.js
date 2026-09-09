/** @typedef {[number, number]} Vec2 */

/**
 * @typedef {'point'|'segment'|'ray'|'disk'|'polygon'|'ball'|'curve'|'surface'} PrimitiveKind
 * @typedef {'primitive'|'transform'|'morph'|'combine'|'replicateArrange'|'projectSlice'|'dualPolar'|'subdivideSimplify'|'compose'} OperatorKind
 * @typedef {{kind:'affine2d', matrix:[number,number,number,number,number,number]} TransformGeometry
 * @typedef {{kind:'point', p:Vec2}|{kind:'segment'|'ray', a:Vec2,b:Vec2}|{kind:'disk',center:Vec2,radius:number}|{kind:'polygon',vertices:Vec2[]}|{kind:'ball',center:[number,number,number],radius:number}|{kind:'curve',controlPoints:Vec2[]}|{kind:'surface',seed:number[]}|{kind:'derived',operation:OperatorKind,params:Record<string,unknown>}} Geometry
 * @typedef {{nodes:number,edges:Array<[number,number]>,components:number,dimension:0|1|2|3}} Topology
 * @typedef {{color:string,material:string,texture:number,curvature:number[],symmetry:string[],bounds:number[],temporal?:{phase:number,velocity:number[]}}} ShapeAttributes
 * @typedef {{operator:OperatorKind,parents:string[],params:Record<string,unknown>}} Provenance
 * @typedef {{id:string,geometry:Geometry,topology:Topology,attributes:ShapeAttributes,provenance:Provenance,depth:number,createdAtStep:number,tags:string[]}} Shape
 * @typedef {{novelty:number,coherence:number,simplicity:number,goalRelevance:number,symmetry:number,predictivePower:number,total:number}} Fitness
 * @typedef {{shape:Shape,fitness:Fitness}} ScoredShape
 */

export const OPERATOR_KINDS = Object.freeze([
  'transform', 'morph', 'combine', 'replicateArrange', 'projectSlice',
  'dualPolar', 'subdivideSimplify', 'compose'
]);

