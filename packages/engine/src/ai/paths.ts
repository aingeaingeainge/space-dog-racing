import { balance } from '../content/balance';
import {
  currentPlanet,
  fixCatchRate,
  maxStakeFlat,
  maxStakeFor,
  player,
  purseFor,
  thisWeeksCard,
} from '../state';
import { outstanding } from '../economy/loans';
import { hasFixer } from '../economy/staff';
import { winProbabilities } from '../race/odds';
import { bettingOpen } from '../phases/turn';
import type { Action, GameState, Id, RaceTypeId } from '../types';
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
  type Plan,
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
  /**
   * Whether the crook may work §13 at all. `true` in every normal run.
   *
   * The ablation the phase turns on: the same agent, the same seeds, once with the road and once
   * without, so what §13 is *worth* is a difference rather than a comparison against a different
   * agent playing a different game. Without it the crook is exactly a cheap racing stable, which
   * is the right control — the fixer's wage and the fixer's jobs both switch off together.
   */
  crookMayFix: true,
};

// ---------------------------------------------------------------------------------------------
// Road 3: the crook (GDD §13, BUILD_PLAN §7a.5). The steps below are shared with the mixed agent,
// because "plays all three roads" has to mean *these* lines and not a second implementation of
// them — otherwise the mixed row measures a different crook from the crook row.
// ---------------------------------------------------------------------------------------------

/**
 * What −25 fitness is worth in **rating** points, for an agent that has to price a nobbling.
 *
 * The engine takes fitness off the runner; the bookie's model speaks only rating, so an agent
 * weighing a sabotage has to convert. Measured rather than guessed: on a Gold-class field, taking
 * 25 fitness off a rating-68 rival moves its win rate 61.6% → 45.9%, which the odds model
 * reproduces at about **10 rating points** [measured, `--fix`]. Derived from `fitScale`'s own
 * shape, so it moves if D13's curve ever does: 25 fitness is a 2.55% cut in top speed, and §5.1's
 * leverage table prices 2.5% of top speed at roughly ten points of rating.
 *
 * An AI heuristic rather than a rule, so it lives here beside `COVERAGE_GAIN` and
 * `THROW_CHEAP_RATE` rather than in `balance.json`: nothing in the game reads it, and a player
 * pricing the same decision reads the Bookie's own counter instead.
 */
const SABOTAGE_RATING_EQUIV = 10;

/**
 * Below this true chance a runner is not value at any price, it is noise: the odds model floors a
 * hopeless dog's probability (`oddsFloor`), so its posted price is a number rather than an opinion
 * and "50 times a floored probability" is arithmetic on a placeholder.
 */
const CROOK_MIN_BACKABLE = 0.04;

/**
 * Buy a box for the best dog we have standing (GDD §13). `planetPre`, after `declareBest`.
 *
 * Priced rather than habitual, and the sum is the one §8.4 got backwards: the *benefit* scales
 * with the race (a bigger purse and a bigger sensible stake) while the fine does not, so a bribe
 * is worth it at a Major and not at a cheap Tuesday. Trap 1 every time, because D37's measurement
 * is that the rail is worth about +3.5 points of win rate on a bend and nothing at all on a
 * straight — so on a track with no bends this step correctly does nothing.
 */
function buyABox(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (s.toggles.cleanSport || p.flags.fixerBarred || !hasFixer(p)) return;
  if (currentPlanet(s).track.bends === 'none') return;
  if (plan.cash < balance.bribeCost + plan.reserve) return;
  // The richest race we are actually standing in.
  let best: { race: RaceTypeId; dogId: Id; purse: number } | null = null;
  for (const race of thisWeeksCard(s)) {
    const dogId = s.declarations[race][playerId];
    if (!dogId) continue;
    const purse = purseFor(s, race)[0];
    if (!best || purse > best.purse) best = { race, dogId, purse };
  }
  if (!best) return;
  // D37: the draw is worth about 3.5 points of win rate, so the purse side alone has to clear the
  // fee before the betting side is counted. `fixCatchRate` is not in this sum: a caught bribe
  // costs the fine and the fixer, and that is priced once, in `worthFixing`, for the sabotage —
  // the bribe is the cheap half of the road and the agent treats it as such.
  if (best.purse * 0.035 * 2 < balance.bribeCost) return;
  out.push({ t: 'BribeSteward', playerId, race: best.race, dogId: best.dogId, trap: 1 });
  plan.cash -= balance.bribeCost;
}

