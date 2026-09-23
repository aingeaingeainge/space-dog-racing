import { balance } from '../content/balance';
import { currentPlanet, player } from '../state';
import { cargoTotal } from '../economy/goods';
import { aiChoiceFor } from '../phases/explore';
import type { Action, DoorCategory, GameState, Id } from '../types';
import { hash01, ownDogs } from './shared';

/**
 * Which door a Normal stable opens (GDD_V3 §9.1, Phase D1 item 9): **a weight per category that leans
 * on what the stable lacks, times a hash for variety** — the same shape as `ai/shared.ts`'s other
 * "occasionally" rules, so it is a pure function of the state and a season replays exactly.
 *
 * What it reads is only its own stable and the planet: never another stable's door, which is private
 * (decision D1), and never what is behind a door, which nobody can see.
 *
 * - **The Pound** when a dog is laid up (the vet) or the kennel has a dog worth replacing — old, or
 *   rated well under the dealt 50;
 * - **The Bar** with a hold to price (next week's shelf);
 * - **The Back Alley** with money to spend on a whisper;
 * - **The Strip** when cash is short, and a little more often anyway, because it is on the fewest
 *   planets (5.7 of a season's ten weeks, against 5.8–6.2 for the others);
 * - **The Track** while a dog's style is still unknown or the yard is tired.
 *
 * ⚠️ **The bonuses are small and the hash is large on purpose** (`weight × (0.25 + hash)`). Built
 * first with bigger bonuses and `0.4 + hash`, Normal opened the Bar 38.9% of the time and the Back
 * Alley 6.0% — a cash bonus that is true nearly every week is not a need, it is a constant — against
 * §11's none-below-12% row.
 *
 * ⚠️ **Hard uses this unchanged in D1** — the prompt gives Hard no new Explore behaviour until D2.
 */
export const DOOR_BASE: Record<DoorCategory, number> = {
  pound: 1,
  bar: 1,
  alley: 1,
  strip: 1.15,
  track: 1,
};

export function doorWeights(s: GameState, playerId: Id): Record<DoorCategory, number> {
  const p = player(s, playerId);
  const dogs = ownDogs(s, p);
  const w = { ...DOOR_BASE };
  if (dogs.some((d) => d.injuryWeeks > 0)) w.pound += 0.6;
  if (dogs.some((d) => d.age >= 6 || d.rating < balance.startDogRating - 5)) w.pound += 0.3;
  if (cargoTotal(p.cargo) > 20) w.bar += 0.2;
  if (p.cash > 3000) w.alley += 0.2;
  if (p.cash < 1500) w.strip += 0.4;
  if (dogs.some((d) => !d.styleKnown)) w.track += 0.3;
  const fit = dogs.reduce((a, d) => a + d.fitness, 0) / Math.max(1, dogs.length);
  if (fit < 70) w.track += 0.2;
  return w;
}

/** The door, by the weights and a per-stable-week hash. */
export function pickDoor(s: GameState, playerId: Id, weigh = true): number {
  const doors = currentPlanet(s).exploreDoors;
  const w = weigh ? doorWeights(s, playerId) : null;
  let best = 0;
  let bestScore = -1;
  doors.forEach((d, i) => {
    const h = hash01(s.seed, s.week, playerId, 'door', i);
    const score = w ? w[d.category] * (0.25 + h) : h;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * The Explore step every difficulty shares: open a door, or answer the card behind it. Returns null
 * outside Explore, so a `decide` can fall through to its own phases.
 */
export function exploreStep(s: GameState, playerId: Id, weigh = true): Action[] | null {
  if (s.pendingEvent?.playerId === playerId)
    return [{ t: 'ResolveEvent', playerId, choice: aiChoiceFor(s, playerId) }];
  if (s.phase !== 'explore' || s.activePlayer !== playerId) return null;
  return [{ t: 'ChooseDoor', playerId, door: pickDoor(s, playerId, weigh) }];
}
