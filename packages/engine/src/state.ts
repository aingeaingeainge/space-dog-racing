import { balance } from './content/balance';
import {
  planetOf,
  GRAND_FINAL_PLANET_ID,
  MAJOR_PLANET_IDS,
  REGULAR_PLANET_IDS,
} from './content/planets';
import { AI_PERSONALITIES, AI_STABLE_NAMES } from './content/names';
import {
  DRAWN_PER_WEEKEND,
  OPEN_TYPE_ID,
  PURSE_BY_TIER,
  RACE_TYPES,
  raceType,
} from './content/raceTypes';
import { createStartingDog, emptyPlanetState, type IdGen } from './economy/market';
import { FIXER_CATCH_MULT } from './content/staff';
import { emptyCargo } from './economy/goods';
import { KIBBLE_ID } from './content/goods';
import { mulberry32, type Rng } from './rng';
import type {
  CalendarEntry,
  Dog,
  GameState,
  GoodTier,
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
export const MAJOR_WEEKS: readonly number[] = [4, 7, 10];

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
 * Fitness a dog gains (or loses) for what it did with its week (GDD §5.7).
 *
 * The vet's contribution arrives as a **number of points** rather than as "have you got one",
 * because the ladder makes three different answers out of one hire: a Rough vet shortens a layoff
 * and adds nothing here, a Proper vet adds 5 and a Prime vet 10 (GDD §8.3).
 *
 * A **race** is charged where it happens, in applyRaceOutcome, so a dog that ran gains nothing
 * more here — it has already paid its 25. A dog *set* to race that never got a run has had the
 * week off whatever the Kennels says, so it takes Rest's recovery; otherwise the friendly
 * "declaring implies racing" rule would quietly punish a stable for pointing a dog at a card
 * that turned out not to want it. **Train** is work rather than rest and pays its own small
 * gain. **Rest** and the imposed **Layoff** both recover in full.
 */
export function weeklyFitnessDelta(d: Dog, vetRestBonus: number, ran: boolean): number {
  const status = weekStatusOf(d);
  if (status === 'race' && ran) return 0;
  if (status === 'train') return balance.fitnessTrain;
  return balance.fitnessRest + vetRestBonus + (d.traits.includes('bouncesBack') ? 5 : 0);
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
 * The **flat** stake ceiling here (GDD §10, §20 Q7), before the fractional one is considered.
 *
 * ⚠️ This is a guard rather than a tuning knob, and §10 says why in one sentence: *"Max stake is a
 * rich-get-richer channel."* §13's edge is a percentage, so its cash value is whatever you can
 * stake — which means the stable already in front earns most from the identical fixer's fee, and a
 * ceiling expressed as a fraction of cash cannot stop that, because it *is* the fraction of a
 * bigger number. A flat ceiling is the only shape that binds a rich stable and leaves a poor one
 * alone.
 *
 * Collar Prime lifts it, and only Collar Prime: §2.1 gives the crook's road "bursts, at the biggest
 * races", and the Grand Final is the one week of the season where letting it have one costs the
 * rest of the design nothing.
 */
export function maxStakeFlat(s: GameState): number {
  return balance.maxStakeFlat * (currentPlanet(s).special.maxStakeFlatMult ?? 1);
}

/** What a stable may have on one race: the fractional ceiling and the flat one, lower wins. */
export function maxStakeFor(s: GameState, p: Player): number {
  return Math.floor(Math.min(p.cash * maxStakeFraction(s), maxStakeFlat(s)));
}

export function dopingCatchRate(s: GameState): number {
  return currentPlanet(s).special.dopingCatch ?? balance.supplementCatchBase;
}

/**
 * How often the stewards notice a bought box or a nobbled dog (GDD §13).
 *
 * Two factors and nothing else: **where you are** — the planet's own row, from Lagrange Lows'
 * 20% to Holy Bark's 60% — and **who did the job**, which is the whole of the Fixer's ladder
 * (D41). Multiplied rather than added, so a careful man is worth more at Cosmodrome than at
 * Lagrange Lows, which is the right way round.
 *
 * ⚠️ **The tier is the job's, not the stable's (E-D45).** It used to be read off `Player.staff`,
 * which was the only shape available while the Fixer was a hire and which quietly assumed a
 * stable's fixing was all done by one man. Per job, it is not: a crook can buy a box from a Rough
 * man on Monday and a nobbling from a careful one three planets later, and each job is priced and
 * risked on its own. So the caller passes the tier off the `Fix`.
 */
export function fixCatchRate(s: GameState, tier: GoodTier): number {
  const base = currentPlanet(s).special.fixCatch ?? balance.fixCatchBase;
  return Math.max(0, Math.min(1, base * FIXER_CATCH_MULT[tier]));
}

/**
 * Championship points as they stand (GDD §4.3, D3): 10 / 6 / 3 / 1 for the first four home in
 * **any** race, all season.
 *
 * ⚠️ **Derived from the race archive rather than stored, and that is the whole implementation
 * note.** `RaceResult` already carries the finishing order and, on each entry, who owned the dog
 * when it ran — so the points are a fact the state already holds, and a field would be a second
 * copy of it to keep honest. Same argument as Phase B's dossier (D36) and for the same payoff:
 * a scoreboard that cannot drift out of step with the results it is a scoreboard of.
 *
 * Local runners score nothing. Points belong to the stable that owned the dog **on the day**, so
 * selling a dog does not sell the points it has already won you.
 */
export function championshipPoints(s: GameState): Record<Id, number> {
  const table = [
    balance.champPoints1,
    balance.champPoints2,
    balance.champPoints3,
    balance.champPoints4,
  ];
  const points: Record<Id, number> = {};
  for (const p of s.players) points[p.id] = 0;
  for (const r of [...s.results, ...(s.races ?? [])]) {
    r.order.slice(0, table.length).forEach((dogId, i) => {
      const e = r.entries.find((x) => x.dogId === dogId);
      if (!e || e.local || e.ownerId === 'local') return;
      if (points[e.ownerId] !== undefined) points[e.ownerId]! += table[i]!;
    });
  }
  return points;
}

/**
 * The championship standings, richest in points first (GDD §4.3).
 *
 * Ties break on the stable id, which is arbitrary and **deliberately** so: it is a function of the
 * state and nothing else, so the same season pays the same purse on every machine. A tie-break
 * that reached for net worth would make the purse depend on the thing it is paid into.
 */
export function championshipTable(s: GameState): { playerId: Id; points: number }[] {
  const points = championshipPoints(s);
  return s.players
    .map((p) => ({ playerId: p.id, points: points[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points || (a.playerId < b.playerId ? -1 : 1));
}

/**
 * This weekend's card (GDD §6.3): two types drawn without replacement from the pool, then The
 * Open, which runs every weekend, last, for the headline money.
 *
 * Drawn here, with the calendar, rather than on arrival — the whole season's cards exist from
 * week 1 so that the fog (§9.3) has something to hide and a dossier something to sell. A type
 * whose `minWeek` has not arrived is simply not in the pool that week, which is how the
 * Consolation stays out of week 1 without a branch.
 */
function drawCard(rng: Rng, week: number): RaceTypeId[] {
  const pool = RACE_TYPES.filter((t) => t.drawn && week >= t.minWeek).map((t) => t.id);
  return [...rng.shuffle(pool).slice(0, DRAWN_PER_WEEKEND), OPEN_TYPE_ID];
}

function buildCalendar(rng: Rng): CalendarEntry[] {
  const majors = rng.shuffle(MAJOR_PLANET_IDS.filter((id) => id !== GRAND_FINAL_PLANET_ID));
  const regulars = rng.shuffle([...REGULAR_PLANET_IDS]).slice(0, balance.weeks - 4);
  const cal: CalendarEntry[] = [];
  let m = 0;
  let r = 0;
  for (let week = 1; week <= balance.weeks; week++) {
    const card = drawCard(rng, week);
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
    fixes: [],
    fixArchive: [],
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
      cargo: { ...emptyCargo(), [KIBBLE_ID]: balance.startCargo },
      staff: [],
      loans: [],
      flags: {
        caughtDoping: false,
        bankrupt: false,
        arriveFirstNextWeek: false,
        rivalTrap8: false,
        tipOff: false,
        fixerBarred: false,
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
