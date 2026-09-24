import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createSeason, netWorthBreakdown, replay, runSeason, type SeasonSetup } from '../src/index';
import { balance } from '../src/content/balance';

/**
 * Golden seed: seed 42, six Normal AIs, a whole season. If this snapshot changes, a rule
 * changed (or the RNG draw order did). Update it deliberately with `vitest -u` and say why in
 * the commit message.
 */
const SETUP: SeasonSetup = {
  seed: 42,
  players: Array.from({ length: 6 }, (_, i) => ({
    name: `AI ${i + 1}`,
    kind: 'ai',
    difficulty: 'normal',
  })),
};

describe('golden season (seed 42, 6 Normal AIs)', () => {
  const { state, log } = runSeason(SETUP);

  it('finishes the season', () => {
    expect(state.phase).toBe('seasonEnd');
    // The counter stops on the last weekend rather than running past it, so this is derived
    // rather than typed: v3 runs ten weekends (GDD_V3 §2.1) where v2 ran thirteen, and a literal
    // here would have to be edited every time the calendar length moves.
    expect(state.week).toBe(balance.weeks);
    expect(state.calendar).toHaveLength(balance.weeks);
    expect(state.finalStandings).toHaveLength(6);
  });

  it('matches the golden digest', () => {
    const digest = {
      seed: state.seed,
      rng: state.rng,
      actions: log.length,
      calendar: state.calendar.map((c) => c.planetId),
      standings: state.finalStandings,
      players: state.players.map((p) => ({
        id: p.id,
        cash: Math.round(p.cash),
        worth: netWorthBreakdown(state, p),
        dogs: p.dogIds.map((id) => {
          const d = state.dogs[id]!;
          return `${d.name}:${d.rating}:${d.age}:${d.wins}/${d.runs}`;
        }),
        stats: p.stats,
      })),
      results: state.results.map(
        (r) => `${r.week}${r.race[0]}:${r.order.slice(0, 3).join(',')}:${r.margin}`,
      ),
      stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
    };
    expect(digest).toMatchSnapshot();
  });

  it('replays identically from the action log', () => {
    const replayed = replay(createSeason(SETUP), log);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(state));
  });

  it('is independent of when the season was run', () => {
    const again = runSeason(SETUP);
    expect(JSON.stringify(again.state)).toBe(JSON.stringify(state));
    expect(again.log).toEqual(log);
  });
});

/*
 * v3 Phase E1 — an addition; nothing above this line was edited.
 *
 * A second golden: a **two-season** game (GDD_V3 §2.1, §2.2), seed 42, six Normal AIs. It guards
 * what the one-season golden cannot see — the off-season (age, the retirement window, the staff
 * notice), the new season's re-drawn circuit and reset stats, and the game's standings. If it moves,
 * a rule about the game's shape moved.
 */
const TWO_SEASONS: SeasonSetup = { ...SETUP, length: { kind: 'seasons', seasons: 2 } };

describe('golden game (seed 42, 6 Normal AIs, two seasons)', () => {
  const { state, log } = runSeason(TWO_SEASONS);

  it('finishes the game after two seasons', () => {
    expect(state.phase).toBe('seasonEnd');
    expect(state.season).toBe(2);
    expect(state.seasons).toHaveLength(2);
    expect(state.gameOver?.reason).toBe('seasons');
  });

  it('matches the golden digest', () => {
    const digest = {
      actions: log.length,
      rng: state.rng,
      seasons: state.seasons.map((r) => ({
        season: r.season,
        calendar: r.calendar,
        standings: r.standings,
        goldCups: r.goldCups,
      })),
      standings: state.finalStandings,
      retirements: log.filter((a) => a.t === 'Retire' && a.dogId !== null).length,
      hires: log.filter((a) => a.t === 'ResolveStaffNotice' && a.hire).length,
      players: state.players.map((p) => ({
        id: p.id,
        worth: netWorthBreakdown(state, p),
        staff: p.staff,
        dogs: p.dogIds.map((id) => {
          const d = state.dogs[id]!;
          return `${d.name}:${d.rating}:${d.age}:${d.wins}/${d.runs}`;
        }),
      })),
      stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
    };
    expect(digest).toMatchSnapshot();
  });

  it('replays identically from the action log', () => {
    const replayed = replay(createSeason(TWO_SEASONS), log);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(state));
  });
});
