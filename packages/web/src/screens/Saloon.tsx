import { useState } from 'react';
import {
  balance,
  formatBones,
  loanCap,
  outstanding,
  planetOf,
  weeklyInterest,
  PLANETS,
  STAT_KEYS,
  type GameState,
  type Player,
  type StaffRole,
  type StatKey,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { KV, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { rumours } from '../lib/rumours';
import { ownedDogs } from '../lib/selectors';
import { useGame } from '../store/gameStore';

const ROLE_BLURB: Record<StaffRole, string> = {
  trainer: `+${balance.trainerStatPerWeek} to one stat of one dog every week`,
  vet: `Halves injury weeks and recovers ${balance.fitnessRecoveryVet} fitness a week instead of ${balance.fitnessRecovery}`,
  fixer: 'Sabotage and steward bribes (GDD §13)',
};

const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Acceleration',
  stamina: 'Stamina',
  trap: 'Trap',
};

function planetsWith(kind: 'bank' | 'shark'): string {
  return PLANETS.filter((p) => p.special[kind]).map((p) => p.name).join(', ');
}

/** GDD §8 and §7.4 — who you can hire, what they cost, and who will lend you money here. */
export function Saloon({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const staffOnOffer = s.planet.staff;
  const employed = (Object.keys(me.staff) as StaffRole[]).filter((r) => me.staff[r]);
  const wages = employed.reduce((sum, r) => {
    const o = me.staff[r];
    return sum + (o ? o.wage : 0);
  }, 0);

  return (
    <>
      <Panel title={`Saloon — ${planet.name}`} sub="staff, wages and credit">
        <KV
          items={[
            ['Cash', formatBones(me.cash)],
            ['Wage bill', `${formatBones(wages)} a week`],
            [
              'Owed',
              me.loans.length
                ? `${me.loans.map((l) => `${l.lender === 'bank' ? 'bank' : 'Fat Tony'} ${formatBones(l.principal)}`).join(', ')} — interest ${formatBones(weeklyInterest(me))} a week`
                : 'nothing, for now',
            ],
          ]}
        />
        <Notes
          lines={[
            sp.trainer && 'A trainer is always drinking here.',
            sp.vet && 'A vet works out of the back room.',
            sp.fixer && 'A fixer is at the far table, if you are that sort of stable.',
            sp.bank && `The bank lends up to ${formatBones(balance.bankMax)} at ${Math.round(balance.bankRate * 100)}% a week.`,
            sp.shark && 'Fat Tony Nebula is holding court in the corner.',
            !sp.bank && !sp.shark && `Nobody lends money here. Banks: ${planetsWith('bank')}. Fat Tony: ${planetsWith('shark')}.`,
          ]}
        />
      </Panel>

      <Rumours s={s} />

      <Panel title="For hire" sub="wages are charged every week until you let them go">
        {staffOnOffer.length === 0 ? (
          <p className="muted flush">
            Nobody worth hiring is drinking here this week.
          </p>
        ) : null}
        {staffOnOffer.map((o) => {
          const why =
            o.role === 'fixer' && s.toggles.cleanSport
              ? 'Clean Sport is on this season'
              : me.staff[o.role]
                ? `You already employ a ${o.role}`
                : me.cash < o.wage
                  ? `You cannot cover the first week's ${formatBones(o.wage)}`
                  : null;
          return (
            <div className="shop-row" key={o.id}>
              <span className="what">
                <b>
                  {o.name} <span className="muted">— {o.role}</span>
                </b>
                <span className="muted">{o.quirk ?? ROLE_BLURB[o.role]}</span>
              </span>
              <span className="price">{formatBones(o.wage)}/week</span>
              <NeonButton
                disabled={!!why}
                title={why ?? `Hire ${o.name}`}
                onClick={() =>
                  dispatch({ t: 'HireStaff', playerId: me.id, role: o.role, staffId: o.id })
                }
              >
                Hire
              </NeonButton>
              {why ? <span className="why">{why}</span> : null}
              {o.quirk ? <span className="why">Quirk: {o.quirk}</span> : null}
            </div>
          );
        })}
      </Panel>

      <Panel title="Your staff" sub={`${formatBones(wages)} a week`}>
        {employed.length === 0 ? (
          <p className="muted flush">
            You run the whole stable yourself.
          </p>
        ) : null}
        {employed.map((role) => {
          const o = me.staff[role]!;
          return (
            <div className="shop-row" key={role}>
              <span className="what">
                <b>
                  {o.name} <span className="muted">— {role}</span>
                </b>
                <span className="muted">{o.quirk ?? ROLE_BLURB[role]}</span>
              </span>
              <span className="price">{formatBones(o.wage)}/week</span>
              <NeonButton onClick={() => dispatch({ t: 'FireStaff', playerId: me.id, role })}>
                Let them go
              </NeonButton>
            </div>
          );
        })}
      </Panel>

      <TrainingFocus s={s} me={me} />

      {sp.bank ? (
        <Lender
          me={me}
          lender="bank"
          title="The bank"
          sub={`up to ${formatBones(balance.bankMax)} at ${Math.round(balance.bankRate * 100)}% a week`}
          note="Repay any time. Outstanding debt counts against your net worth at the end of the season."
        />
      ) : null}
      {sp.shark ? (
        <Lender
          me={me}
          lender="shark"
          title="Fat Tony Nebula"
          sub={`up to ${formatBones(balance.sharkMax)} at ${Math.round(balance.sharkRate * 100)}% a week`}
          note="Miss a week's interest and Tony's boys take your best dog. He is also the one who covers you when the bills bounce."
        />
      ) : null}
    </>
  );
}

/**
 * GDD §9's rumours — the only hint in the game about kibble prices further down the circuit, and
 * the reason the trade is a judgement rather than a lookup. What is being said is derived from the
 * calendar and the planets' price bands (lib/rumours.ts); a band is not a price, so the tip can be
 * wrong.
 */
function Rumours({ s }: { s: GameState }) {
  const heard = rumours(s);
  return (
    <Panel title="What they're saying" sub="kibble prices further up the circuit">
      {heard.length ? (
        <Notes lines={heard.map((r) => r.text)} />
      ) : (
        <p className="muted flush">
          Nothing but the racing tonight. Nobody has a word to say about the price of kibble.
        </p>
      )}
    </Panel>
  );
}

function TrainingFocus({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const dogs = ownedDogs(s, me);
  const trainer = me.staff.trainer;
  const [dogId, setDogId] = useState(me.training?.dogId ?? dogs[0]?.id ?? '');
  const [stat, setStat] = useState<StatKey>(me.training?.stat ?? 'speed');
  const current = me.training ? s.dogs[me.training.dogId] : undefined;
  const gain = balance.trainerStatPerWeek + (trainer?.name === 'Gristle McGraw' ? 1 : 0);

  return (
    <Panel
      title="Training focus"
      sub={trainer ? `${trainer.name} works on one dog, one stat, +${gain} a week` : 'needs a trainer'}
    >
      {!trainer ? (
        <p className="muted flush">
          Hire a trainer and you can point them at a dog and a stat. The gain lands when you jump
          to the next planet.
        </p>
      ) : (
        <>
          <p className="flush-t">
            {current && me.training ? (
              <>
                Now working on <b>{current.name}</b> — {STAT_LABEL[me.training.stat]} (
                {current[me.training.stat]} → {Math.min(99, current[me.training.stat] + gain)} at the
                end of the week).
              </>
            ) : (
              <span className="muted">Nobody is being worked on.</span>
            )}
          </p>
          <div className="row">
            <select value={dogId} onChange={(e) => setDogId(e.target.value)}>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · rating {d.rating}
                </option>
              ))}
            </select>
            <select value={stat} onChange={(e) => setStat(e.target.value as StatKey)}>
              {STAT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STAT_LABEL[k]}
                  {dogs.find((d) => d.id === dogId) ? ` (${dogs.find((d) => d.id === dogId)![k]})` : ''}
                </option>
              ))}
            </select>
            <NeonButton
              variant="primary"
              disabled={!dogId}
              onClick={() => dispatch({ t: 'SetTraining', playerId: me.id, dogId, stat })}
            >
              Work on it
            </NeonButton>
            <NeonButton
              disabled={!me.training}
              onClick={() => dispatch({ t: 'SetTraining', playerId: me.id, dogId: null, stat })}
            >
              Stop training
            </NeonButton>
          </div>
        </>
      )}
    </Panel>
  );
}

