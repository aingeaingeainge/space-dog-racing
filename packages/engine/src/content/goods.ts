import { balance } from './balance';
import type { GoodId, StatKey } from '../types';

/**
 * What a hold can carry, as data (GDD §8.2, D4).
 *
 * **Content is data: a good is a row here and an id in `GoodId`.** Nothing branches on which
 * good it is — the eating loop asks `staple`, the training loop asks `stat` and the gain band, the
 * market asks `priceMult` and the stock numbers, and none of them knows what a row is called.
 * `content/raceTypes.ts` is the pattern this follows.
 *
 * ⚠️ **v3 Phase A cut the thirteen rows to one.** The four stats × three tiers and the
 * Rough/Proper/Prime ladder are gone (BUILD_PLAN_V3 §2.1), and kibble is left as the **placeholder
 * single good** of Phase A item 8: enough that the trade loop, the eating loop and the harness's
 * trade column all still work, and no more than that.
 *
 * **Phase B replaces this file with GDD_V3 §6.1's six foods** — Grey Mash, Scrapmeat, Glow Tripe,
 * Vat Steak, Pulsar Marrow, Ambrosia — on 8× bands with per-planet shelf depth, where the food *is*
 * the training programme (§6.3) and the empty hold costs 10 fitness (§6.3's running cost). The row
 * shape below deliberately survives that change: `stat`, the gain band, `priceMult` and the stock
 * numbers are all fields §6.1 needs, so Phase B adds rows rather than reworking the interface.
 */
export interface Good {
  id: GoodId;
  /** Full name, as an error message or a shelf label says it. */
  label: string;
  /** Column form for a table where the tier is its own column. */
  short: string;
  /**
   * The stat this feed sharpens, or null for the staple — kibble's gain lands on a **random**
   * stat, which is the floor of improvement GDD §8.2 describes and the reason a stable that buys
   * nothing still drifts upward very slowly.
   */
  stat: StatKey | null;
  /** Stat points a feed adds, inclusive. */
  gainMin: number;
  gainMax: number;
  /** Dogs eat this. Exactly one row is the staple, and the eating loop only ever wants that one. */
  staple: boolean;
  /** Price against the planet's kibble band (GDD §9.1). Kibble is 1 by definition. */
  priceMult: number;
  /** Chance this planet stocks it at all, and how deep the shelf is when it does (GDD §8.1). */
  stockChance: number;
  stockMin: number;
  stockMax: number;
}

/**
 * A shelf marked this deep is never drawn down: the staple is always available in any quantity.
 * A rule about a *number* rather than about which good it is, so nothing branches on `id` — and
 * `rollGoodPrices` makes no rng draw for a shelf whose depth cannot vary.
 *
 * ⚠️ Phase B gives every good a finite shelf (GDD_V3 §6.1's depth per planet is the scarcity rule
 * that stops "fill the hold with Ambrosia"), at which point this constant should disappear rather
 * than being kept for one row.
 */
export const STOCK_UNLIMITED = 9999;

export const GOODS: readonly Good[] = [
  {
    id: 'kibble',
    label: 'Space Kibble',
    short: 'Kibble',
    stat: null,
    gainMin: balance.trainKibbleMin,
    gainMax: balance.trainKibbleMax,
    staple: true,
    priceMult: 1,
    // Always on every shelf, in any quantity: it is what the dogs eat, and a planet that ran out
    // would be a rule about starvation rather than a market.
    stockChance: 1,
    stockMin: STOCK_UNLIMITED,
    stockMax: STOCK_UNLIMITED,
  },
];

export const GOOD_BY_ID: Record<GoodId, Good> = Object.fromEntries(
  GOODS.map((g) => [g.id, g]),
) as Record<GoodId, Good>;

export function good(id: GoodId): Good {
  const g = GOOD_BY_ID[id];
  if (!g) throw new Error('Unknown good ' + id);
  return g;
}

/**
 * The staple (GDD §8.2). Dogs eat this, and with one good in the market it is also the only thing
 * the hold can hold — which is exactly what makes it a *placeholder* rather than a market.
 */
export const KIBBLE_ID: GoodId = 'kibble';

/** Every feed for one stat, worst first. */
export function feedsFor(stat: StatKey): readonly Good[] {
  return GOODS.filter((g) => g.stat === stat);
}

/**
 * The best feed for this stat that the hold actually has a crate of, or null for none.
 *
 * ⚠️ With one good and no stat feeds this always returns null, and that is honest rather than
 * broken: there is nothing to sharpen a chosen stat with until Phase B. The function is kept
 * because `trainOneWeek` and the AI both ask the question, and Phase B answers it with six rows.
 */
export function bestFeedAboard(cargo: Record<GoodId, number>, stat: StatKey): Good | null {
  let best: Good | null = null;
  for (const g of GOODS) {
    if (g.stat !== stat || cargo[g.id] <= 0) continue;
    if (!best || g.priceMult > best.priceMult) best = g;
  }
  return best;
}
