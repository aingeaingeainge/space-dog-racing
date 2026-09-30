/**
 * `npm run harness -- --draft` — the draft (GDD_V3 V29–V33, v3 Phase N).
 *
 *   npm run harness -- --draft [--games 1000] [--seed 1] [--set key=value …]
 *
 * One-season games, all Normal, at **3, 6 and 8 stables**, `--games` each (1,000 by default), and for
 * each table size:
 *
 * - **Win rate and mean end worth by opening draft position** (round 1's order, 1 = first pick), and
 *   the largest gap from fair (1/n) in points — the target is every position within ±3;
 * - **start worth by draft position** and the spread from first to last, read at week 1's arrival,
 *   once the draft is over and before anything else has happened;
 * - the kennels the draft built: dogs' mean rating, and the share of stables with all three styles.
 *
 * Then, over every stable of every game, **each trainer bonus priced by D12's regression**: end worth
 * regressed on how many of each bonus a stable drafted, with its start worth as a control (a drafted
 * trainer is chosen, not dealt, so a stable that took a good trainer may have taken a weaker dog to
 * do it). A coefficient is Bones of end worth per bonus held, and the fair cut is today's cut plus
 * the coefficient as a share of a stable's purses. Commission as a share of purses closes it.
 */
import { overridesLine } from './balance-set';
import { STAFF_BONUSES, type StaffBonusId } from '../src/content/staff';
import { netWorth } from '../src/economy/netWorth';
import { staffBonus } from '../src/economy/staff';
import { decide } from '../src/ai';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { createSeason, player } from '../src/state';
import type { AiAgent } from '../src/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-NZ');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface StableObs {
  pos: number;
  start: number;
  end: number;
  won: boolean;
  bonuses: Record<StaffBonusId, number>;
  purses: number;
  commission: number;
  meanRating: number;
  allStyles: boolean;
}

function playOne(seed: number, n: number, agent: AiAgent): StableObs[] {
  const s = createSeason({
    seed,
    players: Array.from({ length: n }, () => ({
      name: '',
      kind: 'ai' as const,
      difficulty: agent,
    })),
  });
  const round1 = s.drafts[0]!.order.slice(0, n);
  let start: number[] | null = null;
  let bonuses: Record<StaffBonusId, number>[] = [];
  let guard = 0;
  while (!isSeasonOver(s) && guard++ < 200_000) {
    if (s.phase === 'arrival' && !start) {
      start = s.players.map((p) => netWorth(s, p));
      bonuses = s.players.map(
        (p) =>
          Object.fromEntries(STAFF_BONUSES.map((b) => [b.id, staffBonus(p, b.id)])) as Record<
            StaffBonusId,
            number
          >,
      );
    }
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    for (const a of decide(s, who, player(s, who).difficulty)) reduceMut(s, a);
  }
  const winner = s.finalStandings![0]!.playerId;
  const draft = s.drafts[0]!;
  return s.players.map((p, i) => {
    const mine = draft.picks.filter((x) => x.playerId === p.id && x.dog).map((x) => x.dog!);
    return {
      pos: round1.indexOf(p.id) + 1,
      start: start![i]!,
      end: s.finalStandings!.find((x) => x.playerId === p.id)!.netWorth,
      won: winner === p.id,
      bonuses: bonuses[i]!,
      purses: p.stats.prizeIncome + p.stats.commission,
      commission: p.stats.commission,
      meanRating: mean(mine.map((d) => d.rating)),
      allStyles: new Set(mine.map((d) => d.style)).size === 3,
    };
  });
}

/** Ordinary least squares by the normal equations, solved by Gaussian elimination: β and its SEs. */
function ols(X: number[][], y: number[]): { beta: number[]; se: number[] } {
  const k = X[0]!.length;
  const XtX = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty = new Array<number>(k).fill(0);
  for (let r = 0; r < X.length; r++) {
    const x = X[r]!;
    for (let i = 0; i < k; i++) {
      Xty[i]! += x[i]! * y[r]!;
      for (let j = 0; j < k; j++) XtX[i]![j]! += x[i]! * x[j]!;
    }
  }
  const inv = invert(XtX);
  const beta = inv.map((row) => row.reduce((a, v, j) => a + v * Xty[j]!, 0));
  let sse = 0;
  for (let r = 0; r < X.length; r++) {
    const fit = X[r]!.reduce((a, v, j) => a + v * beta[j]!, 0);
    sse += (y[r]! - fit) * (y[r]! - fit);
  }
  const sigma2 = sse / Math.max(1, X.length - k);
  return { beta, se: inv.map((row, i) => Math.sqrt(sigma2 * row[i]!)) };
}

