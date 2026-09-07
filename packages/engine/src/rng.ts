/**
 * Seeded PRNG (mulberry32). The engine never touches Math.random: every draw goes through
 * an Rng whose 32-bit state lives in GameState.rng, so a serialised state carries its
 * randomness with it and (seed + action log) replays identically anywhere.
 */
import { normalDeviate } from './determinism';

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number;
  /** Uniform float in [lo, hi). */
  uniform(lo: number, hi: number): number;
  /** Normal deviate with the given mean and standard deviation. */
  gauss(mean?: number, sd?: number): number;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick: weights[i] is the relative weight of items[i]. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Bernoulli trial. */
  chance(p: number): boolean;
  /** Current 32-bit state (store this). */
  state(): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    uniform: (lo, hi) => lo + next() * (hi - lo),
    gauss: (mean = 0, sd = 1) => {
      // Box–Muller; two draws every call so the draw count is stable. The transform itself
      // lives in determinism.ts because Math.log and Math.cos are implementation-defined, and
      // a last-ULP difference here can flip a finishing order and desync two clients.
      const u = next();
      const v = next();
      return mean + sd * normalDeviate(u, v);
    },
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    pickWeighted: (items, weights) => {
      if (items.length === 0 || items.length !== weights.length)
        throw new Error('bad weighted pick');
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i] ?? 0;
        if (r < 0) return items[i] as (typeof items)[number];
      }
      return items[items.length - 1] as (typeof items)[number];
    },
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i] as (typeof items)[number];
        items[i] = items[j] as (typeof items)[number];
        items[j] = tmp;
      }
      return items;
    },
    chance: (p) => next() < p,
    state: () => a,
  };
  return rng;
}

/** Derive a fresh, independent stream from a parent (e.g. one per race). */
export function fork(rng: Rng): Rng {
  return mulberry32(Math.floor(rng.next() * 4294967296));
}

/** Small string hash so a text seed ("bin-juice") can become a numeric one. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
