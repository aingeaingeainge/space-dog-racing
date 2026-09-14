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
  cargoCap,
  championshipPoints,
  jobCost,
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
    // The bound is the hold the stable actually has, which is the ship plus whatever a Trader adds
    // (GDD §8.3). Changed from `p.ship.cargoCap` because the quantity it bounds changed, not
    // because the rule loosened: `fireStaff` refuses to leave a hold over capacity, so this is
    // still the tightest true statement about the hold at every instant.
    assert(cargoTotal(p.cargo) <= cargoCap(p), 'cargoTotal(p.cargo) <= cargoCap(p)');
    // GDD §8.3 / D7: three slots, any mix. The mix is free; the count is not.
    assert(
      p.staff.length <= balance.staffSlots,
      `${p.staff.length} staff in ${balance.staffSlots} slots`,
    );
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
  const card = thisWeeksCard(s);
  // GDD §13: the Fixer's week. All of them things a screen or a sweep leans on.
  //
  // ⚠️ Phase E's version of "struck off means struck off" is the opposite shape to Phase D's. It
  // used to check that a barred stable had nobody on the *books*; the Fixer is not on the books
  // any more, so what the ban has to mean is that no *job* was bought after the enquiry that
  // barred them. Which is the stronger statement, and the one the ban is actually for (E-D45).
  assert(
    !s.players.some((p) => p.staff.some((o) => o.role === 'fixer')),
    'a fixer is on somebody’s books — he is hired by the job now',
  );
  {
    const barredAt = new Map<string, number>();
    for (const f of [...s.fixArchive, ...s.fixes]) {
      if (!f.caught) continue;
      const at = barredAt.get(f.playerId);
      if (at === undefined || f.week < at) barredAt.set(f.playerId, f.week);
    }
    for (const f of [...s.fixArchive, ...s.fixes]) {
      const at = barredAt.get(f.playerId);
      if (at !== undefined)
        assert(f.week <= at, `${f.playerId} bought a job in week ${f.week}, barred since ${at}`);
    }
    for (const [pid] of barredAt)
      assert(player(s, pid).flags.fixerBarred, `${pid} was caught and is not barred`);
  }
  for (const kind of ['bribe', 'sabotage'] as const) {
    const perPlayer = new Map<string, number>();
    for (const f of s.fixes) {
      if (f.kind !== kind || f.week !== s.week) continue;
      perPlayer.set(f.playerId, (perPlayer.get(f.playerId) ?? 0) + 1);
    }
    for (const [pid, n] of perPlayer)
      assert(n <= 1, `${pid} has ${n} ${kind}s down this weekend — the fixer has one job in him`);
  }
  for (const f of s.fixes) {
    assert(card.includes(f.race), `a ${f.kind} on the ${f.race}, which is not on the card`);
    if (f.kind === 'bribe') {
      assert(f.trap !== undefined, 'a bribe with no box bought');
      assert(f.trap! >= 1 && f.trap! <= balance.traps, `box ${f.trap} does not exist`);
      // If the field is out, the box that was paid for is the box the dog is in — the bribe is
      // applied last in lockDeclarations precisely so that nothing can quietly undo it.
      const field = s.fields?.find((x) => x.race === f.race);
      const entry = field?.entries.find((e) => e.dogId === f.dogId);
      if (entry) assert(entry.trap === f.trap, `bought trap ${f.trap}, drew ${entry.trap}`);
    }
    const d = s.dogs[f.dogId];
    if (d && f.kind === 'sabotage') assert(d.ownerId !== f.playerId, 'nobbled its own dog');
  }
  // Every job is somebody's job, at somebody's price (E-D45). The fee on the record has to be the
  // price list's answer for the grade that took it, or the Season End column is adding up numbers
  // the player was never charged.
  for (const f of [...s.fixArchive, ...s.fixes]) {
    assert(f.fixer.length > 0, 'a job with nobody’s name on it');
    assert(
      f.fee === jobCost(f.kind, f.tier),
      `a ${f.kind} by a ${f.tier} man cost ${f.fee}, price list says ${jobCost(f.kind, f.tier)}`,
    );
    assert(f.caught || f.fine === undefined, 'a fine on a job the stewards never noticed');
  }
  // The archive is the season, and this week is not in it yet: a fix is swept in at endTurn, so
  // the two lists never hold the same job twice and the split cannot double-count.
  for (const f of s.fixArchive)
    assert(f.week < s.week, `week ${f.week} archived during week ${f.week}`);
  for (const d of Object.values(s.dogs)) {
    assert(d.nobbled >= 0 && Number.isInteger(d.nobbled), `nobbled ${d.nobbled}`);
    // A nobbling is a fact about one card. Outside the window between the lock and the end of the
    // races there is no such thing, which is what makes clearing it with the other race-day buffs
    // the whole of its lifetime.
    if (!s.locked || s.races) assert(d.nobbled === 0, `${d.id} still carries ${d.nobbled} nobbled`);
  }
  // GDD §4.3: the championship is derived from the archive, so it can never disagree with it.
  const points = championshipPoints(s);
  for (const p of s.players) assert((points[p.id] ?? 0) >= 0, 'negative championship points');

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
