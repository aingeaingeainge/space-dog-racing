import type { Action, SeasonSetup } from '@sdr/engine';

/**
 * The save file is the seed plus the action log — never the derived state (CLAUDE.md).
 * `setup` carries the seed and the table of stables, which is everything createSeason needs;
 * replaying the log on top of that reproduces the season exactly on any machine.
 */
export interface SaveBlob {
  v: number;
  setup: SeasonSetup;
  log: Action[];
  ui: { resultsSeenWeek: number };
}

export const SAVE_VERSION = 1;
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
