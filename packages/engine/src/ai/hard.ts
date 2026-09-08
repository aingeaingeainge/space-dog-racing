import { balance } from '../content/balance';
import { dogSalePrice } from '../economy/dogValue';
import { upgradePrice } from '../economy/market';
import { winProbabilities } from '../race/odds';
import { currentPlanet, dopingCatchRate, maxStakeFraction, player } from '../state';
import { RACE_CLASSES, type Action, type GameState, type Id } from '../types';
import {
  bestAssignment,
  dogMarket,
  emitDeclarations,
  expectedField,
  expectedPurse,
  hash01,
  keepTrainer,
  planetAhead,
  repayLoans,
  startPlan,
  tradeFoodPlan,
  weeksToMajor,
  type Assignment,
  type MarketOptions,
  type Plan,
} from './shared';

/** How often Hard leaves the Bronze to the locals and backs its Silver runner instead. */
const THROW_BRONZE_RATE = 0.15;
/** Fitness a dog should still have the week after a run, if a Major is next weekend. */
const MAJOR_FITNESS_FLOOR = balance.fitnessScaleBelow + 20;

/**
 * Hard AI (GDD §14): Normal, plus — it holds a dog back rather than arrive at a Major tired,
 * spends down to its reserve late on to own the best dog it can (net worth is the score), sells
 * a dog before the age tick takes a chunk out of its value, dopes where the stewards do not
 * look, fills the hold before Blackreach so the black hole drags it in first, and now and then
 * leaves the Bronze alone and puts the money on its Silver runner.
 *
 * Same rules, same information, no stat bonuses — only better decisions. Deterministic:
 * "occasionally" is `hash01`, never an rng.
 */
export function decideHard(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];

  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    keepTrainer(plan);
    repayLoans(plan);
    if (s.phase === 'planetPost') sellAgeingDog(plan);
    if (s.phase === 'planetPre') dogMarket(plan, marketOptions(s));
    // Blackreach reverses the turn order, so arrive heavy and get first look at the market.
    const fillHold =
      s.phase === 'planetPost' && !!planetAhead(s, 1)?.special.turnOrderReversed;
    tradeFoodPlan(plan, { fillHold });
    if (s.phase === 'planetPre') feedSupplements(plan, declareForThisWeek(plan));
  }

  if (s.phase === 'betting' && s.fields) placeBets(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}

/**
 * Net worth counts a dog at book value and cash at face value, so a dog bought under the odds
 * is worth buying for the column alone — and a better dog wins more on the way. From midseason
 * Hard lowers its bar, and by week 10 it will spend down to its reserve (GDD §14).
 */
function marketOptions(s: GameState): MarketOptions {
  if (s.week >= 10)
    return {
      buyCashMultiple: 1,
      minRatingGain: 1,
      minRatingGainForSwap: 4,
      bargainFactor: 1,
      keepReserve: true,
    };
  if (s.week >= 6)
    return {
      buyCashMultiple: 1.4,
      minRatingGain: 2,
      minRatingGainForSwap: 5,
      bargainFactor: 0.95,
      keepReserve: true,
    };
  return {};
}

/**
 * Sell a dog before it declines. Ages tick at the end of week `ageTickWeek` and the value
 * multiplier falls hardest going into the decline years, so the week of the tick is the last
 * chance to sell an ageing dog at the better factor; after that it only pays where the buyers do.
 */
function sellAgeingDog(plan: Plan): void {
  const { s, playerId, out } = plan;
  if (plan.kennel.length < 3) return;
  const planet = currentPlanet(s);
  const buyerBonus = planet.special.buyerBonus ?? 0;
  const valueMod = planet.special.dogValueMod ?? 1;
  const beforeTheTick = s.week === balance.ageTickWeek;
  if (!beforeTheTick && buyerBonus + (valueMod - 1) <= 0) return;

  const best = [...plan.kennel].sort((a, b) => b.rating - a.rating)[0];
  const minAge = beforeTheTick ? balance.declineMinAge - 1 : balance.declineMinAge;
  const sell = plan.kennel
    .filter(
      (d) =>
        d.id !== best?.id &&
        d.injuryWeeks === 0 &&
        !d.traits.includes('oldSoul') &&
        d.age >= minAge,
    )
    .sort((a, b) => b.age - a.age || a.rating - b.rating)[0];
  if (!sell) return;

  out.push({ t: 'SellDog', playerId, dogId: sell.id });
  plan.cash += dogSalePrice(sell, buyerBonus, valueMod);
  plan.kennel = plan.kennel.filter((d) => d.id !== sell.id);
}

