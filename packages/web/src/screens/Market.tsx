import { useState } from 'react';
import {
  balance,
  cargoTotal,
  formatBones,
  HOLD_CAP,
  KIBBLE_ID,
  planetOf,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Gauge, KV, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { ownedDogs } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/** Crates the stable will eat at the end of this week (GDD §7.2, GDD_V3 §6.3). */
function weeklyFood(s: GameState, p: Player): number {
  let need = 0;
  for (const d of ownedDogs(s, p))
    need += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
  return p.sponsorWeeks > 0 ? need * 2 : need;
}

/**
 * The Market — **the only market in v3** (GDD_V3 §6).
 *
 * ⚠️ **This screen was the dog market and the gear counter, and now it is the food trade.**
 * BUILD_PLAN_V3 §2.1 deletes the shelf of dogs, the asking prices, the track-day passes, the
 * muzzles and the supplement; the food trading that used to live at the Docks moves here, because
 * the Docks is deleted too (GDD_V3 §10) and food is the one thing left to buy. The fuel arithmetic
 * that made carrying a crate a real calculation goes with the fuel — a crate is worth carrying
 * whenever the next planet's floor beats this planet's price, and nothing else.
 *
 * **Phase B replaces this screen wholesale** with GDD_V3 §6.2's five columns — Your Hold / On Planet
 * / You Paid / Market Price / **Price Range** — over six goods on 8× bands. §6.2 is emphatic that
 * the Price Range column is what makes the market legible on a first play, and that it must not be
 * swapped for a cheap/dear icon. What is here now is one good and a slider: enough that the trade
 * loop runs and the harness has something to measure, and deliberately no more than that.
 */
export function Market({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  const [qty, setQty] = useState(5);

  const food = s.planet.goods[KIBBLE_ID];
  const crates = cargoTotal(me.cargo);
  const aboard = me.cargo[KIBBLE_ID];
  const room = HOLD_CAP - crates;
  const affordable = food.buy > 0 ? Math.floor(me.cash / food.buy) : 0;
  const maxBuy = Math.max(0, Math.min(room, affordable, food.stock));
  const units = Math.max(0, Math.min(qty, Math.max(maxBuy, aboard)));
  const spread = food.buy - food.sell;
  const need = weeklyFood(s, me);
  const next = s.calendar[s.week];
  const nextPlanet = next ? planetOf(next.planetId) : null;

  const trading = s.toggles.trading;
  const tradeShut = trading ? null : 'No Trading is on this season';
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';
  const shut = inTurn ? tradeShut : 'Shut while the races are on';

  return (
    <Panel
      title={`Market — ${planet.name}`}
      sub={`buy ${food.buy} · sell ${food.sell} · spread ${spread} per crate`}
    >
      <div className="grid2">
        <KV
          items={[
            ['Hold', <Gauge key="g" value={crates} max={HOLD_CAP} unit="crates" />],
            ['Your dogs eat', `${need} crate${need === 1 ? '' : 's'} at the end of this week`],
            [
              'With an empty hold',
              `each dog loses ${balance.emptyHoldFitness} fitness and gains nothing`,
            ],
            [
              'Next stop',
              nextPlanet
                ? `${nextPlanet.name} — food band ${nextPlanet.foodBand[0]}–${nextPlanet.foodBand[1]}`
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
              disabled={!!shut}
              onChange={(e) => setQty(Number(e.target.value))}
            />{' '}
            <b>{units}</b>
          </label>
          <div className="row">
            <NeonButton
              disabled={!!shut || units <= 0 || units > maxBuy}
              title={
                shut ??
                (units > room
                  ? 'Not enough hold space'
                  : units > affordable
                    ? 'Not enough Bones'
                    : `Costs ${formatBones(units * food.buy)}`)
              }
              onClick={() => dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units })}
            >
              Buy {units} for {formatBones(units * food.buy)}
            </NeonButton>
            <NeonButton
              disabled={!!shut || units <= 0 || units > aboard}
              title={shut ?? `Fetches ${formatBones(units * food.sell)}`}
              onClick={() =>
                dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: -units })
              }
            >
              Sell {units} for {formatBones(units * food.sell)}
            </NeonButton>
          </div>
          <div className="row">
            <NeonButton
              disabled={!!shut || maxBuy <= 0}
              onClick={() =>
                dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: maxBuy })
              }
            >
              Fill the hold ({maxBuy})
            </NeonButton>
            <NeonButton
              disabled={!!shut || aboard <= 0}
              onClick={() =>
                dispatch({ t: 'TradeFood', playerId: me.id, good: KIBBLE_ID, units: -aboard })
              }
            >
              Sell the lot ({aboard})
            </NeonButton>
          </div>
          <Notes
            lines={[
              shut,
              units > 0
                ? `${units} crate${units === 1 ? '' : 's'} costs ${formatBones(units * food.buy)} here — ` +
                  `they have to fetch ${Math.ceil(food.buy)} a crate at the next stop to break even.`
                : null,
              nextPlanet
                ? `${nextPlanet.name}'s band is ${nextPlanet.foodBand[0]}–${nextPlanet.foodBand[1]}, so a crate bought at ${food.buy} ` +
                  (nextPlanet.foodBand[0] * (1 - balance.foodSpread) > food.buy
                    ? 'is worth carrying.'
                    : 'is probably not worth carrying.')
                : 'Nothing past this weekend: sell what you are holding.',
              `Turn order next week is set by how heavy you are — every five crates costs you a place. First pick of the shelf against a hold worth carrying is the whole trade.`,
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}
