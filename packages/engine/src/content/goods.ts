import { balance } from './balance';
import { GOOD_IDS, STAT_KEYS, type GoodId, type GoodTier, type StatKey } from '../types';

/**
 * What a hold can carry, as data (GDD §8.2, D4).
 *
 * **Content is data: a good is a row here and an id in `GoodId`.** Nothing branches on which
 * good it is — the eating loop asks `staple`, the training loop asks `stat` and the gain band, the
 * market asks `priceMult` and the stock numbers, and none of them knows what a row is called.
 * `content/raceTypes.ts` is the pattern this follows.
 *
 * The thirteen rows are the staple plus **four stats × three tiers**, and that is the whole list.
 * GDD §21 keeps a fifth stat food out by name: four stats and three grades is one concept, and
 * §8.5's busier market is served by tiers and by stock depth instead.
 */
export interface Good {
  id: GoodId;
  /** Full name, as an error message or a shelf label says it: "Proper speed feed". */
  label: string;
  /** Column form for a table where the tier is its own column: "Speed". */
  short: string;
  /**
   * The stat a Train week on this feed sharpens, or null for the staple — kibble's gain lands on
   * a **random** stat, which is the floor of improvement GDD §8.2 describes and the reason a
   * stable that buys nothing still drifts upward very slowly.
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
 * `rollGoodPrices` makes no rng draw for a shelf whose depth cannot vary.
 */
export const STOCK_UNLIMITED = 9999;

/** The three-tier ladder, in order, as a word and as chevrons (GDD §8.1). */
export const TIER_LABEL: Record<GoodTier, string> = {
  rough: 'Rough',
  proper: 'Proper',
  prime: 'Prime',
};

/** One, two or three chevrons — so a market table scans without being parsed (GDD §8.1). */
export const TIER_GLYPH: Record<GoodTier, string> = {
  rough: '›',
  proper: '››',
  prime: '›››',
};

/** Worst first. Reverse it to ask "what is the best of these I have?". */
export const TIER_ORDER: readonly GoodTier[] = ['rough', 'proper', 'prime'] as const;

/** Weekly wage by tier (GDD §7.2). On the ladder, so a good and a hire read the same. */
export const TIER_WAGE: Record<GoodTier, number> = {
  rough: balance.wageRough,
  proper: balance.wageProper,
  prime: balance.wagePrime,
};

/** How often a tier is on a shelf, and how much of it (GDD §8.1's 70 / 25 / 5). */
export const TIER_STOCK: Record<GoodTier, { chance: number; min: number; max: number }> = {
  rough: {
    chance: balance.stockChanceRough,
    min: balance.stockRoughMin,
    max: balance.stockRoughMax,
  },
  proper: {
    chance: balance.stockChanceProper,
    min: balance.stockProperMin,
    max: balance.stockProperMax,
  },
  prime: {
    chance: balance.stockChancePrime,
    min: balance.stockPrimeMin,
    max: balance.stockPrimeMax,
  },
};

const TIER_GAIN: Record<GoodTier, { min: number; max: number }> = {
  rough: { min: balance.feedGainRoughMin, max: balance.feedGainRoughMax },
  proper: { min: balance.feedGainProperMin, max: balance.feedGainProperMax },
  prime: { min: balance.feedGainPrimeMin, max: balance.feedGainPrimeMax },
};

/**
 * How dear a stat's feed is, priced by **what the stat is worth in the race sim** (GDD §8.2).
 *
 * Measured leverage is 24.2 / 19.2 / 16.1 / 15.3 for speed / stamina / accel / trap, so speed feed
 * is the dearest at every tier and trap feed the cheap one, exactly as §8.2 asks.
 *
 * ⚠️ **Stamina is priced on its flat 19%, and there is no distance story.** §5.1 is explicit: it
 * reads 19.0% on a sprint and 19.2% on a stayer, because the fade point is a *fraction* of the
 * distance. Stayer is a flat 3% trait bonus, not a stat interaction. "Stamina feed for the long
 * tracks" would be a lie the simulation does not support, so nothing here or on the Market says it.
 */
const STAT_PRICE: Record<StatKey, number> = {
  speed: balance.feedStatSpeed,
  stamina: balance.feedStatStamina,
  accel: balance.feedStatAccel,
  trap: balance.feedStatTrap,
};

const TIER_PRICE: Record<GoodTier, number> = {
  rough: balance.feedTierRough,
  proper: balance.feedTierProper,
  prime: balance.feedTierPrime,
};

/**
 * The middle of the circuit's kibble band, which is what `priceMult` is expressed against.
 *
 * `rollGoodPrices` multiplies a planet's own band by the good's `priceMult`, so a multiplier has to
 * be a **ratio to kibble**, not a price. Dividing the intended Bones price by the typical band mid
 * is what makes `feedPriceBase` readable as "a Rough trap crate costs about this much" while keeping
 * the planet's cheapness flowing through every good — which is the whole basis of the trade (§9.1).
 */
const BAND_MID = (balance.foodPriceMin + balance.foodPriceMax) / 2;

const STAT_LABEL: Record<StatKey, string> = {
  speed: 'speed',
  accel: 'accel',
  stamina: 'stamina',
  trap: 'trap',
};

const STAT_SHORT: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Accel',
  stamina: 'Stamina',
  trap: 'Trap',
};