function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const d = a[c]![c]!;
    for (let j = 0; j < 2 * n; j++) a[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r]![c]!;
      for (let j = 0; j < 2 * n; j++) a[r]![j]! -= f * a[c]![j]!;
    }
  }
  return a.map((row) => row.slice(n));
}

export function runDraft(games = 1000, seed = 1, agent: AiAgent = 'normal'): string {
  const out: string[] = [];
  const t0 = Date.now();
  out.push(
    `Space Dog Racing harness — the draft (GDD_V3 V29–V33): ${games} one-season games a table size, all ${agent}, seeds ${seed}…${seed + games - 1}`,
  );
  if (overridesLine()) out.push(overridesLine());
  out.push('');
  const all: StableObs[] = [];
  for (const n of [3, 6, 8]) {
    const obs: StableObs[] = [];
    for (let g = 0; g < games; g++) obs.push(...playOne(seed + g, n, agent));
    all.push(...obs);
    const fair = 1 / n;
    out.push(
      `${n} stables — by opening draft position (1 = first pick; fair win rate ${pct(fair)})`,
    );
    out.push('  pos   win rate   vs fair   mean start   mean end   dogs rated');
    let worst = 0;
    const starts: number[] = [];
    for (let pos = 1; pos <= n; pos++) {
      const at = obs.filter((o) => o.pos === pos);
      const wr = at.filter((o) => o.won).length / at.length;
      worst = Math.max(worst, Math.abs(wr - fair));
      starts.push(mean(at.map((o) => o.start)));
      out.push(
        `  ${String(pos).padStart(3)}   ${pct(wr).padStart(8)}   ${((wr - fair) * 100 >= 0 ? '+' : '') + ((wr - fair) * 100).toFixed(1).padStart(4)}    ${fmt(mean(at.map((o) => o.start))).padStart(9)}   ${fmt(mean(at.map((o) => o.end))).padStart(8)}   ${mean(
          at.map((o) => o.meanRating),
        )
          .toFixed(1)
          .padStart(9)}`,
      );
    }
    const se = Math.sqrt((fair * (1 - fair)) / games) * 100;
    out.push(
      `  widest gap from fair ${(worst * 100).toFixed(1)} points (target ±3: ${worst <= 0.03 ? 'MET' : 'MISSED'}; one standard error at ${games} games is ${se.toFixed(1)})`,
    );
    out.push(
      `  start worth, first pick to last: ${fmt(starts[0]!)} → ${fmt(starts[n - 1]!)} (spread ${fmt(Math.max(...starts) - Math.min(...starts))}) · mean end worth ${fmt(mean(obs.map((o) => o.end)))}`,
    );
    out.push(
      `  kennels with all three styles ${pct(obs.filter((o) => o.allStyles).length / obs.length)} · poorer than they started ${pct(obs.filter((o) => o.end < o.start).length / obs.length)}`,
    );
    out.push('');
  }

  // D12's regression, on drafted trainers, with start worth as the control.
  const ids = STAFF_BONUSES.map((b) => b.id);
  const X = all.map((o) => [1, o.start / 1000, ...ids.map((id) => o.bonuses[id])]);
  const y = all.map((o) => o.end);
  const { beta, se } = ols(X, y);
  const purses = mean(all.map((o) => o.purses));
  out.push(
    `Each trainer bonus priced by D12's regression — end worth on bonuses drafted, start worth as a control (${all.length} stables)`,
  );
  out.push('  bonus                        held    Bones per bonus (± se)   cut now   fair cut');
  ids.forEach((id, i) => {
    const b = beta[i + 2]!;
    const e = se[i + 2]!;
    const row = STAFF_BONUSES.find((x) => x.id === id)!;
    const held = mean(all.map((o) => o.bonuses[id]));
    const fairCut = row.cut + b / Math.max(1, purses);
    out.push(
      `  ${row.short.padEnd(28)} ${held.toFixed(2).padStart(5)}   ${(b >= 0 ? '+' : '') + fmt(b)} (± ${fmt(e)})`.padEnd(
        68,
      ) + `${pct(row.cut).padStart(6)}   ${pct(fairCut).padStart(7)}`,
    );
  });
  out.push(
    `  (a stable's purses, gross: ${fmt(purses)} a season; start worth: ${(beta[1]! >= 0 ? '+' : '') + fmt(beta[1]!)} of end worth per 1,000 at the start)`,
  );
  const commission = mean(all.map((o) => o.commission));
  out.push(`Commission, as a share of purses: ${pct(commission / Math.max(1, purses))}`);
  out.push('', `Elapsed ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return out.join('\n');
}
