import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { raceType } from '../content/raceTypes';
import { winProbabilities } from '../race/odds';
import { baseRating, dogValue } from '../economy/dogValue';
import { calendarEntry, eligible, FREE_HORIZON, player, purseFor, thisWeeksCard } from '../state';
import { GOODS, good, STAPLE_ID, type Good } from '../content/goods';
import { expectedPrice } from '../economy/food';
import { cargoTotal, HOLD_CAP } from '../economy/goods';
import {
  type Action,
  type Cargo,
  type Dog,
  type GoodId,
  type GameState,
  type Id,
  type Planet,
  type Player,
  type RaceTypeId,
  type StatKey,
} from '../types';

export function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/** Ratings the AI expects to face in a race: declared rivals so far, locals for the rest. */
export function expectedField(
  s: GameState,
  race: RaceTypeId,
  excludePlayer: Id,
  ratingOf: (d: Dog) => number = (d) => d.rating,
): number[] {
  const major = calendarEntry(s).major;
  const mid = raceType(race).localRating + (major ? balance.localRatingMajorBonus : 0);
  const ratings: number[] = [];
  for (const [pid, dogId] of Object.entries(s.declarations[race])) {
    if (pid === excludePlayer) continue;
    const d = s.dogs[dogId];
    if (d) ratings.push(ratingOf(d));
  }
  while (ratings.length < balance.traps - 1) ratings.push(mid);
  return ratings;
}

/**
 * A dog is only as good as its rating says until you look at the stat bars: a race result moves
 * the rating, but a trainer's week and a track-day pass move the *stats* and leave the rating
 * where it was. So a well-drilled dog is quietly better than its number — it still runs in the
 * class its rating allows, and the bookie still prices the number. Any player can see this on
 * the DogCard; Hard is the difficulty that acts on it.
 */
export function effectiveRating(d: Dog): number {
  return Math.max(d.rating, baseRating(d));
}

/** Expected prize money for running `dog` in a race (P(win)×1st + P(2nd)×2nd + P(3rd)×3rd, roughly). */
export function expectedPurse(
  s: GameState,
  dog: Dog,
  race: RaceTypeId,
  playerId: Id,
  rating: number = dog.rating,
  rivalRatingOf?: (d: Dog) => number,
): number {
  const others = expectedField(s, race, playerId, rivalRatingOf);
  const p = winProbabilities([rating, ...others])[0]!;
  const purse = purseFor(s, race);
  // Places: a cheap approximation of Harville that keeps the AI fast.
  const p2 = Math.min(1 - p, p * 1.2);
  const p3 = Math.min(1 - p - p2, p * 1.1);
  return p * purse[0] + p2 * purse[1] + p3 * purse[2];
}

export interface Assignment {
  /** race type → the dog we run in it. Only races on this weekend's card ever appear. */
  plan: Partial<Record<RaceTypeId, Id>>;
  value: number;
}

export interface AssignmentOptions {
  /**
   * Scale on the "is this race worth the fitness and the injury risk?" bar. Hard raises it in
   * the week before a Major so a marginal run does not cost it the race that matters.
   */
  minPurseScale?: number;
  /** Dogs held out of every race this week whatever the numbers say. */
  hold?: ReadonlySet<Id>;
  /**
   * Dogs the state policy would rather rest or train, but which will take a trap the first pass
   * left empty. GDD §5.2: "a dog at 60 is now a dog you might *choose* to run when you are short
   * of runners, which is the decision Race/Train/Rest exists to create." A flat fitness threshold
   * would delete that decision — it would leave a trap to the locals rather than run a tired dog,
   * whatever the race was worth.
   */
  reserve?: ReadonlySet<Id>;
  /** Below this fitness a dog is not worth running at all: the injury roll doubles (GDD §5.2). */
  reserveFloor?: number;
  /**
   * How to rate our own dog when working out what a race is worth. Defaults to the public
   * rating, which is what the bookie and the class caps use; Hard passes `effectiveRating`.
   */
  ratingOf?: (d: Dog) => number;
  /**
   * How to rate **rivals'** declared dogs, when that should not be the public rating either.
   *
   * ⚠️ **This exists because of an asymmetry that cost Hard two and a half points of head-to-head
   * for four phases without anybody noticing (E-D47).** Hard has rated its own dogs by their stats
   * since M4 — a well-drilled dog is quietly better than its number — and `expectedField` went on
   * rating everybody else's by the number. So every race Hard priced compared a generous estimate
   * of itself against a plain one of the field, and it systematically thought it was more likely
   * to win than it was. That is not "acting on information the bookie has not got"; it is
   * arithmetic with two different rulers.
   */
  rivalRatingOf?: (d: Dog) => number;
}

