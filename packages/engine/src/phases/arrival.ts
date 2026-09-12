import { balance } from '../content/balance';
import { emptyPlanetState, rollFinds, rollMarketDogs, rollStaff } from '../economy/market';
import { rollGoodPrices } from '../economy/food';
import { cargoTotal, spoilCargo } from '../economy/goods';
import { currentPlanet, emptyDeclarations, log, type Ctx } from '../state';
import { clamp } from '../rng';
import { drawEvents } from './events';

/** GDD §4.2 step 1: arrive, roll the planet, decide turn order. */
export function runArrival(ctx: Ctx): void {
  const { s, rng } = ctx;
  const entry = s.calendar[s.week - 1]!;
  const planet = currentPlanet(s);
  if (planet.id !== entry.planetId) throw new Error('planet/calendar mismatch');

  // Planet state for the week.
  const ps = emptyPlanetState(planet.id);
  ps.goods = rollGoodPrices(planet, rng);
  for (const d of rollMarketDogs(planet, s.week, rng, ctx.nextId)) {
    s.dogs[d.id] = d;
    ps.marketDogIds.push(d.id);
  }
  ps.staff = rollStaff(planet, rng, ctx.nextId);
  ps.muzzlesInStock = !!planet.special.muzzles || rng.chance(0.3);
  ps.trackDayPasses = rng.chance(0.5);
  // What each stable's own staff turned up for it (GDD §8.3). In `s.players` order rather than
  // turn order, because turn order has not been rolled yet and the draw order must not depend on
  // it — a Scout's dogs are the same dogs whoever lands first.
  for (const p of s.players) {
    const { finds, dogs } = rollFinds(p, planet, s.week, ps.goods, rng, ctx.nextId);
    ps.finds[p.id] = finds;
    for (const d of dogs) s.dogs[d.id] = d;
  }
  s.planet = ps;
  s.declarations = emptyDeclarations();
  s.locked = false;
  s.fields = null;
  s.races = null;
  s.done = [];

  // Turn order: shipSpeed × 10 − cargo ÷ 5 + d10, highest first (reversed at Blackreach).
  const scored = s.players.map((p) => {
    const die = rng.int(1, balance.arrivalDie);
    // The whole hold slows the ship, whatever is in it: a crate of Prime speed feed weighs the
    // same as a crate of kibble.
    const crates = cargoTotal(p.cargo);
    let score = p.ship.speed * balance.arrivalSpeedMult - crates / balance.arrivalCargoDiv + die;
    let reason =
      crates > balance.fuelCargoFree
        ? 'heavy cargo'
        : p.ship.speed >= 4
          ? 'fast ship'
          : die >= 8
            ? 'lucky approach'
            : 'steady approach';
    if (p.flags.arriveFirstNextWeek) {
      score += 1000;
      reason = 'wormhole shortcut';
      p.flags.arriveFirstNextWeek = false;
    }
    if (p.flags.bankrupt) score -= 10000;
    return { id: p.id, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  if (planet.special.turnOrderReversed) {
    const bankrupt = scored.filter((x) => x.score < -5000);
    const live = scored.filter((x) => x.score >= -5000).reverse();
    scored.splice(0, scored.length, ...live, ...bankrupt);
    for (const x of live) x.reason = 'black hole drags heavy ships in first';
  }
  s.turnOrder = scored.map((x) => x.id);
  s.turnOrderReason = Object.fromEntries(scored.map((x) => [x.id, x.reason]));
  log(s, `Week ${s.week}: ${planet.name}${entry.major ? ` — ${planet.event ?? 'Major'}` : ''}.`);

  // Planet arrival effects.
  for (const p of s.players) {
    if (p.flags.bankrupt) continue;
    const delta = planet.special.fitnessOnArrival ?? 0;
    if (delta) {
      for (const id of p.dogIds) {
        const d = s.dogs[id];
        if (d) d.fitness = clamp(d.fitness + delta, 0, 100);
      }
    }
    // Glassfall's freeze takes a fraction of the *whole* hold, off the biggest stacks first —
    // see spoilCargo for why that reading rather than a fraction of each good (which would cost a
    // diversified trader a crate of everything) or of the total rounded down per good (which a
    // hold of thin stacks would dodge entirely).
    if (planet.special.foodSpoils && !p.ship.coldStore) {
      const lost = spoilCargo(p.cargo, planet.special.foodSpoils);
      if (lost > 0) log(s, `${lost} crates froze solid on approach to ${planet.name}.`, p.id);
    }
    // Hushmarket: the real owner turns up for a fell-off-a-ship dog.
    for (const id of [...p.dogIds]) {
      const d = s.dogs[id];
      if (d?.fellOffAShip === s.week) {
        if (rng.chance(0.2)) {
          p.dogIds = p.dogIds.filter((x) => x !== id);
          delete s.dogs[id];
          log(s, `${d.name}'s real owner turned up with paperwork and a large friend.`, p.id);
        } else {
          delete d.fellOffAShip;
        }
      }
    }
  }

  s.phase = 'events';
  s.eventQueue = s.turnOrder.filter((id) => !s.players.find((p) => p.id === id)?.flags.bankrupt);
  s.activePlayer = null;
  drawEvents(ctx);
}