/**
 * One feed row, built from the stat and the tier.
 *
 * A builder rather than twelve hand-written literals because the twelve prices are one formula —
 * base × stat × tier — and a designer who wants speed feed dearer moves **one** cell in the sheet
 * rather than three. Adding a tier is still a row; adding a stat is still a row. What is not
 * possible, on purpose, is giving one of the twelve a special case, because that is the branch
 * GDD §8.2 and CLAUDE.md both forbid.
 */
function feed(stat: StatKey, tier: GoodTier): Good {
  const gain = TIER_GAIN[tier];
  const stock = TIER_STOCK[tier];
  return {
    id: `${stat}${tier[0]!.toUpperCase()}${tier.slice(1)}` as GoodId,
    label: `${TIER_LABEL[tier]} ${STAT_LABEL[stat]} feed`,
    short: STAT_SHORT[stat],
    stat,
    tier,
    gainMin: gain.min,
    gainMax: gain.max,
    staple: false,
    // `feedPriceBase × stat × tier` is the crate's price at a typical band, and dividing by the
    // typical band turns it into the ratio `rollGoodPrices` wants. Prime speed feed comes out at
    // about 950 on an average planet, 470 on a cheap one and 1,300 on Neon Snout: the dearest thing
    // in the market that is not a dog, and the reason a hold of it is worth carrying.
    priceMult: (balance.feedPriceBase * STAT_PRICE[stat] * TIER_PRICE[tier]) / BAND_MID,
    stockChance: stock.chance,
    stockMin: stock.min,
    stockMax: stock.max,
  };
}

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
  // Tier-major, so a market table reads down the ladder rather than across the stats.
  ...TIER_ORDER.flatMap((tier) => STAT_KEYS.map((stat) => feed(stat, tier))),
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

/** Every feed for one stat, worst tier first. */
export function feedsFor(stat: StatKey): readonly Good[] {
  return GOODS.filter((g) => g.stat === stat);
}

/**
 * The best feed for this stat that the hold actually has a crate of, or null for none.
 *
 * Best rather than chosen, and that is a decision (see `trainOneWeek`): a player who bought Prime
 * speed feed bought it to be eaten, and asking them to also say *when* would cost a click a dog a
 * week against a budget with half a click left in it (GDD §8.5, D10). What the player controls is
 * what is in the hold and which stat the dog is on.
 */
export function bestFeedAboard(cargo: Record<GoodId, number>, stat: StatKey): Good | null {
  let best: Good | null = null;
  for (const id of GOOD_IDS) {
    const g = GOOD_BY_ID[id];
    if (!g || g.stat !== stat || cargo[id] <= 0 || !g.tier) continue;
    if (!best || TIER_ORDER.indexOf(g.tier) > TIER_ORDER.indexOf(best.tier!)) best = g;
  }
  return best;
}
