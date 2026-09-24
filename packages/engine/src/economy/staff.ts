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

/** Fitness a week a trainer adds to a dog that did not run (§8.2): `weeklyFitnessDelta`'s bonus. */
export function restBonus(p: Pick<Player, 'staff'>): number {
  return staffBonus(p, 'fitnessWeek') * balance.staffFitnessWeek;
}

/**
 * What a Normal stable thinks a bonus is worth a week (Phase D2 item 2): a share of its own weekly
 * prize money for the bonuses that win races, a flat figure in Bones for the ones that do not. The
 * AI's price list — a rule a player works out, not a measurement — and deliberately rough.
 *
 * ⚠️ `styleReveal` is worth nothing to Normal, because Normal never reads the field.
 */
export const STAFF_WORTH: Record<StaffBonusId, { prize: number; flat: number }> = {
  statWeek: { prize: 0.04, flat: 0 },
  fitnessWeek: { prize: 0.03, flat: 0 },
  injuryHalf: { prize: 0.03, flat: 0 },
  injuryShort: { prize: 0.015, flat: 0 },
  styleReveal: { prize: 0, flat: 0 },
  shelfIntel: { prize: 0, flat: 80 },
  prizeUp: { prize: 0.1, flat: 0 },
  saferExplore: { prize: 0, flat: 40 },
};

/** Before a stable has raced much, what it expects to win a week: about the all-Normal mean. */
const PRIZE_PRIOR = 2000;

/** This stable's prize money a week so far, before the cut, or the prior if that is more. */
export function weeklyPrize(s: GameState, p: Player): number {
  const done = Math.max(1, s.week - 1);
  return Math.max(PRIZE_PRIOR, (p.stats.prizeIncome + p.stats.commission) / done);
}

/** A trainer's worth to this stable a week, less their cut of its purses: Bones a week. */
export function trainerNet(
  s: GameState,
  p: Player,
  row: StaffRow,
  worth: Record<StaffBonusId, { prize: number; flat: number }> = STAFF_WORTH,
): number {
  const w = weeklyPrize(s, p);
  let v = 0;
  for (const id of row.bonuses) v += worth[id].prize * w + worth[id].flat;
  return v - cutOf(row) * w;
}

/**
 * The hire rule (Phase D2 item 2): **take the offer into the slot of the trainer worth least to this
 * stable, if the offer is worth more than that trainer by a margin of two points of its weekly prize
 * money.** Returns the slot to hire into, or −1 to walk away. An empty slot is always filled.
 */
export function hireSlot(
  s: GameState,
  p: Player,
  offer: StaffRow,
  worth: Record<StaffBonusId, { prize: number; flat: number }> = STAFF_WORTH,
): number {
  if (p.staff.length < balance.staffSlots) return p.staff.length;
  const nets = staffOf(p).map((r) => trainerNet(s, p, r, worth));
  const worst = nets.indexOf(Math.min(...nets));
  const margin = HIRE_MARGIN * weeklyPrize(s, p);
  return trainerNet(s, p, offer, worth) > nets[worst]! + margin ? worst : -1;
}

/** Two points of the stable's weekly prize money: what an offer has to beat the worst trainer by. */
export const HIRE_MARGIN = 0.02;

/**
 * Hard's price list (Phase D2 item 4, GDD §14's "better decisions, same rules"): Normal's, plus what
 * Hard actually does with the two bonuses Normal cannot use — it reads the field, so a style revealed
 * is worth a little; and it trades on a tip, so next week's shelf is priced off its own trading.
 */
export function hardWorth(p: Player): Record<StaffBonusId, { prize: number; flat: number }> {
  const trade = Math.max(0, p.stats.tradeIncome);
  return {
    ...STAFF_WORTH,
    styleReveal: { prize: 0.005, flat: 0 },
    shelfIntel: { prize: 0, flat: Math.max(STAFF_WORTH.shelfIntel.flat, trade * 0.01) },
  };
}
