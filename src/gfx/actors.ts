import { art, mirror, type Art } from './pixels';

/**
 * 16x16 character sprites. Down/up faces are symmetric so they're authored as
 * an 8px-wide left half and mirrored; side views are authored in full facing
 * right and flipped horizontally at runtime for the left direction.
 *
 * Walk cycles reuse the same 13-row top and only swap the bottom three rows,
 * which is exactly how the originals kept sprite data small.
 *
 * Indices follow the `player` / `npc` swatches in palette.ts, so every one of
 * the four does a job and the sprite reads on a colour theme and a mono one
 * alike:
 *
 *   0  skin, hands          1  trousers
 *   2  cap and shirt        3  outline, eyes, hair, brim, boots
 *
 * The cap is what makes the character legible from behind. Hair alone at index
 * 3 is the same value as the outline, so a back view drawn as bare hair is a
 * silhouette-shaped blob; a cap in the outfit colour with a hair fringe below
 * the brim gives the back of the head real internal shape. For the same reason
 * the back walk cycle leads with the opposite leg to the front one — which is
 * what you actually see when a body turns around.
 *
 * The crown gets a single row of outline, not two. A 2px-thick dark roof eats
 * enough of a 16px head that the cap below it reads as a headband instead.
 */

const WIDTH = 16;
const HEIGHT = 16;
const TOP_ROWS = 13;
const LEG_ROWS = HEIGHT - TOP_ROWS;

const FRONT_TOP = mirror(
  art(`
    ....3333
    ..332222
    .3222222
    .3222222
    .3333333
    .3300000
    .3303000
    .3303000
    .3300000
    ..333000
    .3322222
    .3222222
    .3022222
  `),
);

const BACK_TOP = mirror(
  art(`
    ....3333
    ..332222
    .3222222
    .3222222
    .3222222
    .3222222
    .3333333
    .3333333
    ..333333
    ..333333
    .3322222
    .3222222
    .3022222
  `),
);

const SIDE_TOP = art(`
  ...33333333.....
  ..3322222223....
  .32222222223....
  .32222222223....
  .3333333333333..
  .3330000003.....
  .3330003003.....
  .3330003003.....
  .3330000003.....
  ..330000003.....
  ..3222222223....
  ..3222222203....
  ..3222222203....
`);

const LEGS_FRONT_IDLE = art(`
  ...3111331113...
  ...3111331113...
  ...3333..3333...
`);

const LEGS_FRONT_A = art(`
  ...3111331113...
  ..31113..3113...
  ..3333....333...
`);

const LEGS_FRONT_B = art(`
  ...3111331113...
  ...3113..31113..
  ...333....3333..
`);

/** Seen from behind: heels instead of toecaps, and the step phase is reversed. */
const LEGS_BACK_IDLE = art(`
  ...3111331113...
  ...3111331113...
  ...3113..3113...
`);

const LEGS_BACK_A = art(`
  ...3111331113...
  ...3113..31113..
  ...313....3113..
`);

const LEGS_BACK_B = art(`
  ...3111331113...
  ..31113..3113...
  ..3113....313...
`);

const LEGS_SIDE_IDLE = art(`
  ..31111113......
  ..3113.313......
  ..3333.3333.....
`);

const LEGS_SIDE_A = art(`
  ..31111113......
  .3113..3113.....
  .333...3333.....
`);

const LEGS_SIDE_B = art(`
  ..31111113......
  ..3113..3113....
  ..3333..333.....
`);

/**
 * Authoring art as text is easy to get subtly wrong — a dropped character
 * yields a 15-wide sprite that is still perfectly rectangular, so the check in
 * `makeTexture` waves it through and the sprite silently sits off-centre.
 */
function checkSize(name: string, a: Art, rows: number) {
  if (a.length !== rows) {
    throw new Error(`Art "${name}" is ${a.length} rows, expected ${rows}`);
  }
  a.forEach((row, i) => {
    if (row.length !== WIDTH) {
      throw new Error(
        `Art "${name}" row ${i} is ${row.length} wide, expected ${WIDTH}`,
      );
    }
  });
}

const compose = (top: Art, legs: Art): Art => [...top, ...legs];

/** Sprite set for one character: 3 frames per direction (idle, stepA, stepB). */
export interface ActorArt {
  down: [Art, Art, Art];
  up: [Art, Art, Art];
  side: [Art, Art, Art];
}

function buildActor(front: Art, back: Art, side: Art): ActorArt {
  return {
    down: [
      compose(front, LEGS_FRONT_IDLE),
      compose(front, LEGS_FRONT_A),
      compose(front, LEGS_FRONT_B),
    ],
    up: [
      compose(back, LEGS_BACK_IDLE),
      compose(back, LEGS_BACK_A),
      compose(back, LEGS_BACK_B),
    ],
    side: [
      compose(side, LEGS_SIDE_IDLE),
      compose(side, LEGS_SIDE_A),
      compose(side, LEGS_SIDE_B),
    ],
  };
}

/**
 * Recolour a sprite's outfit shade. The colour theme already gives the NPC its
 * own swatch, but the mono themes hand every asset the same four greens — so
 * without this the NPC would be pixel-identical to the player on a DMG screen.
 */
function reshade(a: Art, from: string, to: string): Art {
  return a.map((row) => row.split(from).join(to));
}

checkSize('FRONT_TOP', FRONT_TOP, TOP_ROWS);
checkSize('BACK_TOP', BACK_TOP, TOP_ROWS);
checkSize('SIDE_TOP', SIDE_TOP, TOP_ROWS);
for (const [name, legs] of Object.entries({
  LEGS_FRONT_IDLE,
  LEGS_FRONT_A,
  LEGS_FRONT_B,
  LEGS_BACK_IDLE,
  LEGS_BACK_A,
  LEGS_BACK_B,
  LEGS_SIDE_IDLE,
  LEGS_SIDE_A,
  LEGS_SIDE_B,
})) {
  checkSize(name, legs, LEG_ROWS);
}

export const PLAYER_ART = buildActor(FRONT_TOP, BACK_TOP, SIDE_TOP);

export const NPC_ART = buildActor(
  reshade(FRONT_TOP, '2', '1'),
  reshade(BACK_TOP, '2', '1'),
  reshade(SIDE_TOP, '2', '1'),
);
