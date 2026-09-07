import { balance } from '../content/balance';
import type { Planet } from '../types';
import type { Rng } from '../rng';

/** Roll this week's food prices for a planet from its band (GDD §9). */
export function rollFoodPrices(planet: Planet, rng: Rng): { buy: number; sell: number } {
  const [lo, hi] = planet.foodBand;
  const mid = rng.uniform(lo, hi) * (1 + rng.uniform(-balance.foodDrift, balance.foodDrift));
  const buy = Math.round(mid);
  const sell = Math.round(mid * (1 - balance.foodSpread));
  return { buy: Math.max(1, buy), sell: Math.max(1, sell) };
}

/** Fuel for the jump out of a planet (GDD §7.2). */
export function fuelCost(cargo: number): number {
  const over = Math.max(0, cargo - balance.fuelCargoFree);
  return balance.fuelBase + over * balance.fuelPerCargoUnitOver;
}
