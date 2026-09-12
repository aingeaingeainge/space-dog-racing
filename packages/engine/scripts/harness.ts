/**
 * Balance harness (BUILD_PLAN §7 and §7a). Runs N headless seasons and prints the stats the
 * plan asks for. Usage (from the repo root):
 *   npm run harness -- --seasons 200 [--ai normal,normal,normal,normal,normal,normal] [--seed 1]
 *   npm run harness -- --seasons 400 --ai careless,normal,normal,normal   # D6, bankruptRate
 *   npm run harness -- --calibrate        # race-sim win rates vs rating gap + oddsScale fit
 *   npm run harness -- --stats            # D12 regression: +10 to one stat, at three lengths
 *   npm run harness -- --pups             # D14: what a Train week is worth, and when a pup arrives
 *   npm run harness -- --card             # D2: can a broad stable fill the card, and a narrow one?
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
import { createDog, fitRating } from '../src/economy/market';
import { baseRating, dogValue } from '../src/economy/dogValue';
import { netWorth } from '../src/economy/netWorth';
import { clamp, mulberry32 } from '../src/rng';
import { createSeason, eligible, player, thisWeeksCard } from '../src/state';
import { decide } from '../src/ai';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { simulateRace, type Runner } from '../src/race/simulateRace';
import { winProbabilities } from '../src/race/odds';
import { DRAWN_PER_WEEKEND, OPEN_TYPE_ID, RACE_TYPES, raceType } from '../src/content/raceTypes';
import {
  RACE_TYPE_IDS,
  STAT_KEYS,
  type AiAgent,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
  type StatKey,
  type Track,
} from '../src/types';

interface Args {
  seasons: number;
  ai: AiAgent[];
  seed: number;
  calibrate: boolean;
  stats: boolean;
  pups: boolean;
  card: boolean;
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
}

function emptySample(): SeasonSample {
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
  };
}

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

/**
 * Play one season, sampling the locked card each week. Mirrors `drive()` — if that ever grows a
 * hook, this collapses back into it.
 */
function playSeason(
  seed: number,
  ai: AiAgent[],
  sample: SeasonSample,
): { state: GameState; actions: number } {
  const s = createSeason({
    seed,
    players: ai.map((difficulty) => ({ name: '', kind: 'ai' as const, difficulty })),
  });
  let actions = 0;
  let sampledWeek = 0;
  let paidWeek = 0;
  let guard = 0;
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
      for (const p of s.players) {
        if (p.flags.bankrupt) continue;
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
      reduceMut(s, a);
      const gained = p.cash - before;
      if (gained > 0) {
        if (a.t === 'TradeFood') bumpMap(sample.grossFood, who, gained);
        else if (a.t === 'SellDog') bumpMap(sample.grossDogs, who, gained);
      }
      actions++;
    }
  }
  return { state: s, actions };
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

  const t0 = performance.now();
  for (let i = 0; i < args.seasons; i++) {
    const sample = emptySample();
    const { state, actions: n } = playSeason(args.seed + i, args.ai, sample);
    actions += n;
    collect(state, sample);
  }
  const elapsed = (performance.now() - t0) / 1000;

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
      st.prize.push(p.stats.prizeIncome);
      st.trade.push(p.stats.tradeIncome);
      st.bet.push(p.stats.betIncome);
      st.costs.push(p.stats.costs);
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
    d.outOfMoneyLastWeek = oom;
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

  const trainers: [string, number][] = [
    ['none          ', 0],
    [`Rough      +${balance.trainerStatPerWeek} `, balance.trainerStatPerWeek],
    ['Gristle    +2 ', balance.trainerStatPerWeek + 1],
    ['Prime (C)  +4 ', 4],
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
    'Phase A has only the Rough trainer and plain kibble; the Prime row is what GDD §8.2 and §8.3',
  );
  lines.push('promise in Phase C, and is here so the two can be compared before it is built.');
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('harness.ts')) main();
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.calibrate) console.log(runCalibration());
  else if (args.stats) console.log(runStatLeverage());
  else if (args.pups) console.log(runPupCurve());
  else if (args.card) console.log(runCardProbe());
  else console.log(runHarness(args));
}
