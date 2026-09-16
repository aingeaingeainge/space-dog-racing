import { planetOf, type GameState, type Player } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Notes } from '../components/ui';
import { specialText, trackText } from '../lib/planetText';
import { fogLevel, raceLabel, type FogLevel } from '../lib/selectors';
import { rumours } from '../lib/rumours';

/**
 * GDD §15.2 — ⚠️ **a fog, and nothing to buy through it.** This planet in full; next week's name and
 * Major star; the rest of the route as unknown stops.
 *
 * The dossier is deleted (BUILD_PLAN_V3 §2.1). GDD_V3 §2.1 keeps the fog and makes it matter more
 * than it ever did — it is now the *only* thing information is for — and §9.4 moves the buying of it
 * into Bar events and staff bonuses in Phase D, with exactly one use: knowing whether next week's
 * planet buys your food high.
 *
 * The v1 file's own comment read "the whole circuit is visible from week 1 so players can plan",
 * and that line is what D5 deletes. Pillar 2 is "you play the hand you're dealt": the season's
 * texture is meant to come from what you are offered, not from a route you optimised in week 1.
 * And §9.2 is the reason this does not hurt the trader — it *creates* the trader's road. Carrying
 * kibble blind loses 9.5 a unit; carrying it to a planet you know earns 23.6 on the legs worth
 * acting on, so the moment the map goes dark, knowing where you are going becomes worth money.
 */
export function GalaxyMap({ s }: { s: GameState; me: Player }) {
  const gossip = rumours(s);

  return (
    <>
      <Panel
        title="Galaxy map"
        sub="where you are, where you are going next, and nothing beyond that"
      >
        <Notes
          lines={[
            'The circuit is drawn fresh every season and the stewards do not publish it. You know this planet in full and next week by name, and the rest is rumour.',
            'The Majors are the exception: weeks 4, 7, 10 and 13 always, and the Grand Final always at Collar Prime. The rhythm is fixed even when the content is not.',
            gossip.length
              ? `They are saying: ${gossip.map((r) => r.text).join(' ')}`
              : 'Nobody in the Saloon has anything worth repeating this week.',
          ]}
        />
      </Panel>

      <Panel title="The circuit" sub="13 stops, Majors starred" tight>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Wk</th>
                <th>Planet</th>
                <th>Track</th>
                <th>Food</th>
                <th>Card</th>
                <th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {s.calendar.map((e) => {
                const level = fogLevel(s, e.week);
                const p = planetOf(e.planetId);
                const rowClass =
                  level === 'here'
                    ? 'me'
                    : level === 'past'
                      ? 'dim'
                      : level === 'dark'
                        ? 'fog'
                        : '';
                return (
                  <tr key={e.week} className={rowClass}>
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
                    {level === 'dark' ? (
                      <td className="muted" colSpan={5}>
                        {e.major
                          ? 'A Major, venue not yet announced'
                          : 'An unknown stop — buy the file, or wait and see'}
                      </td>
                    ) : (
                      <>
                        <td>
                          <b>{p.name}</b>
                          {e.major ? <div className="muted">{p.event}</div> : null}
                        </td>
                        <td>
                          {detailed(level) ? trackText(p.track) : <span className="muted">—</span>}
                        </td>
                        <td className="num">
                          {detailed(level) ? (
                            `${p.foodBand[0]}–${p.foodBand[1]}`
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="muted wrap">
                          {detailed(level) ? e.card.map((r) => raceLabel(r)).join(', ') : '—'}
                        </td>
                        <td className="wrap rules">
                          {detailed(level) ? (
                            specialText(p).map((t) => <Badge key={t}>{t}</Badge>)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/**
 * Next week is a *name*, not a briefing. §9.3 gives you the planet and its Major status for free
 * and nothing else — the track, the food band and the card stay dark. A planet's name does imply its
 * band to anyone who has been there before, which is what makes the free look worth something.
 */
function detailed(level: FogLevel): boolean {
  return level === 'here' || level === 'past';
}
