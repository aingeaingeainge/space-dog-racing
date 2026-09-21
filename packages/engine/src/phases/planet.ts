import { raceType } from '../content/raceTypes';
import { good } from '../content/goods';
import { cargoTotal, HOLD_CAP, recordPurchase } from '../economy/goods';
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
import { bettingOpen } from './turn';

function fail(msg: string, action: Action): never {
  throw new ActionError(msg, action);
}

function activeOrFail(s: GameState, playerId: Id, action: Action): Player {
  if (s.activePlayer !== playerId) fail(`It is not ${playerId}'s turn`, action);
  return player(s, playerId);
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
  const p = activeOrFail(s, action.playerId, action);
  const type = raceType(action.race);
  // A race that is not on this weekend's card is not a race you can enter (GDD §6.3). The
  // declaration book has a key for every type, so nothing else would stop an entry landing in
  // one that is not being run and then quietly vanishing at endTurn.
  if (!thisWeeksCard().includes(action.race))
    fail(`There is no ${type.label} on this weekend's card`, action);
  if (action.dogId === null) {
    delete s.declarations[action.race][p.id];
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
  // Declaring implies racing (GDD §5.7). See setDogState for why the implication runs this way.
  d.weekState = 'race';
}

export function placeBet(ctx: Ctx, action: Extract<Action, { t: 'PlaceBet' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'betting');
  const p = activeOrFail(s, action.playerId, action);
  if (!s.locked || !s.fields || !bettingOpen(s)) fail('The bookie is closed', action);
  const field = s.fields.find((f) => f.race === action.race);
  const entry = field?.entries.find((e) => e.dogId === action.dogId);
  if (!entry) fail('That dog is not in that race', action);
  const stake = Math.floor(action.stake);
  if (stake <= 0) fail('Stake must be positive', action);
  const alreadyStaked = s.bets
    .filter((b) => b.playerId === p.id && b.week === s.week && b.race === action.race)
    .reduce((sum, b) => sum + b.stake, 0);
  // One ceiling: a fraction of cash (GDD_V3 §7.4). The flat stake ceiling went with the crook's
  // road — v2 added it because a crook could borrow a bankroll, and there is no borrowing in v3, so
  // bets are affordable by construction.
  const cap = maxStakeFor(s, p);
  if (alreadyStaked + stake > cap) fail(`Max stake on this race is ${cap}`, action);
  pay(p, stake, action);
  const margin = bettingMargin(s);
  const odds =
    action.kind === 'win'
      ? decimalOdds(entry.winProb, margin)
      : decimalOdds(entry.placeProb, margin);
  s.bets.push({
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
 * Three refusals: the hold has to have room for the crates *in total*, the shelf has to have that
 * many on it, and you cannot sell what you are not carrying. The shelf is what makes turn order
 * worth something — stock is shared with the whole table, so first look is first buy (GDD §8.5),
 * and GDD_V3 §2.3 keeps the Market in turn order for exactly that reason.
 */
export function tradeFood(ctx: Ctx, action: Extract<Action, { t: 'TradeFood' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  if (!s.toggles.trading) fail('Trading is switched off this season', action);
  const g = good(action.good);
  const market = s.planet.goods[action.good];
  const units = Math.trunc(action.units);
  if (units === 0) return;
  if (units > 0) {
    if (cargoTotal(p.cargo) + units > HOLD_CAP) fail('Not enough hold space', action);
    const available = market.stock;
    if (units > available) fail(`Only ${available} crates of ${g.label} to be had here`, action);
    const cost = units * market.buy;
    pay(p, cost, action);
    recordPurchase(p, action.good, units, market.buy);
    // Every shelf is finite and shared (GDD_V3 §6.1, V7): what you buy, the stable after you in the
    // turn order cannot. That is what going first is *for* (§2.3).
    market.stock -= units;
    p.stats.tradeIncome -= cost;
  } else {
    const sell = -units;
    if (sell > p.cargo[action.good]) fail(`Not that much ${g.label} aboard`, action);
    const proceeds = sell * market.sell;
    p.cash += proceeds;
    p.cargo[action.good] -= sell;
    p.stats.tradeIncome += proceeds;
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
  const p = activeOrFail(s, action.playerId, action);
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
