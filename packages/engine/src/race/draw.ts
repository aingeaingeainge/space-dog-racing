import type { Track } from '../types';

/**
 * What the **draw** is worth on a given track (GDD §6.2, D37).
 *
 * One definition, in the engine, read by the AI that prices a steward's bribe and by the Race
 * Office that prints what one costs — because a screen that guesses is how a player ends up being
 * lied to, and an agent that guesses differently from the screen is worse than either.
 */

/**
 * How much the draw matters here relative to a tight-bend track, 0 to 1.
 *
 * Mirrors `simulateRace`'s own `bendMult`, normalised on the tightest bends, and **zero where the
 * track has none**: a trap number on a straight is a starting position and nothing else. The Void
 * Derby's 350 m is the race where buying a box is provably worth nothing, and the screens say so.
 */
export function bendFactor(track: Track): number {
  switch (track.bends) {
    case 'none':
      return 0;
    case 'wide':
      return 0.6 / 1.5;
    case 'tight':
      return 1;
    default:
      return 1 / 1.5;
  }
}

/**
 * Win-rate points a dog gains by **choosing** its box rather than taking the draw it was given,
 * as a fraction — so 0.021 is two points.
 *
 * ⚠️ **Re-measured at `v3d2`, and it is 2.1 points, not v2's 3.5.** Phase D2 brought the bought box
 * back and the screens quote this number, so it was measured again on today's race model — eight
 * equal rating-50 dogs of mixed styles, 20,000 races a track, box 1 against the mean of the eight:
 * **+2.1 on tight bends, +1.2 medium, +0.7 wide, nothing on a straight** (`--explore` prints it).
 * The race model has changed under it since D37 — the fold of Trap into Acceleration, the styles, the
 * hot pace and the run-in — and nothing read the constant, so nothing noticed. The v2 note follows.
 *
 * ⚠️ **A measured conversion, not a derivation.** `trapDrawEdge` is a top-speed multiplier and
 * win rate is not linear in top speed, so the two cannot be related by arithmetic. The number
 * comes from the sweep that set `trapDrawEdge` in the first place: one dog walked across all
 * eight boxes against seven craft-50 rivals on a tight 480, 9,000 races a box, against the mean
 * over the eight. It read **+3.5 points for a craft-65 dog and +3.5 for a craft-35 one**
 * [measured, `--stats`], and it scales with how tight the bends are.
 *
 * Re-measure it if `trapDrawEdge`, `trapTraffic` or the bump constants ever move.
 */
export const DRAW_WIN_POINTS = 0.021;

export function drawAdvantage(track: Track): number {
  return DRAW_WIN_POINTS * bendFactor(track);
}
