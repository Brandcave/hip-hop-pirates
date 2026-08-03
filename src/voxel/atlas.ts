import * as THREE from 'three';
import { buildIsoGround, TERRAIN, type TerrainName } from '../gfx/iso';
import type { Theme } from '../gfx/palette';
import { HALF_H, HALF_W, ISO_H, ISO_W, VARIANTS } from '../gfx/tiles/kit';

/**
 * Turning the isometric tile art into voxel face textures.
 *
 * The 2D art is drawn as a 2:1 diamond — which IS a square top face, already
 * seen at the projection's angle. So the textures for the 3D world are not
 * re-authored, they are UN-projected: for each texel of a square face, work out
 * where that point lands inside the diamond and sample it there.
 *
 * That inverse is exact, and it recovers more than it costs. The road and water
 * patterns were authored as functions of the ground-plane lattice specifically
 * so they would run continuously across tile edges; un-projecting returns them
 * to those coordinates, so the continuity that made a pond read as one surface
 * in 2D survives into 3D for free.
 */

/** Texels along one edge of a face. The diamond holds ~2048px, so 32 is honest. */
const FACE = 32;

/**
 * Sample the diamond at the point corresponding to square face coordinate
 * (a, b), where a runs along grid +x and b along grid +y.
 */
function unproject(source: ImageData, a: number, b: number) {
  const sx = Math.round((a - b) * HALF_W + HALF_W);
  const sy = Math.round((a + b) * HALF_H);
  const x = Math.min(ISO_W - 1, Math.max(0, sx));
  const y = Math.min(ISO_H - 1, Math.max(0, sy));
  const i = (y * ISO_W + x) * 4;
  return [source.data[i], source.data[i + 1], source.data[i + 2], source.data[i + 3]];
}

function toSquare(diamond: HTMLCanvasElement): HTMLCanvasElement {
  const src = diamond.getContext('2d')!.getImageData(0, 0, ISO_W, ISO_H);
  const out = document.createElement('canvas');
  out.width = FACE;
  out.height = FACE;
  const ctx = out.getContext('2d')!;
  const image = ctx.createImageData(FACE, FACE);
  for (let v = 0; v < FACE; v++) {
    for (let u = 0; u < FACE; u++) {
      // +0.5 samples texel centres, which keeps the pattern off the seam.
      const [r, g, b, alpha] = unproject(src, (u + 0.5) / FACE, (v + 0.5) / FACE);
      const i = (v * FACE + u) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = alpha;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/**
 * One texture array's worth of terrain faces, laid out as a vertical strip:
 * every terrain, every variant. A voxel's UVs select a row.
 */
export interface FaceAtlas {
  texture: THREE.Texture;
  rows: number;
  /** Row index for a terrain's variant, for UV lookup. */
  row(terrain: TerrainName, variant: number): number;
}

export function buildFaceAtlas(theme: Theme): FaceAtlas {
  const terrains = Object.keys(TERRAIN) as TerrainName[];
  const rows = terrains.length * VARIANTS;

  const sheet = document.createElement('canvas');
  sheet.width = FACE;
  sheet.height = FACE * rows;
  const ctx = sheet.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  terrains.forEach((terrain, t) => {
    const pal = theme.swatches[TERRAIN[terrain].swatch as keyof typeof theme.swatches];
    for (let v = 0; v < VARIANTS; v++) {
      const face = toSquare(buildIsoGround(terrain, pal, v));
      ctx.drawImage(face, 0, (t * VARIANTS + v) * FACE);
    }
  });

  const texture = new THREE.CanvasTexture(sheet);
  // WebGL's v axis runs up from the bottom and three flips canvases to match,
  // which would silently invert the strip: row 0 (grass) would be sampled from
  // the last row (sand). Keep the canvas order the mesher indexes against.
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    rows,
    row: (terrain, variant) =>
      terrains.indexOf(terrain) * VARIANTS + (variant % VARIANTS),
  };
}

export const FACE_SIZE = FACE;
