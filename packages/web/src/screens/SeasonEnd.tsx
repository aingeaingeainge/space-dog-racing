import { useState } from 'react';
import { formatBones, planetOf, type GameState, type Player, type RoadSplit } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Notes, StableName } from '../components/ui';
import { OwnerBlurb, OwnerFace } from '../components/Owner';
import { staffLine } from '../components/StaffCard';
import { NeonButton } from '../components/NeonButton';
import { WorthChart } from '../components/WorthChart';
import {
  gameMoments,
  gameRows,
  lastSeason,
  moments,
  seasonRows,
  targetFinish,
  type GameRow,
  type Moment,
  type SeasonRow,
  type TargetFinish,
} from '../lib/seasonEnd';
import { seasonLinkFor } from '../lib/seedLink';
import { playerById, standings } from '../lib/selectors';
import { useGame } from '../store/gameStore';
import { clock, summarisePace } from '../lib/pace';
import { buildReport, gameEndLine, gameLengthText } from '../lib/report';

/**
 * The end of a season, or of the game (GDD_V3 §10 screen 9). Between seasons the table reads how the
 * season went and then goes into the off-season; at the game's end it reads how the game went.
 */
export function SeasonEnd({ s }: { s: GameState }) {
  const rec = lastSeason(s);
  if (s.phase === 'offSeason' && rec) return <SeasonOver s={s} rows={seasonRows(s, rec)} />;
  return <GameOver s={s} />;
}

/**
 * Phase E2 — **the season's end, between seasons** (BUILD_PLAN_V3 Phase E item 5): the podium, where
 * the money came from, the net-worth chart and the moments, then on to the off-season. Everything is
 * read off the season's archive record, because the off-season has already aged the dogs and a worth
 * read off the live state would not be the figure the season ended on.
 */
