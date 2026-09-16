import { balance } from '../content/balance';
import { kibbleAboard } from '../economy/goods';
import { bestFeedAboard, KIBBLE_ID } from '../content/goods';
import { netWorth } from '../economy/netWorth';
import { OPEN_TYPE_ID } from '../content/raceTypes';
import {
  emptyDeclarations,
  log,
  player,
  placeThisWeek,
  ranThisWeek,
  weeklyFitnessDelta,
  weekStatusOf,
  type Ctx,
} from '../state';
import { clamp } from '../rng';
import { STAT_KEYS, type Dog, type GameState, type GoodId, type Player } from '../types';

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

/**
 * One Train week, and what the dog ate (GDD §5.7, §8.2, §8.3).
 *
 * **A Train week eats one crate.** If the hold carries a feed for the stat this dog is on, it eats
 * the *best* one it has and gains that feed's band on **that stat** — Rough +1–3, Proper +2–4,
 * Prime +4–6. With no such feed aboard it eats a crate of kibble and gains the floor, +1–3, on a
 * **random** stat: v1's behaviour exactly, and the reason a stable that spends nothing still drifts
 * upward very slowly. With nothing at all aboard the crate is bought at the local price with the
 * no-kibble penalty on top, like any other missed dinner.
 *
 * **Why the best feed rather than a chosen one.** A player who bought Prime speed feed bought it to
 * be eaten; asking them *which week* as well would cost a click per dog per week against a budget
 * with half a click left in it (GDD §8.5, D10). What the player controls is what is in the hold and
 * which stat the dog is on — two decisions that already have screens — and the consequence is that
 * Prime feed disappears fast, which is §8.1's consumable guard working rather than failing.
 *
 * ⚠️ **The trainer's points are gone with the staff ladder (BUILD_PLAN_V3 §2.1).** Phase D brings
 * staff back as two trainers on commission (GDD_V3 §8), whose bonuses land here again.
 */
function trainOneWeek(ctx: Ctx, p: Player, d: Dog): void {
  const { rng, s } = ctx;
  const feed = bestFeedAboard(p.cargo, d.trainStat);
  if (feed) {
    p.cargo[feed.id]--;
    eaten(s, p, feed.id, 1);
    d[d.trainStat] = clamp(d[d.trainStat] + rng.int(feed.gainMin, feed.gainMax), 1, 99);
    log(s, `${d.name} trained on ${feed.label}.`, p.id);
    return;
  }
  // The floor: plain kibble, on whichever stat it lands. The crate itself is charged with the
  // week's dinner, above, so there is nothing to deduct here.
  const kibble = rng.int(balance.trainKibbleMin, balance.trainKibbleMax);
  const stat = rng.pick(STAT_KEYS);
  d[stat] = clamp(d[stat] + kibble, 1, 99);
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
      // GDD §5.7: a Train week eats a crate on top of the week's dinner. That crate is a *feed*
      // if the hold has one for the stat this dog is on — `trainOneWeek` takes it below — and
      // kibble otherwise, which is what this counts.
      if (weekStatusOf(d) === 'train' && !bestFeedAboard(p.cargo, d.trainStat))
        foodNeeded += balance.foodPerDog;
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

    // ---- Each dog's week resolves (GDD §5.7) ----
    // Race has already happened at race day; Train works and eats; Rest and Layoff recover.
    const remaining = ownDogs(s, p);
    for (const d of remaining) {
      if (weekStatusOf(d) === 'train') trainOneWeek(ctx, p, d);
      // GDD §6.3: the Consolation's entry criterion, stored on the dog rather than looked up, so
      // a local generated for the race can carry the same fact. A run out of the money refills the
      // counter; every other week counts it down, so it expires on its own after `consolationReach`
      // weekends without anything having to remember when it was set.
      const place = placeThisWeek(s, d.id);
      d.outOfMoneyFor =
        place !== null && place > 3 ? balance.consolationReach : Math.max(0, d.outOfMoneyFor - 1);
      d.fitness = clamp(d.fitness + weeklyFitnessDelta(d, 0, ranThisWeek(s, d.id)), 0, 100);
      if (d.form > 0) d.form = Math.max(0, d.form - balance.formDecay);
      else if (d.form < 0) d.form = Math.min(0, d.form + balance.formDecay);
      if (d.injuryWeeks > 0) d.injuryWeeks--;
      // Bad blood: a diva sulks about every lesser kennel-mate.
      if (d.traits.includes('badBlood')) {
        const lesser = remaining.filter((o) => o.id !== d.id && o.rating < d.rating).length;
        d.form = clamp(d.form - 2 * lesser, -balance.formMax, balance.formMax);
      }
      // Growth and decline, every week and by age (GDD §5.6 / D14). v1 ticked one point every
      // second week for anything under 3, which is a rounding error over a season; a pup now
      // compounds at 2 a week, which is what makes raising one a real curve.
      const effectiveAge = d.traits.includes('oldSoul') ? d.age - 1 : d.age;
      const growth =
        effectiveAge <= 1
          ? balance.growthAge1
          : effectiveAge === 2
            ? balance.growthAge2
            : effectiveAge >= balance.declineMinAge
              ? -balance.declinePerWeek
              : 0;
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
    r.race === OPEN_TYPE_ID && r.payouts.some((x) => x.place === 1 && x.playerId === pid);
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
