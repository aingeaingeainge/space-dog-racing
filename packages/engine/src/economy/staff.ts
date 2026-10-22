/**
 * A stable's staff, as the engine asks about them (GDD_V3 §8, as Phase T rewrote it): how many of a
 * bonus it has, who fills a role, and what each takes from its own side. Everything reads a **bonus**,
 * never a name — a member of staff is one or two rows of `content/staff.ts` and a cut derived from them.
 */
import { balance } from '../content/balance';
import {
  cutOf,
  STAFF,
  STAFF_ROLES,
  staffRow,
  type StaffBonusId,
  type StaffRole,
  type StaffRow,
} from '../content/staff';
import { good } from '../content/goods';
import type { GameState, GoodId, Id, Player } from '../types';

/** This stable's staff, as rows, in role order. */
export function staffOf(p: Pick<Player, 'staff'>): StaffRow[] {
  return p.staff.map(staffRow);
}

/** Who fills this role for the stable, if anybody. */
export function staffInRole(p: Pick<Player, 'staff'>, role: StaffRole): StaffRow | null {
  return staffOf(p).find((r) => r.role === role) ?? null;
}

/**
 * Put a stable's staff back in role order (Trainer, Trade, Gambling). Called after every hire, so the
 * save never depends on the order people were taken on in.
 */
export function sortStaff(p: Pick<Player, 'staff'>): void {
  p.staff.sort(
    (a, b) => STAFF_ROLES.indexOf(staffRow(a).role) - STAFF_ROLES.indexOf(staffRow(b).role),
  );
}

/**
 * Take this person on, into their own role: whoever held it goes. Returns who went, if anybody.
 * The one way a stable's staff changes (the draft, a Bar card), so "one of each" cannot be broken.
 */
export function hire(p: Pick<Player, 'staff'>, id: Id): Id | null {
  const row = staffRow(id);
  const gone = staffInRole(p, row.role)?.id ?? null;
  p.staff = p.staff.filter((x) => x !== gone);
  p.staff.push(id);
  sortStaff(p);
  return gone;
}

/** How many of this stable's staff carry this bonus (0 or 1: one person a role, a bonus a role). */
export function staffBonus(p: Pick<Player, 'staff'>, id: StaffBonusId): number {
  let n = 0;
  for (const r of staffOf(p)) if (r.bonuses.includes(id)) n++;
  return n;
}

/** The share of its own side this role takes for the stable: 0 if the role is empty (§8.1). */
export function cutFor(p: Pick<Player, 'staff'>, role: StaffRole): number {
  const r = staffInRole(p, role);
  return r ? cutOf(r) : 0;
}

/** The share of a purse the Trainer takes (§8.1). */
export function commissionRate(p: Pick<Player, 'staff'>): number {
  return cutFor(p, 'trainer');
}

/** People nobody employs: who a Bar card can offer (§9.1), in the rows' own order. */
export function unemployedStaff(s: GameState, role?: StaffRole): StaffRow[] {
  const taken = new Set<Id>(s.players.flatMap((p) => p.staff));
  return STAFF.filter((r) => !taken.has(r.id) && (!role || r.role === role));
}

/**
 * A purse as the stable banks it (§8.1, §8.2): the prize-money bonus first, then the Trainer's
 * commission on the whole of it. Rounded once each, so the log's figures add up.
 */
export function purseAfterStaff(
  p: Pick<Player, 'staff'>,
  purse: number,
): { gross: number; commission: number; net: number } {
  const gross = Math.round(purse * (1 + staffBonus(p, 'prizeUp') * balance.staffPrizeUp));
  const commission = Math.round(gross * commissionRate(p));
  return { gross, commission, net: gross - commission };
}

/**
 * What one crate of a good costs this stable to buy, and fetches when it sells (Phase T, T3): the
 * posted prices, moved by its Trade Advisor's haggling and selling. **A stable's sell price is held at
 * least a Bone under its buy price**, so no advisor can open a same-planet arbitrage (food.ts's
 * `foodSpread` rule).
 */
export function pricesFor(
  s: GameState,
  p: Pick<Player, 'staff'> & Partial<Pick<Player, 'priceMult'>>,
  id: GoodId,
): { buy: number; sell: number } {
  const m = s.planet.goods[id];
  // A glut or a shortage this stable found (Phase T): the posted price moved for it alone, inside
  // the band, with the sell re-derived from the buy as `scaleGood` always did.
  const mult = p.priceMult?.[id] ?? 1;
  const g = good(id);
  const postedBuy =
    mult === 1 ? m.buy : Math.min(g.ceiling, Math.max(g.floor, Math.round(m.buy * mult)));
  const postedSell =
    mult === 1 ? m.sell : Math.max(1, Math.round(postedBuy * (1 - balance.foodSpread)));
  const buy = Math.max(
    1,
    Math.round(postedBuy * (1 - staffBonus(p, 'haggle') * balance.staffHaggle)),
  );
  const up = Math.round(postedSell * (1 + staffBonus(p, 'sellUp') * balance.staffSellUp));
  return { buy, sell: Math.max(0, Math.min(up, buy - 1)) };
}

/**
 * A stable's own shelf depth for a posted depth (T2): `privateShelfShare` of it — the posted depths
 * were a whole table's shelf, shared — times the planet's multiplier (Blackreach) and a Trade Advisor's
 * deeper shelf, rounded up, so a stable is never offered none of a good.
 */
export function shelfDepthFor(p: Pick<Player, 'staff'>, posted: number, planetMult = 1): number {
  const base = posted * balance.privateShelfShare * planetMult;
  return Math.ceil(base * (1 + staffBonus(p, 'deepShelf') * balance.staffDeepShelf));
}

