import { balance } from './balance';
import type { Planet, Id } from '../types';

const sprint = (bends: Planet['track']['bends'], extra: Partial<Planet['track']> = {}) =>
  ({ distance: 350, length: 'sprint', bends, hazard: 1, ...extra }) as Planet['track'];
const standard = (bends: Planet['track']['bends'], extra: Partial<Planet['track']> = {}) =>
  ({ distance: 480, length: 'standard', bends, hazard: 1, ...extra }) as Planet['track'];
const staying = (bends: Planet['track']['bends'], extra: Partial<Planet['track']> = {}) =>
  ({ distance: 600, length: 'staying', bends, hazard: 1, ...extra }) as Planet['track'];

/** GDD §12. Content is data: add a planet by adding a row. */
export const PLANETS: readonly Planet[] = [
  // ---- Major venues ----
  {
    id: 'cosmodrome',
    name: 'Cosmodrome',
    event: 'The Cosmodrome Classic',
    vibe: 'Retro-futurist imperial capital; brass, banners, propaganda posters of dogs',
    major: true,
    track: standard('wide'),
    foodBand: [80, 110],
    marketBias: 'Expensive Gold-class dogs',
    special: {
      bank: true,
      dopingCatch: 0.3,
      buyerBonus: 0.15,
      marketQualityBonus: 20,
      trainer: true,
    },
    accents: ['#C9A227', '#7A1F2B'],
  },
  {
    id: 'ossuary',
    name: 'Ossuary',
    event: 'The Bonemeal Cup',
    vibe: 'Graveyard planet; racing in a cathedral of ribs',
    major: true,
    track: staying('tight', { hazard: 1.5 }),
    foodBand: [80, 110],
    marketBias: 'Collectors pay over the odds',
    special: { shark: true, dogValueMod: 1.1, buyerBonus: 0.1, marketQualityBonus: 20 },
    accents: ['#E8E4D0', '#4B2E83'],
  },
  {
    id: 'blackreach',
    name: 'Blackreach',
    event: 'The Void Derby',
    vibe: 'Deep-space station orbiting a black hole; time is weird',
    major: true,
    track: sprint('none'),
    foodBand: [90, 130],
    marketBias: 'Sprinters and oddities',
    special: { turnOrderReversed: true, marketQualityBonus: 20 },
    accents: ['#3FD6E0', '#0B0B1A'],
  },
  {
    id: 'collarPrime',
    name: 'Collar Prime',
    event: 'The Galactic Collar',
    vibe: "Neon megacity; the sport's Vegas",
    major: true,
    track: standard('medium'),
    foodBand: [90, 130],
    marketBias: 'The best dogs money can buy',
    special: { bettingMargin: 0.1, maxStakeFraction: 1, marketQualityBonus: 25, trainer: true },
    accents: ['#F04E98', '#3FD6E0'],
  },
  // ---- Regular pool ----
  {
    id: 'kibbleton',
    name: 'Kibbleton Prime',
    vibe: 'Endless kibble farms; folksy',
    major: false,
    track: standard('wide'),
    foodBand: [40, 60],
    marketBias: 'Dull market',
    special: {},
    accents: ['#F4C542', '#7BB661'],
  },
  {
    id: 'rustgut',
    name: 'Rustgut',
    vibe: 'Mining colony, orange dust, everyone coughing',
    major: false,
    track: standard('tight'),
    foodBand: [110, 140],
    marketBias: 'Cheap knackered dogs (age 5+), and nothing above Rough on the shelves',
    // GDD §8.1 names Rustgut as the feed-poor planet: cheap kibble band, nothing good in it.
    special: { marketAgeBias: 'old', feedBias: balance.feedBiasPoor },
    accents: ['#D9531E', '#6B3A22'],
  },
  {
    id: 'neonSnout',
    name: 'Neon Snout',
    vibe: 'Casino moon',
    major: false,
    track: standard('medium'),
    foodBand: [100, 140],
    marketBias: 'Everything +20%',
    special: { bettingMargin: 0.1, everythingMarkup: 0.2 },
    accents: ['#F04E98', '#9BE84B'],
  },
  {
    id: 'drift',
    name: 'The Drift',
    vibe: 'Orbital scrapyard',
    major: false,
    track: sprint('medium'),
    foodBand: [70, 100],
    marketBias: 'Ship parts',
    special: { shipDiscount: 0.3, piratesLikely: true },
    accents: ['#8C8C8C', '#F4C542'],
  },
  {
    id: 'mudhaven',
    name: 'Mudhaven',
    vibe: 'Swamp world, fog, glowing insects',
    major: false,
    track: staying('medium', { hazard: 1.5, mud: true }),
    foodBand: [70, 100],
    marketBias: 'Stayers',
    special: { vet: true },
    accents: ['#5B7A2E', '#9BE84B'],
  },
  {
    id: 'glassfall',
    name: 'Glassfall',
    vibe: 'Ice planet, aurora',
    major: false,
    track: sprint('wide', { slippery: true }),
    foodBand: [85, 120],
    marketBias: 'Fast starters',
    special: { foodSpoils: 0.2 },
    accents: ['#A8E6FF', '#7B4BD6'],
  },
  {
    id: 'portSlobber',
    name: 'Port Slobber',
    vibe: 'Sleazy spaceport',
    major: false,
    track: standard('medium'),
    foodBand: [70, 100],
    marketBias: 'Staff of every kind',
    special: { bank: true, trainer: true, vet: true, fixer: true, winningsTax: 0.1 },
    accents: ['#F4C542', '#3A2A5C'],
  },
  {
    id: 'vatgrown',
    name: 'Vatgrown',
    vibe: 'Bio-lab; clone pups in jars',
    major: false,
    track: standard('medium'),
    foodBand: [45, 70],
    marketBias: 'Age-1 pups with growth, and the best feed on the circuit',
    // GDD §8.1 names Vatgrown as where the Prime feed is. A bio-lab would be.
    special: { dopingCatch: 0, marketAgeBias: 'pups', feedBias: balance.feedBiasRich },
    accents: ['#9BE84B', '#3FD6E0'],
  },
  {
    id: 'oldWembley',
    name: 'Old Wembley',
    vibe: 'Nostalgia dome rebuilding Earth tracks',
    major: false,
    track: standard('medium'),
    foodBand: [70, 100],
    marketBias: 'Traditionalists',
    special: { dopingCatch: 0.4, purseMult: 1.2 },
    accents: ['#2E8B57', '#F4F4F4'],
  },
  {
    id: 'hushmarket',
    name: 'Hushmarket',
    vibe: 'Black-market bazaar',
    major: false,
    track: standard('tight'),
    foodBand: [100, 140],
    marketBias: '"Fell-off-a-ship" dogs at 60% value',
    special: { shark: true, fellOffAShip: true },
    accents: ['#7A1F2B', '#F4C542'],
  },
  {
    id: 'sunbleach',
    name: 'Sunbleach',
    vibe: 'Desert, twin suns',
    major: false,
    track: standard('medium', { hazard: 1.2 }),
    foodBand: [100, 130],
    marketBias: 'Cheap kennel modules',
    special: { fitnessOnArrival: -5, kennelDiscount: 0.5 },
    accents: ['#F7B267', '#F4C542'],
  },
  {
    id: 'tinkertown',
    name: 'Tinkertown',
    vibe: 'Robot-run workshop planet',
    major: false,
    track: sprint('medium'),
    foodBand: [70, 100],
    marketBias: 'Engines and muzzles',
    special: { engineDiscount: 0.4, muzzles: true },
    accents: ['#3FD6E0', '#B87333'],
  },
  {
    id: 'holyBark',
    name: 'Holy Bark',
    vibe: 'Monastery world; monks who worship the Good Boy',
    major: false,
    track: staying('wide'),
    foodBand: [45, 70],
    marketBias: 'Serene',
    special: { noBetting: true, noUpkeep: true, fitnessOnArrival: 5 },
    accents: ['#F4F4F4', '#C9A227'],
  },
  {
    id: 'lagrangeLows',
    name: 'Lagrange Lows',
    vibe: 'Floating slum station',
    major: false,
    track: standard('tight'),
    foodBand: [100, 140],
    marketBias: 'Fixers and nervy locals',
    special: { fixer: true, shark: true, localsNervy: true },
    accents: ['#9BE84B', '#1B1A22'],
  },
];

export const PLANET_BY_ID: Record<Id, Planet> = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
export const MAJOR_PLANET_IDS = PLANETS.filter((p) => p.major).map((p) => p.id);
export const REGULAR_PLANET_IDS = PLANETS.filter((p) => !p.major).map((p) => p.id);
export const GRAND_FINAL_PLANET_ID: Id = 'collarPrime';

export function planetOf(id: Id): Planet {
  const p = PLANET_BY_ID[id];
  if (!p) throw new Error('Unknown planet ' + id);
  return p;
}