function SeasonOver({ s, rows }: { s: GameState; rows: SeasonRow[] }) {
  const ackSeason = useGame((g) => g.ackSeason);
  const top = rows[0];
  const last = s.calendar[s.week - 1];
  // Phase I, GDD_V3 V23: the draft is public — the whole table reads who gets the breeder's pick.
  const draftedId = Object.entries(s.offSeason?.notices ?? {}).find(([, n]) => n.draft)?.[0];
  const drafted = s.players.find((p) => p.id === draftedId);
  return (
    <div className="app">
      <div className="centre">
        <h1>Season {s.season} over</h1>
        <p className="muted">
          {last ? `${planetOf(last.planetId).name}, week ${s.week}` : null} · {gameLengthText(s)}
        </p>
        {top ? (
          <p className="game-end">
            {top.player.name} tops season {s.season} on {formatBones(top.netWorth)}
            {top.goldCups ? ` · ${top.goldCups} Gold Cup${top.goldCups === 1 ? '' : 's'}` : ''}.
          </p>
        ) : null}
      </div>

      <div className="row centre">
        <NeonButton variant="primary" onClick={ackSeason}>
          On to season {s.season + 1}
        </NeonButton>
        <span className="muted">
          The off-season first: every dog a year older and back to full fitness, one retirement, the
          staff notice.
          {drafted ? (
            <>
              {' '}
              <b>Last at the table: {drafted.name} gets the breeder&apos;s pick</b>, a better dog
              than anybody else is offered.
            </>
          ) : null}
        </span>
      </div>

      <SeasonPodium rows={rows} />

      <IncomeSplit
        rows={rows.map((r) => ({
          player: r.player,
          split: r.split,
          commission: r.stats.commission,
        }))}
        sub={`season ${s.season}: where each stable's money came from`}
      />

      <Panel title="The season" sub="net worth, week by week">
        <WorthChart s={s} />
      </Panel>

      <Moments list={moments(s)} sub="what the season will be remembered for" />

      <Panel title={`Season ${s.season} standings`} tight>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Stable</th>
                <th className="num">Net worth</th>
                <th className="num">Gold Cups</th>
                <th className="num">Races won</th>
                <th>Trainers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player.id} className={r.player.kind === 'human' ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <StableName player={r.player} />
                  </td>
                  <td className="num">
                    <b>{formatBones(r.netWorth)}</b>
                  </td>
                  <td className="num">{r.goldCups}</td>
                  <td className="num">{r.raceWins}</td>
                  <td className="wrap small">{staffLine(r.player)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/** The top three, as they finished the season. */
function SeasonPodium({ rows }: { rows: SeasonRow[] }) {
  return (
    <Panel title="Podium" sub="highest net worth; tie-break Gold Cups, then races won">
      <div className="podium">
        {rows.slice(0, 3).map((r, i) => (
          <div key={r.player.id} className={i === 0 ? 'first' : undefined}>
            <div className="medal">{['🥇', '🥈', '🥉'][i]}</div>
            <OwnerFace player={r.player} big />
            <div>
              <StableName player={r.player} />
            </div>
            <OwnerBlurb player={r.player} />
            <div className="worth">{formatBones(r.netWorth)}</div>
            <div className="muted">
              {r.goldCups} Gold Cup{r.goldCups === 1 ? '' : 's'} · {r.raceWins} race
              {r.raceWins === 1 ? '' : 's'} won
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * GDD_V3 §11's income split, with the trainers' cut on its own line (Phase E2): purses before the cut,
 * the cut, trading, betting, and the food and bills that went out whatever a stable did.
 */
export function IncomeSplit({
  rows,
  sub,
}: {
  rows: { player: Player; split: RoadSplit; commission: number }[];
  sub: string;
}) {
  return (
    <Panel title="Where the money came from" sub={sub} tight>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stable</th>
              <th className="num">Prize money</th>
              <th className="num">Trainers' cut</th>
              <th className="num">Trading</th>
              <th className="num">Betting</th>
              <th className="num">Food &amp; bills</th>
              <th className="num">Ledger</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player.id} className={r.player.kind === 'human' ? 'me' : ''}>
                <td>
                  <StableName player={r.player} />
                </td>
                <td className="num">{formatBones(r.split.prize)}</td>
                <td className="num">{formatBones(-r.commission)}</td>
                <td className="num">{signed(r.split.trade)}</td>
                <td className="num">{signed(r.split.betting)}</td>
                <td className="num">{formatBones(-(r.split.costs - r.commission))}</td>
                <td className="num">
                  <b>{signed(r.split.net)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Prize money is what the purses paid, before the trainers took their cut. Trading is goods
        sold less goods bought; betting is returns less stakes. Food and bills are what went out
        whatever you were doing. The ledger is those columns — what is left over is in the dogs and
        the hold, which is why it does not match net worth.
      </p>
    </Panel>
  );
}

/**
 * Phase E2 — **the game's end** (BUILD_PLAN_V3 Phase E item 5; GDD §15.11 before it): the winner, big,
 * and why the game ended; the whole game's net worth across every season; its moments; a table of
 * seasons and the game's totals; how a Target was crossed; and "play again". Nothing here is a rule:
 * it reads the archive and the final state. A one-season game is its own season's end as well, so it
 * shows the season's podium and chart where a longer game shows its seasons.
 */
function GameOver({ s }: { s: GameState }) {
  const abandon = useGame((g) => g.abandon);
  const playAgain = useGame((g) => g.playAgain);
  const setup = useGame((g) => g.setup);
  // Online (v3l3, §2.6): Play again is the host's, and makes a new room the whole table follows.
  const online = useGame((g) => g.source === 'online');
  const host = useGame((g) => g.host);
  const hostName = useGame((g) => s.players.find((p) => p.id === g.meta?.host)?.name ?? 'the host');
  const rows = gameRows(s);
  const winner = rows[0];
  const multi = s.seasons.length > 1;
  const finish = targetFinish(s);
  const rec = lastSeason(s);

  return (
    <div className="app">
      <div className="centre">
        <h1>Game over</h1>
        {winner ? (
          <div className="winner">
            <OwnerFace player={winner.player} big />
            <div className="winner-name">
              <StableName player={winner.player} />
            </div>
            <div className="worth">{formatBones(winner.netWorth)}</div>
          </div>
        ) : null}
        {s.gameOver ? <p className="game-end">{gameEndLine(s)}</p> : null}
        <p className="muted">{gameLengthText(s)}</p>
      </div>

      <PaceLine />

      {finish ? <TargetPanel s={s} finish={finish} /> : null}

      {multi ? null : rec ? <SeasonPodium rows={seasonRows(s, rec)} /> : null}

      <Panel
        title={multi ? 'The game' : 'The season'}
        sub={multi ? 'net worth, weekend by weekend, every season' : 'net worth, week by week'}
      >
        <WorthChart s={s} game={multi} />
      </Panel>

      <Moments
        list={gameMoments(s)}
        sub={
          multi ? 'what the game will be remembered for' : 'what the season will be remembered for'
        }
      />

      {multi ? <SeasonsTable s={s} rows={rows} /> : null}

      <IncomeSplit
        rows={rows}
        sub={
          multi
            ? "the whole game: where each stable's money came from"
            : "where each stable's money came from"
        }
      />

      <FinalStandings s={s} rows={rows} />

      <Panel title="Again" sub={`seed ${s.seed}`}>
        <div className="row">
          {!online || host ? (
            <NeonButton variant="primary" onClick={playAgain}>
              Play again
            </NeonButton>
          ) : null}
          <NeonButton onClick={abandon}>{online ? 'Leave the room' : 'New game'}</NeonButton>
          {setup ? <ShareSeed setup={setup} /> : null}
          {setup ? <CopyReport s={s} setup={setup} /> : null}
        </div>
        {online ? (
          <p className="muted">
            {host
              ? 'Play again opens a new room with the same seats, the same seed and the same length, and everybody here follows you into it.'
              : `If ${hostName} presses Play again, this browser follows into the new room: the same seats, the same seed and the same length.`}
          </p>
        ) : null}
        <p className="muted">
          Play again is the same table, the same seed and the same length, from the first weekend:
          the same dogs on offer, the same events, the same trap draws. What you do with them is up
          to you. <b>Copy the report</b> for the playtest: the link, the table, the result, the
          clock and each season&apos;s draft, as plain text to paste into the next Cowork session.
        </p>
      </Panel>
    </div>
  );
}

/**
 * Phase E2's pace timer, read back (the playtest's 🎲 rows): how long the game took at the table, a
 * weekend's share, and how much of that was race day. Nothing is shown for a game with no clock.
 */
function PaceLine() {
  const pace = useGame((g) => g.pace);
  const p = summarisePace(pace);
  if (!p.weekends) return null;
  const minutes = Math.round(p.total / 60);
  return (
    <Panel title="The clock" sub="wall-clock time at the table, from the pace timer">
      <p className="flush">
        This game took{' '}
        <b>
          {minutes} minute{minutes === 1 ? '' : 's'}
        </b>
        , <b>{clock(p.perWeekend)}</b> a weekend, of which race day <b>{clock(p.raceDay)}</b>.
      </p>
      <p className="muted">
        A weekend: {clock(p.private)} on private screens · {clock(p.raceDay)} on race day ·{' '}
        {clock(p.pass)} passing the laptop · {clock(p.table)} on the table's own screens (arrival,
        board, after the races), over {p.weekends} weekend{p.weekends === 1 ? '' : 's'}
        {p.between ? `; ${clock(p.between)} between seasons` : ''}. A stretch on one screen counts
        for ten minutes at most, and the clock stops while the window is hidden.
      </p>
    </Panel>
  );
}

/** Who topped each season, and the game's totals (Gold Cups and races won are `gameTotal`s). */
function SeasonsTable({ s, rows }: { s: GameState; rows: GameRow[] }) {
  return (
    <Panel title="Season by season" tight>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th className="num">Weekends</th>
              <th>Topped by</th>
              <th className="num">Worth</th>
              <th>Runner-up</th>
            </tr>
          </thead>
          <tbody>
            {s.seasons.map((r) => {
              const top = r.standings[0];
              const second = r.standings[1];
              return (
                <tr key={r.season}>
                  <td>{r.season}</td>
                  <td className="num">{r.weeks}</td>
                  <td>{top ? playerById(s, top.playerId)?.name : '—'}</td>
                  <td className="num">{top ? formatBones(top.netWorth) : '—'}</td>
                  <td className="muted">
                    {second
                      ? `${playerById(s, second.playerId)?.name} ${formatBones(second.netWorth)}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stable</th>
              <th className="num">Seasons topped</th>
              <th className="num">Gold Cups</th>
              <th className="num">Races won</th>
              <th className="num">Final worth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player.id} className={r.player.kind === 'human' ? 'me' : ''}>
                <td>
                  <StableName player={r.player} />
                </td>
                <td className="num">{r.titles}</td>
                <td className="num">{r.goldCups}</td>
                <td className="num">{r.raceWins}</td>
                <td className="num">
                  <b>{formatBones(r.netWorth)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** GDD_V3 §2.1, E3: how the race to the figure finished. */
function TargetPanel({ s, finish }: { s: GameState; finish: TargetFinish }) {
  const target = s.length.kind === 'target' ? s.length.worth : 0;
  const names = finish.crossers.map((p) => p.name).join(' and ');
  const lines = [
    `${names} crossed ${formatBones(target)} at week ${finish.week} of season ${finish.season} — weekend ${finish.weekend} of the game.`,
    finish.together
      ? 'Two crossed on the same weekend, so the richer of them took it.'
      : 'Nobody else got there that weekend.',
    finish.caught
      ? `${finish.caught.name} led into that last weekend and was caught on it.`
      : 'The stable that led into the last weekend held on.',
  ];
  return (
    <Panel title="The finish" sub="net worth is checked at the end of every weekend">
      <Notes lines={lines} />
    </Panel>
  );
}

/** The final table, as the game ended: what every stable holds, and what it is worth. */
function FinalStandings({ s, rows }: { s: GameState; rows: GameRow[] }) {
  const live = new Map(standings(s).map((r) => [r.player.id, r]));
  return (
    <Panel title="Final standings" tight>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Stable</th>
              <th className="num">Cash</th>
              <th className="num">Dogs</th>
              <th className="num">Cargo</th>
              <th className="num">Net worth</th>
              <th className="num">Gold Cups</th>
              <th>Trainers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const l = live.get(r.player.id);
              return (
                <tr key={r.player.id} className={r.player.kind === 'human' ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <StableName player={r.player} />
                  </td>
                  <td className="num">{l ? formatBones(l.cash) : '—'}</td>
                  <td className="num">{l ? formatBones(l.dogs) : '—'}</td>
                  <td className="num">{l ? formatBones(l.cargo) : '—'}</td>
                  <td className="num">
                    <b>{formatBones(r.netWorth)}</b>
                  </td>
                  <td className="num">{r.goldCups}</td>
                  <td className="wrap small">{staffLine(r.player)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** A figure that can go either way reads better with its sign on the front. */
function signed(n: number): string {
  return n > 0 ? `+${formatBones(n)}` : formatBones(n);
}

function Moments({ list, sub }: { list: Moment[]; sub: string }) {
  if (!list.length) return null;
  return (
    <Panel title="Moments" sub={sub}>
      <dl className="moments">
        {list.map((m) => (
          <div key={m.key}>
            <dt>{m.label}</dt>
            <dd>
              <b>{m.headline}</b>
              {m.detail ? <span className="muted">{m.detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/**
 * A link that opens the New Season screen with this seed and this table filled in. It does not
 * start anybody's season for them, and it carries the toggles because without them the same seed
 * does not replay the same way.
 */
function ShareSeed({ setup }: { setup: Parameters<typeof seasonLinkFor>[0] }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const link = seasonLinkFor(setup, window.location.href);

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => setState('copied'),
      () => setState('shown'),
    );
    if (!navigator.clipboard) setState('shown');
  };

  return (
    <>
      <NeonButton
        onClick={copy}
        title="A link that fills this seed and table into the New Season screen"
      >
        {state === 'copied' ? 'Link copied' : 'Copy a link to this season'}
      </NeonButton>
      {state === 'shown' ? (
        <input
          className="seed-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </>
  );
}

/**
 * Phase J — **"Copy the report"**: the game as plain text (lib/report.ts), for the playtest evening.
 * A copy that cannot reach the clipboard — no permission, no secure context, an old browser — falls
 * back to a selectable text box, and nothing here ever throws.
 */
function CopyReport({ s, setup }: { s: GameState; setup: Parameters<typeof seasonLinkFor>[0] }) {
  const log = useGame((g) => g.log);
  const pace = useGame((g) => g.pace);
  // Online (§5.3): the seats a stand-in played, for the report's one extra line. Hotseat: none.
  const standInWeekends = useGame((g) => (g.source === 'online' ? g.meta?.standInWeekends : null));
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const [text, setText] = useState('');

  const copy = () => {
    let report = '';
    try {
      report = buildReport({
        s,
        setup,
        log,
        pace,
        base: window.location.href,
        build: typeof __SDR_BUILD__ === 'string' ? __SDR_BUILD__ : 'unknown',
        copiedAt: new Date().toLocaleString(),
        ...(standInWeekends
          ? {
              standIns: Object.entries(standInWeekends).map(([id, weekends]) => ({
                name: s.players.find((p) => p.id === id)?.name ?? id,
                weekends,
              })),
            }
          : {}),
      });
    } catch (e) {
      report = `The report could not be built: ${(e as Error).message}`;
    }
    setText(report);
    try {
      const done = navigator.clipboard?.writeText(report);
      if (!done) setState('shown');
      else
        done.then(
          () => setState('copied'),
          () => setState('shown'),
        );
    } catch {
      setState('shown');
    }
  };

  return (
    <>
      <NeonButton
        onClick={copy}
        title="The game as plain text: the link, the table, the result, the clock, each season's draft"
      >
        {state === 'copied' ? 'Report copied' : 'Copy the report'}
      </NeonButton>
      {state === 'shown' ? (
        <div className="report-box">
          <p className="muted">The clipboard said no. Select the text below and copy it by hand.</p>
          <textarea
            className="report-text"
            readOnly
            rows={16}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
    </>
  );
}
