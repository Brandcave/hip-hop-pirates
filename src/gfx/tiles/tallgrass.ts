import {
  fillDiamond,
  HALF_H,
  HALF_W,
  ISO_H,
  ISO_W,
  insideDiamond,
  rng,
  span,
  dot,
  type Swatch,
} from './kit';

/**
 * Tall grass: the encounter tile, so legibility beats prettiness. A player has
 * to know at a glance which side of the boundary they are standing on.
 *
 * It comes in two parts — the field it sits on (baked into the map) and the
 * blades that stand proud of it (a sprite, so shadows and actors sort against
 * it correctly).
 *
 * The whole tile is built from the same list of clumps: the ground puts a dark
 * pocket under each one, the sprite grows a tuft out of it. Clumps rather than
 * scattered singles are what make the field read as a mass you could lose a
 * creature in, and what gives the top edge a ragged silhouette against the
 * short grass next door.
 */

/** How far the blades rise above the tile. */
export const BLADE_HEIGHT = 13;

/** Clumps per tile axis, in tile (u,v) space so they land evenly on the diamond. */
const GRID = 4;

interface Clump {
  x: number;
  y: number;
}

/**
 * Tuft positions for a variant, in diamond pixel space. Laid out on a jittered
 * lattice in tile space so the spread stays even — a purely random scatter
 * clumps and gaps in the wrong places, and the gaps read as bald patches once
 * the tile repeats.
 */
function clumps(variant: number): Clump[] {
  const random = rng(4000 + variant);
  const out: Clump[] = [];
  for (let gv = 0; gv < GRID; gv++) {
    for (let gu = 0; gu < GRID; gu++) {
      const u = (gu + 0.1 + 0.8 * random()) / GRID;
      const v = (gv + 0.1 + 0.8 * random()) / GRID;
      out.push({
        x: HALF_W + (u - v) * HALF_W,
        y: (u + v) * HALF_H,
      });
    }
  }
  return out;
}

export function drawTallGrassGround(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
) {
  // Base is the same in every variant; only the detail above it changes. It is
  // the dark end of the ramp on purpose: the floor of a stand of grass is in
  // shadow, and that shadow is what tells a player the tile is tall grass even
  // where an actor is covering the blades.
  fillDiamond(ctx, top, pal[2]);

  const random = rng(3000 + variant);

  // Litter of half-lit stems lying in the mat. Short dashes rather than single
  // pixels, so at play size it reads as matted growth and not as dither noise.
  for (let y = 0; y < ISO_H; y++) {
    for (let x = -2; x < ISO_W; x += 4) {
      const r = random();
      if (r > 0.3) continue;
      const w = 2 + Math.floor(random() * 2);
      span(ctx, y, x + Math.floor(random() * 3), w, r < 0.12 ? pal[1] : pal[3], top);
    }
  }

  // A dark pocket under each tuft: the ground the blades grow out of. These are
  // what give the field its clumped rhythm even where a blade sprite is hidden
  // behind an actor.
  for (const c of clumps(variant)) {
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    span(ctx, cy, cx - 3, 7, pal[3], top);
    span(ctx, cy + 1, cx - 2, 5, pal[3], top);
    dot(ctx, cx - 4, cy, pal[3], top);
  }
}

interface Blade {
  x: number;
  y: number;
  h: number;
  lean: number;
  /** How far up the blade the shadow column runs, 0..1. */
  shade: number;
  tip: string | null;
}

/** Drawn into a canvas of ISO_H + BLADE_HEIGHT, blades above, tile below. */
export function drawTallGrassBlades(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
) {
  const random = rng(7000 + variant);
  const list: Blade[] = [];

  for (const c of clumps(variant)) {
    const n = 5 + Math.floor(random() * 3);
    // Tufts are not all the same size; the short ones are what stop the top
    // edge turning into an even fringe.
    const scale = 0.5 + random() * 0.8;
    const depth = c.y / (ISO_H - 1);
    // Tone is decided per tuft, not per blade. Per blade it dithers the greens
    // together and the mass turns to static; per tuft it stays a stack of
    // readable shapes — far ones sunk in shadow, near ones catching the light.
    const near = depth > 0.35 && random() < 0.8;
    const lit = near && random() < 0.7;
    const spark = depth > 0.55 && random() < 0.4;
    for (let i = 0; i < n; i++) {
      const bx = Math.round(c.x + random() * 9 - 4.5);
      const by = Math.round(c.y + random() * 4 - 2);
      if (!insideDiamond(bx, by)) continue;
      // Front blades stand taller, which is most of the sense of depth.
      const h = Math.max(3, Math.round((5 + depth * 5 + random() * 3) * scale));
      const fan = i / Math.max(1, n - 1) - 0.5;
      list.push({
        // Two pixels of margin: a blade sliced by the canvas edge reads as a seam.
        x: Math.max(1, Math.min(ISO_W - 3, bx)),
        y: by,
        h: Math.min(h, BLADE_HEIGHT + by),
        lean: fan * (3 + random() * 3),
        // Far tufts carry their shadow most of the way up, which is what sinks
        // them behind the near ones.
        shade: near ? 0.45 : 0.8,
        // Light only catches the near tufts, and only their longer blades.
        tip: lit && h > 5 && (spark || i === 0) ? pal[0] : null,
      });
    }
  }

  // Back to front, so near tufts overlap far ones.
  list.sort((a, b) => a.y - b.y);

  for (const b of list) {
    const bottom = BLADE_HEIGHT + b.y;
    let tx = b.x;
    let ty = bottom;
    for (let i = 0; i < b.h; i++) {
      const t = i / Math.max(1, b.h - 1);
      // A blade that leans past the canvas edge would be sliced by the
      // neighbouring tile, which reads as a seam; bending it back costs a pixel
      // of curve and costs nothing to look at.
      const px = Math.max(0, Math.min(ISO_W - 2, b.x + Math.round(b.lean * t * t)));
      const py = bottom - i;
      if (py < 0) break;
      ctx.fillStyle = pal[1];
      ctx.fillRect(px, py, 1, 1);
      if (t < b.shade) {
        // Thicker at the base, shaded, so a tuft has some volume.
        ctx.fillStyle = pal[3];
        ctx.fillRect(px + 1, py, 1, 1);
      }
      tx = px;
      ty = py;
    }
    if (b.tip) {
      ctx.fillStyle = b.tip;
      ctx.fillRect(tx, ty, 1, 1);
    }
  }
}
