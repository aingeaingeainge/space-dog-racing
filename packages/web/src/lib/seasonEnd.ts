import {
  dogValue,
  formatBones,
  gameTotal,
  planetOf,
  roadSplit,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type PlayerSeasonStats,
  type RoadSplit,
  type SeasonRecord,
} from '@sdr/engine';
import { playerById, raceLabel, standings } from './selectors';

/**
 * GDD §15.11's two missing halves: the worth-over-time series behind the chart, and the
 * "moments" panel.
 *
 * Everything here is *derived*. `Player.stats.worthByWeek` has been recorded by the engine since
 * M0 and `s.results`, `s.bets` and `s.dogs` carry the rest, so this module adds nothing to
 * GameState and nothing to the engine — which is the whole reason the season-end screen could be
 * left until M4 without a rule change.
 *
 * ⚠️ **Phase E2: the upset and the best bet come from the archive now** (`SeasonRecord.moments`, kept
 * by the engine at `finishSeason`), because the game's end tells every season's story and each new
 * season clears the results and the book. The rest is still derived.
 */

export interface WorthSeries {
  player: Player;
  /** Net worth at the end of each week this stable played. Index 0 is week 1. */
  points: number[];
  /**
   * The week the stable went bust, or null. `endTurn` sets the flag and then pushes that week's
   * worth before skipping the stable ever after, so a bust stable's series simply stops — which
   * is why the line has to be allowed to end early rather than being padded out to week 13.
   */
  bustWeek: number | null;
  /** Final placing, 1 = champion. */
  rank: number;
}

/** One line per stable, in finishing order so the legend reads like the standings. */
export function worthSeries(s: GameState): WorthSeries[] {
  return standings(s).map((row, i) => {
    const points = row.player.stats.worthByWeek;
    return {
      player: row.player,
      points,
      bustWeek: null,
      rank: i + 1,
    };
  });
}

/** How many weeks the chart spans — the longest series, so a bust stable cannot shorten it. */
export function weeksPlayed(s: GameState): number {
  return s.players.reduce((n, p) => Math.max(n, p.stats.worthByWeek.length), 0);
}

export interface Moment {
  key: string;
  /** The label down the left — what kind of moment this is. */
  label: string;
  /** The answer, in as few words as it takes. */
  headline: string;
  /** Where and who, for the ones that have a where and a who. */
  detail?: string;
}

function stableName(s: GameState, ownerId: Id | 'local'): string {
  if (ownerId === 'local') return 'a local';
  return playerById(s, ownerId)?.name ?? 'a stable';
}

/**
 * The most valuable dog left standing. Not what anybody *paid* for one: purchase prices are
 * never written into the state, so a "most expensive dog" read off `s.dogs` would be an invented
 * number. This is what the dog is worth at the Galactic Collar, which the state does know.
 */
function bestDog(s: GameState): Moment | null {
  let best: Dog | null = null;
  for (const d of Object.values(s.dogs)) {
    if (d.ownerId === 'local' || d.ownerId === 'market') continue;
    if (!best || dogValue(d) > dogValue(best)) best = d;
  }
  if (!best) return null;
  const record = best.runs
    ? `${best.wins} win${best.wins === 1 ? '' : 's'} from ${best.runs} run${best.runs === 1 ? '' : 's'}`
    : 'never ran';
  return {
    key: 'dog',
    label: 'Most valuable dog',
    headline: `${best.name} — ${formatBones(dogValue(best))}`,
    detail: `rating ${best.rating}, ${best.age} seasons old · ${record} · ${stableName(s, best.ownerId)}`,
  };
}

/**
 * "Season 2, week 4" in a game of more than one season, "week 4" in a game of one — so a one-season
 * game reads exactly as it always did.
 */
function when(s: GameState, season: number, week: number): string {
  const multi = s.length.kind === 'target' || s.length.seasons > 1;
  return multi ? `season ${season}, week ${week}` : `week ${week}`;
}

