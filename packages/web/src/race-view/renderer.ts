import type { Id, RaceResult } from '@sdr/engine';
import { createCamera, type Camera, type Viewport } from './camera';
import type { Pose, TrackGeometry } from './tracks';

/**
 * Canvas 2D replay of a race.
 *
 * The renderer reads `RaceResult.ticks` and nothing else — it never simulates, never rolls a
 * number and never decides a place. Finishing order comes from `result.order` and
 * `result.finishTicks`, so what is on screen cannot disagree with what the engine recorded.
 * Feed it the same log twice and you get the same race twice, frame timing aside.
 */

export interface RunnerStyle {
  /** Saddle-cloth colour — the stable's, or a dead grey for a local. */
  colour: string;
  /** Ink for the number on it. */
  ink: string;
  local: boolean;
  mine: boolean;
}

export interface RunnerSample {
  index: number;
  dogId: Id;
  trap: number;
  name: string;
  distance: number;
  pose: Pose;
  place: number;
  finished: boolean;
  /** Metres behind the leader; 0 for the leader. */
  behind: number;
}

export interface RaceSample {
  time: number;
  tick: number;
  runners: RunnerSample[];
  /** Same runners, in running order. */
  standing: RunnerSample[];
  leader: RunnerSample;
  /** Leader's fraction of the race distance, 0..1. */
  progress: number;
  finishedCount: number;
}

export interface RendererOptions {
  result: RaceResult;
  track: TrackGeometry;
  tickSeconds: number;
  styleFor(index: number): RunnerStyle;
  /**
   * M3 hook. Return a sprite for this dog and the renderer draws it, rotated to `heading`,
   * instead of the placeholder capsule. Until then every runner is a coloured capsule.
   */
  spriteFor?: (dogId: Id, heading: number) => CanvasImageSource | null;
}

export interface Renderer {
  /** Seconds of tick log. */
  duration: number;
  /** When the replay stops: shortly after third place, so the tail-enders are not dead air. */
  replayEnd: number;
  /** When the winner crosses — where a photo finish freezes. */
  winnerAt: number;
  sample(time: number): RaceSample;
  resize(): void;
  draw(time: number, opts?: { freeze?: boolean; dt?: number }): void;
}

const LURE_LEAD = 7;
const GROUP_METRES = 24;

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

