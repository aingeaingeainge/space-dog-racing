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
import { NeonButton } from '../components/NeonButton';
import { TicketCard } from '../components/TicketCard';
import { BettingSlip, type SlipRow } from '../components/BettingSlip';
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
          <NeonButton variant="primary" onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}>
            Run the races
          </NeonButton>
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

      {RACE_CLASSES.map((cls) => (
        <RaceBetting key={cls} s={s} me={me} cls={cls} margin={margin} frac={frac} />
      ))}
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
    <TicketCard
      cls={CLASS_LABEL[cls]}
      cap="trap draw and odds"
      purse={formatBones(purse[0])}
      serial={`2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
    >
      <div className="stack stake">
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
              const disabled = wanted < 10;
              return (
                <tr key={e.dogId} className={e.ownerId === me.id ? 'me' : ''}>
                  <td>{e.trap}</td>
                  <td>
                    <b>{e.name}</b>
                    {d && d.ownerId === me.id && d.supplemented ? (
                      <Badge tone="hot" title="you fed this one a supplement — the bookie does not know">
                        💉
                      </Badge>
                    ) : null}
                  </td>
                  <td>
                    {owner ? (
                      <StableName player={owner} me={owner.id === me.id} />
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
                    <NeonButton
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Set a stake first'
                          : `${formatBones(wanted)} to win — returns ${formatBones(Math.round(wanted * e.odds))}`
                      }
                      onClick={() => place(e.dogId, 'win')}
                    >
                      {e.odds.toFixed(2)}
                    </NeonButton>
                  </td>
                  <td className="num">
                    <NeonButton
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Set a stake first'
                          : `${formatBones(wanted)} on a top-three finish — returns ${formatBones(Math.round(wanted * placeOdds))}`
                      }
                      onClick={() => place(e.dogId, 'place')}
                    >
                      {placeOdds.toFixed(2)}
                    </NeonButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BetSlips s={s} bets={bets} cls={cls} />
    </TicketCard>
  );
}

/** The kit's betting slip, open. The same component shows it settled on the Results screen. */
function BetSlips({ s, bets, cls }: { s: GameState; bets: Bet[]; cls: RaceClass }) {
  const rows: SlipRow[] = bets.map((b, i) => ({
    key: `${cls}-${i}`,
    race: CLASS_LABEL[cls],
    dog: s.dogs[b.dogId]?.name ?? 'that dog',
    kind: b.kind,
    stake: b.stake,
    odds: b.odds,
  }));
  return <BettingSlip title={`${CLASS_LABEL[cls]} slips`} rows={rows} />;
}
