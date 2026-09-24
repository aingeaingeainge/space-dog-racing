import {
  balance,
  dogValue,
  formatBones,
  netWorthBreakdown,
  cargoTotal,
  HOLD_CAP,
  weekStatusOf,
  weeklyFitnessDelta,
  GOODS,
  type Dog,
  type GameState,
  type Player,
  type Diet,
  type GoodId,
  type StatKey,
  good,
  type FeedPlan,
} from '@sdr/engine';
import { DogCard } from '../components/DogCard';
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
import { feedEffect } from '../lib/priceTag';
import { useGame } from '../store/gameStore';

function status(d: Dog): { text: string; tone?: 'bad' | 'hot' } {
  if (d.injuryWeeks > 0) return { text: `injured ${d.injuryWeeks}w`, tone: 'bad' };
  if (d.fitness < balance.fitnessScaleBelow) return { text: 'jaded', tone: 'hot' };
  return { text: 'fit' };
}

const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Acceleration',
  stamina: 'Stamina',
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
  const f = fitnessOutlook(d);
  if (status === 'layoff')
    return `on layoff, +${weeklyFitnessDelta(d, 0, false)} fitness (${f.now} → ${f.resting})`;
  if (status === 'race')
    return declared
      ? `racing: −${balance.fitnessPerRace} fitness (${f.now} → ${f.racing}; ${f.resting} if you rest it instead)`
      : `set to race but not entered — it will take the week off (${f.now} → ${f.resting})`;
  return `resting: +${weeklyFitnessDelta(d, 0, false)} fitness (${f.now} → ${f.resting})`;
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
              ['Kennels', `${dogs.length} dog${dogs.length === 1 ? '' : 's'}`],
              ['Hold', `${cargoTotal(me.cargo)} / ${HOLD_CAP} crates`],
            ]}
          />
          <KV
            items={[
              [
                'This week',
                `${count('race')} racing · ${count('rest')} resting${count('layoff') ? ` · ${count('layoff')} on layoff` : ''}`,
              ],
              ['Dogs value', formatBones(worth.dogs)],
            ]}
          />
          <KV items={[['Net worth', <b key="nw">{formatBones(worth.total)}</b>]]} />
        </div>
        {/* GDD_V3 §6.3's running cost, said before the week resolves rather than after — which is
            what BUILD_PLAN_V3 Phase B item 5 means by "visible in the Kennel". */}
        {bill.hungry > 0 && (
          <div className="notice error">
            <b>
              {bill.hungryNames.join(' and ')} {bill.hungry === 1 ? 'has' : 'have'} nothing to eat
              at the jump: −{balance.emptyHoldFitness} fitness {bill.hungry === 1 ? '' : 'each '}and
              no gain this week.
            </b>{' '}
            The hold holds {bill.foodFromHold} of the {bill.foodNeeded} crate
            {bill.foodNeeded === 1 ? '' : 's'} the yard eats. Buy food at the Market before you end
            the turn.
          </div>
        )}
        <Notes
          lines={[
            `This week's dinner: ${bill.foodNeeded} crate${bill.foodNeeded === 1 ? '' : 's'}, ${bill.foodFromHold} of them in the hold. Food is the only running cost in the game — no upkeep, no wages, no fuel, no debt — and it is not charged in Bones: a dog the hold cannot feed loses ${balance.emptyHoldFitness} fitness and gains nothing.`,
            `Every dog either races or rests. Race costs ${balance.fitnessPerRace} fitness, Rest returns ${balance.fitnessRest} — more for a young dog, less for an old one. Every dog eats one crate either way. Fitness multiplies every stat at every level: a dog at 60 is slower than a dog at 90, but it is still a runner.`,
          ]}
        />
      </Panel>

      <Panel title="Dogs" sub="ratings and stats are public — everyone can see them">
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
                    {weekStatusOf(d) === 'rest' ? (
                      <Badge title="resting this week">resting</Badge>
                    ) : null}
                    {st.tone ? <Badge tone={st.tone}>{st.text}</Badge> : null}
                  </>
                }
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

