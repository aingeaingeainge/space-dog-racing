import { describe, expect, it } from 'vitest';
import {
  createSeason,
  currentDraft,
  decide,
  dogValue,
  isSeasonOver,
  needsAdvance,
  player,
  reduceMut,
  replay,
  snakeOrder,
  STAFF,
  STYLE_IDS,
  waitingOn,
  type Action,
  type AiAgent,
  type GameState,
  type SeasonSetup,
} from '../src/index';
import { balance } from '../src/content/balance';

/**
 * v3 Phase N — **the draft** (GDD_V3 V29–V33). A game opens on a six-round snake draft of four dogs
 * and two trainers from a public board; each off-season is one round of the same draft, last on the
 * standings first. (Rewritten at Phase N: this file was Phase I's test of V23's breeder's pick, which
 * the off-season draft replaced.)
 */

const ais = (n: number, difficulty: AiAgent = 'normal') =>
  Array.from({ length: n }, () => ({ name: '', kind: 'ai' as const, difficulty }));
const humans = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Human ${i + 1}`, kind: 'human' as const }));

/** Drive every seat as its AI (a human as Normal) until `stop`, keeping the log. */
function play(setup: SeasonSetup, stop: (s: GameState) => boolean = () => false) {
  const s = createSeason(setup);
  const log: Action[] = [];
  let guard = 0;
  while (!isSeasonOver(s) && !stop(s) && guard++ < 200_000) {
    if (needsAdvance(s)) {
      const a: Action = { t: 'AdvancePhase' };
      reduceMut(s, a);
      log.push(a);
      continue;
    }
    const who = waitingOn(s)!;
    const p = player(s, who);
    for (const a of decide(s, who, p.kind === 'human' ? 'normal' : p.difficulty)) {
      reduceMut(s, a);
      log.push(a);
    }
  }
  return { s, log };
}

describe('the opening draft (V29)', () => {
  it('snakeOrder is the plain snake unless round 3 reverses (Q2)', () => {
    const r1 = ['a', 'b', 'c'];
    expect(snakeOrder(r1, 4)).toEqual(['a', 'b', 'c', 'c', 'b', 'a', 'a', 'b', 'c', 'c', 'b', 'a']);
    expect(snakeOrder(r1, 4, true)).toEqual([
      ...['a', 'b', 'c'],
      ...['c', 'b', 'a'],
      ...['c', 'b', 'a'],
      ...['a', 'b', 'c'],
    ]);
  });
  for (const n of [3, 6, 8]) {
    it(`snakes six rounds for ${n} stables, round 1 drawn`, () => {
      const s = createSeason({ seed: 100 + n, players: ais(n) });
      expect(s.phase).toBe('draft');
      const d = currentDraft(s)!;
      expect(d.kind).toBe('opening');
      expect(d.rounds).toBe(balance.startDogs + balance.staffSlots);
      expect(d.rounds).toBe(6);
      const round1 = d.order.slice(0, n);
      expect([...round1].sort()).toEqual(s.players.map((p) => p.id).sort());
      // Q2: round 3 runs the way round 2 did, and the snake carries on from there.
      expect(d.order).toEqual(snakeOrder(round1, 6, true));
      const backwards = [false, true, true, false, true, false];
      for (let r = 0; r < 6; r++) {
        const round = d.order.slice(r * n, (r + 1) * n);
        expect(round).toEqual(backwards[r] ? [...round1].reverse() : round1);
      }
      expect(s.activePlayer).toBe(round1[0]);
      expect(waitingOn(s)).toBe(round1[0]);
    });
  }

  it('draws round 1 from the seed: not always seating order', () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 30; seed++)
      firsts.add(currentDraft(createSeason({ seed, players: ais(6) }))!.order[0]!);
    expect(firsts.size).toBeGreaterThan(3);
  });

  for (const n of [3, 4, 6, 7, 8]) {
    it(`builds the board as specified for ${n} stables`, () => {
      const s = createSeason({ seed: 7 + n, players: ais(n) });
      const d = currentDraft(s)!;
      expect(d.dogs).toHaveLength(balance.draftDogsPerStable * n);
      expect(d.staff).toHaveLength(Math.min(STAFF.length, balance.draftTrainersPerStable * n));
      expect(new Set(d.staff).size).toBe(d.staff.length);
      // Ratings evenly spaced across 40–60.
      const ratings = d.dogs.map((x) => x.rating).sort((a, b) => a - b);
      const m = ratings.length;
      ratings.forEach((r, i) =>
        expect(r).toBe(
          Math.round(
            balance.draftRatingMin +
              ((balance.draftRatingMax - balance.draftRatingMin) * i) / (m - 1),
          ),
        ),
      );
      expect(ratings[0]).toBe(balance.draftRatingMin);
      expect(ratings[m - 1]).toBe(balance.draftRatingMax);
      // Styles split as evenly as the count allows, and each spans the range: every run of three
      // ratings carries all three styles, so a style's weakest is within two steps of the bottom and
      // its strongest within four of the top (the last run can be short).
      const counts = STYLE_IDS.map((st) => d.dogs.filter((x) => x.style === st).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      const step = (balance.draftRatingMax - balance.draftRatingMin) / (m - 1);
      for (const st of STYLE_IDS) {
        const rs = d.dogs.filter((x) => x.style === st).map((x) => x.rating);
        expect(Math.min(...rs)).toBeLessThanOrEqual(balance.draftRatingMin + Math.ceil(2 * step));
        expect(Math.max(...rs)).toBeGreaterThanOrEqual(
          balance.draftRatingMax - Math.ceil(4 * step),
        );
      }
      // Every style public, nobody's yet, ages in range.
      for (const x of d.dogs) {
        expect(x.styleKnown).toBe(true);
        expect(x.dealt).toBe(false);
        expect(x.ownerId).toBe('');
        expect(x.age).toBeGreaterThanOrEqual(balance.startDogAgeMin);
        expect(x.age).toBeLessThanOrEqual(balance.startDogAgeMax);
      }
      // Nothing is dealt.
      for (const p of s.players) {
        expect(p.dogIds).toEqual([]);
        expect(p.staff).toEqual([]);
      }
    });
  }

  it('gives eight stables every one of the 24 trainers', () => {
    const d = currentDraft(createSeason({ seed: 3, players: ais(8) }))!;
    expect([...d.staff].sort()).toEqual(STAFF.map((r) => r.id).sort());
  });

  it('holds a stable to four dogs and two trainers, and refuses an illegal pick', () => {
    const s = createSeason({ seed: 5, players: humans(3) });
    const d = currentDraft(s)!;
    const [a, b] = d.order as [string, string];
    // Out of turn.
    expect(() =>
      reduceMut(s, { t: 'DraftPick', playerId: b, pick: { dog: d.dogs[0]!.id } }),
    ).toThrow(/pick/);
    // Not on the board.
    expect(() => reduceMut(s, { t: 'DraftPick', playerId: a, pick: { dog: 'dog_zz' } })).toThrow(
      /board/,
    );
    expect(() => reduceMut(s, { t: 'DraftPick', playerId: a, pick: { staff: 'nobody' } })).toThrow(
      /board/,
    );
    // No pass, no release, no EndPhase in the opening draft.
    expect(() => reduceMut(s, { t: 'DraftPick', playerId: a, pick: null })).toThrow();
    expect(() =>
      reduceMut(s, {
        t: 'DraftPick',
        playerId: a,
        pick: { dog: d.dogs[0]!.id },
        release: 'dog_1',
      }),
    ).toThrow(/opening/);
    expect(() => reduceMut(s, { t: 'EndPhase', playerId: a })).toThrow(/pick/);
    expect(() => reduceMut(s, { t: 'AdvancePhase' })).toThrow();
    // Every stable takes its trainers first, then dogs: a third trainer is refused.
    let refusedStaff = 0;
    while (s.phase === 'draft') {
      const cur = currentDraft(s)!;
      const who = s.activePlayer!;
      const p = player(s, who);
      if (p.staff.length === balance.staffSlots && cur.staff.length) {
        expect(() =>
          reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: cur.staff[0]! } }),
        ).toThrow(/staff is full/);
        refusedStaff++;
      }
      if (p.staff.length < balance.staffSlots)
        reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: cur.staff[0]! } });
      else reduceMut(s, { t: 'DraftPick', playerId: who, pick: { dog: cur.dogs[0]!.id } });
    }
    expect(refusedStaff).toBeGreaterThan(0);
    expect(s.phase).toBe('arrival');
    for (const p of s.players) {
      expect(p.dogIds).toHaveLength(balance.startDogs);
      expect(p.staff).toHaveLength(balance.staffSlots);
      for (const id of p.dogIds) {
        expect(s.dogs[id]!.ownerId).toBe(p.id);
        expect(s.dogs[id]!.styleKnown).toBe(true);
      }
    }
    // The board is dropped; the record stays.
    const done = s.drafts[0]!;
    expect(done.dogs).toEqual([]);
    expect(done.staff).toEqual([]);
    expect(done.picks).toHaveLength(6 * 3);
    expect(done.at).toBe(done.order.length);
  });

  it('refuses a fifth dog', () => {
    const s = createSeason({ seed: 9, players: humans(3) });
    while (s.phase === 'draft') {
      const cur = currentDraft(s)!;
      const who = s.activePlayer!;
      const p = player(s, who);
      if (p.dogIds.length === balance.startDogs) {
        expect(() =>
          reduceMut(s, { t: 'DraftPick', playerId: who, pick: { dog: cur.dogs[0]!.id } }),
        ).toThrow(/kennel is full/);
        reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: cur.staff[0]! } });
      } else reduceMut(s, { t: 'DraftPick', playerId: who, pick: { dog: cur.dogs[0]!.id } });
    }
    expect(s.phase).toBe('arrival');
  });

  for (const agent of ['easy', 'normal', 'hard'] as const)
    for (const n of [3, 8])
      it(`completes by AI at ${agent}, ${n} stables, every kennel four and two`, () => {
        const { s } = play({ seed: 11 + n, players: ais(n, agent) }, (x) => x.phase !== 'draft');
        expect(s.phase).toBe('arrival');
        for (const p of s.players) {
          expect(p.dogIds).toHaveLength(4);
          expect(p.staff).toHaveLength(2);
        }
        const all = s.players.flatMap((p) => p.staff);
        expect(new Set(all).size).toBe(all.length);
      });

  it('Normal builds one of each style where the board allows it', () => {
    let full = 0;
    let tables = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { s } = play({ seed, players: ais(6) }, (x) => x.phase !== 'draft');
      for (const p of s.players) {
        tables++;
        if (new Set(p.dogIds.map((id) => s.dogs[id]!.style)).size === 3) full++;
      }
    }
    expect(full / tables).toBeGreaterThan(0.8);
  });

  it('replays the draft, board and order included, from the seed and the log', () => {
    const setup: SeasonSetup = { seed: 77, players: [...humans(2), ...ais(4)] };
    const { s, log } = play(setup, (x) => x.phase !== 'draft');
    const again = replay(createSeason(setup), log);
    expect(JSON.stringify(again)).toBe(JSON.stringify(s));
    // The same seed gives the same board and the same order.
    expect(JSON.stringify(createSeason(setup).drafts)).toBe(
      JSON.stringify(createSeason(setup).drafts),
    );
  });
});

describe('the off-season draft (V32)', () => {
  const setup: SeasonSetup = { seed: 42, players: ais(6), length: { kind: 'seasons', seasons: 2 } };
  const { s: open } = play(setup, (x) => x.phase === 'offSeason');

  it('opens after the ageing and the notice, one round, last on the standings first', () => {
    expect(open.phase).toBe('offSeason');
    const d = currentDraft(open)!;
    expect(d.kind).toBe('offSeason');
    expect(d.rounds).toBe(1);
    const standings = open.seasons[0]!.standings.map((x) => x.playerId);
    expect(d.order).toEqual([...standings].reverse());
    expect(open.activePlayer).toBe(standings[standings.length - 1]);
    expect(d.dogs).toHaveLength(Math.ceil(balance.offDraftDogsPerStable * 6));
    for (const x of d.dogs) {
      expect(x.styleKnown).toBe(true);
      expect(x.age).toBeGreaterThanOrEqual(balance.dogOfferAgeMin);
      expect(x.age).toBeLessThanOrEqual(balance.startDogAgeMax);
    }
    // Every trainer on the board is unemployed, and none is one who just left.
    const employed = new Set(open.players.flatMap((p) => p.staff));
    const left = Object.values(open.offSeason!.notices).flatMap((n) => n.left);
    expect(d.staff.length).toBeLessThanOrEqual(6);
    for (const id of d.staff) {
      expect(employed.has(id)).toBe(false);
      expect(left.includes(id)).toBe(false);
    }
  });

  it('a pass is always legal, and a pass lets nothing go', () => {
    const s = structuredClone(open);
    const who = s.activePlayer!;
    expect(() =>
      reduceMut(s, { t: 'DraftPick', playerId: who, pick: null, release: 'x' }),
    ).toThrow();
    reduceMut(s, { t: 'DraftPick', playerId: who, pick: null });
    expect(s.drafts.at(-1)!.picks.at(-1)).toEqual({ playerId: who, round: 1 });
    expect(s.activePlayer).toBe(currentDraft(s)!.order[1]);
  });

  it('a dog retires one of yours, paid exactly its book value', () => {
    const s = structuredClone(open);
    const who = s.activePlayer!;
    const p = player(s, who);
    const d = currentDraft(s)!;
    const take = d.dogs[0]!;
    expect(p.dogIds).toHaveLength(4);
    expect(() => reduceMut(s, { t: 'DraftPick', playerId: who, pick: { dog: take.id } })).toThrow(
      /retire/,
    );
    const rival = s.players.find((x) => x.id !== who)!;
    expect(() =>
      reduceMut(s, {
        t: 'DraftPick',
        playerId: who,
        pick: { dog: take.id },
        release: rival.dogIds[0]!,
      }),
    ).toThrow(/Not your dog/);
    const old = s.dogs[p.dogIds[2]!]!;
    const value = dogValue(old);
    const cash = p.cash;
    reduceMut(s, { t: 'DraftPick', playerId: who, pick: { dog: take.id }, release: old.id });
    expect(p.cash).toBe(cash + value);
    expect(s.dogs[old.id]).toBeUndefined();
    expect(p.dogIds).toHaveLength(4);
    expect(p.dogIds).toContain(take.id);
    expect(s.dogs[take.id]!.ownerId).toBe(who);
    expect(s.dogs[take.id]!.styleKnown).toBe(true);
    expect(s.drafts.at(-1)!.picks.at(-1)!.released).toEqual({
      dog: { id: old.id, name: old.name, paid: value },
    });
  });

  it('a trainer lets one go when the staff is full, and not otherwise', () => {
    const s = structuredClone(open);
    const who = s.activePlayer!;
    const p = player(s, who);
    const d = currentDraft(s)!;
    if (!d.staff.length) return;
    const t = d.staff[0]!;
    if (p.staff.length === 2) {
      expect(() => reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: t } })).toThrow(
        /let go/,
      );
      const out = p.staff[0]!;
      reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: t }, release: out });
      expect(p.staff).toHaveLength(2);
      expect(p.staff).not.toContain(out);
      expect(p.staff).toContain(t);
    } else {
      expect(() =>
        reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: t }, release: 'x' }),
      ).toThrow(/room/);
      reduceMut(s, { t: 'DraftPick', playerId: who, pick: { staff: t } });
      expect(p.staff).toContain(t);
    }
  });

  it('refuses a pick out of turn, and ends into the new season', () => {
    const s = structuredClone(open);
    const d = currentDraft(s)!;
    expect(() => reduceMut(s, { t: 'DraftPick', playerId: d.order[1]!, pick: null })).toThrow(
      /pick/,
    );
    for (const id of d.order) reduceMut(s, { t: 'DraftPick', playerId: id, pick: null });
    expect(s.phase).toBe('newSeason');
    reduceMut(s, { t: 'AdvancePhase' });
    expect(s.season).toBe(2);
    expect(s.phase).toBe('arrival');
  });

  it('picks draw nothing: however the table picks, the next season is drawn the same', () => {
    const passAll = structuredClone(open);
    for (const id of currentDraft(passAll)!.order)
      reduceMut(passAll, { t: 'DraftPick', playerId: id, pick: null });
    const ai = structuredClone(open);
    while (ai.phase === 'offSeason') {
      const who = ai.activePlayer!;
      for (const a of decide(ai, who, 'normal')) reduceMut(ai, a);
    }
    expect(ai.rng).toBe(passAll.rng);
    reduceMut(passAll, { t: 'AdvancePhase' });
    reduceMut(ai, { t: 'AdvancePhase' });
    expect(ai.calendar).toEqual(passAll.calendar);
  });

  for (const agent of ['easy', 'normal', 'hard'] as const)
    it(`plays a two-season game at ${agent}, every kennel still four and two`, () => {
      const { s } = play({
        seed: 5,
        players: ais(5, agent),
        length: { kind: 'seasons', seasons: 2 },
      });
      expect(s.phase).toBe('seasonEnd');
      expect(s.drafts).toHaveLength(2);
      for (const p of s.players) {
        expect(p.dogIds).toHaveLength(4);
        expect(p.staff.length).toBeLessThanOrEqual(2);
      }
    });

  it('replays a whole two-season game from its log', () => {
    const { s, log } = play(setup);
    expect(JSON.stringify(replay(createSeason(setup), log))).toBe(JSON.stringify(s));
  }, 60_000);
});