/**
 * The Trade Advisor's cut of a sale (T4): a share of the **profit** — crates × (sell − You Paid), when
 * that is above zero. A crate that came free (an event) was paid nothing, so all of it is profit.
 */
export function tradeCommission(p: Player, id: GoodId, crates: number, sellEach: number): number {
  const profit = crates * (sellEach - p.paid[id]);
  if (profit <= 0) return 0;
  return Math.round(profit * cutFor(p, 'trade'));
}

/** The Gambling Advisor's cut of a winning slip (T4): a share of payout − stake. */
export function betCommission(p: Pick<Player, 'staff'>, stake: number, payout: number): number {
  const profit = payout - stake;
  if (profit <= 0) return 0;
  return Math.round(profit * cutFor(p, 'gambling'));
}

/** Fitness a week a trainer adds to a dog that did not run (§8.2): `weeklyFitnessDelta`'s bonus. */
export function restBonus(p: Pick<Player, 'staff'>): number {
  return staffBonus(p, 'fitnessWeek') * balance.staffFitnessWeek;
}

/**
 * What a Normal stable thinks a bonus is worth a week (Phase D2 item 2), before the cut: a share of the
 * stable's weekly takings on that bonus's side, plus a flat figure in Bones. The AI's price list — a
 * rule a player works out, not a measurement — and deliberately rough. Phase T: `prize` is a share of
 * the side the role is paid from (purses, trading profit, winnings), and the advisors' rows are new.
 */
export const STAFF_WORTH: Record<StaffBonusId, { side: number; flat: number }> = {
  // ⚠️ Phase T: **every row is what `harness --draft` measured the bonus worth**, as a share of its
  // own side — its fair cut (17,000 stables at `v3t`, see claude/V3_PHASE_T_NOTES.md). Until `v3t`
  // the trainers' rows were D2's rough guesses, and with three roles to fill the guesses decided who
  // got the good people: a draft position read up to 6.8 points off fair before they were measured.
  statWeek: { side: 0.056, flat: 0 },
  fitnessWeek: { side: 0.095, flat: 0 },
  injuryHalf: { side: 0.005, flat: 0 },
  injuryShort: { side: 0.02, flat: 0 },
  prizeUp: { side: 0.126, flat: 0 },
  saferExplore: { side: 0.012, flat: 0 },
  shelfIntel: { side: 0.09, flat: 0 },
  haggle: { side: 0.24, flat: 0 },
  sellUp: { side: 0.03, flat: 0 },
  deepShelf: { side: 0.23, flat: 0 },
  whisper: { side: 0.2, flat: 0 },
  sharpOdds: { side: 0.25, flat: 0 },
  stakeUp: { side: 0, flat: 0 },
};

/** Before a stable has raced, traded or bet much, what each side brings in a week. */
const SIDE_PRIOR: Record<StaffRole, number> = { trainer: 2000, trade: 300, gambling: 150 };

/**
 * This stable's takings a week so far on one side, before its staff's cut, or the prior if that is
 * more: purses for the Trainer, profit on sales for the Trade Advisor, winnings for the Gambling one.
 */
export function weeklySide(s: GameState, p: Player, role: StaffRole): number {
  const done = Math.max(1, s.week - 1);
  const side =
    role === 'trainer'
      ? p.stats.prizeIncome + p.stats.commission
      : role === 'trade'
        ? Math.max(0, p.stats.tradeIncome) + p.stats.tradeCommission
        : Math.max(0, p.stats.betIncome) + p.stats.betCommission;
  return Math.max(SIDE_PRIOR[role], side / done);
}

/** Kept for the scripts that read it: a Trainer's side, purses a week. */
export function weeklyPrize(s: GameState, p: Player): number {
  return weeklySide(s, p, 'trainer');
}

/** A member of staff's worth to this stable a week, less their cut of its side: Bones a week. */
export function trainerNet(
  s: GameState,
  p: Player,
  row: StaffRow,
  worth: Record<StaffBonusId, { side: number; flat: number }> = STAFF_WORTH,
): number {
  const w = weeklySide(s, p, row.role);
  let v = 0;
  for (const id of row.bonuses) v += worth[id].side * w + worth[id].flat;
  return v - cutOf(row) * w;
}

/** `trainerNet`, by its role-free name. */
export const staffNet = trainerNet;

/**
 * The hire rule (Phase D2 item 2, by role since Phase T): **take the offer if its role is empty, or if
 * it is worth more than whoever holds the role by a margin of two points of that side's weekly takings.**
 */
export function wouldHire(
  s: GameState,
  p: Player,
  offer: StaffRow,
  worth: Record<StaffBonusId, { side: number; flat: number }> = STAFF_WORTH,
): boolean {
  const now = staffInRole(p, offer.role);
  if (!now) return true;
  const margin = HIRE_MARGIN * weeklySide(s, p, offer.role);
  return trainerNet(s, p, offer, worth) > trainerNet(s, p, now, worth) + margin;
}

/** Two points of the side's weekly takings: what an offer has to beat the holder by. */
export const HIRE_MARGIN = 0.02;

/**
 * Hard's price list (Phase D2 item 4, GDD §14's "better decisions, same rules"): Normal's, plus what
 * Hard actually does with a bonus Normal uses less: it trades on a tip, so next week's shelf is priced
 * off its own trading.
 */
export function hardWorth(p: Player): Record<StaffBonusId, { side: number; flat: number }> {
  const trade = Math.max(0, p.stats.tradeIncome);
  return {
    ...STAFF_WORTH,
    shelfIntel: { side: STAFF_WORTH.shelfIntel.side, flat: Math.max(0, trade * 0.01) },
  };
}
