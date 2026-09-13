import { balance } from '../content/balance';
import { bestStaff, vetInjuryRelief } from '../economy/staff';
type VetRelief = ReturnType<typeof vetInjuryRelief>;
import { OPEN_TYPE_ID, raceType } from '../content/raceTypes';
import { pow10 } from '../determinism';
import { createLocalDog } from '../economy/market';
import { dogValue } from '../economy/dogValue';
import { decimalOdds, placeProbabilities, winProbabilities } from '../race/odds';
import { simulateRace, type Runner } from '../race/simulateRace';
import {
  bettingMargin,
  calendarEntry,
  championshipTable,
  currentPlanet,
  dog,
  dopingCatchRate,
  fixCatchRate,
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

    // Trap draw: shuffle, then honour wide runners (outside), the dodgy steward, and anybody who
    // has had a word with a real one (GDD §13).
    const draw = rng.shuffle([...runners]);
    const wide = draw.filter((d) => d.traits.includes('wideRunner'));
    const rest = draw.filter((d) => !d.traits.includes('wideRunner'));
    let ordered = [...rest, ...wide];
    if (race === OPEN_TYPE_ID) {
      for (const briber of s.players.filter((p) => p.flags.rivalTrap8)) {
        const rivals = ordered.filter((d) => d.ownerId !== briber.id && d.ownerId !== 'local');
        const target = rivals.sort((a, b) => b.rating - a.rating)[0];
        if (target) ordered = [...ordered.filter((d) => d !== target), target];
      }
    }
    // A bought box (§13). Applied **last**, after the draw and after the two existing rules that
    // move dogs about, because a bribe that a later rule could undo would be a fee for nothing —
    // the same mistake §8.4 is the standing example of. Swapped rather than inserted, so the field
    // stays a permutation of the boxes and `properties.test.ts`'s "a runner's trap is its position"
    // holds at every instant.
    for (const fix of s.fixes) {
      if (fix.kind !== 'bribe' || fix.week !== s.week || fix.race !== race || !fix.trap) continue;
      const from = ordered.findIndex((d) => d.id === fix.dogId);
      const to = fix.trap - 1;
      if (from < 0 || to < 0 || to >= ordered.length || from === to) continue;
      const swap = ordered[to]!;
      ordered[to] = ordered[from]!;
      ordered[from] = swap;
    }

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
    trapStat: d.trap,
    fitness: Math.max(0, d.fitness - d.nobbled),
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
 * Did this dog pull up, and for how long (GDD §5.5, §8.3).
 *
 * The vet's three tiers do three different things, and this is where two of them land: a **Prime**
 * vet cuts the chance of an injury happening at all, a **Proper or Prime** vet halves the weeks,
 * and a **Rough** vet takes a week off the end instead. So the cheap vet is worth having and is
 * plainly worse than the dear one, which is what a ladder is for.
 */
function rollInjury(ctx: Ctx, d: Dog, hazard: number, relief: VetRelief): number {
  let p = balance.injuryBase * hazard * (1 - relief.chanceCut);
  if (d.fitness < balance.injuryLowFitnessBelow) p *= balance.injuryLowFitnessMult;
  if (d.traits.includes('fragile')) p *= 2;
  if (d.traits.includes('iron')) p *= 0.5;
  if (!ctx.rng.chance(p)) return 0;
  let weeks = ctx.rng.int(balance.injuryWeeksMin, balance.injuryWeeksMax);
  if (relief.halve) weeks = Math.max(1, Math.floor(weeks / 2));
  else if (relief.weeksOff) weeks = Math.max(1, weeks - relief.weeksOff);
  return weeks;
}

/**
 * The stewards' round (GDD §13). One roll per job, on race day, before the purse is paid.
 *
 * ⚠️ **Three decisions live in this function and each is a direct answer to §8.4's cautionary
 * tale**, which is the supplement: caught doping forfeits the *purse*, so its punishment grows
 * with the size of the race while its benefit is a fixed speed bump — worse the bigger the race,
 * which is exactly backwards from tempting.
 *
 * 1. **The roll happens here, not when the job is placed.** The fine is a multiple of what the
 *    crook had on that race, and the bets are struck in the betting phase — so rolling any earlier
 *    would make it impossible to size the deterrent against the bet, which is what §13 asks for in
 *    as many words.
 * 2. **The fine is `base + mult × stake on that race`, and the purse is untouched.** §13's edge is
 *    a percentage of the stake, so the punishment is a multiple of the stake: it grows with what
 *    the crime was actually *for*, and a crook who fixed a race and did not back it pays the flat
 *    part only. A crook whose own dog then wins keeps the purse, because taking it would be §8.4
 *    again, wearing a different hat.
 * 3. **The nobbling stands.** A caught crook does not get the race run again — the dog is slow,
 *    the money is lost, and the stewards are at the door. Undoing it as well would make the whole
 *    mechanic a coin flip on its own main effect, and §13 asks for severe rather than random.
 *
 * The Fixer is struck off and no other will work for this stable again this season, which is the
 * half of the deterrent that grows with how often the road is used.
 *
 * ⚠️ **§13's third penalty — "the wronged stable is told who did it" — is logged and does nothing,
 * and that is a decision rather than an omission (D40).** The line is public, so it reaches every
 * stable at the table; but an AI holds no grudge, so in single-player it is flavour. Making it bite
 * means retaliation, which is a rule the GDD does not describe and a fourth thing to balance in a
 * phase that already carries a three-road balance pass. It is a **multiplayer** feature, written up
 * for M6, and the fine and the season ban are sized to carry the whole deterrent without it.
 */
function catchFixers(ctx: Ctx, race: RaceResult['race']): void {
  const { s } = ctx;
  for (const fix of s.fixes) {
    if (fix.week !== s.week || fix.race !== race || fix.caught) continue;
    const p = player(s, fix.playerId);
    if (!ctx.rng.chance(fixCatchRate(s, p))) continue;
    fix.caught = true;
    const staked = s.bets
      .filter((b) => b.playerId === p.id && b.week === s.week && b.race === race)
      .reduce((sum, b) => sum + b.stake, 0);
    const fine = Math.round(balance.fixFineBase + balance.fixFineStakeMult * staked);
    p.cash -= fine;
    p.stats.costs += fine;
    const gone = bestStaff(p, 'fixer');
    if (gone) p.staff = p.staff.filter((o) => o.id !== gone.id);
    p.flags.fixerBarred = true;
    const d = s.dogs[fix.dogId];
    const what =
      fix.kind === 'bribe'
        ? `buying trap ${fix.trap} for ${d?.name ?? 'a dog'}`
        : `getting at ${d?.name ?? 'a dog'}`;
    // No playerId: this one is public. Everybody at the table hears who it was (§13).
    log(
      s,
      `Stewards' enquiry, ${raceType(race).label}: ${p.name} caught ${what}. ` +
        `Fined ${fine}${staked > 0 ? ` (${balance.fixFineBase} plus a share of the ${staked} they had on it)` : ''}` +
        `${gone ? `, and ${gone.name} is struck off` : ''}. No fixer will work for them again this season.`,
    );
  }
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
    if (p.flags.bankrupt) return;
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

    // §13's stewards, after the doping ones and before a Bone of this race's purse is paid.
    catchFixers(ctx, race);

    sim.order.forEach((dogId, idx) => {
      const place = idx + 1;
      const d = dog(s, dogId);
      const delta = applyRaceOutcome(s, d, place, dogs);
      result.ratingDeltas[dogId] = delta;
      if (race === OPEN_TYPE_ID && place === 1) d.openWins++;
      if (d.ownerId !== 'local' && d.ownerId !== 'market') {
        const owner = player(s, d.ownerId);
        const weeks = rollInjury(ctx, d, planet.track.hazard, vetInjuryRelief(owner));
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
  for (const d of Object.values(s.dogs)) {
    d.raceBonus = 0;
    d.supplemented = false;
    d.nobbled = 0;
  }
  for (const p of s.players) {
    p.flags.rivalTrap8 = false;
    p.flags.tipOff = false;
  }
  startPlayerPhase(s, 'planetPost');
}

/** Highest-value dog a player owns, if any. */
export function mostValuableDog(s: GameState, playerId: Id): Dog | undefined {
  return player(s, playerId)
    .dogIds.map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d)
    .sort((a, b) => dogValue(b) - dogValue(a))[0];
}
