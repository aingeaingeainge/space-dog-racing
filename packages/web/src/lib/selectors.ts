import {
  balance,
  kibbleAboard,
  KIBBLE_ID,
  dogsValue,
  dogValue,
  netWorthBreakdown,
  planetOf,
  thisWeeksCard,
  FREE_HORIZON,
  raceType,
  HEADLINE_TYPE_ID,
  RACE_TYPE_IDS,
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
export function raceTone(race: RaceTypeId): 'bronze' | 'silver' | 'gold' {
  // The tone IS the tier now (GDD_V3 §7.1), so this is a rename rather than a lookup. It used to
  // take the card as well, because "which of the two drawn races is the cheaper one" was a fact
  // about the week rather than about the race.
  return race === 'goldCup' ? 'gold' : race === 'silverPlate' ? 'silver' : 'bronze';
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
export function goldCupWins(s: GameState): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const p of s.players) out[p.id] = 0;
  const finished = [...s.results, ...(s.races ?? [])];
  for (const r of finished) {
    if (r.race !== HEADLINE_TYPE_ID) continue;
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
  cargo: number;
  netWorth: number;
  openWins: number;
}

export function standings(s: GameState): StandingRow[] {
  const open = goldCupWins(s);
  const rows = s.players.map((player) => {
    const w = netWorthBreakdown(s, player);
    return {
      player,
      cash: w.cash,
      dogs: w.dogs,
      cargo: w.cargo,
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
  if (!raceType(race).eligible(d)) return `needs ${raceType(race).criterion}`;
  return null;
}

/** Why a dog cannot run in *any* race this week — null when at least one race will have it. */
export function cannotRunReason(s: GameState, d: Dog): string | null {
  if (d.injuryWeeks > 0)
    return `injured — out for ${d.injuryWeeks} more week${d.injuryWeeks > 1 ? 's' : ''}`;
  if (thisWeeksCard().every((race) => !raceType(race).eligible(d)))
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

export function fitnessOutlook(d: Dog): FitnessOutlook {
  const bounce = d.traits.includes('bouncesBack') ? 5 : 0;
  // ⚠️ No vet to add to the rest any more (BUILD_PLAN_V3 §2.1). GDD_V3 §8.2's staff bonuses put
  // "+5 fitness recovery per week" back in Phase D, and `me` is kept in the signature for it.
  const rest = balance.fitnessRest + bounce;
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
 * Beyond that, nothing.
 *
 * ⚠️ **The `'bought'` level is gone with the dossier (BUILD_PLAN_V3 §2.1).** The fog itself is kept
 * whole (§2.3) and GDD_V3 §2.1 makes it load-bearing for the first time — it is now the *only* thing
 * information is for, and §9.4 moves the buying of it into Bar events in Phase D. So this is three
 * levels plus 'past' until then, and `fogLevel` keeps its signature so the Galaxy Map does not have
 * to change shape twice.
 */
export type FogLevel = 'here' | 'named' | 'dark' | 'past';

export function fogLevel(s: GameState, week: number): FogLevel {
  if (week < s.week) return 'past';
  if (week === s.week) return 'here';
  if (week <= s.week + FREE_HORIZON) return 'named';
  return 'dark';
}

/** Typical rating of the local dogs that will fill the empty traps (GDD §6.1). */
export function localRatingFor(race: RaceTypeId, major: boolean): number {
  return raceType(race).localRating + (major ? balance.localRatingMajorBonus : 0);
}

export function declaredCount(s: GameState, race: RaceTypeId): number {
  return Object.keys(s.declarations[race]).length;
}

export const TRAPS = balance.traps;

export function worthParts(s: GameState, p: Player) {
  return { dogs: dogsValue(s, p) };
}

export { dogValue };

export interface WeeklyBill {
  food: number;
  total: number;
  /** Crates the dogs will eat, and how many of them are already in the hold. */
  foodNeeded: number;
  foodFromHold: number;
}

/**
 * What the jump at the end of this week will cost. This mirrors phases/endTurn.ts for display only
 * — the engine still does the charging — so a player can see a bad week coming rather than
 * discovering it on the leaderboard.
 *
 * ⚠️ **Upkeep, wages, fuel and interest are all gone (BUILD_PLAN_V3 §2.1), so the bill is food.**
 * GDD_V3 V10 is explicit that food is the only running cost and pillar 5 is why: nobody should be
 * dead at week 6 of a game with friends. The consequence, named in §6.3, is that the empty-hold
 * penalty Phase B builds is carrying the entire economy's pressure — so this one-line bill is a
 * thing to watch rather than a simplification to be pleased about.
 */
export function weeklyBill(s: GameState, p: Player): WeeklyBill {
  const dogs = ownedDogs(s, p);
  let foodNeeded = 0;
  for (const d of dogs)
    foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  if (p.sponsorWeeks > 0) foodNeeded *= 2;
  const foodFromHold = Math.min(kibbleAboard(p.cargo), foodNeeded);
  const food = Math.round(
    (foodNeeded - foodFromHold) * s.planet.goods[KIBBLE_ID].buy * balance.foodNoCargoPenalty,
  );
  return { food, total: food, foodNeeded, foodFromHold };
}
