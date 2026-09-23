import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { emptyPlanetState } from '../economy/dogs';
import { rollGoodPrices } from '../economy/food';
import { cargoTotal, HOLD_CAP } from '../economy/goods';
import { currentPlanet, emptyDeclarations, log, type Ctx } from '../state';
import { clamp } from '../rng';
import { seedExplore } from './explore';
import { CONDITIONS } from '../content/conditions';

/** One draw per stable dog against the condition table (Phase D1 item 6). */
function drawConditions(ctx: Ctx): void {
  const { s, rng } = ctx;
  s.conditions = [];
  for (const p of s.players) {
    for (const id of p.dogIds) {
      let u = rng.next();
      for (const row of CONDITIONS) {
        if (u < row.chance) {
          s.conditions.push({ dogId: id, condition: row.id, tipped: [] });
          break;
        }
        u -= row.chance;
      }
    }
  }
}

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
  // ⚠️ **Rolled a week early since Phase D1** (GDD_V3 §9.4): a Bar card sells next week's band
  // position, so next week's prices have to exist now. Week 1 rolls its own and week 2's; every later
  // week rolls one — the next — and posts the one it was handed. The fog is who may *read* them.
  const next = s.calendar[s.week];
  ps.goods =
    s.nextPlanet && s.nextPlanet.planetId === planet.id
      ? s.nextPlanet.goods
      : rollGoodPrices(planet, rng);
  s.planet = ps;
  if (next) {
    const ahead = emptyPlanetState(next.planetId);
    ahead.goods = rollGoodPrices(planetOf(next.planetId), rng);
    s.nextPlanet = ahead;
  } else s.nextPlanet = null;
  s.declarations = emptyDeclarations();
  s.locked = false;
  s.fields = null;
  s.races = null;
  s.done = [];

  // Turn order: `20 − cargo ÷ 5 + d10`, highest first (reversed at Blackreach) — GDD_V3 §2.3.
  //
  // ⚠️ **There is no ship speed to buy any more (BUILD_PLAN_V3 §2.1), so turn order is bought with
  // an empty hold and nothing else**, and a stable that loads its hold to the roof goes last all
  // season — a trade the whole table can see it making, which is why the reason names the numbers.
  //
  // ⚠️ **The score is computed in whole numbers, scaled by the divisor**: `20×5 − crates + die×5`.
  // Phase A computed `−crates ÷ 5 + die` in floating point, and 0.2 is not a binary fraction, so two
  // stables on *exactly* the same score — 1 crate and a 1, 11 crates and a 3 — compared as 0.8
  // against 0.7999999999999998 and the tie went to whoever the rounding error favoured. Deterministic
  // (IEEE `+ − ÷` are exact per spec, so every engine agreed), but a tie decided by the last bit of a
  // double is not a rule anybody can read. Found in Phase B because putting the constant 20 back
  // moved the golden season when a constant added to every score cannot move an ordering: it moved
  // which ties the rounding broke. With the score exact, the constant is verifiably inert.
  //
  // **Ties go to the lighter hold**, then to the table's seating order. The lighter ship lands first
  // is the rule's own logic applied to the one case the arithmetic cannot separate.
  const div = balance.arrivalCargoDiv;
  const scored = s.players.map((p) => {
    const die = rng.int(1, balance.arrivalDie);
    const crates = cargoTotal(p.cargo);
    let score = balance.arrivalBase * div - crates + die * div;
    const sum =
      `${balance.arrivalBase} − ${crates} crate${crates === 1 ? '' : 's'} ÷ ${div} + ` +
      `${die} on the die = ${(score / div).toFixed(1)}`;
    let reason = crates > HOLD_CAP / 2 ? `heavy hold: ${sum}` : sum;
    if (p.flags.arriveFirstNextWeek) {
      score += 1000 * div;
      reason = 'wormhole shortcut — first, whatever the score';
      p.flags.arriveFirstNextWeek = false;
    } else if (p.flags.arriveLastNextWeek) {
      score -= 1000 * div;
      reason = 'a fried navicomp — last, whatever the score';
    }
    p.flags.arriveLastNextWeek = false;
    return { id: p.id, score, crates, reason };
  });
  scored.sort((a, b) => b.score - a.score || a.crates - b.crates);
  if (planet.special.turnOrderReversed) {
    scored.reverse();
    for (const x of scored)
      if (!x.reason.startsWith('wormhole') && !x.reason.startsWith('a fried'))
        x.reason = `the black hole drags the heaviest in first — ${x.reason}`;
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

  // Race-day conditions (Phase D1 item 6), before anybody explores: one draw per stable dog, in
  // seating order, whatever it lands on — so the stream never depends on what was drawn, and the
  // conditions exist before any tip can be about them.
  drawConditions(ctx);
  // GDD_V3 §2.3 step 2: Explore, in turn order, each stable on its own stream (decision D1).
  seedExplore(ctx);
  s.phase = 'explore';
  s.pendingEvent = null;
  s.activePlayer = s.turnOrder[0] ?? null;
}
