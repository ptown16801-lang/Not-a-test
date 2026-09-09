/**
 * Direct ASCII cornfield renderer for Shape Cognition geometry.
 *
 * Deliberately independent of the dirt-inscription renderer: there are no
 * actuator commands, soil budgets, physical coordinates, or steganography.
 */

const EPSILON = 1e-12;
const DEFAULTS = Object.freeze({width: 88, height: 32, horizon: 9});

function integerOption(name, value, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const transformPoint = ([x, y], [a, b, c, d, e, f]) => [a * x + c * y + e, b * x + d * y + f];

function circle(center, radius, samples = 48) {
  return [Array.from({length: samples + 1}, (_, index) => {
    const angle = index * Math.PI * 2 / samples;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  })];
}

function bezier(points, samples = 40) {
  if (points.length < 2) return [];
  return [Array.from({length: samples + 1}, (_, index) => {
    const work = points.map(point => [...point]);
    const t = index / samples;
    for (let level = work.length - 1; level; level--) {
      for (let item = 0; item < level; item++) work[item] = lerp(work[item], work[item + 1], t);
    }
    return work[0];
  })];
}

/** Replay the existing immutable geometry DAG directly into 2-D polylines. */
export function replayShapePaths(shapeId, shapeMap, cache = new Map()) {
  if (cache.has(shapeId)) return cache.get(shapeId).map(path => path.map(point => [...point]));
  const shape = shapeMap.get(shapeId);
  if (!shape) throw new Error(`Unknown shape ${shapeId}`);
  const geometry = shape.geometry;
  let paths;
  if (geometry.kind === 'point') paths = circle(geometry.p, .025, 12);
  else if (geometry.kind === 'segment' || geometry.kind === 'ray') paths = [[geometry.a, geometry.b]];
  else if (geometry.kind === 'disk') paths = circle(geometry.center, geometry.radius);
  else if (geometry.kind === 'polygon') paths = [[...geometry.vertices, geometry.vertices[0]]];
  else if (geometry.kind === 'curve') paths = bezier(geometry.controlPoints);
  else if (geometry.kind === 'ball') paths = circle([geometry.center[0], geometry.center[1]], geometry.radius);
  else if (geometry.kind === 'surface' && geometry.seed.length >= 4) {
    const [x0, y0, x1, y1] = geometry.seed;
    paths = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  } else if (geometry.kind === 'surface') paths = [];
  else {
    const parents = shape.provenance.parents.map(parent => replayShapePaths(parent, shapeMap, cache));
    const operation = geometry.operation || shape.provenance.operator;
    const params = {...shape.provenance.params, ...geometry.params};
    if (operation === 'transform') {
      paths = parents[0].map(path => path.map(point => transformPoint(point, params.matrix)));
    } else if (operation === 'replicateArrange') {
      paths = [];
      const count = Math.max(1, params.count ?? 2);
      const arrangement = params.arrangement ?? 'bilateral';
      for (let index = 0; index < count; index++) {
        const angle = index * Math.PI * 2 / count;
        const radial = arrangement === 'radial' || arrangement === 'radialRotate';
        const tx = radial ? Math.cos(angle) * .28 : (index - (count - 1) / 2) * .28;
        const ty = radial ? Math.sin(angle) * .2 : 0;
        const mirror = arrangement === 'bilateral' && index % 2 ? -1 : 1;
        paths.push(...parents[0].map(path => path.map(([x, y]) => [mirror * x + tx, y + ty])));
      }
    } else if (operation === 'morph') {
      const amount = Number(params.parameters?.[0] ?? 0);
      paths = parents[0].map(path => path.map(([x, y]) => [x, y + Math.sin(x * Math.PI) * amount * .08]));
    } else if (operation === 'dualPolar') {
      paths = parents[0].map(path => [...path].reverse());
    } else if (operation === 'subdivideSimplify') {
      const level = Math.max(1, params.level ?? 1);
      paths = parents[0].map(path => params.mode === 'simplify'
        ? path.filter((_, index) => index % (level + 1) === 0 || index === path.length - 1)
        : path.flatMap((point, index) => index < path.length - 1
          ? [point, ...Array.from({length: level}, (_, item) => lerp(point, path[index + 1], (item + 1) / (level + 1)))]
          : [point]));
    } else {
      // combine, compose, and project/slice remain direct, visible overlays in
      // this deliberately rudimentary terminal view.
      paths = parents.flat();
    }
  }
  const finite = paths
    .filter(path => path.length >= 2)
    .map(path => path.filter(point => point.length >= 2 && point.every(Number.isFinite)));
  cache.set(shapeId, finite);
  return finite.map(path => path.map(point => [...point]));
}

function pathBounds(paths) {
  const points = paths.flat();
  if (!points.length) throw new Error('Cannot render a shape with no 2-D path points');
  return points.reduce(
    (bounds, [x, y]) => [
      Math.min(bounds[0], x), Math.min(bounds[1], y),
      Math.max(bounds[2], x), Math.max(bounds[3], y)
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
}

function segmentGlyph(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy) * 2) return '-';
  if (Math.abs(dy) >= Math.abs(dx) * 2) return '|';
  return dx * dy >= 0 ? '\\' : '/';
}

function mergeGlyph(previous, next) {
  if (previous === ' ' || previous === '.' || previous === next) return next;
  if ('Yy|/\\'.includes(previous) && next === '*') return '*';
  return '+';
}

function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** Render thought paths inside a perspective ASCII cornfield scene. */
export function renderCornfieldPaths(paths, options = {}) {
  const width = integerOption('width', options.width ?? DEFAULTS.width, 40, 240);
  const height = integerOption('height', options.height ?? DEFAULTS.height, 18, 120);
  const horizon = integerOption('horizon', options.horizon ?? Math.min(DEFAULTS.horizon, Math.floor(height / 3)), 5, height - 10);
  const seed = integerOption('seed', options.seed ?? 1, 0, 0xffffffff);
  const random = makeRandom(seed);
  const grid = Array.from({length: height}, () => Array(width).fill(' '));
  const center = (width - 1) / 2;

  const put = (x, y, glyph) => {
    const column = Math.max(0, Math.min(width - 1, Math.round(x)));
    const row = Math.max(0, Math.min(height - 1, Math.round(y)));
    grid[row][column] = mergeGlyph(grid[row][column], glyph);
  };
  const line = (start, end, fixedGlyph) => {
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
    const glyph = fixedGlyph || segmentGlyph(dx, dy);
    for (let sample = 0; sample <= samples; sample++) {
      const t = sample / samples;
      put(start[0] + dx * t, start[1] + dy * t, glyph);
    }
  };

  // Amber sky cannot be encoded in monochrome ASCII, but the centered sun and
  // long horizon preserve the intended composition.
  put(center, 2, 'O');
  line([center - 3, 2], [center - 2, 2], '-');
  line([center + 2, 2], [center + 3, 2], '-');
  put(center - 2, 1, '\\'); put(center + 2, 1, '/');
  put(center - 2, 3, '/'); put(center + 2, 3, '\\');
  for (let x = 0; x < width; x++) put(x, horizon, x % 4 === 0 ? 'Y' : '_');

  const corridorHalfWidth = row => {
    const t = (row - horizon) / Math.max(1, height - 1 - horizon);
    return 2 + t * width * .24;
  };

  // Six-foot corn is represented relationally: dense/tall foreground stalks,
  // small horizon stalks, and a perspective opening through the center.
  for (let row = horizon + 1; row < height; row++) {
    const half = corridorHalfWidth(row);
    const spacing = row < horizon + 5 ? 4 : row < horizon + 12 ? 3 : 2;
    for (let column = 0; column < width; column++) {
      const inCorn = column < center - half || column > center + half;
      if (inCorn && (column + row) % spacing === 0 && random() > .16) {
        put(column, row, random() > .42 ? 'Y' : 'y');
        if (row + 1 < height && random() > .35) put(column, row + 1, '|');
      } else if (!inCorn && row > horizon + 2 && (column + row) % 5 === 0) {
        put(column, row, '.');
      }
    }
    put(center - half, row, '/');
    put(center + half, row, '\\');
  }

  const [minX, minY, maxX, maxY] = pathBounds(paths);
  const dataWidth = Math.max(EPSILON, maxX - minX);
  const dataHeight = Math.max(EPSILON, maxY - minY);
  const farRow = horizon + 3;
  const nearRow = height - 3;
  const project = ([x, y]) => {
    const u = (x - minX) / dataWidth;
    const v = (y - minY) / dataHeight;
    const row = nearRow - v * (nearRow - farRow);
    const half = corridorHalfWidth(row) * .78;
    return [center + (u * 2 - 1) * half, row];
  };
  for (const path of paths) {
    for (let index = 1; index < path.length; index++) line(project(path[index - 1]), project(path[index]), '*');
  }

  const art = grid.map(row => row.join('').replace(/\s+$/u, '')).join('\n');
  return Object.freeze({
    schema: 'ascii-cornfield-render/v1', width, height, horizon,
    pathCount: paths.length, art
  });
}

/** Replay and render one selected shape directly into the ASCII cornfield. */
export function renderCornfieldAscii(stream, options = {}) {
  if (!stream || !['shape-cognition/v1', 'shape-cognition/v2'].includes(stream.schema)) {
    throw new TypeError('stream must be a shape-cognition/v1 or shape-cognition/v2 snapshot');
  }
  const shapes = new Map((stream.shapes || []).map(shape => [shape.id, shape]));
  const lastSelected = stream.steps?.at(-1)?.selected?.[0]?.shapeId;
  const shapeId = options.shapeId || lastSelected || stream.active?.[0];
  if (!shapeId || !shapes.has(shapeId)) throw new Error('No renderable shape is present in the stream');
  const paths = replayShapePaths(shapeId, shapes);
  const rendered = renderCornfieldPaths(paths, options);
  return Object.freeze({
    schema: 'ascii-cornfield/v1',
    sourceSchema: stream.schema,
    pipeline: 'artistic-translation',
    shapeId,
    ...rendered,
    qualification: 'Approximate artistic/debug cornfield view; not a dirt-renderer output or validated neural-state visualization.'
  });
}
