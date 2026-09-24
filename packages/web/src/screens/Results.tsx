import {
  formatBones,
  planetOf,
  STYLE_BY_ID,
  type GameState,
  type Player,
  type RaceResult,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Delta, Notes, StableName, StyleTag, Traits } from '../components/ui';
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
            <th>Ran as</th>
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
            // How it ran (GDD_V3 §5.2): public now it has raced, and the day's expression in words.
            const run = r.runs?.[r.entries.indexOf(e)];
            const day = !run
              ? ''
              : run.style === 'stalker'
                ? ''
                : run.expression >= 1.1
                  ? 'all out'
                  : run.expression <= 0.5
                    ? 'barely'
                    : '';
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
                <td>
                  {run ? <StyleTag style={run.style} /> : null}
                  {day ? <span className="muted"> {day}</span> : null}
                </td>
                <td className="wrap">
                  <Traits ids={s.dogs[dogId]?.traits ?? []} />
                </td>
                <td className="num">
                  <Delta n={r.ratingDeltas[dogId] ?? 0} />
                </td>
                <td className="num">{e.odds.toFixed(2)}</td>
                <td className="num">{pay ? formatBones(pay.amount) : '—'}</td>
                <td>{injury ? <Badge tone="bad">injured {injury}w</Badge> : null}</td>
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
  const dispatch = useGame((g) => g.dispatch);
  // Phase D1 (§10.1's click budget): "Back to the planet" then "End turn" is two presses for a
  // player with nothing left to do here — and after the races, most weeks, there is nothing. One
  // press does both. The hub is still one press away for anyone who wants to sell.
  const canFly = s.phase === 'planetPost' && s.activePlayer === me.id;
  const next = s.calendar[s.week];
  const flyOn = () => {
    ackResults();
    dispatch({ t: 'EndPhase', playerId: me.id });
  };
  useKeys({ Enter: ackResults, ' ': ackResults, f: canFly ? flyOn : undefined });
  if (!s.races) return null;
  const planet = planetOf(s.planet.planetId);
  const mine = s.races.flatMap((r) =>
    r.payouts.filter((p) => p.playerId === me.id).map((p) => ({ race: r.race, ...p })),
  );
  const won = mine.reduce((sum, p) => sum + p.amount, 0);
  const taken = mine.reduce((sum, p) => sum + (p.commission ?? 0), 0);

  return (
    <div className="app">
      <Panel
        title={`Week ${s.week} results — ${planet.name}`}
        sub="prize money paid, ratings updated"
        actions={
          <>
            <NeonButton variant="primary" onClick={ackResults} title="key: Enter">
              Back to the planet
            </NeonButton>
            {canFly ? (
              <NeonButton onClick={flyOn} title="key: F — ends your turn here">
                {next ? `Fly on to ${planetOf(next.planetId).name}` : 'End the season'}
              </NeonButton>
            ) : null}
          </>
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
            {taken ? (
              <span className="muted">
                {' '}
                Your trainers took {formatBones(taken)} of it — their cut of the purses.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="muted flush">Nothing in the money this weekend.</p>
        )}
      </Panel>

      <Stewards s={s} />

      <YourJobs s={s} me={me} />

      <Revealed s={s} />

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

/**
 * GDD_V3 §9.3: **the whole table is told who did it.** Every nobbler the stewards caught this weekend,
 * named, with the fine — on everybody's Results, not only the victim's.
 */
function Stewards({ s }: { s: GameState }) {
  const found = (s.races ?? []).flatMap((r) => r.stewards.map((f) => ({ race: r.race, ...f })));
  if (!found.length) return null;
  return (
    <Panel title="Stewards' enquiry" sub="a dog was got at — and the stewards know who did it">
      {found.map((f, i) => {
        const who = playerById(s, f.playerId);
        const dog = s.dogs[f.dogId];
        return (
          <p key={i} className="notice error flush">
            <b>{who?.name ?? 'Somebody'}</b> nobbled <b>{dog?.name ?? 'a dog'}</b> in the{' '}
            {raceLabel(f.race)}. Fined {formatBones(f.fine)}.
          </p>
        );
      })}
    </Panel>
  );
}

/**
 * What this stable's own Back Alley jobs did this weekend (GDD_V3 §9.3) — private, unless the stewards
 * made it public above. A nobble that bit and was not caught is known only to the stable that paid
 * for it.
 */
const nth = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

function YourJobs({ s, me }: { s: GameState; me: Player }) {
  const jobs = s.jobs.filter((j) => j.by === me.id);
  if (!jobs.length || !s.races) return null;
  const lines = jobs.map((j) => {
    if (j.kind === 'box')
      return j.race && j.box
        ? `The steward's box: box ${j.box} in the ${raceLabel(j.race)}.`
        : 'The steward’s box was never named, so it was never used.';
    const dog = j.dogId ? s.dogs[j.dogId] : undefined;
    const ran = s.races!.find((r) => r.order.includes(j.dogId ?? ''));
    if (!ran) return `${dog?.name ?? 'The dog'} never ran, so the nobble came to nothing.`;
    const caught = ran.stewards.some((f) => f.playerId === me.id && f.dogId === j.dogId);
    const place = ran.order.indexOf(j.dogId!) + 1;
    return caught
      ? `${dog?.name} ran nobbled in the ${raceLabel(ran.race)} (${nth(place)}) — and the stewards saw.`
      : `${dog?.name} ran nobbled in the ${raceLabel(ran.race)} and finished ${nth(place)}. Nobody saw a thing.`;
  });
  return (
    <Panel title="Your business in the Back Alley" sub="only you see this">
      <Notes lines={lines} />
    </Panel>
  );
}

/**
 * GDD_V3 §5.4: the styles this weekend made public — every stable dog that ran for the first time,
 * and any the elimination gave away. Written out once here and on the dog card from now on, so
 * nobody at the table needs a pen.
 */
function Revealed({ s }: { s: GameState }) {
  if (!s.races) return null;
  const firstTime = new Map<string, string>();
  for (const r of s.races)
    r.entries.forEach((e, i) => {
      if (!e.local && e.style === null && r.runs?.[i]) firstTime.set(e.dogId, e.name);
    });
  if (!firstTime.size) return null;
  const lines = [...firstTime.keys()].map((id) => {
    const d = s.dogs[id]!;
    return `${d.name} is a ${STYLE_BY_ID[d.style].name.toLowerCase()}`;
  });
  return (
    <Panel
      title="New on the card"
      sub="styles the table has now seen — on every dog card from here on"
    >
      <p className="flush">{lines.join(' · ')}.</p>
    </Panel>
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
