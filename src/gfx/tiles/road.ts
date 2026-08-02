import {
  dot,
  fillDiamond,
  HALF_H,
  HALF_W,
  ISO_H,
  ISO_W,
  rng,
  rowSpan,
  span,
  type Swatch,
} from './kit';

/**
 * The road: trodden earth. It has to read as a deliberate route through the
 * grass at a glance, including on the single-ramp monochrome themes where the
 * only thing separating it from the meadow is tone.
 *
 * The surface is painted in *lattice space* rather than tile space. Because the
 * diamonds tessellate, a tile's neighbours sit exactly (+-HALF_W, +-HALF_H)
 * away, so the two grid axes
 *
 *   u = (dx/HALF_W + dy/HALF_H) / 2      v = (dx/HALF_W - dy/HALF_H) / 2
 *
 * change by exactly 1 from one tile to the next. Anything drawn as a function of
 * frac(u), frac(v) is therefore continuous across every tile edge in the field:
 * a rut leaves one diamond and arrives in the next without a step. That buys a
 * seamless packed-earth bed, at the cost of the bed being the same in all four
 * variants — which is what rule 2 wants anyway. The variants differ in the
 * scuffs and stones scattered on top, and those are what break up the repeat.
 */

const frac = (n: number) => n - Math.floor(n);

