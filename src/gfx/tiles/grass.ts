import { dot, fillDiamond, ISO_H, rng, rowSpan, type Swatch } from './kit';

/**
 * Short grass — the default ground, and by far the most repeated tile on the
 * map, so it has to hold up in bulk more than it has to look good alone.
 */
export function drawGrass(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[1]);

  const random = rng(1000 + variant);
  for (let i = 0; i < 8; i++) {
    const y = Math.floor(random() * ISO_H);
    const { x, w } = rowSpan(y);
    dot(ctx, Math.floor(x + random() * w), y, pal[2], top);
  }
}