export function createRenderer(canvas: HTMLCanvasElement, opts: RendererOptions): Renderer {
  const { result, track, tickSeconds } = opts;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser has no 2D canvas context.');
  const camera: Camera = createCamera();
  const entries = result.entries;
  const n = entries.length;
  const lastTick = Math.max(0, result.ticks.length - 1);
  const duration = lastTick * tickSeconds;

  const finishTickOf = (id: Id): number => result.finishTicks[id] ?? lastTick;
  const third = result.order[Math.min(2, result.order.length - 1)];
  const replayEnd = Math.min(
    duration,
    ((third ? finishTickOf(third) : lastTick) + 9) * tickSeconds,
  );
  const winnerAt = (result.order[0] ? finishTickOf(result.order[0]) : lastTick) * tickSeconds;

  let view: Viewport = { w: canvas.clientWidth || 960, h: canvas.clientHeight || 540 };
  let dpr = 1;
  let path: Path2D | null = null;

  function buildPath(): Path2D {
    const p = new Path2D();
    const pts = track.outline;
    p.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]!.x, pts[i]!.y);
    if (track.closed) p.closePath();
    return p;
  }

  function resize(): void {
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    view = { w, h };
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function sample(time: number): RaceSample {
    const raw = time / tickSeconds;
    const tick = Math.max(0, Math.min(lastTick, raw));
    const i0 = Math.floor(tick);
    const i1 = Math.min(lastTick, i0 + 1);
    const k = tick - i0;
    const rowA = result.ticks[i0] ?? [];
    const rowB = result.ticks[i1] ?? rowA;

    // The finished dogs are always a prefix of `order`: the engine appends to it as they cross.
    let finishedCount = 0;
    while (
      finishedCount < result.order.length &&
      finishTickOf(result.order[finishedCount]!) <= tick
    )
      finishedCount++;
    const placeOf = new Map<Id, number>();
    for (let i = 0; i < finishedCount; i++) placeOf.set(result.order[i]!, i + 1);

    const runners: RunnerSample[] = [];
    for (let i = 0; i < n; i++) {
      const e = entries[i]!;
      const distance = lerp(rowA[i] ?? 0, rowB[i] ?? 0, k);
      runners.push({
        index: i,
        dogId: e.dogId,
        trap: e.trap,
        name: e.name,
        distance,
        pose: track.runnerAt(distance, e.trap, n),
        place: placeOf.get(e.dogId) ?? 0,
        finished: placeOf.has(e.dogId),
        behind: 0,
      });
    }
    // Anyone still running is ranked behind everyone who has crossed, by distance.
    const running = runners.filter((r) => !r.finished).sort((a, b) => b.distance - a.distance);
    running.forEach((r, i) => {
      r.place = finishedCount + i + 1;
    });
    const standing = [...runners].sort((a, b) => a.place - b.place);
    const leader = standing[0]!;
    const front = Math.max(...runners.map((r) => r.distance));
    for (const r of runners) r.behind = Math.max(0, front - r.distance);

    return {
      time,
      tick,
      runners,
      standing,
      leader,
      progress: Math.max(0, Math.min(1, front / track.distance)),
      finishedCount,
    };
  }

  function screen(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: (p.x - camera.x) * camera.zoom + view.w / 2,
      y: (p.y - camera.y) * camera.zoom + view.h / 2,
    };
  }

  function drawTrack(): void {
    if (!path) path = buildPath();
    const w = track.halfWidth * 2;
    ctx!.lineCap = track.closed ? 'butt' : 'round';
    ctx!.lineJoin = 'round';
    // Rail, then surface on top of it, so both edges get an outline for free.
    ctx!.strokeStyle = '#0e0d13';
    ctx!.lineWidth = w + 1.6;
    ctx!.stroke(path);
    ctx!.strokeStyle = '#3a2b21';
    ctx!.lineWidth = w;
    ctx!.stroke(path);
    // The rail the dogs hug.
    ctx!.save();
    ctx!.setLineDash([6, 5]);
    ctx!.strokeStyle = 'rgba(244, 197, 66, 0.16)';
    ctx!.lineWidth = 0.25;
    ctx!.stroke(path);
    ctx!.restore();
  }

  function drawLine(pose: Pose, style: 'finish' | 'start'): void {
    const nx = -pose.hy;
    const ny = pose.hx;
    const half = track.halfWidth;
    if (style === 'start') {
      ctx!.strokeStyle = 'rgba(155, 232, 75, 0.5)';
      ctx!.lineWidth = 0.3;
      ctx!.beginPath();
      ctx!.moveTo(pose.x - nx * half, pose.y - ny * half);
      ctx!.lineTo(pose.x + nx * half, pose.y + ny * half);
      ctx!.stroke();
      return;
    }
    const squares = 10;
    const step = (half * 2) / squares;
    const depth = 1.6;
    for (let i = 0; i < squares; i++) {
      const a = -half + i * step;
      ctx!.fillStyle = i % 2 ? '#12111a' : '#f4f4f4';
      ctx!.beginPath();
      ctx!.moveTo(pose.x + nx * a, pose.y + ny * a);
      ctx!.lineTo(pose.x + nx * (a + step), pose.y + ny * (a + step));
      ctx!.lineTo(
        pose.x + nx * (a + step) + pose.hx * depth,
        pose.y + ny * (a + step) + pose.hy * depth,
      );
      ctx!.lineTo(pose.x + nx * a + pose.hx * depth, pose.y + ny * a + pose.hy * depth);
      ctx!.closePath();
      ctx!.fill();
    }
  }

  function drawLure(distance: number): void {
    const pose = track.runnerAt(distance + LURE_LEAD, 0.6, 8);
    const a = Math.atan2(pose.hy, pose.hx);
    ctx!.save();
    ctx!.translate(pose.x, pose.y);
    ctx!.rotate(a);
    ctx!.fillStyle = 'rgba(63, 214, 224, 0.22)';
    ctx!.beginPath();
    ctx!.ellipse(0, 0, 2.4, 1.2, 0, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.fillStyle = '#3fd6e0';
    ctx!.strokeStyle = '#0e0d13';
    ctx!.lineWidth = 0.16;
    ctx!.beginPath();
    ctx!.ellipse(0, 0, 1.1, 0.42, 0, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.stroke();
    ctx!.restore();
  }

  function drawRunner(r: RunnerSample, style: RunnerStyle): void {
    const a = Math.atan2(r.pose.hy, r.pose.hx);
    const sprite = opts.spriteFor?.(r.dogId, a);
    ctx!.save();
    ctx!.translate(r.pose.x, r.pose.y);
    ctx!.rotate(a);
    ctx!.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx!.beginPath();
    ctx!.ellipse(-0.15, 0.35, 1.35, 0.6, 0, 0, Math.PI * 2);
    ctx!.fill();
    if (sprite) {
      // M3 drops real run cycles in here; the capsule below is the placeholder until then.
      ctx!.drawImage(sprite as CanvasImageSource, -1.4, -0.6, 2.8, 1.2);
      ctx!.restore();
      return;
    }
    const len = 2.6;
    const wid = 1.12;
    ctx!.beginPath();
    ctx!.moveTo(-len / 2 + wid / 2, -wid / 2);
    ctx!.lineTo(len / 2 - wid / 2, -wid / 2);
    ctx!.quadraticCurveTo(len / 2 + 0.25, 0, len / 2 - wid / 2, wid / 2);
    ctx!.lineTo(-len / 2 + wid / 2, wid / 2);
    ctx!.quadraticCurveTo(-len / 2 - 0.2, 0, -len / 2 + wid / 2, -wid / 2);
    ctx!.closePath();
    ctx!.fillStyle = style.colour;
    ctx!.fill();
    ctx!.lineWidth = style.mine ? 0.26 : 0.18;
    ctx!.strokeStyle = style.mine ? '#9be84b' : '#0e0d13';
    ctx!.stroke();
    // A snout, so which way it is pointing reads at a glance.
    ctx!.fillStyle = '#0e0d13';
    ctx!.beginPath();
    ctx!.ellipse(len / 2 - 0.15, 0, 0.22, 0.26, 0, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.restore();
  }

  function drawNumber(r: RunnerSample, style: RunnerStyle): void {
    // Numbers are drawn in screen space so they stay crisp and upright at every zoom.
    const p = screen(r.pose);
    const size = Math.max(9, Math.min(15, camera.zoom * 0.95));
    ctx!.font = `700 ${size}px "Space Mono", ui-monospace, monospace`;
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.lineWidth = 3;
    ctx!.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx!.strokeText(String(r.trap), p.x, p.y);
    ctx!.fillStyle = style.ink;
    ctx!.fillText(String(r.trap), p.x, p.y);
  }

  function draw(time: number, drawOpts?: { freeze?: boolean; dt?: number }): void {
    const s = sample(time);
    const freeze = !!drawOpts?.freeze;
    const dt = drawOpts?.dt ?? 1 / 60;

    const focus: { x: number; y: number }[] = [];
    if (freeze) {
      const line = track.poseAt(track.distance);
      focus.push(line);
      for (const r of s.standing.slice(0, 3)) focus.push(r.pose);
    } else {
      const front = s.leader.distance;
      for (const r of s.runners) if (front - r.distance <= GROUP_METRES) focus.push(r.pose);
      focus.push(track.runnerAt(front + LURE_LEAD, 0.6, 8));
    }
    const frame = { points: focus, progress: freeze ? 1 : s.progress };
    if (dt >= 0.5) camera.snap(frame, view);
    else camera.follow(frame, view, dt);

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = '#16151d';
    ctx!.fillRect(0, 0, view.w, view.h);
    ctx!.save();
    camera.apply(ctx!, view);

    drawTrack();
    if (!track.closed) drawLine(track.poseAt(0), 'start');
    drawLine(track.poseAt(track.distance), 'finish');
    drawLure(s.leader.distance);
    // Back markers first, so the leaders are drawn over the field.
    for (const r of [...s.standing].reverse()) drawRunner(r, opts.styleFor(r.index));

    ctx!.restore();
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const r of s.standing) drawNumber(r, opts.styleFor(r.index));
  }

  resize();
  return { duration, replayEnd, winnerAt, sample, resize, draw };
}
