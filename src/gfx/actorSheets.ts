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
 * The row order happens to be exactly our `Dir` set, and that is not a
 * coincidence worth fighting: isometric rotates the *world* 45°, not the actor,
 * so a grid step still reads on screen as toward / away / left / right. Walking
 * grid-up moves up-right and shows the character's back; grid-down moves
 * down-left and shows their face. Mapping Dir to LPC's rows one-for-one is the
 * correct projection, not a shortcut.
 */

export const FRAME_W = 64;
export const FRAME_H = 64;
const COLS = 9;

/** LPC's row order within a walk sheet. */
const ROWS: Dir[] = ['up', 'left', 'down', 'right'];

export const ACTOR_KEYS = ['player', 'npc'] as const;
export type ActorKey = (typeof ACTOR_KEYS)[number];

/** The standing frame for a facing — column 0 of that direction's row. */
export function idleFrame(dir: Dir): number {
  return ROWS.indexOf(dir) * COLS;
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
  ROWS.forEach((dir, row) => {
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
