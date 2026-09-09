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
import { clearSave, readSave, writeSave, SAVE_VERSION, type SaveUi } from './persist';
import { applyActions } from './loop';

/** Where the human is looking during their own phase. Never part of game state. */
export type View = 'hub' | 'stable' | 'market' | 'docks' | 'saloon' | 'office' | 'map';

/** How fast the race view replays a tick log. Remembered for the rest of the session. */
export type RaceSpeed = 1 | 2;

export interface GameStore {
  setup: SeasonSetup | null;
  state: GameState | null;
  log: Action[];
  error: string | null;
  view: View;
  leaderboard: boolean;
  /** Week whose races the table has already watched run. UI only. */
  racesWatchedWeek: number;
  /** Week whose race results the table has already read. UI only. */
  resultsSeenWeek: number;
  /** 1× or 2×. UI only. */
  raceSpeed: RaceSpeed;
  /** The human whose "pass the laptop" screen has been acknowledged. */
  passAck: Id | null;
  hasSave: boolean;

  newSeason: (setup: SeasonSetup) => void;
  /** The same table and the same seed, from week 1 (GDD §15.11). */
  playAgain: () => void;
  resume: () => void;
  abandon: () => void;
  dispatch: (...actions: Action[]) => void;
  setView: (view: View) => void;
  setLeaderboard: (open: boolean) => void;
  setRaceSpeed: (speed: RaceSpeed) => void;
  ackRaces: () => void;
  ackResults: () => void;
  ackPass: (playerId: Id) => void;
  clearError: () => void;
}

export const useGame = create<GameStore>((set, get) => {
  /** The UI-only half of the save file, gathered in one place so no writer drops a field. */
  function ui(over?: Partial<SaveUi>): SaveUi {
    const g = get();
    return {
      resultsSeenWeek: g.resultsSeenWeek,
      racesWatchedWeek: g.racesWatchedWeek,
      raceSpeed: g.raceSpeed,
      ...over,
    };
  }

  function save(over?: Partial<SaveUi>, log?: Action[]): void {
    const g = get();
    if (!g.setup) return;
    writeSave({ v: SAVE_VERSION, setup: g.setup, log: log ?? g.log, ui: ui(over) });
  }

  return {
    setup: null,
    state: null,
    log: [],
    error: null,
    view: 'hub',
    leaderboard: false,
    racesWatchedWeek: 0,
    resultsSeenWeek: 0,
    raceSpeed: 2,
    passAck: null,
    hasSave: readSave() !== null,

    newSeason: (setup) => {
      const state = createSeason(setup);
      const log: Action[] = [];
      // Run AI stables and system phases until a human is on the clock.
      drive(state, log);
      const speed = get().raceSpeed;
      writeSave({
        v: SAVE_VERSION,
        setup,
        log,
        ui: { resultsSeenWeek: 0, racesWatchedWeek: 0, raceSpeed: speed },
      });
      set({
        setup,
        state,
        log,
        error: null,
        view: 'hub',
        leaderboard: false,
        racesWatchedWeek: 0,
        resultsSeenWeek: 0,
        passAck: null,
        hasSave: true,
      });
    },

    /**
     * Play the season again. A season *is* (setup + log), so the same setup replayed from an empty
     * log is the same season — there is no new mechanism here and nothing to seed twice. The
     * finished log goes, which is what makes this different from `resume`.
     */
    playAgain: () => {
      const { setup, newSeason } = get();
      if (!setup) return;
      newSeason(setup);
    },

    resume: () => {
      const blob = readSave();
      if (!blob) {
        set({ error: 'No saved season found.', hasSave: false });
        return;
      }
      try {
        const state = replay(createSeason(blob.setup), blob.log);
        // A reload never costs the player a re-watch: if the week's races are still live but the
        // save does not say they were watched, fail soft to the results rather than replaying
        // three races the table may already have seen.
        const watched = state.races
          ? Math.max(blob.ui?.racesWatchedWeek ?? 0, state.week)
          : (blob.ui?.racesWatchedWeek ?? 0);
        const speed: RaceSpeed = blob.ui?.raceSpeed === 1 ? 1 : 2;
        set({
          setup: blob.setup,
          state,
          log: blob.log,
          error: null,
          view: 'hub',
          leaderboard: false,
          racesWatchedWeek: watched,
          resultsSeenWeek: blob.ui?.resultsSeenWeek ?? 0,
          raceSpeed: speed,
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
      const { state, log, setup } = get();
      if (!state || !setup) return;
      const beforeWeek = state.week;
      const beforePhase = state.phase;
      const beforeWho = waitingOn(state);
      try {
        const { state: next, added } = applyActions(state, actions);
        const nextLog = [...log, ...added];
        save(undefined, nextLog);
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

    setRaceSpeed: (raceSpeed) => {
      set({ raceSpeed });
      save({ raceSpeed });
    },

    ackRaces: () => {
      const week = get().state?.week ?? 0;
      set({ racesWatchedWeek: week });
      save({ racesWatchedWeek: week });
    },

    ackResults: () => {
      const week = get().state?.week ?? 0;
      set({ resultsSeenWeek: week });
      save({ resultsSeenWeek: week });
    },

    ackPass: (playerId) => set({ passAck: playerId }),
    clearError: () => set({ error: null }),
  };
});
