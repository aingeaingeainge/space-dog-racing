import {
  formatBones,
  planetOf,
  RACE_CLASSES,
  type GameState,
  type Player,
  type RaceResult,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Delta, StableName } from '../components/ui';
import { CLASS_LABEL, playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

function RaceTable({ s, r, meId }: { s: GameState; r: RaceResult; meId: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Trap</th>
            <th>Dog</th>
            <th>Stable</th>
            <th className="num">Rating</th>
            <th className="num">Δ</th>
            <th className="num">Odds</th>
            <th className="num">Prize</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {r.order.map((dogId, i) => {
            const e = r.entries.find((x) => x.dogId === dogId);
            if (!e) return null;
            const owner = playerById(s, e.local ? null : e.ownerId);
            const pay = r.payouts.find((p) => p.dogId === dogId);
            const injury = r.injuries[dogId];
            const doped = r.dopingCaught.includes(dogId);
            return (
              <tr key={dogId} className={e.ownerId === meId ? 'me' : i > 2 ? 'dim' : ''}>
                <td>{i + 1}</td>
                <td>{e.trap}</td>
                <td>{e.name}</td>
                <td>
                  {owner ? (
                    <StableName player={owner} me={owner.id === meId} />
                  ) : (
                    <Badge>local</Badge>
                  )}
                </td>
                <td className="num">{e.rating}</td>
                <td className="num">
                  <Delta n={r.ratingDeltas[dogId] ?? 0} />
                </td>
                <td className="num">{e.odds.toFixed(2)}</td>
                <td className="num">{pay ? formatBones(pay.amount) : '—'}</td>
                <td>
                  {injury ? <Badge tone="bad">injured {injury}w</Badge> : null}
                  {doped ? <Badge tone="bad">stewards 💉</Badge> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** GDD §15.9 without the canvas: who won, what it paid, what it did to the ratings. */
export function Results({ s, me }: { s: GameState; me: Player }) {
  const ackResults = useGame((g) => g.ackResults);
  if (!s.races) return null;
  const planet = planetOf(s.planet.planetId);
  const mine = RACE_CLASSES.flatMap((cls) =>
    s.races![cls].payouts.filter((p) => p.playerId === me.id).map((p) => ({ cls, ...p })),
  );
  const won = mine.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="app">
      <Panel
        title={`Week ${s.week} results — ${planet.name}`}
        sub="prize money paid, ratings updated"
        actions={
          <button className="primary" onClick={ackResults}>
            Back to the planet
          </button>
        }
      >
        {mine.length ? (
          <p style={{ margin: 0 }}>
            You picked up <b>{formatBones(won)}</b>:{' '}
            {mine
              .map(
                (p) =>
                  `${CLASS_LABEL[p.cls]} ${p.place === 1 ? '1st' : p.place === 2 ? '2nd' : '3rd'}`,
              )
              .join(', ')}
            .
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Nothing in the money this weekend.
          </p>
        )}
      </Panel>

      {RACE_CLASSES.map((cls) => {
        const r = s.races![cls];
        const winner = r.entries.find((e) => e.dogId === r.order[0]);
        return (
          <Panel
            key={cls}
            title={`${CLASS_LABEL[cls]} — ${winner?.name ?? '?'}`}
            sub={`won by ${r.margin} m${r.photoFinish ? ' — photo finish!' : ''} · purse ${formatBones(r.purse[0])}`}
            tight
          >
            <RaceTable s={s} r={r} meId={me.id} />
          </Panel>
        );
      })}
    </div>
  );
}
