import { balance } from '../content/balance';
import { GOODS } from '../content/goods';
import { GOOD_IDS, type Cargo, type GoodId, type GameState, type Player } from '../types';

/**
 * The hold, and the four questions the rest of the engine asks it.
 *
 * **Why the hold is a dense record.** `Cargo` carries a key for every good whether or not any of
 * it is aboard. The sparse alternative — only the goods you hold — reads `?? 0` at every site and
 * there are a lot of sites; worse, `GameState` *is* the save file and the golden digest hashes
 * `JSON.stringify(state)`, so a sparse record would make the hash depend on the order a stable
 * happened to buy things in. Dense, built once by `emptyCargo()` in `GOOD_IDS` order, is
 * canonical: the same hold always serialises the same way. A zero per good per stable is a price
 * worth paying for that, and it is why Phase B's six rows need no change here.
 */
export function emptyCargo(): Cargo {
  return Object.fromEntries(GOOD_IDS.map((id) => [id, 0])) as Cargo;
}

/** Crates aboard, all goods together — what the arrival roll is charged against (GDD_V3 §2.3). */
export function cargoTotal(cargo: Cargo): number {
  let total = 0;
  for (const id of GOOD_IDS) total += cargo[id];
  return total;
}

/**
 * The hold: **50 crates, for everybody, forever** (GDD_V3 §6.1).
 *
 * ⚠️ **There is no ship to upgrade (BUILD_PLAN_V3 §2.1), so capacity is a constant rather than a
 * field** — and `Player.ship` went in Phase A. Phase A held it at v2's starting 20 on purpose, so
 * that deleting things could be measured on its own; Phase B raises it to 50 in the same commit that
 * gives the six goods something to spend it on. At 50 the cash binds first and the hold binds from
 * the middle of the season, which is §6.1's progression and the harness's crossover row.
 */
export const HOLD_CAP = balance.holdCap;

/** Room left in the hold. */
export function holdRoom(p: Player): number {
  return HOLD_CAP - cargoTotal(p.cargo);
}

/**
 * Crates arriving in the hold at a known cost per crate, and the running average that is §6.2's
 * **You Paid** column (decision B4). A purchase moves the average toward its own price in
 * proportion to the crates it adds; a free crate (an event) arrives at zero and pulls it down,
 * because you did not pay for it. Crates leaving — sold, eaten, spoiled, taken — leave *at* the
 * average and do not move it, which is what makes a partial sale sensible: sell half and what is
 * left still cost what it cost.
 */
export function recordPurchase(p: Player, id: GoodId, crates: number, costEach: number): void {
  const held = p.cargo[id];
  p.paid[id] = held > 0 ? (p.paid[id] * held + costEach * crates) / (held + crates) : costEach;
  p.cargo[id] = held + crates;
}

/**
 * Zero the average for any good the hold no longer carries, so the save never records a price for
 * crates that are not there. Run after every action (`reduce.ts`), which is cheaper to reason about
 * than hooking every one of the six places a crate can leave the hold.
 */
export function settleHold(p: Player): void {
  for (const id of GOOD_IDS) if (p.cargo[id] === 0 && p.paid[id] !== 0) p.paid[id] = 0;
}

/**
 * What the hold is worth at this planet's sell prices — the `cargo` line of net worth (GDD §4.3).
 *
 * Per good, at that good's own local sell price, because that is what the hold would actually
 * fetch if it were emptied here. `properties.test.ts` re-derives this sum independently and
 * asserts net worth equals it plus the other parts, which is the invariant this phase most
 * threatens: get the valuation subtly wrong and it fails at a seed nobody tested.
 */
export function cargoValue(s: GameState, p: Player): number {
  let total = 0;
  for (const id of GOOD_IDS) total += p.cargo[id] * s.planet.goods[id].sell;
  return Math.round(total);
}

/**
 * Lose a fraction of the hold — Glassfall's freeze, the cold store's absence, a pirate's cut, a
 * customs officer's spite (GDD §12).
 *
 * **Decided here, and it is a decision: the fraction is of the *total*, and the crates come off
 * the largest stacks first.** Rounding up per good instead would mean a hold split thinly across
 * many goods lost a crate of each — 13 of 13 at a 25% spoil rate, when there were 13 — so the per-good
 * reading punishes a diversified trader absurdly, and the obvious fix (rounding down per good)
 * lets a hold of twelve three-crate stacks spoil nothing at all. Taking the loss off the biggest
 * stacks is proportional to what "a fraction of the hold" means, cannot be dodged by splitting a
 * hold up, and is deterministic without consuming an rng draw.
 *
 * Returns the number of crates lost, and mutates `cargo`.
 */
export function spoilCargo(cargo: Cargo, fraction: number): number {
  const total = cargoTotal(cargo);
  if (total <= 0 || fraction <= 0) return 0;
  let toLose = Math.min(total, Math.ceil(total * fraction));
  const lost = toLose;
  // Largest stack first, ties broken by GOOD_IDS order so the result never depends on key order.
  while (toLose > 0) {
    let pick: GoodId | null = null;
    for (const id of GOOD_IDS) {
      if (cargo[id] > 0 && (pick === null || cargo[id] > cargo[pick])) pick = id;
    }
    if (pick === null) break;
    const take = Math.min(cargo[pick], toLose);
    cargo[pick] -= take;
    toLose -= take;
  }
  return lost - toLose;
}

/** Empty the hold, returning what was lost. Pirates who take the lot. */
export function emptyHold(cargo: Cargo): number {
  const total = cargoTotal(cargo);
  for (const id of GOOD_IDS) cargo[id] = 0;
  return total;
}

/** Every good, cheapest first — the §6.1 ladder, in the order a market table prints it. */
export function goodsInOrder(): readonly GoodId[] {
  return GOODS.map((g) => g.id);
}
