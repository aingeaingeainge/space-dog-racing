import { balance } from '../content/balance';
import { GOODS, good, STAPLE_ID } from '../content/goods';
import {
  GOOD_IDS,
  type Cargo,
  type Dog,
  type GoodId,
  type GoodMarket,
  type Id,
  type Planet,
  type Player,
} from '../types';
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
 * puts a named food / best available / worst available choice in front of this. What is here is
 * §6.3's own fallback rule, *"the cheapest thing aboard"*, which is what the diet falls back to when
 * its choice runs out and is therefore the right behaviour for a dog that has no diet yet.
 * "Cheapest" is the good's place on the §6.1 ladder, not this week's price: a diet is a standing
 * order, and a standing order cannot depend on a draw the dog has never seen.
 */
function chooseFood(cargo: Cargo): GoodId | null {
  for (const id of GOOD_IDS) if (cargo[id] > 0) return id;
  return null;
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
 * A planet's food map in one line — "cheap for Grey Mash and Scrapmeat, dear for Ambrosia" — for
 * the two information events that sell it (GDD_V3 §9.4) and for any screen that needs it said
 * rather than tabled. Names a good as cheap at a bias of 0.8 or below and dear at 1.2 or above,
 * which is the point where its typical price sits a tenth of the band away from the middle.
 *
 * `invert` swaps the two lists, which is what a lying clerk's manifest does: the lie is about the
 * *shape* of the market rather than a number nudged by a few Bones, so a player who acts on it is
 * wrong in a way they will notice.
 */
export function describeTaste(planet: Planet, invert = false): string {
  const cheap = GOODS.filter((g) => planet.foodBand[g.id] <= 0.8).map((g) => g.label);
  const dear = GOODS.filter((g) => planet.foodBand[g.id] >= 1.2).map((g) => g.label);
  const [lo, hi] = invert ? [dear, cheap] : [cheap, dear];
  const list = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const parts = [lo.length ? `cheap for ${list(lo)}` : '', hi.length ? `dear for ${list(hi)}` : ''];
  const said = parts.filter(Boolean).join(', ');
  return said || 'middling for everything';
}

/**
 * The price a good is *expected* to post on a planet — what a stable standing somewhere else can
 * reasonably plan to sell it for there (GDD_V3 §6.1, §12).
 *
 * **This is the engine's own expectation and the AI and the Market screen both read it**, so the
 * number a player is shown for "next stop" and the number an AI trades on cannot drift apart. That
 * is §14's rule — every difficulty sees exactly what a player sees — kept by construction rather
 * than by care.
 *
 * ⚠️ **While the draw is flat across the band (this commit) the expectation is the band's midpoint
 * on every planet**, which means the trader's map is blank: the only signal is whether *this*
 * week's draw is below the middle. The planet's `foodBand` bias is data from this commit on and is
 * read by the price draw in the next, which is where the map appears.
 */
export function expectedPrice(_planet: Planet, id: GoodId): number {
  const g = good(id);
  return (g.floor + g.ceiling) / 2;
}

/**
 * This week's market on one planet, per good (GDD_V3 §6.1).
 *
 * Every good is on every shelf — a price to buy at, a price to sell at, and a finite depth of
 * stock. Buy and sell move together: the sell price is always `foodSpread` below the buy, so a
 * crate bought and sold in the same place always loses the spread, and the only way to make money
 * is to carry it somewhere.
 *
 * ⚠️ **The price is drawn FLAT across the good's band in this commit, which is exactly what §6.4
 * forbids** — it is here only so the six goods and the shelf land in a commit of their own and the
 * next commit's snapshot move is attributable to the distribution alone. A flat draw puts a fifth
 * of all Ambrosia prices within 126 Bones of the floor, and that is the 8× happening *to* a player
 * rather than being hunted by one.
 *
 * ⚠️ **Every good now makes two draws, price then depth, always.** Phase A's version skipped the
 * depth draw for a shelf that could not vary (the staple's unlimited stock), with a comment saying
 * that let a change to the good list replay an unchanged season draw for draw. Every shelf is
 * finite now — `STOCK_UNLIMITED` is gone, because the depth is the scarcity rule (V7) — so that
 * property no longer exists, and any change to the good list moves every season. That is a
 * deliberate trade and the snapshot move that comes with it is named in this commit.
 */
export function rollGoodPrices(_planet: Planet, rng: Rng): Record<GoodId, GoodMarket> {
  const out = {} as Record<GoodId, GoodMarket>;
  for (const g of GOODS) {
    const mid = rng.uniform(g.floor, g.ceiling);
    const buy = Math.max(1, Math.round(mid));
    const sell = Math.max(1, Math.round(mid * (1 - balance.foodSpread)));
    const stock = rng.int(g.shelfMin, g.shelfMax);
    out[g.id] = { buy, sell, stock };
  }
  return out;
}
