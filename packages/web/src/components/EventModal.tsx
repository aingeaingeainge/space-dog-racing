import { EVENT_BY_ID, type GameState } from '@sdr/engine';
import { Modal } from './ui';
import { NeonButton } from './NeonButton';
import { eventArt } from '../lib/assets';
import { useKeys } from '../lib/keys';
import { playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §11: one event per stable per weekend, and the phase order cannot move on until the
 * player has chosen. AI stables choose through the card's own aiChoice inside the engine.
 *
 * The 800×500 illustration slot is filled by design/ASSET_LIST.md's event cards, one per event
 * id. Until the art for a card lands the slot draws itself — hazard hatching in the planet's
 * accents with the card's name — so an event never opens onto a hole.
 */
export function EventModal({ s }: { s: GameState }) {
  const dispatch = useGame((g) => g.dispatch);
  const pending = s.pendingEvent;
  const choose = (choice: number) => {
    if (!pending || choice < 0 || choice >= pending.choices.length) return;
    dispatch({ t: 'ResolveEvent', playerId: pending.playerId, choice });
  };
  // 1, 2, 3 … answer the card, and Enter takes the first choice — one key per choice the card
  // actually offers, so a two-way card cannot be told to take a third option. There is
  // deliberately no Escape: GDD §11 says the phase cannot move on until the player has chosen.
  const keys: Record<string, () => void> = { Enter: () => choose(0) };
  for (let i = 0; i < (pending?.choices.length ?? 0); i++) keys[String(i + 1)] = () => choose(i);
  useKeys(keys);
  if (!pending) return null;
  const card = EVENT_BY_ID[pending.eventId];
  const who = playerById(s, pending.playerId);
  if (!card) return null;

  const art = eventArt(pending.eventId);

  return (
    <Modal kind="event" title={card.name} sub={who ? `${who.name} — week ${s.week}` : undefined}>
      <div className="event-art">
        {art ? <img src={art.url} alt="" decoding="async" /> : null}
        {!art || art.placeholder ? (
          <span className="ph">{art ? 'placeholder' : `no card art — ${pending.eventId}`}</span>
        ) : null}
      </div>
      <p>{card.text}</p>
      <div className="row">
        {pending.choices.map((label, i) => (
          <NeonButton
            key={i}
            variant={i === 0 ? 'primary' : 'default'}
            title={`key: ${i + 1}`}
            onClick={() => choose(i)}
          >
            {label}
          </NeonButton>
        ))}
      </div>
    </Modal>
  );
}