/**
 * The longest odds that actually won, locals included — an upset is an upset. Read off the archive
 * (Phase E2), so a game's end can find the longest price of the whole game.
 */
function biggestUpset(s: GameState, recs: readonly SeasonRecord[]): Moment | null {
  let best: { rec: SeasonRecord; u: NonNullable<SeasonRecord['moments']['upset']> } | null = null;
  for (const rec of recs) {
    const u = rec.moments?.upset;
    if (u && (!best || u.odds > best.u.odds)) best = { rec, u };
  }
  if (!best) return null;
  const { rec, u } = best;
  return {
    key: 'upset',
    label: 'Biggest upset',
    headline: `${u.name} at ${u.odds.toFixed(2)}`,
    detail: `${raceLabel(u.race)} on ${planetOf(u.planetId).name}, ${when(s, rec.season, u.week)} — ${stableName(s, u.ownerId)}`,
  };
}

/** The slip that paid the most over its stake, across the seasons given. */
function bestBet(s: GameState, recs: readonly SeasonRecord[]): Moment | null {
  const struck = recs.reduce((n, r) => n + (r.moments?.betsStruck ?? 0), 0);
  if (!struck) return null;
  let best: { rec: SeasonRecord; b: NonNullable<SeasonRecord['moments']['bet']> } | null = null;
  for (const rec of recs) {
    const b = rec.moments?.bet;
    if (b && (!best || b.profit > best.b.profit)) best = { rec, b };
  }
  if (!best) {
    return {
      key: 'bet',
      label: 'Best bet',
      headline: 'Not one slip landed',
      detail: `${struck} bet${struck === 1 ? '' : 's'} struck, every one of them torn up`,
    };
  }
  const { rec, b } = best;
  return {
    key: 'bet',
    label: 'Best bet',
    headline: `${formatBones(b.profit)} on ${b.name}`,
    detail: `${stableName(s, b.playerId)} — ${formatBones(b.stake)} at ${b.odds.toFixed(2)} ${b.kind}, ${raceLabel(b.race)} in ${when(s, rec.season, b.week)}`,
  };
}

/**
 * The last weekend the lead actually changed hands, on whatever axis the series are drawn on — a
 * season's weeks, or (Phase E2) the whole game's weekends laid end to end. Session 1 measured the
 * season as settled by week 7.6 of 13 after the balance pass, so this is the number that says
 * whether *this* season, or game, was a contest or a procession.
 */
function leadChange(
  s: GameState,
  series: readonly WorthSeries[],
  label: (weekend: number) => string,
): Moment | null {
  const n = series.reduce((m, x) => Math.max(m, x.points.length), 0);
  if (n === 0) return null;
  const leaderAt = (weekend: number): Player | null => {
    let best: Player | null = null;
    let bestWorth = -Infinity;
    for (const line of series) {
      const w = line.points[weekend - 1];
      if (w !== undefined && w > bestWorth) {
        bestWorth = w;
        best = line.player;
      }
    }
    return best;
  };
  let leader = leaderAt(1);
  let changed = 0;
  let takenFrom: Player | null = null;
  for (let w = 2; w <= n; w++) {
    const next = leaderAt(w);
    if (next && leader && next.id !== leader.id) {
      changed = w;
      takenFrom = leader;
    }
    if (next) leader = next;
  }
  if (!leader) return null;
  if (changed === 0) {
    return {
      key: 'lead',
      label: 'The lead',
      headline: `${leader.name} led from the first weekend`,
      detail: 'never headed — a procession',
    };
  }
  return {
    key: 'lead',
    label: 'Lead last changed',
    headline: label(changed),
    detail: takenFrom ? `${leader.name} took it off ${takenFrom.name} and kept it` : undefined,
  };
}

