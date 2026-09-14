/**
 * Balance harness (BUILD_PLAN §7 and §7a). Runs N headless seasons and prints the stats the
 * plan asks for. Usage (from the repo root):
 *   npm run harness -- --seasons 200 [--ai normal,normal,normal,normal,normal,normal] [--seed 1]
 *   npm run harness -- --seasons 400 --ai careless,normal,normal,normal   # D6, bankruptRate
 *   npm run harness -- --calibrate        # race-sim win rates vs rating gap + oddsScale fit
 *   npm run harness -- --stats            # D12 regression: +10 to one stat, at three lengths
 *   npm run harness -- --pups             # D14: what a Train week is worth, and when a pup arrives
 *   npm run harness -- --card             # D2: can a broad stable fill the card, and a narrow one?
 *   npm run harness -- --autoplan --seasons 200   # §7a.3: autoplan% and the sampled apLoss rollout
 *   npm run harness -- --fix              # §13: what a nobbling is worth, and what it costs
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
import { good, GOODS, TIER_LABEL, TIER_ORDER } from '../src/content/goods';
import { createDog, fitRating } from '../src/economy/market';
import { baseRating, dogValue } from '../src/economy/dogValue';
import { netWorth } from '../src/economy/netWorth';
import { cargoTotal } from '../src/economy/goods';
import { bestStaff, cargoCap, infoReach } from '../src/economy/staff';
import { roadSplit } from '../src/economy/roadSplit';
import { FIXER_CATCH_MULT, jobCost } from '../src/content/staff';
import { clamp, mulberry32 } from '../src/rng';
import { createSeason, eligible, FREE_HORIZON, player, thisWeeksCard } from '../src/state';
import { decide } from '../src/ai';
import { MIX_KNOBS, PATH_KNOBS } from '../src/ai/paths';
import { HARD_KNOBS } from '../src/ai/hard';
import { STACK_OVERRIDE } from '../src/ai/shared';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { simulateRace, type Runner } from '../src/race/simulateRace';
import { winProbabilities } from '../src/race/odds';
import { DRAWN_PER_WEEKEND, OPEN_TYPE_ID, RACE_TYPES, raceType } from '../src/content/raceTypes';
import {
  RACE_TYPE_IDS,
  STAT_KEYS,
  type Action,
  type AiAgent,
  type Dog,
  type GameState,
  type Id,
  type GoodId,
  type Player,
  type StaffRole,
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
  pups: boolean;
  card: boolean;
  autoplan: boolean;
  /** §7a.4's Prime-amplification test (GDD §20 Q3). */
  leadConversion: boolean;
  /** §7a.5's three-way printout: the trainer and the trader in the same seasons. */
  roads: boolean;
  /** §13's ablation: the crook agent with the road worked and with it switched off (D42). */
  crookAblation: boolean;
  /** D43: which of the three constraints on a mixed stable actually binds. */
  mixability: boolean;
  /** §14: which of Hard's own decisions is costing it its head-to-head band. */
  hardAblation: boolean;
  /** §6b's cargo-payback ablation: run the trader with and without buying hold. */
  holdPayback: boolean;
  /** D7's stacking row: three of one role against a mixed three, in the same seasons. */
  stacking: boolean;
  /** §13's road, priced against the fields the game actually produces (GDD §20 Q7). */
  fix: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    seasons: 50,
    ai: Array(6).fill('normal'),
    seed: 1,
    calibrate: false,
    stats: false,
    pups: false,
    card: false,
    autoplan: false,
    leadConversion: false,
    roads: false,
    crookAblation: false,
    mixability: false,
    hardAblation: false,
    holdPayback: false,
    stacking: false,
    fix: false,
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
    else if (a === '--pups') args.pups = true;
    else if (a === '--card') args.card = true;
    else if (a === '--autoplan') args.autoplan = true;
    else if (a === '--leadConversion' || a === '--lead') args.leadConversion = true;
    else if (a === '--roads') args.roads = true;
    else if (a === '--crookAblation') args.crookAblation = true;
    else if (a === '--mixability') args.mixability = true;
    else if (a === '--hardAblation') args.hardAblation = true;
    else if (a === '--holdPayback' || a === '--hold') args.holdPayback = true;
    else if (a === '--stacking') args.stacking = true;
    else if (a === '--fix') args.fix = true;
    else if (a === '--quiet') args.quiet = true;
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
  bankrupt: number;
  dogsBought: number[];
  /** §7a.4: fitness of every dog at the moment it was declared. */
  declFitness: number[];
  declBelowThreshold: number;
  /** Race entries and distinct dogs owned, per stable-season → races per dog. */
  entries: number[];
  dogsOwned: number[];
  dogsAtEnd: number[];
  /** §6.3: how many of the weekend's three races the stable filled, every stable-week. */
  filled: number[];
  /** §7a.4: Herfindahl over the stable's dog values at week 13. 1.0 is one dog, 0.2 is five. */
  concentration: number[];
  /** §7.1: gross income by road, so "prize is 87% of it" is a number rather than a claim. */
  grossPrize: number[];
  grossFood: number[];
  grossDogs: number[];
  grossBets: number[];
  /** Mean crates aboard at the end of each week — what the trader's road is actually carrying. */
  crates: number[];
  /** Hold capacity at week 13, ship plus staff. */
  hold: number[];
  /**
   * §13's rows (BUILD_PLAN §6b Phase D). `caught` is seasons in which the stewards got this stable
   * at least once — read off `flags.fixerBarred`, which is set on a catch and never cleared, so it
   * is exactly "caught at least once" and needs nothing added to the engine to say so.
   */
  fixes: number[];
  caught: number;
  worthCaught: number[];
  /**
   * ⚠️ **Among stables that actually fixed something.** BUILD_PLAN §6b asks for "a caught crook's
   * mean end worth, below the trainer agent's", and read naively that row is confounded: the
   * crooks that never get caught are mostly the ones whose road never opened — no fixer, or never
   * the cash to use one — so "clean" quietly means "poor and honest by accident". Measured that
   * way a caught crook looks *richer* than a clean one, which is selection rather than crime
   * paying. Splitting on "fixed at least once" is the comparison the row was reaching for.
   */
  worthClean: number[];
  worthCleanFixer: number[];
  /**
   * What §13 cost this stable: fees plus fines, off `fixArchive` (E item 1).
   *
   * ⚠️ **It used to be inside `costs` and being inside `costs` is why nobody could see it.** The
   * road's *earnings* have always been legible — they are in `bet` and in `prize` — and what it
   * cost was folded in with the wages and the fuel, so the one comparison that decides whether the
   * road is worth walking could only be made by ablation. It is a column now, here and on the
   * Season End screen, from the same `roadSplit`.
   */
  fixSpend: number[];
  betsStruck: number[];
  /**
   * §7a.4's `infoSpend` / `infoROI`. Bones spent looking past the fog — dossiers, a Tipster's
   * wages, and information bought from an event card — against what the legs that information
   * covered actually returned, measured next to the same stable's uncovered legs.
   */
  infoSpend: number[];
  legCovered: number[];
  legUncovered: number[];
}

/** Every stable is in the same season, so a pairing is a like-for-like comparison. */
interface HeadToHead {
  wins: number; // the first agent finished above the second
  total: number;
}

const AGENT_ORDER: AiAgent[] = ['careless', 'easy', 'normal', 'hard'];

/** Per-race-type counters, kept as one object so a new type never needs a new field. */
type ByType<T> = Map<RaceTypeId, T>;
const byType = <T>(make: () => T): ByType<T> => new Map(RACE_TYPE_IDS.map((r) => [r, make()]));

/** Per-season sampling that only exists while declarations are locked (see the file header). */
interface SeasonSample {
  declFitness: Map<Id, number[]>;
  entries: Map<Id, number>;
  dogsSeen: Map<Id, Set<Id>>;
  fieldByWeek: ByType<number[][]>;
  /** §7a.4 cardCoverage: weekends a type was on the card, and weekends a stable could fill it. */
  coverOffered: ByType<number>;
  coverHad: ByType<number>;
  /** Player entries and races run, per type — §7a.2's replacement for the Gold field row. */
  entriesByType: ByType<number>;
  racesByType: ByType<number>;
  /** How many of the weekend's three races each stable actually declared into. */
  filled: Map<Id, number[]>;
  /** GDD §7.1: the posted purse pool against what actually reached a player's pocket. */
  poolPosted: number;
  poolToPlayers: number;
  /** D2's "a maiden win costs you the next Maiden": entries per Maiden run, by week. */
  maidenEntries: number[];
  maidenRuns: number[];
  /** Gross income by road, tallied from the cash each action moves (see grossFrom). */
  grossFood: Map<Id, number>;
  grossDogs: Map<Id, number>;
  /**
   * §7a.2 asks for **a row per good and tier** in the income split, and this is it: crates and
   * Bones moved, per good, in each direction. Kept gross for the same reason the road split is —
   * "sold minus bought" cannot answer "where did the money come in".
   */
  goodsBought: Map<GoodId, { crates: number; bones: number }>;
  goodsSold: Map<GoodId, { crates: number; bones: number }>;
  /**
   * §7a.4 `leadConversion` (GDD §20 Q3) — the Prime-amplification test.
   *
   * One row per stable-season: its net-worth **rank at week 6** and **at week 13**, and whether it
   * took a Prime thing (feed or staff) at any point. If a Prime offer creates a bigger gap for the
   * stable that was already ahead than for the one behind, D11's consumable/wage guards are not
   * strong enough and §11's ugly rubber band is the next lever.
   *
   * ⚠️ **Read off the action stream, not off `PlayerSeasonStats`.** §7a.4 specifies a two-field
   * addition to the engine's stats, and it is not needed: the harness applies every action itself,
   * so "this stable bought a Prime thing" is already in front of it. Doing it here keeps GameState
   * unchanged and the golden snapshot at its two moves — the same argument that kept the dossier out
   * of state in Phase B.
   */
  primeTaken: Set<Id>;
  /**
   * Prime things a stable could have bought this season — the acceptance row is 2–5 **offers seen**,
   * not offers taken, because §8.1's guard is about the tier being *rare* rather than about anybody
   * managing to afford it. Counted once per stable-week: a Prime shelf on this planet, or a Prime
   * body drinking in the Saloon.
   */
  primeOffers: Map<Id, number>;
  /**
   * Crates aboard at the end of every week, per stable.
   *
   * ⚠️ Measured across the season rather than at week 13, and the difference matters: a trader sells
   * its hold down before the Grand Final, so an end-of-season snapshot read 6.6 crates for a stable
   * that had been carrying 21. Reading the wrong one nearly bought a wrong conclusion about whether
   * the hold was the binding constraint.
   */
  cratesByWeek: Map<Id, number[]>;
  /** §13: bribes and nobblings placed, per stable. */
  fixes: Map<Id, number>;
  /** Bones staked, per stable — the denominator the crook's road is a percentage of. */
  staked: Map<Id, number>;
  /**
   * §7a.4's information economy, per stable.
   *
   * `infoSpend` is dossiers plus a Tipster's wage for the weeks it was employed. The legs are the
   * crude but honest per-jump P&L: what a stable **sold** in week w against what it **bought** in
   * week w−1, split by whether it could see past the free horizon when it made that buy. Crude
   * because a hold does not turn over neatly every week; honest because it is the same measure on
   * both sides of the split, so what it reports is the *difference* information makes rather than
   * the level of anything.
   */
  infoSpend: Map<Id, number>;
  boughtByWeek: Map<Id, number[]>;
  soldByWeek: Map<Id, number[]>;
  informedAtWeek: Map<Id, boolean[]>;
}

