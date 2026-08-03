import { ISO_H, ISO_W, makeCanvas, type Swatch } from '../tiles/kit';

export type { Swatch };
export {
  bottomRow,
  drawSides,
  ellipse,
  fillDiamond,
  insideDiamond,
  ISO_H,
  ISO_W,
  HALF_W,
  HALF_H,
  makeCanvas,
  rng,
  rowSpan,
  span,
  dot,
} from '../tiles/kit';

/**
 * A prop is everything a tile has standing on it: a tree, a sign, a building,
 * blades of grass, the moving surface of water.
 *
 * Contract every prop module implements:
 *
 * - `build(pal, variant, frame)` returns a canvas ISO_W wide. The BOTTOM ISO_H
 *   rows of that canvas are the tile's own diamond and must be left transparent
 *   — the map bakes the ground there, and shadows are cast onto it. Anything
 *   above those rows is height. `propCanvas()` sizes this for you.
 * - `frames` is the animation length. 1 means static. Frames play on a loop and
 *   MUST cycle seamlessly: frame `frames - 1` is followed by frame 0 again, so a
 *   sway that ends where it started is the whole job.
 * - `variants` is how many interchangeable versions exist. The map picks one per
 *   tile by position hash.
 *
 * Frames multiply with variants — `frames * variants` textures per prop — so
 * keep both modest. Six frames and four variants is 24 canvases, which is fine;
 * sixteen of each is not.
 */
export interface PropModule {
  frames: number;
  variants: number;
  /** Frames per second. Ignored when `frames` is 1. */
  frameRate?: number;
  /**
   * Set when the art depends on what is next to it. `build` then receives a
   * bitmask of which orthogonal neighbours carry the SAME prop, and a texture is
   * generated for each of the 16 combinations.
   *
   * This is what separates a row of identical cubes from a building: a wall with
   * neighbours on two sides is an interior span and should not draw its own
   * corners, while a wall alone is a whole hut.
   */
  neighbourAware?: boolean;
  build(pal: Swatch, variant: number, frame: number, neighbours: number): HTMLCanvasElement;
}

/** Neighbour mask bits, in grid terms. North is -y, east is +x. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

/** Does the mask say there is a matching neighbour on this side? */
export const has = (mask: number, side: number) => (mask & side) !== 0;

/**
 * Canvas for a prop standing `height` pixels tall above its tile. The tile's own
 * diamond occupies the bottom ISO_H rows and is left transparent.
 */
export function propCanvas(height: number) {
  const { el, ctx } = makeCanvas(ISO_W, ISO_H + height);
  return { el, ctx, height, groundY: height + ISO_H / 2 };
}
