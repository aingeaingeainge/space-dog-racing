import {
  hasStaff,
  vetRestBonus,
  balance,
  dogValue,
  dopingCatchRate,
  formatBones,
  netWorthBreakdown,
  cargoTotal,
  planetOf,
  upgradePrice,
  weekStatusOf,
  weeklyFitnessDelta,
  STAT_KEYS,
  WEEK_STATES,
  type Dog,
  type GameState,
  type Player,
  type StatKey,
  type UpgradeId,
  type WeekState,
} from '@sdr/engine';
import { DogCard } from '../components/DogCard';
import { NeonButton } from '../components/NeonButton';
import { Panel } from '../components/Panel';
import { Badge, KV, Notes } from '../components/ui';
import {
  cannotRunReason,
  declaredRace,
  fitnessOutlook,
  ownedDogs,
  raceLabel,
  weeklyBill,
} from '../lib/selectors';
import { useGame } from '../store/gameStore';

function status(d: Dog): { text: string; tone?: 'bad' | 'hot' } {
  if (d.injuryWeeks > 0) return { text: `injured ${d.injuryWeeks}w`, tone: 'bad' };
  if (d.banWeeks > 0) return { text: `banned ${d.banWeeks}w`, tone: 'bad' };
  if (d.fitness < balance.fitnessScaleBelow) return { text: 'jaded', tone: 'hot' };
  return { text: 'fit' };
}

const STATE_LABEL: Record<WeekState, string> = {
  race: 'Race',
  train: 'Train',
  rest: 'Rest',
};

const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Acceleration',
  stamina: 'Stamina',
  trap: 'Trap',
};

/**
 * What this dog's week will cost or return in fitness, for the line under the buttons.
 *
 * Every branch names the number it lands on next week rather than only the delta: "−25 fitness"
 * is a rule, "74 → 49" is a decision. GDD §5.7's choice is between two futures and the card is
 * where both of them should be legible.
 */
function fitnessLine(d: Dog, me: Player, declared: boolean): string {
  const status = weekStatusOf(d);
  const f = fitnessOutlook(d, me);
  if (status === 'layoff')
    return `on layoff, +${weeklyFitnessDelta(d, vetRestBonus(me), false)} fitness (${f.now} → ${f.resting})`;
  if (status === 'race')
    return declared
      ? `racing: −${balance.fitnessPerRace} fitness (${f.now} → ${f.racing}; ${f.resting} if you rest it instead)`
      : `set to race but not entered — it will take the week off (${f.now} → ${f.resting})`;
  if (status === 'train')
    return `training ${STAT_LABEL[d.trainStat]}: +${balance.fitnessTrain} fitness (${f.now} → ${f.training}), one crate of kibble`;
  return `resting: +${weeklyFitnessDelta(d, vetRestBonus(me), false)} fitness (${f.now} → ${f.resting})`;
}

/**
 * GDD §15.4 — "your dogs as cards: portrait, stats bars, rating, fitness, form arrows, age,
 * traits, value, training focus". M1 laid this out as a table because there was no card to put
 * a dog in; M3 has one, so the Kennels is now the kit's DogCard grid with the portrait slot
 * session 2 fills. Every action the table carried is still on the card: the same three kennel
 * items, priced at the market and applied to a named dog here, through the same BuyUpgrade.
 */
