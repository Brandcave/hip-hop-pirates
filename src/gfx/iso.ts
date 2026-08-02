import type { Swatch } from './palette';

/**
 * Isometric projection and procedurally-drawn iso tile art.
 *
 * The game logic still thinks in a square grid — collision, ledges, encounters
 * and interaction are all unchanged. Only the mapping from grid to screen moved
 * to a 2:1 diamond lattice, plus the tile art that goes with it.
 *
 * Tiles are generated rather than authored: a top diamond in the swatch's base
 * colour, and (for anything with height) two extruded side faces in its darker
 * shades. That gets a real iso look out of the existing four-colour ramps
 * without drawing a single tile by hand.
 */

/** Diamond footprint of one grid tile. 2:1 is the classic iso ratio. */
export const ISO_W = 32;
export const ISO_H = 16;

const HALF_W = ISO_W / 2;
const HALF_H = ISO_H / 2;

export interface IsoMetrics {
  /** Screen x of grid (0,0)'s centre. */
  ox: number;
  oy: number;
  /** Size of the whole projected map, in pixels. */
  width: number;
  height: number;
}

export function isoMetrics(cols: number, rows: number): IsoMetrics {
  return {
    // Pushing right by `rows` half-widths keeps the leftmost tile at x >= 0.
    ox: rows * HALF_W,
    oy: HALF_H,
    width: (cols + rows) * HALF_W,
    height: (cols + rows) * HALF_H,
  };
}

/** Centre of grid tile (tx, ty) in screen pixels. */
export function isoScreen(tx: number, ty: number, m: IsoMetrics) {
  return { x: (tx - ty) * HALF_W + m.ox, y: (tx + ty) * HALF_H + m.oy };
}

/**
 * Painter-order depth. Tiles further along both axes are nearer the viewer, and
 * because it is derived from the same sum as the screen y it stays correct for
 * an actor mid-step between two tiles.
 */
export function isoDepth(tx: number, ty: number) {
  return (tx + ty) * HALF_H;
}

// ---------------------------------------------------------------------------
// Tile art
// ---------------------------------------------------------------------------

export type IsoKind =
  | 'ground'
  | 'water'
  | 'tallGrass'
  | 'block'
  | 'tree'
  | 'sign'
  | 'flower';

export interface IsoSpec {
  kind: IsoKind;
  /** Extrusion in pixels, for `block`. */
  height?: number;
  /**
   * Which shade of the ramp the top face uses. Ground tiles have no silhouette
   * to tell them apart, so they lean on tone + pattern instead — that is what
   * keeps a path readable against grass on the one-ramp monochrome themes.
   */
  tone?: 0 | 1 | 2 | 3;
  /** Scatter drawn onto the top face. */
  pattern?: PatternName;
}

export type PatternName = 'grass' | 'path' | 'sand' | 'none';

const PATTERNS: Record<PatternName, [number, number][]> = {
  grass: [
    [12, 5],
    [21, 8],
    [15, 11],
    [24, 6],
  ],
  path: [
    [10, 6],
    [16, 4],
    [22, 9],
    [13, 10],
    [19, 12],
    [26, 7],
  ],
  sand: [
    [11, 7],
    [12, 8],
    [20, 5],
    [21, 6],
    [17, 11],
    [18, 12],
  ],
  none: [],
};

/** Horizontal extent of the top diamond on row `r`. */
function rowSpan(r: number) {
  const k = r < HALF_H ? r : ISO_H - 1 - r;
  const w = (k + 1) * 4;
  return { x: HALF_W - w / 2, w };
}

/** Last row of the top diamond that covers column `x` — where a side face starts. */
function bottomRow(x: number) {
  const d = x < HALF_W ? x : ISO_W - 1 - x;
  return HALF_H + Math.floor(d / 2);
}

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { el, ctx };
}

/** The top face, drawn row by row so the edges stay hard pixel steps. */
function drawTop(ctx: CanvasRenderingContext2D, top: number, color: string) {
  ctx.fillStyle = color;
  for (let r = 0; r < ISO_H; r++) {
    const { x, w } = rowSpan(r);
    ctx.fillRect(x, top + r, w, 1);
  }
}

/** Scatter fixed specks so large areas of ground aren't dead flat. */
function speckle(
  ctx: CanvasRenderingContext2D,
  top: number,
  color: string,
  pattern: PatternName = 'grass',
) {
  ctx.fillStyle = color;
  for (const [x, y] of PATTERNS[pattern]) {
    ctx.fillRect(x, top + y, 1, 1);
  }
}

/** The two extruded side faces below the top diamond. */
function drawSides(
  ctx: CanvasRenderingContext2D,
  top: number,
  height: number,
  left: string,
  right: string,
) {
  for (let x = 0; x < ISO_W; x++) {
    ctx.fillStyle = x < HALF_W ? left : right;
    ctx.fillRect(x, top + bottomRow(x) + 1, 1, height);
  }
}

function block(pal: Swatch, height: number) {
  const { el, ctx } = canvas(ISO_W, ISO_H + height);
  drawTop(ctx, 0, pal[1]);
  drawSides(ctx, 0, height, pal[2], pal[3]);
  return el;
}

