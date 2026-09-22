import { balance } from '../content/balance';
import { STYLE_BY_ID } from '../content/styles';
import type { Id, RaceEvent, RunNote, StyleId, Track, TraitId } from '../types';
import type { Rng } from '../rng';

/** Everything the simulator needs to know about one runner. Pure data: no ownership, no money. */
export interface Runner {
  id: Id;
  trap: number; // 1..8
  speed: number;
  /** Also the break from the boxes and the line through a bend (GDD_V3 §4.1, V9). */
  accel: number;
  stamina: number;
  fitness: number;
  form: number;
  traits: readonly TraitId[];
  speedBonus?: number; // supplement / lucky bone, in stat points
  /**
   * How it runs (GDD_V3 §5.1). Optional because a runner with no style runs the baseline curve,
   * which is the stalker's — so a probe or a test that does not care about styles need not say so.
   */
  style?: StyleId;
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
  /** How each runner ran, index-aligned with `runners`: style and the day's expression (§5.2). */
  runs: RunNote[];
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
 * How far inside the boxes a trap is: **+0.5 at trap 1, −0.5 at the outside trap**, symmetric
 * about the middle (GDD §6.2, D37).
 *
 * Two rules read it and they pull opposite ways, which is the whole point: the rail is the short
 * way round, and the rail is where the traffic is. Symmetric so that a full field's draw is worth
 * nothing in aggregate — the draw redistributes a race, it does not add speed to one.
 */
function insideness(trap: number): number {
  return ((balance.traps + 1) / 2 - trap) / (balance.traps - 1);
}

/**
 * Whose line gives way when two dogs meet on a bend (GDD §5.1, §6.2, D37).
 *
 * Trap craft decides it, **adjusted for where the dog is drawn**: a dog on the rail has less room
 * to work with, so it needs the craft to hold its line and comes off worse when it has not got it.
 * The lower score is the victim.
 *
 * ⚠️ **This replaces a tie-break that was doing the same job by accident and doing it far too
 * hard.** `ri.trapStat <= rj.trapStat ? i : j` made the lower array index — which is the lower
 * trap — the victim of every clash between two dogs of equal craft, and in a field of identical
 * dogs on a tight track that was worth **trap 1 winning 9.1% against trap 8's 17.3%** [measured].
 * Nothing intended it, nothing printed it, and it has been in every race with bends since M0.
 * Now the rule is deliberate, its size is a number in the spreadsheet, and it is paid for by the
 * shorter trip on the rail — so which end of the draw a dog wants depends on the dog.
 */
/**
 * How well this runner holds its line, given the box it is in.
 *
 * ⚠️ **Reads Acceleration since v3 (GDD_V3 §4.1, V9).** It read the Trap stat, and Trap is folded
 * into Accel rather than deleted precisely so that this function, the break from the boxes and the
 * rail's `trapDrawEdge` all keep working — deleting the stat would have made the draw worthless
 * again. `trapTraffic` is unchanged: the rail is still the short way round and still where the
 * traffic is, and which end of the boxes a dog wants still depends on how much craft it has.
 */
function bendCraft(r: Runner): number {
  return r.accel - balance.trapTraffic * insideness(r.trap);
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
  /**
   * How much the **draw** matters here (GDD §6.2, D37). Zero on a track with no bends, because a
   * trap number on a straight is a starting position and nothing else — which is what `--stats`
   * measures and what the Void Derby's 350 m straight is for.
   */
  const drawMult = windows.length ? bendMult : 0;

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
    // The break from the boxes, on Acceleration (GDD_V3 §4.1).
    let breakStat = r.accel;
    if (r.traits.includes('slowStarter')) breakStat -= 15;
    pos[i] =
      (Math.max(1, breakStat) / 100) *
      balance.raceBreakMetres *
      rng.uniform(balance.raceBreakMin, balance.raceBreakMax);
  }

