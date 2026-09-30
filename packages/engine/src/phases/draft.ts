import { balance } from '../content/balance';
import { STAFF, staffRow } from '../content/staff';
import { STYLE_BY_ID } from '../content/styles';
import { buildBoardDogs } from '../economy/dogs';
import { dogValue } from '../economy/dogValue';
import { unemployedStaff } from '../economy/staff';
import type { Rng } from '../rng';
import { log, player, type Ctx } from '../state';
import {
  ActionError,
  type Action,
  type DraftPickRecord,
  type DraftState,
  type GameState,
  type Id,
} from '../types';

/**
 * **The draft** (GDD_V3 V29–V33, v3 Phase N — Jesse's call). Nothing is dealt any more.
 *
 * - **The opening draft** (V29) is the first player phase of a game. Every stable ends it with
 *   `startDogs` (4) dogs and `staffSlots` (2) trainers, picked one at a time from a public board in a
 *   **snake**: round 1's order is a shuffle of the stables, round 2 reverses it, and so on for six
 *   rounds. On its pick a stable takes one dog or one trainer; a full kennel can only take trainers
 *   and full staff only dogs, so every pick is forced to leave the stable where the rounds need it.
 * - **The off-season draft** (V32) is one round of the same, in **reverse order of the season's
 *   standings** (last picks first), from a fresh board, after the ageing and the staff notice. A
 *   stable takes a dog (retiring one of its own, paid its book value), takes a trainer (letting one
 *   go if it has two), or passes.
 *
 * **The board is public** (V30): every dog's age, three stats, rating, book value and running style,
 * every trainer's bonuses and cut. A drafted dog's style is known to the table from the start.
 *
 * The board and the order are drawn from the game's stream when the draft opens, so the same seed
 * gives the same board and the same order. A pick draws nothing.
 *
 * Picks are **in turn order**, like the Market (ONLINE_PLAN L1b's note): the off-season was answered
 * in any order until Phase N, because each stable's answer touched only its own offer. A pick takes
 * something off a shared board, so order is the rule, and the stable on the clock is `activePlayer`.
 * A pick is the turn — there is no EndPhase in a draft.
 */

/** The snake (V29): round 1 as drawn, every even round reversed. */
export function snakeOrder(round1: readonly Id[], rounds: number): Id[] {
  const out: Id[] = [];
  for (let r = 0; r < rounds; r++) out.push(...(r % 2 === 0 ? round1 : [...round1].reverse()));
  return out;
}

/** The draft being made, if the game is in one. */
export function currentDraft(s: GameState): DraftState | null {
  if (s.phase !== 'draft' && s.phase !== 'offSeason') return null;
  return s.drafts[s.drafts.length - 1] ?? null;
}

/**
 * Open the game's first phase (V29), called from `createSeason` once the stables are seated. The
 * board: `draftDogsPerStable` dogs a stable, rated and styled by `buildBoardDogs`, ages
 * `startDogAgeMin`–`startDogAgeMax`; and `draftTrainersPerStable` trainers a stable, capped by the
 * pool of 24, from a shuffle of the rows. Then round 1's order, a shuffle of the stables.
 */
export function openOpeningDraft(ctx: Ctx): void {
  const { s, rng } = ctx;
  const n = s.players.length;
  const dogs = buildBoardDogs(
    balance.draftDogsPerStable * n,
    { min: balance.startDogAgeMin, max: balance.startDogAgeMax },
    rng,
    ctx.nextId,
  );
  const staff = rng
    .shuffle(STAFF.map((r) => r.id))
    .slice(0, Math.min(STAFF.length, balance.draftTrainersPerStable * n));
  const round1 = rng.shuffle(s.players.map((p) => p.id));
  const rounds = balance.startDogs + balance.staffSlots;
  s.drafts.push({
    kind: 'opening',
    season: 1,
    rounds,
    order: snakeOrder(round1, rounds),
    at: 0,
    dogs,
    staff,
    picks: [],
  });
  s.turnOrder = [...round1];
  s.turnOrderReason = Object.fromEntries(
    round1.map((id, i) => [
      id,
      i === 0 ? 'Drawn first to pick' : `Drawn ${ordinal(i + 1)} to pick`,
    ]),
  );
  startDraftPhase(s, 'draft');
  log(
    s,
    `The draft: ${dogs.length} dogs and ${staff.length} trainers on the board, ${rounds} rounds. ` +
      `${player(s, round1[0]!).name} was drawn to pick first.`,
  );
}

