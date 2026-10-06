import { useState } from 'react';
import {
  balance,
  bettingMargin,
  decimalOdds,
  formatBones,
  maxStakeCeiling,
  maxStakeFor,
  maxStakeFraction,
  purseFor,
  thisWeeksCard,
  type Bet,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import { FieldTable } from '../components/FieldTable';
import { Whispers } from '../components/Whispers';
import { Panel } from '../components/Panel';
import { Notes } from '../components/ui';
import { More } from '../components/More';
import { Guide } from '../components/Guide';
import { NeonButton } from '../components/NeonButton';
import { TicketCard } from '../components/TicketCard';
import { BettingSlip, type SlipRow } from '../components/BettingSlip';
import { useKeys } from '../lib/keys';
import { raceLabel, raceTone } from '../lib/selectors';
import { bookieBlindSpot, fieldMeanFitness, stakeLine, stakeValue } from '../lib/priceTag';
import { useGame } from '../store/gameStore';

/**
 * GDD §10 and §15.8. The card is locked, the fields are public, and the bookie is open on any
 * dog in any race — including your own, which is the whole grimy point. Your slips stay yours:
 * nobody else at the table sees them, this week or ever.
 */
export function Bookie({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const online = useGame((g) => g.source === 'online');
  const runRaces = () => dispatch({ t: 'EndPhase', playerId: me.id });
  useKeys({ Enter: runRaces });
  if (!s.fields) return null;
  const margin = bettingMargin(s);
  const frac = maxStakeFraction(s);
  // What this stable may have on one race here: the lesser of the fraction and the flat ceiling
  // (GDD_V3 §7.4, V21), whichever binds — a poor stable still sees its half of cash.
  const cap = maxStakeFor(s, me);
  const ceiling = maxStakeCeiling(s);
  const myBets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week);
  const staked = myBets.reduce((sum, b) => sum + b.stake, 0);
  const potential = myBets.reduce((sum, b) => sum + Math.round(b.stake * b.odds), 0);

  return (
    <>
      <Whispers s={s} me={me} where="the book prices the rating and the style, never this" />
      <Guide id="bookie">
        Back one of your dogs if you fancy it — or just press{' '}
        <b>{online ? 'Done betting' : 'Run the races'}</b>.
      </Guide>
      <Panel
        title="The bookie"
        sub={`max stake ${formatBones(cap)} a race`}
        actions={
          <NeonButton variant="primary" onClick={runRaces} title="key: Enter">
            {online ? 'Done betting' : 'Run the races'}
          </NeonButton>
        }
      >
        <div className="oneline">
          {myBets.length ? (
            <>
              On: <b>{formatBones(staked)}</b> across {myBets.length} slip
              {myBets.length === 1 ? '' : 's'}, returning <b>{formatBones(potential)}</b> if they
              all land.{' '}
            </>
          ) : margin < 0.15 ? (
            `A ${Math.round(margin * 100)}% book: the friendliest odds on the circuit. `
          ) : (
            'Nothing on yet. '
          )}
          <More label="How the bookie works">
            <Notes
              lines={[
                `The book takes ${Math.round(margin * 100)}%, so betting is a losing game unless you know something it does not — it prices the rating and the style, never the fitness or the shape of the field.`,
                `You may have up to ${formatBones(cap)} on one race: ${Math.round(frac * 100)}% of your cash or ${formatBones(ceiling)}, whichever is less${ceiling > balance.maxStake ? ` — the ceiling is doubled here` : ''}.`,
                'Win pays if the dog wins; place pays on a top-three finish. You can back your own dogs, or a rival. Nobody else sees your slips.',
                `${formatBones(me.cash)} in hand.`,
              ]}
            />
          </More>
        </div>
      </Panel>

      {thisWeeksCard().map((race) => (
        <RaceBetting key={race} s={s} me={me} race={race} margin={margin} />
      ))}
    </>
  );
}

function RaceBetting({
  s,
  me,
  race,
  margin,
}: {
  s: GameState;
  me: Player;
  race: RaceTypeId;
  margin: number;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const [stake, setStake] = useState(100);
  const [book, setBook] = useState(false);
  const field = s.fields!.find((f) => f.race === race)!.entries;
  const purse = purseFor(s, race);
  const bets = s.bets.filter((b) => b.playerId === me.id && b.week === s.week && b.race === race);
  const already = bets.reduce((sum, b) => sum + b.stake, 0);
  // Both ceilings, the lower binding — the same rule `placeBet` enforces, so the slider cannot
  // offer a stake the reducer would refuse (GDD §10, §20 Q7).
  const cap = maxStakeFor(s, me);
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

  const oddsButton = (e: (typeof field)[number], kind: 'win' | 'place', odds: number) => {
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
  };

  return (
    <TicketCard
      cls={raceLabel(race)}
      tone={raceTone(race)}
      cap="odds"
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
        {room < 10 ? (
          <span className="muted">
            {already > 0
              ? `At the limit for this race (${formatBones(cap)}).`
              : 'Not enough cash for a bet here.'}
          </span>
        ) : null}
      </div>

      {/* Phase P: your own runner first, in one line, with its two prices; the full book of eight
          is one press away. Most weekends a new player's bet, if any, is on their own dog. */}
      {mine.length ? (
        <div className="stack">
          {mine.map((e) => (
            <div key={e.dogId} className="row tight my-runner">
              <span>
                <b>{e.name}</b> <span className="muted">trap {e.trap}</span>
              </span>
              <span className="muted">to win</span>
              {oddsButton(e, 'win', e.odds)}
              <span className="muted">to place</span>
              {oddsButton(e, 'place', decimalOdds(e.placeProb, margin))}
            </div>
          ))}
          {value && priced ? (
            <span className="muted">
              {formatBones(value.stake)} on {priced.name} {stakeLine(value, formatBones)}.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="muted tight-p">No runner of yours in this one.</p>
      )}

      {blind.length ? <Notes lines={blind.slice(0, 1)} /> : null}

      <NeonButton variant="link" aria-expanded={book} onClick={() => setBook(!book)}>
        {book ? 'Hide the full book ▾' : `Full book: all ${field.length} dogs ▸`}
      </NeonButton>
      {book ? (
        <FieldTable s={s} meId={me.id} field={field} margin={margin} oddsCell={oddsButton} />
      ) : null}

      {bets.length ? <BetSlips s={s} bets={bets} race={race} /> : null}
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
