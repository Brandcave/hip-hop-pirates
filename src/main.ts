import Phaser from 'phaser';
import {
  computeViewport,
  PIXEL_SCALE,
  resetZoom,
  VIEW_H,
  VIEW_W,
  zoomBy,
} from './engine/constants';
import { dayStartForHour } from './engine/time';
import { VoxelScene } from './voxel/scene';
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
  const dev = window as unknown as { game: Phaser.Game; setHour: (h: number) => void };
  dev.game = game;
  // Jump the world clock, for looking at the light at a given hour.
  dev.setHour = (hour: number) => game.registry.set('dayStart', dayStartForHour(hour));
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

/**
 * cmd/ctrl +/- zooms the game rather than the page. Zooming in magnifies each
 * game pixel, so the same window holds fewer of them and shows less world;
 * zooming out does the reverse. Numpad variants are included because laptops
 * with a number pad send those codes instead.
 */
const ZOOM_IN = ['Equal', 'NumpadAdd'];
const ZOOM_OUT = ['Minus', 'NumpadSubtract'];
const ZOOM_RESET = ['Digit0', 'Numpad0'];

window.addEventListener(
  'keydown',
  (event) => {
    if (event.code === 'KeyF') {
      toggleFullscreen();
      return;
    }
    if (!event.metaKey && !event.ctrlKey) return;

    let changed: boolean | null = null;
    if (ZOOM_IN.includes(event.code)) changed = zoomBy(1);
    else if (ZOOM_OUT.includes(event.code)) changed = zoomBy(-1);
    else if (ZOOM_RESET.includes(event.code)) changed = resetZoom();
    if (changed === null) return;

    // Swallow the browser's own zoom even at the ends of the range, so hitting
    // the limit doesn't suddenly start scaling the page instead.
    event.preventDefault();
    if (changed) onViewportChanged();
  },
  // Capture, to get ahead of anything the scenes bind on the window.
  true,
);


/**
 * The voxel diorama, built lazily the first time it is asked for and stepped by
 * the V key: OFF -> 15 -> 35 -> 50 -> 75 -> OFF, the same ladder shape the mod
 * this borrows from uses. The isometric game keeps running underneath, so the
 * two views are the same save at the same minute.
 */
let voxel: VoxelScene | null = null;

function stepVoxel() {
  if (!voxel) {
    const theme = game.registry.get('theme');
    const dayStart = game.registry.get('dayStart');
    if (!theme || !dayStart) return;
    voxel = new VoxelScene(theme, dayStart);
    document.getElementById('screen')!.appendChild(voxel.canvas);
    window.addEventListener('resize', () => voxel?.resize());
  }
  voxel.step();
  if (game.canvas) game.canvas.style.visibility = voxel.enabled ? 'hidden' : 'visible';
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyV') stepVoxel();
});

game.events.on(Phaser.Core.Events.POST_RENDER, () => {
  if (!voxel?.enabled) return;
  const world = game.scene.getScene('World') as unknown as {
    tileX?: number;
    tileY?: number;
  } | null;
  if (world && world.tileX !== undefined && world.tileY !== undefined) {
    voxel.lookAt(world.tileX, world.tileY);
  }
  voxel.render();
});
