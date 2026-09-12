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
  cargoCap,
  cargoTotal,
  KIBBLE_ID,
  createSeason,
  drive,
  planetOf,
  upgradePrice,
  raceType,
  thisWeeksCard,
  type RaceTypeId,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type SeasonSetup,
} from '@sdr/engine';
import { applyActions, screenFor, type ScreenUi } from '../src/store/loop';
import { venues } from '../src/lib/venues';
import { venueStatus } from '../src/lib/venueStatus';
import { HOTSPOT_VENUES } from '../src/lib/hotspots';

/**
 * Declarations (3) + **plan the week** + head to the track + run the races + back to the planet +
 * end turn.
 *
 * "Plan the week" is v2 Phase A's addition and it is counted here deliberately. GDD §5.7 gives
 * every dog a weekly state, which is six decisions for a full kennel; the Kennels' summary button
 * (screens/Stable.tsx) sets the whole yard by fitness in one press and the player then overrides
 * the dogs they care about. So the mechanic costs **one** click a weekend rather than six, which
 * is the summary BUILD_PLAN §11 asks for when a per-dog decision meets a click budget. A player
 * who never touches it pays nothing and gets v1's behaviour — every dog pointed at a race.
 *
 * This is now true of *every* weekend, which it was not before M4 session 2. A weekend with no
 * bookie — Holy Bark, or a No Betting season — never had a "run the races" button to press, so the
 * flat 7 used to over-count those weeks by one. The locked-card screen those weekends now get
 * (screens/LockedField.tsx) ends on "Watch the races", which takes that click's place: the field
 * finally gets shown and the weekend costs exactly what a betting weekend costs.
 */
const FIXED_PER_WEEKEND = 8;

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && d.banWeeks === 0 && raceType(race).eligible(d);
}

function planetTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const dogs = ownDogs(s, p);
  let cash = p.cash;

  // The hub player keeps a trainer and a vet — Normal's own line (GDD §14) — at whatever tier it
  // can cover, so the Saloon is worth a walk on the weeks something good is drinking there.
  if (pre) {
    for (const role of ['trainer', 'vet'] as const) {
      if (p.staff.length >= balance.staffSlots) break;
      if (p.staff.some((o) => o.role === role)) continue;
      const offer = s.planet.staff.find((o) => o.role === role && cash > o.wage * 5);
      if (!offer) continue;
      out.push({ t: 'HireStaff', playerId: p.id, staffId: offer.id });
      cash -= offer.wage;
    }
  }
  // GDD §5.7's per-dog decision, counted honestly: the hub player plans every dog's week the way
  // the Kennels' "Plan the week" button does. That is *one* click for the yard, not one per dog —
  // the summary BUILD_PLAN §11 asks for when a per-dog decision meets a click budget — so the
  // weekend costs one more decision than it did, not six.
  if (pre) {
    for (const d of dogs) {
      if (d.injuryWeeks > 0 || d.banWeeks > 0) continue;
      const state = d.fitness >= 65 ? 'race' : d.fitness >= 45 ? 'train' : 'rest';
      if (d.weekState !== state) out.push({ t: 'SetDogState', playerId: p.id, dogId: d.id, state });
    }
  }

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

  if (s.toggles.trading && p.cargo[KIBBLE_ID] < dogs.length * 2) {
    const units = Math.min(
      cargoCap(p) - cargoTotal(p.cargo),
      dogs.length * 2,
      Math.floor(Math.max(0, cash - 1500) / Math.max(1, s.planet.goods[KIBBLE_ID].buy)),
    );
    if (units > 0) out.push({ t: 'TradeFood', playerId: p.id, good: KIBBLE_ID, units });
  }

  if (pre) {
    const taken = new Set<Id>();
    // Richest race first, so the best dog goes where the money is — the same order a player
    // fills the card in. The card is ordered with the headline race last (GDD §6.3).
    for (const race of [...thisWeeksCard(s)].reverse()) {
      const pick = dogs
        .filter((d) => !taken.has(d.id) && eligible(d, race) && d.fitness > 40)
        .sort((a, b) => b.rating - a.rating)[0];
      if (pick) {
        taken.add(pick.id);
        out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
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
  const ui: ScreenUi = {
    racesWatchedWeek: 0,
    resultsSeenWeek: 0,
    fieldsSeenWeek: 0,
    passAck: null,
    bustAck: [],
  };
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
    if (screen.kind === 'fields') {
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
    if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      const applied = applyActions(state, [{ t: 'ResolveEvent', playerId: me.id, choice: 0 }]);
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
console.log(
  `  after  : ${Math.round(seasonAfter)}   (${Math.round(seasonBefore - seasonAfter)} fewer)`,
);
