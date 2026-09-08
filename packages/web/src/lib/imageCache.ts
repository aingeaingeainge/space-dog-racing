/**
 * One image, loaded once, shared by everything that wants to draw it.
 *
 * Both compositors — the dog portraits and the race-view run cycles — need the same handful of
 * files, need them decoded before they can composite, and must never block a render waiting for
 * one. So: a promise per URL, kept forever (there are at most a few dozen), and a synchronous
 * peek for the render path, which draws its fallback on a miss and picks the art up on the next
 * frame or the next render.
 *
 * A file that fails to load resolves to null rather than rejecting. A missing image is a slot
 * that keeps its placeholder, never an error a screen has to catch.
 */

type Slot = { image: HTMLImageElement | null; done: boolean };

const slots = new Map<string, Slot>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** The decoded image if it is already here, otherwise null. Never starts a load. */
export function peekImage(url: string): HTMLImageElement | null {
  return slots.get(url)?.image ?? null;
}

/** True once we know one way or the other, so a caller can stop asking. */
export function imageSettled(url: string): boolean {
  return slots.get(url)?.done ?? false;
}

/** Load it, or hand back the load already in flight. Resolves to null if it will never arrive. */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  const hit = pending.get(url);
  if (hit) return hit;
  if (typeof document === 'undefined') return Promise.resolve(null);

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      slots.set(url, { image: img, done: true });
      resolve(img);
    };
    img.onerror = () => {
      slots.set(url, { image: null, done: true });
      resolve(null);
    };
    img.src = url;
  });
  pending.set(url, p);
  return p;
}