/**
 * Stewards' enquiries that caught somebody (GDD_V3 §9.3) — public, and the best story generator in
 * the game — summed across the seasons given, off the archived stats.
 */
function caught(s: GameState, recs: readonly SeasonRecord[]): Moment | null {
  const rows = s.players
    .map((p) => ({ p, n: recs.reduce((m, r) => m + (r.stats[p.id]?.caught ?? 0), 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!rows.length) return null;
  const total = rows.reduce((m, x) => m + x.n, 0);
  return {
    key: 'caught',
    label: 'Caught by the stewards',
    headline: rows.map((x) => (x.n > 1 ? `${x.p.name} ×${x.n}` : x.p.name)).join(', '),
    detail: `${total} nobble${total === 1 ? '' : 's'} found out and fined`,
  };
}

/**
 * What the season that has just ended will be remembered for (Phase E2: read off its archive record,
 * whose moments the engine keeps at `finishSeason`).
 */
export function moments(s: GameState): Moment[] {
  const rec = s.seasons[s.seasons.length - 1];
  const recs = rec ? [rec] : [];
  return [
    biggestUpset(s, recs),
    bestDog(s),
    bestBet(s, recs),
    caught(s, recs),
    leadChange(s, worthSeries(s), (w) => `Week ${w} of ${weeksPlayed(s)}`),
  ].filter((m): m is Moment => m !== null);
}

/**
 * The whole game's moments (Phase E2): the longest price and the best slip of any season, the most
 * valuable dog left, everybody the stewards caught, and the last time the lead changed across every
 * season laid end to end.
 */
export function gameMoments(s: GameState): Moment[] {
  const series = gameWorthSeries(s);
  const at = (weekend: number): string => {
    let left = weekend;
    for (const r of s.seasons) {
      if (left <= r.weeks) return `Season ${r.season}, week ${left}`;
      left -= r.weeks;
    }
    return `Weekend ${weekend}`;
  };
  return [
    biggestUpset(s, s.seasons),
    bestDog(s),
    bestBet(s, s.seasons),
    caught(s, s.seasons),
    leadChange(s, series, at),
  ].filter((m): m is Moment => m !== null);
}

// ---------------------------------------------------------------------------------------------------
// Phase E2: the season's end and the game's end read the **archive** (`s.seasons`), which the engine
// writes at `finishSeason`. Between seasons the dogs have already aged a year, so a net worth read off
// the live state would not be the figure the season ended on; the archive's is.

/** The season that has just ended — the last one archived. */
export function lastSeason(s: GameState): SeasonRecord | undefined {
  return s.seasons[s.seasons.length - 1];
}

export interface SeasonRow {
  player: Player;
  netWorth: number;
  goldCups: number;
  raceWins: number;
  stats: PlayerSeasonStats;
  split: RoadSplit;
}

/** One season's table, from its archive record, in the order it finished. */
export function seasonRows(s: GameState, rec: SeasonRecord): SeasonRow[] {
  return rec.standings.flatMap(({ playerId, netWorth }) => {
    const player = playerById(s, playerId);
    const stats = rec.stats[playerId];
    if (!player || !stats) return [];
    return [
      {
        player,
        netWorth,
        goldCups: rec.goldCups[playerId] ?? 0,
        raceWins: rec.raceWins[playerId] ?? 0,
        stats,
        split: roadSplit(s, { ...player, stats }),
      },
    ];
  });
}

/** Two splits added together, for a whole game's ledger. */
function addSplit(a: RoadSplit, b: RoadSplit): RoadSplit {
  return {
    prize: a.prize + b.prize,
    trade: a.trade + b.trade,
    betting: a.betting + b.betting,
    costs: a.costs + b.costs,
    net: a.net + b.net,
  };
}

/** The trainers' cut for a season's stats — a cost inside `RoadSplit.costs`, shown on its own. */
export function commissionOf(stats: PlayerSeasonStats): number {
  return stats.commission;
}

export interface GameRow {
  player: Player;
  netWorth: number;
  goldCups: number;
  raceWins: number;
  /** Seasons this stable topped. */
  titles: number;
  split: RoadSplit;
  commission: number;
}

/** The whole game's table: final standings, with every season's ledger summed from the archive. */
export function gameRows(s: GameState): GameRow[] {
  const cups = gameTotal(s, (r) => r.goldCups);
  const wins = gameTotal(s, (r) => r.raceWins);
  return (s.finalStandings ?? []).flatMap(({ playerId, netWorth }) => {
    const player = playerById(s, playerId);
    if (!player) return [];
    let split: RoadSplit = { prize: 0, trade: 0, betting: 0, costs: 0, net: 0 };
    let commission = 0;
    for (const rec of s.seasons) {
      const stats = rec.stats[playerId];
      if (!stats) continue;
      split = addSplit(split, roadSplit(s, { ...player, stats }));
      commission += stats.commission;
    }
    return [
      {
        player,
        netWorth,
        goldCups: cups[playerId] ?? 0,
        raceWins: wins[playerId] ?? 0,
        titles: s.seasons.filter((r) => r.standings[0]?.playerId === playerId).length,
        split,
        commission,
      },
    ];
  });
}

/** A marker on the worth chart's time axis: a Major, the Grand Final, or an off-season. */
export interface ChartMark {
  /** Weekend index along the axis, 1-based; a half is between two weekends. */
  at: number;
  label: string;
  strong?: boolean;
}

/**
 * The whole game's worth, one line per stable across every season, from the archive's
 * `worthByWeek` (Phase E2): the seasons laid end to end, so the axis is the game's weekends.
 */
export function gameWorthSeries(s: GameState): WorthSeries[] {
  const order = s.finalStandings ?? s.seasons[s.seasons.length - 1]?.standings ?? [];
  return order.flatMap(({ playerId }, i) => {
    const player = playerById(s, playerId);
    if (!player) return [];
    const points = s.seasons.flatMap((r) => r.stats[playerId]?.worthByWeek ?? []);
    return [{ player, points, bustWeek: null, rank: i + 1 }];
  });
}

/** Where each off-season falls on the whole-game axis: between a season's last weekend and the next's first. */
export function seasonMarks(s: GameState): ChartMark[] {
  const marks: ChartMark[] = [];
  let at = 0;
  for (const r of s.seasons.slice(0, -1)) {
    at += r.weeks;
    marks.push({ at: at + 0.5, label: `S${r.season + 1}`, strong: true });
  }
  return marks;
}

/**
 * How a Target game finished (GDD_V3 §2.1, E3): who crossed and when, whether two crossed together,
 * and whether the stable that led into the last weekend was caught on it. Read off the whole-game
 * worth lines, which are the same figures the Target check read.
 */
export interface TargetFinish {
  crossers: Player[];
  season: number;
  week: number;
  /** The game's weekend the target was crossed on, counting every season. */
  weekend: number;
  together: boolean;
  /** The stable that led at the end of the weekend before, if it is not the winner. */
  caught: Player | null;
}

export function targetFinish(s: GameState): TargetFinish | null {
  const over = s.gameOver;
  if (!over || over.reason !== 'target') return null;
  const series = gameWorthSeries(s);
  const weekend = series.reduce((n, x) => Math.max(n, x.points.length), 0);
  let before: Player | null = null;
  let best = -Infinity;
  for (const line of series) {
    const v = line.points[weekend - 2];
    if (v !== undefined && v > best) {
      best = v;
      before = line.player;
    }
  }
  const winner = s.finalStandings?.[0]?.playerId;
  return {
    crossers: over.crossers.flatMap((id) => playerById(s, id) ?? []),
    season: over.season,
    week: over.week,
    weekend,
    together: over.crossers.length > 1,
    caught: before && before.id !== winner ? before : null,
  };
}
