import { GOOD_IDS, type GoodId, type Planet, type Id } from '../types';

/**
 * A planet's food prices, as a **level** and a **tilt** (GDD_V3 §12's per-planet `foodBand`).
 *
 * `foodBand` is six multipliers, one per good, over the centre of that good's §6.1 band: 1.0 prices
 * mid-band, 0.6 in the cheap part, 1.4 in the dear part. Eighteen planets by six goods is 108
 * numbers, and 108 hand-picked numbers is a map nobody can read or reason about — so each planet is
 * written as two, plus at most one exception, and the six are derived:
 *
 * - **level** — how dear the planet is for everything. Taken straight from Phase A's absolute
 *   band, so a planet keeps the economic character v1 and v2 gave it: Kibbleton's old [40, 60] is
 *   level 0.70, Rustgut's [110, 140] is 1.25, and the pool's median band [80, 110] is 1.00.
 * - **tilt** — which end of the ladder is dear here. Positive: the staples are cheap and the
 *   exotics dear, which is a poor world or a farming one (Kibbleton, Lagrange Lows). Negative: the
 *   exotics flow and the staples are the thing in short supply, which is a rich world or a
 *   smuggler's (Collar Prime, Hushmarket). Good *i* of six, cheapest first, gets
 *   `level × (1 + tilt × (i − 2.5) ÷ 2.5)`, so a tilt of 0.3 moves the ends 30% apart each way.
 * - **one exception** where the planet's name is a promise: the Drift is an orbital scrapyard and
 *   sells Scrapmeat cheap; Vatgrown is a bio-lab and sells Vat Steak cheap; the monks of Holy Bark
 *   worship the Good Boy and pay through the nose for Ambrosia; the Hushmarket is where Ambrosia
 *   comes from. Six planets carry one, and none carries two.
 *
 * ⚠️ **The multiplier moves where the week's price clusters, never the band.** A bias that scaled
 * the *price* would let a dear planet post Ambrosia above 720 and a cheap one Grey Mash below 10 —
 * outside §6.1's 8×, which is the one number §6.4 says must stay a hard range. So the engine clamps
 * the bias to `planetBiasMin…Max` and the draw to the band itself (`rollGoodPrices`).
 *
 * Chosen so that **every good's bias averages close to 1.0 across the eighteen**, which keeps a
 * season's mean price at mid-band and makes the map a thing about *where*, not a drift in *how
 * much*. The notes print the table.
 */
