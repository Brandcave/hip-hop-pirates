import {
  ellipse,
  fillRect,
  grid,
  gridToArt,
  pset,
  type Art,
  type Grid,
} from './pixels';

/**
 * Placeholder 32x32 creature sprites, composed procedurally so the proof of
 * concept ships without binary assets. Real monster art would be authored in
 * Aseprite and loaded as a spritesheet — only `SPRITE_BUILDERS` changes.
 */

/** Apply a darker shade, but only over existing body pixels. */
function shade(g: Grid, cx: number, cy: number, rx: number, ry: number) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x] !== '1') continue;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = '2';
    }
  }
}

function eye(g: Grid, x: number, y: number) {
  fillRect(g, x, y, 3, 4, '3');
  pset(g, x + 2, y, '0');
  pset(g, x + 2, y + 1, '0');
}

function feet(g: Grid, y: number) {
  ellipse(g, 10, y, 4, 2.5, '2', '3');
  ellipse(g, 21, y, 4, 2.5, '2', '3');
}

/** Front sprites face the player; back sprites are the rear view, so no face. */
export type View = 'front' | 'back';

function sproutle(view: View): Art {
  const g = grid(32, 32);
  // Leaves
  ellipse(g, 11, 6, 5, 3, '1', '3');
  ellipse(g, 21, 6, 5, 3, '1', '3');
  fillRect(g, 15, 6, 2, 6, '3');
  // Body
  ellipse(g, 16, 20, 11, 9, '1', '3');
  shade(g, 22, 25, 9, 7);
  feet(g, 28);
  if (view === 'front') {
    eye(g, 10, 17);
    eye(g, 19, 17);
    fillRect(g, 14, 24, 4, 1, '3');
    pset(g, 13, 23, '3');
    pset(g, 18, 23, '3');
  } else {
    // A seam down the back reads as "turned away".
    fillRect(g, 15, 14, 1, 12, '2');
  }
  return gridToArt(g);
}

function emberat(view: View): Art {
  const g = grid(32, 32);
  // Tail flame
  ellipse(g, 27, 12, 3.5, 6, '1', '3');
  ellipse(g, 27, 13, 1.8, 3.5, '0');
  // Ears
  ellipse(g, 8, 8, 3, 5, '1', '3');
  ellipse(g, 20, 8, 3, 5, '1', '3');
  // Body
  ellipse(g, 14, 20, 10, 9, '1', '3');
  shade(g, 19, 25, 8, 7);
  ellipse(g, 9, 29, 4, 2.5, '2', '3');
  ellipse(g, 19, 29, 4, 2.5, '2', '3');
  if (view === 'front') {
    eye(g, 8, 16);
    eye(g, 16, 16);
    ellipse(g, 12.5, 23, 4, 2.5, '0', '3');
    pset(g, 12, 22, '3');
    pset(g, 13, 22, '3');
  } else {
    fillRect(g, 13, 14, 1, 12, '2');
  }
  return gridToArt(g);
}

function pebblin(view: View): Art {
  const g = grid(32, 32);
  // Chunky rock body
  ellipse(g, 16, 21, 12, 8, '2', '3');
  ellipse(g, 16, 14, 8, 6, '1', '3');
  shade(g, 23, 24, 8, 6);
  // Arms
  ellipse(g, 4, 20, 3, 4, '2', '3');
  ellipse(g, 28, 20, 3, 4, '2', '3');
  if (view === 'front') {
    eye(g, 11, 12);
    eye(g, 19, 12);
    fillRect(g, 13, 18, 6, 1, '3');
  }
  // Cracks
  for (let i = 0; i < 5; i++) pset(g, 12 + i, 25 + (i % 2), '3');
  for (let i = 0; i < 4; i++) pset(g, 21 - i, 22 + i, '3');
  return gridToArt(g);
}

export const SPRITE_BUILDERS: Record<string, (view: View) => Art> = {
  sproutle,
  emberat,
  pebblin,
};