/**
 * Open the off-season's draft (V32), once the dogs have aged and the notices are read: a fresh board
 * of `offDraftDogsPerStable` dogs a stable (rounded up), ages `dogOfferAgeMin`–`startDogAgeMax`, and
 * every unemployed trainer bar this off-season's leavers, shuffled, up to one a stable. The order is
 * the reverse of the season's standings — §2.4's order, the one the season's end shows.
 */
export function openOffSeasonDraft(ctx: Ctx, leavers: readonly Id[]): void {
  const { s, rng } = ctx;
  const n = s.players.length;
  const dogs = buildBoardDogs(
    Math.ceil(balance.offDraftDogsPerStable * n),
    { min: balance.dogOfferAgeMin, max: balance.startDogAgeMax },
    rng,
    ctx.nextId,
  );
  const staff = boardTrainers(
    rng,
    unemployedStaff(s)
      .map((r) => r.id)
      .filter((id) => !leavers.includes(id)),
    n,
  );
  const standings = s.seasons[s.seasons.length - 1]?.standings.map((x) => x.playerId) ?? [];
  const order = standings.length ? [...standings].reverse() : s.players.map((p) => p.id);
  s.drafts.push({
    kind: 'offSeason',
    season: s.season + 1,
    rounds: 1,
    order,
    at: 0,
    dogs,
    staff,
    picks: [],
  });
  s.turnOrder = [...order];
  s.turnOrderReason = Object.fromEntries(
    order.map((id, i) => [
      id,
      i === 0 ? 'Last at the table, so first to pick' : `${ordinal(order.length - i)} at the table`,
    ]),
  );
  startDraftPhase(s, 'offSeason');
  log(
    s,
    `The off-season draft: ${dogs.length} dogs and ${staff.length} trainer${staff.length === 1 ? '' : 's'} on the board. Last at the table picks first.`,
  );
}

function boardTrainers(rng: Rng, pool: Id[], n: number): Id[] {
  return rng.shuffle(pool).slice(0, n);
}

function startDraftPhase(s: GameState, phase: 'draft' | 'offSeason'): void {
  s.phase = phase;
  s.done = [];
  const d = s.drafts[s.drafts.length - 1]!;
  s.activePlayer = d.order[d.at] ?? null;
  if (s.activePlayer === null) finishDraft(s);
}

/** What a stable may take with its next pick: the rule a screen greys out, and the AI's legal list. */
export function draftRoom(s: GameState, playerId: Id): { dog: boolean; staff: boolean } {
  const d = currentDraft(s);
  if (!d) return { dog: false, staff: false };
  const p = player(s, playerId);
  if (d.kind === 'offSeason') return { dog: d.dogs.length > 0, staff: d.staff.length > 0 };
  return {
    dog: p.dogIds.length < balance.startDogs && d.dogs.length > 0,
    staff: p.staff.length < balance.staffSlots && d.staff.length > 0,
  };
}

