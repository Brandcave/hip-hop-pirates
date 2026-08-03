import { propCanvas, type PropModule } from '../props/kit';
import {
  HALF_H,
  HALF_W,
  ISO_H,
  dot,
  fillDiamond,
  rng,
  rowSpan,
  VARIANTS,
  type Swatch,
} from './kit';

/**
 * Water. A pond is many tiles of this butted together, so it has to read as one
 * continuous surface — the crests are what sell depth, and the tiling is what
 * usually ruins it.
 *
 * The surface is a wave field written in the *diamond's own axes* rather than in
 * screen rows, so the ripples lie on the ground plane instead of floating across
 * it as horizontal bars.
 *
 * Neighbouring tiles are offset by (+-32, +-16) px. In
 *
 *     p = (cx + 2cy) / 64      q = (cx - 2cy) / 64
 *
 * those offsets become exact +-1 steps of p or q, so a wave built from whole
 * multiples of p and q is continuous across every tile edge in the pond: a crest
 * runs on through a seam instead of stopping at it. The same coordinates put the
 * four rim edges at p = +-1/2 and q = +-1/2, and the ripple is phased so those
 * lines fall a quarter of a wavelength from both crest and trough — nothing can
 * ever settle along a rim and draw the outline that turns a pond into a tray of
 * blue tiles.
 *
 * Since the field is seamless it is the same in every variant. The variants
 * differ only in where the water goes slack: a couple of calm discs per variant,
 * kept clear of the rim by their own radius, damp the ripple locally. That
 * breaks up the one-tile rhythm of the wave without touching a single seam.
 */

const TAU = Math.PI * 2;

/** Ground-plane axes of the tile: both in -1/2 .. 1/2 inside the diamond. */
function axes(x: number, y: number) {
  const cx = x + 0.5 - HALF_W;
  const cy = y + 0.5 - HALF_H;
  return { p: (cx + 2 * cy) / 64, q: (cx - 2 * cy) / 64 };
}

/** Discs of slack water, in ground-plane coordinates so they stay circular. */
type Calm = { p: number; q: number; r: number };

/**
 * The still base of the water, baked into the map with the rest of the ground.
 * Everything that moves lives in `waterSurface` below.
 */
export function drawWaterBase(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  _variant: number,
  top = 0,
) {
  fillDiamond(ctx, top, pal[2]);
}

export function drawWater(
  ctx: CanvasRenderingContext2D,
  pal: Swatch,
  variant: number,
  top = 0,
  skipBase = false,
) {
  // Identical under every variant — the colour of the pond must not band.
  if (!skipBase) fillDiamond(ctx, top, pal[2]);

  const pick = rng(variant * 977 + 41);
  const spots: Calm[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 0.13 + pick() * 0.1;
    spots.push({
      p: (pick() * 2 - 1) * (0.5 - r),
      q: (pick() * 2 - 1) * (0.5 - r),
      r,
    });
  }

  // Per-pixel jitter, so the crest edges break into pixels rather than reading
  // as smooth vector bands.
  const grain = rng(0x5ea0d);

  for (let y = 0; y < ISO_H; y++) {
    const { x: from, w } = rowSpan(y);
    for (let x = from; x < from + w; x++) {
      const { p: pn, q: qn } = axes(x, y);
      const p = TAU * pn;
      const q = TAU * qn;

      // How far across a ripple we are: 0 on a crest line, +-1/2 in a trough.
      // The quarter turn keeps the rim (q = +-1/2) at 1/4, i.e. plain water.
      const phi =
        2 * qn +
        0.25 +
        0.07 * Math.sin(p) +
        0.03 * Math.sin(2 * p - q) +
        0.018 * Math.sin(3 * p + q) +
        // Terms in q alone stretch and squeeze the spacing between ripples, so
        // the crests do not come out as an evenly spaced comb.
        0.1 * Math.sin(q) +
        0.05 * Math.sin(2 * q + p);
      const t = phi - Math.round(phi) + (grain() - 0.5) * 0.008;
      const across = Math.abs(t);

      // Slack water: the ripple simply fades out inside a calm disc.
      let calm = 0;
      for (const s of spots) {
        const d = Math.hypot(pn - s.p, qn - s.q) / s.r;
        if (d < 1) calm = Math.max(calm, 1 - d * d);
      }
      const life = 1 - 0.9 * calm;

      // Two slow swells running along the crests. They open and close the
      // crest and the shadow independently, so both come out as strokes of
      // varying length that taper off rather than as an endless corrugation.
      const lit =
        (0.5 * Math.sin(p - q) + 0.32 * Math.sin(2 * p + q) + 0.2 * Math.sin(3 * p - 2 * q)) /
        1.02;
      const deep =
        (0.5 * Math.sin(2 * p - q) + 0.34 * Math.sin(p + 2 * q) + 0.2 * Math.sin(3 * q - p)) /
        1.04;

      const crest = (0.030 + 0.040 * lit) * life;
      // The shadow only opens on the stretches where the swell is strongest, so
      // it comes out as a few short strokes under the crests rather than grit.
      const shadow = (deep - 0.32) * 0.075 * life;

      if (across < crest) {
        dot(ctx, x, y, lit > 0.62 && across < crest * 0.45 ? pal[0] : pal[1], top);
      } else if (0.5 - across < shadow) {
        dot(ctx, x, y, pal[3], top);
      }
    }
  }
}

/**
 * The moving surface: crests and troughs only, over a transparent base, so it
 * can be drawn as a sprite above the baked water and animated.
 *
 * `frames` is 1 today — a still surface. Raising it is how the water starts to
 * move: frame `frames - 1` must lead back into frame 0 without a jump.
 */
export const waterSurface: PropModule = {
  frames: 1,
  variants: VARIANTS,
  frameRate: 6,
  build(pal: Swatch, variant: number, _frame: number) {
    const { el, ctx } = propCanvas(0);
    drawWater(ctx, pal, variant, 0, true);
    return el;
  },
};
