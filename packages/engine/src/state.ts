import { balance } from './content/balance';
import {
  planetOf,
  GRAND_FINAL_PLANET_ID,
  MAJOR_PLANET_IDS,
  REGULAR_PLANET_IDS,
} from './content/planets';
import { AI_PERSONALITIES, AI_STABLE_NAMES } from './content/names';
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
  RaceClass,
  SeasonSetup,
} from './types';
import { ActionError } from './types';

export const STATE_VERSION = 1;
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

/** Purse for a class this week (GDD §5.3, planet purse modifiers). */
export function purseFor(s: GameState, cls: RaceClass): [number, number, number] {
  const e = calendarEntry(s);
  const mult = e.grandFinal ? balance.finalMult : e.major ? balance.majorMult : 1;
  const planetMult = currentPlanet(s).special.purseMult ?? 1;
  const base: [number, number, number] =
    cls === 'bronze'
      ? [balance.purseBronze1, balance.purseBronze2, balance.purseBronze3]
      : cls === 'silver'
        ? [balance.purseSilver1, balance.purseSilver2, balance.purseSilver3]
        : [balance.purseGold1, balance.purseGold2, balance.purseGold3];
  return base.map((x) => Math.round(x * mult * planetMult)) as [number, number, number];
}

export function ratingCap(cls: RaceClass): number {
  return cls === 'bronze' ? balance.capBronze : cls === 'silver' ? balance.capSilver : 99;
}

export function eligible(d: Dog, cls: RaceClass): boolean {
  return d.rating <= ratingCap(cls) && d.injuryWeeks === 0 && d.banWeeks === 0;
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

function buildCalendar(rng: Rng): CalendarEntry[] {
  const majors = rng.shuffle(MAJOR_PLANET_IDS.filter((id) => id !== GRAND_FINAL_PLANET_ID));
  const regulars = rng.shuffle([...REGULAR_PLANET_IDS]).slice(0, balance.weeks - 4);
  const cal: CalendarEntry[] = [];
  let m = 0;
  let r = 0;
  for (let week = 1; week <= balance.weeks; week++) {
    if (week === balance.weeks) {
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
    declarations: { bronze: {}, silver: {}, gold: {} },
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
