import type { Action, AiAgent, GameState, Id } from '../types';
import { decideCareless } from './careless';
import { decideEasy } from './easy';
import { decideHard } from './hard';
import { decideNormal } from './normal';
import { decideTrader, decideTrainer } from './paths';

/**
 * Decide the active AI player's actions for the current phase (ending with EndPhase).
 * All three difficulties play by the same rules with the same information (GDD §14): what
 * changes is the quality of the decision, never the dogs.
 *
 * `careless`, `trainer` and `trader` are measurement agents rather than difficulties (BUILD_PLAN
 * §7a.5) and are reachable only from the harness — nothing a player can click offers them.
 */
export function decide(s: GameState, playerId: Id, agent: AiAgent = 'normal'): Action[] {
  switch (agent) {
    case 'easy':
      return decideEasy(s, playerId);
    case 'hard':
      return decideHard(s, playerId);
    case 'careless':
      return decideCareless(s, playerId);
    case 'trainer':
      return decideTrainer(s, playerId);
    case 'trader':
      return decideTrader(s, playerId);
    case 'normal':
    default:
      return decideNormal(s, playerId);
  }
}

export { decideCareless } from './careless';
export { decideEasy } from './easy';
export { decideHard } from './hard';
export { decideNormal } from './normal';
export { decideTrader, decideTrainer } from './paths';
