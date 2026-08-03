import { propCanvas, type PropModule } from '../props/kit';
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
  VARIANTS,
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
  /** Tip displacement, in pixels, at the top of a gust. */
  sway: number;
  /** Where in the shared cycle this blade sits, 0..1. */
  phase: number;
}

/**
 * The gust, as a 0..1 curve over one cycle. 0 is rest, 1 is fully bent
 * downwind.
 *
 * It is a cosine with its time axis warped: the first third of the cycle
 * carries the whole push, the remaining two thirds the release. Wind shoves and
 * then lets go, and a blade returns on its own stiffness, which is slower. A
 * plain sine gives you a metronome — the eye reads the even beat immediately
 * and stops believing it is weather.
 *
 * The warp keeps the ends flat (the derivative is zero at 0, at the peak and at
 * 1), so the cycle closes on itself without a kink: frame frames-1 leads back
 * into frame 0 with no snap.
 */
const ATTACK = 0.32;

function gust(p: number) {
  const q = ((p % 1) + 1) % 1;
  const u = q < ATTACK ? (q / ATTACK) * 0.5 : 0.5 + ((q - ATTACK) / (1 - ATTACK)) * 0.5;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
}

/**
 * Drawn into a canvas of ISO_H + BLADE_HEIGHT, blades above, tile below.
 *
 * `phase` is where this frame sits in the shared wind cycle, 0..1. The map
 * offsets it per tile (gfx/wind.ts) so a gust crosses the field; here it only
 * has to be periodic.
 */
export function drawTallGrassBlades(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  phase = 0,
) {
  const random = rng(7000 + variant);
  // A second stream, so adding motion did not reshuffle the static scatter.
  const breeze = rng(9100 + variant);
  const list: Blade[] = [];

  for (const c of clumps(variant)) {
    // A tuft mostly moves as one thing — it is rooted in one pocket of ground
    // and its blades tangle together. The spread within a tuft is small on
    // purpose: give every blade its own phase and the mass dissolves into
    // static, which is the other way to lose the shape of grass.
    const tuftPhase = (breeze() - 0.5) * 0.14;
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
      const x = Math.max(1, Math.min(ISO_W - 3, bx));
      const lean = fan * (3 + random() * 3);
      // Taller blades have more lever, so they travel further at the tip.
      const want = (1.1 + (h / BLADE_HEIGHT) * 2.0) * (0.75 + breeze() * 0.5);
      list.push({
        // Two pixels of margin: a blade sliced by the canvas edge reads as a seam.
        x,
        y: by,
        h: Math.min(h, BLADE_HEIGHT + by),
        lean,
        // Never enough to reach the canvas edge: a blade that bends into the
        // clamp stops dead at the top of every gust, and a blade that stops
        // while its neighbours keep going is the thing the eye catches.
        // The -4 leaves room for the shaded column the blade carries on its
        // right: without it a tuft on the eastern edge grows a hard vertical
        // line along the tile seam at the top of every gust.
        sway: Math.max(0, Math.min(want, ISO_W - 4 - x - Math.max(0, lean))),
        phase: tuftPhase + (breeze() - 0.5) * 0.06,
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
    const bend = b.sway * gust(phase + b.phase);
    let tx = b.x;
    let ty = bottom;
    for (let i = 0; i < b.h; i++) {
      const t = i / Math.max(1, b.h - 1);
      // Both curves put nearly all the displacement at the tip and none at the
      // root — that is the difference between a blade bending and a blade
      // sliding across the ground. The bend is the shallower of the two: on
      // t*t only the top pixel or two ever move a whole pixel, and a stand
      // whose mass never budges reads as a shimmer along the fringe rather
      // than as grass being pushed over.
      const curve = t * t;
      const bendCurve = t * (0.3 + 0.7 * t);
      // A blade that leans past the canvas edge would be sliced by the
      // neighbouring tile, which reads as a seam; bending it back costs a pixel
      // of curve and costs nothing to look at.
      const px = Math.max(
        0,
        Math.min(ISO_W - 2, b.x + Math.round(b.lean * curve + bend * bendCurve)),
      );
      // A blade laid over by the wind is shorter on screen than one standing
      // up. Without this the tip swings on an arc it never leaves, and the
      // stand reads as a shimmer rather than as grass being pushed over.
      const py = bottom - i + Math.round(bend * curve * 0.3);
      if (py < 0) break;
      if (py > bottom) break;
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

/**
 * The blades, as a depth-sorted sprite standing above the tile.
 *
 * Six frames at 6fps: a one-second gust. Fewer and the push in the first third
 * of the cycle has too few samples to read as a push; more and you are paying
 * for textures the eye cannot resolve at this size, where the whole motion is
 * two or three pixels wide.
 *
 * Frame 0 is rest, and the cycle returns to it — the gust curve is flat at both
 * ends, so frames-1 leads back into 0 without a snap. The whole field shares
 * this cycle with a per-tile phase offset (see gfx/wind.ts), so what you see is
 * a gust crossing the meadow rather than every tile bending at once.
 */
export const tallGrassBlades: PropModule = {
  frames: 6,
  variants: VARIANTS,
  frameRate: 6,
  build(pal: Swatch, variant: number, frame: number) {
    const { el, ctx } = propCanvas(BLADE_HEIGHT);
    drawTallGrassBlades(ctx, pal, variant, frame / tallGrassBlades.frames);
    return el;
  },
};
