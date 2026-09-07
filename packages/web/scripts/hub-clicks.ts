/**
 * What a weekend costs in clicks, before and after the hub started telling you what is in
 * each venue.
 *
 * PLAYTEST_NOTES finding 4: "an hour once every venue is in use — six venues × two planet
 * phases × 13 weeks. Nothing is wrong with any single screen; there are simply a lot of
 * clicks." M3's hub is supposed to shorten that path, so this measures it rather than
 * asserting it.
 *
 *   npx tsx packages/web/scripts/hub-clicks.ts [seasons]
 *
 * What is counted, per weekend, for a player who works the whole planet:
 *
 *   BEFORE  every venue that is open has to be opened, because walking in is the only way to
 *           find out whether it has anything in it. Plus the fixed overhead: three
 *           declarations, "head to the track", "run the races", "back to the planet",
 *           "end turn". Races are not counted — at 2× they advance themselves.
 *   AFTER   the hub prints each venue's stock on its hotspot (lib/venueStatus.ts), so only
 *           the venues with something in them are worth a walk. Same fixed overhead: nothing
 *           is hidden, nothing is disabled that was not already, and a player who wants to
 *           look anyway still can.
 *
 * The walk is a real season through store/loop.ts and screenFor, with a human who shops:
 * buys a dog when one is affordable and a kennel slot is free, keeps a trainer, keeps the
 * dogs fed, declares its best three and bets nothing. Cash is what decides most of the
 * "worth a walk" answers, so the player has to actually spend for the number to mean anything.
 */
import {
  balance,
  createSeason,
  drive,
  planetOf,
  upgradePrice,
  RACE_CLASSES,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceClass,
  type SeasonSetup,
} from '@sdr/engine';
import { applyActions, screenFor, type ScreenUi } from '../src/store/loop';
import { venues } from '../src/lib/venues';
import { venueStatus } from '../src/lib/venueStatus';
import { HOTSPOT_VENUES } from '../src/lib/hotspots';

const HUMAN = 'p1';
/** Declarations (3) + head to the track + run the races + back to the planet + end turn. */
const FIXED_PER_WEEKEND = 7;

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligible(d: Dog, cls: RaceClass): boolean {
  const cap = cls === 'bronze' ? balance.capBronze : cls === 'silver' ? balance.capSilver : 99;
  return d.injuryWeeks === 0 && d.banWeeks === 0 && d.rating <= cap;
}

function planetTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const dogs = ownDogs(s, p);
  let cash = p.cash;

  const trainer = s.planet.staff.find((o) => o.role === 'trainer');
  if (pre && !p.staff.trainer && trainer && cash > trainer.wage * 5) {
    out.push({ t: 'HireStaff', playerId: p.id, role: 'trainer', staffId: trainer.id });
    cash -= trainer.wage;
  }
  if (pre && p.staff.trainer && !p.training && dogs[0])
    out.push({ t: 'SetTraining', playerId: p.id, dogId: dogs[0].id, stat: 'speed' });

  if (dogs.length < p.kennelSlots) {
    const buy = s.planet.marketDogIds
      .map((id) => s.dogs[id])
      .filter((d): d is Dog => !!d && (d.askingPrice ?? 0) < cash - 4000)
      .sort((a, b) => b.rating - a.rating)[0];
    if (buy) {
      out.push({ t: 'BuyDog', playerId: p.id, dogId: buy.id });
      cash -= buy.askingPrice ?? 0;
    }
  }

  if (s.toggles.trading && p.cargo < dogs.length * 2) {
    const units = Math.min(
      p.ship.cargoCap - p.cargo,
      dogs.length * 2,
      Math.floor(Math.max(0, cash - 1500) / Math.max(1, s.planet.foodBuy)),
    );
    if (units > 0) out.push({ t: 'TradeFood', playerId: p.id, units });
  }

  if (pre) {
    const taken = new Set<Id>();
    for (const cls of ['gold', 'silver', 'bronze'] as RaceClass[]) {
      const pick = dogs
        .filter((d) => !taken.has(d.id) && eligible(d, cls) && d.fitness > 40)
        .sort((a, b) => b.rating - a.rating)[0];
      if (pick) {
        taken.add(pick.id);
        out.push({ t: 'Declare', playerId: p.id, cls, dogId: pick.id });
      }
    }
    const gear = upgradePrice('trackDay', planet, p);
    if (s.planet.trackDayPasses && gear < cash - 6000 && dogs[0])
      out.push({ t: 'BuyUpgrade', playerId: p.id, upgrade: 'trackDay', dogId: dogs[0].id });
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

interface Tally {
  phases: number;
  before: number;
  after: number;
  weekends: number;
}

function playSeason(seed: number, tally: Tally): void {
  const setup: SeasonSetup = {
    seed,
    players: [
      { name: 'Jesse', kind: 'human' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
    ],
  };
  let state = createSeason(setup);
  const log: Action[] = [];
  drive(state, log);
  const ui: ScreenUi = { racesWatchedWeek: 0, resultsSeenWeek: 0, passAck: null };
  let lastWeek = 0;

  for (let step = 0; step < 20000; step++) {
    const screen = screenFor(state, ui);
    if (screen.kind === 'seasonEnd') return;
    if (screen.kind === 'noHuman') throw new Error(`seed ${seed}: lost the human stable`);
    const me = screen.me!;
    if (screen.kind === 'race') {
      ui.racesWatchedWeek = state.week;
      continue;
    }
    if (screen.kind === 'results') {
      ui.resultsSeenWeek = state.week;
      continue;
    }
    if (screen.kind === 'pass') {
      ui.passAck = me.id;
      continue;
    }
    if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      const applied = applyActions(state, [
        { t: 'ResolveEvent', playerId: me.id, choice: 0 },
      ]);
      state = applied.state;
      log.push(...applied.added);
      continue;
    }
    if (screen.kind === 'betting') {
      const applied = applyActions(state, [{ t: 'EndPhase', playerId: me.id }]);
      state = applied.state;
      log.push(...applied.added);
      continue;
    }

    // A planet phase. Count what the six venues cost this player, both ways.
    if (state.week !== lastWeek) {
      lastWeek = state.week;
      tally.weekends++;
    }
    const open = new Map(venues(state).map((v) => [v.id, v]));
    const status = venueStatus(state, me);
    for (const id of HOTSPOT_VENUES) {
      if (!open.get(id)?.open) continue;
      tally.before++;
      if (status[id].worth) tally.after++;
    }
    tally.phases++;

    const applied = applyActions(state, planetTurn(state, me));
    state = applied.state;
    log.push(...applied.added);
  }
  throw new Error(`seed ${seed}: the season never ended`);
}

const n = Number(process.argv[2]) || 20;
const tally: Tally = { phases: 0, before: 0, after: 0, weekends: 0 };
for (let i = 0; i < n; i++) playSeason(1000 + i * 37, tally);

const weekends = tally.weekends;
const before = tally.before / weekends + FIXED_PER_WEEKEND;
const after = tally.after / weekends + FIXED_PER_WEEKEND;
const seasonBefore = before * balance.weeks;
const seasonAfter = after * balance.weeks;

console.log(`${n} seasons, ${weekends} weekends, ${tally.phases} planet phases.\n`);
console.log(`Venue visits a weekend`);
console.log(`  before — every open venue, both phases : ${(tally.before / weekends).toFixed(1)}`);
console.log(`  after  — only the ones with stock      : ${(tally.after / weekends).toFixed(1)}`);
console.log(`\nClicks a weekend (venues + ${FIXED_PER_WEEKEND} fixed)`);
console.log(`  before : ${before.toFixed(1)}`);
console.log(`  after  : ${after.toFixed(1)}   (${(100 * (1 - after / before)).toFixed(0)}% fewer)`);
console.log(`\nClicks a ${balance.weeks}-week season`);
console.log(`  before : ${Math.round(seasonBefore)}`);
console.log(`  after  : ${Math.round(seasonAfter)}   (${Math.round(seasonBefore - seasonAfter)} fewer)`);
