/**
 * The asset contract, as data.
 *
 * One list of every image the game expects. `make-placeholders.ts` writes a stand-in for each
 * entry; `asset-list.ts` writes design/ASSET_LIST.md from the same list. Neither can drift from
 * the other, and neither can drift from the engine's content, because the planets and events
 * come out of @sdr/engine rather than being retyped here.
 */
import { EVENTS, PLANETS, type Planet } from '@sdr/engine';
import {
  arrangementNameFor,
  ARRANGEMENTS,
  HOTSPOT_VENUES,
  type Arrangement,
} from '../src/lib/hotspots';

export type Tier = 1 | 2 | 3;

export interface AssetSpec {
  /** Path under packages/web/src/assets/, without an extension. */
  stem: string;
  group: string;
  w: number;
  h: number;
  /** Does the finished art need transparency? */
  alpha: boolean;
  targetKb: number;
  capKb: number;
  /** What the placeholder prints on itself. */
  label: string;
  /** Second line of the placeholder, and the "what this is" column of the list. */
  what: string;
  tier: Tier;
  /** Two hexes the placeholder is drawn in — the planet's accents where there are any. */
  accents: [string, string];
  /** Ready to paste into an image model. */
  prompt: string;
  /** Locked negative list for this group. */
  negative: string;
  /** Fixed seed band, so a re-roll stays in family. */
  seeds: string;
}

export interface AssetGroup {
  id: string;
  title: string;
  tier: Tier;
  blurb: string;
  assets: AssetSpec[];
}

const HOUSE: [string, string] = ['#9BE84B', '#3FD6E0'];

const STYLE =
  '1990s PC-game digital painting, chunky black outlines, flat cel shading, saturated grime — ' +
  "Gazillionaire's pastel cartooning crossed with Death Rally's soot and neon, everything " +
  'slightly held together with tape';

const NEG_SCENE =
  'photorealism, 3D render, photograph, text, letters, words, readable signage, watermark, ' +
  'signature, humans, human faces, gore, lens flare, depth-of-field blur, soft gradients, ' +
  'muddy colour, empty grey sky';

const NEG_SPRITE =
  'photorealism, 3D render, photograph, text, letters, watermark, signature, humans, ' +
  'background, ground, shadow on the ground, drop shadow, cast shadow, cropped limbs, ' +
  'soft gradients, motion blur';

const NEG_CHAR =
  'photorealism, 3D render, photograph, text, letters, watermark, signature, real celebrity ' +
  'likeness, gore, nudity, soft gradients, busy background';

/** Plain-English colour names for the accents, so a prompt reads like a brief and not a hex dump. */
const ACCENT_NAMES: Record<string, [string, string]> = {
  cosmodrome: ['imperial gold', 'oxblood red'],
  ossuary: ['bone white', 'deep violet'],
  blackreach: ['event-horizon cyan', 'near-black indigo'],
  collarPrime: ['hot pink', 'electric cyan'],
  kibbleton: ['hazard yellow', 'crop green'],
  rustgut: ['rust orange', 'dirt brown'],
  neonSnout: ['casino pink', 'acid green'],
  drift: ['scrap grey', 'warning yellow'],
  mudhaven: ['swamp green', 'bioluminescent green'],
  glassfall: ['ice blue', 'aurora violet'],
  portSlobber: ['sodium yellow', 'bruise purple'],
  vatgrown: ['culture green', 'lab cyan'],
  oldWembley: ['turf green', 'chalk white'],
  hushmarket: ['maroon', 'lamp yellow'],
  sunbleach: ['sand orange', 'twin-sun yellow'],
  tinkertown: ['coolant cyan', 'copper'],
  holyBark: ['linen white', 'brass gold'],
  lagrangeLows: ['sickly green', 'soot black'],
};

/** What each hotspot arrangement asks the composition to leave alone. */
export const ARRANGEMENT_BRIEF: Record<string, string> = {
  arc: 'an open sweep of ground rising left to right, with flat uncluttered patches at mid height and one clear patch centre-bottom',
  terraces:
    'stacked levels of a built-up place, with three uncluttered shopfront areas across the upper third and three more across the lower third',
  strip:
    'one lit street running left to right, with uncluttered frontages alternating high and low along it and a clear patch centre-bottom',
  ring: 'a hollow seen from its rim, uncluttered around all four edges and across the middle, with the detail in the ring between',
  canyon:
    'looking down into a cut, with uncluttered ledges high left and high right, a clear shelf mid-centre, and clear ground low down',
  gantry:
    'two decks of a structure, with three uncluttered bays across the upper third and three across the lower third, uprights between them',
};