/**
 * The one fix worth doing on this card, priced in Bones (GDD §13, §10).
 *
 * ⚠️ **The crook does not have to back its own dog, and that is the finding that makes the road
 * exist.** §13 describes the move as "backing your own dog at its unmoved odds", and that is one
 * case of a more general fact: nobbling the favourite lifts the true chance of *every other runner
 * in the race* while the book goes on quoting all eight of them at the prices it struck when
 * declarations locked. §10 has allowed a bet on any dog in any race since v1. So the honest
 * optimum is to nobble the favourite and take whichever price the market is now wrongest about —
 * usually the second favourite, sometimes your own.
 *
 * Measured, this is the difference between a road and a rounding error: with the crook restricted
 * to its own runner it found a positive fix in **10 of 1,600 stable-weeks**, because a mid stable's
 * dog is a 2% chance at 42/1 and 45% of nearly nothing is nearly nothing. Backing the best price
 * in the race instead, the same move on a field with a dominant favourite is worth about **+50% of
 * the stake** [measured, `--fix`].
 *
 * The purse term survives and is what still makes its own dog the pick when the two are close: a
 * sabotage moves prize money as well as a price, and only for a dog you own.
 */
interface FixChoice {
  race: RaceTypeId;
  /** The dog to get at: whoever the book has shortest, and not ours. */
  target: Id;
  /** The dog to back: whoever the stale board is now wrongest about. */
  on: Id;
  stake: number;
  value: number;
}

function bestFix(plan: Plan, stake: number): FixChoice | null {
  const { s, p, playerId } = plan;
  if (!s.fields || stake < 100) return null;
  const q = fixCatchRate(s, p);
  const expectedFine = q * (balance.fixFineBase + balance.fixFineStakeMult * stake);
  let choice: FixChoice | null = null;
  for (const race of thisWeeksCard(s)) {
    const field = s.fields.find((f) => f.race === race);
    if (!field) continue;
    const entries = field.entries;
    // Whoever the book has shortest, as long as it is not ours — you cannot nobble your own.
    let favIdx = -1;
    entries.forEach((e, k) => {
      if (e.ownerId === playerId) return;
      if (favIdx < 0 || e.winProb > entries[favIdx]!.winProb) favIdx = k;
    });
    if (favIdx < 0) continue;
    const after = entries.map((e, k) =>
      k === favIdx ? Math.max(5, e.rating - SABOTAGE_RATING_EQUIV) : e.rating,
    );
    const trueP = winProbabilities(after);
    const purse = purseFor(s, race)[0];
    entries.forEach((e, k) => {
      if (k === favIdx) return;
      // A dog so far out of it that the book has floored its price is noise, not value.
      if (trueP[k]! < CROOK_MIN_BACKABLE) return;
      const bettingGain = stake * (trueP[k]! * e.odds - 1);
      const purseGain = e.ownerId === playerId ? (trueP[k]! - e.winProb) * purse : 0;
      const value = bettingGain + purseGain - balance.sabotageCost - expectedFine;
      if (value > 0 && (!choice || value > choice.value))
        choice = { race, target: entries[favIdx]!.dogId, on: e.dogId, stake, value };
    });
  }
  return choice;
}

/**
 * Nobble, then bet (GDD §13). The betting phase, which is the only phase in which either is
 * possible — see the note on the `Sabotage` action for why that is the mechanic rather than an
 * implementation detail.
 *
 * The stake is everything above the reserve, up to the ceiling, because the edge is a *percentage*
 * and the fee is not: a small bet cannot pay for a fixer. This agent will always push against
 * whatever `maxStakeFor` allows, which is exactly what makes it the instrument for measuring where
 * §20 Q7's ceiling belongs — and exactly the rich-get-richer channel §10 warns about, seen from
 * the inside.
 */
function workTheFix(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  if (!s.fields) return;
  const canSabotage =
    !s.toggles.cleanSport && !p.flags.fixerBarred && hasFixer(p) && bettingOpen(s);
  const bank = Math.max(0, Math.floor(plan.cash - plan.reserve - balance.sabotageCost));
  const choice = canSabotage ? bestFix(plan, Math.min(maxStakeFor(s, p), bank)) : null;

  if (choice) {
    out.push({ t: 'Sabotage', playerId, race: choice.race, dogId: choice.target });
    plan.cash -= balance.sabotageCost;
    const stake = Math.min(maxStakeFor(s, { ...p, cash: plan.cash }), choice.stake);
    if (stake >= 100) {
      out.push({
        t: 'PlaceBet',
        playerId,
        race: choice.race,
        dogId: choice.on,
        kind: 'win',
        stake,
      });
      plan.cash -= stake;
    }
    return;
  }

  // No fix worth doing: back our own runner where the book's price is already generous about it,
  // which is the §5.3 edge every stable has and the crook simply uses harder.
  for (const race of thisWeeksCard(s)) {
    const field = s.fields.find((f) => f.race === race);
    const mine = field?.entries.find((e) => e.ownerId === playerId);
    if (!mine || mine.winProb < balance.aiBetMinProb) continue;
    const stake = Math.min(
      maxStakeFor(s, { ...p, cash: plan.cash }),
      Math.floor(plan.cash * balance.aiBetFraction * 4),
    );
    if (stake < 100) continue;
    out.push({ t: 'PlaceBet', playerId, race, dogId: mine.dogId, kind: 'win', stake });
    plan.cash -= stake;
    return;
  }
}

