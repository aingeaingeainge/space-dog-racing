import { balance } from '../content/balance';
import { dogSalePrice, dogValue } from '../economy/dogValue';
import { fuelCost } from '../economy/food';
import { outstanding, weeklyInterest } from '../economy/loans';
import { netWorth } from '../economy/netWorth';
import { currentPlanet, log, player, type Ctx } from '../state';
import { clamp } from '../rng';
import { STAT_KEYS, type Dog, type GameState, type Player } from '../types';
import { mostValuableDog } from './raceDay';

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function removeDog(s: GameState, p: Player, d: Dog): void {
  p.dogIds = p.dogIds.filter((id) => id !== d.id);
  if (p.training?.dogId === d.id) delete p.training;
  if (p.fanClubDogId === d.id) delete p.fanClubDogId;
  delete s.dogs[d.id];
}

/** GDD §4.2 step 7: weekly costs, training, recovery, then jump. */
export function runEndTurn(ctx: Ctx): void {
  const { s, rng } = ctx;
  const planet = currentPlanet(s);
  const evenWeek = s.week % balance.growthEveryWeeks === 0;

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
    for (const d of dogs)
      foodNeeded += d.traits.includes('glutton') ? 2 * balance.foodPerDog : balance.foodPerDog;
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
      const wonThisWeek =
        fan && s.races && Object.values(s.races).some((r) => r.order[0] === fan.id);
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

    // ---- Training and recovery ----
    const remaining = ownDogs(s, p);
    if (p.staff.trainer && p.training) {
      const d = s.dogs[p.training.dogId];
      if (d) {
        const gristle = p.staff.trainer.name === 'Gristle McGraw';
        const gain = balance.trainerStatPerWeek + (gristle ? 1 : 0);
        d[p.training.stat] = clamp(d[p.training.stat] + gain, 1, 99);
        if (gristle && rng.chance(0.05)) {
          const victim = rng.pick(dogs);
          if (!victim.traits.includes('nervy')) {
            victim.traits.push('nervy');
            log(s, `Gristle McGraw's methods have made ${victim.name} Nervy.`, p.id);
          }
        }
      }
    }
    for (const d of remaining) {
      let recover = p.staff.vet ? balance.fitnessRecoveryVet : balance.fitnessRecovery;
      if (d.traits.includes('bouncesBack')) recover += 5;
      d.fitness = clamp(d.fitness + recover, 0, 100);
      if (d.form > 0) d.form = Math.max(0, d.form - balance.formDecay);
      else if (d.form < 0) d.form = Math.min(0, d.form + balance.formDecay);
      if (d.injuryWeeks > 0) d.injuryWeeks--;
      if (d.banWeeks > 0) d.banWeeks--;
      // Bad blood: a diva sulks about every lesser kennel-mate.
      if (d.traits.includes('badBlood')) {
        const lesser = remaining.filter((o) => o.id !== d.id && o.rating < d.rating).length;
        d.form = clamp(d.form - 2 * lesser, -balance.formMax, balance.formMax);
      }
      // Growth and decline every second week.
      if (evenWeek) {
        const effectiveAge = d.traits.includes('oldSoul') ? d.age - 1 : d.age;
        if (effectiveAge <= balance.growthMaxAge) {
          const stat = rng.pick(STAT_KEYS);
          d[stat] = clamp(d[stat] + 1, 1, 99);
        } else if (effectiveAge >= balance.declineMinAge) {
          const stat = rng.pick(STAT_KEYS);
          d[stat] = clamp(d[stat] - 1, 1, 99);
        }
      }
      if (s.week === balance.ageTickWeek && !d.traits.includes('oldSoul'))
        d.age = Math.min(7, d.age + 1);
    }
    if (p.sponsorWeeks > 0) p.sponsorWeeks--;
    p.stats.worthByWeek.push(netWorth(s, p));
  }

  // Sweep locals and unsold market dogs; prune this week's tick logs into the archive.
  for (const d of Object.values(s.dogs)) {
    if (d.ownerId === 'local' || d.ownerId === 'market') delete s.dogs[d.id];
  }
  if (s.races) {
    for (const r of Object.values(s.races)) s.results.push({ ...r, ticks: [] });
  }
  s.races = null;
  s.fields = null;
  s.declarations = { bronze: {}, silver: {}, gold: {} };
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

function finishSeason(s: GameState): void {
  const wonGold = (r: (typeof s.results)[number], pid: string) =>
    r.cls === 'gold' && r.payouts.some((x) => x.place === 1 && x.playerId === pid);
  const goldWins = (pid: string) => s.results.filter((r) => wonGold(r, pid)).length;
  const majorsWon = (pid: string) =>
    s.results.filter((r) => s.calendar[r.week - 1]?.major && wonGold(r, pid)).length;
  const standings = s.players
    .map((p) => ({
      playerId: p.id,
      netWorth: netWorth(s, p),
      gold: goldWins(p.id),
      majors: majorsWon(p.id),
    }))
    .sort((a, b) => b.netWorth - a.netWorth || b.gold - a.gold || b.majors - a.majors);
  s.finalStandings = standings.map(({ playerId, netWorth: nw }) => ({ playerId, netWorth: nw }));
  s.phase = 'seasonEnd';
  s.activePlayer = null;
  const champ = player(s, standings[0]!.playerId);
  log(s, `Season over: ${champ.name} wins with a stable worth ${standings[0]!.netWorth}.`);
}
