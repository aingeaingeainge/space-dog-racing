import { describe, expect, it } from 'vitest';
import {
  createSeason,
  decide,
  isSeasonOver,
  needsAdvance,
  player,
  reduceMut,
  waitingOn,
  type Action,
  type GameState,
  type SeasonSetup,
} from '../src/index';

/**
 * Phase I: a human picks their face on the Title, and a face is a saddle-cloth colour
 * (`PlayerSetup.colour`). That is only safe if colour touches no draw — otherwise picking a face
 * would change the game, and a seed link (which carries no colours) would not replay it.
 *
 * Four humans and two Normal AIs play two seasons, the humans played by the Normal AI so the run
 * is headless. Once with the default colours (seat index), once with every colour permuted. Apart
 * from `Player.colour`, the action log and the final state must be identical.
 */
function play(setup: SeasonSetup): { state: GameState; log: Action[] } {
  const s = createSeason(setup);
  const log: Action[] = [];
  for (let steps = 0; !isSeasonOver(s); steps++) {
    if (steps > 100_000) throw new Error('did not finish');
    if (needsAdvance(s)) {
      const a: Action = { t: 'AdvancePhase' };
      reduceMut(s, a);
      log.push(a);
      continue;
    }
    const who = waitingOn(s);
    if (!who) throw new Error(`stalled in ${s.phase}`);
    for (const a of decide(s, who, player(s, who).difficulty ?? 'normal')) {
      reduceMut(s, a);
      log.push(a);
    }
  }
  return { state: s, log };
}

const KINDS = ['human', 'ai', 'human', 'human', 'ai', 'human'] as const;

function setupWith(colours: (number | undefined)[]): SeasonSetup {
  return {
    seed: 42,
    length: { kind: 'seasons', seasons: 2 },
    players: KINDS.map((kind, i) => ({
      name: kind === 'human' ? `Human ${i + 1}` : '',
      kind,
      ...(kind === 'ai' ? { difficulty: 'normal' as const } : {}),
      ...(colours[i] === undefined ? {} : { colour: colours[i] }),
    })),
  };
}

function withoutColour(s: GameState): unknown {
  return { ...s, players: s.players.map((p) => ({ ...p, colour: 0 })) };
}

describe('colour touches no draw (Phase I)', () => {
  const plain = play(setupWith([]));
  const permuted = play(setupWith([7, 3, 5, 0, 6, 2]));

  it('the permuted table really wears different colours', () => {
    expect(plain.state.players.map((p) => p.colour)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(permuted.state.players.map((p) => p.colour)).toEqual([7, 3, 5, 0, 6, 2]);
    expect(plain.state.gameOver?.reason).toBe('seasons');
    // The humans really played: every one of them declared a dog.
    for (const id of ['p1', 'p3', 'p4', 'p6']) {
      expect(plain.log.some((a) => a.t === 'Declare' && a.playerId === id)).toBe(true);
    }
  });

  it('plays the same two seasons, apart from the colours', () => {
    expect(permuted.log).toEqual(plain.log);
    expect(withoutColour(permuted.state)).toEqual(withoutColour(plain.state));
  });
});
