import { balance } from '../content/balance';
import type { Id, RaceEvent, Track, TraitId } from '../types';
import type { Rng } from '../rng';

/** Everything the simulator needs to know about one runner. Pure data: no ownership, no money. */
export interface Runner {
  id: Id;
  trap: number; // 1..8
  speed: number;
  accel: number;
  stamina: number;
  trapStat: number;
  fitness: number;
  form: number;
  traits: readonly TraitId[];
  speedBonus?: number; // supplement / lucky bone, in stat points
}

export interface RaceContext {
  track: Track;
  major: boolean;
}

export interface SimResult {
  order: Id[];
  finishTicks: Record<Id, number>;
  /** ticks[t][i] = distance of runners[i] at tick t (metres, 2 dp). */
  ticks: number[][];
  events: RaceEvent[];
  margin: number;
  photoFinish: boolean;
}

/** Fraction-of-distance windows that count as bends, by track shape. */
function bendWindows(track: Track): [number, number][] {
  if (track.bends === 'none') return [];
  switch (track.length) {
    case 'sprint':
      return [[0.3, 0.55]];
    case 'standard':
      return [
        [0.15, 0.35],
        [0.6, 0.8],
      ];
    case 'staying':
      return [
        [0.2, 0.38],
        [0.6, 0.78],
      ];
  }
}

function onBend(frac: number, windows: [number, number][]): boolean {
  for (const [a, b] of windows) if (frac >= a && frac <= b) return true;
  return false;
}

/**
 * Tick model ported from design/economy_sim.py run_race(), with the GDD §6.2 additions:
 * bend interference, trait modifiers and a tick log for the renderer. Every random number
 * comes from `rng`; the same runners + rng give the same race on any machine.
 */
