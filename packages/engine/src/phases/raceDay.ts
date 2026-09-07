import { balance } from '../content/balance';
import { pow10 } from '../determinism';
import { createLocalDog } from '../economy/market';
import { dogValue } from '../economy/dogValue';
import { decimalOdds, placeProbabilities, winProbabilities } from '../race/odds';
import { simulateRace, type Runner } from '../race/simulateRace';
import {
  bettingMargin,
  calendarEntry,
  currentPlanet,
  dog,
  dopingCatchRate,
  log,
  player,
  purseFor,
  type Ctx,
} from '../state';
import { clamp, fork } from '../rng';
import {
  RACE_CLASSES,
  type Dog,
  type GameState,
  type Id,
  type RaceClass,
  type RaceEntry,
  type RaceResult,
} from '../types';
import { bettingOpen, startPlayerPhase } from './turn';

/** GDD §4.2 step 4: fill traps with locals, draw traps, open the bookie. */
export function lockDeclarations(ctx: Ctx): void {
  const { s, rng } = ctx;
  const planet = currentPlanet(s);
  const major = calendarEntry(s).major;
  const fields = { bronze: [], silver: [], gold: [] } as Record<RaceClass, RaceEntry[]>;
  const margin = bettingMargin(s);
  const tipsters = s.players.filter((p) => p.flags.tipOff);
  const lazyClass = tipsters.length ? rng.pick(RACE_CLASSES) : null;

  for (const cls of RACE_CLASSES) {
    const runners: Dog[] = [];
    for (const pid of s.turnOrder) {
      const dogId = s.declarations[cls][pid];
      if (dogId && s.dogs[dogId]) runners.push(s.dogs[dogId]!);
    }
    while (runners.length < balance.traps) {
      const local = createLocalDog(cls, major, !!planet.special.localsNervy, rng, ctx.nextId);
      s.dogs[local.id] = local;
      runners.push(local);
    }
    // Tip-off: one local in a random class is "not trying".
    if (cls === lazyClass) {
      const locals = runners.filter((d) => d.ownerId === 'local');
      if (locals.length) {
        const lazy = rng.pick(locals);
        lazy.fitness = 40;
        for (const p of tipsters) log(s, `Tip-off: ${lazy.name} in ${cls} is not trying.`, p.id);
      }
    }

    // Trap draw: shuffle, then honour wide runners (outside) and the dodgy steward.
    const draw = rng.shuffle([...runners]);
    const wide = draw.filter((d) => d.traits.includes('wideRunner'));
    const rest = draw.filter((d) => !d.traits.includes('wideRunner'));
    let ordered = [...rest, ...wide];
    if (cls === 'gold') {
      for (const briber of s.players.filter((p) => p.flags.rivalTrap8)) {
        const rivals = ordered.filter((d) => d.ownerId !== briber.id && d.ownerId !== 'local');
        const target = rivals.sort((a, b) => b.rating - a.rating)[0];
        if (target) ordered = [...ordered.filter((d) => d !== target), target];
      }
    }

    const ratings = ordered.map((d) => d.rating);
    const winP = winProbabilities(ratings);
    const placeP = placeProbabilities(ratings);
    fields[cls] = ordered.map((d, i) => ({
      trap: i + 1,
      dogId: d.id,
      ownerId: d.ownerId === 'market' ? 'local' : d.ownerId,
      name: d.name,
      rating: d.rating,
      odds: decimalOdds(winP[i]!, margin),
      winProb: winP[i]!,
      placeProb: placeP[i]!,
      local: d.ownerId === 'local',
    }));
  }
  s.fields = fields;
  s.locked = true;
  if (bettingOpen(s)) startPlayerPhase(s, 'betting');
  else s.phase = 'race';
}

function runnerFrom(d: Dog, trap: number): Runner {
  return {
    id: d.id,
    trap,
    speed: d.speed,
    accel: d.accel,
    stamina: d.stamina,
    trapStat: d.trap,
    fitness: d.fitness,
    form: d.form,
    traits: d.traits,
    speedBonus: d.raceBonus,
  };
}

/** GDD §5.3 Elo-style update; returns the rating delta applied. */
function applyRaceOutcome(s: GameState, d: Dog, place: number, field: Dog[]): number {
  const n = field.length;
  const avg = field.reduce((sum, x) => sum + x.rating, 0) / n;
  // pow10, not Math.pow: this feeds the stored rating, so it has to be engine-independent.
  const odds = pow10((d.rating - avg) / balance.eloScale);
  const expected = 1 + (n - 1) * (1 / (1 + odds));
  const rawDelta = (expected - place) * balance.ratingK;
  const delta = Math.round(rawDelta);
  d.rating = clamp(d.rating + delta, 5, 99);
  const formSwing = d.traits.includes('primaDonna') ? 2 : 1;
  d.form = clamp(
    Math.round(d.form + (expected - place) * formSwing),
    -balance.formMax,
    balance.formMax,
  );
  d.fitness = clamp(d.fitness - balance.fitnessPerRace, 0, 100);
  d.runs++;
  if (place === 1) d.wins++;
  return delta;
}

