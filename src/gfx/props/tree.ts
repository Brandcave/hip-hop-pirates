import { ISO_W, propCanvas, rng, type PropModule, type Swatch } from './kit';

/**
 * A tree.
 *
 * Trees are the map's border: they stand shoulder to shoulder in long diagonal
 * lines, so what is actually on screen is a *row* of them. That decides almost
 * every choice in here.
 *
 * 1. *The canopy is a pile of clumps, not an ellipse.* Each clump is shaded on
 *    its own — light from above and slightly to the left, matching the lit face
 *    of the buildings — and where two clumps overlap the brighter one wins. The
 *    dark underside of an upper clump then lands on the lit top of the one below
 *    it, which is what draws the creases that make a canopy read as mass rather
 *    than as a sticker. A single ellipse cannot produce those creases at all.
 * 2. *The silhouette is ragged.* The clump edge test is jittered by a fraction of
 *    a radius, so the outline breaks into leaves. In a row, the outline is nearly
 *    all you see of the tree behind, and a clean curve there reads as a stamp.
 * 3. *Every tree overlaps its neighbours, so shape has to differ where it shows.*
 *    The variants differ in overall height, crown width and lean — the three
 *    things still visible when two thirds of the tree is hidden. Rearranging
 *    leaf noise between variants would be invisible in exactly this situation.
 *
 * Colour: pal[0] is bark, pal[2] and pal[3] the foliage. pal[1] is the grass
 * green the tree stands on; it is used *only* as a sunlit cap on the clumps that
 * face the sky, where it is ringed by pal[2] and reads as light rather than as a
 * hole punched through to the ground.
 */

const HALF = ISO_W / 2;

/** How far the canopy hangs down over the bark. A canopy that merely touches the
 *  trunk floats above it. */
const OVERLAP = 6;
/** Breathing room above the highest leaf. */
const PAD = 3;

interface Recipe {
  /** Bark visible below the foliage. */
  trunkH: number;
  /** Half-extents of the crown mass, before the clumps bulge out of it. */
  crownW: number;
  crownH: number;
  /** Sideways drift per pixel of height. Positive leans right. */
  lean: number;
  /** Clumps ringed around the core. */
  clumps: number;
  /** A second, smaller mass riding above the first — a two-tier crown. */
  tier: boolean;
}

/**
 * Four trees. Height and width move together with the trunk: the tall one is
 * narrow and shows a lot of bark, the squat one is broad and shows almost none,
 * so a row alternates between spire and dome instead of between two near-copies.
 */
const RECIPES: Recipe[] = [
  { trunkH: 15, crownW: 23, crownH: 19, lean: 0.05, clumps: 6, tier: false },
  { trunkH: 21, crownW: 19, crownH: 22, lean: -0.09, clumps: 7, tier: true },
  { trunkH: 11, crownW: 24, crownH: 17, lean: 0.02, clumps: 7, tier: false },
  { trunkH: 17, crownW: 21, crownH: 20, lean: 0.11, clumps: 6, tier: true },
];

function canopyTop(r: Recipe) {
  return r.trunkH + 2 * r.crownH - OVERLAP + PAD;
}

interface Clump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Does this clump face the sky? Only those take a sunlit cap. */
  lit: boolean;
}

/** Light direction in screen space: from above, a little from the left. */
const LX = 0.38;
const LY = 0.92;
/** Shade thresholds on the lighting term. */
const SUNLIT = 0.52;
const MID = -0.22;