function accentsOf(p: Planet): [string, string] {
  return p.accents ?? HOUSE;
}

function colourClause(p: Planet): string {
  const [a, b] = accentsOf(p);
  const [an, bn] = ACCENT_NAMES[p.id] ?? ['accent one', 'accent two'];
  return `Colour scheme ${an} ${a} and ${bn} ${b} over base charcoal #1B1A22 and rust #6B3A22`;
}

/** The track as a sentence, so a prompt reads like a brief. */
function trackClause(p: Planet): string {
  const bends = p.track.bends === 'none' ? 'dead straight, no bends at all' : `${p.track.bends} bends`;
  const extra = [
    p.track.hazard !== 1 ? 'the surface is hazardous and punishing' : null,
    p.track.slippery ? 'it is slippery underfoot' : null,
    p.track.mud ? 'it is wet and muddy' : null,
  ].filter(Boolean);
  return (
    `A ${p.track.distance} m ${p.track.length} circuit with ${bends}` +
    (extra.length ? `; ${extra.join(', and ')}` : '')
  );
}

/** Each planet gets its own 100-wide seed band so a re-roll stays in family (GDD §16). */
function seedBand(i: number, offset: number): string {
  const base = (i + 1) * 100 + offset;
  return `${base}–${base + 99}`;
}

function spotsLine(arrangement: Arrangement): string {
  return HOTSPOT_VENUES.map((v) => `${v} ${arrangement[v].x},${arrangement[v].y}`).join(' · ');
}

// ---------------------------------------------------------------- planets

const backdrops: AssetSpec[] = PLANETS.map((p, i) => {
  const arr = arrangementNameFor(p.id);
  const spots = ARRANGEMENTS[arr]!;
  return {
    stem: `planets/${p.id}/backdrop`,
    group: 'backdrops',
    w: 1920,
    h: 1080,
    alpha: false,
    targetKb: 160,
    capKb: 300,
    label: p.name,
    what: 'hub backdrop',
    tier: 1,
    accents: accentsOf(p),
    prompt:
      `${STYLE}. A grimy retro-future dog-racing venue on ${p.name}: ${p.vibe}. ` +
      `${trackClause(p)} — visible in the distance. ${colourClause(p)}. ` +
      `Composition: ${ARRANGEMENT_BRIEF[arr]} — those six areas must stay flat and uncluttered, ` +
      `because clickable signs are drawn over them at (percent of frame, x,y): ${spotsLine(spots)}. ` +
      `Keep the top-left corner clear for a name plate and the bottom-right corner clear for a stamp. ` +
      `Wide establishing view, comedic, no text of any kind, no humans, 16:9.`,
    negative: NEG_SCENE,
    seeds: seedBand(i, 0),
  };
});

const grounds: AssetSpec[] = PLANETS.map((p, i) => ({
  stem: `planets/${p.id}/ground`,
  group: 'grounds',
  w: 2048,
  h: 2048,
  alpha: false,
  targetKb: 200,
  capKb: 350,
  label: p.name,
  what: 'race-view ground',
  tier: 2,
  accents: accentsOf(p),
  prompt:
    `${STYLE}. Straight-down aerial view of the ground around a dog track on ${p.name}: ` +
    `${p.vibe}. Infield, surrounds, stands, junk and scenery — but NO track, NO ` +
    `running surface, NO lane markings and NO oval: the racing ribbon is drawn over this in code, ` +
    `so leave a broad clear band where it would run and fill the rest. ${colourClause(p)}. ` +
    `Flat top-down, even lighting, no perspective, no text, no humans, square 1:1.`,
  negative: `${NEG_SCENE}, race track, oval, lane lines, running surface, perspective, horizon`,
  seeds: seedBand(i, 20),
}));

