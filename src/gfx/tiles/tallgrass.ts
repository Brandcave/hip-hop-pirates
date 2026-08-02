import { fillDiamond, HALF_H, ISO_H, ISO_W, insideDiamond, rng, type Swatch } from './kit';

/**
 * Tall grass: the encounter tile, so legibility beats prettiness. A player has
 * to know at a glance which side of the boundary they are standing on.
 *
 * It comes in two parts — the field it sits on (baked into the map) and the
 * blades that stand proud of it (a sprite, so shadows and actors sort against
 * it correctly).
 */

/** How far the blades rise above the tile. */
export const BLADE_HEIGHT = 12;

export function drawTallGrassGround(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[1]);

  const random = rng(3000 + variant);
  for (let i = 0; i < 10; i++) {
    const y = Math.floor(random() * ISO_H);
    const x = Math.floor(random() * ISO_W);
    if (!insideDiamond(x, y)) continue;
    ctx.fillStyle = pal[2];
    ctx.fillRect(x, top + y, 1, 2);
  }
}

/** Drawn into a canvas of ISO_H + BLADE_HEIGHT, blades above, tile below. */
export function drawTallGrassBlades(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
) {
  const random = rng(4000 + variant);
  for (let i = 0; i < 14; i++) {
    const bx = Math.floor(random() * ISO_W);
    const by = Math.floor(random() * ISO_H);
    if (!insideDiamond(bx, by)) continue;
    const h = 5 + Math.floor(random() * 5);
    const y = BLADE_HEIGHT + by - h;
    ctx.fillStyle = by > HALF_H ? pal[2] : pal[3];
    ctx.fillRect(bx, y, 1, h);
    ctx.fillRect(bx + 1, y + 2, 1, h - 2);
  }
}
