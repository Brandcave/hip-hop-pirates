import Phaser from 'phaser';
import type { Dir } from '../engine/constants';

/**
 * Actor art is no longer generated — it is LPC spritesheets built by
 * `tools/build-actors.py` and shipped in `public/art/`. See ART-CREDITS.md for
 * the licence, which is share-alike and therefore not optional.
 *
 * Each sheet is one walk animation: nine frames across, four rows down, in
 * LPC's fixed row order. Frame 0 of a row is the standing pose and frames 1..8
 * are the cycle, so idle and walking come out of the same row.
 *
 * Mapping a grid direction to a row is the whole isometric problem in one
 * table. Every grid step is a screen *diagonal*, and because the tile is 2:1
 * the horizontal half of that step is twice the vertical half:
 *
 *   grid up    -> up and right     grid right -> down and right
 *   grid left  -> up and left      grid down  -> down and left
 *
 * So what a step reads as is its left/right component. Matching Dir to LPC's
 * rows one-for-one is the obvious mapping and it is wrong: it shows the back
 * view for grid-up while the character travels right, which reads as
 * moonwalking, and the front view for grid-down while they travel left.
 *
 * Of LPC's four views the profiles are the closest to a true diagonal heading,
 * so each direction takes the profile that agrees with where it is going. The
 * cost is that up and right share a view, as do down and left — unavoidable
 * with four-view art, and far less jarring than a character walking backwards.
 */

export const FRAME_W = 64;
export const FRAME_H = 64;
const COLS = 9;

/** LPC's fixed row order within a walk sheet. */
const NORTH = 0;
const WEST = 1;
const SOUTH = 2;
const EAST = 3;

/** The view each grid direction is drawn with — see the note above. */
const DIR_ROW: Record<Dir, number> = {
  up: EAST, // travels north-east
  right: EAST, // travels south-east
  down: WEST, // travels south-west
  left: WEST, // travels north-west
};

const DIRS: Dir[] = ['up', 'left', 'down', 'right'];

// NORTH and SOUTH are LPC's back and front views. Nothing walks in them, since
// no grid step is straight up or down the screen, but they stay named so the
// row order documents itself and a future 8-way scheme can reach them.
void NORTH;
void SOUTH;

export const ACTOR_KEYS = ['player', 'npc'] as const;
export type ActorKey = (typeof ACTOR_KEYS)[number];

/** The standing frame for a facing — column 0 of that direction's row. */
export function idleFrame(dir: Dir): number {
  return DIR_ROW[dir] * COLS;
}

export function walkAnimKey(name: string, dir: Dir): string {
  return `${name}_walk_${dir}`;
}

export function preloadActors(scene: Phaser.Scene) {
  for (const key of ACTOR_KEYS) {
    scene.load.spritesheet(key, `art/${key}.png`, {
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
    });
  }
}

export function buildActorAnims(scene: Phaser.Scene, name: ActorKey) {
  DIRS.forEach((dir) => {
    const row = DIR_ROW[dir];
    const key = walkAnimKey(name, dir);
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.anims.create({
      key,
      // Columns 1..8; column 0 is the standing pose and would read as a hitch.
      frames: scene.anims.generateFrameNumbers(name, {
        start: row * COLS + 1,
        end: row * COLS + COLS - 1,
      }),
      frameRate: 12,
      repeat: -1,
    });
  });
}
