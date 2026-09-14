import { useState } from 'react';
import {
  balance,
  fixCatchRate,
  formatBones,
  jobCost,
  loanCap,
  outstanding,
  planetOf,
  weeklyInterest,
  PLANETS,
  staffRole,
  wageBill,
  TIER_GLYPH,
  TIER_LABEL,
  TIER_WAGE,
  TRAINER_POINTS,
  type Dog,
  type GameState,
  type GoodTier,
  type Player,
  type StaffOffer,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { KV, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { rumours } from '../lib/rumours';
import { bestEarner, wageWeeks } from '../lib/priceTag';
import { useGame } from '../store/gameStore';

/** A tier, as a word and as chevrons — one vocabulary, read everywhere (GDD §8.1). */
function Tier({ tier }: { tier: GoodTier }) {
  return (
    <span className={`tier tier-${tier}`} title={`${TIER_LABEL[tier]} — ${TIER_WAGE[tier]}/week`}>
      <span className="chev">{TIER_GLYPH[tier]}</span> {TIER_LABEL[tier]}
    </span>
  );
}

/**
 * What this hire is worth over the weeks that are left, from the role's own row (GDD §8.3).
 *
 * The row in `content/staff.ts` carries one line per tier, so the Saloon prints the engine's own
 * description of what it is about to charge for rather than a second copy that can drift from it.
 * And the trainer's line is turned into a season: "+4 a Train week" is a rule, "at most 44 stat
 * points on one dog" is a decision.
 */
function roleValue(s: GameState, o: StaffOffer): string {
  const weeks = wageWeeks(s);
  const base = staffRole(o.role).effect[o.tier];
  if (o.role === 'trainer') {
    const points = TRAINER_POINTS[o.tier] * weeks;
    return `${base} — at most ${points} points on one dog if you train it every week left, and they land on the stat you chose rather than a random one.`;
  }
  return base;
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
  const wages = wageBill(me);
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
            sp.fixer &&
              'There is always somebody at the far table on this station. Whether that is a good thing is between you and the stewards.',
            sp.bank &&
              `The bank lends up to ${formatBones(balance.bankMax)} at ${Math.round(balance.bankRate * 100)}% a week.`,
            sp.shark && 'Fat Tony Nebula is holding court in the corner.',
            !sp.bank &&
              !sp.shark &&
              `Nobody lends money here. Banks: ${planetsWith('bank')}. Fat Tony: ${planetsWith('shark')}.`,
          ]}
        />
      </Panel>

      <FarTable s={s} me={me} />

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
            me.staff.length >= balance.staffSlots
              ? `All ${balance.staffSlots} slots are full — let somebody go first`
              : me.cash < o.wage
                ? `You cannot cover the first week's ${formatBones(o.wage)}`
                : null;
          const already = me.staff.filter((x) => x.role === o.role);
          return (
            <div className="shop-row" key={o.id}>
              <span className="what">
                <b>
                  {o.name}{' '}
                  <span className="muted">
                    — <Tier tier={o.tier} /> {staffRole(o.role).label.toLowerCase()}
                  </span>
                </b>
                <span className="muted">{staffRole(o.role).blurb}</span>
              </span>
              <span className="price">
                {formatBones(o.wage)}/week
                <div className="why">{formatBones(o.wage * weeks)} to the Grand Final</div>
              </span>
              <NeonButton
                disabled={!!why}
                title={why ?? `Hire ${o.name}`}
                onClick={() => dispatch({ t: 'HireStaff', playerId: me.id, staffId: o.id })}
              >
                Hire
              </NeonButton>
              {why ? <span className="why">{why}</span> : null}
              <span className="why">{roleValue(s, o)}</span>
              <span className="why">{hireContext(s, me, o.wage, best)}</span>
              {already.length ? (
                <span className="why">
                  You already employ {already.length} {staffRole(o.role).label.toLowerCase()}
                  {already.length > 1 ? 's' : ''} — the best of them is the one who acts, so a
                  second is a second wage for nothing unless this one is better.
                </span>
              ) : null}
              {o.quirk ? <span className="why">Quirk: {o.quirk}</span> : null}
            </div>
          );
        })}
      </Panel>

      <Panel
        title="Your staff"
        sub={
          wages
            ? `${me.staff.length} of ${balance.staffSlots} slots · ${formatBones(wages)} a week · ${formatBones(wages * weeks)} still to be charged`
            : `nobody on the books — ${balance.staffSlots} slots free`
        }
      >
        {me.staff.length === 0 ? (
          <p className="muted flush">
            You run the whole stable yourself. {balance.staffSlots} slots, any mix — three trainers
            is allowed, though only the best of them would actually train.
          </p>
        ) : null}
        {me.staff.map((o) => (
          <div className="shop-row" key={o.id}>
            <span className="what">
              <b>
                {o.name}{' '}
                <span className="muted">
                  — <Tier tier={o.tier} /> {staffRole(o.role).label.toLowerCase()}
                </span>
              </b>
              <span className="muted">{roleValue(s, o)}</span>
            </span>
            <span className="price">
              {formatBones(o.wage)}/week
              <div className="why">{formatBones(o.wage * weeks)} still to come</div>
            </span>
            <NeonButton
              onClick={() => dispatch({ t: 'FireStaff', playerId: me.id, staffId: o.id })}
            >
              Let them go
            </NeonButton>
            {o.quirk ? <span className="why">Quirk: {o.quirk}</span> : null}
          </div>
        ))}
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
/**
 * The far table (GDD §13, E-D45) — a price list rather than a hire.
 *
 * ⚠️ **This panel is the whole of what changed about the Fixer, said in one screen.** Through
 * Phase D he was a row in "For hire" above, with a wage charged every week to the Grand Final;
 * the road measured as a 3,498-Bone loss because of it, and the arithmetic was never close (D42).
 * So he has no Hire button now. What he has is a name, a grade and two prices — and the decision
 * to pay one of them is taken where the job is, at the Race Office before the draw and at the
 * Bookie after the prices are up, against that race's purse and that slip's stake.
 *
 * The reason it is still worth a panel here rather than nothing at all: §9.3's fog means a player
 * arriving on a planet does not otherwise know whether the road is open this week, and pillar 4
 * says they should be able to price what they have been offered the instant it appears. A price
 * list you read on arrival is exactly that, and it costs no click to walk past.
 */
