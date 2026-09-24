import { describe, expect, it } from 'vitest';
import {
  aiChoiceFor,
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
  STYLE_IDS,
  type Action,
  type GameState,
  mulberry32,
  simulateRace,
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
      // §6.2's You Paid (decision B4): a running average, never negative, and zero whenever there
      // is nothing of that good aboard — `settleHold` keeps that true after every action. (Zero with
      // crates aboard is fine: crates that arrived free cost nothing.)
      assert(p.paid[id] >= 0, `p.paid[${id}] >= 0`);
      assert(p.cargo[id] > 0 || p.paid[id] === 0, `p.paid[${id}] is set with nothing aboard`);
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
      // ⚠️ v3 Phase B: `trainStat` is replaced by the sticky diet (GDD_V3 §6.3), so the invariant
      // that the pointer names something real is re-pointed at the field that replaced it.
      assert(
        ['named', 'best', 'worst'].includes(d!.diet.kind),
        `diet ${d!.diet.kind} is not a diet`,
      );
      if (d!.diet.kind === 'named')
        assert(GOOD_IDS.includes(d!.diet.good), `diet names ${d!.diet.good}, which is not a good`);
      assert(d!.lastMeal === null || GOOD_IDS.includes(d!.lastMeal), `lastMeal ${d!.lastMeal}`);
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
    assert(
      card[card.length - 1] === HEADLINE_TYPE_ID,
      `week ${w} does not end on the headline race`,
    );
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

/**
 * Walk a one-human season through this week's Explore (GDD_V3 §9.1, v3 Phase D1): open the first
 * door and answer whatever is behind it as a Normal AI would. It replaced the arrival draw's
 * `while (s.pendingEvent) ResolveEvent(0)`, which could now mean "swap your first dog".
 */
function explorePast(s: GameState): void {
  let guard = 0;
  while ((s.phase === 'explore' || s.pendingEvent) && guard++ < 20) {
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    if (s.pendingEvent)
      reduceMut(s, { t: 'ResolveEvent', playerId: who, choice: aiChoiceFor(s, who) });
    else reduceMut(s, { t: 'ChooseDoor', playerId: who, door: 0 });
  }
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
    reduceMut(s, { t: 'AdvancePhase' }); // arrival + Explore; p1 is human so the season waits
    // v3 Phase D1: the arrival draw is gone and Explore waits for a door (GDD_V3 §9.1).
    expect(['explore', 'planetPre']).toContain(s.phase);
    expect(() => reduceMut(s, { t: 'EndPhase', playerId: s.activePlayer ?? 'p1' })).toThrow();
  });

  it('never lets a purchase take cash below zero', () => {
    const s = createSeason({ seed: 3, players: [{ name: 'A', kind: 'human' }] });
    reduceMut(s, { t: 'AdvancePhase' });
    explorePast(s);
    const p = player(s, 'p1');
    expect(() =>
      reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: STAPLE_ID, units: 1000 }),
    ).toThrow();
    // Spend down a crate at a time, **dearest good first**, moving down the ladder whenever a
    // shelf runs out, until the reducer refuses — which is how a stable with money in its pocket
    // actually shops, and the only order in which cash and space can be told apart.
    let bought = 0;
    let stoppedOn: 'cash' | 'hold' | null = null;
    for (const id of [...GOOD_IDS].reverse()) {
      for (;;) {
        try {
          reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: id, units: 1 });
          bought++;
        } catch (e) {
          const why = String(e);
          if (/Bones/.test(why)) stoppedOn = 'cash';
          else if (/hold space/.test(why)) stoppedOn = 'hold';
          else expect(why).toMatch(/to be had here/); // this shelf is bare: next good down
          break;
        }
      }
      if (stoppedOn) break;
    }
    expect(bought).toBeGreaterThanOrEqual(1);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(cargoTotal(p.cargo)).toBeLessThanOrEqual(HOLD_CAP);
    // ⚠️ **Re-examined in v3 Phase B, as Phase A asked, and now it measures something.** Phase A
    // rewrote this to assert only the hold cap, because with one cheap good and a 20-crate hold the
    // hold always bound before the cash and there was no early game to test. At GDD_V3 §6.1's 50
    // crates and six goods on 8× bands, a stable in week 1 shopping dearest-first runs out of
    // **money** with the hold far from full — "cash binds early" — and at a 20-crate hold the same
    // walk runs out of *space* first (Ambrosia and Marrow alone fill it), so this line fails if the
    // hold is ever put back. The crossover to hold-bound later in the season is a harness row.
    expect(stoppedOn).toBe('cash');
    expect(cargoTotal(p.cargo)).toBeLessThan(HOLD_CAP);
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
      explorePast(s);
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