/**
 * The betting bank (§2.1: what a crook buys is "fixers, information, **betting bank**").
 *
 * ⚠️ **This is the line that decides whether §13 is a road or a curiosity, and it is a design
 * finding rather than an agent tweak.** The measured edge is a *percentage* of the stake (27.8% on
 * the best price left on the board, `--fix`) while the fee and the flat fine are fixed. So the
 * whole question is how much a crook can have on. A racing stable carries three to five thousand
 * spare, which cannot pay 1,200 for the job and still stake enough for the percentage to clear it:
 * measured, a crook restricted to its own cash placed **0.3 fixes a season** and the road did not
 * exist.
 *
 * Fat Tony lends 15,000 at 10% a week (§7.4) and until now nothing in the game has ever taken him
 * up on it — §20 Q15 asks whether the *trader* should, and the honest answer turns out to be that
 * the **crook** should. A road financed at 10% a week is high variance with a punishment tail on
 * both sides: the stewards on one and the vig on the other, which is §2.1's crook column written
 * out. The bank at 3% would be cheap money for a road that is supposed to be dangerous.
 *
 * Borrowed only with a Fixer who can actually work, only where Tony is, only while there is season
 * left to earn it back, and held rather than repaid on sight — which is why `repayLoans` moves
 * below this and runs on its own terms.
 */
function bettingBank(plan: Plan): void {
  const { s, p, playerId, out } = plan;
  const weeksLeft = balance.weeks - s.week;
  const working = hasFixer(p) && !p.flags.fixerBarred && !s.toggles.cleanSport;
  // Late on, or with no fixer left to use it, the bank is just a bill: clear it.
  if (!working || weeksLeft < 2) {
    repayLoans(plan);
    return;
  }
  if (!currentPlanet(s).special.shark) return;
  // Enough to pay for a job and push against the ceiling, twice over — a bank that covers one fix
  // is a bank that is empty the week after a losing bet.
  const want = maxStakeFlat(s) * 2 + balance.sabotageCost * 2;
  if (plan.cash >= want) return;
  const room = balance.sharkMax - outstanding(p, 'shark');
  const take = Math.min(room, Math.ceil((want - plan.cash) / 500) * 500);
  if (take < 1000) return;
  out.push({ t: 'Borrow', playerId, lender: 'shark', amount: take });
  plan.cash += take;
}

/** A mid stable: good enough to have a live runner in the race it is about to interfere with. */
const CROOK_STATES: StateOptions = { raceAbove: 62, restBelow: 45, train: true };

/**
 * Road 3: the crook (BUILD_PLAN §7a.5).
 *
 * Keeps a mid stable, hires a Fixer, buys a box where the draw is worth buying, nobbles the
 * favourite in the richest race it is in, and backs its own dog into the price that has not moved.
 *
 * ⚠️ It hires a **trainer alongside the fixer and leaves the third slot empty**, which is D30's
 * finding applied to a road D30 did not know about: three slots is more than a stable can
 * profitably fill, and the crook's second-most-valuable hire is the one that keeps it with a dog
 * worth backing.
 */
