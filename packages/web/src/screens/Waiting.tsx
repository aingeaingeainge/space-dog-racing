import { planetOf, publicStyle, thisWeeksCard, type GameState, type Player } from '@sdr/engine';
import { NeonButton } from '../components/NeonButton';
import { Panel } from '../components/Panel';
import { Notes, StableName, StyleTag } from '../components/ui';
import { useKeys } from '../lib/keys';
import { criterionFor, playerById, raceLabel } from '../lib/selectors';
import { PHASE_PLAIN } from '../lib/waiting';
import { useGame, type View } from '../store/gameStore';
import { GalaxyMap } from './GalaxyMap';
import { PlanetHub } from './PlanetHub';
import { Stable } from './Stable';

/**
 * **Online, off the clock** (ONLINE_PLAN §5.1, V25; `screenFor`'s `waiting`). A public screen: the
 * waiting line above it names who the table is on, and this is what a stable may do meanwhile —
 * read its own kennel, the leaderboard and the map, watch declarations land on the board, and after
 * the races press "Fly on" early (the room holds it until the stable's turn).
 *
 * ⚠️ §5.1 also said a waiting stable could pick next week's diet. The engine takes a diet only from
 * the stable on the clock (`SetDogState`, `activeOrFail`), and the engine does not change for online
 * play, so the diet is set in the stable's own sitting, as in hotseat. The Kennels here are read-only.
 */
const TABS: { id: View; label: string; key: string }[] = [
  { id: 'hub', label: 'Planet hub', key: 'h' },
  { id: 'stable', label: 'Kennels', key: 'k' },
  { id: 'map', label: 'Galaxy map', key: 'g' },
];

export function Waiting({ s, me }: { s: GameState; me: Player }) {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const leaderboard = useGame((g) => g.leaderboard);
  const setLeaderboard = useGame((g) => g.setLeaderboard);
  const keys: Record<string, (() => void) | undefined> = {
    l: () => setLeaderboard(!leaderboard),
    Escape: leaderboard ? undefined : () => setView('hub'),
  };
  for (const t of TABS) keys[t.key] = () => setView(t.id);
  useKeys(keys);
  const shown = TABS.some((t) => t.id === view) ? view : 'hub';
  const why = `Not your turn: ${PHASE_PLAIN[s.phase] ?? 'this'} is in turn order`;

  return (
    <>
      <nav className="tabs">
        {TABS.map((t) => (
          <NeonButton
            key={t.id}
            small
            variant={shown === t.id ? 'primary' : 'default'}
            title={`${t.label} (key: ${t.key.toUpperCase()})`}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </NeonButton>
        ))}
      </nav>
      {shown === 'stable' ? (
        <Stable s={s} me={me} />
      ) : shown === 'map' ? (
        <GalaxyMap s={s} me={me} />
      ) : (
        <>
          <WhileWaiting s={s} me={me} />
          <PlanetHub s={s} me={me} waiting={why} />
        </>
      )}
    </>
  );
}

/** What this part of the weekend offers a stable that is not on the clock. */
function WhileWaiting({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const queued = useGame((g) => g.meta?.queued[me.id] ?? null);
  const done = s.done.includes(me.id);
  const post = s.phase === 'planetPost' && !done && !queued;
  const fly = () => dispatch({ t: 'EndPhase', playerId: me.id });
  useKeys({ f: post ? fly : undefined });

  if (s.phase === 'planetPost') {
    const next = s.calendar[s.week];
    const where = next ? `on to ${planetOf(next.planetId).name}` : 'the season ends';
    if (done || queued)
      return (
        <div className="notice held">
          {done ? (
            <>You have flown on — {where} once the table has.</>
          ) : (
            <>
              <b>You fly on when your turn comes</b> — the room is holding it. Then {where}.
            </>
          )}
        </div>
      );
    return (
      <Panel
        title="After the races"
        sub={`the market is open again, in turn order · then ${where}`}
      >
        <div className="row">
          <NeonButton variant="primary" onClick={fly} title="key: F">
            {next ? 'Fly on' : 'End the season'}
          </NeonButton>
          <span className="muted">
            Press it now and the room keeps it for your turn. Want the market again? Wait: it opens
            for you in turn order.
          </span>
        </div>
      </Panel>
    );
  }
  if (s.phase === 'planetPre') return <Board s={s} me={me} />;
  if (s.phase === 'betting')
    return (
      <div className="notice held">
        Your slips are in. The races run when every stable has finished at the Bookie.
      </div>
    );
  if (s.phase === 'explore')
    return (
      <div className="notice held">
        Your door is open. The stables ahead of you are still answering theirs.
      </div>
    );
  return null;
}

/**
 * The board as it fills (GDD_V3 §7.3, V16): declarations are public the moment they are made, so a
 * stable waiting its turn watches them land. Read-only; its own declarations come in its sitting.
 */
function Board({ s, me }: { s: GameState; me: Player }) {
  const card = thisWeeksCard();
  return (
    <Panel title="The board" sub="declarations, public as they are made, in turn order">
      <div className="grid3">
        {card.map((race) => (
          <div key={race} className="board-race">
            <h3>
              {raceLabel(race)} <span className="muted small">{criterionFor(race)}</span>
            </h3>
            <table>
              <tbody>
                {s.turnOrder.map((id) => {
                  const p = playerById(s, id);
                  if (!p) return null;
                  const dogId = s.declarations[race][id];
                  const d = dogId ? s.dogs[dogId] : undefined;
                  return (
                    <tr key={id} className={id === me.id ? 'me' : ''}>
                      <td>
                        <StableName player={p} me={id === me.id} />
                      </td>
                      <td>
                        {d ? (
                          <>
                            {d.name} <StyleTag style={publicStyle(d)} />
                          </>
                        ) : (
                          <span className="muted">{s.done.includes(id) ? 'none' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <Notes
        lines={[
          'The stables ahead of you in the turn order declare first; yours are made in your own sitting, when you can see what they did.',
        ]}
      />
    </Panel>
  );
}
