/**
 * Balance harness (BUILD_PLAN §7 and §7a). Runs N headless seasons and prints the stats the
 * plan asks for. Usage (from the repo root):
 *   npm run harness -- --seasons 200 [--ai normal,normal,normal,normal,normal,normal] [--seed 1]
 *   npm run harness -- --calibrate        # race-sim win rates vs rating gap + oddsScale fit
 *   npm run harness -- --stats            # D12 regression: +10 to one stat, at three lengths
 *   npm run harness -- --autoplan --seasons 200   # §7a.3: autoplan% and the sampled apLoss rollout
 *   npm run harness -- --lead            # §7a.4: does a lead at week 6 convert, split on betting
 *   npm run harness -- --hardAblation    # §14: which of Hard's own decisions earns its head-to-head
 *
 * The standard printout carries **BUILD_PLAN_V3 Phase B's market rows** — food as a share of gross,
 * the cash-bound → hold-bound crossover week, the p99 best trading leg against mean end worth, the
 * share of weeks a hold is empty, Ambrosia's shelf depth, and the p90/p10 spread — and a per-good
 * table with the band position every crate was bought and sold at. None of them is behind a flag:
 * the p99 leg is the row that protects the game (GDD_V3 §6.4) and a run that did not print it would
 * be a run that did not check it.
 *
 * ⚠️ `--fix` and `--card` are gone with the crook's road and the drawn card (BUILD_PLAN_V3 §2.1).
 * An unrecognised flag is an error rather than a silent plain run — the v2 habit of typing a mode
 * that no longer exists and reading the default output as its result is a real way to be wrong.
 *
 * ## Why this drives the season itself rather than calling runSeason
 *
 * Three of §7a's measures are about the moment a dog is *declared*, not about anything the
 * finished state remembers: mean fitness at declaration, the share of declarations under 60, and
 * the race count per dog. `RaceEntry` carries a rating and not a fitness, and adding one to it
 * would be a state-shape change — moving the golden snapshot for the sake of an instrument. So
 * the harness steps the season the way `drive()` does and samples the state at the instant
 * declarations lock, which costs nothing and leaves the engine alone.
 */
import { balance } from '../src/content/balance';
import { GOODS, good } from '../src/content/goods';
import { createDog, fitRating } from '../src/economy/dogs';
import { dogValue } from '../src/economy/dogValue';
import { netWorth } from '../src/economy/netWorth';
import { planFeeding } from '../src/economy/food';
import { cargoTotal, HOLD_CAP } from '../src/economy/goods';
import { roadSplit } from '../src/economy/roadSplit';
import { mulberry32 } from '../src/rng';
import { createSeason, eligible, player, thisWeeksCard } from '../src/state';
import { decide } from '../src/ai';
import { HARD_KNOBS } from '../src/ai/hard';
import { hash01 } from '../src/ai/shared';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { simulateRace, type Runner } from '../src/race/simulateRace';
import { winProbabilities } from '../src/race/odds';
import { HEADLINE_TYPE_ID, raceType } from '../src/content/raceTypes';
import {
  RACE_TYPE_IDS,
  type Action,
  type AiAgent,
  type Dog,
  type GameState,
  type Id,
  type GoodId,
  type Player,
  type RaceTypeId,
  type StatKey,
  type Track,
  type WeekState,
} from '../src/types';

interface Args {
  seasons: number;
  ai: AiAgent[];
  seed: number;
  calibrate: boolean;
  stats: boolean;
  autoplan: boolean;
  /** §7a.4: does a lead at week 6 convert, split on whether the stable bet (GDD §20 Q3, Q7). */
  leadConversion: boolean;
  /** §14: which of Hard's own decisions is earning — or costing — it its head-to-head band. */
  hardAblation: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    seasons: 50,
    ai: Array(6).fill('normal'),
    seed: 1,
    calibrate: false,
    stats: false,
    autoplan: false,
    leadConversion: false,
    hardAblation: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? '';
    if (a === '--seasons') args.seasons = Number(next());
    else if (a === '--ai')
      args.ai = next()
        .split(',')
        .map((x) => x.trim() as AiAgent);
    else if (a === '--seed') args.seed = Number(next());
    else if (a === '--calibrate') args.calibrate = true;
    else if (a === '--stats') args.stats = true;
    else if (a === '--autoplan') args.autoplan = true;
    else if (a === '--leadConversion' || a === '--lead') args.leadConversion = true;
    else if (a === '--hardAblation') args.hardAblation = true;
    else if (a === '--quiet') args.quiet = true;
    else throw new Error(`Unknown flag ${a}. See the usage block at the top of this file.`);
  }
  return args;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-NZ');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx]!;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface AgentStats {
  worth: number[];
  wins: number;
  seasons: number;
  prize: number[];
  trade: number[];
  bet: number[];
  costs: number[];
  /** §7a.4: fitness of every dog at the moment it was declared. */
  declFitness: number[];
  declBelowThreshold: number;
  /** Race entries and distinct dogs owned, per stable-season → races per dog. */
  entries: number[];
  dogsOwned: number[];
  dogsAtEnd: number[];
  /** **Pace measure 2**: how many of the weekend's three races the stable filled, every
   * stable-week. GDD_V3 Phase A wants the mean in 1.8–2.4 of 3. */
  filled: number[];
  /** **Pace measure 1**: decisions taken, per stable-weekend (see `SeasonSample.decisions`). */
  decisions: number[];
  /** §7a.4: Herfindahl over the stable's dog values at week 13. 1.0 is one dog, 0.2 is five. */
  concentration: number[];
  /** §7.1: gross income by road, so "prize is 87% of it" is a number rather than a claim. */
  grossPrize: number[];
  grossFood: number[];
  grossBets: number[];
  /** Mean crates aboard at the end of each week — what the trade is actually carrying. */
  crates: number[];
  betsStruck: number[];
  /** Phase B: each stable-season's best week of sales, and the week it first went hold-bound. */
  bestLeg: number[];
  crossover: number[];
  neverCrossed: number;
}

/** Every stable is in the same season, so a pairing is a like-for-like comparison. */
interface HeadToHead {
  wins: number; // the first agent finished above the second
  total: number;
}

const AGENT_ORDER: AiAgent[] = ['easy', 'normal', 'hard'];

/** Per-race-type counters, kept as one object so a new type never needs a new field. */
type ByType<T> = Map<RaceTypeId, T>;
const byType = <T>(make: () => T): ByType<T> => new Map(RACE_TYPE_IDS.map((r) => [r, make()]));

/** Per-season sampling that only exists while declarations are locked (see the file header). */
interface SeasonSample {
  declFitness: Map<Id, number[]>;
  entries: Map<Id, number>;
  dogsSeen: Map<Id, Set<Id>>;
  fieldByWeek: ByType<number[][]>;
  /**
   * **Pace measure 1 (BUILD_PLAN_V3 Phase A): decisions a stable takes per weekend.**
   *
   * A *decision* is an action that changes the world because the player chose it — a declaration, a
   * Race/Rest change, a trade, a bet, an event answer. `EndPhase`, `EndTurn` and `AdvancePhase` are
   * not decisions: they are the player saying "done", and counting them would make a stable that
   * does nothing look busy. `hub-clicks.ts` measures the *presses* a human pays for the same
   * weekend, navigation included, and GDD_V3 §10.1's ≤ 10 budget is against that instrument; this
   * one is the same question asked of six AI stables over hundreds of seasons.
   */
  decisions: Map<Id, number>;
  /** Player entries and races run, per type — §7a.2's replacement for the Gold field row. */
  entriesByType: ByType<number>;
  racesByType: ByType<number>;
  /** How many of the weekend's three races each stable actually declared into. */
  filled: Map<Id, number[]>;
  /** GDD §7.1: the posted purse pool against what actually reached a player's pocket. */
  poolPosted: number;
  poolToPlayers: number;
  /** Gross income by road, tallied from the cash each action moves (see grossFrom). */
  grossFood: Map<Id, number>;
  /**
   * §7a.2 asks for **a row per good and tier** in the income split, and this is it: crates and
   * Bones moved, per good, in each direction. Kept gross for the same reason the road split is —
   * "sold minus bought" cannot answer "where did the money come in".
   */
  goodsBought: Map<GoodId, { crates: number; bones: number }>;
  goodsSold: Map<GoodId, { crates: number; bones: number }>;
  /**
   * Crates aboard at the end of every week, per stable.
   *
   * ⚠️ Measured across the season rather than at the last week, and the difference matters: a trader
   * sells its hold down before the Grand Final, so an end-of-season snapshot read 6.6 crates for a
   * stable that had been carrying 21. Reading the wrong one nearly bought a wrong conclusion about
   * whether the hold was the binding constraint.
   */
  cratesByWeek: Map<Id, number[]>;
  /** Net-worth rank at week 6 and at the end, per stable — `leadConversion`'s two columns. */
  rankAtSix: Map<Id, number>;
  /** Bones staked, per stable. */
  staked: Map<Id, number>;
  // ---- v3 Phase B: the market (BUILD_PLAN_V3 Phase B item 8) ----
  /**
   * Where in its band each crate was bought and sold, as a crate-weighted sum of band positions —
   * 0 at the floor, 1 at the ceiling. A stable buying at 0.5 is not trading; one buying at 0.2 is.
   */
  boughtPos: Map<GoodId, number>;
  soldPos: Map<GoodId, number>;
  /** Crates of each good eaten at the jump, straight from the engine's own `planFeeding`. */
  fed: Map<GoodId, number>;
  /** Profit realised by each stable's sales this week, against its own You Paid. */
  legThisWeek: Map<Id, number>;
  /** The best week of sales each stable had — "the best single trading leg" (§6.4). */
  bestLeg: Map<Id, number>;
  /** The first week each stable ended its trading hold-bound (see `holdBound`). */
  crossover: Map<Id, number>;
  /** Stables hold-bound at each week's jump. */
  holdBoundByWeek: number[];
  /** Stable-weeks with nothing aboard at the jump, and dog-weeks that went hungry. */
  emptyHoldWeeks: number;
  stableWeeks: number;
  hungryDogWeeks: number;
  dogWeeks: number;
  /** Each good's shelf depth as the planet posts it, before anybody has bought (§6.1, V7). */
  shelfAtArrival: Map<GoodId, number[]>;
}

