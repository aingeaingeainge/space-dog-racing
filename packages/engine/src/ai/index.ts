import type { Action, AiAgent, GameState, Id } from '../types';
import { decideEasy } from './easy';
import { decideHard } from './hard';
import { decideNormal } from './normal';
import { decideDraft } from './draft';

/**
 * Decide the active AI player's actions for the current phase (ending with EndPhase).
 * All three difficulties play by the same rules with the same information (GDD §14): what
 * changes is the quality of the decision, never the dogs.
 *
 * ⚠️ **The measurement agents are gone (BUILD_PLAN_V3 §2.1).** `careless` measured a bankruptcy
 * that v3 does not have, and `trainer` / `trader` / `crook` / `mixed` measured three roads that v3
 * replaced with one road and two sidelines. `AiAgent` is now exactly `Difficulty`, so the switch
 * below is total and the harness can no longer ask for an agent that does not exist.
 */
export function decide(s: GameState, playerId: Id, agent: AiAgent = 'normal'): Action[] {
  // The draft (GDD_V3 V29, V32): the opening one and the off-season's, one pick a turn.
  if (s.phase === 'draft' || s.phase === 'offSeason') return decideDraft(s, playerId, agent);
  switch (agent) {
    case 'easy':
      return decideEasy(s, playerId);
    case 'hard':
      return decideHard(s, playerId);
    case 'normal':
    default:
      return decideNormal(s, playerId);
  }
}

export { decideEasy } from './easy';
export { decideHard } from './hard';
export { decideNormal } from './normal';