function rollInjury(ctx: Ctx, d: Dog, hazard: number, hasVet: boolean): number {
  let p = balance.injuryBase * hazard;
  if (d.fitness < balance.injuryLowFitnessBelow) p *= balance.injuryLowFitnessMult;
  if (d.traits.includes('fragile')) p *= 2;
  if (d.traits.includes('iron')) p *= 0.5;
  if (!ctx.rng.chance(p)) return 0;
  let weeks = ctx.rng.int(balance.injuryWeeksMin, balance.injuryWeeksMax);
  if (hasVet) weeks = Math.max(1, Math.floor(weeks / 2));
  return weeks;
}

/** GDD §4.2 step 5: run Bronze, Silver, Gold; pay out; update dogs; settle bets. */
export function runRaces(ctx: Ctx): void {
  const { s } = ctx;
  if (!s.fields) throw new Error('Declarations were never locked');
  const planet = currentPlanet(s);
  const entry = calendarEntry(s);
  const races = {} as Record<RaceClass, RaceResult>;

  for (const cls of RACE_CLASSES) {
    const field = s.fields[cls];
    const dogs = field.map((e) => dog(s, e.dogId));
    const runners = field.map((e, i) => runnerFrom(dogs[i]!, e.trap));
    const sim = simulateRace(runners, { track: planet.track, major: entry.major }, fork(ctx.rng));
    const purse = purseFor(s, cls);
    const result: RaceResult = {
      week: s.week,
      planetId: planet.id,
      cls,
      purse,
      entries: field,
      order: sim.order,
      finishTicks: sim.finishTicks,
      margin: Math.round(sim.margin * 100) / 100,
      photoFinish: sim.photoFinish,
      ticks: sim.ticks,
      events: sim.events,
      ratingDeltas: {},
      injuries: {},
      payouts: [],
      dopingCaught: [],
    };

    // Stewards: supplements may be caught before the purse is paid (never on Vatgrown).
    const catchRate = dopingCatchRate(s);
    for (const d of dogs) {
      if (d.supplemented && d.ownerId !== 'local' && ctx.rng.chance(catchRate)) {
        result.dopingCaught.push(d.id);
        const owner = player(s, d.ownerId);
        owner.flags.caughtDoping = true;
        owner.stats.supplementsCaught++;
        d.rating = clamp(d.rating - balance.supplementRatingPenalty, 5, 99);
        d.banWeeks = balance.supplementBanWeeks;
        log(
          s,
          `Stewards catch ${d.name} doped: purse forfeited, rating −${balance.supplementRatingPenalty}, banned ${balance.supplementBanWeeks} week.`,
          owner.id,
        );
      }
    }

    sim.order.forEach((dogId, idx) => {
      const place = idx + 1;
      const d = dog(s, dogId);
      const delta = applyRaceOutcome(s, d, place, dogs);
      result.ratingDeltas[dogId] = delta;
      if (cls === 'gold' && place === 1) d.goldWins++;
      if (d.ownerId !== 'local' && d.ownerId !== 'market') {
        const owner = player(s, d.ownerId);
        const weeks = rollInjury(ctx, d, planet.track.hazard, !!owner.staff.vet);
        if (weeks) {
          d.injuryWeeks = weeks;
          result.injuries[dogId] = weeks;
          log(
            s,
            `${d.name} pulled up injured — out for ${weeks} week${weeks > 1 ? 's' : ''}.`,
            owner.id,
          );
        }
        if (place <= 3 && !result.dopingCaught.includes(dogId)) {
          let amount = purse[place - 1]!;
          if (planet.special.winningsTax)
            amount = Math.round(amount * (1 - planet.special.winningsTax));
          owner.cash += amount;
          owner.stats.prizeIncome += amount;
          result.payouts.push({ playerId: owner.id, dogId, place, amount });
        }
      }
    });

    // Settle bets on this race.
    for (const bet of s.bets) {
      if (bet.week !== s.week || bet.cls !== cls || bet.settled) continue;
      const place = sim.order.indexOf(bet.dogId) + 1;
      const won = bet.kind === 'win' ? place === 1 : place >= 1 && place <= 3;
      const payout = won ? Math.round(bet.stake * bet.odds) : 0;
      bet.settled = { won, payout };
      if (payout) {
        const p = player(s, bet.playerId);
        p.cash += payout;
        p.stats.betIncome += payout;
      }
    }

    const winner = dog(s, sim.order[0]!);
    log(
      s,
      `${cls[0]!.toUpperCase()}${cls.slice(1)}: ${winner.name} wins${sim.photoFinish ? ' in a photo finish' : ''} (${result.margin} m).`,
    );
    races[cls] = result;
  }

  // Clear race-day buffs.
  for (const d of Object.values(s.dogs)) {
    d.raceBonus = 0;
    d.supplemented = false;
  }
  for (const p of s.players) {
    p.flags.rivalTrap8 = false;
    p.flags.tipOff = false;
  }
  s.races = races;
  startPlayerPhase(s, 'planetPost');
}

/** Highest-value dog a player owns, if any. */
export function mostValuableDog(s: GameState, playerId: Id): Dog | undefined {
  return player(s, playerId)
    .dogIds.map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d)
    .sort((a, b) => dogValue(b) - dogValue(a))[0];
}