/** Choose and declare this week's runners, holding fitness back for a Major if one is next. */
function declareForThisWeek(plan: Plan): Assignment {
  const { s, playerId } = plan;
  const toMajor = weeksToMajor(s);

  // A Major next weekend: raise the bar on what is worth a run, and sit the best dog out of
  // anything that would leave it short of fit when it matters.
  const hold = new Set<Id>();
  if (toMajor === 1) {
    const best = [...plan.kennel].sort((a, b) => b.rating - a.rating)[0];
    if (best) {
      const afterAWeek = best.fitness - balance.fitnessPerRace + balance.fitnessRecovery;
      if (afterAWeek < MAJOR_FITNESS_FLOOR) hold.add(best.id);
    }
  }
  const assignment = bestAssignment(s, plan.p, plan.kennel, {
    minPurseScale: toMajor === 1 ? 2 : 1,
    hold,
  });

  // Now and then, leave the Bronze to the locals: the dog keeps its fitness and the money goes
  // over the counter at the bookie instead (GDD §14, §10).
  if (toMajor !== 0 && throwingTheBronze(s, playerId) && assignment.plan.bronze) {
    const silverId = assignment.plan.silver;
    const silver = silverId ? s.dogs[silverId] : undefined;
    if (silver) {
      const p = winProbabilities([
        silver.rating,
        ...expectedField(s, 'silver', playerId),
      ])[0]!;
      if (p >= 0.35) delete assignment.plan.bronze;
    }
  }

  emitDeclarations(plan, assignment);
  return assignment;
}

/** Same answer in planetPre and at the bookie, without carrying a flag through the state. */
function throwingTheBronze(s: GameState, playerId: Id): boolean {
  return hash01(s.seed, s.week, playerId, 'throwBronze') < THROW_BRONZE_RATE;
}

/**
 * Supplements where the stewards do not look (GDD §14: Vatgrown, catch rate 0). Anywhere else
 * the forfeited purse costs more than the bonus is worth, which is a measured fact rather than
 * a guess — see claude/M4_NOTES.md.
 */
function feedSupplements(plan: Plan, assignment: Assignment): void {
  const { s, p, playerId, out } = plan;
  if (s.toggles.cleanSport) return;
  if (dopingCatchRate(s) > 0) return;
  const price = upgradePrice('supplement', currentPlanet(s), p);
  for (const cls of RACE_CLASSES) {
    const dogId = assignment.plan[cls];
    if (!dogId) continue;
    const d = s.dogs[dogId];
    if (!d || d.supplemented) continue;
    if (plan.cash - price < plan.reserve) break;
    if (expectedPurse(s, d, cls, playerId) < price * 3) continue;
    out.push({ t: 'BuyUpgrade', playerId, upgrade: 'supplement', dogId });
    plan.cash -= price;
  }
}

/**
 * The bookie prices public ratings and nothing else, so it cannot see a supplement in one of
 * our own runners — that is the edge GDD §10 describes. Otherwise Hard bets like Normal, with
 * the extra stake on the Silver in a week it left the Bronze alone.
 */
function placeBets(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!s.fields) return;
  const stakeFraction = maxStakeFraction(s);
  const mine = new Set(p.dogIds);
  const threwTheBronze =
    throwingTheBronze(s, playerId) && !s.declarations.bronze[playerId];

  for (const cls of RACE_CLASSES) {
    const field = s.fields[cls];
    let pick = field.find((e) => mine.has(e.dogId) && s.dogs[e.dogId]?.supplemented);
    let fraction = balance.aiBetFraction * 3;

    if (!pick && threwTheBronze && cls === 'silver') {
      const own = field.find((e) => mine.has(e.dogId));
      if (own && own.winProb >= 0.3) {
        pick = own;
        fraction = balance.aiBetFraction * 3;
      }
    }
    if (!pick) {
      const fav = [...field].sort((a, b) => b.winProb - a.winProb)[0];
      if (!fav || fav.winProb < balance.aiBetMinProb) continue;
      pick = fav;
      fraction = balance.aiBetFraction;
    }

    const cap = Math.floor(plan.cash * stakeFraction);
    const stake = Math.floor(Math.min(plan.cash * fraction, 1200, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, cls, dogId: pick.dogId, kind: 'win', stake });
    plan.cash -= stake;
  }
}
