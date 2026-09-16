import { balance } from '../content/balance';
import { OPEN_TYPE_ID, raceType } from '../content/raceTypes';
import { pow10 } from '../determinism';
import { createLocalDog } from '../economy/dogs';
import { dogValue } from '../economy/dogValue';
import { decimalOdds, placeProbabilities, winProbabilities } from '../race/odds';
import { simulateRace, type Runner } from '../race/simulateRace';
import {
  bettingMargin,
  calendarEntry,
  championshipTable,
  currentPlanet,
  dog,
  log,
  player,
  purseFor,
  thisWeeksCard,
  type Ctx,
} from '../state';
import { clamp, fork } from '../rng';
import type { Dog, GameState, Id, RaceField, RaceResult } from '../types';
import { bettingOpen, startPlayerPhase } from './turn';

/** GDD §4.2 step 4: fill traps with locals, draw traps, open the bookie. */
export function lockDeclarations(ctx: Ctx): void {
  const { s, rng } = ctx;
  const planet = currentPlanet(s);
  const major = calendarEntry(s).major;
  const card = thisWeeksCard(s);
  const fields: RaceField[] = [];
  const margin = bettingMargin(s);
  const tipsters = s.players.filter((p) => p.flags.tipOff);
  const lazyRace = tipsters.length ? rng.pick(card) : null;

  for (const race of card) {
    const runners: Dog[] = [];
    for (const pid of s.turnOrder) {
      const dogId = s.declarations[race][pid];
      if (dogId && s.dogs[dogId]) runners.push(s.dogs[dogId]!);
    }
    while (runners.length < balance.traps) {
      const local = createLocalDog(race, major, !!planet.special.localsNervy, rng, ctx.nextId);
      s.dogs[local.id] = local;
      runners.push(local);
    }
    // Tip-off: one local in a random race on the card is "not trying".
    if (race === lazyRace) {
      const locals = runners.filter((d) => d.ownerId === 'local');
      if (locals.length) {
        const lazy = rng.pick(locals);
        lazy.fitness = 40;
        for (const p of tipsters)
          log(s, `Tip-off: ${lazy.name} in the ${raceType(race).label} is not trying.`, p.id);
      }
    }

    // Trap draw: shuffle, then honour wide runners (outside).
    //
    // ⚠️ The dodgy steward and the bought box are gone with the crook's road (BUILD_PLAN_V3 §2.1).
    // GDD_V3 §9.3 brings the bought box back as a Back Alley event in Phase D; the draw itself is
    // untouched and stays the place it would be applied.
    const draw = rng.shuffle([...runners]);
    const wide = draw.filter((d) => d.traits.includes('wideRunner'));
    const rest = draw.filter((d) => !d.traits.includes('wideRunner'));
    const ordered = [...rest, ...wide];
    const ratings = ordered.map((d) => d.rating);
    const winP = winProbabilities(ratings);
    const placeP = placeProbabilities(ratings);
    fields.push({
      race,
      entries: ordered.map((d, i) => ({
        trap: i + 1,
        dogId: d.id,
        ownerId: d.ownerId === 'market' ? 'local' : d.ownerId,
        name: d.name,
        rating: d.rating,
        odds: decimalOdds(winP[i]!, margin),
        winProb: winP[i]!,
        placeProb: placeP[i]!,
        local: d.ownerId === 'local',
      })),
    });
  }
  s.fields = fields;
  s.locked = true;
  if (bettingOpen(s)) startPlayerPhase(s, 'betting');
  else s.phase = 'race';
}

/**
 * The dog as the race sees it, which is not quite the dog as the card sees it.
 *
 * `fitness` is where §13 lands: a nobbled dog runs on `fitness − nobbled` while every screen, every
 * rival and the whole betting market go on reading `fitness`. That divergence is not a bug to be
 * tidied up later — it is the crook's road, and the only reason betting is a road at all (§2.1).
 */
