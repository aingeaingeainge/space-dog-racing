import { balance } from '../content/balance';
import { decimalOdds, placeProbabilities, winProbabilities } from '../race/odds';
import { bettingMargin, maxStakeFor, player, thisWeeksCard } from '../state';
import type { Action, GameState, Id, RaceTypeId } from '../types';
import {
  bestAssignment,
  effectiveRating,
  emitDeclarations,
  expectedField,
  hash01,
  buyFeedPlan,
  planetAhead,
  racingDogs,
  setStates,
  startPlan,
  stateHold,
  tradeFoodPlan,
  weeksToMajor,
  type Assignment,
  type Plan,
  type StateOptions,
} from './shared';

/**
 * How often Hard leaves the *first* race on the card to the locals and backs its runner in the
 * second instead (GDD §14, §10). It used to be phrased as "leaves the Bronze alone", which was
 * the same thing while the card was a fixed ladder; positionally it is "skip one of the cheap
 * races and put the money over the counter", which is what it always meant.
 */
const THROW_CHEAP_RATE = 0.15;
/** Fitness a dog should still have the week after a run, if a Major is next weekend. */
const MAJOR_FITNESS_FLOOR = balance.fitnessScaleBelow + 20;

/**
 * Hard's Race/Train/Rest policy (GDD §14). Normal's fitness rule with one addition:
 * `trainThroughCheapWeeks` prices a week in the yard against the purse the dog is passing up,
 * so a young or outclassed dog spends a quiet weekend training and turns up for the Major. It
 * is the first behaviour in the game that reasons about *later*, so it is a flag rather than a
 * number and the notes carry its ablation.
 *
 * It also races a little deeper into the fitness range than Normal: with the vet it keeps and
 * the §5.2 curve softened, a dog at 60 is a dog you might choose to run.
 */
const HARD_STATES: StateOptions = {
  raceAbove: 58,
  restBelow: 45,
  train: true,
  trainThroughCheapWeeks: true,
};

