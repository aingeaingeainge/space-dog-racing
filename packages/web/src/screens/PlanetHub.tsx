import {
  balance,
  cargoTotal,
  HOLD_CAP,
  formatBones,
  describeTaste,
  planetOf,
  purseFor,
  thisWeeksCard,
  EVENT_BY_ID,
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
import { eventArt, uiArt } from '../lib/assets';
import { Whispers } from '../components/Whispers';
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
  const entry = s.calendar[s.week - 1]!;
  const planet = planetOf(entry.planetId);
  const sp = planet.special;
  const rules = specialText(planet);
  const bill = weeklyBill(s, me);
  const spots = hotspotsFor(planet.id);
  const status = venueStatus(s, me);
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

      <BehindTheDoor s={s} me={me} />
      <Whispers s={s} me={me} where="use them at the Race Office and the bookie" />

      <Signpost rules={rules}>
        <Notes
          lines={[
            `${trackText(planet.track)} · food here is ${describeTaste(planet)}`,
            purseMult !== 1 ? `Purses are ×${purseMult} this weekend.` : null,
            sp.winningsTax
              ? `${pct(sp.winningsTax)} of every purse goes to the port authority.`
              : null,
            sp.fitnessOnArrival
              ? `Your dogs arrived ${sp.fitnessOnArrival > 0 ? 'refreshed' : 'flat'}: fitness ${sp.fitnessOnArrival > 0 ? '+' : ''}${sp.fitnessOnArrival}.`
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
            // ⚠️ Food is the only running cost left (GDD_V3 V10, §6.3), and it is charged to the
            // dog rather than to the purse: a stable that sails without food pays in condition.
            bill.hungry
              ? `${bill.hungryNames.join(' and ')} will go hungry at the jump — −${balance.emptyHoldFitness} fitness ${bill.hungry === 1 ? '' : 'each '}and no gain. The hold has ${bill.foodFromHold} of the ${bill.foodNeeded} crates the yard eats.`
              : `The hold feeds every dog this week: ${bill.foodNeeded} crate${bill.foodNeeded === 1 ? '' : 's'} at the jump. Food is the only running cost there is.`,
          ]}
        />
      </Panel>

      <h3 className="section">This weekend&apos;s card</h3>
      <div className="grid3">
        {thisWeeksCard().map((race) => {
          const purse = purseFor(s, race);
          const mineId = s.declarations[race][me.id];
          const dog = mineId ? s.dogs[mineId] : undefined;
          const declared = declaredCount(s, race);
          return (
            <TicketCard
              key={race}
              cls={raceLabel(race)}
              tone={raceTone(race)}
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
        {/*
          GDD_V3 §2.3: turn order is bought with an empty hold and nothing else, and it cuts both
          ways — first look at a shelf that runs out, against a heavy hold that goes last all season.
          The engine writes the arithmetic into each stable's reason, so the table shows the whole
          sum rather than a verdict. (The subtitle said "ship speed × 10" until v3 Phase B; there
          has been no ship since Phase A.)
        */}
        <Panel
          title="Turn order"
          sub={`${balance.arrivalBase} − crates aboard ÷ ${balance.arrivalCargoDiv} + d${balance.arrivalDie}, highest first · ties to the lighter hold`}
        >
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
          <Notes
            lines={[
              `Every ${balance.arrivalCargoDiv} crates you carry off this planet costs a point next week. A full hold of ${HOLD_CAP} is ${HOLD_CAP / balance.arrivalCargoDiv} points — more than the die can make up — so a stable that trades heavy goes last to the shelf, week after week, and everybody can see why.`,
            ]}
          />
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
              ['Hold', `${cargoTotal(me.cargo)} / ${HOLD_CAP} crates`],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

/**
 * What was behind this stable's door this weekend (GDD_V3 §9.1), read back on the hub. A card
 * without a choice resolves the moment the door opens, so this is where a player reads it — no
 * modal, no extra click (§10.1).
 */
function BehindTheDoor({ s, me }: { s: GameState; me: Player }) {
  const cardId = s.explore?.cards[me.id];
  const door = s.explore?.picks[me.id];
  if (cardId === undefined || door === undefined) return null;
  const planet = planetOf(s.planet.planetId);
  const card = cardId ? EVENT_BY_ID[cardId] : undefined;
  const lines = s.eventLog.filter(
    (l) => l.week === s.week && l.phase === 'explore' && l.playerId === me.id,
  );
  const art = card ? eventArt(card.id) : null;
  return (
    <Panel
      title={card ? card.name : 'Nothing doing'}
      sub={`behind ${planet.exploreDoors[door]?.name ?? 'the door'} this weekend`}
    >
      <div className="behind-door">
        <div className="event-art">
          {art ? <img src={art.url} alt="" decoding="async" /> : null}
          {!art || art.placeholder ? (
            <span className="ph">{art ? 'placeholder' : 'no art'}</span>
          ) : null}
        </div>
        <div className="log">
          {card ? <p className="muted">{card.text}</p> : null}
          {lines.slice(1).map((l, i) => (
            <p key={i} className="mine">
              {l.text}
            </p>
          ))}
        </div>
      </div>
    </Panel>
  );
}