export function emptySample(): SeasonSample {
  return {
    declFitness: new Map(),
    entries: new Map(),
    dogsSeen: new Map(),
    fieldByWeek: byType(() => Array.from({ length: balance.weeks }, () => [] as number[])),
    decisions: new Map(),
    entriesByType: byType(() => 0),
    racesByType: byType(() => 0),
    filled: new Map(),
    poolPosted: 0,
    poolToPlayers: 0,
    grossFood: new Map(),
    goodsBought: new Map(),
    goodsSold: new Map(),
    cratesByWeek: new Map(),
    staked: new Map(),
    rankAtSix: new Map(),
    boughtPos: new Map(),
    soldPos: new Map(),
    fed: new Map(),
    legThisWeek: new Map(),
    bestLeg: new Map(),
    crossover: new Map(),
    holdBoundByWeek: Array.from({ length: balance.weeks }, () => 0),
    emptyHoldWeeks: 0,
    stableWeeks: 0,
    hungryDogWeeks: 0,
    dogWeeks: 0,
    shelfAtArrival: new Map(),
  };
}

/**
 * **The cash-bound → hold-bound crossover, as a definition** (BUILD_PLAN_V3 Phase B item 8,
 * decision B5). A stable is **hold-bound** in a week if it ends that week's trading — at the jump,
 * after the last market phase — with the hold at least 90% full *and* enough cash left to have
 * bought another tenth of the hold of the dearest good at that good's mid-band price. In words: it
 * stopped buying because it had nowhere to put the next crate, not because it had no money for it.
 * Anything else is cash-bound, or not trading, which from the outside is the same thing.
 *
 * Both thresholds are read off the data rather than chosen: a tenth of the hold is five crates at
 * 50, and the dearest good's mid-band price is Ambrosia's 405, so the floor is about 2,000 Bones —
 * a third of the starting cash. The crossover week is the first week a stable is hold-bound.
 */
function holdBound(p: Player): boolean {
  const dearest = GOODS[GOODS.length - 1]!;
  const tenth = HOLD_CAP / 10;
  return (
    cargoTotal(p.cargo) >= HOLD_CAP - tenth &&
    p.cash >= tenth * ((dearest.floor + dearest.ceiling) / 2)
  );
}

/** Where a price sits in its good's band: 0 at the floor, 1 at the ceiling. */
const bandPos = (id: GoodId, price: number): number => {
  const g = good(id);
  return (price - g.floor) / (g.ceiling - g.floor);
};

const bumpGood = (
  m: Map<GoodId, { crates: number; bones: number }>,
  id: GoodId,
  crates: number,
  bones: number,
): void => {
  const cur = m.get(id) ?? { crates: 0, bones: 0 };
  cur.crates += crates;
  cur.bones += bones;
  m.set(id, cur);
};

const bumpMap = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/**
 * §7a.4 `concentration`: the Herfindahl index over a stable's dog values, `Σ (vᵢ / Σv)²`. One dog
 * is 1.0, five equal dogs 0.2. R1 says v1 rewarded the top end; the target is the champion's
 * mean below 0.4, which is another way of saying a champion should own a *stable*.
 */
function herfindahl(s: GameState, p: Player): number | null {
  const values = p.dogIds
    .map((id) => (s.dogs[id] ? dogValue(s.dogs[id]!) : 0))
    .filter((v) => v > 0);
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return values.reduce((sum, v) => sum + (v / total) * (v / total), 0);
}

/**
 * The week the season stopped changing hands: the earliest week from which the eventual champion
 * led on net worth and never lost the lead again. v1 ran 7.6, which is a procession — half the
 * season played out after the answer was known. Later is better.
 */
function decidedByWeek(s: GameState, winner: Id): number {
  const worth = (p: Player, w: number) => p.stats.worthByWeek[w] ?? -Infinity;
  const champ = s.players.find((p) => p.id === winner);
  if (!champ) return balance.weeks;
  let decided = 1;
  for (let w = 0; w < balance.weeks; w++) {
    const led = s.players.every((p) => p.id === winner || worth(champ, w) >= worth(p, w));
    if (!led) decided = w + 2;
  }
  return Math.min(decided, balance.weeks);
}

// -------------------------------------------------------------------------------------------
// §7a.3 `autoplan%` / `apLoss%` — what `naive%` becomes now that a week is six decisions.
// -------------------------------------------------------------------------------------------

/**
 * The autoplan (BUILD_PLAN §7a.3), verbatim:
 *
 * > every fit dog Races if it is eligible for anything; the best eligible dog goes into the
 * > richest race it can enter; anything under 50 fitness Rests; nobody Trains.
 *
 * This is the v2 shape of "just enter everything" — what a player does before they have
 * understood the game — and the measure it feeds asks how often that is *also* the right answer.
 * `naive%` ran 59% before M4's purse change and 19% after, and that number is why the change was
 * made; the target band here is 15–30%, because above 40% the week is making itself and below
 * 10% the player cannot find the plan at all and depth reads as noise.
 */
function autoplanFor(s: GameState, p: Player, sold: ReadonlySet<Id> = new Set()): Action[] {
  const card = thisWeeksCard();
  const kennel = p.dogIds
    .filter((id) => !sold.has(id))
    .map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d);
  const fit = kennel.filter((d) => d.fitness >= balance.injuryLowFitnessBelow);
  // Richest race first — the card runs with the headline race last, so walk it backwards — and
  // the best dog that qualifies goes in it.
  const out: Action[] = [];
  const taken = new Set<Id>();
  for (const race of [...card].reverse()) {
    const pick = fit
      .filter((d) => !taken.has(d.id) && eligible(d, race))
      .sort((a, b) => b.rating - a.rating)[0];
    if (!pick) continue;
    taken.add(pick.id);
    out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
  }
  // Anything under the fitness floor rests; nobody trains; everything else stays pointed at a
  // race, which is the state a dog is created in and the state a player who touches nothing gets.
  for (const d of kennel) {
    if (taken.has(d.id)) continue;
    const state: WeekState = d.fitness < balance.injuryLowFitnessBelow ? 'rest' : 'race';
    if (d.weekState !== state) out.push({ t: 'SetDogState', playerId: p.id, dogId: d.id, state });
  }
  return out;
}

/** A week's plan as the two things it decides: who runs where, and what everyone else does. */
interface WeekPlan {
  entries: string;
  states: string;
}

function planFrom(s: GameState, p: Player, actions: readonly Action[]): WeekPlan {
  const entries = new Map<RaceTypeId, Id | null>();
  for (const race of thisWeeksCard()) entries.set(race, s.declarations[race][p.id] ?? null);
  const states = new Map<Id, WeekState>();
  for (const id of p.dogIds) states.set(id, s.dogs[id]?.weekState ?? 'race');
  for (const a of actions) {
    if (a.t === 'Declare' && a.playerId === p.id) {
      entries.set(a.race, a.dogId);
      if (a.dogId) states.set(a.dogId, 'race');
    } else if (a.t === 'SetDogState' && a.playerId === p.id) {
      states.set(a.dogId, a.state);
    }
  }
  const key = <K, V>(m: Map<K, V>) =>
    [...m.entries()]
      .map(([k, v]) => `${String(k)}=${String(v)}`)
      .sort()
      .join('|');
  return { entries: key(entries), states: key(states) };
}

/** Everything the agent decided that was *not* the week's plan — its shopping, mostly. */
const notPlan = (a: Action) => a.t !== 'Declare' && a.t !== 'SetDogState';

/**
 * Dogs the agent is about to sell this phase. The autoplan is computed from the state as it
 * stands when `decide` is called, so without this it would cheerfully declare a dog the agent's
 * own shopping has already sold on — and the reducer would rightly refuse it. Both the comparison
 * and the rollout use the same filter, so they price the same plan.
 */
function soldThisPhase(): Set<Id> {
  // ⚠️ **Always empty now, and kept as a seam rather than deleted.** With the dog market gone
  // (BUILD_PLAN_V3 §2.1) an agent cannot sell a dog mid-phase, so there is nothing for the autoplan
  // comparison to filter out. GDD_V3 §9.2 brings dog *swaps* back in Phase D — accepting an offer
  // discards one of your own — at which point this is where that filter goes again.
  return new Set<Id>();
}

/**
 * Play a season out, optionally forcing one stable onto the autoplan in one week, and return
 * every stable's end worth. The forced week keeps the agent's own shopping and swaps only the
 * plan, so the two rollouts differ in exactly the thing being priced and nothing else.
 */
/**
 * Play a season out from here, optionally forcing one stable's autoplan in one week (§7a.3).
 *
 * ⚠️ **`anchorWeeks` is D25's fix, and it is the whole of what Phase E tried on `apLoss`.** §7a.3
 * asks for two rollouts "on the same downstream seed" and `GameState` carries one linear rng
 * stream, so the instant the forced plan consumes a different number of draws every race, market
 * and event afterwards is a different random season — sd 20,041 against an effect worth at most a
 * week's purse. Re-anchoring the stream at each week boundary to `hash(seed, week)` makes the two
 * arms share their draws again from the top of every week, so the part of the difference that is
 * pure draw-mismatch cancels and the part that is the decision's consequence — a different dog,
 * different cash, a different plan next week — survives, which is the part being priced.
 *
 * It is legitimate precisely because these are **counterfactual** rollouts rather than seasons
 * anybody plays: the stream is still deterministic and still uniform, both arms are re-anchored
 * identically, and nothing here touches the engine or a real season.
 */
