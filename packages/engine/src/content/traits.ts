import type { Trait, TraitId } from '../types';

/** GDD §5.4. Numeric effects are applied in race/simulateRace.ts, phases/endTurn.ts and economy/. */
export const TRAITS: readonly Trait[] = [
  { id: 'railer', name: 'Railer', blurb: '+3% speed on tight-bend tracks' },
  {
    id: 'wideRunner',
    name: 'Wide runner',
    blurb: 'Always drawn outside; far less likely to be bumped',
  },
  { id: 'slowStarter', name: 'Slow starter', blurb: 'Slow out of the boxes, fades later' },
  { id: 'mudlark', name: 'Mudlark', blurb: '+5% on swamp tracks' },
  { id: 'fragile', name: 'Fragile', blurb: 'Injury chance ×2' },
  { id: 'iron', name: 'Iron', blurb: 'Injury chance ×0.5' },
  { id: 'showboat', name: 'Showboat', blurb: '+3% at Majors' },
  { id: 'glutton', name: 'Glutton', blurb: 'Eats 2 food a week' },
  { id: 'nervy', name: 'Nervy', blurb: '−5% when drawn trap 1 or 8' },
  { id: 'sprinter', name: 'Sprinter', blurb: '+3% on tracks of 400 m or less' },
  { id: 'stayer', name: 'Stayer', blurb: '+3% on tracks of 550 m or more' },
  { id: 'cheapDate', name: 'Cheap date', blurb: 'Upkeep halved' },
  { id: 'primaDonna', name: 'Prima donna', blurb: 'Form swings ×2' },
  { id: 'bouncesBack', name: 'Bounces back', blurb: '+5 fitness a week' },
  { id: 'oldSoul', name: 'Old soul', blurb: 'Ages a season later' },
  { id: 'badBlood', name: 'Bad blood', blurb: '−2 form for every kennel-mate with a lower rating' },
];

export const TRAIT_IDS: readonly TraitId[] = TRAITS.map((t) => t.id);
export const TRAIT_BY_ID: Record<TraitId, Trait> = Object.fromEntries(
  TRAITS.map((t) => [t.id, t]),
) as Record<TraitId, Trait>;
