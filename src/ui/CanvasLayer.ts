import Phaser from 'phaser';
import { drawText } from '../gfx/font';
import type { Palette } from '../gfx/palette';

/**
 * A screen-space canvas the UI draws into with plain 2D calls. Keeping all HUD
 * rendering in one immediate-mode surface avoids juggling dozens of game
 * objects and makes the pixel alignment exact.
 */
export class CanvasLayer {
  readonly texture: Phaser.Textures.CanvasTexture;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: Phaser.GameObjects.Image;
  readonly width: number;
  readonly height: number;
  readonly pal: Palette;

  constructor(
    scene: Phaser.Scene,
    key: string,
    width: number,
    height: number,
    x = 0,
    y = 0,
    depth = 100,
    pal: Palette,
  ) {
    this.width = width;
    this.height = height;
    this.pal = pal;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, width, height)!;
    this.ctx = this.texture.getContext();
    this.ctx.imageSmoothingEnabled = false;
    this.image = scene.add
      .image(x, y, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  fill(shade: 0 | 1 | 2 | 3) {
    this.ctx.fillStyle = this.pal[shade];
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  rect(x: number, y: number, w: number, h: number, shade: 0 | 1 | 2 | 3) {
    this.ctx.fillStyle = this.pal[shade];
    this.ctx.fillRect(x, y, w, h);
  }

  /** For the few places where colour carries meaning and no shade will do. */
  paint(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  /** The classic double-ruled dialogue frame. */
  frame(x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h, 3);
    this.rect(x + 1, y + 1, w - 2, h - 2, 0);
    this.ctx.fillStyle = this.pal[3];
    this.ctx.strokeStyle = this.pal[3];
    // Inner rule, inset by 2px.
    this.ctx.fillRect(x + 3, y + 3, w - 6, 1);
    this.ctx.fillRect(x + 3, y + h - 4, w - 6, 1);
    this.ctx.fillRect(x + 3, y + 3, 1, h - 6);
    this.ctx.fillRect(x + w - 4, y + 3, 1, h - 6);
    // Knock the hard corners off, GB style.
    this.rect(x, y, 1, 1, 0);
    this.rect(x + w - 1, y, 1, 1, 0);
    this.rect(x, y + h - 1, 1, 1, 0);
    this.rect(x + w - 1, y + h - 1, 1, 1, 0);
  }

  text(str: string, x: number, y: number, shade: 0 | 1 | 2 | 3 = 3) {
    drawText(this.ctx, str, x, y, this.pal, shade);
  }

  refresh() {
    this.texture.refresh();
  }

  destroy() {
    this.image.destroy();
  }
}
