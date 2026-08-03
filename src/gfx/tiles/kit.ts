import type { Swatch } from '../palette';

/**
 * The drawing kit every terrain tile is painted with.
 *
 * A ground tile is one 2:1 diamond, ISO_W x ISO_H, drawn at (0,0) of its own
 * canvas. Tiles butt up against each other on all four edges, so anything drawn
 * here repeats across a whole field — the job of a terrain module is to fill the
 * diamond with something that survives that repetition.
 *
 * Three rules that keep a field looking like ground rather than like tiles:
 *
 * 1. Never outline the diamond, and never darken its rim. An edge treatment is
 *    the single fastest way to turn a meadow into a chessboard.
 * 2. Keep the base fill uniform between variants. Vary the detail on top, not
 *    the colour underneath, or the field bands into patches.
 * 3. Detail that runs off one edge should be rare and small. It will be sliced
 *    by the neighbour, and a sliced blade reads as a seam.
 */
export type { Swatch };

export const ISO_W = 64;
export const ISO_H = 32;
export const HALF_W = ISO_W / 2;
export const HALF_H = ISO_H / 2;

/** How many interchangeable versions of each terrain tile the map picks between. */
export const VARIANTS = 4;

/**
 * Horizontal extent of the diamond on row `r`: the row starts at `x` and runs
 * `w` pixels. Rows 0 and ISO_H-1 are the narrow tips, the middle rows the full
 * width.
 */
export function rowSpan(r: number) {
  const k = r < HALF_H ? r : ISO_H - 1 - r;
  const w = (k + 1) * (ISO_W / HALF_H);
  return { x: HALF_W - w / 2, w };
}

/** Is this pixel inside the diamond? Use it to clip any free-form drawing. */
export function insideDiamond(x: number, y: number) {
  if (y < 0 || y >= ISO_H) return false;
  const { x: from, w } = rowSpan(y);
  return x >= from && x < from + w;
}

export function makeCanvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { el, ctx };
}

/** Flat fill of the whole diamond, `top` pixels down the canvas. */
export function fillDiamond(ctx: CanvasRenderingContext2D, top: number, color: string) {
  ctx.fillStyle = color;
  for (let r = 0; r < ISO_H; r++) {
    const { x, w } = rowSpan(r);
    ctx.fillRect(x, top + r, w, 1);
  }
}

/** A horizontal run, clipped to the diamond. The workhorse for surface detail. */
export function span(
  ctx: CanvasRenderingContext2D,
  y: number,
  x: number,
  w: number,
  color: string,
  top = 0,
) {
  if (y < 0 || y >= ISO_H) return;
  const s = rowSpan(y);
  const from = Math.max(x, s.x);
  const to = Math.min(x + w, s.x + s.w);
  if (to > from) {
    ctx.fillStyle = color;
    ctx.fillRect(from, top + y, to - from, 1);
  }
}

/** Last row of the diamond covering column `x` — where an extruded face starts. */
export function bottomRow(x: number) {
  const d = x < HALF_W ? x : ISO_W - 1 - x;
  return HALF_H + Math.floor(d / (ISO_W / ISO_H));
}

/** The two extruded side faces below a diamond, for anything with height. */
export function drawSides(
  ctx: CanvasRenderingContext2D,
  top: number,
  height: number,
  left: string,
  right: string,
) {
  for (let x = 0; x < ISO_W; x++) {
    ctx.fillStyle = x < HALF_W ? left : right;
    ctx.fillRect(x, top + bottomRow(x) + 1, 1, height);
  }
}

/** Filled ellipse, hard-edged. The workhorse for canopies and blobs. */
export function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    if (w > 0) ctx.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

/** A single pixel, clipped to the diamond. */
export function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  top = 0,
) {
  if (!insideDiamond(x, y)) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, top + y, 1, 1);
}

/**
 * Deterministic RNG. Art must be identical every run — a tile that reshuffles
 * on reload can't be judged, and the map bake assumes a variant is stable.
 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
