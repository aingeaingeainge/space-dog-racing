import type { Action, GameState, Id } from '../types';

/**
 * The off-season (GDD_V3 §2.2), as an AI answers it: the retirement window, the staff notice, and
 * EndPhase. Rolled already, so nothing here draws.
 *
 * Every AI keeps everybody and takes on a candidate into an empty slot.
 */
export function decideOffSeason(s: GameState, playerId: Id): Action[] {
  const n = s.offSeason?.notices[playerId];
  const out: Action[] = [];
  if (!n) return [{ t: 'EndPhase', playerId }];
  if (n.retired === undefined) out.push({ t: 'Retire', playerId, dogId: null });
  if (n.candidate && n.hired === undefined)
    out.push({ t: 'ResolveStaffNotice', playerId, hire: true });
  out.push({ t: 'EndPhase', playerId });
  return out;
}
