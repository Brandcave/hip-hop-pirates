import {
  bottomRow,
  E,
  has,
  HALF_W,
  ISO_H,
  ISO_W,
  N,
  propCanvas,
  rng,
  rowSpan,
  S,
  W,
  type Swatch,
} from './kit';

/**
 * Buildings, and the low terrain step of a ledge, which only shares the
 * extrusion code.
 *
 * A house on this map is a block of R tiles with a row of W/D tiles along its
 * south edge, so nothing here is ever seen alone: every surface has to continue
 * into the tile beside it. Two things make that work.
 *
 * 1. Everything is drawn as a function of the *neighbour mask*. The roof's
 *    height at a point is the distance to the nearest edge with no roof beyond
 *    it — which produces eaves at the outside, a ridge where two slopes meet,
 *    and hips at the corners, all from one expression and all continuous across
 *    tile boundaries. Walls drop their corner posts wherever a wall continues.
 * 2. Detail on a vertical face is positioned by (column, depth below the top
 *    edge) rather than by canvas row. `bottomRow` steps down two pixels per
 *    column, exactly as an iso wall does, so a band at a fixed depth is one
 *    unbroken line along the whole terrace instead of a stack of steps.
 *
 * The heights are chosen so the pieces meet. A wall stands WALL_H; the roof's
 * eave sits at exactly the same height, so the roof's lower edge lands on the
 * top of the wall row rather than floating above it or cutting into it.
 */

/**
 * How tall each kind of block stands. Owned here so the art and the shadow it
 * throws can never disagree — WorldScene reads these same numbers.
 *
 * They must stay DISTINCT: `buildBlock` is handed a height and no name, so the
 * height is the only thing that says which of the four is being drawn. `door`
 * is deliberately four taller than `wall` for that reason alone; it is drawn at
 * the wall's height with the spare rows left empty at the top of the canvas.
 */
export const BLOCK_HEIGHTS = {
  wall: 40,
  roof: 58,
  door: 44,
  ledge: 10,
} as const;

export type BlockName = keyof typeof BLOCK_HEIGHTS;

/** Top of the wall row, and the height the roof's eave comes down to. */
const WALL_H = 40;
/** How far the eave band drops as it crosses the wall row, front to back. */
const AWNING = 6;
/** Ridge height above the eave. Must keep BLOCK_HEIGHTS.roof = WALL_H + this. */
const ROOF_RISE = 18;

const KIND_OF_HEIGHT: Record<number, BlockName> = {
  [BLOCK_HEIGHTS.wall]: 'wall',
  [BLOCK_HEIGHTS.roof]: 'roof',
  [BLOCK_HEIGHTS.door]: 'door',
  [BLOCK_HEIGHTS.ledge]: 'ledge',
};

const frac = (n: number) => n - Math.floor(n);

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Grid coordinates of a pixel inside the tile diamond, in tiles, measured from
 * the tile's centre: `u` runs east, `w` runs south, each spanning -0.5..0.5.
 * Everything about a block's shape is written in terms of these, because they
 * are what the neighbour mask talks about.
 */
function uvAt(x: number, r: number) {
  const dx = x + 0.5 - ISO_W / 2;
  const dy = r + 0.5 - ISO_H / 2;
  return { u: dx / ISO_W + dy / ISO_H, w: dy / ISO_H - dx / ISO_W };
}

/**
 * Paint the block's upper surface, which may be sloped: `rise` gives how many
 * pixels above the flat diamond the surface stands at that point. Columns are
 * filled as runs so a slope never opens up gaps between rows.
 *
 * Returns, per canvas column, the last row the surface occupied — where the
 * vertical faces have to take over.
 */
function drawSurface(
  ctx: CanvasRenderingContext2D,
  top: number,
  rise: (u: number, w: number) => number,
  shade: (u: number, w: number) => string,
) {
  const bottoms = new Int32Array(ISO_W).fill(-1);
  for (let x = 0; x < ISO_W; x++) {
    let prev = -1;
    for (let r = 0; r < ISO_H; r++) {
      const s = rowSpan(r);
      if (x < s.x || x >= s.x + s.w) continue;
      const { u, w } = uvAt(x, r);
      const y = Math.round(top + r - rise(u, w));
      const from = prev < 0 ? y : Math.min(prev + 1, y);
      const color = shade(u, w);
      for (let yy = from; yy <= y; yy++) px(ctx, x, yy, color);
      prev = Math.max(prev, y);
    }
    bottoms[x] = prev;
  }
  return bottoms;
}

