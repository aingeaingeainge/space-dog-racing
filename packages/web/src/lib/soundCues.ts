import { useEffect, useRef } from 'react';
import type { GameState, Id } from '@sdr/engine';
import { sfxCard, sfxSting } from './sound';

/**
 * v3 Phase R: **the door's sounds**, read off the state rather than off a press, so a card answered
 * by key, by click or (online) by the room all sound the same. A card coming up behind your door
 * whooshes; what it did is a sting — up if it put Bones in your pocket, down if it took them, a shrug
 * if neither. Measured on the seat on the clock, across the one change that resolved the card.
 */
export function useSoundCues(s: GameState | null, meId: Id | null): void {
  const prev = useRef<{ key: string; card: boolean; pending: boolean; cash: number } | null>(null);
  const me = s && meId ? s.players.find((p) => p.id === meId) : undefined;
  const key = s && me ? `${s.season}:${s.week}:${me.id}` : '';
  const card = !!s && !!me && s.explore?.cards[me.id] !== undefined;
  const pending = !!s?.pendingEvent && s.pendingEvent.playerId === meId;
  const cash = me?.cash ?? 0;

  useEffect(() => {
    const was = prev.current;
    prev.current = { key, card, pending, cash };
    if (!was || !key || was.key !== key) return;
    const delta = cash - was.cash;
    const mood = delta > 0 ? 'good' : delta < 0 ? 'bad' : 'meh';
    if (!was.pending && pending) {
      // A card that asks: it whooshes up, and waits for its answer.
      sfxCard();
    } else if (was.pending && !pending) {
      sfxSting(mood);
    } else if (!was.card && card) {
      // A card that does not ask is done the moment the door opens.
      sfxSting(mood);
    }
  }, [key, card, pending, cash]);
}
