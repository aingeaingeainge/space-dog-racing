import { balance } from '../content/balance';
import { staffRow, type StaffBonusId } from '../content/staff';
import { dogValue } from '../economy/dogValue';
import { hardWorth, STAFF_WORTH, trainerNet } from '../economy/staff';
import { currentDraft, draftRoom } from '../phases/draft';
import { player } from '../state';
import type { Action, AiAgent, Dog, GameState, Id, Player, StyleId } from '../types';

/**
 * The draft (GDD_V3 V29, V32), as an AI picks. **Score every legal item on the board in Bones and
 * take the best.** Nothing here draws; a pick is a function of the board, the stable and the game.
 *
 * - **A dog** is worth its book value plus the purses it is expected to win over the seasons it has
 *   left to race (`RUNS_A_SEASON` runs at `purseAt(rating)`, the curve fitted from the harness), plus
 *   `NEED_BONUS` for a style the stable has none of yet.
 * - **A trainer** is worth their weekly net (`trainerNet`: the bonuses at D12's price list, less the
 *   cut) over the same seasons. Hard prices on its own list (`hardWorth`).
 * - **Easy** takes the highest-rated dog it can, and a trainer only when it must.
 * - **Normal** takes the best score.
 * - **Hard** also weighs age: a dog's rating is walked forward season by season with §4.3's growth
 *   and decline before the purses are counted.
 * - **In the off-season** a stable takes the best item if it beats what it would have to let go by
 *   `aiDraftMargin` Bones (⚖️, a sheet cell), and otherwise passes. Easy takes a dog only when it
 *   rates higher than its lowest-rated dog, and a trainer only into an empty slot.
 */

/**
 * Purses a run wins by the rating the dog is declared at, in Bones: `[rating, purse]`, interpolated
 * between points and held flat past the ends. **Fitted from the harness at Phase N** — all-Normal,
 * six four-dog stables, 150 seasons: the mean gross purse a declaration won, by rating at declaration
 * in 5-point buckets (`claude/V3_PHASE_N_NOTES.md`). It is convex: the better dogs go in the Gold Cup,
 * so a point of rating is worth more at the top of the board than at the bottom.
 */
export const PURSE_CURVE: readonly (readonly [number, number])[] = [
  [35, 450],
  [40, 630],
  [45, 660],
  [50, 880],
  [55, 1220],
  [60, 1710],
  [65, 2280],
  [70, 2780],
];
/** Runs a dog gets in a season of four-dog kennels (the harness's races per dog). */
export const RUNS_A_SEASON = 6;
/** Bones for a style the stable has none of: enough to break a near-tie, not to take a worse dog. */
export const NEED_BONUS = 400;
/** A Target game has no fixed length: the AI counts on this many seasons. */
const TARGET_SEASONS = 2;
/** Rating a stat point a week is worth, near enough (the weights average a third). */
const RATING_PER_STAT = 1 / 3;

export function purseAt(rating: number): number {
  const c = PURSE_CURVE;
  if (rating <= c[0]![0]) return c[0]![1];
  for (let i = 1; i < c.length; i++) {
    const [r1, p1] = c[i]!;
    if (rating <= r1) {
      const [r0, p0] = c[i - 1]!;
      return p0 + ((p1 - p0) * (rating - r0)) / (r1 - r0);
    }
  }
  return c[c.length - 1]![1];
}

/** Seasons of racing a pick made now has ahead of it. */
export function seasonsAhead(s: GameState): number {
  const d = currentDraft(s);
  const next = d?.season ?? s.season;
  if (s.length.kind === 'target') return TARGET_SEASONS;
  return Math.max(1, s.length.seasons - next + 1);
}

/** Stat points a week at this age: §4.3's growth column, as `endTurn` applies it. */
function growthAt(age: number): number {
  if (age <= 1) return balance.growthAge1Band;
  if (age === 2) return balance.growthAge2Band;
  if (age === 5) return -balance.declineAge5;
  if (age === 6) return -balance.declineAge6;
  if (age >= 7) return -balance.declineAge7;
  return 0;
}

