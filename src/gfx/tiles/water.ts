import { fillDiamond, span, type Swatch } from './kit';

/**
 * Water. A pond is many tiles of this butted together, so it has to read as one
 * continuous surface — the crests are what sell depth, and the tiling is what
 * usually ruins it.
 */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[2]);

  const crests: [number, number, number][][] = [
    [[8, 20, 12], [14, 36, 16], [20, 16, 14]],
    [[10, 28, 14], [16, 12, 12], [22, 34, 12]],
    [[6, 26, 10], [13, 18, 14], [21, 30, 16]],
    [[9, 14, 14], [15, 32, 12], [23, 20, 12]],
  ];
  for (const [y, x, w] of crests[variant % crests.length]) {
    span(ctx, y, x, w, pal[1], top);
  }
}