function Lender({
  me,
  lender,
  title,
  sub,
  note,
}: {
  me: Player;
  lender: 'bank' | 'shark';
  title: string;
  sub: string;
  note: string;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const owed = outstanding(me, lender);
  const room = loanCap(lender) - owed;
  const rate = lender === 'bank' ? balance.bankRate : balance.sharkRate;
  const [amount, setAmount] = useState(1000);
  const borrow = Math.max(0, Math.min(amount, room));
  const repay = Math.max(0, Math.min(amount, owed, Math.floor(me.cash)));

  return (
    <Panel title={title} sub={sub}>
      <KV
        items={[
          ['Outstanding', owed ? formatBones(owed) : 'nothing'],
          ['Interest', `${formatBones(Math.round(owed * rate))} a week`],
          ['Room left', formatBones(room)],
        ]}
      />
      <div className="row gap-t">
        <label>
          <span className="muted">Amount</span>{' '}
          <input
            type="range"
            min={100}
            max={Math.max(100, loanCap(lender))}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />{' '}
          <b>{formatBones(amount)}</b>
        </label>
      </div>
      <div className="row gap-t">
        <NeonButton
          disabled={borrow <= 0}
          title={room <= 0 ? 'Already borrowed to the limit' : undefined}
          onClick={() => dispatch({ t: 'Borrow', playerId: me.id, lender, amount: borrow })}
        >
          Borrow {formatBones(borrow)}
        </NeonButton>
        <NeonButton
          disabled={repay <= 0}
          title={owed <= 0 ? 'Nothing owed' : me.cash < 100 ? 'No Bones to repay with' : undefined}
          onClick={() => dispatch({ t: 'Repay', playerId: me.id, lender, amount: repay })}
        >
          Repay {formatBones(repay)}
        </NeonButton>
        <NeonButton
          disabled={owed <= 0 || me.cash <= 0}
          onClick={() =>
            dispatch({
              t: 'Repay',
              playerId: me.id,
              lender,
              amount: Math.min(owed, Math.floor(me.cash)),
            })
          }
        >
          Clear what you can
        </NeonButton>
      </div>
      <Notes lines={[note]} />
    </Panel>
  );
}
