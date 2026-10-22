/**
 * The race-view camera: pans to the leading group and zooms with it, easing on both so nothing
 * snaps. Purely cosmetic — it never touches the tick log, so two runs of the same race look the
 * same wherever the camera happens to be.
 */

export interface Viewport {
  /** CSS pixels. */
  w: number;
  h: number;
}

export interface CameraFrame {
  /** Points that must stay in shot, in world metres. */
  points: readonly { x: number; y: number }[];
  /** 0..1 — how far through the race the leader is. Used to tighten up for the finish. */
  progress: number;
}

export interface Camera {
  x: number;
  y: number;
  /** Pixels per metre. */
  zoom: number;
  /**
   * Phase S: true when the picture is turned a quarter left — an upright phone, where the track's
   * long axis is laid along the tall side of the screen instead of across the narrow one, so the
   * field is drawn twice the size. World +x points up the screen.
   */
  turned: boolean;
  /** Ease toward the frame. `dt` in seconds; frame-rate independent. */
  follow(frame: CameraFrame, view: Viewport, dt: number): void;
  /** Jump straight there — for the first frame of a race, and after a skip. */
  snap(frame: CameraFrame, view: Viewport): void;
  /** Set the world transform on a context already scaled for the device pixel ratio. */
  apply(ctx: CanvasRenderingContext2D, view: Viewport): void;
}

/** Metres visible across the viewport, before and during the run to the line. */
const WIDE_MIN = 62;
const WIDE_MAX = 145;
const FINISH_MIN = 42;
const FINISH_MAX = 88;
/** Below this the picture is all track and no dogs. */
const MIN_ZOOM = 2.2;
const MAX_ZOOM = 26;
const PAN_LAMBDA = 6;
const ZOOM_LAMBDA = 3.2;

function ease(from: number, to: number, lambda: number, dt: number): number {
  // 1 - e^-λt: the same easing whatever the frame rate. The renderer may use exp freely; only
  // the engine is held to the determinism rules.
  return from + (to - from) * (1 - Math.exp(-lambda * Math.max(0, dt)));
}

/** An upright picture, a third taller than it is wide: a phone. Turn the track to lie along it. */
export function isTurned(view: Viewport): boolean {
  return view.h > view.w * 1.33;
}

function target(frame: CameraFrame, view: Viewport) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of frame.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, zoom: 8 };

  // Tighten as the leader comes to the line, so the finish is the closest shot of the race.
  const closing = Math.max(0, Math.min(1, (frame.progress - 0.82) / 0.18));
  // v3 Phase R: a phone held upright has a tall, narrow picture, and the minimum shot is metres
  // *across* it — so the field was drawn at half the size the height had room for. Upright, the
  // minimum shrinks with the aspect (never below 55%); a landscape screen is exactly as before.
  // Phase S: a picture tall enough to be turned is measured turned (see `isTurned`), so it is a
  // landscape picture here and this only applies to one that is a little taller than wide.
  const turned = isTurned(view);
  if (turned) view = { w: view.h, h: view.w };
  // A turned phone is still a small screen: come in closer than a laptop would, and leave less
  // margin either side of the field, or the dogs are drawn the size of ants.
  const portrait = turned ? 0.7 : view.h > view.w ? Math.max(0.55, view.w / view.h) : 1;
  const wide = (WIDE_MAX + (FINISH_MAX - WIDE_MAX) * closing) * portrait;
  const tight = (WIDE_MIN + (FINISH_MIN - WIDE_MIN) * closing) * portrait;

  const spanX = Math.max(maxX - minX + 26, tight);
  const spanY = maxY - minY + (turned ? 12 : 20);
  const byX = view.w / Math.min(spanX, wide);
  const byY = spanY > 0 ? view.h / spanY : byX;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(byX, byY)));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
}

export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 8,
    turned: false,
    follow(frame, view, dt) {
      this.turned = isTurned(view);
      const t = target(frame, view);
      this.x = ease(this.x, t.x, PAN_LAMBDA, dt);
      this.y = ease(this.y, t.y, PAN_LAMBDA, dt);
      this.zoom = ease(this.zoom, t.zoom, ZOOM_LAMBDA, dt);
    },
    snap(frame, view) {
      this.turned = isTurned(view);
      const t = target(frame, view);
      this.x = t.x;
      this.y = t.y;
      this.zoom = t.zoom;
    },
    apply(ctx, view) {
      ctx.translate(view.w / 2, view.h / 2);
      if (this.turned) ctx.rotate(-Math.PI / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x, -this.y);
    },
  };
}
