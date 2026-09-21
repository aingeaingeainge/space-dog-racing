import { useState } from 'react';
import {
  balance,
  cargoTotal,
  describeTaste,
  formatBones,
  HOLD_CAP,
  planetOf,
  type GameState,
  type GoodId,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Gauge, Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { marketRows, nextStop, type MarketRow } from '../lib/market';
import { weeklyBill } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * The Market — **the only market in v3**, and GDD_V3 §6.2's table, copied from Gazillionaire more
 * or less intact because it is a complete trading UI in five columns:
 *
 *   Your Hold | On Planet | You Paid | Market Price | Price Range
 *
 * **You Paid** is `Player.paid`, the running average the engine keeps per good (decision B4), so
 * nobody does break-even arithmetic in their head: it goes green when the sell price here beats it
 * and pink when it does not. A partial sale leaves it where it was, because what is left still
 * cost what it cost.
 *
 * ⚠️ **The Price Range column is the most important thing in the phase and it is printed as
 * numbers.** "198" means nothing; "198, range 60–480" means *cheap, buy it*, instantly, with no
 * memory and no notes. The bar under the range marks where this week's price sits in it, as an aid
 * to the numbers rather than a replacement for them — BUILD_PLAN_V3's prompt is explicit that the
 * column must not become a cheap/dear icon, because an icon is a verdict and the range is the
 * evidence, and §6.2's bet is that a player can reach the verdict themselves at a glance.
 *
 * Next week's planet is printed under the table as its *food map* — "dear for Pulsar Marrow and
 * Ambrosia" — which is static planet data, not next week's prices. The fog (§2.1) hides the week's
 * draw; it does not hide what kind of place Rustgut is, and a game that made you memorise that
 * would reward whoever brought a pen (the same principle as §5.4's style-on-the-card).
 */
export function Market({ s, me }: { s: GameState; me: Player }) {
  const planet = planetOf(s.planet.planetId);
  const rows = marketRows(s, me);
  const crates = cargoTotal(me.cargo);
  const next = nextStop(s);
  const bill = weeklyBill(s, me);

  const trading = s.toggles.trading;
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';
  const shut = !inTurn
    ? 'Shut while the races are on'
    : !trading
      ? 'No Trading is on this season'
      : null;

  return (
    <Panel
      title={`Market — ${planet.name}`}
      sub="six foods: your inventory and your dogs' training, both at once"
    >
      <div className="market-hold">
        <b>Hold</b> <Gauge value={crates} max={HOLD_CAP} unit="crates" />
        <span className="muted">
          {' '}
          · the same {HOLD_CAP} for every stable, forever · {formatBones(me.cash)} in hand
        </span>
      </div>
      <div className="table-wrap">
        <table className="market">
          <thead>
            <tr>
              <th>Food</th>
              <th className="num">Your Hold</th>
              <th className="num">On Planet</th>
              <th className="num">You Paid</th>
              <th className="num">Market Price</th>
              <th>Price Range</th>
              <th>Trade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.good.id} r={r} me={me} room={HOLD_CAP - crates} shut={shut} />
            ))}
          </tbody>
        </table>
      </div>
      <Notes
        lines={[
          shut,
          next
            ? `Next stop: ${next.name} — ${describeTaste(next)}. That is what kind of place it is, not next week's prices; those are drawn when you land.`
            : 'Nothing past this weekend: whatever is in the hold at the end of it is valued at these sell prices.',
          `Your dogs eat ${bill.foodNeeded} crate${bill.foodNeeded === 1 ? '' : 's'} at the jump, each by the diet you set in the Kennel, falling back to the cheapest thing aboard. A dog the hold cannot feed loses ${balance.emptyHoldFitness} fitness.`,
          `Every ${balance.arrivalCargoDiv} crates aboard when you leave costs a point in next week's turn order — first look at the next shelf, against a hold worth carrying.`,
        ]}
      />
    </Panel>
  );
}

function Row({
  r,
  me,
  room,
  shut,
}: {
  r: MarketRow;
  me: Player;
  room: number;
  shut: string | null;
}) {
  const dispatch = useGame((g) => g.dispatch);
  const affordable = r.buy > 0 ? Math.floor(me.cash / r.buy) : 0;
  const maxBuy = Math.max(0, Math.min(room, affordable, r.onShelf));
  const [qty, setQty] = useState(1);
  const n = Math.max(1, qty);
  const trade = (units: number) =>
    dispatch({ t: 'TradeFood', playerId: me.id, good: r.good.id as GoodId, units });

  return (
    <tr className={r.aboard > 0 ? 'me' : ''}>
      <td>
        <b>{r.good.label}</b>
      </td>
      <td className="num">{r.aboard || <span className="muted">—</span>}</td>
      <td className="num">{r.onShelf}</td>
      <td className="num">
        {r.paid === null ? (
          <span className="muted">—</span>
        ) : (
          <span
            className={r.sell > r.paid ? 'gain' : r.sell < r.paid ? 'loss' : ''}
            title={`Sold here, a crate fetches ${r.sell} against the ${Math.round(r.paid)} you paid: ${r.sell >= r.paid ? '+' : '−'}${Math.abs(Math.round(r.sell - r.paid))} each`}
          >
            {Math.round(r.paid)}
          </span>
        )}
      </td>
      <td
        className="num"
        title={
          r.nextSell === null
            ? 'The last stop of the season'
            : `Next stop usually pays about ${r.nextSell} a crate`
        }
      >
        <b>{r.buy}</b>
        <div className="muted small">sells {r.sell}</div>
      </td>
      <td>
        <div className="range">
          <span className="num">{r.good.floor}</span>
          <span
            className={`range-bar ${r.word}`}
            title={`${r.buy} is ${Math.round(r.pos * 100)}% of the way from ${r.good.floor} to ${r.good.ceiling}`}
          >
            <span className="range-mark" style={{ left: `${r.pos * 100}%` }} />
          </span>
          <span className="num">{r.good.ceiling}</span>
        </div>
      </td>
      <td className="trade">
        <input
          type="number"
          min={1}
          value={n}
          disabled={!!shut}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          aria-label={`Crates of ${r.good.label}`}
        />
        <NeonButton
          disabled={!!shut || n > maxBuy}
          title={
            shut ??
            (n > room
              ? 'Not enough hold space'
              : n > r.onShelf
                ? `Only ${r.onShelf} on the shelf`
                : n > affordable
                  ? 'Not enough Bones'
                  : `Costs ${formatBones(n * r.buy)}`)
          }
          onClick={() => trade(n)}
        >
          Buy
        </NeonButton>
        <NeonButton
          disabled={!!shut || n > r.aboard}
          title={shut ?? `Fetches ${formatBones(n * r.sell)}`}
          onClick={() => trade(-n)}
        >
          Sell
        </NeonButton>
        <NeonButton
          disabled={!!shut || maxBuy <= 0}
          title={shut ?? `${maxBuy} for ${formatBones(maxBuy * r.buy)}`}
          onClick={() => trade(maxBuy)}
        >
          Max
        </NeonButton>
        <NeonButton
          disabled={!!shut || r.aboard <= 0}
          title={shut ?? `${r.aboard} for ${formatBones(r.aboard * r.sell)}`}
          onClick={() => trade(-r.aboard)}
        >
          All
        </NeonButton>
      </td>
    </tr>
  );
}