  // The day's style expression (GDD_V3 §5.2, V13): one draw per runner, here, before the first tick.
  // A field is always `balance.traps` runners — short fields are filled with locals — so this is a
  // fixed number of draws per race and the stream never shifts with how many stables declared.
  //
  // ⚠️ **It scales the style's *shape*, never the dog's speed.** A front-runner who draws 0.35 runs
  // like a stalker; one who draws 1.25 goes off like a rocket and pays for it. v2 D13 learned what a
  // 20%-wide multiplier on the dog itself does — it makes everything else invisible.
  const expression = new Float64Array(n);
  for (let i = 0; i < n; i++)
    expression[i] = rng.uniform(balance.styleExpressionMin, balance.styleExpressionMax);
  const earlyMult = new Float64Array(n);
  const styleFade = new Float64Array(n);
  const fadeMult = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const st = STYLE_BY_ID[runners[i]!.style ?? 'stalker'];
    const e = expression[i]!;
    earlyMult[i] = 1 + (st.earlySpeed - 1) * e;
    styleFade[i] = st.fadeShift * e;
    fadeMult[i] = 1 + (st.fadeMult - 1) * e;
  }

  // Static per-dog multipliers from traits, the track, and the draw.
  const mult = new Float64Array(n).fill(1);
  const fadeShift = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = runners[i]!;
    const t = r.traits;
    // The draw: a shorter trip on the rail, a longer one out wide (GDD §6.2, D37). `inside` runs
    // +0.5 at trap 1 to −0.5 at trap 8, so the effect is symmetric about the middle of the boxes
    // and a full-width field neither gains nor loses speed on average.
    mult[i]! *= 1 + balance.trapDrawEdge * insideness(r.trap) * drawMult;
    if (t.includes('railer') && track.bends === 'tight') mult[i]! *= 1.03;
    if (t.includes('mudlark') && track.mud) mult[i]! *= 1.05;
    if (t.includes('showboat') && ctx.major) mult[i]! *= 1.03;
    if (t.includes('nervy') && (r.trap === 1 || r.trap === 8)) mult[i]! *= 0.95;
    if (t.includes('sprinter') && distance <= 400) mult[i]! *= 1.03;
    if (t.includes('stayer') && distance >= 550) mult[i]! *= 1.03;
    if (t.includes('slowStarter')) fadeShift[i] = 0.05;
  }

  // The contest rule (GDD_V3 §5.3, V14). Styles alone are independent — three front-runners would
  // each run their own curve — so the interaction is written: while a front-runner is inside the
  // first third and another dog is within `contestDistance` of it at the head of the field, both go
  // `contestSpeedBoost` faster, and both pay for it later with a fade point moved earlier. The cost
  // accrues with the ground covered while contesting — a whole first third duelled costs
  // `contestFadeCost`, a brush costs a sliver — so a front-runner who draws a low expression and
  // never gets to the front is never burned. The closer's curve never changes; the leaders come back
  // to it. ⚠️ A kill switch, not a tuning target: `--styles` measures it, and if a closer's gap
  // against a front-runner-heavy field is under 4 points the rule is to be cut.
  const contests = runners.map((r) => STYLE_BY_ID[r.style ?? 'stalker'].contests);
  const contesting: boolean[] = new Array(n).fill(false);
  const contestedMetres = new Float64Array(n);
  const duelled: boolean[] = new Array(n).fill(false);
  const contestWindow = balance.contestWindow * distance;

  ticks.push(Array.from(pos, (p) => Math.round(p * 100) / 100));
  let leader = -1;
  let t = 0;
  while (order.length < n && t < balance.raceMaxTicks) {
    t++;
    // Who is contesting the lead this tick, read off where everybody was at the end of the last one.
    contesting.fill(false);
    let head = 0;
    for (let i = 0; i < n; i++) if (!finished[i] && pos[i]! > head) head = pos[i]!;
    for (let i = 0; i < n; i++) {
      if (!contests[i] || finished[i] || pos[i]! >= contestWindow) continue;
      if (pos[i]! < head - balance.contestDistance) continue;
      for (let j = 0; j < n; j++) {
        if (j === i || finished[j] || pos[j]! < head - balance.contestDistance) continue;
        if (Math.abs(pos[i]! - pos[j]!) > balance.contestDistance) continue;
        contesting[i] = true;
        contesting[j] = true;
        if (!duelled[i]) {
          duelled[i] = true;
          events.push({ tick: t, kind: 'duel', dogId: runners[i]!.id, otherId: runners[j]!.id });
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (finished[i]) continue;
      const r = runners[i]!;
      // GDD §5.2: fitness multiplies every stat, at every fitness — not only below a threshold.
      const fit = balance.fitScaleBase + (balance.fitScaleCoef * r.fitness) / 100;
      const speedStat = Math.min(120, r.speed + (r.speedBonus ?? 0));
      let top =
        (balance.raceBaseSpeed +
          (balance.raceSpeedCoef * speedStat) / 100 +
          balance.raceFormCoef * r.form +
          balance.raceLuckCoef * luck[i]!) *
        fit *
        mult[i]!;
      const fadeStart =
        balance.raceFadeBase +
        (balance.raceFadeStamina * r.stamina) / 100 +
        fadeShift[i]! +
        styleFade[i]! -
        (balance.contestFadeCost * contestedMetres[i]!) / contestWindow;
      const frac = pos[i]! / distance;
      // The style's early pace (§5.1): quicker or slower over the first part of the trip only.
      if (frac < balance.styleEarlyFraction) top *= earlyMult[i]!;
      if (frac > fadeStart) {
        top *=
          1 -
          (balance.raceFadePenalty * fadeMult[i]! * (frac - fadeStart)) /
            Math.max(0.05, 1 - fadeStart);
      }
      if (contesting[i]) top *= 1 + balance.contestSpeedBoost;
      if (bumpedUntil[i]! > t) top *= 1 - balance.raceBumpPenalty;
      let acc = balance.raceAccelBase + (balance.raceAccelCoef * r.accel) / 100;
      if (track.slippery) acc *= 0.85 + (0.3 * r.accel) / 100; // Glassfall: acceleration matters more
      vel[i] = Math.min(top, vel[i]! + acc * dt) + rng.gauss(0, balance.raceTickNoiseSd);
      if (vel[i]! < 0) vel[i] = 0;
      if (contesting[i]) contestedMetres[i] = contestedMetres[i]! + vel[i]! * dt;
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
          p *= 1 - (Math.min(ri.accel, rj.accel) / 100) * 0.5;
          if (ri.traits.includes('wideRunner') || rj.traits.includes('wideRunner')) p *= 0.25;
          if (rng.chance(p)) {
            // The dog with less craft for the line it is on comes off worse — see bendCraft.
            const victim = bendCraft(ri) <= bendCraft(rj) ? i : j;
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
    runs: runners.map((r, i) => ({
      style: r.style ?? 'stalker',
      expression: Math.round(expression[i]! * 100) / 100,
      contested: Math.round((contestedMetres[i]! / contestWindow) * 100) / 100,
    })),
  };
}
