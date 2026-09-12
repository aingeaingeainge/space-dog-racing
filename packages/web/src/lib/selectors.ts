import {
  balance,
  cargoTotal,
  kibbleAboard,
  KIBBLE_ID,
  debt,
  dogsValue,
  dogValue,
  fuelCost,
  netWorthBreakdown,
  planetOf,
  shipValue,
  weeklyInterest,
  thisWeeksCard,
  FREE_HORIZON,
  raceType,
  LOCAL_RATING_BY_TIER,
  OPEN_TYPE_ID,
  RACE_TYPE_IDS,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Phase,
  type Player,
  type RaceTypeId,
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

/** What a race is called, from its row (GDD §6.3). */
export function raceLabel(race: RaceTypeId): string {
  return raceType(race).label;
}

/**
 * The three stub colours, by position on the card rather than by race name. The card is ordered
 * with the headline race last (GDD §6.3), so the metal reads as a ladder however the two drawn
 * races come out — three identical stubs side by side is a worse screen than three that name
 * themselves.
 */
export function raceTone(
  race: RaceTypeId,
  card: readonly RaceTypeId[],
): 'bronze' | 'silver' | 'gold' {
  if (race === OPEN_TYPE_ID) return 'gold';
  return card.indexOf(race) === 0 ? 'bronze' : 'silver';
}

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
 * Wins in the weekend's headline race per stable, counted from the race archive rather than
 * from the dogs still owned, so selling a champion does not erase the win. First tie-break for
 * the season (GDD §4.3).
 */
export function openWins(s: GameState): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const p of s.players) out[p.id] = 0;
  const finished = [...s.results, ...(s.races ?? [])];
  for (const r of finished) {
    if (r.race !== OPEN_TYPE_ID) continue;
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
  openWins: number;
}

export function standings(s: GameState): StandingRow[] {
  const open = openWins(s);
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
      openWins: open[player.id] ?? 0,
    };
  });
  rows.sort((a, b) => b.netWorth - a.netWorth || b.openWins - a.openWins);
  return rows;
}

export function ownedDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/** The race this player has declared the dog in, if any. */
export function declaredRace(s: GameState, playerId: Id, dogId: Id): RaceTypeId | null {
  for (const race of RACE_TYPE_IDS) if (s.declarations[race][playerId] === dogId) return race;
  return null;
}

/** What the race asks of a dog, in the words the card header prints (GDD §6.5). */
export function criterionFor(race: RaceTypeId): string {
  return raceType(race).criterion;
}

/** Why a dog cannot run in one race — null when it can. */
export function ineligibleReason(d: Dog, race: RaceTypeId): string | null {
  if (d.injuryWeeks > 0) return `injured (${d.injuryWeeks}w)`;
  if (d.banWeeks > 0) return `banned (${d.banWeeks}w)`;
  if (!raceType(race).eligible(d)) return `needs ${raceType(race).criterion}`;
  return null;
}

/** Why a dog cannot run in *any* race this week — null when at least one race will have it. */
export function cannotRunReason(s: GameState, d: Dog): string | null {
  if (d.injuryWeeks > 0)
    return `injured — out for ${d.injuryWeeks} more week${d.injuryWeeks > 1 ? 's' : ''}`;
  if (d.banWeeks > 0)
    return `banned by the stewards for ${d.banWeeks} more week${d.banWeeks > 1 ? 's' : ''}`;
  if (thisWeeksCard(s).every((race) => !raceType(race).eligible(d)))
    return "nothing on this weekend's card will have it";
  return null;
}

/**
 * What next week's fitness looks like from here, for each of the three things the week can be
 * (GDD §5.7). The Race Office prints it beside every eligible dog, because the price of a run
 * is the whole of the decision Phase A built and nothing on the declaring screen ever named it.
 *
 * This mirrors phases/endTurn.ts for display only. A race is charged where it happens, so a dog
 * that runs takes −fitnessPerRace and no recovery on top; Rest picks up the vet and Bounces
 * back, Train does not.
 */
export interface FitnessOutlook {
  now: number;
  racing: number;
  training: number;
  resting: number;
}

export function fitnessOutlook(d: Dog, me: Player): FitnessOutlook {
  const bounce = d.traits.includes('bouncesBack') ? 5 : 0;
  const rest = (me.staff.vet ? balance.fitnessRestVet : balance.fitnessRest) + bounce;
  const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    now: d.fitness,
    racing: cap(d.fitness - balance.fitnessPerRace),
    training: cap(d.fitness + balance.fitnessTrain),
    resting: cap(d.fitness + rest),
  };
}

/**
 * The fog (GDD §9.3, D5). What this stable is allowed to see of the circuit, week by week.
 *
 * You know the planet you are standing on completely, and next week's by name and Major status.
 * Beyond that, nothing — unless you bought a dossier on it, which is why this reads the action
 * log rather than the state: the whole circuit is in `calendar` because the reducer had to build
 * it, and the fog is a rule about who may look. A purchase is in the log, so the log is the
 * answer, and nothing had to be added to GameState to hold it.
 */
export type FogLevel = 'here' | 'named' | 'bought' | 'dark' | 'past';

export function dossierWeeks(log: readonly Action[], playerId: Id): Set<number> {
  const out = new Set<number>();
  for (const a of log) {
    if (a.t === 'BuyUpgrade' && a.upgrade === 'dossier' && a.playerId === playerId && a.week)
      out.add(a.week);
  }
  return out;
}

export function fogLevel(s: GameState, week: number, bought: ReadonlySet<number>): FogLevel {
  if (week < s.week) return 'past';
  if (week === s.week) return 'here';
  if (week <= s.week + FREE_HORIZON) return 'named';
  return bought.has(week) ? 'bought' : 'dark';
}

/** The week a dossier can be bought for from here, or null if the season ends first. */
export function dossierWeek(s: GameState): number | null {
  const week = s.week + balance.dossierReach;
  return week <= s.calendar.length ? week : null;
}

/** Typical rating of the local dogs that will fill the empty traps (GDD §6.1). */
export function localRatingFor(race: RaceTypeId, major: boolean): number {
  return LOCAL_RATING_BY_TIER[raceType(race).tier] + (major ? balance.localRatingMajorBonus : 0);
}

export function declaredCount(s: GameState, race: RaceTypeId): number {
  return Object.keys(s.declarations[race]).length;
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
  const fuel = s.week < balance.weeks ? fuelCost(cargoTotal(p.cargo)) : 0;
  let foodNeeded = 0;
  for (const d of dogs)
    foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  if (p.sponsorWeeks > 0) foodNeeded *= 2;
  // Dogs eat the staple and nothing else (GDD §8.2), so a hold full of speed feed still pays
  // the no-kibble penalty. The bill has to say that or a stable is surprised at the jump.
  const foodFromHold = Math.min(kibbleAboard(p.cargo), foodNeeded);
  const food = Math.round(
    (foodNeeded - foodFromHold) * s.planet.goods[KIBBLE_ID].buy * balance.foodNoCargoPenalty,
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
