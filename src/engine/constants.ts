/**
 * Core resolution + timing constants.
 *
 * The game keeps Game Boy sized *pixels* but not a Game Boy sized *screen*: one
 * game pixel is blown up by a whole-number factor (PIXEL_SCALE) chosen from the
 * window height, and the framebuffer is then made as many game pixels wide and
 * tall as the window can hold. So a wide window shows more world rather than a
 * stretched or letterboxed 160x144 image.
 *
 * These are `let` on purpose: `computeViewport()` reruns on resize and ES module
 * live bindings mean every importer sees the new numbers. Anything that lays out
 * against them must therefore read them at draw/create time, not at module load.
 */
export const TILE = 16;

/** Reference height — the classic 144px screen, i.e. how big sprites feel. */
const BASE_H = 144;

export let PIXEL_SCALE = 1;
export let VIEW_W = 160;
export let VIEW_H = 144;

/** Tiles visible on screen. */
export let VIEW_TILES_X = VIEW_W / TILE;
export let VIEW_TILES_Y = VIEW_H / TILE;

/**
 * Size the framebuffer to the window. The scale factor floors so the canvas is
 * always at least as large as the window (any remainder is a sub-scale-factor
 * sliver cropped at the edges), which is what makes the fill exact.
 */
export function computeViewport(w = window.innerWidth, h = window.innerHeight) {
  PIXEL_SCALE = Math.max(1, Math.floor(h / BASE_H));
  // Never go below the original screen: the HUD and battle layouts assume it.
  VIEW_W = Math.max(160, Math.ceil(w / PIXEL_SCALE));
  VIEW_H = Math.max(BASE_H, Math.ceil(h / PIXEL_SCALE));
  VIEW_TILES_X = VIEW_W / TILE;
  VIEW_TILES_Y = VIEW_H / TILE;
}

computeViewport();

/** Milliseconds to walk one tile. Gen 1 is roughly 16 frames @60fps. */
export const WALK_MS = 190;
/** Milliseconds spent turning in place before a step begins. */
export const TURN_MS = 70;
/** Ledge hops cover 2 tiles. */
export const HOP_MS = 300;

export const TEXT_SPEED_MS = 28;

export type Dir = 'down' | 'up' | 'left' | 'right';

export const DIR_VECTORS: Record<Dir, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Keyboard bindings, in the "A button / B button" spirit of the original. */
export const KEYS = {
  A: ['KeyZ', 'Enter', 'Space'],
  B: ['KeyX', 'Backspace', 'ShiftLeft'],
  UP: ['ArrowUp', 'KeyW'],
  DOWN: ['ArrowDown', 'KeyS'],
  LEFT: ['ArrowLeft', 'KeyA'],
  RIGHT: ['ArrowRight', 'KeyD'],
  // Escape is reserved by the browser for leaving fullscreen.
  START: ['KeyM'],
};
