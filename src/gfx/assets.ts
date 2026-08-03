import Phaser from 'phaser';
import type { MapDef } from '../data/maps';
import { SPECIES } from '../data/species';
import { SPRITE_BUILDERS } from './creatures';
import {
  buildIsoGround,
  buildIsoProp,
  PROPS,
  TERRAIN,
  variantAt,
  VARIANTS,
  buildShadowBlob,
  buildShadowDiamond,
  ISO_H,
  isoMetrics,
  isoScreen,
  type IsoMetrics,
} from './iso';
import { monsterSwatch, type SwatchName, type Theme } from './palette';
import { flipArt as mirrorArt, makeTexture } from './pixels';
import { ACTOR_KEYS, buildActorAnims } from './actorSheets';
import { TILES, type TileDef } from './tiles';

/**
 * Every texture the game uses is generated here from source art, each asset
 * coloured with its own named ramp from the active theme. Because it all funnels
 * through one function, changing theme is just "regenerate and go" — and
 * swapping to real PNG assets later means rewriting only this file.
 */

/**
 * The flat diamond under a tile. For a prop tile that is the terrain it stands
 * in — grass beneath a tree, the field beneath tall grass — which is what the
 * prop no longer draws for itself.
 */
function groundCanvas(theme: Theme, def: TileDef, variant: number) {
  const terrain = TERRAIN[def.iso.terrain];
  return buildIsoGround(def.iso.terrain, theme.swatches[terrain.swatch as SwatchName], variant);
}

/** Texture key for one frame of one variant of a tile's prop, in one neighbourhood. */
export function propKey(def: TileDef, variant: number, frame = 0, neighbours = 0) {
  return `${def.key}_v${variant}_f${frame}_m${neighbours}`;
}

/** Animation key for one variant of an animated prop. */
export function propAnimKey(def: TileDef, variant: number, neighbours = 0) {
  return `anim_${def.key}_v${variant}_m${neighbours}`;
}

/** Tiles with something standing on them get a depth-sorted sprite too. */
export function isTallTile(def: TileDef) {
  return def.iso.prop !== undefined;
}

export function buildAssets(scene: Phaser.Scene, theme: Theme) {
  // One texture per prop, per variant, per animation frame — so a field of tall
  // grass isn't a stencil, and anything that moves has frames to move through.
  for (const def of Object.values(TILES)) {
    if (!def.iso.prop) continue;
    const module = PROPS[def.iso.prop];
    // 16 neighbourhoods for anything that cares what is beside it, 1 otherwise.
    const masks = module.neighbourAware ? 16 : 1;
    for (let v = 0; v < module.variants; v++) {
      for (let m = 0; m < masks; m++) {
        for (let f = 0; f < module.frames; f++) {
          const prop = buildIsoProp(def.iso, theme.swatches[def.swatch], v, f, m);
          if (!prop) continue;
          const key = propKey(def, v, f, m);
          if (scene.textures.exists(key)) scene.textures.remove(key);
          scene.textures.addCanvas(key, prop);
        }

        if (module.frames <= 1) continue;
        const anim = propAnimKey(def, v, m);
        if (scene.anims.exists(anim)) scene.anims.remove(anim);
        scene.anims.create({
          key: anim,
          frames: Array.from({ length: module.frames }, (_, f) => ({
            key: propKey(def, v, f, m),
          })),
          frameRate: module.frameRate ?? 8,
          repeat: -1,
        });
      }
    }
  }

  for (const [key, make] of [
    ['shadow_blob', buildShadowBlob],
    ['shadow_diamond', buildShadowDiamond],
  ] as const) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, make());
  }

  // Actors are loaded art, not generated, so they need animations only.
  for (const key of ACTOR_KEYS) buildActorAnims(scene, key);

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

  // Every tile gets ground, props included — they draw above the shadow layer
  // and would otherwise paint over the shadows cast across them.
  const stamps = new Map<string, HTMLCanvasElement[]>();
  for (const [ch, def] of Object.entries(TILES)) {
    stamps.set(
      ch,
      Array.from({ length: VARIANTS }, (_, v) => groundCanvas(theme, def, v)),
    );
  }

  // Back to front, so the tiny overlaps at diamond edges resolve correctly.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const variants = stamps.get(map.layout[y][x]);
      if (!variants) continue;
      const stamp = variants[variantAt(x, y)];
      const p = isoScreen(x, y, metrics);
      ctx.drawImage(stamp, p.x - stamp.width / 2, p.y + ISO_H / 2 - stamp.height);
    }
  }
  tex.refresh();
  return { key, metrics };
}
