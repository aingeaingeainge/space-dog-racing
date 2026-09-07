import { balance } from '../content/balance';
import { dogValue } from './dogValue';
import type { GameState, Player } from '../types';

export function shipValue(p: Player): number {
  return Math.round((balance.shipStartValue + p.ship.upgradesPaid) * balance.shipResaleFactor);
}

export function loanRate(lender: 'bank' | 'shark'): number {
  return lender === 'bank' ? balance.bankRate : balance.sharkRate;
}

/** Principal plus one week's interest, GDD §4.3. */
export function debt(p: Player): number {
  let total = 0;
  for (const l of p.loans) total += l.principal * (1 + loanRate(l.lender));
  return Math.round(total);
}

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
  ship: number;
  cargo: number;
  debt: number;
  total: number;
}

/** GDD §4.3 net worth. Cargo is valued at the local *sell* price. */
export function netWorthBreakdown(state: GameState, p: Player): WorthBreakdown {
  const cash = Math.round(p.cash);
  const dogs = dogsValue(state, p);
  const ship = shipValue(p);
  const cargo = Math.round(p.cargo * state.planet.foodSell);
  const owed = debt(p);
  return { cash, dogs, ship, cargo, debt: owed, total: cash + dogs + ship + cargo - owed };
}

export function netWorth(state: GameState, p: Player): number {
  return netWorthBreakdown(state, p).total;
}
