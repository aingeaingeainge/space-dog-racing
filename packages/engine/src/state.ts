import { balance } from './content/balance';
import {
  planetOf,
  GRAND_FINAL_PLANET_ID,
  MAJOR_PLANET_IDS,
  REGULAR_PLANET_IDS,
} from './content/planets';
import { AI_PERSONALITIES, AI_STABLE_NAMES } from './content/names';
import { CARD, raceType } from './content/raceTypes';
import { createStartingDog, emptyPlanetState, type IdGen } from './economy/dogs';
import { emptyCargo } from './economy/goods';
import { KIBBLE_ID } from './content/goods';
import { mulberry32, type Rng } from './rng';
import type {
  CalendarEntry,
  Dog,
  GameState,
  Id,
  Phase,
  Planet,
  Player,
  RaceTypeId,
  SeasonSetup,
  WeekStatus,
} from './types';
import { ActionError, RACE_TYPE_IDS } from './types';

/**
 * 6 for v2 Phase E: the Fixer is hired by the **job** rather than by the week, so he lives on
 * `PlanetState.fixer` instead of in `Player.staff`, every `Fix` carries the man and his grade,
 * and the season's fixing is archived in `fixArchive`. A Phase D log cannot replay on this
 * engine — its `HireStaff` actions can name a fixer, and nothing here would know what to do with
 * one.
 *
 * 5 for v2 Phase D: dogs carry a `nobbled` figure, the state carries this weekend's `fixes`, and
 * a stable can be barred from hiring a Fixer — so `Action` gains `BribeSteward` and `Sabotage`
 * and a Phase C log cannot replay on this engine.
 *
 * 4 for v2 Phase C: the hold is a record of crates per good rather than a single number, a
 * planet posts a price and a shelf depth per good rather than one `foodBuy`/`foodSell` pair, and
 * `TradeFood` names the good it is trading. A Phase B log cannot replay on this engine — its
 * `TradeFood` actions do not say what they were buying.
 *
 * 3 for v2 Phase B: a race is a row rather than one of three classes, so `Declare` and
 * `PlaceBet` carry a `RaceTypeId`, `Bet` and `RaceResult` store one, and declarations, fields
 * and races have all changed shape. A Phase A log cannot replay on this engine.
 *
 * The web save is seed + log (store/persist.ts), which is why SAVE_VERSION moves with it and an
 * old save fails soft to the title screen rather than replaying into a different game.
 */
export const STATE_VERSION = 5;
/**
 * The Major weekends. **One, at week 5 (GDD_V3 §2.1)**, where v2 had three.
 *
 * Kept as a list rather than collapsed to a number because the shape of the season is a list — the
 * Grand Final is week 10 and is its own thing — and because a multi-season game (Phase E) will want
 * to reshuffle this rather than recompute it.
 */
export const MAJOR_WEEKS: readonly number[] = [balance.majorWeek];

/**
 * How far ahead the circuit is free to look (GDD §9.3, D5). This planet in full, and next week's
 * by name and Major status — nothing beyond, unless you have bought it.
 *
 * The Majors themselves are *not* hidden: §4.1 fixes them at weeks 4, 7, 10 and 13 and the Grand
 * Final at Collar Prime, so the rhythm of the season stays plannable while its content does not.
 * That is why `weeksToMajor` may still scan the whole calendar and `planetAhead` may not.
 */
export const FREE_HORIZON = 1;

/** Mutable working view of a state inside the reducer: the rng is materialised once per reduce. */
export interface Ctx {
  s: GameState;
  rng: Rng;
  nextId: IdGen;
}

export function makeCtx(s: GameState): Ctx {
  const rng = mulberry32(s.rng);
  const nextId: IdGen = (prefix) => `${prefix}_${(s.nextId++).toString(36)}`;
  return { s, rng, nextId };
}

/** Write the rng position back so the next reduce continues the stream. */
export function commitCtx(ctx: Ctx): GameState {
  ctx.s.rng = ctx.rng.state();
  return ctx.s;
}

export function log(s: GameState, text: string, playerId?: Id): void {
  const line = { week: s.week, phase: s.phase, text, ...(playerId ? { playerId } : {}) };
  s.eventLog.push(line);
}

export function player(s: GameState, id: Id): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error('Unknown player ' + id);
  return p;
}

export function dog(s: GameState, id: Id): Dog {
  const d = s.dogs[id];
  if (!d) throw new Error('Unknown dog ' + id);
  return d;
}

export function currentPlanet(s: GameState): Planet {
  return planetOf(s.planet.planetId);
}

export function calendarEntry(s: GameState, week = s.week): CalendarEntry {
  const e = s.calendar[week - 1];
  if (!e) throw new Error('No calendar entry for week ' + week);
  return e;
}

export function isMajorWeek(s: GameState): boolean {
  return calendarEntry(s).major;
}

/**
 * This weekend's three races, in the order they are run (GDD_V3 §7.1): Bronze, Silver, Gold.
 *
 * ⚠️ **The same three every weekend now**, so this no longer reads the calendar at all. The
 * signature is kept — including the unused `week` — because every caller asks "what is on this
 * week", and a card that varies again (a Major with a fourth race, say) should not be a change to
 * thirty call sites.
 */