export function simulateRace(runners: readonly Runner[], ctx: RaceContext, rng: Rng): SimResult {
  const n = runners.length;
  const { track } = ctx;
  const distance = track.distance;
  const dt = balance.raceTickSeconds;
  const windows = bendWindows(track);
  const bumpTicks = Math.max(1, Math.round(balance.raceBumpSeconds / dt));
  // The GDD's 10% "per encounter" chance is spread over the ticks two dogs typically spend
  // side by side on a bend (about half a second).
  const bumpPerTick = balance.raceBumpChance / bumpTicks;
  const bendMult = track.bends === 'tight' ? 1.5 : track.bends === 'wide' ? 0.6 : 1;

  const pos = new Float64Array(n);
  const vel = new Float64Array(n);
  const bumpedUntil = new Int32Array(n);
  const finished: boolean[] = new Array(n).fill(false);
  const order: Id[] = [];
  const finishTicks: Record<Id, number> = {};
  const events: RaceEvent[] = [];
  const ticks: number[][] = [];

  // Per-dog race-day luck (drawn once) and break out of the boxes.
  const luck = new Float64Array(n);
  for (let i = 0; i < n; i++) luck[i] = rng.gauss(0, balance.raceLuckSd);
  for (let i = 0; i < n; i++) {
    const r = runners[i]!;
    let trapStat = r.trapStat;
    if (r.traits.includes('slowStarter')) trapStat -= 15;
    pos[i] =
      (Math.max(1, trapStat) / 100) *
      balance.raceBreakMetres *
      rng.uniform(balance.raceBreakMin, balance.raceBreakMax);
  }

  // Static per-dog multipliers from traits and the track.
  const mult = new Float64Array(n).fill(1);
  const fadeShift = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = runners[i]!;
    const t = r.traits;
    if (t.includes('railer') && track.bends === 'tight') mult[i]! *= 1.03;
    if (t.includes('mudlark') && track.mud) mult[i]! *= 1.05;
    if (t.includes('showboat') && ctx.major) mult[i]! *= 1.03;
    if (t.includes('nervy') && (r.trap === 1 || r.trap === 8)) mult[i]! *= 0.95;
    if (t.includes('sprinter') && distance <= 400) mult[i]! *= 1.03;
    if (t.includes('stayer') && distance >= 550) mult[i]! *= 1.03;
    if (t.includes('slowStarter')) fadeShift[i] = 0.05;
  }

  ticks.push(Array.from(pos, (p) => Math.round(p * 100) / 100));
  let leader = -1;
  let t = 0;
  while (order.length < n && t < balance.raceMaxTicks) {
    t++;
    for (let i = 0; i < n; i++) {
      if (finished[i]) continue;
      const r = runners[i]!;
      const fit = 0.8 + (0.2 * r.fitness) / 100;
      const speedStat = Math.min(120, r.speed + (r.speedBonus ?? 0));
      let top =
        (balance.raceBaseSpeed +
          (balance.raceSpeedCoef * speedStat) / 100 +
          balance.raceFormCoef * r.form +
          balance.raceLuckCoef * luck[i]!) *
        fit *
        mult[i]!;
      const fadeStart =
        balance.raceFadeBase + (balance.raceFadeStamina * r.stamina) / 100 + fadeShift[i]!;
      const frac = pos[i]! / distance;
      if (frac > fadeStart) {
        top *= 1 - (balance.raceFadePenalty * (frac - fadeStart)) / Math.max(0.05, 1 - fadeStart);
      }
      if (bumpedUntil[i]! > t) top *= 1 - balance.raceBumpPenalty;
      let acc = balance.raceAccelBase + (balance.raceAccelCoef * r.accel) / 100;
      if (track.slippery) acc *= 0.85 + (0.3 * r.accel) / 100; // Glassfall: acceleration matters more
      vel[i] = Math.min(top, vel[i]! + acc * dt) + rng.gauss(0, balance.raceTickNoiseSd);
      if (vel[i]! < 0) vel[i] = 0;
      pos[i] = pos[i]! + vel[i]! * dt;
    }

    // Bend interference: dogs within bumpDistance of each other on a bend may clash.
    if (windows.length) {
      for (let i = 0; i < n; i++) {
        if (finished[i] || !onBend(pos[i]! / distance, windows)) continue;
        for (let j = i + 1; j < n; j++) {
          if (finished[j]) continue;
          if (Math.abs(pos[i]! - pos[j]!) > balance.raceBumpDistance) continue;
          const ri = runners[i]!;
          const rj = runners[j]!;
          let p = bumpPerTick * bendMult;
          // Trap craft and wide running keep dogs out of trouble.
          p *= 1 - (Math.min(ri.trapStat, rj.trapStat) / 100) * 0.5;
          if (ri.traits.includes('wideRunner') || rj.traits.includes('wideRunner')) p *= 0.25;
          if (rng.chance(p)) {
            // The dog with the worse trap craft comes off worse.
            const victim = ri.trapStat <= rj.trapStat ? i : j;
            const other = victim === i ? j : i;
            bumpedUntil[victim] = t + bumpTicks;
            events.push({
              tick: t,
              kind: 'bump',
              dogId: runners[victim]!.id,
              otherId: runners[other]!.id,
            });
          }
        }
      }
    }

    // Finishes, in order of how far past the line each dog is this tick.
    const crossing: number[] = [];
    for (let i = 0; i < n; i++) if (!finished[i] && pos[i]! >= distance) crossing.push(i);
    crossing.sort((a, b) => pos[b]! - pos[a]!);
    for (const i of crossing) {
      finished[i] = true;
      order.push(runners[i]!.id);
      finishTicks[runners[i]!.id] = t;
      events.push({ tick: t, kind: 'finish', dogId: runners[i]!.id });
    }

    let best = -1;
    for (let i = 0; i < n; i++) if (!finished[i] && (best < 0 || pos[i]! > pos[best]!)) best = i;
    if (best >= 0 && best !== leader && order.length === 0) {
      if (leader >= 0) events.push({ tick: t, kind: 'leadChange', dogId: runners[best]!.id });
      leader = best;
    }
    ticks.push(Array.from(pos, (p) => Math.round(p * 100) / 100));
  }

  // Anyone still running when the clock ran out finishes by distance.
  const stragglers: number[] = [];
  for (let i = 0; i < n; i++) if (!finished[i]) stragglers.push(i);
  stragglers.sort((a, b) => pos[b]! - pos[a]!);
  for (const i of stragglers) {
    order.push(runners[i]!.id);
    finishTicks[runners[i]!.id] = t;
  }

  // Margin: gap between first and second when the winner crossed.
  let margin = 0;
  if (n >= 2) {
    const winTick = finishTicks[order[0]!] ?? t;
    const row = ticks[winTick] ?? ticks[ticks.length - 1]!;
    const winIdx = runners.findIndex((r) => r.id === order[0]);
    const secIdx = runners.findIndex((r) => r.id === order[1]);
    margin = Math.max(0, (row[winIdx] ?? 0) - (row[secIdx] ?? 0));
  }
  return {
    order,
    finishTicks,
    ticks,
    events,
    margin,
    photoFinish: margin < balance.racePhotoFinishMetres,
  };
}
