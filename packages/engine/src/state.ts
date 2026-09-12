import { balance } from './content/balance';
import {
  planetOf,
  GRAND_FINAL_PLANET_ID,
  MAJOR_PLANET_IDS,
  REGULAR_PLANET_IDS,
} from './content/planets';
import { AI_PERSONALITIES, AI_STABLE_NAMES } from './content/names';
import { PURSE_BY_TIER, raceType } from './content/raceTypes';
import { createStartingDog, emptyPlanetState, type IdGen } from './economy/market';
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
 * 3 for v2 Phase B: a race is a row rather than one of three classes, so `Declare` and
 * `PlaceBet` carry a `RaceTypeId`, `Bet` and `RaceResult` store one, and declarations, fields
 * and races have all changed shape. A Phase A log cannot replay on this engine.
 *
 * The web save is seed + log (store/persist.ts), which is why SAVE_VERSION moves with it and an
 * old save fails soft to the title screen rather than replaying into a different game.
 */
export const STATE_VERSION = 3;
export const MAJOR_WEEKS: readonly number[] = [4, 7, 10];

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

/** This weekend's three races, in the order they are run (GDD §6.3). */
export function thisWeeksCard(s: GameState, week = s.week): readonly RaceTypeId[] {
  return calendarEntry(s, week).card;
}

/** An empty declaration book: every race type is a key, and most weeks most of them stay empty. */
export function emptyDeclarations(): Record<RaceTypeId, Record<Id, Id>> {
  return Object.fromEntries(RACE_TYPE_IDS.map((id) => [id, {}])) as Record<
    RaceTypeId,
    Record<Id, Id>
  >;
}

/** Purse for one race this week (GDD §6.4, planet purse modifiers). */
export function purseFor(s: GameState, race: RaceTypeId): [number, number, number] {
  const e = calendarEntry(s);
  const mult = e.grandFinal ? balance.finalMult : e.major ? balance.majorMult : 1;
  const planetMult = currentPlanet(s).special.purseMult ?? 1;
  const base = PURSE_BY_TIER[raceType(race).tier];
  return base.map((x) => Math.round(x * mult * planetMult)) as [number, number, number];
}

/**
 * May this dog take a trap in this race? Two halves that are deliberately separate: the race's
 * own entry criterion, which is the row's business (GDD §6.3), and the two conditions that bar a
 * dog from every race there is. Locals answer the first half and skip the second — they are
 * generated sound.
 */
export function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && d.banWeeks === 0 && raceType(race).eligible(d);
}

/**
 * What a dog is actually doing this week (GDD §5.7). The stored `weekState` is the player's
 * answer; an injury or a stewards' ban overrides it with **Layoff**, which recovers like Rest.
 * Derived rather than stored, so that clearing an injury hands the dog back whatever the player
 * had already chosen instead of silently leaving it resting.
 */
export function weekStatusOf(d: Dog): WeekStatus {
  return d.injuryWeeks > 0 || d.banWeeks > 0 ? 'layoff' : d.weekState;
}

/** Did this dog actually get a run this weekend? Set to race is not the same as having raced. */
export function ranThisWeek(s: GameState, dogId: Id): boolean {
  if (!s.races) return false;
  for (const r of s.races) if (r.order.includes(dogId)) return true;
  return false;
}

/**
 * Fitness a dog gains (or loses) for what it did with its week (GDD §5.7).
 *
 * A **race** is charged where it happens, in applyRaceOutcome, so a dog that ran gains nothing
 * more here — it has already paid its 25. A dog *set* to race that never got a run has had the
 * week off whatever the Kennels says, so it takes Rest's recovery; otherwise the friendly
 * "declaring implies racing" rule would quietly punish a stable for pointing a dog at a card
 * that turned out not to want it. **Train** is work rather than rest and pays its own small
 * gain. **Rest** and the imposed **Layoff** both recover in full.
 */
export function weeklyFitnessDelta(d: Dog, hasVet: boolean, ran: boolean): number {
  const status = weekStatusOf(d);
  if (status === 'race' && ran) return 0;
  if (status === 'train') return balance.fitnessTrain;
  const rest = hasVet ? balance.fitnessRestVet : balance.fitnessRest;
  return rest + (d.traits.includes('bouncesBack') ? 5 : 0);
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

export function dopingCatchRate(s: GameState): number {
  return currentPlanet(s).special.dopingCatch ?? balance.supplementCatchBase;
}

/**
 * This weekend's card. Fixed to the three classes while the shape lands, so the season plays
 * exactly as it did; the draw from the pool arrives with the seven types (GDD §6.3).
 */
function drawCard(): RaceTypeId[] {
  return [...RACE_TYPE_IDS];
}

function buildCalendar(rng: Rng): CalendarEntry[] {
  const majors = rng.shuffle(MAJOR_PLANET_IDS.filter((id) => id !== GRAND_FINAL_PLANET_ID));
  const regulars = rng.shuffle([...REGULAR_PLANET_IDS]).slice(0, balance.weeks - 4);
  const cal: CalendarEntry[] = [];
  let m = 0;
  let r = 0;
  for (let week = 1; week <= balance.weeks; week++) {
    const card = drawCard();
    if (week === balance.weeks) {
      cal.push({ week, planetId: GRAND_FINAL_PLANET_ID, major: true, grandFinal: true, card });
    } else if (MAJOR_WEEKS.includes(week)) {
      cal.push({ week, planetId: majors[m++]!, major: true, grandFinal: false, card });
    } else {
      cal.push({ week, planetId: regulars[r++]!, major: false, grandFinal: false, card });
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
      cleanSport: false,
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
      kennelSlots: balance.kennelSlotsStart,
      ship: {
        speed: balance.shipStartSpeed,
        cargoCap: balance.cargoCapStart,
        coldStore: false,
        upgradesPaid: 0,
      },
      cargo: balance.startCargo,
      staff: {},
      loans: [],
      flags: {
        caughtDoping: false,
        bankrupt: false,
        arriveFirstNextWeek: false,
        rivalTrap8: false,
        tipOff: false,
      },
      sponsorWeeks: 0,
      stats: {
        prizeIncome: 0,
        tradeIncome: 0,
        betIncome: 0,
        costs: 0,
        dogsBought: 0,
        dogsSold: 0,
        supplementsUsed: 0,
        supplementsCaught: 0,
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
