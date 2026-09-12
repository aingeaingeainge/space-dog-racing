import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { LOCAL_RATING_BY_TIER, raceType } from '../content/raceTypes';
import { winProbabilities } from '../race/odds';
import { baseRating, dogValue } from '../economy/dogValue';
import { calendarEntry, eligible, FREE_HORIZON, player, purseFor, thisWeeksCard } from '../state';
import {
  bestFeedAboard,
  feedsFor,
  GOODS,
  KIBBLE_ID,
  STOCK_UNLIMITED,
  TIER_ORDER,
  type Good,
} from '../content/goods';
import { cargoTotal } from '../economy/goods';
import { buyPriceFor, cargoCap, hasStaff, trainerPoints, wageBill } from '../economy/staff';
import {
  RACE_TYPE_IDS,
  STAT_KEYS,
  type Action,
  type Cargo,
  type Dog,
  type GoodId,
  type StaffId,
  type StaffRole,
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
export function expectedField(s: GameState, race: RaceTypeId, excludePlayer: Id): number[] {
  const major = calendarEntry(s).major;
  const mid =
    LOCAL_RATING_BY_TIER[raceType(race).tier] + (major ? balance.localRatingMajorBonus : 0);
  const ratings: number[] = [];
  for (const [pid, dogId] of Object.entries(s.declarations[race])) {
    if (pid === excludePlayer) continue;
    const d = s.dogs[dogId];
    if (d) ratings.push(d.rating);
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
): number {
  const others = expectedField(s, race, playerId);
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
  const card = thisWeeksCard(s);
  const scale = opts.minPurseScale ?? 1;
  const available = candidates.filter(
    (d) => d.injuryWeeks === 0 && d.banWeeks === 0 && !opts.hold?.has(d.id),
  );
  const dogs = available.filter((d) => !opts.reserve?.has(d.id));
  let best: Assignment = { plan: {}, value: 0 };
  const ev = new Map<string, number>();
  for (const d of available) {
    for (const race of card) {
      if (eligible(d, race))
        ev.set(
          `${d.id}|${race}`,
          expectedPurse(s, d, race, p.id, opts.ratingOf ? opts.ratingOf(d) : d.rating),
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

/** Cash the AI keeps back for a fortnight of bills — the wage bill included, whatever it is. */
export function reserveCash(s: GameState, p: Player): number {
  const dogs = ownDogs(s, p).length;
  const weekly =
    dogs * balance.upkeepPerDog +
    balance.fuelBase +
    wageBill(p) +
    weeklyFoodNeed(s, p) * balance.foodPriceMax;
  return weekly * 2;
}

/** The stat a trainer should work on: the weakest one, weighted by how much rating cares. */
export function weakestWeightedStat(d: Dog): StatKey {
  const weighted: [number, StatKey][] = [
    [d.speed / balance.ratingWeightSpeed, 'speed'],
    [d.accel / balance.ratingWeightAccel, 'accel'],
    [d.stamina / balance.ratingWeightStamina, 'stamina'],
    [d.trap / balance.ratingWeightTrap, 'trap'],
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
  /** Slots already committed this phase, so two steps cannot both fill the last one. */
  hired: number;
  hiredRoles: Set<StaffRole>;
  takenStaff: Set<StaffId>;
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
    hired: 0,
    hiredRoles: new Set(),
    takenStaff: new Set(),
    shelfTaken: new Map(),
    reserve: reserveCash(s, p),
    kennel: ownDogs(s, p),
  };
}

/**
 * Harness-only: force one stable to **stack** a single role (GDD §8.3, D7).
 *
 * D7's acceptance row asks whether three of one role beats a mixed three by more than 5 points of
 * head-to-head, and a real head-to-head means both lines in the same season — so the override is per
 * stable rather than global. `keepStaff` is the only reader; nothing a player can reach sets it, and
 * the harness clears it between runs.
 *
 * Note what stacking actually buys, because it is the answer the row is probing: `bestStaff` means a
 * second trainer adds **nothing** — the best one trains — so three trainers is three wages for one
 * effect. That is the no-stacking-penalty design working as intended (the price is the gate), and
 * this probe is what turns that reasoning into a number.
 */
export const STACK_OVERRIDE = new Map<Id, StaffRole>();

export interface HireOptions {
  /** Roles this agent will take on, most wanted first. */
  want?: StaffRole[];
  /**
   * Weeks of the wage the stable must be able to cover before it signs. The gate GDD §8.3 asks
   * for: a Prime trainer is 1,400 a week, so at `cover: 4` a stable needs 5,600 spare to reach
   * one and will take a Proper instead until it does.
   */
  cover?: number;
  /** Ignore the cover test and take the dearest thing on offer. The careless agent's line. */
  reckless?: boolean;
}

/**
 * What Normal will take on (GDD §14): the two roles that pay for themselves on a racing stable.
 *
 * Measured, not assumed. With `['trainer', 'vet', 'trader']` Normal filled all three slots, paid
 * 4,200 a week more and lost 12% of its end worth, because the Trader's hold is worth nothing to a
 * stable that does not work the spread. The roles that serve the *other* two roads belong to the
 * agents that play them — Hard, and BUILD_PLAN §7a.5's trader — which is decision quality rather
 * than a handicap.
 */
const DEFAULT_WANT: readonly StaffRole[] = ['trainer', 'vet'];

/**
 * Fill the staff slots (GDD §8.3, §14).
 *
 * One step for all six roles rather than a `keepTrainer` and a `keepVet`, because D7 made the
 * question "what is worth a slot" instead of "have I got one of each". Within a role it takes the
 * **best tier it can cover**, which is what makes the wage the gate rather than the tier list.
 *
 * Deterministic: offers are walked in the order the planet rolled them, and ties in tier are
 * broken by that order, so no randomness enters an agent's decision.
 */
export function keepStaff(plan: Plan, opts: HireOptions = {}): void {
  const { s, p, playerId, out } = plan;
  const forced = STACK_OVERRIDE.get(playerId);
  // A forced stacker wants the same role in every slot, so the walk below can fill all three.
  const want = forced
    ? (Array(balance.staffSlots).fill(forced) as StaffRole[])
    : (opts.want ?? DEFAULT_WANT);
  const cover = opts.cover ?? 4;
  const weeksLeft = balance.weeks - s.week + 1;
  let slots = balance.staffSlots - p.staff.length - plan.hired;
  if (slots <= 0) return;
  for (const role of want) {
    if (slots <= 0) return;
    // A forced stack takes the same role again; everything else takes one of each.
    if (!forced && (hasStaff(p, role) || plan.hiredRoles.has(role))) continue;
    if (forced && plan.hiredRoles.has(role)) continue;
    const offers = s.planet.staff.filter((o) => o.role === role && !plan.takenStaff.has(o.id));
    if (!offers.length) continue;
    // Best tier first, then whatever the stable can actually cover.
    const ranked = [...offers].sort(
      (a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier),
    );
    const weeks = Math.min(cover, weeksLeft);
    const pick = opts.reckless
      ? ranked[0]
      : ranked.find((o) => plan.cash > plan.reserve + o.wage * weeks);
    if (!pick) continue;
    if (opts.reckless && plan.cash <= pick.wage) continue;
    out.push({ t: 'HireStaff', playerId, staffId: pick.id });
    plan.cash -= pick.wage;
    plan.hired++;
    if (!forced) plan.hiredRoles.add(role);
    plan.takenStaff.add(pick.id);
    slots--;
  }
}

/**
 * Rating points one Train week is worth: the trainer's points on the chosen stat, plus whatever
 * the dog eats (GDD §8.2, §8.3).
 *
 * The feed half is what Phase C adds. A stable with Prime speed feed aboard gets +4–6 on the stat
 * it chose rather than +1–3 on a random one, which is close to four times the rating for the same
 * week — so an agent that does not price the feed will rest dogs it should be training.
 */
export function ratingPerTrainWeek(p: Player): number {
  const trainer = trainerPoints(p);
  const meanWeight =
    (balance.ratingWeightSpeed +
      balance.ratingWeightAccel +
      balance.ratingWeightStamina +
      balance.ratingWeightTrap) /
    4;
  // The floor: plain kibble, on a random stat, so it is worth the mean weight.
  const kibble = ((balance.trainKibbleMin + balance.trainKibbleMax) / 2) * meanWeight;
  // Whatever feed is aboard lands on the stat the dog is on. Priced on the best crate in the hold,
  // which is what `trainOneWeek` will actually feed.
  let feed = 0;
  for (const stat of STAT_KEYS) {
    const g = bestFeedAboard(p.cargo, stat);
    if (!g) continue;
    const gain = ((g.gainMin + g.gainMax) / 2) * RATING_WEIGHT[stat];
    if (gain > feed) feed = gain;
  }
  return trainer * meanWeight + Math.max(kibble, feed);
}

const RATING_WEIGHT: Record<StatKey, number> = {
  speed: balance.ratingWeightSpeed,
  accel: balance.ratingWeightAccel,
  stamina: balance.ratingWeightStamina,
  trap: balance.ratingWeightTrap,
};

export interface FeedBuyOptions {
  /** Crates to aim for per stat being trained. */
  crates?: number;
  /** Fraction of the spare cash this step may spend. */
  spend?: number;
  /** Buy the dearest feed on the shelf whether or not a dog is on that stat. Easy's weakness. */
  reckless?: boolean;
}

/**
 * Buy feed for the dogs that are going to train (GDD §8.2).
 *
 * Called **after** `setStates`, because what to buy depends on which dogs are training and which
 * stat each is on — and `setStates` is what decides both. A stable that already has a crate for
 * that stat buys nothing: the feed is consumed one crate per dog per Train week, so a hold with
 * one crate and three trainees is a real shortage the agent should notice.
 *
 * `reckless` is D26's fix, and it is the only line here that is deliberately bad: an Easy stable
 * buys the dearest crate on the shelf whether or not it has a dog to eat it, which is the first
 * weakness in the game that **costs it money while it is still racing**. Every other handicap §14
 * gives Easy — never hires, never bets, never buys — is a saving.
 */
export function buyFeedPlan(plan: Plan, opts: FeedBuyOptions = {}): void {
  const { s, p, playerId, out } = plan;
  if (!s.toggles.trading) return;
  const want = opts.crates ?? 2;
  const spendFraction = opts.spend ?? 0.5;
  let budget = Math.max(0, (plan.cash - plan.reserve) * spendFraction);
  const room = () => cargoCap(p) - cargoTotal(plan.cargo);

  const buy = (g: Good, crates: number): void => {
    const price = buyPriceFor(p, s.planet.goods[g.id].buy);
    const available = Math.min(
      availableHere(plan, g.id),
      room(),
      Math.floor(budget / Math.max(1, price)),
      crates,
    );
    if (available <= 0) return;
    out.push({ t: 'TradeFood', playerId, good: g.id, units: available });
    plan.cargo[g.id] += available;
    plan.cash -= available * price;
    budget -= available * price;
    claim(plan, g.id, available);
  };

  if (opts.reckless) {
    // The dearest thing on the shelf, one crate, with no thought for whether anything will eat it.
    const shelf = GOODS.filter((g) => g.stat && availableHere(plan, g.id) > 0).sort(
      (a, b) => s.planet.goods[b.id].buy - s.planet.goods[a.id].buy,
    );
    if (shelf[0]) buy(shelf[0], opts.crates ?? 1);
    return;
  }

  const training = plan.kennel.filter((d) => d.weekState === 'train' && d.injuryWeeks === 0);
  const byStat = new Map<StatKey, number>();
  for (const d of training) byStat.set(d.trainStat, (byStat.get(d.trainStat) ?? 0) + 1);
  // Most-wanted stat first, so a thin budget goes where the most dogs are working.
  const stats = [...byStat.entries()].sort((a, b) => b[1] - a[1]);
  for (const [stat, dogs] of stats) {
    const have = bestFeedAboard(plan.cargo, stat);
    const need = Math.max(0, Math.min(want, dogs) - (have ? plan.cargo[have.id] : 0));
    if (need <= 0) continue;
    // Best tier the budget reaches, which is how a good week buys Prime and a bad one buys Rough.
    const options = feedsFor(stat)
      .filter((g) => availableHere(plan, g.id) > 0)
      .sort((a, b) => TIER_ORDER.indexOf(b.tier!) - TIER_ORDER.indexOf(a.tier!));
    const pick = options.find((g) => buyPriceFor(p, s.planet.goods[g.id].buy) <= budget);
    if (pick) buy(pick, need);
  }
}

export interface StateOptions {
  /** Fitness at or above which a dog is offered to the race card at all. */
  raceAbove?: number;
  /** Below this, a dog that is not racing rests rather than trains. */
  restBelow?: number;
  /** Whether the stable trains at all. Easy does not. */
  train?: boolean;
  /**
   * Hard only: hold a dog out of a cheap week because the training is worth more than the purse
   * it is passing up. The first behaviour in the game that reasons about *later*, so it is a
   * flag rather than a constant, and the ablation table in the notes is what it is for.
   */
  trainThroughCheapWeeks?: boolean;
}

/**
 * Dogs the state policy will not offer to the race card this week (GDD §14). Fed to
 * `bestAssignment` as its `hold`, so the fitness rule decides what races before the expected
 * purse does — which is what makes "race above 65, rest below 45, train in between" a policy
 * rather than a label.
 */
export function stateHold(plan: Plan, opts: StateOptions = {}): Set<Id> {
  const { s, p } = plan;
  const raceAbove = opts.raceAbove ?? 65;
  const hold = new Set<Id>();
  const weeksLeft = balance.weeks - s.week;
  const gain = ratingPerTrainWeek(p);
  for (const d of plan.kennel) {
    if (d.injuryWeeks > 0 || d.banWeeks > 0) continue; // Layoff decides for itself
    if (d.fitness < raceAbove) {
      hold.add(d.id);
      continue;
    }
    if (
      opts.trainThroughCheapWeeks &&
      weeksLeft > 0 &&
      trainingBeatsRacing(plan, d, gain, weeksLeft)
    )
      hold.add(d.id);
  }
  return hold;
}

/**
 * Is a week in the yard worth more than the week's best purse? (GDD §14 Hard.)
 *
 * The purse passed up is what the dog would expect to win in the best race it can enter now.
 * The training is worth the *uplift* those rating points buy on every remaining race — priced
 * with the same `expectedPurse` the assignment search uses, so the two sides of the comparison
 * are measured with one instrument. It comes out true for a young or weak dog in a cheap week
 * and false in a Major, which is the behaviour §14 asks for and not a rule about ages.
 */
function trainingBeatsRacing(plan: Plan, d: Dog, gain: number, weeksLeft: number): boolean {
  const { s, p } = plan;
  let now = 0;
  let better = 0;
  for (const race of thisWeeksCard(s)) {
    if (!eligible(d, race)) continue;
    const rating = effectiveRating(d);
    now = Math.max(now, expectedPurse(s, d, race, p.id, rating));
    better = Math.max(better, expectedPurse(s, d, race, p.id, rating + gain));
  }
  if (now <= 0) return false;
  // It will not run every remaining week — two in three is what the fitness cycle allows.
  return (better - now) * weeksLeft * 0.66 > now;
}

/**
 * Set every dog that is not racing to Train or Rest (GDD §5.7). Run *after* the declarations,
 * because Declare already sets a runner to 'race' — so this only ever touches the dogs left in
 * the yard, and never trips setDogState's "withdraw it from its race first".
 */
export function setStates(plan: Plan, racing: ReadonlySet<Id>, opts: StateOptions = {}): void {
  const { playerId, out } = plan;
  const restBelow = opts.restBelow ?? 45;
  const mayTrain = opts.train ?? true;
  for (const d of plan.kennel) {
    if (racing.has(d.id)) continue;
    if (d.injuryWeeks > 0 || d.banWeeks > 0) continue; // Layoff: nothing to choose
    const train = mayTrain && d.fitness >= restBelow;
    const state = train ? 'train' : 'rest';
    const stat = weakestWeightedStat(d);
    if (d.weekState === state && (!train || d.trainStat === stat)) continue;
    out.push({
      t: 'SetDogState',
      playerId,
      dogId: d.id,
      state,
      ...(train ? { stat } : {}),
    });
    d.weekState = state;
    if (train) d.trainStat = stat;
  }
}

// Measured and rejected, again (v2 Phase A). GDD §5.2 and §6.4 reason that a dog takes about
// seven races in thirteen weeks and a three-race card has thirty-nine traps, so a stable wants
// five dogs — and the kennel module is how you get a fifth. The harness disagrees: buying it
// costs Normal five thousand Bones of end worth and nine points of head-to-head against Easy.
// The module is 2,000, the extra dog's upkeep another 1,950 over a season, and the five extra
// races it buys are the *cheapest* five, because the good races were already covered. This is
// M4's ship-upgrade finding surviving the rules that were supposed to overturn it, and it is
// why `dogs owned at week 13` comes in under its target: owning 4.5 dogs is not yet worth it.
// The lever is ship economics, which GDD §9.2 and §20 Q6 hand to Phase C.

/** Repay Fat Tony first, then the bank, out of anything above the reserve. */
export function repayLoans(plan: Plan): void {
  const { p, playerId, out } = plan;
  const loans = [...p.loans].sort((a) => (a.lender === 'shark' ? -1 : 1));
  for (const loan of loans) {
    const spare = plan.cash - plan.reserve;
    const amount = Math.min(loan.principal, Math.floor(spare));
    if (amount >= 100) {
      out.push({ t: 'Repay', playerId, lender: loan.lender, amount });
      plan.cash -= amount;
    }
  }
}

/**
 * Race types the kennel has nobody fit and eligible for (GDD §6.3). Measured over the whole pool
 * rather than this week's three, because the point of buying for coverage is the weeks you have
 * not seen yet — under the fog you cannot know which types are coming, only that a stable that
 * covers more of them fills more of the card.
 */
export function coverageGaps(kennel: readonly Dog[]): Set<RaceTypeId> {
  const gaps = new Set<RaceTypeId>();
  for (const race of RACE_TYPE_IDS) {
    const covered = kennel.some(
      (d) => eligible(d, race) && d.fitness >= balance.injuryLowFitnessBelow,
    );
    if (!covered) gaps.add(race);
  }
  return gaps;
}

export interface MarketOptions {
  /** Multiple of the asking price the stable insists on holding before it buys. */
  buyCashMultiple?: number;
  /** How much better than the worst dog a purchase has to be. */
  minRatingGain?: number;
  /** How much better it has to be to be worth selling the worst dog to make room. */
  minRatingGainForSwap?: number;
  /** Also buy a dog priced under this multiple of its book value — net worth counts dogs. */
  bargainFactor?: number;
  /** Never spend the reserve. */
  keepReserve?: boolean;
  /** Buy into an empty kennel slot without the rating comparison. Defaults to true. */
  fillEmptySlots?: boolean;
  /**
   * Rating points to credit a market dog with for each race type it covers that the kennel
   * cannot (GDD §6.3). This is what the fact-gated card gives a good stable to be clever about: a
   * 40-rated maiden is worth more to a kennel of finished dogs than its number says, because it
   * is the only runner they have for a third of the pool. Hard prices it; Normal buys on rating.
   */
  coverageGain?: number;
}

/** Buy a better dog when the stable can plainly afford one (GDD §14 Normal). */
export function dogMarket(plan: Plan, opts: MarketOptions = {}): void {
  const { s, p, playerId, out } = plan;
  const cashMultiple = opts.buyCashMultiple ?? balance.aiBuyCashMultiple;
  const gain = opts.minRatingGain ?? 3;
  const swapGain = opts.minRatingGainForSwap ?? 8;
  const dogs = plan.kennel;
  const worst = [...dogs].sort((a, b) => a.rating - b.rating)[0];
  // What the kennel cannot field, and what a dog on the market is worth for closing it.
  const gaps = opts.coverageGain ? coverageGaps(dogs) : new Set<RaceTypeId>();
  const worthOf = (d: Dog) =>
    d.rating +
    [...gaps].filter((race) => raceType(race).eligible(d)).length * (opts.coverageGain ?? 0);
  // The shared shelf plus whatever this stable's own Scout turned up, which nobody else can buy
  // (GDD §8.3). An agent that could not see its own finds would be paying a wage for nothing.
  const forSale = [...s.planet.marketDogIds, ...(s.planet.finds[playerId]?.dogIds ?? [])]
    .map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d && !d.fellOffAShip)
    .sort((a, b) => worthOf(b) - worthOf(a));
  const slotsFree = p.dogIds.length < p.kennelSlots;
  // An empty kennel is its own reason to buy. GDD §5.2 and §6.4: a dog can take about seven races
  // in thirteen weeks, so a three-race card wants five dogs, and a stable of three leaves a third
  // of the card to the locals however good those three are. Under v1's fitness numbers a fourth
  // dog was only ever an upgrade; under §5.7 it is a runner.
  const needBodies = opts.fillEmptySlots !== false && slotsFree;
  for (const d of forSale) {
    const price = d.askingPrice ?? dogValue(d);
    const bargain = opts.bargainFactor !== undefined && price <= dogValue(d) * opts.bargainFactor;
    if (plan.cash < price * cashMultiple) continue;
    if (opts.keepReserve && plan.cash - price < plan.reserve) continue;
    if (worst && worthOf(d) <= worst.rating + gain && !bargain && !needBodies) continue;
    if (!slotsFree) {
      if (!worst || dogs.length <= 1 || worthOf(d) < worst.rating + swapGain) continue;
      out.push({ t: 'SellDog', playerId, dogId: worst.id });
      plan.cash += Math.round(dogValue(worst) * balance.marketSellFactor);
      plan.kennel.splice(plan.kennel.indexOf(worst), 1);
    }
    out.push({ t: 'BuyDog', playerId, dogId: d.id });
    plan.cash -= price;
    plan.kennel.push(d);
    break;
  }
}

export interface FoodOptions {
  /**
   * Fill the hold whatever the spread says. Hard does this the week before Blackreach, where
   * the black hole drags the heavy ships in first and first look at the market is worth more
   * than the fuel (GDD §12).
   */
  fillHold?: boolean;
  /**
   * Work the spread on the **specialist feeds** as well as on kibble (GDD §9.2).
   *
   * Off by default, which is a statement about Normal rather than an oversight: kibble is the
   * staple every stable already handles, and a dearer inventory is the trader's road rather than
   * the racing stable's. §9.1 measured the reason it matters — blind carrying loses 9.5 a crate of
   * kibble, and a feed crate is five to eight times the price, so the same 15% weekly drift is
   * worth ten times as much per crate of hold.
   */
  workGoods?: boolean;
  /** Fraction of spare cash the goods arbitrage may commit. */
  goodsSpend?: number;
}

/**
 * The one good most worth moving from here to next week's planet, or null (GDD §9.2).
 *
 * Expected profit a crate is `next week's sell − what it costs here`, where next week's sell is
 * that planet's band mid × the good's own price multiplier × (1 − spread). The band is what a
 * stable can see for free (the Docks prints it, `planetAhead` allows it), so this is arbitrage on
 * *public* information — and that is the point of §9.2: the trader stops carrying and starts
 * **selecting**, which is worth +23.6 a crate against blind carrying's −9.5.
 *
 * One good rather than all thirteen, on purpose. The hold is the scarce thing, so the best crate
 * crowds out the second-best anyway, and a step that emitted a dozen TradeFood actions a week would
 * spend the click budget (D10) on decisions a player would not make.
 */
/** Crates of one good this stable can still buy here, after whatever it has already queued. */
export function availableHere(plan: Plan, id: GoodId): number {
  const { s, playerId } = plan;
  const market = s.planet.goods[id];
  if (market.stock === STOCK_UNLIMITED) return STOCK_UNLIMITED;
  const consigned = s.planet.finds[playerId]?.goods[id] ?? 0;
  return Math.max(0, market.stock + consigned - (plan.shelfTaken.get(id) ?? 0));
}

function claim(plan: Plan, id: GoodId, crates: number): void {
  plan.shelfTaken.set(id, (plan.shelfTaken.get(id) ?? 0) + crates);
}

function bestLeg(
  plan: Plan,
  nextBand: readonly [number, number] | null,
): { good: Good; margin: number } | null {
  if (!nextBand) return null;
  const { s, p } = plan;
  const mid = (nextBand[0] + nextBand[1]) / 2;
  let best: { good: Good; margin: number } | null = null;
  for (const g of GOODS) {
    if (g.staple) continue; // the staple is handled by the dinner half, below
    const market = s.planet.goods[g.id];
    if (availableHere(plan, g.id) <= 0 || market.buy <= 0) continue;
    const expectedSell = mid * g.priceMult * (1 - balance.foodSpread);
    const margin = expectedSell - buyPriceFor(p, market.buy);
    // A relative floor as well as the absolute one: 40 Bones is a real margin on a 60-Bone crate
    // of kibble and noise on a 900-Bone crate of Prime speed feed.
    const floor = Math.max(balance.aiFoodSpreadMin, market.buy * balance.aiGoodsMarginMin);
    if (margin > floor && (!best || margin > best.margin)) best = { good: g, margin };
  }
  return best;
}

/** Sell whatever the hold is carrying at a profit against next week's expected price. */
function sellFeedLegs(plan: Plan, nextBand: readonly [number, number] | null): void {
  const { s, p, playerId, out } = plan;
  const mid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : null;
  for (const g of GOODS) {
    if (g.staple) continue;
    const aboard = plan.cargo[g.id];
    if (aboard <= 0) continue;
    const here = s.planet.goods[g.id].sell;
    // With nowhere better to go, or a better price here than the next stop expects, take the money.
    const expectedNext = mid === null ? 0 : mid * g.priceMult * (1 - balance.foodSpread);
    // A dog that is training on this stat wants the crate more than the bookkeeper does.
    const wanted = plan.kennel.some((d) => d.weekState === 'train' && d.trainStat === g.stat);
    if (wanted) continue;
    if (here >= expectedNext) {
      out.push({ t: 'TradeFood', playerId, good: g.id, units: -aboard });
      plan.cargo[g.id] -= aboard;
      plan.cash += aboard * here;
      void p;
    }
  }
}

/** Eat first, then trade the spread to the next planet (GDD §14 Normal). */
export function tradeFoodPlan(plan: Plan, opts: FoodOptions = {}): void {
  const { s, p, playerId, out } = plan;
  if (!s.toggles.trading) return;
  const need = weeklyFoodNeed(s, p);
  const next = s.calendar[s.week];
  const nextBand = next ? planetOf(next.planetId).foodBand : null;
  const kibble = s.planet.goods[KIBBLE_ID];
  const nextMid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : kibble.buy;
  const buyHere = kibble.buy;
  const sellHere = kibble.sell;
  // ---- The specialist feeds, for an agent that works them (GDD §9.2) ----
  // Sell first, so the hold has room and the cash is in hand before the next leg is bought.
  if (opts.workGoods) {
    sellFeedLegs(plan, nextBand);
    const leg = bestLeg(plan, nextBand);
    if (leg) {
      const spend = Math.max(0, plan.cash - plan.reserve) * (opts.goodsSpend ?? 0.6);
      const price = buyPriceFor(p, s.planet.goods[leg.good.id].buy);
      const buyable = Math.min(
        cargoCap(p) - cargoTotal(plan.cargo) - need,
        availableHere(plan, leg.good.id),
        Math.floor(spend / Math.max(1, price)),
      );
      if (buyable > 0) {
        out.push({ t: 'TradeFood', playerId, good: leg.good.id, units: buyable });
        plan.cargo[leg.good.id] += buyable;
        plan.cash -= buyable * price;
        claim(plan, leg.good.id, buyable);
      }
    }
  }

  // ---- The staple: dinner, and the one-week spread every stable can see ----
  const aboard = plan.cargo[KIBBLE_ID];
  const room = cargoCap(p) - cargoTotal(plan.cargo);
  let units = 0;
  if (opts.fillHold) {
    const spend = Math.max(0, plan.cash - plan.reserve);
    units = Math.min(room, Math.floor(spend / buyHere));
  } else if (sellHere - nextMid > balance.aiFoodSpreadMin && aboard > need) {
    units = -(aboard - need); // sell the surplus here, keep this week's dinner
  } else if (nextMid * (1 - balance.foodSpread) - buyHere > balance.aiFoodSpreadMin) {
    const spend = Math.max(0, plan.cash - plan.reserve);
    units = Math.min(room, Math.floor(spend / buyHere));
  }
  if (units === 0 && aboard < need) {
    // No trade on, but never arrive hungry: buy this week's food if we can.
    units = Math.min(room, need - aboard, Math.floor(Math.max(0, plan.cash - 500) / buyHere));
  }
  if (units !== 0) {
    out.push({ t: 'TradeFood', playerId, good: KIBBLE_ID, units });
    plan.cash -= units * (units > 0 ? buyHere : sellHere);
    plan.cargo[KIBBLE_ID] += units;
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
  for (const race of thisWeeksCard(s)) {
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