export function Stable({ s, me }: { s: GameState; me: Player }) {
  const dogs = ownedDogs(s, me);
  const worth = netWorthBreakdown(s, me);
  const bill = weeklyBill(s, me);
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';
  const plans = dogs.map((d) => weekStatusOf(d));
  const count = (k: string) => plans.filter((x) => x === k).length;

  return (
    <>
      <Panel title={me.name} sub="your stable">
        <div className="grid3">
          <KV
            items={[
              ['Cash', formatBones(me.cash)],
              ['Kennels', `${dogs.length} / ${me.kennelSlots} dogs`],
              ['Hold', `${cargoTotal(me.cargo)} / ${me.ship.cargoCap} crates`],
            ]}
          />
          <KV
            items={[
              ['Ship', `engine ${me.ship.speed}${me.ship.coldStore ? ', cold store' : ''}`],
              [
                'Staff',
                Object.values(me.staff).length
                  ? Object.values(me.staff)
                      .map((o) => `${o.name} (${o.role})`)
                      .join(', ')
                  : 'none',
              ],
              [
                'This week',
                `${count('race')} racing · ${count('train')} training · ${count('rest')} resting${count('layoff') ? ` · ${count('layoff')} on layoff` : ''}`,
              ],
            ]}
          />
          <KV
            items={[
              [
                'Debt',
                me.loans.length
                  ? me.loans.map((l) => `${l.lender} ${formatBones(l.principal)}`).join(', ')
                  : 'none',
              ],
              ['Dogs value', formatBones(worth.dogs)],
              ['Net worth', <b key="nw">{formatBones(worth.total)}</b>],
            ]}
          />
        </div>
        <Notes
          lines={[
            `This week's bill: ${formatBones(bill.total)} — upkeep ${formatBones(bill.upkeep)}, wages ${formatBones(bill.wages)}, fuel ${formatBones(bill.fuel)}, kibble ${bill.foodNeeded} crate${bill.foodNeeded === 1 ? '' : 's'} (${bill.foodFromHold} from the hold${bill.food ? `, ${formatBones(bill.food)} bought at the gate` : ''})${bill.interest ? `, interest ${formatBones(bill.interest)}` : ''}.`,
            `Every dog does exactly one of three things with the week. Race costs ${balance.fitnessPerRace} fitness, Train returns ${balance.fitnessTrain} and eats a second crate of kibble, Rest returns ${balance.fitnessRest} (${balance.fitnessRest + vetRestBonus(me)} with your vet). Fitness multiplies every stat at every level — a dog at 60 is slower than a dog at 90, but it is still a runner.`,
          ]}
        />
      </Panel>

      <Panel title="Dogs" sub="ratings and stats are public — everyone can see them">
        <PlanTheWeek s={s} me={me} dogs={dogs} inTurn={inTurn} />
        <div className="dogcards">
          {dogs.map((d) => {
            const st = status(d);
            const race = declaredRace(s, me.id, d.id);
            return (
              <DogCard
                key={d.id}
                dog={d}
                declared={!!race}
                sub={`age ${d.age} · ${d.wins}/${d.runs} · ${formatBones(dogValue(d))}`}
                badges={
                  <>
                    {race ? (
                      <Badge tone="good" title="declared this weekend">
                        {raceLabel(race)}
                      </Badge>
                    ) : null}
                    {weekStatusOf(d) === 'train' ? (
                      <Badge title={`on a training week: ${STAT_LABEL[d.trainStat]}`}>
                        training {STAT_LABEL[d.trainStat].toLowerCase()}
                      </Badge>
                    ) : null}
                    {weekStatusOf(d) === 'rest' ? (
                      <Badge title="resting this week">resting</Badge>
                    ) : null}
                    {st.tone ? <Badge tone={st.tone}>{st.text}</Badge> : null}
                    {d.supplemented ? (
                      <Badge tone="hot" title="doped for this weekend">
                        💉 on
                      </Badge>
                    ) : null}
                  </>
                }
                actions={<Gear s={s} me={me} d={d} inTurn={inTurn} />}
              >
                <WeekPlan s={s} me={me} d={d} inTurn={inTurn} declared={!!race} />
              </DogCard>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/**
 * GDD §5.7's control, and the centre of the v2 game: Race, Train or Rest, one per dog per week.
 *
 * Layoff is shown rather than offered — an injured or banned dog is on Layoff whatever the
 * Kennels says — but the three buttons stay live underneath it, because what a dog does the week
 * it comes sound is a decision worth taking early.
 *
 * Standing a declared dog down is refused by the engine (withdraw it from its race first), so the
 * button says so rather than throwing an ActionError at the player.
 */
function WeekPlan({
  s,
  me,
  d,
  inTurn,
  declared,
}: {
  s: GameState;
  me: Player;
  d: Dog;
  inTurn: boolean;
  declared: boolean;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const status = weekStatusOf(d);
  const laidOff = status === 'layoff';
  // Why this dog cannot take a trap at all this weekend. Under the rating caps that is injury or
  // a ban; once the card is fact-gated it is also "nothing on this card will have it", and the
  // Kennels has to say so or the player is left wondering why Race does nothing.
  const barred = cannotRunReason(s, d);

  return (
    <div className="weekplan">
      <div className="row tight">
        {WEEK_STATES.map((state) => {
          // Race stays live for a barred dog on purpose: it is how you say what the dog should
          // do the week it comes back, and setDogState allows exactly that. The button explains
          // itself instead of refusing.
          const why = !inTurn
            ? 'Not while the races are on'
            : state !== 'race' && declared
              ? `Withdraw ${d.name} from its race first`
              : null;
          const note =
            state === 'race' && barred
              ? `Not this weekend — ${barred}. Sets the week it can.`
              : null;
          return (
            <NeonButton
              key={state}
              small
              variant={status === state ? 'primary' : undefined}
              disabled={!!why}
              title={why ?? note ?? `${STATE_LABEL[state]} this week`}
              onClick={() => dispatch({ t: 'SetDogState', playerId: me.id, dogId: d.id, state })}
            >
              {STATE_LABEL[state]}
            </NeonButton>
          );
        })}
        {d.weekState === 'train' ? (
          <select
            aria-label={`What ${d.name} works on`}
            value={d.trainStat}
            disabled={!inTurn}
            onChange={(e) =>
              dispatch({
                t: 'SetDogState',
                playerId: me.id,
                dogId: d.id,
                state: 'train',
                stat: e.target.value as StatKey,
              })
            }
          >
            {STAT_KEYS.map((k) => (
              <option key={k} value={k}>
                {STAT_LABEL[k]} ({d[k]})
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <span className="muted small">
        {laidOff ? `Out for ${Math.max(d.injuryWeeks, d.banWeeks)} more week(s). ` : ''}
        {fitnessLine(d, me, declared)}
      </span>
      {barred && !laidOff ? (
        <span className="muted small">Cannot run this weekend — {barred}.</span>
      ) : null}
      {!hasStaff(me, 'trainer') && d.weekState === 'train' ? (
        <span className="muted small">
          No trainer, so a Train week is plain kibble alone: +{balance.trainKibbleMin}–
          {balance.trainKibbleMax} to a stat of its own choosing.
        </span>
      ) : null}
    </div>
  );
}

/**
 * The click budget's answer to a per-dog decision (GDD §15.3, BUILD_PLAN §11). Six dogs × one
 * decision is six clicks a weekend on top of the thirteen there already were, and the fix the
 * plan asks for is a summary rather than fewer decisions — so one button sets the whole yard to
 * the sensible default and the player overrides the dogs they care about.
 */
function PlanTheWeek({
  s,
  me,
  dogs,
  inTurn,
}: {
  s: GameState;
  me: Player;
  dogs: Dog[];
  inTurn: boolean;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const restBelow = balance.fitnessScaleBelow - 15;
  const plan = (d: Dog): WeekState =>
    d.fitness >= 65 ? 'race' : d.fitness >= restBelow ? 'train' : 'rest';
  const todo = dogs.filter(
    (d) => weekStatusOf(d) !== 'layoff' && !declaredRace(s, me.id, d.id) && d.weekState !== plan(d),
  );

  return (
    <div className="row">
      <NeonButton
        disabled={!inTurn || !todo.length}
        title={
          !todo.length
            ? 'Every dog already has the week it would be given'
            : `Race anything over 65 fitness, train anything over ${restBelow}, rest the rest — then change your mind about the ones that matter`
        }
        onClick={() => {
          for (const d of todo)
            dispatch({ t: 'SetDogState', playerId: me.id, dogId: d.id, state: plan(d) });
        }}
      >
        Plan the week ({todo.length})
      </NeonButton>
      <span className="muted small">
        Sets every undeclared dog by fitness. It is a starting point, not advice.
      </span>
    </div>
  );
}

/** The three kennel items (GDD §8), bought straight onto one dog. */
function Gear({ s, me, d, inTurn }: { s: GameState; me: Player; d: Dog; inTurn: boolean }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const catchRate = dopingCatchRate(s);

  const items: { upgrade: UpgradeId; label: string; what: string; shut: string | null }[] = [
    {
      upgrade: 'trackDay',
      label: 'Track day',
      what: `Track-day pass: +${balance.itemTrackDayBonus} to the weakest stat`,
      shut: s.planet.trackDayPasses ? null : 'No passes on this planet this week',
    },
    {
      upgrade: 'muzzle',
      label: 'Muzzle',
      what: `Racing muzzle: +${balance.itemMuzzleBonus} Trap`,
      shut: s.planet.muzzlesInStock ? null : 'No muzzles in stock here this week',
    },
    {
      upgrade: 'supplement',
      label: '💉',
      what: `"Supplement": +${balance.itemSupplementBonus} speed for this weekend, ${Math.round(catchRate * 100)}% caught on ${planet.name}`,
      shut: s.toggles.cleanSport
        ? 'Clean Sport is on this season'
        : !pre
          ? 'Too late — supplements go in before the races'
          : d.supplemented
            ? `${d.name} has had enough`
            : null,
    },
  ];

  return (
    <>
      {items.map((it) => {
        const price = upgradePrice(it.upgrade, planet, me);
        const why = !inTurn
          ? 'Not while the races are on'
          : (it.shut ?? (price > me.cash ? `Short by ${formatBones(price - me.cash)}` : null));
        return (
          <NeonButton
            key={it.upgrade}
            small
            disabled={!!why}
            title={why ? `${it.what} — ${why}` : `${it.what} — ${formatBones(price)}`}
            onClick={() =>
              dispatch({ t: 'BuyUpgrade', playerId: me.id, upgrade: it.upgrade, dogId: d.id })
            }
          >
            {it.label}
          </NeonButton>
        );
      })}
    </>
  );
}
