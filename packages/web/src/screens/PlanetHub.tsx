import {
  balance,
  cargoTotal,
  formatBones,
  KIBBLE_ID,
  planetOf,
  purseFor,
  thisWeeksCard,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { HubStage } from '../components/HubStage';
import { Hotspot } from '../components/Hotspot';
import { NeonButton } from '../components/NeonButton';
import { Signpost } from '../components/Signpost';
import { TicketCard } from '../components/TicketCard';
import { KV, Notes, StableName } from '../components/ui';
import { uiArt } from '../lib/assets';
import { specialText, trackText } from '../lib/planetText';
import { hotspotsFor, HOTSPOT_VENUES, VENUE_ICON } from '../lib/hotspots';
import { venues } from '../lib/venues';
import { venueStatus } from '../lib/venueStatus';
import {
  criterionFor,
  raceLabel,
  raceTone,
  PHASE_LABEL,
  PHASE_ORDER,
  declaredCount,
  localRatingFor,
  playerById,
  weeklyBill,
  TRAPS,
} from '../lib/selectors';
import { useGame, type View } from '../store/gameStore';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The painted hotspot icon for a venue, or nothing — in which case the emoji stands. */
function finishedIcon(id: string) {
  const art = uiArt(`icon-${id}`);
  return art && !art.placeholder ? art : null;
}

/**
 * GDD §15.3 — the painted planet with six hotspots, its rules on a signpost, this weekend's
 * card, and the way into every venue.
 *
 * Each hotspot carries what is actually in that venue this week (lib/venueStatus.ts), which is
 * the answer to PLAYTEST_NOTES finding 4: a season is a lot of clicks, and most of them go on
 * opening a shop to find out it has nothing in it. Nothing is hidden and nothing is disabled
 * that was not already — a shut venue still says why, per M1 note 2.
 */
export function PlanetHub({ s, me }: { s: GameState; me: Player }) {
  const setView = useGame((g) => g.setView);
  const log = useGame((g) => g.log);
  const entry = s.calendar[s.week - 1]!;
  const planet = planetOf(entry.planetId);
  const sp = planet.special;
  const rules = specialText(planet);
  const bill = weeklyBill(s, me);
  const spots = hotspotsFor(planet.id);
  const status = venueStatus(s, me, log);
  const byId = new Map(venues(s).map((v) => [v.id, v]));
  const weekLog = s.eventLog.filter(
    (l) => l.week === s.week && (!l.playerId || l.playerId === me.id),
  );
  const purseMult =
    (entry.grandFinal ? balance.finalMult : entry.major ? balance.majorMult : 1) *
    (sp.purseMult ?? 1);

  return (
    <>
      <HubStage
        planetId={planet.id}
        name={
          <>
            {planet.name}
            {entry.grandFinal ? (
              <span className="star"> ★★</span>
            ) : entry.major ? (
              <span className="star"> ★</span>
            ) : null}
          </>
        }
        vibe={entry.major && planet.event ? planet.event : planet.vibe}
      >
        {HOTSPOT_VENUES.map((id) => {
          const v = byId.get(id);
          if (!v) return null;
          const st = status[id];
          return (
            <Hotspot
              key={id}
              spot={spots[id]}
              icon={VENUE_ICON[id]}
              iconArt={finishedIcon(id)}
              label={v.label}
              status={st.short}
              detail={st.line}
              worth={st.worth}
              reason={v.open ? undefined : (v.reason ?? 'Shut')}
              onClick={() => setView(id as View)}
            />
          );
        })}
      </HubStage>

      <Signpost rules={rules}>
        <Notes
          lines={[
            `${trackText(planet.track)} · kibble ${s.planet.goods[KIBBLE_ID].buy} in, ${s.planet.goods[KIBBLE_ID].sell} out · ${planet.marketBias.toLowerCase()}`,
            purseMult !== 1 ? `Purses are ×${purseMult} this weekend.` : null,
            sp.winningsTax
              ? `${pct(sp.winningsTax)} of every purse goes to the port authority.`
              : null,
            sp.noUpkeep ? 'The monks feed and house your dogs: no upkeep this week.' : null,
            sp.fitnessOnArrival
              ? `Your dogs arrived ${sp.fitnessOnArrival > 0 ? 'refreshed' : 'flat'}: fitness ${sp.fitnessOnArrival > 0 ? '+' : ''}${sp.fitnessOnArrival}.`
              : null,
            sp.dopingCatch !== undefined
              ? sp.dopingCatch === 0
                ? 'Supplements are legal here — the stewards catch nobody.'
                : `The stewards here catch ${pct(sp.dopingCatch)} of doped dogs, against ${pct(balance.supplementCatchBase)} elsewhere.`
              : null,
            sp.localsNervy
              ? 'The local runners are all Nervy — traps 1 and 8 do them no favours.'
              : null,
          ]}
        />
      </Signpost>

      <Panel
        title="Where to?"
        sub="GDD §4.2 phase 3 — what is actually in each one this week"
        actions={
          <span className="phases">
            {PHASE_ORDER.map((p) => (
              <span
                key={p}
                className={
                  p === s.phase
                    ? 'now'
                    : PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(s.phase)
                      ? 'done'
                      : ''
                }
              >
                {PHASE_LABEL[p]}
              </span>
            ))}
          </span>
        }
      >
        <div className="venue-list">
          {HOTSPOT_VENUES.map((id) => {
            const v = byId.get(id);
            if (!v) return null;
            const st = status[id];
            return (
              <div className={st.worth ? 'venue-line worth' : 'venue-line'} key={id}>
                <NeonButton
                  variant={st.worth ? 'primary' : 'default'}
                  disabled={!v.open}
                  title={v.reason}
                  onClick={() => setView(id as View)}
                >
                  {v.label}
                </NeonButton>
                <span className={v.open ? 'muted' : 'shut'}>{v.open ? st.line : v.reason}</span>
              </div>
            );
          })}
        </div>
        <Notes
          lines={[
            `This week costs ${formatBones(bill.total)} — ${
              [
                bill.upkeep ? `upkeep ${formatBones(bill.upkeep)}` : null,
                bill.wages ? `wages ${formatBones(bill.wages)}` : null,
                bill.fuel ? `fuel ${formatBones(bill.fuel)}` : null,
                bill.food ? `kibble at the gate ${formatBones(bill.food)}` : null,
                bill.interest ? `interest ${formatBones(bill.interest)}` : null,
              ]
                .filter(Boolean)
                .join(', ') || 'nothing at all this week'
            }.`,
          ]}
        />
      </Panel>

      <h3 className="section">This weekend&apos;s card</h3>
      <div className="grid3">
        {thisWeeksCard(s).map((race) => {
          const purse = purseFor(s, race);
          const mineId = s.declarations[race][me.id];
          const dog = mineId ? s.dogs[mineId] : undefined;
          const declared = declaredCount(s, race);
          return (
            <TicketCard
              key={race}
              cls={raceLabel(race)}
              tone={raceTone(race, thisWeeksCard(s))}
              cap={criterionFor(race)}
              purse={formatBones(purse[0])}
              serial={`2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
            >
              <p className="tight-p">
                {dog ? (
                  <>
                    Your runner: <b>{dog.name}</b> ({dog.rating})
                  </>
                ) : (
                  <span className="muted">No runner declared</span>
                )}
              </p>
              <p className="muted flush">
                {declared} stable{declared === 1 ? '' : 's'} in · {Math.max(0, TRAPS - declared)}{' '}
                locals at about {localRatingFor(race, entry.major)}
              </p>
            </TicketCard>
          );
        })}
      </div>

      <div className="grid2">
        <Panel title="Turn order" sub="ship speed × 10 − cargo ÷ 5 + d10">
          <div className="table-wrap">
            <table>
              <tbody>
                {s.turnOrder.map((id, i) => {
                  const p = playerById(s, id);
                  if (!p) return null;
                  return (
                    <tr key={id} className={id === me.id ? 'me' : ''}>
                      <td>{i + 1}</td>
                      <td>
                        <StableName player={p} me={id === me.id} />
                      </td>
                      <td className="muted">{s.turnOrderReason[id]}</td>
                      <td className="muted">{s.done.includes(id) ? 'done' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="This week" sub="what has happened so far">
          <div className="log">
            {weekLog.length ? (
              weekLog.map((l, i) => (
                <p key={i} className={l.playerId === me.id ? 'mine' : 'muted'}>
                  {l.text}
                </p>
              ))
            ) : (
              <p className="muted">Quiet so far.</p>
            )}
          </div>
          <KV
            items={[
              ['Phase', PHASE_LABEL[s.phase]],
              ['Cash', formatBones(me.cash)],
              ['Hold', `${cargoTotal(me.cargo)} / ${me.ship.cargoCap} crates`],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
