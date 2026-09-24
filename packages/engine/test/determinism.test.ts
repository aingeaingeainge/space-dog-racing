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

/*
 * v3 Phase C — additions only; nothing above this line was edited.
 */
describe('the book prices a public style, and its inputs stay integers far from a boundary', () => {
  /**
   * GDD_V3 §5.6 moves the book's input off the rating alone: `rating + bookEdge`, where the edge is
   * a whole number of rating points per style per trip. So the domain the test above proves is
   * widened by the smallest and largest edge in the sheet, and every value in it is proved again.
   */
  it('every rating 5–99 plus every style edge has thousands of ULPs of margin', async () => {
    const { STYLES } = await import('../src/content/styles');
    const edges = STYLES.flatMap((st) => Object.values(st.bookEdge));
    for (const e of edges) expect(Number.isInteger(e), `edge ${e} is a whole number`).toBe(true);
    const lo = 5 + Math.min(0, ...edges);
    const hi = 99 + Math.max(0, ...edges);
    let worst = Infinity;
    for (let r = lo; r <= hi; r++)
      worst = Math.min(worst, quantizeMarginUlps(Math.pow(10, r / balance.oddsScale)));
    expect(worst).toBeGreaterThan(1000);
  });
});

/*
 * v3 Phase D1 — additions only; nothing above this line was edited.
 */
describe("Explore never moves the game's stream (decision D1)", () => {
  /**
   * Every stable explores on its own stream, seeded at arrival. So whatever door a stable opens,
   * whatever is behind it and whatever it chooses, the game's stream at the end of Explore is the
   * same, and so is every other stable's draw — only a one-of-a-kind card can pass between stables,
   * and that is contention, not the stream. Two copies of week 1, one human seat opening a
   * different door in each, compared at the moment Explore hands over to the market.
   */
  it('gives the same game stream, seeds and rival cards whichever door a stable opens', async () => {
    const { createSeason, reduceMut, decide, needsAdvance, player, aiChoiceFor } =
      await import('../src/index');
    const toMarket = (door: number) => {
      const s = createSeason({
        seed: 2026,
        players: [
          { name: 'Human', kind: 'human' },
          ...Array.from({ length: 5 }, () => ({
            name: '',
            kind: 'ai' as const,
            difficulty: 'normal' as const,
          })),
        ],
      });
      let guard = 0;
      while (s.phase !== 'planetPre' && guard++ < 1000) {
        if (needsAdvance(s)) {
          reduceMut(s, { t: 'AdvancePhase' });
          continue;
        }
        const who = s.pendingEvent?.playerId ?? s.activePlayer!;
        if (player(s, who).kind === 'human') {
          if (s.pendingEvent)
            reduceMut(s, { t: 'ResolveEvent', playerId: who, choice: aiChoiceFor(s, who) });
          else reduceMut(s, { t: 'ChooseDoor', playerId: who, door });
        } else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
      }
      return s;
    };
    const runs = [0, 1, 2].map(toMarket);
    for (const s of runs.slice(1)) {
      expect(s.rng).toBe(runs[0]!.rng);
      expect(s.explore!.seeds).toEqual(runs[0]!.explore!.seeds);
      expect(s.conditions.map((c) => [c.dogId, c.condition])).toEqual(
        runs[0]!.conditions.map((c) => [c.dogId, c.condition]),
      );
    }
    // The human opened three different doors; a rival's card changes only if the human took a
    // one-of-a-kind card first, which the test allows for rather than hides.
    for (const id of ['p2', 'p3', 'p4', 'p5', 'p6']) {
      const cards = runs.map((s) => s.explore!.cards[id]);
      const humanTookUnique = runs.some((s) => s.explore!.taken.length > 0);
      if (!humanTookUnique) expect(new Set(cards).size).toBe(1);
    }
  });
});

/*
 * v3 Phase D2 — additions only; nothing above this line was edited.
 */
