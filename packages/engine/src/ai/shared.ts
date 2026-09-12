import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { LOCAL_RATING_BY_TIER, raceType } from '../content/raceTypes';
import { winProbabilities } from '../race/odds';
import { baseRating, dogValue } from '../economy/dogValue';
import { calendarEntry, eligible, FREE_HORIZON, player, purseFor, thisWeeksCard } from '../state';
import type { Action, Dog, GameState, Id, Planet, Player, RaceTypeId, StatKey } from '../types';

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

/** Cash the AI keeps back for a fortnight of bills. */
export function reserveCash(s: GameState, p: Player): number {
  const dogs = ownDogs(s, p).length;
  const weekly =
    dogs * balance.upkeepPerDog +
    balance.fuelBase +
    (p.staff.trainer ? balance.trainerWage : 0) +
    (p.staff.vet ? balance.vetWage : 0) +
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
  cargo: number;
  reserve: number;
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
    cargo: p.cargo,
    reserve: reserveCash(s, p),
    kennel: ownDogs(s, p),
  };
}

/**
 * Keep a trainer (GDD §14 Normal). Which dog he works on is no longer a stable-wide setting —
 * under GDD §5.7 every dog on a Train week gets his points, on the stat its own `trainStat`
 * names, so `setStates` picks that and this only decides whether to employ him at all.
 */
export function keepTrainer(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (p.staff.trainer) return;
  const offer = s.planet.staff.find((o) => o.role === 'trainer');
  if (offer && plan.cash > plan.reserve + offer.wage * 3)
    out.push({ t: 'HireStaff', playerId, role: 'trainer', staffId: offer.id });
}

/** Rating points one Train week is worth: the trainer's plus plain kibble, over four stats. */
export function ratingPerTrainWeek(p: Player): number {
  const trainer = p.staff.trainer ? balance.trainerStatPerWeek : 0;
  const kibble = (balance.trainKibbleMin + balance.trainKibbleMax) / 2;
  const meanWeight =
    (balance.ratingWeightSpeed +
      balance.ratingWeightAccel +
      balance.ratingWeightStamina +
      balance.ratingWeightTrap) /
    4;
  return (trainer + kibble) * meanWeight;
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
}

/** Buy a better dog when the stable can plainly afford one (GDD §14 Normal). */
export function dogMarket(plan: Plan, opts: MarketOptions = {}): void {
  const { s, p, playerId, out } = plan;
  const cashMultiple = opts.buyCashMultiple ?? balance.aiBuyCashMultiple;
  const gain = opts.minRatingGain ?? 3;
  const swapGain = opts.minRatingGainForSwap ?? 8;
  const dogs = plan.kennel;
  const worst = [...dogs].sort((a, b) => a.rating - b.rating)[0];
  const forSale = s.planet.marketDogIds
    .map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d && !d.fellOffAShip)
    .sort((a, b) => b.rating - a.rating);
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
    if (worst && d.rating <= worst.rating + gain && !bargain && !needBodies) continue;
    if (!slotsFree) {
      if (!worst || dogs.length <= 1 || d.rating < worst.rating + swapGain) continue;
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
}

/** Eat first, then trade the spread to the next planet (GDD §14 Normal). */
export function tradeFoodPlan(plan: Plan, opts: FoodOptions = {}): void {
  const { s, p, playerId, out } = plan;
  if (!s.toggles.trading) return;
  const need = weeklyFoodNeed(s, p);
  const next = s.calendar[s.week];
  const nextBand = next ? planetOf(next.planetId).foodBand : null;
  const nextMid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : s.planet.foodBuy;
  const buyHere = s.planet.foodBuy;
  const sellHere = s.planet.foodSell;
  let units = 0;
  if (opts.fillHold) {
    const spend = Math.max(0, plan.cash - plan.reserve);
    units = Math.min(p.ship.cargoCap - plan.cargo, Math.floor(spend / buyHere));
  } else if (sellHere - nextMid > balance.aiFoodSpreadMin && plan.cargo > need) {
    units = -(plan.cargo - need); // sell the surplus here, keep this week's dinner
  } else if (nextMid * (1 - balance.foodSpread) - buyHere > balance.aiFoodSpreadMin) {
    const spend = Math.max(0, plan.cash - plan.reserve);
    const room = p.ship.cargoCap - plan.cargo;
    units = Math.min(room, Math.floor(spend / buyHere));
  }
  if (units === 0 && plan.cargo < need) {
    // No trade on, but never arrive hungry: buy this week's food if we can.
    units = Math.min(
      p.ship.cargoCap - plan.cargo,
      need - plan.cargo,
      Math.floor(Math.max(0, plan.cash - 500) / buyHere),
    );
  }
  if (units !== 0) {
    out.push({ t: 'TradeFood', playerId, units });
    plan.cash -= units * (units > 0 ? buyHere : sellHere);
    plan.cargo += units;
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