// ---------------------------------------------------------------------------
// Roof
// ---------------------------------------------------------------------------

type Side = 'n' | 'e' | 's' | 'w';

/**
 * The roof surface.
 *
 * Height at a point is the eave plus the pitch times the distance to the
 * nearest *open* edge — an edge with no roof tile beyond it. A tile with roof
 * to the north only is a plain slope; one open on two sides hips down into a
 * corner; one enclosed on all four sits flat at ridge height. Because the
 * expression only ever refers to distances measured from shared edges, the
 * surface of one tile meets its neighbour's exactly, and the ridge appears by
 * itself wherever two opposite slopes run into each other.
 */
function drawRoof(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  height: number,
  mask: number,
) {
  const top = ROOF_RISE;
  const open = {
    n: !has(mask, N),
    e: !has(mask, E),
    s: !has(mask, S),
    w: !has(mask, W),
  };

  // Nearest open edge, and which one it is. Ties resolve toward the faces the
  // camera actually sees, so a hip corner reads as lit rather than muddy.
  const nearest = (u: number, w: number) => {
    let dist = 1;
    let side: Side | null = null;
    const test = (o: boolean, d: number, s: Side) => {
      if (o && d < dist) {
        dist = d;
        side = s;
      }
    };
    test(open.s, 0.5 - w, 's');
    test(open.e, 0.5 - u, 'e');
    test(open.n, w + 0.5, 'n');
    test(open.w, u + 0.5, 'w');
    return { dist, side: side as Side | null };
  };

  const shade = (u: number, w: number) => {
    const { dist, side } = nearest(u, w);
    // Ridge cap: the tiles along the top course catch the most light.
    if (dist > 0.93) return pal[0];
    // Nine shingle courses per tile, laid parallel to the eave, with the butt
    // joints of each course staggered against the one below. Both are counted
    // in whole tiles, so both carry on into the next tile without a step.
    const course = dist * 9;
    const line = course - Math.floor(course) < 0.17;
    const along = side === 'e' || side === 'w' ? w : u;
    const joint =
      frac(along * 6 + (Math.floor(course) % 2) * 0.5) < 0.1 &&
      course - Math.floor(course) > 0.3;
    const mark = line || joint;
    if (side === 's' || side === null) return mark ? pal[1] : pal[0];
    if (side === 'e') return mark ? pal[3] : pal[1];
    return mark ? pal[1] : pal[3];
  };

  const bottoms = drawSurface(ctx, top, (u, w) => ROOF_RISE * nearest(u, w).dist, shade);

  // Below the surface. On the rows the map gives no wall tiles of their own,
  // this face IS the building's side wall — it just has to be painted from the
  // roof's ramp — so it gets a wall's anatomy: a lit board along the eave, deep
  // shade under the overhang, weatherboarding, a footing where it meets the
  // ground, and a window on any side that is actually open to the camera.
  for (let x = 0; x < ISO_W; x++) {
    const start = bottoms[x];
    if (start < 0) continue;
    const end = bottomRow(x) + height;
    for (let y = start + 1; y <= end; y++) {
      const fromTop = y - start - 1;
      const fromGround = end - y;
      // Depth below the eave plane, so the boarding lines up between tiles.
      const depth = y - (bottomRow(x) + top);
      // Board-and-batten on a side that faces the camera, weatherboarding
      // where it is only ever glimpsed. The battens are every fourth column,
      // and 4 divides the 32-column step between tiles along a face, so they
      // run unbroken up the whole side rather than restarting each tile.
      const batten = open.e && x >= HALF_W && x % 4 === 0;
      let color: string;
      if (fromTop < 2) color = pal[0];
      else if (fromTop < 4) color = pal[3];
      else if (fromGround < 4) color = fromGround === 0 ? pal[3] : pal[1];
      else if (batten) color = pal[1];
      else color = ((depth % 8) + 8) % 8 === 4 ? pal[1] : pal[3];
      px(ctx, x, y, color);
    }
  }
}

// ---------------------------------------------------------------------------
// Wall and door
// ---------------------------------------------------------------------------

/**
 * The front row of the house: plastered wall with a window, or the doorway.
 *
 * The top face is not the top of a box — it is the eave band, a shallow shingled
 * overhang dropping forward across the tile, which is what stops a row of these
 * reading as a row of cubes. Its back edge is at WALL_H, exactly where the
 * roof's eave lands, so roof and overhang meet on one line.
 *
 * The wall and the door use different ramps but the same two tones for that
 * band, so the overhang runs unbroken across the doorway.
 */
