import { balance } from './balance';
import type { RunningStyle, StyleId } from '../types';
import { STYLE_IDS } from '../types';

/**
 * GDD_V3 §5.1's three running styles, one row each, every number a spreadsheet cell.
 *
 * ⚠️ **A style is a row.** `simulateRace` reads `earlySpeed`, `fadeShift`, `fadeMult` and `contests`
 * and never asks which style it is looking at, so a fourth style is a row here and four cells in the
 * sheet. If adding one ever needs a branch, stop.
 */
export const STYLES: readonly RunningStyle[] = [
  {
    id: 'frontRunner',
    name: 'Front-runner',
    earlySpeed: balance.styleFrontRunnerSpeed,
    fadeShift: balance.styleFrontRunnerFade,
    fadeMult: balance.styleFrontRunnerFadeMult,
    contests: balance.styleFrontRunnerContests === 1,
    blurb: 'Bursts from the boxes and leads early, then pays for it',
  },
  {
    id: 'stalker',
    name: 'Stalker',
    earlySpeed: balance.styleStalkerSpeed,
    fadeShift: balance.styleStalkerFade,
    fadeMult: balance.styleStalkerFadeMult,
    contests: balance.styleStalkerContests === 1,
    blurb: 'Even pace, sits handy, wins by being better',
  },
  {
    id: 'closer',
    name: 'Closer',
    earlySpeed: balance.styleCloserSpeed,
    fadeShift: balance.styleCloserFade,
    fadeMult: balance.styleCloserFadeMult,
    contests: balance.styleCloserContests === 1,
    blurb: 'Slow away, comes home hardest over the last third',
  },
];

export const STYLE_BY_ID: Record<StyleId, RunningStyle> = Object.fromEntries(
  STYLES.map((st) => [st.id, st]),
) as Record<StyleId, RunningStyle>;

// The rows and the canonical id list must agree, or a deal and a save would disagree about order.
if (STYLES.map((st) => st.id).join() !== STYLE_IDS.join())
  throw new Error('content/styles.ts is out of step with STYLE_IDS');
