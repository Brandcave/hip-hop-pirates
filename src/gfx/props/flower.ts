import { ISO_W, propCanvas, type PropModule, type Swatch } from './kit';

const U = ISO_W / 32;

/** Small flowers scattered on the grass. Decoration only — nothing stands on them. */
export const flower: PropModule = {
  frames: 1,
  variants: 1,
  build(pal: Swatch) {
    const { el, ctx } = propCanvas(3 * U);
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
  },
};
