import Phaser from 'phaser';
import {
  DIR_VECTORS,
  HOP_MS,
  TILE,
  TURN_MS,
  VIEW_H,
  VIEW_W,
  WALK_MS,
  type Dir,
} from '../engine/constants';
import { Buttons, delay } from '../engine/input';
import { MAPS, type MapDef, type MapObject } from '../data/maps';
import { createMonster, type Monster } from '../data/species';
import { buildMapTexture } from '../gfx/assets';
import {
  saveThemeName,
  THEME_ORDER,
  type Theme,
  type ThemeName,
} from '../gfx/palette';
import { TILES, type TileDef } from '../gfx/tiles';
import { Dialog } from '../ui/Dialog';

const spriteDir = (dir: Dir) => (dir === 'left' || dir === 'right' ? 'side' : dir);
const hexToInt = (hex: string) => parseInt(hex.slice(1), 16);

/**
 * The overworld: grid-locked movement, tile collision, ledges, signs, NPCs and
 * wild encounters. All movement is tile-to-tile with a tween in between, which
 * is what gives the original games their deliberate, snappy feel.
 */
export class WorldScene extends Phaser.Scene {
  private theme!: Theme;
  private map!: MapDef;
  private buttons!: Buttons;
  private dialog!: Dialog;
  private player!: Phaser.GameObjects.Sprite;
  private npcs: { def: MapObject; sprite: Phaser.GameObjects.Sprite }[] = [];

  private tileX = 0;
  private tileY = 0;
  private facing: Dir = 'down';
  private moving = false;
  private busy = false;
  private turnTimer = 0;

  constructor() {
    super('World');
  }