/*
 * v3 Phase C — running styles. Additions only: nothing above this line was edited for Phase C.
 */
describe('running styles (GDD_V3 §5.4, §5.5)', () => {
  it('deals every stable one of each style, every dog at exactly the starting rating, all hidden', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = 3 + (seed % 6);
      const s = createSeason({
        seed,
        players: Array.from({ length: n }, () => ({ name: '', kind: 'ai' as const })),
      });
      for (const p of s.players) {
        const dogs = p.dogIds.map((id) => s.dogs[id]!);
        expect(dogs.map((d) => d.style).sort()).toEqual([...STYLE_IDS].sort());
        for (const d of dogs) {
          expect(d.rating).toBe(balance.startDogRating);
          expect(d.styleKnown).toBe(false);
        }
      }
    }
  });

  it('reveals a style by racing, never un-reveals it, and never posts one the table does not know', () => {
    for (const seed of [7, 8, 9]) {
      const s = createSeason({
        seed,
        players: Array.from({ length: 6 }, () => ({ name: '', kind: 'ai' as const })),
      });
      const known = new Set<string>();
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 50_000) {
        const lockedBefore = s.locked;
        const actions: Action[] = needsAdvance(s)
          ? [{ t: 'AdvancePhase' }]
          : decide(s, s.pendingEvent?.playerId ?? s.activePlayer!, 'normal');
        for (const a of actions) {
          reduceMut(s, a);
          for (const d of Object.values(s.dogs)) {
            if (known.has(d.id)) expect(d.styleKnown).toBe(true);
            if (d.styleKnown) known.add(d.id);
          }
          // A posted entry shows the style the table knew at the lock, and only that one.
          if (!lockedBefore && s.locked && s.fields) {
            for (const f of s.fields)
              for (const e of f.entries) {
                const d = s.dogs[e.dogId]!;
                expect(e.style).toBe(d.styleKnown ? d.style : null);
              }
          }
          if (s.races)
            for (const r of s.races)
              r.entries.forEach((e, i) => {
                expect(s.dogs[e.dogId]!.styleKnown).toBe(true);
                expect(r.runs[i]!.style).toBe(s.dogs[e.dogId]!.style);
              });
        }
      }
      expect(isSeasonOver(s)).toBe(true);
    }
  }, 60_000);
});

