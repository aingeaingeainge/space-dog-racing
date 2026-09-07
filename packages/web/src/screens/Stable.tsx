import {
  balance,
  dogValue,
  dopingCatchRate,
  formatBones,
  netWorthBreakdown,
  planetOf,
  upgradePrice,
  type Dog,
  type GameState,
  type Player,
  type UpgradeId,
} from '@sdr/engine';
import { DogCard } from '../components/DogCard';
import { NeonButton } from '../components/NeonButton';
import { Panel } from '../components/Panel';
import { Badge, KV, Notes } from '../components/ui';
import { CLASS_LABEL, declaredClass, ownedDogs, weeklyBill } from '../lib/selectors';
import { useGame } from '../store/gameStore';

function status(d: Dog): { text: string; tone?: 'bad' | 'hot' } {
  if (d.injuryWeeks > 0) return { text: `injured ${d.injuryWeeks}w`, tone: 'bad' };
  if (d.banWeeks > 0) return { text: `banned ${d.banWeeks}w`, tone: 'bad' };
  if (d.fitness < balance.fitnessScaleBelow) return { text: 'jaded', tone: 'hot' };
  return { text: 'fit' };
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
  const trained = me.training ? s.dogs[me.training.dogId] : undefined;
  const bill = weeklyBill(s, me);
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';

  return (
    <>
      <Panel title={me.name} sub="your stable">
        <div className="grid3">
          <KV
            items={[
              ['Cash', formatBones(me.cash)],
              ['Kennels', `${dogs.length} / ${me.kennelSlots} dogs`],
              ['Cargo', `${me.cargo} / ${me.ship.cargoCap} crates of kibble`],
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
              ['Training', trained && me.training ? `${trained.name}: ${me.training.stat}` : 'none'],
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
            `Fitness below ${balance.fitnessScaleBelow} scales every stat down; a race costs ${balance.fitnessPerRace} and a week recovers ${balance.fitnessRecovery} (${balance.fitnessRecoveryVet} with a vet).`,
          ]}
        />
      </Panel>

      <Panel title="Dogs" sub="ratings and stats are public — everyone can see them">
        <div className="dogcards">
          {dogs.map((d) => {
            const st = status(d);
            const cls = declaredClass(s, me.id, d.id);
            return (
              <DogCard
                key={d.id}
                dog={d}
                declared={!!cls}
                sub={`age ${d.age} · ${d.wins}/${d.runs} · ${formatBones(dogValue(d))}`}
                badges={
                  <>
                    {cls ? (
                      <Badge tone="good" title="declared this weekend">
                        {CLASS_LABEL[cls]}
                      </Badge>
                    ) : null}
                    {me.training?.dogId === d.id ? (
                      <Badge title={`in training: ${me.training.stat}`}>training</Badge>
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
              />
            );
          })}
        </div>
      </Panel>
    </>
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
