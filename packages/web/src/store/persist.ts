import type { Action, SeasonSetup } from '@sdr/engine';

/**
 * The save file is the seed plus the action log — never the derived state (CLAUDE.md).
 * `setup` carries the seed and the table of stables, which is everything createSeason needs;
 * replaying the log on top of that reproduces the season exactly on any machine.
 */
export interface SaveUi {
  resultsSeenWeek: number;
  /**
   * Week whose races have been watched, and how fast the player likes to watch them. Both are
   * UI-only — they never enter GameState — and both are optional so a save written before the
   * race view still loads. That is why SAVE_VERSION has not moved.
   */
  racesWatchedWeek?: number;
  raceSpeed?: number;
  /** Week whose locked card has been read on a no-bookie weekend, and who has been told they are
   * bust. Both optional for the same reason as the two above: an M3 save must still load. */
  fieldsSeenWeek?: number;
  bustAck?: string[];
}

export interface SaveBlob {
  v: number;
  setup: SeasonSetup;
  log: Action[];
  ui: SaveUi;
}

/**
 * 2 for v2 Phase A. The blob itself is unchanged in shape — it is still seed + action log — but
 * the log is no longer replayable: `SetTraining` is not an action any more, and every rule the
 * log's outcomes depended on has moved. A v1 save now fails the version check in `readSave`,
 * which returns null, which lands the player on the title screen with a new season rather than
 * half a season that no longer means what it meant.
 */
export const SAVE_VERSION = 2;
const KEY = 'sdr.save.v1';

export function writeSave(blob: SaveBlob): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    // A full or blocked localStorage must never break the game in progress.
  }
}

export function readSave(): SaveBlob | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as SaveBlob;
    if (blob.v !== SAVE_VERSION || !blob.setup || !Array.isArray(blob.log)) return null;
    return blob;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