function playOut(
  s: GameState,
  force: { playerId: Id; week: number } | null,
  anchorWeeks = false,
): Map<Id, number> {
  let guard = 0;
  let anchored = 0;
  while (!isSeasonOver(s) && guard++ < 200_000) {
    if (anchorWeeks && s.week !== anchored) {
      anchored = s.week;
      s.rng = Math.floor(hash01(s.seed, s.week, 'apLoss', 'anchor') * 4294967296);
    }
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = s.pendingEvent?.playerId ?? s.activePlayer;
    if (!who) throw new Error(`Engine stalled in phase ${s.phase}`);
    const p = player(s, who);
    let actions = decide(s, who, p.difficulty);
    if (force && who === force.playerId && s.week === force.week && s.phase === 'planetPre') {
      actions = [
        ...actions.filter(notPlan).filter((a) => a.t !== 'EndPhase'),
        ...autoplanFor(s, p, soldThisPhase()),
        { t: 'EndPhase', playerId: who },
      ];
    }
    for (const a of actions) reduceMut(s, a);
  }
  return new Map(s.players.map((p) => [p.id, netWorth(s, p)]));
}

/**
 * `autoplan%` and `apLoss%` (BUILD_PLAN §7a.3).
 *
 * ⚠️ `apLoss%` cannot be a one-week expected-purse figure the way `nLoss%` was: a Train week pays
 * off in weeks 9–13, so the loss has to be measured against *season-end worth*. The honest
 * implementation is a rollout — from the state at that week, play the season out twice on the
 * same downstream seed, once with the autoplan forced and once with the agent's own plan, and
 * difference the end worth. That is roughly 3–4× the cost of a plain season, so it is **sampled:
 * one week in four, one stable a season**, and the printout says so.
 */
export function runAutoplan(seasons = 200, seed = 1, sampleEvery = 4): string {
  const ai: AiAgent[] = Array(6).fill('normal');
  let agree = 0;
  let weeks = 0;
  let entriesAgree = 0;
  let statesAgree = 0;
  const losses: number[] = [];
  /** End worth in the rollouts where the agent played its own plan — apLoss's denominator. */
  const baseline: number[] = [];
  const t0 = performance.now();

  for (let i = 0; i < seasons; i++) {
    const s = createSeason({
      seed: seed + i,
      players: ai.map((difficulty) => ({ name: '', kind: 'ai' as const, difficulty })),
    });
    // One stable a season carries the rollout, rotated so no seat is over-sampled.
    const rollFor = `p${(i % ai.length) + 1}`;
    let guard = 0;
    while (!isSeasonOver(s) && guard++ < 200_000) {
      if (needsAdvance(s)) {
        reduceMut(s, { t: 'AdvancePhase' });
        continue;
      }
      const who = s.pendingEvent?.playerId ?? s.activePlayer;
      if (!who) throw new Error(`Engine stalled in phase ${s.phase}`);
      const p = player(s, who);
      const actions = decide(s, who, p.difficulty);

      if (s.phase === 'planetPre' && !s.pendingEvent) {
        const auto = planFrom(s, p, autoplanFor(s, p, soldThisPhase()));
        const own = planFrom(s, p, actions);
        weeks++;
        if (auto.entries === own.entries) entriesAgree++;
        if (auto.states === own.states) statesAgree++;
        if (auto.entries === own.entries && auto.states === own.states) agree++;

        if (who === rollFor && s.week % sampleEvery === 1 && auto.entries !== own.entries) {
          const withAuto = playOut(structuredClone(s), { playerId: who, week: s.week }, true);
          const withOwn = playOut(structuredClone(s), null, true);
          losses.push((withOwn.get(who) ?? 0) - (withAuto.get(who) ?? 0));
          baseline.push(withOwn.get(who) ?? 0);
        }
      }
      for (const a of actions) reduceMut(s, a);
    }
  }

  const elapsed = (performance.now() - t0) / 1000;
  const meanLoss = mean(losses);
  // The rollouts are *not* paired. GameState carries one rng stream, so the instant the forced
  // plan consumes a different number of draws the rest of the season is a different random
  // season — there is no "same downstream seed" to hold. So the difference of two end worths is
  // one decision plus a whole season of variance, and the standard error is the only honest way
  // to say whether anything survived it.
  const sd = losses.length
    ? Math.sqrt(mean(losses.map((x) => (x - meanLoss) * (x - meanLoss))))
    : 0;
  const se = losses.length ? sd / Math.sqrt(losses.length) : 0;
  const signal = Math.abs(meanLoss) > 2 * se;
  return [
    `autoplan% / apLoss% (BUILD_PLAN §7a.3) — ${seasons} seasons, all Normal, seeds ${seed}…${seed + seasons - 1}`,
    `Elapsed ${elapsed.toFixed(1)} s. The rollout is sampled: one stable a season, one week in ${sampleEvery},`,
    `and only where the autoplan and the agent actually disagree about the entries — ${losses.length} rollouts.`,
    '',
    'The autoplan: every fit dog races if it is eligible for anything, the best eligible dog goes',
    'into the richest race it can enter, anything under 50 fitness rests, nobody trains.',
    '',
    `  autoplan%              ${pct(agree / Math.max(1, weeks)).padStart(7)}   (target 15–30%; above 40 the week makes itself, below 10 it reads as noise)`,
    `  …entries alone         ${pct(entriesAgree / Math.max(1, weeks)).padStart(7)}`,
    `  …states alone          ${pct(statesAgree / Math.max(1, weeks)).padStart(7)}`,
    `  stable-weeks measured  ${String(weeks).padStart(7)}`,
    '',
    `  apLoss, mean           ${fmt(meanLoss).padStart(7)} Bones of end worth given up by playing the autoplan that one week`,
    `  apLoss%                ${pct(meanLoss / Math.max(1, mean(baseline))).padStart(7)} of the ${fmt(mean(baseline))} the agent's own plan ends on in the same rollouts`,
    `  apLoss, std. error     ${fmt(se).padStart(7)} over ${losses.length} rollouts (sd ${fmt(sd)})`,
    `  → ${
      signal
        ? 'outside two standard errors: there is something here.'
        : 'INSIDE two standard errors — this is noise, and reading a decision into it would be wrong.'
    }`,
    '',
    '⚠️ **apLoss is a BOUND, not a figure, and that is now a finding rather than a debt (D25,',
    'revised E-D48).** §7a.3 asks for two rollouts "on the same downstream seed" and GameState',
    'carries a single linear rng stream, so the instant the forced plan consumes a different number',
    'of draws the rest of the season is a different random season. Phase E re-anchors the stream at',
    'each week boundary in both arms, which cancels the part of the difference that is pure',
    'draw-mismatch: sd 20,041 → ~17,800, a 13% cut and nothing like enough on its own. What it does',
    'buy is that the mean is now stable under sampling instead of wandering — Phase D read −1,047 at',
    '568 rollouts, this reads within a few hundred of zero at 2,500 — so the measure can be quoted',
    'as an interval.',
    '',
    'Read the two standard errors above as the answer: **one week of naive play costs less than that',
    'many Bones**, which on a ~32,000 season is under a couple of per cent. That is not a broken',
    'instrument, it is the game saying a single week out of thirteen is worth very little at season',
    'end — the same shape as §20 Q12, where the season is decided by compounding rather than by any',
    'one weekend. Chasing a point estimate would need the engine to key its randomness by event',
    'rather than by sequence, which is a rebalance of every number in the game to sharpen one',
    'instrument. Not worth it, and said out loud rather than carried as "still unbuilt".',
    '',
    '⚠️ The forced week keeps the agent’s own shopping and swaps only the plan, so the two',
    'rollouts differ in exactly the thing being priced. A dog the agent buys *during* that week is',
    'not in the autoplan, which is computed before its own action list is applied — a small bias',
    'against the autoplan, and the honest alternative would have been to reorder the agent.',
  ].join('\n');
}

/**
 * Net-worth rank of every stable, 1 = richest. Ties broken by player id so the rank is a function
 * of the state and nothing else.
 */
function ranks(s: GameState): Map<Id, number> {
  const rows = s.players
    .map((p) => ({ id: p.id, worth: netWorth(s, p) }))
    .sort((a, b) => b.worth - a.worth || (a.id < b.id ? -1 : 1));
  return new Map(rows.map((r, i) => [r.id, i + 1]));
}

/**
 * Play one season, sampling the locked card each week. Mirrors `drive()` — if that ever grows a
 * hook, this collapses back into it.
 */