/** Hash of a lattice cell, 0..1. */
function cellValue(i: number, j: number, seed: number) {
  let h = Math.imul(i + 0x9e3779b1, 374761393) ^ Math.imul(j + 0x85ebca6b, 668265263);
  h = Math.imul(h ^ seed, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise on an `nu` x `nv` lattice, periodic in u and v with period 1 — the
 * periodicity is the whole point, see the note above.
 */
function noise(u: number, v: number, nu: number, nv: number, seed: number) {
  const x = u * nu;
  const y = v * nv;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const i0 = ((x0 % nu) + nu) % nu;
  const i1 = (i0 + 1) % nu;
  const j0 = ((y0 % nv) + nv) % nv;
  const j1 = (j0 + 1) % nv;
  const a = cellValue(i0, j0, seed);
  const b = cellValue(i1, j0, seed);
  const c = cellValue(i0, j1, seed);
  const d = cellValue(i1, j1, seed);
  const hi = a + (b - a) * fx;
  const lo = c + (d - c) * fx;
  return hi + (lo - hi) * fy;
}

/**
 * Tone of the packed surface, high for the pale crust and low for trodden
 * earth.
 *
 * Every octave here is deliberately fine — one to three pixels. The bed repeats
 * once per diamond, which is unavoidable if it is to be seamless, and anything
 * coarse enough to be recognised as a shape is therefore recognised again six
 * times across the screen: wallpaper. Grain this fine reads as a material
 * instead. The lattice is stretched along u so the speckle lies along a grid
 * axis rather than pointing everywhere at once.
 */
function bedTone(u: number, v: number) {
  const grain =
    noise(u, v, 12, 28, 17) * 0.3 +
    noise(u, v, 20, 20, 233) * 0.3 +
    noise(u, v, 34, 34, 71) * 0.4;

  // One broad, softly wandering band of heavier wear running along a grid axis.
  // It shifts the *density* of the grain rather than drawing an edge of its own,
  // so it never hardens into a stripe; what it does is make the middle of the
  // track darker and grittier than the shoulders, which is most of what tells
  // the eye this is a route and not a rectangle of pale ground.
  const wander = (noise(u, 0.5, 3, 1, 401) - 0.5) * 0.16;
  const width = 0.15 + noise(u, 0.5, 4, 1, 79) * 0.14;
  const strength = 0.35 + noise(u, 0.5, 5, 1, 911) * 0.75;
  const d = Math.abs(frac(v - 0.32 - wander + 0.5) - 0.5);
  const worn = d >= width ? 0 : smooth(1 - d / width) * strength;

  return 0.37 + grain * 0.62 - worn * 0.26;
}

/** Which of the four ramp entries a bed tone lands on. */
function bedIndex(t: number) {
  if (t < 0.28) return 2;
  if (t < 0.55) return 1;
  return 0;
}

export function drawRoad(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[0]);

  // The bed. Identical in every variant, and continuous across every tile edge.
  const row = new Uint8Array(ISO_W);
  for (let y = 0; y < ISO_H; y++) {
    const s = rowSpan(y);
    const from = Math.floor(s.x);
    const to = Math.ceil(s.x + s.w);
    const dy = y + 0.5 - HALF_H;
    for (let x = from; x < to; x++) {
      const dx = x + 0.5 - HALF_W;
      const a = dx / HALF_W;
      const b = dy / HALF_H;
      row[x] = bedIndex(bedTone(frac((a + b) * 0.5), frac((a - b) * 0.5)));
    }
    let runStart = from;
    for (let x = from + 1; x <= to; x++) {
      if (x < to && row[x] === row[runStart]) continue;
      if (row[runStart] !== 0) {
        span(ctx, y, runStart, x - runStart, pal[row[runStart]], top);
      }
      runStart = x;
    }
  }

  scatter(ctx, pal, variant, top);
}

/**
 * The per-variant layer, and where all the coarse structure lives.
 *
 * Ruts were tried in the seamless bed first: they join perfectly across tiles,
 * and they look like wood grain, because a groove that repeats every diamond is
 * a stripe on a 32-pixel pitch forever. Broken into wandering segments a few
 * pixels long and dealt out differently per variant they read as wear instead,
 * and being short they lose nothing to a tile edge.
 */
function scatter(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top: number,
) {
  const random = rng(2000 + variant);
  const place = () => {
    const y = Math.floor(random() * ISO_H);
    const s = rowSpan(y);
    return { x: Math.floor(s.x + random() * s.w), y };
  };

  // Ruts: chains of short runs stepping along a grid axis (two across, one
  // down), broken by gaps, with the odd darker pixel scored into the bottom.
  for (let i = 0; i < 4; i++) {
    const { x, y } = place();
    const dir = random() < 0.72 ? 1 : -1;
    const len = 5 + Math.floor(random() * 5);
    let drift = 0;
    for (let k = 0; k < len; k++) {
      if (random() < 0.22) continue;
      if (random() < 0.3) drift += random() < 0.5 ? 1 : -1;
      const rx = x + dir * k * 2 + drift;
      const ry = y + k;
      span(ctx, ry, rx, 2 + Math.floor(random() * 2), pal[1], top);
      if (random() < 0.4) dot(ctx, rx + 1, ry, pal[2], top);
    }
  }

  // Scuff marks: short strokes, lying along either grid axis.
  for (let i = 0; i < 9; i++) {
    const { x, y } = place();
    const dir = random() < 0.5 ? 1 : -1;
    const len = 1 + Math.floor(random() * 3);
    const shade = random() < 0.55 ? pal[1] : pal[2];
    for (let k = 0; k < len; k++) {
      span(ctx, y + k, x + dir * k * 2, 2, shade, top);
    }
  }

  // Grit trodden into the surface.
  for (let i = 0; i < 18; i++) {
    const { x, y } = place();
    dot(ctx, x, y, random() < 0.4 ? pal[1] : pal[2], top);
  }

  // Small stones: a lit crown with its own shadow tucked under it. The only
  // place the darkest shade is used, which is what makes them read as objects
  // sitting on the surface rather than as holes in it.
  for (let i = 0; i < 6; i++) {
    const { x, y } = place();
    span(ctx, y, x, 1 + Math.floor(random() * 2), pal[0], top);
    dot(ctx, x + 1, y + 1, pal[3], top);
  }

  // Bare spots polished back to the pale crust by feet.
  for (let i = 0; i < 12; i++) {
    const { x, y } = place();
    span(ctx, y, x, 1 + Math.floor(random() * 3), pal[0], top);
  }
}
