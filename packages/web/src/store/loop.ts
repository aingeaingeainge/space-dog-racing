import {
  drive,
  isSeasonOver,
  reduceMut,
  waitingOn,
  type Action,
  type GameState,
  type Id,
  type Player,
} from '@sdr/engine';
import { bookieOpen } from '../lib/selectors';
import type { RoomMeta } from '../../../server/src/protocol';

export interface Applied {
  state: GameState;
  /** Everything applied — ours, the AI's and the system's AdvancePhase — in order. */
  added: Action[];
}

/**
 * The whole game loop in one function. Actions are applied to a *copy* of the state, then the
 * engine drives AI stables and system phases until a human is on the clock again. On an
 * ActionError this throws and the live state is untouched, because it was never the one edited.
 */
export function applyActions(base: GameState, actions: readonly Action[]): Applied {
  const state = structuredClone(base);
  const added: Action[] = [];
  for (const a of actions) {
    reduceMut(state, a);
    added.push(a);
  }
  if (!isSeasonOver(state)) drive(state, added);
  return { state, added };
}

/**
 * The UI's name for this weekend, for its "already watched / already read" marks (GDD_V3 §2.1).
 *
 * ⚠️ **Week numbers repeat once a game runs past one season**, so a mark that said "week 3 watched"
 * would swallow season two's week 3. In season 1 this is the week itself — a one-season game and
 * its saves read exactly as they always did — and from season 2 it is `100 × (season − 1) + week`.
 */
export function weekKey(s: Pick<GameState, 'season' | 'week'>): number {
  return (s.season - 1) * 100 + s.week;
}

export type ScreenKind =
  | 'seasonEnd'
  | 'noHuman'
  | 'bust'
  | 'fields'
  | 'race'
  | 'results'
  | 'arrival'
  | 'board'
  | 'afterRaces'
  | 'pass'
  | 'explore'
  | 'offSeason'
  | 'betting'
  | 'planet'
  /** Online only (§5.1): this seat is not on the clock and has nothing it may do but read. Public. */
  | 'waiting';

export interface ScreenUi {
  /** Week whose races the table has already watched run. */
  racesWatchedWeek: number;
  /** Week whose race results the table has already read. */
  resultsSeenWeek: number;
  /** Week whose locked card has been read, on a weekend with no bookie to show it. */
  fieldsSeenWeek: number;
  /** The human whose "pass the laptop" screen has been acknowledged. */
  passAck: Id | null;
  /** Humans who have been told they are bust. */
  bustAck: Id[];
  /**
   * The last season whose end the table has read (GDD_V3 §2.2). Optional so a caller written before
   * multi-season play — a script, a test — still type-checks; absent reads as "none".
   */
  seasonSeen?: number;
  /**
   * Phase E2, a table of two or more humans only: the weekend whose arrival — the new planet and the
   * turn order — the table has read together, and the weekend whose locked board it has read before
   * the Bookie. Optional, like `seasonSeen`, so a script written before E2 still type-checks.
   */
  arrivalSeenWeek?: number;
  boardSeenWeek?: number;
  /**
   * Phase E2: after the races, the human who asked to go back to the planet to trade before flying
   * on. Everybody else flies on from the table's roll-call without the laptop moving.
   */
  postTrade?: Id | null;
}

export interface Screen {
  kind: ScreenKind;
  /** The human the screen belongs to; null only when no human is left to play. */
  me: Player | null;
}

/**
 * Online (ONLINE_PLAN §6 item 3): the browser's own seat and what the room says about the table.
 * Only the two fields `screenFor` reads, so the loop stays free of the socket.
 */
export interface OnlineSeat {
  seat: Id;
  meta: Pick<RoomMeta, 'clock' | 'queued'> | null;
}

/**
 * Screens that show one human's own business: their door and its card, their market, kennels and
 * Race Office, their bets, their off-season. Every other screen is **public** — the table watches it
 * together — and needs no pass (GDD_V3 §3). A private screen whose owner is not the human who last
 * held the laptop must come after a pass screen: `table-walk.ts` checks exactly that rule, and
 * `season-check` fails on a breach.
 */
