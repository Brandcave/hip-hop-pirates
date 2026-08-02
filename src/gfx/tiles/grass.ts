import { dot, fillDiamond, insideDiamond, ISO_H, ISO_W, rng, type Swatch } from './kit';

/**
 * Short grass — the default ground, and by far the most repeated tile on the
 * map, so it has to hold up in bulk more than it has to look good alone.
 *
 * Three things decide whether a field of this reads as a meadow or as tiling:
 *
 * 1. *Even coverage.* Marks sit on jittered lattices, one per cell, rather than
 *    at free random. Free random clumps in some corners and leaves holes in
 *    others, and once the tile repeats those holes are exactly what the eye
 *    latches onto as "that stamp again".
 * 2. *Equal ink in every variant.* Every variant lays down the same number of
 *    pixels of each tone — the counts are structural, not probabilistic. A
 *    variant that is even slightly darker than its neighbours turns the field
 *    into visible patches, which is the same failure as varying the base fill.
 * 3. *No landmarks.* The map picks between only four variants on a strictly
 *    periodic lattice, so anything memorable in one tile reappears on a regular
 *    grid. The defence is that no single mark is memorable: the texture is
 *    carried by pal[2], which is the smallest step from the base, and the two
 *    extreme tones are used only as the tip and foot of a blade, touching the
 *    pal[2] body, never as loose bright or dark pixels.
 *
 * Anchors are tested against the diamond so detail runs right up to the rim. A
 * margin of clean fill around the edge would draw the tile boundaries as
 * clearly as an outline would. Marks are one or two pixels, so the rim takes at
 * most a pixel off one and never leaves a sliced blade behind.
 */

/** Scatter lattice — 2:1 cells, so blade spacing follows the ground plane. */
const SCATTER_W = 8;
const SCATTER_H = 4;
const SCATTER_COLS = ISO_W / SCATTER_W; // 8
const SCATTER_ROWS = ISO_H / SCATTER_H; // 8

/** Clump lattice, at twice the spacing. */
const CLUMP_W = 16;
const CLUMP_H = 8;
const CLUMP_COLS = ISO_W / CLUMP_W; // 4
const CLUMP_ROWS = ISO_H / CLUMP_H; // 4

export function drawGrass(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  // Identical in every variant. Vary the detail, never the colour underneath.
  fillDiamond(ctx, top, pal[1]);

  const random = rng(0x9e37 + variant * 5717);

  // --- the even scatter ------------------------------------------------------
  // One blade per cell, always. What varies between variants is where it sits
  // and which way it leans, never how many there are.
  for (let cy = 0; cy < SCATTER_ROWS; cy++) {
    for (let cx = 0; cx < SCATTER_COLS; cx++) {
      const x = cx * SCATTER_W + Math.floor(random() * SCATTER_W);
      const y = cy * SCATTER_H + Math.floor(random() * SCATTER_H);
      const lean = random();
      if (!insideDiamond(x, y)) continue;
      dot(ctx, x, y, pal[2], top);
      // Most stay a single pixel. A second pixel now and then gives the mark a
      // direction — a blade rather than a speck — without doubling the ink.
      if (lean < 0.18) dot(ctx, x, y + 1, pal[2], top);
      else if (lean < 0.30) dot(ctx, x + 1, y + 1, pal[2], top);
      else if (lean < 0.42) dot(ctx, x - 1, y + 1, pal[2], top);
    }
  }

  // --- clumps ----------------------------------------------------------------
  // Where the grass grows a little thicker. These are what give the eye
  // something bigger than a pixel to read, so the surface stops being static.
  let cell = 0;
  for (let cy = 0; cy < CLUMP_ROWS; cy++) {
    for (let cx = 0; cx < CLUMP_COLS; cx++, cell++) {
      const x = cx * CLUMP_W + 2 + Math.floor(random() * (CLUMP_W - 4));
      const y = cy * CLUMP_H + 1 + Math.floor(random() * (CLUMP_H - 2));
      const sx = x + (random() < 0.5 ? -2 : 2);
      const sy = y + Math.floor(random() * 2);
      if (!insideDiamond(x, y)) continue;

      // A companion blade a couple of pixels off, so the clump has width.
      dot(ctx, sx, sy, pal[2], top);
      if (random() < 0.5) dot(ctx, sx, sy + 1, pal[2], top);

      // The standing blade, drawn whole: foot, body, lit tip. The tones have to
      // touch to read as one blade — a loose pal[0] pixel is a sparkle and a
      // loose pal[3] pixel is a speck of dirt, and a field of either shimmers.
      dot(ctx, x, y, pal[2], top);
      dot(ctx, x, y + 1, pal[2], top);
      // Exactly a quarter of the clumps get shade at the foot and half get a
      // lit tip — chosen by cell so the count is the same in every variant.
      if ((cell + variant) % 4 === 1) dot(ctx, x, y + 2, pal[3], top);
      if ((cell + variant) % 2 === 0) dot(ctx, x, y - 1, pal[0], top);
    }
  }
}
