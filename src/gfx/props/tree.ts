import { ellipse, ISO_H, ISO_W, propCanvas, type PropModule, type Swatch } from './kit';

/**
 * A tree: trunk rising from the centre of the tile, canopy sitting on top of it.
 *
 * The canopy's lower edge overlaps the bark by a few pixels on purpose — a
 * canopy that merely touches the trunk reads as floating above it.
 */
const U = ISO_W / 32;
const TRUNK = 10 * U;
const CANOPY = 24 * U;

export const tree: PropModule = {
  frames: 1,
  variants: 1,
  build(pal: Swatch) {
    const { el, ctx, groundY } = propCanvas(TRUNK + CANOPY);

    const trunkTop = groundY - TRUNK;
    ctx.fillStyle = pal[0];
    ctx.fillRect(14 * U, trunkTop, 4 * U, TRUNK);
    ctx.fillStyle = pal[3];
    ctx.fillRect(13 * U, trunkTop, U, TRUNK);
    ctx.fillRect(18 * U, trunkTop, U, TRUNK);

    const cy = trunkTop - CANOPY / 2 + 6 * U;
    ellipse(ctx, 16 * U, cy, 13 * U, 11 * U, pal[3]);
    ellipse(ctx, 14 * U, cy - 2 * U, 10 * U, 8 * U, pal[2]);
    return el;
  },
};

export const TREE_HEIGHT = TRUNK + CANOPY;
void ISO_H;
