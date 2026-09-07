import { EVENT_BY_ID, type GameState } from '@sdr/engine';
import { Modal } from './ui';
import { playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §11: one event per stable per weekend, and the phase order cannot move on until the
 * player has chosen. AI stables choose through the card's own aiChoice inside the engine.
 */
export function EventModal({ s }: { s: GameState }) {
  const dispatch = useGame((g) => g.dispatch);
  const pending = s.pendingEvent;
  if (!pending) return null;
  const card = EVENT_BY_ID[pending.eventId];
  const who = playerById(s, pending.playerId);
  if (!card) return null;

  return (
    <Modal title={card.name} sub={who ? `${who.name} — week ${s.week}` : undefined}>
      <p>{card.text}</p>
      <div className="row">
        {pending.choices.map((label, i) => (
          <button
            key={i}
            className={i === 0 ? 'primary' : ''}
            onClick={() => dispatch({ t: 'ResolveEvent', playerId: pending.playerId, choice: i })}
          >
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
