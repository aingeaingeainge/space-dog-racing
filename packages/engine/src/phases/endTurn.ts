import { balance } from '../content/balance';
import { kibbleAboard } from '../economy/goods';
import { bestFeedAboard, KIBBLE_ID } from '../content/goods';
import { netWorth } from '../economy/netWorth';
import { HEADLINE_TYPE_ID } from '../content/raceTypes';
import {
  emptyDeclarations,
  log,
  player,
  ranThisWeek,
  weeklyFitnessDelta,
  type Ctx,
} from '../state';
import { clamp } from '../rng';
import { STAT_KEYS, type Dog, type GameState, type GoodId, type Player } from '../types';

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/**
 * What one week's food does to one dog (GDD_V3 §6.3).
 *
 * ⚠️ **This was `trainOneWeek`, and the rename is the rule change (GDD_V3 V8).** A dog used to eat and
 * gain only on a Train week, which is why Train existed at all. Now **every dog eats one unit a week
 * whatever it is doing and gains that food's bonus** — so this runs for the whole yard, and Train had
 * nothing left to be.
 *
 * With one placeholder good there is no stat feed to find, so every dog takes the floor: +1–3 on a
 * random stat, which is v1's behaviour and the reason a stable that spends nothing still drifts
 * upward very slowly. **Phase B is where this gets interesting**: §6.3 gives each of the six foods its
 * own effect, three of them pointed at a stat and three broader ones that touch condition, and the
 * sticky per-dog diet (`Dog.trainStat`, which nothing reads yet) decides which one a dog takes.
 */
function feedOneWeek(ctx: Ctx, p: Player, d: Dog): void {
  const { rng, s } = ctx;
  const feed = bestFeedAboard(p.cargo, d.trainStat);
  if (feed) {
    p.cargo[feed.id]--;
    eaten(s, p, feed.id, 1);
    d[d.trainStat] = clamp(d[d.trainStat] + rng.int(feed.gainMin, feed.gainMax), 1, 99);
    log(s, `${d.name} ate ${feed.label}.`, p.id);
    return;
  }
  // The floor: the staple, on whichever stat it lands. The crate itself is charged with the week's
  // dinner, above, so there is nothing to deduct here.
  const staple = rng.int(balance.trainKibbleMin, balance.trainKibbleMax);
  const stat = rng.pick(STAT_KEYS);
  d[stat] = clamp(d[stat] + staple, 1, 99);
}

/**
 * Stat points a week, by age (GDD_V3 §4.3's growth column).
 *
 * A function rather than a table lookup because §4.3 bands rather than enumerates — ages 3 and 4 are
 * one band and 5, 6 and 7 are three rows that happen to share a number. Written as the bands so that
 * changing one of them is changing one line.
 */
function growthForAge(age: number): number {
  if (age <= 1) return balance.growthAge1Band;
  if (age === 2) return balance.growthAge2Band;
  if (age === 5) return -balance.declineAge5;
  if (age === 6) return -balance.declineAge6;
  if (age >= 7) return -balance.declineAge7;
  return 0;
}

/**
 * A crate out of the hold is a **running cost**, not a failed trade (GDD §7.2).
 *
 * `stats.tradeIncome` is sold minus bought, so a stable that bought a crate of Prime speed feed and
 * fed it to a dog used to look like a trader who had lost 900 Bones. §7.2 lists "feed eaten" among
 * the weekly costs and that is what it is: this moves the crate's value out of the trade column and
 * into costs at the moment it is consumed, valued at what it would have fetched here — which is
 * exactly the opportunity cost of eating it rather than selling it.
 *
 * Nothing about the game changes; two of the harness's columns stop lying. It is the same class of
 * fix as Phase B's gross road split, and for the same reason: you cannot balance three roads while
 * one of the numbers is measuring something else.
 */
function eaten(s: GameState, p: Player, id: GoodId, crates: number): void {
  const worth = crates * s.planet.goods[id].sell;
  p.stats.tradeIncome += worth;
  p.stats.costs += worth;
}

