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
 * Each direction maps to the row of the same name, and that works because
 * movement runs along the grid diagonals (see DIR_VECTORS): every heading
 * projects to a screen cardinal, so the north view really does travel straight
 * up and the east view straight right.
 *
 * Getting here took two wrong turns worth recording. Moving along the grid axes
 * instead sends every step off on a screen diagonal, and LPC has no 45° views —
 * so the back view travels up-right and reads as moonwalking. Substituting the
 * nearest profile fixes the moonwalk but makes up and right the same sprite.
 * Neither is fixable in the art; only the movement axes fix it.
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
  up: NORTH,
  left: WEST,
  down: SOUTH,
  right: EAST,
};

const DIRS: Dir[] = ['up', 'left', 'down', 'right'];


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
