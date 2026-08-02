/**
 * Colour.
 *
 * Tile and creature art is authored as four indices per asset ('0' lightest ..
 * '3' darkest, the DMG convention), with the four colours chosen *per asset*
 * rather than globally: grass gets a green ramp, a roof a red one. Actors are
 * not in here at all — they are full-colour LPC sheets (see gfx/actorSheets.ts).
 *
 * A Theme is the full mapping. There was once a set of monochrome themes that
 * gave every asset the same four-colour ramp, Game Boy style; they went when the
 * actors became loaded 16-bit art, which a four-shade ramp cannot repaint.
 */

/** Four colours, lightest to darkest, indexed by the digits used in art. */
export type Swatch = readonly [string, string, string, string];

/** Historical name — UI code draws with a single swatch. */
export type Palette = Swatch;

/**
 * Named ramps. Tiles, actors and creatures each reference one by name; the
 * names are the vocabulary an artist works in, not a pixel-level detail.
 */
export type SwatchName =
  | 'grass'
  | 'tallGrass'
  | 'path'
  | 'sand'
  | 'water'
  | 'tree'
  | 'flower'
  | 'sign'
  | 'wall'
  | 'roof'
  | 'door'
  | 'ledge'
  | 'monNormal'
  | 'monGrass'
  | 'monFire'
  | 'monRock';

export interface Theme {
  id: string;
  /** Shown in the colour menu. */
  name: string;
  /** Beyond the edge of the map, and the pre-battle flash. */
  backdrop: string;
  /** Dialogue boxes, menus and text: [fill, tint, mid, ink]. */
  ui: Swatch;
  /** HP bar, which is the one place colour carries meaning. */
  hp: { high: string; mid: string; low: string };
  /** Battle scene: [sky, ground, ground shade, ink]. */
  battle: Swatch;
  swatches: Record<SwatchName, Swatch>;
}

/** Base greens shared by grass, tall grass, the tree backdrop and flower beds. */
const GRASS_LIGHT = '#7cc24a';
const GRASS_DARK = '#59a437';
const INK = '#20283d';

const COLOR: Theme = {
  id: 'color',
  name: 'COLOR',
  backdrop: '#101820',
  ui: ['#ffffff', '#cfd9e8', '#7d89a6', INK],
  hp: { high: '#4cbf58', mid: '#f2c14e', low: '#e0503c' },
  battle: ['#cfe8f7', '#93c85a', '#6aa03c', INK],
  swatches: {
    grass: ['#a8d97a', GRASS_LIGHT, GRASS_DARK, '#3f7d2c'],
    // Deliberately deeper than plain grass: this is the tile that says "wild
    // encounters live here", so it has to read as different at a glance.
    tallGrass: ['#8fce5a', '#4e9e34', '#276b1d', '#1b4d15'],
    path: ['#d9b892', '#c4a077', '#a9865f', '#7f6544'],
    sand: ['#f0dea8', '#dcc487', '#c2a96c', '#94804f'],
    water: ['#bfe9ff', '#7fc0f0', '#3d7fd1', '#1f4f96'],
    // 1 is the grass the canopy sits on; 0 is the trunk.
    tree: ['#8a5a2b', GRASS_LIGHT, '#3f8a2e', '#215c22'],
    // 0 petals, 2 pollen, 1 grass, 3 the grass speckle.
    flower: ['#f45b8a', GRASS_LIGHT, '#ffd93d', GRASS_DARK],
    sign: ['#f2e2c0', GRASS_LIGHT, '#c8933f', '#7a4a1e'],
    wall: ['#e3c8a0', '#f0e2c8', '#a9714a', '#7c4a2c'],
    roof: ['#e8756a', '#d1483f', '#d1483f', '#8f2f2c'],
    door: ['#a86b3c', '#c08a55', '#7c4a2c', '#4a2c1a'],
    ledge: ['#d9b892', GRASS_LIGHT, '#c4a077', '#8a6a45'],
    monNormal: ['#f4ecd8', '#cbbfa4', '#9a8d73', '#413a2c'],
    monGrass: ['#eaffd0', '#7ec850', '#4f9c37', '#1f4d24'],
    monFire: ['#ffe9a8', '#f0913c', '#c9552a', '#5a2117'],
    monRock: ['#e9e2d2', '#a9a297', '#7b7568', '#3a362f'],
  },
};

export const THEMES: Record<string, Theme> = {
  color: COLOR,
};

export type ThemeName = keyof typeof THEMES;

export const THEME_ORDER: ThemeName[] = ['color'];

const STORAGE_KEY = 'sprite.theme';

export function loadThemeName(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in THEMES) return stored as ThemeName;
  return 'color';
}

export function saveThemeName(name: ThemeName) {
  localStorage.setItem(STORAGE_KEY, name);
}

/** Ramp for a creature, chosen by its element type. */
export function monsterSwatch(theme: Theme, type: string): Swatch {
  const key = `mon${type.charAt(0).toUpperCase()}${type.slice(1)}` as SwatchName;
  return theme.swatches[key] ?? theme.swatches.monNormal;
}
