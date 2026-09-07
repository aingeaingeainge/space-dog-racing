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
  const wide = WIDE_MAX + (FINISH_MAX - WIDE_MAX) * closing;
  const tight = WIDE_MIN + (FINISH_MIN - WIDE_MIN) * closing;

  const spanX = Math.max(maxX - minX + 26, tight);
  const spanY = maxY - minY + 20;
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
    follow(frame, view, dt) {
      const t = target(frame, view);
      this.x = ease(this.x, t.x, PAN_LAMBDA, dt);
      this.y = ease(this.y, t.y, PAN_LAMBDA, dt);
      this.zoom = ease(this.zoom, t.zoom, ZOOM_LAMBDA, dt);
    },
    snap(frame, view) {
      const t = target(frame, view);
      this.x = t.x;
      this.y = t.y;
      this.zoom = t.zoom;
    },
    apply(ctx, view) {
      ctx.translate(view.w / 2, view.h / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x, -this.y);
    },
  };
}
