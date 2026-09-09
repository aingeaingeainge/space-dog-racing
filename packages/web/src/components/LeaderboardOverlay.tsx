import { formatBones, type GameState, type Id } from '@sdr/engine';
import { useKeys } from '../lib/keys';
import { standings } from '../lib/selectors';
import { Modal, StableName } from './ui';
import { OwnerBlurb, OwnerFace } from './Owner';
import { useGame } from '../store/gameStore';

/** GDD §15.10 — everything public, reachable from every screen. Escape shuts it, like any modal. */
export function LeaderboardOverlay({ s, meId }: { s: GameState; meId: Id | null }) {
  const setLeaderboard = useGame((g) => g.setLeaderboard);
  const close = () => setLeaderboard(false);
  useKeys({ Escape: close, l: close });
  const rows = standings(s);
  return (
    <Modal
      title="Leaderboard"
      sub={`week ${s.week} of ${s.calendar.length} — net worth decides the season`}
      onClose={() => setLeaderboard(false)}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Stable</th>
              <th className="num">Cash</th>
              <th className="num">Dogs</th>
              <th className="num">Ship</th>
              <th className="num">Cargo</th>
              <th className="num">Debt</th>
              <th className="num">Net worth</th>
              <th className="num">Gold wins</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.player.id}
                className={r.player.id === meId ? 'me' : r.player.flags.bankrupt ? 'dim' : ''}
              >
                <td>{i + 1}</td>
                <td>
                  <span className="owner-cell">
                    <OwnerFace player={r.player} />
                    <span>
                      <StableName player={r.player} me={r.player.id === meId} />
                      <OwnerBlurb player={r.player} />
                    </span>
                  </span>
                </td>
                <td className="num">{formatBones(r.cash)}</td>
                <td className="num">{formatBones(r.dogs)}</td>
                <td className="num">{formatBones(r.ship)}</td>
                <td className="num">{formatBones(r.cargo)}</td>
                <td className="num">{r.debt ? formatBones(-r.debt) : '—'}</td>
                <td className="num">
                  <b>{formatBones(r.netWorth)}</b>
                </td>
                <td className="num">{r.goldWins}</td>
                <td>
                  {r.player.flags.caughtDoping ? <span title="caught doping">💉</span> : null}
                  {r.player.flags.bankrupt ? <span title="bankrupt"> 💀</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted flush-b">
        Net worth = cash + dogs + ship + cargo − debt (GDD §4.3). Tie-break: most Gold wins.
      </p>
    </Modal>
  );
}
