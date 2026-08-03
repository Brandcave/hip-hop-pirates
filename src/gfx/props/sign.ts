import { ISO_W, propCanvas, type PropModule, type Swatch } from './kit';

/**
 * A signpost: post in the ground, board on top of it. The board is positioned
 * from the ground up rather than pinned to the top of the canvas, or it floats.
 */
const U = ISO_W / 32;
const POST = 8 * U;
const BOARD = 9 * U;

export const sign: PropModule = {
  frames: 1,
  variants: 1,
  build(pal: Swatch) {
    const { el, ctx, groundY } = propCanvas(POST + BOARD);

    ctx.fillStyle = pal[3];
    ctx.fillRect(15 * U, groundY - POST, 2 * U, POST);

    const boardY = groundY - POST - BOARD;
    ctx.fillStyle = pal[2];
    ctx.fillRect(9 * U, boardY, 14 * U, BOARD);
    ctx.fillStyle = pal[0];
    ctx.fillRect(10 * U, boardY + U, 12 * U, BOARD - 2 * U);
    ctx.fillStyle = pal[3];
    ctx.fillRect(12 * U, boardY + 3 * U, 8 * U, U);
    ctx.fillRect(12 * U, boardY + 5 * U, 6 * U, U);
    return el;
  },
};

export const SIGN_HEIGHT = POST + BOARD;
