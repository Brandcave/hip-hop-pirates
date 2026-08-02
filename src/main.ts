import Phaser from 'phaser';
import { computeViewport, PIXEL_SCALE, VIEW_H, VIEW_W } from './engine/constants';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'screen',
  width: VIEW_W,
  height: VIEW_H,
  // Nearest-neighbour everything; no sub-pixel smearing anywhere.
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#000000',
  // Scaling is handled manually below so the zoom factor stays a whole number.
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [BootScene, WorldScene, BattleScene],
});

// Handy for poking at scene state from the devtools console during development.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}

/**
 * Push the freshly computed viewport into Phaser and size the canvas so the
 * window is covered exactly. Every game pixel stays a square of PIXEL_SCALE
 * device pixels — integer-only scaling is the difference between crisp Game Boy
 * pixels and a shimmering mess.
 */
function applyCanvasSize() {
  const canvas = game.canvas;
  if (!canvas) return;
  game.scale.resize(VIEW_W, VIEW_H);
  canvas.style.width = `${VIEW_W * PIXEL_SCALE}px`;
  canvas.style.height = `${VIEW_H * PIXEL_SCALE}px`;
}

/**
 * A resize changes how many game pixels exist, so every screen-space layout
 * (dialogue box, battle HUD) has to be rebuilt. Restarting from Boot is the
 * same path a palette swap already takes; progress lives in the registry and
 * survives it.
 */
function onViewportChanged() {
  const before = `${VIEW_W}x${VIEW_H}`;
  computeViewport();
  applyCanvasSize();
  if (before === `${VIEW_W}x${VIEW_H}`) return;
  game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
  game.scene.start('Boot');
}

game.events.once(Phaser.Core.Events.READY, applyCanvasSize);

let resizeTimer = 0;
const scheduleResize = () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onViewportChanged, 150);
};

window.addEventListener('resize', scheduleResize);
document.addEventListener('fullscreenchange', scheduleResize);

const toggleFullscreen = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyF') toggleFullscreen();
});
