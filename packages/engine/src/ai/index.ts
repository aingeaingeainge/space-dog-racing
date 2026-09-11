import type { Action, AiAgent, GameState, Id } from '../types';
import { decideCareless } from './careless';
import { decideEasy } from './easy';
import { decideHard } from './hard';
import { decideNormal } from './normal';

/**
 * Decide the active AI player's actions for the current phase (ending with EndPhase).
 * All three difficulties play by the same rules with the same information (GDD §14): what
 * changes is the quality of the decision, never the dogs.
 *
 * `careless` is a measurement agent rather than a difficulty (BUILD_PLAN §7a.5) and is reachable
 * only from the harness — nothing a player can click offers it.
 */
export function decide(s: GameState, playerId: Id, agent: AiAgent = 'normal'): Action[] {
  switch (agent) {
    case 'easy':
      return decideEasy(s, playerId);
    case 'hard':
      return decideHard(s, playerId);
    case 'careless':
      return decideCareless(s, playerId);
    case 'normal':
    default:
      return decideNormal(s, playerId);
  }
}

export { decideCareless } from './careless';
export { decideEasy } from './easy';
export { decideHard } from './hard';
export { decideNormal } from './normal';
