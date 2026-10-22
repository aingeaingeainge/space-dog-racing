import { planetOf, type GameState, type Player } from '@sdr/engine';
import { NeonButton } from '../components/NeonButton';
import { useKeys } from '../lib/keys';
import { PHASE_PLAIN } from '../lib/waiting';
import { useGame, type View } from '../store/gameStore';
import { GalaxyMap } from './GalaxyMap';
import { PlanetHub } from './PlanetHub';
import { Stable } from './Stable';

/**
 * **Online, done and waiting** (ONLINE_PLAN §5.1, V25; `screenFor`'s `waiting`). Since Phase T every
 * stable plays the weekend at once, so a seat waits only once it has finished its part — the planet,
 * the Bookie, or after the races — and only for the slowest. The waiting line above names who the
 * table is on, and this is what a stable may do meanwhile: read its own kennel, the leaderboard and the
 * map. The entries are sealed until the last stable finishes, so there is no board to watch.
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
  const why = `You are done with ${PHASE_PLAIN[s.phase] ?? 'this'}: waiting on the others`;

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

/** What a stable that has finished its part of the weekend reads while the others finish theirs. */
function WhileWaiting({ s, me }: { s: GameState; me: Player }) {
  const done = s.done.includes(me.id);
  if (s.phase === 'planetPost') {
    const next = s.calendar[s.week];
    const where = next ? `on to ${planetOf(next.planetId).name}` : 'the season ends';
    return (
      <div className="notice held">
        {done ? <>You have flown on — {where} once the table has.</> : <>Then {where}.</>}
      </div>
    );
  }
  if (s.phase === 'planetPre')
    return (
      <div className="notice held">
        Your weekend is in. Every entry is sealed until the last stable finishes — then the whole
        card goes up and the Bookie opens.
      </div>
    );
  if (s.phase === 'betting')
    return (
      <div className="notice held">
        Your slips are in. The races run when every stable has finished at the Bookie.
      </div>
    );
  return null;
}
