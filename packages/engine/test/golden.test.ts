import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createSeason, netWorthBreakdown, replay, runSeason, type SeasonSetup } from '../src/index';

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
    expect(state.week).toBe(13);
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
        ship: p.ship,
        loans: p.loans,
        stats: p.stats,
      })),
      results: state.results.map(
        (r) => `${r.week}${r.cls[0]}:${r.order.slice(0, 3).join(',')}:${r.margin}`,
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
