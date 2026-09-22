import type { Trait, TraitId } from '../types';

/**
 * GDD_V3 §4.5: **eight traits**, shown as icons on the dog card. Numeric effects are applied in
 * race/simulateRace.ts, phases/raceDay.ts, phases/endTurn.ts and economy/.
 *
 * ⚠️ **Sixteen became eight in v3 Phase C** (§2.2). *Slow starter*, *Sprinter* and *Stayer* went
 * because running styles and the fade in metres (A7) now say what they said — two systems saying the
 * same thing is the mistake `SetTraining` fixed once already (v2 D19). *Nervy*, *Cheap date*, *Prima
 * donna*, *Bounces back* and *Old soul* went with them: Cheap date halved an upkeep that v3 does not
 * have, and the other four were a management sim's texture in a forty-minute party game.
 */
export const TRAITS: readonly Trait[] = [
  { id: 'railer', name: 'Railer', blurb: '+3% speed on tight-bend tracks' },
  {
    id: 'wideRunner',
    name: 'Wide runner',
    blurb: 'Always drawn outside; far less likely to be bumped',
  },
  { id: 'mudlark', name: 'Mudlark', blurb: '+5% on swamp tracks' },
  { id: 'fragile', name: 'Fragile', blurb: 'Injury chance ×2' },
  { id: 'iron', name: 'Iron', blurb: 'Injury chance ×0.5' },
  { id: 'showboat', name: 'Showboat', blurb: '+3% at Majors' },
  { id: 'glutton', name: 'Glutton', blurb: 'Eats 2 food a week' },
  { id: 'badBlood', name: 'Bad blood', blurb: '−2 form for every kennel-mate with a lower rating' },
];

export const TRAIT_IDS: readonly TraitId[] = TRAITS.map((t) => t.id);
export const TRAIT_BY_ID: Record<TraitId, Trait> = Object.fromEntries(
  TRAITS.map((t) => [t.id, t]),
) as Record<TraitId, Trait>;
