/**
 * `npm run harness -- --game` — whole games (BUILD_PLAN_V3 Phase E, v3 Phase E1 item 5).
 *
 *   npm run harness -- --game [--games 200] [--ai normal,normal,…] [--seed 1] [--set key=value …]
 *
 * Plays full games at **1, 3 and 5 seasons** and in **Target mode** at both suggested targets, six
 * Normal stables unless `--ai` says otherwise, and reports every row of Phase E1's acceptance table
 * against its band. Kept out of `harness.ts` because it is its own instrument: it plays *games*,
 * where everything in that file plays one season and reads one season's state at the end.
 *
 * ⚠️ **"Mathematically out" is defined here before it is measured** (Phase E1 item 5): at the start
 * of week 8 of a season, a stable is out if its net worth plus **every first-place purse still to run
 * that season** — weeks 8, 9 and 10, all three races, at their Major and Grand Final multipliers and
 * the planet's own, raised by its prize-money trainers and never cut by commission or tax — is still
 * under the leader's net worth. It ignores trading and betting, which can make anything possible, so
 * it is a *purse* definition: a stable that is out could still win only by the market or the bookie.
 */
import { overridesLine } from './balance-set';
import { balance } from '../src/content/balance';
import { planetOf } from '../src/content/planets';
import { CARD, raceType } from '../src/content/raceTypes';
import { netWorth } from '../src/economy/netWorth';
import { commissionRate, staffBonus } from '../src/economy/staff';
import { decide } from '../src/ai';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { createSeason, player } from '../src/state';
import type { AiAgent, CalendarEntry, GameLength, GameState, Id } from '../src/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-NZ');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** What one game told us. Every array is per stable-season unless it says otherwise. */
interface GameObs {
  seasons: number;
  weekends: number;
  stables: number;
  /** Per season index (0-based): worth at the first arrival, and at the season's last weekend. */
  start: number[][];
  end: number[][];
  /** Per season: the share of stables mathematically out at the start of week 8. */
  outAt8: { out: number; of: number }[];
  /** Per season: the ages of every kennel dog at the season's first arrival. */
  ages: number[][];
  /** Per season: races entered a weekend, per stable (declarations at the lock). */
  entered: number[][];
  retirements: number;
  poundDogs: number;
  leavers: number;
  hires: number;
  candidates: number;
  over: GameState['gameOver'];
  winner: Id;
  weeksPlayed: number;
  /** The richest stable at the end of the weekend before the last — who led into the finish. */
  leaderBefore: Id | null;
  /**
   * Phase I: per season, E7's test run at the season's first arrival with **the whole season's**
   * first-place purses left, rather than at week 8 with three weeks' worth.
   */
  outAtStart: { out: number; of: number }[];
  /** Phase I: per season, per stable (seat order), where its money came from and what it had. */
  ledger: Ledger[][];
  /** Phase I: the game's final standings, best first. */
  finalOrder: Id[];
}

/** Phase I: one stable's season, for "where does the richer half's extra come from". */
interface Ledger {
  /** Purses won, gross (before the trainers' cut), and the cut. */
  prize: number;
  cut: number;
  trade: number;
  bet: number;
  /** Food bought for eating, and stewards' fines. */
  food: number;
  fines: number;
  /** Mean rating of the dogs it declared, over the season; races it entered. */
  ratingSum: number;
  entries: number;
  /** At the season's first arrival: cash, the trainers' combined cut, prize-money trainers. */
  cash: number;
  cutRate: number;
  prizeUp: number;
}

/** The first-place purse this race pays in this calendar week (§7.1), before any trainer's bonus. */
function winPurse(entry: CalendarEntry, race: (typeof CARD)[number]): number {
  const mult = entry.grandFinal ? balance.finalMult : entry.major ? balance.majorMult : 1;
  const planetMult = planetOf(entry.planetId).special.purseMult ?? 1;
  return Math.round(raceType(race).purse[0] * mult * planetMult);
}

/** Share of stables mathematically out at the start of week 8, by the definition at the top. */
function outAtWeek8(s: GameState): { out: number; of: number } {
  const worth = s.players.map((p) => p.stats.worthByWeek[6] ?? netWorth(s, p));
  return outWith(s, worth, 7);
}

/**
 * E7's test with the purses from calendar index `from` onward: a stable is out if its worth plus
 * every first-place purse left (raised by its prize-money trainers) is under the leader's worth.
 */
