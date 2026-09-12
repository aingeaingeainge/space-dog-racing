import { balance } from '../content/balance';
import { raceType } from '../content/raceTypes';
import { dogSalePrice } from '../economy/dogValue';
import { loanCap, outstanding } from '../economy/loans';
import { upgradePrice } from '../economy/market';
import { decimalOdds } from '../race/odds';
import {
  bettingMargin,
  currentPlanet,
  dog,
  eligible,
  log,
  maxStakeFraction,
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
import { clamp } from '../rng';
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

export function buyDog(ctx: Ctx, action: Extract<Action, { t: 'BuyDog' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const d = dog(s, action.dogId);
  if (d.ownerId !== 'market' || !s.planet.marketDogIds.includes(d.id))
    fail('That dog is not for sale here', action);
  if (p.dogIds.length >= p.kennelSlots) fail('No free kennel slot', action);
  const price = d.askingPrice ?? 0;
  pay(p, price, action);
  d.ownerId = p.id;
  delete d.askingPrice;
  p.dogIds.push(d.id);
  p.stats.dogsBought++;
  s.planet.marketDogIds = s.planet.marketDogIds.filter((id) => id !== d.id);
  log(s, `Bought ${d.name} (rating ${d.rating}) for ${price}.`, p.id);
}

export function sellDog(ctx: Ctx, action: Extract<Action, { t: 'SellDog' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const d = dog(s, action.dogId);
  if (d.ownerId !== p.id) fail('Not your dog', action);
  if (p.dogIds.length <= 1) fail('A stable must keep at least one dog', action);
  if (declaredDogs(s, p.id).includes(d.id) && s.phase === 'planetPre')
    fail('Withdraw the dog from its race first', action);
  const planet = currentPlanet(s);
  const price = dogSalePrice(d, planet.special.buyerBonus ?? 0, planet.special.dogValueMod ?? 1);
  p.cash += price;
  p.stats.dogsSold++;
  p.dogIds = p.dogIds.filter((id) => id !== d.id);
  if (p.fanClubDogId === d.id) delete p.fanClubDogId;
  delete s.dogs[d.id];
  log(s, `Sold ${d.name} for ${price}.`, p.id);
}

/** Every dog this stable has standing in a race this weekend. */
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
  if (!thisWeeksCard(s).includes(action.race))
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
        : d.banWeeks > 0
          ? `${d.name} is banned`
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
  const cap = Math.floor(p.cash * maxStakeFraction(s));
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

export function tradeFood(ctx: Ctx, action: Extract<Action, { t: 'TradeFood' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  if (!s.toggles.trading) fail('Trading is switched off this season', action);
  const units = Math.trunc(action.units);
  if (units === 0) return;
  if (units > 0) {
    if (p.cargo + units > p.ship.cargoCap) fail('Not enough hold space', action);
    const cost = units * s.planet.foodBuy;
    pay(p, cost, action);
    p.cargo += units;
    p.stats.tradeIncome -= cost;
  } else {
    const sell = -units;
    if (sell > p.cargo) fail('Not that much kibble aboard', action);
    const proceeds = sell * s.planet.foodSell;
    p.cash += proceeds;
    p.cargo -= sell;
    p.stats.tradeIncome += proceeds;
  }
}

export function hireStaff(ctx: Ctx, action: Extract<Action, { t: 'HireStaff' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const offer = s.planet.staff.find((o) => o.id === action.staffId && o.role === action.role);
  if (!offer) fail('Nobody by that name is for hire here', action);
  if (action.role === 'fixer' && s.toggles.cleanSport) fail('Clean Sport: no fixers', action);
  if (p.staff[action.role]) fail(`You already employ a ${action.role}`, action);
  p.staff[action.role] = offer;
  s.planet.staff = s.planet.staff.filter((o) => o.id !== offer.id);
  log(s, `Hired ${offer.name} as ${action.role} (${offer.wage}/week).`, p.id);
}

export function fireStaff(ctx: Ctx, action: Extract<Action, { t: 'FireStaff' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  if (!p.staff[action.role]) fail(`You have no ${action.role}`, action);
  delete p.staff[action.role];
}

/**
 * Set what a dog does with its week (GDD §5.7). Legal in both planet phases and validated the
 * way Declare is — same phases, same ownership check.
 *
 * **Which way the dependency runs, and why.** Declaring a dog implies it races: the Race Office
 * sets `weekState` for you, because a player who has just put a dog in the Gold and then finds
 * it did not run because a radio button in another screen said "rest" has been told off by the
 * game for no reason. The other direction refuses instead: standing a declared dog down asks
 * you to withdraw it from its race first, which is exactly what selling one already does. So
 * the friendly implication runs from the specific act to the general state, and never the other
 * way round, where it would quietly bin an entry.
 *
 * Layoff is not settable — an injured or banned dog is on Layoff whatever the Kennels says, and
 * `weekStatusOf` derives it. Setting the state of a dog that is on Layoff is allowed and useful:
 * it is how you say what the dog should do the week it comes back.
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
  if (action.stat) d.trainStat = action.stat;
}

export function buyUpgrade(ctx: Ctx, action: Extract<Action, { t: 'BuyUpgrade' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const planet = currentPlanet(s);
  const price = upgradePrice(action.upgrade, planet, p);
  switch (action.upgrade) {
    case 'engine':
      if (p.ship.speed >= balance.shipMaxSpeed) fail('Engine already at top tier', action);
      pay(p, price, action);
      p.ship.speed++;
      p.ship.upgradesPaid += price;
      break;
    case 'cargo':
      pay(p, price, action);
      p.ship.cargoCap += balance.cargoUpgradeUnits;
      p.ship.upgradesPaid += price;
      break;
    case 'kennel':
      if (p.kennelSlots >= balance.kennelSlotsMax) fail('Kennels already full size', action);
      pay(p, price, action);
      p.kennelSlots++;
      p.ship.upgradesPaid += price;
      break;
    case 'coldStore':
      if (p.ship.coldStore) fail('Already fitted', action);
      pay(p, price, action);
      p.ship.coldStore = true;
      p.ship.upgradesPaid += price;
      break;
    case 'trackDay': {
      if (!s.planet.trackDayPasses) fail('No track-day passes here this week', action);
      const d = ownDogOrFail(s, p, action);
      pay(p, price, action);
      const stat = bestStatToTrain(d);
      d[stat] = clamp(d[stat] + balance.itemTrackDayBonus, 1, 99);
      s.planet.trackDayPasses = false;
      break;
    }
    case 'muzzle': {
      if (!s.planet.muzzlesInStock) fail('No racing muzzles here this week', action);
      const d = ownDogOrFail(s, p, action);
      pay(p, price, action);
      d.trap = clamp(d.trap + balance.itemMuzzleBonus, 1, 99);
      s.planet.muzzlesInStock = false;
      break;
    }
    case 'supplement': {
      if (s.toggles.cleanSport) fail('Clean Sport: no supplements', action);
      if (s.phase !== 'planetPre') fail('Too late to feed a supplement', action);
      const d = ownDogOrFail(s, p, action);
      if (d.supplemented) fail(`${d.name} has had enough`, action);
      pay(p, price, action);
      d.supplemented = true;
      d.raceBonus += balance.itemSupplementBonus;
      p.stats.supplementsUsed++;
      break;
    }
  }
  p.stats.costs += price;
}

function ownDogOrFail(s: GameState, p: Player, action: Action): ReturnType<typeof dog> {
  const dogId = 'dogId' in action ? action.dogId : undefined;
  if (!dogId) fail('Which dog?', action);
  const d = dog(s, dogId);
  if (d.ownerId !== p.id) fail('Not your dog', action);
  return d;
}

function bestStatToTrain(d: ReturnType<typeof dog>): 'speed' | 'accel' | 'stamina' | 'trap' {
  // A track day sharpens whatever is weakest, weighted by how much it matters to rating.
  const weighted: [number, 'speed' | 'accel' | 'stamina' | 'trap'][] = [
    [d.speed / balance.ratingWeightSpeed, 'speed'],
    [d.accel / balance.ratingWeightAccel, 'accel'],
    [d.stamina / balance.ratingWeightStamina, 'stamina'],
    [d.trap / balance.ratingWeightTrap, 'trap'],
  ];
  weighted.sort((a, b) => a[0] - b[0]);
  return weighted[0]![1];
}

export function borrow(ctx: Ctx, action: Extract<Action, { t: 'Borrow' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const planet = currentPlanet(s);
  if (action.lender === 'bank' && !planet.special.bank) fail('No bank on this planet', action);
  if (action.lender === 'shark' && !planet.special.shark)
    fail('Fat Tony is not on this planet', action);
  const amount = Math.floor(action.amount);
  if (amount <= 0) fail('Borrow a positive amount', action);
  if (outstanding(p, action.lender) + amount > loanCap(action.lender)) {
    fail(`${action.lender === 'bank' ? 'The bank' : 'Fat Tony'} will not lend that much`, action);
  }
  const existing = p.loans.find((l) => l.lender === action.lender);
  if (existing) existing.principal += amount;
  else p.loans.push({ lender: action.lender, principal: amount });
  p.cash += amount;
  log(
    s,
    `Borrowed ${amount} from ${action.lender === 'bank' ? 'the bank' : 'Fat Tony Nebula'}.`,
    p.id,
  );
}

export function repay(ctx: Ctx, action: Extract<Action, { t: 'Repay' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const loan = p.loans.find((l) => l.lender === action.lender);
  if (!loan) fail('Nothing owed to that lender', action);
  const amount = Math.min(loan.principal, Math.floor(action.amount));
  if (amount <= 0) fail('Repay a positive amount', action);
  pay(p, amount, action);
  loan.principal -= amount;
  if (loan.principal <= 0) p.loans = p.loans.filter((l) => l !== loan);
}
