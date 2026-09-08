import type { Action, Difficulty, GameState, Id } from '../types';
import { decideEasy } from './easy';
import { decideHard } from './hard';
import { decideNormal } from './normal';

/**
 * Decide the active AI player's actions for the current phase (ending with EndPhase).
 * All three difficulties play by the same rules with the same information (GDD §14): what
 * changes is the quality of the decision, never the dogs.
 */
export function decide(s: GameState, playerId: Id, difficulty: Difficulty = 'normal'): Action[] {
  switch (difficulty) {
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
