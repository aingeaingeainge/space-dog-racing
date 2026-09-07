import { balance } from '../content/balance';

/**
 * The bookie's model (GDD §10): a Bradley–Terry / logistic strength model on public ratings,
 *   strength_i = 10^(rating_i / oddsScale),  P(win_i) = strength_i / Σ strength.
 * `oddsScale` is calibrated against simulateRace by scripts/harness.ts --calibrate so that a
 * rating-65 dog against seven 50s wins about half the time.
 */
export function winProbabilities(ratings: readonly number[]): number[] {
  const strengths = ratings.map((r) => Math.pow(10, r / balance.oddsScale));
  const total = strengths.reduce((s, x) => s + x, 0);
  return strengths.map((s) => Math.max(balance.oddsFloor, s / total));
}

/** Harville expansion: probability each runner finishes in the top `places`. */
export function placeProbabilities(ratings: readonly number[], places = 3): number[] {
  const n = ratings.length;
  const strengths = ratings.map((r) => Math.pow(10, r / balance.oddsScale));
  const result = new Array<number>(n).fill(0);
  const recurse = (remaining: number[], depth: number, prob: number) => {
    if (depth === places) return;
    const total = remaining.reduce((s, i) => s + strengths[i]!, 0);
    for (const i of remaining) {
      const p = prob * (strengths[i]! / total);
      result[i] = result[i]! + p;
      recurse(
        remaining.filter((j) => j !== i),
        depth + 1,
        p,
      );
    }
  };
  recurse(
    Array.from({ length: n }, (_, i) => i),
    0,
    1,
  );
  return result.map((p) => Math.min(1, Math.max(balance.oddsFloor, p)));
}

/** Decimal odds from a probability and the house margin: (1 − margin) / p, floored at 1.01. */
export function decimalOdds(p: number, margin = balance.bettingMargin): number {
  return Math.max(1.01, Math.round(((1 - margin) / p) * 100) / 100);
}

/** Probability that the dog with `rating` beats a field of `others` (convenience for AI). */
export function winProbAgainst(rating: number, others: readonly number[]): number {
  return winProbabilities([rating, ...others])[0]!;
}
