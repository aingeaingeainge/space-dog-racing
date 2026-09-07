import { runArrival } from './phases/arrival';
import { runEndTurn } from './phases/endTurn';
import { resolveEvent } from './phases/events';
import {
  borrow,
  buyDog,
  buyUpgrade,
  declare,
  fireStaff,
  hireStaff,
  placeBet,
  repay,
  sellDog,
  setTraining,
  tradeFood,
} from './phases/planet';
import { lockDeclarations, runRaces } from './phases/raceDay';
import { endPhaseFor } from './phases/turn';
import { commitCtx, makeCtx, player } from './state';
import { ActionError, type Action, type GameState } from './types';

/** True when the game is waiting for the system to move it on rather than for a player. */
export function needsAdvance(s: GameState): boolean {
  switch (s.phase) {
    case 'arrival':
    case 'race':
    case 'endTurn':
      return true;
    case 'betting':
      return !s.locked;
    default:
      return false;
  }
}

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
      else runEndTurn(ctx);
      break;
    case 'EndPhase': {
      if (s.pendingEvent) throw new ActionError('Resolve your event first', action);
      if (s.activePlayer !== action.playerId)
        throw new ActionError(`It is not ${action.playerId}'s turn`, action);
      player(s, action.playerId);
      endPhaseFor(s, action.playerId);
      break;
    }
    case 'ResolveEvent':
      resolveEvent(ctx, action.playerId, action.choice);
      break;
    case 'BuyDog':
      buyDog(ctx, action);
      break;
    case 'SellDog':
      sellDog(ctx, action);
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
    case 'HireStaff':
      hireStaff(ctx, action);
      break;
    case 'FireStaff':
      fireStaff(ctx, action);
      break;
    case 'SetTraining':
      setTraining(ctx, action);
      break;
    case 'BuyUpgrade':
      buyUpgrade(ctx, action);
      break;
    case 'Borrow':
      borrow(ctx, action);
      break;
    case 'Repay':
      repay(ctx, action);
      break;
  }
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