const surfaces: AssetSpec[] = PLANETS.map((p, i) => ({
  stem: `planets/${p.id}/surface`,
  group: 'surfaces',
  w: 512,
  h: 512,
  alpha: false,
  targetKb: 40,
  capKb: 70,
  label: p.name,
  what: 'surface tile',
  tier: 2,
  accents: accentsOf(p),
  prompt:
    `${STYLE}. Seamless tileable texture of the racing surface on ${p.name}: ` +
    `${p.vibe}. ${trackClause(p)}. Close top-down detail of the ground itself — ` +
    `grit, scuffs, paw scrapes, stains — dark enough that bright saddle-cloth colours read on ` +
    `top of it. ${colourClause(p)}, but kept muted. Seamless on all four edges, flat top-down, ` +
    `no text, no objects, no track markings, square 1:1.`,
  negative: `${NEG_SCENE}, seams, borders, vignette, objects, lane lines, bright saturated colour`,
  seeds: seedBand(i, 40),
}));

// ---------------------------------------------------------------- dogs

const BODY_BRIEFS = [
  'a lean classic greyhound, long muzzle',
  'a scruffy rough-coated lurcher with a bent ear',
  'a whippet-thin runner with an oversized head',
  'a barrel-chested bruiser of a hound',
  'a six-legged alien greyhound',
  'a hound with three eyes in a row down its forehead',
  'a hound with two chrome prosthetic hind legs',
  'a translucent hound you can see the ribs through',
  'a long antennaed hound with insect feelers',
  'an ancient grey-muzzled veteran hound, scarred',
  'a leggy vat-grown pup, all knees and ears',
  'a shaggy tusked hound with a boar-like snout',
];

const ACCESSORY_BRIEFS = [
  'a cracked racing muzzle',
  'a studded leather collar with a dangling tag',
  'a pair of goggles pushed up on the head',
  'a rusty cybernetic jaw plate',
  'a bandaged foreleg and a torn ear',
  'a floating halo of small orbiting rocks',
  'a sponsor blanket with a hideous meat-paste mascot',
  'a set of glowing bio-tubes plugged into the shoulder',
];

const bodies: AssetSpec[] = BODY_BRIEFS.map((brief, i) => ({
  stem: `dogs/bodies/body-${String(i).padStart(2, '0')}`,
  group: 'bodies',
  w: 512,
  h: 512,
  alpha: true,
  targetKb: 35,
  capKb: 60,
  label: `body ${i}`,
  what: brief,
  tier: 1,
  accents: HOUSE,
  prompt:
    `${STYLE}. Portrait of ${brief} — head and shoulders, facing three-quarters left, ` +
    `cartoon space-greyhound of a grimy retro future. Painted in NEUTRAL GREYS AND WHITES ONLY ` +
    `with chunky black outlines: the game tints this in code with one of six stable palettes, so ` +
    `no colour of its own. Fully transparent background, nothing behind the dog, no ground, no ` +
    `shadow, no collar or gear (those are separate overlay layers), no text, square 1:1.`,
  negative: `${NEG_SPRITE}, colour, saturated hues, collar, muzzle, goggles, clothing`,
  seeds: `${2000 + i * 100}–${2099 + i * 100}`,
}));

const accessories: AssetSpec[] = ACCESSORY_BRIEFS.map((brief, i) => ({
  stem: `dogs/accessories/accessory-${String(i).padStart(2, '0')}`,
  group: 'accessories',
  w: 512,
  h: 512,
  alpha: true,
  targetKb: 20,
  capKb: 40,
  label: `accessory ${i}`,
  what: brief,
  tier: 1,
  accents: HOUSE,
  prompt:
    `${STYLE}. ${brief}, drawn on its own as an overlay layer to sit on a three-quarters-left ` +
    `space-greyhound head and shoulders. Same 512×512 frame and the same head position as the ` +
    `body layers, so it registers when stacked. Chunky black outlines, flat cel shading, grubby. ` +
    `Fully transparent everywhere except the item itself. No dog, no head, no background, no ` +
    `text, square 1:1.`,
  negative: `${NEG_SPRITE}, dog, animal, head, body, background`,
  seeds: `${3000 + i * 100}–${3099 + i * 100}`,
}));

