import Phaser from 'phaser';
import { TILE } from '../engine/constants';
import type { MapDef } from '../data/maps';
import { SPECIES } from '../data/species';
import { NPC_ART, PLAYER_ART, type ActorArt } from './actors';
import { SPRITE_BUILDERS } from './creatures';
import { monsterSwatch, type Swatch, type Theme } from './palette';
import { artToCanvas, flipArt as mirrorArt, makeTexture } from './pixels';
import { TILES } from './tiles';

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

export function buildAssets(scene: Phaser.Scene, theme: Theme) {
  for (const def of Object.values(TILES)) {
    makeTexture(scene, def.key, def.art, theme.swatches[def.swatch]);
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
 * Bake an entire map into one texture. Fine for proof-of-concept map sizes; for
 * a full game swap this for a Phaser tilemap fed by Tiled JSON, which culls
 * offscreen tiles and supports layers.
 */
export function buildMapTexture(
  scene: Phaser.Scene,
  map: MapDef,
  theme: Theme,
): { key: string; width: number; height: number } {
  const key = `map:${map.id}`;
  const cols = map.layout[0].length;
  const rows = map.layout.length;
  const width = cols * TILE;
  const height = rows * TILE;

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, width, height)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;

  // Rasterise each distinct tile once, then blit.
  const stamps = new Map<string, HTMLCanvasElement>();
  for (const [ch, def] of Object.entries(TILES)) {
    stamps.set(ch, artToCanvas(def.art, theme.swatches[def.swatch]));
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const stamp = stamps.get(map.layout[y][x]);
      if (stamp) ctx.drawImage(stamp, x * TILE, y * TILE);
    }
  }
  tex.refresh();
  return { key, width, height };
}
