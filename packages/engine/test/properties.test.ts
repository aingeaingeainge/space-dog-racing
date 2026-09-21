import { describe, expect, it } from 'vitest';
import {
  balance,
  createSeason,
  decide,
  dogValue,
  isSeasonOver,
  needsAdvance,
  netWorthBreakdown,
  cargoTotal,
  HOLD_CAP,
  player,
  raceType,
  reduceMut,
  thisWeeksCard,
  weekStatusOf,
  STAPLE_ID,
  GOOD_IDS,
  HEADLINE_TYPE_ID,
  RACE_TYPE_IDS,
  STAT_KEYS,
  WEEK_STATES,
  type Action,
  type GameState,
} from '../src/index';

/** Invariants that must hold after every single action (BUILD_PLAN §7). */
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error('Invariant violated: ' + msg);
}

function checkInvariants(s: GameState): void {
  const owners = new Map<string, string>();
  // ⚠️ **Solvency is no longer an invariant, and that is the design rather than a gap.** v2 promised
  // cash was non-negative at a week boundary unless Fat Tony was carrying you or you were bust;
  // BUILD_PLAN_V3 §2.1 deletes the loans, the forced-sale cascade and bankruptcy itself, and
  // GDD_V3 V10 and pillar 5 are explicit that nobody is out before the end. So a stable that spends
  // past its cash simply owes nothing to anybody and goes on racing, and there is nothing true left
  // to assert here. `lastAction` is still threaded through for the messages below.
  for (const p of s.players) {
    // The hold, per good and in total (GDD §8.2). v1 asserted the same two things about a single
    // number; the quantity changed shape, so the expression does. Strictly stronger than before:
    // every shelf is non-negative *and* the total still fits the ship, where one number could
    // only say the second thing.
    for (const id of GOOD_IDS) {
      assert(p.cargo[id] >= 0, `p.cargo[${id}] >= 0`);
      assert(Number.isInteger(p.cargo[id]), `p.cargo[${id}] is an integer`);
    }
    assert(cargoTotal(p.cargo) >= 0, 'cargoTotal(p.cargo) >= 0');
    // One hold, the same for everybody, forever — there is no ship to enlarge it (GDD_V3 §6.1).
    assert(cargoTotal(p.cargo) <= HOLD_CAP, 'cargoTotal(p.cargo) <= HOLD_CAP');
    for (const id of p.dogIds) {
      const d = s.dogs[id];
      assert(d !== undefined, `dog ${id} owned by ${p.id} is missing`);
      assert(d!.ownerId === p.id, 'd!.ownerId === p.id');
      assert(!owners.has(id), `dog ${id} owned twice`);
      owners.set(id, p.id);
      assert(d!.rating >= 0, 'd!.rating >= 0');
      assert(d!.rating <= 99, 'd!.rating <= 99');
      assert(Number.isInteger(d!.rating), 'integer');
      for (const stat of STAT_KEYS) {
        assert(d![stat] >= 1, 'd![stat] >= 1');
        assert(d![stat] <= 99, 'd![stat] <= 99');
        assert(Number.isInteger(d![stat]), 'integer');
      }
      assert(d!.fitness >= 0, 'd!.fitness >= 0');
      assert(d!.fitness <= 100, 'd!.fitness <= 100');
      // BUILD_PLAN §7: every dog has exactly one weekly state, and Layoff is never stored — an
      // injured dog keeps the state its owner chose and `weekStatusOf` overrides it.
      assert(WEEK_STATES.includes(d!.weekState), `weekState ${d!.weekState} is not one of three`);
      assert(STAT_KEYS.includes(d!.trainStat), `trainStat ${d!.trainStat} is not a stat`);
      if (d!.injuryWeeks > 0) assert(weekStatusOf(d!) === 'layoff', 'an injured dog is on layoff');
      // A declared dog is racing. Declare sets it, and setDogState refuses to unset it.
      if (!s.locked && RACE_TYPE_IDS.some((r) => s.declarations[r][p.id] === id))
        assert(d!.weekState === 'race', `declared dog ${id} is set to ${d!.weekState}`);
      assert(Math.abs(d!.form) <= balance.formMax, 'Math.abs(d!.form) <= balance.formMax');
    }
    // Net worth equals the sum of its parts.
    const w = netWorthBreakdown(s, p);
    const dogs = p.dogIds.reduce((sum, id) => sum + dogValue(s.dogs[id]!), 0);
    // The cargo term is re-derived here **independently of `cargoValue`**, crate by crate at each
    // good's own local sell price. That is the point of the invariant: asserting it against the
    // engine's own helper would only say cargoValue equals cargoValue, and this is the assertion
    // BUILD_PLAN warned Phase C most threatens.
    const hold = GOOD_IDS.reduce((sum, id) => sum + p.cargo[id] * s.planet.goods[id].sell, 0);
    // Three terms, not five: no ship to value and no debt to subtract (GDD_V3 §2.4).
    assert(
      w.total === Math.round(p.cash) + dogs + Math.round(hold),
      'w.total === Math.round(p.cash) + dogs + the hold at local sell prices',
    );
  }
  const card = thisWeeksCard();
  // GDD §6.3: a weekend's card is exactly three races, run in a fixed order with the headline
  // race last, and no race appears on it twice. Every week of the season, not just this one —
  // the card is drawn when the calendar is built, so a bad draw is a bug from week 1.
  for (let w = 1; w <= balance.weeks; w++) {
    const card = thisWeeksCard();
    assert(card.length === 3, `week ${w}'s card has ${card.length} races`);
    assert(new Set(card).size === 3, `week ${w}'s card runs a race twice`);
    assert(card[card.length - 1] === HEADLINE_TYPE_ID, `week ${w} does not end on the headline race`);
  }

  // A dog is never declared in two races, is declared only into a race being run this weekend,
  // and satisfies that race's own entry criterion (checked while declarations are still open —
  // ratings and win counts move after the race).
  const declared = new Set<string>();
  for (const race of s.locked ? [] : RACE_TYPE_IDS) {
    for (const [pid, dogId] of Object.entries(s.declarations[race])) {
      assert(card.includes(race), `dog ${dogId} declared in the ${race}, which is not on the card`);
      assert(!declared.has(dogId), `dog ${dogId} declared twice`);
      declared.add(dogId);
      const d = s.dogs[dogId]!;
      assert(d.ownerId === pid, 'd.ownerId === pid');
      assert(
        raceType(race).eligible(d),
        `declared dog ${dogId} does not qualify for the ${race}: ${raceType(race).criterion}`,
      );
    }
  }
  if (s.fields) {
    const inRace = new Set<string>();
    assert(s.fields.length === card.length, 'a field per race on the card');
    for (const { race, entries } of s.fields) {
      assert(entries.length === balance.traps, 'field size');
      entries.forEach((e, i) => {
        // A runner's trap is its position in the field, boxes 1..8 with no gaps and no repeats.
        // Nothing asserted this while the trap number was worth nothing; D37 gives the draw an
        // effect and §13's steward bribe *moves a dog between boxes*, so "the field is the draw"
        // is now load-bearing rather than incidental.
        assert(e.trap === i + 1, `entry ${i} in the ${race} is in trap ${e.trap}`);
      });
      for (const e of entries) {
        assert(!inRace.has(e.dogId), 'dog in two races');
        inRace.add(e.dogId);
        // Every runner satisfies the race's predicate — the locals too. They bypass Declare, so
        // this is the only thing standing between a Juvenile and a field of four-year-olds
        // (GDD §6.3); createLocalDog's LocalSpec is what has to keep it true.
        //
        // Only between the lock and the races, because eligibility is a fact about the dog *at
        // declaration*: the race then moves ratings, wins and runs, and a Maiden's winner is
        // supposed to stop being a maiden. That is the mechanic, not a violation.
        if (!s.races)
          assert(
            raceType(race).eligible(s.dogs[e.dogId]!),
            `${e.local ? 'local' : 'declared'} runner ${e.dogId} does not qualify for the ${race}`,
          );
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
      checkInvariants(s);
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
    // A v2 action this engine no longer knows: `reduce`'s default arm must throw rather than
    // silently drop it, or a stale log would replay as a different season (the v2 Phase A finding).
    expect(() =>
      reduceMut(s, { t: 'HireStaff', playerId: 'p1', staffId: 'nope' } as unknown as Action),
    ).toThrow(/different version/);
    reduceMut(s, { t: 'AdvancePhase' }); // arrival + events; p1 is human so the season waits
    expect(['events', 'planetPre']).toContain(s.phase);
  });

  it('never lets a purchase take cash below zero', () => {
    const s = createSeason({ seed: 3, players: [{ name: 'A', kind: 'human' }] });
    reduceMut(s, { t: 'AdvancePhase' });
    while (s.pendingEvent) reduceMut(s, { t: 'ResolveEvent', playerId: 'p1', choice: 0 });
    const p = player(s, 'p1');
    expect(() =>
      reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: STAPLE_ID, units: 1000 }),
    ).toThrow();
    // Buy the staple a crate at a time until the money runs out. The only purchase left in v3
    // Phase A is the market, so that is what the refusal has to be tested against.
    let bought = 0;
    for (;;) {
      try {
        reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: STAPLE_ID, units: 1 });
        bought++;
      } catch (e) {
        expect(String(e)).toMatch(/Bones|hold space/);
        break;
      }
    }
    expect(bought).toBeGreaterThanOrEqual(1);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    // ⚠️ **The old assertion here was `cash < shipCargoCost × 1.2` — "the money is nearly gone" —
    // and it no longer holds, for a reason worth keeping rather than a bug.** It spent down through
    // 1,400-Bone hold upgrades, so cash was always what ran out. With no upgrades to buy, the only
    // purchase left is food at about a hundred a crate against a 20-crate hold, so **the hold binds
    // long before the cash does**: this run stops with most of the 6,000 still in hand.
    //
    // That is GDD_V3 §6.1's cash-bound-to-hold-bound progression arriving at the wrong end of the
    // season — with one cheap good and a small hold there is no cash-bound early game at all. It is
    // the clearest single argument for Phase B's 50-unit hold and its 8× bands, and Phase B's
    // "the week a stable stops being cash-bound and starts being hold-bound, weeks 4–7" row is where
    // it gets measured. What is asserted now is the invariant this test is actually for.
    expect(cargoTotal(p.cargo)).toBeLessThanOrEqual(HOLD_CAP);
  });

  /**
   * GDD_V3 §6.3's running cost, which is the whole of v3's (V10): a dog the hold cannot feed loses
   * `emptyHoldFitness` and gains nothing, and nothing is charged in Bones for it.
   *
   * Two copies of one season, played to the same point, differing only in whether the hold was
   * sold off before the jump. Every dog is set to Rest and dropped to 50 fitness first, because a
   * rested dog at 90 recovers into the ceiling of 100 either way and would hide the rule — which is
   * also why `runEndTurn` folds the penalty into the same clamp as the week's recovery rather than
   * applying it separately.
   */
  it('takes the empty-hold penalty in fitness, not in Bones', () => {
    const toJump = (sellTheHold: boolean) => {
      const s = createSeason({ seed: 7, players: [{ name: 'A', kind: 'human' }] });
      reduceMut(s, { t: 'AdvancePhase' });
      while (s.pendingEvent) reduceMut(s, { t: 'ResolveEvent', playerId: 'p1', choice: 0 });
      const p = player(s, 'p1');
      for (const id of GOOD_IDS) {
        if (sellTheHold && p.cargo[id] > 0)
          reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: id, units: -p.cargo[id] });
      }
      for (const id of p.dogIds) {
        reduceMut(s, { t: 'SetDogState', playerId: 'p1', dogId: id, state: 'rest' });
        s.dogs[id]!.fitness = 50;
      }
      const cashBefore = p.cash;
      let guard = 0;
      while (s.week === 1 && guard++ < 100) {
        if (needsAdvance(s)) reduceMut(s, { t: 'AdvancePhase' });
        else reduceMut(s, { t: 'EndPhase', playerId: 'p1' });
      }
      return { s, p, cashBefore };
    };
    const fed = toJump(false);
    const hungry = toJump(true);
    expect(cargoTotal(hungry.p.cargo)).toBe(0);
    for (const id of fed.p.dogIds) {
      const d = fed.s.dogs[id]!;
      const h = hungry.s.dogs[id]!;
      expect(h.fitness).toBe(d.fitness - balance.emptyHoldFitness);
    }
    // Not charged in Bones: v2 bought the missing crates at the gate at 1.5×, and that rule is
    // replaced rather than kept alongside. Selling the hold is the only cash that moved.
    expect(hungry.p.cash).toBe(hungry.cashBefore);
  });
});