describe('the hot pace and the run-in (GDD_V3 §5.3, §14 Q11; Phase C2)', () => {
  const track = { distance: 480, length: 'standard', bends: 'medium', hazard: 1 } as const;
  const field = (styles: readonly (typeof STYLE_IDS)[number][]) =>
    styles.map((style, i) => ({
      id: `d${i}`,
      trap: i + 1,
      speed: 50,
      accel: 50,
      stamina: 50,
      fitness: 75,
      form: 0,
      traits: [],
      style,
    }));
  const b = balance as unknown as Record<string, number>;

  it('never touches the rng, never lights with one front-runner, and burns only when lit', () => {
    const lone = field([
      'frontRunner',
      'stalker',
      'stalker',
      'stalker',
      'closer',
      'closer',
      'stalker',
      'stalker',
    ]);
    const crowd = field([
      'frontRunner',
      'frontRunner',
      'frontRunner',
      'stalker',
      'closer',
      'stalker',
      'stalker',
      'stalker',
    ]);
    const saved = b.hotPaceFadeCost!;
    for (let seed = 1; seed <= 40; seed++) {
      const rngA = mulberry32(seed);
      const rngB = mulberry32(seed);
      // A lone front-runner: the rule never lights, so any cost at all gives the identical race.
      b.hotPaceFadeCost = 0;
      const a = simulateRace(lone, { track, major: false }, rngA);
      b.hotPaceFadeCost = 500;
      const c = simulateRace(lone, { track, major: false }, rngB);
      b.hotPaceFadeCost = saved;
      expect(c.ticks).toEqual(a.ticks);
      expect(a.events.some((e) => e.kind === 'hotPace')).toBe(false);
      expect(a.runs.every((r) => r.hot === 0)).toBe(true);
      // And the rule draws nothing: the rng is left at the same point whatever it did to the race.
      expect(rngA.next()).toBe(rngB.next());
      // A crowded front lights it, at most once, and only runners in the lead group pay.
      const h = simulateRace(crowd, { track, major: false }, mulberry32(seed));
      const lit = h.events.filter((e) => e.kind === 'hotPace');
      expect(lit.length).toBeLessThanOrEqual(1);
      if (!lit.length) expect(h.runs.every((r) => r.hot === 0)).toBe(true);
    }
  });

  it('slows every runner alike in the run-in, so it never reorders a field of equal dogs', () => {
    const eq = field([
      'stalker',
      'stalker',
      'stalker',
      'stalker',
      'stalker',
      'stalker',
      'stalker',
      'stalker',
    ]);
    const saved = b.raceRunInPenalty!;
    for (let seed = 1; seed <= 20; seed++) {
      b.raceRunInPenalty = 0;
      const off = simulateRace(eq, { track, major: false }, mulberry32(seed));
      b.raceRunInPenalty = saved;
      const on = simulateRace(eq, { track, major: false }, mulberry32(seed));
      // Same ground, same draws: identical up to the run-in, and the finish can only be closer.
      const upTo = off.ticks.findIndex(
        (row) => Math.max(...row) > track.distance - b.raceRunInMetres!,
      );
      expect(on.ticks.slice(0, upTo)).toEqual(off.ticks.slice(0, upTo));
      expect(on.margin).toBeLessThanOrEqual(off.margin + 1e-9);
    }
  });
});

/*
 * v3 Phase D1 — additions only; nothing above this line was edited.
 */
describe('Explore, the Pound, the tips and the local runner (GDD_V3 §4.4, §9; Phase D1)', () => {
  /** What must hold after every action once Explore exists, over whole seasons of Normal stables. */
  function checkD1(s: GameState): void {
    for (const p of s.players) {
      // ⚠️ Edited in Phase E1 (item 1): the free local runner is deleted, so there is no loaner to
      // check — only that no stable carries one any more.
      assert(!('loanerId' in p), `${p.id} still carries a loaner`);
      assert(p.dogIds.length === balance.startDogs, `${p.id} holds ${p.dogIds.length} dogs`);
      assert(
        p.dealtGone.length + p.dogIds.filter((id) => s.dogs[id]!.dealt).length === 3,
        `${p.id}'s dealt three do not add up`,
      );
      assert(p.stats.liesCaught <= p.stats.liesTold, 'more lies caught than told');
      assert(p.stats.dogsTaken <= p.stats.dogOffers, 'more dogs taken than offered');
    }
    for (const d of Object.values(s.dogs)) assert(!('loan' in d), `${d.id} is a loaner`);
    for (const c of s.conditions) {
      for (const pid of c.tipped)
        assert(
          s.players.some((p) => p.id === pid),
          `tip to ${pid}`,
        );
      assert(new Set(c.tipped).size === c.tipped.length, 'a stable tipped twice about one dog');
    }
    if (s.phase === 'explore') assert(s.activePlayer !== null || s.pendingEvent, 'Explore stalled');
    if (s.explore && s.phase !== 'explore' && s.phase !== 'arrival')
      for (const p of s.players)
        assert(s.explore.picks[p.id] !== undefined, `${p.id} never opened a door`);
  }

  it('hold after every action across 12 seasons of 3–8 stables', () => {
    for (let seed = 300; seed < 312; seed++) {
      const s = createSeason({
        seed,
        players: Array.from({ length: 3 + (seed % 6) }, () => ({
          name: '',
          kind: 'ai' as const,
          difficulty: 'normal' as const,
        })),
      });
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 50_000) {
        const who = s.pendingEvent?.playerId ?? s.activePlayer!;
        const actions: Action[] = needsAdvance(s)
          ? [{ t: 'AdvancePhase' }]
          : decide(s, who, player(s, who).difficulty);
        for (const a of actions) {
          reduceMut(s, a);
          checkInvariants(s);
          checkD1(s);
        }
      }
      expect(isSeasonOver(s)).toBe(true);
    }
  }, 60_000);

  // ⚠️ Edited in Phase E1 (item 1): the loaner half of this test went with the free local runner.
  it('refuses a second door and a door out of turn', () => {
    const s = createSeason({
      seed: 11,
      players: [
        { name: 'A', kind: 'human' },
        { name: 'B', kind: 'human' },
      ],
    });
    reduceMut(s, { t: 'AdvancePhase' });
    expect(s.phase).toBe('explore');
    const first = s.activePlayer!;
    const second = s.turnOrder.find((id) => id !== first)!;
    expect(() => reduceMut(s, { t: 'ChooseDoor', playerId: second, door: 0 })).toThrow();
    expect(() => reduceMut(s, { t: 'ChooseDoor', playerId: first, door: 3 })).toThrow();
    reduceMut(s, { t: 'ChooseDoor', playerId: first, door: 1 });
    if (s.pendingEvent)
      reduceMut(s, { t: 'ResolveEvent', playerId: first, choice: aiChoiceFor(s, first) });
    expect(() => reduceMut(s, { t: 'ChooseDoor', playerId: first, door: 0 })).toThrow();
  });
});

