import { balance } from '../content/balance';
import { emptyPlanetState } from '../economy/dogs';
import { rollGoodPrices } from '../economy/food';
import { cargoTotal } from '../economy/goods';
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
  // ⚠️ The planet-week is now one thing: a shelf. The dogs on the block, the staff hall, the man
  // at the far table, the muzzles and the track-day passes are all deleted (BUILD_PLAN_V3 §2.1),
  // and with them every rng draw they made — which is why this commit's golden season diverges
  // from v2e's at week 1 rather than at the first purchase.
  const ps = emptyPlanetState(planet.id);
  ps.goods = rollGoodPrices(planet, rng);
  s.planet = ps;
  s.declarations = emptyDeclarations();
  s.locked = false;
  s.fields = null;
  s.races = null;
  s.done = [];

  // Turn order: −cargo ÷ 5 + d10, highest first (reversed at Blackreach).
  //
  // ⚠️ **There is no ship speed to buy any more (BUILD_PLAN_V3 §2.1), so turn order is bought with
  // an empty hold and nothing else** — which is exactly what GDD_V3 §2.3 asks for. §2.3 writes the
  // score as `20 − cargoUnits ÷ 5 + d10`; the constant 20 does not change any ordering, so it is
  // left out here rather than written in as a number that does nothing. Phase B puts it back when
  // the 50-unit hold makes the whole expression something the screen has to explain.
  const scored = s.players.map((p) => {
    const die = rng.int(1, balance.arrivalDie);
    const crates = cargoTotal(p.cargo);
    let score = -crates / balance.arrivalCargoDiv + die;
    let reason =
      crates > balance.fuelCargoFree
        ? 'heavy cargo'
        : die >= 8
          ? 'lucky approach'
          : 'steady approach';
    if (p.flags.arriveFirstNextWeek) {
      score += 1000;
      reason = 'wormhole shortcut';
      p.flags.arriveFirstNextWeek = false;
    }
    return { id: p.id, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  if (planet.special.turnOrderReversed) {
    scored.reverse();
    for (const x of scored) x.reason = 'black hole drags heavy ships in first';
  }
  s.turnOrder = scored.map((x) => x.id);
  s.turnOrderReason = Object.fromEntries(scored.map((x) => [x.id, x.reason]));
  log(s, `Week ${s.week}: ${planet.name}${entry.major ? ` — ${planet.event ?? 'Major'}` : ''}.`);

  // Planet arrival effects.
  for (const p of s.players) {
    const delta = planet.special.fitnessOnArrival ?? 0;
    if (delta) {
      for (const id of p.dogIds) {
        const d = s.dogs[id];
        if (d) d.fitness = clamp(d.fitness + delta, 0, 100);
      }
    }
  }

  s.phase = 'events';
  s.eventQueue = [...s.turnOrder];
  s.activePlayer = null;
  drawEvents(ctx);
}
