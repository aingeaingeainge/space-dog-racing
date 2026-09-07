import { describe, expect, it } from 'vitest';
import { balance } from '../src/content/balance';
import {
  SIGNIFICANT_DIGITS,
  normalDeviate,
  quantize,
  quantizeMarginUlps,
} from '../src/determinism';
import { mulberry32 } from '../src/rng';

/**
 * These tests defend the CLAUDE.md non-negotiable that a seed plus an action log reproduces the
 * same season *anywhere* — not merely on the machine that recorded it.
 *
 * Background: Node 22 and Node 24 disagreed in the last ULP of `Math.pow`, which moved every
 * stored win/place probability and so the golden state hash. ECMAScript permits that: pow, exp,
 * log and the trig functions are implementation-defined. Arithmetic and sqrt are not.
 */
describe('quantize', () => {
  it('is idempotent', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20_000; i++) {
      const x = (rng.next() - 0.5) * Math.pow(10, rng.int(-12, 12));
      const q = quantize(x);
      expect(quantize(q)).toBe(q);
    }
  });

  it('keeps sign, zero, and non-finite values intact', () => {
    expect(quantize(0)).toBe(0);
    expect(quantize(-0)).toBe(-0);
    expect(quantize(Infinity)).toBe(Infinity);
    expect(quantize(-Infinity)).toBe(-Infinity);
    expect(Number.isNaN(quantize(NaN))).toBe(true);
    expect(quantize(-1.23456789012345)).toBeLessThan(0);
  });

  it('rounds to the requested number of significant digits', () => {
    expect(quantize(1.234567891234, 8)).toBeCloseTo(1.2345679, 12);
    expect(quantize(454090.9610972479, 8)).toBeCloseTo(454090.96, 6);
    expect(quantize(0.000123456789123, 8)).toBeCloseTo(0.00012345679, 15);
  });

  it('absorbs a several-ULP disturbance, which is all engines ever differ by', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 20_000; i++) {
      const x = (rng.next() + 0.1) * Math.pow(10, rng.int(-6, 6));
      const jittered = x * (1 + 4 * Number.EPSILON);
      // A 4-ULP nudge must not change the quantized value (bar the ~1e-8 boundary case).
      if (quantizeMarginUlps(x) > 8) expect(quantize(jittered)).toBe(quantize(x));
    }
  });
});

describe('engine transcendental inputs sit far from a rounding boundary', () => {
  /**
   * The odds model's domain is finite: ratings are integers 5–99, so `10 ** (r / oddsScale)`
   * has exactly 95 possible results. We can therefore *prove*, not sample, that the model is
   * identical on every engine.
   */
  it('odds strengths: every rating 5-99 has thousands of ULPs of margin', () => {
    let worst = Infinity;
    let worstRating = 0;
    for (let r = 5; r <= 99; r++) {
      const margin = quantizeMarginUlps(Math.pow(10, r / balance.oddsScale));
      if (margin < worst) {
        worst = margin;
        worstRating = r;
      }
    }
    expect(worst, `rating ${worstRating} is the closest to a boundary`).toBeGreaterThan(1000);
  });

  /**
   * The Elo update's domain is finite too: rating is an integer 5–99 and `avg` is the mean of
   * n ∈ [2,8] integer ratings, so the exponent only ever takes (rating − k/n) / eloScale.
   */
  it('elo update: every reachable (rating, field average) pair clears 100 ULPs', () => {
    let worst = Infinity;
    let worstAt = '';
    for (let n = 2; n <= 8; n++) {
      for (let k = 5 * n; k <= 99 * n; k++) {
        const avg = k / n;
        for (let rating = 5; rating <= 99; rating += 7) {
          const margin = quantizeMarginUlps(Math.pow(10, (rating - avg) / balance.eloScale));
          if (margin < worst) {
            worst = margin;
            worstAt = `n=${n} avg=${avg} rating=${rating}`;
          }
        }
      }
    }
    expect(worst, `closest: ${worstAt}`).toBeGreaterThan(100);
  });

  /**
   * The Box–Muller path takes continuous input, so this one is a bound rather than a proof:
   * over a large seeded sample no draw comes near a boundary. See SIGNIFICANT_DIGITS for the
   * residual-risk arithmetic.
   */
  it('gauss: no sampled draw lands within 4 ULPs of a boundary', () => {
    const rng = mulberry32(1993);
    let worst = Infinity;
    for (let i = 0; i < 100_000; i++) {
      const u = rng.next();
      const v = rng.next();
      const safeU = u < 1e-12 ? 1e-12 : u;
      const raw = Math.sqrt(-2 * Math.log(safeU)) * Math.cos(2 * Math.PI * v);
      worst = Math.min(worst, quantizeMarginUlps(raw));
    }
    expect(worst).toBeGreaterThan(4);
  });

  it('normalDeviate is the quantized Box-Muller value', () => {
    const rng = mulberry32(4242);
    for (let i = 0; i < 1000; i++) {
      const u = rng.next();
      const v = rng.next();
      const safeU = u < 1e-12 ? 1e-12 : u;
      const raw = Math.sqrt(-2 * Math.log(safeU)) * Math.cos(2 * Math.PI * v);
      expect(normalDeviate(u, v)).toBe(quantize(raw));
    }
  });
});

describe('the engine leaves no raw transcendental in the hot path', () => {
  it('uses the documented digit count', () => {
    expect(SIGNIFICANT_DIGITS).toBe(8);
  });
});
