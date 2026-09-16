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
    special: {},
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
    special: {},
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
    special: { turnOrderReversed: true },
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
    // The fraction has let you stake everything you own here since v1, and with the flat ceiling
    // gone (BUILD_PLAN_V3 §2.1 — there is no borrowed bankroll to cap) it is the whole of the rule.
    special: { bettingMargin: 0.1, maxStakeFraction: 1 },
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
    special: {},
    accents: ['#D9531E', '#6B3A22'],
  },
  {
    id: 'neonSnout',
    name: 'Neon Snout',
    vibe: 'Casino moon',
    major: false,
    track: standard('medium'),
    foodBand: [100, 140],
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
    special: { piratesLikely: true },
    accents: ['#8C8C8C', '#F4C542'],
  },
  {
    id: 'mudhaven',
    name: 'Mudhaven',
    vibe: 'Swamp world, fog, glowing insects',
    major: false,
    track: staying('medium', { hazard: 1.5, mud: true }),
    foodBand: [70, 100],
    special: {},
    accents: ['#5B7A2E', '#9BE84B'],
  },
  {
    id: 'glassfall',
    name: 'Glassfall',
    vibe: 'Ice planet, aurora',
    major: false,
    track: sprint('wide', { slippery: true }),
    foodBand: [85, 120],
    special: {},
    accents: ['#A8E6FF', '#7B4BD6'],
  },
  {
    id: 'portSlobber',
    name: 'Port Slobber',
    vibe: 'Sleazy spaceport',
    major: false,
    track: standard('medium'),
    foodBand: [70, 100],
    special: { winningsTax: 0.1 },
    accents: ['#F4C542', '#3A2A5C'],
  },
  {
    id: 'vatgrown',
    name: 'Vatgrown',
    vibe: 'Bio-lab; clone pups in jars',
    major: false,
    track: standard('medium'),
    foodBand: [45, 70],
    // GDD §8.1 names Vatgrown as where the Prime feed is. A bio-lab would be.
    special: {},
    accents: ['#9BE84B', '#3FD6E0'],
  },
  {
    id: 'oldWembley',
    name: 'Old Wembley',
    vibe: 'Nostalgia dome rebuilding Earth tracks',
    major: false,
    track: standard('medium'),
    foodBand: [70, 100],
    // Nostalgists with a rule book. They test for everything and they watch the boxes too.
    special: { purseMult: 1.2 },
    accents: ['#2E8B57', '#F4F4F4'],
  },
  {
    id: 'hushmarket',
    name: 'Hushmarket',
    vibe: 'Black-market bazaar',
    major: false,
    track: standard('tight'),
    foodBand: [100, 140],
    // A black-market bazaar does not run a stewards' room worth the name.
    special: {},
    accents: ['#7A1F2B', '#F4C542'],
  },
  {
    id: 'sunbleach',
    name: 'Sunbleach',
    vibe: 'Desert, twin suns',
    major: false,
    track: standard('medium', { hazard: 1.2 }),
    foodBand: [100, 130],
    special: { fitnessOnArrival: -5 },
    accents: ['#F7B267', '#F4C542'],
  },
  {
    id: 'tinkertown',
    name: 'Tinkertown',
    vibe: 'Robot-run workshop planet',
    major: false,
    track: sprint('medium'),
    foodBand: [70, 100],
    special: {},
    accents: ['#3FD6E0', '#B87333'],
  },
  {
    id: 'holyBark',
    name: 'Holy Bark',
    vibe: 'Monastery world; monks who worship the Good Boy',
    major: false,
    track: staying('wide'),
    foodBand: [45, 70],
    // ⚠️ No bookie means no sabotage here at all: §13's nobbling is a `betting`-phase action and
    // Holy Bark skips that phase entirely. A bought box is still possible, and the monks notice.
    special: { noBetting: true, fitnessOnArrival: 5 },
    accents: ['#F4F4F4', '#C9A227'],
  },
  {
    id: 'lagrangeLows',
    name: 'Lagrange Lows',
    vibe: 'Floating slum station',
    major: false,
    track: standard('tight'),
    foodBand: [100, 140],
    // Everybody on this station is on the take, including the stewards. The Fixer's home ground
    // and the one place on the circuit where the road is cheap to walk.
    special: { localsNervy: true },
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