/** GDD §4.2 step 7: weekly costs, then each dog's chosen state resolves, then the jump. */
export function runEndTurn(ctx: Ctx): void {
  const { s, rng } = ctx;

  for (const p of s.players) {
    const dogs = ownDogs(s, p);

    // ---- Costs ----
    //
    // ⚠️ **Food is the only running cost left (GDD_V3 V10).** Upkeep, wages, fuel and loan interest
    // are all deleted (BUILD_PLAN_V3 §2.1), which is pillar 5 — nobody is out before the end — and
    // it is why GDD_V3 §6.3's empty-hold penalty has to be real when Phase B builds it: with
    // nothing else charged in the quiet weeks, food is the whole of what keeps money scarce.
    let costs = 0;

    let foodNeeded = 0;
    for (const d of dogs) {
      foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
      // ⚠️ **One crate a dog a week, full stop (GDD_V3 §6.3).** A Train week used to eat a second
      // crate on top of the dinner; there is no Train week, and §6.3 is explicit that a dog eats one
      // unit a week *whatever it is doing* and gains that food's bonus for it.
    }
    if (p.sponsorWeeks > 0) foodNeeded *= 2;
    // Dogs eat **the staple** (GDD §8.2). A stable that sailed without it buys at the local price
    // with the penalty on top — which is the ancestor of §6.3's empty-hold rule, and the reason
    // Phase B has somewhere to put it.
    const fromHold = Math.min(kibbleAboard(p.cargo), foodNeeded);
    p.cargo[KIBBLE_ID] -= fromHold;
    eaten(s, p, KIBBLE_ID, fromHold);
    const shortfall = foodNeeded - fromHold;
    if (shortfall > 0)
      costs += Math.round(shortfall * s.planet.goods[KIBBLE_ID].buy * balance.foodNoCargoPenalty);

    p.cash -= costs;
    p.stats.costs += costs;

    // Fan club money while the dog keeps winning.
    if (p.fanClubDogId) {
      const fan = s.dogs[p.fanClubDogId];
      const wonThisWeek = fan && s.races && s.races.some((r) => r.order[0] === fan.id);
      if (wonThisWeek) p.cash += 200;
      else delete p.fanClubDogId;
    }

    // ---- Each dog's week resolves (GDD_V3 §4.2, §4.3) ----
    //
    // ⚠️ **Every dog eats, every week, whatever it did (GDD_V3 §6.3, V8).** That is the rule that made
    // Train redundant, and it is why `feedOneWeek` runs for the whole yard rather than for the dogs
    // that chose to train. Race has already happened at race day; Rest and Layoff recover.
    const remaining = ownDogs(s, p);
    for (const d of remaining) {
      feedOneWeek(ctx, p, d);
      d.fitness = clamp(d.fitness + weeklyFitnessDelta(d, 0, ranThisWeek(s, d.id)), 0, 100);
      if (d.form > 0) d.form = Math.max(0, d.form - balance.formDecay);
      else if (d.form < 0) d.form = Math.min(0, d.form + balance.formDecay);
      if (d.injuryWeeks > 0) d.injuryWeeks--;
      // Bad blood: a diva sulks about every lesser kennel-mate.
      if (d.traits.includes('badBlood')) {
        const lesser = remaining.filter((o) => o.id !== d.id && o.rating < d.rating).length;
        d.form = clamp(d.form - 2 * lesser, -balance.formMax, balance.formMax);
      }
      // Growth and decline, every week and **banded by age** (GDD_V3 §4.3).
      //
      // ⚠️ **The band is flatter than v2's and that is the design.** v2 grew a pup at 2 points a week
      // to make raising one a real curve; §4.3's table is +1 at ages 1 and 2, nothing at 3–4, and −1
      // from 5 — because v3 has no pups to raise (no dog market) and age now matters across *seasons*
      // rather than inside one. Growth is **on top of** whatever the food gives (§4.3), so a young dog
      // fed well compounds and an old one fed well merely holds station, which is the shape that makes
      // Phase E's retirement window a decision.
      const effectiveAge = d.traits.includes('oldSoul') ? d.age - 1 : d.age;
      const growth = growthForAge(effectiveAge);
      for (let i = 0; i < Math.abs(growth); i++) {
        const stat = rng.pick(STAT_KEYS);
        d[stat] = clamp(d[stat] + Math.sign(growth), 1, 99);
      }
      if (s.week === balance.ageTickWeek && !d.traits.includes('oldSoul'))
        d.age = Math.min(7, d.age + 1);
    }
    if (p.sponsorWeeks > 0) p.sponsorWeeks--;
    p.stats.worthByWeek.push(netWorth(s, p));
  }

  // Sweep the locals; prune this week's tick logs into the archive.
  for (const d of Object.values(s.dogs)) {
    if (d.ownerId === 'local') delete s.dogs[d.id];
  }
  if (s.races) {
    for (const r of s.races) s.results.push({ ...r, ticks: [] });
  }
  s.races = null;
  s.fields = null;
  s.declarations = emptyDeclarations();
  s.locked = false;

  // ---- Jump ----
  if (s.week >= balance.weeks) {
    finishSeason(s);
    return;
  }
  s.week++;
  s.planet.planetId = s.calendar[s.week - 1]!.planetId;
  s.phase = 'arrival';
  s.activePlayer = null;
}

/** GDD §4.3: net worth decides it; tie-break is most Open wins, then most Majors. */
function finishSeason(s: GameState): void {
  const wonOpen = (r: (typeof s.results)[number], pid: string) =>
    r.race === HEADLINE_TYPE_ID && r.payouts.some((x) => x.place === 1 && x.playerId === pid);
  const openWins = (pid: string) => s.results.filter((r) => wonOpen(r, pid)).length;
  const majorsWon = (pid: string) =>
    s.results.filter((r) => s.calendar[r.week - 1]?.major && wonOpen(r, pid)).length;
  const standings = s.players
    .map((p) => ({
      playerId: p.id,
      netWorth: netWorth(s, p),
      open: openWins(p.id),
      majors: majorsWon(p.id),
    }))
    .sort((a, b) => b.netWorth - a.netWorth || b.open - a.open || b.majors - a.majors);
  s.finalStandings = standings.map(({ playerId, netWorth: nw }) => ({ playerId, netWorth: nw }));
  s.phase = 'seasonEnd';
  s.activePlayer = null;
  const champ = player(s, standings[0]!.playerId);
  log(s, `Season over: ${champ.name} wins with a stable worth ${standings[0]!.netWorth}.`);
}