export function emptySample(): SeasonSample {
  return {
    declFitness: new Map(),
    entries: new Map(),
    dogsSeen: new Map(),
    fieldByWeek: byType(() => Array.from({ length: balance.weeks }, () => [] as number[])),
    coverOffered: byType(() => 0),
    coverHad: byType(() => 0),
    entriesByType: byType(() => 0),
    racesByType: byType(() => 0),
    filled: new Map(),
    poolPosted: 0,
    poolToPlayers: 0,
    maidenEntries: Array.from({ length: balance.weeks }, () => 0),
    maidenRuns: Array.from({ length: balance.weeks }, () => 0),
    grossFood: new Map(),
    grossDogs: new Map(),
    goodsBought: new Map(),
    goodsSold: new Map(),
    primeTaken: new Set(),
    primeOffers: new Map(),
    cratesByWeek: new Map(),
    fixes: new Map(),
    staked: new Map(),
    infoSpend: new Map(),
    boughtByWeek: new Map(),
    soldByWeek: new Map(),
    informedAtWeek: new Map(),
  };
}

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
 * Is this dog one the stable could actually put in this race? The eligibility predicate plus the
 * fitness floor below which the injury roll doubles (GDD §5.2) — a dog it *could* enter but never
 * would is not coverage, and cardCoverage is meant to answer "was there a decision here".
 */
function couldEnter(d: Dog, race: RaceTypeId): boolean {
  return eligible(d, race) && d.fitness >= balance.injuryLowFitnessBelow;
}

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
  const card = thisWeeksCard(s);
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
  for (const race of thisWeeksCard(s)) entries.set(race, s.declarations[race][p.id] ?? null);
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
function soldThisPhase(actions: readonly Action[], playerId: Id): Set<Id> {
  const out = new Set<Id>();
  for (const a of actions) if (a.t === 'SellDog' && a.playerId === playerId) out.add(a.dogId);
  return out;
}

/**
 * Play a season out, optionally forcing one stable onto the autoplan in one week, and return
 * every stable's end worth. The forced week keeps the agent's own shopping and swaps only the
 * plan, so the two rollouts differ in exactly the thing being priced and nothing else.
 */
