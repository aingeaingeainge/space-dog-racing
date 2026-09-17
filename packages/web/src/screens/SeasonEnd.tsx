import { useState } from 'react';
import { formatBones, planetOf, roadSplit, type GameState } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { StableName } from '../components/ui';
import { OwnerBlurb, OwnerFace } from '../components/Owner';
import { NeonButton } from '../components/NeonButton';
import { WorthChart } from '../components/WorthChart';
import { moments } from '../lib/seasonEnd';
import { seasonLinkFor } from '../lib/seedLink';
import { standings } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §15.11 — the podium, the worth chart, the moments and the full table. This is the last
 * screen of an hour of play, so it is the one place in the game that is allowed to simply be
 * worth looking at.
 */
export function SeasonEnd({ s }: { s: GameState }) {
  const abandon = useGame((g) => g.abandon);
  const playAgain = useGame((g) => g.playAgain);
  const setup = useGame((g) => g.setup);
  const rows = standings(s);
  const podium = rows.slice(0, 3);
  const final = s.calendar[s.calendar.length - 1];

  return (
    <div className="app">
      <div className="centre">
        <h1>Season over</h1>
        <p className="muted">
          {final ? `${planetOf(final.planetId).name} — the Galactic Collar` : null}
        </p>
      </div>

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Again" sub={`seed ${s.seed}`}>
        <div className="row">
          <NeonButton variant="primary" onClick={playAgain}>
            Play this season again
          </NeonButton>
          <NeonButton onClick={abandon}>New season</NeonButton>
          {setup ? <ShareSeed setup={setup} /> : null}
        </div>
        <p className="muted">
          The same seed and the same table replays the same thirteen weekends — the dogs on offer,
          the events, the trap draws. What you do with them is up to you.
        </p>
      </Panel>
    </div>
  );
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
