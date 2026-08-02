import type { Swatch } from './palette';
import { drawGrass } from './tiles/grass';
import {
  HALF_H,
  HALF_W,
  ISO_H,
  ISO_W,
  makeCanvas as canvas,
  rowSpan,
  VARIANTS,
} from './tiles/kit';
import { drawRoad } from './tiles/road';
import { BLADE_HEIGHT, drawTallGrassBlades, drawTallGrassGround } from './tiles/tallgrass';
import { drawWater } from './tiles/water';

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

export { ISO_H, ISO_W, VARIANTS };

/**
 * Props were authored against a 32x16 diamond. `U` scales those coordinates to
 * whatever ISO_W is now, so the shapes stay in proportion and the numbers stay
 * readable as the sizes they were drawn at. Terrain tiles in ./tiles are drawn
 * at full resolution instead — they have detail worth the pixels.
 */
const U = ISO_W / 32;

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
  /**
   * The ground this tile sits on. For a prop tile that is the terrain
   * *underneath* it: props draw above the shadow layer, so they must not paint
   * their own ground — the map bakes it, and the shadow lands on it in between.
   */
  terrain: TerrainName;
  /** Extrusion in pixels, for `block`. */
  height?: number;
}

export type TerrainName = 'grass' | 'tallGrass' | 'road' | 'water' | 'sand';

type TerrainDraw = (
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top?: number,
) => void;

/**
 * Each terrain names the ramp it paints with and the module that paints it.
 * A prop's ground goes through the same table, so the grass under a tree is
 * drawn by exactly the code that drew the grass beside it — which is what keeps
 * the seam invisible.
 */
export const TERRAIN: Record<TerrainName, { swatch: string; draw: TerrainDraw }> = {
  grass: { swatch: 'grass', draw: drawGrass },
  tallGrass: { swatch: 'tallGrass', draw: drawTallGrassGround },
  road: { swatch: 'path', draw: drawRoad },
  water: { swatch: 'water', draw: drawWater },
  sand: { swatch: 'sand', draw: (ctx, pal, variant, top) => drawRoad(ctx, pal, variant, top) },
};

/**
 * Which variant a map cell uses. Hashed from the coordinates so it is stable
 * across a rebake, and uncorrelated enough that no pattern emerges in the field.
 */
export function variantAt(x: number, y: number) {
  const h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  return (h >>> 0) % VARIANTS;
}

/** The top face, drawn row by row so the edges stay hard pixel steps. */
function drawTop(ctx: CanvasRenderingContext2D, top: number, color: string) {
  ctx.fillStyle = color;
  for (let r = 0; r < ISO_H; r++) {
    const { x, w } = rowSpan(r);
    ctx.fillRect(x, top + r, w, 1);
  }
}

/** Last row of the diamond that covers column `x` — where a side face starts. */
function bottomRow(x: number) {
  const d = x < HALF_W ? x : ISO_W - 1 - x;
  return HALF_H + Math.floor(d / (ISO_W / ISO_H));
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

function tree(pal: Swatch) {
  const trunk = 10 * U;
  const canopy = 24 * U;
  const { el, ctx } = canvas(ISO_W, ISO_H + trunk + canopy);
  const top = trunk + canopy;

  const groundY = top + HALF_H;

  // Trunk rises from the centre of the diamond.
  const trunkTop = groundY - trunk;
  ctx.fillStyle = pal[0];
  ctx.fillRect(14 * U, trunkTop, 4 * U, trunk);
  ctx.fillStyle = pal[3];
  ctx.fillRect(13 * U, trunkTop, U, trunk);
  ctx.fillRect(18 * U, trunkTop, U, trunk);

  // Canopy sits *on* the trunk — its lower edge overlaps the bark by a few
  // pixels, otherwise the crown reads as floating.
  const cy = trunkTop - canopy / 2 + 6 * U;
  ellipse(ctx, 16 * U, cy, 13 * U, 11 * U, pal[3]);
  ellipse(ctx, 14 * U, cy - 2 * U, 10 * U, 8 * U, pal[2]);
  return el;
}

function sign(pal: Swatch) {
  const post = 8 * U;
  const board = 9 * U;
  const { el, ctx } = canvas(ISO_W, ISO_H + post + board);
  const top = post + board;

  const groundY = top + HALF_H;
  ctx.fillStyle = pal[3];
  ctx.fillRect(15 * U, groundY - post, 2 * U, post);
  // The board sits *on* the post. Pinning it to the top of the canvas instead
  // leaves it floating, because the canvas is taller than post + board.
  const boardY = groundY - post - board;
  ctx.fillStyle = pal[2];
  ctx.fillRect(9 * U, boardY, 14 * U, board);
  ctx.fillStyle = pal[0];
  ctx.fillRect(10 * U, boardY + U, 12 * U, board - 2 * U);
  ctx.fillStyle = pal[3];
  ctx.fillRect(12 * U, boardY + 3 * U, 8 * U, U);
  ctx.fillRect(12 * U, boardY + 5 * U, 6 * U, U);
  return el;
}

function flower(pal: Swatch) {
  const { el, ctx } = canvas(ISO_W, ISO_H + 3 * U);
  for (const [ax, ay] of [
    [13, 8],
    [20, 12],
  ]) {
    const cx = ax * U;
    const cy = ay * U;
    ctx.fillStyle = pal[0];
    ctx.fillRect(cx - U, cy, 3 * U, U);
    ctx.fillRect(cx, cy - U, U, 3 * U);
    ctx.fillStyle = pal[2];
    ctx.fillRect(cx, cy, U, U);
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
  const { el, ctx } = canvas(16 * U, 8 * U);
  ellipse(ctx, 8 * U, 4 * U, 8 * U, 4 * U, '#000000');
  return el;
}

export function buildShadowDiamond(): HTMLCanvasElement {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  drawTop(ctx, 0, '#000000');
  return el;
}

/** The flat diamond a tile sits on. Baked into the map, under the shadow layer. */
export function buildIsoGround(
  terrain: TerrainName,
  pal: Swatch,
  variant: number,
): HTMLCanvasElement {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  TERRAIN[terrain].draw(ctx, pal, variant, 0);
  return el;
}

/**
 * Everything a tile has *above* the ground — blades, a tree, a building. Drawn
 * as a depth-sorted sprite with a transparent base, so shadows cast across the
 * tile stay visible underneath it.
 */
export function buildIsoProp(
  spec: IsoSpec,
  pal: Swatch,
  variant: number,
): HTMLCanvasElement | null {
  switch (spec.kind) {
    case 'tallGrass': {
      const { el, ctx } = canvas(ISO_W, ISO_H + BLADE_HEIGHT);
      drawTallGrassBlades(ctx, pal, variant);
      return el;
    }
    case 'block':
      if (variant > 0) return null;
      return block(pal, spec.height ?? 16);
    case 'tree':
      return variant > 0 ? null : tree(pal);
    case 'sign':
      return variant > 0 ? null : sign(pal);
    case 'flower':
      return variant > 0 ? null : flower(pal);
    default:
      return null;
  }
}