export const PRIVATE_SCREENS: ReadonlySet<ScreenKind> = new Set<ScreenKind>([
  'explore',
  'planet',
  'betting',
  'offSeason',
]);

/** Humans at the table, in seating order. */
function tableOf(s: GameState): Player[] {
  return s.players.filter((p) => p.kind === 'human');
}

/**
 * Who sits at the Bookie next (Phase E2). **Betting is taken in any order** (the engine's half is in
 * `placeBet`), so the laptop does not have to move just because the turn order says so: whoever holds
 * it bets first if they still have to, and after that the humans still to bet go in turn order.
 */
export function bookieSitter(s: GameState, holder: Id | null): Player | null {
  const still = s.turnOrder
    .map((id) => s.players.find((p) => p.id === id)!)
    .filter((p) => p.kind === 'human' && !s.done.includes(p.id));
  return still.find((p) => p.id === holder) ?? still[0] ?? null;
}

/**
 * Why the laptop is moving, for the pass screen (GDD_V3 §2.3): what the next human is about to do, and
 * whether the order is the turn order's or anybody's.
 */
export function passReason(s: GameState): string {
  switch (s.phase) {
    case 'explore':
      return 'Explore — one door each, in turn order. Nobody sees anybody else’s door.';
    case 'planetPre':
      return 'Market, Kennels and Race Office — in turn order: the shelf is shared and the declarations are public.';
    case 'betting':
      return 'The Bookie — everybody bets privately, in any order.';
    case 'planetPost':
      return 'After the races — the market again, in turn order.';
    case 'offSeason':
      return 'The off-season — your retirement window and your staff notice.';
    default:
      return '';
  }
}

/**
 * Which screen the one human on the clock should be looking at. Kept out of the components so
 * a whole season can be played headlessly in exactly the order a person would see it.
 */
export function screenFor(s: GameState, ui: ScreenUi, online?: OnlineSeat): Screen {
  if (online) return onlineScreenFor(s, ui, online);
  const table = tableOf(s);
  /** Phase E2: two or more humans round one laptop. One human sees exactly what they always saw. */
  const hotseat = table.length > 1;

  // ⚠️ **There is no going bust to tell anybody about (BUILD_PLAN_V3 §2.1).** The Bust screen and
  // the whole forced-sale cascade behind it are deleted; GDD_V3 pillar 5 is that nobody is out
  // before the end, and §11's replacement failure state is simply ending a season poorer than you
  // started. `ui.bustAck` is left in the store for now because nothing reads it and removing it is
  // a store change rather than a rule change.

  if (isSeasonOver(s)) return { kind: 'seasonEnd', me: null };
  // Between seasons (GDD_V3 §2.2): the table reads how the season ended, together, and then each
  // human has the off-season screen in turn.
  if (s.phase === 'offSeason' && (ui.seasonSeen ?? 0) < s.season)
    return { kind: 'seasonEnd', me: null };
  const waiting = waitingOn(s);
  const me =
    (hotseat && s.phase === 'betting' && s.locked ? bookieSitter(s, ui.passAck) : null) ??
    s.players.find((p) => p.id === waiting) ??
    table[0] ??
    null;
  if (!me) return { kind: 'noHuman', me: null };
  // Races are public: the whole table watches them run, then reads the results, before the
  // laptop moves on to anybody's private business. On a weekend with no bookie the locked card
  // comes first, because otherwise nothing ever shows it.
  const wk = weekKey(s);
  if (s.races && !bookieOpen(s) && ui.fieldsSeenWeek !== wk) return { kind: 'fields', me };
  if (s.races && ui.racesWatchedWeek !== wk) return { kind: 'race', me };
  if (s.races && ui.resultsSeenWeek !== wk) return { kind: 'results', me };
  // Phase E2 — the table's public moments, read together and passed to nobody (GDD_V3 §3):
  if (hotseat) {
    // the new planet and the turn order, once a weekend, before the first door;
    if (s.phase === 'explore' && (ui.arrivalSeenWeek ?? 0) !== wk) return { kind: 'arrival', me };
    // the locked board and the prices, once a weekend, before the first slip;
    if (s.phase === 'betting' && (ui.boardSeenWeek ?? 0) !== wk) return { kind: 'board', me };
    // and after the races, a roll-call in turn order: fly on from here, or take the laptop to trade.
    if (s.phase === 'planetPost' && (ui.postTrade ?? null) !== me.id)
      return { kind: 'afterRaces', me };
  }
  // The pass screen, only when the laptop really moves: never to the human already holding it.
  if (hotseat && ui.passAck !== me.id) return { kind: 'pass', me };
  // GDD_V3 §9.1: a new planet opens on its three doors. A card with a choice waits in EventModal
  // over the hub, so the doors are only the screen while there is a door still to pick.
  if (s.phase === 'explore' && !s.pendingEvent) return { kind: 'explore', me };
  if (s.phase === 'offSeason') return { kind: 'offSeason', me };
  if (s.phase === 'betting') return { kind: 'betting', me };
  return { kind: 'planet', me };
}

