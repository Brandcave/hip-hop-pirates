import type { ElementType } from './moves';

export interface Species {
  id: string;
  name: string;
  type: ElementType;
  /** Base stats, in the same spirit as Gen 1's 0-255 scale. */
  base: { hp: number; atk: number; def: number; spd: number };
  /** Move ids learned by default. */
  moves: string[];
  /** Key into SPRITE_BUILDERS. */
  sprite: string;
}

export const SPECIES: Record<string, Species> = {
  sproutle: {
    id: 'sproutle',
    name: 'SPROUTLE',
    type: 'grass',
    base: { hp: 45, atk: 49, def: 49, spd: 45 },
    moves: ['tackle', 'vinelash'],
    sprite: 'sproutle',
  },
  emberat: {
    id: 'emberat',
    name: 'EMBERAT',
    type: 'fire',
    base: { hp: 39, atk: 52, def: 43, spd: 65 },
    moves: ['scratch', 'ember'],
    sprite: 'emberat',
  },
  pebblin: {
    id: 'pebblin',
    name: 'PEBBLIN',
    type: 'rock',
    base: { hp: 50, atk: 45, def: 65, spd: 25 },
    moves: ['tackle', 'rockthrow'],
    sprite: 'pebblin',
  },
};

export interface Monster {
  species: Species;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  moves: string[];
}

/** Gen 1-ish stat derivation: simple, deterministic, easy to rebalance later. */
export function createMonster(speciesId: string, level: number): Monster {
  const species = SPECIES[speciesId];
  const stat = (b: number) => Math.floor((b * 2 * level) / 100) + 5;
  const maxHp = Math.floor((species.base.hp * 2 * level) / 100) + level + 10;
  return {
    species,
    level,
    maxHp,
    hp: maxHp,
    atk: stat(species.base.atk),
    def: stat(species.base.def),
    spd: stat(species.base.spd),
    moves: [...species.moves],
  };
}
