import Phaser from 'phaser';
import {
  DIR_VECTORS,
  HOP_MS,
  TURN_MS,
  VIEW_H,
  VIEW_W,
  WALK_MS,
  type Dir,
} from '../engine/constants';
import { Buttons, delay } from '../engine/input';
import { MAPS, type MapDef, type MapObject } from '../data/maps';
import { createMonster, type Monster } from '../data/species';
import { worldTime } from '../engine/time';
import { buildMapTexture, isTallTile } from '../gfx/assets';
import { ISO_H, ISO_W, isoDepth, isoScreen, type IsoMetrics } from '../gfx/iso';
import { lightFor, type Light } from '../gfx/light';
import { Clock } from '../ui/Clock';
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

/** How far below a tile's centre an actor's feet sit, so they stand on the diamond. */
const FOOT_OFFSET = 4;
/** Room above the map for the tallest prop, so the camera doesn't clip it. */
const PROP_HEADROOM = 48;

/**
 * Everything casts onto one layer just above the baked ground and below every
 * prop, so shadows never climb up the things they are cast by.
 */
const SHADOW_DEPTH = -0.5;
/** The night grade sits over the world but under the UI, which stays readable. */
const GRADE_DEPTH = 9000;
const UI_DEPTH = 9500;

/**
 * What each kind of tile throws.
 *
 * `girth` is the caster's own width on the ground — a tree's shadow is as wide
 * as its canopy, a signpost's is as narrow as its post. Matching the footprint
 * is what makes a shadow belong to its object rather than merely sit near it.
 */
interface CasterSpec {
  height: number;
  girth: number;
  shape: 'blob' | 'diamond';
}

function shadowCaster(def: TileDef): CasterSpec | null {
  switch (def.iso.kind) {
    case 'tree':
      return { height: 20, girth: 22, shape: 'blob' };
    case 'sign':
      return { height: 10, girth: 9, shape: 'blob' };
    case 'block':
      // Buildings shadow with their own square footprint, corners and all.
      return { height: def.iso.height ?? 16, girth: ISO_W, shape: 'diamond' };
    default:
      // Grass blades and flowers are too low to throw anything worth drawing.
      return null;
  }
}

interface CastShadow {
  image: Phaser.GameObjects.Image;
  /** Where the shadow is anchored: the base of whatever is casting it. */
  x: number;
  y: number;
  height: number;
  /** Width of the caster's own footprint, before the light stretches it. */
  girth: number;
}

/**
 * The overworld: grid-locked movement, tile collision, ledges, signs, NPCs and
 * wild encounters. All movement is tile-to-tile with a tween in between, which
 * is what gives the original games their deliberate, snappy feel.
 */
export class WorldScene extends Phaser.Scene {
  private theme!: Theme;
  private metrics!: IsoMetrics;
  private map!: MapDef;
  private buttons!: Buttons;
  private dialog!: Dialog;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: CastShadow;
  private shadows: CastShadow[] = [];
  private grade!: Phaser.GameObjects.Rectangle;
  private clock!: Clock;
  private lastMinute = -1;
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
    this.shadows = [];
    this.lastMinute = -1;
    this.moving = false;
    this.busy = false;
    this.turnTimer = 0;

