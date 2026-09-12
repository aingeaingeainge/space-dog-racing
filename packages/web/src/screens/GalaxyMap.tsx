import { formatBones, planetOf, upgradePrice, type GameState, type Player } from '@sdr/engine';
import { NeonButton } from '../components/NeonButton';
import { Panel } from '../components/Panel';
import { Badge, Notes } from '../components/ui';
import { specialText, trackText } from '../lib/planetText';
import { dossierWeek, dossierWeeks, fogLevel, raceLabel, type FogLevel } from '../lib/selectors';
import { rumours } from '../lib/rumours';
import { useGame } from '../store/gameStore';

/**
 * GDD §15.2 — ⚠️ **now a fog.** This planet in full; next week's name and Major star; the rest of
 * the route as unknown stops. Anything bought shows here.
 *
 * The v1 file's own comment read "the whole circuit is visible from week 1 so players can plan",
 * and that line is what D5 deletes. Pillar 2 is "you play the hand you're dealt": the season's
 * texture is meant to come from what you are offered, not from a route you optimised in week 1.
 * And §9.2 is the reason this does not hurt the trader — it *creates* the trader's road. Carrying
 * kibble blind loses 9.5 a unit; carrying it to a planet you know earns 23.6 on the legs worth
 * acting on, so the moment the map goes dark, knowing where you are going becomes worth money.
 */
export function GalaxyMap({ s, me }: { s: GameState; me: Player }) {
  const log = useGame((g) => g.log);
  const dispatch = useGame((g) => g.dispatch);
  const bought = dossierWeeks(log, me.id);
  const week = dossierWeek(s);
  const price = upgradePrice('dossier', planetOf(s.planet.planetId), me);
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';
  const already = week !== null && bought.has(week);
  const gossip = rumours(s);

  const why = !inTurn
    ? 'Not while the races are on'
    : week === null
      ? 'The season ends before then'
      : already
        ? `You already have the file on week ${week}`
        : price > me.cash
          ? `Short by ${formatBones(price - me.cash)}`
          : null;

  return (
    <>
      <Panel
        title="Galaxy map"
        sub="where you are, where you are going next, and nothing you have not paid for"
        actions={
          week !== null ? (
            <NeonButton
              small
              disabled={!!why}
              title={
                why ?? `A dossier on week ${week}: the planet, its kibble band and its race card`
              }
              onClick={() =>
                dispatch({ t: 'BuyUpgrade', playerId: me.id, upgrade: 'dossier', week })
              }
            >
              Dossier on week {week} — {formatBones(price)}
            </NeonButton>
          ) : null
        }
      >
        <Notes
          lines={[
            'The circuit is drawn fresh every season and the stewards do not publish it. You know this planet in full and next week by name, and the rest is rumour until you buy the file.',
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
                const level = fogLevel(s, e.week, bought);
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
                          {level === 'bought' ? (
                            <div className="muted">from your dossier</div>
                          ) : null}
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
 * and nothing else — the track, the kibble band and the card are what the dossier sells, and if
 * next week showed all of them the dossier would only ever be worth one week's reach instead of
 * two. A planet's name does imply its band to anyone who has been there before, and that is the
 * point of §9.2: the free look is worth something, and the paid one is worth more.
 */
function detailed(level: FogLevel): boolean {
  return level === 'here' || level === 'past' || level === 'bought';
}
