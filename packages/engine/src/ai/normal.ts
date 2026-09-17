import { player } from '../state';
import type { Action, GameState, Id } from '../types';
import {
  betFavourites,
  buyFeedPlan,
  declareBest,
  racingDogs,
  setStates,
  stateHold,
  startPlan,
  tradeFoodPlan,
} from './shared';

/**
 * Normal's Race-or-Rest rule (GDD_V3 §4.2): race above 65 fitness, rest below it. Deliberately a
 * single readable line — it is what a player works out in their first season.
 *
 * ⚠️ It used to read "race above 65, rest below 45, train in between", and losing the middle case is
 * why Normal and Hard's weeks are now nearly the same week. Hard's job is still to beat it, and it
 * has to do that in the declarations and at the bookie.
 */
const NORMAL_STATES = { raceAbove: 65 } as const;

/**
 * Normal AI (GDD §14): declares to maximise expected purse, sets every dog to Race or Rest
 * by a fitness rule, buys feed for the stats its yard is pointed at, trades the staple when the spread
 * beats aiFoodSpreadMin, and bets small on favourites.
 * Deterministic: no randomness, so replays never diverge.
 *
 * ⚠️ **Normal has four decisions fewer than it had at `v2e`** (BUILD_PLAN_V3 §2.1): no hiring, no
 * loan repayment, no dog market, and no ship. That is most of why this commit moves the golden
 * snapshot — the golden season is six Normal stables, so deleting what Normal *did* changes every
 * cash figure in it from week 1.
 *
 * Every step lives in ai/shared.ts so Easy and Hard change the decisions rather than the plumbing.
 */
export function decideNormal(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    if (s.phase === 'planetPre') {
      const assignment = declareBest(plan, { reserve: stateHold(plan, NORMAL_STATES) });
      setStates(plan, racingDogs(assignment));
      // Still after setStates, though the reason has changed: every dog eats every week now
      // (GDD_V3 §6.3), so what to buy depends on the diet pointers setStates sets, not on which
      // dogs are training.
      buyFeedPlan(plan);
    }
    tradeFoodPlan(plan, { workGoods: true });
  }

  if (s.phase === 'betting' && s.fields) betFavourites(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}
