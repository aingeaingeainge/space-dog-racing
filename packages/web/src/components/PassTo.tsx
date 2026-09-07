import type { GameState, Player } from '@sdr/engine';
import { PHASE_LABEL } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/** Hotseat handover: nothing of the next player's business is on screen until they say go. */
export function PassTo({ s, next }: { s: GameState; next: Player }) {
  const ackPass = useGame((g) => g.ackPass);
  return (
    <div className="app">
      <div className="centre">
        <h1>Pass to {next.name}</h1>
        <p className="muted">
          Week {s.week} of {s.calendar.length} · {PHASE_LABEL[s.phase]}
        </p>
        <p className="muted">Everyone else: look away.</p>
        <button className="primary" onClick={() => ackPass(next.id)}>
          I am {next.name}
        </button>
      </div>
    </div>
  );
}
