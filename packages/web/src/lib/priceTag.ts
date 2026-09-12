/**
 * What a thing on sale is worth, said in the dog's own numbers.
 *
 * **Why this module exists.** Phase A built the fitness rules and Jesse could not feel them; what
 * made him feel them in Phase B was the Race Office printing "74 → 49" next to the dog. The
 * mechanic had been there all along — what arrived was the price, on the screen where the decision
 * is made. Phase C adds a whole market, and a goods table that says "Proper speed feed, 900" is
 * Phase A's Kennels again: a correct rule with no price on it.
 *
 * So every counter in the market prices its stock through here, and the unit is never "+2–4 Speed".
 * It is *this dog's* rating, in *this* season's weeks:
 *
 *   Rosco · Speed 54 → 61 by week 10 · rating 47 → 50
 *
 * Everything in here is display arithmetic mirroring the engine, in the same spirit as
 * `fitnessOutlook` and `weeklyBill` in selectors.ts. The engine still does the charging; this only
 * says what it is about to charge for. Where the engine has a definition — `weakestStat`,
 * `ratingWith` — it is imported rather than re-derived, because a screen that guesses is how the
 * player ends up being lied to.
 */
import {
  balance,
  bestFeedAboard,
  cargoTotal,
  dogValue,
  fuelCost,
  ratingWith,
  weakestStat,
  type Dog,
  type GameState,
  type Good,
  type Id,
  type Player,
  type StatKey,
} from '@sdr/engine';

export { weakestStat, ratingWith };

export const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Accel',
  stamina: 'Stamina',
  trap: 'Trap',
};

/**
 * Weekends still to come after this one — what a weekly wage runs over and how many Train weeks
 * a feed bought today could possibly be spent on.
 *
 * A wage is charged at the end of every week including this one, so the bill a player is signing
 * up for is `weeksLeft + 1` payments. That distinction is the whole difference between "1,400 a
 * week" and "18,200 before the season ends", which is the number that makes it a decision.
 */
export function weeksLeft(s: GameState): number {
  return Math.max(0, balance.weeks - s.week);
}

/** Weeks a wage hired *now* will be charged for, this week's included. */
export function wageWeeks(s: GameState): number {
  return weeksLeft(s) + 1;
}

/** What employing this staff member costs between now and the Grand Final. */
export function wageToSeasonEnd(s: GameState, wage: number): number {
  return wage * wageWeeks(s);
}

export interface TrainProjection {
  /** Train weeks assumed — every remaining week, which is the ceiling rather than a forecast. */
  weeks: number;
  statNow: number;
  statThen: number;
  ratingNow: number;
  ratingThen: number;
}

/**
 * Where a stat and a rating land if this dog trains that stat every week left in the season.
 *
 * Deliberately the ceiling, and said as one: "would reach 61 by week 13 if it trained every week".
 * A dog cannot both train and race, so the honest framing is the most the purchase could buy,
 * against which the player prices their own plan. Kibble's floor gain is left out — it lands on a
 * random stat and is what a stable that spends nothing already gets, so counting it would flatter
 * every feed by the same amount.
 */
export function projectTrain(
  d: Dog,
  stat: StatKey,
  gainPerWeek: number,
  weeks: number,
): TrainProjection {
  const statThen = Math.max(1, Math.min(99, d[stat] + gainPerWeek * weeks));
  return {
    weeks,
    statNow: d[stat],
    statThen,
    ratingNow: d.rating,
    ratingThen: ratingWith(d, stat, statThen - d[stat]),
  };
}

/** "Speed 54 → 61 by week 13, rating 47 → 50" — one line, and the reason the feed has a price. */
export function projectionLine(s: GameState, p: TrainProjection, stat: StatKey): string {
  if (p.weeks <= 0) return `no training weeks left — ${STAT_LABEL[stat]} stays ${p.statNow}`;
  const week = Math.min(balance.weeks, s.week + p.weeks);
  return (
    `${STAT_LABEL[stat]} ${p.statNow} → ${p.statThen} by week ${week}` +
    `, rating ${p.ratingNow} → ${p.ratingThen}`
  );
}

/**
 * Prize money one dog has won for its stable this season, read off the race archive.
 *
 * Not stored on the Dog, and deliberately not: `RaceResult.payouts` already carries dog, place and
 * amount for every race run, so the fact is in the archive and adding a field would be a second
 * copy to keep honest. Used to answer the Saloon's question — is this wage bill big against what
 * your best dog actually earns?
 */
