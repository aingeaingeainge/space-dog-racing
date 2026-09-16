import { eligible, player, thisWeeksCard } from '../state';
import type { Action, GameState, Id } from '../types';
import { KIBBLE_ID } from '../content/goods';
import { cargoTotal, HOLD_CAP } from '../economy/goods';
import { buyFeedPlan, hash01, setStates, startPlan, weeklyFoodNeed } from './shared';

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
 * never trains, never bets, and buys food only when the hold will not cover the week.
 *
 * ⚠️ Its one remaining self-harm is the reckless feed buy below. The forced sale when broke is gone
 * with the dog market (BUILD_PLAN_V3 §2.1) — and so is going broke (GDD_V3 V10).
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
    // D26's fix, and the only line in Easy that costs it money while it is still racing: it buys
    // the dearest crate on the shelf whether or not it has a dog on that stat. Every other handicap
    // §14 gives Easy — never hires, never bets, never buys a dog — is a *saving*, which is why
    // Normal beat the old Easy by turning up rather than by playing better.
    if (s.phase === 'planetPre' && s.toggles.trading) buyFeedPlan(plan, { reckless: true });
    // Food: never a trade, and only when the hold is actually empty — which is how a careless
    // stable ends up buying a week's kibble at a mining colony's prices, or paying the
    // no-cargo penalty on the way out. Room as the hold WILL stand, because the crate above has
    // already taken some of it.
    if (s.toggles.trading) {
      const need = weeklyFoodNeed(s, p);
      const kibble = s.planet.goods[KIBBLE_ID];
      if (plan.cargo[KIBBLE_ID] === 0 && kibble.buy > 0) {
        const units = Math.min(
          HOLD_CAP - cargoTotal(plan.cargo),
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
      const fit = plan.kennel.filter((d) => d.injuryWeeks === 0 && d.fitness >= EASY_REST_BELOW);
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
