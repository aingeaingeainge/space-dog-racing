import { useEffect, useState } from 'react';
import type { GameState, Id, Player } from '@sdr/engine';
import { NeonButton } from './NeonButton';
import { StableName } from './ui';
import { sinceText, waitingLine } from '../lib/waiting';
import { useGame } from '../store/gameStore';
import type { RoomMeta } from '../store/online';

/**
 * Online only (ONLINE_PLAN §5.1, §5.3, §6 item 6): the strips that sit under the top bar of a game
 * played in a room. None of them renders in hotseat, where there is no room.
 */

/** "reconnecting…" while this browser's socket is down. */
export function ConnectionStrip() {
  const conn = useGame((g) => g.conn);
  if (conn !== 'down') return null;
  return (
    <div className="online-strip down" role="status">
      Reconnecting to the room…{' '}
      <span className="muted">nothing is lost: the room holds the game</span>
    </div>
  );
}

/** §7: the room speaks a newer protocol than this build. */
export function ReloadStrip() {
  const need = useGame((g) => g.reloadNeed);
  if (need === null) return null;
  return (
    <div className="online-strip reload" role="alert">
      A new version is out — reload to keep playing.{' '}
      <NeonButton small variant="primary" onClick={() => window.location.reload()}>
        Reload
      </NeonButton>
    </div>
  );
}

/**
 * Who may press "Let an AI play for them" (§5.3, the room's `mayStandIn`): the host, or while the host
 * is away the first connected human in seat order.
 */
export function mayStandIn(s: GameState, meta: RoomMeta, seat: Id): boolean {
  if (meta.host && meta.online.includes(meta.host)) return seat === meta.host;
  return s.players.find((p) => p.kind === 'human' && meta.online.includes(p.id))?.id === seat;
}

/**
 * The waiting line (§5.1, V25): "Waiting on Ruby — Market and Race Office · 1:20 · Nudge", over the
 * hub while this seat is off the clock. The clock ticks here; the room's `since` is its start.
 */
export function WaitingLine({ s, me }: { s: GameState; me: Player }) {
  const meta = useGame((g) => g.meta);
  const nudge = useGame((g) => g.nudge);
  const [now, setNow] = useState(() => Date.now());
  const [nudgedAt, setNudgedAt] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!meta) return null;
  const line = waitingLine(s, meta, me.id);
  if (!line) return null;
  const cooling = now - nudgedAt < 60_000;
  return (
    <div className="waiting-line" role="status">
      <span className="who">{line.text}</span>
      {line.what ? <span className="muted"> — {line.what}</span> : null}
      <span className="clock"> · {sinceText(now - line.since)}</span>
      {line.who.length ? (
        <NeonButton
          small
          disabled={cooling}
          title={cooling ? 'Nudged — once a minute' : 'A sound and a flashing tab on their screen'}
          onClick={() => {
            setNudgedAt(Date.now());
            for (const p of line.who) nudge(p.id);
          }}
        >
          {cooling ? 'Nudged' : 'Nudge'}
        </NeonButton>
      ) : null}
    </div>
  );
}

/**
 * The table's humans who are not here (§5.3, V26): "reconnecting…" beside a closed seat, "(AI
 * standing in)" once a stand-in plays it, and for the host (or the first human here while the host
 * is away) the one button, **"Let an AI play for them"**. Nobody can be kicked, so there is no other.
 * Renders nothing while everybody is here.
 */
export function AwaySeats({ s, me }: { s: GameState; me: Player }) {
  const meta = useGame((g) => g.meta);
  const standIn = useGame((g) => g.standIn);
  if (!meta) return null;
  const away = s.players.filter(
    (p) => p.kind === 'human' && p.id !== me.id && !meta.online.includes(p.id),
  );
  if (!away.length) return null;
  const may = mayStandIn(s, meta, me.id);
  return (
    <div className="online-strip away">
      {away.map((p) => {
        const stood = meta.standIn.includes(p.id);
        return (
          <span key={p.id} className="away-seat">
            <StableName player={p} />{' '}
            <span className="muted">{stood ? '(AI standing in)' : 'reconnecting…'}</span>
            {!stood && may ? (
              <NeonButton
                small
                title="A Normal AI plays this stable whenever it is on the clock, until its player is back"
                onClick={() => standIn(p.id, true)}
              >
                Let an AI play for them
              </NeonButton>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