/** GDD_V3 V29, V32: one pick, by the stable on the clock. */
export function draftPick(ctx: Ctx, action: Extract<Action, { t: 'DraftPick' }>): void {
  const { s } = ctx;
  const d = currentDraft(s);
  if (!d) throw new ActionError('There is no draft on', action);
  const on = d.order[d.at];
  if (on !== action.playerId) throw new ActionError(`It is not ${action.playerId}'s pick`, action);
  const p = player(s, action.playerId);
  const round = d.rounds > 1 ? Math.floor(d.at / s.players.length) + 1 : 1;
  const rec: DraftPickRecord = { playerId: p.id, round };
  const pick = action.pick;
  const off = d.kind === 'offSeason';
  if (!off && action.release !== undefined)
    throw new ActionError('Nothing is let go in the opening draft', action);

  if (pick === null) {
    if (!off) throw new ActionError('Take a dog or a trainer', action);
    if (action.release !== undefined) throw new ActionError('A pass lets nothing go', action);
    log(s, `${p.name} passes.`);
  } else if ('dog' in pick) {
    const at = d.dogs.findIndex((x) => x.id === pick.dog);
    if (at < 0) throw new ActionError('That dog is not on the board', action);
    const full = p.dogIds.length >= balance.startDogs;
    if (full && !off) throw new ActionError('Your kennel is full: take a trainer', action);
    if (full && action.release === undefined)
      throw new ActionError('Name the dog you retire to make room', action);
    if (!full && action.release !== undefined)
      throw new ActionError('There is room in the kennel: nothing to retire', action);
    let retired = '';
    if (action.release !== undefined) {
      if (!p.dogIds.includes(action.release)) throw new ActionError('Not your dog', action);
      const old = s.dogs[action.release]!;
      const paid = dogValue(old);
      p.cash += paid;
      // Its style leaves with it (`dealtGone`); nothing is dealt since Phase N, so this is a no-op
      // kept for the rule's sake.
      if (old.dealt) p.dealtGone.push(old.styleKnown ? old.style : null);
      p.dogIds = p.dogIds.filter((id) => id !== old.id);
      delete s.dogs[old.id];
      if (p.fanClubDogId === old.id) delete p.fanClubDogId;
      rec.released = { dog: { id: old.id, name: old.name, paid } };
      retired = ` and retires ${old.name} (age ${old.age}) for its book value, ${paid} Bones`;
    }
    const dog = d.dogs.splice(at, 1)[0]!;
    dog.ownerId = p.id;
    s.dogs[dog.id] = dog;
    p.dogIds.push(dog.id);
    rec.dog = { id: dog.id, name: dog.name, rating: dog.rating, age: dog.age, style: dog.style };
    log(
      s,
      `${p.name} takes ${dog.name} — rated ${dog.rating}, age ${dog.age}, a ${STYLE_BY_ID[dog.style].name.toLowerCase()}${retired}.`,
    );
  } else {
    const at = d.staff.indexOf(pick.staff);
    if (at < 0) throw new ActionError('That trainer is not on the board', action);
    const full = p.staff.length >= balance.staffSlots;
    if (full && !off) throw new ActionError('Your staff is full: take a dog', action);
    if (full && action.release === undefined)
      throw new ActionError('Name the trainer you let go to make room', action);
    if (!full && action.release !== undefined)
      throw new ActionError('There is room on the staff: nobody to let go', action);
    let gone = '';
    if (action.release !== undefined) {
      if (!p.staff.includes(action.release)) throw new ActionError('Not your trainer', action);
      p.staff = p.staff.filter((id) => id !== action.release);
      rec.released = { staff: action.release };
      gone = ` and lets ${staffRow(action.release).name} go`;
    }
    d.staff.splice(at, 1);
    p.staff.push(pick.staff);
    rec.staff = pick.staff;
    log(s, `${p.name} takes on ${staffRow(pick.staff).name}${gone}.`);
  }
  d.picks.push(rec);
  d.at++;
  s.activePlayer = d.order[d.at] ?? null;
  if (s.activePlayer === null) finishDraft(s);
}

/**
 * The last pick is in. The opening draft hands over to week 1's arrival; an off-season's to the new
 * season (both need the system's AdvancePhase). The board is dropped — what is left on it goes back
 * to nowhere — and the order and the picks stay, for the report.
 */
function finishDraft(s: GameState): void {
  const d = s.drafts[s.drafts.length - 1]!;
  d.dogs = [];
  d.staff = [];
  s.activePlayer = null;
  s.done = [];
  s.phase = d.kind === 'opening' ? 'arrival' : 'newSeason';
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}
