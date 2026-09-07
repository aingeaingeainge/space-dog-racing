/**
 * Cross-engine determinism (CLAUDE.md non-negotiable: same seed + same action log ⇒ same
 * season; GDD §2.6 "multiplayer-ready from line one").
 *
 * ECMAScript leaves `Math.pow`, `Math.exp`, `Math.log` and the trigonometric functions
 * *implementation-defined*. V8 changed them between Node 22 and Node 24 (observed: the odds
 * model differing in the last ULP), and browser engines differ from Node again. Any value
 * derived from them therefore cannot be safely hashed, compared or replayed across machines —
 * which is exactly what a lockstep multiplayer season has to do.
 *
 * By contrast `+ - * /` and `Math.sqrt` are correctly rounded and hence bit-identical
 * everywhere, per IEEE 754. So the rule for this engine is:
 *
 *   **Every transcendental result is passed through `quantize` at the call site.**
 *
 * Rounding to 10 significant digits leaves thousands of ULPs of headroom against the ~1 ULP
 * by which implementations actually disagree, so every engine lands on the same double, and
 * everything computed from it downstream stays exact. Ten significant digits is far more
 * precision than any rating, price or probability in this game needs.
 *
 * The eslint `no-restricted-properties` rule in eslint.config.js keeps raw calls from coming
 * back; this module is the one place allowed to use them.
 */

const MIN_EXP = -323;
const MAX_EXP = 308;

/**
 * Powers of ten as exact doubles. Built from string literals because StringNumericLiteral →
 * Number is fully specified (correctly rounded), unlike `Math.pow(10, e)`.
 */
const POW10: readonly number[] = (() => {
  const table: number[] = [];
  for (let e = MIN_EXP; e <= MAX_EXP; e++) table.push(Number(`1e${e}`));
  return table;
})();

const TOP = POW10.length - 1;

/** Largest `e` with `10**e <= ax`, by binary search over the table. Comparisons are exact. */
function decimalExponent(ax: number): number {
  let lo = 0;
  let hi = TOP;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (POW10[mid]! <= ax) lo = mid;
    else hi = mid - 1;
  }
  return lo + MIN_EXP;
}

/** `x * 10**e`, split into table-sized steps so the exponent never leaves the table. */
function scaleBy(x: number, e: number): number {
  let out = x;
  let rem = e;
  while (rem > MAX_EXP) {
    out = out * POW10[TOP]!;
    rem -= MAX_EXP;
  }
  while (rem < MIN_EXP) {
    out = out * POW10[0]!;
    rem -= MIN_EXP;
  }
  return out * POW10[rem - MIN_EXP]!;
}

/**
 * Why 8 and not, say, 15: the risk that survives quantization is a value landing within the
 * engines' disagreement of a `.5` rounding boundary. At `d` significant digits that chance is
 * about `10**(d-17)` per call. The engine makes ~230k transcendental calls per season, so 8
 * digits puts a worst-case desync — and only for a function two engines actually disagree on —
 * at roughly 1 in 1000 seasons, while still carrying far more precision than any probability,
 * rating or race distance in this game uses. Eliminating the residual entirely means shipping
 * our own log/exp (or a committed quantile table); that is an M5 decision, not an M0 one.
 */
export const SIGNIFICANT_DIGITS = 8;

/**
 * Round `x` to `digits` significant decimal digits using only exact operations, so the result
 * is the same double on every conformant JavaScript engine.
 *
 * Wrap every `Math.pow` / `Math.log` / `Math.exp` / trig result in this before it can reach
 * game state, an AI decision, or anything hashed.
 */
export function quantize(x: number, digits: number = SIGNIFICANT_DIGITS): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const ax = x < 0 ? -x : x;
  const shift = digits - 1 - decimalExponent(ax);
  return scaleBy(Math.round(scaleBy(x, shift)), -shift);
}

/**
 * The engine's whole transcendental vocabulary. Every one of these quantizes before returning,
 * so callers can treat the result as an ordinary exact double. Nothing outside this module may
 * call `Math.pow` / `Math.log` / trig directly — eslint enforces it.
 */

/** `10 ** exponent`, stable across engines. Both odds and the Elo update need only base 10. */
export function pow10(exponent: number): number {
  return quantize(Math.pow(10, exponent));
}

/**
 * The Box–Muller transform, kept whole here rather than in rng.ts so that `Math.log` and
 * `Math.cos` live behind a single quantize. Takes two uniforms in [0,1) and returns a standard
 * normal deviate. Quantizing the composed value rather than each input halves the work in the
 * engine's hottest loop *and* leaves one rounding boundary to clear instead of two.
 */
export function normalDeviate(u: number, v: number): number {
  const safeU = u < 1e-12 ? 1e-12 : u;
  // Math.sqrt is exact per IEEE 754; log and cos are not, which is what the quantize is for.
  return quantize(Math.sqrt(-2 * Math.log(safeU)) * Math.cos(2 * Math.PI * v));
}

/**
 * Distance, in ULPs, from `x * 10**shift` to the nearest `.5` rounding boundary — i.e. how far
 * `x` may drift before `quantize` would land on a different value. Used by the determinism
 * tests to prove the safety margin over the inputs the engine actually feeds it.
 */
export function quantizeMarginUlps(x: number, digits: number = SIGNIFICANT_DIGITS): number {
  const ax = x < 0 ? -x : x;
  if (ax === 0 || !Number.isFinite(ax)) return Infinity;
  const shift = digits - 1 - decimalExponent(ax);
  const scaled = scaleBy(ax, shift);
  const distance = Math.abs(scaled - Math.floor(scaled) - 0.5);
  // One ULP of ax, expressed on the scaled grid.
  const ulpScaled = scaleBy(ulp(ax), shift);
  return distance / ulpScaled;
}

/** Size of one unit in the last place at `ax`, without touching Math.log2. */
function ulp(ax: number): number {
  const next = nextUp(ax);
  return next - ax;
}

function nextUp(ax: number): number {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, ax);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  if (lo === 0xffffffff) {
    buf.setUint32(0, hi + 1);
    buf.setUint32(4, 0);
  } else {
    buf.setUint32(4, lo + 1);
  }
  return buf.getFloat64(0);
}
