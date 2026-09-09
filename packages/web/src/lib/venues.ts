import { planetOf, type GameState } from '@sdr/engine';
import { bookieOpen } from './selectors';
import type { View } from '../store/gameStore';

export type VenueId = View | 'bookie';

export interface Venue {
  id: VenueId;
  label: string;
  /** Can the player use it right now? */
  open: boolean;
  /** Why not — shown on the disabled button and on the hub (GDD §15.3). */
  reason?: string;
}

/**
 * The six venues of GDD §4.2 phase 3 plus the map, with the reason each one is shut when it is.
 * A planet that has no bookie says so rather than silently dropping the button, so the planet's
 * special rules are legible from the hub.
 */
export function venues(s: GameState): Venue[] {
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const post = s.phase === 'planetPost';
  const inTurn = pre || post;
  const shut = inTurn ? undefined : 'Not while the races are on';

  const bookie: Venue = !bookieOpen(s)
    ? {
        id: 'bookie',
        label: 'Bookie',
        open: false,
        reason: s.toggles.betting ? `No bookie on ${planet.name}` : 'No betting this season',
      }
    : s.phase === 'betting'
      ? { id: 'bookie', label: 'Bookie', open: true }
      : { id: 'bookie', label: 'Bookie', open: false, reason: 'Opens when the card locks' };

  return [
    { id: 'hub', label: 'Planet hub', open: true },
    { id: 'market', label: 'Market', open: inTurn, reason: shut },
    { id: 'stable', label: 'Kennels', open: true },
    { id: 'docks', label: 'Docks', open: inTurn, reason: shut },
    { id: 'saloon', label: 'Saloon', open: inTurn, reason: shut },
    bookie,
    {
      id: 'office',
      label: 'Race Office',
      open: pre,
      reason: pre ? undefined : 'The card is closed for this weekend',
    },
    { id: 'map', label: 'Galaxy map', open: true },
  ];
}
