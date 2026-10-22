import { settleHold } from './economy/goods';
import { runArrival } from './phases/arrival';
import { runEndTurn } from './phases/endTurn';
import { startNextSeason } from './phases/game';
import { draftPick } from './phases/draft';
import { chooseDoor, resolveEvent } from './phases/explore';
import { chooseBox, declare, hasExplored, placeBet, setDogState, tradeFood } from './phases/planet';
import { lockDeclarations, runRaces } from './phases/raceDay';
import { endPhaseFor, mayAct } from './phases/turn';
import { commitCtx, makeCtx, player } from './state';
import { ActionError, PLAYER_PHASES, type Action, type GameState } from './types';

/** True when the game is waiting for the system to move it on rather than for a player. */
export function needsAdvance(s: GameState): boolean {
  switch (s.phase) {
    case 'arrival':
    case 'race':
    case 'endTurn':
    case 'newSeason':
      return true;
    case 'betting':
      return !s.locked;
    default:
      return false;
  }
}

/**
 * Is the **game** over (GDD_V3 §2.1)? The name is older than multi-season play: a season that is not
 * the last ends into the next one and never answers yes here.
 */
export function isSeasonOver(s: GameState): boolean {
  return s.phase === 'seasonEnd';
}

/**
 * Apply an action to a state IN PLACE. The reducer is still a pure function of
 * (state, action): all randomness comes from state.rng. Use `reduce` for an immutable copy.
 */
export function reduceMut(s: GameState, action: Action): GameState {
  if (s.phase === 'seasonEnd') throw new ActionError('The season is over', action);
  const ctx = makeCtx(s);
  switch (action.t) {
    case 'AdvancePhase':
      if (!needsAdvance(s))
        throw new ActionError(`Waiting for ${s.activePlayer ?? 'a player'} in ${s.phase}`, action);
      if (s.phase === 'arrival') runArrival(ctx);
      else if (s.phase === 'betting') lockDeclarations(ctx);
      else if (s.phase === 'race') runRaces(ctx);
      else if (s.phase === 'newSeason') startNextSeason(ctx);
      else runEndTurn(ctx);
      break;
    case 'EndPhase': {
      if (s.pendingEvents[action.playerId])
        throw new ActionError('Resolve your event first', action);
      // Phase N: a draft's pick is its turn, so there is nothing to end (GDD_V3 V29, V32).
      if (s.phase === 'draft' || s.phase === 'offSeason')
        throw new ActionError('Make your pick', action);
      if (!PLAYER_PHASES.includes(s.phase) || needsAdvance(s))
        throw new ActionError(`Nothing to finish in ${s.phase}`, action);
      // Phase T (GDD_V3 T1): every player phase of the weekend is taken in any order — the planet, the
      // Bookie (as since E2) and after the races — so any stable still at it may finish it.
      player(s, action.playerId);
      if (!mayAct(s, action.playerId))
        throw new ActionError(`${action.playerId} has already finished`, action);
      if (s.phase === 'planetPre' && !hasExplored(s, action.playerId))
        throw new ActionError('Pick a door first', action);
      endPhaseFor(s, action.playerId);
      break;
    }
    case 'ChooseDoor':
      chooseDoor(ctx, action);
      break;
    case 'ResolveEvent':
      resolveEvent(ctx, action.playerId, action.choice);
      break;
    case 'Declare':
      declare(ctx, action);
      break;
    case 'PlaceBet':
      placeBet(ctx, action);
      break;
    case 'TradeFood':
      tradeFood(ctx, action);
      break;
    case 'SetDogState':
      setDogState(ctx, action);
      break;
    case 'ChooseBox':
      chooseBox(ctx, action);
      break;
    case 'DraftPick':
      draftPick(ctx, action);
      break;
    default:
      // An action this engine does not know. The switch is exhaustive over the union, so the only
      // way here is a log written by an older engine — a v2 save with a `HireStaff` or a `Borrow`
      // in it, say. Silently doing nothing was worse than failing: a stale log would replay as a
      // *different* season rather than as an error, which is exactly what STATE_VERSION prevents,
      // and v3 deletes nine action types at once so this path matters more than it ever has.
      throw new ActionError(
        `Unknown action ${(action as { t: string }).t} — this log was written by a different version`,
        action,
      );
  }
  // You Paid is meaningless for a good that is no longer aboard; zero it here rather than at every
  // one of the six places a crate can leave the hold (GDD_V3 §6.2, decision B4).
  for (const p of s.players) settleHold(p);
  return commitCtx(ctx);
}

/** Immutable reducer: returns a new state, never touches the input. */
export function reduce(state: GameState, action: Action): GameState {
  return reduceMut(structuredClone(state), action);
}

/** Replay a log from a fresh season state; the result is identical on every machine. */
export function replay(initial: GameState, log: readonly Action[]): GameState {
  const s = structuredClone(initial);
  for (const a of log) reduceMut(s, a);
  return s;
}
