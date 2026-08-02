import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../engine/constants';
import { delay } from '../engine/input';
import { effectiveness, MOVES, type Move } from '../data/moves';
import type { Monster } from '../data/species';
import type { Theme } from '../gfx/palette';
import { CanvasLayer } from '../ui/CanvasLayer';
import { Dialog } from '../ui/Dialog';

/** The original battle composition: a 160x144 screen minus the 48px dialogue box. */
const FIELD_W = 160;
const FIELD_H = 96;
const BOX_H = 48;

interface BattleData {
  enemy: Monster;
  party: Monster[];
}

/**
 * Turn-based wild battle. The whole fight is expressed as one linear async
 * function, which keeps the ordering rules (speed checks, faint checks,
 * message pacing) readable instead of scattered across a state machine.
 */
export class BattleScene extends Phaser.Scene {
  private theme!: Theme;
  private bg!: CanvasLayer;
  private hud!: CanvasLayer;
  private dialog!: Dialog;

  private enemy!: Monster;
  private player!: Monster;
  private party!: Monster[];

  private enemySprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;

  /**
   * The fight is composed for a 160x144 screen; on a larger viewport the whole
   * arrangement is centred in the space above the dialogue box rather than
   * spread out, so it keeps its original proportions.
   */
  private ox = 0;
  private oy = 0;

  constructor() {
    super('Battle');
  }

  create(data: BattleData) {
    this.theme = this.registry.get('theme');
    this.enemy = data.enemy;
    this.party = data.party;
    this.player = data.party[0];

    this.ox = Math.floor((VIEW_W - FIELD_W) / 2);
    this.oy = Math.floor((VIEW_H - BOX_H - FIELD_H) / 2);

    // The field is painted with the battle ramp; the HUD with the UI one.
    this.bg = new CanvasLayer(this, 'battle:bg', VIEW_W, VIEW_H, 0, 0, 0, this.theme.battle);
    this.drawBackground();

    this.enemySprite = this.add
      .image(this.ox + 112, this.oy + 30, `mon_${this.enemy.species.id}_front`)
      .setDepth(10);
    this.playerSprite = this.add
      .image(this.ox + 42, this.oy + 76, `mon_${this.player.species.id}_back`)
      .setDepth(10);

    this.hud = new CanvasLayer(this, 'battle:hud', VIEW_W, VIEW_H, 0, 0, 20, this.theme.ui);
    this.dialog = new Dialog(this, this.theme.ui, 'battle:dialog', 200);
    this.drawHud();

    void this.run();
  }

  // -- presentation ---------------------------------------------------------

