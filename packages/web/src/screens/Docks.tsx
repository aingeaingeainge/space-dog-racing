import { useState } from 'react';
import {
  balance,
  formatBones,
  fuelCost,
  planetOf,
  upgradePrice,
  type GameState,
  type Player,
  type UpgradeId,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Gauge, KV, Notes } from '../components/ui';
import { ownedDogs } from '../lib/selectors';
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

  const room = me.ship.cargoCap - me.cargo;
  const affordable = s.planet.foodBuy > 0 ? Math.floor(me.cash / s.planet.foodBuy) : 0;
  const maxBuy = Math.max(0, Math.min(room, affordable));
  const units = Math.max(0, Math.min(qty, Math.max(maxBuy, me.cargo)));
  const spread = s.planet.foodBuy - s.planet.foodSell;
  const need = weeklyFood(s, me);
  const next = s.calendar[s.week];
  const nextPlanet = next ? planetOf(next.planetId) : null;
  const fuelNow = fuelCost(me.cargo);
  const fuelAfterBuy = fuelCost(me.cargo + units);
  const fuelAfterSell = fuelCost(Math.max(0, me.cargo - units));

  const trading = s.toggles.trading;
  const tradeShut = trading ? null : 'No Trading is on this season';

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
      name: `Cargo hold +${balance.cargoUpgradeUnits}`,
      blurb: `Hold ${me.ship.cargoCap} → ${me.ship.cargoCap + balance.cargoUpgradeUnits} crates`,
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
              ['Ship', `engine ${me.ship.speed}/${balance.shipMaxSpeed}${me.ship.coldStore ? ' · cold store' : ''}`],
              ['Hold', <Gauge key="g" value={me.cargo} max={me.ship.cargoCap} unit="crates" />],
              ['Fuel next jump', `${formatBones(fuelNow)} (${balance.fuelBase} + ${balance.fuelPerCargoUnitOver}/crate over ${balance.fuelCargoFree})`],
              ['Cash', formatBones(me.cash)],
            ]}
          />
          <Notes
            lines={[
              `Cargo also slows you down: the arrival roll is ship speed ×${balance.arrivalSpeedMult} − crates ÷ ${balance.arrivalCargoDiv} + d${balance.arrivalDie}, and first in gets first look at the market.`,
              sp.shipDiscount ? `Ship upgrades are ${pct(sp.shipDiscount)} off here.` : null,
              sp.engineDiscount ? `Engines are ${pct(sp.engineDiscount)} off here.` : null,
              sp.kennelDiscount ? `Kennel modules are ${pct(sp.kennelDiscount)} off here.` : null,
              sp.everythingMarkup ? `Everything on this rock is ${pct(sp.everythingMarkup)} dearer.` : null,
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

      <Panel title="Ship upgrades" sub="GDD §8 — every purchase should pay for itself inside five weeks">
        {ships.map((u) => {
          const price = upgradePrice(u.upgrade, planet, me);
          const why = u.shut ?? (price > me.cash ? `Short by ${formatBones(price - me.cash)}` : null);
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
              <button
                disabled={!!why}
                title={why ?? undefined}
                onClick={() => dispatch({ t: 'BuyUpgrade', playerId: me.id, upgrade: u.upgrade })}
              >
                Buy
              </button>
              {why ? <span className="why">{why}</span> : null}
            </div>
          );
        })}
      </Panel>

      <Panel
        title="Space Kibble"
        sub={`buy ${s.planet.foodBuy} · sell ${s.planet.foodSell} · spread ${spread} per crate`}
      >
        <div className="grid2">
          <KV
            items={[
              ['Hold', <Gauge key="g" value={me.cargo} max={me.ship.cargoCap} unit="crates" />],
              ['Your dogs eat', `${need} crate${need === 1 ? '' : 's'} at the end of this week`],
              [
                'With an empty hold',
                `you pay ${s.planet.foodBuy} ×${balance.foodNoCargoPenalty} a crate on arrival`,
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
                max={Math.max(1, Math.max(maxBuy, me.cargo))}
                value={units || 1}
                disabled={!trading}
                onChange={(e) => setQty(Number(e.target.value))}
              />{' '}
              <b>{units}</b>
            </label>
            <div className="row">
              <button
                disabled={!trading || units <= 0 || units > maxBuy}
                title={
                  tradeShut ??
                  (units > room
                    ? 'Not enough hold space'
                    : units > affordable
                      ? 'Not enough Bones'
                      : `Costs ${formatBones(units * s.planet.foodBuy)}`)
                }
                onClick={() => dispatch({ t: 'TradeFood', playerId: me.id, units })}
              >
                Buy {units} for {formatBones(units * s.planet.foodBuy)}
              </button>
              <button
                disabled={!trading || units <= 0 || units > me.cargo}
                title={tradeShut ?? `Fetches ${formatBones(units * s.planet.foodSell)}`}
                onClick={() => dispatch({ t: 'TradeFood', playerId: me.id, units: -units })}
              >
                Sell {units} for {formatBones(units * s.planet.foodSell)}
              </button>
            </div>
            <div className="row">
              <button
                disabled={!trading || maxBuy <= 0}
                onClick={() => dispatch({ t: 'TradeFood', playerId: me.id, units: maxBuy })}
              >
                Fill the hold ({maxBuy})
              </button>
              <button
                disabled={!trading || me.cargo <= 0}
                onClick={() => dispatch({ t: 'TradeFood', playerId: me.id, units: -me.cargo })}
              >
                Sell the lot ({me.cargo})
              </button>
            </div>
            <Notes
              lines={[
                tradeShut,
                fuelAfterBuy !== fuelNow
                  ? `Buying ${units} takes the fuel for the next jump from ${formatBones(fuelNow)} to ${formatBones(fuelAfterBuy)}.`
                  : `The first ${balance.fuelCargoFree} crates ride free; fuel only climbs above that (you carry ${me.cargo}).`,
                me.cargo > 0 && fuelAfterSell !== fuelNow
                  ? `Selling ${units} takes it to ${formatBones(fuelAfterSell)}.`
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
