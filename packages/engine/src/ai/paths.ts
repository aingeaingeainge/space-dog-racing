import { balance } from '../content/balance';
import { currentPlanet, player } from '../state';
import { outstanding } from '../economy/loans';
import type { Action, GameState, Id } from '../types';
import {
  buyFeedPlan,
  declareBest,
  dogMarket,
  keepStaff,
  racingDogs,
  repayLoans,
  setStates,
  stateHold,
  startPlan,
  tradeFoodPlan,
  type StateOptions,
} from './shared';

/**
 * The path agents (BUILD_PLAN §7a.5) — measurement agents, never offered to a player.
 *
 * `easy` / `normal` / `hard` measure **difficulty**. These measure **strategy**, and they are what
 * GDD §20 Q2 needs: are the three roads actually worth roughly the same? A player picking "Trader"
 * as an opponent would be picking one that is deliberately bad at two thirds of the game, so
 * `Title.tsx` and `lib/seedLink.ts` enumerate the three difficulties by hand and nothing here can
 * leak into a season setup.
 *
 * ⚠️ **The caveat that has to travel with every number they produce.** Three hand-written agents
 * measure whether three roads *can* pay, not whether they are balanced against a good player. Jesse
 * beat three Hard and three Normal stables with a line no agent plays. They are a floor test, not a
 * proof, and the harness prints that sentence next to the table.
 *
 * The crook is Phase D's: §13's sabotage and steward bribes do not exist as actions, so an agent
 * built to work them would be measuring nothing.
 */

/** Races what it has, but the season is about raising dogs rather than about this weekend's purse. */
const TRAINER_STATES: StateOptions = { raceAbove: 70, restBelow: 40, train: true };

/**
 * Road 1: the trainer (BUILD_PLAN §7a.5).
 *
 * Buys pups, trains them, keeps a trainer and a vet, does not trade beyond eating, never bets. Two
 * things make it a *strategy* rather than a worse Normal: it races only above 70 fitness, so its
 * good dogs are always fresh and always improving, and it spends deep on feed — the whole point of
 * §8.2 is that a Train week with Prime feed is worth four of one without.
 */
export function decideTrainer(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];
  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // A trainer first, a vet second: the vet is what keeps a dog that is always training sound.
    keepStaff(plan, { want: ['trainer', 'vet'], cover: balance.weeks - s.week + 1 });
    repayLoans(plan);
    if (s.phase === 'planetPre') {
      // Pups: cheap, useless this week, and the only thing a season of training can compound on.
      dogMarket(plan, { buyCashMultiple: 1.5, minRatingGain: -8, keepReserve: true });
      const assignment = declareBest(plan, { reserve: stateHold(plan, TRAINER_STATES) });
      setStates(plan, racingDogs(assignment), TRAINER_STATES);
      buyFeedPlan(plan, { crates: 4, spend: 0.85 });
    }
    // Eating only — "does not trade beyond eating" is the spec, so no `workGoods`.
    tradeFoodPlan(plan);
  }

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}

/**
 * Harness-only knob (BUILD_PLAN §6b's cargo-payback row, GDD §20 Q6).
 *
 * The acceptance row asks whether a +20-unit hold pays back inside one season, and the only honest
 * way to answer that is an **ablation**: the same agent, the same seeds, with a different number of
 * upgrades allowed. A cap rather than a boolean, because the first measurement showed the agent
 * buying **4.4 upgrades a season** — so an on/off comparison averages a useful first upgrade with
 * three useless later ones and answers a question nobody asked. Sweeping the cap gives the marginal
 * value of each, which is what "does a +20 hold pay back" means.
 *
 * Nothing a player can reach touches this, it is uncapped in every normal run, and the agent stays
 * deterministic within a run.
 */
export const PATH_KNOBS = {
  /** How many cargo upgrades the trader may buy in a season. `Infinity` in every normal run. */
  traderHoldCap: Infinity,
};

/** Three cheap dogs, raced when the purse is free money; everything else is the hold. */
const TRADER_STATES: StateOptions = { raceAbove: 60, restBelow: 45, train: false };

/**
 * Road 2: the trader (BUILD_PLAN §7a.5).
 *
 * Keeps three cheap dogs, buys hold and information, works the spread, races only when the purse is
 * free money. The staff it wants is the other half of its road — a **Trader** for the hold, the
 * consignments and the discount, and a **Tipster** for the week it cannot otherwise see — and it is
 * the only agent that buys a cargo upgrade, which is what makes GDD §20 Q6's payback row a
 * measurement rather than an estimate.
 */
export function decideTrader(s: GameState, playerId: Id): Action[] {
  const p = player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];
  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    keepStaff(plan, { want: ['trader', 'tipster'], cover: 5 });
    repayLoans(plan);
    // Credit, because a trader who will not borrow is not a floor test of the road — it is a floor
    // test of the road played with one hand. GDD §7.4's bank lends 5,000 at 3% a week, which is
    // about 150 a week against a leg that returns 400 a crate on a dozen crates. Only the bank, only
    // while there is season left to trade it, and `repayLoans` above clears it when the cash is in.
    const leg = balance.weeks - s.week;
    if (leg >= 3) {
      const room = balance.bankMax - outstanding(p, 'bank');
      if (room >= 1000 && plan.cash < plan.reserve * 3 && currentPlanet(s).special.bank) {
        plan.out.push({ t: 'Borrow', playerId, lender: 'bank', amount: room });
        plan.cash += room;
      }
    }
    // Hold, while there is enough season left for it to earn back (GDD §9.2, §20 Q6).
    //
    // ⚠️ A tighter rule was tried and is worse: requiring the current hold to be 80% full before
    // buying more took mean carried crates from 21.5 down to 14.8 and trade income from 6,275 to
    // 4,939, because the road is **lumpy** — a good leg wants all the room at once and a bad one
    // wants none, so a hold sized to last week's fill is a hold that is too small on the week that
    // matters. Capacity bought early is capacity available when the spread finally appears.
    const holdPrice = Math.round(balance.shipCargoCost);
    const weeksLeft = balance.weeks - s.week;
    const boughtSoFar = (p.ship.cargoCap - balance.cargoCapStart) / balance.cargoUpgradeUnits;
    if (
      boughtSoFar < PATH_KNOBS.traderHoldCap &&
      weeksLeft >= 5 &&
      plan.cash > holdPrice + plan.reserve * 2
    ) {
      plan.out.push({ t: 'BuyUpgrade', playerId, upgrade: 'cargo' });
      plan.cash -= holdPrice;
    }
    if (s.phase === 'planetPre') {
      // Three bodies, cheap, and no upgrading: the dogs are here to collect free purses.
      dogMarket(plan, { buyCashMultiple: 4, minRatingGain: 6, keepReserve: true });
      const assignment = declareBest(plan, { reserve: stateHold(plan, TRADER_STATES) });
      setStates(plan, racingDogs(assignment), TRADER_STATES);
    }
    tradeFoodPlan(plan, { workGoods: true, goodsSpend: 0.9 });
  }

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}