/**
 * Best one-dog-per-race assignment by expected purse (GDD §14 Normal).
 *
 * The search enumerates one dog per race **on this weekend's card**, which is what makes it a
 * different question from v1's: the three races are drawn rather than fixed, and which of a
 * stable's dogs are even allowed into them changes week to week (GDD §6.3). A stable that cannot
 * fill the card leaves traps to the locals, and that is the force D2 is counting on.
 */
export function bestAssignment(
  s: GameState,
  p: Player,
  candidates: Dog[] = ownDogs(s, p),
  opts: AssignmentOptions = {},
): Assignment {
  const card = thisWeeksCard();
  const scale = opts.minPurseScale ?? 1;
  const available = candidates.filter((d) => d.injuryWeeks === 0 && !opts.hold?.has(d.id));
  const dogs = available.filter((d) => !opts.reserve?.has(d.id));
  let best: Assignment = { plan: {}, value: 0 };
  const ev = new Map<string, number>();
  for (const d of available) {
    for (const race of card) {
      if (eligible(d, race))
        ev.set(
          `${d.id}|${race}`,
          expectedPurse(
            s,
            d,
            race,
            p.id,
            opts.ratingOf ? opts.ratingOf(d) : d.rating,
            opts.rivalRatingOf,
          ),
        );
    }
  }
  // Enumerate: each race gets at most one distinct dog (or nobody). ≤5 dogs → tiny search.
  const recurse = (
    ci: number,
    used: Set<Id>,
    plan: Partial<Record<RaceTypeId, Id>>,
    value: number,
  ) => {
    if (ci === card.length) {
      if (value > best.value) best = { plan: { ...plan }, value };
      return;
    }
    const race = card[ci]!;
    recurse(ci + 1, used, plan, value); // leave the trap to the locals
    for (const d of dogs) {
      if (used.has(d.id)) continue;
      const v = ev.get(`${d.id}|${race}`);
      // Not worth the fitness and injury risk: leave the trap to the locals.
      if (v === undefined || v < (balance.aiMinExpectedPurse + 0.012 * dogValue(d)) * scale)
        continue;
      // A tired dog costs future races: discount below the fitness scaling threshold.
      const fatigue = d.fitness < balance.fitnessScaleBelow ? 0.8 : 1;
      used.add(d.id);
      plan[race] = d.id;
      recurse(ci + 1, used, plan, value + v * fatigue);
      used.delete(d.id);
      delete plan[race];
    }
  };
  recurse(0, new Set(), {}, 0);

  // Short of runners: offer the reserve to whatever the first pass left to the locals. They are
  // still priced by the same EV bar and still carry the fatigue discount, so a jaded dog takes a
  // trap only when the race is worth more than the week off — which is the choice GDD §5.2 wants
  // a player weighing, and the reason the fitness floor is a preference rather than a rule.
  const floor = opts.reserveFloor ?? balance.injuryLowFitnessBelow;
  const spare = available.filter((d) => opts.reserve?.has(d.id) && d.fitness >= floor);
  if (spare.length) {
    const taken = new Set<Id>(Object.values(best.plan));
    for (const race of card) {
      if (best.plan[race]) continue;
      let pick: { d: Dog; v: number } | null = null;
      for (const d of spare) {
        if (taken.has(d.id)) continue;
        const v = ev.get(`${d.id}|${race}`);
        if (v === undefined || v < (balance.aiMinExpectedPurse + 0.012 * dogValue(d)) * scale)
          continue;
        const fatigue = d.fitness < balance.fitnessScaleBelow ? 0.8 : 1;
        if (!pick || v * fatigue > pick.v) pick = { d, v: v * fatigue };
      }
      if (pick) {
        best.plan[race] = pick.d.id;
        best.value += pick.v;
        taken.add(pick.d.id);
      }
    }
  }
  return best;
}

/** How many food units the stable eats each week. */
export function weeklyFoodNeed(s: GameState, p: Player): number {
  let need = 0;
  for (const d of ownDogs(s, p)) need += d.traits.includes('glutton') ? 2 : 1;
  return need * balance.foodPerDog * (p.sponsorWeeks > 0 ? 2 : 1);
}