const runCycles: AssetSpec[] = BODY_BRIEFS.map((brief, i) => ({
  stem: `dogs/run/run-${String(i).padStart(2, '0')}`,
  group: 'run',
  w: 2240,
  h: 120,
  alpha: true,
  targetKb: 45,
  capKb: 80,
  label: `run ${i}`,
  what: `${brief} — 8-frame run cycle`,
  tier: 2,
  accents: HOUSE,
  prompt:
    `${STYLE}. A horizontal 8-frame sprite sheet of a top-down running cycle for ${brief}, ` +
    `seen from DIRECTLY ABOVE. Eight equal frames of 280×120 pixels in a single row, each frame ` +
    `one step of a gallop, the dog NOSE-RIGHT. ` +
    // The framing has to be spelled out. The renderer maps a whole frame to 2.8 m × 1.2 m and
    // the placeholder capsule it replaces filled 93% of that, so a dog drawn politely inside
    // its frame arrives on the track at half the weight of the runners beside it.
    `THE DOG MUST FILL THE FRAME EDGE TO EDGE: nose within a few pixels of the right edge, tail ` +
    `reaching the left edge, the torso at least two thirds of the frame's height, and the legs ` +
    `touching the top and bottom edges at full stretch. No empty margin on any side. ` +
    `Neutral greys and whites only with chunky black outlines — the game tints and rotates this ` +
    `in code. Transparent background, no shadow, no ground, no text, frames identical in scale ` +
    `and centring so the cycle does not wobble.`,
  negative: `${NEG_SPRITE}, side view, perspective, colour, varying scale between frames, gaps, borders, empty margins, small subject, dog floating in the middle of the frame`,
  seeds: `${2000 + i * 100}–${2099 + i * 100}`,
}));

// ---------------------------------------------------------------- events

const eventCards: AssetSpec[] = EVENTS.map((e, i) => ({
  stem: `events/${e.id}`,
  group: 'events',
  w: 800,
  h: 500,
  alpha: false,
  targetKb: 70,
  capKb: 130,
  label: e.name,
  what: e.text.slice(0, 90),
  tier: 3,
  accents: HOUSE,
  prompt:
    `${STYLE}. Event card illustration: ${e.name}. ${e.text} ` +
    `A single readable comic moment on a grimy retro-future dog-racing circuit, acid green ` +
    `#9BE84B and hot pink #F04E98 accents over charcoal #1B1A22 and rust #6B3A22. ` +
    `Dark rather than cruel — nothing dies on screen. No text, no humans (aliens and dogs only), 8:5.`,
  negative: NEG_SCENE,
  seeds: `${5000 + i * 20}–${5019 + i * 20}`,
}));

// ---------------------------------------------------------------- portraits

const OWNER_BRIEFS = [
  'a tall aristocratic insectoid baroness in a moth-eaten fur',
  'a squat four-armed bookmaker chewing a cigar',
  'a nervous tentacled accountant with a clipboard',
  'a gold-toothed reptilian hustler in a loud suit',
  'a serene robed monk-alien with too many eyes',
  'a scarred ex-racer with a chrome jaw',
  'a beaming, terrifying corporate mascot in a mascot suit',
  'a tiny ancient crone riding a hovering chair',
  'a slick young heir in mirrored goggles',
  'a hulking slab of a bruiser in oil-stained overalls',
  'a fast-talking twin-headed promoter',
  'a dusty prospector alien with a lucky bone on a string',
];

const STAFF_BRIEFS: [string, string][] = [
  ['trainer-01', 'Gristle McGraw: a wiry old trainer with a whistle and a wandering eye'],
  ['trainer-02', 'a brisk younger trainer with a stopwatch and a clipboard'],
  ['vet-01', 'a four-handed vet in a stained smock holding a huge syringe'],
  ['vet-02', 'a gentle giant of a vet with reading spectacles and a bandage roll'],
  ['fixer-01', 'a fixer in a long coat, hands in pockets, standing in shadow'],
  ['fixer-02', 'a cheerful fixer with a briefcase full of things you should not have'],
  ['fat-tony', 'Fat Tony Nebula: an enormous, immaculately dressed loan shark, all rings and teeth'],
];

const ownerPortraits: AssetSpec[] = OWNER_BRIEFS.map((brief, i) => ({
  stem: `portraits/owner-${String(i + 1).padStart(2, '0')}`,
  group: 'portraits',
  w: 512,
  h: 512,
  alpha: true,
  targetKb: 50,
  capKb: 90,
  label: `owner ${i + 1}`,
  what: brief,
  tier: 3,
  accents: HOUSE,
  prompt:
    `${STYLE}. Character portrait of an AI stable owner: ${brief}. Head and shoulders, facing ` +
    `the viewer, comic and characterful, grimy retro-future dog-racing circuit. Acid green ` +
    `#9BE84B and hot pink #F04E98 accents over charcoal #1B1A22. Transparent background or a ` +
    `flat charcoal one, no text, square 1:1.`,
  negative: NEG_CHAR,
  seeds: `${7000 + i * 50}–${7049 + i * 50}`,
}));

