import { decide } from './ai';
import { isSeasonOver, needsAdvance, reduceMut } from './reduce';
import { createSeason, player } from './state';
import type { Action, GameState, Id, SeasonSetup } from './types';

export interface DriveResult {
  state: GameState;
  /** Every action applied, in order — with the seed this reproduces the season. */
  log: Action[];
}

/**
 * The player a driver should hear from next, or null if the engine should AdvancePhase / the season
 * is over. In a phase everybody plays at once (Phase T) that is the first AI still to finish, else the
 * first human — but **every** stable in `onTheClock` may act.
 */
export function waitingOn(s: GameState): Id | null {
  return s.activePlayer;
}

/**
 * Every stable that may act now (Phase T): in the draft, the one on the clock; in a weekend's player
 * phase, every stable that has not finished it; nobody while the system moves the game.
 */
export function onTheClock(s: GameState): Id[] {
  if (isSeasonOver(s) || needsAdvance(s)) return [];
  if (s.phase === 'draft' || s.phase === 'offSeason') return s.activePlayer ? [s.activePlayer] : [];
  return s.turnOrder.filter((id) => !s.done.includes(id));
}

/**
 * Drive a state forward in place until a human must act or the season ends.
 * AI players act through ai.decide; system phases advance automatically.
 */
export function drive(s: GameState, log: Action[] = [], maxSteps = 100_000): DriveResult {
  let steps = 0;
  while (!isSeasonOver(s) && steps++ < maxSteps) {
    if (needsAdvance(s)) {
      const a: Action = { t: 'AdvancePhase' };
      reduceMut(s, a);
      log.push(a);
      continue;
    }
    const who = waitingOn(s);
    if (!who) throw new Error(`Engine stalled in phase ${s.phase}`);
    const p = player(s, who);
    if (p.kind === 'human') break;
    const actions = decide(s, who, p.difficulty);
    if (!actions.length) throw new Error(`AI ${who} returned no actions in ${s.phase}`);
    for (const a of actions) {
      reduceMut(s, a);
      log.push(a);
    }
  }
  if (steps >= maxSteps) throw new Error('drive() exceeded maxSteps');
  return { state: s, log };
}

/** Create and play a whole season headless. Humans in the setup will stall it. */
export function runSeason(setup: SeasonSetup): DriveResult {
  return drive(createSeason(setup));
}
