import { ellipse, propCanvas, rng, type PropModule, type Swatch } from './kit';

/**
 * A signpost: a planked board bolted to a post that is driven into the turf.
 *
 * COLOUR. The `sign` ramp is [cream, grass, mid wood, dark wood] — index 1 is the
 * grass the prop stands on, left over from when props painted their own ground.
 * So the woodwork is a three-tone ramp: pal[0] is the pale weathered face, pal[2]
 * the sawn edge / grain, pal[3] the shadowed edge and the ink. pal[1] is used for
 * exactly one thing, at the very bottom: blades growing in FRONT of the post, so
 * the base reads as driven into the turf rather than parked on it. (The sign tile
 * always lays grass under itself — see tiles.ts — so that colour always matches.)
 *
 * FORM. A board that is a plain screen-aligned rectangle reads as a decal stuck
 * on the scene. This one is a slab: the front face is the readable rectangle, but
 * it is given DEPTH pixels of body receding up and to the RIGHT along the iso
 * axis, which exposes a top face (mid) and a right end cap (dark). The cap steps
 * up 1px every 2px of depth, so its silhouette obeys the 2:1 projection and the
 * board sits in the world instead of on top of it. Light is from the upper left,
 * matching the buildings, which is why the far side is the dark one.
 */

const POST_H = 18;
const BOARD_H = 22;
/** Body of the slab, in pixels of recession up-and-right. */
const DEPTH = 3;
/** Extra headroom so the receded top face is not clipped by the canvas. */
const HEIGHT = POST_H + BOARD_H + 3;

/** Front face of the board, in canvas columns. */
const BX0 = 14;
const BX1 = 49;

/** Left column of the post, and its width. */
const PX = 30;
const PW = 6;

/**
 * Ink on the board. Ragged word lengths are what make a row of bars read as
 * writing; even spacing reads as a barcode. One heading on the upper plank, two
 * body lines on the lower one.
 */
const WRITING: { y: number; h: number; words: [number, number][] }[] = [
  { y: 3, h: 3, words: [[8, 9], [19, 8]] },
  { y: 13, h: 2, words: [[4, 6], [12, 5], [19, 8]] },
  { y: 16, h: 2, words: [[4, 8], [14, 6]] },
];

