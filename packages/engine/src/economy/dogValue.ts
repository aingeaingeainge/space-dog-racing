import { balance } from '../content/balance';
import { clamp } from '../rng';
import type { Dog, StatKey } from '../types';

export function ageFactor(age: number): number {
  switch (Math.max(1, Math.floor(age))) {
    case 1:
      return balance.ageFactor1;
    case 2:
      return balance.ageFactor2;
    case 3:
      return balance.ageFactor3;
    case 4:
      return balance.ageFactor4;
    case 5:
      return balance.ageFactor5;
    default:
      return balance.ageFactor6;
  }
}

/** GDD §7.3: value = (a + b × rating²) × ageFactor × injuryFactor. */
export function dogValue(dog: Pick<Dog, 'rating' | 'age' | 'injuryWeeks'>): number {
  const base =
    (balance.valueFloor + balance.valueCurve * dog.rating * dog.rating) * ageFactor(dog.age);
  const injury = dog.injuryWeeks > 0 ? balance.injuredValueFactor : 1;
  return Math.round(base * injury);
}

/** What a stable gets for selling a dog on a given planet (80% of value, plus any buyer bonus). */
export function dogSalePrice(dog: Dog, buyerBonus = 0, valueMod = 1): number {
  return Math.round(dogValue(dog) * balance.marketSellFactor * (1 + buyerBonus) * valueMod);
}

/**
 * Rating from raw stats (GDD_V3 §4.1), integer: `0.40 speed + 0.35 accel + 0.25 stamina`.
 *
 * The weights sum to 1, so a dog with every stat at 50 rates 50 — which is what makes the number
 * readable next to the stat bars. Accel carries 0.35 because Trap's 0.15 was folded into its 0.20
 * rather than dropped (GDD_V3 V9); a rating computed with the old four-weight sum would land about
 * fifteen points low on the same dog.
 */
export function baseRating(d: Pick<Dog, 'speed' | 'accel' | 'stamina'>): number {
  return Math.round(
    balance.ratingWeightSpeed * d.speed +
      balance.ratingWeightAccel * d.accel +
      balance.ratingWeightStamina * d.stamina,
  );
}

/**
 * The stat a track-day pass sharpens: whatever is weakest once each stat is weighted by how much
 * it moves the rating (GDD §8.4).
 *
 * It lives here rather than in `phases/planet.ts` because the Market has to print *which* stat
 * before the player pays for it, and a screen that guesses the engine's answer is the Phase A
 * failure this phase exists to stop repeating. One definition, read by both.
 */
export function weakestStat(d: Pick<Dog, 'speed' | 'accel' | 'stamina'>): StatKey {
  const weighted: [number, StatKey][] = [
    [d.speed / balance.ratingWeightSpeed, 'speed'],
    [d.accel / balance.ratingWeightAccel, 'accel'],
    [d.stamina / balance.ratingWeightStamina, 'stamina'],
  ];
  weighted.sort((a, b) => a[0] - b[0]);
  return weighted[0]![1];
}

/** The rating this dog would carry with `delta` more points on one stat. */
export function ratingWith(d: Dog, stat: StatKey, delta: number): number {
  return baseRating({ ...d, [stat]: clamp(d[stat] + delta, 1, 99) });
}