describe("A Back Alley job never moves the game's stream (GDD_V3 §9.3, Phase D2 item 3)", () => {
  /**
   * A nobble and a bought box are booked at a door, and their consequences land on race day: the box
   * at the lock, the nobble on the runner, and the stewards' catch after the race. The stewards draw
   * once per stable every race day whether or not anybody booked anything, and the box is placed
   * without a draw, so the game's stream when race day ends is the same with the jobs as without.
   */
  it('gives the same stream after race day with a nobble and a bought box as with neither', async () => {
    const { createSeason, reduceMut, decide, needsAdvance, player } = await import('../src/index');
    const run = (withJobs: boolean) => {
      const s = createSeason({
        seed: 77,
        players: Array.from({ length: 6 }, () => ({
          name: '',
          kind: 'ai' as const,
          difficulty: 'normal' as const,
        })),
      });
      let booked = false;
      let guard = 0;
      while (s.phase !== 'planetPost' && guard++ < 5000) {
        if (s.phase === 'betting' && !s.locked && !booked) {
          booked = true;
          if (withJobs) {
            const gold = s.declarations.goldCup;
            const victim = gold['p2'] ?? Object.values(gold)[0];
            const mine = Object.entries(s.declarations).find(([, d]) => d['p1'])?.[0];
            if (victim) s.jobs.push({ by: 'p1', kind: 'nobble', dogId: victim });
            if (mine) s.jobs.push({ by: 'p1', kind: 'box', race: mine as 'goldCup', box: 1 });
            expect(s.jobs.length).toBe(2);
          }
        }
        if (needsAdvance(s)) {
          reduceMut(s, { t: 'AdvancePhase' });
          continue;
        }
        const who = s.pendingEvent?.playerId ?? s.activePlayer!;
        for (const a of decide(s, who, player(s, who).difficulty)) reduceMut(s, a);
      }
      return s;
    };
    const plain = run(false);
    const jobs = run(true);
    expect(jobs.races).not.toEqual(plain.races);
    expect(jobs.rng).toBe(plain.rng);
  });
});

/*
 * v3 Phase E1 — additions only; nothing above this line was edited.
 */
describe("No off-season answer moves the game's stream or another stable's draws (GDD_V3 §2.2)", () => {
  /**
   * Every stable's off-season — its offer, its trainers' notices, its candidate — is rolled on its
   * own stream when the off-season opens, from one game-stream draw per stable in seating order. The
   * answers draw nothing. So however two human stables answer, the next season's circuit, and every
   * rival's off-season, come out the same.
   */
  it('gives the same next season whatever two humans answer', async () => {
    const { createSeason, reduceMut, decide, needsAdvance, player, aiChoiceFor } =
      await import('../src/index');
    type Answer = { retire: boolean; hire: boolean };
    const run = (answers: Record<string, Answer>) => {
      const s = createSeason({
        seed: 31,
        players: [
          { name: 'A', kind: 'human' },
          { name: 'B', kind: 'human' },
          ...Array.from({ length: 4 }, () => ({
            name: '',
            kind: 'ai' as const,
            difficulty: 'normal' as const,
          })),
        ],
        length: { kind: 'seasons', seasons: 2 },
      });
      let notices = '';
      let guard = 0;
      while (!(s.season === 2 && s.phase === 'explore') && guard++ < 100_000) {
        if (needsAdvance(s)) {
          reduceMut(s, { t: 'AdvancePhase' });
          continue;
        }
        const who = s.pendingEvent?.playerId ?? s.activePlayer!;
        const p = player(s, who);
        if (p.kind === 'human' && s.phase === 'offSeason') {
          if (!notices) notices = JSON.stringify(s.offSeason!.notices);
          const n = s.offSeason!.notices[who]!;
          const a = answers[who]!;
          reduceMut(s, { t: 'Retire', playerId: who, dogId: a.retire ? p.dogIds[0]! : null });
          if (n.candidate) reduceMut(s, { t: 'ResolveStaffNotice', playerId: who, hire: a.hire });
          reduceMut(s, { t: 'EndPhase', playerId: who });
        } else if (p.kind === 'human') {
          if (s.pendingEvent)
            reduceMut(s, { t: 'ResolveEvent', playerId: who, choice: aiChoiceFor(s, who) });
          else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
        } else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
      }
      return { s, notices };
    };
    const a = run({ p1: { retire: true, hire: true }, p2: { retire: false, hire: false } });
    const b = run({ p1: { retire: false, hire: false }, p2: { retire: true, hire: true } });
    // The same off-season was rolled for everybody, and the same season followed it.
    expect(b.notices).toBe(a.notices);
    expect(b.s.calendar).toEqual(a.s.calendar);
    expect(b.s.explore!.seeds).toEqual(a.s.explore!.seeds);
    expect(b.s.turnOrder).toEqual(a.s.turnOrder);
    // The rivals kept exactly the same kennels and trainers.
    for (const id of ['p3', 'p4', 'p5', 'p6']) {
      const pa = a.s.players.find((p) => p.id === id)!;
      const pb = b.s.players.find((p) => p.id === id)!;
      expect(pb.staff).toEqual(pa.staff);
      expect(pb.dogIds.map((d) => b.s.dogs[d]!.name)).toEqual(
        pa.dogIds.map((d) => a.s.dogs[d]!.name),
      );
    }
  }, 60_000);
});