export function thisWeeksCard(): readonly RaceTypeId[] {
  return CARD;
}

/** An empty declaration book: every race type is a key, and most weeks most of them stay empty. */
export function emptyDeclarations(): Record<RaceTypeId, Record<Id, Id>> {
  return Object.fromEntries(RACE_TYPE_IDS.map((id) => [id, {}])) as Record<
    RaceTypeId,
    Record<Id, Id>
  >;
}

/** Purse for one race this week (GDD_V3 §7.1, plus the planet's own modifier). */
export function purseFor(s: GameState, race: RaceTypeId): [number, number, number] {
  const e = calendarEntry(s);
  const mult = e.grandFinal ? balance.finalMult : e.major ? balance.majorMult : 1;
  const planetMult = currentPlanet(s).special.purseMult ?? 1;
  return raceType(race).purse.map((x) => Math.round(x * mult * planetMult)) as [
    number,
    number,
    number,
  ];
}

/**
 * May this dog take a trap in this race? Two halves that are deliberately separate: the race's
 * own entry criterion, which is the row's business (GDD §6.3), and the condition that bars a dog
 * from every race there is. Locals answer the first half and skip the second — they are generated
 * sound.
 *
 * ⚠️ The stewards' ban is gone with the doping and fixing it punished (BUILD_PLAN_V3 §2.1), so
 * injury is the only thing that can stop a dog being declared.
 */
export function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

/**
 * What a dog is actually doing this week (GDD §5.7). The stored `weekState` is the player's
 * answer; an injury overrides it with **Layoff**, which recovers like Rest.
 * Derived rather than stored, so that clearing an injury hands the dog back whatever the player
 * had already chosen instead of silently leaving it resting.
 */
export function weekStatusOf(d: Dog): WeekStatus {
  return d.injuryWeeks > 0 ? 'layoff' : d.weekState;
}

/** Did this dog actually get a run this weekend? Set to race is not the same as having raced. */
export function ranThisWeek(s: GameState, dogId: Id): boolean {
  return placeThisWeek(s, dogId) !== null;
}

/** Where it finished this weekend, 1-based, or null if it did not run. */
export function placeThisWeek(s: GameState, dogId: Id): number | null {
  if (!s.races) return null;
  for (const r of s.races) {
    const i = r.order.indexOf(dogId);
    if (i >= 0) return i + 1;
  }
  return null;
}

/**
 * What this week does to a dog's fitness (GDD_V3 §4.2, §4.3).
 *
 * A dog that actually **ran** already paid the race's cost on race day, so it gains nothing here.
 * Everything else recovers at the Rest rate, **banded by age**: a five-year-old comes back at 25 and
 * a six- or seven-year-old at 20, against 30 for anything younger (§4.3). That is what makes the
 * retirement window of §2.2 a decision rather than a formality — an old dog is not just slower, it
 * takes longer to be ready again.
 *
 * Layoff recovers like Rest, which is why it is derived rather than stored.
 */
export function restRateFor(age: number): number {
  if (age >= 7) return balance.restAge7;
  if (age === 6) return balance.restAge6;
  if (age === 5) return balance.restAge5;
  return balance.fitnessRest;
}

export function weeklyFitnessDelta(d: Dog, bonus: number, ran: boolean): number {
  if (weekStatusOf(d) === 'race' && ran) return 0;
  return restRateFor(d.age) + bonus + (d.traits.includes('bouncesBack') ? 5 : 0);
}

export function assertPhase(s: GameState, ...phases: Phase[]): void {
  if (!phases.includes(s.phase)) {
    throw new ActionError(`Not allowed in phase ${s.phase}`, { t: 'AdvancePhase' });
  }
}

export function bettingMargin(s: GameState): number {
  return currentPlanet(s).special.bettingMargin ?? balance.bettingMargin;
}

export function maxStakeFraction(s: GameState): number {
  return currentPlanet(s).special.maxStakeFraction ?? balance.maxStakeFraction;
}

/**
 * What a stable may have on one race: a fraction of its cash (GDD_V3 §7.4).
 *
 * ⚠️ **The flat ceiling is gone (BUILD_PLAN_V3 §2.1).** v2 added it because §10 called max stake a
 * rich-get-richer channel and the crook's percentage edge turned that into a real problem — a
 * fractional ceiling cannot bind a rich stable, because it *is* a fraction of a bigger number. v3
 * deletes both halves of that: there is no fixing to earn the percentage and no borrowing to build
 * a bankroll, so §7.4 is explicit that bets are affordable by construction and the fraction is the
 * whole of the rule.
 */
export function maxStakeFor(s: GameState, p: Player): number {
  return Math.floor(p.cash * maxStakeFraction(s));
}

/*
 * ⚠️ **The championship is gone (BUILD_PLAN_V3 §2.1, GDD_V3 V18).** `championshipPoints`,
 * `championshipTable` and the purse they fed lived here. GDD_V3 §2.4 is explicit: net worth is the
 * whole scoring system, the purse paid whoever was already winning (v2 D39), and a multi-season game
 * would have needed a second scoreboard on top of one nobody read. The tie-break it used to share
 * with is kept, on Gold Cup wins.
 */

