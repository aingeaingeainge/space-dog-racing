import { balance } from './balance';
import type { GoodId, GoodTier, StatKey } from '../types';

/**
 * What a hold can carry, as data (GDD §8.2, D4).
 *
 * **Content is data: a good is a row here and an id in `GoodId`.** Nothing branches on which
 * good it is — the eating loop asks `staple`, the training loop asks `stat` and `gain`, the
 * market asks `priceMult` and `stock`, and none of them knows what a row is called. If adding a
 * good ever needs a branch somewhere else, the shape is wrong and that is the thing to fix.
 * `content/raceTypes.ts` is the pattern this follows.
 *
 * This commit ships **kibble alone**, on purpose. `Player.cargo` was a single number threaded
 * through 26 files, and BUILD_PLAN §11's warning about Phase B's refactor applies harder here:
 * the shape change lands first, with one good, playing an identical season, and the twelve feeds
 * are a data change on top of it.
 */
export interface Good {
  id: GoodId;
  label: string;
  /** Short form for a table column. */
  short: string;
  /**
   * The stat a Train week on this feed sharpens, or null for the staple — kibble's gain lands on
   * a random stat, which is the floor of improvement GDD §8.2 describes and the reason a stable
   * that buys nothing still drifts upward.
   */
  stat: StatKey | null;
  /** Where it sits on the one ladder (GDD §8.1). Kibble sits *below* it: the staple. */
  tier: GoodTier | null;
  /** Stat points a Train week on this feed adds, inclusive. */
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
 * `rollGoodPrices` makes no rng draw for a shelf whose depth cannot vary, which is what lets the
 * shape change land without moving a single race.
 */
export const STOCK_UNLIMITED = 9999;

export const GOODS: readonly Good[] = [
  {
    id: 'kibble',
    label: 'Space Kibble',
    short: 'Kibble',
    stat: null,
    tier: null,
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
 * The staple (GDD §8.2). Dogs eat this and nothing else, and an empty *kibble* shelf in the hold
 * pays the arrival penalty however much Prime speed feed is stacked next to it — which is the
 * point: a hold is a set of choices, not a single number that happens to feed the dogs.
 */
export const KIBBLE_ID: GoodId = 'kibble';

/** The three-tier ladder, in order, as a word and as chevrons (GDD §8.1). */
export const TIER_LABEL: Record<GoodTier, string> = {
  rough: 'Rough',
  proper: 'Proper',
  prime: 'Prime',
};

export const TIER_GLYPH: Record<GoodTier, string> = {
  rough: '›',
  proper: '››',
  prime: '›››',
};

export const TIER_ORDER: readonly GoodTier[] = ['rough', 'proper', 'prime'];
