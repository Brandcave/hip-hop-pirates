import Phaser from 'phaser';
import type { Palette } from './palette';

/**
 * A pixel-art asset is just an array of equal-length strings.
 * '0'..'3' are palette indices, '.' is transparent.
 *
 * Authoring art in source keeps the proof of concept dependency-free and makes
 * palette swapping trivial (textures are regenerated, not recoloured). When you
 * move to real artwork, swap `buildAssets()` over to `this.load.spritesheet()`
 * and nothing else in the game has to change.
 */
export type Art = string[];

/** Parse a template literal into an Art, trimming indentation. */
export function art(src: string): Art {
  return src
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Mirror a left-half Art horizontally to produce a symmetric sprite. */
export function mirror(half: Art): Art {
  return half.map((row) => row + [...row].reverse().join(''));
}

function assertRectangular(key: string, a: Art) {
  const w = a[0]?.length ?? 0;
  if (!w) throw new Error(`Art "${key}" is empty`);
  a.forEach((row, i) => {
    if (row.length !== w) {
      throw new Error(`Art "${key}" row ${i} is ${row.length} wide, expected ${w}`);
    }
  });
}

/** Render Art onto a 2D context at 1px per cell. */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  a: Art,
  pal: Palette,
  ox = 0,
  oy = 0,
) {
  for (let y = 0; y < a.length; y++) {
    const row = a[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.' || c === ' ') continue;
      ctx.fillStyle = pal[Number(c) as 0 | 1 | 2 | 3];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

/** Rasterise Art to a detached canvas — handy for fast drawImage blitting. */
export function artToCanvas(a: Art, pal: Palette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = a[0].length;
  canvas.height = a.length;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawArt(ctx, a, pal);
  return canvas;
}

/** Register Art as a Phaser texture under `key`. */
export function makeTexture(
  scene: Phaser.Scene,
  key: string,
  a: Art,
  pal: Palette,
): void {
  assertRectangular(key, a);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, a[0].length, a.length);
  if (!tex) throw new Error(`Could not create texture "${key}"`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  drawArt(ctx, a, pal);
  tex.refresh();
}

// ---------------------------------------------------------------------------
// Procedural drawing helpers, used for the placeholder creature sprites.
// ---------------------------------------------------------------------------

export type Grid = string[][];

export function grid(w: number, h: number, fill = '.'): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function gridToArt(g: Grid): Art {
  return g.map((row) => row.join(''));
}

export function pset(g: Grid, x: number, y: number, ch: string) {
  if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return;
  g[y][x] = ch;
}

export function fillRect(
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  ch: string,
) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) pset(g, i, j, ch);
}

/** Filled ellipse with a 1px outline in `edge`. */
export function ellipse(
  g: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  edge?: string,
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) {
        const isEdge =
          edge !== undefined &&
          (((x + 1 - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 ||
            ((x - 1 - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 ||
            ((x - cx) / rx) ** 2 + ((y + 1 - cy) / ry) ** 2 > 1 ||
            ((x - cx) / rx) ** 2 + ((y - 1 - cy) / ry) ** 2 > 1);
        pset(g, x, y, isEdge ? edge! : fill);
      }
    }
  }
}

/** Flip art horizontally. */
export function flipArt(a: Art): Art {
  return a.map((row) => [...row].reverse().join(''));
}
