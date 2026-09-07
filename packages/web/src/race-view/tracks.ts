import { planetOf, type Id, type Track } from '@sdr/engine';

/**
 * Track geometry for the race view.
 *
 * Presentation only. Nothing here decides anything: the engine has already run the race and the
 * renderer replays its tick log along these paths, so distance-along-track is an input, never an
 * output. That is also why this lives in packages/web — anything under `packages/engine/src`
 * falls under the no-Math.pow determinism rule (M0 notes) and would churn the golden snapshot
 * for a shape nobody races on.
 *
 * One path per planet, built from that planet's GDD §12 track: the distance is the length of the
 * lap, the bend description sets the radius, and two planets get their own shape — a ring for
 * The Drift's orbital scrapyard, a straight for Blackreach's "no bends (straight!)".
 *
 * Coordinates are metres in a y-down (canvas) world. Dogs run anti-clockwise as they do on a
 * real track, which with y down means every bend is a left turn.
 */

export interface Pose {
  x: number;
  y: number;
  /** Unit heading. The right-hand normal — the outside of the track — is (-hy, hx). */
  hx: number;
  hy: number;
}

export type TrackShape = 'oval' | 'ring' | 'straight';

type Seg =
  | { kind: 'line'; x0: number; y0: number; hx: number; hy: number; len: number }
  /** Swept with the angle *decreasing*, so the turn is to the left in a y-down world. */
  | { kind: 'arc'; cx: number; cy: number; r: number; a0: number; len: number };

export interface TrackGeometry {
  planetId: Id;
  shape: TrackShape;
  /** Race distance in metres — one lap of this path. */
  distance: number;
  closed: boolean;
  laneWidth: number;
  /** Half the racing surface, in metres. */
  halfWidth: number;
  bounds: { x: number; y: number; w: number; h: number };
  /** Where a runner is after `d` metres. Past the line it runs on straight, it does not lap. */
  poseAt(d: number): Pose;
  /** Where the dog in `trap` is after `d` metres. Trap 1 hugs the rail. */
  runnerAt(d: number, trap: number, traps: number): Pose;
  /** Centreline sampled every metre or so, for drawing. */
  outline: readonly { x: number; y: number }[];
  /** Every 100 m mark, for the distance boards. */
  markers: readonly { d: number; pose: Pose }[];
}

const LANE_WIDTH = 1.35;
const RAIL_MARGIN = 1.1;
const TAU = Math.PI * 2;

/**
 * How much of the lap the two bends eat. Wide bends have a bigger radius, so on a track of fixed
 * length they take *more* of it and leave shorter straights; tight bends are the other way round.
 */
function bendFraction(track: Track): number {
  switch (track.bends) {
    case 'wide':
      return 0.62;
    case 'medium':
      return 0.5;
    case 'tight':
      return 0.38;
    default:
      return 0;
  }
}

function line(x0: number, y0: number, hx: number, hy: number, len: number): Seg {
  return { kind: 'line', x0, y0, hx, hy, len };
}

function arc(cx: number, cy: number, r: number, a0: number): Seg {
  return { kind: 'arc', cx, cy, r, a0, len: Math.PI * r };
}

function ovalSegs(distance: number, frac: number): Seg[] {
  const r = (frac * distance) / TAU;
  const straight = ((1 - frac) * distance) / 2;
  return [
    // Bottom straight, running right, with the finish line behind it at d = 0.
    line(0, 2 * r, 1, 0, straight),
    // Right-hand bend, swept from the bottom of the circle round to the top.
    arc(straight, r, r, Math.PI / 2),
    // Top straight, running back left.
    line(straight, 0, -1, 0, straight),
    // Left-hand bend, closing the lap.
    arc(0, r, r, -Math.PI / 2),
  ];
}

