import Phaser from 'phaser';
import { VIEW_W } from '../engine/constants';
import type { WorldTime } from '../engine/time';
import type { Palette } from '../gfx/palette';
import { CanvasLayer } from './CanvasLayer';

/**
 * The time of day, pinned to the top of the screen.
 *
 * It carries a sun or moon mark as well as the digits, because the light is the
 * thing the clock is really reporting — the number is how you predict where the
 * shadows are about to go.
 */
const W = 52;
const H = 15;

export class Clock {
  private layer: CanvasLayer;
  private shown = '';

  constructor(scene: Phaser.Scene, pal: Palette, depth: number) {
    this.layer = new CanvasLayer(
      scene,
      `hud:clock:${scene.scene.key}`,
      W,
      H,
      Math.floor((VIEW_W - W) / 2),
      3,
      depth,
      pal,
    );
  }

  update(time: WorldTime, night: boolean) {
    const key = `${time.label}${night ? 'n' : 'd'}`;
    if (key === this.shown) return;
    this.shown = key;

    this.layer.clear();
    this.layer.frame(0, 0, W, H);
    if (night) this.moon(6, 5);
    else this.sun(6, 5);
    this.layer.text(time.label, 17, 4);
    this.layer.refresh();
  }

  private sun(x: number, y: number) {
    this.layer.rect(x + 1, y, 3, 5, 3);
    this.layer.rect(x, y + 1, 5, 3, 3);
  }

  private moon(x: number, y: number) {
    this.layer.rect(x + 1, y, 3, 5, 3);
    this.layer.rect(x, y + 1, 5, 3, 3);
    // Bite out of the top-right, which is what makes it read as a crescent.
    this.layer.rect(x + 3, y, 2, 3, 0);
  }

  destroy() {
    this.layer.destroy();
  }
}
