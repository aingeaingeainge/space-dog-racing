import type { ScreenKind } from '../store/loop';

/**
 * Phase E2 — **the pace timer**, a UI-only record of how long a game took at the table, kept in the
 * save's `ui` block and never in game state. ⚠️ Wall-clock time must never reach the engine or the
 * action log: a season is seed + log, and a clock in either would make the same log mean different
 * games. This module is the only place the game reads the clock, and only the store calls it.
 *
 * It answers BUILD_PLAN_V3 Phase E's four 🎲 rows — a four-human season in 25 minutes with the races
 * skipped, 40 watched, eight humans in 70 — which need people in a room and a clock nobody has to
 * remember to start.
 */

/** Where a second went. */
export type PaceBucket = 'private' | 'raceDay' | 'pass' | 'table';

/** One weekend, arrival to "Fly on", in seconds on each kind of screen. */
export interface PaceWeekend {
  /** `weekKey` of the weekend: the week in season 1, `100 × (season − 1) + week` after it. */
  key: number;
  private: number;
  raceDay: number;
  pass: number;
  table: number;
}

export interface Pace {
  weekends: PaceWeekend[];
  /** Seconds between seasons: the season's end and the off-season screens. */
  between: number;
}

export const EMPTY_PACE: Pace = { weekends: [], between: 0 };

/**
 * One stretch on a screen is counted up to ten minutes. A laptop left open over dinner is not the game
 * being slow, and the record should not say it was.
 */
export const PACE_CAP_S = 600;

/** Which bucket a screen's time goes in. The Explore door, the hub, the Bookie: private. */
export function bucketOf(kind: ScreenKind): PaceBucket | 'between' | null {
  switch (kind) {
    case 'explore':
    case 'planet':
    case 'betting':
      return 'private';
    case 'race':
    case 'results':
    case 'fields':
      return 'raceDay';
    case 'pass':
      return 'pass';
    case 'arrival':
    case 'board':
    case 'afterRaces':
      return 'table';
    case 'offSeason':
      return 'between';
    default:
      // The season's end is 'between' when a season ends into the next; the game's end, the title
      // and a table with nobody to play are not the game being played.
      return null;
  }
}

/** Add `seconds` on a screen of `bucket` to the weekend `key`. Returns a new record. */
export function addPace(
  pace: Pace,
  key: number,
  bucket: PaceBucket | 'between',
  seconds: number,
): Pace {
  const s = Math.max(0, Math.min(PACE_CAP_S, seconds));
  if (!s) return pace;
  if (bucket === 'between') return { ...pace, between: pace.between + s };
  const weekends = [...pace.weekends];
  let i = weekends.findIndex((w) => w.key === key);
  if (i < 0) {
    weekends.push({ key, private: 0, raceDay: 0, pass: 0, table: 0 });
    i = weekends.length - 1;
  }
  const w = { ...weekends[i]! };
  w[bucket] += s;
  weekends[i] = w;
  return { ...pace, weekends };
}

export interface PaceSummary {
  /** Whole game, in seconds, weekends and between seasons both. */
  total: number;
  weekends: number;
  perWeekend: number;
  /** A weekend's seconds, on average, in each bucket. */
  raceDay: number;
  private: number;
  pass: number;
  table: number;
  between: number;
}

export function summarisePace(pace: Pace): PaceSummary {
  const n = pace.weekends.length;
  const sum = (pick: (w: PaceWeekend) => number) => pace.weekends.reduce((a, w) => a + pick(w), 0);
  const weekendTotal = sum((w) => w.private + w.raceDay + w.pass + w.table);
  const avg = (x: number) => (n ? x / n : 0);
  return {
    total: weekendTotal + pace.between,
    weekends: n,
    perWeekend: avg(weekendTotal),
    raceDay: avg(sum((w) => w.raceDay)),
    private: avg(sum((w) => w.private)),
    pass: avg(sum((w) => w.pass)),
    table: avg(sum((w) => w.table)),
    between: pace.between,
  };
}

/** "3m 05s", "48s". */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
