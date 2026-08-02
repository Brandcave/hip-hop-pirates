import { dot, fillDiamond, ISO_H, rng, rowSpan, type Swatch } from './kit';

/**
 * The road: trodden earth. It has to read as a deliberate route through the
 * grass at a glance, including on the single-ramp monochrome themes where the
 * only thing separating it from the meadow is tone.
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[0]);

  const random = rng(2000 + variant);
  for (let i = 0; i < 10; i++) {
    const y = Math.floor(random() * ISO_H);
    const { x, w } = rowSpan(y);
    dot(ctx, Math.floor(x + random() * w), y, pal[1], top);
  }
}
