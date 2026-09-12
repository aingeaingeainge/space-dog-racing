import { balance } from '../content/balance';
import {
  SCOUT_DOGS,
  TIPSTER_REACH,
  TRADER_HOLD,
  TRAINER_POINTS,
  VET_REST_BONUS,
} from '../content/staff';
import { TIER_ORDER } from '../content/goods';
import type { GoodTier, Player, StaffOffer, StaffRole } from '../types';

/**
 * Reading a staff list (GDD §8.3, D7).
 *
 * `Player.staff` is a **list** of up to `staffSlots` hires in any mix, so "have I got a vet" and
 * "how good is my best vet" are two different questions and every caller asks one of them here
 * rather than indexing. Three trainers is a legal stable and the whole point of D7, so nothing in
 * the engine may assume one hire per role.
 *
 * **Stacking is not penalised and is not double-counted either.** Two trainers do not add their
 * points: the *best* one trains. What a second trainer buys is nothing, which is exactly what makes
 * D7's acceptance row — does stacking three of one role beat a mixed three — measurable rather than
 * rhetorical. If it turns out that stacking wins anyway, that is a finding about the roles' shapes,
 * which is where §8.3 says the balance belongs.
 */
export function staffOf(p: Player, role: StaffRole): StaffOffer[] {
  return p.staff.filter((o) => o.role === role);
}

export function hasStaff(p: Player, role: StaffRole): boolean {
  return p.staff.some((o) => o.role === role);
}

/** The best hire in one role, or null. "Best" is tier order, and ties cannot happen in practice. */
export function bestStaff(p: Player, role: StaffRole): StaffOffer | null {
  let best: StaffOffer | null = null;
  for (const o of p.staff) {
    if (o.role !== role) continue;
    if (!best || TIER_ORDER.indexOf(o.tier) > TIER_ORDER.indexOf(best.tier)) best = o;
  }
  return best;
}

export function bestTier(p: Player, role: StaffRole): GoodTier | null {
  return bestStaff(p, role)?.tier ?? null;
}

/** The whole wage bill, charged every week until they are let go (GDD §7.2). */
export function wageBill(p: Player): number {
  let total = 0;
  for (const o of p.staff) total += o.wage;
  return total;
}

/** Stat points the trainer adds to a dog on a Train week. Zero without one. */
export function trainerPoints(p: Player): number {
  const tier = bestTier(p, 'trainer');
  return tier ? TRAINER_POINTS[tier] : 0;
}

/** Fitness a rest week gains on top of the base. A Rough vet buys shorter injuries, not this. */
export function vetRestBonus(p: Player): number {
  const tier = bestTier(p, 'vet');
  return tier ? VET_REST_BONUS[tier] : 0;
}

/** Weeks knocked off a fresh injury, and whether the rest of it is halved (GDD §8.3). */
export function vetInjuryRelief(p: Player): { weeksOff: number; halve: boolean; chanceCut: number } {
  const tier = bestTier(p, 'vet');
  if (!tier) return { weeksOff: 0, halve: false, chanceCut: 0 };
  return {
    weeksOff: tier === 'rough' ? balance.vetInjuryWeeksOff : 0,
    halve: tier !== 'rough',
    chanceCut: tier === 'prime' ? balance.vetInjuryCutPrime : 0,
  };
}

export function scoutDogs(p: Player): number {
  const tier = bestTier(p, 'scout');
  return tier ? SCOUT_DOGS[tier] : 0;
}

/** Does the Scout turn up one dog priced under book? Proper and above. */
export function scoutFindsBargain(p: Player): boolean {
  const tier = bestTier(p, 'scout');
  return tier === 'proper' || tier === 'prime';
}

/**
 * The hold, including whatever a Trader adds to it (GDD §8.3).
 *
 * Every room-in-the-hold check goes through this rather than `p.ship.cargoCap`, so hiring a Trader
 * is felt at the Docks the same week. The ship's own capacity is still what a cargo upgrade buys
 * and what resale is priced on: a Trader is a wage, and a wage does not become an asset.
 */
export function cargoCap(p: Player): number {
  const tier = bestTier(p, 'trader');
  return p.ship.cargoCap + (tier ? TRADER_HOLD[tier] : 0);
}

/** Fraction off every buy price. Prime trader only. */
export function traderDiscount(p: Player): number {
  return bestTier(p, 'trader') === 'prime' ? balance.traderDiscountPrime : 0;
}

/** What a good costs this stable here, after its Trader's discount. */
export function buyPriceFor(p: Player, listed: number): number {
  const off = traderDiscount(p);
  return off > 0 ? Math.max(1, Math.round(listed * (1 - off))) : listed;
}

/**
 * How far ahead this stable may look, free (GDD §9.3).
 *
 * **What is free is a *name*, not a briefing.** §9.3: next week's planet and its Major status, and
 * nothing about its track, its kibble band or its card. So with no Tipster both numbers here are
 * **zero** — a stable knows where it is going and not what it will cost — and a Tipster is what
 * buys the detail. `FREE_HORIZON` stays one week and is about the name alone.
 *
 * The AI's `planetAhead` guard reads exactly this, so an agent with a Tipster sees what a player
 * with the same Tipster sees and not a week more. That guard is what keeps §14's "every difficulty
 * sees what a player sees" enforced rather than merely intended.
 */
export function infoReach(p: Player): { band: number; card: number } {
  const tier = bestTier(p, 'tipster');
  return tier ? TIPSTER_REACH[tier] : { band: 0, card: 0 };
}
