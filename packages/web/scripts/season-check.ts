/**
 * Play a whole season the way a person does — through store/loop.ts and screenFor, the same two
 * functions App.tsx walks — issuing exactly the actions the screens can issue, with exactly the
 * guards the screens put on their buttons. Any ActionError means a screen could offer a player
 * a button the engine would refuse.
 *
 *   npx tsx packages/web/scripts/season-check.ts [seed ...]
 *
 * Not part of `npm test` (which is the engine's own suite); this is the UI's end-to-end check.
 */
import {
  cargoTotal,
  HOLD_CAP,
  KIBBLE_ID,
  bettingMargin,
  createSeason,
  drive,
  maxStakeFor,
  planetOf,
  replay,
  raceType,
  thisWeeksCard,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
  type SeasonSetup,
  type WeekState,
} from '@sdr/engine';
import { applyActions, screenFor, type ScreenUi } from '../src/store/loop';

const HUMAN = 'p1';

/**
 * Action counters. `Record<string, number>` plus `noUncheckedIndexedAccess` means every read is
 * `number | undefined`, so counting goes through here rather than through twenty non-null
 * assertions. (This file was never typechecked before v2 Phase A — `packages/web/tsconfig.json`
 * only covered `src` — which is how a `SetTraining` survived in it after the action was deleted.)
 */