export function playSeason(
  seed: number,
  ai: AiAgent[],
  sample: SeasonSample,
): { state: GameState; actions: number; rankAtLeadWeek: Map<Id, number> } {
  const s = createSeason({
    seed,
    players: ai.map((difficulty) => ({ name: '', kind: 'ai' as const, difficulty })),
  });
  let actions = 0;
  let sampledWeek = 0;
  let paidWeek = 0;
  let guard = 0;
  // §7a.4's split point. Week 6 is the "decided by" week Phase B measured, which is exactly the
  // week at which "ahead" and "behind" start to mean something.
  const LEAD_WEEK = 6;
  let rankAtLeadWeek: Map<Id, number> | null = null;
  let cratesWeek = 0;
  let shelfWeek = 0;
  while (!isSeasonOver(s) && guard++ < 200_000) {
    // The shelf as the planet posts it: the first look at a new week, before anybody has traded.
    if (shelfWeek !== s.week && (s.phase === 'events' || s.phase === 'planetPre')) {
      shelfWeek = s.week;
      for (const g of GOODS) {
        const list = sample.shelfAtArrival.get(g.id) ?? [];
        list.push(s.planet.goods[g.id].stock);
        sample.shelfAtArrival.set(g.id, list);
      }
    }
    // Own the stable's dogs before anything sells them on.
    for (const p of s.players) {
      let seen = sample.dogsSeen.get(p.id);
      if (!seen) sample.dogsSeen.set(p.id, (seen = new Set()));
      for (const id of p.dogIds) seen.add(id);
    }
    // The one instant the card is known and nothing has run: fitness here is pre-race.
    if (s.fields && !s.races && sampledWeek !== s.week) {
      sampledWeek = s.week;
      const card = thisWeeksCard();
      for (const race of card) {
        bumpMap(sample.racesByType, race);
      }
      // **Pace measure 2: races entered per weekend per stable.** Read off the stable's own
      // declaration book rather than off the field, because a race a stable left to the locals is
      // exactly what this measure is for.
      //
      // ⚠️ **`cardCoverage` used to sit here and is deleted (BUILD_PLAN_V3 §2.1, item 10).** It
      // asked "on the weekends this type ran, could the stable have filled it" — a question that
      // only exists while a race can refuse a dog. Every v3 race is open entry (§7.1), so coverage
      // is the fitness floor and nothing else, which is what the kennel table already reports.
      for (const p of s.players) {
        let filled = 0;
        for (const race of card) {
          if (s.declarations[race][p.id]) filled++;
        }
        const list = sample.filled.get(p.id) ?? [];
        list.push(filled);
        sample.filled.set(p.id, list);
      }
      for (const { race, entries: field } of s.fields) {
        sample.fieldByWeek.get(race)![s.week - 1]!.push(mean(field.map((e) => e.rating)));
        for (const e of field) {
          if (e.local) continue;
          const d = s.dogs[e.dogId];
          if (!d) continue;
          const list = sample.declFitness.get(e.ownerId) ?? [];
          list.push(d.fitness);
          sample.declFitness.set(e.ownerId, list);
          bumpMap(sample.entries, e.ownerId);
          bumpMap(sample.entriesByType, race);
        }
      }
    }
    // §7.1: the share of the posted purse pool that reaches a player. The rest leaves the economy
    // with the local dogs, and Phase A found it had collapsed to 30% without anything noticing.
    if (s.races && paidWeek !== s.week) {
      paidWeek = s.week;
      for (const r of s.races) {
        sample.poolPosted += r.purse[0] + r.purse[1] + r.purse[2];
        for (const pay of r.payouts) sample.poolToPlayers += pay.amount;
      }
    }
    if (rankAtLeadWeek === null && s.week > LEAD_WEEK) rankAtLeadWeek = ranks(s);
    if (cratesWeek !== s.week && s.phase === 'endTurn') {
      cratesWeek = s.week;
      for (const p of s.players) {
        const list = sample.cratesByWeek.get(p.id) ?? [];
        list.push(cargoTotal(p.cargo));
        sample.cratesByWeek.set(p.id, list);
        // ---- The market at the jump (Phase B item 8) — the week's trading is over. ----
        const dogs = p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
        const plan = planFeeding(p, dogs, !s.toggles.trading);
        for (const f of plan) if (f.good) bumpMap(sample.fed, f.good, f.got + f.fromGate);
        sample.stableWeeks++;
        sample.dogWeeks += dogs.length;
        if (cargoTotal(p.cargo) === 0) sample.emptyHoldWeeks++;
        sample.hungryDogWeeks += plan.filter((f) => f.good === null).length;
        if (holdBound(p)) {
          sample.holdBoundByWeek[s.week - 1]!++;
          if (!sample.crossover.has(p.id)) sample.crossover.set(p.id, s.week);
        }
        const leg = sample.legThisWeek.get(p.id) ?? 0;
        if (leg > (sample.bestLeg.get(p.id) ?? 0)) sample.bestLeg.set(p.id, leg);
        sample.legThisWeek.set(p.id, 0);
      }
    }
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      actions++;
      continue;
    }
    const who = s.pendingEvent?.playerId ?? s.activePlayer;
    if (!who) throw new Error(`Engine stalled in phase ${s.phase}`);
    const p = player(s, who);
    if (p.kind === 'human') throw new Error('The harness plays AI stables only');
    for (const a of decide(s, who, p.difficulty)) {
      // Gross rather than net income by road (GDD §7.1). `stats.tradeIncome` is sold minus
      // bought, which cannot answer "what share of a stable's income is prize money"; the cash
      // an action moves can, and reading it here keeps the instrument out of the engine.
      const before = p.cash;
      // §6.4's leg: a sale realises crates × (sell price − You Paid), read *before* the sale lands.
      // Summed across the week, so a stable that sells three goods at one stop has made one leg.
      if (a.t === 'TradeFood') {
        const price = a.units > 0 ? s.planet.goods[a.good].buy : s.planet.goods[a.good].sell;
        const crates = Math.abs(Math.trunc(a.units));
        bumpMap(
          a.units > 0 ? sample.boughtPos : sample.soldPos,
          a.good,
          bandPos(a.good, price) * crates,
        );
        if (a.units < 0) bumpMap(sample.legThisWeek, who, crates * (price - p.paid[a.good]));
      }
      reduceMut(s, a);
      const gained = p.cash - before;
      // **Pace measure 1.** Counted here rather than from the finished log because the log does not
      // say whose weekend an action belonged to once the season is over.
      if (a.t !== 'EndPhase') bumpMap(sample.decisions, who);
      if (gained > 0 && a.t === 'TradeFood') bumpMap(sample.grossFood, who, gained);
      if (a.t === 'PlaceBet') bumpMap(sample.staked, who, a.stake);
      // §7a.2's row per good, both ways, gross.
      //
      // ⚠️ **The information economy that used to be sampled here is gone (BUILD_PLAN_V3 §2.1).**
      // `infoSpend` / `infoROI` and the FIFO-tagged crates of D44 measured what a Tipster's wage and
      // a dossier bought, and v3 has neither: GDD_V3 §9.4 keeps the fog but moves information into
      // Bar events and staff bonuses, and says it now has exactly one use — knowing whether next
      // week's planet buys your Ambrosia high. That is a Phase B/D measure against a Phase B market,
      // so it is deleted here rather than carried forward measuring nothing.
      if (a.t === 'TradeFood') {
        const crates = Math.abs(Math.trunc(a.units));
        const bones = Math.abs(gained);
        if (a.units > 0) bumpGood(sample.goodsBought, a.good, crates, bones);
        else bumpGood(sample.goodsSold, a.good, crates, bones);
      }
      actions++;
    }
  }
  return { state: s, actions, rankAtLeadWeek: rankAtLeadWeek ?? ranks(s) };
}

