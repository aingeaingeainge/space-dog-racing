import { describe, expect, it } from 'vitest';
import {
  balance,
  createDog,
  decimalOdds,
  fitRating,
  mulberry32,
  placeProbabilities,
  simulateRace,
  winProbabilities,
  type Runner,
} from '../src/index';

const track = { distance: 480, length: 'standard' as const, bends: 'medium' as const, hazard: 1 };

function field(rng: ReturnType<typeof mulberry32>, qualities: number[]): Runner[] {
  let n = 0;
  return qualities.map((q, i) => {
    const d = fitRating(
      createDog({ quality: q, age: 3, owner: 'local', traits: [] }, rng, (p) => `${p}${n++}`),
      q,
      q,
    );
    return {
      id: d.id,
      trap: i + 1,
      speed: d.speed,
      accel: d.accel,
      stamina: d.stamina,
      trapStat: d.trap,
      fitness: 90,
      form: 0,
      traits: [],
    };
  });
}

describe('simulateRace', () => {
  it('is deterministic for the same runners and seed', () => {
    const runners = field(mulberry32(5), [50, 50, 50, 50, 50, 50, 50, 50]);
    const a = simulateRace(runners, { track, major: false }, mulberry32(99));
    const b = simulateRace(runners, { track, major: false }, mulberry32(99));
    expect(a).toEqual(b);
    expect(a.order).toHaveLength(8);
    expect(new Set(a.order).size).toBe(8);
  });

  it('emits a tick log that ends with every dog past the line', () => {
    const runners = field(mulberry32(8), [40, 45, 50, 55, 60, 65, 70, 75]);
    const r = simulateRace(runners, { track, major: false }, mulberry32(1));
    const last = r.ticks[r.ticks.length - 1]!;
    for (const pos of last) expect(pos).toBeGreaterThanOrEqual(track.distance);
    expect(r.ticks[0]!.every((p) => p < 5)).toBe(true);
    for (const id of r.order) expect(r.finishTicks[id]).toBeGreaterThan(0);
  });

  it('calibration: a rating-65 dog beats seven 50s 45–60% of the time', () => {
    const rng = mulberry32(2024);
    const n = 1200;
    let wins = 0;
    for (let i = 0; i < n; i++) {
      const runners = rng.shuffle(field(rng, [65, 50, 50, 50, 50, 50, 50, 50]));
      const hero = runners.find((r) => r.id === 'dog0')!.id;
      if (
        simulateRace(runners, { track, major: false }, mulberry32(rng.int(0, 1e9))).order[0] ===
        hero
      )
        wins++;
    }
    expect(wins / n).toBeGreaterThan(0.45);
    expect(wins / n).toBeLessThan(0.6);
  });
});

describe('odds', () => {
  it('win probabilities sum to one and favour the higher rating', () => {
    const p = winProbabilities([70, 50, 50, 50, 50, 50, 50, 50]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(p[0]!).toBeGreaterThan(p[1]!);
  });
  it('place probabilities sum to three', () => {
    const p = placeProbabilities([70, 60, 50, 50, 50, 50, 40, 30]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(3, 6);
  });
  it('decimal odds carry the house margin', () => {
    expect(decimalOdds(0.5, 0.15)).toBe(1.7);
    expect(decimalOdds(0.999, balance.bettingMargin)).toBeGreaterThanOrEqual(1.01);
  });
});
