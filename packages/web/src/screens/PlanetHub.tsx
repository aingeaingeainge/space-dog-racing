import {
  balance,
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
import { Signpost } from '../components/Signpost';
import { TicketCard } from '../components/TicketCard';
import { Notes, StableName } from '../components/ui';
import { More } from '../components/More';
import { Guide } from '../components/Guide';
import { staffLine } from '../components/StaffCard';
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
  declaredCount,
  localRatingFor,
  playerById,
  weeklyBill,
  TRAPS,
} from '../lib/selectors';
import { useGame, type View } from '../store/gameStore';

/** 1st, 2nd, 3rd, 4th … for the turn-order line. */
function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

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
export function PlanetHub({
  s,
  me,
  waiting,
}: {
  s: GameState;
  me: Player;
  /** Online, off the clock (v3l3): why the Market and the Race Office are shut to this seat. */
  waiting?: string;
}) {
  const setView = useGame((g) => g.setView);
  const entry = s.calendar[s.week - 1]!;
  const planet = planetOf(entry.planetId);
  const sp = planet.special;
  const rules = specialText(planet);
  const bill = weeklyBill(s, me);
  const spots = hotspotsFor(planet.id);
  const status = venueStatus(s, me);
  const byId = new Map(venues(s, waiting).map((v) => [v.id, v]));
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

      {s.phase === 'planetPre' && !waiting ? (
        <Guide id="hub-pre">
          Next, the <b>Race Office</b>: put a dog in each race. The Market and the Kennels can wait.
        </Guide>
      ) : s.phase === 'planetPost' && !waiting ? (
        <Guide id="hub-post">
          Spend your winnings at the <b>Market</b>, or <b>End turn</b> to fly on.
        </Guide>
      ) : null}
      <BehindTheDoor s={s} me={me} />
      <Whispers s={s} me={me} where="use them at the Race Office and the bookie" />

      {/* Phase P (D34): the signpost is up only when the rock has a rule, or it is a Major. */}
      {rules.length || entry.major || entry.grandFinal ? (
        <Signpost rules={rules}>
          <Notes
            lines={[
              entry.grandFinal || entry.major
                ? `${entry.grandFinal ? 'The Grand Final' : 'A Major'}: purses ×${purseMult}.`
                : null,
            ]}
          />
        </Signpost>
      ) : null}

      {/* ⚠️ Food is the only running cost (GDD_V3 V10, §6.3), charged to the dog, not the purse.
          Said only when it will bite: a hold that feeds everybody is not news (D34). */}
      {bill.hungry ? (
        <div className="notice">
          {bill.hungryNames.join(' and ')} will go hungry at the jump: −{balance.emptyHoldFitness}{' '}
          fitness {bill.hungry === 1 ? '' : 'each '}and no gain. Buy food at the Market.
        </div>
      ) : null}

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

      {/*
        GDD_V3 §2.3: turn order is bought with an empty hold and nothing else. Phase P: one line —
        where you are in it — and the whole table, with the engine's arithmetic, behind the "?".
      */}
      <div className="oneline muted">
        You go <b>{ordinal(s.turnOrder.indexOf(me.id) + 1)}</b> of {s.turnOrder.length} this
        weekend.{' '}
        <More label="Turn order and this week">
          <p className="flush">
            Highest score goes first: {balance.arrivalBase} − crates aboard ÷{' '}
            {balance.arrivalCargoDiv} + a d{balance.arrivalDie}. A heavy hold goes last to the shelf
            and last to declare — the later you declare, the more of each field you see.
          </p>
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
          <p className="muted">
            {trackText(planet.track)} · food here is {describeTaste(planet)} · trainers:{' '}
            {staffLine(me)}.
          </p>
          {weekLog.length ? (
            <div className="log">
              {weekLog.map((l, i) => (
                <p key={i} className={l.playerId === me.id ? 'mine' : 'muted'}>
                  {l.text}
                </p>
              ))}
            </div>
          ) : null}
        </More>
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
