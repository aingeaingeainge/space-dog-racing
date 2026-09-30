import {
  AI_STABLE_NAMES,
  formatBones,
  staffRow,
  STYLE_BY_ID,
  type Action,
  type DraftPickRecord,
  type GameState,
  type Id,
  type Player,
  type SeasonSetup,
} from '@sdr/engine';
import { aiOwnerIndices, HUMAN_FACES } from './faces';
import { clock, summarisePace, type Pace } from './pace';
import { gameRows } from './seasonEnd';
import { seasonLinkFor } from './seedLink';

/**
 * Phase J — **"Copy the report"**: the game's end as plain text, for Jesse to paste into the next
 * Cowork session, so each game at the playtest evening comes back as a record rather than from memory.
 *
 * Plain text only, no markdown tables: it has to survive a phone's clipboard and a chat box. It reads
 * the final state, the setup, the action log and the pace timer, and nothing else; nothing new is
 * stored for it. It never needs the date to make sense — the date is on the last line, as a label.
 */
export interface ReportInput {
  s: GameState;
  setup: SeasonSetup;
  log: readonly Action[];
  pace: Pace;
  /** Where the game is served from, for the seed link. */
  base: string;
  /** `__SDR_BUILD__`, or whatever the caller knows. */
  build: string;
  /** When the report was copied, already formatted. Optional, and only ever a label. */
  copiedAt?: string;
  /**
   * Online only (ONLINE_PLAN §5.3, V26): the seats a stand-in played, from the room's
   * `meta.standInWeekends`. Absent or empty, the report reads exactly as a hotseat one.
   */
  standIns?: readonly { name: string; weekends: number }[];
}

/** "Aroha's seat was played by an AI for 3 weekends." */
export function standInLine(name: string, weekends: number): string {
  return `${name}'s seat was played by an AI for ${weekends} weekend${weekends === 1 ? '' : 's'}.`;
}

const DIFFICULTY: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

/** The game's length in a phrase (GDD_V3 §2.1). */
export function gameLengthText(s: GameState): string {
  if (s.length.kind === 'seasons') return `season ${s.season} of ${s.length.seasons}`;
  return `season ${s.season}, racing to ${formatBones(s.length.worth)}`;
}

/** The length the table chose, for the report's header: "2 seasons", "race to 60,000 Bones". */
function lengthChosen(s: GameState): string {
  if (s.length.kind === 'seasons')
    return `${s.length.seasons} season${s.length.seasons === 1 ? '' : 's'}`;
  return `race to ${formatBones(s.length.worth)}`;
}

/**
 * Why the game ended, in a line (GDD_V3 §2.1): the seasons ran out, a target was crossed, or a Target
 * game hit the season cap. ⚠️ E1's line could say "Overtaken on the line!", which cannot happen with one
 * worth check a weekend (E3); the finish panel says what can — two crossing together, a leader caught.
 */
export function gameEndLine(s: GameState): string {
  const over = s.gameOver!;
  const top = s.finalStandings?.[0];
  const winner = s.players.find((p) => p.id === top?.playerId);
  const wins = winner && top ? `${winner.name} wins with ${formatBones(top.netWorth)}.` : '';
  if (over.reason === 'target') {
    const crossers = over.crossers
      .map((id) => s.players.find((p) => p.id === id)?.name ?? id)
      .join(' and ');
    const target = s.length.kind === 'target' ? formatBones(s.length.worth) : 'the target';
    return `Target crossed: ${crossers} passed ${target} at week ${over.week} of season ${over.season}. ${wins}`;
  }
  if (over.reason === 'cap')
    return `The season cap: nobody reached the target in ${over.season} seasons. ${wins}`;
  return over.season > 1 ? `The seasons ran out: after ${over.season}, ${wins}` : wins;
}

function togglesText(s: GameState): string {
  const on: string[] = [];
  if (!s.toggles.betting) on.push('No Betting');
  if (!s.toggles.trading) on.push('No Trading');
  if (s.toggles.casualEvents) on.push('Casual events');
  return on.length ? on.join(', ') : 'none (the defaults)';
}

/** "human, face Pink (glamorous old hand)" or "AI, Hard, its own painted owner". */
function whoText(p: Player, owner: number | null): string {
  if (p.kind === 'human') {
    const f = HUMAN_FACES[p.colour % 8]!;
    return `human, face ${f.colour} (${f.who})`;
  }
  const d = DIFFICULTY[p.difficulty ?? 'normal'] ?? 'Normal';
  if (owner === null) return `AI, ${d}`;
  const listed = AI_STABLE_NAMES[owner];
  return listed === p.name
    ? `AI, ${d}, its own painted owner`
    : `AI, ${d}, renamed, wearing ${listed ?? `owner ${owner + 1}`}'s face`;
}

/** One pick, in the report's words: "Grumpy Backlash (58, closer)", "Vell (trainer)", "passed". */
function pickText(x: DraftPickRecord): string {
  if (x.dog)
    return `${x.dog.name} (${x.dog.rating}, ${STYLE_BY_ID[x.dog.style].name.toLowerCase()})`;
  if (x.staff) return `${staffRow(x.staff).name} (trainer)`;
  return 'passed';
}

