import { useState } from 'react';
import {
  balance,
  cargoTotal,
  formatBones,
  fuelCost,
  KIBBLE_ID,
  planetOf,
  upgradePrice,
  type GameState,
  type Player,
  type UpgradeId,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Gauge, KV, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { ownedDogs } from '../lib/selectors';
import { holdEconomics } from '../lib/priceTag';
import { useGame } from '../store/gameStore';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Crates the stable will eat at the end of this week (GDD §7.2 / §9). */
function weeklyFood(s: GameState, p: Player): number {
  let need = 0;
  for (const d of ownedDogs(s, p))
    need += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  return p.sponsorWeeks > 0 ? need * 2 : need;
}

/** GDD §15.6 — ship upgrades and the kibble trade, with the fuel each crate costs on show. */
export function Docks({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const [qty, setQty] = useState(5);

  const kibble = s.planet.goods[KIBBLE_ID];
  const crates = cargoTotal(me.cargo);
  const aboard = me.cargo[KIBBLE_ID];
  const room = me.ship.cargoCap - crates;
  const affordable = kibble.buy > 0 ? Math.floor(me.cash / kibble.buy) : 0;
  const maxBuy = Math.max(0, Math.min(room, affordable, kibble.stock));
  const units = Math.max(0, Math.min(qty, Math.max(maxBuy, aboard)));
  const spread = kibble.buy - kibble.sell;
  const need = weeklyFood(s, me);
  const next = s.calendar[s.week];
  const nextPlanet = next ? planetOf(next.planetId) : null;
  const fuelNow = fuelCost(crates);
  const fuelAfterBuy = fuelCost(crates + units);
  const fuelAfterSell = fuelCost(Math.max(0, crates - units));
  // What the crates cost and what they have to fetch (GDD §9.1). See lib/priceTag.ts.
  const econ = holdEconomics(me, units, kibble.buy);
  const full = holdEconomics(me, maxBuy, kibble.buy);

  const trading = s.toggles.trading;
  const tradeShut = trading ? null : 'No Trading is on this season';

  // What a cargo upgrade has to earn. Price plus the fuel it drags, spread over the crates and
  // the legs that are left — the payback question GDD §20 Q6 asks, answered on the row.
  const jumpsLeft = Math.max(0, balance.weeks - s.week);
  const cargoExtraFuel = balance.cargoUpgradeUnits * balance.fuelPerCargoUnitOver;
  const cargoBreakEven =
    jumpsLeft > 0
      ? Math.ceil(
          (upgradePrice('cargo', planet, me) + cargoExtraFuel * jumpsLeft) /
            (balance.cargoUpgradeUnits * jumpsLeft),
        )
      : 0;

  const ships: {
    upgrade: UpgradeId;
    name: string;
    blurb: string;
    list: number;
    shut: string | null;
  }[] = [
    {
      upgrade: 'engine',
      name: `Engine tier ${me.ship.speed} → ${me.ship.speed + 1}`,
      blurb: `+${balance.arrivalSpeedMult} on the arrival roll — first look at the market`,
      list: balance.shipEngineCost,
      shut: me.ship.speed >= balance.shipMaxSpeed ? 'Already at the top tier' : null,
    },
    {
      upgrade: 'cargo',
      // GDD §9.2's warning, printed where it is spent: at v1's numbers a +20 hold returned about
      // 1,000 a season against 2,500 paid. A player cannot see that from "+20 crates", so the row
      // says what the extra crates drag and what each has to clear over the weeks left.
      name: `Cargo hold +${balance.cargoUpgradeUnits}`,
      blurb:
        `Hold ${me.ship.cargoCap} → ${me.ship.cargoCap + balance.cargoUpgradeUnits} crates` +
        ` · the extra ${balance.cargoUpgradeUnits} drag ${balance.cargoUpgradeUnits * balance.fuelPerCargoUnitOver} fuel a jump` +
        (jumpsLeft > 0
          ? `, so over the ${jumpsLeft} jump${jumpsLeft === 1 ? '' : 's'} left they must clear ${cargoBreakEven} a crate a leg to pay for themselves`
          : ' — no jumps left to use it on'),
      list: balance.shipCargoCost,
      shut: null,
    },
    {
      upgrade: 'kennel',
      name: 'Kennel module',
      blurb: `A ${balance.kennelSlotsMax}th kennel slot (you have ${me.kennelSlots})`,
      list: balance.shipKennelCost,
      shut: me.kennelSlots >= balance.kennelSlotsMax ? 'Kennels are already full size' : null,
    },
    {
      upgrade: 'coldStore',
      name: 'Cold store',
      blurb: 'Cargo never spoils, whatever the planet',
      list: balance.shipColdStoreCost,
      shut: me.ship.coldStore ? 'Already fitted' : null,
    },
  ];

  return (
    <>
      <Panel title={`Docks — ${planet.name}`} sub="ship upgrades and the kibble trade">
        <div className="grid2">
          <KV
            items={[
              [
                'Ship',
                `engine ${me.ship.speed}/${balance.shipMaxSpeed}${me.ship.coldStore ? ' · cold store' : ''}`,
              ],
              ['Hold', <Gauge key="g" value={crates} max={me.ship.cargoCap} unit="crates" />],
              [
                'Fuel next jump',
                `${formatBones(fuelNow)} (${balance.fuelBase} + ${balance.fuelPerCargoUnitOver}/crate over ${balance.fuelCargoFree})`,
              ],
              ['Cash', formatBones(me.cash)],
            ]}
          />
          <Notes
            lines={[
              `Cargo also slows you down: the arrival roll is ship speed ×${balance.arrivalSpeedMult} − crates ÷ ${balance.arrivalCargoDiv} + d${balance.arrivalDie}, and first in gets first look at the market.`,
              sp.shipDiscount ? `Ship upgrades are ${pct(sp.shipDiscount)} off here.` : null,
              sp.engineDiscount ? `Engines are ${pct(sp.engineDiscount)} off here.` : null,
              sp.kennelDiscount ? `Kennel modules are ${pct(sp.kennelDiscount)} off here.` : null,
              sp.everythingMarkup
                ? `Everything on this rock is ${pct(sp.everythingMarkup)} dearer.`
                : null,
              sp.foodSpoils && !me.ship.coldStore
                ? `${pct(sp.foodSpoils)} of your cargo freezes on approach to ${planet.name} without a cold store.`
                : null,
              sp.turnOrderReversed
                ? 'The black hole drags the heaviest ships in first here — cargo is an advantage this week.'
                : null,
            ]}
          />
        </div>
      </Panel>

      <Panel
        title="Ship upgrades"
        sub="GDD §8 — every purchase should pay for itself inside five weeks"
      >
        {ships.map((u) => {
          const price = upgradePrice(u.upgrade, planet, me);
          const why =
            u.shut ?? (price > me.cash ? `Short by ${formatBones(price - me.cash)}` : null);
          return (
            <div className="shop-row" key={u.upgrade}>
              <span className="what">
                <b>{u.name}</b>
                <span className="muted">{u.blurb}</span>
              </span>
              <span className="price">
                {formatBones(price)}
                {price !== u.list ? (
                  <span className="muted"> (list {formatBones(u.list)})</span>
                ) : null}
              </span>
              <NeonButton
                disabled={!!why}
                title={why ?? undefined}
                onClick={() => dispatch({ t: 'BuyUpgrade', playerId: me.id, upgrade: u.upgrade })}
              >
                Buy
              </NeonButton>
              {why ? <span className="why">{why}</span> : null}
            </div>
          );
        })}
      </Panel>

      <Panel
        title="Space Kibble"
        sub={`buy ${kibble.buy} · sell ${kibble.sell} · spread ${spread} per crate`}
      >
        <div className="grid2">
          <KV
            items={[
              ['Hold', <Gauge key="g" value={crates} max={me.ship.cargoCap} unit="crates" />],
              ['Your dogs eat', `${need} crate${need === 1 ? '' : 's'} at the end of this week`],
              [
                'With an empty hold',
                `you pay ${kibble.buy} ×${balance.foodNoCargoPenalty} a crate on arrival`,
              ],
              [
                'Next stop',
                nextPlanet
                  ? `${nextPlanet.name} — kibble band ${nextPlanet.foodBand[0]}–${nextPlanet.foodBand[1]}`
                  : 'nowhere — this is the Grand Final',
              ],
            ]}
          />
          <div className="stack">
            <label>
              <span className="muted">Crates</span>{' '}
              <input
                type="range"
                min={1}
                max={Math.max(1, Math.max(maxBuy, aboard))}
                value={units || 1}
                disabled={!trading}
                onChange={(e) => setQty(Number(e.target.value))}
              />{' '}
              <b>{units}</b>
            </label>
            <div className="row">
              <NeonButton
                disabled={!trading || units <= 0 || units > maxBuy}
                title={
                  tradeShut ??
                  (units > room
                    ? 'Not enough hold space'
                    : units > affordable
                      ? 'Not enough Bones'
                      : `Costs ${formatBones(units * kibble.buy)}`)
                }
                onClick={() =>
                  dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units })
                }
              >
                Buy {units} for {formatBones(units * kibble.buy)}
              </NeonButton>
              <NeonButton
                disabled={!trading || units <= 0 || units > aboard}
                title={tradeShut ?? `Fetches ${formatBones(units * kibble.sell)}`}
                onClick={() =>
                  dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: -units })
                }
              >
                Sell {units} for {formatBones(units * kibble.sell)}
              </NeonButton>
            </div>
            <div className="row">
              <NeonButton
                disabled={!trading || maxBuy <= 0}
                onClick={() =>
                  dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: maxBuy })
                }
              >
                Fill the hold ({maxBuy})
              </NeonButton>
              <NeonButton
                disabled={!trading || aboard <= 0}
                onClick={() =>
                  dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: -aboard })
                }
              >
                Sell the lot ({aboard})
              </NeonButton>
            </div>
            <Notes
              lines={[
                tradeShut,
                // The number the spread hides (GDD §9.1): carrying kibble blind loses 9.5 a
                // crate, and the reason a player never noticed is that the buy price is printed
                // and the fuel it drags is charged a week later. Say what the crate has to fetch
                // before the crate is bought.
                units > 0
                  ? `${units} crate${units === 1 ? '' : 's'} costs ${formatBones(econ.outlay)} here` +
                    (econ.fuelExtra > 0
                      ? ` plus ${formatBones(econ.fuelExtra)} of extra fuel`
                      : '') +
                    ` — they have to fetch ${econ.breakEven} a crate at the next stop to break even.`
                  : null,
                fuelAfterBuy !== fuelNow
                  ? `Buying ${units} takes the fuel for the next jump from ${formatBones(fuelNow)} to ${formatBones(fuelAfterBuy)}.`
                  : `The first ${balance.fuelCargoFree} crates ride free; fuel only climbs above that (you carry ${crates}).`,
                maxBuy > 0 && maxBuy !== units
                  ? `Filling the hold (${maxBuy}) would cost ${formatBones(full.outlay)} and take the jump to ${formatBones(full.fuelFull)} — break-even ${full.breakEven} a crate.`
                  : null,
                aboard > 0 && fuelAfterSell !== fuelNow
                  ? `Selling ${units} takes it to ${formatBones(fuelAfterSell)}.`
                  : null,
                nextPlanet
                  ? `${nextPlanet.name}'s band is ${nextPlanet.foodBand[0]}–${nextPlanet.foodBand[1]} and you sell into its buy-side, so a band that straddles your break-even is a gamble rather than a trade.`
                  : null,
                `A full hold also costs you ${Math.round(me.ship.cargoCap / balance.arrivalCargoDiv)} off the arrival roll.`,
              ]}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}
