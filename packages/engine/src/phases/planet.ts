import { raceType } from '../content/raceTypes';
import { balance } from '../content/balance';
import { good } from '../content/goods';
import { cargoTotal, HOLD_CAP, recordPurchase } from '../economy/goods';
import { pricesFor, staffBonus, tradeCommission } from '../economy/staff';
import { decimalOdds } from '../race/odds';
import {
  bettingMargin,
  dog,
  eligible,
  maxStakeFor,
  player,
  thisWeeksCard,
  type Ctx,
} from '../state';
import {
  ActionError,
  type Action,
  type GameState,
  type Id,
  type Player,
  RACE_TYPE_IDS,
} from '../types';
import { bettingOpen, mayAct } from './turn';

function fail(msg: string, action: Action): never {
  throw new ActionError(msg, action);
}

/**
 * Is this stable free to act on the planet now (Phase T, GDD_V3 T1)? **Any stable still at it**, in
 * whatever order — the weekend is played by everybody at once. Before the races it must have been
 * through its door first (§2.3 step 2): what is behind it can hand it a dog, a crate or a trainer,
 * and the market and the Race Office are the rest of the same visit.
 */
function actorOrFail(s: GameState, playerId: Id, action: Action): Player {
  const p = player(s, playerId);
  if (!mayAct(s, p.id)) fail(`${p.name} has finished on this planet`, action);
  if (s.pendingEvents[p.id]) fail('Resolve your event first', action);
  if (s.phase === 'planetPre' && s.explore && s.explore.picks[p.id] === undefined)
    fail('Pick a door first', action);
  return p;
}

/** Has this stable opened its door this weekend? (Phase T: the first thing it does on the planet.) */
export function hasExplored(s: GameState, playerId: Id): boolean {
  return !s.explore || s.explore.picks[playerId] !== undefined;
}

function planetPhase(s: GameState, action: Action, ...phases: GameState['phase'][]): void {
  if (!phases.includes(s.phase)) fail(`${action.t} is not allowed in phase ${s.phase}`, action);
}

function pay(p: Player, amount: number, action: Action): void {
  if (amount > p.cash)
    fail(`Not enough Bones (${amount} needed, ${Math.round(p.cash)} held)`, action);
  p.cash -= amount;
}

export function declaredDogs(s: GameState, playerId: Id): Id[] {
  const out: Id[] = [];
  for (const race of RACE_TYPE_IDS) {
    const id = s.declarations[race][playerId];
    if (id) out.push(id);
  }
  return out;
}

