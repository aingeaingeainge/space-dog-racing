import { balance } from '../content/balance';
import { dogValue } from '../economy/dogValue';
import { eligible, player } from '../state';
import { RACE_CLASSES, type Action, type GameState, type Id } from '../types';
import { hash01, ownDogs, startPlan, weeklyFoodNeed } from './shared';

/** About one race in five is left to the locals — enough that Easy fields look careless. */
const SKIP_RATE = 0.2;

/**
 * Easy AI (GDD §14): near-random declarations respecting the caps, never bets, buys food only
 * when the hold will not cover the week, never hires staff, sells a dog only when broke.
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
      const isDeclared = RACE_CLASSES.some((c) => s.declarations[c][playerId] === cheapest.id);
      if (!(isDeclared && s.phase === 'planetPre')) {
        out.push({ t: 'SellDog', playerId, dogId: cheapest.id });
        plan.cash += Math.round(dogValue(cheapest) * balance.marketSellFactor);
        plan.kennel = plan.kennel.filter((d) => d.id !== cheapest.id);
      }
    }

    // Food: never a trade, only this week's dinner, and only once the hold is short.
    if (s.toggles.trading) {
      const need = weeklyFoodNeed(s, p);
      if (plan.cargo < need && s.planet.foodBuy > 0) {
        const units = Math.min(
          p.ship.cargoCap - plan.cargo,
          need - plan.cargo,
          Math.floor(Math.max(0, plan.cash) / s.planet.foodBuy),
        );
        if (units > 0) {
          out.push({ t: 'TradeFood', playerId, units });
          plan.cash -= units * s.planet.foodBuy;
          plan.cargo += units;
        }
      }
    }

    if (s.phase === 'planetPre') {
      // Shuffle the fit dogs by a per-week hash, then walk the three races taking whoever is
      // next in that order and eligible. No expected purse anywhere: that is Normal's job.
      const fit = ownDogs(s, p).filter((d) => d.injuryWeeks === 0 && d.banWeeks === 0);
      const shuffled = [...fit].sort(
        (a, b) =>
          hash01(s.seed, s.week, playerId, a.id) - hash01(s.seed, s.week, playerId, b.id),
      );
      const used = new Set<Id>();
      for (const cls of RACE_CLASSES) {
        let chosen: Id | null = null;
        if (hash01(s.seed, s.week, playerId, cls, 'skip') > SKIP_RATE) {
          const pick = shuffled.find((d) => !used.has(d.id) && eligible(d, cls));
          if (pick) {
            chosen = pick.id;
            used.add(pick.id);
          }
        }
        if ((s.declarations[cls][playerId] ?? null) !== chosen)
          out.push({ t: 'Declare', playerId, cls, dogId: chosen });
      }
    }
  }

  // Easy never visits the bookie.
  out.push({ t: 'EndPhase', playerId });
  return out;
}
