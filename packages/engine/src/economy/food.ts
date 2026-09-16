import { balance } from '../content/balance';
import { GOODS } from '../content/goods';
import type { GoodId, GoodMarket, Planet } from '../types';
import type { Rng } from '../rng';

/**
 * This week's market on one planet, per good (GDD §9.1).
 *
 * The planet's `foodBand` is the band for the staple and every other good is priced against it by
 * its row's `priceMult`, so a planet that is cheap for one good is cheap for all of them — which is
 * what makes "where am I buying" a question with one answer rather than one per row. The ±15%
 * weekly drift is drawn **once per good**, so the goods do not all move together.
 *
 * Stock is rolled here too, and separately from price: a good has a chance of being on the shelf
 * at all, and a depth when it is. The staple is always there in any quantity.
 *
 * ⚠️ **`feedBias` is gone with the tier ladder (BUILD_PLAN_V3 §2.1).** Phase B replaces this
 * function's price model with GDD_V3 §6.1's six 8× bands and §6.4's mid-band clustering, which must
 * use `normalDeviate()` from `determinism.ts` — never `exp` — and per-planet shelf depth.
 */
export function rollGoodPrices(planet: Planet, rng: Rng): Record<GoodId, GoodMarket> {
  const [lo, hi] = planet.foodBand;
  const out = {} as Record<GoodId, GoodMarket>;
  for (const g of GOODS) {
    const mid =
      rng.uniform(lo, hi) * g.priceMult * (1 + rng.uniform(-balance.foodDrift, balance.foodDrift));
    const buy = Math.max(1, Math.round(mid));
    const sell = Math.max(1, Math.round(mid * (1 - balance.foodSpread)));
    // Neither draw is made when the answer cannot vary — a shelf that is always there and always
    // deep (the staple) consumes no randomness, which is what lets a change to the good list
    // replay an unchanged season draw for draw.
    const stocked = g.stockChance >= 1 ? true : rng.chance(g.stockChance);
    const depth = g.stockMin === g.stockMax ? g.stockMin : rng.int(g.stockMin, g.stockMax);
    out[g.id] = { buy, sell, stock: stocked ? depth : 0 };
  }
  return out;
}
