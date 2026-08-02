import { buildIsoGround, buildIsoProp, ISO_H, ISO_W, TERRAIN, variantAt, VARIANTS } from './gfx/iso';
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

section(
  'boundaries — road and tall grass against short grass',
  [mixed(colour, 1), mixed(colour, 2)],
);

section(
  'monochrome (DMG) — everything shares one four-colour ramp',
  (['.', '_', ',', '~'] as const).map((ch) => field(THEMES.dmg, ch, 1)),
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
