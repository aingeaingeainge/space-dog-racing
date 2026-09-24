import type { GameState, Player } from '../types';

/**
 * What a stable actually did with its season, split by where the money came from (GDD §2.1,
 * GDD_V3 §11).
 *
 * ⚠️ **This lives in the engine and not in `packages/web/lib` for one reason: the harness needs
 * the same arithmetic.** The harness has printed a prize / trade / bet split since Phase D and
 * `SeasonEnd.tsx` prints the same thing for every stable at the table; two copies of one sum is how
 * the screen and the instrument start quietly disagreeing about what a road earned. So it is one
 * function and both callers read it.
 *
 * **Everything here is derived.** `Player.stats` has carried the three income lines since M0, so
 * nothing on `GameState` grows to support this and the golden snapshot does not move for it. That is
 * the test of whether this is a screen or a rule.
 *
 * ⚠️ **The `fixes` column is gone with the crook's road (BUILD_PLAN_V3 §2.1).** So are the wage,
 * fuel and upkeep components of `costs`: with no staff, no ship and no kennel, the only thing left
 * going out is food (GDD_V3 V10 — food is the only running cost). The column is kept rather than
 * folded away because Phase B's empty-hold penalty and Phase D's staff commission both land in it,
 * and because a ledger with a cost line of zero is a fact worth showing rather than hiding.
 *
 * ⚠️ **Why the lines do not add up to net worth, and should not.** A season's end worth is cash plus
 * dogs plus the hold, and two of those are *assets* rather than income: a stable's dogs carry their
 * book value and the hold is a purchase. So this table answers "where did the money come from" and
 * the standings answer "what is it worth now". GDD_V3 §11 names this split as the honest replacement
 * for v2's three-road printout.
 */
export interface RoadSplit {
  /** Purses won, all season, before the trainers' cut (GDD_V3 §8.1). */
  prize: number;
  /** Goods sold minus goods bought, net. Food eaten is a cost and is not in here (§9.1). */
  trade: number;
  /** Betting returns minus stakes struck (§10). Negative for most stables, which is the point. */
  betting: number;
  /** Food bought for eating, event bills, fines and the trainers' commission — what went out. */
  costs: number;
  /** `prize + trade + betting − costs`: the ledger, before what it left you owning. */
  net: number;
}

/**
 * The split for one stable.
 *
 * `betting` is read off `stats.betIncome` rather than re-summed from `s.bets` because a slip that
 * never settled — a race that did not run — is a stake paid and nothing back, and `betIncome` is the
 * figure the ledger actually moved.
 */
export function roadSplit(s: GameState, p: Player): RoadSplit {
  // ⚠️ Phase D2: the purse is what the dog won, before the trainers' cut, and the cut is a cost —
  // which is where this file said Phase D's commission would land. `stats.prizeIncome` is what the
  // stable banked after it, so the purse is that plus `stats.commission`. The net is unchanged.
  const prize = p.stats.prizeIncome + p.stats.commission;
  const trade = p.stats.tradeIncome;
  const betting = p.stats.betIncome;
  const costs = p.stats.costs + p.stats.commission;
  return { prize, trade, betting, costs, net: prize + trade + betting - costs };
}
