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
  | 'pass'
  | 'explore'
  | 'betting'
  | 'planet';

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
}

export interface Screen {
  kind: ScreenKind;
  /** The human the screen belongs to; null only when no human is left to play. */
  me: Player | null;
}

/**
 * Which screen the one human on the clock should be looking at. Kept out of the components so
 * a whole season can be played headlessly in exactly the order a person would see it.
 */
export function screenFor(s: GameState, ui: ScreenUi): Screen {
  const table = s.players.filter((p) => p.kind === 'human');

  // ⚠️ **There is no going bust to tell anybody about (BUILD_PLAN_V3 §2.1).** The Bust screen and
  // the whole forced-sale cascade behind it are deleted; GDD_V3 pillar 5 is that nobody is out
  // before the end, and §11's replacement failure state is simply ending a season poorer than you
  // started. `ui.bustAck` is left in the store for now because nothing reads it and removing it is
  // a store change rather than a rule change.

  if (isSeasonOver(s)) return { kind: 'seasonEnd', me: null };
  const waiting = waitingOn(s);
  const me = s.players.find((p) => p.id === waiting) ?? table[0] ?? null;
  if (!me) return { kind: 'noHuman', me: null };
  // Races are public: the whole table watches them run, then reads the results, before the
  // laptop moves on to anybody's private business. On a weekend with no bookie the locked card
  // comes first, because otherwise nothing ever shows it.
  const wk = weekKey(s);
  if (s.races && !bookieOpen(s) && ui.fieldsSeenWeek !== wk) return { kind: 'fields', me };
  if (s.races && ui.racesWatchedWeek !== wk) return { kind: 'race', me };
  if (s.races && ui.resultsSeenWeek !== wk) return { kind: 'results', me };
  if (table.length > 1 && ui.passAck !== me.id) return { kind: 'pass', me };
  // GDD_V3 §9.1: a new planet opens on its three doors. A card with a choice waits in EventModal
  // over the hub, so the doors are only the screen while there is a door still to pick.
  if (s.phase === 'explore' && !s.pendingEvent) return { kind: 'explore', me };
  if (s.phase === 'betting') return { kind: 'betting', me };
  return { kind: 'planet', me };
}
