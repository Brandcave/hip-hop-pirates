import Phaser from 'phaser';
import { KEYS } from './constants';

export type ButtonName = keyof typeof KEYS;

const GAME_CODES = new Set(Object.values(KEYS).flat());

/** Physically held keys, tracked at the window level. */
const held = new Set<string>();
let trackerInstalled = false;

function installTracker() {
  if (trackerInstalled) return;
  trackerInstalled = true;
  window.addEventListener('keydown', (event) => {
    if (GAME_CODES.has(event.code)) event.preventDefault();
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // Releases that happen while unfocused never arrive, so assume nothing is held.
  window.addEventListener('blur', () => held.clear());
}

export function isCodeDown(codes: string[]): boolean {
  return codes.some((code) => held.has(code));
}

/**
 * Button state for one scene.
 *
 * Presses are *latched* from keydown events rather than sampled from key state,
 * so a tap that begins and ends between two frames still registers. Sampling
 * alone silently drops quick taps.
 */
export class Buttons {
  private pressed = new Set<string>();

  constructor(scene: Phaser.Scene) {
    installTracker();
    const kb = scene.input.keyboard!;
    const onDown = (event: KeyboardEvent) => this.pressed.add(event.code);
    const onPostUpdate = () => this.pressed.clear();

    kb.on('keydown', onDown);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onPostUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', onDown);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onPostUpdate);
    });
  }

  /** True while held, and for the frame a tap was latched. */
  isDown(name: ButtonName): boolean {
    return KEYS[name].some((code) => held.has(code) || this.pressed.has(code));
  }

  justDown(name: ButtonName): boolean {
    return KEYS[name].some((code) => this.pressed.has(code));
  }

  /** Drop pending presses, e.g. the keypress that just closed a dialogue box. */
  flush() {
    this.pressed.clear();
  }
}

export function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) scene.time.delayedCall(0, resolve);
    else scene.time.delayedCall(ms, resolve);
  });
}

/**
 * Resolve when one of `codes` is pressed.
 *
 * If the scene shuts down first (a resize rebuilds the viewport this way) the
 * handler is dropped and the promise simply never settles, which parks the
 * awaiting flow instead of letting it draw into torn-down objects.
 */
export function waitForKey(scene: Phaser.Scene, codes: string[]): Promise<string> {
  return new Promise((resolve) => {
    const kb = scene.input.keyboard!;
    const handler = (event: KeyboardEvent) => {
      if (!codes.includes(event.code)) return;
      kb.off('keydown', handler);
      resolve(event.code);
    };
    kb.on('keydown', handler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', handler));
  });
}
