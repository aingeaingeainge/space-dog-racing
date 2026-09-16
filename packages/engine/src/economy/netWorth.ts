import { dogValue } from './dogValue';
import { cargoValue } from './goods';
import type { GameState, Player } from '../types';

export function dogsValue(state: GameState, p: Player): number {
  let total = 0;
  for (const id of p.dogIds) {
    const d = state.dogs[id];
    if (d) total += dogValue(d);
  }
  return total;
}

export interface WorthBreakdown {
  cash: number;
  dogs: number;
  cargo: number;
  total: number;
}

/**
 * Net worth (GDD_V3 §2.4):
 *
 * ```
 * netWorth = cash + Σ dogValue(rating, age, injuryStatus) + Σ cargo × localSellPrice
 * ```
 *
 * ⚠️ **The ship line and the debt line are gone (BUILD_PLAN_V3 §2.1).** There is nothing to buy for
 * a ship and nothing to borrow, so §2.4 is explicit that net worth is three terms. Cargo is still
 * valued **per good, at that good's local sell price** — what the hold would fetch if it were
 * emptied here. See `cargoValue`; `properties.test.ts` re-derives the same sum independently and
 * asserts the total is its parts.
 */
export function netWorthBreakdown(state: GameState, p: Player): WorthBreakdown {
  const cash = Math.round(p.cash);
  const dogs = dogsValue(state, p);
  const cargo = cargoValue(state, p);
  return { cash, dogs, cargo, total: cash + dogs + cargo };
}

export function netWorth(state: GameState, p: Player): number {
  return netWorthBreakdown(state, p).total;
}
