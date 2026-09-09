import { useState } from 'react';
import { formatBones, planetOf, type GameState } from '@sdr/engine';
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

      <Panel title="Podium" sub="highest net worth wins; tie-break most Gold wins">
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
              <div className="muted">{r.goldWins} Gold wins</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="The season" sub="net worth, week by week">
        <WorthChart s={s} />
      </Panel>

      <Moments s={s} />

      <Panel title="Final standings" tight>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Stable</th>
                <th className="num">Cash</th>
                <th className="num">Dogs</th>
                <th className="num">Ship</th>
                <th className="num">Cargo</th>
                <th className="num">Debt</th>
                <th className="num">Net worth</th>
                <th className="num">Gold</th>
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
                  <td className="num">{formatBones(r.ship)}</td>
                  <td className="num">{formatBones(r.cargo)}</td>
                  <td className="num">{r.debt ? formatBones(-r.debt) : '—'}</td>
                  <td className="num">
                    <b>{formatBones(r.netWorth)}</b>
                  </td>
                  <td className="num">{r.goldWins}</td>
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
      <NeonButton onClick={copy} title="A link that fills this seed and table into the New Season screen">
        {state === 'copied' ? 'Link copied' : 'Copy a link to this season'}
      </NeonButton>
      {state === 'shown' ? <input className="seed-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /> : null}
    </>
  );
}
