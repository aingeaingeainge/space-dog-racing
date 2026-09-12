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
 * **Why facts rather than ratings.** A rating can be suppressed — that is the standing objection
 * to D1's "feed moves stats, results move rating" — but an age and a win cannot. Five of the
 * seven gate on something a player has no way to hide, which is what makes "keep a stable that
 * covers several eligibilities" the force that kills one-dog concentration. The two that post a
 * number, Handicap and Invitational, are the exceptions, and they are the v1 system surviving as
 * two rows among eight rather than as the whole design.
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
  /** Ran recently and finished out of the money — the Consolation's own fact. */
  outOfMoney?: boolean;
}

export interface RaceType {
  id: RaceTypeId;
  label: string;
  /** What the card header posts, in the words a player reads (GDD §6.5). */
  criterion: string;
  tier: RacePurseTier;
  /** In the weekly draw pool? The Open is not: it runs every weekend, last, for the big money. */
  drawn: boolean;
  /** Earliest week this type can be drawn. The Consolation needs a last week to have happened. */
  minWeek: number;
  /** Which dogs the race will have. Fitness, injury and bans are checked separately. */
  eligible: (d: Dog) => boolean;
  local: LocalSpec;
}

export const RACE_TYPES: readonly RaceType[] = [
  {
    id: 'open',
    label: 'The Open',
    criterion: 'any dog may enter',
    tier: 'open',
    drawn: false,
    minWeek: 1,
    eligible: () => true,
    local: {},
  },
  {
    id: 'maiden',
    label: 'Maiden',
    criterion: 'never won a race',
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    // Winning it destroys your own eligibility, which is the point: it puts a real cost on a win.
    eligible: (d) => d.wins === 0,
    local: {},
  },
  {
    id: 'juvenile',
    label: 'Juvenile',
    criterion: 'age 2 or under',
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    // What a bought pup is *for*, and the one race a stable full of finished dogs cannot enter.
    eligible: (d) => d.age <= 2,
    local: { ageMin: 1, ageMax: 2 },
  },
  {
    id: 'veterans',
    label: 'Veterans',
    criterion: 'age 5 or over',
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    // A late-career job for an old dog, and the first reason in the game to keep one.
    eligible: (d) => d.age >= balance.declineMinAge,
    local: { ageMin: balance.declineMinAge, ageMax: 7 },
  },
  {
    id: 'novice',
    label: 'Novice',
    criterion: 'fewer than 6 career runs',
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    // Early-season, and distinct from the Maiden: a dog can win first time out and still be one.
    eligible: (d) => d.runs < 6,
    local: {},
  },
  {
    id: 'handicap',
    label: 'Handicap',
    criterion: `rating ${balance.capHandicap} or less`,
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    eligible: (d) => d.rating <= balance.capHandicap,
    local: { ratingMax: balance.capHandicap },
  },
  {
    id: 'invitational',
    label: 'Invitational',
    criterion: `rating ${balance.floorInvitational} or more`,
    tier: 'drawn',
    drawn: true,
    minWeek: 1,
    // The good-dogs race. No cap, so there is nowhere for a very good dog to hide.
    eligible: (d) => d.rating >= balance.floorInvitational,
    local: { ratingMin: balance.floorInvitational },
  },
  {
    id: 'consolation',
    label: 'Consolation',
    criterion:
      balance.consolationReach > 1
        ? `ran out of the money in the last ${balance.consolationReach} weekends`
        : 'ran last week and finished out of the money',
    tier: 'drawn',
    drawn: true,
    // Nobody ran in week 0, so there is nobody to console until week 2.
    minWeek: 2,
    // The one deliberate catch-up mechanic. `outOfMoneyFor` is a stored fact like `wins` rather
    // than a lookup into recent results, so a local can carry it too.
    eligible: (d) => d.outOfMoneyFor > 0,
    local: { outOfMoney: true },
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
export const OPEN_TYPE_ID: RaceTypeId = 'open';

/** How many types are drawn from the pool each weekend, alongside The Open (GDD §6.3). */
export const DRAWN_PER_WEEKEND = 2;

/** GDD §6.4. First, second and third by tier, before the Major and planet multipliers. */
export const PURSE_BY_TIER: Record<RacePurseTier, [number, number, number]> = {
  open: [balance.purseOpen1, balance.purseOpen2, balance.purseOpen3],
  drawn: [balance.purseDrawn1, balance.purseDrawn2, balance.purseDrawn3],
};

/**
 * How good the local dogs are, by the tier of the race they are filling (GDD §6.1).
 *
 * They are the benchmark a stable is measured against, so they are priced by what the race pays
 * rather than by anything about the race's entry criterion: a rich race draws a strong home
 * team, and a Juvenile and a Veterans paying the same money draw the same standard of local.
 *
 * A row's `LocalSpec` can still override the *rating window* — the Handicap's locals are capped
 * and the Invitational's are pushed up to its floor — which is how a race whose criterion is a
 * number still gets a field that satisfies it. See D17 for the two earlier re-fits of these.
 */
export const LOCAL_RATING_BY_TIER: Record<RacePurseTier, number> = {
  open: balance.localRatingOpen,
  drawn: balance.localRatingDrawn,
};
