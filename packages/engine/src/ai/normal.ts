import { exploreStep } from './explore';
import { player } from '../state';
import type { Action, GameState, Id } from '../types';
import {
  betFavourites,
  buyFeedPlan,
  declareBest,
  racingDogs,
  setStates,
  stateHold,
  tippedToRest,
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
 * by a fitness rule, keeps two weeks of dinner aboard, trades the six goods against next week's
 * planet (GDD_V3 §6.1), and bets small on favourites.
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
  // Explore (GDD_V3 §9.1): open a door, answer the card.
  const explore = exploreStep(s, playerId);
  if (explore) return explore;
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    if (s.phase === 'planetPre') {
      // A tip that one of our own dogs will run below itself is a Race-or-Rest decision (D1 item 6).
      const assignment = declareBest(plan, {
        reserve: stateHold(plan, NORMAL_STATES),
        hold: tippedToRest(s, playerId),
      });
      setStates(plan, racingDogs(assignment), { diets: true });
      // Dinner first, so a trading leg bought below it is never what the dogs eat (GDD_V3 §6.3's
      // cheapest-aboard fallback feeds the staple before anything dearer).
      buyFeedPlan(plan);
    }
    tradeFoodPlan(plan);
  }

  if (s.phase === 'betting' && s.fields) betFavourites(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}
