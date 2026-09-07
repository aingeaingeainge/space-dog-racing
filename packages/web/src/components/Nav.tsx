import type { GameState, Player } from '@sdr/engine';
import { venues } from '../lib/venues';
import { useGame, type View } from '../store/gameStore';

/**
 * The venues of GDD §4.2 phase 3 as a tab strip. A venue that is shut says why on the button
 * rather than vanishing, so the planet's rules are learnable from the hub.
 */
export function Nav({ s, me }: { s: GameState; me: Player }) {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const pre = s.phase === 'planetPre';

  return (
    <div className="row" style={{ marginBottom: 12 }}>
      {venues(s).map((v) => (
        <button
          key={v.id}
          className={view === v.id ? 'primary' : ''}
          disabled={!v.open || v.id === 'bookie'}
          title={v.reason}
          onClick={() => setView(v.id as View)}
        >
          {v.label}
        </button>
      ))}
      <span className="spacer" style={{ flex: 1 }} />
      <button className="primary" onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}>
        {pre ? 'Head to the track' : 'End turn'}
      </button>
    </div>
  );
}
