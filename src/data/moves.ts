export type ElementType = 'normal' | 'grass' | 'fire' | 'rock';

export interface Move {
  id: string;
  name: string;
  type: ElementType;
  power: number;
  accuracy: number;
  pp: number;
}

export const MOVES: Record<string, Move> = {
  tackle: { id: 'tackle', name: 'TACKLE', type: 'normal', power: 40, accuracy: 100, pp: 35 },
  scratch: { id: 'scratch', name: 'SCRATCH', type: 'normal', power: 40, accuracy: 100, pp: 35 },
  vinelash: { id: 'vinelash', name: 'VINE LASH', type: 'grass', power: 45, accuracy: 100, pp: 25 },
  ember: { id: 'ember', name: 'EMBER', type: 'fire', power: 40, accuracy: 100, pp: 25 },
  rockthrow: { id: 'rockthrow', name: 'ROCK THROW', type: 'rock', power: 50, accuracy: 90, pp: 15 },
  growl: { id: 'growl', name: 'GROWL', type: 'normal', power: 0, accuracy: 100, pp: 40 },
};

/** Attacking type -> defending type -> multiplier. Anything unlisted is 1x. */
const CHART: Partial<Record<ElementType, Partial<Record<ElementType, number>>>> = {
  fire: { grass: 2, rock: 0.5, fire: 0.5 },
  grass: { rock: 2, fire: 0.5, grass: 0.5 },
  rock: { fire: 2, grass: 0.5 },
};

export function effectiveness(attack: ElementType, defend: ElementType): number {
  return CHART[attack]?.[defend] ?? 1;
}
