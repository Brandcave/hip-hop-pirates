import * as THREE from 'three';
import { MAPS } from '../data/maps';
import { worldTime } from '../engine/time';
import { lightFor } from '../gfx/light';
import type { Theme } from '../gfx/palette';
import { buildFaceAtlas } from './atlas';
import { buildVoxelWorld } from './grid';
import { buildWorldMesh } from './mesher';

/**
 * The voxel diorama.
 *
 * A second renderer beside the isometric one, not a replacement: the 2D world
 * keeps running underneath and the ladder steps back to it, so the two can be
 * compared on the same save at the same minute.
 *
 * THE LADDER is camera pitch, in degrees, and it is the whole interface. 15 is
 * almost the flat isometric view we came from; 75 looks down on a tabletop
 * model. Stepping it is how you discover that a voxel world is mostly a
 * question of what angle you agreed to look at it from.
 */
export const PITCH_LADDER = [0, 15, 35, 50, 75] as const;

/** Tiles across the diorama's view at the flattest rung. */
const VIEW_TILES = 22;

export class VoxelScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private ambient = new THREE.HemisphereLight(0xbfd8ff, 0x4a5a3a, 0.55);
  private rung = 2;
  private focus = new THREE.Vector3(0, 0, 0);
  private dayStart: number;

  constructor(theme: Theme, dayStart: number, mapId = 'route1') {
    this.dayStart = dayStart;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:none;image-rendering:pixelated';

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

    const world = buildVoxelWorld(MAPS[mapId]);
    const atlas = buildFaceAtlas(theme);
    const { mesh } = buildWorldMesh(world, atlas, theme);
    this.scene.add(mesh);

    // A ground plane under everything, so the diorama sits on something rather
    // than floating over the void at the map's edge.
    const skirt = new THREE.Mesh(
      new THREE.PlaneGeometry(world.cols * 3, world.rows * 3),
      new THREE.MeshLambertMaterial({ color: 0x121a12 }),
    );
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(world.cols / 2, -0.02, world.rows / 2);
    this.scene.add(skirt);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadowCam.left = -40;
    shadowCam.right = 40;
    shadowCam.top = 40;
    shadowCam.bottom = -40;
    shadowCam.near = 0.5;
    shadowCam.far = 200;
    this.scene.add(this.sun, this.sun.target, this.ambient);

    this.focus.set(world.cols / 2, 0, world.rows / 2);
    this.resize();
  }

  get pitch() {
    return PITCH_LADDER[this.rung];
  }

  get enabled() {
    return this.rung > 0;
  }

  /** Step the ladder, wrapping back to OFF — the mod's own interface. */
  step() {
    this.rung = (this.rung + 1) % PITCH_LADDER.length;
    this.canvas.style.display = this.enabled ? 'block' : 'none';
    return this.pitch;
  }

  lookAt(tileX: number, tileY: number) {
    this.focus.set(tileX + 0.5, 0, tileY + 0.5);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Render at a fraction of the window and scale up: the pixels stay chunky,
    // which is the whole point, and it costs a quarter of the fragments.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.floor(w / 3), Math.floor(h / 3), false);
    const aspect = w / h;
    const half = VIEW_TILES / 2;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  render() {
    if (!this.enabled) return;

    const time = worldTime(this.dayStart);
    const light = lightFor(time);

    // The camera looks north along the same bearing the 2D world is drawn from,
    // so stepping the ladder rotates the world under you rather than spinning it.
    const pitch = THREE.MathUtils.degToRad(Math.max(8, this.pitch));
    const dist = 60;
    const yaw = Math.PI / 4;
    this.camera.position.set(
      this.focus.x + Math.cos(pitch) * Math.sin(yaw) * dist,
      this.focus.y + Math.sin(pitch) * dist,
      this.focus.z + Math.cos(pitch) * Math.cos(yaw) * dist,
    );
    this.camera.lookAt(this.focus);

    // The sun is the same body the 2D shadows use: east at dawn, south and high
    // at noon, west at dusk. Here it casts real shadows instead of stamped ones.
    const hour = time.minutes / 60;
    const day = THREE.MathUtils.clamp((hour - 6) / 14, 0, 1);
    const elevation = Math.max(0.08, Math.sin(Math.PI * day));
    const azimuth = Math.PI * day;
    this.sun.position.set(
      this.focus.x + Math.cos(azimuth) * 60,
      elevation * 70 + 6,
      this.focus.z - Math.sin(azimuth) * 40,
    );
    this.sun.target.position.copy(this.focus);
    this.sun.color.setHex(light.tint);
    this.sun.intensity = light.isNight ? 0.35 : 1.5;
    this.ambient.intensity = light.isNight ? 0.3 : 0.55;
    this.scene.background = new THREE.Color(light.tint).multiplyScalar(
      light.isNight ? 0.35 : 0.9,
    );

    this.renderer.render(this.scene, this.camera);
  }
}
