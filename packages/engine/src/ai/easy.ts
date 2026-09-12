import { balance } from '../content/balance';
import { dogValue } from '../economy/dogValue';
import { eligible, player, thisWeeksCard } from '../state';
import { RACE_TYPE_IDS, type Action, type GameState, type Id } from '../types';
import { KIBBLE_ID } from '../content/goods';
import { hash01, setStates, startPlan, weeklyFoodNeed } from './shared';

/**
 * How often Easy cannot be bothered with a race and leaves the trap to the locals. Half the
 * card sounds like a lot, but it is the number that lands BUILD_PLAN M4's "Normal beats Easy
 * ~80% of seasons": below it, Easy's floor is high enough that a Normal stable having a bad
 * week still finishes under it. Nothing on screen changes — an empty trap is filled by a local.
 */
const SKIP_RATE = 0.85;

/**
 * Easy's Race/Train/Rest rule (GDD §14): it races anything fit enough and rests anything under
 * 40, and it never trains — a training week is an investment, and Easy does not make those.
 * That is the whole of the difference, and it is the cheapest way for Normal's rule to be worth
 * something.
 */
const EASY_REST_BELOW = 40;

/**
 * Easy AI (GDD §14): near-random declarations respecting the caps, rests anything under 40 and
 * never trains, never bets, buys food only when the hold will not cover the week, never hires
 * staff, sells a dog only when broke.
 *
 * "Near-random" is `hash01` of the season seed, the week and the ids — never `Math.random` and
 * never the state's rng, which the reducer owns. So Easy is unpredictable to a player and still
 * a pure function of the state, and a season replays from its log exactly.
 */
export function decideEasy(s: GameState, playerId: Id): Action[] {
  const p = player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);
  const { out } = plan;

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // Broke, and only then: let the cheapest dog go.
    if (plan.cash < 0 && plan.kennel.length > 1) {
      const cheapest = [...plan.kennel].sort((a, b) => dogValue(a) - dogValue(b))[0]!;
      const isDeclared = RACE_TYPE_IDS.some((r) => s.declarations[r][playerId] === cheapest.id);
      if (!(isDeclared && s.phase === 'planetPre')) {
        out.push({ t: 'SellDog', playerId, dogId: cheapest.id });
        plan.cash += Math.round(dogValue(cheapest) * balance.marketSellFactor);
        plan.kennel = plan.kennel.filter((d) => d.id !== cheapest.id);
      }
    }

    // Food: never a trade, and only when the hold is actually empty — which is how a careless
    // stable ends up buying a week's kibble at a mining colony's prices, or paying the
    // no-cargo penalty on the way out.
    if (s.toggles.trading) {
      const need = weeklyFoodNeed(s, p);
      const kibble = s.planet.goods[KIBBLE_ID];
      if (plan.cargo[KIBBLE_ID] === 0 && kibble.buy > 0) {
        const units = Math.min(
          p.ship.cargoCap,
          need,
          Math.floor(Math.max(0, plan.cash) / kibble.buy),
        );
        if (units > 0) {
          out.push({ t: 'TradeFood', playerId, good: KIBBLE_ID, units });
          plan.cash -= units * kibble.buy;
          plan.cargo[KIBBLE_ID] += units;
        }
      }
    }

    if (s.phase === 'planetPre') {
      // Shuffle the fit dogs by a per-week hash, then walk the three races taking whoever is
      // next in that order and eligible. No expected purse anywhere: that is Normal's job.
      // plan.kennel, not ownDogs: a dog sold a moment ago is no longer ours to declare.
      const fit = plan.kennel.filter(
        (d) => d.injuryWeeks === 0 && d.banWeeks === 0 && d.fitness >= EASY_REST_BELOW,
      );
      const shuffled = [...fit].sort(
        (a, b) => hash01(s.seed, s.week, playerId, a.id) - hash01(s.seed, s.week, playerId, b.id),
      );
      const used = new Set<Id>();
      for (const race of thisWeeksCard(s)) {
        let chosen: Id | null = null;
        if (hash01(s.seed, s.week, playerId, race, 'skip') > SKIP_RATE) {
          const pick = shuffled.find((d) => !used.has(d.id) && eligible(d, race));
          if (pick) {
            chosen = pick.id;
            used.add(pick.id);
          }
        }
        if ((s.declarations[race][playerId] ?? null) !== chosen)
          out.push({ t: 'Declare', playerId, race, dogId: chosen });
      }
      setStates(plan, used, { train: false });
    }
  }

  // Easy never visits the bookie.
  out.push({ t: 'EndPhase', playerId });
  return out;
}