type Tally = Record<string, number>;
function bump(tally: Tally, key: string, by = 1): void {
  tally[key] = (tally[key] ?? 0) + by;
}

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligibleFor(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

/**
 * Best dog to each race, richest race first — what a person does at the Race Office. The card is
 * ordered with the headline race last (GDD §6.3), so walking it backwards is walking down the
 * money, and a stable that cannot fill all three leaves the traps to the locals.
 */
function declarations(s: GameState, kennel: Dog[], p: Player): Action[] {
  const out: Action[] = [];
  const taken = new Set<Id>();
  for (const race of [...thisWeeksCard(s)].reverse()) {
    const pick = kennel
      .filter((d) => !taken.has(d.id) && eligibleFor(d, race) && d.fitness > 40)
      .sort((a, b) => b.rating - a.rating)[0];
    if (pick) {
      taken.add(pick.id);
      out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
    }
  }
  return out;
}

/** Everything a human can do at the planet's venues, with the screens' own guards. */
function planetTurn(s: GameState, p: Player, tally: Tally): Action[] {
  const out: Action[] = [];
  const pre = s.phase === 'planetPre';
  let cash = p.cash;
  let cargo = cargoTotal(p.cargo);
  let kibble = p.cargo[KIBBLE_ID];
  const dogs = ownDogs(s, p);
  const kennel = [...dogs];

  // GDD §5.7: the walk-through player plans every dog's week the way the Kennels' own "Plan the
  // week" button does — race anything fresh, train the middle, rest the tired. The declarations
  // below then flip whatever they enter back to 'race', which is the friendly implication in
  // action and the reason this runs first.
  if (pre) {
    for (const d of kennel) {
      if (d.injuryWeeks > 0) continue;
      const state: WeekState = d.fitness >= 65 ? 'race' : d.fitness >= 45 ? 'train' : 'rest';
      if (d.weekState === state) continue;
      out.push({ t: 'SetDogState', playerId: p.id, dogId: d.id, state });
      bump(tally, 'SetDogState');
    }
  }

  // --- Market: the food trade, which is the only market left (GDD_V3 §6) ---
  //
  // ⚠️ **Six venues' worth of walk-through went with the systems behind them (BUILD_PLAN_V3 §2.1)**:
  // the Saloon's hires and the week-9 clear-out, the bank and Fat Tony, the dog market's sell-the-
  // worst-buy-the-best, the gear, the dossier, and the ship. What is left is the three decisions
  // GDD_V3 §1.1 says v3 has at this point in the weekend, and the check is thinner for it.
  //
  // **This is the row to watch when Phase B lands**: §6.2's six goods with shelf depth and a sticky
  // per-dog diet are exactly the kind of thing a walk-through can *survive* without exercising, and
  // a check that passes because it stopped checking is worse than a red one.
  if (s.toggles.trading) {
    const need = kennel.length;
    const next = s.calendar[s.week];
    const nextBand = next ? planetOf(next.planetId).foodBand : null;
    const m = s.planet.goods[KIBBLE_ID];
    const nextMid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : m.buy;
    let units = 0;
    if (m.sell > nextMid + 20 && kibble > need) units = -(kibble - need);
    else if (nextMid - m.buy > 20) {
      const spend = Math.max(0, cash - 2500);
      units = Math.min(HOLD_CAP - cargo, Math.floor(spend / m.buy));
    } else if (kibble < need) {
      units = Math.min(
        HOLD_CAP - cargo,
        need - kibble,
        Math.floor(Math.max(0, cash - 500) / m.buy),
      );
    }
    if (units !== 0) {
      out.push({ t: 'TradeFood', playerId: p.id, good: KIBBLE_ID, units });
      cash -= units * (units > 0 ? m.buy : m.sell);
      cargo += units;
      kibble += units;
      bump(tally, 'TradeFood');
    }
  }

  if (pre) {
    const declares = declarations(s, kennel, p);
    out.push(...declares);
    bump(tally, 'Declare', declares.length);
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/** The Bookie screen: a stake inside the planet's cap, on the favourite and one outsider. */
function bettingTurn(s: GameState, p: Player, tally: Tally): Action[] {
  const out: Action[] = [];
  if (!s.fields) return [{ t: 'EndPhase', playerId: p.id }];
  let cash = p.cash;
  // ⚠️ **The nobbling half of this walk-through is gone (BUILD_PLAN_V3 §2.1).** It used to walk the
  // stewards' enquiry, the fine sized against the stake, and the ban that stopped the next hire —
  // the best-covered path in the check. GDD_V3 §9.3 rebuilds all of it as a Back Alley event in
  // Phase D, and §9.3's acceptance row (`season-check` fails on zero sabotages) is where it comes
  // back. Until then this screen only bets.
  for (const { race, entries } of s.fields) {
    const already = s.bets
      .filter((b) => b.playerId === p.id && b.week === s.week && b.race === race)
      .reduce((sum, b) => sum + b.stake, 0);
    const cap = maxStakeFor(s, { ...p, cash });
    const room = Math.max(0, Math.min(cap - already, Math.floor(cash)));
    if (room < 50) continue;
    const runners = [...entries].sort((a, b) => b.winProb - a.winProb);
    const fav = runners[0];
    const outsider = runners[Math.min(3, runners.length - 1)];
    const stake = Math.min(100, room);
    if (fav) {
      out.push({ t: 'PlaceBet', playerId: p.id, race, dogId: fav.dogId, kind: 'win', stake });
      cash -= stake;
      bump(tally, 'PlaceBet');
    }
    const room2 = Math.max(
      0,
      Math.min(maxStakeFor(s, { ...p, cash }) - already - stake, Math.floor(cash)),
    );
    if (outsider && outsider !== fav && room2 >= 50) {
      const stake2 = Math.min(50, room2);
      out.push({
        t: 'PlaceBet',
        playerId: p.id,
        race,
        dogId: outsider.dogId,
        kind: 'place',
        stake: stake2,
      });
      cash -= stake2;
      bump(tally, 'PlaceBet');
    }
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

function playSeason(seed: number, toggles?: SeasonSetup['toggles']) {
  const setup: SeasonSetup = {
    seed,
    ...(toggles ? { toggles } : {}),
    // A mixed field, so the check exercises all three difficulties' action streams (M4).
    players: [
      { name: 'Jesse', kind: 'human' },
      { name: '', kind: 'ai', difficulty: 'easy' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'hard' },
      { name: '', kind: 'ai', difficulty: 'hard' },
    ],
  };
  // One key per action the engine still has, so "never used" means an action exists that the
  // screens cannot issue — which is the thing this check is for. Nine keys went with the nine
  // action types BUILD_PLAN_V3 §2.1 deletes.
  const tally: Tally = {
    Declare: 0,
    PlaceBet: 0,
    TradeFood: 0,
    SetDogState: 0,
    ResolveEvent: 0,
  };
  const screens: Record<string, number> = {};

  let state = createSeason(setup);
  const log: Action[] = [];
  drive(state, log);
  const ui: ScreenUi = {
    racesWatchedWeek: 0,
    resultsSeenWeek: 0,
    fieldsSeenWeek: 0,
    passAck: null,
    bustAck: [],
  };

  for (let step = 0; step < 20000; step++) {
    const screen = screenFor(state, ui);
    screens[screen.kind] = (screens[screen.kind] ?? 0) + 1;
    if (screen.kind === 'seasonEnd') {
      const human = state.players.find((p) => p.id === HUMAN)!;
      const rehearsed = replay(createSeason(setup), log);
      if (JSON.stringify(rehearsed) !== JSON.stringify(state))
        throw new Error(`seed ${seed}: replaying the log did not reproduce the season`);
      return { state, log, tally, screens, human };
    }
    if (screen.kind === 'noHuman') throw new Error(`seed ${seed}: lost the human stable`);
    const me = screen.me!;
    if (screen.kind === 'race') {
      // The race view: the table watches the three logs replay. Watching changes nothing, so
      // the headless walk acknowledges it exactly as pressing skip three times would.
      ui.racesWatchedWeek = state.week;
      continue;
    }
    if (screen.kind === 'results') {
      ui.resultsSeenWeek = state.week;
      continue;
    }
    if (screen.kind === 'fields') {
      // A weekend with no bookie: the locked card is read, then the races run.
      ui.fieldsSeenWeek = state.week;
      continue;
    }
    if (screen.kind === 'bust') {
      ui.bustAck = [...ui.bustAck, me.id];
      continue;
    }
    if (screen.kind === 'pass') {
      ui.passAck = me.id;
      continue;
    }
    let actions: Action[];
    if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      actions = [
        {
          t: 'ResolveEvent',
          playerId: me.id,
          choice: state.week % state.pendingEvent.choices.length,
        },
      ];
      bump(tally, 'ResolveEvent');
    } else if (screen.kind === 'betting') {
      actions = bettingTurn(state, me, tally);
    } else {
      actions = planetTurn(state, me, tally);
    }
    const applied = applyActions(state, actions);
    state = applied.state;
    log.push(...applied.added);
  }
  throw new Error(`seed ${seed}: the season never ended`);
}

const seeds = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => !Number.isNaN(n));
const toRun = seeds.length ? seeds : [42, 7, 1234, 90210];
let failures = 0;
/** Phase A's replacement for the §13 coverage row — see the note at the end of the run. */
const walked = { declare: 0, states: 0, trades: 0, bets: 0 };
for (const seed of toRun) {
  const variants: [string, SeasonSetup['toggles'] | undefined][] =
    seed === toRun[0]
      ? [
          ['default toggles', undefined],
          [
            'no betting, no trading, casual events',
            {
              betting: false,
              trading: false,
              casualEvents: true,
            },
          ],
        ]
      : [['default toggles', undefined]];
  for (const [label, toggles] of variants) {
    try {
      const { state, log, tally, screens, human } = playSeason(seed, toggles);
      const worth = state.finalStandings?.find((f) => f.playerId === HUMAN)?.netWorth ?? 0;
      const rank = (state.finalStandings ?? []).findIndex((f) => f.playerId === HUMAN) + 1;
      const missing = Object.entries(tally)
        .filter(([, n]) => n === 0)
        .map(([k]) => k);
      console.log(
        `seed ${seed} (${label}): finished week ${state.week}, ${log.length} actions, ` +
          `${human.name} ${rank}/${state.players.length} on ${worth.toLocaleString('en-NZ')} Bones`,
      );
      console.log(
        `  actions: ${Object.entries(tally)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
      );
      console.log(
        `  screens: ${Object.entries(screens)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}${missing.length ? `\n  never used: ${missing.join(', ')}` : ''}`,
      );
      if (bettingMargin(state) <= 0) throw new Error('betting margin went to zero');
      // ⚠️ **The acceptance row this check used to carry is gone with §13 (BUILD_PLAN_V3 §2.1)** —
      // it counted jobs placed, stewards' enquiries and bans served, and refused to pass on a zero.
      // What replaces it is the same idea pointed at what v3 actually has: a season is not *walked*
      // unless the three decisions of GDD_V3 §1.1 that exist in Phase A were all exercised. Phase B
      // adds the diet and the empty hold to this list; Phase D puts the sabotage row back (§9.3).
      walked.declare += tally.Declare ?? 0;
      walked.states += tally.SetDogState ?? 0;
      walked.trades += tally.TradeFood ?? 0;
      walked.bets += tally.PlaceBet ?? 0;
      if (human.dogIds.length === 0) throw new Error('the human stable lost every dog');
    } catch (e) {
      failures++;
      console.error(`seed ${seed} (${label}) FAILED: ${(e as Error).message}`);
    }
  }
}
// ⚠️ An acceptance row rather than a statistic (BUILD_PLAN_V3 Phase A): a check that passes because
// it stopped checking is worse than a red one, and this phase deleted most of what this file used to
// walk. So the run fails unless every decision v3 has at this point was actually made.
console.log(
  `\nThe week walked: ${walked.declare} declarations, ${walked.states} Race/Rest changes, ` +
    `${walked.trades} trades, ${walked.bets} bets.`,
);
if (!failures && Object.values(walked).some((n) => n === 0)) {
  const dead = Object.entries(walked)
    .filter(([, n]) => n === 0)
    .map(([k]) => k);
  console.error(`Never exercised: ${dead.join(', ')} — the check did not walk the week.`);
  failures++;
}
console.log(failures ? `${failures} season(s) failed` : 'All seasons played out clean.');
process.exit(failures ? 1 : 0);