export function runHarness(args: Args): string {
  const lines: string[] = [];
  const byAgent = new Map<AiAgent, AgentStats>();
  const stat = (d: AiAgent): AgentStats => {
    let st = byAgent.get(d);
    if (!st) {
      st = {
        worth: [],
        wins: 0,
        seasons: 0,
        prize: [],
        trade: [],
        bet: [],
        costs: [],
        declFitness: [],
        declBelowThreshold: 0,
        entries: [],
        dogsOwned: [],
        dogsAtEnd: [],
        filled: [],
        decisions: [],
        concentration: [],
        grossPrize: [],
        grossFood: [],
        grossBets: [],
        crates: [],
        betsStruck: [],
        bestLeg: [],
        crossover: [],
        neverCrossed: 0,
      };
      byAgent.set(d, st);
    }
    return st;
  };
  const fieldByWeek = new Map<RaceTypeId, number[][]>(
    RACE_TYPE_IDS.map((r) => [r, Array.from({ length: balance.weeks }, () => [] as number[])]),
  );
  const h2h = new Map<string, HeadToHead>();
  const pairing = (a: AiAgent, b: AiAgent): HeadToHead => {
    const key = `${a}|${b}`;
    let p = h2h.get(key);
    if (!p) {
      p = { wins: 0, total: 0 };
      h2h.set(key, p);
    }
    return p;
  };
  let actions = 0;
  let championWonAMajor = 0;
  const entriesByType = byType(() => 0);
  const racesByType = byType(() => 0);
  let poolPosted = 0;
  let poolToPlayers = 0;
  const championConcentration: number[] = [];
  const decidedBy: number[] = [];
  // §7a.2's row per good, across every season.
  const goodsBought = new Map<GoodId, { crates: number; bones: number }>();
  const goodsSold = new Map<GoodId, { crates: number; bones: number }>();
  const boughtPos = new Map<GoodId, number>();
  const soldPos = new Map<GoodId, number>();
  const fed = new Map<GoodId, number>();
  const shelfAtArrival = new Map<GoodId, number[]>();
  const holdBoundByWeek = Array.from({ length: balance.weeks }, () => 0);
  let emptyHoldWeeks = 0;
  let stableWeeks = 0;
  let hungryDogWeeks = 0;
  let dogWeeks = 0;
  /**
   * The same test, split on **whether the stable bet** (GDD §10, §20 Q7).
   *
   * §10 names max stake as a rich-get-richer channel, because §13's edge is a percentage and its
   * cash value is whatever you can stake — so the leader earns most from the identical fixer's fee.
   * The flat ceiling is the guard, and this is the measure that says whether it worked: if a
   * leader gains more from having had a bet than a trailer does, the ceiling is too high.
   */
  const leadBet = {
    aheadBet: [] as number[],
    aheadNone: [] as number[],
    behindBet: [] as number[],
    behindNone: [] as number[],
  };

  const t0 = performance.now();
  for (let i = 0; i < args.seasons; i++) {
    const sample = emptySample();
    const { state, actions: n, rankAtLeadWeek } = playSeason(args.seed + i, args.ai, sample);
    actions += n;
    collect(state, sample);
    collectLead(state, sample, rankAtLeadWeek);
  }
  const elapsed = (performance.now() - t0) / 1000;

  /**
   * §7a.4 `leadConversion` (GDD §20 Q3). For every stable: was it ahead at week 6, did it take a
   * Prime thing, and how many places did it move by week 13?
   *
   * A **positive** delta is places gained, so a bigger number is a stable climbing. The question the
   * two columns answer is whether Prime is an amplifier: if the leaders' Prime gain is larger than
   * the trailers', the top tier is helping whoever is already winning, which is what D11's
   * consumable food and wage-not-purchase staff were shaped to prevent.
   */
  function collectLead(s: GameState, sample: SeasonSample, at6: Map<Id, number>): void {
    const at13 = ranks(s);
    const half = s.players.length / 2;
    for (const p of s.players) {
      const before = at6.get(p.id);
      const after = at13.get(p.id);
      if (before === undefined || after === undefined) continue;
      const delta = before - after; // places gained
      const ahead = before <= half;
      const bet = (sample.staked.get(p.id) ?? 0) > 0;
      if (ahead) (bet ? leadBet.aheadBet : leadBet.aheadNone).push(delta);
      else (bet ? leadBet.behindBet : leadBet.behindNone).push(delta);
    }
    for (const [id, v] of sample.goodsBought) bumpGood(goodsBought, id, v.crates, v.bones);
    for (const [id, v] of sample.goodsSold) bumpGood(goodsSold, id, v.crates, v.bones);
    for (const [id, v] of sample.boughtPos) bumpMap(boughtPos, id, v);
    for (const [id, v] of sample.soldPos) bumpMap(soldPos, id, v);
    for (const [id, v] of sample.fed) bumpMap(fed, id, v);
    for (const [id, v] of sample.shelfAtArrival)
      shelfAtArrival.set(id, [...(shelfAtArrival.get(id) ?? []), ...v]);
    sample.holdBoundByWeek.forEach((n, w) => (holdBoundByWeek[w]! += n));
    emptyHoldWeeks += sample.emptyHoldWeeks;
    stableWeeks += sample.stableWeeks;
    hungryDogWeeks += sample.hungryDogWeeks;
    dogWeeks += sample.dogWeeks;
  }

  function collect(s: GameState, sample: SeasonSample) {
    const standings = s.finalStandings ?? [];
    const winner = standings[0]?.playerId;
    const place = new Map(standings.map((x, i) => [x.playerId, i]));
    for (const p of s.players) {
      const d = p.difficulty ?? 'normal';
      const st = stat(d);
      st.seasons++;
      st.worth.push(netWorth(s, p));
      if (p.id === winner) st.wins++;
      // ⚠️ One arithmetic, two readers: `SeasonEnd.tsx` prints this same split for every stable
      // at the table, so the instrument and the screen cannot drift apart about what a road
      // earned (Phase E item 0).
      const split = roadSplit(s, p);
      st.prize.push(split.prize);
      st.trade.push(split.trade);
      st.bet.push(split.betting);
      st.costs.push(split.costs);
      const fits = sample.declFitness.get(p.id) ?? [];
      for (const f of fits) {
        st.declFitness.push(f);
        if (f < balance.fitnessScaleBelow) st.declBelowThreshold++;
      }
      st.entries.push(sample.entries.get(p.id) ?? 0);
      st.dogsOwned.push(sample.dogsSeen.get(p.id)?.size ?? 0);
      st.dogsAtEnd.push(p.dogIds.length);
      for (const f of sample.filled.get(p.id) ?? []) st.filled.push(f);
      // Per stable-weekend, so the row is comparable with hub-clicks' per-weekend budget.
      st.decisions.push((sample.decisions.get(p.id) ?? 0) / balance.weeks);
      const h = herfindahl(s, p);
      if (h !== null) st.concentration.push(h);
      // Gross, by road. Bet returns come off the settled slips rather than `betIncome`, which is
      // returns minus stakes and so answers a different question.
      const betReturns = s.bets
        .filter((b) => b.playerId === p.id)
        .reduce((sum, b) => sum + (b.settled?.payout ?? 0), 0);
      st.grossPrize.push(p.stats.prizeIncome);
      st.grossFood.push(sample.grossFood.get(p.id) ?? 0);
      st.grossBets.push(betReturns);
      st.crates.push(mean(sample.cratesByWeek.get(p.id) ?? [0]));
      st.betsStruck.push(sample.staked.get(p.id) ?? 0);
      st.bestLeg.push(sample.bestLeg.get(p.id) ?? 0);
      const cross = sample.crossover.get(p.id);
      if (cross === undefined) st.neverCrossed++;
      else st.crossover.push(cross);
    }
    for (const race of RACE_TYPE_IDS) {
      bumpMap(entriesByType, race, sample.entriesByType.get(race) ?? 0);
      bumpMap(racesByType, race, sample.racesByType.get(race) ?? 0);
    }
    poolPosted += sample.poolPosted;
    poolToPlayers += sample.poolToPlayers;
    if (winner) {
      const champ = s.players.find((p) => p.id === winner);
      if (champ) {
        const h = herfindahl(s, champ);
        if (h !== null) championConcentration.push(h);
      }
      decidedBy.push(decidedByWeek(s, winner));
    }
    for (const a of s.players) {
      for (const b of s.players) {
        const da = a.difficulty ?? 'normal';
        const db = b.difficulty ?? 'normal';
        if (AGENT_ORDER.indexOf(da) <= AGENT_ORDER.indexOf(db)) continue;
        const pa = place.get(a.id);
        const pb = place.get(b.id);
        if (pa === undefined || pb === undefined) continue;
        const rec = pairing(da, db);
        rec.total++;
        if (pa < pb) rec.wins++;
      }
    }
    for (const race of RACE_TYPE_IDS) {
      const src = sample.fieldByWeek.get(race)!;
      const dst = fieldByWeek.get(race)!;
      for (let w = 0; w < balance.weeks; w++) for (const v of src[w]!) dst[w]!.push(v);
    }
    const majorWins = new Map<string, number>();
    for (const r of s.results) {
      if (s.calendar[r.week - 1]?.major && r.race === HEADLINE_TYPE_ID) {
        const w = r.payouts.find((x) => x.place === 1);
        if (w) majorWins.set(w.playerId, (majorWins.get(w.playerId) ?? 0) + 1);
      }
    }
    if (winner && (majorWins.get(winner) ?? 0) > 0) championWonAMajor++;
  }

  lines.push(
    `Space Dog Racing harness — ${args.seasons} seasons, stables: ${args.ai.join(', ')}, seeds ${args.seed}…${args.seed + args.seasons - 1}`,
  );
  lines.push(
    `Elapsed ${elapsed.toFixed(1)} s (${((elapsed / args.seasons) * 1000).toFixed(0)} ms/season, ${fmt(actions / args.seasons)} actions/season)`,
  );
  lines.push('');
  lines.push('End net worth (Bones) and win rate by agent');
  lines.push('  agent      n     mean      p10      p50      p90   winRate');
  for (const [d, st] of byAgent) {
    const sorted = [...st.worth].sort((a, b) => a - b);
    lines.push(
      `  ${d.padEnd(8)} ${String(st.seasons).padStart(4)} ${fmt(mean(st.worth)).padStart(8)} ${fmt(quantile(sorted, 0.1)).padStart(8)} ${fmt(quantile(sorted, 0.5)).padStart(8)} ${fmt(quantile(sorted, 0.9)).padStart(8)}   ${pct(st.wins / Math.max(1, st.seasons)).padStart(6)}`,
    );
  }
  // ⚠️ `bankruptRate` is gone, and it is not a row waiting to be re-derived: there is no bankruptcy
  // in v3 (BUILD_PLAN_V3 §2.1, GDD_V3 V10, pillar 5). GDD_V3 §11's replacement failure state is
  // "stables ending a season on less than they started", 10–25%, which is the row below.
  if (h2h.size) {
    lines.push('');
    lines.push(
      'Head to head — share of same-season pairings the stronger stable finished above (M4 targets: hard>normal ~65%, normal>easy ~80%)',
    );
    for (const [key, rec] of h2h) {
      const [a, b] = key.split('|');
      lines.push(
        `  ${`${a} beats ${b}`.padEnd(24)} ${pct(rec.wins / Math.max(1, rec.total)).padStart(6)}   (${rec.total} pairings)`,
      );
    }
  }
  lines.push('');
  lines.push('Income split per stable-season (mean): prize / trade / betting / costs');
  for (const [d, st] of byAgent) {
    lines.push(
      `  ${d.padEnd(8)} ${fmt(mean(st.prize)).padStart(8)} ${fmt(mean(st.trade)).padStart(8)} ${fmt(mean(st.bet)).padStart(8)} ${fmt(mean(st.costs)).padStart(8)}`,
    );
  }
  lines.push(
    '  ⚠️ costs is food and event bills only — no upkeep, wages, fuel or interest (GDD_V3 V10)',
  );

  // §7a.4: the kennel measures. Race or Rest is judged on these and nothing else.
  //
  // ⚠️ **Two of v2's four targets are gone rather than missed.** `dogs at wk 13 ≥ 4.5` and the
  // `distinct dogs owned` column measured a stable that could *buy* dogs; with the dog market
  // deleted (BUILD_PLAN_V3 §2.1) every stable owns the three it was dealt, and a column whose only
  // possible value is 3.00 is not a measure. Both are kept in the print for one phase as a
  // deletion check — if either ever reads anything but 3.00, something is making dogs it should
  // not be — and `races/dog` moves from v2's fitted 7–9 to GDD_V3 Phase A's **5–7**, because a
  // three-dog stable over ten weekends cannot reach 7 and being told so every run is noise.
  lines.push('');
  lines.push(
    `The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under ${balance.fitnessScaleBelow} 10–25%, races/dog 5–7)`,
  );
  lines.push(
    `  agent     meanFit   <thresh   races/dog   dogs@wk${balance.weeks}   distinct dogs owned`,
  );
  for (const [d, st] of byAgent) {
    const declared = st.declFitness.length;
    const racesPerDog = mean(st.entries) / Math.max(0.001, mean(st.dogsOwned));
    lines.push(
      `  ${d.padEnd(8)} ${mean(st.declFitness).toFixed(1).padStart(7)} ${pct(st.declBelowThreshold / Math.max(1, declared)).padStart(9)} ${racesPerDog.toFixed(1).padStart(11)} ${mean(st.dogsAtEnd).toFixed(2).padStart(10)} ${mean(st.dogsOwned).toFixed(2).padStart(21)}`,
    );
  }

  // §7a.2: "average Gold field rating by week" is retired — it measures a class that Phase B
  // deletes, and what it was really asking (are stables racing up?) reads off every race.
  lines.push('');
  lines.push('Field strength by week, per race type (mean entrant rating, all eight traps)');
  for (const race of RACE_TYPE_IDS) {
    lines.push(
      `  ${raceType(race).label.padEnd(13)} ${fieldByWeek
        .get(race)!
        .map((w) => mean(w).toFixed(0).padStart(3))
        .join(' ')}`,
    );
  }

  // The two numbers that say whether the card is a decision or a lottery. ⚠️ `cardCoverage` is
  // deleted (item 10) — see the sampling loop for why an open-entry card cannot have one.
  const totalRaces = RACE_TYPE_IDS.reduce((sum, r) => sum + (racesByType.get(r) ?? 0), 0);
  const totalEntries = RACE_TYPE_IDS.reduce((sum, r) => sum + (entriesByType.get(r) ?? 0), 0);
  lines.push('');
  lines.push('The card (GDD §6.3) — how often each type runs, and whether a stable can fill it');
  lines.push('  type            share of races   share of entries   entries/race');
  for (const race of RACE_TYPE_IDS) {
    const runs = racesByType.get(race) ?? 0;
    const ent = entriesByType.get(race) ?? 0;
    lines.push(
      `  ${raceType(race).label.padEnd(14)} ${pct(runs / Math.max(1, totalRaces)).padStart(13)} ` +
        `${pct(ent / Math.max(1, totalEntries)).padStart(18)} ` +
        `${(ent / Math.max(1, runs)).toFixed(2).padStart(14)}`,
    );
  }
  lines.push('  Every weekend runs all three now, so the share columns are a shape check.');

  lines.push('');
  lines.push('Filling the card — how many of the weekend’s three races a stable declares into');
  for (const [d, st] of byAgent) {
    const n = Math.max(1, st.filled.length);
    const share = (k: number) => pct(st.filled.filter((x) => x === k).length / n);
    lines.push(
      `  ${d.padEnd(8)} all three ${share(3).padStart(6)} · two ${share(2).padStart(6)} · one ${share(1).padStart(6)} · none ${share(0).padStart(6)}   (mean ${mean(st.filled).toFixed(2)})`,
    );
  }

  // **The three pace measures (BUILD_PLAN_V3 Phase A, item 10).**
  //
  // These are the rows v3 is actually about — §1 asks whether four players takes forty minutes and
  // whether anything memorable happens in it — so they are printed together, with their bands, at
  // the level of a single weekend rather than buried in three different tables.
  //
  // ⚠️ **Only one of the three is tunable in this phase, and only by one number.** Phase A's
  // instruction is that if `races entered per weekend` misses 1.8–2.4 the Race fitness cost moves
  // and nothing else does — not the purses, which would reach the same row by paying a stable to
  // run a tired dog rather than by making a tired dog cheaper to run.
  lines.push('');
  lines.push('Pace (GDD_V3 §1, §10.1) — the three rows v3 is about');
  lines.push('  agent     decisions/weekend   races entered/weekend   races/dog/season');
  for (const [d, st] of byAgent) {
    const racesPerDog = mean(st.entries) / Math.max(0.001, mean(st.dogsOwned));
    lines.push(
      `  ${d.padEnd(8)} ${mean(st.decisions).toFixed(2).padStart(17)} ${mean(st.filled).toFixed(2).padStart(23)} ${racesPerDog.toFixed(2).padStart(18)}`,
    );
  }
  const paceBand = (v: number, lo: number, hi: number) =>
    v < lo ? `MISSED low (${v.toFixed(2)})` : v > hi ? `MISSED high (${v.toFixed(2)})` : 'MET';
  const allFilled = [...byAgent.values()].flatMap((st) => st.filled);
  const allEntries = mean([...byAgent.values()].flatMap((st) => st.entries));
  const allDogs = mean([...byAgent.values()].flatMap((st) => st.dogsOwned));
  const allDecisions = mean([...byAgent.values()].flatMap((st) => st.decisions));
  lines.push(
    `  all stables: decisions ${allDecisions.toFixed(2)} a weekend · entered ` +
      `${mean(allFilled).toFixed(2)} of 3 (band 1.8–2.4: ${paceBand(mean(allFilled), 1.8, 2.4)}) · ` +
      `races/dog ${(allEntries / Math.max(0.001, allDogs)).toFixed(2)} ` +
      `(band 5–7: ${paceBand(allEntries / Math.max(0.001, allDogs), 5, 7)})`,
  );
  lines.push(
    '  decisions/weekend counts chosen actions only, not EndPhase. The ≤ 10 budget belongs to' +
      ' hub-clicks,',
  );
  lines.push(
    '  which counts a human’s presses including navigation; this row is the same question asked of' +
      ' the AI.',
  );

  // GDD §7.1 / D15. The pool is what the card posts; the share is what a player actually banks.
  lines.push('');
  lines.push(
    `Purse pool: ${fmt(poolPosted / Math.max(1, args.seasons))} posted a season, ` +
      `${pct(poolToPlayers / Math.max(1, poolPosted))} of it reaching a player ` +
      `(v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)`,
  );

  lines.push('');
  lines.push('Gross income by road per stable-season, and prize as a share of it (GDD §7.1)');
  lines.push('  agent       prize     food sold   bets returned   prize share');
  for (const [d, st] of byAgent) {
    const prize = mean(st.grossPrize);
    const total = prize + mean(st.grossFood) + mean(st.grossBets);
    lines.push(
      `  ${d.padEnd(8)} ${fmt(prize).padStart(9)} ${fmt(mean(st.grossFood)).padStart(11)} ` +
        `${fmt(mean(st.grossBets)).padStart(15)} ${pct(prize / Math.max(1, total)).padStart(13)}`,
    );
  }
  lines.push('  Target (BUILD_PLAN §6b): prize share falls toward 65%. Gross, not net — the');
  lines.push('  question is where the money came in, not whether the road turned a profit.');

  // §7a.2's row per good, and BUILD_PLAN_V3 Phase B item 8's additions to it: crates fed, and the
  // mean *band position* of every crate bought and sold — 0.0 at the floor, 1.0 at the ceiling. The
  // column that says whether a stable is trading at all is `paid@`: at 0.5 it is paying the going
  // rate, at 0.2 it is hunting.
  const seasonsRun = Math.max(1, args.seasons * args.ai.length);
  lines.push('');
  lines.push(
    'The goods, per stable-season — bought, sold, fed, and where in its band the price sat (0 floor, 1 ceiling)',
  );
  lines.push(
    '  good               bought   paid@   Bones out     sold   sold@    Bones in      fed   shelf',
  );
  for (const g of GOODS) {
    const b = goodsBought.get(g.id) ?? { crates: 0, bones: 0 };
    const sold = goodsSold.get(g.id) ?? { crates: 0, bones: 0 };
    const at = (sum: number, n: number) => (n ? (sum / n).toFixed(2) : '  — ');
    lines.push(
      `  ${g.label.padEnd(16)} ${(b.crates / seasonsRun).toFixed(1).padStart(8)} ` +
        `${at(boughtPos.get(g.id) ?? 0, b.crates).padStart(7)} ${fmt(b.bones / seasonsRun).padStart(11)} ` +
        `${(sold.crates / seasonsRun).toFixed(1).padStart(8)} ${at(soldPos.get(g.id) ?? 0, sold.crates).padStart(7)} ` +
        `${fmt(sold.bones / seasonsRun).padStart(11)} ${((fed.get(g.id) ?? 0) / seasonsRun).toFixed(1).padStart(8)} ` +
        `${mean(shelfAtArrival.get(g.id) ?? [0])
          .toFixed(1)
          .padStart(7)}`,
    );
  }

  // **The Phase B rows (BUILD_PLAN_V3 Phase B), printed together with their bands**, the way Phase A
  // printed the pace rows — so a run answers "did the market land?" without a flag. The p99 leg is
  // the row that protects the game (§6.4) and is deliberately not behind one.
  const band = (v: number, lo: number, hi: number, fmtV: (x: number) => string) =>
    v < lo ? `MISSED low (${fmtV(v)})` : v > hi ? `MISSED high (${fmtV(v)})` : 'MET';
  const all = [...byAgent.values()];
  const allWorth = all.flatMap((st) => st.worth);
  const meanWorth = mean(allWorth);
  const grossAll =
    mean(all.flatMap((st) => st.grossPrize)) +
    mean(all.flatMap((st) => st.grossFood)) +
    mean(all.flatMap((st) => st.grossBets));
  const foodShare = mean(all.flatMap((st) => st.grossFood)) / Math.max(1, grossAll);
  const crossWeeks = all.flatMap((st) => st.crossover);
  const never = all.reduce((n, st) => n + st.neverCrossed, 0);
  const legs = all.flatMap((st) => st.bestLeg).sort((a, b) => a - b);
  const p99 = quantile(legs, 0.99);
  const ambrosia = shelfAtArrival.get(GOODS[GOODS.length - 1]!.id) ?? [0];
  const emptyShare = emptyHoldWeeks / Math.max(1, stableWeeks);
  const sortedWorth = [...allWorth].sort((a, b) => a - b);
  const spread = quantile(sortedWorth, 0.9) / Math.max(1, quantile(sortedWorth, 0.1));
  lines.push('');
  lines.push('The market (BUILD_PLAN_V3 Phase B) — the rows that say whether it landed');
  lines.push(
    `  food sold, share of gross income   ${pct(foodShare).padStart(7)}   band 20–35%: ${band(foodShare, 0.2, 0.35, pct)}`,
  );
  lines.push(
    `  cash-bound → hold-bound, week      ${mean(crossWeeks).toFixed(1).padStart(7)}   band 4–7: ${band(mean(crossWeeks), 4, 7, (x) => x.toFixed(1))}` +
      `   (${pct(crossWeeks.length / Math.max(1, crossWeeks.length + never))} of stable-seasons ever cross)`,
  );
  lines.push(
    `  hold-bound at the jump, by week    ${holdBoundByWeek.map((n) => pct(n / Math.max(1, args.seasons * args.ai.length)).padStart(6)).join(' ')}`,
  );
  lines.push(
    `  best trading leg in a season, p99  ${fmt(p99).padStart(7)}   = ${pct(p99 / Math.max(1, meanWorth))} of mean end worth — target < 40%: ${p99 / Math.max(1, meanWorth) < 0.4 ? 'MET' : 'MISSED'}` +
      `   (p50 ${fmt(quantile(legs, 0.5))}, max ${fmt(legs[legs.length - 1] ?? 0)})`,
  );
  lines.push(
    `  hold empty at the jump             ${pct(emptyShare).padStart(7)}   of stable-weeks — target < 5%: ${emptyShare < 0.05 ? 'MET' : 'MISSED'}` +
      `   · dogs hungry ${pct(hungryDogWeeks / Math.max(1, dogWeeks))} of dog-weeks`,
  );
  lines.push(
    `  Ambrosia on one planet's shelf     ${mean(ambrosia).toFixed(1).padStart(7)}   mean, max ${Math.max(...ambrosia)} — target ≤ 8: ${mean(ambrosia) <= 8 ? 'MET' : 'MISSED'}`,
  );
  lines.push(
    `  net worth p90 / p10                ${spread.toFixed(2).padStart(6)}×   diagnostic, not a target: wider is variance back through the market (v3a 2.3×)`,
  );
  lines.push(
    '  A leg is one week of a stable’s sales, crates × (sell − You Paid), summed across goods. Hold-bound is',
  );
  lines.push(
    '  ≥ 90% full at the jump with cash for another tenth of the hold of the dearest good (decision B5).',
  );

  // ⚠️ **The Prime half of leadConversion is gone with the tier ladder (BUILD_PLAN_V3 §2.1).**
  // "Does a Prime offer widen the lead?" cannot be asked of a game with no tiers. What survives is
  // the betting split below, which is the same shape on a channel v3 still has — and GDD_V3 §11's
  // "net worth gap, 1st to last, narrower than v2's" is the row that replaces it. Phase B should
  // re-point this machinery at the six-good market, where "does a good leg widen the lead" is the
  // live version of the question.
  const row = (label: string, withP: number[], without: number[]): void => {
    const a = mean(withP);
    const b = mean(without);
    lines.push(
      `  ${label.padEnd(14)} ${a.toFixed(2).padStart(6)} (n ${String(withP.length).padStart(5)})  ` +
        `${b.toFixed(2).padStart(6)} (n ${String(without.length).padStart(5)})  ` +
        `${(a - b >= 0 ? '+' : '') + (a - b).toFixed(2)}`,
    );
  };

  // §20 Q7: the same shape again, on the channel the flat stake ceiling exists to close.
  lines.push('');
  lines.push('leadConversion, split on whether the stable bet (GDD §10, §20 Q7)');
  lines.push('  group              bet          did not bet     the gap betting makes');
  row('ahead at wk 6', leadBet.aheadBet, leadBet.aheadNone);
  row('behind at wk 6', leadBet.behindBet, leadBet.behindNone);
  const leaderBet = mean(leadBet.aheadBet) - mean(leadBet.aheadNone);
  const trailerBet = mean(leadBet.behindBet) - mean(leadBet.behindNone);
  lines.push(
    `  Max stake ${pct(balance.maxStakeFraction)} of cash (GDD_V3 §7.4) against the ` +
      `${pct(balance.maxStakeFraction)} fraction. Leader ${leaderBet >= 0 ? '+' : ''}${leaderBet.toFixed(2)}, ` +
      `trailer ${trailerBet >= 0 ? '+' : ''}${trailerBet.toFixed(2)} — ${leaderBet <= trailerBet ? 'MET' : 'MISSED'}.`,
  );

  lines.push('');
  lines.push(
    `Concentration (Herfindahl over dog values at week ${balance.weeks}): champion ${mean(championConcentration).toFixed(3)}, ` +
      `all stables ${mean([...byAgent.values()].flatMap((st) => st.concentration)).toFixed(3)} — target: champion below 0.400`,
  );
  lines.push(
    `Season decided by week ${mean(decidedBy).toFixed(1)} — the earliest week the champion led and never lost the lead (v1: 7.6, later is better)`,
  );

  lines.push(
    `Seasons where the champion won at least one Major Gold Cup: ${pct(championWonAMajor / Math.max(1, args.seasons))}`,
  );

  return lines.join('\n');
}

