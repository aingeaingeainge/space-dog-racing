import { balance } from '../content/balance';
import { HEADLINE_TYPE_ID } from '../content/raceTypes';
import { emptyPlanetState } from '../economy/dogs';
import { netWorth } from '../economy/netWorth';
import {
  buildCalendar,
  emptyDeclarations,
  emptySeasonStats,
  log,
  player,
  type Ctx,
} from '../state';
import { openOffSeason } from './offSeason';
import type { GameOver, GameState, Id, SeasonMoments, SeasonRecord } from '../types';

/**
 * The game around the seasons (GDD_V3 §2.1, §2.2, §2.4): how a season ends, whether that is the
 * game's end, and how the next season starts.
 *
 * ⚠️ **A season is no longer the whole game.** Until Phase E `finishSeason` wrote the final standings
 * and stopped. Now it archives the season, then either ends the game or opens the way into the next
 * one — and `finalStandings` means the **game's**.
 */

/**
 * The stables at or past the Target, checked at the end of a weekend (GDD_V3 §2.1). Empty in a game
 * of seasons. Worth is read after the week's dinner and before the jump — the same figure
 * `worthByWeek` records for the weekend — so what the table saw on the leaderboard is what counts.
 */
export function targetCrossers(s: GameState): Id[] {
  if (s.length.kind !== 'target') return [];
  const target = s.length.worth;
  return s.players.filter((p) => netWorth(s, p) >= target).map((p) => p.id);
}

/** Gold Cups and races won this season, per stable, off the season's results (§2.4's tie-breaks). */
function seasonWins(s: GameState): { goldCups: Record<Id, number>; raceWins: Record<Id, number> } {
  const goldCups: Record<Id, number> = {};
  const raceWins: Record<Id, number> = {};
  for (const p of s.players) {
    goldCups[p.id] = 0;
    raceWins[p.id] = 0;
  }
  for (const r of s.results) {
    const win = r.payouts.find((x) => x.place === 1);
    if (!win) continue;
    raceWins[win.playerId] = (raceWins[win.playerId] ?? 0) + 1;
    if (r.race === HEADLINE_TYPE_ID) goldCups[win.playerId] = (goldCups[win.playerId] ?? 0) + 1;
  }
  return { goldCups, raceWins };
}

/**
 * The season's moments as facts (Phase E2), for the archive: the longest-priced winner and the slip
 * that paid most over its stake. Reads the season's results and book, which the next season clears.
 * Nothing here draws or decides anything; it is a record, like the standings beside it.
 */
function seasonMoments(s: GameState): SeasonMoments {
  let upset: SeasonMoments['upset'] = null;
  for (const r of s.results) {
    const e = r.entries.find((x) => x.dogId === r.order[0]);
    if (e && (!upset || e.odds > upset.odds))
      upset = {
        name: e.name,
        ownerId: e.ownerId,
        odds: e.odds,
        race: r.race,
        planetId: r.planetId,
        week: r.week,
      };
  }
  let bet: SeasonMoments['bet'] = null;
  for (const b of s.bets) {
    if (!b.settled?.won) continue;
    const profit = b.settled.payout - b.stake;
    if (bet && profit <= bet.profit) continue;
    const ran = s.results.find((r) => r.week === b.week && r.race === b.race);
    const name =
      ran?.entries.find((e) => e.dogId === b.dogId)?.name ?? s.dogs[b.dogId]?.name ?? 'a dog';
    bet = {
      playerId: b.playerId,
      name,
      stake: b.stake,
      odds: b.odds,
      kind: b.kind,
      race: b.race,
      week: b.week,
      profit,
    };
  }
  return { upset, bet, betsStruck: s.bets.length };
}

/**
 * Highest net worth first; ties to most Gold Cups, then most races won (GDD_V3 §2.4), then seating
 * order so the sort is total. ⚠️ **v2's second tie-break was "most Majors"**; §2.4 says races won,
 * and Phase E1 reads §2.4.
 */
function rank(
  s: GameState,
  goldCups: Record<Id, number>,
  raceWins: Record<Id, number>,
): { playerId: Id; netWorth: number }[] {
  return s.players
    .map((p, seat) => ({
      playerId: p.id,
      netWorth: netWorth(s, p),
      cups: goldCups[p.id] ?? 0,
      wins: raceWins[p.id] ?? 0,
      seat,
    }))
    .sort(
      (a, b) => b.netWorth - a.netWorth || b.cups - a.cups || b.wins - a.wins || a.seat - b.seat,
    )
    .map(({ playerId, netWorth: nw }) => ({ playerId, netWorth: nw }));
}

/** Sum one per-stable tally across every archived season: a game total, derived rather than kept. */
export function gameTotal(
  s: GameState,
  pick: (r: SeasonRecord) => Record<Id, number>,
): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const p of s.players) out[p.id] = 0;
  for (const r of s.seasons)
    for (const [id, n] of Object.entries(pick(r))) out[id] = (out[id] ?? 0) + n;
  return out;
}

