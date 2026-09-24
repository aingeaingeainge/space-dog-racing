import { exploreStep } from './explore';
import { balance } from '../content/balance';
import { decimalOdds, placeProbabilities, styleEdge, winProbabilities } from '../race/odds';
import { publicStyle } from '../content/styles';
import { bettingMargin, currentPlanet, maxStakeFor, player, thisWeeksCard } from '../state';
import type { Action, Dog, GameState, Id, RaceEntry, RaceTypeId } from '../types';
import {
  bestAssignment,
  effectiveRating,
  emitDeclarations,
  expectedField,
  fieldRead,
  hash01,
  otherFrontRunners,
  buyFeedPlan,
  planetAhead,
  racingDogs,
  setStates,
  spendBox,
  startPlan,
  stateHold,
  tippedAgainst,
  tippedToBack,
  tippedToRest,
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
 * Hard's Race-or-Rest policy (GDD_V3 §4.2): one number, and it is the *only* thing left separating
 * Hard's week from Normal's. It races a little deeper into the fitness range — a dog at 58 is a dog
 * you might choose to run, where Normal wants 65.
 *
 * ⚠️ **`trainThroughCheapWeeks` is deleted (see `ai/shared.ts` for the measurement).** Pricing a week
 * in the yard against the purse it passes up needs the yard to be worth something, and with food
 * reaching every dog every week (§6.3) it is not. It was the first behaviour in the game that
 * reasoned about *later*; what is left that does is `holdsForMajor`, which reasons about fitness
 * rather than about rating and survives untouched.
 */
const HARD_STATES: StateOptions = { raceAbove: 58 };

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
  // Explore (GDD_V3 §9.1): open a door, answer the card.
  const explore = exploreStep(s, playerId);
  if (explore) return explore;
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
    // Dinner first, as Normal: a trading leg sitting below the staple is never what the dogs eat.
    // ⚠️ v2's "feeds deeper than Normal" (three crates a stat, 70% of spare cash) is gone with the
    // stat feeds it bought; it was measured free rather than good (58.7% either way) and there is
    // nothing yet to buy deeper *of* until the diet lands.
    if (s.phase === 'planetPre') buyFeedPlan(plan);
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
  // A tip on our own dog is a Race-or-Rest decision, as it is for Normal (Phase D1 item 6).
  const hold = tippedToRest(s, playerId);
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
    // Phase D2 item 4: read the board (§7.3). What is declared so far is public, in turn order.
    adjust: HARD_KNOBS.readsFieldEntries ? (d, race) => boardRead(s, playerId, d, race) : undefined,
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
      const own = backed.rating + styleEdge(publicStyle(backed), currentPlanet(s).track);
      const p = winProbabilities([own, ...expectedField(s, second, playerId)])[0]!;
      if (p >= 0.35) delete assignment.plan[cheap];
    }
  }

  emitDeclarations(plan, assignment);
  setStates(plan, racingDogs(assignment), { diets: true });
  spendBox(plan, assignment.plan);
  return assignment;
}

/**
 * Hard reads the declarations board (GDD_V3 §7.3, Phase D2 item 4): what this dog's style is worth in
 * this race, given the front-runners already declared into it and the ones the empty traps will
 * probably bring. Only a public style can be read — Hard learns its own dogs' styles by racing them,
 * like everybody else (C4) — so a dog nobody has read yet is worth its rating and no more.
 */
function boardRead(s: GameState, playerId: Id, d: Dog, race: RaceTypeId): number {
  const style = publicStyle(d);
  if (!style) return 0;
  const rivals = Object.entries(s.declarations[race])
    .filter(([pid]) => pid !== playerId)
    .map(([, id]) => s.dogs[id])
    .filter((x): x is Dog => !!x);
  const unfilled = balance.traps - 1 - rivals.length;
  return fieldRead(style, otherFrontRunners(rivals.map(publicStyle), unfilled));
}

/** The field-shape read on a posted field (§5.6): rating points per entry, index-aligned. */
function fieldShape(entries: readonly RaceEntry[]): number[] {
  return entries.map((e, i) =>
    fieldRead(
      e.style,
      otherFrontRunners(
        entries.filter((_, j) => j !== i).map((x) => x.style),
        0,
      ),
    ),
  );
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

import { HARD_KNOBS } from './knobs';
export { HARD_KNOBS };

function placeBets(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!s.fields) return;
  const mine = new Set(p.dogIds);
  const [cheap, second] = cheapAndSecond();
  const threwTheCheapRace =
    !!cheap && throwingTheCheapRace(s, playerId) && !s.declarations[cheap][playerId];
  const margin = bettingMargin(s);

  for (const { race, entries: field } of s.fields) {
    // Phase D2 item 4: the book prices each runner's trip and never the field (§5.6). Hard adds it.
    const shape = HARD_KNOBS.readsFieldBets ? fieldShape(field) : field.map(() => 0);
    let pick: { dogId: Id; kind: 'win' | 'place' } | null = null;
    let fraction = balance.aiBetFraction;
    // A tip, bet exactly as Normal bets one (Phase D1 item 6): Hard gets nothing new in D1 beyond it.
    const tip = tippedToBack(s, playerId, field);
    if (tip) pick = { dogId: tip.dogId, kind: 'win' };
    /** The price we took the edge at, so the stake can be sized against it. */
    let pickOdds = 0;

    // Our own runners, priced on what we know rather than on the number the bookie reads.
    // Both markets get checked: on the same edge a place bet pays less and lands far more
    // often, and a stable trying to be top of the table at week 13 would rather grind.
    let bestEdge = EDGE_REQUIRED;
    for (let i = 0; i < field.length && !tip; i++) {
      const e = field[i]!;
      if (!mine.has(e.dogId)) continue;
      const d = s.dogs[e.dogId];
      if (!d) continue;
      // On the book's own ruler: its style edge on this trip, as posted (GDD_V3 §5.6).
      const ours =
        effectiveRating(d) +
        d.raceBonus * balance.ratingWeightSpeed +
        (e.bookRating - e.rating) +
        shape[i]!;
      const ratings = field.map((x, j) => (j === i ? ours : x.bookRating + shape[j]!));
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

    // Anybody's runner the field's shape makes better than its price — a lone front-runner, a closer
    // behind a crowd — backed to win like an edge on its own dog (Phase D2 item 4).
    if (!pick && HARD_KNOBS.readsFieldBets && shape.some((x) => x !== 0)) {
      const probs = winProbabilities(field.map((x, j) => x.bookRating + shape[j]!));
      let best = EDGE_REQUIRED;
      field.forEach((e, j) => {
        if (mine.has(e.dogId)) return;
        const edge = probs[j]! * e.odds;
        if (edge > best) {
          best = edge;
          pick = { dogId: e.dogId, kind: 'win' };
          fraction = balance.aiBetFraction * 2;
        }
      });
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

    if (tippedAgainst(s, playerId, pick.dogId)) continue;
    // The flat ceiling as well as the fractional one, now that §20 Q7 has put one in.
    const cap = maxStakeFor(s, { ...p, cash: plan.cash });
    const stake = Math.floor(Math.min(plan.cash * fraction, cap));
    if (stake < 50) continue;
    out.push({ t: 'PlaceBet', playerId, race, dogId: pick.dogId, kind: pick.kind, stake });
    plan.cash -= stake;
  }
}
