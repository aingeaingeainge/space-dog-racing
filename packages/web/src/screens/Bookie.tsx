import { useState } from 'react';
import {
  bettingMargin,
  formatBones,
  maxStakeFraction,
  planetOf,
  purseFor,
  thisWeeksCard,
  type Bet,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import { FieldTable } from '../components/FieldTable';
import { Panel } from '../components/Panel';
import { Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { TicketCard } from '../components/TicketCard';
import { BettingSlip, type SlipRow } from '../components/BettingSlip';
import { useKeys } from '../lib/keys';
import { raceLabel, raceTone } from '../lib/selectors';
import {
  bookieBlindSpot,
  fieldMeanFitness,
  impliedProbability,
  stakeLine,
  stakeValue,
} from '../lib/priceTag';
import { useGame } from '../store/gameStore';

/**
 * GDD §10 and §15.8. The card is locked, the fields are public, and the bookie is open on any
 * dog in any race — including your own, which is the whole grimy point. Your slips stay yours:
 * nobody else at the table sees them, this week or ever.
 */
export function Bookie({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const runRaces = () => dispatch({ t: 'EndPhase', playerId: me.id });
  useKeys({ Enter: runRaces });
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
          <NeonButton variant="primary" onClick={runRaces} title="key: Enter">
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

      {thisWeeksCard(s).map((race) => (
        <RaceBetting key={race} s={s} me={me} race={race} margin={margin} frac={frac} />
      ))}
    </>
  );
}

function RaceBetting({
  s,
  me,
  race,
  margin,
  frac,
}: {
  s: GameState;
  me: Player;
  race: RaceTypeId;
  margin: number;
  frac: number;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const [stake, setStake] = useState(100);
  const field = s.fields!.find((f) => f.race === race)!.entries;
  const purse = purseFor(s, race);
  const bets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week && b.race === race);
  const already = bets.reduce((sum, b) => sum + b.stake, 0);
  const cap = Math.floor(me.cash * frac);
  const room = Math.max(0, Math.min(cap - already, Math.floor(me.cash)));
  const wanted = Math.max(0, Math.min(stake, room));

  const place = (dogId: string, kind: 'win' | 'place') =>
    dispatch({ t: 'PlaceBet', playerId: me.id, race, dogId, kind, stake: wanted });

  /**
   * The two sentences this screen was missing (GDD §10). A price is a ratio; a bet is in Bones —
   * so the stake dialled in is priced against the runner most worth pricing it against, and the
   * book's blind spot is named for every dog in the race where there is one to name.
   *
   * Own runners first, because a stable's own dogs are the ones whose fitness and stat bars it has
   * been looking at all week, and §5.3's informational edge is worth nothing unless somebody says
   * out loud that the book cannot see it.
   */
  const meanFit = fieldMeanFitness(s, field);
  const mine = field.filter((e) => e.ownerId === me.id);
  const priced = mine[0] ?? [...field].sort((a, b) => b.winProb - a.winProb)[0];
  const value = priced && wanted >= 10 ? stakeValue(wanted, priced.odds) : null;
  const blind = [...mine, ...field.filter((e) => e.ownerId !== me.id)]
    .map((e) => bookieBlindSpot(s, e, meanFit))
    .filter((x): x is string => !!x)
    .slice(0, 3);

  return (
    <TicketCard
      cls={raceLabel(race)}
      tone={raceTone(race, thisWeeksCard(s))}
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
        {value && priced ? (
          <span>
            <b>{formatBones(value.stake)}</b> on {priced.name} at {priced.odds.toFixed(2)}{' '}
            {stakeLine(value, formatBones)} · the book gives it{' '}
            {Math.round(impliedProbability(priced.odds, margin) * 100)}%
          </span>
        ) : null}
      </div>

      {blind.length ? <Notes lines={blind} /> : null}

      <FieldTable
        s={s}
        meId={me.id}
        field={field}
        margin={margin}
        oddsCell={(e, kind, odds) => {
          const v = stakeValue(wanted, odds);
          return (
            <NeonButton
              disabled={wanted < 10}
              title={
                wanted < 10
                  ? 'Set a stake first'
                  : `${formatBones(wanted)} ${kind === 'win' ? 'to win' : 'on a top-three finish'} — ` +
                    `${stakeLine(v, formatBones)}`
              }
              onClick={() => place(e.dogId, kind)}
            >
              {odds.toFixed(2)}
            </NeonButton>
          );
        }}
      />

      <BetSlips s={s} bets={bets} race={race} />
    </TicketCard>
  );
}

/** The kit's betting slip, open. The same component shows it settled on the Results screen. */
function BetSlips({ s, bets, race }: { s: GameState; bets: Bet[]; race: RaceTypeId }) {
  const rows: SlipRow[] = bets.map((b, i) => ({
    key: `${race}-${i}`,
    race: raceLabel(race),
    dog: s.dogs[b.dogId]?.name ?? 'that dog',
    kind: b.kind,
    stake: b.stake,
    odds: b.odds,
  }));
  return <BettingSlip title={`${raceLabel(race)} slips`} rows={rows} />;
}
