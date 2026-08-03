import { drawSides, fillDiamond, ISO_H, propCanvas, type Swatch } from './kit';

/**
 * Buildings and any other extruded block: walls, roofs, doors, and the low step
 * of a ledge. One prism — a lit top face and two shaded side faces.
 *
 * A building on this map is several of these tiles side by side (a block of R
 * roof tiles over a row of W wall tiles), so whatever is drawn here has to hold
 * together when repeated edge to edge as much as it has to look right alone.
 */
/**
 * How tall each kind of block stands. Owned here so the art and the shadow it
 * throws can never disagree — WorldScene reads these same numbers.
 */
export const BLOCK_HEIGHTS = {
  wall: 40,
  roof: 56,
  door: 40,
  ledge: 10,
} as const;

export type BlockName = keyof typeof BLOCK_HEIGHTS;

export function buildBlock(
  pal: Swatch,
  height: number,
  _variant = 0,
  _frame = 0,
  _neighbours = 0,
) {
  const { el, ctx } = propCanvas(height);
  fillDiamond(ctx, 0, pal[1]);
  drawSides(ctx, 0, height, pal[2], pal[3]);
  return el;
}

export const BLOCK_FRAMES = 1;
export const BLOCK_VARIANTS = 1;
void ISO_H;
