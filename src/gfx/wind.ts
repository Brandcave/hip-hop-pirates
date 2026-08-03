import { ISO_H, ISO_W } from './tiles/kit';

/**
 * Wind.
 *
 * One wind blows over the whole map, and it has an opinion of its own: it comes
 * from the west, the same quarter the evening sun sets in, and it moves in
 * gusts rather than at a constant speed.
 *
 * The important decision is that a gust TRAVELS. Every animated thing shares one
 * cycle, but its phase is offset by how far along the wind direction it stands,
 * so a gust visibly crosses a meadow instead of every blade bending in unison.
 * Unison is the tell that betrays cheap foliage animation, and it costs nothing
 * to avoid: the offset is a lookup, not a simulation.
 */

/** Direction the wind blows towards, in compass terms (east, north). */
const TOWARDS_EAST = 1;
const TOWARDS_NORTH = 0.35;

/** How many tiles apart two blades are before they bend a full cycle apart. */
const WAVELENGTH_TILES = 7;

/**
 * Phase offset, 0..1, for a tile at (tx, ty). Same value every run, so a rebake
 * or a scene restart never reshuffles the field mid-gust.
 */
export function windPhase(tx: number, ty: number) {
  // Grid to compass: east runs along screen x, north towards the viewer.
  const east = (tx - ty) / 2;
  const north = (tx + ty) / 2;
  const along = (east * TOWARDS_EAST + north * TOWARDS_NORTH) / WAVELENGTH_TILES;
  return ((along % 1) + 1) % 1;
}

/** Screen-space direction of the wind, for anything that leans rather than cycles. */
export function windScreenDir() {
  return { x: TOWARDS_EAST, y: (TOWARDS_NORTH * ISO_H) / ISO_W };
}