/*
 * v3 Phase D2 — additions only; nothing above this line was edited.
 */
describe('Phase D2: staff, sabotage and the bought box', () => {
  /** Drive a season to a point, every seat an AI of the given difficulty. */
  const table = (seed: number, n = 6) =>
    createSeason({
      seed,
      players: Array.from({ length: n }, (_, i) => ({
        name: '',
        kind: 'ai' as const,
        difficulty: (['normal', 'hard', 'easy'] as const)[i % 3]!,
      })),
    });
  const step = (s: GameState) => {
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    const actions: Action[] = needsAdvance(s)
      ? [{ t: 'AdvancePhase' }]
      : decide(s, who, player(s, who).difficulty);
    for (const a of actions) reduceMut(s, a);
  };

  it('a stable never has more than two trainers, and commission comes only from purses', () => {
    for (let seed = 400; seed < 410; seed++) {
      const s = table(seed, 3 + (seed % 6));
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 50_000) {
        step(s);
        for (const p of s.players) {
          assert(p.staff.length <= balance.staffSlots, `${p.id} holds ${p.staff.length} trainers`);
          assert(new Set(p.staff).size === p.staff.length, `${p.id} holds a trainer twice`);
        }
        const all = s.players.flatMap((p) => p.staff);
        assert(new Set(all).size === all.length, 'two stables employ the same trainer');
      }
      // Every Bone of commission is on a payout — a purse — and nowhere else.
      for (const p of s.players) {
        const onPurses = s.results
          .flatMap((r) => r.payouts)
          .filter((x) => x.playerId === p.id)
          .reduce((a, x) => a + x.commission, 0);
        expect(p.stats.commission).toBe(onPurses);
      }
    }
  }, 60_000);

  /** Two copies of one weekend at the lock, one with a job booked by hand; race day run on both. */
  const raceDayWith = (seed: number, book: (s: GameState) => void) => {
    const run = (withJob: boolean) => {
      const s = table(seed);
      let booked = false;
      let guard = 0;
      while (s.phase !== 'planetPost' && guard++ < 5000) {
        if (s.phase === 'betting' && !s.locked && !booked) {
          booked = true;
          if (withJob) book(s);
        }
        step(s);
      }
      return s;
    };
    return { plain: run(false), booked: run(true) };
  };

  it('a nobble never touches the stored fitness', () => {
    let hits = 0;
    for (let seed = 500; seed < 506; seed++) {
      let victim = '';
      const { plain, booked } = raceDayWith(seed, (s) => {
        victim = Object.values(s.declarations[HEADLINE_TYPE_ID])[0] ?? '';
        s.jobs.push({ by: 'p6', kind: 'nobble', dogId: victim });
      });
      if (!victim) continue;
      hits++;
      // The runner ran on −25; the stored dog is exactly what it would have been without the job.
      expect(booked.dogs[victim]!.fitness).toBe(plain.dogs[victim]!.fitness);
      expect(booked.fields).toEqual(plain.fields);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('a bought box is honoured', () => {
    let hits = 0;
    for (let seed = 600; seed < 612; seed++) {
      const box = 1 + (seed % 8);
      let race: (typeof RACE_TYPE_IDS)[number] | undefined;
      const { booked } = raceDayWith(seed, (s) => {
        race = RACE_TYPE_IDS.find((r) => s.declarations[r]['p1']);
        if (race) s.jobs.push({ by: 'p1', kind: 'box', race, box });
      });
      if (!race) continue;
      const entry = booked
        .fields!.find((f) => f.race === race)!
        .entries.find((e) => e.ownerId === 'p1');
      expect(entry?.trap).toBe(box);
      hits++;
    }
    expect(hits).toBeGreaterThan(3);
  });
});

/*
 * v3 Phase E1 — additions only. Above this line, only Phase D1's block was edited, as item 1 (the
 * free local runner's deletion) forced; its comments say where.
 */
describe('Phase E1: the game around the seasons (GDD_V3 §2.1, §2.2, §4.3)', () => {
  const six = Array.from({ length: 6 }, () => ({
    name: '',
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  }));
  /** One step of an all-AI game: the actions the engine or the stable on the clock would take. */
  const step = (s: GameState): Action[] => {
    if (needsAdvance(s)) return [{ t: 'AdvancePhase' }];
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    return decide(s, who, player(s, who).difficulty);
  };

  it('ages every dog by exactly one at each off-season, and never during a season', () => {
    for (const seed of [5, 6]) {
      const s = createSeason({ seed, players: six, length: { kind: 'seasons', seasons: 3 } });
      let offSeasons = 0;
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 200_000) {
        for (const a of step(s)) {
          const before = new Map(Object.values(s.dogs).map((d) => [d.id, d.age]));
          const phase = s.phase;
          reduceMut(s, a);
          const opened = phase !== 'offSeason' && s.phase === 'offSeason';
          if (opened) offSeasons++;
          for (const d of Object.values(s.dogs)) {
            const was = before.get(d.id);
            if (was === undefined || d.ownerId === 'local') continue;
            const want = opened ? Math.min(7, was + 1) : was;
            assert(d.age === want, `${d.id} aged ${was} → ${d.age} at week ${s.week} (${a.t})`);
          }
          // No dog anywhere carries a loan (item 1), in any season.
          for (const d of Object.values(s.dogs)) assert(!('loan' in d), `${d.id} is a loaner`);
        }
      }
      expect(offSeasons).toBe(2);
    }
  }, 60_000);

  it('pays a retirement exactly the dog’s book value, and swaps in the dog on offer', () => {
    const s = createSeason({
      seed: 21,
      players: [{ name: 'Me', kind: 'human' }, ...six.slice(1)],
      length: { kind: 'seasons', seasons: 2 },
    });
    let guard = 0;
    while (!(s.phase === 'offSeason' && s.activePlayer === 'p1') && guard++ < 100_000) {
      const who = s.pendingEvent?.playerId ?? s.activePlayer;
      if (!needsAdvance(s) && who === 'p1') {
        // The human seat plays the week as Normal would.
        if (s.pendingEvent)
          reduceMut(s, { t: 'ResolveEvent', playerId: who, choice: aiChoiceFor(s, who) });
        else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
        continue;
      }
      for (const a of step(s)) reduceMut(s, a);
    }
    const me = player(s, 'p1');
    const old = s.dogs[me.dogIds[1]!]!;
    const value = dogValue(old);
    const cash = me.cash;
    const offered = String(s.offSeason!.notices['p1']!.offer.offerName);
    reduceMut(s, { t: 'Retire', playerId: 'p1', dogId: old.id });
    expect(me.cash).toBe(cash + value);
    expect(s.dogs[old.id]).toBeUndefined();
    expect(me.dogIds).toHaveLength(balance.startDogs);
    const joined = s.dogs[me.dogIds[1]!]!;
    expect(joined.name).toBe(offered);
    expect(joined.styleKnown).toBe(false);
    expect(joined.dealt).toBe(false);
    // Each answer once; EndPhase only once everything is answered.
    expect(() => reduceMut(s, { t: 'Retire', playerId: 'p1', dogId: null })).toThrow();
    const n = s.offSeason!.notices['p1']!;
    if (n.candidate) {
      expect(() => reduceMut(s, { t: 'EndPhase', playerId: 'p1' })).toThrow(/staff/);
      reduceMut(s, { t: 'ResolveStaffNotice', playerId: 'p1', hire: false });
    }
    reduceMut(s, { t: 'EndPhase', playerId: 'p1' });
  }, 60_000);

  it('ends a Target game at the end of the first weekend anybody crosses, and the richest wins', async () => {
    const { netWorth } = await import('../src/index');
    for (const seed of [1, 2, 3, 4]) {
      const target = balance.targetShort;
      const s = createSeason({ seed, players: six, length: { kind: 'target', worth: target } });
      let first: { season: number; week: number } | null = null;
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 200_000) {
        for (const a of step(s)) {
          const wasEnd = s.phase === 'endTurn';
          const at = { season: s.season, week: s.week };
          reduceMut(s, a);
          // At the end of every weekend, before the jump: who is at or past the target?
          if (wasEnd && !first) {
            const worths = s.players.map((p) => p.stats.worthByWeek[at.week - 1] ?? 0);
            if (Math.max(...worths) >= target) first = at;
          }
        }
      }
      expect(s.gameOver?.reason).toBe('target');
      expect(first).toEqual({ season: s.gameOver!.season, week: s.gameOver!.week });
      const worths = s.players.map((p) => netWorth(s, p));
      expect(s.finalStandings![0]!.netWorth).toBe(Math.max(...worths));
      for (const id of s.gameOver!.crossers)
        expect(netWorth(s, player(s, id))).toBeGreaterThanOrEqual(target);
    }
  }, 60_000);

  it('resets a stable’s stats at a new season and keeps the old ones in the archive', async () => {
    const { emptySeasonStats } = await import('../src/index');
    const s = createSeason({ seed: 9, players: six, length: { kind: 'seasons', seasons: 2 } });
    let atEnd: Record<string, unknown> | null = null;
    let checked = false;
    let guard = 0;
    while (!isSeasonOver(s) && guard++ < 200_000) {
      for (const a of step(s)) {
        const phase = s.phase;
        reduceMut(s, a);
        if (phase !== 'offSeason' && s.phase === 'offSeason')
          atEnd = Object.fromEntries(s.players.map((p) => [p.id, structuredClone(p.stats)]));
        if (phase === 'newSeason' && !checked) {
          checked = true;
          expect(s.season).toBe(2);
          for (const p of s.players) expect(p.stats).toEqual(emptySeasonStats());
          expect(s.seasons[0]!.stats).toEqual(atEnd);
          expect(s.results).toEqual([]);
          expect(s.bets).toEqual([]);
        }
      }
    }
    expect(checked).toBe(true);
    expect(s.seasons).toHaveLength(2);
    expect(s.seasons[1]!.stats['p1']!.worthByWeek).toHaveLength(balance.weeks);
  }, 60_000);
});

