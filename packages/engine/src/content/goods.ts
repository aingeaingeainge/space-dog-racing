import { balance } from './balance';
import type { GoodId, StatKey } from '../types';
import { GOOD_IDS } from '../types';

/**
 * The six foods (GDD_V3 §6), as data.
 *
 * **There is exactly one market in v3, and it sells these.** Each is simultaneously a trade good
 * and a week's training (V5): every dog eats one unit a week whatever it is doing and gains that
 * food's bonus (§6.3), so every market decision is also a training decision.
 *
 * **Content is data: a good is a row here and an id in `GoodId`.** Nothing branches on which good
 * it is — the price draw asks `floor` and `ceiling`, the shelf asks the depth, the feeding loop asks
 * `stat` and the gain band — and none of them knows what a row is called. Every number is a cell in
 * the spreadsheet (`balance.json`), so a row here is names and pointers and nothing else.
 */
export interface Good {
  id: GoodId;
  /** Full name, as a shelf label or an error message says it. */
  label: string;
  /** Column form, for a table that is short of room. */
  short: string;
  /**
   * §6.1's band. **Every good is exactly 8× from floor to ceiling**, so every good is the same
   * *bet* and differs only in how much capital it takes to make it — and the across-good ladder at
   * the floor (1 / 2 / 3 / 6 / 7.5 / 9) is a near-equal 9×. That near-equality is what makes a
   * cash-bound stable and a hold-bound stable play different games.
   */
  floor: number;
  ceiling: number;
  /** §6.1's shelf depth per planet, rolled weekly — the scarcity rule (V7). */
  shelfMin: number;
  shelfMax: number;
  /**
   * The stat a week of this food is aimed at (§6.3), or null for a random one.
   *
   * ⚠️ **The aim is light on purpose (V6).** Three cheap foods each point at one stat and three
   * dearer ones land at random; the randomness sits *inside* each row, where it adds texture,
   * rather than between them, where it would reduce six foods to one ladder of magnitude and make
   * feeding "buy the best you can afford".
   */
  stat: StatKey | null;
  /** Stat points a week of this food adds, inclusive. */
  gainMin: number;
  gainMax: number;
  /** Fitness a week of this food adds on top of the week's own recovery — the exotics' condition. */
  fitness: number;
  /**
   * Multiplier on the dog's injury chance in the races after the jump it ate this at — Ambrosia's
   * "injury chance halved this week" (§6.3). 1 for every food that does not touch it.
   */
  injuryMult: number;
}

export const GOODS: readonly Good[] = [
  {
    id: 'greyMash',
    label: 'Grey Mash',
    short: 'Mash',
    floor: balance.greyMashFloor,
    ceiling: balance.greyMashCeiling,
    shelfMin: balance.greyMashShelfMin,
    shelfMax: balance.greyMashShelfMax,
    stat: null,
    gainMin: balance.greyMashGainMin,
    gainMax: balance.greyMashGainMax,
    // 0 and 1 are "this food does not touch condition" — the identities, not tunables. §6.3 gives
    // fitness and an injury effect to the two exotics only, and those are sheet cells.
    fitness: 0,
    injuryMult: 1,
  },
  {
    id: 'scrapmeat',
    label: 'Scrapmeat',
    short: 'Scrap',
    floor: balance.scrapmeatFloor,
    ceiling: balance.scrapmeatCeiling,
    shelfMin: balance.scrapmeatShelfMin,
    shelfMax: balance.scrapmeatShelfMax,
    stat: 'stamina',
    gainMin: balance.scrapmeatGainMin,
    gainMax: balance.scrapmeatGainMax,
    fitness: 0,
    injuryMult: 1,
  },
  {
    id: 'glowTripe',
    label: 'Glow Tripe',
    short: 'Tripe',
    floor: balance.glowTripeFloor,
    ceiling: balance.glowTripeCeiling,
    shelfMin: balance.glowTripeShelfMin,
    shelfMax: balance.glowTripeShelfMax,
    stat: 'accel',
    gainMin: balance.glowTripeGainMin,
    gainMax: balance.glowTripeGainMax,
    fitness: 0,
    injuryMult: 1,
  },
  {
    id: 'vatSteak',
    label: 'Vat Steak',
    short: 'Steak',
    floor: balance.vatSteakFloor,
    ceiling: balance.vatSteakCeiling,
    shelfMin: balance.vatSteakShelfMin,
    shelfMax: balance.vatSteakShelfMax,
    stat: 'speed',
    gainMin: balance.vatSteakGainMin,
    gainMax: balance.vatSteakGainMax,
    fitness: 0,
    injuryMult: 1,
  },
  {
    id: 'pulsarMarrow',
    label: 'Pulsar Marrow',
    short: 'Marrow',
    floor: balance.pulsarMarrowFloor,
    ceiling: balance.pulsarMarrowCeiling,
    shelfMin: balance.pulsarMarrowShelfMin,
    shelfMax: balance.pulsarMarrowShelfMax,
    stat: null,
    gainMin: balance.pulsarMarrowGainMin,
    gainMax: balance.pulsarMarrowGainMax,
    fitness: balance.pulsarMarrowFitness,
    injuryMult: 1,
  },
  {
    id: 'ambrosia',
    label: 'Ambrosia',
    short: 'Ambrosia',
    floor: balance.ambrosiaFloor,
    ceiling: balance.ambrosiaCeiling,
    shelfMin: balance.ambrosiaShelfMin,
    shelfMax: balance.ambrosiaShelfMax,
    stat: null,
    gainMin: balance.ambrosiaGainMin,
    gainMax: balance.ambrosiaGainMax,
    fitness: balance.ambrosiaFitness,
    injuryMult: balance.ambrosiaInjuryMult,
  },
];

// The row list and the canonical id order are two statements of one fact; fail at load, not at a
// seed nobody tested, if they ever disagree.
if (GOODS.map((g) => g.id).join() !== GOOD_IDS.join())
  throw new Error('content/goods.ts rows are out of GOOD_IDS order');

export const GOOD_BY_ID: Record<GoodId, Good> = Object.fromEntries(
  GOODS.map((g) => [g.id, g]),
) as Record<GoodId, Good>;

export function good(id: GoodId): Good {
  const g = GOOD_BY_ID[id];
  if (!g) throw new Error('Unknown good ' + id);
  return g;
}

/**
 * The cheapest food: what a stable starts with aboard, what the gate sells in a No Trading season,
 * and what a hungry dog's owner is steered towards. Read off the rows' floors rather than named, so
 * nothing branches on which good it is.
 */
export const STAPLE_ID: GoodId = [...GOODS].sort((a, b) => a.floor - b.floor)[0]!.id;

/** Every food aimed at one stat, cheapest first. */
export function feedsFor(stat: StatKey): readonly Good[] {
  return GOODS.filter((g) => g.stat === stat);
}
