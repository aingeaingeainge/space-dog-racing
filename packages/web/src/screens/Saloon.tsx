import { useState } from 'react';
import {
  balance,
  formatBones,
  loanCap,
  outstanding,
  planetOf,
  weeklyInterest,
  PLANETS,
  type Dog,
  type GameState,
  type Player,
  type StaffRole,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { KV, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { rumours } from '../lib/rumours';
import { bestEarner, wageWeeks } from '../lib/priceTag';
import { useGame } from '../store/gameStore';

const ROLE_BLURB: Record<StaffRole, string> = {
  trainer: `+${balance.trainerStatPerWeek} to the chosen stat of every dog you put on a Train week`,
  vet: `Halves injury weeks and a rest week returns ${balance.fitnessRestVet} fitness instead of ${balance.fitnessRest}`,
  fixer: 'Sabotage and steward bribes (GDD §13)',
};

/** What the role is worth over the weeks that are left, rather than in the abstract. */
function roleValue(s: GameState, role: StaffRole): string | null {
  const weeks = wageWeeks(s);
  switch (role) {
    case 'trainer':
      return `At most ${balance.trainerStatPerWeek * weeks} stat points on one dog if you train it every week left — and they land on the stat you chose, not a random one.`;
    case 'vet':
      return `Every rest week is worth ${balance.fitnessRestVet - balance.fitnessRest} more fitness, so a dog comes back a week sooner each time you stand it down.`;
    case 'fixer':
      return null;
  }
}

/**
 * The sentence that turns a wage into a decision (GDD §7.2, §7.5).
 *
 * "1,400/week" is a number. What a player needs is the commitment against the money the stable
 * actually makes, because §7.5's route to bankruptcy is exactly a wage bill signed in a good week
 * and still being charged in a bad one. So: what it costs to the Grand Final, and what the best
 * dog in the yard has won in the season so far — the two figures whose ratio *is* the decision.
 */
function hireContext(
  s: GameState,
  me: Player,
  wage: number,
  best: { dog: Dog; won: number } | null,
): string {
  const total = wage * wageWeeks(s);
  const against =
    best && best.won > 0
      ? `the ${formatBones(best.won)} ${best.dog.name} has won all season`
      : `a stable that has won ${formatBones(me.stats.prizeIncome)} in prize money all season`;
  return `${formatBones(total)} before the season ends, against ${against}.`;
}

function planetsWith(kind: 'bank' | 'shark'): string {
  return PLANETS.filter((p) => p.special[kind])
    .map((p) => p.name)
    .join(', ');
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
  // A wage is a weekly number and a season-long commitment, and only the second is a decision
  // (GDD §7.2, §7.5). The Saloon prints both, against what the stable's best dog has actually won.
  const weeks = wageWeeks(s);
  const best = bestEarner(s, me);

  return (
    <>
      <Panel title={`Saloon — ${planet.name}`} sub="staff, wages and credit">
        <KV
          items={[
            ['Cash', formatBones(me.cash)],
            [
              'Wage bill',
              wages
                ? `${formatBones(wages)} a week — ${formatBones(wages * weeks)} over the ${weeks} week${weeks === 1 ? '' : 's'} left`
                : 'nothing — you run the whole yard yourself',
            ],
            [
              'Your best earner',
              best && best.won > 0
                ? `${best.dog.name} has won ${formatBones(best.won)} all season`
                : 'nothing won yet this season',
            ],
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
            sp.bank &&
              `The bank lends up to ${formatBones(balance.bankMax)} at ${Math.round(balance.bankRate * 100)}% a week.`,
            sp.shark && 'Fat Tony Nebula is holding court in the corner.',
            !sp.bank &&
              !sp.shark &&
              `Nobody lends money here. Banks: ${planetsWith('bank')}. Fat Tony: ${planetsWith('shark')}.`,
          ]}
        />
      </Panel>

      <Rumours s={s} />

      <Panel
        title="For hire"
        sub={`wages are charged every week until you let them go — ${weeks} more charge${weeks === 1 ? '' : 's'} if you hire tonight`}
      >
        {staffOnOffer.length === 0 ? (
          <p className="muted flush">Nobody worth hiring is drinking here this week.</p>
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
              <span className="price">
                {formatBones(o.wage)}/week
                <div className="why">{formatBones(o.wage * weeks)} to the Grand Final</div>
              </span>
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
              <span className="why">{hireContext(s, me, o.wage, best)}</span>
              {roleValue(s, o.role) ? <span className="why">{roleValue(s, o.role)}</span> : null}
              {o.quirk ? <span className="why">Quirk: {o.quirk}</span> : null}
            </div>
          );
        })}
      </Panel>

      <Panel
        title="Your staff"
        sub={
          wages
            ? `${formatBones(wages)} a week · ${formatBones(wages * weeks)} still to be charged`
            : 'nobody on the books'
        }
      >
        {employed.length === 0 ? (
          <p className="muted flush">You run the whole stable yourself.</p>
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