function taste(
  level: number,
  tilt: number,
  exception: Partial<Record<GoodId, number>> = {},
): Record<GoodId, number> {
  const last = GOOD_IDS.length - 1;
  const out = {} as Record<GoodId, number>;
  GOOD_IDS.forEach((id, i) => {
    const bias = level * (1 + (tilt * (i - last / 2)) / (last / 2));
    // Two decimals: a map is read by people, and 1.3125 is not a number anybody reads.
    out[id] = exception[id] ?? Math.round(bias * 100) / 100;
  });
  return out;
}

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
    foodBand: taste(1.0, -0.15),
    special: {},
    accents: ['#C9A227', '#7A1F2B'],
    exploreDoors: [
      {
        name: 'The Imperial Paddock',
        category: 'track',
        blurb:
          "Brass rails, a band, and a colonel with a stopwatch who takes your dog's time personally.",
      },
      {
        name: "The Officers' Mess",
        category: 'bar',
        blurb: 'Medals, port and gossip. Somebody here always knows which dog the Emperor fancies.',
      },
      {
        name: 'The Parade Ground',
        category: 'strip',
        blurb: 'Banners, bunting and sponsors queuing to be photographed next to a winner.',
      },
    ],
  },
  {
    id: 'ossuary',
    name: 'Ossuary',
    event: 'The Bonemeal Cup',
    vibe: 'Graveyard planet; racing in a cathedral of ribs',
    major: true,
    track: staying('tight', { hazard: 1.5 }),
    foodBand: taste(1.0, 0.1, { pulsarMarrow: 0.6 }),
    special: {},
    accents: ['#E8E4D0', '#4B2E83'],
    exploreDoors: [
      {
        name: 'The Charnel Kennels',
        category: 'pound',
        blurb: 'Dogs bred among the bones. They do not bark. They look at you.',
      },
      {
        name: 'The Catacombs',
        category: 'alley',
        blurb: 'Tunnels under the track, lit by candles and bad intentions.',
      },
      {
        name: 'The Rib Vault',
        category: 'track',
        blurb: 'A practice straight laid out down the spine of something enormous and long dead.',
      },
    ],
  },
  {
    id: 'blackreach',
    name: 'Blackreach',
    event: 'The Void Derby',
    vibe: 'Deep-space station orbiting a black hole; time is weird',
    major: true,
    track: sprint('none'),
    foodBand: taste(1.1, 0),
    special: { turnOrderReversed: true },
    accents: ['#3FD6E0', '#0B0B1A'],
    exploreDoors: [
      {
        name: 'The Event Horizon',
        category: 'bar',
        blurb: 'A bar on the lip of the black hole. Your drink arrives before you order it.',
      },
      {
        name: 'Airlock Nine',
        category: 'alley',
        blurb: "The station's back door. Things come in through it that were never on a manifest.",
      },
      {
        name: 'The Time-Share',
        category: 'strip',
        blurb: "Salesmen offering tomorrow at today's prices. Some of them are you.",
      },
    ],
  },
  {
    id: 'collarPrime',
    name: 'Collar Prime',
    event: 'The Galactic Collar',
    vibe: "Neon megacity; the sport's Vegas",
    major: true,
    track: standard('medium'),
    foodBand: taste(1.1, -0.25),
    // The fraction has let you stake everything you own here since v1, and with the flat ceiling
    // gone (BUILD_PLAN_V3 §2.1 — there is no borrowed bankroll to cap) it is the whole of the rule.
    special: { bettingMargin: 0.1, maxStakeFraction: 1 },
    accents: ['#F04E98', '#3FD6E0'],
    exploreDoors: [
      {
        name: 'The Neon Mile',
        category: 'strip',
        blurb: 'Ten kilometres of lights, cash and people who want some of yours.',
      },
      {
        name: 'The High Roller Room',
        category: 'bar',
        blurb: 'The money that runs the sport drinks here. It talks, if you listen.',
      },
      {
        name: 'The Grand Final Paddock',
        category: 'track',
        blurb: 'Where the best dogs in the galaxy are walked, watched and weighed.',
      },
    ],
  },
  // ---- Regular pool ----
  {
    id: 'kibbleton',
    name: 'Kibbleton Prime',
    vibe: 'Endless kibble farms; folksy',
    major: false,
    track: standard('wide'),
    foodBand: taste(0.7, 0.3),
    special: {},
    accents: ['#F4C542', '#7BB661'],
    exploreDoors: [
      {
        name: 'The Barn Litter',
        category: 'pound',
        blurb: 'There is always a litter in a Kibbleton barn, and a farmer who wants it gone.',
      },
      {
        name: 'The Harvest Fair',
        category: 'strip',
        blurb: 'Pie, prize marrows and a kibble-sack race the whole town bets on.',
      },
      {
        name: 'The Paddock Gallops',
        category: 'track',
        blurb: 'Soft ground, long grass and an old boy with a flag who used to train champions.',
      },
    ],
  },
  {
    id: 'rustgut',
    name: 'Rustgut',
    vibe: 'Mining colony, orange dust, everyone coughing',
    major: false,
    track: standard('tight'),
    foodBand: taste(1.25, 0.1),
    special: {},
    accents: ['#D9531E', '#6B3A22'],
    exploreDoors: [
      {
        name: 'The Canary',
        category: 'bar',
        blurb:
          "The miners' bar. Everyone coughs, everyone talks, nobody leaves before the shift bell.",
      },
      {
        name: 'The Slag Heaps',
        category: 'alley',
        blurb:
          'Orange dust and people who would rather not be found. Things fall off ore trucks here.',
      },
      {
        name: 'The Pit Pony Pens',
        category: 'pound',
        blurb: 'Where the colony keeps its working dogs. Some of them can run.',
      },
    ],
  },
  {
    id: 'neonSnout',
    name: 'Neon Snout',
    vibe: 'Casino moon',
    major: false,
    track: standard('medium'),
    foodBand: taste(1.2, -0.1),
    special: { bettingMargin: 0.1 },
    accents: ['#F04E98', '#9BE84B'],
    exploreDoors: [
      {
        name: 'The Casino Floor',
        category: 'strip',
        blurb:
          'Chips, lights and a croupier with three hands. The house always wins; sometimes it pays.',
      },
      {
        name: 'The Sportsbook Lounge',
        category: 'bar',
        blurb: 'Every race on every screen, and tipsters on every stool.',
      },
      {
        name: 'The Loading Dock',
        category: 'alley',
        blurb: 'Behind the casino, where the chips go when nobody is counting.',
      },
    ],
  },
  {
    id: 'drift',
    name: 'The Drift',
    vibe: 'Orbital scrapyard',
    major: false,
    track: sprint('medium'),
    foodBand: taste(0.95, 0, { scrapmeat: 0.55 }),
    special: { piratesLikely: true },
    accents: ['#8C8C8C', '#F4C542'],
    exploreDoors: [
      {
        name: 'The Salvage Pound',
        category: 'pound',
        blurb: 'Strays, stowaways and dogs pulled out of wrecks. Sold as seen.',
      },
      {
        name: 'The Wreck Yard',
        category: 'alley',
        blurb: 'Acres of hulks and a scavenger behind every one. Watch your hold.',
      },
      {
        name: 'The Swap Meet',
        category: 'strip',
        blurb: 'Everything has a price and nothing has a receipt.',
      },
    ],
  },
  {
    id: 'mudhaven',
    name: 'Mudhaven',
    vibe: 'Swamp world, fog, glowing insects',
    major: false,
    track: staying('medium', { hazard: 1.5, mud: true }),
    foodBand: taste(0.95, 0, { glowTripe: 0.55 }),
    special: {},
    accents: ['#5B7A2E', '#9BE84B'],
    exploreDoors: [
      {
        name: 'The Bog Gallops',
        category: 'track',
        blurb: 'A track through the swamp. The dogs that love it really love it.',
      },
      {
        name: 'The Stilt Kennels',
        category: 'pound',
        blurb: 'Kennels on legs above the mud, and a swamp witch who knows every dog in them.',
      },
      {
        name: 'The Glowbug Tavern',
        category: 'bar',
        blurb: 'Lit by insects, run by frogs. The gossip is slow and usually true.',
      },
    ],
  },
  {
    id: 'glassfall',
    name: 'Glassfall',
    vibe: 'Ice planet, aurora',
    major: false,
    track: sprint('wide', { slippery: true }),
    foodBand: taste(1.05, 0.15),
    special: {},
    accents: ['#A8E6FF', '#7B4BD6'],
    exploreDoors: [
      {
        name: 'The Ice Rink',
        category: 'track',
        blurb: 'Practise on the glass and your dog learns to stop falling over. Mostly.',
      },
      {
        name: 'The Aurora Lodge',
        category: 'bar',
        blurb:
          'Wool jumpers, hot grog and punters who have been snowed in with the form book for a month.',
      },
      {
        name: 'The Snow Kennels',
        category: 'pound',
        blurb: 'Big-footed dogs bred for the ice, and a musher who needs to lose one.',
      },
    ],
  },
  {
    id: 'portSlobber',
    name: 'Port Slobber',
    vibe: 'Sleazy spaceport',
    major: false,
    track: standard('medium'),
    foodBand: taste(0.95, -0.2),
    special: { winningsTax: 0.1 },
    accents: ['#F4C542', '#3A2A5C'],
    exploreDoors: [
      {
        name: 'Customs Shed 9',
        category: 'alley',
        blurb: 'Where confiscated goods go to be un-confiscated.',
      },
      {
        name: 'The Drool & Anchor',
        category: 'bar',
        blurb:
          "A dockers' pub. Every freighter crew in the sector drinks here, and every one of them talks.",
      },
      {
        name: 'The Duty-Free',
        category: 'strip',
        blurb: 'Cheap booze, cheap food, cheap sponsors. Mind the tax on the way out.',
      },
    ],
  },
  {
    id: 'vatgrown',
    name: 'Vatgrown',
    vibe: 'Bio-lab; clone pups in jars',
    major: false,
    track: standard('medium'),
    foodBand: taste(0.75, 0, { vatSteak: 0.5 }),
    // GDD §8.1 named Vatgrown as where the Prime feed was. A bio-lab grows its steak in a vat.
    special: {},
    accents: ['#9BE84B', '#3FD6E0'],
    exploreDoors: [
      {
        name: 'The Clone Nursery',
        category: 'pound',
        blurb:
          'Pups in jars, labelled by batch. The lab is overstocked and not fussy about paperwork.',
      },
      {
        name: 'The Test Treadmills',
        category: 'track',
        blurb: 'Sensors, wires and a lab tech who will tell you exactly how your dog runs.',
      },
      {
        name: 'The Surplus Auction',
        category: 'strip',
        blurb: 'Whatever the lab grew too much of this week, going cheap.',
      },
    ],
  },
  {
    id: 'oldWembley',
    name: 'Old Wembley',
    vibe: 'Nostalgia dome rebuilding Earth tracks',
    major: false,
    track: standard('medium'),
    foodBand: taste(0.95, 0.1),
    // Nostalgists with a rule book. They test for everything and they watch the boxes too.
    special: { purseMult: 1.2 },
    accents: ['#2E8B57', '#F4F4F4'],
    exploreDoors: [
      {
        name: 'The Twin Towers Paddock',
        category: 'track',
        blurb: 'A rebuilt Earth paddock, sawdust and all. The old-timers will watch your dog work.',
      },
      {
        name: 'The Old Stand Bar',
        category: 'bar',
        blurb: 'Photographs of dogs that died centuries ago, and men who can name every one.',
      },
      {
        name: 'The Rescue Home',
        category: 'pound',
        blurb: 'A charity for retired racers. Some of them are not quite finished.',
      },
    ],
  },
  {
    id: 'hushmarket',
    name: 'Hushmarket',
    vibe: 'Black-market bazaar',
    major: false,
    track: standard('tight'),
    foodBand: taste(1.15, -0.35, { ambrosia: 0.6 }),
    // A black-market bazaar does not run a stewards' room worth the name.
    special: {},
    accents: ['#7A1F2B', '#F4C542'],
    exploreDoors: [
      {
        name: 'The Whisper Stalls',
        category: 'alley',
        blurb: 'Nothing is sold out loud. Everything is for sale.',
      },
      {
        name: 'The Bazaar',
        category: 'strip',
        blurb: 'Spices, silks and Ambrosia straight off the boat, if you can haggle.',
      },
      {
        name: "The Fence's Parlour",
        category: 'bar',
        blurb:
          'Tea, cakes and a very polite woman who knows where every crate in the sector is going.',
      },
    ],
  },
  {
    id: 'sunbleach',
    name: 'Sunbleach',
    vibe: 'Desert, twin suns',
    major: false,
    track: standard('medium', { hazard: 1.2 }),
    foodBand: taste(1.15, 0.2),
    special: { fitnessOnArrival: -5 },
    accents: ['#F7B267', '#F4C542'],
    exploreDoors: [
      {
        name: 'The Dune Run',
        category: 'track',
        blurb: 'Twin suns and deep sand. A dog that trains here is fit, or dead.',
      },
      {
        name: 'The Oasis Pound',
        category: 'pound',
        blurb: "Where the desert's strays come for water, and the caravans sell what they found.",
      },
      {
        name: 'The Shade Tents',
        category: 'alley',
        blurb: 'Out of the suns, out of sight. Business is done lying down.',
      },
    ],
  },
  {
    id: 'tinkertown',
    name: 'Tinkertown',
    vibe: 'Robot-run workshop planet',
    major: false,
    track: sprint('medium'),
    foodBand: taste(0.95, -0.1),
    special: {},
    accents: ['#3FD6E0', '#B87333'],
    exploreDoors: [
      {
        name: 'The Dyno Shop',
        category: 'track',
        blurb:
          'Robots will put your dog on rollers and print you a graph. They are never wrong about the graph.',
      },
      {
        name: 'The Parts Exchange',
        category: 'strip',
        blurb: 'Robots trading bolts for food they cannot eat. They drive a hard bargain anyway.',
      },
      {
        name: 'The Scrap Chute',
        category: 'alley',
        blurb:
          'Everything the robots throw away comes down here, and so do the people who want it.',
      },
    ],
  },
  {
    id: 'holyBark',
    name: 'Holy Bark',
    vibe: 'Monastery world; monks who worship the Good Boy',
    major: false,
    track: staying('wide'),
    foodBand: taste(0.75, 0.25, { ambrosia: 1.3 }),
    // ⚠️ No bookie means no sabotage here at all: §13's nobbling is a `betting`-phase action and
    // Holy Bark skips that phase entirely. A bought box is still possible, and the monks notice.
    special: { noBetting: true, fitnessOnArrival: 5 },
    accents: ['#F4F4F4', '#C9A227'],
    exploreDoors: [
      {
        name: 'The Almshouse',
        category: 'pound',
        blurb: 'The monks take in every stray on the planet, and bless the ones they rehome.',
      },
      {
        name: 'The Confessional',
        category: 'alley',
        blurb: 'The monks hear everything. For a donation, so can you.',
      },
      {
        name: 'The Cloister Walk',
        category: 'track',
        blurb: 'A quiet stone track round the abbey garden. The Good Boy watches.',
      },
    ],
  },
  {
    id: 'lagrangeLows',
    name: 'Lagrange Lows',
    vibe: 'Floating slum station',
    major: false,
    track: standard('tight'),
    foodBand: taste(1.2, 0.28),
    // ⚠️ Its one rule was that the locals were Nervy (−5% from traps 1 and 8), and Nervy left the
    // trait list in v3 Phase C (GDD_V3 §4.5). A floating slum keeps its tight bends and its food map;
    // Phase D's Back Alley door (§9.1) is where its character is meant to live now.
    special: {},
    accents: ['#9BE84B', '#1B1A22'],
    exploreDoors: [
      {
        name: 'The Under-Deck',
        category: 'alley',
        blurb: 'Below the waterline of a station with no water. The rent is paid in favours.',
      },
      {
        name: 'The Drip Bar',
        category: 'bar',
        blurb: 'Condensation falls in your glass. So do rumours.',
      },
      {
        name: 'The Stray Shelter',
        category: 'pound',
        blurb: 'A volunteer, a hosepipe and forty dogs nobody wanted. Yet.',
      },
    ],
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
