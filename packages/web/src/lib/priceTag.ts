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
  baseRating,
  bestFeedAboard,
  ratingWith,
  weakestStat,
  type Dog,
  type GameState,
  type Good,
  type Id,
  type Player,
  type RaceEntry,
  type StatKey,
} from '@sdr/engine';

export { weakestStat, ratingWith };

export const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Accel',
  stamina: 'Stamina',
};

/**
 * Weekends still to come after this one — what a weekly wage runs over and how many Train weeks
 * a feed bought today could possibly be spent on.
 *
 * ⚠️ **The wage arithmetic this used to carry is gone with the wages (BUILD_PLAN_V3 §2.1).** Phase D
 * pays staff a percentage of race prize money instead (GDD_V3 §8.1), which needs no forward bill at
 * all — that is the whole point of commission, and v2 D42 is why.
 */
export function weeksLeft(s: GameState): number {
  return Math.max(0, balance.weeks - s.week);
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

/**
 * What a stake is actually worth, in Bones, at the price on the board (GDD §10).
 *
 * The bookie has always printed decimal odds, which is the price and not the decision. A player
 * deciding whether to have 2,000 on a 6.16 shot is deciding about a **12,320 return, a 10,320
 * profit, and 2,000 gone** — three numbers the screen made them work out. Odds are a ratio; a
 * betting decision is in Bones, the same way a feed crate's decision is in this dog's rating and
 * not in "+2–4 Speed" (see the note at the head of this module).
 *
 * This matters more in Phase D than it did before, because §13's whole road is a percentage edge
 * whose cash value is the stake — so a crook who cannot see the stake in Bones cannot price the
 * fixer's fee against it.
 */
export interface StakeValue {
  stake: number;
  odds: number;
  /** What comes back over the counter if it lands: stake × odds. */
  returns: number;
  /** Returns less the stake. */
  profit: number;
  /** What the slip is worth if it loses — the stake, gone. */
  loss: number;
}

export function stakeValue(stake: number, odds: number): StakeValue {
  const returns = Math.round(stake * odds);
  return { stake, odds, returns, profit: returns - stake, loss: stake };
}

/** "returns 12,320 — a 10,320 profit, or 2,000 gone" — the sentence a price is not. */
export function stakeLine(v: StakeValue, fmt: (n: number) => string): string {
  return `returns ${fmt(v.returns)} — a ${fmt(v.profit)} profit, or ${fmt(v.loss)} gone`;
}

/** What the bookie's price says the chance is, once its own margin is taken back out. */
export function impliedProbability(odds: number, margin: number): number {
  return Math.min(1, (1 - margin) / Math.max(1.01, odds));
}

/**
 * What the bookie is not pricing about one runner (GDD §10, §5.3).
 *
 * The book is a model of **public ratings and nothing else** — that is the sentence §5.3 and §10
 * both rest on, and it is the only reason betting can ever be a road rather than a tax. But a
 * player could only act on it by holding two screens in their head: the odds here, and the stat
 * bars over in the Kennels.
 *
 * So the gap gets printed. Three things move a dog and leave its rating alone, and each one is a
 * clause here only when it is actually true of this dog:
 *
 * - **Fitness.** `RaceEntry` carries a rating and the field table prints the fitness beside it;
 *   what was missing was that the *price* only knows the first of the two.
 * - **Stats that have outgrown the rating** (§5.3's `effectiveRating`) — a month with a trainer,
 *   a track-day pass. Exactly what the Hard AI acts on, said out loud so a player can too.
 * - **A supplement**, and from Phase D a nobbling, neither of which the book has seen.
 *
 * Returns null when there is nothing to say, so a dog the bookie has right adds no noise.
 */
export function bookieBlindSpot(
  s: GameState,
  entry: RaceEntry,
  fieldMeanFitness: number,
): string | null {
  const d = s.dogs[entry.dogId];
  if (!d) return null;
  const clauses: string[] = [];
  const stats = baseRating(d);
  if (stats > d.rating) {
    clauses.push(`stats worth ${stats} against the ${d.rating} it is priced on`);
  }
  const fitGap = Math.round(d.fitness - fieldMeanFitness);
  if (Math.abs(fitGap) >= 6) {
    clauses.push(
      `${d.fitness} fitness against a field averaging ${Math.round(fieldMeanFitness)}` +
        (fitGap > 0 ? '' : ' — it is the tired one here'),
    );
  }
  // ⚠️ The supplement and the nobbling are both deleted (BUILD_PLAN_V3 §2.1), so the blind spot is
  // now only what a fed dog's stats have outgrown its rating by. GDD_V3 §5.6 replaces them with a
  // bigger one that is deliberate: **the book prices style but not the shape of the field**, so a
  // closer in a field of three front-runners is genuinely better than its price. That clause belongs
  // here in Phase C, and §11 measures its size.
  if (!clauses.length) return null;
  return `${d.name} is priced at rating ${entry.rating}. The book does not see ${clauses.join(', nor ')}.`;
}

/** The mean fitness of the runners in a field — what one dog's condition is read against. */
export function fieldMeanFitness(s: GameState, field: readonly RaceEntry[]): number {
  let total = 0;
  let n = 0;
  for (const e of field) {
    const d = s.dogs[e.dogId];
    if (!d) continue;
    total += d.fitness;
    n++;
  }
  return n ? total / n : 0;
}
