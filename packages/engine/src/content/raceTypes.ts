import { balance } from './balance';
import type { Dog, RacePurseTier, RaceTypeId } from '../types';

/**
 * The race card as data (GDD §6.3, D2).
 *
 * Every race on a weekend's card is one of these rows. A row says what the race is called, what
 * it asks of a dog, what it pays, and — because a short field is filled with locals and a local
 * has to be as eligible as anyone else — what facts a dog generated for it must carry.
 *
 * **Content is data: a new race type is a row here and an id in `RaceTypeId`.** If adding one
 * ever needs a branch somewhere else, the shape is wrong and that is the thing to fix.
 *
 * This is the shape landing with the three classes still in it, exactly as BUILD_PLAN §11 asks:
 * `eligible` is the rating cap the class already had, so the season plays identically and the
 * golden snapshot moves only because declarations, fields and races changed shape.
 */

/**
 * The facts a locally-generated dog must carry to satisfy its race's own predicate.
 *
 * Locals bypass `Declare`, so nothing else would stop a four-year-old turning up in a Juvenile —
 * the eligibility system never sees them. A spec rather than a second predicate because you
 * cannot invert a predicate: this says how to *build* a dog the predicate will accept, and
 * `properties.test.ts` then checks that every entrant in every field actually satisfies it.
 */
export interface LocalSpec {
  ageMin?: number;
  ageMax?: number;
  /** Rating is drawn around the tier's level and then squeezed into this window. */
  ratingMin?: number;
  ratingMax?: number;
}

export interface RaceType {
  id: RaceTypeId;
  label: string;
  /** What the card header posts, in the words a player reads (GDD §6.5). */
  criterion: string;
  tier: RacePurseTier;
  /** Which dogs the race will have. Fitness, injury and bans are checked separately. */
  eligible: (d: Dog) => boolean;
  local: LocalSpec;
}

export const RACE_TYPES: readonly RaceType[] = [
  {
    id: 'bronze',
    label: 'Bronze',
    criterion: `rating ${balance.capBronze} or less`,
    tier: 'bronze',
    eligible: (d) => d.rating <= balance.capBronze,
    local: { ratingMax: balance.capBronze },
  },
  {
    id: 'silver',
    label: 'Silver',
    criterion: `rating ${balance.capSilver} or less`,
    tier: 'silver',
    eligible: (d) => d.rating <= balance.capSilver,
    local: { ratingMax: balance.capSilver },
  },
  {
    id: 'gold',
    label: 'Gold',
    criterion: 'any dog may enter',
    tier: 'gold',
    eligible: () => true,
    local: {},
  },
];

export const RACE_TYPE_BY_ID: Record<RaceTypeId, RaceType> = Object.fromEntries(
  RACE_TYPES.map((t) => [t.id, t]),
) as Record<RaceTypeId, RaceType>;

export function raceType(id: RaceTypeId): RaceType {
  const t = RACE_TYPE_BY_ID[id];
  if (!t) throw new Error('Unknown race type ' + id);
  return t;
}

/**
 * The weekend's headline race — biggest purse, run last, open to anything. Its wins are the
 * season's first tie-break (GDD §4.3) and the harness's "did the champion win a Major one?".
 * One constant rather than a flag on the row, because there is exactly one and the card's
 * ordering depends on knowing which.
 */
export const OPEN_TYPE_ID: RaceTypeId = 'gold';

/** GDD §6.4. First, second and third by tier, before the Major and planet multipliers. */
export const PURSE_BY_TIER: Record<RacePurseTier, [number, number, number]> = {
  bronze: [balance.purseBronze1, balance.purseBronze2, balance.purseBronze3],
  silver: [balance.purseSilver1, balance.purseSilver2, balance.purseSilver3],
  gold: [balance.purseGold1, balance.purseGold2, balance.purseGold3],
};

/**
 * How good the local dogs are, by the tier of the race they are filling (GDD §6.1).
 *
 * They are the benchmark a stable is measured against, so they are priced by what the race pays
 * rather than by anything about the race's entry criterion: a rich race draws a strong home
 * team. See D17 for the two times this has had to be re-fitted, and why.
 */
export const LOCAL_RATING_BY_TIER: Record<RacePurseTier, number> = {
  bronze: balance.localRatingBronze,
  silver: balance.localRatingSilver,
  gold: balance.localRatingGold,
};