function drawWall(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  height: number,
  mask: number,
  isDoor: boolean,
) {
  // The door canvas is taller than the wall it lines up with; hold the surface
  // down so both tops sit at the same height above the ground.
  const top = height - WALL_H;
  const faceH = WALL_H - AWNING;

  const eaveDark = isDoor ? pal[2] : pal[3];
  const eaveMid = isDoor ? pal[0] : pal[2];

  const bottoms = drawSurface(
    ctx,
    top,
    (_u, w) => -AWNING * (w + 0.5),
    (_u, w) => {
      const t = w + 0.5;
      if (t > 0.9) return eaveMid;
      const course = t * 5;
      return course - Math.floor(course) < 0.24 ? eaveMid : eaveDark;
    },
  );

  /** A pixel on the vertical face, `d` pixels below the top of the wall. */
  const put = (x: number, d: number, color: string) => {
    if (x < 0 || x >= ISO_W) return;
    const y = bottomRow(x) + top + AWNING + d;
    if (y <= bottoms[x] || y > bottomRow(x) + height) return;
    px(ctx, x, y, color);
  };
  const run = (x0: number, x1: number, d: number, color: string) => {
    for (let x = x0; x <= x1; x++) put(x, d, color);
  };
  const column = (x: number, d0: number, d1: number, color: string) => {
    for (let d = d0; d <= d1; d++) put(x, d, color);
  };

  // Base coat. The left half of the diamond is the south face, which the camera
  // is looking at; the right half is the east face, turned away from the light.
  const front = pal[1];
  const sideFace = isDoor ? pal[2] : pal[0];
  const random = rng(910 + mask + (isDoor ? 64 : 0));
  for (let x = 0; x < ISO_W; x++) {
    const start = bottoms[x];
    if (start < 0) continue;
    const end = bottomRow(x) + height;
    const lit = x < HALF_W;
    for (let y = start + 1; y <= end; y++) {
      const d = y - (bottomRow(x) + top + AWNING);
      // Anything above the wall proper is still under the overhang.
      px(ctx, x, y, d < 0 ? eaveDark : lit ? front : sideFace);
    }
  }

  // The shadow the overhang casts on the wall below it, then plaster grain.
  for (let x = 0; x < ISO_W; x++) {
    run(x, x, 0, pal[2]);
    run(x, x, 1, x < HALF_W ? pal[0] : pal[2]);
  }
  if (!isDoor) {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(random() * ISO_W);
      const d = 3 + Math.floor(random() * (faceH - 8));
      put(x, d, x < HALF_W ? pal[0] : pal[2]);
    }
  }

  // Plinth: the wall meets the ground on a course of stone.
  for (let x = 0; x < ISO_W; x++) {
    for (let d = faceH - 4; d < faceH; d++) put(x, d, d === faceH - 4 ? pal[0] : pal[2]);
    put(x, faceH - 1, pal[3]);
  }

  if (isDoor) drawDoorway(pal, put, run, column, faceH);
  else drawWindow(pal, put, run);

  // Corner posts. A wall with a neighbour on that side is mid-terrace and gets
  // none — which is the whole reason a terrace stops looking like separate huts.
  // Next to the doorway the same rule puts a post either side of the opening,
  // where it reads as the door's casing.
  if (!has(mask, W)) {
    column(0, 0, faceH - 1, pal[2]);
    column(1, 0, faceH - 1, pal[2]);
    column(2, 0, faceH - 1, pal[3]);
  }
  if (!has(mask, E)) {
    column(29, 0, faceH - 1, pal[3]);
    for (let x = 30; x <= 33; x++) column(x, 0, faceH - 1, pal[2]);
  }
}

type Put = (x: number, d: number, color: string) => void;
type Run = (x0: number, x1: number, d: number, color: string) => void;
type Col = (x: number, d0: number, d1: number, color: string) => void;

/** A shuttered window, centred on the visible half of the wall's south face. */
function drawWindow(pal: Swatch, put: Put, run: Run) {
  const x0 = 8;
  const x1 = 23;
  const d0 = 7;
  const d1 = 20;

  for (let x = x0 + 1; x < x1; x++) {
    for (let d = d0 + 1; d < d1; d++) put(x, d, pal[3]);
  }
  // Light raking down the pane.
  for (let k = 0; k < 6; k++) {
    put(x0 + 2 + k, d0 + 2 + k, pal[0]);
    put(x0 + 3 + k, d0 + 2 + k, pal[0]);
  }
  // Frame and mullions.
  run(x0, x1, d0, pal[2]);
  run(x0, x1, d1, pal[2]);
  for (let d = d0; d <= d1; d++) {
    put(x0, d, pal[2]);
    put(x1, d, pal[2]);
    put(15, d, pal[2]);
    put(16, d, pal[2]);
  }
  run(x0 + 1, x1 - 1, 13, pal[2]);
  run(x0 + 1, x1 - 1, 14, pal[2]);
  // Sill, with its own shadow under it.
  run(x0 - 1, x1 + 1, d1 + 1, pal[0]);
  run(x0 - 1, x1 + 1, d1 + 2, pal[2]);
}

