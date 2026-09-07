import { useState } from 'react';
import {
  bettingMargin,
  decimalOdds,
  formatBones,
  maxStakeFraction,
  planetOf,
  purseFor,
  RACE_CLASSES,
  type Bet,
  type GameState,
  type Player,
  type RaceClass,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Notes, StableName, Traits } from '../components/ui';
import { CLASS_LABEL, playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §10 and §15.8. The card is locked, the fields are public, and the bookie is open on any
 * dog in any race — including your own, which is the whole grimy point. Your slips stay yours:
 * nobody else at the table sees them, this week or ever.
 */
export function Bookie({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  if (!s.fields) return null;
  const planet = planetOf(s.planet.planetId);
  const margin = bettingMargin(s);
  const frac = maxStakeFraction(s);
  const myBets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week);
  const staked = myBets.reduce((sum, b) => sum + b.stake, 0);
  const potential = myBets.reduce((sum, b) => sum + Math.round(b.stake * b.odds), 0);

  return (
    <>
      <Panel
        title="The bookie"
        sub={`${planet.name} · margin ${Math.round(margin * 100)}% · max stake ${Math.round(frac * 100)}% of cash per race`}
        actions={
          <button className="primary" onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}>
            Run the races
          </button>
        }
      >
        <div className="row spread">
          <span>
            On at the moment: <b>{formatBones(staked)}</b> across {myBets.length} slip
            {myBets.length === 1 ? '' : 's'} · returns <b>{formatBones(potential)}</b> if every one
            of them lands
          </span>
          <span className="muted">{formatBones(me.cash)} left in hand</span>
        </div>
        <Notes
          lines={[
            margin < 0.15
              ? `A ${Math.round(margin * 100)}% book — the friendliest odds on the circuit.`
              : `The book takes ${Math.round(margin * 100)}%, so betting is a losing game unless you know something.`,
            frac >= 1
              ? 'Collar Prime lets you stake everything you have on a single race.'
              : `You may not have more than ${Math.round(frac * 100)}% of your cash on any one race.`,
            'You can back your own dogs, or lay into a rival. Nobody else at this table sees your slips.',
          ]}
        />
      </Panel>

      <div className="grid3">
        {RACE_CLASSES.map((cls) => (
          <RaceBetting key={cls} s={s} me={me} cls={cls} margin={margin} frac={frac} />
        ))}
      </div>
    </>
  );
}

function RaceBetting({
  s,
  me,
  cls,
  margin,
  frac,
}: {
  s: GameState;
  me: Player;
  cls: RaceClass;
  margin: number;
  frac: number;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const [stake, setStake] = useState(100);
  const field = s.fields![cls];
  const purse = purseFor(s, cls);
  const bets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week && b.cls === cls);
  const already = bets.reduce((sum, b) => sum + b.stake, 0);
  const cap = Math.floor(me.cash * frac);
  const room = Math.max(0, Math.min(cap - already, Math.floor(me.cash)));
  const wanted = Math.max(0, Math.min(stake, room));

  const place = (dogId: string, kind: 'win' | 'place') =>
    dispatch({ t: 'PlaceBet', playerId: me.id, cls, dogId, kind, stake: wanted });

  return (
    <Panel
      key={cls}
      title={`${CLASS_LABEL[cls]} — ${formatBones(purse[0])}`}
      sub={`trap draw, odds and your slips · 2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
    >
      <div className="stack" style={{ marginBottom: 8 }}>
        <label>
          <span className="muted">Stake</span>{' '}
          <input
            type="range"
            min={10}
            max={Math.max(10, room)}
            step={10}
            value={wanted || 10}
            disabled={room < 10}
            onChange={(e) => setStake(Number(e.target.value))}
          />{' '}
          <b>{formatBones(wanted)}</b>
        </label>
        <span className="muted">
          {room < 10
            ? already > 0
              ? `You are at the limit for this race (${formatBones(cap)}).`
              : 'Not enough cash for a bet on this race.'
            : `Room for ${formatBones(room)} more on this race.`}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Trap</th>
              <th>Dog</th>
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
              const disabled = wanted < 10;
              return (
                <tr key={e.dogId} className={e.ownerId === me.id ? 'me' : ''}>
                  <td>{e.trap}</td>
                  <td style={{ whiteSpace: 'normal' }}>
                    {e.name}
                    {d && d.ownerId === me.id && d.supplemented ? (
                      <Badge tone="hot" title="you fed this one a supplement — the bookie does not know">
                        💉
                      </Badge>
                    ) : null}
                    <br />
                    {owner ? (
                      <span style={{ fontSize: 12 }}>
                        <StableName player={owner} me={owner.id === me.id} />
                      </span>
                    ) : (
                      <Badge>local</Badge>
                    )}
                    <div style={{ fontSize: 11 }}>
                      <Traits ids={d?.traits ?? []} />
                    </div>
                  </td>
                  <td className="num">{e.rating}</td>
                  <td className="num">{d ? d.fitness : '—'}</td>
                  <td className="num">
                    <button
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Set a stake first'
                          : `${formatBones(wanted)} to win — returns ${formatBones(Math.round(wanted * e.odds))}`
                      }
                      onClick={() => place(e.dogId, 'win')}
                    >
                      {e.odds.toFixed(2)}
                    </button>
                  </td>
                  <td className="num">
                    <button
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Set a stake first'
                          : `${formatBones(wanted)} on a top-three finish — returns ${formatBones(Math.round(wanted * placeOdds))}`
                      }
                      onClick={() => place(e.dogId, 'place')}
                    >
                      {placeOdds.toFixed(2)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BetSlips s={s} bets={bets} />
    </Panel>
  );
}

function BetSlips({ s, bets }: { s: GameState; bets: Bet[] }) {
  if (!bets.length)
    return (
      <p className="muted" style={{ marginBottom: 0 }}>
        Nothing on this race.
      </p>
    );
  const total = bets.reduce((sum, b) => sum + b.stake, 0);
  return (
    <table>
      <tbody>
        {bets.map((b, i) => (
          <tr key={i}>
            <td>{s.dogs[b.dogId]?.name ?? 'that dog'}</td>
            <td className="muted">{b.kind}</td>
            <td className="num">{formatBones(b.stake)}</td>
            <td className="num">@ {b.odds.toFixed(2)}</td>
            <td className="num">{formatBones(Math.round(b.stake * b.odds))}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={2}>
            <b>On this race</b>
          </td>
          <td className="num">
            <b>{formatBones(total)}</b>
          </td>
          <td colSpan={2} />
        </tr>
      </tbody>
    </table>
  );
}