/**
 * The ten-week circuit (GDD_V3 §2.1).
 *
 * Eight regular planets drawn without replacement from the pool of fourteen, one Major venue at
 * week 5, and Collar Prime at week 10. The card no longer lives on the entry — it is the same three
 * races every weekend (`CARD`), so there is nothing per-week to draw and nothing for the fog to hide
 * about it.
 *
 * ⚠️ **§2.1's own arithmetic does not add up, and this is the reading that does.** It says "9 regular
 * planets drawn without replacement from the pool of 14 … plus Collar Prime at week 10", and then
 * "week 5's Major venue is drawn from the other three Major venues" — which is eleven weekends in a
 * ten-week season. Two of the ten weeks are named (5 and 10), so eight are regular. The parts of
 * §2.1 that are unambiguous are the ones kept; the 9 is the number that has to give. **Flagged for
 * Jesse in the phase notes rather than settled here.**
 */
function buildCalendar(rng: Rng): CalendarEntry[] {
  const majors = rng.shuffle(MAJOR_PLANET_IDS.filter((id) => id !== GRAND_FINAL_PLANET_ID));
  const regulars = rng.shuffle([...REGULAR_PLANET_IDS]).slice(0, balance.regularPlanets);
  const cal: CalendarEntry[] = [];
  let m = 0;
  let r = 0;
  for (let week = 1; week <= balance.weeks; week++) {
    if (week === balance.grandFinalWeek) {
      cal.push({ week, planetId: GRAND_FINAL_PLANET_ID, major: true, grandFinal: true });
    } else if (MAJOR_WEEKS.includes(week)) {
      cal.push({ week, planetId: majors[m++]!, major: true, grandFinal: false });
    } else {
      cal.push({ week, planetId: regulars[r++]!, major: false, grandFinal: false });
    }
  }
  return cal;
}

/** Build week-1 state (phase 'arrival', waiting for the first AdvancePhase). */
export function createSeason(setup: SeasonSetup): GameState {
  if (setup.players.length < 1 || setup.players.length > 8) {
    throw new Error('A season needs 1–8 stables');
  }
  const rng = mulberry32(setup.seed);
  const s: GameState = {
    version: STATE_VERSION,
    seed: setup.seed,
    rng: 0,
    week: 1,
    phase: 'arrival',
    calendar: buildCalendar(rng),
    planet: emptyPlanetState(''),
    players: [],
    turnOrder: [],
    turnOrderReason: {},
    activePlayer: null,
    done: [],
    dogs: {},
    declarations: emptyDeclarations(),
    locked: false,
    fields: null,
    races: null,
    pendingEvent: null,
    eventQueue: [],
    bets: [],
    results: [],
    eventLog: [],
    toggles: {
      betting: true,
      trading: true,
      casualEvents: false,
      ...(setup.toggles ?? {}),
    },
    nextId: 1,
    finalStandings: null,
  };
  s.planet.planetId = s.calendar[0]!.planetId;
  const ctx: Ctx = { s, rng, nextId: (prefix) => `${prefix}_${(s.nextId++).toString(36)}` };
  const usedColours = new Set<number>();
  const aiNames = rng.shuffle([...AI_STABLE_NAMES]);
  setup.players.forEach((ps, i) => {
    let colour = ps.colour ?? i;
    while (usedColours.has(colour)) colour = (colour + 1) % 8;
    usedColours.add(colour);
    const id = `p${i + 1}`;
    const p: Player = {
      id,
      name: ps.name || (ps.kind === 'ai' ? aiNames[i % aiNames.length]! : `Stable ${i + 1}`),
      colour,
      kind: ps.kind,
      cash: balance.startCash,
      dogIds: [],
      cargo: { ...emptyCargo(), [KIBBLE_ID]: balance.startCargo },
      flags: {
        arriveFirstNextWeek: false,
        tipOff: false,
      },
      sponsorWeeks: 0,
      stats: {
        prizeIncome: 0,
        tradeIncome: 0,
        betIncome: 0,
        costs: 0,
        worthByWeek: [],
      },
    };
    if (ps.kind === 'ai') {
      p.difficulty = ps.difficulty ?? 'normal';
      // GDD §14 pairs the line with the stable — "Baroness Vex never borrows" — so key it off
      // the name rather than drawing at random, or Vex gets somebody else's habit every season.
      // AI_PERSONALITIES is written in the same order as AI_STABLE_NAMES.
      const known = AI_STABLE_NAMES.indexOf(p.name);
      p.personality = known >= 0 ? AI_PERSONALITIES[known]! : rng.pick(AI_PERSONALITIES);
    }
    for (let k = 0; k < balance.startDogs; k++) {
      const d = createStartingDog(id, rng, ctx.nextId);
      s.dogs[d.id] = d;
      p.dogIds.push(d.id);
    }
    s.players.push(p);
  });
  return commitCtx(ctx);
}
