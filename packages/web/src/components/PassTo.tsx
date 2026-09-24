import type { GameState, Player } from '@sdr/engine';
import { NeonButton } from './NeonButton';
import { PHASE_LABEL } from '../lib/selectors';
import { passReason } from '../store/loop';
import { useGame } from '../store/gameStore';

/**
 * Hotseat handover: nothing of the next player's business is on screen until they say go. It names who
 * is next and why — what they are about to do, and whether the order is the turn order's (Phase E2).
 * `screenFor` never shows it to the human already holding the laptop.
 */
export function PassTo({ s, next }: { s: GameState; next: Player }) {
  const ackPass = useGame((g) => g.ackPass);
  return (
    <div className="app">
      <div className="centre">
        <h1>Pass to {next.name}</h1>
        <p className="muted">
          Week {s.week} of {s.calendar.length} · {PHASE_LABEL[s.phase]}
        </p>
        <p>{passReason(s)}</p>
        <p className="muted">Everyone else: look away.</p>
        <NeonButton variant="primary" onClick={() => ackPass(next.id)}>
          I am {next.name}
        </NeonButton>
      </div>
    </div>
  );
}