/**
 * Hard AI (GDD §14): Normal, plus — it spends a cheap weekend training a dog that would earn
 * little by running, holds a dog back rather than arrive at a Major tired,
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
    // ⚠️ **Hard lost five of its decisions here (BUILD_PLAN_V3 §2.1)**: hiring, loan repayment,
    // selling an ageing dog, the dog market and the gear. What is left is the market, the feed, the
    // declarations and the book — which is most of why Phase A's `Hard beats Normal` row must be
    // treated as unmeasured rather than inherited.
    //
    // Blackreach reverses the turn order, so arrive heavy and get first look at the market.
    const fillHold = s.phase === 'planetPost' && !!planetAhead(s, 1)?.special.turnOrderReversed;
    // Feed before kibble: a crate of Prime speed feed is worth more than a crate of dinner, and
    // the hold is the thing they compete for (GDD §8.2's "hold or feed").
    // Feeds deeper than Normal: three crates a stat and 70% of the spare cash, against Normal's
    // two and a half. Ablated at Normal's settings and at none at all: head-to-head reads 58.7%
    // either way, so this is free rather than good — kept on the same footing as D27's coverage
    // buying, because it is how a good racer uses the new market and the ablation is recorded.
    if (s.phase === 'planetPre') buyFeedPlan(plan, { crates: 3, spend: 0.7 });
    tradeFoodPlan(plan, { fillHold });
    // ⚠️ **Declarations last, after the feed and the trade, and that is v2's order rather than an
    // accident.** It used to be `feedSupplements(plan, declareForThisWeek(plan))` — the supplement
    // decision needed to know who was running, so the declaration was made as its argument. The
    // supplement is deleted (BUILD_PLAN_V3 §2.1) and the declaration is not, so the call stands on
    // its own here. Moving it earlier would change what Hard buys, which is a tuning change dressed
    // as a tidy-up.
    if (s.phase === 'planetPre') declareForThisWeek(plan);
  }

  if (s.phase === 'betting' && s.fields) placeBets(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}

/** Choose and declare this week's runners, holding fitness back for a Major if one is next. */
function declareForThisWeek(plan: Plan): Assignment {
  const { s, playerId } = plan;
  const toMajor = weeksToMajor(s);

  // The state policy decides what is offered to the card at all: anything too tired to run, and
  // anything whose week is worth more in the yard than on the track (GDD §5.7).
  const reserve = stateHold(plan, HARD_STATES);
  const hold = new Set<Id>();
  // A Major next weekend: sit the best dog out of anything that would leave it short of fit
  // when it matters. Under §5.7 that is a live worry rather than the formality it was in v1 —
  // a race costs 25 and a rest returns 30, so one hard weekend really does cost the next.
  if (toMajor === 1 && HARD_KNOBS.holdsForMajor) {
    const best = [...plan.kennel].sort((a, b) => b.rating - a.rating)[0];
    if (best) {
      const afterAWeek = best.fitness - balance.fitnessPerRace + balance.fitnessRest;
      if (afterAWeek < MAJOR_FITNESS_FLOOR) hold.add(best.id);
    }
  }
  // Note the bar on "is this race worth running?" is NOT raised in the week before a Major.
  // Measured in M4: doing that cost Hard two and a half points of head-to-head, because a
  // skipped Bronze is real money. Holding the one dog that would arrive tired is enough.
  const assignment = bestAssignment(s, plan.p, plan.kennel, {
    minPurseScale: 1,
    hold,
    reserve,
    // ⚠️ One ruler or the other, never one each (E-D47). `sameRuler` measures both dogs and the
    // field by their stats; `false` measures both by the public rating, which is Normal's answer.
    ratingOf: HARD_KNOBS.ratesByStats ? effectiveRating : undefined,
    rivalRatingOf: HARD_KNOBS.ratesByStats && HARD_KNOBS.sameRuler ? effectiveRating : undefined,
  });

  // Now and then, leave the first race on the card to the locals: the dog keeps its fitness and
  // the money goes over the counter at the bookie instead (GDD §14, §10).
  const [cheap, second] = cheapAndSecond();
  if (
    toMajor !== 0 &&
    cheap &&
    second &&
    throwingTheCheapRace(s, playerId) &&
    assignment.plan[cheap]
  ) {
    const backedId = assignment.plan[second];
    const backed = backedId ? s.dogs[backedId] : undefined;
    if (backed) {
      const p = winProbabilities([backed.rating, ...expectedField(s, second, playerId)])[0]!;
      if (p >= 0.35) delete assignment.plan[cheap];
    }
  }

  emitDeclarations(plan, assignment);
  setStates(plan, racingDogs(assignment));
  return assignment;
}

/**
 * The race Hard is willing to skip, and the one it backs instead. The card is ordered with the
 * headline race last (GDD §6.3), so the first two are the cheap pair and skipping the first to
 * back the second is the same trade the Bronze/Silver version made.
 *
 * Takes nothing: with the drawn card gone (§2.1) every weekend runs the same three races, so the
 * cheap pair is a property of `CARD` rather than of this week's state.
 */
function cheapAndSecond(): [RaceTypeId | undefined, RaceTypeId | undefined] {
  const card = thisWeeksCard();
  return [card[0], card[1]];
}

/** Same answer in planetPre and at the bookie, without carrying a flag through the state. */
function throwingTheCheapRace(s: GameState, playerId: Id): boolean {
  // The salt stays 'throwBronze': it is a fixed string that decides *which weeks* Hard skips a
  // race, not a class name, and changing it would re-roll that for no reason.
  if (!HARD_KNOBS.throwsCheapRace) return false;
  return hash01(s.seed, s.week, playerId, 'throwBronze') < THROW_CHEAP_RATE;
}

