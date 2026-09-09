import type { GameState, Player } from '@sdr/engine';
import { NeonButton } from './NeonButton';
import { useKeys } from '../lib/keys';
import { venues, type VenueId } from '../lib/venues';
import { venueStatus } from '../lib/venueStatus';
import { useGame, type View } from '../store/gameStore';

/**
 * The venues of GDD §4.2 phase 3 as a tab strip, so venue-to-venue is still one click once you
 * are off the hub. A venue that is shut says why on the button rather than vanishing, and an
 * open one carries what is in it this week in its tooltip (lib/venueStatus.ts) — the same line
 * the hub's hotspot shows, so you never have to walk back to the hub to check.
 *
 * It is also where the planet phase's keyboard shortcuts live, since the strip is mounted exactly
 * when they apply (PLAYTEST_NOTES finding 4). One letter per venue, Enter for the thing the
 * primary button does, Escape back to the hub. Nothing fires while an event card is open — that
 * modal has to be answered first, and it takes the number keys itself.
 */
const KEY_FOR: Partial<Record<VenueId, string>> = {
  hub: 'h',
  market: 'm',
  stable: 'k',
  docks: 'd',
  saloon: 's',
  office: 'o',
  map: 'g',
};

export function Nav({ s, me }: { s: GameState; me: Player }) {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const leaderboard = useGame((g) => g.leaderboard);
  const setLeaderboard = useGame((g) => g.setLeaderboard);
  const pre = s.phase === 'planetPre';
  const status = venueStatus(s, me);
  const list = venues(s);
  const endPhase = () => dispatch({ t: 'EndPhase', playerId: me.id });

  // An event card owns the keyboard until it is answered.
  const live = !s.pendingEvent;
  const keys: Record<string, (() => void) | undefined> = {};
  if (live) {
    for (const v of list) {
      const key = KEY_FOR[v.id];
      if (key && v.open) keys[key] = () => setView(v.id as View);
    }
    keys.Enter = endPhase;
    keys.l = () => setLeaderboard(!leaderboard);
    // While the leaderboard is open Escape belongs to it (LeaderboardOverlay binds its own), so
    // one key closes whatever is on top instead of closing it *and* navigating underneath it.
    keys.Escape = leaderboard ? undefined : () => setView('hub');
  }
  useKeys(keys);

  return (
    <>
      <nav className="tabs">
        {list.map((v) => {
          const st = status[v.id];
          const key = KEY_FOR[v.id];
          const why = v.reason ?? st?.line;
          return (
            <NeonButton
              key={v.id}
              small
              variant={view === v.id ? 'primary' : 'default'}
              className={v.open && st?.worth ? 'has-stock' : undefined}
              disabled={!v.open || v.id === 'bookie'}
              title={key && v.open ? `${why ?? v.label} (key: ${key.toUpperCase()})` : why}
              onClick={() => setView(v.id as View)}
            >
              {v.label}
            </NeonButton>
          );
        })}
        <span className="spacer" />
        <NeonButton
          small
          variant="primary"
          title={`${pre ? 'Lock the card in and head to the track' : 'Jump to the next planet'} (key: Enter)`}
          onClick={endPhase}
        >
          {pre ? 'Head to the track' : 'End turn'}
        </NeonButton>
      </nav>
      <p className="keyhint muted">
        Keys:{' '}
        {list
          .filter((v) => v.open && KEY_FOR[v.id])
          .map((v) => `${KEY_FOR[v.id]!.toUpperCase()} ${v.label.toLowerCase()}`)
          .join(' · ')}{' '}
        · L leaderboard · Enter {pre ? 'to the track' : 'end turn'} · Esc hub
      </p>
    </>
  );
}
