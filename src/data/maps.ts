import { TILES } from '../gfx/tiles';

export type ObjectKind = 'sign' | 'npc' | 'door';

export interface MapObject {
  x: number;
  y: number;
  kind: ObjectKind;
  /** Dialogue shown when the player presses A while facing this object. */
  text: string;
  /** Which way an NPC faces while idle. */
  facing?: 'down' | 'up' | 'left' | 'right';
}

export interface EncounterEntry {
  species: string;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

export interface MapDef {
  id: string;
  name: string;
  /** One character per tile; see TILES for the legend. */
  layout: string[];
  objects: MapObject[];
  /** Chance per step taken on an encounter tile. */
  encounterRate: number;
  encounters: EncounterEntry[];
  /** Where the player starts on a fresh game. */
  spawn: { x: number; y: number };
}

export const PALLET_ROUTE: MapDef = {
  id: 'route1',
  name: 'ROUTE 1',
  spawn: { x: 6, y: 8 },
  encounterRate: 0.16,
  encounters: [
    { species: 'emberat', minLevel: 3, maxLevel: 5, weight: 45 },
    { species: 'pebblin', minLevel: 2, maxLevel: 4, weight: 35 },
    { species: 'sproutle', minLevel: 3, maxLevel: 6, weight: 20 },
  ],
  layout: [
    '##############################',
    '##############################',
    '##..........................##',
    '##..RRRR....................##',
    '##..RRRR..........,,,,,,....##',
    '##..WWDW..........,,,,,,,,..##',
    '##....__..........,,,,,,,,,.##',
    '##....__S.........,,,,,,,,..##',
    '##....__......*....,,,,,,...##',
    '##....______________........##',
    '##..........._..............##',
    '##..*........_......~~~~~...##',
    '##..........._.....~~~~~~~..##',
    '##..........._.....~~~~~~~..##',
    '##..........._......~~~~~...##',
    '##..........._..............##',
    '##..........._______........##',
    '##.................._.......##',
    '##..,,,,,..........._.......##',
    '##..,,,,,,.........._.......##',
    '##..,,,,,,,........._..RRRR.##',
    '##..,,,,,,.........._..RRRR.##',
    '##..,,,,,..........._..WWDW.##',
    '##..................______..##',
    '##..................LLLLL...##',
    '##.........*.......*........##',
    '##############################',
    '##############################',
  ],
  objects: [
    {
      x: 8,
      y: 7,
      kind: 'sign',
      text: 'ROUTE 1\nTALL GRASS AHEAD. WILD CREATURES HIDE THERE!',
    },
    {
      x: 6,
      y: 5,
      kind: 'door',
      text: 'THE DOOR IS LOCKED. YOUR MOM MUST HAVE STEPPED OUT.',
    },
    {
      x: 25,
      y: 22,
      kind: 'door',
      text: 'A SIGN ON THE DOOR READS: BACK IN FIVE MINUTES.',
    },
    {
      x: 16,
      y: 10,
      kind: 'npc',
      facing: 'down',
      text: "HI! I'M SCOUTING THE ROUTE.\nPRESS Z TO TALK, AND WALK INTO TALL GRASS TO FIND CREATURES.\nYOU CAN HOP DOWN LEDGES, BUT NOT BACK UP!",
    },
  ],
};

export const MAPS: Record<string, MapDef> = {
  route1: PALLET_ROUTE,
};

/**
 * Fail loudly at boot rather than rendering a corrupt or unplayable map.
 * These are the mistakes that are easy to make by hand and annoying to debug
 * once you're staring at the game: a ragged row, a ledge you'd land inside a
 * tree, a sign placed one tile off.
 */
export function validateMap(map: MapDef) {
  const fail = (msg: string) => {
    throw new Error(`Map "${map.id}": ${msg}`);
  };
  const width = map.layout[0].length;
  const height = map.layout.length;
  const at = (x: number, y: number) => TILES[map.layout[y]?.[x]] ?? null;

  map.layout.forEach((row, y) => {
    if (row.length !== width) fail(`row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (!TILES[ch]) fail(`unknown tile "${ch}" at ${x},${y}`);
    });
  });

  const spawn = at(map.spawn.x, map.spawn.y);
  if (!spawn || spawn.solid || spawn.ledge) {
    fail(`spawn ${map.spawn.x},${map.spawn.y} is not standable`);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!at(x, y)?.ledge) continue;
      const landing = at(x, y + 1);
      if (!landing || landing.solid || landing.ledge) {
        fail(`ledge at ${x},${y} has nowhere to land`);
      }
    }
  }

  for (const object of map.objects) {
    const tile = at(object.x, object.y);
    if (!tile) fail(`object at ${object.x},${object.y} is outside the map`);
    if (object.kind === 'npc' && tile!.solid) {
      fail(`NPC at ${object.x},${object.y} stands on a solid tile`);
    }
    if (object.kind !== 'npc' && !tile!.solid) {
      // Signs and doors are read by walking into them, so they must block.
      fail(`${object.kind} at ${object.x},${object.y} must sit on a solid tile`);
    }
  }

  if (map.encounters.length === 0 && map.encounterRate > 0) {
    fail('has an encounter rate but no encounter table');
  }
}