/** Is this season the game's last? And if so, why (GDD_V3 §2.1). */
function endOfGame(s: GameState, crossers: Id[]): GameOver['reason'] | null {
  if (crossers.length) return 'target';
  if (s.length.kind === 'seasons') return s.season >= s.length.seasons ? 'seasons' : null;
  return s.season >= balance.targetSeasonCap ? 'cap' : null;
}

/**
 * The season is over: archive it, then end the game or open the off-season (GDD_V3 §2.1, §2.2).
 * Called at the end of week 10, or at the end of the weekend a Target is crossed.
 */
export function finishSeason(ctx: Ctx): void {
  const { s } = ctx;
  const crossers = targetCrossers(s);
  const { goldCups, raceWins } = seasonWins(s);
  const standings = rank(s, goldCups, raceWins);
  s.seasons.push({
    season: s.season,
    weeks: s.week,
    calendar: s.calendar.map((c) => c.planetId),
    standings,
    stats: Object.fromEntries(s.players.map((p) => [p.id, structuredClone(p.stats)])),
    goldCups,
    raceWins,
    moments: seasonMoments(s),
  });
  s.activePlayer = null;

  const reason = endOfGame(s, crossers);
  if (!reason) {
    const champ = player(s, standings[0]!.playerId);
    log(
      s,
      `Season ${s.season} over: ${champ.name} tops the table with a stable worth ${standings[0]!.netWorth}.`,
    );
    // GDD_V3 §2.2: between seasons, the off-season — age, one retirement, the staff notice.
    openOffSeason(ctx);
    return;
  }

  // The game's standings: final net worth, ties on Gold Cups and races won across the whole game.
  const game = rank(
    s,
    gameTotal(s, (r) => r.goldCups),
    gameTotal(s, (r) => r.raceWins),
  );
  s.finalStandings = game;
  s.gameOver = { reason, season: s.season, week: s.week, crossers };
  s.phase = 'seasonEnd';
  const champ = player(s, game[0]!.playerId);
  if (reason === 'target') {
    const who = crossers.map((id) => player(s, id).name).join(' and ');
    log(
      s,
      `${who} crossed ${s.length.kind === 'target' ? s.length.worth : 0} — the game ends this weekend. ${champ.name} wins with a stable worth ${game[0]!.netWorth}.`,
    );
  } else if (s.seasons.length > 1 || reason === 'cap') {
    log(s, `Game over: ${champ.name} wins with a stable worth ${game[0]!.netWorth}.`);
  } else {
    // One season: the line every game before Phase E ended on.
    log(s, `Season over: ${champ.name} wins with a stable worth ${game[0]!.netWorth}.`);
  }
}

/**
 * The next season (GDD_V3 §2.2 step 4): **cash, cargo, dogs, trainers and known styles carry over
 * untouched** — except that every dog comes back fresh, on full fitness and with no layoff (Phase E2); the circuit is re-drawn on the game's stream, prices reset (next week's market is
 * forgotten, so arrival rolls a fresh one), and the season's own business is cleared — conditions,
 * jobs, bets, declarations, results and the log. Each stable's season stats are reset, having been
 * archived in `seasons` when the last one ended. Turn order is rolled at arrival, as at any arrival.
 *
 * ⚠️ **`intel` is cleared too, and it has to be**: it is keyed by week number, and week numbers
 * repeat — a tip about week 10 would read as true again at week 10 of the next season.
 */
export function startNextSeason(ctx: Ctx): void {
  const { s, rng } = ctx;
  s.season++;
  s.calendar = buildCalendar(rng);
  s.week = 1;
  s.planet = emptyPlanetState(s.calendar[0]!.planetId);
  s.nextPlanet = null;
  s.explore = null;
  s.conditions = [];
  s.jobs = [];
  s.bets = [];
  s.results = [];
  s.eventLog = [];
  s.declarations = emptyDeclarations();
  s.locked = false;
  s.fields = null;
  s.races = null;
  s.pendingEvent = null;
  s.offSeason = null;
  s.done = [];
  s.activePlayer = null;
  for (const p of s.players) {
    p.stats = emptySeasonStats();
    p.intel = { week: 0, goods: [] };
    // Phase E2, Jesse's call: **the off-season is a long rest.** Every dog starts the new season on
    // `seasonStartFitness` (100) and any layoff clears. Until E2 fitness and layoffs carried over
    // untouched, and races entered fell from 2.12 a weekend in season 1 to about 1.87 after it.
    for (const id of p.dogIds) {
      const d = s.dogs[id];
      if (!d) continue;
      d.fitness = balance.seasonStartFitness;
      d.injuryWeeks = 0;
    }
  }
  s.phase = 'arrival';
  log(s, `Season ${s.season} begins.`);
}
