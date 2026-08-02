/**
 * Core resolution + timing constants.
 *
 * The game keeps Game Boy sized *pixels* but not a Game Boy sized *screen*: one
 * game pixel is blown up by a fixed whole-number factor (PIXEL_SCALE), and the
 * framebuffer is then made as many game pixels wide and tall as the window can
 * hold. So a bigger window shows more world at the same magnification rather
 * than zooming in, stretching, or letterboxing a 160x144 image.
 *
 * These are `let` on purpose: `computeViewport()` reruns on resize and ES module
 * live bindings mean every importer sees the new numbers. Anything that lays out
 * against them must therefore read them at draw/create time, not at module load.
 */
export const TILE = 16;

/** Reference height — a 16-bit console screen, i.e. how big sprites feel. */
const BASE_H = 224;

/**
 * How many CSS pixels one game pixel occupies by default. Constant on purpose:
 * growing the window must reveal more of the world, not magnify what is already
 * on screen. The only exception is a window too short to hold the base screen at
 * this factor, where we scale *down* so nothing gets cropped away.
 */
const DEFAULT_PIXEL_SCALE = 2;
const MIN_PIXEL_SCALE = 1;
const MAX_PIXEL_SCALE = 8;

const ZOOM_KEY = 'sprite:zoom';

/**
 * An explicit zoom chosen with cmd/ctrl +/-, or null to auto-fit. Once the
 * player picks a zoom it sticks across resizes and reloads — an auto-fit that
 * quietly overrode it would feel like the game fighting the keyboard.
 */
let userPixelScale: number | null = loadZoom();

function loadZoom(): number | null {
  const stored = Number(localStorage.getItem(ZOOM_KEY));
  return Number.isInteger(stored) && stored >= MIN_PIXEL_SCALE && stored <= MAX_PIXEL_SCALE
    ? stored
    : null;
}

export let PIXEL_SCALE = 1;
export let VIEW_W = 160;
export let VIEW_H = 144;

/** Tiles visible on screen. */
export let VIEW_TILES_X = VIEW_W / TILE;
export let VIEW_TILES_Y = VIEW_H / TILE;

/**
 * Size the framebuffer to the window. The zoom does not follow the window, so a
 * larger window simply buys more game pixels; auto-fit only ever scales *down*,
 * for a window too short to hold the base screen.
 */
export function computeViewport(w = window.innerWidth, h = window.innerHeight) {
  const autoFit = Math.max(
    MIN_PIXEL_SCALE,
    Math.min(DEFAULT_PIXEL_SCALE, Math.floor(h / BASE_H)),
  );
  // A stored zoom is re-clamped: a window that shrank since last time cannot
  // honour the zoom it was given on a bigger one.
  PIXEL_SCALE = userPixelScale === null ? autoFit : Math.min(userPixelScale, maxScaleFor(h));
  // Never go below the original screen: the HUD and battle layouts assume it.
  VIEW_W = Math.max(160, Math.ceil(w / PIXEL_SCALE));
  VIEW_H = Math.max(BASE_H, Math.ceil(h / PIXEL_SCALE));
  VIEW_TILES_X = VIEW_W / TILE;
  VIEW_TILES_Y = VIEW_H / TILE;
}

/**
 * The most magnification this window can take. Past it the framebuffer's BASE_H
 * floor is taller than the window, so the canvas would overflow and clip the
 * HUD off the top and bottom — zooming in simply stops there instead.
 */
function maxScaleFor(h: number) {
  return Math.max(MIN_PIXEL_SCALE, Math.min(MAX_PIXEL_SCALE, Math.floor(h / BASE_H)));
}

/**
 * Step the zoom one whole pixel in or out. Whole numbers only — a fractional
 * factor is what turns crisp pixel art into a shimmering mess. Returns false at
 * the ends of the range so the caller can skip a pointless viewport rebuild.
 */
export function zoomBy(step: number): boolean {
  const next = Math.max(
    MIN_PIXEL_SCALE,
    Math.min(maxScaleFor(window.innerHeight), PIXEL_SCALE + step),
  );
  if (next === PIXEL_SCALE) return false;
  userPixelScale = next;
  localStorage.setItem(ZOOM_KEY, String(next));
  return true;
}

/** Hand the zoom back to auto-fit (cmd/ctrl+0). */
export function resetZoom(): boolean {
  if (userPixelScale === null) return false;
  userPixelScale = null;
  localStorage.removeItem(ZOOM_KEY);
  return true;
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
