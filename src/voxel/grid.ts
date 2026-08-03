import type { MapDef } from '../data/maps';
import { variantAt, type PropName, type TerrainName } from '../gfx/iso';
import { TILES } from '../gfx/tiles';

/**
 * The map as columns of voxels.
 *
 * The game's world is still the same square character grid it always was — this
 * only decides how tall each cell stands and what its surfaces are made of.
 * Collision, encounters and ledges keep reading the character grid, so the 3D
 * world and the 2D one are the same world seen two ways, never two worlds that
 * can drift apart.
 */

/** One voxel is a quarter of a tile, so a wall is four blocks rather than one. */
export const VOXEL = 0.25;

export interface Column {
  terrain: TerrainName;
  prop?: PropName;
  /** Height of the solid column, in voxels. Ground is 0. */
  height: number;
  variant: number;
}

/**
 * How tall each prop stands as solid geometry. Trees and signs are NOT here:
 * they are too fine to voxelise well at this scale and are drawn as their own
 * objects, the way the mod does for anything that isn't terrain.
 */
const PROP_VOXELS: Partial<Record<PropName, number>> = {
  wall: 5,
  door: 5,
  roof: 7,
  ledge: 1,
};

export interface VoxelWorld {
  cols: number;
  rows: number;
  columns: Column[];
  at(x: number, y: number): Column | null;
}

export function buildVoxelWorld(map: MapDef): VoxelWorld {
  const cols = map.layout[0].length;
  const rows = map.layout.length;
  const columns: Column[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const def = TILES[map.layout[y][x]];
      const prop = def?.iso.prop;
      columns.push({
        terrain: def?.iso.terrain ?? 'grass',
        prop,
        height: prop ? PROP_VOXELS[prop] ?? 0 : 0,
        variant: variantAt(x, y),
      });
    }
  }

  return {
    cols,
    rows,
    columns,
    at(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return columns[y * cols + x];
    },
  };
}
