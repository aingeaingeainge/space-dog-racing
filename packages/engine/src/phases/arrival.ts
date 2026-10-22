import { balance } from '../content/balance';
import { planetOf } from '../content/planets';
import { emptyPlanetState } from '../economy/dogs';
import { rollGoodPrices } from '../economy/food';
import { shelfDepthFor } from '../economy/staff';
import { unitCargo } from '../economy/goods';
import { GOOD_IDS } from '../types';
import { startPlayerPhase } from './turn';
import { currentPlanet, emptyDeclarations, log, type Ctx } from '../state';
import { clamp } from '../rng';
import { seedExplore } from './explore';
import { followDeclarations } from './planet';
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

/** GDD §4.2 step 1: arrive, roll the planet, fill every stable's shelf, open the weekend. */
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
  // Nothing is declared yet, so every dog starts the week resting (Phase D2 item 5).
  followDeclarations(s);
  s.locked = false;
  s.fields = null;
  s.races = null;
  s.done = [];

  // ⚠️ **There is no turn order to roll** (Phase T, GDD_V3 T1 — Jesse's call). Until `v3t` this was
  // `20 − cargo ÷ 5 + d10`, highest first, reversed at Blackreach: first look at a shared shelf against
  // last look at the declarations. Everybody plays the weekend at once now, the shelf is every stable's
  // own and the declarations are sealed, so going first was worth nothing — and the roll's draws went
  // with it, which moves every draw after this point.
  //
  // Every stable's own shelf (T2): the posted depth, times the planet's multiplier (Blackreach), times
  // a Trade Advisor's deeper shelf. No draw.
  for (const p of s.players) {
    p.priceMult = unitCargo();
    for (const id of GOOD_IDS)
      p.shelf[id] = shelfDepthFor(p, ps.goods[id].stock, planet.special.shelfMult ?? 1);
  }
  log(s, `Week ${s.week}: ${planet.name}${entry.major ? ` — ${planet.event ?? 'Major'}` : ''}.`);

  // Planet arrival effects, and a stable's own landing (Phase T): a wormhole or a pilot's chart lands
  // its dogs rested, a fried navicomp lands them shaken — what used to be arriving first or last.
  for (const p of s.players) {
    const delta =
      (planet.special.fitnessOnArrival ?? 0) +
      (p.flags.freshNextWeek ? balance.freshArrivalFitness : 0) +
      (p.flags.rattledNextWeek ? balance.rattledArrivalFitness : 0);
    if (p.flags.freshNextWeek) log(s, 'The shortcut paid: your dogs land rested.', p.id);
    if (p.flags.rattledNextWeek) log(s, 'The navicomp held, just. Your dogs land shaken.', p.id);
    p.flags.freshNextWeek = false;
    p.flags.rattledNextWeek = false;
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
  // GDD_V3 §2.3 step 2: Explore, each stable on its own stream (decision D1) — and since Phase T, the
  // first thing in a weekend every stable plays at once (T1).
  seedExplore(ctx);
  s.pendingEvents = {};
  startPlayerPhase(s, 'planetPre');
}
