import { balance } from '../content/balance';
import { GOODS, KIBBLE_ID, STAPLE_ID } from '../content/goods';
import type { Cargo, Dog, GoodId, GoodMarket, Id, Planet, Player } from '../types';
import type { Rng } from '../rng';

/**
 * What one dog will eat at the end of this week, and what happens if it cannot (GDD_V3 §6.3).
 *
 * **This lives in the engine and the Kennel reads it**, rather than the screen mirroring the rule
 * in its own arithmetic. BUILD_PLAN_V3 Phase B asks for the empty-hold penalty to be *visible in
 * the Kennel before the week resolves*, and a screen that re-derives which dog misses out is a
 * screen that can be wrong about it — which, for the one rule carrying the whole of v3's running
 * cost, is the worst place in the game to be lied to.
 */
export interface FeedPlan {
  dogId: Id;
  /** Crates it wants: one, doubled for a Glutton, and again while a sponsor is feeding the yard. */
  crates: number;
  /** What it will actually eat, or null when the hold cannot feed it at all. */
  good: GoodId | null;
  /** Crates it will actually get from the hold — fewer than `crates` when the hold runs down. */
  got: number;
  /**
   * Crates bought at the gate at the local price, which happens **only in a No Trading season**.
   *
   * ⚠️ **Without this the No Trading toggle would starve every dog from week 3.** The toggle
   * closes the market, so a stable cannot restock, and §6.3's empty-hold rule would then take 10
   * fitness off every dog every week for the rest of the season. The toggle's own promise on the
   * title screen is *"your dogs still eat: you pay the local price at the gate"*, and the gate is
   * what keeps it: with the market shut there is no decision to punish, so the staple is bought at
   * the buy price — no multiplier — once the hold is empty. In a trading season this is always 0
   * and the empty-hold penalty is the whole rule.
   */
  fromGate: number;
}

/** Crates one dog wants this week (GDD_V3 §6.3: one unit, whatever it is doing). */
export function cratesWanted(p: Player, d: Dog): number {
  const base = d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  return p.sponsorWeeks > 0 ? base * 2 : base;
}

/**
 * Which crate this dog reaches for.
 *
 * ⚠️ **The sticky per-dog diet of §6.3 is not built yet** — that is item 4 of this phase, and it
 * replaces this function's body with a named food / best available / worst available choice and a
 * cheapest-aboard fallback. With one placeholder good there is nothing to choose between, so the
 * question is only whether the hold has anything in it at all, which is exactly the question the
 * empty-hold penalty asks.
 */
function chooseFood(cargo: Cargo): GoodId | null {
  return cargo[KIBBLE_ID] > 0 ? KIBBLE_ID : null;
}

/**
 * The whole yard's dinner, in `dogIds` order, against one copy of the hold.
 *
 * Order matters and is the stable's own: with two crates and three dogs the third dog is the one
 * that goes hungry, every time, and the Kennel can therefore say *which* dog before the week
 * resolves. Pure — no rng, no mutation of the player — so the screen and `runEndTurn` can both call
 * it and cannot disagree.
 */
export function planFeeding(p: Player, dogs: readonly Dog[], gateOpen = false): FeedPlan[] {
  const left = { ...p.cargo };
  const out: FeedPlan[] = [];
  for (const d of dogs) {
    const crates = cratesWanted(p, d);
    const good = chooseFood(left);
    if (good === null) {
      out.push(
        gateOpen
          ? { dogId: d.id, crates, good: STAPLE_ID, got: 0, fromGate: crates }
          : { dogId: d.id, crates, good: null, got: 0, fromGate: 0 },
      );
      continue;
    }
    const got = Math.min(crates, left[good]);
    left[good] -= got;
    out.push({ dogId: d.id, crates, good, got, fromGate: 0 });
  }
  return out;
}

/** Dogs this plan cannot feed at all — each one costs `balance.emptyHoldFitness` (GDD_V3 §6.3). */
export function goingHungry(plan: readonly FeedPlan[]): number {
  return plan.filter((f) => f.good === null).length;
}

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
