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
  cargoTotal,
  dogValue,
  drawAdvantage,
  fixCatchRate,
  formatBones,
  fuelCost,
  jobCost,
  planetOf,
  purseFor,
  ratingWith,
  weakestStat,
  winProbabilities,
  type Dog,
  type FixerOffer,
  type GameState,
  type Good,
  type Id,
  type Player,
  type RaceEntry,
  type RaceTypeId,
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
  if (d.supplemented) clauses.push('a supplement nobody declared');
  // §13's whole point, said out loud on the one screen where it is worth money.
  if (d.nobbled > 0)
    clauses.push(`the ${d.nobbled} fitness somebody took off it after the prices went up`);
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

/**
 * What a bought box is worth, in Bones, on this track and in this race (GDD §13, D37).
 *
 * The two halves the fee has to clear, and neither of them is "+3.5% win rate":
 * - the **purse** it moves your way, which scales with the race — so a box is worth buying at a
 *   Major and not on a quiet Tuesday;
 * - the **price**, because the book prices ratings and does not price a draw either, so a dog you
 *   have moved to the rail is value at its own unmoved odds.
 *
 * `drawAdvantage` is the engine's own number (measured, and zero on a track with no bends), so
 * this screen and the AI that buys boxes are pricing the same thing.
 */
/**
 * What `sabotageFitness` is worth in rating points to the bookie's model — the conversion this
 * screen has to make because the engine takes *fitness* off a runner and the book speaks only
 * *rating*. Mirrors `SABOTAGE_RATING_POINTS` in the harness and `SABOTAGE_RATING_EQUIV` in
 * `ai/paths.ts`; measured by `npm run harness -- --fix` and re-measured if D13's curve moves.
 */
export const SABOTAGE_RATING_POINTS = 10;

export interface BoxPrice {
  /** The man selling it this weekend, or null where nobody is about (GDD §13). */
  fixer: FixerOffer | null;
  fee: number;
  /** Win-rate points choosing the box is worth here, as a fraction. Zero on a straight. */
  advantage: number;
  purse: number;
  purseGain: number;
  /** What the advantage is worth on a stake of this size at the dog's own odds. */
  bettingGain: number;
  worthIt: boolean;
  line: string;
}

export function priceABox(
  s: GameState,
  race: RaceTypeId,
  entryOdds: number | null,
  stake: number,
): BoxPrice {
  const advantage = drawAdvantage(planetOf(s.planet.planetId).track);
  const purse = purseFor(s, race)[0];
  const purseGain = Math.round(advantage * purse);
  // A win-rate gain of `advantage` on a price of `odds` is worth `advantage × odds` per Bone on.
  const bettingGain = entryOdds ? Math.round(advantage * entryOdds * stake) : 0;
  // This weekend's man at this weekend's rate (E-D45). Null where nobody is drinking here, which
  // is the honest answer to "what would a box cost" when there is nobody to buy one from.
  const fixer = s.planet.fixer;
  const fee = fixer ? jobCost('bribe', fixer.tier) : 0;
  const total = purseGain + bettingGain;
  return {
    fee,
    fixer,
    advantage,
    purse,
    purseGain,
    bettingGain,
    worthIt: total > fee,
    line:
      advantage <= 0
        ? 'No bends on this track — a box here is a starting position and nothing else. Save your money.'
        : `Choosing the box is worth about ${(advantage * 100).toFixed(1)} points of a win here: ` +
          `${formatBones(purseGain)} of purse` +
          (bettingGain > 0
            ? ` and ${formatBones(bettingGain)} on a ${formatBones(stake)} bet`
            : '') +
          `, against the ${formatBones(fee)} fee.`,
  };
}

/**
 * What nobbling one runner would be worth, in Bones, at the stake dialled in (GDD §13, §10).
 *
 * ⚠️ **This is the screen the phase exists for.** A Sabotage button that said "−25 fitness, 500
 * Bones" would be §8.4's supplement wearing a hat: a correct rule with its price in the wrong
 * units. §13's road is a *percentage* edge whose cash value is the stake, and a player who cannot
 * see the stake and the fine in the same sentence cannot price the fee against either.
 *
 * Five numbers, all in Bones, all at the stake actually dialled in: what the fee is, what the edge
 * is worth on that stake, what the purse moves if the dog is yours, what the stewards cost you if
 * they notice, and what the whole thing comes to. The odds are the **posted** ones, because they
 * are what the bookie will still be quoting after the job is done — that divergence is the road.
 */
export interface FixPrice {
  /** The man taking the job this weekend — his name and his grade (GDD §13). */
  fixer: FixerOffer;
  fee: number;
  catchRate: number;
  /** The fine if the stewards notice, at this stake. */
  fine: number;
  target: RaceEntry;
  /** The runner the stale board is most wrong about once the target has been got at. */
  back: RaceEntry;
  /** Expected return per Bone staked on `back`, minus the Bone. */
  edge: number;
  bettingGain: number;
  purseGain: number;
  expectedCost: number;
  net: number;
  /** Stake at which the whole thing breaks even, or null where no stake ever does. */
  breakEven: number | null;
}

export function priceASabotage(
  s: GameState,
  me: Player,
  race: RaceTypeId,
  stake: number,
): FixPrice | null {
  const field = s.fields?.find((f) => f.race === race)?.entries;
  if (!field || !field.length) return null;
  // Whoever the book has shortest, and not one of ours — you cannot nobble your own.
  let favIdx = -1;
  field.forEach((e, k) => {
    if (e.ownerId === me.id) return;
    if (favIdx < 0 || e.winProb > field[favIdx]!.winProb) favIdx = k;
  });
  if (favIdx < 0) return null;
  const after = field.map((e, k) =>
    k === favIdx ? Math.max(5, e.rating - SABOTAGE_RATING_POINTS) : e.rating,
  );
  const trueP = winProbabilities(after);
  let bestIdx = -1;
  let bestEdge = 0;
  field.forEach((e, k) => {
    if (k === favIdx) return;
    const edge = trueP[k]! * e.odds - 1;
    if (bestIdx < 0 || edge > bestEdge) {
      bestIdx = k;
      bestEdge = edge;
    }
  });
  if (bestIdx < 0) return null;
  const back = field[bestIdx]!;
  // ⚠️ Both halves of the price are **this weekend's man** (E-D45): what he charges for the job,
  // and how well he covers his tracks. So the counter under the odds moves from planet to planet
  // with whoever is drinking there, which is the road being something you find rather than
  // something you hold.
  const fixer = s.planet.fixer;
  if (!fixer) return null;
  const fee = jobCost('sabotage', fixer.tier);
  const catchRate = fixCatchRate(s, fixer.tier);
  const fine = Math.round(balance.fixFineBase + balance.fixFineStakeMult * stake);
  const bettingGain = Math.round(bestEdge * stake);
  const purseGain =
    back.ownerId === me.id
      ? Math.round((trueP[bestIdx]! - back.winProb) * purseFor(s, race)[0])
      : 0;
  const expectedCost = Math.round(fee + catchRate * fine);
  // Net of the *rate* per Bone, so the break-even is the stake at which the fixed costs are covered.
  const netRate = bestEdge - catchRate * balance.fixFineStakeMult;
  const fixed = fee + catchRate * balance.fixFineBase - purseGain;
  return {
    fee,
    fixer,
    catchRate,
    fine,
    target: field[favIdx]!,
    back,
    edge: bestEdge,
    bettingGain,
    purseGain,
    expectedCost,
    net: bettingGain + purseGain - expectedCost,
    breakEven: netRate > 0 ? Math.ceil(fixed / netRate) : null,
  };
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
