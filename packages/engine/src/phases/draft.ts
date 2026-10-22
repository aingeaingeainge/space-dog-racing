import { balance } from '../content/balance';
import { ROLE_INFO, STAFF_ROLES, staffOfRole, staffRow, type StaffRole } from '../content/staff';
import { STYLE_BY_ID } from '../content/styles';
import { buildBoardDogs } from '../economy/dogs';
import { dogValue } from '../economy/dogValue';
import { hire, staffInRole, unemployedStaff } from '../economy/staff';
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
 *   `startDogs` (4) dogs and **one of each of the three staff roles** (Phase T, T2: a Dog Trainer, a
 *   Trade Advisor and a Gambling Advisor), picked one at a time from a public board in a **snake**:
 *   round 1's order is a shuffle of the stables, round 2 reverses it, and so on for seven rounds. On its
 *   pick a stable takes one dog or one member of staff in a role it has not filled; a full kennel can
 *   only take staff and full staff only dogs, so every pick is forced to leave the stable where the
 *   rounds need it.
 * - **The off-season draft** (V32) is one round of the same, in **reverse order of the season's
 *   standings** (last picks first), from a fresh board, after the ageing and the staff notice. A
 *   stable takes a dog (retiring one of its own, paid its book value), takes a member of staff (who
 *   replaces whoever holds that role), or passes.
 *
 * **The board is public** (V30): every dog's age, three stats, rating, book value and running style,
 * every person's role, bonuses and cut. A drafted dog's style is known to the table from the start.
 *
 * ⚠️ **The drafts are the one thing still taken in turn order** (Phase T, Jesse's call): a pick takes
 * something off a shared board. The weekend itself is everybody at once (T1).
 *
 * The board and the order are drawn from the game's stream when the draft opens, so the same seed
 * gives the same board and the same order. A pick draws nothing.
 *
 * Picks are **in turn order**, like the Market (ONLINE_PLAN L1b's note): the off-season was answered
 * in any order until Phase N, because each stable's answer touched only its own offer. A pick takes
 * something off a shared board, so order is the rule, and the stable on the clock is `activePlayer`.
 * A pick is the turn — there is no EndPhase in a draft.
 */

/**
 * The snake (V29): round 1 as drawn, every even round reversed. With `thirdReverses` (Q2) round 3 runs
 * the way round 2 did, and the snake carries on from there: so the stable that picked first picks last
 * twice running, and the last pick of round 1 opens round 3.
 */
export function snakeOrder(round1: readonly Id[], rounds: number, thirdReverses = false): Id[] {
  const out: Id[] = [];
  for (let r = 0; r < rounds; r++) {
    const backwards = thirdReverses && r >= 2 ? r % 2 === 0 : r % 2 === 1;
    out.push(...(backwards ? [...round1].reverse() : round1));
  }
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
 * `startDogAgeMin`–`startDogAgeMax`; and, of each staff role, `draftStaffPerRole` a stable (rounded up,
 * capped by the role's roster), from a shuffle of that role's rows (Phase T). Then round 1's order, a
 * shuffle of the stables.
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
  const staff = STAFF_ROLES.flatMap((role) => {
    const pool = staffOfRole(role).map((r) => r.id);
    return rng
      .shuffle(pool)
      .slice(0, Math.min(pool.length, Math.ceil(balance.draftStaffPerRole * n)));
  });
  const round1 = rng.shuffle(s.players.map((p) => p.id));
  const rounds = balance.startDogs + STAFF_ROLES.length;
  s.drafts.push({
    kind: 'opening',
    season: 1,
    rounds,
    order: snakeOrder(round1, rounds, balance.draftThirdRoundReverses === 1),
    at: 0,
    dogs,
    staff,
    picks: [],
  });
  startDraftPhase(s, 'draft');
  log(
    s,
    `The draft: ${dogs.length} dogs and ${staff.length} staff on the board, ${rounds} rounds. ` +
      `${player(s, round1[0]!).name} was drawn to pick first.`,
  );
}

/**
 * Open the off-season's draft (V32), once the dogs have aged and the notices are read: a fresh board
 * of `offDraftDogsPerStable` dogs a stable (rounded up), rated `offDraftRatingMin`–`offDraftRatingMax`
 * (its own range since Phase N's balance commit, Jesse's call), ages `dogOfferAgeMin`–`startDogAgeMax`, and
 * of each staff role, the unemployed bar this off-season's leavers, shuffled, up to a third of the
 * stables (rounded up) — about one a stable in all, as the trainers' board was before Phase T. The
 * order is the reverse of the season's standings — §2.4's order, the one the season's end shows.
 */
export function openOffSeasonDraft(ctx: Ctx, leavers: readonly Id[]): void {
  const { s, rng } = ctx;
  const n = s.players.length;
  const dogs = buildBoardDogs(
    Math.ceil(balance.offDraftDogsPerStable * n),
    { min: balance.dogOfferAgeMin, max: balance.startDogAgeMax },
    rng,
    ctx.nextId,
    { min: balance.offDraftRatingMin, max: balance.offDraftRatingMax },
  );
  const staff = STAFF_ROLES.flatMap((role) =>
    boardStaff(
      rng,
      unemployedStaff(s, role)
        .map((r) => r.id)
        .filter((id) => !leavers.includes(id)),
      Math.ceil(n / STAFF_ROLES.length),
    ),
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
  startDraftPhase(s, 'offSeason');
  log(
    s,
    `The off-season draft: ${dogs.length} dogs and ${staff.length} staff on the board. Last at the table picks first.`,
  );
}

function boardStaff(rng: Rng, pool: Id[], n: number): Id[] {
  return rng.shuffle(pool).slice(0, n);
}

function startDraftPhase(s: GameState, phase: 'draft' | 'offSeason'): void {
  s.phase = phase;
  s.done = [];
  const d = s.drafts[s.drafts.length - 1]!;
  s.activePlayer = d.order[d.at] ?? null;
  if (s.activePlayer === null) finishDraft(s);
}

/**
 * What a stable may take with its next pick: the rule a screen greys out, and the AI's legal list.
 * `roles` are the staff roles it may draft into (Phase T): in the opening draft those it has not
 * filled, in the off-season any (whoever holds it goes) — and only roles with somebody on the board.
 */
export function draftRoom(
  s: GameState,
  playerId: Id,
): { dog: boolean; staff: boolean; roles: StaffRole[] } {
  const d = currentDraft(s);
  if (!d) return { dog: false, staff: false, roles: [] };
  const p = player(s, playerId);
  const onBoard = (role: StaffRole) => d.staff.some((id) => staffRow(id).role === role);
  const roles = STAFF_ROLES.filter(
    (role) => onBoard(role) && (d.kind === 'offSeason' || !staffInRole(p, role)),
  );
  if (d.kind === 'offSeason') return { dog: d.dogs.length > 0, staff: roles.length > 0, roles };
  return {
    dog: p.dogIds.length < balance.startDogs && d.dogs.length > 0,
    staff: roles.length > 0,
    roles,
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
    if (full && !off) throw new ActionError('Your kennel is full: take a member of staff', action);
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
    if (at < 0) throw new ActionError('That person is not on the board', action);
    // Phase T (T2): one of each role. A new hire goes into their own role, and whoever held it goes —
    // which the opening draft never allows (a stable drafts each role once) and the off-season does.
    const row = staffRow(pick.staff);
    const holder = staffInRole(p, row.role);
    const role = ROLE_INFO[row.role].name;
    if (holder && !off) throw new ActionError(`You already have a ${role}: take a dog`, action);
    if (action.release !== undefined && action.release !== holder?.id)
      throw new ActionError(
        holder
          ? `${row.name} replaces ${holder.name}, your ${role}`
          : `You have no ${role} to let go`,
        action,
      );
    hire(p, pick.staff);
    let gone = '';
    if (holder) {
      rec.released = { staff: holder.id };
      gone = ` and lets ${holder.name} go`;
    }
    d.staff.splice(at, 1);
    rec.staff = pick.staff;
    log(s, `${p.name} takes on ${row.name} as ${role}${gone}.`);
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