function ground(pal: Swatch, tone: 0 | 1 | 2 | 3, pattern: PatternName) {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  drawTop(ctx, 0, pal[tone]);
  // One step darker than the face, wrapping around at the darkest shade.
  speckle(ctx, 0, pal[tone === 3 ? 1 : tone + 1], pattern);
  return el;
}

function water(pal: Swatch) {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  drawTop(ctx, 0, pal[2]);
  // Crests, clipped to the diamond so they follow its edges.
  ctx.fillStyle = pal[1];
  for (const [r, x, w] of [
    [4, 10, 6],
    [7, 18, 8],
    [10, 8, 7],
  ]) {
    const span = rowSpan(r);
    const from = Math.max(x, span.x);
    const to = Math.min(x + w, span.x + span.w);
    if (to > from) ctx.fillRect(from, r, to - from, 1);
  }
  return el;
}

/** Grass with blades standing proud of the tile — the encounter marker. */
function tallGrass(pal: Swatch) {
  const blades = 6;
  const { el, ctx } = canvas(ISO_W, ISO_H + blades);
  drawTop(ctx, blades, pal[1]);
  ctx.fillStyle = pal[2];
  for (const [x, y, h] of [
    [8, 9, 5],
    [13, 6, 6],
    [18, 4, 6],
    [23, 7, 5],
    [11, 12, 4],
    [21, 11, 4],
  ]) {
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + 1, y + 1, 1, h - 1);
  }
  return el;
}

function tree(pal: Swatch, base: Swatch) {
  const trunk = 10;
  const canopy = 24;
  const { el, ctx } = canvas(ISO_W, ISO_H + trunk + canopy);
  const top = trunk + canopy;
  drawTop(ctx, top, base[1]);

  const groundY = top + HALF_H;

  // Trunk rises from the centre of the diamond.
  const trunkTop = groundY - trunk;
  ctx.fillStyle = pal[0];
  ctx.fillRect(14, trunkTop, 4, trunk);
  ctx.fillStyle = pal[3];
  ctx.fillRect(13, trunkTop, 1, trunk);
  ctx.fillRect(18, trunkTop, 1, trunk);

  // Canopy sits *on* the trunk — its lower edge overlaps the bark by a few
  // pixels, otherwise the crown reads as floating.
  const cy = trunkTop - canopy / 2 + 6;
  ellipse(ctx, 16, cy, 13, 11, pal[3]);
  ellipse(ctx, 14, cy - 2, 10, 8, pal[2]);
  return el;
}

function sign(pal: Swatch, base: Swatch) {
  const post = 8;
  const board = 9;
  const { el, ctx } = canvas(ISO_W, ISO_H + post + board);
  const top = post + board;
  drawTop(ctx, top, base[1]);

  const groundY = top + HALF_H;
  ctx.fillStyle = pal[3];
  ctx.fillRect(15, groundY - post, 2, post);
  ctx.fillStyle = pal[2];
  ctx.fillRect(9, 0, 14, board);
  ctx.fillStyle = pal[0];
  ctx.fillRect(10, 1, 12, board - 2);
  ctx.fillStyle = pal[3];
  ctx.fillRect(12, 3, 8, 1);
  ctx.fillRect(12, 5, 6, 1);
  return el;
}

function flower(pal: Swatch, base: Swatch) {
  const { el, ctx } = canvas(ISO_W, ISO_H + 3);
  drawTop(ctx, 3, base[1]);
  speckle(ctx, 3, base[2]);
  for (const [cx, cy] of [
    [13, 8],
    [20, 12],
  ]) {
    ctx.fillStyle = pal[0];
    ctx.fillRect(cx - 1, cy, 3, 1);
    ctx.fillRect(cx, cy - 1, 1, 3);
    ctx.fillStyle = pal[2];
    ctx.fillRect(cx, cy, 1, 1);
  }
  return el;
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    if (w > 0) ctx.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

/**
 * Shadow stamps. Both are solid black and fully opaque — direction, length and
 * strength all come from the light at draw time, so one texture serves every
 * hour of the day.
 *
 * Round things get a blob that stretches into a smear; blocks get a copy of the
 * tile diamond, because a building's shadow should have the building's corners.
 */
export function buildShadowBlob(): HTMLCanvasElement {
  const { el, ctx } = canvas(16, 8);
  ellipse(ctx, 8, 4, 8, 4, '#000000');
  return el;
}

export function buildShadowDiamond(): HTMLCanvasElement {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  drawTop(ctx, 0, '#000000');
  return el;
}

/**
 * Build one tile's art. `base` is the ramp of the ground a decoration stands on
 * (grass, normally), so props blend into the terrain around them.
 */
export function buildIsoTile(spec: IsoSpec, pal: Swatch, base: Swatch): HTMLCanvasElement {
  switch (spec.kind) {
    case 'water':
      return water(pal);
    case 'tallGrass':
      return tallGrass(pal);
    case 'block':
      return block(pal, spec.height ?? 16);
    case 'tree':
      return tree(pal, base);
    case 'sign':
      return sign(pal, base);
    case 'flower':
      return flower(pal, base);
    default:
      return ground(pal, spec.tone ?? 1, spec.pattern ?? 'grass');
  }
}