export const tree: PropModule = {
  frames: 1,
  variants: RECIPES.length,
  build(pal: Swatch, variant: number) {
    const r = RECIPES[variant % RECIPES.length];
    const { el, ctx, groundY } = propCanvas(canopyTop(r));

    const centreAt = (y: number) => HALF + r.lean * (groundY - y);

    // --- the trunk -----------------------------------------------------------
    // Drawn first, so the foliage settles over its top few rows.
    const trunkTop = groundY - r.trunkH;
    const baseHW = 1.8 + r.crownW * 0.085;
    const bark = rng(0x1f0b + variant * 4211);
    // The roots. Asymmetric, and read off before the trunk rows so each row can
    // simply include them in its own fill — a root drawn as a separate spur
    // beside the trunk comes out as loose pixels rather than as part of the tree.
    const root = [0.4 + bark() * 1.3, 0.4 + bark() * 1.3];

    // Contact shade at the foot. The map casts a real shadow under the tree, but
    // the pixels where bark meets grass need to be dark or the trunk reads as
    // standing a little above the ground rather than in it.
    ctx.fillStyle = pal[3];
    for (let dy = 0; dy <= 2; dy++) {
      const w = Math.round(baseHW + 3 - dy * 1.6);
      const cx = centreAt(groundY + dy);
      ctx.fillRect(Math.round(cx - w), groundY + dy, w * 2, 1);
    }

    for (let y = groundY + 1; y >= trunkTop - 3; y--) {
      const up = Math.max(0, groundY - y);
      // The flare lives in the bottom few pixels only. Spread over the whole
      // trunk it reads as a cone; kept to the foot it reads as a tree standing
      // in the ground rather than a dowel pushed into it.
      const foot = Math.max(0, 1 - up / 6) ** 2.2;
      const stem = 2.1 - 0.5 * (up / r.trunkH);
      const cx = centreAt(y);
      const from = Math.round(cx - stem - (baseHW - stem + root[0]) * foot);
      const to = Math.round(cx + stem + (baseHW - stem + root[1]) * foot);
      ctx.fillStyle = pal[0];
      ctx.fillRect(from, y, to - from, 1);
      // The right side is away from the light.
      const shade = Math.max(1, Math.round((to - from) * 0.32));
      ctx.fillStyle = pal[3];
      ctx.fillRect(to - shade, y, shade, 1);
      // Bark grain: the odd notch on the lit side, so the trunk is not two bars.
      if (bark() < 0.24 && to - from > 3) ctx.fillRect(from, y, 1, 1);
    }

    // --- the canopy ----------------------------------------------------------
    const shape = rng(0x9c41 + variant * 6353);
    const crownCy = trunkTop + OVERLAP - r.crownH;
    const crownCx = centreAt(crownCy);

    const clumps: Clump[] = [
      // The core the rest is piled onto, sat slightly low so the mass is heavy
      // at the shoulders and light at the top.
      {
        x: crownCx,
        y: crownCy + r.crownH * 0.12,
        rx: r.crownW * 0.74,
        ry: r.crownH * 0.74,
        lit: false,
      },
    ];
    for (let i = 0; i < r.clumps; i++) {
      const a = -Math.PI / 2 + (i + shape() * 0.55) * ((Math.PI * 2) / r.clumps);
      const reach = 0.42 + shape() * 0.17;
      const s = 0.30 + shape() * 0.13;
      const dx = Math.cos(a) * r.crownW * reach;
      const dy = Math.sin(a) * r.crownH * reach;
      clumps.push({
        x: crownCx + dx,
        y: crownCy + dy,
        rx: r.crownW * s,
        ry: r.crownH * (s + 0.05),
        lit: dy < -r.crownH * 0.10,
      });
    }
    if (r.tier) {
      // A smaller head above the main mass: the tall variants get a stepped
      // outline instead of one long dome.
      clumps.push({
        x: crownCx + (shape() - 0.5) * r.crownW * 0.3,
        y: crownCy - r.crownH * 0.72,
        rx: r.crownW * 0.46,
        ry: r.crownH * 0.42,
        lit: true,
      });
    }

    const reachX = r.crownW * 1.3;
    const reachY = r.crownH * 1.35;
    const x0 = Math.max(0, Math.floor(crownCx - reachX));
    const x1 = Math.min(ISO_W, Math.ceil(crownCx + reachX));
    const y0 = Math.max(0, Math.floor(crownCy - reachY));
    const y1 = Math.min(el.height, Math.ceil(crownCy + reachY));

    // One noise stream, walked in a fixed order, so the leaf edge is identical
    // every build.
    const grain = rng(0x5d17 + variant * 8837);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const n = grain();
        let best = -9;
        for (const c of clumps) {
          const u = (px + 0.5 - c.x) / c.rx;
          const v = (py + 0.5 - c.y) / c.ry;
          const d2 = u * u + v * v;
          // The jittered radius is what turns each clump's rim into leaves.
          if (d2 > 0.86 + 0.26 * n) continue;
          // Facing the light, less a falloff towards the clump's own rim: the
          // falloff is what darkens the seam where two clumps meet.
          let f = -(LX * u + LY * v) - 0.38 * d2;
          if (!c.lit) f = Math.min(f, SUNLIT - 0.06);
          if (f > best) best = f;
        }
        if (best < -8) continue;
        const f = best + (n - 0.5) * 0.11;
        // The extra case is leaf texture: the odd leaf on a well-lit shoulder
        // catching the sun. Only the light tone gets scattered like this — a
        // loose dark pixel in a canopy reads as a hole, not as a leaf.
        const lit = f > SUNLIT || (f > 0.3 && n < 0.03);
        ctx.fillStyle = lit ? pal[1] : f > MID ? pal[2] : pal[3];
        ctx.fillRect(px, py, 1, 1);
      }
    }

    return el;
  },
};

/** Tallest of the variants — what the tree needs clearance for. */
export const TREE_HEIGHT = Math.max(...RECIPES.map(canopyTop));
