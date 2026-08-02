import Phaser from 'phaser';
import type { MapDef } from '../data/maps';
import { SPECIES } from '../data/species';
import { NPC_ART, PLAYER_ART, type ActorArt } from './actors';
import { SPRITE_BUILDERS } from './creatures';
import {
  buildIsoTile,
  buildShadowBlob,
  buildShadowDiamond,
  ISO_H,
  isoMetrics,
  isoScreen,
  type IsoMetrics,
} from './iso';
import { monsterSwatch, type Swatch, type Theme } from './palette';
import { flipArt as mirrorArt, makeTexture } from './pixels';
import { TILES, type TileDef } from './tiles';

/**
 * Every texture the game uses is generated here from source art, each asset
 * coloured with its own named ramp from the active theme. Because it all funnels
 * through one function, changing theme is just "regenerate and go" — and
 * swapping to real PNG assets later means rewriting only this file.
 */

const DIRS = ['down', 'up', 'side'] as const;

function buildActorTextures(
  scene: Phaser.Scene,
  name: string,
  actor: ActorArt,
  pal: Swatch,
) {
  DIRS.forEach((dir) => {
    actor[dir].forEach((frame, i) => {
      makeTexture(scene, `${name}_${dir}_${i}`, frame, pal);
    });
  });
}

function buildActorAnims(scene: Phaser.Scene, name: string) {
  DIRS.forEach((dir) => {
    const key = `${name}_walk_${dir}`;
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.anims.create({
      key,
      // idle -> stepA -> idle -> stepB reads as a proper four-beat walk cycle
      frames: [
        { key: `${name}_${dir}_1` },
        { key: `${name}_${dir}_0` },
        { key: `${name}_${dir}_2` },
        { key: `${name}_${dir}_0` },
      ],
      frameRate: 8,
      repeat: -1,
    });
  });
}

/** Iso tile art, drawn once per theme and registered as a texture each. */
function tileCanvas(theme: Theme, def: TileDef) {
  return buildIsoTile(def.iso, theme.swatches[def.swatch], theme.swatches.grass);
}

/** A tile taller than one diamond has to be drawn as a depth-sorted prop. */
export function isTallTile(def: TileDef) {
  return def.iso.kind !== 'ground' && def.iso.kind !== 'water';
}

export function buildAssets(scene: Phaser.Scene, theme: Theme) {
  for (const def of Object.values(TILES)) {
    if (scene.textures.exists(def.key)) scene.textures.remove(def.key);
    scene.textures.addCanvas(def.key, tileCanvas(theme, def));
  }

  for (const [key, make] of [
    ['shadow_blob', buildShadowBlob],
    ['shadow_diamond', buildShadowDiamond],
  ] as const) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, make());
  }

  buildActorTextures(scene, 'player', PLAYER_ART, theme.swatches.player);
  buildActorTextures(scene, 'npc', NPC_ART, theme.swatches.npc);
  buildActorAnims(scene, 'player');
  buildActorAnims(scene, 'npc');

  for (const species of Object.values(SPECIES)) {
    const build = SPRITE_BUILDERS[species.sprite];
    const pal = monsterSwatch(theme, species.type);
    makeTexture(scene, `mon_${species.id}_front`, build('front'), pal);
    // Mirrored so the rear view isn't a straight copy of the silhouette.
    makeTexture(scene, `mon_${species.id}_back`, mirrorArt(build('back')), pal);
  }
}

/**
 * Bake the flat ground into one texture. Anything with height is left out and
 * spawned as a sprite by the scene instead, so the player can walk behind it.
 *
 * Fine for proof-of-concept map sizes; for a full game swap this for a Phaser
 * tilemap, which culls offscreen tiles and supports layers.
 */
export function buildMapTexture(
  scene: Phaser.Scene,
  map: MapDef,
  theme: Theme,
): { key: string; metrics: IsoMetrics } {
  const key = `map:${map.id}`;
  const cols = map.layout[0].length;
  const rows = map.layout.length;
  const metrics = isoMetrics(cols, rows);

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, metrics.width, metrics.height)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;

  // Rasterise each distinct flat tile once, then blit.
  const stamps = new Map<string, HTMLCanvasElement>();
  for (const [ch, def] of Object.entries(TILES)) {
    if (!isTallTile(def)) stamps.set(ch, tileCanvas(theme, def));
  }

  // Back to front, so the tiny overlaps at diamond edges resolve correctly.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const stamp = stamps.get(map.layout[y][x]);
      if (!stamp) continue;
      const p = isoScreen(x, y, metrics);
      ctx.drawImage(stamp, p.x - stamp.width / 2, p.y + ISO_H / 2 - stamp.height);
    }
  }
  tex.refresh();
  return { key, metrics };
}
