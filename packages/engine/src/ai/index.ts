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
export function decide(state: GameState, playerId: Id, agent: AiAgent = 'normal'): Action[] {
  // The draft (GDD_V3 V29, V32): the opening one and the off-season's, one pick a turn.
  if (state.phase === 'draft' || state.phase === 'offSeason')
    return decideDraft(state, playerId, agent);
  const s = sealedFor(state, playerId);
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

/**
 * **What an AI may see of the Race Office before the lock** (Phase T, GDD_V3 T1): its own declarations
 * and nobody else's — the same seal `viewFor` puts on a human's browser. Until `v3t` declarations were
 * public as they were made, in turn order, and Hard read the board; now every stable declares blind,
 * and an AI that read the state would be cheating. A shallow copy: `decide` never writes to the state.
 */
export function sealedFor(s: GameState, playerId: Id): GameState {
  if (s.phase !== 'planetPre') return s;
  const declarations = Object.fromEntries(
    Object.entries(s.declarations).map(([race, book]) => [
      race,
      book[playerId] ? { [playerId]: book[playerId] } : {},
    ]),
  ) as GameState['declarations'];
  return { ...s, declarations };
}

export { decideEasy } from './easy';
export { decideHard } from './hard';
export { decideNormal } from './normal';
