import { describe, expect, it } from 'vitest';
import {
  balance,
  betCommission,
  createSeason,
  cutFor,
  decide,
  hasExplored,
  isSeasonOver,
  maxStakeFor,
  needsAdvance,
  onTheClock,
  player,
  pricesFor,
  reduceMut,
  shelfDepthFor,
  staffOfRole,
  staffRow,
  STAFF,
  STAFF_BONUS_BY_ID,
  STAFF_ROLES,
  tradeCommission,
  viewFor,
  GOOD_IDS,
  RACE_TYPE_IDS,
  type Action,
  type GameState,
  type Id,
  type SeasonSetup,
} from '../src/index';
import { sealedFor } from '../src/ai';

/*
 * v3 Phase T (GDD_V3 T1–T4, Jesse's calls): **everybody plays the weekend at once**, with a shelf of
 * their own and the declarations sealed until the lock; and **three staff, one of each role**, each
 * paid a share of their own side.
 */

const humans = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Human ${i + 1}`, kind: 'human' as const }));
const ais = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `AI ${i + 1}`,
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  }));

/** Play every seat as Normal (a human through `decide`, as the room's stand-in does) until `stop`. */
function playUntil(s: GameState, stop: (s: GameState) => boolean): GameState {
  let guard = 0;
  while (!isSeasonOver(s) && !stop(s) && guard++ < 200_000) {
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = s.activePlayer!;
    for (const a of decide(s, who, 'normal')) reduceMut(s, a);
  }
  return s;
}

/** A game at week `week`'s planet, every stable still to go through its door. */
function atPlanet(setup: SeasonSetup, week = 2): GameState {
  return playUntil(createSeason(setup), (s) => s.week === week && s.phase === 'planetPre');
}

/** One stable's whole weekend on the planet as Normal would play it: door, card, sitting, EndPhase. */
function sitting(s: GameState, who: Id): void {
  let guard = 0;
  while (s.phase === 'planetPre' && !s.done.includes(who) && guard++ < 20)
    for (const a of decide(s, who, 'normal')) reduceMut(s, a);
}

describe('the weekend everybody plays at once (T1)', () => {
  it('lets any stable act in any order, and moves on only when the last finishes', () => {
    const s = atPlanet({ seed: 7, players: humans(3) });
    const [a, b, c] = s.turnOrder as [Id, Id, Id];
    expect(onTheClock(s)).toEqual([a, b, c]);
    // The last seat goes first, all the way to the end of its weekend.
    sitting(s, c);
    expect(s.done).toEqual([c]);
    expect(s.phase).toBe('planetPre');
    expect(onTheClock(s)).toEqual([a, b]);
    // Finished is finished.
    expect(() => reduceMut(s, { t: 'EndPhase', playerId: c })).toThrow(/finished/);
    expect(() => reduceMut(s, { t: 'TradeFood', playerId: c, good: 'greyMash', units: 1 })).toThrow(
      /finished/,
    );
    sitting(s, a);
    expect(s.done).toEqual([a, c]); // kept in seating order, whoever pressed first
    sitting(s, b);
    expect(s.phase).toBe('betting');
  });

  it('plays every AI the moment the weekend opens, and then waits on the humans', () => {
    const s = createSeason({ seed: 9, players: [...humans(2), ...ais(3)] });
    playUntil(s, (x) => x.week === 1 && x.phase === 'planetPre');
    // Drive as a client does: whoever the engine names, until a human is named.
    while (!needsAdvance(s) && player(s, s.activePlayer!).kind === 'ai')
      for (const a of decide(s, s.activePlayer!, 'normal')) reduceMut(s, a);
    expect(s.done.sort()).toEqual(['p3', 'p4', 'p5']);
    expect(s.activePlayer).toBe('p1');
    // …and the second human need not wait for the first.
    sitting(s, 'p2');
    expect(s.done).toContain('p2');
    expect(s.activePlayer).toBe('p1');
  });

  for (const seed of [3, 11, 19]) {
    it(`gives the same weekend whichever order three humans play it in (seed ${seed})`, () => {
      const base = atPlanet({ seed, players: [...humans(3), ...ais(3)] });
      // The AIs first, as any driver plays them.
      for (const id of base.turnOrder) if (player(base, id).kind === 'ai') sitting(base, id);
      const outcome = (order: Id[]) => {
        const s = structuredClone(base);
        for (const id of order) sitting(s, id);
        reduceMut(s, { t: 'AdvancePhase' }); // the lock
        const fields = s.fields!.map((f) =>
          f.entries.map((e) => [e.trap, e.ownerId, e.local ? 'local' : e.name, e.odds]),
        );
        for (const id of s.turnOrder)
          if (!s.done.includes(id)) reduceMut(s, { t: 'EndPhase', playerId: id });
        reduceMut(s, { t: 'AdvancePhase' }); // race day
        return JSON.stringify({
          rng: s.rng,
          fields,
          order: s.races!.map((r) => r.order.map((id) => s.dogs[id]?.name ?? id)),
          stables: s.players.map((p) => ({
            cash: p.cash,
            cargo: p.cargo,
            shelf: p.shelf,
            dogs: p.dogIds.map((id) => s.dogs[id]!.name),
            staff: p.staff,
          })),
        });
      };
      const want = outcome(['p1', 'p2', 'p3']);
      for (const order of [
        ['p1', 'p3', 'p2'],
        ['p2', 'p1', 'p3'],
        ['p3', 'p2', 'p1'],
      ])
        expect(outcome(order)).toBe(want);
    });
  }
});

describe('every stable has a shelf of its own (T2)', () => {
  it('fills each stable’s shelf at arrival, and a purchase empties only the buyer’s', () => {
    const s = atPlanet({ seed: 5, players: humans(2) });
    for (const p of s.players)
      for (const g of GOOD_IDS)
        expect(p.shelf[g]).toBe(shelfDepthFor(p, s.planet.goods[g].stock, 1));
    const [a, b] = s.turnOrder as [Id, Id];
    for (const id of [a, b]) reduceMut(s, { t: 'ChooseDoor', playerId: id, door: 0 });
    for (const id of [a, b])
      if (s.pendingEvents[id]) reduceMut(s, { t: 'ResolveEvent', playerId: id, choice: 0 });
    const g = 'greyMash';
    const before = player(s, b).shelf[g];
    const take = Math.min(player(s, a).shelf[g], 5);
    reduceMut(s, { t: 'TradeFood', playerId: a, good: g, units: take });
    expect(player(s, a).shelf[g]).toBe(before - take);
    expect(player(s, b).shelf[g]).toBe(before);
    // The planet's posted depth never moves.
    expect(s.planet.goods[g].stock).toBeGreaterThan(0);
  });

  it('is privateShelfShare of the posted depth, rounded up, and deeper with a Trade Advisor', () => {
    const plain = { staff: [] as Id[] };
    const deep = { staff: [staffOfRole('trade').find((r) => r.bonuses.includes('deepShelf'))!.id] };
    for (const posted of [3, 8, 12, 40, 60]) {
      expect(shelfDepthFor(plain, posted)).toBe(Math.ceil(posted * balance.privateShelfShare));
      expect(shelfDepthFor(deep, posted)).toBe(
        Math.ceil(posted * balance.privateShelfShare * (1 + balance.staffDeepShelf)),
      );
      expect(shelfDepthFor(plain, posted, 2)).toBe(
        Math.ceil(posted * balance.privateShelfShare * 2),
      );
    }
  });
});

describe('the declarations are sealed until the lock (T1)', () => {
  it('shows a stable its own entries and nobody else’s, until everybody has finished', () => {
    const s = atPlanet({ seed: 13, players: humans(3) });
    const [a, b] = s.turnOrder as [Id, Id];
    sitting(s, a);
    const mine = RACE_TYPE_IDS.filter((r) => s.declarations[r][a]);
    expect(mine.length).toBeGreaterThan(0);
    for (const r of RACE_TYPE_IDS) {
      expect(viewFor(s, b).declarations[r][a]).toBeUndefined();
      expect(viewFor(s, a).declarations[r][a]).toBe(s.declarations[r][a]);
    }
    for (const id of s.turnOrder) if (!s.done.includes(id)) sitting(s, id);
    reduceMut(s, { t: 'AdvancePhase' });
    expect(s.locked).toBe(true);
    for (const r of mine) expect(viewFor(s, b).declarations[r][a]).toBe(s.declarations[r][a]);
  });

  it('never lets an AI read a rival’s entry: its sitting is the same whatever a human declared', () => {
    for (const seed of [2, 4, 6, 8]) {
      const s = atPlanet({ seed, players: [...humans(1), ...ais(3)] });
      const quiet = structuredClone(s);
      sitting(s, 'p1');
      expect(RACE_TYPE_IDS.some((r) => s.declarations[r]['p1'])).toBe(true);
      for (const ai of ['p2', 'p3', 'p4']) {
        const hear = (x: GameState) => {
          const y = structuredClone(x);
          const out: Action[] = [];
          let guard = 0;
          while (!y.done.includes(ai) && guard++ < 20)
            for (const a of decide(y, ai, 'normal')) {
              out.push(a);
              reduceMut(y, a);
            }
          return JSON.stringify(out);
        };
        expect(hear(s)).toBe(hear(quiet));
        expect(sealedFor(s, ai).declarations.goldCup['p1']).toBeUndefined();
      }
    }
  });
});

describe('three staff, one of each role, each paid from their own side (T2–T4)', () => {
  it('has a roster of every role with room to spare at eight stables', () => {
    for (const role of STAFF_ROLES) expect(staffOfRole(role).length).toBeGreaterThanOrEqual(12);
    // Nobody carries a bonus from another role's side.
    for (const r of STAFF)
      for (const b of r.bonuses) expect(STAFF_BONUS_BY_ID[b].role).toBe(r.role);
  });

  it('prices a Trade Advisor’s haggling and selling, and never lets the sell reach the buy', () => {
    const s = atPlanet({ seed: 21, players: humans(1) });
    const both = {
      staff: [
        staffOfRole('trade').find(
          (r) => r.bonuses.includes('haggle') && r.bonuses.includes('sellUp'),
        )!.id,
      ],
    };
    const none = { staff: [] as Id[] };
    for (const g of GOOD_IDS) {
      const m = s.planet.goods[g];
      expect(pricesFor(s, none, g)).toEqual({ buy: m.buy, sell: m.sell });
      const p = pricesFor(s, both, g);
      expect(p.buy).toBe(Math.max(1, Math.round(m.buy * (1 - balance.staffHaggle))));
      expect(p.sell).toBeLessThan(p.buy);
      expect(p.sell).toBeGreaterThanOrEqual(m.sell);
    }
  });

  it('takes the Trade Advisor’s cut from the profit on a sale, and nothing from a loss', () => {
    const s = atPlanet({ seed: 23, players: humans(1) });
    const p = player(s, 'p1');
    const cut = cutFor(p, 'trade');
    expect(cut).toBeGreaterThan(0);
    p.cargo.vatSteak = 4;
    p.paid.vatSteak = 100;
    expect(tradeCommission(p, 'vatSteak', 4, 150)).toBe(Math.round(4 * 50 * cut));
    expect(tradeCommission(p, 'vatSteak', 4, 90)).toBe(0);
    reduceMut(s, { t: 'ChooseDoor', playerId: 'p1', door: 0 });
    if (s.pendingEvents['p1']) reduceMut(s, { t: 'ResolveEvent', playerId: 'p1', choice: 0 });
    const q = player(s, 'p1');
    const crates = q.cargo.vatSteak;
    if (!crates) return;
    const sell = pricesFor(s, q, 'vatSteak').sell;
    const owed = tradeCommission(q, 'vatSteak', crates, sell);
    const cash = q.cash;
    reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: 'vatSteak', units: -crates });
    expect(q.cash).toBe(cash + crates * sell - owed);
    expect(q.stats.tradeCommission).toBe(owed);
  });

  it('takes the Gambling Advisor’s cut from a winning slip’s profit only', () => {
    const p = { staff: [staffOfRole('gambling')[0]!.id] };
    const cut = cutFor(p, 'gambling');
    expect(betCommission(p, 100, 350)).toBe(Math.round(250 * cut));
    expect(betCommission(p, 100, 100)).toBe(0);
    expect(betCommission(p, 100, 0)).toBe(0);
    expect(betCommission({ staff: [] }, 100, 350)).toBe(0);
  });

  it('lifts the flat stake ceiling, never the share of cash, for an advisor who lifts the limit', () => {
    const s = atPlanet({ seed: 25, players: humans(1) });
    const p = player(s, 'p1');
    const lifter = staffOfRole('gambling').find((r) => r.bonuses.includes('stakeUp'))!.id;
    p.staff = p.staff.filter((id) => staffRow(id).role !== 'gambling');
    p.cash = 1_000_000;
    const flat = maxStakeFor(s, p);
    p.staff.push(lifter);
    expect(maxStakeFor(s, p)).toBe(Math.floor(flat * (1 + balance.staffStakeUp)));
    p.cash = 400;
    expect(maxStakeFor(s, p)).toBe(Math.floor(400 * balance.maxStakeFraction));
  });

  it('keeps one of each role through two seasons of Bar cards and off-season drafts', () => {
    for (const seed of [31, 32, 33]) {
      const s = createSeason({
        seed,
        players: ais(6),
        length: { kind: 'seasons', seasons: 2 },
      });
      playUntil(s, () => {
        for (const p of s.players) {
          const roles = p.staff.map((id) => staffRow(id).role);
          expect(new Set(roles).size).toBe(roles.length);
          expect(roles).toEqual(STAFF_ROLES.filter((r) => roles.includes(r)));
        }
        const all = s.players.flatMap((p) => p.staff);
        expect(new Set(all).size).toBe(all.length);
        return false;
      });
      expect(s.phase).toBe('seasonEnd');
      expect(hasExplored(s, 'p1')).toBe(true);
    }
  });
});