function playOut(s: GameState, force: { playerId: Id; week: number } | null): Map<Id, number> {
  let guard = 0;
  while (!isSeasonOver(s) && guard++ < 200_000) {
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
        ...autoplanFor(s, p, soldThisPhase(actions, who)),
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
        const auto = planFrom(s, p, autoplanFor(s, p, soldThisPhase(actions, who)));
        const own = planFrom(s, p, actions);
        weeks++;
        if (auto.entries === own.entries) entriesAgree++;
        if (auto.states === own.states) statesAgree++;
        if (auto.entries === own.entries && auto.states === own.states) agree++;

        if (who === rollFor && s.week % sampleEvery === 1 && auto.entries !== own.entries) {
          const withAuto = playOut(structuredClone(s), { playerId: who, week: s.week });
          const withOwn = playOut(structuredClone(s), null);
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
    '⚠️ **apLoss is structurally noisy and no feasible sample size fixes it.** §7a.3 asks for two',
    'rollouts "on the same downstream seed", but GameState carries a single rng stream: the moment',
    'the forced plan consumes a different number of draws, the rest of the season is a different',
    'random season. So each sample is one decision plus thirteen weeks of variance — an sd of tens',
    'of thousands against an effect worth at most a week\u2019s purse. autoplan% above is exact and',
    'means what it says; apLoss should be read as an error bar around zero until the engine can',
    'fork a per-decision stream.',
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
  while (!isSeasonOver(s) && guard++ < 200_000) {
    // Own the stable's dogs before anything sells them on.
    for (const p of s.players) {
      let seen = sample.dogsSeen.get(p.id);
      if (!seen) sample.dogsSeen.set(p.id, (seen = new Set()));
      for (const id of p.dogIds) seen.add(id);
    }
    // The one instant the card is known and nothing has run: fitness here is pre-race.
    if (s.fields && !s.races && sampledWeek !== s.week) {
      sampledWeek = s.week;
      const card = thisWeeksCard(s);
      for (const race of card) {
        bumpMap(sample.racesByType, race);
        if (race === 'maiden') sample.maidenRuns[s.week - 1]!++;
      }
      // §7a.4 cardCoverage and the fill rate, per stable: could you have filled this race, and
      // did you? Read off the stable's own kennel rather than off the field, because a race a
      // stable left to the locals is exactly what these two measures are for.
      // Prime offers in front of this stable this week: the shared shelf, its own consignment, and
      // the Saloon. Counted at the one instant the week is fully rolled and nothing has been bought.
      const primeOnShelf = GOODS.filter(
        (g) => g.tier === 'prime' && s.planet.goods[g.id].stock > 0,
      ).length;
      const primeStaff = s.planet.staff.filter((o) => o.tier === 'prime').length;
      for (const p of s.players) {
        if (p.flags.bankrupt) continue;
        const mine = GOODS.filter(
          (g) => g.tier === 'prime' && (s.planet.finds[p.id]?.goods[g.id] ?? 0) > 0,
        ).length;
        bumpMap(sample.primeOffers, p.id, primeOnShelf + primeStaff + mine);
        const kennel = p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
        let filled = 0;
        for (const race of card) {
          bumpMap(sample.coverOffered, race);
          if (kennel.some((d) => couldEnter(d, race))) bumpMap(sample.coverHad, race);
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
          if (race === 'maiden') sample.maidenEntries[s.week - 1]!++;
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
      }
      // §7a.4: a Tipster's wage is information spending, and the weeks it covers are the weeks a
      // stable bought stock knowing more than the free horizon gives it. Sampled at endTurn, once
      // a week, after the planet phases in which both the hire and the buying happen.
      for (const p of s.players) {
        const tip = bestStaff(p, 'tipster');
        if (tip) bumpMap(sample.infoSpend, p.id, tip.wage);
        const seen = sample.informedAtWeek.get(p.id) ?? Array(balance.weeks).fill(false);
        seen[s.week - 1] = infoReach(p).band > FREE_HORIZON;
        sample.informedAtWeek.set(p.id, seen);
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
      // What is on offer has to be read *before* the action lands, or a hire has already left the
      // planet's list by the time we look at it.
      const offer =
        a.t === 'HireStaff' ? s.planet.staff.find((o) => o.id === a.staffId) : undefined;
      reduceMut(s, a);
      const gained = p.cash - before;
      if (gained > 0) {
        if (a.t === 'TradeFood') bumpMap(sample.grossFood, who, gained);
        else if (a.t === 'SellDog') bumpMap(sample.grossDogs, who, gained);
      }
      // §13 and §7a.4, read off the action stream for the same reason `leadConversion` is (D36):
      // the harness applies every action itself, so nothing has to be added to GameState to say
      // what a stable did.
      if (a.t === 'Sabotage' || a.t === 'BribeSteward') bumpMap(sample.fixes, who, 1);
      if (a.t === 'PlaceBet') bumpMap(sample.staked, who, a.stake);
      if (a.t === 'BuyUpgrade' && a.upgrade === 'dossier') bumpMap(sample.infoSpend, who, -gained);
      if (a.t === 'TradeFood') {
        const w = s.week - 1;
        const buys = sample.boughtByWeek.get(who) ?? Array(balance.weeks).fill(0);
        const sells = sample.soldByWeek.get(who) ?? Array(balance.weeks).fill(0);
        if (a.units > 0) buys[w] = (buys[w] ?? 0) + Math.abs(gained);
        else sells[w] = (sells[w] ?? 0) + Math.abs(gained);
        sample.boughtByWeek.set(who, buys);
        sample.soldByWeek.set(who, sells);
      }
      // §7a.2's row per good, both ways, gross.
      if (a.t === 'TradeFood') {
        const crates = Math.abs(Math.trunc(a.units));
        const bones = Math.abs(gained);
        if (a.units > 0) bumpGood(sample.goodsBought, a.good, crates, bones);
        else bumpGood(sample.goodsSold, a.good, crates, bones);
        // §7a.4: a Prime crate taken is a Prime offer converted (GDD §20 Q3).
        if (a.units > 0 && good(a.good).tier === 'prime') sample.primeTaken.add(who);
      }
      if (offer?.tier === 'prime') sample.primeTaken.add(who);
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
        bankrupt: 0,
        dogsBought: [],
        declFitness: [],
        declBelowThreshold: 0,
        entries: [],
        dogsOwned: [],
        dogsAtEnd: [],
        filled: [],
        concentration: [],
        grossPrize: [],
        grossFood: [],
        grossDogs: [],
        grossBets: [],
        crates: [],
        hold: [],
        fixes: [],
        caught: 0,
        worthCaught: [],
        worthClean: [],
        worthCleanFixer: [],
        fixSpend: [],
        betsStruck: [],
        infoSpend: [],
        legCovered: [],
        legUncovered: [],
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
  let supplementsUsed = 0;
  let supplementsCaught = 0;
  let actions = 0;
  let championWonAMajor = 0;
  const coverOffered = byType(() => 0);
  const coverHad = byType(() => 0);
  const entriesByType = byType(() => 0);
  const racesByType = byType(() => 0);
  const maidenEntries = Array.from({ length: balance.weeks }, () => 0);
  const maidenRuns = Array.from({ length: balance.weeks }, () => 0);
  let poolPosted = 0;
  let poolToPlayers = 0;
  const championConcentration: number[] = [];
  const decidedBy: number[] = [];
  // §7a.2's row per good, across every season.
  const goodsBought = new Map<GoodId, { crates: number; bones: number }>();
  const goodsSold = new Map<GoodId, { crates: number; bones: number }>();
  /** §7a.4 leadConversion: rank change week 6 → 13, split by ahead/behind and by Prime taken. */
  /** §6b's "Prime offers seen per season", per stable. */
  const primeOffersSeen: number[] = [];
  const lead = {
    aheadPrime: [] as number[],
    aheadNone: [] as number[],
    behindPrime: [] as number[],
    behindNone: [] as number[],
  };
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
      const prime = sample.primeTaken.has(p.id);
      const ahead = before <= half;
      if (ahead) (prime ? lead.aheadPrime : lead.aheadNone).push(delta);
      else (prime ? lead.behindPrime : lead.behindNone).push(delta);
      const bet = (sample.staked.get(p.id) ?? 0) > 0;
      if (ahead) (bet ? leadBet.aheadBet : leadBet.aheadNone).push(delta);
      else (bet ? leadBet.behindBet : leadBet.behindNone).push(delta);
    }
    for (const [id, v] of sample.goodsBought) bumpGood(goodsBought, id, v.crates, v.bones);
    for (const [id, v] of sample.goodsSold) bumpGood(goodsSold, id, v.crates, v.bones);
    for (const p of s.players) primeOffersSeen.push(sample.primeOffers.get(p.id) ?? 0);
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
      st.fixSpend.push(split.fixes);
      st.costs.push(split.costs);
      st.dogsBought.push(p.stats.dogsBought);
      if (p.flags.bankrupt) st.bankrupt++;
      supplementsUsed += p.stats.supplementsUsed;
      supplementsCaught += p.stats.supplementsCaught;
      const fits = sample.declFitness.get(p.id) ?? [];
      for (const f of fits) {
        st.declFitness.push(f);
        if (f < balance.fitnessScaleBelow) st.declBelowThreshold++;
      }
      st.entries.push(sample.entries.get(p.id) ?? 0);
      st.dogsOwned.push(sample.dogsSeen.get(p.id)?.size ?? 0);
      st.dogsAtEnd.push(p.dogIds.length);
      for (const f of sample.filled.get(p.id) ?? []) st.filled.push(f);
      const h = herfindahl(s, p);
      if (h !== null) st.concentration.push(h);
      // Gross, by road. Bet returns come off the settled slips rather than `betIncome`, which is
      // returns minus stakes and so answers a different question.
      const betReturns = s.bets
        .filter((b) => b.playerId === p.id)
        .reduce((sum, b) => sum + (b.settled?.payout ?? 0), 0);
      st.grossPrize.push(p.stats.prizeIncome);
      st.grossFood.push(sample.grossFood.get(p.id) ?? 0);
      st.grossDogs.push(sample.grossDogs.get(p.id) ?? 0);
      st.grossBets.push(betReturns);
      st.crates.push(mean(sample.cratesByWeek.get(p.id) ?? [0]));
      st.hold.push(cargoCap(p));
      // §13: how much fixing this stable did, and whether the stewards ever got it.
      st.fixes.push(sample.fixes.get(p.id) ?? 0);
      st.betsStruck.push(sample.staked.get(p.id) ?? 0);
      const worth = netWorth(s, p);
      const fixed = (sample.fixes.get(p.id) ?? 0) > 0;
      if (p.flags.fixerBarred) {
        st.caught++;
        st.worthCaught.push(worth);
      } else {
        st.worthClean.push(worth);
        if (fixed) st.worthCleanFixer.push(worth);
      }
      // §7a.4 infoROI: this stable's per-leg trade P&L, split by whether it was informed when it
      // bought. Week w's sales against week w−1's purchases — see the note on SeasonSample.
      st.infoSpend.push(sample.infoSpend.get(p.id) ?? 0);
      const buys = sample.boughtByWeek.get(p.id) ?? [];
      const sells = sample.soldByWeek.get(p.id) ?? [];
      const seen = sample.informedAtWeek.get(p.id) ?? [];
      for (let w = 1; w < balance.weeks; w++) {
        const profit = (sells[w] ?? 0) - (buys[w - 1] ?? 0);
        if ((buys[w - 1] ?? 0) <= 0) continue;
        if (seen[w - 1]) st.legCovered.push(profit);
        else st.legUncovered.push(profit);
      }
    }
    for (const race of RACE_TYPE_IDS) {
      bumpMap(coverOffered, race, sample.coverOffered.get(race) ?? 0);
      bumpMap(coverHad, race, sample.coverHad.get(race) ?? 0);
      bumpMap(entriesByType, race, sample.entriesByType.get(race) ?? 0);
      bumpMap(racesByType, race, sample.racesByType.get(race) ?? 0);
    }
    for (let w = 0; w < balance.weeks; w++) {
      maidenEntries[w]! += sample.maidenEntries[w]!;
      maidenRuns[w]! += sample.maidenRuns[w]!;
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
      if (s.calendar[r.week - 1]?.major && r.race === OPEN_TYPE_ID) {
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
  lines.push('  agent      n     mean      p10      p50      p90   winRate   bankruptRate');
  for (const [d, st] of byAgent) {
    const sorted = [...st.worth].sort((a, b) => a - b);
    lines.push(
      `  ${d.padEnd(8)} ${String(st.seasons).padStart(4)} ${fmt(mean(st.worth)).padStart(8)} ${fmt(quantile(sorted, 0.1)).padStart(8)} ${fmt(quantile(sorted, 0.5)).padStart(8)} ${fmt(quantile(sorted, 0.9)).padStart(8)}   ${pct(st.wins / Math.max(1, st.seasons)).padStart(6)}   ${pct(st.bankrupt / Math.max(1, st.seasons)).padStart(7)} (${st.bankrupt})`,
    );
  }
  lines.push('  bankruptRate targets (GDD §7.5 / D6): careless 5–10%, every difficulty ≤ 2%');
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
  lines.push(
    'Income split per stable-season (mean): prize / trade / betting / costs / dogs bought',
  );
  for (const [d, st] of byAgent) {
    lines.push(
      `  ${d.padEnd(8)} ${fmt(mean(st.prize)).padStart(8)} ${fmt(mean(st.trade)).padStart(8)} ${fmt(mean(st.bet)).padStart(8)} ${fmt(mean(st.costs)).padStart(8)}   ${mean(st.dogsBought).toFixed(1)}`,
    );
  }

  // §7a.4: the kennel measures. Race/Train/Rest is judged on these three and nothing else.
  lines.push('');
  lines.push(
    `The kennel — fitness at declaration, races per dog, dogs owned (targets: fitness 60–80, under ${balance.fitnessScaleBelow} 10–25%, races/dog 7–9, dogs at wk ${balance.weeks} ≥ 4.5)`,
  );
  lines.push('  agent     meanFit   <thresh   races/dog   dogs@wk13   distinct dogs owned');
  for (const [d, st] of byAgent) {
    const declared = st.declFitness.length;
    const racesPerDog = mean(st.entries) / Math.max(0.001, mean(st.dogsOwned));
    lines.push(
      `  ${d.padEnd(8)} ${mean(st.declFitness).toFixed(1).padStart(7)} ${pct(st.declBelowThreshold / Math.max(1, declared)).padStart(9)} ${racesPerDog.toFixed(1).padStart(11)} ${mean(st.dogsAtEnd).toFixed(2).padStart(11)} ${mean(st.dogsOwned).toFixed(2).padStart(21)}`,
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

  // §7a.4 cardCoverage, and the two numbers that say whether the card is a decision or a lottery.
  const totalRaces = RACE_TYPE_IDS.reduce((sum, r) => sum + (racesByType.get(r) ?? 0), 0);
  const totalEntries = RACE_TYPE_IDS.reduce((sum, r) => sum + (entriesByType.get(r) ?? 0), 0);
  lines.push('');
  lines.push('The card (GDD §6.3) — how often each type runs, and whether a stable can fill it');
  lines.push('  type            share of races   share of entries   cardCoverage   entries/race');
  for (const race of RACE_TYPE_IDS) {
    const runs = racesByType.get(race) ?? 0;
    const ent = entriesByType.get(race) ?? 0;
    const offered = coverOffered.get(race) ?? 0;
    const cover = offered ? (coverHad.get(race) ?? 0) / offered : 0;
    lines.push(
      `  ${raceType(race).label.padEnd(14)} ${pct(runs / Math.max(1, totalRaces)).padStart(13)} ` +
        `${pct(ent / Math.max(1, totalEntries)).padStart(18)} ${pct(cover).padStart(14)} ` +
        `${(ent / Math.max(1, runs)).toFixed(2).padStart(14)}`,
    );
  }
  lines.push(
    '  cardCoverage: share of the weekends it ran where a stable had a fit, eligible dog.',
  );
  lines.push('  Target (BUILD_PLAN §6b): every type ≥ 8% of all races run.');

  lines.push('');
  lines.push('Filling the card — how many of the weekend’s three races a stable declares into');
  for (const [d, st] of byAgent) {
    const n = Math.max(1, st.filled.length);
    const share = (k: number) => pct(st.filled.filter((x) => x === k).length / n);
    lines.push(
      `  ${d.padEnd(8)} all three ${share(3).padStart(6)} · two ${share(2).padStart(6)} · one ${share(1).padStart(6)} · none ${share(0).padStart(6)}   (mean ${mean(st.filled).toFixed(2)})`,
    );
  }

  // GDD §7.1 / D15. The pool is what the card posts; the share is what a player actually banks.
  lines.push('');
  lines.push(
    `Purse pool: ${fmt(poolPosted / Math.max(1, args.seasons))} posted a season, ` +
      `${pct(poolToPlayers / Math.max(1, poolPosted))} of it reaching a player ` +
      `(v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)`,
  );

  lines.push('');
  lines.push('Gross income by road per stable-season, and prize as a share of it (GDD §7.1)');
  lines.push('  agent       prize     food sold   dogs sold   bets returned   prize share');
  for (const [d, st] of byAgent) {
    const prize = mean(st.grossPrize);
    const total = prize + mean(st.grossFood) + mean(st.grossDogs) + mean(st.grossBets);
    lines.push(
      `  ${d.padEnd(8)} ${fmt(prize).padStart(9)} ${fmt(mean(st.grossFood)).padStart(11)} ` +
        `${fmt(mean(st.grossDogs)).padStart(11)} ${fmt(mean(st.grossBets)).padStart(15)} ` +
        `${pct(prize / Math.max(1, total)).padStart(13)}`,
    );
  }
  lines.push('  Target (BUILD_PLAN §6b): prize share falls toward 65%. Gross, not net — the');
  lines.push('  question is where the money came in, not whether the road turned a profit.');

  // §7a.2's row per good and tier. The whole point of Phase C is that "food sold: 700" becomes
  // something else, and one line cannot say which of thirteen things it became.
  const seasonsRun = Math.max(1, args.seasons * args.ai.length);
  const traded = GOODS.filter(
    (g) => (goodsBought.get(g.id)?.crates ?? 0) + (goodsSold.get(g.id)?.crates ?? 0) > 0,
  );
  if (traded.length) {
    lines.push('');
    lines.push(
      'The goods, per stable-season (GDD §8.2 / BUILD_PLAN §7a.2 — a row per good and tier)',
    );
    lines.push('  good                 tier      crates in    Bones out   crates out    Bones in');
    for (const g of traded) {
      const b = goodsBought.get(g.id) ?? { crates: 0, bones: 0 };
      const sold = goodsSold.get(g.id) ?? { crates: 0, bones: 0 };
      lines.push(
        `  ${g.label.padEnd(20)} ${(g.tier ? TIER_LABEL[g.tier] : 'staple').padEnd(8)} ` +
          `${(b.crates / seasonsRun).toFixed(1).padStart(10)} ${fmt(b.bones / seasonsRun).padStart(12)} ` +
          `${(sold.crates / seasonsRun).toFixed(1).padStart(12)} ${fmt(sold.bones / seasonsRun).padStart(11)}`,
      );
    }
    const primeCrates = traded
      .filter((g) => g.tier === 'prime')
      .reduce((sum, g) => sum + (goodsBought.get(g.id)?.crates ?? 0), 0);
    lines.push(`  Prime crates bought per stable-season: ${(primeCrates / seasonsRun).toFixed(2)}`);
  }

  lines.push('');
  lines.push(
    `Prime offers seen per stable-season: ${mean(primeOffersSeen).toFixed(2)} ` +
      `(target 2–5 — a rare tier is the point, GDD §8.1)`,
  );

  // §7a.4 leadConversion (GDD §20 Q3): does the Prime tier amplify whoever is already ahead?
  lines.push('');
  lines.push('leadConversion — does a Prime offer widen the lead? (§7a.4, GDD §20 Q3)');
  lines.push('  Places gained between week 6 and week 13. Positive = climbed.');
  lines.push('  group          took Prime          took none        the gap Prime makes');
  const row = (label: string, withP: number[], without: number[]): void => {
    const a = mean(withP);
    const b = mean(without);
    lines.push(
      `  ${label.padEnd(14)} ${a.toFixed(2).padStart(6)} (n ${String(withP.length).padStart(5)})  ` +
        `${b.toFixed(2).padStart(6)} (n ${String(without.length).padStart(5)})  ` +
        `${(a - b >= 0 ? '+' : '') + (a - b).toFixed(2)}`,
    );
  };
  row('ahead at wk 6', lead.aheadPrime, lead.aheadNone);
  row('behind at wk 6', lead.behindPrime, lead.behindNone);
  const leaderGain = mean(lead.aheadPrime) - mean(lead.aheadNone);
  const trailerGain = mean(lead.behindPrime) - mean(lead.behindNone);
  lines.push(
    `  Target: the leader's gain from Prime is no larger than the trailer's. ` +
      `Leader ${leaderGain >= 0 ? '+' : ''}${leaderGain.toFixed(2)}, trailer ${trailerGain >= 0 ? '+' : ''}${trailerGain.toFixed(2)} — ` +
      `${leaderGain <= trailerGain ? 'MET' : 'MISSED'}.`,
  );
  lines.push(
    '  ⚠️ A leader is already at the top of the table, so it has fewer places to gain than a',
  );
  lines.push(
    '  trailer has: read the two columns against each other within a row, not across rows.',
  );

  // §20 Q7: the same shape again, on the channel the flat stake ceiling exists to close.
  lines.push('');
  lines.push('leadConversion, split on whether the stable bet (GDD §10, §20 Q7)');
  lines.push('  group              bet          did not bet     the gap betting makes');
  row('ahead at wk 6', leadBet.aheadBet, leadBet.aheadNone);
  row('behind at wk 6', leadBet.behindBet, leadBet.behindNone);
  const leaderBet = mean(leadBet.aheadBet) - mean(leadBet.aheadNone);
  const trailerBet = mean(leadBet.behindBet) - mean(leadBet.behindNone);
  lines.push(
    `  Flat ceiling ${fmt(balance.maxStakeFlat)} (×${balance.maxStakeFlatFinalMult} at the Collar) against the ` +
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

  // D2's own claim, measured: winning a Maiden costs you the next one.
  const third = (from: number, to: number) => {
    let e = 0;
    let r = 0;
    for (let w = from; w <= to; w++) {
      e += maidenEntries[w - 1]!;
      r += maidenRuns[w - 1]!;
    }
    return r ? (e / r).toFixed(2) : 'n/a';
  };
  lines.push(
    `Maiden entries per Maiden run: weeks 1–4 ${third(1, 4)}, 5–9 ${third(5, 9)}, 10–13 ${third(10, balance.weeks)} — ` +
      `it should fall, because winning one is what bars you from the next`,
  );
  lines.push(
    `Supplements: ${supplementsUsed} used, ${supplementsCaught} caught (${supplementsUsed ? pct(supplementsCaught / supplementsUsed) : 'n/a'})`,
  );
  lines.push(
    `Seasons where the champion won at least one Major Open: ${pct(championWonAMajor / Math.max(1, args.seasons))}`,
  );

  // §7a.4's information economy (GDD §9.2). What a stable spent looking past the fog, and what the
  // legs that information covered returned against the ones it did not.
  const infoRows = [...byAgent.entries()].filter(([, st]) => mean(st.infoSpend) > 0);
  if (infoRows.length) {
    lines.push('');
    lines.push('The information economy (§7a.4) — infoSpend and infoROI');
    lines.push('  agent     spent    covered legs   uncovered legs   the difference   infoROI');
    for (const [d, st] of infoRows) {
      const cov = mean(st.legCovered);
      const unc = mean(st.legUncovered);
      const spend = mean(st.infoSpend);
      const legs = st.legCovered.length / Math.max(1, args.seasons * args.ai.length);
      lines.push(
        `  ${d.padEnd(8)} ${fmt(spend).padStart(7)} ${fmt(cov).padStart(9)} (n ${String(st.legCovered.length).padStart(5)}) ` +
          `${fmt(unc).padStart(9)} (n ${String(st.legUncovered.length).padStart(5)}) ` +
          `${((cov - unc >= 0 ? '+' : '') + fmt(cov - unc)).padStart(14)}   ` +
          `${spend > 0 ? ((cov - unc) * legs) / spend : 0}`.slice(0, 60),
      );
    }
    lines.push(
      '  A leg is week w’s sales against week w−1’s purchases, split by whether the stable',
    );
    lines.push(
      '  could see past the free horizon when it bought. Crude — a hold does not turn over',
    );
    lines.push(
      '  neatly every week — but the same measure on both sides, so what it reports is the',
    );
    lines.push('  *difference* information makes rather than the level of anything (GDD §9.2).');
  }

  // §7a.5's printout, now four roads wide plus the mixed agent. The deliverable is this table,
  // not the agents — and the caveat below it is part of the deliverable.
  const roadAgents = (['trainer', 'trader', 'crook', 'mixed'] as AiAgent[]).filter((a) =>
    byAgent.has(a),
  );
  if (roadAgents.length) {
    lines.push('');
    lines.push('The roads, side by side (BUILD_PLAN §7a.5, GDD §20 Q2)');
    lines.push(
      '  agent       mean      p10      p90   p90/p10     prize    trade   bet   fixed  jobs  caught  winRate',
    );
    for (const a of roadAgents) {
      const st = byAgent.get(a)!;
      const sorted = [...st.worth].sort((x, y) => x - y);
      const p10 = quantile(sorted, 0.1);
      const p90 = quantile(sorted, 0.9);
      lines.push(
        `  ${a.padEnd(8)} ${fmt(mean(st.worth)).padStart(8)} ${fmt(p10).padStart(8)} ` +
          `${fmt(p90).padStart(8)} ${(p10 > 0 ? (p90 / p10).toFixed(1) : '—').padStart(9)} ` +
          `${fmt(mean(st.prize)).padStart(9)} ${fmt(mean(st.trade)).padStart(8)} ` +
          `${fmt(mean(st.bet)).padStart(6)} ${fmt(-mean(st.fixSpend)).padStart(6)} ` +
          `${mean(st.fixes).toFixed(1).padStart(5)} ` +
          `${pct(st.caught / Math.max(1, st.seasons)).padStart(7)} ` +
          `${pct(st.wins / Math.max(1, st.seasons)).padStart(8)}`,
      );
    }
    const singles = roadAgents.filter((a) => a !== 'mixed');
    const means = singles.map((a) => mean(byAgent.get(a)!.worth));
    const spread = (Math.max(...means) - Math.min(...means)) / Math.max(1, Math.min(...means));
    lines.push(
      `  Target (§7a.5): within 15% of each other on the mean, and visibly different in spread — ` +
        `the crook widest, the trainer narrowest.`,
    );
    lines.push(
      `  Measured ${pct(spread)} apart across ${singles.join(' / ')} — ${spread <= 0.15 ? 'MET' : 'MISSED'}.`,
    );
    const crook = byAgent.get('crook');
    if (crook) {
      const trainerMean = byAgent.has('trainer') ? mean(byAgent.get('trainer')!.worth) : 0;
      const caughtMean = mean(crook.worthCaught);
      const rate = crook.caught / Math.max(1, crook.seasons);
      lines.push('');
      lines.push('  The crook’s own rows (BUILD_PLAN §6b Phase D)');
      lines.push(
        `    caught at least once   ${pct(rate)} — target 40–70% — ${rate >= 0.4 && rate <= 0.7 ? 'MET' : 'MISSED'}`,
      );
      lines.push(
        `    a caught crook’s worth ${fmt(caughtMean)} against the trainer’s ${fmt(trainerMean)} — ` +
          `${caughtMean < trainerMean ? 'MET' : 'MISSED'}`,
      );
      lines.push(
        `      …against a crook that fixed and got away with it: ${fmt(mean(crook.worthCleanFixer))} ` +
          `(n ${crook.worthCleanFixer.length}); every clean crook, road or no road: ${fmt(mean(crook.worthClean))}`,
      );
      lines.push(
        '      ⚠️ The middle number is the honest comparison. A crook that never gets caught is',
      );
      lines.push(
        '      mostly one whose road never opened — no fixer, or never the cash to use one — so',
      );
      lines.push('      "clean" read naively means "poor and honest by accident".');
      lines.push(
        `    fixes placed a season  ${mean(crook.fixes).toFixed(1)}, staking ${fmt(mean(crook.betsStruck))} in total`,
      );
    }
    const mixedAgent = byAgent.get('mixed');
    if (mixedAgent && singles.length) {
      const bestSingle = Math.max(...means);
      const bestName = singles[means.indexOf(bestSingle)]!;
      const m = mean(mixedAgent.worth);
      lines.push(
        `    a mixed agent          ${fmt(m)} against the best single road (${bestName}) ${fmt(bestSingle)} — ` +
          `${m >= bestSingle * 0.95 ? 'MET' : 'MISSED'}`,
      );
      lines.push(
        '    ⚠️ §2.1 says the roads "are meant to be mixable" and nothing had ever measured it.',
      );
    }
    lines.push('');
    lines.push(
      '  ⚠️ Hand-written agents measure whether the roads *can* pay, not whether they are',
    );
    lines.push(
      '  balanced against a good player. Jesse beat three Hard and three Normal stables with a line',
    );
    lines.push('  no agent plays. This is a floor test, not a proof.');
  }
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
        trapStat: d.trap,
        fitness: d.fitness,
        form: d.form,
        traits: d.traits,
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
  const stats: (StatKey | null)[] = [null, 'speed', 'accel', 'stamina', 'trap'];
  const base = 50;
  const bump = 10;
  const lines: string[] = [
    `Stat leverage: +${bump} to one stat from a balanced rating-${base} dog vs seven ${base}s, ${n} races/cell`,
    `Targets (BUILD_PLAN §6b, standard 480): speed 21–25, stamina 18–22, accel 14–18, trap 12–16`,
    '  track        |    none    | +10 speed   +10 accel   +10 stam    +10 trap   (win% / place%)',
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
          trapStat: d.trap,
          fitness: 100,
          form: 0,
          traits: [],
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
    '  Accel should peak on the sprint and trap on the tight bends. Stamina reads the same at',
  );
  lines.push(
    '  every length by construction: fadeStart is a fraction of the distance, so the fade window',
  );
  lines.push(
    '  is proportionally identical at 350 m and 600 m. That needs a model change, not a number.',
  );
  return lines.join('\n');
}

/**
 * D2's structural claim, measured directly (GDD §6.3, BUILD_PLAN §6b Phase B).
 *
 * This is not a season — it is the eligibility arithmetic on its own, which is the honest way to
 * answer "does keeping a broad stable let you fill the card?". A season's fill rate mixes the
 * question with fitness, cash and whether the AI thought the race was worth entering; this asks
 * only whether the dogs *qualify*. The two acceptance rows are read off it.
 *
 * The stables are **rolled fresh for every draw** rather than hand-built once. A single
 * hand-picked stable answers the question you designed it to answer: pick one dog per criterion
 * and it fills the card every week, which says more about the picker than about the card. Rolling
 * age, wins, runs and rating from the archetype's own distribution gives the spread a real stable
 * has, and the answer is a distribution rather than a fact about one kennel.
 *
 *  - **broad**: dogs spread over the facts the card gates on, ages 1–6, wins and runs growing
 *    with age, ratings around the middle of the field.
 *  - **concentrated**: one very good, well-raced four-year-old plus cheap fillers — v1's optimal
 *    stable, and the one D2 exists to punish.
 */
export function runCardProbe(draws = 20000, seed = 20260912): string {
  const rng = mulberry32(seed);
  let counter = 0;
  const nextId = () => `d${counter++}`;
  const shape = (quality: number, age: number, wins: number, runs: number, oom = false): Dog => {
    const q = clamp(Math.round(rng.gauss(quality, 7)), 20, 92);
    const d = fitRating(createDog({ quality: q, age, owner: 'p1', traits: [] }, rng, nextId), q, q);
    d.wins = wins;
    d.runs = runs;
    d.outOfMoneyFor = oom ? balance.consolationReach : 0;
    return d;
  };
  /** A dog of no particular plan: any age, a career that fits its age, a middling rating. */
  const anyDog = (): Dog => {
    const age = rng.int(1, 6);
    const runs = age === 1 ? rng.int(0, 4) : rng.int(2, 6 * age);
    return shape(46, age, Math.min(runs, rng.int(0, age)), runs, rng.chance(0.35));
  };
  const goodDog = (): Dog => shape(70, 4, rng.int(4, 8), rng.int(14, 26));
  const filler = (): Dog => shape(34, 4, rng.int(1, 3), rng.int(8, 20), rng.chance(0.35));

  const stables: { label: string; roll: () => Dog[] }[] = [
    { label: 'broad, 5 dogs   ', roll: () => [anyDog(), anyDog(), anyDog(), anyDog(), anyDog()] },
    { label: 'broad, 3 dogs   ', roll: () => [anyDog(), anyDog(), anyDog()] },
    { label: 'one good + 2    ', roll: () => [goodDog(), filler(), filler()] },
    {
      label: 'one good + 4    ',
      roll: () => [goodDog(), filler(), filler(), filler(), filler()],
    },
    {
      label: 'four good dogs  ',
      roll: () => [goodDog(), goodDog(), goodDog(), goodDog()],
    },
  ];

  const pool = RACE_TYPES.filter((t) => t.drawn).map((t) => t.id);
  const lines: string[] = [
    `Race card coverage (GDD §6.3 / D2) — ${draws} rolled stables against ${draws} random cards`,
    'A card is The Open plus two types drawn from the pool of seven. "Fills" means the stable owns',
    'a distinct qualifying dog for every race, one dog per race — the same one-per-race rule the',
    'Race Office enforces. Fitness, cash and whether the race looked worth entering are all out of',
    'it: this is what the stable is *allowed* to do, and the season fill rate in the main printout',
    'is what it actually does.',
    '',
    'Targets (BUILD_PLAN §6b): a broad five-dog stable fills all three 55–70% of weeks; a stable',
    'built around one good dog fills all three no more than 20% of the time.',
    '',
    '  stable             all three      two or more        just one           none',
  ];

  for (const { label, roll } of stables) {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < draws; i++) {
      const card = [...rng.shuffle([...pool]).slice(0, DRAWN_PER_WEEKEND), OPEN_TYPE_ID];
      counts[maxFilled(roll(), card)]!++;
    }
    const share = (k: number) => pct(counts[k]! / draws);
    const atLeast = (k: number) => pct(counts.slice(k).reduce((a, b) => a + b, 0) / draws);
    lines.push(
      `  ${label} ${share(3).padStart(12)} ${atLeast(2).padStart(16)} ${share(1).padStart(17)} ${share(0).padStart(14)}`,
    );
  }
  return lines.join('\n');
}

/**
 * The most races this stable could fill, one dog per race. Three races and at most six dogs, so
 * the exhaustive search is free and a greedy one would under-count — a dog that fits two races
 * has to go in the one nothing else can fill.
 */
function maxFilled(dogs: readonly Dog[], card: readonly RaceTypeId[]): number {
  let best = 0;
  const walk = (i: number, used: Set<string>, filled: number) => {
    if (i === card.length) {
      if (filled > best) best = filled;
      return;
    }
    walk(i + 1, used, filled);
    for (const d of dogs) {
      if (used.has(d.id) || !raceType(card[i]!).eligible(d)) continue;
      used.add(d.id);
      walk(i + 1, used, filled + 1);
      used.delete(d.id);
    }
  };
  walk(0, new Set(), 0);
  return best;
}

/**
 * The D14 pup curve (GDD §5.6). BUILD_PLAN §11 names this phase's narrowest band and says the
 * acceptance criterion is the *week a pup reaches par*, not a stat number, and that the whole
 * curve gets reported rather than a pass or a fail — so it is an instrument, not a script that
 * was run once. Phase C changes both inputs (real feeds, a trainer ladder) and will want it again.
 *
 * A pup at age 1 with all stats ≈ 37, trained for N of the 13 weeks, against the Open locals.
 * Averaged over many pups because the points land on random stats and one pup is noise.
 */
export function runPupCurve(pups = 200, racesPerCell = 900, seed = 4242): string {
  const track: Track = { distance: 480, length: 'standard', bends: 'medium', hazard: 1 };
  const field = balance.localRatingOpen;
  // Weekly around the target band, because the acceptance row is a *week* and 4/8/10/13 cannot
  // tell 8 from 9.
  const checkpoints = [4, 6, 8, 9, 10, 11, 13];
  const lines: string[] = [
    `Pup curve — age-1 pup (all stats ≈ 37, rating 37) against seven rating-${field} locals at fitness ${balance.localFitness}.`,
    `Par is 12.5%. Plain kibble +${balance.trainKibbleMin}–${balance.trainKibbleMax} a Train week, growth +${balance.growthAge1}/week at age 1 and +${balance.growthAge2} at age 2.`,
    `Target (BUILD_PLAN §6b): a pup bought in week 1 and trained throughout reaches par between weeks 9 and 11.`,
    '',
    `trainer          train  pts/train-wk  pts/wk  |  win% at weeks ${checkpoints.join(' · ')}  | par`,
  ];

  const raise = (trainWeeks: number, trainerPoints: number) => {
    const rng = mulberry32(seed);
    let counter = 0;
    const nextId = (p: string) => `${p}${counter++}`;
    const at = new Map<number, { speed: number; accel: number; stamina: number; trap: number }>();
    for (const w of checkpoints) at.set(w, { speed: 0, accel: 0, stamina: 0, trap: 0 });
    let gain = 0;
    for (let n = 0; n < pups; n++) {
      const pup = fitRating(
        createDog({ quality: 37, age: 1, owner: 'p1', traits: [] }, rng, nextId),
        37,
        37,
      );
      const start = pup.speed + pup.accel + pup.stamina + pup.trap;
      for (let week = 1; week <= balance.weeks; week++) {
        if (week <= trainWeeks) {
          if (trainerPoints > 0)
            pup[pup.trainStat] = clamp(pup[pup.trainStat] + trainerPoints, 1, 99);
          const kibble = rng.int(balance.trainKibbleMin, balance.trainKibbleMax);
          const stat = rng.pick(STAT_KEYS);
          pup[stat] = clamp(pup[stat] + kibble, 1, 99);
        }
        const g = pup.age <= 1 ? balance.growthAge1 : pup.age === 2 ? balance.growthAge2 : 0;
        for (let i = 0; i < g; i++) {
          const stat = rng.pick(STAT_KEYS);
          pup[stat] = clamp(pup[stat] + 1, 1, 99);
        }
        if (week === balance.ageTickWeek) pup.age = Math.min(7, pup.age + 1);
        const slot = at.get(week);
        if (slot) {
          slot.speed += pup.speed;
          slot.accel += pup.accel;
          slot.stamina += pup.stamina;
          slot.trap += pup.trap;
        }
      }
      gain += pup.speed + pup.accel + pup.stamina + pup.trap - start;
    }
    for (const slot of at.values()) {
      slot.speed /= pups;
      slot.accel /= pups;
      slot.stamina /= pups;
      slot.trap /= pups;
    }
    return { at, gain: gain / pups };
  };

  const winRate = (
    line: { speed: number; accel: number; stamina: number; trap: number },
    s2: number,
  ) => {
    const rng = mulberry32(s2);
    let counter = 0;
    const nextId = (p: string) => `${p}${counter++}`;
    let wins = 0;
    for (let i = 0; i < racesPerCell; i++) {
      const runners: Runner[] = [
        {
          id: 'hero',
          trap: 1,
          speed: Math.round(line.speed),
          accel: Math.round(line.accel),
          stamina: Math.round(line.stamina),
          trapStat: Math.round(line.trap),
          fitness: 90,
          form: 0,
          traits: [],
        },
      ];
      for (let k = 0; k < 7; k++) {
        const r = fitRating(
          createDog({ quality: field, age: 3, owner: 'local', traits: [] }, rng, nextId),
          field,
          field,
        );
        runners.push({
          id: `r${k}`,
          trap: k + 2,
          speed: r.speed,
          accel: r.accel,
          stamina: r.stamina,
          trapStat: r.trap,
          fitness: balance.localFitness,
          form: 0,
          traits: [],
        });
      }
      const draw = rng.shuffle(runners).map((x, idx) => ({ ...x, trap: idx + 1 }));
      const res = simulateRace(draw, { track, major: false }, mulberry32(rng.int(0, 2 ** 31)));
      if (res.order[0] === 'hero') wins++;
    }
    return wins / racesPerCell;
  };

  // The staff ladder as it is now built (GDD §8.3). Each row is the trainer's points a Train
  // week; the feed a dog eats is on top of it and is what `--stats` and the season runs measure.
  const trainers: [string, number][] = [
    ['none           ', 0],
    [`Rough      +${balance.trainerPointsRough}  `, balance.trainerPointsRough],
    [`Gristle    +${balance.trainerPointsRough + 1}  `, balance.trainerPointsRough + 1],
    [`Proper     +${balance.trainerPointsProper}  `, balance.trainerPointsProper],
    [`Prime      +${balance.trainerPointsPrime}  `, balance.trainerPointsPrime],
  ];
  for (const [label, points] of trainers) {
    for (const trainWeeks of [13, 10, 8, 6]) {
      const { at, gain } = raise(trainWeeks, points);
      const cells: string[] = [];
      let par = 0;
      for (const w of checkpoints) {
        const line = at.get(w)!;
        const rating = baseRating({
          speed: Math.round(line.speed),
          accel: Math.round(line.accel),
          stamina: Math.round(line.stamina),
          trap: Math.round(line.trap),
        });
        // One rival seed for every checkpoint, so the curve reads as a curve: a fresh field per
        // week adds ±3 points of noise and makes week 9 look worse than week 8.
        const win = winRate(line, 1000);
        void rating;
        cells.push(`${(win * 100).toFixed(1).padStart(4)}`);
        if (!par && win > 0.125) par = w;
      }
      lines.push(
        `${label}  ${String(trainWeeks).padStart(2)}/13  ` +
          `${(gain / trainWeeks).toFixed(1).padStart(11)}  ` +
          `${(gain / balance.weeks).toFixed(1).padStart(6)}  |  ${cells.join('  ')}  | ${par ? 'wk ' + par : 'never'}`,
      );
    }
    lines.push('');
  }
  lines.push(
    'All four tiers are built (Phase C). The rows are the trainer alone on plain kibble — a dog on a',
  );
  lines.push(
    'stat feed gains its band on top, +1-3 Rough to +4-6 Prime, so the Prime row understates a',
  );
  lines.push('stable that is also feeding properly. That pairing is what the season runs measure.');
  return lines.join('\n');
}

/**
 * GDD §20 Q6 / BUILD_PLAN §6b: **does a +20-unit cargo upgrade pay back inside one season?**
 *
 * An ablation rather than an estimate. The same trader agent, the same seeds, once buying hold and
 * once refusing to — so the only difference between the two runs is the purchase, and the difference
 * in end worth is what the purchase was worth. v1's estimate was "about 1,000 a season against 2,500
 * spent"; this is the measurement that replaces it.
 */
/**
 * §13's road, priced (GDD §13, §10, §20 Q7). `npm run harness -- --fix`
 *
 * ⚠️ **This is the measurement the whole phase turns on, and it did not exist before Phase D.**
 * §13 carries one number — "+23% EV [measured]" — taken on a hand-built Gold-class field before
 * the §6.2 rebalance, before the card, before the goods. What a nobbling is worth *in the fields
 * this game actually produces* is a different question, and the deterrent cannot be sized against
 * a number nobody has re-taken.
 *
 * The probe plays real seasons, stops at the instant declarations lock, and for every race on
 * every card asks: take `sabotageFitness` off whoever the book has shortest, and what is the best
 * price left on the board now worth? The bookie's model is applied to the **unmoved** ratings,
 * because that is precisely what the bookie does.
 *
 * Two rows, and the difference between them is the finding:
 *
 * - **own runner only** — §13 as written, "backing your own dog at its unmoved odds".
 * - **best price in the race** — §10 as written, which has allowed a bet on any dog since v1.
 *
 * Then the break-even stake at the current fee, fine and catch rate, which is what actually
 * decides whether the road exists.
 */
/**
 * What `sabotageFitness` is worth in rating points to the bookie's model — the conversion any
 * agent, screen or probe has to make, because the engine takes *fitness* off a runner and the book
 * speaks only *rating*. Kept beside `runFixProbe` and mirrored by `SABOTAGE_RATING_EQUIV` in
 * `ai/paths.ts`, which is the one place it is acted on.
 */
const SABOTAGE_RATING_POINTS = 10;

export function runFixProbe(seasons = 120, seed = 1): string {
  const lines: string[] = [
    'The crook’s road, priced (GDD §13 / §20 Q7) — every locked field of every card',
    `${seasons} seasons of six Normal stables; the nobbling is ${balance.sabotageFitness} fitness off`,
    'whoever the book has shortest, and the book is left quoting its unmoved prices.',
    '',
  ];
  // What `sabotageFitness` is worth in rating points, by the same route the AI uses: fitness
  // multiplies every stat, so the cut in top speed is (fitScale(f−n) / fitScale(f)) − 1, and §5.1's
  // leverage table prices top speed against rating. Measured here rather than asserted, so the
  // number moves if D13's curve ever does.
  const fitAt = (f: number) => balance.fitScaleBase + (balance.fitScaleCoef * f) / 100;
  const speedCut = 1 - fitAt(75 - balance.sabotageFitness) / fitAt(75);
  lines.push(
    `  ${balance.sabotageFitness} fitness off a dog at 75 is a ${(speedCut * 100).toFixed(2)}% cut in top speed.`,
  );

  const ownEdges: number[] = [];
  const bestEdges: number[] = [];
  const bestEdgesMajor: number[] = [];
  let races = 0;
  let racesWithOwn = 0;
  for (let i = 0; i < seasons; i++) {
    const sample = emptySample();
    const s = createSeason({
      seed: seed + i,
      players: Array(6)
        .fill('normal')
        .map((d) => ({ name: '', kind: 'ai' as const, difficulty: d as AiAgent })),
    });
    let guard = 0;
    let seenWeek = 0;
    while (!isSeasonOver(s) && guard++ < 200_000) {
      if (s.fields && !s.races && seenWeek !== s.week) {
        seenWeek = s.week;
        const major = s.calendar[s.week - 1]?.major ?? false;
        for (const { entries } of s.fields) {
          races++;
          let favIdx = -1;
          entries.forEach((e, k) => {
            if (favIdx < 0 || e.winProb > entries[favIdx]!.winProb) favIdx = k;
          });
          if (favIdx < 0) continue;
          // The favourite's rating, cut by what the fitness loss is worth. Solved from the odds
          // model rather than assumed: find the rating at which the sim's win rate matches.
          const after = entries.map((e, k) =>
            k === favIdx ? Math.max(5, e.rating - SABOTAGE_RATING_POINTS) : e.rating,
          );
          const trueP = winProbabilities(after);
          let best = 0;
          let own = 0;
          entries.forEach((e, k) => {
            if (k === favIdx || trueP[k]! < 0.04) return;
            const edge = trueP[k]! * e.odds - 1;
            if (edge > best) best = edge;
            if (!e.local && edge > own) own = edge;
          });
          if (own > 0) racesWithOwn++;
          ownEdges.push(own);
          bestEdges.push(best);
          if (major) bestEdgesMajor.push(best);
        }
      }
      if (needsAdvance(s)) {
        reduceMut(s, { t: 'AdvancePhase' });
        continue;
      }
      const who = s.pendingEvent?.playerId ?? s.activePlayer!;
      for (const a of decide(s, who, player(s, who).difficulty)) reduceMut(s, a);
      void sample;
    }
  }
  const sortedBest = [...bestEdges].sort((a, b) => a - b);
  const sortedOwn = [...ownEdges].sort((a, b) => a - b);
  lines.push('');
  lines.push(`  ${races} races sampled. Edge is expected return per Bone staked, minus the Bone.`);
  lines.push('  what you back                mean edge    p50     p90   share worth backing');
  const row = (label: string, xs: number[], sorted: number[]) =>
    lines.push(
      `  ${label.padEnd(28)} ${pct(mean(xs)).padStart(8)} ${pct(quantile(sorted, 0.5)).padStart(7)} ` +
        `${pct(quantile(sorted, 0.9)).padStart(7)}   ${pct(xs.filter((x) => x > 0).length / Math.max(1, xs.length)).padStart(6)}`,
    );
  row('a stable-owned runner (§13)', ownEdges, sortedOwn);
  row('the best price left (§10)', bestEdges, sortedBest);
  if (bestEdgesMajor.length)
    row(
      '  …of those, at a Major',
      bestEdgesMajor,
      [...bestEdgesMajor].sort((a, b) => a - b),
    );
  lines.push(
    `  A stable-owned runner is in the race at all in ${pct(racesWithOwn / Math.max(1, races))} of them.`,
  );

  // What it costs, and therefore what it takes to be worth doing. ⚠️ Three rows now rather than
  // one: the Fixer is hired by the job, so the fee *and* the catch chance both depend on the grade
  // of man drinking on the planet you happen to be on (E-D45), and the break-even stake is the
  // number that shows what the three grades are actually offering each other.
  lines.push('');
  lines.push('What one nobbling costs, by the grade of man taking it, and the stake it clears at');
  lines.push('  grade     fee   caught   fixed cost   % of the stake   break-even at a 27% edge');
  for (const tier of TIER_ORDER) {
    const fee = jobCost('sabotage', tier);
    const qt = balance.fixCatchBase * FIXER_CATCH_MULT[tier];
    const fixedT = fee + qt * balance.fixFineBase;
    const perBoneT = qt * balance.fixFineStakeMult;
    const netT = 0.27 - perBoneT;
    lines.push(
      `  ${TIER_LABEL[tier].padEnd(8)} ${fmt(fee).padStart(5)} ${pct(qt).padStart(7)} ` +
        `${fmt(fixedT).padStart(12)} ${(perBoneT * 100).toFixed(1).padStart(14)}%   ` +
        `${(netT > 0 ? fmt(Math.ceil(fixedT / netT)) : 'never').padStart(12)}`,
    );
  }
  lines.push('');
  const q = balance.fixCatchBase;
  const fixed = jobCost('sabotage', 'proper') + q * balance.fixFineBase;
  const perBone = q * balance.fixFineStakeMult;
  lines.push('  The sweep below is the Proper man, who is the middle of that ladder.');
  lines.push(
    '  edge   net of the fine   break-even stake   at the flat ceiling of ' +
      fmt(balance.maxStakeFlat),
  );
  for (const edge of [0.2, 0.3, 0.4, 0.5, 0.7]) {
    const net = edge - perBone;
    const breakEven = net > 0 ? fixed / net : Infinity;
    const atCeiling = net * balance.maxStakeFlat - fixed;
    lines.push(
      `  ${pct(edge).padStart(5)}  ${pct(net).padStart(14)}   ${(net > 0 ? fmt(breakEven) : 'never').padStart(16)}   ${(atCeiling >= 0 ? '+' : '') + fmt(atCeiling)}`,
    );
  }
  lines.push('');
  lines.push('  ⚠️ The fine’s stake multiple must stay below (edge ÷ catch chance) or no stake is');
  lines.push('  ever worth fixing — that is the whole constraint on the deterrent, and it is why');
  lines.push(
    '  §8.4’s purse forfeit is the wrong shape: it scales with the race, not with the bet.',
  );
  return lines.join('\n');
}

/**
 * ⚠️ **Which of Hard's own decisions is costing it (GDD §14, BUILD_PLAN §6b).**
 *
 * "Hard beats Normal" has now missed its 63–68% band for six phases: 60.6 (v1) → 56.8 (A) → 53.9
 * (B) → 58.6 (C) → 57.7 (D) → 58.0 (E baseline). Phase D built and rejected both of its own
 * candidates, and the pattern across the whole record is that the only thing that has ever moved
 * the number is **removing a bad decision** — D30's "hire less" recovered 4.7 points; both of
 * Phase D's additions lost.
 *
 * So this switches off, one at a time, decisions Hard already makes and Normal does not, and asks
 * whether Normal's simpler answer was better all along. Same seeds, same table, every row.
 */
export function runHardAblation(seasons = 600, seed = 1): string {
  const lines: string[] = [];
  const before = { ...HARD_KNOBS };
  const ai: AiAgent[] = ['normal', 'normal', 'normal', 'hard', 'hard', 'hard'];
  const HARDS = new Set(['p4', 'p5', 'p6']);
  const run = (): { rate: number; hard: number; normal: number; p10: number } => {
    let wins = 0;
    let pairs = 0;
    const hard: number[] = [];
    const normal: number[] = [];
    for (let i = 0; i < seasons; i++) {
      const { state } = playSeason(seed + i, ai, emptySample());
      const h: number[] = [];
      const n: number[] = [];
      for (const p of state.players) (HARDS.has(p.id) ? h : n).push(netWorth(state, p));
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
    `Hard's own decisions, ablated — ${seasons} seasons, three Hard against three Normal, the same seeds every row`,
  );
  lines.push('');
  lines.push('  row                              beats Normal   Hard mean   p10     Normal mean');
  const rows: [string, Partial<typeof HARD_KNOBS>][] = [
    ['as built (Phase D: one ruler each)', { sameRuler: false }],
    ['  rates its dogs like Normal', { ratesByStats: false, sameRuler: false }],
    ['  one ruler: stats on both sides', { sameRuler: true }],
    ['  does not hold for a Major', { sameRuler: false, holdsForMajor: false }],
    ['  never throws the cheap race', { sameRuler: false, throwsCheapRace: false }],
    ['  does not sell before the tick', { sameRuler: false, sellsAgeingDogs: false }],
    ['  works §13 per job', { sameRuler: false, worksTheFix: true }],
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

/**
 * ⚠️ **Which constraint actually binds the mixed agent (GDD D43, §2.1).**
 *
 * D43 measured §2.1's promise — "a stable that trains a pup, pays for it by trading, and backs it
 * at 9/1 when it is ready… should be about as rich as one that commits" — and found the mixed
 * agent 28% behind the trainer. It then named three suspects: three roads competing for three
 * **staff slots**, one kennel's **cash**, and one week's **attention**. Nothing distinguished
 * between them, and a design argument with three plausible causes and no table is an argument
 * about who is most confident.
 *
 * So each is relaxed on its own, over the same seasons and the same seeds, against the Phase D
 * agent as the floor and the trainer as the bar:
 *
 * - **slots** — one more staff slot for everybody in the run, so the roads stop bidding for three.
 * - **cash** — the stable starts with twice the money, so nothing is bound by the bankroll.
 * - **attention** — every road played at the intensity the *single-road* agent plays it: the
 *   trainer's feed and pups, the trader's hold and spread. This is the suspect §2.1 actually
 *   describes, and the one that would make D43 a harness bug rather than a design fault.
 *
 * ⚠️ `balance.staffSlots` is mutated for the slot row and put back. It is a script, the run is
 * deterministic while it is set, and the alternative — threading a slot count through `keepStaff`
 * and the reducer's own refusal — would be a rule change to answer a measurement question.
 */
export function runMixability(seasons = 400, seed = 1): string {
  const lines: string[] = [];
  const before = { ...MIX_KNOBS };
  const phaseD = {
    want: ['trainer', 'trader'] as StaffRole[],
    holdCap: 0,
    feedCrates: 3,
    feedSpend: 0.6,
    goodsSpend: 0.6,
    buyCashMultiple: 2,
    minRatingGain: 0,
    borrowBelowReserves: 3,
  };
  const run = (agent: AiAgent, slots: number, cash: number): number[] => {
    const startCash = balance.startCash;
    const staffSlots = balance.staffSlots;
    balance.staffSlots = slots;
    balance.startCash = cash;
    const worth: number[] = [];
    const ai: AiAgent[] = Array(6).fill(agent);
    for (let i = 0; i < seasons; i++) {
      const sample = emptySample();
      const { state } = playSeason(seed + i, ai, sample);
      for (const p of state.players) worth.push(netWorth(state, p));
    }
    balance.staffSlots = staffSlots;
    balance.startCash = startCash;
    return worth;
  };
  const slots = balance.staffSlots;
  const cash = balance.startCash;

  const rows: { label: string; worth: number[] }[] = [];
  const withKnobs = (k: Partial<typeof MIX_KNOBS>, fn: () => number[]): number[] => {
    Object.assign(MIX_KNOBS, before, k);
    const out = fn();
    Object.assign(MIX_KNOBS, before);
    return out;
  };

  rows.push({
    label: 'mixed, as Phase D built it',
    worth: withKnobs(phaseD, () => run('mixed', slots, cash)),
  });
  rows.push({
    label: '  + a fourth staff slot',
    worth: withKnobs(phaseD, () => run('mixed', slots + 1, cash)),
  });
  rows.push({
    label: '  + twice the starting cash',
    worth: withKnobs(phaseD, () => run('mixed', slots, cash * 2)),
  });
  rows.push({
    label: '  + every road at full intensity',
    worth: withKnobs({}, () => run('mixed', slots, cash)),
  });
  rows.push({ label: 'trainer (the bar)', worth: run('trainer', slots, cash) });
  // ⚠️ The control that makes the cash row mean anything. Doubling the bankroll lifts *any* agent,
  // so "cash binds the mixed stable" is only a finding if it lifts the mixed stable by more than it
  // lifts one that commits. Without this row the probe measures compound interest.
  rows.push({
    label: '  trainer + twice the cash',
    worth: run('trainer', slots, cash * 2),
  });
  rows.push({ label: 'trader', worth: run('trader', slots, cash) });
  rows.push({ label: 'crook', worth: run('crook', slots, cash) });
  Object.assign(MIX_KNOBS, before);

  lines.push(
    `Mixability — ${seasons} seasons of six of each, the same seeds every row (GDD D43, §2.1)`,
  );
  lines.push('');
  lines.push('  row                                mean      p10      p90   against the trainer');
  const bar = mean(rows.find((r) => r.label.startsWith('trainer'))!.worth);
  for (const r of rows) {
    const sorted = [...r.worth].sort((a, b) => a - b);
    const m = mean(r.worth);
    lines.push(
      `  ${r.label.padEnd(32)} ${fmt(m).padStart(8)} ${fmt(quantile(sorted, 0.1)).padStart(8)} ` +
        `${fmt(quantile(sorted, 0.9)).padStart(8)}   ${((m / bar - 1) * 100).toFixed(1).padStart(6)}%`,
    );
  }
  lines.push('');
  lines.push(
    '  ⚠️ Read the three middle rows against the first, not against each other: each relaxes ONE',
  );
  lines.push(
    '  of D43’s three suspects and leaves the other two alone, which is what makes them a diagnosis',
  );
  lines.push('  rather than four different agents.');
  lines.push(
    '  ⚠️ And read the cash row against the trainer’s own cash row: more money lifts everybody, so',
  );
  lines.push('  what the suspect has to explain is the *difference* between the two lifts.');
  return lines.join('\n');
}

/**
 * ⚠️ **The ablation the crook's road lives or dies by (GDD D42, E-D45).**
 *
 * The same agent, the same seeds, once with §13 and once with it switched off — because "is the
 * road worth walking" is a *difference*, not a comparison against a different agent playing a
 * different game. Phase D ran this by hand and it produced the phase's headline finding; it is a
 * harness mode now so the next session can re-run it in one command instead of rebuilding the
 * scaffolding and hoping it matches.
 *
 * With `crookMayFix` off the crook is exactly a cheap racing stable, which is the right control:
 * before Phase E that switched off a wage *and* the jobs together, and now there is no wage, so
 * it switches off only the jobs — which is a cleaner ablation than the one that produced D42.
 */
export function runCrookAblation(seasons = 250, seed = 1): string {
  const lines: string[] = [];
  const ai: AiAgent[] = Array(6).fill('crook');
  const run = (
    mayFix: boolean,
  ): { worth: number[]; bet: number; fixSpend: number; jobs: number; caught: number } => {
    PATH_KNOBS.crookMayFix = mayFix;
    const worth: number[] = [];
    let bet = 0;
    let fixSpend = 0;
    let jobs = 0;
    let caught = 0;
    let n = 0;
    for (let i = 0; i < seasons; i++) {
      const sample = emptySample();
      const { state } = playSeason(seed + i, ai, sample);
      for (const p of state.players) {
        const split = roadSplit(state, p);
        worth.push(netWorth(state, p));
        bet += split.betting;
        fixSpend += split.fixes;
        jobs += sample.fixes.get(p.id) ?? 0;
        if (p.flags.fixerBarred) caught++;
        n++;
      }
    }
    return {
      worth,
      bet: bet / Math.max(1, n),
      fixSpend: fixSpend / Math.max(1, n),
      jobs: jobs / Math.max(1, n),
      caught: caught / Math.max(1, n),
    };
  };

  lines.push(
    `The crook’s road, ablated — ${seasons} seasons of six crooks, the same seeds both rows`,
  );
  lines.push('');
  lines.push('  §13          mean      p10      p90    betting   fixing   jobs   caught');
  const rows: { label: string; r: ReturnType<typeof run> }[] = [
    { label: 'worked', r: run(true) },
    { label: 'ablated', r: run(false) },
  ];
  PATH_KNOBS.crookMayFix = true;
  for (const { label, r } of rows) {
    const sorted = [...r.worth].sort((a, b) => a - b);
    lines.push(
      `  ${label.padEnd(10)} ${fmt(mean(r.worth)).padStart(8)} ${fmt(quantile(sorted, 0.1)).padStart(8)} ` +
        `${fmt(quantile(sorted, 0.9)).padStart(8)} ${fmt(r.bet).padStart(10)} ` +
        `${fmt(-r.fixSpend).padStart(8)} ${r.jobs.toFixed(1).padStart(6)} ${pct(r.caught).padStart(8)}`,
    );
  }
  const worked = mean(rows[0]!.r.worth);
  const ablated = mean(rows[1]!.r.worth);
  const diff = worked - ablated;
  lines.push('');
  lines.push(
    `  Walking the road is worth ${diff >= 0 ? '+' : ''}${fmt(diff)} of end worth — ` +
      `${diff > 0 ? 'MET' : 'MISSED'} against BUILD_PLAN §6b’s row (better with §13 than without).`,
  );
  lines.push(
    '  ⚠️ This is the only comparison that holds everything else equal, and it is what BUILD_PLAN’s',
  );
  lines.push(
    '  "a caught crook’s worth, below the trainer’s" row was reaching for and could not express:',
  );
  lines.push(
    '  a crook that never gets caught is mostly one whose road never opened, so splitting on the',
  );
  lines.push('  catch measures selection rather than crime (D42).');
  return lines.join('\n');
}

export function runHoldPayback(seasons = 400, seed = 1): string {
  const lines: string[] = [];
  const ai: AiAgent[] = Array(6).fill('trader');
  const run = (cap: number): { worth: number; hold: number; trade: number; bought: number } => {
    PATH_KNOBS.traderHoldCap = cap;
    const worth: number[] = [];
    const holds: number[] = [];
    const trade: number[] = [];
    const bought: number[] = [];
    for (let i = 0; i < seasons; i++) {
      const sample = emptySample();
      const { state } = playSeason(seed + i, ai, sample);
      for (const p of state.players) {
        worth.push(netWorth(state, p));
        holds.push(cargoCap(p));
        trade.push(p.stats.tradeIncome);
        bought.push((p.ship.cargoCap - balance.cargoCapStart) / balance.cargoUpgradeUnits);
      }
    }
    return { worth: mean(worth), hold: mean(holds), trade: mean(trade), bought: mean(bought) };
  };

  lines.push(
    `Cargo-hold payback — ${seasons} seasons of six traders per row, the same seeds every row`,
  );
  lines.push('');
  lines.push(
    `  A +${balance.cargoUpgradeUnits}-crate hold costs ${fmt(balance.shipCargoCost)} and drags ` +
      `${balance.cargoUpgradeUnits * balance.fuelPerCargoUnitOver} more fuel a jump.`,
  );
  lines.push('');
  lines.push('  upgrades allowed   bought   hold   mean end worth   trade income   marginal gain');
  const caps = [0, 1, 2, 3, Infinity];
  let previous: { worth: number; bought: number } | null = null;
  const marginals: number[] = [];
  for (const cap of caps) {
    const r = run(cap);
    let marginal = '';
    if (previous) {
      const extra = r.bought - previous.bought;
      const gain = extra > 0 ? (r.worth - previous.worth) / extra : 0;
      marginal = `${fmt(gain)} per upgrade`;
      if (Number.isFinite(cap)) marginals.push(gain);
    }
    lines.push(
      `  ${(Number.isFinite(cap) ? String(cap) : 'no cap').padEnd(18)} ${r.bought.toFixed(2).padStart(6)} ` +
        `${r.hold.toFixed(0).padStart(6)} ${fmt(r.worth).padStart(16)} ${fmt(r.trade).padStart(14)}   ${marginal}`,
    );
    previous = { worth: r.worth, bought: r.bought };
  }
  PATH_KNOBS.traderHoldCap = Infinity;
  lines.push('');
  const first = marginals[0] ?? 0;
  lines.push(
    `  The row that answers §6b is the FIRST upgrade: ${fmt(first)} against ${fmt(balance.shipCargoCost)} paid — ` +
      `${first >= balance.shipCargoCost ? 'MET' : 'MISSED'}.`,
  );
  lines.push(
    '  ⚠️ Net worth already counts the ship at 70% of what was paid for it (shipResaleFactor), so an',
  );
  lines.push(
    `  upgrade that earned nothing would read about −${fmt(balance.shipCargoCost * (1 - balance.shipResaleFactor))}, not 0. That is the floor.`,
  );
  lines.push(
    '  ⚠️ And the marginal column is the real finding: capacity has sharply diminishing returns',
  );
  lines.push(
    '  because this road is bound by the cash to buy stock, not by the room to put it in.',
  );
  return lines.join('\n');
}

/**
 * GDD §8.3 / D7: **does stacking three of one role beat a mixed three?**
 *
 * A real head-to-head — three stables forced to stack one role against three playing Normal's mixed
 * line, in the same seasons, on the same card. The target is that stacking wins no more than 5
 * points of head-to-head, and if it wins more than that the roles are not differently shaped enough
 * and §8.3 says to re-shape them rather than to add a penalty.
 */
export function runStacking(seasons = 300, seed = 1): string {
  const lines: string[] = [];
  lines.push(`Staff stacking — ${seasons} seasons, three stackers against three mixed (D7)`);
  lines.push('');
  lines.push('  stacked role    stacker mean   mixed mean   stacker beats mixed');
  const roles: StaffRole[] = ['trainer', 'vet', 'trader', 'scout', 'tipster'];
  for (const role of roles) {
    let stackWorth = 0;
    let mixedWorth = 0;
    let wins = 0;
    let pairs = 0;
    for (let i = 0; i < seasons; i++) {
      STACK_OVERRIDE.clear();
      // p1..p3 stack, p4..p6 play Normal's line. Same season, same card, same market.
      for (const id of ['p1', 'p2', 'p3']) STACK_OVERRIDE.set(id, role);
      const sample = emptySample();
      const { state } = playSeason(seed + i, Array(6).fill('normal') as AiAgent[], sample);
      const worth = new Map(state.players.map((p) => [p.id, netWorth(state, p)]));
      const stacked = ['p1', 'p2', 'p3'].map((id) => worth.get(id) ?? 0);
      const mixed = ['p4', 'p5', 'p6'].map((id) => worth.get(id) ?? 0);
      stackWorth += mean(stacked);
      mixedWorth += mean(mixed);
      for (const a of stacked)
        for (const b of mixed) {
          pairs++;
          if (a > b) wins++;
        }
    }
    STACK_OVERRIDE.clear();
    const rate = wins / Math.max(1, pairs);
    lines.push(
      `  ${role.padEnd(15)} ${fmt(stackWorth / seasons).padStart(12)} ${fmt(mixedWorth / seasons).padStart(12)}   ` +
        `${pct(rate)}`,
    );
  }
  lines.push('');
  lines.push(
    '  Target (D7): no more than 5 points of head-to-head over a mixed three, i.e. 45–55%.',
  );
  lines.push(
    '  A stacker pays three wages for one effect, because `bestStaff` means the best hire in',
  );
  lines.push(
    '  a role is the one that acts. That is the price being the gate rather than a penalty,',
  );
  lines.push('  and it is why GDD §21 keeps a stacking penalty out unless this table demands one.');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.calibrate) console.log(runCalibration());
  else if (args.stats) console.log(runStatLeverage());
  else if (args.pups) console.log(runPupCurve());
  else if (args.card) console.log(runCardProbe());
  else if (args.autoplan) console.log(runAutoplan(args.seasons));
  else if (args.holdPayback) console.log(runHoldPayback(args.seasons, args.seed));
  else if (args.stacking) console.log(runStacking(args.seasons, args.seed));
  else if (args.crookAblation)
    console.log(runCrookAblation(args.seasons === 50 ? 250 : args.seasons, args.seed));
  else if (args.mixability)
    console.log(runMixability(args.seasons === 50 ? 400 : args.seasons, args.seed));
  else if (args.hardAblation)
    console.log(runHardAblation(args.seasons === 50 ? 600 : args.seasons, args.seed));
  else if (args.fix) console.log(runFixProbe(args.seasons === 50 ? 120 : args.seasons, args.seed));
  else console.log(runHarness(args));
}

// The entry point, at the end of the file and not in the middle of it: `main()` runs at module
// load, so anything declared below the call sits in its temporal dead zone. Functions are hoisted
// and survived that; the first `const` added after it did not.
if (process.argv[1]?.endsWith('harness.ts')) main();
