import { create } from 'zustand';
import {
  createSeason,
  drive,
  replay,
  waitingOn,
  type Action,
  type GameState,
  type Id,
  type SeasonSetup,
} from '@sdr/engine';
import { clearSave, readSave, writeSave, SAVE_VERSION, type SaveBlob } from './persist';
import { applyActions } from './loop';

/** Where the human is looking during their own phase. Never part of game state. */
export type View = 'hub' | 'stable' | 'office' | 'map';

export interface GameStore {
  setup: SeasonSetup | null;
  state: GameState | null;
  log: Action[];
  error: string | null;
  view: View;
  leaderboard: boolean;
  /** Week whose race results the table has already watched. UI only. */
  resultsSeenWeek: number;
  /** The human whose "pass the laptop" screen has been acknowledged. */
  passAck: Id | null;
  hasSave: boolean;

  newSeason: (setup: SeasonSetup) => void;
  resume: () => void;
  abandon: () => void;
  dispatch: (...actions: Action[]) => void;
  setView: (view: View) => void;
  setLeaderboard: (open: boolean) => void;
  ackResults: () => void;
  ackPass: (playerId: Id) => void;
  clearError: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  setup: null,
  state: null,
  log: [],
  error: null,
  view: 'hub',
  leaderboard: false,
  resultsSeenWeek: 0,
  passAck: null,
  hasSave: readSave() !== null,

  newSeason: (setup) => {
    const state = createSeason(setup);
    const log: Action[] = [];
    // Run AI stables and system phases until a human is on the clock.
    drive(state, log);
    writeSave({ v: SAVE_VERSION, setup, log, ui: { resultsSeenWeek: 0 } });
    set({
      setup,
      state,
      log,
      error: null,
      view: 'hub',
      leaderboard: false,
      resultsSeenWeek: 0,
      passAck: null,
      hasSave: true,
    });
  },

  resume: () => {
    const blob: SaveBlob | null = readSave();
    if (!blob) {
      set({ error: 'No saved season found.', hasSave: false });
      return;
    }
    try {
      const state = replay(createSeason(blob.setup), blob.log);
      set({
        setup: blob.setup,
        state,
        log: blob.log,
        error: null,
        view: 'hub',
        leaderboard: false,
        resultsSeenWeek: blob.ui?.resultsSeenWeek ?? 0,
        passAck: null,
        hasSave: true,
      });
    } catch (e) {
      set({ error: `That save could not be replayed: ${(e as Error).message}` });
    }
  },

  abandon: () => {
    clearSave();
    set({ setup: null, state: null, log: [], error: null, hasSave: false, passAck: null });
  },

  /**
   * Send actions to the engine and store what comes back. The log — ours, the AI's and the
   * system's AdvancePhase — is the save file. On an ActionError nothing is kept, because the
   * live state was never the copy that was edited.
   */
  dispatch: (...actions) => {
    const { state, log, setup, resultsSeenWeek } = get();
    if (!state || !setup) return;
    const beforeWeek = state.week;
    const beforePhase = state.phase;
    const beforeWho = waitingOn(state);
    try {
      const { state: next, added } = applyActions(state, actions);
      const nextLog = [...log, ...added];
      writeSave({ v: SAVE_VERSION, setup, log: nextLog, ui: { resultsSeenWeek } });
      const moved =
        next.week !== beforeWeek || next.phase !== beforePhase || waitingOn(next) !== beforeWho;
      set({
        state: next,
        log: nextLog,
        error: null,
        hasSave: true,
        ...(moved ? { view: 'hub' as View } : {}),
      });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  setView: (view) => set({ view }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  ackResults: () => {
    const { state, setup, log } = get();
    const week = state?.week ?? 0;
    if (setup) writeSave({ v: SAVE_VERSION, setup, log, ui: { resultsSeenWeek: week } });
    set({ resultsSeenWeek: week });
  },

  ackPass: (playerId) => set({ passAck: playerId }),
  clearError: () => set({ error: null }),
}));
