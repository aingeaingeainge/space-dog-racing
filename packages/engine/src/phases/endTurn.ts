import { balance } from '../content/balance';
import { dogSalePrice, dogValue } from '../economy/dogValue';
import { fuelCost } from '../economy/food';
import { outstanding, weeklyInterest } from '../economy/loans';
import { netWorth } from '../economy/netWorth';
import { OPEN_TYPE_ID } from '../content/raceTypes';
import {
  currentPlanet,
  emptyDeclarations,
  log,
  player,
  ranThisWeek,
  weeklyFitnessDelta,
  weekStatusOf,
  type Ctx,
} from '../state';
import { clamp } from '../rng';
import { STAT_KEYS, type Dog, type GameState, type Player } from '../types';
import { mostValuableDog } from './raceDay';

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function removeDog(s: GameState, p: Player, d: Dog): void {
  p.dogIds = p.dogIds.filter((id) => id !== d.id);
  if (p.fanClubDogId === d.id) delete p.fanClubDogId;
  delete s.dogs[d.id];
}

/**
 * Stat points a dog gains from one Train week (GDD §5.7, §8.2, §8.3).
 *
 * Phase A's feed is a **placeholder**: plain kibble, +1–3 to a random stat, which GDD §8.2 calls
 * the floor of improvement and the reason a stable that spends nothing still drifts upward very
 * slowly. Phase C builds the four stat feeds × three tiers on top, and *that* is what aims the
 * points at the stat the player chose. Until then `trainStat` is carried on the Dog and only the
 * trainer's points land on it, so the choice is recorded and visible rather than ignored.
 */
function trainOneWeek(ctx: Ctx, p: Player, d: Dog): void {
  const { rng } = ctx;
  const trainer = p.staff.trainer;
  if (trainer) {
    const gristle = trainer.name === 'Gristle McGraw';
    const gain = balance.trainerStatPerWeek + (gristle ? 1 : 0);
    d[d.trainStat] = clamp(d[d.trainStat] + gain, 1, 99);
  }
  // Plain kibble: the floor, on whichever stat it lands.
  const kibble = rng.int(balance.trainKibbleMin, balance.trainKibbleMax);
  const stat = rng.pick(STAT_KEYS);
  d[stat] = clamp(d[stat] + kibble, 1, 99);
}