/** Race calibration: one dog of quality q against seven of quality 50 (GDD §6.2 targets). */
export function runCalibration(seed = 7, n = 2000): string {
  const lines: string[] = [
    'Race calibration: one dog vs seven rating-50 dogs, standard 480 m track',
  ];
  const rng = mulberry32(seed);
  let counter = 0;
  const nextId = (p: string) => `${p}${counter++}`;
  const track: Track = { distance: 480, length: 'standard', bends: 'medium', hazard: 1 };
  const results: { q: number; win: number; modelP: number }[] = [];
  for (const q of [35, 45, 50, 55, 65, 75]) {
    let wins = 0;
    let modelP = 0;
    for (let i = 0; i < n; i++) {
      const hero = fitRating(
        createDog({ quality: q, age: 3, owner: 'local', traits: [] }, rng, nextId),
        q,
        q,
      );
      const field = [hero];
      for (let k = 0; k < 7; k++)
        field.push(
          fitRating(
            createDog({ quality: 50, age: 3, owner: 'local', traits: [] }, rng, nextId),
            50,
            50,
          ),
        );
      const runners: Runner[] = rng.shuffle(field).map((d, idx) => ({
        id: d.id,
        trap: idx + 1,
        speed: d.speed,
        accel: d.accel,
        stamina: d.stamina,
        fitness: d.fitness,
        form: d.form,
        traits: d.traits,
        style: d.style,
      }));
      const r = simulateRace(runners, { track, major: false }, mulberry32(rng.int(0, 2 ** 31)));
      if (r.order[0] === hero.id) wins++;
      modelP += winProbabilities(runners.map((x) => field.find((d) => d.id === x.id)!.rating))[
        runners.findIndex((x) => x.id === hero.id)
      ]!;
    }
    results.push({ q, win: wins / n, modelP: modelP / n });
    lines.push(`  rating ${q}: sim wins ${pct(wins / n)}   bookie model ${pct(modelP / n)}`);
  }
  // Best-fit oddsScale for the sim (least squares on log-odds vs rating gap).
  let bestScale = balance.oddsScale;
  let bestErr = Infinity;
  for (let scale = 8; scale <= 40; scale += 0.25) {
    let err = 0;
    for (const r of results) {
      const p =
        Math.pow(10, r.q / scale) / (Math.pow(10, r.q / scale) + 7 * Math.pow(10, 50 / scale));
      err += (p - r.win) ** 2;
    }
    if (err < bestErr) {
      bestErr = err;
      bestScale = scale;
    }
  }
  lines.push(
    `  oddsScale in balance.json: ${balance.oddsScale}; best fit to the sim: ${bestScale}`,
  );
  // D52's criterion, printed rather than remembered: the danger is the *overlay* — the book
  // under-rating a dog and leaving money on the table — so each candidate's largest overlay is shown
  // beside its rms error, and the sheet value is the one that leaves the smallest.
  lines.push(
    '  scale   largest overlay (sim above book)   rms error   (D52: the sheet takes the least overlay)',
  );
  const candidates = [...new Set([balance.oddsScale, 15.75, 16.5, 17.5, bestScale])].sort(
    (a, b) => a - b,
  );
  for (const scale of candidates) {
    let over = -Infinity;
    let at = 0;
    let sq = 0;
    for (const r of results) {
      const p =
        Math.pow(10, r.q / scale) / (Math.pow(10, r.q / scale) + 7 * Math.pow(10, 50 / scale));
      if (r.win - p > over) {
        over = r.win - p;
        at = r.q;
      }
      sq += (r.win - p) ** 2;
    }
    const mark = scale === balance.oddsScale ? '  ← balance.json' : '';
    lines.push(
      `  ${scale.toFixed(2).padStart(5)}   ${(over * 100).toFixed(2).padStart(5)} points at rating ${String(at).padEnd(14)}   ${(Math.sqrt(sq / results.length) * 100).toFixed(2).padStart(5)}${mark}`,
    );
  }
  return lines.join('\n');
}