export function dogEarnings(s: GameState, dogId: Id): number {
  let total = 0;
  for (const r of [...s.results, ...(s.races ?? [])]) {
    for (const pay of r.payouts) if (pay.dogId === dogId) total += pay.amount;
  }
  return total;
}

/** The dog in this stable that has won the most this season, with what it won. */
export function bestEarner(s: GameState, me: Player): { dog: Dog; won: number } | null {
  let best: { dog: Dog; won: number } | null = null;
  for (const id of me.dogIds) {
    const d = s.dogs[id];
    if (!d) continue;
    const won = dogEarnings(s, id);
    if (!best || won > best.won) best = { dog: d, won };
  }
  return best;
}

/** Whether an asking price is over or under the book value, as a percentage. */
export function askVsBook(d: Dog): { book: number; ask: number; pct: number } {
  const book = dogValue(d);
  const ask = d.askingPrice ?? 0;
  return { book, ask, pct: book > 0 ? Math.round((100 * (ask - book)) / book) : 0 };
}

/**
 * What one crate of a feed would do to one dog, in that dog's own numbers (GDD §8.2).
 *
 * **This is the sentence Phase C exists for.** A goods table that says "Proper speed feed, 900" is
 * Phase A's Kennels again: a correct rule with no price on it. What a player needs is
 *
 *   Rosco · Speed 54 → 57 next Train week · rating 47 → 48 · 61 by week 13 if he keeps eating it
 *
 * so the three numbers that decide the purchase — what it does now, what that is worth in rating,
 * and where a season of it lands — are all on the row with the price.
 */
export function feedEffect(s: GameState, g: Good, d: Dog): string {
  if (!g.stat) {
    return `The staple. A Train week on kibble alone gains ${g.gainMin}–${g.gainMax} on a random stat`;
  }
  const mid = Math.round((g.gainMin + g.gainMax) / 2);
  const oneWeek = ratingWith(d, g.stat, mid);
  const weeks = weeksLeft(s);
  const far = projectTrain(d, g.stat, mid, weeks);
  const label = STAT_LABEL[g.stat];
  return (
    `${d.name}: ${label} ${d[g.stat]} → ${Math.min(99, d[g.stat] + g.gainMin)}–${Math.min(99, d[g.stat] + g.gainMax)} next Train week, ` +
    `rating ${d.rating} → ${oneWeek}` +
    (weeks > 0
      ? ` · ${label} ${far.statThen} and rating ${far.ratingThen} by week ${Math.min(balance.weeks, s.week + weeks)} if he ate it every week`
      : '')
  );
}

/** One crate per dog per Train week — so how many Train weeks the hold currently covers. */
export function cratesForTrainees(s: GameState, me: Player): { trainees: number; covered: number } {
  let trainees = 0;
  let covered = 0;
  for (const id of me.dogIds) {
    const d = s.dogs[id];
    if (!d || d.weekState !== 'train' || d.injuryWeeks > 0) continue;
    trainees++;
    const g = bestFeedAboard(me.cargo, d.trainStat);
    if (g && me.cargo[g.id] > 0) covered++;
  }
  return { trainees, covered };
}

export interface HoldEconomics {
  /** Fuel for the next jump as the hold stands. */
  fuelNow: number;
  /** Fuel for the next jump with `units` more crates aboard. */
  fuelFull: number;
  /** Extra fuel those crates cost, total. */
  fuelExtra: number;
  /** What those crates cost to buy here. */
  outlay: number;
  /**
   * The price a crate has to fetch at the next stop for the run to break even: what you paid,
   * plus the fuel the crate itself added. This is the number the spread hides — GDD §9.1 measured
   * blind carrying at −9.5 a crate, and this is that loss, printed before the purchase.
   */
  breakEven: number;
}

/**
 * What filling the hold costs and what it has to return (GDD §9.1, §9.2).
 *
 * The Docks already showed the fuel line. What it did not show is the number that decides the
 * trade: **the price a crate must fetch at the next stop to have been worth carrying.** Fuel is
 * charged per crate over the free allowance, so the marginal crate on a full hold is dearer than
 * the first, and a player filling up has no way to work that out from `base + n × perUnit`.
 */
export function holdEconomics(me: Player, units: number, unitPrice: number): HoldEconomics {
  const crates = cargoTotal(me.cargo);
  const fuelNow = fuelCost(crates);
  const fuelFull = fuelCost(crates + units);
  const fuelExtra = fuelFull - fuelNow;
  const outlay = units * unitPrice;
  return {
    fuelNow,
    fuelFull,
    fuelExtra,
    outlay,
    breakEven: units > 0 ? Math.ceil((outlay + fuelExtra) / units) : unitPrice,
  };
}
