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
  | 'results'
  | 'pass'
  | 'betting'
  | 'planet';

export interface ScreenUi {
  /** Week whose race results the table has already watched. */
  resultsSeenWeek: number;
  /** The human whose "pass the laptop" screen has been acknowledged. */
  passAck: Id | null;
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
  if (isSeasonOver(s)) return { kind: 'seasonEnd', me: null };
  const table = s.players.filter((p) => p.kind === 'human');
  const waiting = waitingOn(s);
  const me = s.players.find((p) => p.id === waiting) ?? table[0] ?? null;
  if (!me) return { kind: 'noHuman', me: null };
  // Results are public: the whole table watches them before the laptop moves on.
  if (s.races && ui.resultsSeenWeek !== s.week) return { kind: 'results', me };
  if (table.length > 1 && ui.passAck !== me.id) return { kind: 'pass', me };
  if (s.phase === 'betting') return { kind: 'betting', me };
  return { kind: 'planet', me };
}
