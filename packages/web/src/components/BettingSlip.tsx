import type { ReactNode } from 'react';
import { formatBones } from '@sdr/engine';

export interface SlipRow {
  key: string;
  /** Race class, or whatever the left column should say. */
  race: ReactNode;
  dog: ReactNode;
  kind: 'win' | 'place';
  stake: number;
  odds: number;
  /** Absent while the race has not run. */
  won?: boolean;
  payout?: number;
}

/**
 * GDD §16 "betting slip". Your slips and nobody else's: M1 decision 3 says a slip is private
 * for good, and no screen has ever rendered another stable's. The bookie shows it open, the
 * results screen shows the same slip settled — same component, `won` filled in.
 */
export function BettingSlip({
  title = 'Your slips',
  rows,
  net,
  empty = 'Nothing on this race.',
  settled,
}: {
  title?: ReactNode;
  rows: readonly SlipRow[];
  /** Shown top-right: what is riding on it, or what it came to. */
  net?: ReactNode;
  empty?: ReactNode;
  /** True once the races have run, which switches the last column to the payout. */
  settled?: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="slip">
        <h4>
          {title}
          {net ? <span className="net">{net}</span> : null}
        </h4>
        <p className="empty">{empty}</p>
      </div>
    );
  }
  const staked = rows.reduce((sum, r) => sum + r.stake, 0);
  const returned = rows.reduce((sum, r) => sum + (r.payout ?? 0), 0);
  const potential = rows.reduce((sum, r) => sum + Math.round(r.stake * r.odds), 0);

  return (
    <div className="slip">
      <h4>
        {title}
        {net ? <span className="net">{net}</span> : null}
      </h4>
      <table>
        <thead>
          <tr>
            <th>Race</th>
            <th>Dog</th>
            <th>Bet</th>
            <th className="num">Stake</th>
            <th className="num">Odds</th>
            <th className="num">{settled ? 'Payout' : 'Returns'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={settled ? (r.won ? 'won' : 'lost') : undefined}>
              <td>{r.race}</td>
              <td>{r.dog}</td>
              <td>{r.kind === 'win' ? 'Win' : 'Place'}</td>
              <td className="num">{formatBones(r.stake)}</td>
              <td className="num">{r.odds.toFixed(2)}</td>
              <td className="num">
                {settled
                  ? r.won
                    ? formatBones(r.payout ?? 0)
                    : '—'
                  : formatBones(Math.round(r.stake * r.odds))}
              </td>
            </tr>
          ))}
          <tr className="total">
            <td colSpan={3}>Total</td>
            <td className="num">{formatBones(staked)}</td>
            <td />
            <td className="num">{formatBones(settled ? returned : potential)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