function ringSegs(distance: number): Seg[] {
  const r = distance / TAU;
  // Two half-circles rather than one, so the arithmetic below never has to wrap past a full turn.
  return [arc(0, 0, r, Math.PI / 2), arc(0, 0, r, -Math.PI / 2)];
}

function segPose(seg: Seg, u: number): Pose {
  if (seg.kind === 'line') {
    return { x: seg.x0 + seg.hx * u, y: seg.y0 + seg.hy * u, hx: seg.hx, hy: seg.hy };
  }
  const a = seg.a0 - u / seg.r;
  return {
    x: seg.cx + seg.r * Math.cos(a),
    y: seg.cy + seg.r * Math.sin(a),
    hx: Math.sin(a),
    hy: -Math.cos(a),
  };
}

function build(planetId: Id): TrackGeometry {
  const planet = planetOf(planetId);
  const track = planet.track;
  const distance = track.distance;
  const shape: TrackShape =
    planetId === 'drift' ? 'ring' : track.bends === 'none' ? 'straight' : 'oval';

  const segs: Seg[] =
    shape === 'ring'
      ? ringSegs(distance)
      : shape === 'straight'
        ? [line(0, 0, 1, 0, distance)]
        : ovalSegs(distance, bendFraction(track));

  const starts: number[] = [];
  let total = 0;
  for (const seg of segs) {
    starts.push(total);
    total += seg.len;
  }
  const halfWidth = (LANE_WIDTH * 8) / 2 + RAIL_MARGIN;

  function poseOnPath(d: number): Pose {
    if (d <= 0) {
      const p = segPose(segs[0]!, 0);
      return { ...p, x: p.x + p.hx * d, y: p.y + p.hy * d };
    }
    if (d >= total) {
      // Past the line the dogs run on rather than starting another lap.
      const last = segs[segs.length - 1]!;
      const p = segPose(last, last.len);
      const over = d - total;
      return { ...p, x: p.x + p.hx * over, y: p.y + p.hy * over };
    }
    let i = segs.length - 1;
    while (i > 0 && starts[i]! > d) i--;
    return segPose(segs[i]!, d - starts[i]!);
  }

  const outline: { x: number; y: number }[] = [];
  const step = 1.5;
  for (let d = 0; d <= total; d += step) {
    const p = poseOnPath(d);
    outline.push({ x: p.x, y: p.y });
  }
  const closed = shape !== 'straight';
  if (!closed) {
    const p = poseOnPath(total);
    outline.push({ x: p.x, y: p.y });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = halfWidth + 2;

  const markers: { d: number; pose: Pose }[] = [];
  for (let d = 100; d < total - 20; d += 100) markers.push({ d, pose: poseOnPath(d) });

  return {
    planetId,
    shape,
    distance,
    closed,
    laneWidth: LANE_WIDTH,
    halfWidth,
    bounds: {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    },
    outline,
    markers,
    poseAt: poseOnPath,
    runnerAt(d, trap, traps) {
      const p = poseOnPath(d);
      const lateral = (trap - (traps + 1) / 2) * LANE_WIDTH;
      return { x: p.x - p.hy * lateral, y: p.y + p.hx * lateral, hx: p.hx, hy: p.hy };
    },
  };
}

const cache = new Map<Id, TrackGeometry>();

/** The track for a planet. Built once and kept — the shape never changes during a season. */
export function trackFor(planetId: Id): TrackGeometry {
  const hit = cache.get(planetId);
  if (hit) return hit;
  const built = build(planetId);
  cache.set(planetId, built);
  return built;
}

/** One line of plain English about the shape, for the HUD. */
export function trackBlurb(planetId: Id): string {
  const planet = planetOf(planetId);
  const t = planet.track;
  const shape =
    planetId === 'drift' ? 'ring' : t.bends === 'none' ? 'straight' : `${t.bends} bends`;
  const going = t.slippery ? ', slippery' : t.mud ? ', muddy' : '';
  return `${t.distance} m ${shape}${going}`;
}
