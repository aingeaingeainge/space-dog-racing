import type { Dog } from '@sdr/engine';
import { dogAccessory, dogBody } from './assets';
import { loadImage } from './imageCache';

/**
 * The dog portrait compositor (GDD §16, §5.5).
 *
 * `Dog.look = { body 0–11, palette 0–5, accessory 0–7 }` has been on every dog since M0. The
 * bodies and the accessories are painted files; the six palettes are **data**, decided here —
 * M3 session 1 asked and Jesse chose colour over 12 × 6 = 72 painted bodies, which is why one
 * body is only ever drawn once and a seventh coat costs a table row rather than twelve images.
 *
 * How the tint works: the bodies are painted in neutral greys with chunky black outlines, so a
 * `multiply` pass carries the coat while leaving the outlines black and the shadows dark. That
 * means every colour in the table below is the colour the *lightest* fur becomes — a black dog
 * is a light soot-violet here and lands nearly black on the canvas. `destination-in` puts the
 * body's own alpha back afterwards, so nothing bleeds outside the dog.
 */

export interface CoatPalette {
  id: string;
  /** What a racing manager would call it. Shown in the portrait's tooltip. */
  name: string;
  /** Multiplied over the greys: the colour the brightest fur becomes. */
  coat: string;
  /** Brindle's dark barring, drawn into the same multiply pass. */
  stripes?: { colour: string; width: number; gap: number; angle: number };
  /** A second colour washed over the head end, for the parti-coloured coats. */
  wash?: { colour: string; from: number; to: number };
}

/**
 * The six stable coats. Real greyhound colours — black, blue, fawn, brindle, white-and-red and
 * red — pulled towards the GDD §16 palette so a dog sits in the same world as the charcoal
 * `#1B1A22`, the rust `#6B3A22` and the four accents rather than looking photographed.
 *
 * A seventh coat goes here: one row, and `Dog.look.palette` starts landing on it as soon as the
 * engine rolls a 6. Nothing else in the game counts them.
 */
export const COAT_PALETTES: CoatPalette[] = [
  { id: 'black', name: 'black', coat: '#6E6979' },
  { id: 'blue', name: 'blue', coat: '#93A6B6' },
  { id: 'fawn', name: 'fawn', coat: '#E0B076' },
  {
    id: 'brindle',
    name: 'brindle',
    coat: '#D3A165',
    stripes: { colour: '#6B4526', width: 9, gap: 22, angle: -0.32 },
  },
  {
    id: 'whitered',
    name: 'white and red',
    coat: '#F1EADB',
    wash: { colour: '#B9553A', from: 0.02, to: 0.52 },
  },
  { id: 'red', name: 'red', coat: '#C86A42' },
];

export function coatFor(palette: number): CoatPalette {
  return COAT_PALETTES[((palette % COAT_PALETTES.length) + COAT_PALETTES.length) % COAT_PALETTES.length]!;
}

/** One canonical size, scaled down by whoever draws it: a card at 84–132 px, a table chip at 26. */
const PORTRAIT_PX = 192;
/** Composites are big. Keep the most recently wanted looks and let the rest go. */
const CACHE_LIMIT = 40;

export interface Look {
  body: number;
  palette: number;
  accessory: number;
}

export function lookKey(look: Look): string {
  return `${look.body}|${look.palette}|${look.accessory}`;
}

const composites = new Map<string, HTMLCanvasElement>();
/** Looks we have already tried and cannot draw, so a render does not ask forever. */
const hopeless = new Set<string>();

function remember(key: string, canvas: HTMLCanvasElement): void {
  composites.set(key, canvas);
  while (composites.size > CACHE_LIMIT) {
    const oldest = composites.keys().next().value;
    if (oldest === undefined) break;
    composites.delete(oldest);
  }
}

/** Only finished art is composited. A stand-in keeps the labelled slot, which says more. */
function finishedUrl(art: { url: string; placeholder: boolean } | null): string | null {
  return art && !art.placeholder ? art.url : null;
}

function paintStripes(
  g: CanvasRenderingContext2D,
  px: number,
  s: NonNullable<CoatPalette['stripes']>,
): void {
  const reach = px * 1.6;
  g.save();
  g.translate(px / 2, px / 2);
  g.rotate(s.angle);
  g.fillStyle = s.colour;
  for (let x = -reach; x < reach; x += s.width + s.gap) {
    g.fillRect(x, -reach, s.width, reach * 2);
  }
  g.restore();
}