function runnerFrom(d: Dog, trap: number): Runner {
  return {
    id: d.id,
    trap,
    speed: d.speed,
    accel: d.accel,
    stamina: d.stamina,
    fitness: Math.max(0, d.fitness),
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

/**
 * Did this dog pull up, and for how long (GDD §5.5, GDD_V3 §4.4).
 *
 * ⚠️ **The vet is gone with the staff ladder (BUILD_PLAN_V3 §2.1)**, so nothing shortens a layoff
 * any more. GDD_V3 §4.4 flags this as something to watch: with three dogs and no market, losing one
 * for three weeks is a third of a stable for a third of a season, and the guards it names — the free
 * local runner and an Explore door that shortens a layoff — both arrive in Phase D. Until then the
 * base rate is the only dial, and §4.4 says so.
 */
function rollInjury(ctx: Ctx, d: Dog, hazard: number): number {
  let p = balance.injuryBase * hazard;
  if (d.fitness < balance.injuryLowFitnessBelow) p *= balance.injuryLowFitnessMult;
  if (d.traits.includes('fragile')) p *= 2;
  if (d.traits.includes('iron')) p *= 0.5;
  if (!ctx.rng.chance(p)) return 0;
  return ctx.rng.int(balance.injuryWeeksMin, balance.injuryWeeksMax);
}

/**
 * The championship purse (GDD §4.3, D3). Paid once, at the Galactic Collar, after the last race of
 * the season has been run and counted.
 *
 * ⚠️ **A purse, not a scoreboard, and D3 is emphatic about why:** net worth is the only condition
 * under which all three roads compete, so a points table as the win condition would delete two
 * thirds of the design. It rewards racing breadth, which is the trainer's road alone, so it is
 * deliberately modest — about 6% of a champion's end worth. It is paid as prize money because that
 * is what it is.
 *
 * ⚠️ **And it is the latest-paying thing in the game**, which is a real cost to watch: Q12 asks why
 * the season is decided at week 6.6, and a purse that lands in week 13 is the one shape that could
 * move it. Measured rather than hoped — see the phase notes.
 */
function payChampionship(ctx: Ctx): void {
  const { s } = ctx;
  const purse = [balance.champPurse1, balance.champPurse2, balance.champPurse3];
  const table = championshipTable(s);
  table.slice(0, purse.length).forEach((row, i) => {
    const amount = purse[i]!;
    if (row.points <= 0 || amount <= 0) return;
    const p = player(s, row.playerId);
    p.cash += amount;
    p.stats.prizeIncome += amount;
    log(
      s,
      `The championship: ${p.name} finishes ${i + 1}${['st', 'nd', 'rd'][i]} on ${row.points} points and takes ${amount}.`,
    );
  });
}

/** GDD §4.2 step 5: run the card in order; pay out; update dogs; settle bets. */
export function runRaces(ctx: Ctx): void {
  const { s } = ctx;
  if (!s.fields) throw new Error('Declarations were never locked');
  const planet = currentPlanet(s);
  const entry = calendarEntry(s);
  const races: RaceResult[] = [];

  for (const { race, entries: field } of s.fields) {
    const dogs = field.map((e) => dog(s, e.dogId));
    const runners = field.map((e, i) => runnerFrom(dogs[i]!, e.trap));
    const sim = simulateRace(runners, { track: planet.track, major: entry.major }, fork(ctx.rng));
    const purse = purseFor(s, race);
    const result: RaceResult = {
      week: s.week,
      planetId: planet.id,
      race,
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
    };

    sim.order.forEach((dogId, idx) => {
      const place = idx + 1;
      const d = dog(s, dogId);
      const delta = applyRaceOutcome(s, d, place, dogs);
      result.ratingDeltas[dogId] = delta;
      if (race === OPEN_TYPE_ID && place === 1) d.openWins++;
      if (d.ownerId !== 'local') {
        const owner = player(s, d.ownerId);
        const weeks = rollInjury(ctx, d, planet.track.hazard);
        if (weeks) {
          d.injuryWeeks = weeks;
          result.injuries[dogId] = weeks;
          log(
            s,
            `${d.name} pulled up injured — out for ${weeks} week${weeks > 1 ? 's' : ''}.`,
            owner.id,
          );
        }
        if (place <= 3) {
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
      if (bet.week !== s.week || bet.race !== race || bet.settled) continue;
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
      `${raceType(race).label}: ${winner.name} wins${sim.photoFinish ? ' in a photo finish' : ''} (${result.margin} m).`,
    );
    races.push(result);
  }

  // The archive first, then the purse that is counted off it. `championshipPoints` reads
  // `s.results` plus `s.races`, so publishing this week's card before paying is what makes the
  // Grand Final's own three races count toward the championship they decide.
  s.races = races;

  // GDD §4.3: the championship purse, once, after the last card of the season.
  if (entry.grandFinal) payChampionship(ctx);

  // Clear race-day buffs.
  for (const d of Object.values(s.dogs)) d.raceBonus = 0;
  for (const p of s.players) p.flags.tipOff = false;
  startPlayerPhase(s, 'planetPost');
}

/** Highest-value dog a player owns, if any. */
export function mostValuableDog(s: GameState, playerId: Id): Dog | undefined {
  return player(s, playerId)
    .dogIds.map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d)
    .sort((a, b) => dogValue(b) - dogValue(a))[0];
}
