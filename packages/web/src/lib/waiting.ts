import type { GameState, Id, Player } from '@sdr/engine';
import type { RoomMeta } from '../../../server/src/protocol';

/**
 * **The waiting line** (ONLINE_PLAN §5.1, V25): "Waiting on Ruby — Market and Race Office · 1:20 ·
 * Nudge". Who, from the room's `meta.clock`; which part of the weekend, in the plain names the pass
 * screen uses; and how long, from `meta.clock.since`.
 *
 * Decided at `v3l2`'s checklist: **it names only the humans being waited on**, in turn order. At the
 * Bookie (and in the off-season until Phase N made it a draft, in turn order) the clock also lists AI and stood-in seats waiting behind the turn
 * order (GDD_V3 L2b); they are left out, and when nobody else is left it says "Waiting on the AIs"
 * (they are about to play).
 */
export interface WaitingLine {
  /** The humans named, never this browser's own seat, never a stood-in seat. */
  who: Player[];
  /** "Waiting on Ruby and Cal", or "Waiting on the AIs". */
  text: string;
  /** The part of the weekend, in plain words. */
  what: string;
  since: number;
}

export const PHASE_PLAIN: Partial<Record<GameState['phase'], string>> = {
  explore: 'Explore',
  planetPre: 'Market and Race Office',
  betting: 'the Bookie',
  planetPost: 'after the races',
  draft: 'the draft',
  offSeason: 'the off-season draft',
};

function andList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Null when nobody is on the clock but this seat, or nobody at all (the system is moving). */
export function waitingLine(
  s: GameState,
  meta: Pick<RoomMeta, 'clock' | 'standIn'>,
  seat: Id,
): WaitingLine | null {
  const others = meta.clock.seats.filter((id) => id !== seat);
  if (!others.length) return null;
  const who = others
    .map((id) => s.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p && p.kind === 'human' && !meta.standIn.includes(p.id));
  return {
    who,
    text: who.length ? `Waiting on ${andList(who.map((p) => p.name))}` : 'Waiting on the AIs',
    what: PHASE_PLAIN[s.phase] ?? '',
    since: meta.clock.since,
  };
}

/** "1:20", "12:04", "1:02:10": how long the seat has been on the clock. */
export function sinceText(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
