import type { Id } from '@sdr/engine';
import type { VenueId } from './venues';

/**
 * Where the six venues sit on a planet's hub backdrop (GDD §15.3).
 *
 * Positions are percentages of the stage, so they hold at every width, and they are DATA: the
 * backdrops in design/ASSET_LIST.md are generated with these six regions left uncluttered, and
 * the prompt for each planet names its arrangement. A planet with no row here falls back to
 * DEFAULT_ARRANGEMENT, so "adding a planet is one data row plus its images" stays true even if
 * nobody remembers to place its hotspots.
 *
 * Two areas are kept clear of every arrangement: the top-left, where the planet's name plate
 * sits, and the bottom-right corner, where the placeholder stamp goes.
 */

export interface Spot {
  /** Percent from the left of the stage. */
  x: number;
  /** Percent from the top of the stage. */
  y: number;
}

/** The six venues of GDD §4.2 phase 3, in the order they are drawn. */
export const HOTSPOT_VENUES = [
  'market',
  'stable',
  'docks',
  'saloon',
  'bookie',
  'office',
] as const satisfies readonly VenueId[];

export type HotspotVenue = (typeof HOTSPOT_VENUES)[number];

export type Arrangement = Record<HotspotVenue, Spot>;

/**
 * Six arrangements, one per kind of place. A planet picks the one its landscape suggests —
 * terraces for the built-up ones, a canyon for the ones you look down into, a gantry for the
 * stations — which is also the composition brief the backdrop prompt carries.
 */
export const ARRANGEMENTS: Record<string, Arrangement> = {
  /** A sweep across open ground: farms, swamps, ice fields, desert. */
  arc: {
    market: { x: 16, y: 52 },
    stable: { x: 32, y: 73 },
    docks: { x: 50, y: 44 },
    saloon: { x: 68, y: 71 },
    bookie: { x: 84, y: 49 },
    office: { x: 50, y: 87 },
  },
  /** Stacked levels of a built-up place: capitals, labs, domes. */
  terraces: {
    market: { x: 18, y: 40 },
    stable: { x: 41, y: 35 },
    docks: { x: 64, y: 40 },
    saloon: { x: 22, y: 73 },
    bookie: { x: 47, y: 75 },
    office: { x: 75, y: 71 },
  },
  /** One lit street: casino moons, megacities, bazaars. */
  strip: {
    market: { x: 13, y: 62 },
    stable: { x: 31, y: 48 },
    docks: { x: 49, y: 65 },
    saloon: { x: 67, y: 48 },
    bookie: { x: 85, y: 62 },
    office: { x: 49, y: 88 },
  },
  /** Round the rim of a hollow: scrapyards, slum stations. */
  ring: {
    market: { x: 14, y: 39 },
    stable: { x: 14, y: 75 },
    docks: { x: 50, y: 82 },
    saloon: { x: 86, y: 75 },
    bookie: { x: 86, y: 39 },
    office: { x: 50, y: 31 },
  },
  /** Down into a cut: mines, ossuaries, monasteries in the rock. */
  canyon: {
    market: { x: 20, y: 34 },
    stable: { x: 16, y: 65 },
    docks: { x: 44, y: 53 },
    saloon: { x: 65, y: 34 },
    bookie: { x: 73, y: 67 },
    office: { x: 45, y: 85 },
  },
  /** Two decks of a structure: ports, workshops, deep-space stations. */
  gantry: {
    market: { x: 24, y: 31 },
    stable: { x: 51, y: 27 },
    docks: { x: 77, y: 33 },
    saloon: { x: 20, y: 67 },
    bookie: { x: 50, y: 73 },
    office: { x: 79, y: 67 },
  },
};

export const DEFAULT_ARRANGEMENT = 'arc';

/** One row per planet: which arrangement its backdrop is painted around. */
export const PLANET_ARRANGEMENT: Record<Id, string> = {
  cosmodrome: 'terraces',
  ossuary: 'canyon',
  blackreach: 'gantry',
  collarPrime: 'strip',
  kibbleton: 'arc',
  rustgut: 'canyon',
  neonSnout: 'strip',
  drift: 'ring',
  mudhaven: 'arc',
  glassfall: 'arc',
  portSlobber: 'gantry',
  vatgrown: 'terraces',
  oldWembley: 'terraces',
  hushmarket: 'strip',
  sunbleach: 'arc',
  tinkertown: 'gantry',
  holyBark: 'canyon',
  lagrangeLows: 'ring',
};

export function arrangementNameFor(planetId: Id): string {
  return PLANET_ARRANGEMENT[planetId] ?? DEFAULT_ARRANGEMENT;
}

export function hotspotsFor(planetId: Id): Arrangement {
  return ARRANGEMENTS[arrangementNameFor(planetId)] ?? ARRANGEMENTS[DEFAULT_ARRANGEMENT]!;
}

/** What each hotspot is called and what it looks like before the icon art lands. */
export const VENUE_ICON: Record<HotspotVenue, string> = {
  market: '🛒',
  stable: '🐕',
  docks: '🚀',
  saloon: '🥃',
  bookie: '🎲',
  office: '🏁',
};

/** One line of "what you actually do in there", for the hotspot's tooltip. */
export const VENUE_BLURB: Record<HotspotVenue, string> = {
  market: 'Dogs on the block, kennel gear, and what your own are worth',
  stable: 'Your dogs: stats, fitness, form, and gear onto a named dog',
  docks: 'Ship upgrades and the kibble trade',
  saloon: 'Staff for hire, the training focus, and whoever lends money here',
  bookie: 'Win and place on any dog in any race, including your own',
  office: 'Declare one runner per race',
};
