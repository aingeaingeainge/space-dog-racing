import { describe, expect, it } from 'vitest';
import {
  createSeason,
  decide,
  describeRetirementOffer,
  isSeasonOver,
  needsAdvance,
  player,
  reduceMut,
  waitingOn,
  type GameState,
  type SeasonSetup,
} from '../src/index';
import { balance } from '../src/content/balance';

/**
 * Phase I, GDD_V3 §2.2 and V23 — the draft: at the off-season, the stable last on the season's
 * standings is offered a replacement rolled `draftLevelShift` above everybody else's.
 */
const SETUP: SeasonSetup = {
  seed: 7,
  length: { kind: 'seasons', seasons: 2 },
  players: Array.from({ length: 6 }, () => ({
    name: '',
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  })),
};

/** Play to the moment the first off-season opens. */
function toOffSeason(): GameState {
  const s = createSeason(SETUP);
  while (s.phase !== 'offSeason' && !isSeasonOver(s)) {
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = waitingOn(s)!;
    for (const a of decide(s, who, player(s, who).difficulty)) reduceMut(s, a);
  }
  return s;
}

describe('the draft (Phase I)', () => {
  const shift = balance.draftLevelShift;
  const drafted = toOffSeason();
  (balance as { draftLevelShift: number }).draftLevelShift = 0;
  const plain = toOffSeason();
  (balance as { draftLevelShift: number }).draftLevelShift = shift;

  it('goes to exactly one stable: the last on the season’s standings', () => {
    const standings = drafted.seasons[0]!.standings;
    const last = standings[standings.length - 1]!.playerId;
    const notices = drafted.offSeason!.notices;
    expect(Object.keys(notices).filter((id) => notices[id]!.draft)).toEqual([last]);
    expect(describeRetirementOffer(notices[last]!)).toMatch(/^Last at the table/);
  });

  it('raises that stable’s offer and changes no other draw', () => {
    const last = drafted.seasons[0]!.standings.at(-1)!.playerId;
    for (const p of drafted.players) {
      const a = drafted.offSeason!.notices[p.id]!;
      const b = plain.offSeason!.notices[p.id]!;
      expect(a.left).toEqual(b.left);
      expect(a.candidate).toEqual(b.candidate);
      expect({ ...a.offer, speed: 0, accel: 0, stamina: 0 }).toEqual({
        ...b.offer,
        speed: 0,
        accel: 0,
        stamina: 0,
      });
      const sum = (o: Record<string, number | string>) =>
        Number(o.speed) + Number(o.accel) + Number(o.stamina);
      if (p.id === last) expect(sum(a.offer)).toBeGreaterThan(sum(b.offer));
      else expect(a.offer).toEqual(b.offer);
    }
    expect(drafted.rng).toBe(plain.rng);
  });
});