/**
 * The D12 regression (GDD §5.1, §6.2). +10 to one stat from a balanced rating-50 dog against
 * seven balanced 50s, at four track shapes. This is the measurement the whole v2 goods market
 * rests on — Phase C's four stat feeds are one good and three traps if it ever drifts back — so
 * it lives in the instrument rather than in a throwaway script.
 *
 * The field is rolled the way the game rolls dogs (createDog + fitRating, as --calibrate does)
 * rather than with eight identical stat lines: with every rival on exactly 50 Trap the bump
 * tie-break falls the hero's way every time, which flatters Trap by about two points.
 */
export function runStatLeverage(n = 3000, seed = 20260911): string {
  const tracks: { label: string; track: Track }[] = [
    {
      label: 'sprint 350  ',
      track: { distance: 350, length: 'sprint', bends: 'medium', hazard: 1 },
    },
    {
      label: 'standard 480',
      track: { distance: 480, length: 'standard', bends: 'medium', hazard: 1 },
    },
    {
      label: 'staying 600 ',
      track: { distance: 600, length: 'staying', bends: 'medium', hazard: 1 },
    },
    {
      label: 'tight 480   ',
      track: { distance: 480, length: 'standard', bends: 'tight', hazard: 1 },
    },
  ];
  const stats: (StatKey | null)[] = [null, 'speed', 'accel', 'stamina'];
  const base = 50;
  const bump = 10;
  const lines: string[] = [
    `Stat leverage: +${bump} to one stat from a balanced rating-${base} dog vs seven ${base}s, ${n} races/cell`,
    // ⚠️ **The band is Phase A's, not v2's** (BUILD_PLAN_V3 Phase A): speed > accel > stamina, all
    // 14–26%. Accel carries Trap's old weight now (GDD_V3 V9), so it should read *higher* than
    // either v2's accel row (14–18) or its trap row (12–16) did.
    `Target (BUILD_PLAN_V3 Phase A, standard 480): speed > accel > stamina, all 14–26%`,
    '  track        |    none    | +10 speed   +10 accel   +10 stam   (win% / place%)',
  ];
  for (const { label, track } of tracks) {
    const cells: string[] = [];
    for (const stat of stats) {
      const rng = mulberry32(seed);
      let counter = 0;
      const nextId = (p: string) => `${p}${counter++}`;
      let wins = 0;
      let places = 0;
      for (let i = 0; i < n; i++) {
        const field = [];
        for (let k = 0; k < 8; k++) {
          field.push(
            fitRating(
              createDog({ quality: base, age: 3, owner: 'local', traits: [] }, rng, nextId),
              base,
              base,
            ),
          );
        }
        const hero = field[0]!;
        if (stat) hero[stat] += bump;
        const runners: Runner[] = rng.shuffle([...field]).map((d, idx) => ({
          id: d.id,
          trap: idx + 1,
          speed: d.speed,
          accel: d.accel,
          stamina: d.stamina,
          fitness: 100,
          form: 0,
          traits: [],
          style: d.style,
        }));
        const res = simulateRace(runners, { track, major: false }, mulberry32(rng.int(0, 2 ** 31)));
        if (res.order[0] === hero.id) wins++;
        if (res.order.slice(0, 3).includes(hero.id)) places++;
      }
      const p = (x: number) => (x * 100).toFixed(1);
      cells.push(`${p(wins / n).padStart(5)}/${p(places / n).padStart(4)}`);
    }
    lines.push(`  ${label} | ${cells[0]} | ${cells.slice(1).join('  ')}`);
  }
  lines.push(
    '  Accel should peak on the sprint AND on the tight bends — it is the break and the line now',
  );
  lines.push(
    '  (GDD_V3 V9). Stamina should climb with the trip: since A7 the fade point is metres from the',
  );
  lines.push(
    '  boxes rather than a fraction of the distance, so a sprint barely reaches it and a staying trip',
  );
  lines.push('  runs well past it (GDD_V3 B9, decision C5).');
  return lines.join('\n');
}

