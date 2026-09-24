/**
 * A hotseat table walked headlessly (Phase E2, GDD_V3 §2.3, §3): N humans round one laptop, playing
 * through `store/loop.ts` and `screenFor` exactly as App.tsx does, pressing only what the screens
 * offer. It counts what a table pays for sharing one screen — **pass screens a weekend** and **presses
 * a human a weekend** — and it checks the one privacy rule the hotseat loop has to keep:
 *
 * > **Nobody sees another human's private screen without a pass in between.** Stated about
 * > `screenFor`: whenever the owner of a private screen changes, a pass screen came first. Public
 * > screens (the race view, the results, the season's end, the table's roll-calls) are watched by
 * > everybody and neither need a pass nor break the chain.
 *
 * Used by `hub-clicks` (the numbers) and `season-check` (the rule). Not a test of play quality: the
 * humans play a plain line — a door a week, a crate of staple when short, the best three dogs
 * declared, a small bet on each favourite — because the question is how many times the laptop moves,
 * not how well anybody plays.
 */
import {
  aiChoiceFor,
  cargoTotal,
  createSeason,
  drive,
  HOLD_CAP,
  maxStakeFor,
  raceType,
  STAPLE_ID,
  thisWeeksCard,
  type Action,
  type Dog,
  type GameLength,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
  type SeasonSetup,
} from '@sdr/engine';
import {
  applyActions,
  PRIVATE_SCREENS,
  screenFor,
  weekKey,
  type ScreenUi,
} from '../src/store/loop';

export interface TableWalk {
  humans: number;
  weekends: number;
  /** Pass screens shown, across the game. */
  passes: number;
  /** Presses each human made: every action they sent, and the "I am <name>" on their pass screen. */
  presses: Record<Id, number>;
  /** Presses on public screens — the races, the results, the season's end — made once for the table. */
  tablePresses: number;
  /** Private screens shown to a human who had not been passed the laptop. Must be empty. */
  leaks: string[];
  /** Screens seen, by kind. */
  screens: Record<string, number>;
  state: GameState;
  log: Action[];
}

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

