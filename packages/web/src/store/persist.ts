import type { Action, SeasonSetup } from '@sdr/engine';
import type { Pace } from '../lib/pace';

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
  /** The last season whose end the table has read (GDD_V3 §2.2). */
  seasonSeen?: number;
  /** Phase E2, a hotseat table: the weekend whose arrival, and whose locked board, the table read. */
  arrivalSeenWeek?: number;
  boardSeenWeek?: number;
  /** Phase E2: the pace timer. Wall-clock time lives here, in the UI block, and never in the log. */
  pace?: Pace;
}

export interface SaveBlob {
  v: number;
  setup: SeasonSetup;
  log: Action[];
  ui: SaveUi;
}

/**
 * 11 for v3 Phase E2. Every dog starts a new season fresh, so a v3e1 log that reached a second season
 * replays into a different game from there; the check sends every v3e1 save to the title screen rather
 * than deciding which were one-season games. The UI block gains the hotseat marks (`arrivalSeenWeek`,
 * `boardSeenWeek`) and the pace timer (`pace`), all optional.
 *
 * 10 for v3 Phase E1. A setup may carry a game `length`, and a log may run through an off-season
 * (`Retire`, `ResolveStaffNotice`) into a second season. The free local runner is gone and dogs no
 * longer age at week 7, so a v3d2 log is a different season here; this check sends it to the title
 * screen. The UI's week marks are `weekKey`s and `seasonSeen` is new — both read as before in season 1.
 *
 * 9 for v3 Phase D2. Two trainers are dealt to every stable at createSeason, which moves every draw
 * after the deal; the log can carry `ChooseBox`; injury rolls, the stewards and the Race Office's
 * week all draw or set differently. A v3d1 log is a different season here.
 *
 * 8 for v3 Phase D1. The arrival draw is gone and Explore replaces it: a log now carries ChooseDoor,
 * the week's first actions are doors rather than an event queue, arrival rolls conditions and next
 * week's market, and a Pound card can change a stable's dogs. A v3c2 log does not mean this season.
 *
 * 7 for v3 Phase C2. The dogs are dealt the same way, but every race runs differently — the hot
 * pace (GDD_V3 §5.3) and the run-in (§14 Q11) — so a v3c log is a different season here: its
 * purses, its cash and so its bets all come out differently. This check keeps it off the board.
 *
 * 6 for v3 Phase C. The dogs are dealt by a different rule (an equal rating and one of each running
 * style) and the race model is different under every race, so a v3b log means a different season
 * here. In practice it fails fast — three v3b logs replayed at v3c all stopped within the first ten
 * actions on "It is not p4's turn", because the new deal moves the rng and so the turn order — but
 * that is an accident of the stream, not a guarantee; this check is the guarantee. Verified at v3c by
 * writing a v3b-shaped blob and reading it back: null, the title screen.
 *
 * 5 for v3 Phase B. The blob is still seed + action log, and a v3a log does not replay: its
 * `TradeFood` actions trade `kibble`, which no longer exists, and its `SetDogState` actions carry a
 * `stat` where v3b expects a `diet`. So a v3a save fails the check below and lands on the title
 * screen with a new season.
 *
 * ⚠️ **This constant did not move from `v2c` to `v3a`**, though v2d, v2e and v3a all changed the
 * action log's meaning — v3a deleted nine action types. A v2c-to-v2e save therefore *passed* this
 * check at `v3a` and failed later, at replay, with an error message rather than softly here. v3 Phase
 * A's notes said such a save "fails soft to the title screen"; it did not. See `STATE_VERSION`.
 *
 * 3 for v2 Phase B. The blob itself is unchanged in shape — it is still seed + action log — but
 * the log is no longer replayable: `Declare` and `PlaceBet` name a race type rather than a
 * class, so every declaration and every bet in a Phase A log is an action this engine rejects.
 * A v2a save now fails the version check in `readSave`, which returns null, which lands the
 * player on the title screen with a new season rather than half a season that no longer means
 * what it meant.
 */
export const SAVE_VERSION = 11;
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
