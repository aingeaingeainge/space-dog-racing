import { balance } from '../content/balance';
import type { Dog } from '../types';

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

/** Rating from raw stats (GDD §5.3 weights), integer. */
export function baseRating(d: Pick<Dog, 'speed' | 'accel' | 'stamina' | 'trap'>): number {
  return Math.round(
    balance.ratingWeightSpeed * d.speed +
      balance.ratingWeightAccel * d.accel +
      balance.ratingWeightStamina * d.stamina +
      balance.ratingWeightTrap * d.trap,
  );
}
