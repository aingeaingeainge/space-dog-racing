import { useState } from 'react';
import {
  balance,
  dogSalePrice,
  dogValue,
  dopingCatchRate,
  formatBones,
  planetOf,
  upgradePrice,
  type Dog,
  type GameState,
  type Player,
  type UpgradeId,
} from '@sdr/engine';
import { DogThumb } from '../components/DogCard';
import { Panel } from '../components/Panel';
import { Badge, Notes, StatCells, StatHeads, Traits } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { CLASS_LABEL, declaredClass, ownedDogs } from '../lib/selectors';
import { useGame } from '../store/gameStore';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * GDD §8. Stock is rolled on arrival and shared by the whole table — turn order is first look.
 * Every planet modifier that moves a price is spelled out here rather than left in the engine.
 */
export function Market({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const pre = s.phase === 'planetPre';
  const mine = ownedDogs(s, me);
  const forSale = s.planet.marketDogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
  const slotsFree = me.kennelSlots - mine.length;

  const buyReason = (d: Dog): string | null => {
    if (slotsFree <= 0) return `Kennels full (${mine.length}/${me.kennelSlots})`;
    const price = d.askingPrice ?? 0;
    if (price > me.cash) return `Short by ${formatBones(price - me.cash)}`;
    return null;
  };

  const sellReason = (d: Dog): string | null => {
    if (mine.length <= 1) return 'A stable must keep at least one dog';
    if (pre && declaredClass(s, me.id, d.id)) return 'Withdraw it from its race first';
    return null;
  };

  return (
    <>
      <Panel title={`Market — ${planet.name}`} sub={planet.marketBias}>
        <Notes
          lines={[
            `${forSale.length} dog${forSale.length === 1 ? '' : 's'} on the block this week; stock is shared with every stable and turn order is first look.`,
            sp.marketAgeBias === 'old' && 'Knackered old dogs here — cheap by the age factor.',
            sp.marketAgeBias === 'pups' && 'Vat-grown pups: age 1, low rating now, they grow.',
            sp.marketQualityBonus ? 'A Major venue: Gold-class dogs, Gold-class prices.' : null,
            sp.dogValueMod ? `Dogs cost and fetch ×${sp.dogValueMod} here.` : null,
            sp.everythingMarkup ? `Everything is marked up ${pct(sp.everythingMarkup)}.` : null,
            sp.buyerBonus ? `Buyers here pay +${pct(sp.buyerBonus)} when you sell.` : null,
            sp.fellOffAShip &&
              'Some of this stock fell off a ship: 60% of value, and a one-in-five chance the real owner turns up in three weeks.',
          ]}
        />
      </Panel>

      <Panel
        title="For sale"
        sub="full stats, rating, age, traits and the asking price"
        tight
        actions={<span className="muted">{formatBones(me.cash)} in hand</span>}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dog</th>
                <th className="num">Age</th>
                <th className="num">Rating</th>
                <StatHeads />
                <th className="num">Fit</th>
                <th>Traits</th>
                <th className="num">Asking</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {forSale.length === 0 ? (
                <tr>
                  <td colSpan={12} className="muted">
                    Nothing left on the block — the other stables got here first.
                  </td>
                </tr>
              ) : null}
              {forSale.map((d) => {
                const price = d.askingPrice ?? 0;
                const why = buyReason(d);
                return (
                  <tr key={d.id}>
                    <td>
                      <DogThumb dog={d} />
                      <b>{d.name}</b>
                      {d.fellOffAShip ? (
                        <Badge tone="bad" title="20% chance the real owner turns up in 3 weeks">
                          fell off a ship
                        </Badge>
                      ) : null}
                    </td>
                    <td className="num">{d.age}</td>
                    <td className="num">
                      <b>{d.rating}</b>
                    </td>
                    <StatCells d={d} />
                    <td className="num">{d.fitness}</td>
                    <td className="wrap">
                      <Traits ids={d.traits} />
                    </td>
                    <td className="num">{formatBones(price)}</td>
                    <td>
                      <NeonButton
                        disabled={!!why}
                        title={why ?? `Buy ${d.name}`}
                        onClick={() => dispatch({ t: 'BuyDog', playerId: me.id, dogId: d.id })}
                      >
                        Buy
                      </NeonButton>
                      {why ? <div className="muted">{why}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Your kennel"
        sub={`${mine.length} of ${me.kennelSlots} slots · sells at ${pct(balance.marketSellFactor)} of value${sp.buyerBonus ? ` +${pct(sp.buyerBonus)} buyer bonus` : ''}${sp.dogValueMod ? ` ×${sp.dogValueMod}` : ''}`}
        tight
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dog</th>
                <th className="num">Age</th>
                <th className="num">Rating</th>
                <StatHeads />
                <th className="num">Fit</th>
                <th>Traits</th>
                <th className="num">Value</th>
                <th className="num">Sells for</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mine.map((d) => {
                const cls = declaredClass(s, me.id, d.id);
                const price = dogSalePrice(d, sp.buyerBonus ?? 0, sp.dogValueMod ?? 1);
                const why = sellReason(d);
                return (
                  <tr key={d.id}>
                    <td>
                      <DogThumb dog={d} />
                      <b>{d.name}</b>
                      {cls ? <Badge tone="good">{CLASS_LABEL[cls]}</Badge> : null}
                      {d.injuryWeeks ? <Badge tone="bad">injured {d.injuryWeeks}w</Badge> : null}
                    </td>
                    <td className="num">{d.age}</td>
                    <td className="num">
                      <b>{d.rating}</b>
                    </td>
                    <StatCells d={d} />
                    <td className="num">{d.fitness}</td>
                    <td className="wrap">
                      <Traits ids={d.traits} />
                    </td>
                    <td className="num">{formatBones(dogValue(d))}</td>
                    <td className="num">
                      <b>{formatBones(price)}</b>
                    </td>
                    <td>
                      <NeonButton
                        disabled={!!why}
                        title={why ?? `Sell ${d.name} for ${formatBones(price)}`}
                        onClick={() => dispatch({ t: 'SellDog', playerId: me.id, dogId: d.id })}
                      >
                        Sell
                      </NeonButton>
                      {why ? <div className="muted">{why}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Kennel gear" sub="GDD §8 — bought here, used on one of your dogs">
        <ItemRow
          s={s}
          me={me}
          upgrade="trackDay"
          name="Track-day pass"
          blurb={`+${balance.itemTrackDayBonus} to the dog's weakest stat, permanently`}
          shut={s.planet.trackDayPasses ? null : 'No passes on this planet this week'}
        />
        <ItemRow
          s={s}
          me={me}
          upgrade="muzzle"
          name="Racing muzzle"
          blurb={`+${balance.itemMuzzleBonus} Trap, permanently`}
          shut={
            s.planet.muzzlesInStock
              ? null
              : `No muzzles in stock on ${planet.name} this week`
          }
        />
        <ItemRow
          s={s}
          me={me}
          upgrade="supplement"
          name={'"Supplement"'}
          blurb={`+${balance.itemSupplementBonus} speed for this weekend's races only`}
          shut={
            s.toggles.cleanSport
              ? 'Clean Sport is on this season'
              : !pre
                ? 'Too late — supplements go in before the races'
                : null
          }
          catchRate={dopingCatchRate(s)}
        />
      </Panel>
    </>
  );
}

/**
 * One counter of the gear shop: pick a dog, see the price this planet charges, and — for the
 * supplement — the stewards' catch rate on THIS planet, on the button itself (GDD §8, §12).
 */
function ItemRow({
  s,
  me,
  upgrade,
  name,
  blurb,
  shut,
  catchRate,
}: {
  s: GameState;
  me: Player;
  upgrade: UpgradeId;
  name: string;
  blurb: string;
  shut: string | null;
  catchRate?: number;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const dogs = ownedDogs(s, me);
  const [dogId, setDogId] = useState(dogs[0]?.id ?? '');
  const planet = planetOf(s.planet.planetId);
  const price = upgradePrice(upgrade, planet, me);
  const chosen = dogs.find((d) => d.id === dogId) ?? dogs[0];

  const why = shut
    ? shut
    : !chosen
      ? 'No dogs to give it to'
      : price > me.cash
        ? `Short by ${formatBones(price - me.cash)}`
        : upgrade === 'supplement' && chosen.supplemented
          ? `${chosen.name} has had enough this weekend`
          : null;

  const label =
    catchRate === undefined
      ? `Buy for ${formatBones(price)}`
      : catchRate === 0
        ? `Feed it — legal here (0% caught)`
        : `Feed it — ${Math.round(catchRate * 100)}% caught here`;

  return (
    <div className="shop-row">
      <span className="what">
        <b>{name}</b>
        <span className="muted">{blurb}</span>
      </span>
      <select value={chosen?.id ?? ''} onChange={(e) => setDogId(e.target.value)}>
        {dogs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} · {d.rating}
          </option>
        ))}
      </select>
      <span className="price">{formatBones(price)}</span>
      <NeonButton
        disabled={!!why}
        title={why ?? undefined}
        onClick={() =>
          chosen && dispatch({ t: 'BuyUpgrade', playerId: me.id, upgrade, dogId: chosen.id })
        }
      >
        {label}
      </NeonButton>
      {why ? <span className="why">{why}</span> : null}
      {catchRate !== undefined && !shut ? (
        <span className="why">
          Caught: purse forfeited, rating −{balance.supplementRatingPenalty}, banned{' '}
          {balance.supplementBanWeeks} week, and a syringe on the leaderboard for the season.
        </span>
      ) : null}
    </div>
  );
}
