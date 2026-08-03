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
 *
 * MOTION. The whole field is a function of the lattice coordinates (p, q), so it
 * is animated by sliding the coordinates rather than by redrawing anything:
 * frame f evaluates the field at p - f/frames. Two things fall out of that for
 * free. Every sine in the field is a whole multiple of TAU*p, so one whole unit
 * of p is one whole period of every term at once — after `frames` steps the
 * field is bit-identical to frame 0 and the loop closes by construction, not by
 * tuning. And because the shift is applied to the GLOBAL coordinate, every tile
 * in the pond shifts by the same amount, so a crest still runs on through a seam
 * in every frame, not just in frame 0.
 *
 * The drift is along +p and not along +q, and that is a deliberate constraint,
 * not an accident. The crest lines are lines of constant q, which is also the
 * direction of two of the four rim edges; the static field is phased so those
 * edges sit a quarter wavelength from any crest. Drifting along q would slide
 * the rim through that phase and, part way round the cycle, lay a crest along
 * every tile edge in the pond at once — the exact outline the whole design
 * exists to avoid. Drifting along p moves the field ALONG the crest
 * lines, which leaves the rim phase untouched in every frame. What travels is
 * everything the crest is made of: the swell that breaks it into strokes, and
 * the wobble that bends it. Crests visibly stream, and the rim never sees it.
 *
 * On screen one unit of +p is (+32, +16): rightwards and towards the viewer. The
 * wind blows towards the east and a little to the north (gfx/wind.ts), which on
 * screen is rightwards and slightly towards the viewer as well — the same
 * quarter of the screen, so the water and the grass move the same way.
 */

const TAU = Math.PI * 2;

/**
 * Frames in the surface loop, and how far the field slides over that loop.
 *
 * DRIFT must stay a whole number: it is the shift in p across the entire cycle,
 * and only a whole unit of p returns every sine in the field to where it began.
 * One unit per cycle is the smallest honest drift, and at six frames it is a
 * six-pixel step between frames — enough to read as a slide, small enough that
 * it does not strobe.
 */
const FRAMES = 6;
const DRIFT = 1;

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
  /** How far round the loop, 0..1. Slides the wave field along +p. */
  phase = 0,
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
  // as smooth vector bands. Seeded once per frame, so the same pixel gets the
  // same jitter in every frame: the dither sits still while the wave moves
  // through it, which is what keeps the grain from boiling.
  const grain = rng(0x5ea0d);

  // The field is read one drift further along p each frame. The calm discs are
  // NOT shifted — they are where this tile's water is slack, and slack water
  // stays where it is while the swell passes through it.
  const drift = phase * DRIFT;

  for (let y = 0; y < ISO_H; y++) {
    const { x: from, w } = rowSpan(y);
    for (let x = from; x < from + w; x++) {
      const { p: pn, q: qn } = axes(x, y);
      const p = TAU * (pn - drift);
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
 * Frame f reads the field a fraction f/FRAMES of a drift further along p, so the
 * ripples slide; frame FRAMES-1 is one step short of a whole unit of p, and the
 * next step lands exactly on frame 0 again.
 */
export const waterSurface: PropModule = {
  frames: FRAMES,
  variants: VARIANTS,
  // Slow. Water at 64px a tile is crests sliding, not a texture flickering.
  frameRate: 5,
  build(pal: Swatch, variant: number, frame: number) {
    const { el, ctx } = propCanvas(0);
    drawWater(ctx, pal, variant, 0, true, frame / FRAMES);
    return el;
  },
};
