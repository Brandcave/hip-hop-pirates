import type { WorldTime } from '../engine/time';
import { ISO_H, ISO_W } from './iso';

/**
 * The lighting model, and its opinion.
 *
 * THE CAMERA FACES SOUTH. That single decision is what makes the rest work: the
 * sun crosses the southern sky, which is the half we are looking into, so every
 * shadow it throws comes back *towards* the viewer and lands in open ground
 * where it can be read. A camera facing north would be equally physical and
 * would hide every morning shadow behind the object that cast it.
 *
 * With that fixed, the compass falls out of the projection: east is screen
 * right, west is screen left, and north — straight towards the viewer — is
 * screen down, foreshortened 2:1 like everything else on the ground plane.
 *
 * There is ONE key light and it is never straight overhead. The sun rises due
 * east at 06:00, stands due south and high at 13:00, and sets due west at 20:00.
 * Shadows point directly away from it, so across a day they sweep from pointing
 * screen-left, through screen-down at noon, to screen-right at dusk. You can
 * tell the hour from a tree.
 *
 * Two more choices worth stating plainly:
 *
 * 1. Nothing is ever backlit into silhouette during the day. The sun stays in
 *    front of the camera, so the faces we can see are the lit ones.
 * 2. Shadow length is driven by sun elevation alone — raking and long at the
 *    edges of the day, a tight pool at midday. Length is the clock, so it is
 *    allowed to get dramatic: up to four times an object's own height.
 *
 * At night the moon rises where the sun set, low in the west, and throws a
 * weak, cold, short shadow back to the east. It is deliberately not a dim sun:
 * it comes from the opposite side of the sky, so at dusk the whole scene flips
 * the direction it reads in.
 */

/** Sun above the horizon between these hours; the rest is moonlight. */
const SUNRISE = 6;
const SUNSET = 20;

/**
 * Shadow length as a multiple of object height, at the sun's highest.
 *
 * Kept deliberately short. A physically long dawn shadow detaches from its
 * object at this sprite scale and starts reading as a second object lying on
 * the grass — the tell is that you stop seeing "tree" and start seeing "tree,
 * and a stain". The hour still shows in the length, just within a range that
 * keeps the shadow tucked under the thing casting it.
 */
const MIN_LENGTH = 0.22;
/** ...and the cap when it rakes along the ground at dawn and dusk. */
const MAX_LENGTH = 1.15;

export interface Light {
  /** Unit-ish screen vector the shadows point along. */
  shadow: { x: number; y: number };
  /** Multiply against an object's height to get shadow length in pixels. */
  length: number;
  alpha: number;
  /** Multiply-blend colour grading the whole scene. */
  tint: number;
  isNight: boolean;
  source: 'sun' | 'moon';
}

/**
 * Compass direction on the ground, in screen pixels per unit of shadow length.
 *
 * With the camera facing south, east lies along screen x and north along screen
 * y. It is deliberately NOT normalised: a shadow reaching north is squashed to
 * half the screen length of one reaching east, which is the same 2:1 the ground
 * plane gets. Without that, shadows swing round the compass at a constant screen
 * length and immediately read as painted on glass rather than lying on grass.
 */
function toScreenDir(east: number, north: number) {
  return { x: east, y: north * (ISO_H / ISO_W) };
}

/** Colour grade keyframes, in hours. White means "leave it alone". */
const GRADE: [number, number][] = [
  [0, 0x2f3d72],
  [4.5, 0x33427a],
  [5.5, 0x6a5a86],
  [6.5, 0xc08774],
  [7.5, 0xf0cba6],
  [9, 0xffffff],
  [16, 0xffffff],
  [17.5, 0xffce93],
  [19, 0xe89a6a],
  [20, 0xa8737e],
  [21, 0x4c5288],
  [22, 0x2f3d72],
  [24, 0x2f3d72],
];

function lerpColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    ((ar + (br - ar) * t) << 16) |
    ((ag + (bg - ag) * t) << 8) |
    (ab + (bb - ab) * t)
  );
}

function grade(hour: number) {
  for (let i = 1; i < GRADE.length; i++) {
    const [h1, c1] = GRADE[i];
    if (hour > h1) continue;
    const [h0, c0] = GRADE[i - 1];
    return lerpColor(c0, c1, (hour - h0) / (h1 - h0));
  }
  return GRADE[GRADE.length - 1][1];
}

export function lightFor(time: WorldTime): Light {
  const hour = time.minutes / 60;
  const tint = grade(hour);
  const isNight = hour < SUNRISE || hour >= SUNSET;

  if (isNight) {
    // The moon rises where the sun set — low in the west — so its shadow reaches
    // east and slightly toward the viewer. Cold, short, and barely there.
    return {
      shadow: toScreenDir(1, 0.35),
      length: 0.5,
      alpha: 0.12,
      tint,
      isNight,
      source: 'moon',
    };
  }

  // 0 at sunrise, 1 at sunset.
  const day = (hour - SUNRISE) / (SUNSET - SUNRISE);
  // The sun runs east -> south -> west, so the shadow runs west -> north -> east.
  const azimuth = Math.PI * day;
  const east = -Math.cos(azimuth);
  const north = Math.sin(azimuth);
  // Elevation peaks at solar noon; the floor keeps dawn shadows finite.
  const elevation = Math.max(0.12, Math.sin(Math.PI * day));

  return {
    shadow: toScreenDir(east, north),
    length: Math.min(MAX_LENGTH, MIN_LENGTH / elevation),
    // Hard and dark at midday, weak and diffuse when the sun is low.
    alpha: 0.12 + 0.26 * elevation,
    tint,
    isNight,
    source: 'sun',
  };
}