/** GDD §4.2 step 7: weekly costs, then each dog's chosen state resolves, then the jump. */
export function runEndTurn(ctx: Ctx): void {
  const { s, rng } = ctx;
  const planet = currentPlanet(s);

  for (const p of s.players) {
    if (p.flags.bankrupt) continue;
    const dogs = ownDogs(s, p);

    // ---- Costs ----
    let costs = 0;
    if (!planet.special.noUpkeep) {
      for (const d of dogs)
        costs += d.traits.includes('cheapDate') ? balance.upkeepPerDog / 2 : balance.upkeepPerDog;
    }
    if (p.staff.trainer) costs += balance.trainerWage;
    if (p.staff.vet) costs += balance.vetWage;
    if (p.staff.fixer) costs += 350;
    if (s.week < balance.weeks) costs += fuelCost(p.cargo);

    let foodNeeded = 0;
    for (const d of dogs) {
      foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
      // GDD §5.7: a Train week eats a unit of feed on top of the week's dinner. In Phase A the
      // feed is kibble out of the same hold, so training has a real running cost from day one.
      if (weekStatusOf(d) === 'train') foodNeeded += balance.foodPerDog;
    }
    if (p.sponsorWeeks > 0) foodNeeded *= 2;
    const fromHold = Math.min(p.cargo, foodNeeded);
    p.cargo -= fromHold;
    const shortfall = foodNeeded - fromHold;
    if (shortfall > 0)
      costs += Math.round(shortfall * s.planet.foodBuy * balance.foodNoCargoPenalty);

    const interest = weeklyInterest(p);
    costs += interest;
    p.cash -= costs;
    p.stats.costs += costs;

    // Fan club money while the dog keeps winning.
    if (p.fanClubDogId) {
      const fan = s.dogs[p.fanClubDogId];
      const wonThisWeek = fan && s.races && s.races.some((r) => r.order[0] === fan.id);
      if (wonThisWeek) p.cash += 200;
      else delete p.fanClubDogId;
    }

    // Fat Tony covers any shortfall — on his terms. Only when even he says no do dogs get sold.
    if (p.cash < 0) {
      const room = balance.sharkMax - outstanding(p, 'shark');
      const take = Math.min(room, Math.ceil(-p.cash / 100) * 100);
      if (take > 0) {
        const existing = p.loans.find((l) => l.lender === 'shark');
        if (existing) existing.principal += take;
        else p.loans.push({ lender: 'shark', principal: take });
        p.cash += take;
        log(s, `Fat Tony Nebula covers your ${take} shortfall. He will want it back.`, p.id);
      }
    }
    // Fat Tony repossesses if you still cannot cover his interest.
    if (p.cash < 0 && p.loans.some((l) => l.lender === 'shark')) {
      const d = mostValuableDog(s, p.id);
      if (d) {
        removeDog(s, p, d);
        p.loans = p.loans.filter((l) => l.lender !== 'shark');
        log(s, `Fat Tony's boys repossess ${d.name} against your debt.`, p.id);
      }
    }

    // A stable that cannot pay its way sells its cheapest dogs; with no dogs left it is bust.
    while (p.cash < 0 && p.dogIds.length > 0) {
      const cheapest = ownDogs(s, p).sort((a, b) => dogValue(a) - dogValue(b))[0]!;
      const price = dogSalePrice(cheapest);
      removeDog(s, p, cheapest);
      p.cash += price;
      log(s, `Forced sale: ${cheapest.name} goes for ${price} to cover the bills.`, p.id);
    }
    if (p.cash < 0 && p.dogIds.length === 0) {
      p.flags.bankrupt = true;
      log(s, `${p.name} is bankrupt.`, p.id);
    }

    // ---- Each dog's week resolves (GDD §5.7) ----
    // Race has already happened at race day; Train works and eats; Rest and Layoff recover.
    const remaining = ownDogs(s, p);
    const trainedThisWeek: Dog[] = [];
    for (const d of remaining) {
      if (weekStatusOf(d) === 'train') {
        trainOneWeek(ctx, p, d);
        trainedThisWeek.push(d);
      }
      d.fitness = clamp(
        d.fitness + weeklyFitnessDelta(d, !!p.staff.vet, ranThisWeek(s, d.id)),
        0,
        100,
      );
      if (d.form > 0) d.form = Math.max(0, d.form - balance.formDecay);
      else if (d.form < 0) d.form = Math.min(0, d.form + balance.formDecay);
      if (d.injuryWeeks > 0) d.injuryWeeks--;
      if (d.banWeeks > 0) d.banWeeks--;
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
    // Gristle McGraw's methods, once a week rather than once a dog: the quirk is about the yard,
    // and rolling it per trainee would make hiring him worse the more dogs you put in his hands.
    if (p.staff.trainer?.name === 'Gristle McGraw' && trainedThisWeek.length && rng.chance(0.05)) {
      const victim = rng.pick(remaining);
      if (!victim.traits.includes('nervy')) {
        victim.traits.push('nervy');
        log(s, `Gristle McGraw's methods have made ${victim.name} Nervy.`, p.id);
      }
    }
    if (p.sponsorWeeks > 0) p.sponsorWeeks--;
    p.stats.worthByWeek.push(netWorth(s, p));
  }

  // Sweep locals and unsold market dogs; prune this week's tick logs into the archive.
  for (const d of Object.values(s.dogs)) {
    if (d.ownerId === 'local' || d.ownerId === 'market') delete s.dogs[d.id];
  }
  if (s.races) {
    for (const r of s.races) s.results.push({ ...r, ticks: [] });
  }
  s.races = null;
  s.fields = null;
  s.declarations = emptyDeclarations();
  s.locked = false;
  s.planet.marketDogIds = [];

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
