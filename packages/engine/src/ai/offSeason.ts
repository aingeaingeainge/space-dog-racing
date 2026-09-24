import { balance } from '../content/balance';
import { staffRow } from '../content/staff';
import { cheapestDog, estimateOffer } from '../economy/acquire';
import { dogValue } from '../economy/dogValue';
import { hardWorth, hireSlot } from '../economy/staff';
import { player } from '../state';
import type { Action, AiAgent, Dog, GameState, Id } from '../types';

/**
 * The off-season (GDD_V3 §2.2), as an AI answers it: the retirement window, the staff notice, and
 * EndPhase. Everything was rolled when the off-season opened, so nothing here draws.
 *
 * - **Easy** keeps everybody, and takes a candidate into an empty slot.
 * - **Normal** retires a dog of `aiRetireAge` (6) or older, whatever the offer — the lowest-valued, if
 *   it has two. Otherwise it retires its cheapest dog when the offer, as it can read it
 *   (`estimateOffer`: the shown stat as the level, the patter at the seller's lie rate), is worth
 *   more than that dog's book value plus `aiRetireMargin` (500 Bones). It takes a candidate by
 *   `hireSlot`, the Bar card's rule — which always fills an empty slot.
 * - **Hard** does the same with half the margin, and prices a candidate on its own list
 *   (`hardWorth`).
 */
export function decideOffSeason(s: GameState, playerId: Id, agent: AiAgent): Action[] {
  const n = s.offSeason?.notices[playerId];
  const out: Action[] = [];
  if (!n) return [{ t: 'EndPhase', playerId }];
  const p = player(s, playerId);
  if (n.retired === undefined)
    out.push({ t: 'Retire', playerId, dogId: retireChoice(s, playerId, agent) });
  if (n.candidate && n.hired === undefined) {
    const row = staffRow(n.candidate);
    const hire =
      agent === 'easy'
        ? true
        : hireSlot(s, p, row, agent === 'hard' ? hardWorth(p) : undefined) >= 0;
    out.push({ t: 'ResolveStaffNotice', playerId, hire });
  }
  out.push({ t: 'EndPhase', playerId });
  return out;
}

/** The dog this AI would retire, or null to keep them all. */
export function retireChoice(s: GameState, playerId: Id, agent: AiAgent): Id | null {
  if (agent === 'easy') return null;
  const n = s.offSeason?.notices[playerId];
  if (!n) return null;
  const p = player(s, playerId);
  const dogs = p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
  const byValue = (a: Dog, b: Dog) => dogValue(a) - dogValue(b) || (a.id < b.id ? -1 : 1);
  const old = dogs.filter((d) => d.age >= balance.aiRetireAge).sort(byValue)[0];
  if (old) return old.id;
  const cheapest = cheapestDog(s, p);
  if (!cheapest) return null;
  const margin = agent === 'hard' ? balance.aiRetireMargin / 2 : balance.aiRetireMargin;
  const offer = estimateOffer(n.offer, balance.retireOfferLieMult);
  return offer > dogValue(cheapest) + margin ? cheapest.id : null;
}