function FarTable({ s, me }: { s: GameState; me: Player }) {
  const fixer = s.planet.fixer;
  if (s.toggles.cleanSport) return null;
  if (!fixer) {
    return (
      <Panel title="The far table" sub="§13 — nobody worth knowing, this week">
        <p className="muted flush">
          Nobody here knows a steward worth knowing. Try somewhere with worse lighting.
        </p>
      </Panel>
    );
  }
  const barred = me.flags.fixerBarred;
  return (
    <Panel title="The far table" sub="paid by the job, never by the week">
      <p className="flush">
        <b>
          {fixer.name}{' '}
          <span className="muted">
            — <Tier tier={fixer.tier} /> fixer
          </span>
        </b>
      </p>
      <Notes
        lines={[
          `A box for one of your runners: ${formatBones(jobCost('bribe', fixer.tier))}. Bought at the Race Office, before the draw is made.`,
          `A word with somebody else's: ${formatBones(jobCost('sabotage', fixer.tier))}. Bought at the Bookie, after the prices are up and while they stay up.`,
          `The stewards here notice about ${Math.round(fixCatchRate(s, fixer.tier) * 100)}% of jobs. If they notice one of yours it is ${formatBones(balance.fixFineBase)} plus a quarter of what you had on the race, and nobody will take your money again this season.`,
          barred
            ? 'They already have your name. He will not take your money.'
            : 'One job of each kind a weekend — he is one man with one week in him.',
        ]}
      />
    </Panel>
  );
}

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
