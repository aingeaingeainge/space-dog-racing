import { useState } from 'react';
import {
  formatBones,
  planetOf,
  roadSplit,
  type GameState,
  type Player,
  type RoadSplit,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { StableName } from '../components/ui';
import { OwnerBlurb, OwnerFace } from '../components/Owner';
import { staffLine } from '../components/StaffCard';
import { NeonButton } from '../components/NeonButton';
import { WorthChart } from '../components/WorthChart';
import { lastSeason, moments, seasonRows, type SeasonRow } from '../lib/seasonEnd';
import { seasonLinkFor } from '../lib/seedLink';
import { standings } from '../lib/selectors';
import { useGame } from '../store/gameStore';

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

      <Moments s={s} />

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

/** The game's end, and the end of a one-season game. */
function GameOver({ s }: { s: GameState }) {
  const abandon = useGame((g) => g.abandon);
  const playAgain = useGame((g) => g.playAgain);
  const setup = useGame((g) => g.setup);
  const ackSeason = useGame((g) => g.ackSeason);
  const rows = standings(s);
  const podium = rows.slice(0, 3);
  const final = s.calendar[s.week - 1];
  // Between seasons (GDD_V3 §2.2) this is the season's end, and the game goes on.
  const between = s.phase === 'offSeason';
  const multi = s.length.kind === 'target' || s.length.seasons > 1;

  return (
    <div className="app">
      <div className="centre">
        <h1>{between || (multi && !s.gameOver) ? `Season ${s.season} over` : 'Game over'}</h1>
        <p className="muted">
          {final ? `${planetOf(final.planetId).name}, week ${s.week}` : null}
          {multi ? ` · ${gameLengthText(s)}` : null}
        </p>
        {s.gameOver ? <p className="game-end">{gameEndLine(s)}</p> : null}
      </div>

      {between ? (
        <div className="row centre">
          <NeonButton variant="primary" onClick={ackSeason}>
            On to season {s.season + 1}
          </NeonButton>
          <span className="muted">
            The off-season first: a year older, one retirement, the staff notice.
          </span>
        </div>
      ) : null}

      <Panel title="Podium" sub="highest net worth wins; tie-break most Gold Cup wins">
        <div className="podium">
          {podium.map((r, i) => (
            <div key={r.player.id} className={i === 0 ? 'first' : undefined}>
              <div className="medal">{['🥇', '🥈', '🥉'][i]}</div>
              <OwnerFace player={r.player} big />
              <div>
                <StableName player={r.player} />
              </div>
              <OwnerBlurb player={r.player} />
              <div className="worth">{formatBones(r.netWorth)}</div>
              <div className="muted">{r.goldCupWins} Gold Cup wins</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="The season" sub="net worth, week by week">
        <WorthChart s={s} />
      </Panel>

      <Moments s={s} />

      <RoadsWalked s={s} />

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
                <th className="num">Open</th>
                <th className="num">Prize money</th>
                <th className="num">Trainers took</th>
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
                  <td className="num">{formatBones(r.cash)}</td>
                  <td className="num">{formatBones(r.dogs)}</td>
                  <td className="num">{formatBones(r.cargo)}</td>
                  <td className="num">
                    <b>{formatBones(r.netWorth)}</b>
                  </td>
                  <td className="num">{r.goldCupWins}</td>
                  <td className="num">{formatBones(r.player.stats.prizeIncome)}</td>
                  <td className="num">{formatBones(r.player.stats.commission)}</td>
                  <td className="wrap small">{staffLine(r.player)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {between ? null : (
        <Panel title="Again" sub={`seed ${s.seed}`}>
          <div className="row">
            <NeonButton variant="primary" onClick={playAgain}>
              Play this season again
            </NeonButton>
            <NeonButton onClick={abandon}>New season</NeonButton>
            {setup ? <ShareSeed setup={setup} /> : null}
          </div>
          <p className="muted">
            The same seed and the same table replays the same weekends — the dogs on offer, the
            events, the trap draws. What you do with them is up to you.
          </p>
        </Panel>
      )}
    </div>
  );
}

/** The game's length in a phrase (GDD_V3 §2.1). */
function gameLengthText(s: GameState): string {
  if (s.length.kind === 'seasons') return `season ${s.season} of ${s.length.seasons}`;
  return `season ${s.season}, racing to ${formatBones(s.length.worth)}`;
}

/**
 * The plain game-end line (Phase E1): who won, and in a Target game who crossed. The real game-end
 * screen is Phase E2's.
 */
function gameEndLine(s: GameState): string {
  const over = s.gameOver!;
  const top = s.finalStandings?.[0];
  const winner = s.players.find((p) => p.id === top?.playerId);
  const wins = winner && top ? `${winner.name} wins with ${formatBones(top.netWorth)}.` : '';
  if (over.reason === 'target') {
    const crossers = over.crossers
      .map((id) => s.players.find((p) => p.id === id)?.name ?? id)
      .join(' and ');
    const onTheLine = top && !over.crossers.includes(top.playerId) ? ' Overtaken on the line!' : '';
    return `${crossers} crossed the target at week ${over.week} of season ${over.season}. ${wins}${onTheLine}`;
  }
  if (over.reason === 'cap') return `Nobody reached the target in ${over.season} seasons. ${wins}`;
  return over.season > 1 ? `After ${over.season} seasons, ${wins}` : wins;
}

/**
 * Which road every stable actually walked, in Bones (GDD §2.1).
 *
 * ⚠️ **This is the only screen in the game that can tell a player what they *did*.** An hour of
 * small decisions does not add up to a sentence on its own: a stable that believes it played the
 * trainer's road and reads five thousand of trade profit has learnt something about itself, and a
 * crook who spent more on fixers than the betting ever returned has learnt something sharper. The
 * three income lines have been on `Player.stats` since M0 and the harness has printed exactly this
 * split for `--roads` since Phase D; `roadSplit` in the engine is the one arithmetic both read, so
 * the screen and the instrument cannot disagree about what a road earned.
 *
 * ⚠️ **The columns do not add up to net worth and the caption says so.** Two of the roads pay in
 * *assets* rather than income — a trained dog's book value, a bought hold — so this table answers
 * "where did the money come from" while the standings below answer "what is it worth now".
 * Pretending otherwise would be a nicer table and a worse instrument.
 */
function RoadsWalked({ s }: { s: GameState }) {
  const rows = standings(s).map((r) => ({ ...r, split: roadSplit(s, r.player) }));
  return (
    <Panel
      title="The roads walked"
      sub="where each stable's money came from — assets bought are not in here"
      tight
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stable</th>
              <th className="num">Prize money</th>
              <th className="num">Trading</th>
              <th className="num">Betting</th>
              <th className="num">Costs</th>
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
                <td className="num">{signed(r.split.trade)}</td>
                <td className="num">{signed(r.split.betting)}</td>
                <td className="num">{formatBones(-r.split.costs)}</td>
                <td className="num">
                  <b>{signed(r.split.net)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Prize money is what the purses paid, trading is goods sold less goods bought, betting is
        returns less stakes. Costs are the food that went out whatever you were doing — there is no
        upkeep, no wages and no fuel any more. The ledger is those columns; what is left over is in
        the dogs and the hold, which is why it does not match the net worth below.
      </p>
    </Panel>
  );
}

/** A figure that can go either way reads better with its sign on the front. */
function signed(n: number): string {
  return n > 0 ? `+${formatBones(n)}` : formatBones(n);
}

function Moments({ s }: { s: GameState }) {
  const list = moments(s);
  if (!list.length) return null;
  return (
    <Panel title="Moments" sub="what the season will be remembered for">
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
