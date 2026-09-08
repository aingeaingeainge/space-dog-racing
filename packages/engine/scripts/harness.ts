/**
 * Balance harness (BUILD_PLAN §7). Runs N headless seasons and prints the stats the plan asks
 * for. Usage (from the repo root):
 *   npm run harness -- --seasons 200 [--ai normal,normal,normal,normal,normal,normal] [--seed 1]
 *   npm run harness -- --calibrate        # race-sim win rates vs rating gap + oddsScale fit
 */
import { balance } from '../src/content/balance';
import { createDog, fitRating } from '../src/economy/market';
import { netWorth } from '../src/economy/netWorth';
import { mulberry32 } from '../src/rng';
import { runSeason } from '../src/season';
import { simulateRace, type Runner } from '../src/race/simulateRace';
import { winProbabilities } from '../src/race/odds';
import type { Difficulty, GameState } from '../src/types';

interface Args {
  seasons: number;
  ai: Difficulty[];
  seed: number;
  calibrate: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    seasons: 50,
    ai: Array(6).fill('normal'),
    seed: 1,
    calibrate: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? '';
    if (a === '--seasons') args.seasons = Number(next());
    else if (a === '--ai')
      args.ai = next()
        .split(',')
        .map((x) => x.trim() as Difficulty);
    else if (a === '--seed') args.seed = Number(next());
    else if (a === '--calibrate') args.calibrate = true;
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

interface DiffStats {
  worth: number[];
  wins: number;
  seasons: number;
  prize: number[];
  trade: number[];
  bet: number[];
  costs: number[];
  bankrupt: number;
  dogsBought: number[];
}

/** Every stable is in the same season, so a pairing is a like-for-like comparison. */
interface HeadToHead {
  wins: number; // the first difficulty finished above the second
  total: number;
}

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

export function runHarness(args: Args): string {
  const lines: string[] = [];
  const byDiff = new Map<Difficulty, DiffStats>();
  const stat = (d: Difficulty): DiffStats => {
    let s = byDiff.get(d);
    if (!s) {
      s = {
        worth: [],
        wins: 0,
        seasons: 0,
        prize: [],
        trade: [],
        bet: [],
        costs: [],
        bankrupt: 0,
        dogsBought: [],
      };
      byDiff.set(d, s);
    }
    return s;
  };
  const goldFieldByWeek: number[][] = Array.from({ length: balance.weeks }, () => []);
  const h2h = new Map<string, HeadToHead>();
  const pairing = (a: Difficulty, b: Difficulty): HeadToHead => {
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
  let rankVarianceByMajors = 0;

  const t0 = performance.now();
  for (let i = 0; i < args.seasons; i++) {
    const { state, log } = runSeason({
      seed: args.seed + i,
      players: args.ai.map((difficulty) => ({ name: '', kind: 'ai' as const, difficulty })),
    });
    actions += log.length;
    collect(state);
  }
  const elapsed = (performance.now() - t0) / 1000;

  function collect(s: GameState) {
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
    }
    // Head to head: every pair of stables of different difficulties, inside the one season.
    for (const a of s.players) {
      for (const b of s.players) {
        const da = a.difficulty ?? 'normal';
        const db = b.difficulty ?? 'normal';
        if (DIFFICULTY_ORDER.indexOf(da) <= DIFFICULTY_ORDER.indexOf(db)) continue;
        const pa = place.get(a.id);
        const pb = place.get(b.id);
        if (pa === undefined || pb === undefined) continue;
        const rec = pairing(da, db);
        rec.total++;
        if (pa < pb) rec.wins++;
      }
    }
    for (const r of s.results) {
      if (r.cls === 'gold') goldFieldByWeek[r.week - 1]!.push(mean(r.entries.map((e) => e.rating)));
    }
    // How much of the final ranking is explained by Major wins (crude: rank correlation).
    const majorWins = new Map<string, number>();
    for (const r of s.results) {
      if (s.calendar[r.week - 1]?.major && r.cls === 'gold') {
        const w = r.payouts.find((x) => x.place === 1);
        if (w) majorWins.set(w.playerId, (majorWins.get(w.playerId) ?? 0) + 1);
      }
    }
    const top = standings[0]?.playerId;
    if (top && (majorWins.get(top) ?? 0) > 0) rankVarianceByMajors++;
  }

  lines.push(
    `Space Dog Racing harness — ${args.seasons} seasons, stables: ${args.ai.join(', ')}, seeds ${args.seed}…${args.seed + args.seasons - 1}`,
  );
  lines.push(
    `Elapsed ${elapsed.toFixed(1)} s (${((elapsed / args.seasons) * 1000).toFixed(0)} ms/season, ${fmt(actions / args.seasons)} actions/season)`,
  );
  lines.push('');
  lines.push('End net worth (Bones) and win rate by difficulty');
  lines.push('  diff     n     mean      p10      p50      p90   winRate  bankrupt');
  for (const [d, st] of byDiff) {
    const sorted = [...st.worth].sort((a, b) => a - b);
    lines.push(
      `  ${d.padEnd(6)} ${String(st.seasons).padStart(4)} ${fmt(mean(st.worth)).padStart(8)} ${fmt(quantile(sorted, 0.1)).padStart(8)} ${fmt(quantile(sorted, 0.5)).padStart(8)} ${fmt(quantile(sorted, 0.9)).padStart(8)}   ${pct(st.wins / Math.max(1, st.seasons)).padStart(6)}   ${st.bankrupt}`,
    );
  }
  if (h2h.size) {
    lines.push('');
    lines.push(
      'Head to head — share of same-season pairings the harder stable finished above (M4 targets: hard>normal ~65%, normal>easy ~80%)',
    );
    for (const [key, rec] of h2h) {
      const [a, b] = key.split('|');
      lines.push(
        `  ${`${a} beats ${b}`.padEnd(22)} ${pct(rec.wins / Math.max(1, rec.total)).padStart(6)}   (${rec.total} pairings)`,
      );
    }
  }
  lines.push('');
  lines.push(
    'Income split per stable-season (mean): prize / trade / betting / costs / dogs bought',
  );
  for (const [d, st] of byDiff) {
    lines.push(
      `  ${d.padEnd(6)} ${fmt(mean(st.prize)).padStart(8)} ${fmt(mean(st.trade)).padStart(8)} ${fmt(mean(st.bet)).padStart(8)} ${fmt(mean(st.costs)).padStart(8)}   ${mean(st.dogsBought).toFixed(1)}`,
    );
  }
  lines.push('');
  lines.push(
    'Average Gold field rating by week: ' +
      goldFieldByWeek.map((w) => mean(w).toFixed(0)).join(' '),
  );
  lines.push(
    `Supplements: ${supplementsUsed} used, ${supplementsCaught} caught (${supplementsUsed ? pct(supplementsCaught / supplementsUsed) : 'n/a'})`,
  );
  lines.push(
    `Seasons where the champion won at least one Major Gold: ${pct(rankVarianceByMajors / Math.max(1, args.seasons))}`,
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
  const track = { distance: 480, length: 'standard' as const, bends: 'medium' as const, hazard: 1 };
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

if (process.argv[1]?.endsWith('harness.ts')) main();
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.calibrate) console.log(runCalibration());
  else console.log(runHarness(args));
}
