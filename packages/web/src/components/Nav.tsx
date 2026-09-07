import type { GameState, Player } from '@sdr/engine';
import { NeonButton } from './NeonButton';
import { venues } from '../lib/venues';
import { venueStatus } from '../lib/venueStatus';
import { useGame, type View } from '../store/gameStore';

/**
 * The venues of GDD §4.2 phase 3 as a tab strip, so venue-to-venue is still one click once you
 * are off the hub. A venue that is shut says why on the button rather than vanishing, and an
 * open one carries what is in it this week in its tooltip (lib/venueStatus.ts) — the same line
 * the hub's hotspot shows, so you never have to walk back to the hub to check.
 */
export function Nav({ s, me }: { s: GameState; me: Player }) {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const pre = s.phase === 'planetPre';
  const status = venueStatus(s, me);

  return (
    <nav className="tabs">
      {venues(s).map((v) => {
        const st = status[v.id];
        return (
          <NeonButton
            key={v.id}
            small
            variant={view === v.id ? 'primary' : 'default'}
            className={v.open && st?.worth ? 'has-stock' : undefined}
            disabled={!v.open || v.id === 'bookie'}
            title={v.reason ?? st?.line}
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
        onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}
      >
        {pre ? 'Head to the track' : 'End turn'}
      </NeonButton>
    </nav>
  );
}
