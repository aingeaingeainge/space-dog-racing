import { tipsFor, type GameState, type Player } from '@sdr/engine';
import { Panel } from './Panel';
import { playerById } from '../lib/selectors';

/**
 * Race-day tips this stable has been given (Phase D1 item 6) — and only this stable. The book does
 * not know them and never will; a buzzing dog is a bet, a knock on your own dog is a Race-or-Rest
 * decision. Nothing renders when there is nothing to say.
 */
export function Whispers({ s, me, where }: { s: GameState; me: Player; where: string }) {
  const tips = [...tipsFor(s, me.id).entries()];
  if (!tips.length) return null;
  return (
    <Panel title="Whispers" sub={`what you have been told this weekend — ${where}`}>
      <ul className="whispers">
        {tips.map(([dogId, row]) => {
          const d = s.dogs[dogId];
          if (!d) return null;
          const owner = typeof d.ownerId === 'string' ? playerById(s, d.ownerId) : undefined;
          const mine = d.ownerId === me.id;
          return (
            <li key={dogId}>
              <b>{d.name}</b>
              <span className="muted">
                {' '}
                ({mine ? 'yours' : (owner?.name ?? 'a local')})
              </span> is <b className={row.good ? 'up' : 'down'}>{row.name}</b>
              {row.good
                ? ' — it will run above itself on race day, and the book has no idea.'
                : mine
                  ? ' — it will run below itself on race day. Rest it, or run it knowing.'
                  : ' — it will run below itself on race day, whatever its price says.'}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
