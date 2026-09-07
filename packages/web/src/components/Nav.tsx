import type { GameState, Player } from '@sdr/engine';
import { useGame, type View } from '../store/gameStore';

const TABS: { id: View; label: string }[] = [
  { id: 'hub', label: 'Planet hub' },
  { id: 'stable', label: 'Stable' },
  { id: 'office', label: 'Race Office' },
  { id: 'map', label: 'Galaxy map' },
];

/** Venues the engine already supports but session 2 of M1 gives a screen. */
const SOON = ['Market', 'Docks', 'Saloon', 'Bookie'];

export function Nav({ s, me }: { s: GameState; me: Player }) {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const pre = s.phase === 'planetPre';

  return (
    <div className="row" style={{ marginBottom: 12 }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={view === t.id ? 'primary' : ''}
          disabled={t.id === 'office' && !pre}
          onClick={() => setView(t.id)}
        >
          {t.label}
        </button>
      ))}
      {SOON.map((label) => (
        <button key={label} disabled title="Arrives in the next build session">
          {label}
        </button>
      ))}
      <span className="spacer" style={{ flex: 1 }} />
      <button className="primary" onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}>
        {pre ? 'Head to the track' : 'End turn'}
      </button>
    </div>
  );
}