    const { key, metrics } = buildMapTexture(this, this.map, this.theme);
    this.metrics = metrics;
    // The baked ground sits under everything; props and actors sort above it.
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1);
    this.cameras.main.setBackgroundColor(this.theme.backdrop);
    this.addProps();

    for (const def of this.map.objects) {
      if (def.kind !== 'npc') continue;
      const at = this.screenPos(def.x, def.y);
      this.addShadow(at.x, at.y, 12, 11, 'blob');
      const sprite = this.add
        .sprite(at.x, at.y, `npc_${spriteDir(def.facing ?? 'down')}_0`)
        .setOrigin(0.5, 1)
        .setDepth(isoDepth(def.x, def.y) + 0.5);
      sprite.setFlipX(def.facing === 'left');
      this.npcs.push({ def, sprite });
    }

    const saved = this.registry.get('playerPos') as { x: number; y: number } | undefined;
    this.tileX = saved?.x ?? this.map.spawn.x;
    this.tileY = saved?.y ?? this.map.spawn.y;
    const spawn = this.screenPos(this.tileX, this.tileY);
    this.playerShadow = this.addShadow(spawn.x, spawn.y, 12, 11, 'blob');
    this.player = this.add
      .sprite(spawn.x, spawn.y, 'player_down_0')
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(this.tileX, this.tileY) + 0.5);

    // Headroom above the map for tall props poking over the top row.
    this.cameras.main.setBounds(0, -PROP_HEADROOM, metrics.width, metrics.height + PROP_HEADROOM);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.roundPixels = true;

    // Grades the world without touching the UI drawn above it.
    this.grade = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0xffffff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(GRADE_DEPTH)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.buttons = new Buttons(this);
    this.dialog = new Dialog(this, this.theme.ui, `dialog:${this.scene.key}`, UI_DEPTH);
    this.clock = new Clock(this, this.theme.ui, UI_DEPTH + 10);
    this.applyLight();

    // Coming back from a battle: unfreeze and drop any keypresses it consumed.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.busy = false;
      this.buttons.flush();
    });
  }

  /** Where an actor's feet go: the centre of the tile's diamond, nudged forward. */
  private screenPos(tx: number, ty: number) {
    const p = isoScreen(tx, ty, this.metrics);
    return { x: p.x, y: p.y + FOOT_OFFSET };
  }

  /**
   * Everything with height becomes its own sprite so it can be depth-sorted
   * against the player — walk north of a tree and you pass behind it.
   */
  private addProps() {
    for (let y = 0; y < this.map.layout.length; y++) {
      for (let x = 0; x < this.map.layout[y].length; x++) {
        const def = TILES[this.map.layout[y][x]];
        if (!def || !isTallTile(def)) continue;
        const p = isoScreen(x, y, this.metrics);
        this.add
          .image(p.x, p.y + ISO_H / 2, def.key)
          .setOrigin(0.5, 1)
          .setDepth(isoDepth(x, y));

        const caster = shadowCaster(def);
        if (caster) {
          this.addShadow(p.x, p.y, caster.height, caster.girth, caster.shape);
        }
      }
    }
  }

  private addShadow(
    x: number,
    y: number,
    height: number,
    girth: number,
    shape: 'blob' | 'diamond',
  ): CastShadow {
    const image = this.add
      .image(x, y, shape === 'blob' ? 'shadow_blob' : 'shadow_diamond')
      .setOrigin(0.5, 0.5)
      .setDepth(SHADOW_DEPTH);
    const shadow: CastShadow = { image, x, y, height, girth };
    this.shadows.push(shadow);
    return shadow;
  }

  /**
   * Point every shadow away from the light and stretch it by the sun's height,
   * then grade the scene to match.
   *
   * The sun only moves once per in-game minute — once a real second — so the
   * couple of hundred static props are re-cast on that tick. Only the player's
   * own shadow has to keep up with the frame rate.
   */
  private applyLight() {
    const time = worldTime(this.registry.get('dayStart'));
    const light = lightFor(time);
    const minute = Math.floor(time.minutes);

    if (minute === this.lastMinute) {
      this.castShadow(this.playerShadow, light);
      return;
    }

    this.lastMinute = minute;
    for (const shadow of this.shadows) this.castShadow(shadow, light);
    this.grade.setFillStyle(light.tint);
    this.clock.update(time, light.isNight);
  }

  private castShadow(shadow: CastShadow, light: Light) {
    const reach = shadow.height * light.length;
    shadow.image
      .setPosition(
        shadow.x + (light.shadow.x * reach) / 2,
        shadow.y + (light.shadow.y * reach) / 2,
      )
      .setRotation(Math.atan2(light.shadow.y, light.shadow.x))
      // The long axis grows with the light; the short axis stays the footprint,
      // squashed to the ground plane so it lies flat.
      .setDisplaySize(shadow.girth + reach, shadow.girth / 2)
      .setAlpha(light.alpha);
  }

  update(_time: number, deltaMs: number) {
    // The player's shadow is anchored to wherever the feet currently are.
    this.playerShadow.x = this.player.x;
    this.playerShadow.y = this.player.y;
    this.applyLight();

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
    const to = this.screenPos(nx, ny);
    this.tweens.add({
      targets: this.player,
      x: to.x,
      y: to.y,
      duration: WALK_MS,
      // Depth tracks the screen position, so the sort stays right mid-step.
      onUpdate: () => this.player.setDepth(this.player.y + 0.5),
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
    const startX = this.player.x;
    const startY = this.player.y;
    const end = this.screenPos(nx, ny);
    this.tweens.add({
      targets: this.player,
      y: end.y,
      duration: HOP_MS,
      onUpdate: (tween) => {
        const t = tween.progress;
        // Superimpose a parabola so the character visibly leaps.
        this.player.x = Phaser.Math.Linear(startX, end.x, t);
        this.player.y = Phaser.Math.Linear(startY, end.y, t) - Math.sin(t * Math.PI) * 10;
        this.player.setDepth(this.player.y + 0.5);
      },
      onComplete: () => {
        this.player.x = end.x;
        this.player.y = end.y;
        this.player.setDepth(end.y + 0.5);
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