function outWith(s: GameState, worth: number[], from: number): { out: number; of: number } {
  const leader = Math.max(...worth);
  let out = 0;
  s.players.forEach((p, i) => {
    let most = 0;
    for (const e of s.calendar.slice(from)) for (const race of CARD) most += winPurse(e, race);
    most = Math.round(most * (1 + staffBonus(p, 'prizeUp') * balance.staffPrizeUp));
    if (worth[i]! + most < leader) out++;
  });
  return { out, of: s.players.length };
}

export function playGame(seed: number, ai: AiAgent[], length: GameLength): GameObs {
  const s = createSeason({
    seed,
    players: ai.map((difficulty) => ({ name: '', kind: 'ai' as const, difficulty })),
    length,
  });
  const obs: GameObs = {
    seasons: 0,
    weekends: 0,
    stables: s.players.length,
    start: [],
    end: [],
    outAt8: [],
    ages: [],
    entered: [],
    retirements: 0,
    poundDogs: 0,
    leavers: 0,
    hires: 0,
    candidates: 0,
    over: null,
    winner: '',
    weeksPlayed: 0,
    leaderBefore: null,
    outAtStart: [],
    ledger: [],
    finalOrder: [],
  };
  let startedSeason = 0;
  let week8Season = 0;
  let lockedKey = '';
  let offSeasonSeen = 0;
  let guard = 0;
  while (!isSeasonOver(s) && guard++ < 2_000_000) {
    // The season's first look, once arrival has rolled the shelf (so the hold has a price).
    if (s.phase === 'explore' && s.week === 1 && startedSeason !== s.season) {
      startedSeason = s.season;
      obs.start.push(s.players.map((p) => netWorth(s, p)));
      obs.ages.push(s.players.flatMap((p) => p.dogIds.map((id) => s.dogs[id]!.age)));
      obs.entered.push([]);
      const worth = obs.start[obs.start.length - 1]!;
      obs.outAtStart.push(outWith(s, worth, 0));
      obs.ledger.push(
        s.players.map((p) => ({
          prize: 0,
          cut: 0,
          trade: 0,
          bet: 0,
          food: 0,
          fines: 0,
          ratingSum: 0,
          entries: 0,
          cash: p.cash,
          cutRate: commissionRate(p),
          prizeUp: staffBonus(p, 'prizeUp'),
        })),
      );
    }
    if (s.phase === 'arrival' && s.week === 8 && week8Season !== s.season) {
      week8Season = s.season;
      obs.outAt8.push(outAtWeek8(s));
    }
    const key = `${s.season}.${s.week}`;
    if (s.fields && !s.races && lockedKey !== key) {
      lockedKey = key;
      s.players.forEach((p, i) => {
        let n = 0;
        const l = obs.ledger[obs.ledger.length - 1]![i]!;
        for (const race of CARD) {
          const dogId = s.declarations[race][p.id];
          if (!dogId) continue;
          n++;
          l.entries++;
          l.ratingSum += s.dogs[dogId]?.rating ?? 0;
        }
        obs.entered[obs.entered.length - 1]!.push(n);
      });
    }
    if (s.phase === 'offSeason' && s.offSeason && offSeasonSeen !== s.season) {
      offSeasonSeen = s.season;
      for (const n of Object.values(s.offSeason.notices)) {
        obs.leavers += n.left.length;
        if (n.candidate) obs.candidates++;
      }
    }
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = s.pendingEvent?.playerId ?? s.activePlayer;
    if (!who) throw new Error(`Engine stalled in phase ${s.phase}`);
    const p = player(s, who);
    for (const a of decide(s, who, p.difficulty)) {
      if (a.t === 'Retire' && a.dogId) obs.retirements++;
      if (a.t === 'ResolveStaffNotice' && a.hire) obs.hires++;
      reduceMut(s, a);
    }
  }
  s.seasons.forEach((r, k) => {
    s.players.forEach((p, i) => {
      const st = r.stats[p.id]!;
      const l = obs.ledger[k]![i]!;
      l.prize = st.prizeIncome + st.commission;
      l.cut = st.commission;
      l.trade = st.tradeIncome;
      l.bet = st.betIncome;
      l.food = st.costs;
      l.fines = st.fines;
    });
  });
  obs.finalOrder = s.finalStandings!.map((x) => x.playerId);
  for (const r of s.seasons) {
    obs.end.push(s.players.map((p) => r.standings.find((x) => x.playerId === p.id)!.netWorth));
    obs.poundDogs += Object.values(r.stats).reduce((a, st) => a + st.dogsTaken, 0);
    obs.weekends += r.weeks;
  }
  obs.seasons = s.seasons.length;
  obs.over = s.gameOver;
  obs.winner = s.finalStandings![0]!.playerId;
  obs.weeksPlayed = (s.season - 1) * balance.weeks + s.week;
  // Who led going into the last weekend: the week before in this season, or last season's end.
  const last = s.seasons[s.seasons.length - 1]!;
  const before = s.players.map((p) =>
    s.week > 1
      ? last.stats[p.id]!.worthByWeek[s.week - 2]!
      : (s.seasons[s.seasons.length - 2]?.standings.find((x) => x.playerId === p.id)?.netWorth ??
        0),
  );
  if (s.week > 1 || s.seasons.length > 1)
    obs.leaderBefore = s.players[before.indexOf(Math.max(...before))]!.id;
  return obs;
}