const staffPortraits: AssetSpec[] = STAFF_BRIEFS.map(([id, brief], i) => ({
  stem: `portraits/${id}`,
  group: 'portraits',
  w: 512,
  h: 512,
  alpha: true,
  targetKb: 50,
  capKb: 90,
  label: id,
  what: brief,
  tier: 3,
  accents: HOUSE,
  prompt:
    `${STYLE}. Character portrait: ${brief}. Head and shoulders, facing the viewer, comic and ` +
    `characterful, grimy retro-future dog-racing circuit. Acid green #9BE84B and hazard yellow ` +
    `#F4C542 accents over charcoal #1B1A22. Transparent background or a flat charcoal one, ` +
    `no text, square 1:1.`,
  negative: NEG_CHAR,
  seeds: `${7600 + i * 50}–${7649 + i * 50}`,
}));

// ---------------------------------------------------------------- UI furniture

interface UiBrief {
  id: string;
  w: number;
  h: number;
  alpha: boolean;
  what: string;
  prompt: string;
  target: number;
  cap: number;
}

const UI_BRIEFS: UiBrief[] = [
  {
    id: 'plate',
    w: 512,
    h: 512,
    alpha: false,
    what: 'seamless brushed-metal panel tile',
    target: 30,
    cap: 60,
    prompt:
      'Seamless tileable dark brushed-metal plate, scratched and slightly greasy, chunky hand-painted 1990s PC-game look, charcoal #1B1A22 with faint rust #6B3A22 staining, even lighting, no rivets, no text, square 1:1.',
    },
  {
    id: 'rivet',
    w: 128,
    h: 128,
    alpha: true,
    what: 'a single rivet head',
    target: 8,
    cap: 20,
    prompt:
      'A single hand-painted steel rivet head seen straight on, chunky black outline, flat cel shading, slightly rusted, transparent background, nothing else in frame, 1:1.',
  },
  {
    id: 'hazard-tape',
    w: 512,
    h: 64,
    alpha: true,
    what: 'seamless hazard stripe strip',
    target: 8,
    cap: 20,
    prompt:
      'Seamless horizontal strip of scuffed hazard tape, diagonal hazard yellow #F4C542 and charcoal #1B1A22 stripes, chunky painted edges, peeling at the corners, transparent above and below the strip, tiles left to right, no text.',
  },
  {
    id: 'ticket',
    w: 1024,
    h: 256,
    alpha: false,
    what: 'ticket-stub paper texture',
    target: 25,
    cap: 50,
    prompt:
      'Flat scan-like texture of old manila raffle-ticket card, cream #EFE7D4, foxed and thumbed, faint fibre grain, torn perforation running down one short edge, painted 1990s PC-game look, no text, no numbers, tiles vertically.',
  },
  {
    id: 'slip',
    w: 768,
    h: 512,
    alpha: false,
    what: 'betting-slip paper',
    target: 25,
    cap: 50,
    prompt:
      'Flat texture of a small cheap betting slip, off-white #FDFAF2 paper with a maroon #7A1F2B printed header band, carbon smudges, one creased corner, painted 1990s PC-game look, no text, no numbers.',
  },
  {
    id: 'signpost',
    w: 1024,
    h: 256,
    alpha: true,
    what: 'planet-rules sign board',
    target: 25,
    cap: 50,
    prompt:
      'A battered rust-brown #6B3A22 metal sign board with bolted corners and a chipped hazard-yellow border, hanging slightly crooked, chunky black outlines, flat cel shading, blank face with no text, transparent background.',
  },
  {
    id: 'logo',
    w: 1200,
    h: 400,
    alpha: true,
    what: 'title wordmark plate',
    target: 40,
    cap: 80,
    prompt:
      'A chunky hand-painted metal nameplate for a dog-racing circuit, blank face ready for lettering, acid green #9BE84B neon tubing bent around a charcoal #1B1A22 plate, rivets at the corners, a bone motif at each end, grimy, chunky black outlines, transparent background, NO letters and NO words.',
  },
  ...HOTSPOT_VENUES.map((v) => ({
    id: `icon-${v}`,
    w: 128,
    h: 128,
    alpha: true,
    what: `hotspot icon: ${v}`,
    target: 8,
    cap: 20,
    prompt:
      `A single chunky painted icon for the ${v === 'stable' ? 'kennels' : v} of a grimy ` +
      `retro-future dog-racing planet, flat cel shading, thick black outline, acid green ` +
      `#9BE84B and hazard yellow #F4C542 on charcoal, readable at 40 pixels, transparent ` +
      `background, no text, 1:1.`,
  })),
];

