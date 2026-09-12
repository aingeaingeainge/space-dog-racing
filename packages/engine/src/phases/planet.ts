import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { raceType } from '../content/raceTypes';
import { good, STOCK_UNLIMITED } from '../content/goods';
import { staffTitle } from '../content/staff';
import { cargoTotal } from '../economy/goods';
import { buyPriceFor, cargoCap } from '../economy/staff';
import { dogSalePrice, weakestStat } from '../economy/dogValue';
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
  // Two shelves: the shared one the whole table is racing for, and whatever this stable's own
  // Scout turned up, which nobody else can see or buy (GDD §8.3).
  const onShared = s.planet.marketDogIds.includes(d.id);
  const scouted = (s.planet.finds[p.id]?.dogIds ?? []).includes(d.id);
  if (d.ownerId !== 'market' || (!onShared && !scouted))
    fail('That dog is not for sale here', action);
  if (p.dogIds.length >= p.kennelSlots) fail('No free kennel slot', action);
  const price = d.askingPrice ?? 0;
  pay(p, price, action);
  d.ownerId = p.id;
  delete d.askingPrice;
  p.dogIds.push(d.id);
  p.stats.dogsBought++;
  s.planet.marketDogIds = s.planet.marketDogIds.filter((id) => id !== d.id);
  const finds = s.planet.finds[p.id];
  if (finds) finds.dogIds = finds.dogIds.filter((id) => id !== d.id);
  log(
    s,
    `Bought ${d.name} (rating ${d.rating}) for ${price}${scouted ? ' — your scout found it' : ''}.`,
    p.id,
  );
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

/**
 * Buy or sell one good (GDD §9.1). Positive units buy, negative sell.
 *
 * Three refusals rather than v1's two: the hold has to have room for the crates *in total*, the
 * shelf has to have that many on it, and you cannot sell what you are not carrying. The shelf is
 * the new one and it is what makes turn order worth something — stock is shared with the whole
 * table, so first look is first buy (GDD §8.5).
 */
export function tradeFood(ctx: Ctx, action: Extract<Action, { t: 'TradeFood' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  if (!s.toggles.trading) fail('Trading is switched off this season', action);
  const g = good(action.good);
  const market = s.planet.goods[action.good];
  const consigned = s.planet.finds[p.id]?.goods[action.good] ?? 0;
  const units = Math.trunc(action.units);
  if (units === 0) return;
  if (units > 0) {
    if (cargoTotal(p.cargo) + units > cargoCap(p)) fail('Not enough hold space', action);
    const available = market.stock === STOCK_UNLIMITED ? STOCK_UNLIMITED : market.stock + consigned;
    if (units > available) fail(`Only ${available} crates of ${g.label} to be had here`, action);
    // A Prime trader's 5% comes off the price this stable pays, not off the shelf price the rest
    // of the table sees: it is a fact about the hire rather than about the planet.
    const cost = units * buyPriceFor(p, market.buy);
    pay(p, cost, action);
    p.cargo[action.good] += units;
    // Your own consignment goes first — it is yours, and leaving it while the shared shelf empties
    // would be strictly worse for you and better for nobody. An unlimited shelf is never drawn
    // down, which is the rule that keeps the staple always available.
    const fromFinds = Math.min(consigned, units);
    if (fromFinds > 0) s.planet.finds[p.id]!.goods[action.good] -= fromFinds;
    const fromShelf = units - fromFinds;
    if (fromShelf > 0 && market.stock < STOCK_UNLIMITED) market.stock -= fromShelf;
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
 * Take somebody on (GDD §8.3, D7).
 *
 * **Three slots, any mix** — including three trainers, which is why the only refusal left is that
 * the slots are full. v1 refused a second trainer, and that refusal *was* the stacking penalty D7
 * exists to leave out: the price is the gate, and whether stacking dominates is something to
 * measure rather than to forbid.
 *
 * The Fixer is not hireable (`content/staff.ts`), so his row never reaches a planet and the refusal
 * here is a backstop rather than a rule a player meets.
 */
export function hireStaff(ctx: Ctx, action: Extract<Action, { t: 'HireStaff' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const offer = s.planet.staff.find((o) => o.id === action.staffId);
  if (!offer) fail('Nobody by that name is for hire here', action);
  if (offer.role === 'fixer')
    fail('GDD §13 does not exist yet — nothing for a fixer to do', action);
  if (p.staff.length >= balance.staffSlots)
    fail(`All ${balance.staffSlots} staff slots are full — let somebody go first`, action);
  p.staff.push(offer);
  s.planet.staff = s.planet.staff.filter((o) => o.id !== offer.id);
  log(s, `Hired ${offer.name}, ${staffTitle(offer.role, offer.tier)} (${offer.wage}/week).`, p.id);
}

/**
 * Let somebody go.
 *
 * One refusal, and it is about the **Trader's hold** (GDD §8.3): his crates are a wage, not an
 * asset, so losing him loses the capacity — and a stable carrying 45 crates in a 20-crate ship
 * cannot simply be left over its own limit. Rather than spill the difference (a punishment the GDD
 * does not describe) or carry an impossible hold (a hole in the invariant that says a hold fits its
 * ship), this asks the player to sell down first, the same shape as "withdraw the dog from its race
 * first" and "a stable must keep at least one dog".
 */
export function fireStaff(ctx: Ctx, action: Extract<Action, { t: 'FireStaff' }>): void {
  const { s } = ctx;
  planetPhase(s, action, 'planetPre', 'planetPost');
  const p = activeOrFail(s, action.playerId, action);
  const at = p.staff.findIndex((o) => o.id === action.staffId);
  if (at < 0) fail('Nobody by that name is on your books', action);
  const gone = p.staff[at]!;
  const without = p.staff.filter((o) => o.id !== gone.id);
  const capWithout = cargoCap({ ...p, staff: without });
  const crates = cargoTotal(p.cargo);
  if (crates > capWithout) {
    fail(
      `${gone.name}'s hold is carrying ${crates - capWithout} crates you would have nowhere to put — sell some first`,
      action,
    );
  }
  p.staff = without;
  log(s, `Let ${gone.name} go.`, p.id);
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
      const stat = weakestStat(d);
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
    /**
     * A dossier on a week the fog is hiding (GDD §9.3, D5). It buys **one week's** entry in the
     * circuit, `dossierReach` weeks out — next week is free, so what you are paying for is the
     * week after that: one extra leg to price a hold against (§9.2).
     *
     * What it writes is a log line addressed to the buyer, not a field on the Player. The whole
     * circuit is already in `calendar`; the fog is a rule about who may look, and the action log
     * is where "this stable paid to look" already lives. So the information economy lands without
     * adding anything to GameState — which is also why the golden snapshot does not move for it.
     */
    case 'dossier': {
      const week = action.week;
      if (week === undefined) fail('Which week?', action);
      if (week !== s.week + balance.dossierReach) {
        fail(
          `Dossiers only cover week ${s.week + balance.dossierReach} from here — next week is public anyway`,
          action,
        );
      }
      const entry = s.calendar[week - 1];
      if (!entry) fail('The season ends before then', action);
      pay(p, price, action);
      const ahead = planetOf(entry.planetId);
      log(
        s,
        `Dossier on week ${week}: ${ahead.name}${entry.major ? ` — ${ahead.event}` : ''}. ` +
          `Kibble ${ahead.foodBand[0]}–${ahead.foodBand[1]}. ` +
          `Card: ${entry.card.map((r) => raceType(r).label).join(', ')}.`,
        p.id,
      );
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
