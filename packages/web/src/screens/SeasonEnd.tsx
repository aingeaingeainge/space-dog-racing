import { formatBones, planetOf, type GameState } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { StableName } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { standings } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/** GDD §15.11 — podium and the full table. The worth chart and "moments" are M4. */
export function SeasonEnd({ s }: { s: GameState }) {
  const abandon = useGame((g) => g.abandon);
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
              <div>
                <StableName player={r.player} />
              </div>
              <div className="worth">{formatBones(r.netWorth)}</div>
              <div className="muted">{r.goldWins} Gold wins</div>
            </div>
          ))}
        </div>
      </Panel>

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

      <div className="row">
        <NeonButton variant="primary" onClick={abandon}>
          New season
        </NeonButton>
      </div>
    </div>
  );
}
