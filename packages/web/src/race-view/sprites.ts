import { dogRunCycle } from '../lib/assets';
import { loadImage, peekImage } from '../lib/imageCache';

/**
 * Run cycles for the race view.
 *
 * One sheet per base body: eight 280×120 frames in a row, nose-right, painted in neutral greys
 * (design/ASSET_LIST.md, group `run`). The renderer draws a frame after `translate(x, y);
 * rotate(heading)` at 2.8 m × 1.2 m, so the sheet is sliced but never rotated here.
 *
 * Two things this module exists to guarantee:
 *
 * 1. **The frame comes from distance run, not from the clock.** `frameFor` is a pure function
 *    of metres, so the same tick log looks identical at 1×, at 2× and after a skip — the same
 *    promise race-view-check.ts holds the rest of the renderer to.
 * 2. **Nothing is tinted per frame.** Each (body, saddle-cloth colour) is sliced and tinted
 *    once into eight small canvases and kept. Eight runners cost eight sets for the whole race,
 *    not eight tint passes at 60 fps.
 */

const FRAMES = 8;
const FRAME_W = 280;
const FRAME_H = 120;

/** How much ground one complete eight-frame gallop covers. A racing greyhound's stride. */
export const STRIDE_METRES = 4.6;

type FrameSet = HTMLCanvasElement[] | null;

const sets = new Map<string, FrameSet>();
const asked = new Set<number>();

function key(body: number, colour: string | null): string {
  return `${body}|${colour ?? 'local'}`;
}

/** The sheet's URL, but only once it is finished art — a stand-in is not a run cycle. */
function sheetUrl(body: number): string | null {
  const art = dogRunCycle(body);
  return art && !art.placeholder ? art.url : null;
}

/**
 * Slice the sheet into eight frames, tinted with the stable's saddle cloth. The greys are
 * multiplied the same way the portraits are, so the black outlines stay black; a local dog
 * gets no tint at all and stays the dead grey the renderer already gives it.
 */
function build(sheet: HTMLImageElement, colour: string | null): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  // A sheet that is not exactly 2240 wide is still sliced into eight equal frames.
  const sw = Math.floor(sheet.naturalWidth / FRAMES) || FRAME_W;
  const sh = sheet.naturalHeight || FRAME_H;

  for (let i = 0; i < FRAMES; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const g = canvas.getContext('2d')!;
    g.drawImage(sheet, i * sw, 0, sw, sh, 0, 0, sw, sh);
    if (colour) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = colour;
      g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(sheet, i * sw, 0, sw, sh, 0, 0, sw, sh);
      g.globalCompositeOperation = 'source-over';
    }
    frames.push(canvas);
  }
  return frames;
}

/**
 * The eight frames for this body in this colour, or null while there is nothing to draw. Null
 * is not a failure: the renderer falls back to M2's capsule, which is a complete race view.
 */
export function runFrames(body: number, colour: string | null): HTMLCanvasElement[] | null {
  const k = key(body, colour);
  const hit = sets.get(k);
  if (hit !== undefined) return hit;

  const url = sheetUrl(body);
  if (!url) {
    sets.set(k, null);
    return null;
  }
  const sheet = peekImage(url);
  if (!sheet) {
    // Kick the load off once per body and let a later frame pick it up.
    if (!asked.has(body)) {
      asked.add(body);
      void loadImage(url);
    }
    return null;
  }
  if (typeof document === 'undefined') return null;
  const made = build(sheet, colour);
  sets.set(k, made);
  return made;
}

/** Which frame a dog is on after `distance` metres. Pure: no clock, no state, no speed. */
export function frameIndex(distance: number): number {
  const per = STRIDE_METRES / FRAMES;
  const i = Math.floor(distance / per);
  return ((i % FRAMES) + FRAMES) % FRAMES;
}

/** The sprite to draw for a dog that has run `distance` metres, or null to keep the capsule. */
export function spriteAt(
  body: number,
  colour: string | null,
  distance: number,
): HTMLCanvasElement | null {
  const frames = runFrames(body, colour);
  if (!frames) return null;
  return frames[frameIndex(distance)] ?? null;
}

/** Only used by the checks: forget every sliced sheet. */
export function resetSprites(): void {
  sets.clear();
  asked.clear();
}
