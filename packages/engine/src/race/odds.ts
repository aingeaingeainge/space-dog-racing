import { balance } from '../content/balance';
import { STYLE_BY_ID } from '../content/styles';
import { pow10 } from '../determinism';
import type { StyleId, Track } from '../types';

/**
 * What the book adds to a rating for a public style on this trip (GDD_V3 §5.6), in rating points.
 * Zero for a style nobody has seen yet — the book knows exactly what the table knows.
 *
 * ⚠️ **It prices the style and the track, never the field.** A style's advantage in the simulation
 * comes from the trip (a sprint barely makes a dog tire; a staying trip finds everybody out — A7),
 * and the book knows the trip. Which *other* styles are in the race it does not look at: that is
 * §5.6's deliberate standing overlay, measured by `--styles` as the blind-lone-closer return.
 */
export function styleEdge(style: StyleId | null, track: Pick<Track, 'length'>): number {
  return style ? STYLE_BY_ID[style].bookEdge[track.length] : 0;
}

/**
 * strength_i = 10^(rating_i / oddsScale), via the quantized pow10 so the model is bit-identical
 * on every JS engine (see determinism.ts). Ratings are integers 5–99, so this has only ~95
 * possible results; test/determinism.test.ts proves every one sits far from a rounding boundary.
 */
function strength(rating: number): number {
  return pow10(rating / balance.oddsScale);
}

/**
 * The bookie's model (GDD §10): a Bradley–Terry / logistic strength model on public ratings,
 *   strength_i = 10^(rating_i / oddsScale),  P(win_i) = strength_i / Σ strength.
 * `oddsScale` is calibrated against simulateRace by scripts/harness.ts --calibrate so that a
 * rating-65 dog against seven 50s wins about half the time.
 */
export function winProbabilities(ratings: readonly number[]): number[] {
  const strengths = ratings.map(strength);
  const total = strengths.reduce((s, x) => s + x, 0);
  return strengths.map((s) => Math.max(balance.oddsFloor, s / total));
}

/** Harville expansion: probability each runner finishes in the top `places`. */
export function placeProbabilities(ratings: readonly number[], places = 3): number[] {
  const n = ratings.length;
  const strengths = ratings.map(strength);
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