/** A diet as a `<select>` value, and back. Named foods are their good id. */
function dietKey(diet: Diet): string {
  return diet.kind === 'named' ? diet.good : diet.kind;
}
function dietFromKey(key: string): Diet {
  if (key === 'best' || key === 'worst') return { kind: key };
  return { kind: 'named', good: key as GoodId };
}

/**
 * What this dog eats at the jump, in its own terms — straight from the engine's `planFeeding`, so
 * the card cannot disagree with what the week actually does (GDD_V3 §6.3).
 */
function dinnerLine(s: GameState, d: Dog, f: FeedPlan | undefined): string {
  if (!f) return '';
  if (f.good === null)
    return `Nothing to eat at the jump: −${balance.emptyHoldFitness} fitness and no gain. Buy food at the Market.`;
  const g = good(f.good);
  const from = f.fromGate ? ' (bought at the gate)' : '';
  return `Eats ${g.label} at the jump${from} — ${feedEffect(s, g, d)}.`;
}

/**
 * GDD_V3 §4.2's Race or Rest, one per dog per week — **shown, not asked for, since Phase D2.**
 * The Race Office sets it (a declared dog races, the rest rest), because Race/Rest was inert for a
 * dog that was not declared and the weekly "Plan the week" press changed nothing.
 *
 * ⚠️ Train is gone (GDD_V3 V8) — a dog eats and gains every week whatever it is doing, so a third
 * state had nothing left to be. Three dogs × a binary is three decisions a week against §10.1's
 * budget of ten.
 *
 * Layoff is shown as it always was: an injured dog is on Layoff whatever the Race Office says. The
 * diet stays a control here, and it is sticky, so it is not a weekly press.
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
  const dinner = weeklyBill(s, me).plan.find((f) => f.dogId === d.id);

  return (
    <div className="weekplan">
      <div className="row tight">
        {/* Phase D2 item 5: the week follows the Race Office. A declared dog races and every other
            dog rests, so this is a label, not a form — the declaration was always the decision. */}
        <Badge
          tone={status === 'race' ? 'good' : status === 'layoff' ? 'bad' : undefined}
          title="Set by the Race Office: a declared dog races, every other dog rests"
        >
          {laidOff ? 'on layoff' : status === 'race' ? 'racing' : 'resting'}
        </Badge>
        {/*
          GDD_V3 §6.3's diet: per dog, sticky, and **not a weekly click** — set it once and it holds
          until you change it. The default is the cheapest food aboard, which is also §6.3's own
          fallback, so a player who never touches this never sees a dog eat the Ambrosia they bought
          to sell. The line under the card says what the dog will actually eat at the jump.
        */}
        <select
          aria-label={`What ${d.name} eats`}
          title="Diet — sticky: it holds until you change it"
          value={dietKey(d.diet)}
          disabled={!inTurn}
          onChange={(e) =>
            dispatch({
              t: 'SetDogState',
              playerId: me.id,
              dogId: d.id,
              state: d.weekState,
              diet: dietFromKey(e.target.value),
            })
          }
        >
          <option value="worst">Worst available (cheapest aboard)</option>
          <option value="best">Best available (dearest aboard)</option>
          {GOODS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
              {g.stat ? ` — ${STAT_LABEL[g.stat]}` : ' — random stat'}
            </option>
          ))}
        </select>
      </div>
      <span className="muted small">
        {laidOff ? `Out for ${d.injuryWeeks} more week(s). ` : ''}
        {fitnessLine(d, me, declared)}
      </span>
      {barred && !laidOff ? (
        <span className="muted small">Cannot run this weekend — {barred}.</span>
      ) : null}
      <span className={dinner && dinner.good === null ? 'warn-text small' : 'muted small'}>
        {dinnerLine(s, d, dinner)}
      </span>
    </div>
  );
}