/** What a dog is worth to a stable drafting it, in Bones. */
export function dogScore(
  s: GameState,
  d: Pick<Dog, 'rating' | 'age' | 'injuryWeeks' | 'style'>,
  agent: AiAgent,
  styles: readonly StyleId[] = [],
): number {
  const seasons = seasonsAhead(s);
  let purses = 0;
  let rating = d.rating;
  for (let k = 0; k < seasons; k++) {
    purses += RUNS_A_SEASON * purseAt(rating);
    if (agent === 'hard')
      rating += growthAt(Math.min(7, d.age + k)) * balance.weeks * RATING_PER_STAT;
  }
  const need = styles.length && !styles.includes(d.style) ? NEED_BONUS : 0;
  return dogValue(d) + purses + need;
}

/** What a trainer is worth to this stable over the seasons ahead, in Bones. */
export function staffScore(s: GameState, p: Player, id: Id, agent: AiAgent): number {
  const worth: Record<StaffBonusId, { prize: number; flat: number }> =
    agent === 'hard' ? hardWorth(p) : STAFF_WORTH;
  return trainerNet(s, p, staffRow(id), worth) * balance.weeks * seasonsAhead(s);
}

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

export function decideDraft(s: GameState, playerId: Id, agent: AiAgent): Action[] {
  const d = currentDraft(s);
  if (!d) return [];
  const p = player(s, playerId);
  const room = draftRoom(s, playerId);
  const mine = ownDogs(s, p);
  const styles = mine.map((x) => x.style);
  const byRating = (a: Dog, b: Dog) => b.rating - a.rating || (a.id < b.id ? -1 : 1);
  const bestStaff = () =>
    [...d.staff].sort(
      (a, b) => staffScore(s, p, b, agent) - staffScore(s, p, a, agent) || (a < b ? -1 : 1),
    )[0];

  if (d.kind === 'opening') {
    if (agent === 'easy') {
      if (room.dog) return [pick(playerId, { dog: [...d.dogs].sort(byRating)[0]!.id })];
      return [pick(playerId, { staff: bestStaff()! })];
    }
    let best: { score: number; pick: { dog: Id } | { staff: Id } } | null = null;
    if (room.dog)
      for (const x of d.dogs) {
        const sc = dogScore(s, x, agent, styles);
        if (!best || sc > best.score) best = { score: sc, pick: { dog: x.id } };
      }
    if (room.staff)
      for (const id of d.staff) {
        const sc = staffScore(s, p, id, agent);
        if (!best || sc > best.score) best = { score: sc, pick: { staff: id } };
      }
    return [pick(playerId, best!.pick)];
  }

  // The off-season: one pick, or a pass.
  const kennelFull = mine.length >= balance.startDogs;
  const staffFull = p.staff.length >= balance.staffSlots;
  if (agent === 'easy') {
    if (!staffFull && d.staff.length) return [pick(playerId, { staff: bestStaff()! })];
    const top = [...d.dogs].sort(byRating)[0];
    const worst = [...mine].sort(byRating).at(-1);
    if (top && (!kennelFull || (worst && top.rating > worst.rating)))
      return [pick(playerId, { dog: top.id }, kennelFull ? worst!.id : undefined)];
    return [pick(playerId, null)];
  }
  const dogWorth = (x: Dog) => dogScore(s, x, agent);
  const release = [...mine].sort((a, b) => dogWorth(a) - dogWorth(b) || (a.id < b.id ? -1 : 1))[0];
  const staffOut = [...p.staff].sort(
    (a, b) => staffScore(s, p, a, agent) - staffScore(s, p, b, agent) || (a < b ? -1 : 1),
  )[0];
  let best: { gain: number; action: Action } | null = null;
  for (const x of d.dogs) {
    const others = mine.filter((m) => !kennelFull || m.id !== release?.id).map((m) => m.style);
    const gain = dogScore(s, x, agent, others) - (kennelFull && release ? dogWorth(release) : 0);
    if (!best || gain > best.gain)
      best = { gain, action: pick(playerId, { dog: x.id }, kennelFull ? release?.id : undefined) };
  }
  for (const id of d.staff) {
    const gain =
      staffScore(s, p, id, agent) - (staffFull && staffOut ? staffScore(s, p, staffOut, agent) : 0);
    if (!best || gain > best.gain)
      best = { gain, action: pick(playerId, { staff: id }, staffFull ? staffOut : undefined) };
  }
  if (best && best.gain > balance.aiDraftMargin) return [best.action];
  return [pick(playerId, null)];
}

function pick(playerId: Id, what: { dog: Id } | { staff: Id } | null, release?: Id): Action {
  return release === undefined
    ? { t: 'DraftPick', playerId, pick: what }
    : { t: 'DraftPick', playerId, pick: what, release };
}
