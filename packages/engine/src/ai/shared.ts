import { balance } from '../content/balance';
import { winProbabilities } from '../race/odds';
import { dogValue } from '../economy/dogValue';
import { calendarEntry, eligible, purseFor } from '../state';
import {
  RACE_CLASSES,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceClass,
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

/** Best one-dog-per-class assignment by expected purse (GDD §14 Normal). */
export function bestAssignment(
  s: GameState,
  p: Player,
  candidates: Dog[] = ownDogs(s, p),
): Assignment {
  const dogs = candidates.filter((d) => d.injuryWeeks === 0 && d.banWeeks === 0);
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
      if (v === undefined || v < balance.aiMinExpectedPurse + 0.012 * dogValue(d)) continue;
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
