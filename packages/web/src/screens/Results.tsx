import { formatBones, planetOf, type GameState, type Player, type RaceResult } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Delta, StableName, Traits } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { BettingSlip, type SlipRow } from '../components/BettingSlip';
import { OwnerFace } from '../components/Owner';
import { useKeys } from '../lib/keys';
import { playerById, raceLabel } from '../lib/selectors';
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
            <th>Traits</th>
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
                    <span className="owner-cell">
                      <OwnerFace player={owner} />
                      <StableName player={owner} me={owner.id === meId} />
                    </span>
                  ) : (
                    <Badge>local</Badge>
                  )}
                </td>
                <td className="num">{e.rating}</td>
                <td className="wrap">
                  <Traits ids={s.dogs[dogId]?.traits ?? []} />
                </td>
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
  useKeys({ Enter: ackResults, ' ': ackResults });
  if (!s.races) return null;
  const planet = planetOf(s.planet.planetId);
  const mine = s.races.flatMap((r) =>
    r.payouts.filter((p) => p.playerId === me.id).map((p) => ({ race: r.race, ...p })),
  );
  const won = mine.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="app">
      <Panel
        title={`Week ${s.week} results — ${planet.name}`}
        sub="prize money paid, ratings updated"
        actions={
          <NeonButton variant="primary" onClick={ackResults} title="key: Enter">
            Back to the planet
          </NeonButton>
        }
      >
        {mine.length ? (
          <p className="flush">
            You picked up <b>{formatBones(won)}</b>:{' '}
            {mine
              .map(
                (p) =>
                  `${raceLabel(p.race)} ${p.place === 1 ? '1st' : p.place === 2 ? '2nd' : '3rd'}`,
              )
              .join(', ')}
            .
          </p>
        ) : (
          <p className="muted flush">Nothing in the money this weekend.</p>
        )}
      </Panel>

      <BetsSettled s={s} me={me} />

      {s.races.map((r) => {
        const winner = r.entries.find((e) => e.dogId === r.order[0]);
        return (
          <Panel
            key={r.race}
            title={`${raceLabel(r.race)} — ${winner?.name ?? '?'}`}
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

/** GDD §10: every slip you had on this weekend, and what it did to the cash. */
function BetsSettled({ s, me }: { s: GameState; me: Player }) {
  const bets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week);
  if (!bets.length) return null;
  const staked = bets.reduce((sum, b) => sum + b.stake, 0);
  const returned = bets.reduce((sum, b) => sum + (b.settled?.payout ?? 0), 0);
  const net = returned - staked;

  const rows: SlipRow[] = bets.map((b, i) => ({
    key: String(i),
    race: raceLabel(b.race),
    dog: s.dogs[b.dogId]?.name ?? 'that dog',
    kind: b.kind,
    stake: b.stake,
    odds: b.odds,
    won: b.settled?.won ?? false,
    payout: b.settled?.payout ?? 0,
  }));

  return (
    <div className="slip-wrap">
      <BettingSlip
        title="Your bets"
        settled
        rows={rows}
        net={`${net >= 0 ? '+' : ''}${formatBones(net)} on the day`}
      />
      <p className="muted small-print">
        Staked {formatBones(staked)}, returned {formatBones(returned)}. Nobody else at the table
        sees these.
      </p>
    </div>
  );
}