/**
 * The doorway. It is cut into the wall rather than set on top of it: jambs and
 * a lintel in the dark ramp, a recessed panel, and a threshold that runs down to
 * the ground so the opening reads as something you could walk through.
 */
function drawDoorway(pal: Swatch, put: Put, run: Run, column: Col, faceH: number) {
  const x0 = 6;
  const x1 = 25;
  const head = 4;
  const foot = faceH - 3;

  // Opening.
  for (let x = x0; x <= x1; x++) column(x, head, faceH - 1, pal[0]);
  // Jambs and lintel, and the shadow the frame throws into the recess.
  for (const x of [x0, x0 + 1, x1 - 1, x1]) column(x, head, faceH - 1, pal[2]);
  column(x0 + 2, head, faceH - 1, pal[3]);
  run(x0, x1, head, pal[2]);
  run(x0, x1, head + 1, pal[2]);
  run(x0 + 2, x1 - 2, head + 2, pal[3]);
  run(x0 - 1, x1 + 1, head - 1, pal[1]);

  // Panels: two recessed rectangles down the leaf.
  const panels: Array<[number, number]> = [
    [head + 5, head + 12],
    [head + 15, foot - 2],
  ];
  for (const [a, b] of panels) {
    run(x0 + 4, x1 - 3, a, pal[2]);
    run(x0 + 4, x1 - 3, b, pal[2]);
    column(x0 + 4, a, b, pal[2]);
    column(x1 - 3, a, b, pal[2]);
    run(x0 + 5, x1 - 4, a + 1, pal[1]);
  }

  // Handle.
  put(x1 - 5, head + 13, pal[1]);
  put(x1 - 4, head + 13, pal[1]);
  put(x1 - 5, head + 14, pal[3]);
  put(x1 - 4, head + 14, pal[3]);

  // Threshold: a worn step, then the dark line where it meets the ground.
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    put(x, foot, pal[1]);
    put(x, foot + 1, pal[2]);
    put(x, foot + 2, pal[3]);
  }
}

// ---------------------------------------------------------------------------
// Ledge
// ---------------------------------------------------------------------------

/**
 * Not a building — a hand-high step of packed earth the player hops down. It
 * only shares the extrusion, so it stays plain: path-coloured on top so it
 * carries on from the road it edges, a lit lip, and a crumbling earth face.
 */
function drawLedge(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  height: number,
  mask: number,
) {
  const random = rng(310 + mask);
  const bottoms = drawSurface(
    ctx,
    0,
    () => 0,
    () => pal[0],
  );

  for (let r = 0; r < ISO_H; r++) {
    const s = rowSpan(r);
    for (let x = Math.floor(s.x); x < s.x + s.w; x++) {
      if (random() < 0.16) px(ctx, x, r, pal[2]);
    }
  }

  for (let x = 0; x < ISO_W; x++) {
    const start = bottoms[x];
    if (start < 0) continue;
    const end = bottomRow(x) + height;
    for (let y = start + 1; y <= end; y++) {
      const d = y - start - 1;
      let color = x < HALF_W ? pal[2] : pal[3];
      if (d === 0) color = pal[0];
      if (y === end) color = pal[3];
      if (d > 0 && y < end && random() < 0.14) color = pal[3];
      px(ctx, x, y, color);
    }
  }
}

// ---------------------------------------------------------------------------

export function buildBlock(
  pal: Swatch,
  height: number,
  _variant = 0,
  _frame = 0,
  neighbours = 0,
) {
  const { el, ctx } = propCanvas(height);
  switch (KIND_OF_HEIGHT[height] ?? 'wall') {
    case 'roof':
      drawRoof(ctx, pal, height, neighbours);
      break;
    case 'door':
      drawWall(ctx, pal, height, neighbours, true);
      break;
    case 'ledge':
      drawLedge(ctx, pal, height, neighbours);
      break;
    default:
      drawWall(ctx, pal, height, neighbours, false);
      break;
  }
  return el;
}

export const BLOCK_FRAMES = 1;
export const BLOCK_VARIANTS = 1;
