import { balance } from '../content/balance';
import { dogSalePrice, dogValue } from '../economy/dogValue';
import { upgradePrice } from '../economy/market';
import { decimalOdds, placeProbabilities, winProbabilities } from '../race/odds';
import {
  bettingMargin,
  currentPlanet,
  dopingCatchRate,
  maxStakeFraction,
  player,
} from '../state';
import { RACE_CLASSES, type Action, type GameState, type Id } from '../types';
import {
  bestAssignment,
  dogMarket,
  effectiveRating,
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
    keepVet(plan);
    repayLoans(plan);
    if (s.phase === 'planetPost') sellAgeingDog(plan);
    if (s.phase === 'planetPre') {
      dogMarket(plan, marketOptions(s));
      buyGear(plan);
    }
    // Blackreach reverses the turn order, so arrive heavy and get first look at the market.
    const fillHold = s.phase === 'planetPost' && !!planetAhead(s, 1)?.special.turnOrderReversed;
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
 * A vet pays for herself in fitness before you count the injuries: +10 recovery a week is the
 * difference between a dog that can run every weekend and one that cannot (GDD §5.2, §8).
 * She is only for hire on the planets the GDD gives her, so take her when she is there.
 */
function keepVet(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (p.staff.vet) return;
  const offer = s.planet.staff.find((o) => o.role === 'vet');
  if (!offer) return;
  const weeksLeft = balance.weeks - s.week + 1;
  if (weeksLeft < 4) return; // too late for the wage to earn itself back
  if (plan.cash > plan.reserve + offer.wage * weeksLeft)
    out.push({ t: 'HireStaff', playerId, role: 'vet', staffId: offer.id });
}

// Measured and rejected (M4): buying the kennel module and engine tiers cost Hard more than
// they returned — the 0.7 resale factor takes 30% off the moment you pay, and a fifth dog
// bought at its asking price adds upkeep without adding worth. See claude/M4_NOTES.md.

/**
 * Track-day passes and racing muzzles are permanent stat points on the best dog, and — unlike
 * a race result — they do not move its *rating*, so the dog stays in its class and the bookie
 * keeps pricing the old one. GDD §8's payback rule wants five weeks, so Hard stops buying them
 * once there are fewer than five left.
 */
function buyGear(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  const planet = currentPlanet(s);
  const target = [...plan.kennel].sort((a, b) => b.rating - a.rating)[0];
  if (!target) return;
  if (balance.weeks - s.week < 5) return;
  for (const item of ['trackDay', 'muzzle'] as const) {
    const inStock = item === 'trackDay' ? s.planet.trackDayPasses : s.planet.muzzlesInStock;
    if (!inStock) continue;
    const price = upgradePrice(item, planet, p);
    if (plan.cash - price < plan.reserve * 1.5) continue;
    out.push({ t: 'BuyUpgrade', playerId, upgrade: item, dogId: target.id });
    plan.cash -= price;
  }
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
  // Below this, the injury roll doubles (GDD §5.2) and the stats are already being scaled down.
  // A week off is cheaper than three.
  for (const d of plan.kennel) {
    if (d.fitness < balance.injuryLowFitnessBelow) hold.add(d.id);
  }
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
    ratingOf: effectiveRating,
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
 * Supplements, priced rather than assumed. GDD §14 has Hard doping on Vatgrown, where the
 * stewards do not look; the honest generalisation is that it dopes wherever the sum comes out
 * positive, which at the stewards' usual 15% is a real but occasional call.
 *
 *   gain   (1 − q) × the purse with the bonus, against the purse without it
 *   cost   the price, plus q × (the forfeited purse + the rating the dog loses + the ban)
 *
 * The bonus is valued at speed × the rating weight — what a player reading the stat bars would
 * reckon, and deliberately conservative, because the race sim rewards raw Speed by more than
 * the bookie's rating model implies (measured; see claude/M4_NOTES.md).
 */
function feedSupplements(plan: Plan, assignment: Assignment): void {
  const { s, p, playerId, out } = plan;
  if (s.toggles.cleanSport) return;
  const q = dopingCatchRate(s);
  const price = upgradePrice('supplement', currentPlanet(s), p);
  const bonusRating = balance.itemSupplementBonus * balance.ratingWeightSpeed;
  for (const cls of RACE_CLASSES) {
    const dogId = assignment.plan[cls];
    if (!dogId) continue;
    const d = s.dogs[dogId];
    if (!d || d.supplemented) continue;
    if (plan.cash - price < plan.reserve) break;
    const rating = effectiveRating(d);
    const ev0 = expectedPurse(s, d, cls, playerId, rating);
    const ev1 = expectedPurse(s, d, cls, playerId, rating + bonusRating);
    const valueLoss =
      dogValue(d) -
      dogValue({
        rating: Math.max(5, d.rating - balance.supplementRatingPenalty),
        age: d.age,
        injuryWeeks: d.injuryWeeks,
      });
    const banLoss = balance.supplementBanWeeks * ev0;
    if ((1 - q) * ev1 - q * (valueLoss + banLoss) - price - ev0 <= 0) continue;
    out.push({ t: 'BuyUpgrade', playerId, upgrade: 'supplement', dogId });
    plan.cash -= price;
  }
}

/**
 * The bookie prices public ratings and nothing else. It cannot see a supplement, and it cannot
 * see that a dog's stats have outgrown its rating after a month with a trainer and a track-day
 * pass — which is exactly the "you know things the bookie doesn't" of GDD §10. So Hard prices
 * its own runners itself and backs them only where its own number beats the odds on offer.
 * Anything else, it bets like Normal.
 */
const EDGE_REQUIRED = 1.15;

function placeBets(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!s.fields) return;
  const stakeFraction = maxStakeFraction(s);
  const mine = new Set(p.dogIds);
  const threwTheBronze = throwingTheBronze(s, playerId) && !s.declarations.bronze[playerId];
  const margin = bettingMargin(s);

  for (const cls of RACE_CLASSES) {
    const field = s.fields[cls];
    let pick: { dogId: Id; kind: 'win' | 'place' } | null = null;
    let fraction = balance.aiBetFraction;

    // Our own runners, priced on what we know rather than on the number the bookie reads.
    // Both markets get checked: on the same edge a place bet pays less and lands far more
    // often, and a stable trying to be top of the table at week 13 would rather grind.
    let bestEdge = EDGE_REQUIRED;
    for (let i = 0; i < field.length; i++) {
      const e = field[i]!;
      if (!mine.has(e.dogId)) continue;
      const d = s.dogs[e.dogId];
      if (!d) continue;
      const ours = effectiveRating(d) + d.raceBonus * balance.ratingWeightSpeed;
      const ratings = field.map((x, j) => (j === i ? ours : x.rating));
      const winEdge = winProbabilities(ratings)[i]! * e.odds;
      const placeEdge = placeProbabilities(ratings)[i]! * decimalOdds(e.placeProb, margin);
      const kind: 'win' | 'place' = placeEdge >= winEdge ? 'place' : 'win';
      const edge = winEdge > placeEdge ? winEdge : placeEdge;
      if (edge > bestEdge) {
        bestEdge = edge;
        pick = { dogId: e.dogId, kind };
        fraction = balance.aiBetFraction * (kind === 'place' ? 6 : 4);
      }
    }

    // A week it left the Bronze alone: the money it did not risk on the track goes on the
    // Silver runner instead (GDD §14).
    if (!pick && threwTheBronze && cls === 'silver') {
      const own = field.find((e) => mine.has(e.dogId));
      if (own && own.winProb >= 0.3) {
        pick = { dogId: own.dogId, kind: 'win' };
        fraction = balance.aiBetFraction * 2;
      }
    }
    if (!pick) {
      const fav = [...field].sort((a, b) => b.winProb - a.winProb)[0];
      if (!fav || fav.winProb < balance.aiBetMinProb) continue;
      pick = { dogId: fav.dogId, kind: 'win' };
      fraction = balance.aiBetFraction;
    }

    const cap = Math.floor(plan.cash * stakeFraction);
    const stake = Math.floor(Math.min(plan.cash * fraction, 2000, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, cls, dogId: pick.dogId, kind: pick.kind, stake });
    plan.cash -= stake;
  }
}
