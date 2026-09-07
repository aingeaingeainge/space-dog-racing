import { balance } from '../content/balance';
import type { Player } from '../types';

export function loanCap(lender: 'bank' | 'shark'): number {
  return lender === 'bank' ? balance.bankMax : balance.sharkMax;
}

export function outstanding(p: Player, lender: 'bank' | 'shark'): number {
  return p.loans.filter((l) => l.lender === lender).reduce((s, l) => s + l.principal, 0);
}

export function weeklyInterest(p: Player): number {
  let total = 0;
  for (const l of p.loans)
    total += l.principal * (l.lender === 'bank' ? balance.bankRate : balance.sharkRate);
  return Math.round(total);
}