/*
 * ⚠️ **`--card` is gone (BUILD_PLAN_V3 §2.1, item 10's `cardCoverage`).** It rolled stables against
 * random cards and asked what share of weeks each could *fill* — the measure D2's fact-gated card
 * existed for, and the one that proved a one-good-dog stable could only fill all three 10.3% of the
 * time. With open entry (GDD_V3 §7.1) every stable with three sound dogs fills all three, every
 * week, so the answer is 100% by construction and the probe measures nothing. `maxFilled` went with
 * it. The live question it leaves behind — *do stables actually enter all three?* — is a fitness
 * question now, and it is Phase A's `races entered per weekend` row.
 */

/*
 * ⚠️ **`--pups` is gone (BUILD_PLAN_V3 §2.1).** It measured D14's pup curve: what a Train week with
 * each grade of trainer buys a one-year-old, and the week a raised pup reaches par. Every input to
 * it is deleted — there are no pups to buy (no dog market), no Train week (GDD_V3 V8) and no
 * trainers to grade (§2.1) — so it cannot be pointed at anything v3 has.
 *
 * GDD_V3 §4.3's growth bands are much flatter than v2's on purpose (+1 a week at ages 1–2 against
 * v2's +2), because age now matters **across seasons** rather than inside one. What would be worth
 * measuring is therefore a multi-season question, and it belongs with Phase E's off-season and its
 * retirement window rather than here.
 */

/**
 * What `sabotageFitness` is worth in rating points to the bookie's model — the conversion any
 * agent, screen or probe has to make, because the engine takes *fitness* off a runner and the book
 * speaks only *rating*. Kept beside `runFixProbe` and mirrored by `SABOTAGE_RATING_EQUIV` in
 * `ai/paths.ts`, which is the one place it is acted on.
 */
export function runHardAblation(seasons = 600, seed = 1): string {
  const lines: string[] = [];
  const before = { ...HARD_KNOBS };
  // ⚠️ **The project's own table, not a cleaner one.** This mode was first written as three Hard
  // against three Normal, which reads Hard a point weaker than the standing measure does and —
  // measured — does not agree with it about what helps: the one-ruler repair below is worth +2.5
  // points three-against-three and nothing at all here. A head-to-head is a property of the table
  // it is played at, so an ablation run at a different table is answering a different question
  // from the one BUILD_PLAN's acceptance row asks (E-D49).
  const ai: AiAgent[] = ['easy', 'normal', 'normal', 'hard', 'hard', 'normal'];
  const HARDS = new Set(['p4', 'p5']);
  const NORMALS = new Set(['p2', 'p3', 'p6']);
  const run = (): { rate: number; hard: number; normal: number; p10: number } => {
    let wins = 0;
    let pairs = 0;
    const hard: number[] = [];
    const normal: number[] = [];
    for (let i = 0; i < seasons; i++) {
      const { state } = playSeason(seed + i, ai, emptySample());
      const h: number[] = [];
      const n: number[] = [];
      for (const p of state.players) {
        if (HARDS.has(p.id)) h.push(netWorth(state, p));
        else if (NORMALS.has(p.id)) n.push(netWorth(state, p));
      }
      hard.push(...h);
      normal.push(...n);
      for (const a of h)
        for (const b of n) {
          pairs++;
          if (a > b) wins++;
        }
    }
    const sorted = [...hard].sort((a, b) => a - b);
    return {
      rate: wins / Math.max(1, pairs),
      hard: mean(hard),
      normal: mean(normal),
      p10: quantile(sorted, 0.1),
    };
  };

  lines.push(
    `Hard's own decisions, ablated — ${seasons} seasons at the standing table ` +
      `(easy, normal ×3, hard ×2), the same seeds every row`,
  );
  lines.push('');
  lines.push('  row                              beats Normal   Hard mean   p10     Normal mean');
  const rows: [string, Partial<typeof HARD_KNOBS>][] = [
    ['as built (Phase D: one ruler each)', { sameRuler: false }],
    ['  rates its dogs like Normal', { ratesByStats: false, sameRuler: false }],
    ['  one ruler: stats on both sides', { sameRuler: true }],
    ['  does not hold for a Major', { sameRuler: false, holdsForMajor: false }],
    ['  never throws the cheap race', { sameRuler: false, throwsCheapRace: false }],
  ];
  for (const [label, knobs] of rows) {
    Object.assign(HARD_KNOBS, before, knobs);
    const r = run();
    lines.push(
      `  ${label.padEnd(32)} ${pct(r.rate).padStart(8)} ${fmt(r.hard).padStart(12)} ` +
        `${fmt(r.p10).padStart(8)} ${fmt(r.normal).padStart(12)}`,
    );
  }
  Object.assign(HARD_KNOBS, before);
  lines.push('');
  lines.push(
    `  Target: 63–68%. ⚠️ At ${seasons} seasons the standard error on a head-to-head is about ` +
      `${(50 / Math.sqrt(seasons)).toFixed(1)} points`,
  );
  lines.push(
    '  (BUILD_PLAN §7: the effective sample is the SEASON, not the pairing), so a row inside two of',
  );
  lines.push(
    '  those of "as built" has not moved anything and must not be adopted as though it had.',
  );
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.calibrate) console.log(runCalibration());
  else if (args.stats) console.log(runStatLeverage());
  else if (args.autoplan) console.log(runAutoplan(args.seasons));
  else if (args.hardAblation)
    console.log(runHardAblation(args.seasons === 50 ? 600 : args.seasons, args.seed));
  else console.log(runHarness(args));
}

// The entry point, at the end of the file and not in the middle of it: `main()` runs at module
// load, so anything declared below the call sits in its temporal dead zone. Functions are hoisted
// and survived that; the first `const` added after it did not.
if (process.argv[1]?.endsWith('harness.ts')) main();