/**
 * The bookie prices public ratings and nothing else. It cannot see a supplement, and it cannot
 * see that a dog's stats have outgrown its rating after a month with a trainer and a track-day
 * pass — which is exactly the "you know things the bookie doesn't" of GDD §10. So Hard prices
 * its own runners itself and backs them only where its own number beats the odds on offer.
 * Anything else, it bets like Normal.
 */
const EDGE_REQUIRED = 1.15;

/**
 * How hard Hard backs an edge it has actually measured (GDD §14, §10).
 *
 * ⚠️ **The one thing §14 asks for that Hard has never done.** It has priced its own runners by
 * `effectiveRating` since M4 — the §5.3 edge, which any player can read off the stat bars — and
 * then staked **the same fixed fraction of cash whether the edge was 16% or 90%**. Knowing
 * something and not sizing the bet by it is most of the way to not knowing it.
 *
 * A quarter-Kelly on the edge it has just computed: for decimal odds `o` and a true probability
 * `p`, the full-Kelly fraction is `(p·o − 1) / (o − 1)`, and `bestEdge` is already `p·o`. Quarter
 * rather than full because Kelly is optimal for a bankroll that is only ever bet and this one also
 * has to pay wages — and because the edge is Hard's own estimate, so a quarter is the discount for
 * being wrong about it. Clamped so that a huge price on a long shot cannot turn into a plunge.
 *
 * `HARD_KNOBS.sizeBetsByEdge` ablates it; the numbers are in the phase notes.
 */
const KELLY_SHARE = 0.25;
const KELLY_MAX_FRACTION = 0.2;

/**
 * Harness-only ablation switches for the two Phase D changes tried on Hard (BUILD_PLAN §7a).
 *
 * ⚠️ **Both are off, and both are off because they were measured rather than because nobody got to
 * them.** §14 has asked for the first since M4 and the Phase D brief names the second; the numbers
 * are in `claude/V2_PHASE_D_NOTES.md` and repeated here so the next session does not re-try them:
 *
 *   Hard's betting, 300 seasons          beats Normal   mean     p10     bet income
 *   flat fraction of cash (kept)            58.3%      41,109   9,390        +867
 *   quarter-Kelly on the measured edge       56.7%      37,915  11,061        −178
 *
 *   Hard's third slot, 200 seasons        beats Normal   mean     p10    fixes
 *   trainer + vet (kept)                     58.8%      41,663   8,919    0.0
 *   trainer + vet + fixer, working him       49.3%      33,973   7,460    0.8
 *
 * The second of those is D30's question re-asked with §13 in the game — is a Fixer the first third
 * hire a racing stable can profitably make? — and the answer is a flat no, by **9.5 points**. It is
 * the same arithmetic that stopped the crook's own road paying, seen from the other side: a fixer's
 * value is per job and his wage is per week, and a stable that already earns well from purses has
 * the most to lose by spending a slot on a man it uses twice.
 *
 * The Kelly result is the more interesting of the two and the reason is worth keeping: Kelly
 * stakes *more* as the price shortens, so it moves money off the long shots — which is where
 * `effectiveRating` finds its edge, because a fed dog that has not had the results yet is exactly
 * a dog the book has long — and onto short ones, where Hard's own estimate is least likely to beat
 * the book's. Sizing a bet by an edge you have measured is right; sizing it by an edge you have
 * *estimated* is only right where the estimate is good, and Hard's is good in one corner of the
 * board.
 */
