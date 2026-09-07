import { describe, expect, it } from 'vitest';
import {
  balance,
  createSeason,
  decide,
  dogValue,
  isSeasonOver,
  needsAdvance,
  netWorthBreakdown,
  player,
  reduceMut,
  shipValue,
  debt,
  ratingCap,
  RACE_CLASSES,
  type Action,
  type GameState,
} from '../src/index';

/** Invariants that must hold after every single action (BUILD_PLAN §7). */
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error('Invariant violated: ' + msg);
}

function checkInvariants(s: GameState, lastAction: Action): void {
  const owners = new Map<string, string>();
  for (const p of s.players) {
    // Cash is never negative except through Fat Tony's tab or outright bankruptcy.
    if (p.cash < 0) {
      assert(
        p.flags.bankrupt || p.loans.length > 0,
        `negative cash without a loan after ${lastAction.t}`,
      );
    }
    assert(p.cargo >= 0, 'p.cargo >= 0');
    assert(p.cargo <= p.ship.cargoCap, 'p.cargo <= p.ship.cargoCap');
    assert(p.dogIds.length <= p.kennelSlots, 'p.dogIds.length <= p.kennelSlots');
    for (const id of p.dogIds) {
      const d = s.dogs[id];
      assert(d !== undefined, `dog ${id} owned by ${p.id} is missing`);
      assert(d!.ownerId === p.id, 'd!.ownerId === p.id');
      assert(!owners.has(id), `dog ${id} owned twice`);
      owners.set(id, p.id);
      assert(d!.rating >= 0, 'd!.rating >= 0');
      assert(d!.rating <= 99, 'd!.rating <= 99');
      assert(Number.isInteger(d!.rating), 'integer');
      for (const stat of ['speed', 'accel', 'stamina', 'trap'] as const) {
        assert(d![stat] >= 1, 'd![stat] >= 1');
        assert(d![stat] <= 99, 'd![stat] <= 99');
        assert(Number.isInteger(d![stat]), 'integer');
      }
      assert(d!.fitness >= 0, 'd!.fitness >= 0');
      assert(d!.fitness <= 100, 'd!.fitness <= 100');
      assert(Math.abs(d!.form) <= balance.formMax, 'Math.abs(d!.form) <= balance.formMax');
    }
    // Net worth equals the sum of its parts.
    const w = netWorthBreakdown(s, p);
    const dogs = p.dogIds.reduce((sum, id) => sum + dogValue(s.dogs[id]!), 0);
    assert(
      w.total ===
        Math.round(p.cash) +
          dogs +
          shipValue(p) +
          Math.round(p.cargo * s.planet.foodSell) -
          debt(p),
      'w.total === Math.round(p.cash) + dogs + shipValue(p) + Math.round(p.cargo * s.planet.foodSell) - debt(p)',
    );
  }
  // A dog is never declared in two races, and declared dogs respect the caps (checked while
  // declarations are still open — ratings move after the race).
  const declared = new Set<string>();
  for (const cls of s.locked ? [] : RACE_CLASSES) {
    for (const [pid, dogId] of Object.entries(s.declarations[cls])) {
      assert(!declared.has(dogId), `dog ${dogId} declared twice`);
      declared.add(dogId);
      const d = s.dogs[dogId]!;
      assert(d.ownerId === pid, 'd.ownerId === pid');
      assert(d.rating <= ratingCap(cls), 'd.rating <= ratingCap(cls)');
    }
  }
  if (s.fields) {
    const inRace = new Set<string>();
    for (const cls of RACE_CLASSES) {
      assert(s.fields[cls].length === balance.traps, 'field size');
      for (const e of s.fields[cls]) {
        assert(!inRace.has(e.dogId), 'dog in two races');
        inRace.add(e.dogId);
        if (!e.local) assert(e.rating <= ratingCap(cls), 'e.rating <= ratingCap(cls)');
      }
    }
  }
}

function playChecked(seed: number, players: number): GameState {
  const s = createSeason({
    seed,
    players: Array.from({ length: players }, () => ({
      name: '',
      kind: 'ai' as const,
      difficulty: 'normal' as const,
    })),
  });
  let guard = 0;
  while (!isSeasonOver(s) && guard++ < 50_000) {
    const actions: Action[] = needsAdvance(s)
      ? [{ t: 'AdvancePhase' }]
      : decide(
          s,
          s.pendingEvent?.playerId ?? s.activePlayer!,
          player(s, s.activePlayer!).difficulty,
        );
    for (const a of actions) {
      reduceMut(s, a);
      checkInvariants(s, a);
    }
  }
  expect(isSeasonOver(s)).toBe(true);
  return s;
}

describe('engine invariants', () => {
  it('hold after every action across 12 seasons of 3–8 stables', () => {
    for (let seed = 100; seed < 112; seed++) playChecked(seed, 3 + (seed % 6));
  }, 60_000);

  it('rejects actions out of turn and out of phase', () => {
    const s = createSeason({
      seed: 1,
      players: [
        { name: 'A', kind: 'human' },
        { name: 'B', kind: 'ai' },
      ],
    });
    expect(() => reduceMut(s, { t: 'EndPhase', playerId: 'p1' })).toThrow();
    expect(() => reduceMut(s, { t: 'BuyDog', playerId: 'p1', dogId: 'nope' })).toThrow();
    reduceMut(s, { t: 'AdvancePhase' }); // arrival + events; p1 is human so the season waits
    expect(['events', 'planetPre']).toContain(s.phase);
  });

  it('never lets a purchase take cash below zero', () => {
    const s = createSeason({ seed: 3, players: [{ name: 'A', kind: 'human' }] });
    reduceMut(s, { t: 'AdvancePhase' });
    while (s.pendingEvent) reduceMut(s, { t: 'ResolveEvent', playerId: 'p1', choice: 0 });
    const p = player(s, 'p1');
    expect(() => reduceMut(s, { t: 'TradeFood', playerId: 'p1', units: 1000 })).toThrow();
    let bought = 0;
    for (;;) {
      try {
        reduceMut(s, { t: 'BuyUpgrade', playerId: 'p1', upgrade: 'cargo' });
        bought++;
      } catch (e) {
        expect(String(e)).toMatch(/Bones/);
        break;
      }
    }
    expect(bought).toBeGreaterThanOrEqual(1);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.cash).toBeLessThan(balance.shipCargoCost * 1.2);
  });
});