const uiFurniture: AssetSpec[] = UI_BRIEFS.map((u, i) => ({
  stem: `ui/${u.id}`,
  group: 'ui',
  w: u.w,
  h: u.h,
  alpha: u.alpha,
  targetKb: u.target ?? 30,
  capKb: u.cap ?? 60,
  label: u.id,
  what: u.what,
  tier: 3,
  accents: HOUSE,
  prompt: `${STYLE}. ${u.prompt}`,
  negative: `${NEG_SPRITE}, dog, animal`,
  seeds: `${9000 + i * 20}–${9019 + i * 20}`,
}));

export const GROUPS: AssetGroup[] = [
  {
    id: 'backdrops',
    title: 'Planet hub backdrops',
    tier: 1,
    blurb:
      'One per planet, behind the six hotspots on the Planet hub. The single biggest change to ' +
      'how the game looks. Loaded lazily and only for the planet you are standing on.',
    assets: backdrops,
  },
  {
    id: 'bodies',
    title: 'Dog bodies',
    tier: 1,
    blurb:
      'The 12 base bodies of GDD §16, drawn in neutral greys so the compositor can tint each one ' +
      'with any of the six stable palettes. Dog.look.body indexes this list, 0–11.',
    assets: bodies,
  },
  {
    id: 'accessories',
    title: 'Dog accessories',
    tier: 1,
    blurb:
      'The 8 alien overlays, stacked on a body in the same 512×512 frame. Dog.look.accessory ' +
      'indexes this list, 0–7.',
    assets: accessories,
  },
  {
    id: 'grounds',
    title: 'Race-view ground',
    tier: 2,
    blurb:
      'Scenery under the race view, drawn behind the code-drawn track ribbon. NOT the track ' +
      'itself: race-view/tracks.ts owns the geometry and M3 does not move it, so nothing here ' +
      'has to line up with a spline.',
    assets: grounds,
  },
  {
    id: 'surfaces',
    title: 'Racing surface tiles',
    tier: 2,
    blurb: 'Seamless texture painted along the track ribbon, one per planet.',
    assets: surfaces,
  },
  {
    id: 'run',
    title: 'Dog run cycles',
    tier: 2,
    blurb:
      'One 8-frame top-down sheet per base body, nose-right. RendererOptions.spriteFor draws a ' +
      'frame after translate(x, y); rotate(heading) at 2.8 m × 1.2 m in world units, so a frame ' +
      'must be 7:3 and pointing right — 280×120 each, eight in a row. The dog has to fill its ' +
      'frame edge to edge: it replaces a capsule that occupied 93% of those 2.8 m × 1.2 m, and a ' +
      'dog drawn with a polite margin arrives on the track at half the weight of the runners ' +
      'beside it. run-00 was generated once with that margin and had to be redrawn; check the ' +
      'framing before generating the other eleven.',
    assets: runCycles,
  },
  {
    id: 'events',
    title: 'Event cards',
    tier: 3,
    blurb:
      'One 8:5 illustration per event id in the engine deck. The id is the filename; add an ' +
      'event to content/events.ts and it wants a new file with that name.',
    assets: eventCards,
  },
  {
    id: 'portraits',
    title: 'Character portraits',
    tier: 3,
    blurb:
      'Twelve AI stable owners (indexed like Dog.look, by stable number), six hireables and Fat ' +
      'Tony Nebula.',
    assets: [...ownerPortraits, ...staffPortraits],
  },
  {
    id: 'ui',
    title: 'UI furniture',
    tier: 3,
    blurb:
      'The textures behind the kit. Everything here already works as CSS — these only replace ' +
      'painted surfaces with painted surfaces, which is why they are last.',
    assets: uiFurniture,
  },
];

export const ASSETS: AssetSpec[] = GROUPS.flatMap((g) => g.assets);
