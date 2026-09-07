import {
  balance,
  debt,
  dogsValue,
  dogValue,
  netWorthBreakdown,
  shipValue,
  RACE_CLASSES,
  type Dog,
  type GameState,
  type Id,
  type Phase,
  type Player,
  type RaceClass,
} from '@sdr/engine';

export const PHASE_LABEL: Record<Phase, string> = {
  arrival: 'Arrival',
  events: 'Events',
  planetPre: 'Planet — before the races',
  betting: 'Declarations locked',
  race: 'Race day',
  planetPost: 'Planet — after the races',
  endTurn: 'Jumping to the next planet',
  seasonEnd: 'Season over',
};

/** GDD §4.2 in order, for the phase strip on the hub. */
export const PHASE_ORDER: Phase[] = [
  'arrival',
  'events',
  'planetPre',
  'betting',
  'race',
  'planetPost',
  'endTurn',
];

export const CLASS_LABEL: Record<RaceClass, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export function humans(s: GameState): Player[] {
  return s.players.filter((p) => p.kind === 'human');
}

export function playerById(s: GameState, id: Id | null | undefined): Player | undefined {
  return id ? s.players.find((p) => p.id === id) : undefined;
}

/**
 * Gold wins per stable, counted from the race archive rather than from the dogs still owned,
 * so selling a champion does not erase the win. Tie-break for the season (GDD §4.3).
 */
export function goldWins(s: GameState): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const p of s.players) out[p.id] = 0;
  const finished = [...s.results, ...(s.races ? Object.values(s.races) : [])];
  for (const r of finished) {
    if (r.cls !== 'gold') continue;
    const winner = r.order[0];
    const entry = r.entries.find((e) => e.dogId === winner);
    if (entry && entry.ownerId !== 'local' && out[entry.ownerId] !== undefined) {
      out[entry.ownerId] = (out[entry.ownerId] ?? 0) + 1;
    }
  }
  return out;
}

export interface StandingRow {
  player: Player;
  cash: number;
  dogs: number;
  ship: number;
  cargo: number;
  debt: number;
  netWorth: number;
  goldWins: number;
}

export function standings(s: GameState): StandingRow[] {
  const gold = goldWins(s);
  const rows = s.players.map((player) => {
    const w = netWorthBreakdown(s, player);
    return {
      player,
      cash: w.cash,
      dogs: w.dogs,
      ship: w.ship,
      cargo: w.cargo,
      debt: w.debt,
      netWorth: w.total,
      goldWins: gold[player.id] ?? 0,
    };
  });
  rows.sort((a, b) => b.netWorth - a.netWorth || b.goldWins - a.goldWins);
  return rows;
}

export function ownedDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/** The class this player has declared the dog in, if any. */
export function declaredClass(s: GameState, playerId: Id, dogId: Id): RaceClass | null {
  for (const cls of RACE_CLASSES) if (s.declarations[cls][playerId] === dogId) return cls;
  return null;
}

/** Why a dog cannot run in a class — null when it can. */
export function ineligibleReason(d: Dog, cls: RaceClass): string | null {
  if (d.injuryWeeks > 0) return `injured (${d.injuryWeeks}w)`;
  if (d.banWeeks > 0) return `banned (${d.banWeeks}w)`;
  const cap = cls === 'bronze' ? balance.capBronze : cls === 'silver' ? balance.capSilver : 99;
  if (d.rating > cap) return `rating ${d.rating} > ${cap}`;
  return null;
}

/** Typical rating of the local dogs that will fill the empty traps (GDD §6.1). */
export function localRatingFor(cls: RaceClass, major: boolean): number {
  const base =
    cls === 'bronze'
      ? balance.localRatingBronze
      : cls === 'silver'
        ? balance.localRatingSilver
        : balance.localRatingGold;
  return base + (major ? balance.localRatingMajorBonus : 0);
}

export function declaredCount(s: GameState, cls: RaceClass): number {
  return Object.keys(s.declarations[cls]).length;
}

export const TRAPS = balance.traps;

export function worthParts(s: GameState, p: Player) {
  return {
    dogs: dogsValue(s, p),
    ship: shipValue(p),
    debt: debt(p),
  };
}

export { dogValue };