export const HARD_KNOBS = {
  /** Stake in proportion to the measured edge rather than a flat fraction of cash. */
  sizeBetsByEdge: false,
  /**
   * ⚠️ **Phase E's four, and the answer they gave: none of them is a bad decision.**
   *
   * The record said the only thing that has ever moved Hard is removing a bad decision, so these
   * switch off decisions Hard makes and Normal does not, one at a time, at the standing table
   * (easy, normal ×3, hard ×2), 800 seasons, same seeds:
   *
   *   as built (one ruler each)        58.0%   mean 40,997   p10  9,783
   *     rates its dogs like Normal     57.8%        40,509        9,511
   *     one ruler: stats on both sides 57.8%        40,920        9,649
   *     does not hold for a Major      55.9%        40,362        9,873
   *     never throws the cheap race    57.9%        41,493        9,572
   *     does not sell before the tick  56.1%        40,271        9,261
   *     works §13 per job              53.6%        37,670       10,461
   *
   * Two of them are load-bearing — holding the best dog out the week before a Major is worth 2.1
   * points and selling before the age tick 1.9 — and the rest are inside the standard error. So
   * the phase's contribution to the most-missed number in the project is a **negative result**:
   * there is no bad decision left in Hard to take away, and whatever is keeping it off 63–68% is
   * not on this list (E-D49).
   */
  /** Rate our own dogs by their stats rather than their public rating when filling the card. */
  ratesByStats: true,
  /**
   * Rate the *rivals'* declared dogs by the same ruler.
   *
   * Off, Hard compares a generous estimate of itself against a plain one of the field — which is
   * what it did from M4 to Phase D, because `expectedField` never took a ruler. Every race it
   * priced therefore over-estimated its own chance, which is arithmetic with two rulers rather
   * than an edge over the bookie.
   *
   * ⚠️ **On, it is worth nothing measurable, and it is kept anyway.** Three Hard against three
   * Normal it reads +2.5 points; at the standing table it reads −0.2, which is noise, with the
   * mean and p10 also inside the error. Those two tables disagreeing is itself the finding
   * (E-D49): a head-to-head is a property of the table it is played at, and an ablation run at a
   * different one answers a different question from BUILD_PLAN's acceptance row. The repair stays
   * because comparing two different rulers is a defect whether or not fixing it moves a
   * head-to-head — but nobody should record it as a gain.
   */
  sameRuler: true,
  /** Sit the best dog out the week before a Major rather than arrive at it tired. */
  holdsForMajor: true,
  /** Now and then leave the cheap race to the locals and put the money over the counter. */
  throwsCheapRace: true,
};

function placeBets(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!s.fields) return;
  const mine = new Set(p.dogIds);
  const [cheap, second] = cheapAndSecond();
  const threwTheCheapRace =
    !!cheap && throwingTheCheapRace(s, playerId) && !s.declarations[cheap][playerId];
  const margin = bettingMargin(s);

  for (const { race, entries: field } of s.fields) {
    let pick: { dogId: Id; kind: 'win' | 'place' } | null = null;
    let fraction = balance.aiBetFraction;
    /** The price we took the edge at, so the stake can be sized against it. */
    let pickOdds = 0;

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
        pickOdds = kind === 'place' ? decimalOdds(e.placeProb, margin) : e.odds;
        fraction = balance.aiBetFraction * (kind === 'place' ? 6 : 4);
        if (HARD_KNOBS.sizeBetsByEdge && pickOdds > 1.01) {
          // Quarter-Kelly on the edge just measured. `bestEdge` is p×odds, so the full-Kelly
          // fraction is (bestEdge − 1) / (odds − 1).
          const kelly = (bestEdge - 1) / (pickOdds - 1);
          fraction = Math.max(0, Math.min(KELLY_MAX_FRACTION, kelly * KELLY_SHARE));
        }
      }
    }

    // A week it left the cheap race alone: the money it did not risk on the track goes on the
    // runner in the next one instead (GDD §14).
    if (!pick && threwTheCheapRace && race === second) {
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

    // The flat ceiling as well as the fractional one, now that §20 Q7 has put one in.
    const cap = maxStakeFor(s, { ...p, cash: plan.cash });
    const stake = Math.floor(Math.min(plan.cash * fraction, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, race, dogId: pick.dogId, kind: pick.kind, stake });
    plan.cash -= stake;
  }
}
