/**
 * The market, as the screens read it (GDD_V3 §6.2).
 *
 * **One place turns a price into "is that good?"**, and every screen that asks — the Market's
 * Price Range column, the hub's hotspot, the Galaxy Map's rumours — asks it here. §6.2's whole bet
 * is that a player can answer that question from the range alone, with no memory and no notes, so
 * the arithmetic behind the answer has to be one arithmetic.
 *
 * Nothing here is a rule. The engine rolls the prices, keeps the shelf and says what a planet is
 * expected to pay (`expectedPrice`); this only says it in words.
 */
import {
  balance,
  expectedPrice,
  intelPrice,
  GOODS,
  planetOf,
  type GameState,
  type Good,
  type GoodId,
  type Planet,
  type Player,
} from '@sdr/engine';

/** Where a price sits in its good's band: 0 at the floor, 1 at the ceiling. */
export function bandPosition(g: Good, price: number): number {
  return Math.max(0, Math.min(1, (price - g.floor) / (g.ceiling - g.floor)));
}

/**
 * The word for a band position. Quartiles, because a player reading "198, range 60–480" does
 * quartiles in their head whether we print them or not: the bottom quarter is a buy, the top
 * quarter is a sell, and the middle half is the week the price does not make the decision.
 */
export function priceWord(pos: number): 'cheap' | 'fair' | 'dear' {
  return pos <= 0.25 ? 'cheap' : pos >= 0.75 ? 'dear' : 'fair';
}

/** Next week's planet, or null at the Grand Final. The name is all the fog allows (§2.1). */
export function nextStop(s: GameState): Planet | null {
  const e = s.calendar[s.week];
  return e ? planetOf(e.planetId) : null;
}

export interface MarketRow {
  good: Good;
  aboard: number;
  /** §6.2's You Paid: the running average per crate of what is aboard, or null for none aboard. */
  paid: number | null;
  onShelf: number;
  buy: number;
  sell: number;
  pos: number;
  word: 'cheap' | 'fair' | 'dear';
  /** What next week's planet is expected to pay for a crate, after the spread. Null at the Final. */
  nextSell: number | null;
  /** True when `nextSell` is next week's actual price, from a Bar tip (GDD_V3 §9.4). */
  nextKnown: boolean;
}

/** The six rows of §6.2's table, cheapest good first. */
export function marketRows(s: GameState, me: Player): MarketRow[] {
  const next = nextStop(s);
  return GOODS.map((g) => {
    const m = s.planet.goods[g.id];
    const pos = bandPosition(g, m.buy);
    return {
      good: g,
      aboard: me.cargo[g.id],
      paid: me.cargo[g.id] > 0 ? me.paid[g.id] : null,
      onShelf: m.stock,
      buy: m.buy,
      sell: m.sell,
      pos,
      word: priceWord(pos),
      nextSell:
        intelPrice(s, me, g.id) ??
        (next ? Math.round(expectedPrice(next, g.id) * (1 - balance.foodSpread)) : null),
      nextKnown: intelPrice(s, me, g.id) !== null,
    };
  });
}

/**
 * The one line a hotspot has room for: the cheapest-looking good on this shelf, or the dearest
 * thing in your hold, or null when nothing is worth a walk. §10.1's principle, carried from v2
 * (D34): a hotspot flags what *changes*, not what is always there.
 */
export function marketHeadline(
  s: GameState,
  me: Player,
): { line: string; short: string; kind: 'buy' | 'sell' } | null {
  const rows = marketRows(s, me);
  const sellable = rows
    .filter((r) => r.aboard > 0 && r.word === 'dear')
    .sort((a, b) => b.pos - a.pos)[0];
  if (sellable)
    return {
      line: `${sellable.good.label} sells at ${sellable.sell} here — the top of its ${sellable.good.floor}–${sellable.good.ceiling} range`,
      short: `sell ${sellable.good.short}`,
      kind: 'sell',
    };
  const cheap = rows
    .filter((r) => r.onShelf > 0 && r.word === 'cheap' && me.cash >= r.buy)
    .sort((a, b) => a.pos - b.pos)[0];
  if (cheap)
    return {
      line: `${cheap.good.label} at ${cheap.buy} — the bottom of its ${cheap.good.floor}–${cheap.good.ceiling} range`,
      short: `cheap ${cheap.good.short}`,
      kind: 'buy',
    };
  return null;
}

/**
 * The good a planet is most notable for, and which way — what a rumour or a map line would say
 * about it. Null for a planet that is middling for everything.
 */
export function mostNotable(planet: Planet): { id: GoodId; cheap: boolean; bias: number } | null {
  let best: { id: GoodId; cheap: boolean; bias: number } | null = null;
  for (const g of GOODS) {
    const bias = planet.foodBand[g.id];
    if (Math.abs(bias - 1) < 0.25) continue;
    if (!best || Math.abs(bias - 1) > Math.abs(best.bias - 1))
      best = { id: g.id, cheap: bias < 1, bias };
  }
  return best;
}
