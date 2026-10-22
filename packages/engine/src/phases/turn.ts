import { currentPlanet, player } from '../state';
import type { GameState, Id, Phase } from '../types';

/**
 * **Everybody plays the weekend at once** (v3 Phase T, GDD_V3 T1 — Jesse's call). The phases a stable
 * acts in — its weekend on the planet (`planetPre`), the Bookie (`betting`) and after the races
 * (`planetPost`) — are taken **in any order**: every stable that has not sent EndPhase may act, and
 * the phase moves on when the last one does. Nothing a stable does in one of them reaches another
 * stable before the phase ends: the shelves are private (T2), the declarations sealed (T1), the
 * Bookie's slips filed in seating order whatever order they were struck in (E8).
 *
 * `activePlayer` is kept for a driver's sake: **the first AI still to finish, else the first human**,
 * in seating order. So a loop that plays whoever is "active" plays every AI the moment a phase opens,
 * and then waits on a human — who may act whenever they like, whether or not they are the one named.
 *
 * Until `v3t` these phases were in turn order (bar the Bookie, E8), and `turnOrder` was rolled at every
 * arrival from the hold and a die. It is the seating order now.
 */
export function nextToAct(s: GameState): Id | null {
  const left = s.turnOrder.filter((id) => !s.done.includes(id));
  for (const id of left) player(s, id); // an id that is not in the game throws here
  const ai = left.find((id) => player(s, id).kind === 'ai');
  return ai ?? left[0] ?? null;
}

/** Enter a phase every stable acts in, at once, each finishing with EndPhase. */
export function startPlayerPhase(s: GameState, phase: Phase): void {
  s.phase = phase;
  s.done = [];
  s.activePlayer = nextToAct(s);
  if (s.activePlayer === null) finishPlayerPhase(s);
}

/** May this stable act in the phase now? Any stable that has not finished it (Phase T). */
export function mayAct(s: GameState, playerId: Id): boolean {
  return s.turnOrder.includes(playerId) && !s.done.includes(playerId);
}

/** A stable is finished; name the next to act, or move the game on once everybody has. */
export function endPhaseFor(s: GameState, playerId: Id): void {
  if (!s.done.includes(playerId)) s.done.push(playerId);
  // `done` is kept in seating order, whatever order stables finished in, so the state after a phase
  // does not depend on who pressed first.
  s.done.sort((a, b) => s.turnOrder.indexOf(a) - s.turnOrder.indexOf(b));
  s.activePlayer = nextToAct(s);
  if (s.activePlayer === null) finishPlayerPhase(s);
}

/** Everyone has acted: what comes next. Lock/race/endTurn work happens on AdvancePhase. */
export function finishPlayerPhase(s: GameState): void {
  s.activePlayer = null;
  s.done = [];
  switch (s.phase) {
    case 'planetPre':
      s.phase = 'betting'; // AdvancePhase unseals and locks the declarations, and opens the bookie
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
