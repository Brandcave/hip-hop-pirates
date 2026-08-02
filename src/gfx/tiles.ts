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
  '.': { key: 'tile_grass', swatch: 'grass', iso: { kind: 'ground' } },
  ',': {
    key: 'tile_tallgrass',
    swatch: 'tallGrass',
    iso: { kind: 'tallGrass', ground: 'tallGrass' },
    encounter: true,
  },
  // Tone 0 lifts trodden ground clear of the grass even in a single-ramp theme.
  '_': { key: 'tile_path', swatch: 'path', iso: { kind: 'ground', tone: 0, pattern: 'path' } },
  s: { key: 'tile_sand', swatch: 'sand', iso: { kind: 'ground', tone: 0, pattern: 'sand' } },
  '#': { key: 'tile_tree', swatch: 'tree', iso: { kind: 'tree', ground: 'grass' }, solid: true },
  '~': { key: 'tile_water', swatch: 'water', iso: { kind: 'water' }, solid: true },
  '*': { key: 'tile_flower', swatch: 'flower', iso: { kind: 'flower', ground: 'grass' } },
  S: { key: 'tile_sign', swatch: 'sign', iso: { kind: 'sign', ground: 'grass' }, solid: true },
  W: {
    key: 'tile_wall',
    swatch: 'wall',
    iso: { kind: 'block', height: 20, ground: 'grass' },
    solid: true,
  },
  R: {
    key: 'tile_roof',
    swatch: 'roof',
    iso: { kind: 'block', height: 28, ground: 'grass' },
    solid: true,
  },
  D: {
    key: 'tile_door',
    swatch: 'door',
    iso: { kind: 'block', height: 20, ground: 'grass' },
    solid: true,
  },
  L: {
    key: 'tile_ledge',
    swatch: 'ledge',
    iso: { kind: 'block', height: 5, ground: 'path' },
    ledge: true,
  },
};