  create() {
    this.theme = this.registry.get('theme');
    this.map = MAPS[this.registry.get('mapId') ?? 'route1'];
    this.npcs = [];
    this.moving = false;
    this.busy = false;
    this.turnTimer = 0;

    const { key, width, height } = buildMapTexture(this, this.map, this.theme);
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.cameras.main.setBackgroundColor(this.theme.backdrop);

    for (const def of this.map.objects) {
      if (def.kind !== 'npc') continue;
      const sprite = this.add
        .sprite(def.x * TILE + TILE / 2, def.y * TILE + TILE / 2, `npc_${spriteDir(def.facing ?? 'down')}_0`)
        .setDepth(10);
      sprite.setFlipX(def.facing === 'left');
      this.npcs.push({ def, sprite });
    }

    const saved = this.registry.get('playerPos') as { x: number; y: number } | undefined;
    this.tileX = saved?.x ?? this.map.spawn.x;
    this.tileY = saved?.y ?? this.map.spawn.y;
    this.player = this.add
      .sprite(this.tileX * TILE + TILE / 2, this.tileY * TILE + TILE / 2, 'player_down_0')
      .setDepth(11);

    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.roundPixels = true;

    this.buttons = new Buttons(this);
    this.dialog = new Dialog(this, this.theme.ui);

    // Coming back from a battle: unfreeze and drop any keypresses it consumed.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.busy = false;
      this.buttons.flush();
    });
  }

  update(_time: number, deltaMs: number) {
    if (this.busy || this.moving) return;

    if (this.turnTimer > 0) {
      this.turnTimer -= deltaMs;
      if (this.turnTimer > 0) return;
    }

    if (this.buttons.justDown('START')) {
      void this.openMenu();
      return;
    }

    if (this.buttons.justDown('A')) {
      void this.interact();
      return;
    }

    const dir = this.readDirection();
    if (!dir) {
      this.player.anims.stop();
      this.setIdleFrame();
      return;
    }
    this.tryMove(dir);
  }

  // -- movement -------------------------------------------------------------

  private readDirection(): Dir | null {
    if (this.buttons.isDown('UP')) return 'up';
    if (this.buttons.isDown('DOWN')) return 'down';
    if (this.buttons.isDown('LEFT')) return 'left';
    if (this.buttons.isDown('RIGHT')) return 'right';
    return null;
  }

  private tileAt(x: number, y: number): TileDef | null {
    const row = this.map.layout[y];
    if (!row) return null;
    return TILES[row[x]] ?? null;
  }

  private isOccupied(x: number, y: number) {
    return this.npcs.some(({ def }) => def.x === x && def.y === y);
  }

  private tryMove(dir: Dir) {
    if (this.facing !== dir) {
      // Turning in place costs a beat, so tapping a direction only turns you.
      this.facing = dir;
      this.setIdleFrame();
      this.turnTimer = TURN_MS;
      return;
    }

    const v = DIR_VECTORS[dir];
    const nx = this.tileX + v.x;
    const ny = this.tileY + v.y;
    const tile = this.tileAt(nx, ny);
    if (!tile) return;

    if (tile.ledge) {
      const landing = this.tileAt(nx, ny + 1);
      if (dir === 'down' && landing && !landing.solid && !this.isOccupied(nx, ny + 1)) {
        this.hop(nx, ny + 1);
      }
      return;
    }

    if (tile.solid || this.isOccupied(nx, ny)) {
      this.setIdleFrame();
      return;
    }

    this.walk(nx, ny);
  }

  private walk(nx: number, ny: number) {
    this.moving = true;
    this.player.play(`player_walk_${spriteDir(this.facing)}`, true);
    this.player.setFlipX(this.facing === 'left');
    this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: WALK_MS,
      onComplete: () => {
        this.tileX = nx;
        this.tileY = ny;
        this.moving = false;
        this.registry.set('playerPos', { x: nx, y: ny });
        this.onStep();
      },
    });
  }

  /** Ledge hop: two tiles down with a little arc. */
  private hop(nx: number, ny: number) {
    this.moving = true;
    this.player.play(`player_walk_down`, true);
    const startY = this.player.y;
    const endY = ny * TILE + TILE / 2;
    this.tweens.add({
      targets: this.player,
      y: endY,
      duration: HOP_MS,
      onUpdate: (tween) => {
        const t = tween.progress;
        // Superimpose a parabola so the character visibly leaps.
        this.player.y = Phaser.Math.Linear(startY, endY, t) - Math.sin(t * Math.PI) * 8;
      },
      onComplete: () => {
        this.player.y = endY;
        this.tileX = nx;
        this.tileY = ny;
        this.moving = false;
        this.registry.set('playerPos', { x: nx, y: ny });
        this.onStep();
      },
    });
  }

  private setIdleFrame() {
    this.player.anims.stop();
    this.player.setTexture(`player_${spriteDir(this.facing)}_0`);
    this.player.setFlipX(this.facing === 'left');
  }

  private onStep() {
    const tile = this.tileAt(this.tileX, this.tileY);
    if (tile?.encounter && Math.random() < this.map.encounterRate) {
      void this.startBattle();
    }
  }

  // -- interaction ----------------------------------------------------------

  private async interact() {
    const v = DIR_VECTORS[this.facing];
    const tx = this.tileX + v.x;
    const ty = this.tileY + v.y;
    const object = this.map.objects.find((o) => o.x === tx && o.y === ty);
    if (!object) return;

    this.busy = true;
    this.setIdleFrame();

    const npc = this.npcs.find((n) => n.def === object);
    if (npc) {
      // NPCs turn to face you before speaking.
      const opposite: Record<Dir, Dir> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left',
      };
      const look = opposite[this.facing];
      npc.sprite.setTexture(`npc_${spriteDir(look)}_0`);
      npc.sprite.setFlipX(look === 'left');
    }

    await this.dialog.say(object.text);
    this.dialog.hide();
    this.buttons.flush();
    this.busy = false;
  }

  private async openMenu() {
    this.busy = true;
    this.setIdleFrame();
    for (;;) {
      const choice = await this.dialog.choose(['PARTY', 'COLOR', 'CLOSE']);
      if (choice === 0) {
        const party = this.registry.get('party') as Monster[];
        const lines = party
          .map((m) => `${m.species.name} L${m.level}  ${m.hp}/${m.maxHp}HP`)
          .join('\n');
        await this.dialog.say(lines);
      } else if (choice === 1) {
        this.cycleTheme();
        return;
      } else {
        break;
      }
    }
    this.dialog.hide();
    this.buttons.flush();
    this.busy = false;
  }

  private cycleTheme() {
    const current = this.registry.get('themeName') as ThemeName;
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    this.registry.set('themeName', next);
    saveThemeName(next);
    this.scene.start('Boot');
  }

  // -- battles --------------------------------------------------------------

  private pickEncounter(): Monster {
    const total = this.map.encounters.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of this.map.encounters) {
      roll -= entry.weight;
      if (roll <= 0) {
        const level = Phaser.Math.Between(entry.minLevel, entry.maxLevel);
        return createMonster(entry.species, level);
      }
    }
    const fallback = this.map.encounters[0];
    return createMonster(fallback.species, fallback.minLevel);
  }

  private async startBattle() {
    this.busy = true;
    this.player.anims.stop();
    this.setIdleFrame();

    await this.flashTransition();

    const party = this.registry.get('party') as Monster[];
    this.scene.launch('Battle', { enemy: this.pickEncounter(), party });
    this.scene.pause();
  }

  /** The stuttering black flash that precedes every wild battle. */
  private async flashTransition() {
    const veil = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, hexToInt(this.theme.backdrop))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setAlpha(0);

    for (let i = 0; i < 3; i++) {
      veil.setAlpha(1);
      await delay(this, 70);
      veil.setAlpha(0);
      await delay(this, 70);
    }
    veil.setAlpha(1);
    await delay(this, 180);
    veil.destroy();
  }
}
