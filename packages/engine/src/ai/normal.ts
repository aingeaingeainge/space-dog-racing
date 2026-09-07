import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { dogValue } from '../economy/dogValue';
import { player } from '../state';
import {
  RACE_CLASSES,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type StatKey,
} from '../types';
import { bestAssignment, ownDogs, reserveCash, weeklyFoodNeed } from './shared';

/**
 * Normal AI (GDD §14): declares to maximise expected purse, keeps a trainer, trades food when
 * the spread beats aiFoodSpreadMin, bets small on favourites, buys a dog when cash is plentiful
 * and the dog beats its worst. Deterministic: no randomness, so replays never diverge.
 */
export function decideNormal(s: GameState, playerId: Id): Action[] {
  const p = player(s, playerId);
  const out: Action[] = [];
  if (s.pendingEvent?.playerId === playerId) {
    out.push({ t: 'ResolveEvent', playerId, choice: 0 });
    return out;
  }
  if (s.activePlayer !== playerId) return out;

  // Track cash as we plan so we never issue an action the reducer will reject.
  let cash = p.cash;
  let cargo = p.cargo;
  const reserve = reserveCash(s, p);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // --- Staff: keep a trainer on the best dog's speed. ---
    if (!p.staff.trainer) {
      const offer = s.planet.staff.find((o) => o.role === 'trainer');
      if (offer && cash > reserve + offer.wage * 3)
        out.push({ t: 'HireStaff', playerId, role: 'trainer', staffId: offer.id });
    }
    const dogs = ownDogs(s, p);
    const kennel = [...dogs]; // what we will own after this phase's buys and sells
    const best = [...dogs].sort((a, b) => b.rating - a.rating)[0];
    if ((p.staff.trainer || out.some((a) => a.t === 'HireStaff')) && best) {
      const stat = weakestWeightedStat(best);
      if (!p.training || p.training.dogId !== best.id || p.training.stat !== stat) {
        out.push({ t: 'SetTraining', playerId, dogId: best.id, stat });
      }
    }

    // --- Repay Fat Tony first, then the bank, when flush. ---
    const loans = [...p.loans].sort((a) => (a.lender === 'shark' ? -1 : 1));
    for (const loan of loans) {
      const spare = cash - reserve;
      const amount = Math.min(loan.principal, Math.floor(spare));
      if (amount >= 100) {
        out.push({ t: 'Repay', playerId, lender: loan.lender, amount });
        cash -= amount;
      }
    }

    // --- Dog market (pre-race only, so the new dog can run). ---
    if (s.phase === 'planetPre') {
      const worst = [...dogs].sort((a, b) => a.rating - b.rating)[0];
      const forSale = s.planet.marketDogIds
        .map((id) => s.dogs[id])
        .filter((d): d is Dog => !!d && !d.fellOffAShip)
        .sort((a, b) => b.rating - a.rating);
      const slotsFree = p.dogIds.length < p.kennelSlots;
      for (const d of forSale) {
        const price = d.askingPrice ?? dogValue(d);
        if (cash < price * balance.aiBuyCashMultiple) continue;
        if (worst && d.rating <= worst.rating + 3) continue;
        if (!slotsFree) {
          if (!worst || dogs.length <= 1 || d.rating < worst.rating + 8) continue;
          out.push({ t: 'SellDog', playerId, dogId: worst.id });
          cash += Math.round(dogValue(worst) * balance.marketSellFactor);
          kennel.splice(kennel.indexOf(worst), 1);
        }
        out.push({ t: 'BuyDog', playerId, dogId: d.id });
        cash -= price;
        kennel.push(d);
        break;
      }
    }

    // --- Food: eat first, then trade on the spread to the next planet. ---
    if (s.toggles.trading) {
      const need = weeklyFoodNeed(s, p);
      const next = s.calendar[s.week];
      const nextBand = next ? planetOf(next.planetId).foodBand : null;
      const nextMid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : s.planet.foodBuy;
      const buyHere = s.planet.foodBuy;
      const sellHere = s.planet.foodSell;
      let units = 0;
      if (sellHere - nextMid > balance.aiFoodSpreadMin && cargo > need) {
        units = -(cargo - need); // sell the surplus here, keep this week's dinner
      } else if (nextMid * (1 - balance.foodSpread) - buyHere > balance.aiFoodSpreadMin) {
        const spend = Math.max(0, cash - reserve);
        const room = p.ship.cargoCap - cargo;
        units = Math.min(room, Math.floor(spend / buyHere));
      }
      if (units === 0 && cargo < need) {
        // No trade on, but never arrive hungry: buy this week's food if we can.
        units = Math.min(
          p.ship.cargoCap - cargo,
          need - cargo,
          Math.floor(Math.max(0, cash - 500) / buyHere),
        );
      }
      if (units !== 0) {
        out.push({ t: 'TradeFood', playerId, units });
        cash -= units * (units > 0 ? buyHere : sellHere);
        cargo += units;
      }
    }

    // --- Declarations. ---
    if (s.phase === 'planetPre') {
      const { plan } = bestAssignment(s, p, kennel);
      for (const cls of RACE_CLASSES) {
        const dogId = plan[cls] ?? null;
        if ((s.declarations[cls][playerId] ?? null) !== dogId)
          out.push({ t: 'Declare', playerId, cls, dogId });
      }
    }
  }

  if (s.phase === 'betting' && s.fields) {
    for (const cls of RACE_CLASSES) {
      const fav = [...s.fields[cls]].sort((a, b) => b.winProb - a.winProb)[0];
      if (!fav || fav.winProb < balance.aiBetMinProb) continue;
      const stake = Math.floor(Math.min(cash * balance.aiBetFraction, 500));
      if (stake < 50) continue;
      out.push({ t: 'PlaceBet', playerId, cls, dogId: fav.dogId, kind: 'win', stake });
      cash -= stake;
    }
  }

  out.push({ t: 'EndPhase', playerId });
  return out;
}

function weakestWeightedStat(d: Dog): StatKey {
  const weighted: [number, StatKey][] = [
    [d.speed / balance.ratingWeightSpeed, 'speed'],
    [d.accel / balance.ratingWeightAccel, 'accel'],
    [d.stamina / balance.ratingWeightStamina, 'stamina'],
    [d.trap / balance.ratingWeightTrap, 'trap'],
  ];
  weighted.sort((a, b) => a[0] - b[0]);
  return weighted[0]![1];
}