export const sign: PropModule = {
  frames: 1,
  variants: 1,
  build(pal: Swatch) {
    const { el, ctx, groundY } = propCanvas(HEIGHT);
    const fill = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };

    const boardBottom = groundY - POST_H;
    const boardTop = boardBottom - BOARD_H + 1;
    const bw = BX1 - BX0 + 1;

    // --- Ground. Earth turned over when the post went in. Two nested iso
    // ellipses — a dark rim with a lit crown inside it — so it reads as a mound
    // the post disappears into rather than a stain on the lawn. It straddles
    // groundY because the contact patch is a ring on the ground plane, not a
    // line, and a couple of clods sit outside the ring.
    const cx = PX + PW / 2;
    ellipse(ctx, cx, groundY + 1, 9, 3, pal[3]);
    ellipse(ctx, cx, groundY, 7, 2, pal[2]);
    for (const [dx, dy] of [
      [-13, 0],
      [13, -1],
      [11, 4],
      [-10, 4],
    ]) {
      fill(cx + dx, groundY + dy, 1, 1, pal[3]);
    }

    // --- Post. Six columns: dark rim, lit edge, three of face, dark shade.
    // Bounding the highlight with a rim is what turns it from a white stripe
    // into a squared timber; the first pass put the highlight on the outside and
    // the post read as a stick of chalk.
    const postCols = [pal[3], pal[0], pal[2], pal[2], pal[2], pal[3]];
    const postTop = boardBottom - 3;
    const postFoot = groundY + 2;
    for (let i = 0; i < PW; i++) {
      fill(PX + i, postTop, 1, postFoot - postTop + 1, postCols[i]);
    }

    // Where the timber enters the earth it loses its light entirely. Without
    // this the lit column ran all the way down and the post ended in a bright
    // point sitting on the mound instead of sinking into it.
    fill(PX, groundY - 1, PW, postFoot - groundY + 2, pal[3]);

    // Grain: short nicks down the lit face, so the timber has a length to it.
    const grain = rng(4801);
    for (let i = 0; i < 5; i++) {
      const y = postTop + 4 + Math.floor(grain() * (groundY - postTop - 7));
      fill(PX + 2 + Math.floor(grain() * 3), y, 1, 1 + Math.floor(grain() * 2), pal[3]);
    }

    // Board's own shadow falling across the top of the post.
    fill(PX, boardBottom + 1, PW, 2, pal[3]);

    // Blades standing in FRONT of the post and the turned earth. The one place
    // the grass index is used, and the thing that stops the post looking parked
    // on the lawn: two of them deliberately cross the post's own columns.
    const bladeAt: [number, number, number][] = [
      [-11, 4, 2],
      [-8, 3, 3],
      [-5, 4, 2],
      [-2, 4, 2],
      [2, 3, 3],
      [5, 4, 2],
      [8, 3, 1],
      [11, 3, 2],
    ];
    for (const [dx, h, drop] of bladeAt) {
      fill(cx + dx, groundY + drop - h + 1, 1, h, pal[1]);
    }

    // --- Board body: the faces that recede. Drawn before the front face so the
    // front simply covers whatever pokes through.
    for (let i = 1; i <= DEPTH; i++) {
      const rise = Math.round(i / 2);
      fill(BX0 + i, boardTop - rise, bw, 1, pal[2]);
      fill(BX1 + i, boardTop - rise, 1, BOARD_H, pal[3]);
    }
    // Far edge of the top face, in shade — this is the line that closes the slab.
    fill(BX0 + DEPTH, boardTop - 2, bw, 1, pal[3]);

    // --- Front face.
    fill(BX0, boardTop, bw, BOARD_H, pal[0]);

    // Grain: long thin streaks along the plank, rejected wherever they would
    // come within a pixel of the writing. Two dead ends got here — streaks
    // placed anywhere read as a second, blurrier column of text, and banning
    // whole rows left the face almost bare, because the writing owns most of
    // them. Keeping the margins beside each line is what puts grain everywhere
    // without ever touching the message.
    const ink = WRITING.flatMap((line) =>
      line.words.map(([wx, ww]) => ({
        y0: 2 + line.y,
        y1: 2 + line.y + line.h - 1,
        x0: 4 + wx,
        x1: 4 + wx + ww - 1,
      })),
    );
    const clear = (row: number, x0: number, x1: number) =>
      !ink.some((r) => row >= r.y0 - 1 && row <= r.y1 + 1 && x1 >= r.x0 - 1 && x0 <= r.x1 + 1);

    const face = rng(1607);
    for (let i = 0; i < 40; i++) {
      const row = 1 + Math.floor(face() * (BOARD_H - 2));
      const len = 4 + Math.floor(face() * 10);
      const x = 1 + Math.floor(face() * (bw - 2 - len));
      if (!clear(row, x, x + len - 1)) continue;
      fill(BX0 + x, boardTop + row, len, 1, pal[2]);
    }

    // Two planks with a shadowed join, and a shade line where the lower plank
    // meets the frame.
    const join = boardTop + 10;
    fill(BX0 + 1, join, bw - 2, 1, pal[3]);
    fill(BX0 + 1, join + 1, bw - 2, 1, pal[2]);
    fill(BX0 + 1, boardBottom - 1, bw - 2, 1, pal[2]);

    // Frame.
    fill(BX0, boardTop, 1, BOARD_H, pal[3]);
    fill(BX1, boardTop, 1, BOARD_H, pal[3]);
    fill(BX0, boardBottom, bw, 1, pal[3]);

    // Nails, one at each plank end.
    for (const nx of [BX0 + 2, BX1 - 2]) {
      for (const ny of [boardTop + 2, boardBottom - 3]) {
        fill(nx, ny, 1, 1, pal[3]);
        fill(nx, ny + 1, 1, 1, pal[2]);
      }
    }

    // Writing.
    for (const line of WRITING) {
      for (const [wx, ww] of line.words) {
        fill(BX0 + 4 + wx, boardTop + 2 + line.y, ww, line.h, pal[3]);
      }
    }

    return el;
  },
};

export const SIGN_HEIGHT = HEIGHT;