/**
 * Cash the AI keeps back: two weeks of the staple's dinners at the top of its band.
 *
 * ⚠️ **There is no bill left to reserve against (GDD_V3 V10)** — food is charged to the dog, not the
 * purse (§6.3) — so the reserve is only the guarantee that a stable which has just spent everything
 * on a trading leg can still buy dinner next week at the worst price the staple can post. Derived
 * from the staple's own ceiling rather than from a tunable of its own: it is a fact about the band,
 * not a policy.
 */
export function reserveCash(s: GameState, p: Player): number {
  return weeklyFoodNeed(s, p) * good(STAPLE_ID).ceiling * 2;
}

/** The stat a trainer should work on: the weakest one, weighted by how much rating cares. */
export function weakestWeightedStat(d: Dog): StatKey {
  const weighted: [number, StatKey][] = [
    [d.speed / balance.ratingWeightSpeed, 'speed'],
    [d.accel / balance.ratingWeightAccel, 'accel'],
    [d.stamina / balance.ratingWeightStamina, 'stamina'],
  ];
  weighted.sort((a, b) => a[0] - b[0]);
  return weighted[0]![1];
}

/**
 * A deterministic pseudo-random number in [0, 1) from any key parts. `decide()` is handed no
 * rng — it must not consume the one in GameState, or the state it reads would no longer be the
 * state the reducer replays from — so an AI that wants to be unpredictable hashes the season
 * seed, the week and the ids instead. Only ^, >>> and Math.imul, all exact on every engine.
 */