function paintWash(
  g: CanvasRenderingContext2D,
  px: number,
  w: NonNullable<CoatPalette['wash']>,
): void {
  const grad = g.createLinearGradient(0, px * w.from, 0, px * w.to);
  grad.addColorStop(0, w.colour);
  // White is the identity under multiply, so the wash simply stops.
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.fillRect(0, 0, px, px);
}

/** Body, tinted, then the accessory on top in its own colours. */
function compose(
  body: HTMLImageElement,
  accessory: HTMLImageElement | null,
  coat: CoatPalette,
): HTMLCanvasElement {
  const px = PORTRAIT_PX;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d')!;

  g.drawImage(body, 0, 0, px, px);

  g.globalCompositeOperation = 'multiply';
  g.fillStyle = coat.coat;
  g.fillRect(0, 0, px, px);
  if (coat.stripes) paintStripes(g, px, coat.stripes);
  if (coat.wash) paintWash(g, px, coat.wash);
  // A little grime under the chest, so the dog sits on the card rather than floating on it.
  const dirt = g.createLinearGradient(0, px * 0.55, 0, px);
  dirt.addColorStop(0, '#ffffff');
  dirt.addColorStop(1, '#b9b2c2');
  g.fillStyle = dirt;
  g.fillRect(0, 0, px, px);

  // Multiply filled the whole frame; the body's own alpha is what says where the dog is.
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(body, 0, 0, px, px);

  g.globalCompositeOperation = 'source-over';
  if (accessory) g.drawImage(accessory, 0, 0, px, px);
  return canvas;
}

/** The finished portrait if it is already composited, otherwise null. Never starts work. */
export function peekPortrait(look: Look): HTMLCanvasElement | null {
  return composites.get(lookKey(look)) ?? null;
}

/**
 * Composite this look, or hand back the one already made. Resolves to null when there is no
 * finished body art — the caller keeps its labelled slot, which is the whole degrade path.
 */
export async function portraitFor(look: Look): Promise<HTMLCanvasElement | null> {
  const key = lookKey(look);
  const hit = composites.get(key);
  if (hit) return hit;
  if (hopeless.has(key)) return null;
  if (typeof document === 'undefined') return null;

  const bodyUrl = finishedUrl(dogBody(look.body));
  if (!bodyUrl) {
    hopeless.add(key);
    return null;
  }
  const accessoryUrl = finishedUrl(dogAccessory(look.accessory));

  const [body, accessory] = await Promise.all([
    loadImage(bodyUrl),
    accessoryUrl ? loadImage(accessoryUrl) : Promise.resolve(null),
  ]);
  // A body that will not load is a slot, not an error, and never an empty box.
  if (!body) {
    hopeless.add(key);
    return null;
  }
  const made = compose(body, accessory, coatFor(look.palette));
  remember(key, made);
  return made;
}

/** True if there is finished body art for this look at all — the answer without loading it. */
export function hasPortraitArt(look: Look): boolean {
  return !!finishedUrl(dogBody(look.body));
}

/** Draw a composited portrait into a visible canvas at its own device resolution. */
export function paintPortrait(target: HTMLCanvasElement, art: HTMLCanvasElement): void {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = Math.max(1, Math.round((target.clientWidth || 84) * dpr));
  const h = Math.max(1, Math.round((target.clientHeight || 84) * dpr));
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const g = target.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  g.drawImage(art, 0, 0, w, h);
}

/** What the portrait's tooltip says: the coat, and which three layers made it. */
export function lookTitle(dog: Dog): string {
  const coat = coatFor(dog.look.palette);
  return `${dog.name} — ${coat.name} coat (body ${dog.look.body}, accessory ${dog.look.accessory})`;
}

/** Warm the cache for a screenful of dogs, so a table does not pop in a row at a time. */
export function prefetchPortraits(looks: readonly Look[]): void {
  for (const look of looks) void portraitFor(look);
}

/** Only used by the tests and the checks: forget everything and start again. */
export function resetPortraitCache(): void {
  composites.clear();
  hopeless.clear();
}
