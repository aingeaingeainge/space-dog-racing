import { formatBones, planetOf, type GameState, type Player } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { NeonButton } from '../components/NeonButton';
import { Notes, StableName } from '../components/ui';
import { useKeys } from '../lib/keys';
import { playerById } from '../lib/selectors';
import { specialText } from '../lib/planetText';
import { passReason } from '../store/loop';
import { useGame } from '../store/gameStore';
import { LockedField } from './LockedField';

/**
 * Phase E2 — the hotseat table's public screens (GDD_V3 §2.3, §3). Nothing on these belongs to one
 * human, so the whole table reads them together and nobody looks away. Each one ends on a button that
 * **is** the pass when the laptop has to move ("I am <name>"), so a public moment never costs an extra
 * press on top of the handover it sits in front of.
 */

/** The button that ends a public screen: a pass to `next` if they are not holding the laptop already. */
function HandOn({
  next,
  holder,
  onGo,
  stay,
}: {
  next: Player;
  holder: string | null;
  onGo: (passTo?: string) => void;
  stay: string;
}) {
  const moves = holder !== next.id;
  const go = () => onGo(moves ? next.id : undefined);
  useKeys({ Enter: go, ' ': go });
  return (
    <div className="row centre">
      <NeonButton variant="primary" onClick={go} title="key: Enter">
        {moves ? `I am ${next.name}` : stay}
      </NeonButton>
      {moves ? (
        <span className="muted">Pass the laptop to {next.name}. Everyone else: look away.</span>
      ) : null}
    </div>
  );
}

/** The weekend opens: the planet, and the turn order with its reasons (§2.3 step 1). */
export function Arrival({ s, me }: { s: GameState; me: Player }) {
  const ackArrival = useGame((g) => g.ackArrival);
  const holder = useGame((g) => g.passAck);
  const planet = planetOf(s.planet.planetId);
  const rules = specialText(planet);
  return (
    <div className="app">
      <div className="centre">
        <h1>{planet.name}</h1>
        <p className="muted">
          {s.length.kind === 'seasons' && s.length.seasons === 1 ? '' : `Season ${s.season} · `}
          Week {s.week} of {s.calendar.length}
        </p>
      </div>
      <Panel title="Turn order" sub="highest score goes first — empty hold space and a d10">
        <div className="table-wrap">
          <table>
            <tbody>
              {s.turnOrder.map((id, i) => {
                const p = playerById(s, id);
                if (!p) return null;
                return (
                  <tr key={id}>
                    <td>{i + 1}</td>
                    <td>
                      <StableName player={p} />
                    </td>
                    <td className="muted">{s.turnOrderReason[id]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rules.length ? <Notes lines={rules} /> : null}
      </Panel>
      <Notes lines={[passReason(s)]} />
      <HandOn next={me} holder={holder} onGo={ackArrival} stay={`${me.name}: open a door`} />
    </div>
  );
}

/** The card is locked and the prices are up: read together before anybody bets (§2.3 steps 5–6). */
export function Board({ s, me }: { s: GameState; me: Player }) {
  const ackBoard = useGame((g) => g.ackBoard);
  const holder = useGame((g) => g.passAck);
  return (
    <div className="app">
      <LockedField s={s} me={me} board />
      <Notes lines={[passReason(s)]} />
      <HandOn next={me} holder={holder} onGo={ackBoard} stay={`${me.name}: to the Bookie`} />
    </div>
  );
}

/**
 * After the races (§2.3): the market is open again, in turn order, and most weekends nobody wants it.
 * So the table does the roll-call here, in public — each human flies on with one press and the laptop
 * never moves — and only a human who wants to trade takes it back to the planet.
 */
export function AfterRaces({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const tradeAfterRaces = useGame((g) => g.tradeAfterRaces);
  const next = s.calendar[s.week];
  const fly = () => dispatch({ t: 'EndPhase', playerId: me.id });
  useKeys({ f: fly });
  const humans = s.turnOrder.map((id) => playerById(s, id)!).filter((p) => p.kind === 'human');
  return (
    <div className="app">
      <Panel
        title="After the races"
        sub={`the market is open again, in turn order · then ${next ? `on to ${planetOf(next.planetId).name}` : 'the season ends'}`}
      >
        <div className="table-wrap">
          <table>
            <tbody>
              {humans.map((p) => {
                const done = s.done.includes(p.id);
                const now = p.id === me.id;
                return (
                  <tr key={p.id} className={now ? 'me' : ''}>
                    <td>
                      <StableName player={p} />
                    </td>
                    <td className="num">{formatBones(p.cash)}</td>
                    <td className="muted">{done ? 'flying on' : now ? 'your call' : 'waiting'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row">
          <NeonButton variant="primary" onClick={fly} title="key: F">
            {me.name}: {next ? 'fly on' : 'end the season'}
          </NeonButton>
          <NeonButton onClick={() => tradeAfterRaces(me.id)}>{me.name}: trade first</NeonButton>
        </div>
        <Notes
          lines={[
            'Flying on is public and costs nothing. Trading first takes the laptop back to your own planet screen — the others look away — and you fly on from there.',
          ]}
        />
      </Panel>
    </div>
  );
}
