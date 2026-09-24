import { balance } from '../content/balance';
import { staffRow } from '../content/staff';
import { acceptOffer, describeOffer, rollOffer } from '../economy/acquire';
import { dogValue } from '../economy/dogValue';
import { unemployedStaff } from '../economy/staff';
import { mulberry32 } from '../rng';
import { dog, log, player, type Ctx } from '../state';
import { ActionError, type Action, type GameState, type Id, type OffSeasonNotice } from '../types';
import { revealStyles } from './raceDay';
import { startPlayerPhase } from './turn';

/**
 * The off-season (GDD_V3 §2.2): **at most three clicks** between one season and the next.
 *
 * 1. **Every dog ages a year** — shown, not asked. ⚠️ This is where the age tick lives now: §4.3 says
 *    age ticks once, in the off-season, and until Phase E1 it ticked at week 7 of every season. So a
 *    one-season game has no ageing at all.
 * 2. **The retirement window.** Each stable may retire one dog, paid its book value, and takes the
 *    replacement on offer in its place. The stable sees the offer first — §9.2's age, one true stat
 *    and patter that can lie — and then chooses "retire *name*" for one of its dogs or "keep them
 *    all": §2.2 says you see what you are being offered before you accept.
 * 3. **The staff notice.** Each trainer has a `staffNoticeChance` of leaving for a better stable. A
 *    stable left with fewer than two is offered one candidate from those nobody employs.
 *
 * **The streams (decision D1's pattern).** When the off-season opens, the game's stream draws one
 * seed per stable, in seating order, and nothing else. Everything a stable's off-season rolls — the
 * offer, the notices, the candidate — is rolled at once, on that stable's own stream, before anybody
 * answers anything; the answers themselves draw nothing. So no choice moves the game's stream or
 * another stable's draws. The one thing that crosses between stables is the candidate pool: a
 * trainer who left one stable can be offered to another, and no trainer is offered to two. That is a
 * fact about the draws, never about anybody's answer.
 */

/** Open the off-season: age every dog, roll every stable's notice, and hand the table the screen. */
export function openOffSeason(ctx: Ctx): void {
  const { s, rng } = ctx;
  // 1. Every dog ages a year (§4.3). Locals were swept at the jump; every dog left is a stable's.
  for (const p of s.players)
    for (const id of p.dogIds) {
      const d = dog(s, id);
      d.age = Math.min(7, d.age + 1);
    }
  log(s, `The off-season: every dog on the circuit is a year older.`);

  // One seed per stable, seating order, from the game's stream — and nothing else from it.
  const streams = new Map(
    s.players.map((p) => [p.id, mulberry32(Math.floor(rng.next() * 4294967296))]),
  );
  const notices: Record<Id, OffSeasonNotice> = {};
  // 2 and 3, first pass: the replacement on offer, then a draw for each trainer's notice. Every
  // stable makes the same number of draws whatever they land on.
  for (const p of s.players) {
    const r = streams.get(p.id)!;
    const offer = rollOffer(r, { lieMult: balance.retireOfferLieMult });
    const left = p.staff.filter(() => r.chance(balance.staffNoticeChance));
    p.staff = p.staff.filter((id) => !left.includes(id));
    for (const id of left)
      log(s, `${staffRow(id).name} has left ${p.name} for a better stable.`, p.id);
    notices[p.id] = { offer, left, candidate: null };
  }
  // Second pass, once everybody's notices are in: a stable left short is offered one candidate,
  // never one of its own leavers, never one already offered to somebody else.
  const offered = new Set<Id>();
  for (const p of s.players) {
    if (p.staff.length >= balance.staffSlots) continue;
    const n = notices[p.id]!;
    const pool = unemployedStaff(s).filter((r) => !n.left.includes(r.id) && !offered.has(r.id));
    if (!pool.length) continue;
    const pick = streams.get(p.id)!.pick(pool);
    n.candidate = pick.id;
    offered.add(pick.id);
  }
  s.offSeason = { notices };
  startPlayerPhase(s, 'offSeason');
}

/** The text a stable reads about the replacement it would be offered. */
export function describeRetirementOffer(n: OffSeasonNotice): string {
  return `A breeder's agent has a dog for whoever retires one: ${describeOffer(n.offer)}`;
}

function noticeFor(s: GameState, playerId: Id, action: Action): OffSeasonNotice {
  if (s.phase !== 'offSeason' || !s.offSeason)
    throw new ActionError('It is not the off-season', action);
  if (s.activePlayer !== playerId) throw new ActionError(`It is not ${playerId}'s turn`, action);
  const n = s.offSeason.notices[playerId];
  if (!n) throw new ActionError('No off-season for this stable', action);
  return n;
}

/** GDD_V3 §2.2 step 2: retire a dog for its book value and take the replacement, or keep them all. */
export function retire(ctx: Ctx, action: Extract<Action, { t: 'Retire' }>): void {
  const { s } = ctx;
  const n = noticeFor(s, action.playerId, action);
  if (n.retired !== undefined) throw new ActionError('The retirement window is answered', action);
  const p = player(s, action.playerId);
  if (action.dogId === null) {
    n.retired = null;
    log(s, `${p.name} keeps them all.`, p.id);
    return;
  }
  if (!p.dogIds.includes(action.dogId)) throw new ActionError('Not your dog', action);
  const old = dog(s, action.dogId);
  const paid = dogValue(old);
  p.cash += paid;
  const { joined, left } = acceptOffer(s, p, n.offer, action.dogId, ctx.nextId);
  n.retired = action.dogId;
  n.paid = paid;
  log(
    s,
    `${p.name} retires ${left.name} (age ${left.age}) for its book value, ${paid} Bones, and takes on ${joined.name}, age ${joined.age}.`,
  );
  // A dealt dog leaving takes its style with it (dealtGone): the §5.5 elimination stays sound.
  revealStyles(s, []);
}

/** GDD_V3 §2.2 step 3: take the candidate on, or not. */
export function resolveStaffNotice(
  ctx: Ctx,
  action: Extract<Action, { t: 'ResolveStaffNotice' }>,
): void {
  const { s } = ctx;
  const n = noticeFor(s, action.playerId, action);
  if (!n.candidate) throw new ActionError('Nobody is on offer', action);
  if (n.hired !== undefined) throw new ActionError('The staff notice is answered', action);
  const p = player(s, action.playerId);
  n.hired = action.hire;
  if (action.hire) {
    p.staff.push(n.candidate);
    log(s, `${p.name} takes on ${staffRow(n.candidate).name}.`, p.id);
  }
}

/** What a stable still has to answer before it may leave the off-season screen. */
export function offSeasonOutstanding(s: GameState, playerId: Id): string | null {
  const n = s.offSeason?.notices[playerId];
  if (!n) return null;
  if (n.retired === undefined) return 'Answer the retirement window first';
  if (n.candidate && n.hired === undefined) return 'Answer the staff notice first';
  return null;
}
