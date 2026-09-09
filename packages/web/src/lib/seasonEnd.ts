import {
  dogValue,
  formatBones,
  planetOf,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceEntry,
  type RaceResult,
} from '@sdr/engine';
import { CLASS_LABEL, playerById, standings } from './selectors';

/**
 * GDD §15.11's two missing halves: the worth-over-time series behind the chart, and the
 * "moments" panel.
 *
 * Everything here is *derived*. `Player.stats.worthByWeek` has been recorded by the engine since
 * M0 and `s.results`, `s.bets` and `s.dogs` carry the rest, so this module adds nothing to
 * GameState and nothing to the engine — which is the whole reason the season-end screen could be
 * left until M4 without a rule change.
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
      bustWeek: row.player.flags.bankrupt ? points.length : null,
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

function where(r: RaceResult): string {
  return `${CLASS_LABEL[r.cls]} on ${planetOf(r.planetId).name}, week ${r.week}`;
}

/** The longest odds that actually won, locals included — an upset is an upset. */
function biggestUpset(s: GameState): Moment | null {
  let best: { r: RaceResult; e: RaceEntry } | null = null;
  for (const r of s.results) {
    const winner = r.order[0];
    if (!winner) continue;
    const e = r.entries.find((x) => x.dogId === winner);
    if (e && (!best || e.odds > best.e.odds)) best = { r, e };
  }
  if (!best) return null;
  return {
    key: 'upset',
    label: 'Biggest upset',
    headline: `${best.e.name} at ${best.e.odds.toFixed(2)}`,
    detail: `${where(best.r)} — ${stableName(s, best.e.ownerId)}`,
  };
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
  const record = best.runs ? `${best.wins} wins from ${best.runs} runs` : 'never ran';
  return {
    key: 'dog',
    label: 'Most valuable dog',
    headline: `${best.name} — ${formatBones(dogValue(best))}`,
    detail: `rating ${best.rating}, ${best.age} seasons old · ${record} · ${stableName(s, best.ownerId)}`,
  };
}

/** The slip that paid the most over its stake. */
function bestBet(s: GameState): Moment | null {
  const settled = s.bets.filter((b) => b.settled);
  if (!s.bets.length) return null;
  const won = settled.filter((b) => b.settled?.won);
  if (!won.length) {
    return {
      key: 'bet',
      label: 'Best bet',
      headline: 'Not one slip landed',
      detail: `${s.bets.length} bet${s.bets.length === 1 ? '' : 's'} struck all season, every one of them torn up`,
    };
  }
  const best = won.reduce((a, b) =>
    (b.settled!.payout - b.stake > a.settled!.payout - a.stake ? b : a),
  );
  const profit = best.settled!.payout - best.stake;
  return {
    key: 'bet',
    label: 'Best bet',
    headline: `${formatBones(profit)} on ${s.dogs[best.dogId]?.name ?? 'a dog since sold'}`,
    detail: `${stableName(s, best.playerId)} — ${formatBones(best.stake)} at ${best.odds.toFixed(2)} ${best.kind}, ${CLASS_LABEL[best.cls]} in week ${best.week}`,
  };
}

/**
 * The stewards. Session 1 raised the supplement to +12 speed and the harness went from reporting
 * zero of these to 1,835 fed and 151 caught across 800 seasons, so there is finally something
 * here worth printing.
 */
function stewards(s: GameState): Moment {
  let fed = 0;
  let caught = 0;
  for (const p of s.players) {
    fed += p.stats.supplementsUsed;
    caught += p.stats.supplementsCaught;
  }
  if (fed === 0) {
    return {
      key: 'stewards',
      label: 'The stewards',
      headline: s.toggles.cleanSport ? 'Clean Sport — nothing to find' : 'Nobody risked one',
      detail: s.toggles.cleanSport
        ? 'the supplement was off the table this season'
        : 'thirteen weekends and not a single supplement fed',
    };
  }
  const weeks = s.results.filter((r) => r.dopingCaught.length).map((r) => r.week);
  const unique = [...new Set(weeks)];
  return {
    key: 'stewards',
    label: 'The stewards',
    headline: `${caught} caught of ${fed} fed`,
    detail: unique.length
      ? `swabs came back positive in week${unique.length === 1 ? '' : 's'} ${unique.join(', ')}`
      : 'every one of them got away with it',
  };
}

/**
 * The last week the lead actually changed hands. Session 1 measured the season as settled by
 * week 7.6 of 13 after the balance pass (6.5 before it), so this is the number that says whether
 * *this* season was a contest or a procession.
 */
function leadChange(s: GameState): Moment | null {
  const n = weeksPlayed(s);
  if (n === 0) return null;
  const leaderAt = (week: number): Player | null => {
    let best: Player | null = null;
    let bestWorth = -Infinity;
    for (const p of s.players) {
      const w = p.stats.worthByWeek[week - 1];
      if (w === undefined) continue;
      if (w > bestWorth) {
        bestWorth = w;
        best = p;
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
      headline: `${leader.name} led from week 1`,
      detail: 'never headed — a procession',
    };
  }
  return {
    key: 'lead',
    label: 'Lead last changed',
    headline: `Week ${changed} of ${n}`,
    detail: takenFrom ? `${leader.name} took it off ${takenFrom.name} and kept it` : undefined,
  };
}

/** Everything the season already knows about itself, in the order it is worth reading. */
export function moments(s: GameState): Moment[] {
  return [biggestUpset(s), bestDog(s), bestBet(s), leadChange(s), stewards(s)].filter(
    (m): m is Moment => m !== null,
  );
}