describe('Phase E2: the fresh season, the archive’s moments and the Bookie in any order', () => {
  const six = Array.from({ length: 6 }, () => ({
    name: '',
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  }));
  const step = (s: GameState): Action[] => {
    if (needsAdvance(s)) return [{ t: 'AdvancePhase' }];
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    return decide(s, who, player(s, who).difficulty);
  };

  it('starts every dog of every season after the first on seasonStartFitness, with no layoff', () => {
    let tired = 0;
    let injured = 0;
    let seasonsChecked = 0;
    for (const seed of [5, 6, 7]) {
      const s = createSeason({ seed, players: six, length: { kind: 'seasons', seasons: 3 } });
      let guard = 0;
      while (!isSeasonOver(s) && guard++ < 200_000) {
        for (const a of step(s)) {
          const phase = s.phase;
          // What the dogs carried out of the season, so the check below is not vacuous.
          if (phase === 'newSeason')
            for (const p of s.players)
              for (const id of p.dogIds) {
                const d = s.dogs[id]!;
                if (d.fitness < balance.seasonStartFitness) tired++;
                if (d.injuryWeeks > 0) injured++;
              }
          reduceMut(s, a);
          // The first arrival of the new season: nothing has touched a dog since startNextSeason.
          if (phase === 'newSeason') {
            expect(s.phase).toBe('arrival');
            seasonsChecked++;
            for (const p of s.players)
              for (const id of p.dogIds) {
                const d = s.dogs[id]!;
                assert(
                  d.fitness === balance.seasonStartFitness && d.injuryWeeks === 0,
                  `season ${s.season}: ${d.name} starts on ${d.fitness} fitness, ${d.injuryWeeks} weeks out`,
                );
              }
          }
        }
      }
    }
    expect(seasonsChecked).toBe(6);
    expect(tired).toBeGreaterThan(0);
    expect(injured).toBeGreaterThan(0);
  }, 90_000);

  it('archives each season’s longest-priced winner and best slip, as the season’s own results say', () => {
    const s = createSeason({ seed: 11, players: six, length: { kind: 'seasons', seasons: 2 } });
    let checked = 0;
    let guard = 0;
    while (!isSeasonOver(s) && guard++ < 200_000) {
      for (const a of step(s)) {
        const phase = s.phase;
        reduceMut(s, a);
        const ended = (phase !== 'offSeason' && s.phase === 'offSeason') || isSeasonOver(s);
        if (!ended) continue;
        const m = s.seasons[s.seasons.length - 1]!.moments;
        const winOdds = s.results.map((r) => r.entries.find((e) => e.dogId === r.order[0])!.odds);
        expect(m.upset?.odds).toBe(Math.max(...winOdds));
        const profits = s.bets
          .filter((b) => b.settled?.won)
          .map((b) => b.settled!.payout - b.stake);
        expect(m.bet?.profit ?? null).toBe(profits.length ? Math.max(...profits) : null);
        expect(m.betsStruck).toBe(s.bets.length);
        checked++;
      }
    }
    expect(checked).toBe(2);
  }, 60_000);

  it('lets a stable bet out of turn, and refuses a slip or an EndPhase once it has finished', () => {
    const s = createSeason({
      seed: 3,
      players: [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'human' }, ...six.slice(0, 4)],
    });
    let guard = 0;
    while (!(s.phase === 'betting' && s.locked && bettingOpenNow(s)) && guard++ < 100_000) {
      if (s.phase === 'betting' && s.locked && s.activePlayer) {
        reduceMut(s, { t: 'EndPhase', playerId: s.activePlayer });
        continue;
      }
      const who = s.pendingEvent?.playerId ?? s.activePlayer;
      if (!who || needsAdvance(s)) {
        reduceMut(s, { t: 'AdvancePhase' });
        continue;
      }
      if (s.pendingEvent)
        reduceMut(s, { t: 'ResolveEvent', playerId: who, choice: aiChoiceFor(s, who) });
      else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
    }
    // The human later in the turn order bets and leaves first, while the other is still on the clock.
    const humans = s.turnOrder.filter((id) => player(s, id).kind === 'human');
    const late = humans[1]!;
    const { race, entries } = s.fields![0]!;
    const bet: Action = {
      t: 'PlaceBet',
      playerId: late,
      race,
      dogId: entries[0]!.dogId,
      kind: 'win',
      stake: 50,
    };
    const active = s.activePlayer;
    reduceMut(s, bet);
    reduceMut(s, { t: 'EndPhase', playerId: late });
    expect(s.done).toContain(late);
    expect(s.activePlayer).toBe(active);
    expect(() => reduceMut(s, bet)).toThrow(/finished at the Bookie/);
    expect(() => reduceMut(s, { t: 'EndPhase', playerId: late })).toThrow();
  });
});

/** Is there a bookie this weekend (the engine's own rule, copied so this file needs no new export)? */
function bettingOpenNow(s: GameState): boolean {
  return s.toggles.betting && s.fields !== null;
}
