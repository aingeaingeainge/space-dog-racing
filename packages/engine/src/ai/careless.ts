import { dogValue } from '../economy/dogValue';
import { eligible, player, thisWeeksCard } from '../state';
import { RACE_TYPE_IDS, type Action, type Dog, type GameState, type Id } from '../types';
import { KIBBLE_ID } from '../content/goods';
import { STAFF_ROLES_ALL } from '../types';
import { cargoTotal } from '../economy/goods';
import { cargoCap } from '../economy/staff';
import { buyFeedPlan, keepStaff, startPlan, weeklyFoodNeed } from './shared';

/**
 * The careless agent (BUILD_PLAN §7a.5) — a measurement agent, never offered to a player.
 *
 * It exists for one number: GDD §7.5 / D6 asks for bankruptcy in 5–10% of *carelessly played*
 * seasons, and no competent agent ever goes bust, so nothing else can price it. v1's harness
 * reported "0 bankrupt" across every difficulty, which was quietly reporting that the economy
 * could not kill you rather than that the AI was careful.
 *
 * §7a.5 defines it exactly: enters everything, never rests, never trains, hires whatever is
 * offered, never repays a loan, buys the dearest dog it can reach. Two things are worth naming
 * because they are choices rather than the spec:
 *
 * - **It buys food the way Easy does** — only when the hold is empty. Letting it never buy at
 *   all would have it pay the no-cargo penalty every week of the season, which is a drain I
 *   invented rather than one the game has, and the point is to measure the economy's own teeth.
 * - **It does not borrow.** Fat Tony covers a shortfall at endTurn whether you ask or not, so
 *   the debt arrives on its own; deliberately borrowing to spend would be a *strategy*, and a
 *   careless stable does not have one.
 */
export function decideCareless(s: GameState, playerId: Id): Action[] {
  const p = player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);
  const { out } = plan;

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // Hires whatever is offered and takes the dearest tier going, as long as the cash is on the
    // table this instant — no thought for the wage bill, which is D6's most interesting way to go
    // bust (GDD §7.2, §7.5). Three Prime staff is 4,200 a week against a careless stable's ~43,600
    // of prize money, and that is a stable underwater by construction.
    keepStaff(plan, { want: [...STAFF_ROLES_ALL], reckless: true });
    // And buys the dearest crate on the shelf, for the same reason it hires whatever is drinking:
    // it is the money sink §7.5 needs and the same line D26 gives Easy. "Buys the dearest dog it
    // can reach" (§7a.5) was written before the shelves had anything on them.
    if (s.toggles.trading) buyFeedPlan(plan, { reckless: true, crates: 2, spend: 1 });

    // Buys the dearest dog it can reach, pre-race so it can run this weekend. No comparison
    // with what it already owns, and a full kennel is a reason to sell the cheapest, not to stop.
    if (s.phase === 'planetPre') {
      const forSale = s.planet.marketDogIds
        .map((id) => s.dogs[id])
        .filter((d): d is Dog => !!d)
        .sort((a, b) => (b.askingPrice ?? 0) - (a.askingPrice ?? 0));
      for (const d of forSale) {
        const price = d.askingPrice ?? 0;
        if (price > plan.cash) continue;
        if (plan.kennel.length >= p.kennelSlots) {
          if (plan.kennel.length <= 1) break;
          const cheapest = [...plan.kennel].sort((a, b) => dogValue(a) - dogValue(b))[0]!;
          if (RACE_TYPE_IDS.some((r) => s.declarations[r][playerId] === cheapest.id)) break;
          out.push({ t: 'SellDog', playerId, dogId: cheapest.id });
          plan.cash += Math.round(dogValue(cheapest) * 0.8);
          plan.kennel = plan.kennel.filter((x) => x.id !== cheapest.id);
          if (price > plan.cash) break;
        }
        out.push({ t: 'BuyDog', playerId, dogId: d.id });
        plan.cash -= price;
        plan.kennel.push(d);
        break;
      }
    }

    const kibble = s.planet.goods[KIBBLE_ID];
    if (s.toggles.trading && plan.cargo[KIBBLE_ID] === 0 && kibble.buy > 0) {
      // Room in the hold as it will stand, not as the ship was built: the reckless feed buy above
      // has already taken some of it, and a careless stable is careless rather than impossible.
      const units = Math.min(
        cargoCap(p) - cargoTotal(plan.cargo),
        weeklyFoodNeed(s, p),
        Math.floor(Math.max(0, plan.cash) / kibble.buy),
      );
      if (units > 0) {
        out.push({ t: 'TradeFood', playerId, good: KIBBLE_ID, units });
        plan.cash -= units * kibble.buy;
        plan.cargo[KIBBLE_ID] += units;
      }
    }

    // Enters everything: the best dog it has left in every race it is allowed into, whatever
    // the dog's fitness and whatever the purse is worth against the injury risk.
    if (s.phase === 'planetPre') {
      const used = new Set<Id>();
      for (const race of thisWeeksCard(s)) {
        const pick = [...plan.kennel]
          .filter((d) => !used.has(d.id) && eligible(d, race))
          .sort((a, b) => b.rating - a.rating)[0];
        const chosen = pick?.id ?? null;
        if (pick) used.add(pick.id);
        if ((s.declarations[race][playerId] ?? null) !== chosen)
          out.push({ t: 'Declare', playerId, race, dogId: chosen });
      }
    }
  }

  // Never repays a loan, never bets, never trains.
  out.push({ t: 'EndPhase', playerId });
  return out;
}