export function buildReport(r: ReportInput): string {
  const { s, setup, pace } = r;
  const name = (id: Id | undefined) => s.players.find((p) => p.id === id)?.name ?? '—';
  const owners = aiOwnerIndices(s.players, AI_STABLE_NAMES);
  const rows = gameRows(s);
  const out: string[] = [];
  const hr = '';

  out.push('SPACE DOG RACING — GAME REPORT');
  out.push(`Build: ${r.build}`);
  out.push(`Link: ${seasonLinkFor(setup, r.base)}`);
  // Phase M: the link carries the names the table gave its AIs (`names=`), so it replays this
  // game and the note that said it would not is gone.
  out.push(
    `Seed ${s.seed} · ${lengthChosen(s)} · ${s.players.length} stables, ` +
      `${s.players.filter((p) => p.kind === 'human').length} human · toggles: ${togglesText(s)}`,
  );
  out.push(hr);

  out.push('THE TABLE (seat order)');
  s.players.forEach((p, i) => out.push(`${i + 1}. ${p.name} — ${whoText(p, owners[i] ?? null)}`));
  for (const x of r.standIns ?? []) if (x.weekends > 0) out.push(standInLine(x.name, x.weekends));
  out.push(hr);

  // Phase N (V29): the opening draft — round 1's order, then each stable's picks in order.
  const opening = s.drafts[0];
  if (opening) {
    out.push('THE DRAFT');
    const round1 = opening.order.slice(0, s.players.length);
    out.push(`Round 1's order (drawn): ${round1.map((id) => name(id)).join(', ')}`);
    for (const id of round1)
      out.push(
        `${name(id)}: ${opening.picks
          .filter((x) => x.playerId === id)
          .map(pickText)
          .join(' · ')}`,
      );
    out.push(hr);
  }

  out.push('THE RESULT');
  const winner = rows[0];
  if (winner) out.push(`Winner: ${winner.player.name}, ${formatBones(winner.netWorth)}`);
  if (s.gameOver) out.push(`How it ended: ${gameEndLine(s).trim()}`);
  out.push('Final standings:');
  rows.forEach((row, i) =>
    out.push(
      `${i + 1}. ${row.player.name} (${row.player.kind === 'human' ? 'human' : (DIFFICULTY[row.player.difficulty ?? 'normal'] ?? 'AI')}) — ` +
        `${formatBones(row.netWorth)} · ${row.goldCups} Gold Cup${row.goldCups === 1 ? '' : 's'} · ` +
        `${row.raceWins} race${row.raceWins === 1 ? '' : 's'} won · ` +
        `prize ${formatBones(row.split.prize)}, trade ${formatBones(row.split.trade)}, betting ${formatBones(row.split.betting)}`,
    ),
  );
  out.push(hr);

  out.push('THE CLOCK');
  const p = summarisePace(pace);
  if (!p.weekends) {
    out.push('No clock: this game was not timed (nothing was recorded on this device).');
  } else {
    const minutes = Math.round(p.total / 60);
    out.push(
      `This game took ${minutes} minute${minutes === 1 ? '' : 's'}, ${clock(p.perWeekend)} a weekend, of which race day ${clock(p.raceDay)}.`,
    );
    out.push(
      `A weekend: ${clock(p.private)} on private screens · ${clock(p.raceDay)} on race day · ` +
        `${clock(p.pass)} passing the laptop · ${clock(p.table)} on the table's own screens ` +
        `(arrival, board, after the races), over ${p.weekends} weekend${p.weekends === 1 ? '' : 's'}` +
        `${p.between ? `; ${clock(p.between)} between seasons` : ''}.`,
    );
    // Per season, for the long game's "time per season" row (a weekend key is 100 × (season − 1) + week).
    const bySeason = new Map<number, number>();
    for (const w of pace.weekends) {
      const season = Math.floor(w.key / 100) + 1;
      bySeason.set(season, (bySeason.get(season) ?? 0) + w.private + w.raceDay + w.pass + w.table);
    }
    if (bySeason.size > 1)
      out.push(
        'By season: ' +
          [...bySeason.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([season, sec]) => `season ${season} ${Math.round(sec / 60)} min`)
            .join(' · ') +
          ' (weekends only).',
      );
  }
  out.push(hr);

  out.push('SEASON BY SEASON');
  s.seasons.forEach((rec) => {
    const top = rec.standings[0];
    const line = [
      `Season ${rec.season} (${rec.weeks} weekend${rec.weeks === 1 ? '' : 's'}): top ${name(top?.playerId)} ${top ? formatBones(top.netWorth) : ''}`.trim(),
    ];
    // Phase N (V32): the off-season after a season is one draft pick each, last on the standings
    // first. The last season has no off-season after it.
    const draft = s.drafts.find((d) => d.kind === 'offSeason' && d.season === rec.season + 1);
    if (draft)
      line.push(
        'the off-season draft: ' +
          draft.picks
            .map((x) => {
              const gone = x.released?.dog
                ? `, retired ${x.released.dog.name}`
                : x.released?.staff
                  ? `, let ${staffRow(x.released.staff).name} go`
                  : '';
              return `${name(x.playerId)} ${pickText(x)}${gone}`;
            })
            .join('; '),
      );
    else line.push('no draft (no off-season after it)');
    out.push(line.join(' · '));
  });
  out.push(hr);
  out.push(`Copied from the game's end${r.copiedAt ? `, ${r.copiedAt}` : ''}.`);
  return out.join('\n');
}
