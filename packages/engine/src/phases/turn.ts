import { currentPlanet, player } from '../state';
import type { GameState, Id, Phase } from '../types';

function nextLivePlayer(s: GameState, after: Id | null): Id | null {
  const start = after ? s.turnOrder.indexOf(after) + 1 : 0;
  for (let i = start; i < s.turnOrder.length; i++) {
    const id = s.turnOrder[i]!;
    const p = player(s, id);
    if (!p.flags.bankrupt && !s.done.includes(id)) return id;
  }
  return null;
}

/** Enter a phase in which players act in turn order and each sends EndPhase. */
export function startPlayerPhase(s: GameState, phase: Phase): void {
  s.phase = phase;
  s.done = [];
  s.activePlayer = nextLivePlayer(s, null);
  if (s.activePlayer === null) finishPlayerPhase(s);
}

/** The active player is finished; pass to the next, or move the game on. */
export function endPhaseFor(s: GameState, playerId: Id): void {
  if (!s.done.includes(playerId)) s.done.push(playerId);
  s.activePlayer = nextLivePlayer(s, playerId);
  if (s.activePlayer === null) finishPlayerPhase(s);
}

/** Everyone has acted: what comes next. Lock/race/endTurn work happens on AdvancePhase. */
export function finishPlayerPhase(s: GameState): void {
  s.activePlayer = null;
  s.done = [];
  switch (s.phase) {
    case 'planetPre':
      s.phase = 'betting'; // AdvancePhase locks declarations and opens the bookie
      s.locked = false;
      break;
    case 'betting':
      s.phase = 'race';
      break;
    case 'planetPost':
      s.phase = 'endTurn';
      break;
    default:
      break;
  }
}

/** Betting is skipped where there is no bookie (Holy Bark) or the toggle is off. */
export function bettingOpen(s: GameState): boolean {
  return s.toggles.betting && !currentPlanet(s).special.noBetting;
}
