import { balance } from './balance';
import type { Dog, RaceTypeId } from '../types';

/**
 * The race card as data (GDD_V3 §7.1).
 *
 * Three races a weekend, every weekend, and **every dog may enter any of them**. A row says what
 * the race is called, what it pays, and how good the home team is. Nothing branches on which race
 * it is; the id is all that lives in state, on a declaration, on a bet and on an archived result.
 *
 * ⚠️ **v2's seven fact-gated types are cut (BUILD_PLAN_V3 §2.1, GDD_V3 V15).** Maiden, Juvenile,
 * Veterans, Novice, Handicap, Invitational and Consolation were a good answer to a question v3 no
 * longer asks. They existed to reward *a broad stable you built* — the force that killed one-dog
 * concentration in v2 — and v3 deals you three dogs and has no market, so eligibility would be luck
 * rather than planning, which is the exact failure mode the system was designed to avoid. Three
 * purse tiers with open entry is one sentence, and §5 moves the depth into running styles and the
 * shape of the field instead.
 *
 * **Each row now carries its own three purse numbers, and that is a reversal worth naming.** v2 kept
 * purses in a `PURSE_BY_TIER` table because a row with its own numbers would have made the ladder
 * invisible across eight rows paying two amounts. With three rows that *are* the ladder, the table
 * is the thing hiding it: Gold 6,000 / Silver 3,000 / Bronze 1,500 reads as a ladder precisely
 * because it is written down the rows.
 *
 * The decision the card asks is simple and real (§7.1): your second-best dog can probably win the
 * Silver Plate outright, or finish fourth in the Gold Cup for nothing.
 */
export interface RaceType {
  id: RaceTypeId;
  label: string;
  /** What the card header posts, in the words a player reads (GDD §6.5). */
  criterion: string;
  /** First, second and third, before the Major and planet multipliers (GDD_V3 §7.1). */
  purse: [number, number, number];
  /** How good this race's home team is — a rich race draws a strong one (GDD_V3 §7.1). */
  localRating: number;
  /**
   * Which dogs the race will have. Always every dog in v3; injury is checked separately.
   *
   * ⚠️ **Kept as a predicate rather than deleted, and deliberately.** It is one word of code that
   * returns true, and GDD_V3 §15 puts "race types gated on anything but purse" firmly out of the
   * design — so this is not a seam waiting to be reopened. It stays because `declare`,
   * `properties.test.ts` and the Race Office all ask the question, and answering it in one place
   * keeps "a local is as eligible as anyone else" true by construction rather than by inspection.
   */
  eligible: (d: Dog) => boolean;
}

export const RACE_TYPES: readonly RaceType[] = [
  {
    id: 'bronzeDash',
    label: 'Bronze Dash',
    criterion: 'any dog may enter',
    purse: [balance.purseBronze1, balance.purseBronze2, balance.purseBronze3],
    localRating: balance.localRatingBronze,
    eligible: () => true,
  },
  {
    id: 'silverPlate',
    label: 'Silver Plate',
    criterion: 'any dog may enter',
    purse: [balance.purseSilver1, balance.purseSilver2, balance.purseSilver3],
    localRating: balance.localRatingSilver,
    eligible: () => true,
  },
  {
    id: 'goldCup',
    label: 'Gold Cup',
    criterion: 'any dog may enter',
    purse: [balance.purseGold1, balance.purseGold2, balance.purseGold3],
    localRating: balance.localRatingGold,
    eligible: () => true,
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
 * The weekend's headline race — biggest purse, run last. Its wins are the season's first tie-break
 * (GDD_V3 §2.4: most Gold Cup wins, then most race wins).
 *
 * One constant rather than a flag on the row, because there is exactly one and the card's ordering
 * depends on knowing which. It was `OPEN_TYPE_ID` while the headline race was called The Open.
 */
export const HEADLINE_TYPE_ID: RaceTypeId = 'goldCup';

/**
 * The card, in the order it is run: cheapest first, headline last (GDD_V3 §7.1).
 *
 * ⚠️ **Fixed, not drawn.** v2 drew two types from a pool of seven each weekend and put the whole
 * season's cards in the calendar so the fog had something to hide and a dossier something to sell.
 * There is no pool left to draw from and no dossier to sell it, so the card is the same three races
 * every weekend — which is also what makes "one dog per stable per race" a decision about *which*
 * dog rather than about what happens to be on this week.
 */
export const CARD: readonly RaceTypeId[] = ['bronzeDash', 'silverPlate', 'goldCup'] as const;
