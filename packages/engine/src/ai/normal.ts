import { player } from '../state';
import type { Action, GameState, Id } from '../types';
import {
  betFavourites,
  buyFeedPlan,
  declareBest,
  dogMarket,
  keepStaff,
  racingDogs,
  repayLoans,
  setStates,
  stateHold,
  startPlan,
  tradeFoodPlan,
} from './shared';

/**
 * Normal's Race/Train/Rest rule (GDD §14): race above 65 fitness, rest below 45, train in
 * between. Deliberately a single readable line — it is what a player works out in their first
 * season, and Hard's job is to beat it by reasoning about later rather than by knowing more.
 */
const NORMAL_STATES = { raceAbove: 65, restBelow: 45, train: true } as const;

/**
 * Normal AI (GDD §14): declares to maximise expected purse, fills its staff slots with the best
 * tier it can cover, sets every dog to Race, Train or Rest by a fitness rule, buys feed for the
 * stat its trainees are on, trades kibble when the spread beats aiFoodSpreadMin, bets small on
 * favourites, buys a dog when cash is plentiful and the dog beats its worst.
 * Deterministic: no randomness, so replays never diverge.
 *
 * Every step lives in ai/shared.ts so Easy and Hard change the decisions rather than the plumbing.
 */
export function decideNormal(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    keepStaff(plan);
    repayLoans(plan);
    // The dog market is pre-race only, so anything bought can run this weekend.
    if (s.phase === 'planetPre') dogMarket(plan);
    if (s.phase === 'planetPre') {
      const assignment = declareBest(plan, { reserve: stateHold(plan, NORMAL_STATES) });
      setStates(plan, racingDogs(assignment), NORMAL_STATES);
      // After setStates, because what feed to buy depends on which dogs are training and on
      // which stat each one is on — and setStates is what decides both (GDD §8.2).
      buyFeedPlan(plan);
    }
    tradeFoodPlan(plan, { workGoods: true });
  }

  if (s.phase === 'betting' && s.fields) betFavourites(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}
