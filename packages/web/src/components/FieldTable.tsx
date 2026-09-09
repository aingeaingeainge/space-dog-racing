import type { ReactNode } from 'react';
import { decimalOdds, type GameState, type Id, type RaceEntry } from '@sdr/engine';
import { DogThumb } from './DogCard';
import { Badge, StableName, Traits } from './ui';
import { playerById } from '../lib/selectors';

/**
 * A locked field: trap draw, who owns what, and the price of each runner.
 *
 * The same table serves the bookie and the no-bookie weeks. On a betting week the odds are
 * buttons that strike a bet; on Holy Bark, or with the No Betting toggle on, they are just the
 * prices — the field, the traps and the market's opinion are worth seeing whether or not you can
 * back any of it, which is the whole reason those weeks used to feel thin.
 */
export function FieldTable({
  s,
  meId,
  field,
  margin,
  oddsCell,
}: {
  s: GameState;
  meId: Id;
  field: readonly RaceEntry[];
  margin: number;
  /** Render the win/place price as something clickable. Omitted, it is printed as a number. */
  oddsCell?: (entry: RaceEntry, kind: 'win' | 'place', odds: number) => ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trap</th>
            <th>Dog</th>
            <th>Stable</th>
            <th>Traits</th>
            <th className="num">Rating</th>
            <th className="num">Fit</th>
            <th className="num">Win</th>
            <th className="num">Place</th>
          </tr>
        </thead>
        <tbody>
          {field.map((e) => {
            const owner = playerById(s, e.local ? null : e.ownerId);
            const d = s.dogs[e.dogId];
            const placeOdds = decimalOdds(e.placeProb, margin);
            return (
              <tr key={e.dogId} className={e.ownerId === meId ? 'me' : ''}>
                <td>{e.trap}</td>
                <td>
                  {d ? <DogThumb dog={d} /> : null}
                  <b>{e.name}</b>
                  {d && d.ownerId === meId && d.supplemented ? (
                    <Badge tone="hot" title="you fed this one a supplement — the bookie does not know">
                      💉
                    </Badge>
                  ) : null}
                </td>
                <td>
                  {owner ? (
                    <StableName player={owner} me={owner.id === meId} />
                  ) : (
                    <Badge>local</Badge>
                  )}
                </td>
                <td className="wrap">
                  <Traits ids={d?.traits ?? []} />
                </td>
                <td className="num">{e.rating}</td>
                <td className="num">{d ? d.fitness : '—'}</td>
                <td className="num">
                  {oddsCell ? oddsCell(e, 'win', e.odds) : e.odds.toFixed(2)}
                </td>
                <td className="num">
                  {oddsCell ? oddsCell(e, 'place', placeOdds) : placeOdds.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