/** Market, Kennels and Race Office: two weeks of staple if short, then the best three declared. */
function planetTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  const dogs = ownDogs(s, p);
  if (s.phase === 'planetPre') {
    if (s.toggles.trading && p.cargo[STAPLE_ID] < dogs.length * 2) {
      const units = Math.min(
        HOLD_CAP - cargoTotal(p.cargo),
        dogs.length * 2,
        s.planet.goods[STAPLE_ID].stock,
        Math.floor(Math.max(0, p.cash - 1500) / Math.max(1, s.planet.goods[STAPLE_ID].buy)),
      );
      if (units > 0) out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units });
    }
    const taken = new Set<Id>();
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
  if (s.phase === 'planetPost' && s.toggles.trading && p.cargo[STAPLE_ID] > 0)
    // Back at the planet after the races: sell a crate, which is why anybody comes back.
    out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units: -1 });
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/** The Bookie: 100 on each race's favourite, inside the cap. */
function bettingTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  let cash = p.cash;
  for (const { race, entries } of s.fields ?? []) {
    const cap = Math.min(maxStakeFor(s, { ...p, cash }), Math.floor(cash));
    const fav = [...entries].sort((a, b) => b.winProb - a.winProb)[0];
    if (!fav || cap < 100) continue;
    out.push({ t: 'PlaceBet', playerId: p.id, race, dogId: fav.dogId, kind: 'win', stake: 100 });
    cash -= 100;
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/** The off-season: keep them all, take a candidate, on to the next season. */
function offSeasonPress(s: GameState, me: Player): Action {
  const n = s.offSeason!.notices[me.id]!;
  if (n.retired === undefined) return { t: 'Retire', playerId: me.id, dogId: null };
  if (n.candidate && n.hired === undefined)
    return { t: 'ResolveStaffNotice', playerId: me.id, hire: true };
  return { t: 'EndPhase', playerId: me.id };
}

export interface WalkOptions {
  length?: GameLength;
  /** After the races, does this human take the laptop back to trade? Never, unless a caller says. */
  tradeAfterRaces?: (s: GameState, me: Player) => boolean;
  /** Called on every screen, before it is answered — for a caller with a check of its own. */
  onScreen?: (s: GameState, ui: ScreenUi, kind: string) => void;
}

export function walkTable(
  seed: number,
  humans: number,
  ais: number,
  opts: WalkOptions = {},
): TableWalk {
  const { length } = opts;
  const setup: SeasonSetup = {
    seed,
    ...(length ? { length } : {}),
    players: [
      ...Array.from({ length: humans }, (_, i) => ({
        name: `Human ${i + 1}`,
        kind: 'human' as const,
      })),
      ...Array.from({ length: ais }, () => ({
        name: '',
        kind: 'ai' as const,
        difficulty: 'normal' as const,
      })),
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
    seasonSeen: 0,
  };
  const walk: TableWalk = {
    humans,
    weekends: 0,
    passes: 0,
    presses: Object.fromEntries(
      state.players.filter((p) => p.kind === 'human').map((p) => [p.id, 0]),
    ),
    tablePresses: 0,
    leaks: [],
    screens: {},
    state,
    log,
  };
  /** The human whose private screen was last on the laptop, and whether a pass has come since. */
  let holder: Id | null = null;
  let passedSince = false;

  const send = (who: Id, actions: Action[]) => {
    const applied = applyActions(state, actions);
    if (applied.state.activePlayer !== state.activePlayer) ui.postTrade = null;
    state = applied.state;
    log.push(...applied.added);
    walk.presses[who] = (walk.presses[who] ?? 0) + actions.length;
  };

  for (let step = 0; step < 400000; step++) {
    const screen = screenFor(state, ui);
    walk.screens[screen.kind] = (walk.screens[screen.kind] ?? 0) + 1;
    opts.onScreen?.(state, ui, screen.kind);
    if (screen.kind === 'seasonEnd') {
      walk.tablePresses++;
      if (state.phase !== 'offSeason') break;
      ui.seasonSeen = state.season;
      continue;
    }
    if (screen.kind === 'noHuman') throw new Error(`seed ${seed}: no human at the table`);
    const me = screen.me!;
    if (PRIVATE_SCREENS.has(screen.kind)) {
      if (holder !== null && holder !== me.id && !passedSince)
        walk.leaks.push(
          `season ${state.season} week ${state.week}: ${me.name}'s ${screen.kind} screen followed ${holder}'s with no pass`,
        );
      holder = me.id;
      passedSince = false;
    }
    switch (screen.kind) {
      case 'race':
        walk.tablePresses++;
        ui.racesWatchedWeek = weekKey(state);
        continue;
      case 'fields':
        walk.tablePresses++;
        ui.fieldsSeenWeek = weekKey(state);
        continue;
      case 'results':
        // The results screen's "Fly on" is the active stable's, when it has nothing to do after the
        // races (Phase D1) — and this line never does. At a hotseat table the results are public and
        // the roll-call after them does the flying (Phase E2).
        walk.tablePresses++;
        ui.resultsSeenWeek = weekKey(state);
        if (humans < 2 && state.phase === 'planetPost' && state.activePlayer === me.id)
          send(me.id, [{ t: 'EndPhase', playerId: me.id }]);
        continue;
      case 'arrival':
      case 'board':
        // Phase E2: a public moment whose button is the pass when the laptop has to move.
        if (screen.kind === 'arrival') ui.arrivalSeenWeek = weekKey(state);
        else ui.boardSeenWeek = weekKey(state);
        if (ui.passAck === me.id) {
          walk.tablePresses++;
          continue;
        }
        walk.passes++;
        walk.presses[me.id] = (walk.presses[me.id] ?? 0) + 1;
        ui.passAck = me.id;
        passedSince = true;
        continue;
      case 'afterRaces':
        // The roll-call after the races: fly on in public, or take the laptop back to trade.
        if (opts.tradeAfterRaces?.(state, me)) {
          walk.presses[me.id] = (walk.presses[me.id] ?? 0) + 1;
          ui.postTrade = me.id;
          continue;
        }
        send(me.id, [{ t: 'EndPhase', playerId: me.id }]);
        continue;
      case 'pass':
        walk.passes++;
        walk.presses[me.id] = (walk.presses[me.id] ?? 0) + 1;
        ui.passAck = me.id;
        passedSince = true;
        continue;
      case 'bust':
        ui.bustAck = [...ui.bustAck, me.id];
        continue;
      case 'offSeason':
        send(me.id, [offSeasonPress(state, me)]);
        continue;
      case 'explore':
        send(me.id, [{ t: 'ChooseDoor', playerId: me.id, door: state.week % 3 }]);
        continue;
      case 'betting':
        send(me.id, bettingTurn(state, me));
        continue;
      default:
        if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
          send(me.id, [{ t: 'ResolveEvent', playerId: me.id, choice: aiChoiceFor(state, me.id) }]);
          continue;
        }
        send(me.id, planetTurn(state, me));
    }
  }
  if (state.phase !== 'seasonEnd') throw new Error(`seed ${seed}: the game never ended`);
  walk.state = state;
  walk.weekends = state.seasons.reduce((n, r) => n + r.weeks, 0);
  return walk;
}