export function decideCrook(s: GameState, playerId: Id): Action[] {
  player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];
  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // ⚠️ Two departures from the other agents, and both are about the *shape* of this road.
    //
    // **`cover: 4` rather than the whole season**: a trainer's value compounds, so the trainer and
    // the trader agents will only sign one they can pay to week 13. A fixer's value is *per job*,
    // so four weeks of cover is the honest gate and waiting until week 9 to be certain of the wage
    // would be waiting out the road.
    // ⚠️ **Halving the reserve was tried here and is worse, which is worth recording.** A crook
    // holds a betting bank rather than a fortnight of bills, so letting it run closer to the wind
    // looked obviously right: it took the mean end worth 33,540 → 26,797 and the p10 8,746 →
    // 4,554, because the freed cash went into dogs and feed in the weeks it had no fixer and was
    // gone in the weeks it did. The bank has to be *borrowed* for the week it is wanted, which is
    // what `bettingBank` does — it cannot be scraped out of the running costs.
    //
    // `cover: 2` rather than the trainer's whole season: a trainer's value compounds, so it is worth
    // only signing one you can pay to week 13; a fixer's value is per job, and a crook that waits
    // until the wage is certain waits out the road. Measured at `cover: 4` the first working fixer
    // arrived in **week 6.5** — half the season gone before the road opened at all.
    // ⚠️ **A fixer for the big weeks, and not a day longer.** This is the line the whole road
    // turned on, and it was found by ablation rather than by design: a crook that keeps a fixer on
    // the books all season pays a wage every week for a man it uses **twice**, and §13 measured as
    // a *net loss* of 3,498 Bones against the same agent with the road switched off — even though
    // the betting column itself went −713 → +1,885, which is the first time betting has been
    // positive in this project.
    //
    // §2.1 said it in the first place: the crook's road pays "in bursts, at the biggest races".
    // So the fixer is taken on the week before a Major and let go once it has been run. The wage
    // becomes a cost of the burst rather than a standing charge, which is what a per-job road can
    // actually carry.
    keepStaff(plan, {
      want: PATH_KNOBS.crookMayFix ? ['fixer'] : [],
      cover: 2,
      cheapest: ['fixer'],
    });
    bettingBank(plan);
    if (s.phase === 'planetPre') {
      dogMarket(plan, { buyCashMultiple: 4, minRatingGain: 6, keepReserve: true });
      const assignment = declareBest(plan, { reserve: stateHold(plan, CROOK_STATES) });
      setStates(plan, racingDogs(assignment), CROOK_STATES);
      buyABox(plan);
    }
    tradeFoodPlan(plan);
  }

  if (s.phase === 'betting' && s.fields) workTheFix(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}

/**
 * All three roads at once (BUILD_PLAN §6b Phase D's acceptance row).
 *
 * §2.1 says the roads "are meant to be mixable. A stable that trains a pup, pays for it by
 * trading, and backs it at 9/1 when it is ready is playing all three, and should be about as rich
 * as one that commits." Nothing has ever measured that sentence, and it is the only row in the
 * plan that has never been attempted.
 *
 * The agent is deliberately the *same steps* the three single-road agents use, with one options
 * object each — so if the mixed row comes in below the best single road, the finding is about the
 * roads competing for the same slots and the same Bones, and not about a fourth agent being
 * written worse than the other three.
 */
const MIXED_STATES: StateOptions = { raceAbove: 66, restBelow: 42, train: true };

export function decideMixed(s: GameState, playerId: Id): Action[] {
  const p = player(s, playerId);
  if (s.pendingEvent?.playerId === playerId) return [{ t: 'ResolveEvent', playerId, choice: 0 }];
  if (s.activePlayer !== playerId) return [];
  const plan = startPlan(s, playerId);

  if (s.phase === 'planetPre' || s.phase === 'planetPost') {
    // Three slots, three roads, one each — which is exactly the shape D30 found a *racing* stable
    // cannot afford. Whether a stable playing all three can is the question this agent asks.
    keepStaff(plan, { want: ['trainer', 'fixer', 'trader'], cover: 4 });
    repayLoans(plan);
    const leg = balance.weeks - s.week;
    if (leg >= 3) {
      const room = balance.bankMax - outstanding(p, 'bank');
      if (room >= 1000 && plan.cash < plan.reserve * 3 && currentPlanet(s).special.bank) {
        plan.out.push({ t: 'Borrow', playerId, lender: 'bank', amount: room });
        plan.cash += room;
      }
    }
    if (s.phase === 'planetPre') {
      dogMarket(plan, { buyCashMultiple: 2, minRatingGain: 0, keepReserve: true });
      const assignment = declareBest(plan, { reserve: stateHold(plan, MIXED_STATES) });
      setStates(plan, racingDogs(assignment), MIXED_STATES);
      buyFeedPlan(plan, { crates: 3, spend: 0.6 });
      buyABox(plan);
    }
    tradeFoodPlan(plan, { workGoods: true, goodsSpend: 0.6 });
  }

  if (s.phase === 'betting' && s.fields) workTheFix(plan);

  plan.out.push({ t: 'EndPhase', playerId });
  return plan.out;
}

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
