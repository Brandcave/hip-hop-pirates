import type { IsoSpec } from './iso';
import type { SwatchName } from './palette';

/**
 * The tile table. Art is generated from `iso` + `swatch` (see gfx/iso.ts), so a
 * tile is now a shape, a ramp and its rules — no pixels in this file.
 *
 * The game only ever reasons about `solid` / `encounter` / `ledge`; those flags
 * are identical to the top-down build, which is why the projection change left
 * movement, collision and encounters alone.
 */

export interface TileDef {
  key: string;
  /** Which named ramp this tile's colours come from. */
  swatch: SwatchName;
  /** Shape and height in the iso projection. */
  iso: IsoSpec;
  /** Blocks movement entirely. */
  solid?: boolean;
  /** Wild encounters can trigger when standing here. */
  encounter?: boolean;
  /** Can only be entered by hopping down from above. */
  ledge?: boolean;
}

/**
 * The map legend. Each character in a MapDef layout maps to one of these.
 * Adding a tile is a one-line change.
 */
export const TILES: Record<string, TileDef> = {
  '.': { key: 'tile_grass', swatch: 'grass', iso: { terrain: 'grass' } },
  ',': {
    key: 'tile_tallgrass',
    swatch: 'tallGrass',
    iso: { terrain: 'tallGrass', prop: 'tallGrass' },
    encounter: true,
  },
  // Tone 0 lifts trodden ground clear of the grass even in a single-ramp theme.
  '_': { key: 'tile_path', swatch: 'path', iso: { terrain: 'road' } },
  s: { key: 'tile_sand', swatch: 'sand', iso: { terrain: 'sand' } },
  '#': { key: 'tile_tree', swatch: 'tree', iso: { terrain: 'grass', prop: 'tree' }, solid: true },
  '~': {
    key: 'tile_water',
    swatch: 'water',
    iso: { terrain: 'water', prop: 'water' },
    solid: true,
  },
  '*': { key: 'tile_flower', swatch: 'flower', iso: { terrain: 'grass', prop: 'flower' } },
  S: { key: 'tile_sign', swatch: 'sign', iso: { terrain: 'grass', prop: 'sign' }, solid: true },
  W: {
    key: 'tile_wall',
    swatch: 'wall',
    iso: { terrain: 'grass', prop: 'wall' },
    solid: true,
  },
  R: {
    key: 'tile_roof',
    swatch: 'roof',
    iso: { terrain: 'grass', prop: 'roof' },
    solid: true,
  },
  D: {
    key: 'tile_door',
    swatch: 'door',
    iso: { terrain: 'grass', prop: 'door' },
    solid: true,
  },
  L: {
    key: 'tile_ledge',
    swatch: 'ledge',
    iso: { terrain: 'road', prop: 'ledge' },
    ledge: true,
  },
};
