import {
  balance,
  debt,
  dogsValue,
  dogValue,
  fuelCost,
  netWorthBreakdown,
  planetOf,
  shipValue,
  weeklyInterest,
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

/**
 * Is there a bookie this week? Two ways there is not: the season's No Betting toggle, and a planet
 * that has none (Holy Bark). The engine asks the same question in phases/turn.ts to decide whether
 * to open a betting phase at all; this is the client's copy of it, kept in one place because both
 * the venue strip and `screenFor` need the answer and neither may import the other.
 */
export function bookieOpen(s: GameState): boolean {
  return s.toggles.betting && !planetOf(s.planet.planetId).special.noBetting;
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

export interface WeeklyBill {
  upkeep: number;
  wages: number;
  fuel: number;
  food: number;
  interest: number;
  total: number;
  /** Crates the dogs will eat, and how many of them are already in the hold. */
  foodNeeded: number;
  foodFromHold: number;
}

/**
 * What the jump at the end of this week will cost (GDD §7.2). This mirrors phases/endTurn.ts
 * for display only — the engine still does the charging — so a player can see a bad week coming
 * rather than discovering it on the leaderboard.
 */
export function weeklyBill(s: GameState, p: Player): WeeklyBill {
  const planet = planetOf(s.planet.planetId);
  const dogs = ownedDogs(s, p);
  let upkeep = 0;
  if (!planet.special.noUpkeep)
    for (const d of dogs)
      upkeep += d.traits.includes('cheapDate') ? balance.upkeepPerDog / 2 : balance.upkeepPerDog;
  let wages = 0;
  if (p.staff.trainer) wages += balance.trainerWage;
  if (p.staff.vet) wages += balance.vetWage;
  if (p.staff.fixer) wages += 350;
  const fuel = s.week < balance.weeks ? fuelCost(p.cargo) : 0;
  let foodNeeded = 0;
  for (const d of dogs)
    foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  if (p.sponsorWeeks > 0) foodNeeded *= 2;
  const foodFromHold = Math.min(p.cargo, foodNeeded);
  const food = Math.round(
    (foodNeeded - foodFromHold) * s.planet.foodBuy * balance.foodNoCargoPenalty,
  );
  const interest = weeklyInterest(p);
  return {
    upkeep: Math.round(upkeep),
    wages,
    fuel,
    food,
    interest,
    total: Math.round(upkeep) + wages + fuel + food + interest,
    foodNeeded,
    foodFromHold,
  };
}
