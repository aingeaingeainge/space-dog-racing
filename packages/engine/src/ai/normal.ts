import { player } from '../state';
import type { Action, GameState, Id } from '../types';
import {
  betFavourites,
  declareBest,
  dogMarket,
  keepTrainer,
  repayLoans,
  startPlan,
  tradeFoodPlan,
} from './shared';

/**
 * Normal AI (GDD §14): declares to maximise expected purse, keeps a trainer, trades food when
 * the spread beats aiFoodSpreadMin, bets small on favourites, buys a dog when cash is plentiful
 * and the dog beats its worst. Deterministic: no randomness, so replays never diverge.
 *
 * Every step lives in ai/shared.ts so Easy and Hard change the decisions rather than the plumbing.
 */
export function decideNormal(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    keepTrainer(plan);
    repayLoans(plan);
    // The dog market is pre-race only, so anything bought can run this weekend.
    if (s.phase === 'planetPre') dogMarket(plan);
    tradeFoodPlan(plan);
    if (s.phase === 'planetPre') declareBest(plan);
  }

  if (s.phase === 'betting' && s.fields) betFavourites(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}
