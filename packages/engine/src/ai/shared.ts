import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { winProbabilities } from '../race/odds';
import { dogValue } from '../economy/dogValue';
import { calendarEntry, eligible, player, purseFor } from '../state';
import {
  RACE_CLASSES,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Planet,
  type Player,
  type RaceClass,
  type StatKey,
} from '../types';

export function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/** Ratings the AI expects to face in a class: declared rivals so far, locals for the rest. */
export function expectedField(s: GameState, cls: RaceClass, excludePlayer: Id): number[] {
  const major = calendarEntry(s).major;
  const mid =
    (cls === 'bronze'
      ? balance.localRatingBronze
      : cls === 'silver'
        ? balance.localRatingSilver
        : balance.localRatingGold) + (major ? balance.localRatingMajorBonus : 0);
  const ratings: number[] = [];
  for (const [pid, dogId] of Object.entries(s.declarations[cls])) {
    if (pid === excludePlayer) continue;
    const d = s.dogs[dogId];
    if (d) ratings.push(d.rating);
  }
  while (ratings.length < balance.traps - 1) ratings.push(mid);
  return ratings;
}

/** Expected prize money for running `dog` in `cls` (P(win)×1st + P(2nd)×2nd + P(3rd)×3rd, roughly). */
export function expectedPurse(s: GameState, dog: Dog, cls: RaceClass, playerId: Id): number {
  const others = expectedField(s, cls, playerId);
  const p = winProbabilities([dog.rating, ...others])[0]!;
  const purse = purseFor(s, cls);
  // Places: a cheap approximation of Harville that keeps the AI fast.
  const p2 = Math.min(1 - p, p * 1.2);
  const p3 = Math.min(1 - p - p2, p * 1.1);
  return p * purse[0] + p2 * purse[1] + p3 * purse[2];
}

export interface Assignment {
  plan: Partial<Record<RaceClass, Id>>;
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
}

/** Best one-dog-per-class assignment by expected purse (GDD §14 Normal). */
export function bestAssignment(
  s: GameState,
  p: Player,
  candidates: Dog[] = ownDogs(s, p),
  opts: AssignmentOptions = {},
): Assignment {
  const scale = opts.minPurseScale ?? 1;
  const dogs = candidates.filter(
    (d) => d.injuryWeeks === 0 && d.banWeeks === 0 && !opts.hold?.has(d.id),
  );
  let best: Assignment = { plan: {}, value: 0 };
  const ev = new Map<string, number>();
  for (const d of dogs) {
    for (const cls of RACE_CLASSES) {
      if (eligible(d, cls)) ev.set(`${d.id}|${cls}`, expectedPurse(s, d, cls, p.id));
    }
  }
  // Enumerate: each class gets at most one distinct dog (or nobody). ≤5 dogs → tiny search.
  const recurse = (
    ci: number,
    used: Set<Id>,
    plan: Partial<Record<RaceClass, Id>>,
    value: number,
  ) => {
    if (ci === RACE_CLASSES.length) {
      if (value > best.value) best = { plan: { ...plan }, value };
      return;
    }
    const cls = RACE_CLASSES[ci]!;
    recurse(ci + 1, used, plan, value); // leave the trap to the locals
    for (const d of dogs) {
      if (used.has(d.id)) continue;
      const v = ev.get(`${d.id}|${cls}`);
      // Not worth the fitness and injury risk: leave the trap to the locals.
      if (v === undefined || v < (balance.aiMinExpectedPurse + 0.012 * dogValue(d)) * scale)
        continue;
      // A tired dog costs future races: discount below the fitness scaling threshold.
      const fatigue = d.fitness < balance.fitnessScaleBelow ? 0.8 : 1;
      used.add(d.id);
      plan[cls] = d.id;
      recurse(ci + 1, used, plan, value + v * fatigue);
      used.delete(d.id);
      delete plan[cls];
    }
  };
  recurse(0, new Set(), {}, 0);
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

/** The planet the calendar says we reach in `weeksAhead` weeks, or null past the Grand Final. */
export function planetAhead(s: GameState, weeksAhead: number): Planet | null {
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

/** Keep a trainer on the best dog's weakest stat (GDD §14 Normal). */
export function keepTrainer(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!p.staff.trainer) {
    const offer = s.planet.staff.find((o) => o.role === 'trainer');
    if (offer && plan.cash > plan.reserve + offer.wage * 3)
      out.push({ t: 'HireStaff', playerId, role: 'trainer', staffId: offer.id });
  }
  const best = [...plan.kennel].sort((a, b) => b.rating - a.rating)[0];
  if ((p.staff.trainer || out.some((a) => a.t === 'HireStaff')) && best) {
    const stat = weakestWeightedStat(best);
    if (!p.training || p.training.dogId !== best.id || p.training.stat !== stat) {
      out.push({ t: 'SetTraining', playerId, dogId: best.id, stat });
    }
  }
}

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
  for (const d of forSale) {
    const price = d.askingPrice ?? dogValue(d);
    const bargain = opts.bargainFactor !== undefined && price <= dogValue(d) * opts.bargainFactor;
    if (plan.cash < price * cashMultiple) continue;
    if (opts.keepReserve && plan.cash - price < plan.reserve) continue;
    if (worst && d.rating <= worst.rating + gain && !bargain) continue;
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

/** Turn a chosen assignment into Declare actions, skipping the ones already standing. */
export function emitDeclarations(plan: Plan, assignment: Assignment): void {
  const { s, playerId, out } = plan;
  for (const cls of RACE_CLASSES) {
    const dogId = assignment.plan[cls] ?? null;
    if ((s.declarations[cls][playerId] ?? null) !== dogId)
      out.push({ t: 'Declare', playerId, cls, dogId });
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
  for (const cls of RACE_CLASSES) {
    const fav = [...s.fields[cls]].sort((a, b) => b.winProb - a.winProb)[0];
    if (!fav || fav.winProb < minProb) continue;
    const stake = Math.floor(Math.min(plan.cash * fraction, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, cls, dogId: fav.dogId, kind: 'win', stake });
    plan.cash -= stake;
  }
}
