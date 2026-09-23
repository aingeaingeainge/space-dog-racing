import { balance } from './balance';
import type { Dog, RunningStyle, StyleId } from '../types';
import { STYLE_IDS } from '../types';

/**
 * GDD_V3 §5.1's three running styles, one row each, every number a spreadsheet cell.
 *
 * ⚠️ **A style is a row.** `simulateRace` reads `earlySpeed`, `fadeShift`, `fadeMult` and
 * `lightsPace` and never asks which style it is looking at, so a fourth style is a row here and four cells in the
 * sheet. If adding one ever needs a branch, stop.
 */
export const STYLES: readonly RunningStyle[] = [
  {
    id: 'frontRunner',
    name: 'Front-runner',
    earlySpeed: balance.styleFrontRunnerSpeed,
    fadeShift: balance.styleFrontRunnerFade,
    fadeMult: balance.styleFrontRunnerFadeMult,
    lightsPace: balance.styleFrontRunnerLightsPace === 1,
    bookEdge: {
      sprint: balance.bookEdgeFrontRunnerSprint,
      standard: balance.bookEdgeFrontRunnerStandard,
      staying: balance.bookEdgeFrontRunnerStaying,
    },
    blurb: 'Bursts from the boxes and leads early, then pays for it',
  },
  {
    id: 'stalker',
    name: 'Stalker',
    earlySpeed: balance.styleStalkerSpeed,
    fadeShift: balance.styleStalkerFade,
    fadeMult: balance.styleStalkerFadeMult,
    lightsPace: balance.styleStalkerLightsPace === 1,
    bookEdge: {
      sprint: balance.bookEdgeStalkerSprint,
      standard: balance.bookEdgeStalkerStandard,
      staying: balance.bookEdgeStalkerStaying,
    },
    blurb: 'Even pace, sits handy, wins by being better',
  },
  {
    id: 'closer',
    name: 'Closer',
    earlySpeed: balance.styleCloserSpeed,
    fadeShift: balance.styleCloserFade,
    fadeMult: balance.styleCloserFadeMult,
    lightsPace: balance.styleCloserLightsPace === 1,
    bookEdge: {
      sprint: balance.bookEdgeCloserSprint,
      standard: balance.bookEdgeCloserStandard,
      staying: balance.bookEdgeCloserStaying,
    },
    blurb: 'Slow away, comes home hardest over the last third',
  },
];

export const STYLE_BY_ID: Record<StyleId, RunningStyle> = Object.fromEntries(
  STYLES.map((st) => [st.id, st]),
) as Record<StyleId, RunningStyle>;

// The rows and the canonical id list must agree, or a deal and a save would disagree about order.
if (STYLES.map((st) => st.id).join() !== STYLE_IDS.join())
  throw new Error('content/styles.ts is out of step with STYLE_IDS');

/**
 * A dog's style as the table knows it (GDD_V3 §5.4): its style once it has raced, null until then.
 * The one definition every reader uses — the bookie, the AI and the screens — so that nothing ever
 * prices or prints a style the table has not seen.
 */
export function publicStyle(d: Pick<Dog, 'style' | 'styleKnown'>): StyleId | null {
  return d.styleKnown ? d.style : null;
}
