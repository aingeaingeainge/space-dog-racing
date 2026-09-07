import type { Action, Difficulty, GameState, Id } from '../types';
import { decideNormal } from './normal';

/**
 * Decide the active AI player's actions for the current phase (ending with EndPhase).
 * Easy and Hard arrive in M4; until then every difficulty plays Normal.
 */
export function decide(s: GameState, playerId: Id, difficulty: Difficulty = 'normal'): Action[] {
  switch (difficulty) {
    case 'easy':
    case 'hard':
    case 'normal':
    default:
      return decideNormal(s, playerId);
  }
}

export { decideNormal } from './normal';