interface ModeRow {
  label: string;
  length: GameLength;
  games: number;
}

export function runGames(games: number, seed: number, ai: AiAgent[]): string {
  const out: string[] = [];
  const modes: ModeRow[] = [
    { label: '1 season', length: { kind: 'seasons', seasons: 1 }, games: games * 2 },
    { label: '3 seasons', length: { kind: 'seasons', seasons: 3 }, games },
    { label: '5 seasons', length: { kind: 'seasons', seasons: 5 }, games },
    {
      label: `Target ${fmt(balance.targetShort)}`,
      length: { kind: 'target', worth: balance.targetShort },
      games,
    },
    {
      label: `Target ${fmt(balance.targetLong)}`,
      length: { kind: 'target', worth: balance.targetLong },
      games,
    },
  ];
  out.push(
    `Space Dog Racing — whole games (Phase E1), stables: ${ai.join(', ')}, seeds from ${seed}`,
  );
  if (overridesLine()) out.push(overridesLine());
  out.push('');

  const all: { mode: ModeRow; obs: GameObs[]; ms: number }[] = [];
  for (const mode of modes) {
    const t0 = performance.now();
    const obs: GameObs[] = [];
    for (let g = 0; g < mode.games; g++) obs.push(playGame(seed + g, ai, mode.length));
    all.push({ mode, obs, ms: performance.now() - t0 });
  }

  // ---- The acceptance rows, per mode ----
  out.push(
    'Per mode — stable-seasons ending poorer than they began (band 10–25%), the 1st-to-last gap at',
    "season's end, and the share of stables mathematically out at the start of week 8 (target 0)",
  );
  out.push(
    '  mode            games  seasons  poorer   gap mean   gap/mean  1st/last  out@8 any  out@8 last  ms/player-wkd',
  );
  for (const { mode, obs, ms } of all) {
    let poorer = 0;
    let stableSeasons = 0;
    const gaps: number[] = [];
    const rel: number[] = [];
    const ratio: number[] = [];
    let out8 = 0;
    let of8 = 0;
    let outLast = 0;
    let ofLast = 0;
    let playerWeekends = 0;
    for (const o of obs) {
      o.end.forEach((end, k) => {
        const start = o.start[k]!;
        end.forEach((w, i) => {
          stableSeasons++;
          if (w < start[i]!) poorer++;
        });
        const hi = Math.max(...end);
        const lo = Math.min(...end);
        gaps.push(hi - lo);
        rel.push((hi - lo) / mean(end));
        ratio.push(hi / Math.max(1, lo));
      });
      for (const x of o.outAt8) {
        out8 += x.out;
        of8 += x.of;
      }
      // The game's own reading: in the last season there are no purses after this one's, so the
      // season's definition is the game's. Only if the game reached week 8 of its last season.
      if (o.outAt8.length === o.seasons) {
        outLast += o.outAt8[o.seasons - 1]!.out;
        ofLast += o.outAt8[o.seasons - 1]!.of;
      }
      playerWeekends += o.stables * o.weekends;
    }
    const cells = [
      mode.label.padEnd(15),
      String(obs.length).padStart(5),
      mean(obs.map((o) => o.seasons))
        .toFixed(2)
        .padStart(7),
      pct(poorer / stableSeasons).padStart(6),
      fmt(mean(gaps)).padStart(9),
      pct(mean(rel)).padStart(8),
      `${median(ratio).toFixed(2).padStart(7)}×`,
      pct(out8 / Math.max(1, of8)).padStart(8),
      (ofLast ? pct(outLast / ofLast) : '—').padStart(10),
      (ms / playerWeekends).toFixed(2).padStart(10),
    ];
    out.push(`  ${cells.join('  ')}`);
  }
  out.push(
    '  poorer: end-of-season worth under the worth at the season’s first arrival. gap: richest less poorest at',
    '  the season’s last weekend; gap/mean divides by that table’s mean. out@8: see the definition at the top',
    '  of harness-game.ts — worth + every first-place purse left in the season < the leader’s worth, at the',
    '  start of week 8; "any" is every season’s week 8, "last" only the game’s last season, where the',
    '  season’s purses are the game’s. v2e (six Normal, 800 seasons, measured at the tag with its own',
    '  engine): gap 63,530, gap/mean 195%, 1st/last 8.16×.',
    '',
  );

  // ---- Mean end worth by season, and whether the rich compound ----
  const five = all.find((x) => x.mode.label === '5 seasons')!;
  out.push('Mean worth by season (5-season games): at the first arrival → at the season’s end');
  for (let k = 0; k < 5; k++) {
    const st = five.obs.flatMap((o) => o.start[k] ?? []);
    const en = five.obs.flatMap((o) => o.end[k] ?? []);
    const ent = five.obs.flatMap((o) => o.entered[k] ?? []);
    out.push(
      `  season ${k + 1}: ${fmt(mean(st)).padStart(7)} → ${fmt(mean(en)).padStart(7)}   (gain ${fmt(mean(en) - mean(st))}; races entered ${mean(ent).toFixed(2)} a weekend)`,
    );
  }
  // Compounding: split each season's table at its median start worth; compare the halves' gains.
  const halves = { top: [] as number[], bottom: [] as number[] };
  for (const o of five.obs)
    for (let k = 1; k < o.end.length; k++) {
      const start = o.start[k]!;
      const mid = median(start);
      start.forEach((w, i) => (w >= mid ? halves.top : halves.bottom).push(o.end[k]![i]! - w));
    }
  let sameWinner = 0;
  for (const o of five.obs) {
    const s1 = o.end[0]!;
    const leader1 = s1.indexOf(Math.max(...s1));
    if (`p${leader1 + 1}` === o.winner) sameWinner++;
  }
  out.push(
    `  seasons 2–5: the richer half at a season's start gains ${fmt(mean(halves.top))} in it, the poorer half ${fmt(mean(halves.bottom))}`,
    `  the leader after season 1 wins the 5-season game ${pct(sameWinner / five.obs.length)} of the time (1 in ${ai.length} by chance)`,
    '',
  );

  // ---- Phase I: the long game — is E7 the right measure, and where does the lead come from? ----
  out.push(...longGame(all), '');

  // ---- The roster turns over (5-season games) ----
  const stableGames = five.obs.reduce((a, o) => a + o.stables, 0);
  const perTwo = (n: number) => (n / stableGames) * (2 / 5);
  const ret = five.obs.reduce((a, o) => a + o.retirements, 0);
  const pound = five.obs.reduce((a, o) => a + o.poundDogs, 0);
  out.push(
    'The kennel turns over (5-season games) — dogs replaced per stable per two seasons (target ≥ 1)',
    `  retired at the off-season ${perTwo(ret).toFixed(2)} + taken in the Pound ${perTwo(pound).toFixed(2)} = ${perTwo(ret + pound).toFixed(2)}: ${perTwo(ret + pound) >= 1 ? 'MET' : 'MISSED'}`,
    `  off-seasons: ${pct(ret / Math.max(1, stableGames * 4))} of stables retire a dog; trainers leave ${(five.obs.reduce((a, o) => a + o.leavers, 0) / (stableGames * 4)).toFixed(2)} a stable; ` +
      `${pct(five.obs.reduce((a, o) => a + o.candidates, 0) / (stableGames * 4))} are offered a candidate, ${pct(
        five.obs.reduce((a, o) => a + o.hires, 0) /
          Math.max(
            1,
            five.obs.reduce((a, o) => a + o.candidates, 0),
          ),
      )} of them hired`,
    '',
  );

  // ---- Age mix at each season's start ----
  out.push(
    'Age mix of kennels at the start of each season (5-season games) — is the game ageing into 7s?',
  );
  out.push('  season   age 1   age 2   age 3   age 4   age 5   age 6   age 7    mean');
  for (let k = 0; k < 5; k++) {
    const ages = five.obs.flatMap((o) => o.ages[k] ?? []);
    const cells = [1, 2, 3, 4, 5, 6, 7].map((a) =>
      pct(ages.filter((x) => x === a).length / Math.max(1, ages.length)).padStart(7),
    );
    out.push(`  ${String(k + 1).padStart(6)} ${cells.join(' ')}   ${mean(ages).toFixed(2)}`);
  }
  out.push('');

  // ---- Target mode ----
  out.push('Target mode — how a race to a figure ends');
  out.push(
    '  target      weekends to finish (mean / p10 / p90)   crosser not the winner   two or more crossed   leader into the last weekend lost   hit the season cap',
  );
  for (const { mode, obs } of all.filter((x) => x.mode.length.kind === 'target')) {
    const weeks = obs.map((o) => o.weeksPlayed).sort((a, b) => a - b);
    const q = (p: number) => weeks[Math.min(weeks.length - 1, Math.floor(p * weeks.length))]!;
    const notWinner = obs.filter(
      (o) => o.over?.reason === 'target' && !o.over.crossers.includes(o.winner),
    ).length;
    const cap = obs.filter((o) => o.over?.reason === 'cap').length;
    const several = obs.filter((o) => (o.over?.crossers.length ?? 0) > 1).length;
    const overtaken = obs.filter((o) => o.leaderBefore && o.leaderBefore !== o.winner).length;
    out.push(
      `  ${mode.label.padEnd(15)} ${mean(weeks).toFixed(1).padStart(6)} / ${String(q(0.1)).padStart(3)} / ${String(q(0.9)).padStart(3)}${' '.repeat(22)}${pct(notWinner / obs.length).padStart(6)}${pct(several / obs.length).padStart(22)}${pct(overtaken / obs.length).padStart(36)}${pct(cap / obs.length).padStart(21)}`,
    );
  }
  out.push(
    '  ⚠️ "Crosser not the winner" is zero by construction: worth is checked once, at the end of the weekend, so',
    '  whoever is richest then is at or past the target too. What §2.1\'s "overtaken on the line" can mean is the',
    '  last two columns — two stables crossing together, and the stable that led into the last weekend losing it.',
    `  A season is ${balance.weeks} weekends; the cap is ${balance.targetSeasonCap} seasons. The finish itself is E2's playtest row.`,
    '',
  );

  const pw = all.reduce(
    (a, x) => {
      a.ms += x.ms;
      a.n += x.obs.reduce((b, o) => b + o.stables * o.weekends, 0);
      return a;
    },
    { ms: 0, n: 0 },
  );
  out.push(
    `Engine wall-clock: ${(pw.ms / pw.n).toFixed(2)} ms a player-weekend (${fmt(pw.n)} player-weekends in ${(pw.ms / 1000).toFixed(1)} s), AI decisions included.`,
  );
  return out.join('\n');
}