export function declare(ctx: Ctx, action: Extract<Action, { t: 'Declare' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre');
  const p = actorOrFail(s, action.playerId, action);
  const type = raceType(action.race);
  // A race that is not on this weekend's card is not a race you can enter (GDD §6.3). The
  // declaration book has a key for every type, so nothing else would stop an entry landing in
  // one that is not being run and then quietly vanishing at endTurn.
  if (!thisWeeksCard().includes(action.race))
    fail(`There is no ${type.label} on this weekend's card`, action);
  if (action.dogId === null) {
    delete s.declarations[action.race][p.id];
    followDeclarations(s, p.id);
    return;
  }
  const d = dog(s, action.dogId);
  if (d.ownerId !== p.id) fail('Not your dog', action);
  if (!eligible(d, action.race)) {
    fail(
      d.injuryWeeks > 0
        ? `${d.name} is injured`
        : `${d.name} does not qualify for the ${type.label}: ${type.criterion}`,
      action,
    );
  }
  for (const race of RACE_TYPE_IDS) {
    if (race !== action.race && s.declarations[race][p.id] === d.id)
      delete s.declarations[race][p.id];
  }
  s.declarations[action.race][p.id] = d.id;
  followDeclarations(s, p.id);
}

/**
 * **The week's state follows the declarations** (Phase D2 item 5, Jesse's call): a declared dog is
 * racing, and every other dog in the kennel is resting.
 *
 * ⚠️ **Race/Rest was inert for an undeclared dog**, and this is the rule that says so out loud.
 * `weeklyFitnessDelta` rests a dog that did not run whatever its `weekState` says, so the Kennels'
 * weekly "Plan the week" press changed nothing for a player who declares — the declaration was the
 * decision all along. So the state is now *set* by the Race Office, on every Declare and again when
 * declarations lock, and the Kennels shows it rather than asking for it. `SetDogState` stays, for the
 * diet and for a player who wants to mark a dog, but a mark lasts only until the next declaration.
 */
export function followDeclarations(s: GameState, playerId?: Id): void {
  for (const p of s.players) {
    if (playerId && p.id !== playerId) continue;
    const declared = new Set(declaredDogs(s, p.id));
    for (const id of p.dogIds) {
      const d = s.dogs[id];
      if (d) d.weekState = declared.has(id) ? 'race' : 'rest';
    }
  }
}

/**
 * Is this stable still at the Bookie? **Betting is taken in any order** (Phase E2, GDD_V3 §2.3 step 6,
 * §3): "everyone bets at once". A stable may bet, and send EndPhase, whenever it has not yet finished
 * betting — not only when it is the active player — so a hotseat table can hand the laptop round in
 * whatever order saves a pass. AI stables still act as the active player, in turn order.
 */
function bettorOrFail(s: GameState, playerId: Id, action: Action): Player {
  const p = player(s, playerId);
  if (s.done.includes(p.id)) fail(`${p.name} has finished at the Bookie`, action);
  return p;
}

/**
 * Where a new slip goes in `s.bets`: after every slip this weekend from a stable at or before this one
 * in the turn order. So the book reads as if everybody had bet in turn order, **whatever order they
 * actually bet in** — which is what makes the betting phase order-independent to the byte, and why a
 * table of AI stables (which do bet in turn order) writes exactly the book it always wrote.
 */
function slipIndex(s: GameState, playerId: Id): number {
  const rank = (id: Id) => s.turnOrder.indexOf(id);
  let at = s.bets.length;
  while (at > 0) {
    const prev = s.bets[at - 1]!;
    if (prev.week !== s.week || rank(prev.playerId) <= rank(playerId)) break;
    at--;
  }
  return at;
}

export function placeBet(ctx: Ctx, action: Extract<Action, { t: 'PlaceBet' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'betting');
  const p = bettorOrFail(s, action.playerId, action);
  if (!s.locked || !s.fields || !bettingOpen(s)) fail('The bookie is closed', action);
  const field = s.fields.find((f) => f.race === action.race);
  const entry = field?.entries.find((e) => e.dogId === action.dogId);
  if (!entry) fail('That dog is not in that race', action);
  const stake = Math.floor(action.stake);
  if (stake <= 0) fail('Stake must be positive', action);
  const alreadyStaked = s.bets
    .filter((b) => b.playerId === p.id && b.week === s.week && b.race === action.race)
    .reduce((sum, b) => sum + b.stake, 0);
  // Two ceilings, the lower binding (GDD_V3 §7.4): a fraction of cash, and the flat ceiling that
  // Phase G put back because a share-of-cash stake compounds for a rich stable (V21). Summed over
  // every slip this stable already has on the race.
  const cap = maxStakeFor(s, p);
  if (alreadyStaked + stake > cap) fail(`Max stake on this race is ${cap}`, action);
  pay(p, stake, action);
  const margin = bettingMargin(s);
  const posted =
    action.kind === 'win'
      ? decimalOdds(entry.winProb, margin)
      : decimalOdds(entry.placeProb, margin);
  // A Gambling Advisor's better price (Phase T, T3): the slip is struck at it, so it is what the slip
  // says and what it pays. Rounded to the book's two places.
  const sharp = staffBonus(p, 'sharpOdds') * balance.staffSharpOdds;
  const odds = sharp ? Math.round(posted * (1 + sharp) * 100) / 100 : posted;
  s.bets.splice(slipIndex(s, p.id), 0, {
    playerId: p.id,
    week: s.week,
    race: action.race,
    dogId: action.dogId,
    kind: action.kind,
    stake,
    odds,
  });
  p.stats.betIncome -= stake;
}

/**
 * Buy or sell one good (GDD §9.1). Positive units buy, negative sell.
 *
 * Three refusals: the hold has to have room for the crates *in total*, the stable's shelf has to have
 * that many on it, and you cannot sell what you are not carrying.
 *
 * ⚠️ **Every stable has a shelf of its own** (Phase T, GDD_V3 T2 — Jesse's "no more shared market").
 * The planet posts one set of prices and one depth per good, and each stable is given that shelf to
 * itself at arrival (`Player.shelf`); what it buys comes off its own. Until `v3t` the shelf was shared
 * and the Market was taken in turn order, so the first stable through had first pick — the thing turn
 * order was for. The prices a stable pays and gets are its own too: a Trade Advisor haggles and sells
 * (`pricesFor`), and takes a share of the profit on a sale (`tradeCommission`, T4).
 */
export function tradeFood(ctx: Ctx, action: Extract<Action, { t: 'TradeFood' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = actorOrFail(s, action.playerId, action);
  if (!s.toggles.trading) fail('Trading is switched off this season', action);
  const g = good(action.good);
  const price = pricesFor(s, p, action.good);
  const units = Math.trunc(action.units);
  if (units === 0) return;
  if (units > 0) {
    if (cargoTotal(p.cargo) + units > HOLD_CAP) fail('Not enough hold space', action);
    const available = p.shelf[action.good];
    if (units > available) fail(`Only ${available} crates of ${g.label} to be had here`, action);
    const cost = units * price.buy;
    pay(p, cost, action);
    recordPurchase(p, action.good, units, price.buy);
    p.shelf[action.good] -= units;
    p.stats.tradeIncome -= cost;
  } else {
    const sell = -units;
    if (sell > p.cargo[action.good]) fail(`Not that much ${g.label} aboard`, action);
    const gross = sell * price.sell;
    const commission = tradeCommission(p, action.good, sell, price.sell);
    p.cash += gross - commission;
    p.cargo[action.good] -= sell;
    p.stats.tradeIncome += gross - commission;
    p.stats.tradeCommission += commission;
  }
}

/**
 * Race or Rest (GDD_V3 §4.2), and the dog's diet pointer.
 *
 * Standing a declared dog down is refused rather than silently withdrawing it: declaring implies
 * racing, and the reverse has to be asked for, or a stray click could bin an entry.
 */
export function setDogState(ctx: Ctx, action: Extract<Action, { t: 'SetDogState' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = actorOrFail(s, action.playerId, action);
  const d = dog(s, action.dogId);
  if (d.ownerId !== p.id) fail('Not your dog', action);
  if (action.state !== 'race' && declaredDogs(s, p.id).includes(d.id)) {
    fail(`Withdraw ${d.name} from its race first`, action);
  }
  d.weekState = action.state;
  if (action.diet) {
    if (action.diet.kind === 'named') good(action.diet.good); // throws on a good this engine lacks
    d.diet = action.diet;
  }
}

/**
 * Spend a bought trap draw (GDD_V3 §9.3): name the box for this stable's runner in one race. The
 * right was bought in the Back Alley at Explore, before anybody knew the card; it is spent here, in
 * the Race Office, once the race is. It can be moved until the card locks, and is honoured at the
 * lock (`lockDeclarations`) if the stable still has a runner in that race.
 */
export function chooseBox(ctx: Ctx, action: Extract<Action, { t: 'ChooseBox' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre');
  const p = actorOrFail(s, action.playerId, action);
  const job = s.jobs.find((j) => j.by === p.id && j.kind === 'box');
  if (!job) fail('You have not bought a box from a steward this weekend', action);
  if (!thisWeeksCard().includes(action.race)) fail('That race is not on the card', action);
  if (!Number.isInteger(action.box) || action.box < 1 || action.box > balance.traps)
    fail(`There is no box ${action.box}`, action);
  if (!s.declarations[action.race][p.id]) fail('Declare a runner in that race first', action);
  job.race = action.race;
  job.box = action.box;
}
