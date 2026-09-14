import type { GameState, Player } from '../types';

/**
 * What a stable actually did with its season, split by road (GDD §2.1).
 *
 * ⚠️ **This lives in the engine and not in `packages/web/lib` for one reason: the harness needs
 * the same arithmetic.** `--roads` has printed a prize / trade / bet split since Phase D and
 * `SeasonEnd.tsx` is about to print the same thing for every stable at the table; two copies of
 * one sum is how the screen and the instrument start quietly disagreeing about what a road earned.
 * So it is one function and both callers read it.
 *
 * **Everything here is derived.** `Player.stats` has carried the three income lines since M0 and
 * `s.bets` is never cleared, so nothing on `GameState` grows to support this and the golden
 * snapshot does not move for it. That is the test of whether this is a screen or a rule.
 *
 * ⚠️ **Why the three lines do not add up to net worth, and should not.** A season's end worth is
 * cash plus dogs plus the ship plus the hold minus debt, and two of those are *assets a road
 * bought* rather than income it earned: a trainer's road shows up in the dogs' book value long
 * before it shows up in `prize`, and a trader's hold is a purchase. So this table answers "where
 * did the money come from" and the standings answer "what is it worth now", and a stable that
 * reads 600 of trade against 5,500 of prize has learnt something real about which road it walked
 * even though neither number is its score.
 */
export interface RoadSplit {
  /**
   * Purses won, all season, including the championship purse — which is prize money by §4.3's own
   * definition and is counted as such everywhere else.
   */
  prize: number;
  /** Goods sold minus goods bought, net. Feed eaten is a cost and is not in here (§9.1). */
  trade: number;
  /** Betting returns minus stakes struck (§10). Negative for most stables, which is the point. */
  betting: number;
  /**
   * What §13 cost: every job's fee, plus every fine the stewards took (GDD §13).
   *
   * ⚠️ **A cost and never an income, and that is the honest shape.** What fixing *earns* is
   * already in `betting` and in `prize` — the whole road is that a nobbled favourite makes some
   * other price wrong, and a bought box makes your own dog quicker. So this column is what the
   * crook paid for those two, which is exactly the number that decides whether the road was worth
   * walking, and the only way a player could otherwise find it is by remembering.
   */
  fixes: number;
  /** Wages, upkeep, fuel, feed, entry fees, event bills — everything that simply went out. */
  costs: number;
  /** `prize + trade + betting − fixes − costs`: the ledger, before what it left you owning. */
  net: number;
}

/**
 * The split for one stable.
 *
 * `betting` is read off `stats.betIncome` rather than re-summed from `s.bets` because a slip that
 * never settled — a race that did not run, a stable that went bust before race day — is a stake
 * paid and nothing back, and `betIncome` is the figure the ledger actually moved.
 */
export function roadSplit(s: GameState, p: Player): RoadSplit {
  const prize = p.stats.prizeIncome;
  const trade = p.stats.tradeIncome;
  const betting = p.stats.betIncome;
  const costs = p.stats.costs;
  // Both lists, because the last weekend of the season has not been swept into the archive yet
  // when the Season End screen reads this. `endTurn` archives and then finishes, so at every other
  // moment in the season one of the two is empty and the sum is the same either way.
  let fixes = 0;
  for (const f of [...s.fixArchive, ...s.fixes]) {
    if (f.playerId !== p.id) continue;
    fixes += f.fee + (f.fine ?? 0);
  }
  return { prize, trade, betting, fixes, costs, net: prize + trade + betting - fixes - costs };
}

/** How the crook's road actually went: jobs bought, and how many of them the stewards noticed. */
export function fixTally(s: GameState, p: Player): { jobs: number; caught: number } {
  let jobs = 0;
  let caught = 0;
  for (const f of [...s.fixArchive, ...s.fixes]) {
    if (f.playerId !== p.id) continue;
    jobs++;
    if (f.caught) caught++;
  }
  return { jobs, caught };
}