/**
 * Phase I: the long game. E7's week-8 test in the last season sets three weeks of purses against a
 * lead built over years, so alongside it: the same test at the last season's first arrival with the
 * whole season's purses left, and two comeback measures that ask pillar 5's question directly. Then
 * the richer half's extra gain in seasons 2+, split into where it came from.
 */
function longGame(all: { mode: ModeRow; obs: GameObs[] }[]): string[] {
  const out: string[] = [];
  const modes = all.filter(
    (x) => x.mode.label !== '1 season' && x.mode.label !== `Target ${fmt(balance.targetShort)}`,
  );
  out.push(
    'The long game (Phase I) — the last season, and whether the back of the table can still come back',
    '  mode            out@8 last  out@start last  last→top 3, from the start of season 3 / 4 / 5    leader overtaken   last wins the last season',
  );
  for (const { mode, obs } of modes) {
    let o8 = 0;
    let of8 = 0;
    let os = 0;
    let ofs = 0;
    const cb: { hit: number; n: number }[] = [3, 4, 5].map(() => ({ hit: 0, n: 0 }));
    let overtaken = 0;
    let withLast = 0;
    let bestSeason = 0;
    for (const o of obs) {
      const n = o.seasons;
      if (o.outAt8.length === n) {
        o8 += o.outAt8[n - 1]!.out;
        of8 += o.outAt8[n - 1]!.of;
      }
      const st = o.outAtStart[n - 1];
      if (st) {
        os += st.out;
        ofs += st.of;
      }
      [3, 4, 5].forEach((k, j) => {
        const start = o.start[k - 1];
        if (!start || k > n) return;
        const last = start.indexOf(Math.min(...start));
        cb[j]!.n++;
        if (o.finalOrder.indexOf(`p${last + 1}`) < 3) cb[j]!.hit++;
      });
      if (n >= 2) {
        const start = o.start[n - 1]!;
        withLast++;
        if (`p${start.indexOf(Math.max(...start)) + 1}` !== o.winner) overtaken++;
        // The poorest stable at the last season's start has that season's biggest gain.
        const gain = o.end[n - 1]!.map((w, i) => w - start[i]!);
        if (gain.indexOf(Math.max(...gain)) === start.indexOf(Math.min(...start))) bestSeason++;
      }
    }
    const cbCell = cb.map((c) => (c.n ? pct(c.hit / c.n) : '—').padStart(6)).join(' / ');
    out.push(
      `  ${mode.label.padEnd(15)} ${pct(o8 / Math.max(1, of8)).padStart(9)}  ${pct(os / Math.max(1, ofs)).padStart(13)}  ${cbCell.padStart(47)}    ${(withLast ? pct(overtaken / withLast) : '—').padStart(12)}   ${(withLast ? pct(bestSeason / withLast) : '—').padStart(20)}`,
    );
  }
  out.push(
    '  out@start last: E7 run at the last season’s first arrival, with that whole season’s first-place purses left.',
    '  last→top 3: the stable poorest at the start of season k finishes the game in the top 3 (3 of 6 by chance: 50%).',
    '  leader overtaken: the richest stable at the last season’s first arrival does not win.',
    '  last wins the last season: the poorest stable at that first arrival gains the most in it (1 in 6 by chance).',
    '',
  );

  // Where the richer half's extra comes from, seasons 2+ of 5-season games.
  const five = all.find((x) => x.mode.label === '5 seasons');
  if (!five) return out;
  type Key = 'prize' | 'cut' | 'trade' | 'bet' | 'food' | 'fines';
  const keys: Key[] = ['prize', 'cut', 'trade', 'bet', 'food', 'fines'];
  const halves = {
    top: [] as { l: Ledger; gain: number }[],
    bottom: [] as { l: Ledger; gain: number }[],
  };
  for (const o of five.obs)
    for (let k = 1; k < o.end.length; k++) {
      const start = o.start[k]!;
      const mid = median(start);
      start.forEach((w, i) =>
        (w >= mid ? halves.top : halves.bottom).push({
          l: o.ledger[k]![i]!,
          gain: o.end[k]![i]! - w,
        }),
      );
    }
  const m = (xs: { l: Ledger; gain: number }[], f: (x: { l: Ledger; gain: number }) => number) =>
    mean(xs.map(f));
  const line = (label: string, f: (x: { l: Ledger; gain: number }) => number, dp = 0) => {
    const a = m(halves.top, f);
    const b = m(halves.bottom, f);
    const show = (n: number) => (dp ? n.toFixed(dp) : fmt(n));
    out.push(
      `  ${label.padEnd(30)} ${show(a).padStart(9)} ${show(b).padStart(9)} ${show(a - b).padStart(9)}`,
    );
  };
  out.push(
    'Where the richer half’s extra comes from (5-season games, seasons 2–5, split at the median start worth)',
    `  ${''.padEnd(30)} ${'richer'.padStart(9)} ${'poorer'.padStart(9)} ${'diff'.padStart(9)}`,
  );
  line('worth gained in the season', (x) => x.gain);
  const names: Record<(typeof keys)[number], string> = {
    prize: 'purses, gross',
    cut: 'trainers’ cut (−)',
    trade: 'trading',
    bet: 'betting',
    food: 'food eaten (−)',
    fines: 'stewards’ fines (−)',
  };
  for (const k of keys) line(names[k], (x) => x.l[k]);
  line(
    'the rest (dogs, cargo, bills)',
    (x) => x.gain - (x.l.prize - x.l.cut + x.l.trade + x.l.bet - x.l.food - x.l.fines),
  );
  line('mean rating at declaration', (x) => (x.l.entries ? x.l.ratingSum / x.l.entries : 0), 1);
  line('races entered', (x) => x.l.entries, 1);
  line('cash at the season’s start', (x) => x.l.cash);
  line('trainers’ combined cut', (x) => x.l.cutRate * 100, 1);
  line('prize-money trainers', (x) => x.l.prizeUp, 2);
  return out;
}
