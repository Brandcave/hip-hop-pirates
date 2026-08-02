import Phaser from 'phaser';
import { GLYPH_ADV, LINE_H, paginate } from '../gfx/font';
import type { Palette } from '../gfx/palette';
import { KEYS, TEXT_SPEED_MS, VIEW_H, VIEW_W } from '../engine/constants';
import { delay, isCodeDown, waitForKey } from '../engine/input';
import { CanvasLayer } from './CanvasLayer';

const BOX_H = 48;
const PAD_X = 10;
/** Text baseline inside the box, measured from the box's own top edge. */
const TEXT_Y = 10;

/**
 * Promise-based dialogue and menus, so game flow reads top-to-bottom:
 *
 *   await dialog.say('WILD EMBERAT appeared!');
 *   const choice = await dialog.choose(['FIGHT', 'RUN']);
 */
export class Dialog {
  private layer: CanvasLayer;
  private scene: Phaser.Scene;
  private visible = false;
  /** Box width follows the viewport, so it is captured per instance, not per module. */
  private readonly boxW: number;
  private readonly textW: number;

  constructor(
    scene: Phaser.Scene,
    pal: Palette,
    key = `dialog:${scene.scene.key}`,
    depth = 200,
  ) {
    this.scene = scene;
    this.boxW = VIEW_W;
    this.textW = VIEW_W - PAD_X * 2;
    this.layer = new CanvasLayer(scene, key, this.boxW, BOX_H, 0, VIEW_H - BOX_H, depth, pal);
    this.layer.image.setVisible(false);
  }

  get isOpen() {
    return this.visible;
  }

  /** Print text, one page at a time, waiting for A between pages. */
  async say(text: string) {
    this.visible = true;
    this.layer.image.setVisible(true);
    const pages = paginate(text, this.textW, 2);
    for (let p = 0; p < pages.length; p++) {
      await this.reveal(pages[p]);
      this.drawArrow();
      await waitForKey(this.scene, KEYS.A);
    }
  }

  /** Print text and leave it up without waiting (for battle status lines). */
  show(text: string) {
    this.visible = true;
    this.layer.image.setVisible(true);
    const [page] = paginate(text, this.textW, 2);
    this.drawPage(page, page.map((l) => l.length));
  }

  /** A vertical menu anchored to the bottom-right, Gen 1 style. */
  async choose(options: string[], allowCancel = true, prompt?: string): Promise<number> {
    this.visible = true;
    this.layer.image.setVisible(true);
    const menuW = Math.max(...options.map((o) => o.length)) * GLYPH_ADV + 24;
    const menuX = this.boxW - menuW;
    const menuH = options.length * LINE_H + 14;
    const menuY = BOX_H - menuH;

    let index = 0;
    const render = () => {
      // Repaint the whole box first, or the previous message bleeds out
      // from behind the menu frame.
      this.layer.clear();
      this.layer.frame(0, 0, this.boxW, BOX_H);
      if (prompt) {
        paginate(prompt, menuX - PAD_X - 4, 2)[0].forEach((line, i) => {
          this.layer.text(line, PAD_X, TEXT_Y + i * LINE_H);
        });
      }
      this.layer.frame(menuX, menuY, menuW, menuH);
      options.forEach((option, i) => {
        const y = menuY + 7 + i * LINE_H;
        this.layer.text(option, menuX + 14, y);
        if (i === index) this.drawCursor(menuX + 6, y + 1);
      });
      this.layer.refresh();
    };
    render();

    for (;;) {
      const code = await waitForKey(this.scene, [
        ...KEYS.UP,
        ...KEYS.DOWN,
        ...KEYS.A,
        ...KEYS.B,
      ]);
      if (KEYS.UP.includes(code)) {
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (KEYS.DOWN.includes(code)) {
        index = (index + 1) % options.length;
        render();
      } else if (KEYS.A.includes(code)) {
        return index;
      } else if (allowCancel) {
        return -1;
      }
    }
  }

  hide() {
    this.visible = false;
    this.layer.image.setVisible(false);
    this.layer.clear();
    this.layer.refresh();
  }

  private async reveal(lines: string[]) {
    const counts = lines.map(() => 0);
    for (let li = 0; li < lines.length; li++) {
      for (let c = 0; c <= lines[li].length; c++) {
        counts[li] = c;
        this.drawPage(lines, counts);
        // Holding A fast-forwards, exactly like the originals.
        const fast = isCodeDown(KEYS.A);
        await delay(this.scene, fast ? 0 : TEXT_SPEED_MS);
      }
    }
  }

  private drawPage(lines: string[], counts: number[]) {
    this.layer.clear();
    this.layer.frame(0, 0, this.boxW, BOX_H);
    lines.forEach((line, i) => {
      this.layer.text(line.slice(0, counts[i]), PAD_X, TEXT_Y + i * LINE_H);
    });
    this.layer.refresh();
  }

  private drawArrow() {
    const x = this.boxW - 14;
    const y = BOX_H - 12;
    for (let i = 0; i < 4; i++) {
      this.layer.rect(x + i, y + i, 7 - i * 2, 1, 3);
    }
    this.layer.refresh();
  }

  private drawCursor(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      this.layer.rect(x + i, y + i, 1, 5 - i * 2, 3);
    }
  }
}
