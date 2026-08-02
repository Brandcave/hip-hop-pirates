import type { Palette } from './palette';

/**
 * A hand-authored 5x7 bitmap font. Each glyph is 7 rows of 5 cells separated by
 * '/', where '#' is ink and '.' is transparent.
 *
 * Rendering text as bitmaps (rather than canvas fillText) is what keeps the
 * typography crisp at 160x144 and lets it scale up as hard pixels.
 */
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Advance per character, including the 1px gap. */
export const GLYPH_ADV = 6;
export const LINE_H = 11;

const GLYPHS: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../.##../.#...',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  "'": '..#../..#../...../...../...../...../.....',
  '-': '...../...../...../.###./...../...../.....',
  ':': '...../..#../..#../...../..#../..#../.....',
  '/': '....#/...#./...#./..#../.#.../.#.../#....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '%': '#...#/#..#./...#./..#../.#.../#..#./#...#',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '*': '...../.#.#./..#../#####/..#../.#.#./.....',
  '=': '...../...../#####/...../#####/...../.....',
  ' ': '...../...../...../...../...../...../.....',
};

const cache = new Map<string, boolean[][]>();

function glyph(ch: string): boolean[][] | null {
  const key = ch.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const src = GLYPHS[key];
  if (!src) return null;
  const bits = src.split('/').map((row) => [...row].map((c) => c === '#'));
  cache.set(key, bits);
  return bits;
}

export function measure(text: string): number {
  return text.length * GLYPH_ADV;
}

/** Draw a single line of text. Returns the width drawn. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  pal: Palette,
  shade: 0 | 1 | 2 | 3 = 3,
): number {
  ctx.fillStyle = pal[shade];
  let cx = x;
  for (const ch of text) {
    const bits = glyph(ch);
    if (bits) {
      for (let gy = 0; gy < GLYPH_H; gy++) {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (bits[gy][gx]) ctx.fillRect(cx + gx, y + gy, 1, 1);
        }
      }
    }
    cx += GLYPH_ADV;
  }
  return cx - x;
}

/** Greedy word wrap to a pixel width. */
export function wrapText(text: string, maxWidth: number): string[] {
  const maxChars = Math.floor(maxWidth / GLYPH_ADV);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Split wrapped lines into pages of `perPage` lines. */
export function paginate(text: string, maxWidth: number, perPage = 2): string[][] {
  const lines = wrapText(text, maxWidth);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }
  return pages;
}
