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
  player,
  raceType,
  reduceMut,
  shipValue,
  debt,
  thisWeeksCard,
  weekStatusOf,
  KIBBLE_ID,
  GOOD_IDS,
  OPEN_TYPE_ID,
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

function checkInvariants(s: GameState, lastAction: Action): void {
  const owners = new Map<string, string>();
  // Solvency is promised at the week boundary, not inside the week. An event card charges what
  // it charges the moment it is drawn — "Lost luggage: −300" does not stop to ask whether you
  // have 300 — and the machinery that answers for it all lives in endTurn: Fat Tony covers the
  // shortfall, then repossesses, then the cheapest dogs are sold, and only then are you bust.
  // So a stable may be overdrawn between the event phase and endTurn, and must not be once
  // endTurn has run (phase 'arrival', or 'seasonEnd' in week 13). Asserting it after every
  // action instead was asserting something the engine has never promised: the same trip happens
  // on v1's constants at seeds outside this test's range, and clamping the charge would be a new
  // rule — one that quietly protects a careless stable from the bankruptcy GDD §7.5 wants.
  const settled = s.phase === 'arrival' || s.phase === 'seasonEnd';
  for (const p of s.players) {
    // Cash is never negative at a week boundary except through Fat Tony's tab or bankruptcy.
    if (p.cash < 0 && settled) {
      assert(
        p.flags.bankrupt || p.loans.length > 0,
        `negative cash without a loan at a week boundary after ${lastAction.t}`,
      );
    }
    // The hold, per good and in total (GDD §8.2). v1 asserted the same two things about a single
    // number; the quantity changed shape, so the expression does. Strictly stronger than before:
    // every shelf is non-negative *and* the total still fits the ship, where one number could
    // only say the second thing.
    for (const id of GOOD_IDS) {
      assert(p.cargo[id] >= 0, `p.cargo[${id}] >= 0`);
      assert(Number.isInteger(p.cargo[id]), `p.cargo[${id}] is an integer`);
    }
    assert(cargoTotal(p.cargo) >= 0, 'cargoTotal(p.cargo) >= 0');
    assert(cargoTotal(p.cargo) <= p.ship.cargoCap, 'cargoTotal(p.cargo) <= p.ship.cargoCap');
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
      // BUILD_PLAN §7: every dog has exactly one weekly state, and Layoff is never stored — an
      // injured dog keeps the state its owner chose and `weekStatusOf` overrides it.
      assert(WEEK_STATES.includes(d!.weekState), `weekState ${d!.weekState} is not one of three`);
      assert(STAT_KEYS.includes(d!.trainStat), `trainStat ${d!.trainStat} is not a stat`);
      if (d!.injuryWeeks > 0 || d!.banWeeks > 0)
        assert(weekStatusOf(d!) === 'layoff', 'an injured or banned dog is on layoff');
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
    assert(
      w.total === Math.round(p.cash) + dogs + shipValue(p) + Math.round(hold) - debt(p),
      'w.total === Math.round(p.cash) + dogs + shipValue(p) + the hold at local sell prices - debt(p)',
    );
  }
  // GDD §6.3: a weekend's card is exactly three races, run in a fixed order with the headline
  // race last, and no race appears on it twice. Every week of the season, not just this one —
  // the card is drawn when the calendar is built, so a bad draw is a bug from week 1.
  for (let w = 1; w <= balance.weeks; w++) {
    const card = thisWeeksCard(s, w);
    assert(card.length === 3, `week ${w}'s card has ${card.length} races`);
    assert(new Set(card).size === 3, `week ${w}'s card runs a race twice`);
    assert(card[card.length - 1] === OPEN_TYPE_ID, `week ${w} does not end on the headline race`);
  }

  // A dog is never declared in two races, is declared only into a race being run this weekend,
  // and satisfies that race's own entry criterion (checked while declarations are still open —
  // ratings and win counts move after the race).
  const declared = new Set<string>();
  const card = thisWeeksCard(s);
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
    expect(() =>
      reduceMut(s, { t: 'TradeFood', playerId: 'p1', good: KIBBLE_ID, units: 1000 }),
    ).toThrow();
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
