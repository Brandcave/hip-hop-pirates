import {
  buildIsoGround,
  buildIsoProp,
  ISO_H,
  ISO_W,
  PROPS,
  TERRAIN,
  variantAt,
  VARIANTS,
} from './gfx/iso';
import { windPhase } from './gfx/wind';
import { THEMES, type Theme } from './gfx/palette';
import { TILES } from './gfx/tiles';

/**
 * A workbench for the terrain art. Not part of the game — it renders each
 * terrain as a field of tiles, laid out exactly the way the map bake does, so a
 * tile can be judged in the only context that matters: repeated, next to
 * itself, at play size.
 */

const COLS = 6;
const ROWS = 6;

function field(theme: Theme, tileChar: string, zoom: number) {
  const def = TILES[tileChar];
  const terrain = TERRAIN[def.iso.terrain];
  const pal = theme.swatches[terrain.swatch as keyof typeof theme.swatches];

  const w = ((COLS + ROWS) * ISO_W) / 2;
  const h = ((COLS + ROWS) * ISO_H) / 2 + 40;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const grounds = Array.from({ length: VARIANTS }, (_, v) =>
    buildIsoGround(def.iso.terrain, pal, v),
  );
  const props = Array.from({ length: VARIANTS }, (_, v) =>
    buildIsoProp(def.iso, theme.swatches[def.swatch], v),
  );

  const ox = (ROWS * ISO_W) / 2;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cx = (x - y) * (ISO_W / 2) + ox;
      const cy = (x + y) * (ISO_H / 2) + 20;
      ctx.drawImage(grounds[variantAt(x, y)], cx - ISO_W / 2, cy - ISO_H / 2);
    }
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const prop = props[variantAt(x, y)] ?? props[0];
      if (!prop) continue;
      const cx = (x - y) * (ISO_W / 2) + ox;
      const cy = (x + y) * (ISO_H / 2) + 20;
      ctx.drawImage(prop, cx - ISO_W / 2, cy + ISO_H / 2 - prop.height);
    }
  }
  return canvas;
}

const out = document.getElementById('out')!;

/**
 * A live field: same layout as the static one, but it advances animation frames
 * on a clock, with each tile's phase offset by the wind. Motion cannot be judged
 * from a still — what matters is whether a gust reads as travelling across the
 * field or as everything twitching in unison.
 */
function animatedField(theme: Theme, tileChar: string, zoom: number) {
  const def = TILES[tileChar];
  const module = def.iso.prop ? PROPS[def.iso.prop] : null;
  const terrain = TERRAIN[def.iso.terrain];
  const pal = theme.swatches[terrain.swatch as keyof typeof theme.swatches];
  const propPal = theme.swatches[def.swatch as keyof typeof theme.swatches];

  const w = ((COLS + ROWS) * ISO_W) / 2;
  const h = ((COLS + ROWS) * ISO_H) / 2 + 60;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const frames = module?.frames ?? 1;
  const grounds = Array.from({ length: VARIANTS }, (_, v) =>
    buildIsoGround(def.iso.terrain, pal, v),
  );
  const props: (HTMLCanvasElement | null)[][] = Array.from({ length: VARIANTS }, (_, v) =>
    Array.from({ length: frames }, (_, f) =>
      buildIsoProp(def.iso, propPal, v % (module?.variants ?? 1), f),
    ),
  );

  const ox = (ROWS * ISO_W) / 2;
  const start = performance.now();
  const tick = () => {
    const elapsed = ((performance.now() - start) / 1000) * (module?.frameRate ?? 8);
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cx = (x - y) * (ISO_W / 2) + ox;
        const cy = (x + y) * (ISO_H / 2) + 30;
        ctx.drawImage(grounds[variantAt(x, y)], cx - ISO_W / 2, cy - ISO_H / 2);
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = variantAt(x, y) % (module?.variants ?? 1);
        const f = Math.floor(elapsed + windPhase(x, y) * frames) % frames;
        const prop = props[v]?.[f] ?? props[v]?.[0];
        if (!prop) continue;
        const cx = (x - y) * (ISO_W / 2) + ox;
        const cy = (x + y) * (ISO_H / 2) + 30;
        ctx.drawImage(prop, cx - ISO_W / 2, cy + ISO_H / 2 - prop.height);
      }
    }
    requestAnimationFrame(tick);
  };
  tick();
  return canvas;
}

