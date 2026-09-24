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
  aiChoiceFor,
  balance,
  cargoTotal,
  HOLD_CAP,
  STAPLE_ID,
  createSeason,
  drive,
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
 * Declarations (3) + head to the track + run the races + back to the planet + end turn.
 *
 * ⚠️ **7, not 8, since Phase D2 (Jesse's call): the "plan the week" press is gone.** It was v2 Phase
 * A's addition — one Kennels button that set every dog's Race/Rest by fitness — and it was counted
 * here as a fixed press every weekend. D1's walk found it changed nothing: `weeklyFitnessDelta`
 * rests a dog that did not run whatever its state says, so for a player who declares, Race/Rest was
 * inert and the declaration was the decision. From D2 the Race Office sets the week (a declared dog
 * races, the rest rest) and the Kennels shows it, so the press is not made and is not counted.
 * The sum below is otherwise the same instrument D1 used.
 *
 * ⚠️ **Four of these seven are navigation, not decisions, and v3's budget row is about decisions.**
 * BUILD_PLAN_V3 Phase A asks for "decisions per weekend per player ≤ 10" and names this script as the
 * instrument, so the headline number below stays the full press count — moving the goalposts by
 * re-defining the instrument in the phase that is supposed to measure it is exactly the move the
 * standing instruction forbids. But the split is printed too, because the two numbers answer
 * different questions: presses are how long the evening takes, decisions are how much of it was a
 * choice, and §1 asks both.
 *
 * A weekend with no bookie — Holy Bark, or a No Betting season — never had a "run the races" button
 * to press; the locked-card screen those weekends get (screens/LockedField.tsx) ends on "Watch the
 * races", which takes that click's place, so every weekend costs the same fixed seven.
 */
const FIXED_PER_WEEKEND = 7;

/** Head to the track, run the races, back to the planet, end turn — pressed, never chosen. */
const FIXED_NAVIGATION = 4;

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

function planetTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  const pre = s.phase === 'planetPre';
  const dogs = ownDogs(s, p);
  const cash = p.cash;

  // ⚠️ **Three of the hub player's decisions are gone (BUILD_PLAN_V3 §2.1)**: hiring, buying a dog
  // and buying gear. That should push `hub-clicks` down on its own, which matters because GDD_V3
  // §10.1 cuts the budget from 14.5 to **10** — the number that counts now is decisions × players,
  // and eight players at 14 is an unplayable evening. Phase D's Explore adds one back.
  // ⚠️ No Race/Rest here any more (Phase D2 item 5): the declarations below set the week.

  if (s.toggles.trading && p.cargo[STAPLE_ID] < dogs.length * 2) {
    const units = Math.min(
      HOLD_CAP - cargoTotal(p.cargo),
      dogs.length * 2,
      s.planet.goods[STAPLE_ID].stock,
      Math.floor(Math.max(0, cash - 1500) / Math.max(1, s.planet.goods[STAPLE_ID].buy)),
    );
    if (units > 0) out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units });
  }

  if (pre) {
    const taken = new Set<Id>();
    // Richest race first, so the best dog goes where the money is — the same order a player
    // fills the card in. The card is ordered with the headline race last (GDD §6.3).
    for (const race of [...thisWeeksCard()].reverse()) {
      const pick = dogs
        .filter((d) => !taken.has(d.id) && eligible(d, race) && d.fitness > 40)
        .sort((a, b) => b.rating - a.rating)[0];
      if (pick) {
        taken.add(pick.id);
        out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
      }
    }
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

interface Tally {
  phases: number;
  before: number;
  after: number;
  weekends: number;
  /** GDD_V3 §9.1: a door a weekend, and a second press when the card behind it has a choice. */
  explore: number;
  /** Weekends the results screen's "Fly on" took "back to the planet" and "end turn" as one press. */
  flyOn: number;
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
    if (state.phase === 'explore' && !state.pendingEvent && state.activePlayer === me.id) {
      // One press on a door; the card behind it costs a second only if it has a choice to make.
      tally.explore++;
      const applied = applyActions(state, [{ t: 'ChooseDoor', playerId: me.id, door: 0 }]);
      state = applied.state;
      log.push(...applied.added);
      continue;
    }
    if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      tally.explore++;
      const choice = aiChoiceFor(state, me.id);
      const applied = applyActions(state, [{ t: 'ResolveEvent', playerId: me.id, choice }]);
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

    const turn = planetTurn(state, me);
    // After the races with nothing to buy and nothing worth a walk: Results' "Fly on" is one press
    // where "back to the planet" and "end turn" were two.
    if (
      state.phase === 'planetPost' &&
      turn.length === 1 &&
      !HOTSPOT_VENUES.some((id) => open.get(id)?.open && status[id].worth)
    )
      tally.flyOn++;
    const applied = applyActions(state, turn);
    state = applied.state;
    log.push(...applied.added);
  }
  throw new Error(`seed ${seed}: the season never ended`);
}

const n = Number(process.argv[2]) || 20;
const tally: Tally = { phases: 0, before: 0, after: 0, weekends: 0, explore: 0, flyOn: 0 };
for (let i = 0; i < n; i++) playSeason(1000 + i * 37, tally);

const weekends = tally.weekends;
// ⚠️ **Phase D1 adds two lines to this sum and says so.** Explore costs a press on a door every
// weekend and a second when the card has a choice — the arrival card it replaced cost that second
// press too, and this script never counted it, so the old 10.5 was light by about a quarter of a
// click. And the results screen's "Fly on" makes "back to the planet" + "end turn" one press on a
// weekend with nothing to do after the races. Both are counted from the walk, not assumed.
const explorePresses = tally.explore / weekends;
const flyOnSaved = tally.flyOn / weekends;
const before = tally.before / weekends + FIXED_PER_WEEKEND + explorePresses;
const after = tally.after / weekends + FIXED_PER_WEEKEND + explorePresses - flyOnSaved;
const seasonBefore = before * balance.weeks;
const seasonAfter = after * balance.weeks;

console.log(`${n} seasons, ${weekends} weekends, ${tally.phases} planet phases.\n`);
console.log(`Venue visits a weekend`);
console.log(`  before — every open venue, both phases : ${(tally.before / weekends).toFixed(1)}`);
console.log(`  after  — only the ones with stock      : ${(tally.after / weekends).toFixed(1)}`);
console.log(
  `Explore a weekend: ${explorePresses.toFixed(2)} presses (a door, and a choice when the card has one)`,
);
console.log(`"Fly on" from the results: ${flyOnSaved.toFixed(2)} presses saved a weekend`);
console.log(`\nClicks a weekend (venues + ${FIXED_PER_WEEKEND} fixed + Explore − Fly on)`);
console.log(`  before : ${before.toFixed(1)}`);
console.log(`  after  : ${after.toFixed(1)}   (${(100 * (1 - after / before)).toFixed(0)}% fewer)`);
console.log(
  `  budget (BUILD_PLAN_V3 Phase A): ≤ 10 — ${after <= 10 ? 'MET' : `MISSED by ${(after - 10).toFixed(1)}`}`,
);
console.log(
  `  of which decisions : ${(after - FIXED_NAVIGATION + flyOnSaved).toFixed(1)}   ` +
    `(navigation : ${(FIXED_NAVIGATION - flyOnSaved).toFixed(1)} — track, races, back, end turn, less Fly on)`,
);
console.log(`\nClicks a ${balance.weeks}-week season`);
console.log(`  before : ${Math.round(seasonBefore)}`);
console.log(
  `  after  : ${Math.round(seasonAfter)}   (${Math.round(seasonBefore - seasonAfter)} fewer)`,
);