  private drawBackground() {
    this.bg.clear();
    this.bg.fill(0);
    // Ground discs the combatants stand on.
    this.ellipse(this.ox + 112, this.oy + 48, 30, 7);
    this.ellipse(this.ox + 40, this.oy + 95, 36, 8);
    this.bg.rect(0, 0, VIEW_W, 1, 3);
    this.bg.refresh();
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number) {
    const ctx = this.bg.ctx;
    ctx.fillStyle = this.theme.battle[1];
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(1 - (y / ry) ** 2));
      ctx.fillRect(cx - w, cy + y, w * 2, 1);
    }
  }

  private drawHud() {
    this.hud.clear();
    this.drawStatusBox(this.ox + 4, this.oy + 8, this.enemy, false);
    this.drawStatusBox(this.ox + 74, this.oy + 62, this.player, true);
    this.hud.refresh();
  }

  private drawStatusBox(x: number, y: number, mon: Monster, showNumbers: boolean) {
    const w = 82;
    const h = showNumbers ? 34 : 26;
    this.hud.frame(x, y, w, h);
    this.hud.text(mon.species.name, x + 6, y + 5);
    this.hud.text(`:L${mon.level}`, x + w - 26, y + 5);

    const barX = x + 20;
    const barY = y + 16;
    const barW = 48;
    this.hud.text('HP', x + 6, barY - 1);
    this.hud.rect(barX - 1, barY - 1, barW + 2, 5, 3);
    this.hud.rect(barX, barY, barW, 3, 0);

    const ratio = Math.max(0, mon.hp / mon.maxHp);
    // Green, yellow, red — the one place in the HUD where hue means something.
    const { high, mid, low } = this.theme.hp;
    const color = ratio > 0.5 ? high : ratio > 0.2 ? mid : low;
    this.hud.paint(barX, barY, Math.ceil(barW * ratio), 3, color);

    if (showNumbers) {
      const label = `${mon.hp}/ ${mon.maxHp}`;
      this.hud.text(label, x + w - 7 - label.length * 6, y + 23);
    }
  }

  private async animateHp(mon: Monster, target: number) {
    const from = mon.hp;
    const to = Math.max(0, target);
    const steps = Math.max(1, Math.abs(from - to));
    const perStep = Math.min(40, 500 / steps);
    for (let i = 1; i <= steps; i++) {
      mon.hp = Math.round(Phaser.Math.Linear(from, to, i / steps));
      this.drawHud();
      await delay(this, perStep);
    }
    mon.hp = to;
    this.drawHud();
  }

  private async blink(sprite: Phaser.GameObjects.Image) {
    for (let i = 0; i < 3; i++) {
      sprite.setVisible(false);
      await delay(this, 45);
      sprite.setVisible(true);
      await delay(this, 45);
    }
  }

  private async faintAnimation(sprite: Phaser.GameObjects.Image) {
    const startY = sprite.y;
    for (let i = 0; i < 16; i++) {
      sprite.y = startY + i * 2;
      sprite.setCrop(0, 0, sprite.width, Math.max(0, sprite.height - i * 2));
      await delay(this, 25);
    }
    sprite.setVisible(false);
  }

  // -- battle logic ---------------------------------------------------------

  private computeDamage(attacker: Monster, defender: Monster, move: Move) {
    if (move.power === 0) return { amount: 0, eff: 1 };
    const base =
      Math.floor(
        ((2 * attacker.level) / 5 + 2) * move.power * (attacker.atk / defender.def) / 50,
      ) + 2;
    const eff = effectiveness(move.type, defender.species.type);
    const stab = move.type === attacker.species.type ? 1.5 : 1;
    const variance = Phaser.Math.FloatBetween(0.85, 1);
    return { amount: Math.max(1, Math.floor(base * eff * stab * variance)), eff };
  }

  private async useMove(attacker: Monster, defender: Monster, move: Move, byPlayer: boolean) {
    const who = byPlayer ? attacker.species.name : `WILD ${attacker.species.name}`;
    await this.dialog.say(`${who} used ${move.name}!`);

    if (Math.random() * 100 > move.accuracy) {
      await this.dialog.say(`${who}'S ATTACK MISSED!`);
      return;
    }

    const { amount, eff } = this.computeDamage(attacker, defender, move);
    await this.blink(byPlayer ? this.enemySprite : this.playerSprite);
    await this.animateHp(defender, defender.hp - amount);

    if (eff > 1) await this.dialog.say("IT'S SUPER EFFECTIVE!");
    else if (eff < 1) await this.dialog.say("IT'S NOT VERY EFFECTIVE...");
  }

  private async run() {
    await this.dialog.say(`WILD ${this.enemy.species.name} APPEARED!`);
    await this.dialog.say(`GO! ${this.player.species.name}!`);

    for (;;) {
      const action = await this.dialog.choose(
        ['FIGHT', 'RUN'],
        false,
        `WHAT WILL ${this.player.species.name} DO?`,
      );

      if (action === 1) {
        const escaped = this.player.spd >= this.enemy.spd || Math.random() < 0.5;
        if (escaped) {
          await this.dialog.say('GOT AWAY SAFELY!');
          return this.finish();
        }
        await this.dialog.say("CAN'T ESCAPE!");
      } else {
        const moves = this.player.moves.map((id) => MOVES[id]);
        const pick = await this.dialog.choose(moves.map((m) => m.name), true);
        if (pick === -1) continue;

        const playerMove = moves[pick];
        const enemyMove = MOVES[Phaser.Math.RND.pick(this.enemy.moves)];
        const playerFirst = this.player.spd >= this.enemy.spd;

        const order: Array<[Monster, Monster, Move, boolean]> = playerFirst
          ? [
              [this.player, this.enemy, playerMove, true],
              [this.enemy, this.player, enemyMove, false],
            ]
          : [
              [this.enemy, this.player, enemyMove, false],
              [this.player, this.enemy, playerMove, true],
            ];

        for (const [attacker, defender, move, byPlayer] of order) {
          if (attacker.hp <= 0) continue;
          await this.useMove(attacker, defender, move, byPlayer);
          if (defender.hp <= 0) break;
        }
      }

      if (this.enemy.hp <= 0) {
        await this.faintAnimation(this.enemySprite);
        await this.dialog.say(`WILD ${this.enemy.species.name} FAINTED!`);
        return this.finish();
      }

      if (this.player.hp <= 0) {
        await this.faintAnimation(this.playerSprite);
        await this.dialog.say(`${this.player.species.name} FAINTED!`);
        await this.dialog.say('YOU SCURRIED BACK HOME AND RESTED UP.');
        this.party.forEach((m) => (m.hp = m.maxHp));
        return this.finish();
      }
    }
  }

  private async finish() {
    this.dialog.hide();
    await delay(this, 120);
    this.scene.resume('World');
    this.scene.stop();
  }
}