/**
 * Is this seat on the clock (§5.1)? The room's `meta.clock` when there is one; without it, what the
 * view itself says: every stable not finished at the Bookie and in the off-season, otherwise the
 * stable whose turn it is.
 */
export function onClock(s: GameState, online: OnlineSeat): boolean {
  if (online.meta) return online.meta.clock.seats.includes(online.seat);
  if ((s.phase === 'betting' && s.locked) || s.phase === 'offSeason')
    return !s.done.includes(online.seat);
  return waitingOn(s) === online.seat;
}

/**
 * **`screenFor` online** (ONLINE_PLAN §6 item 3). One browser, one seat: `me` is always this
 * browser's own stable, and there are **no pass screens** — nobody else ever looks at this screen.
 * The table's public moments (the arrival, the locked board, race day, the results, the season's
 * end) are read by each browser alone, once a weekend, through the same `ui` marks hotseat uses; the
 * after-races roll-call is gone, because each stable flies on from its own screen. A seat that is
 * not on the clock and has nothing it may do sees **`waiting`**, over the hub.
 *
 * What a seat off the clock may still do (§5.1): pick its door early (the room holds it, so the door
 * screen stays up and says so), fly on early after the races (held the same way, from the waiting
 * screen), bet at the Bookie and answer the off-season at once.
 */
function onlineScreenFor(s: GameState, ui: ScreenUi, online: OnlineSeat): Screen {
  if (isSeasonOver(s)) return { kind: 'seasonEnd', me: null };
  if (s.phase === 'offSeason' && (ui.seasonSeen ?? 0) < s.season)
    return { kind: 'seasonEnd', me: null };
  const me = s.players.find((p) => p.id === online.seat) ?? null;
  if (!me) return { kind: 'noHuman', me: null };
  const wk = weekKey(s);
  if (s.races && !bookieOpen(s) && ui.fieldsSeenWeek !== wk) return { kind: 'fields', me };
  if (s.races && ui.racesWatchedWeek !== wk) return { kind: 'race', me };
  if (s.races && ui.resultsSeenWeek !== wk) return { kind: 'results', me };
  const done = s.done.includes(me.id);
  const on = onClock(s, online);
  const mine = s.pendingEvent?.playerId === me.id;
  if (s.phase === 'explore') {
    if ((ui.arrivalSeenWeek ?? 0) !== wk) return { kind: 'arrival', me };
    if (!(me.id in (s.explore?.picks ?? {}))) return { kind: 'explore', me };
    return { kind: mine ? 'planet' : 'waiting', me };
  }
  if (mine) return { kind: 'planet', me };
  if (s.phase === 'betting' && s.locked) {
    if (done) return { kind: 'waiting', me };
    if ((ui.boardSeenWeek ?? 0) !== wk) return { kind: 'board', me };
    return { kind: 'betting', me };
  }
  if (s.phase === 'offSeason') return { kind: done ? 'waiting' : 'offSeason', me };
  if ((s.phase === 'planetPre' || s.phase === 'planetPost') && on && !done)
    return { kind: 'planet', me };
  return { kind: 'waiting', me };
}
