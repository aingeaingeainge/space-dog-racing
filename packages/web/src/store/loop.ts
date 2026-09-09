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

export type ScreenKind =
  | 'seasonEnd'
  | 'noHuman'
  | 'bust'
  | 'fields'
  | 'race'
  | 'results'
  | 'pass'
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

  /**
   * Going bust is told to your face, and it is checked before the season is over because that is
   * usually the same instant. `nextLivePlayer` skips a bankrupt stable, so the moment the last
   * human goes under, `drive` plays every remaining week against the AI and hands back a finished
   * season — which is how a bankrupt human used to go from week five to the podium with nothing in
   * between ever saying why.
   */
  const bust = table.find((p) => p.flags.bankrupt && !ui.bustAck.includes(p.id));
  if (bust) return { kind: 'bust', me: bust };

  if (isSeasonOver(s)) return { kind: 'seasonEnd', me: null };
  const waiting = waitingOn(s);
  const me = s.players.find((p) => p.id === waiting) ?? table[0] ?? null;
  if (!me) return { kind: 'noHuman', me: null };
  // Races are public: the whole table watches them run, then reads the results, before the
  // laptop moves on to anybody's private business. On a weekend with no bookie the locked card
  // comes first, because otherwise nothing ever shows it.
  if (s.races && !bookieOpen(s) && ui.fieldsSeenWeek !== s.week) return { kind: 'fields', me };
  if (s.races && ui.racesWatchedWeek !== s.week) return { kind: 'race', me };
  if (s.races && ui.resultsSeenWeek !== s.week) return { kind: 'results', me };
  if (table.length > 1 && ui.passAck !== me.id) return { kind: 'pass', me };
  if (s.phase === 'betting') return { kind: 'betting', me };
  return { kind: 'planet', me };
}
