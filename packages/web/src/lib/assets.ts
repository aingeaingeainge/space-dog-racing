import type { Id } from '@sdr/engine';

/**
 * Where the art lives, and how the game finds it.
 *
 * Every image is imported through Vite's glob so the built files are fingerprinted and served
 * from `dist/assets/` — nothing is inlined into the JS bundle and nothing is fetched by a
 * hand-written path that a rename could silently break.
 *
 * The placeholder convention, which is what makes "obviously unfinished" work without a
 * manifest to maintain: **placeholders are `.svg`, finished art is `.webp`.** The resolver
 * prefers `.webp`, so dropping the real file in takes over immediately, and anything still
 * showing an `.svg` is stamped PLACEHOLDER by whichever component drew it. Delete the `.svg`
 * once the `.webp` is in and nothing changes. See design/ASSET_LIST.md.
 */

type UrlMap = Record<string, string>;

const planets = import.meta.glob('../assets/planets/*/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

const events = import.meta.glob('../assets/events/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

const portraits = import.meta.glob('../assets/portraits/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

const dogs = import.meta.glob('../assets/dogs/**/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

const ui = import.meta.glob('../assets/ui/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

export interface Art {
  url: string;
  /** True while the file on disk is still the generated stand-in. */
  placeholder: boolean;
}

/** Finished art wins over a placeholder; nothing at all is null, and the caller draws chrome. */
function resolve(map: UrlMap, stem: string): Art | null {
  const webp = map[`${stem}.webp`];
  if (webp) return { url: webp, placeholder: false };
  const svg = map[`${stem}.svg`];
  if (svg) return { url: svg, placeholder: true };
  return null;
}

/** 1920×1080 painted hub backdrop, six hotspot regions left uncluttered (GDD §16). */
export function planetBackdrop(planetId: Id): Art | null {
  return resolve(planets, `../assets/planets/${planetId}/backdrop`);
}

/** 2048×2048 ground and scenery for the race view, drawn behind the code-drawn ribbon. */
export function planetGround(planetId: Id): Art | null {
  return resolve(planets, `../assets/planets/${planetId}/ground`);
}

/** 512×512 seamless racing-surface tile, painted along the track path. */
export function planetSurface(planetId: Id): Art | null {
  return resolve(planets, `../assets/planets/${planetId}/surface`);
}

/** 800×500 event card illustration, keyed by the engine's event id. */
export function eventArt(eventId: string): Art | null {
  return resolve(events, `../assets/events/${eventId}`);
}

/** 512×512 character portrait: an AI stable owner, a hireable, or Fat Tony. */
export function portraitArt(name: string): Art | null {
  return resolve(portraits, `../assets/portraits/${name}`);
}

/** One of the 12 base bodies, greyscale with black outlines, tinted in code. */
export function dogBody(body: number): Art | null {
  return resolve(dogs, `../assets/dogs/bodies/body-${String(body).padStart(2, '0')}`);
}

/** One of the 8 alien accessory overlays. */
export function dogAccessory(accessory: number): Art | null {
  return resolve(dogs, `../assets/dogs/accessories/accessory-${String(accessory).padStart(2, '0')}`);
}

/** The 8-frame top-down run cycle for a base body, nose-right. Session 2 feeds `spriteFor`. */
export function dogRunCycle(body: number): Art | null {
  return resolve(dogs, `../assets/dogs/run/run-${String(body).padStart(2, '0')}`);
}

/** A piece of UI furniture: panel plate, rivets, hazard tape, and the like. */
export function uiArt(name: string): Art | null {
  return resolve(ui, `../assets/ui/${name}`);
}
