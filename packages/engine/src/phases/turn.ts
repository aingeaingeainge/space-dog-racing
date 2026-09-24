import { currentPlanet, player } from '../state';
import type { GameState, Id, Phase } from '../types';

/**
 * The next player still to act this phase.
 *
 * ⚠️ **Nobody is skipped any more.** This used to pass over a bankrupt stable; there is no
 * bankruptcy in v3 (BUILD_PLAN_V3 §2.1, GDD_V3 V10 and pillar 5 — *nobody is out before the end*),
 * so every stable in `turnOrder` acts every phase until it sends EndPhase. `player()` is still
 * called so an id that is not in the game throws here rather than three frames later.
 */
function nextLivePlayer(s: GameState, after: Id | null): Id | null {
  const start = after ? s.turnOrder.indexOf(after) + 1 : 0;
  for (let i = start; i < s.turnOrder.length; i++) {
    const id = s.turnOrder[i]!;
    player(s, id);
    if (!s.done.includes(id)) return id;
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

/**
 * A player is finished; pass to the next, or move the game on.
 *
 * ⚠️ **The next player is the first in the turn order still to finish**, not the one after this one
 * (Phase E2). In turn order the two are the same stable. They differ only at the Bookie, where a stable
 * may finish out of turn: then the active player stays whoever it was, and the phase ends when the
 * last stable finishes, whichever that is.
 */
export function endPhaseFor(s: GameState, playerId: Id): void {
  if (!s.done.includes(playerId)) s.done.push(playerId);
  s.activePlayer = nextLivePlayer(s, null);
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
    case 'offSeason':
      // Everybody has answered (GDD_V3 §2.2): AdvancePhase starts the next season.
      s.phase = 'newSeason';
      break;
    default:
      break;
  }
}

/** Betting is skipped where there is no bookie (Holy Bark) or the toggle is off. */
export function bettingOpen(s: GameState): boolean {
  return s.toggles.betting && !currentPlanet(s).special.noBetting;
}
