import type { Swatch } from './palette';
import { BLOCK_HEIGHTS, buildBlock, type BlockName } from './props/building';
import { flower } from './props/flower';
import { sign } from './props/sign';
import { tree } from './props/tree';
import type { PropModule } from './props/kit';
import { drawGrass } from './tiles/grass';
import {
  ellipse,
  fillDiamond,
  HALF_H,
  HALF_W,
  ISO_H,
  ISO_W,
  makeCanvas as canvas,
  VARIANTS,
} from './tiles/kit';
import { drawRoad } from './tiles/road';
import { drawTallGrassGround, tallGrassBlades } from './tiles/tallgrass';
import { drawWaterBase, waterSurface } from './tiles/water';

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
  water: { swatch: 'water', draw: drawWaterBase },
  sand: { swatch: 'sand', draw: (ctx, pal, variant, top) => drawRoad(ctx, pal, variant, top) },
};

/** Props: everything standing above the ground, animated or not. */
export type PropName =
  | 'tree'
  | 'sign'
  | 'flower'
  | 'tallGrass'
  | 'water'
  | 'wall'
  | 'roof'
  | 'door'
  | 'ledge';

function blockProp(name: BlockName): PropModule {
  return {
    frames: 1,
    variants: 1,
    neighbourAware: true,
    build: (pal, variant, frame, neighbours) =>
      buildBlock(pal, BLOCK_HEIGHTS[name], variant, frame, neighbours),
  };
}

/** Height of a block prop, or 0 for anything that isn't one. */
export function blockHeight(prop: PropName | undefined) {
  return prop && prop in BLOCK_HEIGHTS ? BLOCK_HEIGHTS[prop as BlockName] : 0;
}

export const PROPS: Record<PropName, PropModule> = {
  tree,
  sign,
  flower,
  tallGrass: tallGrassBlades,
  water: waterSurface,
  wall: blockProp('wall'),
  roof: blockProp('roof'),
  door: blockProp('door'),
  ledge: blockProp('ledge'),
};

export interface IsoSpec {
  /**
   * The ground this tile sits on. For a prop tile that is the terrain
   * *underneath* it: props draw above the shadow layer, so they must not paint
   * their own ground — the map bakes it, and the shadow lands on it in between.
   */
  terrain: TerrainName;
  /** What stands on the tile, if anything. */
  prop?: PropName;
}

/**
 * Which variant a map cell uses. Hashed from the coordinates so it is stable
 * across a rebake, and uncorrelated enough that no pattern emerges in the field.
 */
export function variantAt(x: number, y: number) {
  // The mix matters. Hashing straight into `% VARIANTS` keeps only the low bits,
  // which for two odd multipliers collapses to something like (x + 3y) % 4 — a
  // strictly periodic lattice, so any distinctive tile reappears on a regular
  // diagonal grid and the variants buy nothing. Avalanche first, then reduce.
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) % VARIANTS;
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
  const { el, ctx } = canvas(ISO_W / 2, ISO_H / 2);
  ellipse(ctx, ISO_W / 4, ISO_H / 4, ISO_W / 4, ISO_H / 4, '#000000');
  return el;
}

export function buildShadowDiamond(): HTMLCanvasElement {
  const { el, ctx } = canvas(ISO_W, ISO_H);
  fillDiamond(ctx, 0, '#000000');
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
 * One frame of one variant of a tile's prop. Drawn as a depth-sorted sprite with
 * a transparent base, so shadows cast across the tile stay visible underneath.
 */
export function buildIsoProp(
  spec: IsoSpec,
  pal: Swatch,
  variant: number,
  frame = 0,
  neighbours = 0,
): HTMLCanvasElement | null {
  if (!spec.prop) return null;
  const module = PROPS[spec.prop];
  if (variant >= module.variants || frame >= module.frames) return null;
  return module.build(pal, variant, frame, neighbours);
}
