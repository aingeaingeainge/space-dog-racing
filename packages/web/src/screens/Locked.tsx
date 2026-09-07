import { formatBones, purseFor, RACE_CLASSES, type GameState, type Player } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, StableName } from '../components/ui';
import { CLASS_LABEL, playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §4.2 step 4: the card is locked and the fields are public. The bookie opens in this phase
 * (session 2); for now this is the last look at the field before the traps go up.
 */
export function Locked({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  if (!s.fields) return null;

  return (
    <>
      <Panel
        title="Declarations locked"
        sub="traps drawn, odds posted"
        actions={
          <button className="primary" onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}>
            Run the races
          </button>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          Betting opens on this screen next session. The AI stables have already had their bets on.
        </p>
      </Panel>

      <div className="grid3">
        {RACE_CLASSES.map((cls) => {
          const purse = purseFor(s, cls);
          return (
            <Panel
              key={cls}
              title={`${CLASS_LABEL[cls]} — ${formatBones(purse[0])}`}
              sub="trap draw and bookie's odds"
              tight
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Trap</th>
                      <th>Dog</th>
                      <th className="num">Rating</th>
                      <th className="num">Odds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.fields![cls].map((e) => {
                      const owner = playerById(s, e.local ? null : e.ownerId);
                      return (
                        <tr key={e.dogId} className={e.ownerId === me.id ? 'me' : ''}>
                          <td>{e.trap}</td>
                          <td>
                            {e.name}
                            <br />
                            {owner ? (
                              <span style={{ fontSize: 12 }}>
                                <StableName player={owner} me={owner.id === me.id} />
                              </span>
                            ) : (
                              <Badge>local</Badge>
                            )}
                          </td>
                          <td className="num">{e.rating}</td>
                          <td className="num">{e.odds.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
