import { planetOf, type GameState } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge } from '../components/ui';
import { specialText, trackText } from '../lib/planetText';

/** GDD §15.2 as a list — the whole circuit is visible from week 1 so players can plan. */
export function GalaxyMap({ s }: { s: GameState }) {
  return (
    <Panel
      title="Galaxy map"
      sub="the 13-stop circuit; Majors starred, the Grand Final at Collar Prime"
      tight
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Wk</th>
              <th>Planet</th>
              <th>Track</th>
              <th>Food</th>
              <th>Market</th>
              <th>Rules</th>
            </tr>
          </thead>
          <tbody>
            {s.calendar.map((e) => {
              const p = planetOf(e.planetId);
              const past = e.week < s.week;
              const now = e.week === s.week;
              return (
                <tr key={e.week} className={now ? 'me' : past ? 'dim' : ''}>
                  <td>
                    {e.week}
                    {e.grandFinal ? (
                      <span className="star" title="Grand Final">
                        {' '}
                        ★★
                      </span>
                    ) : e.major ? (
                      <span className="star" title="Major">
                        {' '}
                        ★
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <b>{p.name}</b>
                    {e.major ? <div className="muted">{p.event}</div> : null}
                  </td>
                  <td>{trackText(p.track)}</td>
                  <td className="num">
                    {p.foodBand[0]}–{p.foodBand[1]}
                  </td>
                  <td className="muted wrap">{p.marketBias}</td>
                  <td className="wrap rules">
                    {specialText(p).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