export function hash01(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const text = typeof part === 'number' ? part.toString(36) : part;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Weeks until the next Major: 0 if this week is one, Infinity if the season has none left. */
export function weeksToMajor(s: GameState): number {
  for (let w = s.week; w <= balance.weeks; w++) {
    if (s.calendar[w - 1]?.major) return w - s.week;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * The planet the calendar says we reach in `weeksAhead` weeks, or null past the Grand Final.
 *
 * ⚠️ **This is the AI's only window onto the circuit, and it is deliberately narrow.** GDD §9.3
 * hides everything past next week, and §14 requires every difficulty to see exactly what a player
 * sees. `GameState.calendar` carries the whole season because it has to — the reducer builds it
 * once — so nothing but this guard stops an AI reading week 11 in week 3 and nothing would *fail*
 * if it did: Hard would just quietly stay too good. Asking beyond the free horizon throws rather
 * than returning null, so the mistake is loud.
 */
export function planetAhead(s: GameState, weeksAhead: number): Planet | null {
  if (weeksAhead > FREE_HORIZON) {
    throw new Error(
      `The circuit is dark past ${FREE_HORIZON} week ahead (GDD §9.3) — the AI may not read week ${s.week + weeksAhead}`,
    );
  }
  const e = s.calendar[s.week - 1 + weeksAhead];
  return e ? planetOf(e.planetId) : null;
}

// ---------------------------------------------------------------------------------------------
// A stable's turn, as steps. Every difficulty composes these rather than reimplementing them:
// the Plan carries the cash and cargo the AI *will* have once the actions it has already queued
// have landed, so it never issues an action the reducer would reject.
// ---------------------------------------------------------------------------------------------

export interface Plan {
  s: GameState;
  p: Player;
  playerId: Id;
  out: Action[];
  cash: number;
  /** The hold as it will stand once the queued TradeFood actions have landed. */
  cargo: Cargo;
  reserve: number;
  /**
   * Crates already claimed off each shelf this phase.
   *
   * Two steps buy goods now — `buyFeedPlan` for the dogs and `tradeFoodPlan` for the spread — and
   * the shelf is finite. Without this the second step reads the shelf as it was before the first
   * step's action was queued and the reducer rejects the buy. The Plan exists precisely so an agent
   * never issues an action the reducer would refuse.
   */
  shelfTaken: Map<GoodId, number>;
  /** What the stable will own once this phase's buys and sells have landed. */
  kennel: Dog[];
}

export function startPlan(s: GameState, playerId: Id): Plan {
  const p = player(s, playerId);
  return {
    s,
    p,
    playerId,
    out: [],
    cash: p.cash,
    cargo: { ...p.cargo },
    shelfTaken: new Map(),
    reserve: reserveCash(s, p),
    kennel: ownDogs(s, p),
  };
}

/*
 * ⚠️ **`ratingPerTrainWeek` is deleted, and so is the one decision that used it.**
 *
 * It priced a week in the yard — the trainer's points on the chosen stat plus whatever the dog ate —
 * and Hard's `trainThroughCheapWeeks` compared that against the purse the dog was passing up. Both
 * rest on a premise v3 removes: that food reaches a dog only on a week it does not race. GDD_V3 §6.3
 * feeds **every** dog **every** week whatever it is doing, so resting buys fitness and nothing else,
 * and a comparison whose right-hand side is a rating gain the dog gets anyway is not a comparison.
 *
 * ⚠️ **Measured before deleting, and it was already inert**: 200 seasons of three Hard against three
 * Normal are identical to the last Bone with the flag on and off (43,625 / 39,279 either way, 48.4%
 * head to head). With the trainer gone the gain was ~0.7 rating points, which never clears
 * `(better − now) × weeksLeft × 0.66 > now`. So this is a deletion of dead code rather than of a
 * behaviour, which is worth knowing because the *notes* will say Hard lost a §14 behaviour here and a
 * reader would otherwise expect a number to have moved.
 *
 * Phase B wants the pricing back — six foods with real effects is exactly when "which food is worth
 * buying" becomes a decision — and `git show v3a~2:packages/engine/src/ai/shared.ts` has it.
 */

export interface FeedBuyOptions {
  /** Weeks of dinner to keep aboard. */
  weeks?: number;
  /** Buy the dearest food on the shelf whether or not anything will eat it. Easy's weakness. */
  reckless?: boolean;
}

/**
 * Make sure the yard can eat (GDD_V3 §6.3), before anything is bought to trade.
 *
 * ⚠️ **Dinner is the cheapest thing aboard until the diet lands** (item 4 of this phase), so this
 * keeps `weeks` of dinners of the *staple* aboard and nothing else: a crate of Vat Steak bought to
 * sell next week is safe in the hold only while there is Grey Mash in front of it, because §6.3's
 * fallback feeds the cheapest good first. An agent that forgot this would eat its own trading leg.
 *
 * `reckless` is D26's fix carried over, and it is the only line here that is deliberately bad: an
 * Easy stable buys the dearest crate on the shelf whether or not it can sell it at a profit, which
 * is the weakness that **costs it money while it is still racing**. Every other handicap §14 gives
 * Easy is a saving.
 */
export function buyFeedPlan(plan: Plan, opts: FeedBuyOptions = {}): void {
  const { s, p, playerId, out } = plan;
  if (!s.toggles.trading) return;

  if (opts.reckless) {
    const dear = [...GOODS]
      .filter((g) => availableHere(plan, g.id) > 0)
      .sort((a, b) => s.planet.goods[b.id].buy - s.planet.goods[a.id].buy)[0];
    if (dear && HOLD_CAP - cargoTotal(plan.cargo) > 0 && plan.cash >= s.planet.goods[dear.id].buy)
      buy(plan, dear.id, 1);
    return;
  }

  const want = weeklyFoodNeed(s, p) * (opts.weeks ?? 2);
  const have = plan.cargo[STAPLE_ID];
  if (have >= want) return;
  const price = s.planet.goods[STAPLE_ID].buy;
  const units = Math.min(
    want - have,
    availableHere(plan, STAPLE_ID),
    HOLD_CAP - cargoTotal(plan.cargo),
    Math.floor(Math.max(0, plan.cash) / Math.max(1, price)),
  );
  if (units > 0) buy(plan, STAPLE_ID, units);
  void playerId;
  void out;
}

export interface StateOptions {
  /**
   * Fitness at or above which a dog is offered to the race card at all.
   *
   * ⚠️ **The only knob left, and it is now the whole of an agent's weekly rule.** `restBelow` and
   * `train` went with Train (GDD_V3 §4.2): "race above 65, rest below 45, train in between" had
   * three cases and a binary state has one, so a dog either clears this line or it rests. Which
   * means the difference between Easy, Normal and Hard's *week* is a single number — and any real
   * difference between them now has to live in which dogs they enter, not in what they do with the
   * rest of the yard.
   */
  raceAbove?: number;
}

/**
 * Dogs the state policy will not offer to the race card this week (GDD §14). Fed to
 * `bestAssignment` as its `hold`, so the fitness rule decides what races before the expected
 * purse does.
 */
export function stateHold(plan: Plan, opts: StateOptions = {}): Set<Id> {
  const raceAbove = opts.raceAbove ?? 65;
  const hold = new Set<Id>();
  for (const d of plan.kennel) {
    if (d.injuryWeeks > 0) continue; // Layoff decides for itself
    if (d.fitness < raceAbove) hold.add(d.id);
  }
  return hold;
}

/**
 * Set every dog that is not racing to **Rest** (GDD_V3 §4.2). Run *after* the declarations, because
 * Declare already sets a runner to 'race' — so this only ever touches the dogs left in the yard, and
 * never trips setDogState's "withdraw it from its race first".
 *
 * ⚠️ **There is no Train to choose any more, so this is no longer a policy — it is bookkeeping.**
 * `StateOptions.train` and `restBelow` were the whole of the difference between Easy, Normal and
 * Hard's weekly rule ("race above 65, rest below 45, train in between"), and with a binary state the
 * only decision left is *which dogs to enter*, which `stateHold` and `bestAssignment` make. The
 * options are kept in the signature because all three agents pass them and Phase B's diet decision
 * (§6.3's sticky named food / best available / worst available) lands here — but they no longer do
 * anything, and an agent difference that used to live here has to be found somewhere else.
 *
 * `weakestWeightedStat` still sets `trainStat`, which is now the dog's **diet pointer** rather than
 * its training focus. Nothing reads it in Phase A; Phase B's six goods do.
 */
export function setStates(plan: Plan, racing: ReadonlySet<Id>): void {
  const { playerId, out } = plan;
  for (const d of plan.kennel) {
    if (racing.has(d.id)) continue;
    if (d.injuryWeeks > 0) continue; // Layoff: nothing to choose
    const stat = weakestWeightedStat(d);
    if (d.weekState === 'rest' && d.trainStat === stat) continue;
    out.push({ t: 'SetDogState', playerId, dogId: d.id, state: 'rest', stat });
    d.weekState = 'rest';
    d.trainStat = stat;
  }
}

export interface FoodOptions {
  /**
   * Fill the hold whatever the margins say. Hard does this the week before Blackreach, where the
   * black hole drags the heavy ships in first and first look at the market is worth more than the
   * spread (GDD §12).
   */
  fillHold?: boolean;
  /** Fraction of the spare cash (above the reserve) this step may commit to trading legs. */
  goodsSpend?: number;
}

/** Crates of one good this stable can still buy here, after whatever it has already queued. */
export function availableHere(plan: Plan, id: GoodId): number {
  return Math.max(0, plan.s.planet.goods[id].stock - (plan.shelfTaken.get(id) ?? 0));
}

function claim(plan: Plan, id: GoodId, crates: number): void {
  plan.shelfTaken.set(id, (plan.shelfTaken.get(id) ?? 0) + crates);
}

/** Queue a buy, and move the Plan's cash, hold and shelf as the reducer will. */
function buy(plan: Plan, id: GoodId, units: number): void {
  const price = plan.s.planet.goods[id].buy;
  plan.out.push({ t: 'TradeFood', playerId: plan.playerId, good: id, units });
  plan.cargo[id] += units;
  plan.cash -= units * price;
  claim(plan, id, units);
}

/** Queue a sale, likewise. */
function sell(plan: Plan, id: GoodId, units: number): void {
  const price = plan.s.planet.goods[id].sell;
  plan.out.push({ t: 'TradeFood', playerId: plan.playerId, good: id, units: -units });
  plan.cargo[id] -= units;
  plan.cash += units * price;
}

/**
 * What a crate of this good is expected to fetch at next week's planet, or null past the Grand
 * Final. **The engine's own `expectedPrice`**, so an AI trades on exactly the number the Market
 * screen prints for a player under "next stop" (§14: every difficulty sees what a player sees).
 */
function expectedSellNext(plan: Plan, id: GoodId): number | null {
  const next = planetAhead(plan.s, 1);
  return next ? expectedPrice(next, id) * (1 - balance.foodSpread) : null;
}

/**
 * Sell, then buy, the six goods against next week's planet (GDD_V3 §6.1, §6.4).
 *
 * **Sell** anything whose price here already beats what next week's planet is expected to pay —
 * and everything, bar dinner, past the Grand Final. The dinner the yard eats at the jump is never
 * sold: it is the staple, kept by `buyFeedPlan`, and selling it would be trading the dogs' fitness
 * for a spread.
 *
 * **Buy** the goods whose expected margin beats `aiGoodsMarginMin` of their price, greedily, with
 * the one piece of judgement §6.1 says the whole progression is about:
 *
 * - while the **cash** binds — the budget could not fill the room left with the best crate on the
 *   shelf — take the best margin *per Bone*, because the question is what the money is worth;
 * - once the **hold** binds, take the best margin *per crate*, because the question is what the
 *   space is worth, and that is the dear stuff.
 *
 * That test, made afresh each pick, is how a stable graduates up the ladder without being told to,
 * and it is the same crossover the harness measures from the outside.
 */
export function tradeFoodPlan(plan: Plan, opts: FoodOptions = {}): void {
  const { s, p } = plan;
  if (!s.toggles.trading) return;
  const dinner = weeklyFoodNeed(s, p);

  // ---- Sell ----
  for (const g of GOODS) {
    const keep = g.id === STAPLE_ID ? Math.min(plan.cargo[g.id], dinner) : 0;
    const spare = plan.cargo[g.id] - keep;
    if (spare <= 0) continue;
    const next = expectedSellNext(plan, g.id);
    const here = s.planet.goods[g.id].sell;
    if (next === null || here >= next) sell(plan, g.id, spare);
  }

  // ---- Buy ----
  let budget = Math.max(0, plan.cash - plan.reserve) * (opts.goodsSpend ?? 0.8);
  let room = HOLD_CAP - cargoTotal(plan.cargo);
  const legs: { g: Good; price: number; margin: number }[] = [];
  for (const g of GOODS) {
    const next = expectedSellNext(plan, g.id);
    if (next === null) continue;
    const price = s.planet.goods[g.id].buy;
    const margin = next - price;
    if (opts.fillHold || margin > price * balance.aiGoodsMarginMin) legs.push({ g, price, margin });
  }
  while (legs.length && room > 0 && budget > 0) {
    const perCrate = [...legs].sort((a, b) => b.margin - a.margin)[0]!;
    const holdBinds = budget >= room * perCrate.price;
    const pick = holdBinds
      ? perCrate
      : [...legs].sort((a, b) => b.margin / b.price - a.margin / a.price)[0]!;
    legs.splice(legs.indexOf(pick), 1);
    const units = Math.min(
      availableHere(plan, pick.g.id),
      room,
      Math.floor(budget / Math.max(1, pick.price)),
    );
    if (units <= 0) continue;
    buy(plan, pick.g.id, units);
    budget -= units * pick.price;
    room -= units;
  }
}

/** The dogs an assignment actually runs — what `setStates` treats as spoken for. */
export function racingDogs(assignment: Assignment): Set<Id> {
  const out = new Set<Id>();
  for (const id of Object.values(assignment.plan)) if (id) out.add(id);
  return out;
}

/** Turn a chosen assignment into Declare actions, skipping the ones already standing. */
export function emitDeclarations(plan: Plan, assignment: Assignment): void {
  const { s, playerId, out } = plan;
  for (const race of thisWeeksCard()) {
    const dogId = assignment.plan[race] ?? null;
    if ((s.declarations[race][playerId] ?? null) !== dogId)
      out.push({ t: 'Declare', playerId, race, dogId });
  }
}

/** Declare the best assignment available (GDD §14 Normal). Returns it, for callers who care. */
export function declareBest(plan: Plan, opts: AssignmentOptions = {}): Assignment {
  const assignment = bestAssignment(plan.s, plan.p, plan.kennel, opts);
  emitDeclarations(plan, assignment);
  return assignment;
}

export interface BetOptions {
  minProb?: number;
  fraction?: number;
  cap?: number;
}

/** Small bets on the favourites (GDD §14 Normal). */
export function betFavourites(plan: Plan, opts: BetOptions = {}): void {
  const { s, playerId, out } = plan;
  if (!s.fields) return;
  const minProb = opts.minProb ?? balance.aiBetMinProb;
  const fraction = opts.fraction ?? balance.aiBetFraction;
  const cap = opts.cap ?? 500;
  for (const { race, entries } of s.fields) {
    const fav = [...entries].sort((a, b) => b.winProb - a.winProb)[0];
    if (!fav || fav.winProb < minProb) continue;
    const stake = Math.floor(Math.min(plan.cash * fraction, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, race, dogId: fav.dogId, kind: 'win', stake });
    plan.cash -= stake;
  }
}