/** Every frame of one variant, side by side — how you actually fix a cycle. */
function frameStrip(theme: Theme, tileChar: string, variant: number, zoom: number) {
  const def = TILES[tileChar];
  const module = def.iso.prop ? PROPS[def.iso.prop] : null;
  const frames = module?.frames ?? 1;
  const propPal = theme.swatches[def.swatch as keyof typeof theme.swatches];
  const terrain = TERRAIN[def.iso.terrain];
  const pal = theme.swatches[terrain.swatch as keyof typeof theme.swatches];

  const sample = buildIsoProp(def.iso, propPal, variant, 0);
  const ph = sample?.height ?? ISO_H;
  const canvas = document.createElement('canvas');
  canvas.width = ISO_W * frames;
  canvas.height = ph;
  canvas.style.width = `${ISO_W * frames * zoom}px`;
  canvas.style.height = `${ph * zoom}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const ground = buildIsoGround(def.iso.terrain, pal, variant);
  for (let f = 0; f < frames; f++) {
    ctx.drawImage(ground, f * ISO_W, ph - ISO_H);
    const prop = buildIsoProp(def.iso, propPal, variant, f);
    if (prop) ctx.drawImage(prop, f * ISO_W, ph - prop.height);
  }
  return canvas;
}

function section(title: string, nodes: HTMLElement[]) {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  nodes.forEach((n) => row.appendChild(n));
  out.append(h, row);
}

const colour = THEMES.color;
for (const [name, ch] of [
  ['short grass', '.'],
  ['road', '_'],
  ['tall grass', ','],
  ['water', '~'],
] as const) {
  section(`${name} — play size, then 2x`, [field(colour, ch, 1), field(colour, ch, 2)]);
}

for (const [name, ch] of [
  ['tall grass', ','],
  ['water', '~'],
] as const) {
  const def = TILES[ch];
  const frames = def.iso.prop ? PROPS[def.iso.prop].frames : 1;
  section(`${name} — LIVE, play size then 2x (${frames} frame${frames === 1 ? '' : 's'})`, [
    animatedField(colour, ch, 1),
    animatedField(colour, ch, 2),
  ]);
  section(`${name} — every frame of variant 0, then variant 1`, [
    frameStrip(colour, ch, 0, 2),
    frameStrip(colour, ch, 1, 2),
  ]);
}

section(
  'boundaries — road and tall grass against short grass',
  [mixed(colour, 1), mixed(colour, 2)],
);

/** Terrains meeting each other, which is where tiling problems show up. */
function mixed(theme: Theme, zoom: number) {
  const layout = [
    '..,,,.',
    '..,,,.',
    '___...',
    '..__~~',
    '....~~',
    '..,,~~',
  ];
  const w = ((COLS + ROWS) * ISO_W) / 2;
  const h = ((COLS + ROWS) * ISO_H) / 2 + 40;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const ox = (ROWS * ISO_W) / 2;

  const draw = (pass: 'ground' | 'prop') => {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const def = TILES[layout[y][x]];
        const terrain = TERRAIN[def.iso.terrain];
        const pal = theme.swatches[terrain.swatch as keyof typeof theme.swatches];
        const cx = (x - y) * (ISO_W / 2) + ox;
        const cy = (x + y) * (ISO_H / 2) + 20;
        if (pass === 'ground') {
          ctx.drawImage(
            buildIsoGround(def.iso.terrain, pal, variantAt(x, y)),
            cx - ISO_W / 2,
            cy - ISO_H / 2,
          );
        } else {
          const prop =
            buildIsoProp(def.iso, theme.swatches[def.swatch], variantAt(x, y)) ??
            buildIsoProp(def.iso, theme.swatches[def.swatch], 0);
          if (prop) ctx.drawImage(prop, cx - ISO_W / 2, cy + ISO_H / 2 - prop.height);
        }
      }
    }
  };
  draw('ground');
  draw('prop');
  return canvas;
}
