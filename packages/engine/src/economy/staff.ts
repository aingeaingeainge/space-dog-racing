/**
 * A stable's staff, as the engine asks about them (GDD_V3 §8): how many of a bonus it has, and what
 * its trainers take. Everything reads a **bonus**, never a name — a trainer is one or two rows of
 * `content/staff.ts` and a cut derived from them.
 */
import { balance } from '../content/balance';
import { cutOf, STAFF, staffRow, type StaffBonusId, type StaffRow } from '../content/staff';
import type { GameState, Id, Player } from '../types';

/** This stable's trainers, as rows. */
export function staffOf(p: Pick<Player, 'staff'>): StaffRow[] {
  return p.staff.map(staffRow);
}

/** How many of this stable's trainers carry this bonus. Bonuses stack: two halvers quarter it. */
export function staffBonus(p: Pick<Player, 'staff'>, id: StaffBonusId): number {
  let n = 0;
  for (const r of staffOf(p)) if (r.bonuses.includes(id)) n++;
  return n;
}

/** The share of a purse this stable's trainers take between them (§8.1). */
export function commissionRate(p: Pick<Player, 'staff'>): number {
  return staffOf(p).reduce((a, r) => a + cutOf(r), 0);
}

/** Trainers nobody employs: who a Bar card can offer (§9.1), in the rows' own order. */
export function unemployedStaff(s: GameState): StaffRow[] {
  const taken = new Set<Id>(s.players.flatMap((p) => p.staff));
  return STAFF.filter((r) => !taken.has(r.id));
}

/**
 * A purse as the stable banks it (§8.1, §8.2): the prize-money bonus first, then the commission on
 * the whole of it. Rounded once each, so the log's figures add up.
 */
export function purseAfterStaff(
  p: Pick<Player, 'staff'>,
  purse: number,
): { gross: number; commission: number; net: number } {
  const gross = Math.round(purse * (1 + staffBonus(p, 'prizeUp') * balance.staffPrizeUp));
  const commission = Math.round(gross * commissionRate(p));
  return { gross, commission, net: gross - commission };
}
