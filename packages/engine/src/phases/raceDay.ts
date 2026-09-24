import { balance } from '../content/balance';
import { good } from '../content/goods';
import { publicStyle, STYLE_BY_ID } from '../content/styles';
import { CONDITION_BY_ID, conditionOf } from '../content/conditions';
import { HEADLINE_TYPE_ID, raceType } from '../content/raceTypes';
import { pow10 } from '../determinism';
import { createLocalDog } from '../economy/dogs';
import { dogValue } from '../economy/dogValue';
import { decimalOdds, placeProbabilities, styleEdge, winProbabilities } from '../race/odds';
import { simulateRace, type Runner } from '../race/simulateRace';
import {
  bettingMargin,
  calendarEntry,
  currentPlanet,
  dog,
  log,
  player,
  purseFor,
  thisWeeksCard,
  type Ctx,
} from '../state';
import { clamp, fork } from '../rng';
import type { Dog, GameState, Id, RaceField, RaceResult, StyleId } from '../types';
import { STYLE_IDS } from '../types';
import { bettingOpen, startPlayerPhase } from './turn';
import { followDeclarations } from './planet';

/** GDD §4.2 step 4: fill traps with locals, draw traps, open the bookie. */
export function lockDeclarations(ctx: Ctx): void {
  const { s, rng } = ctx;
  const track = currentPlanet(s).track;
  const major = calendarEntry(s).major;
  const card = thisWeeksCard();
  const fields: RaceField[] = [];
  const margin = bettingMargin(s);
  const tipsters = s.players.filter((p) => p.flags.tipOff);
  // ⚠️ **Drawn every week, whether or not anybody was tipped (decision D1).** The Tip-off card lives
  // behind a Bar door now, so whether anybody holds it depends on which doors were opened — and the
  // game's stream must not. The draws are made regardless and only *applied* for a tipster.
  const lazyRace = rng.pick(card);

  for (const race of card) {
    const runners: Dog[] = [];
    for (const pid of s.turnOrder) {
      const dogId = s.declarations[race][pid];
      if (dogId && s.dogs[dogId]) runners.push(s.dogs[dogId]!);
    }
    while (runners.length < balance.traps) {
      const local = createLocalDog(race, major, rng, ctx.nextId);
      s.dogs[local.id] = local;
      runners.push(local);
    }
    // Tip-off: one local in a random race on the card is "not trying".
    if (race === lazyRace) {
      const locals = runners.filter((d) => d.ownerId === 'local');
      if (locals.length) {
        const lazy = rng.pick(locals);
        if (tipsters.length) {
          lazy.fitness = 40;
          for (const p of tipsters)
            log(s, `Tip-off: ${lazy.name} in the ${raceType(race).label} is not trying.`, p.id);
        }
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
    // The book prices the rating and, once it is public, the style on this trip (GDD_V3 §5.6).
    const ratings = ordered.map((d) => d.rating + styleEdge(publicStyle(d), track));
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
        style: publicStyle(d),
        bookRating: ratings[i]!,
        odds: decimalOdds(winP[i]!, margin),
        winProb: winP[i]!,
        placeProb: placeP[i]!,
        local: d.ownerId === 'local',
      })),
    });
  }
  s.fields = fields;
  s.locked = true;
  // What the Race Office left is the week (Phase D2 item 5): declared dogs race, the rest rest.
  followDeclarations(s);
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
function runnerFrom(s: GameState, d: Dog, trap: number): Runner {
  // A race-day condition (Phase D1 item 6) lands on the runner here and nowhere else: the stored
  // dog, every screen and the book all go on reading it as it was.
  const c = conditionOf(s, d.id);
  const row = c ? CONDITION_BY_ID[c.condition] : null;
  return {
    id: d.id,
    trap,
    speed: d.speed,
    accel: d.accel,
    stamina: d.stamina,
    fitness: clamp(d.fitness + (row?.fitness ?? 0), 0, 100),
    form: d.form,
    traits: d.traits,
    speedBonus: d.raceBonus + (row?.speed ?? 0),
    style: d.style,
  };
}

/**
 * GDD_V3 §5.4: a style is hidden until the dog races, then public to the whole table.
 *
 * Every stable dog that just ran is revealed. Then the elimination §5.5 promises — "a player who has
 * identified two knows the third" — is done by the engine rather than left to whoever brought a pen:
 * the deal is public (one of each), so once two of a stable's dealt three are known, so is the third,
 * and it is known to everybody, because everybody can do the same subtraction.
 *
 * ⚠️ **Rewritten for Phase D1's acquisition (§9.2), which broke the old assumption (decision C4).**
 * The elimination used to require a kennel of exactly three and read every dog in it. Once a stable
 * can swap a dog, that is unsound twice over: an acquired dog is not part of the deal, so its style
 * says nothing about the others; and a dealt dog that has left took one of the three styles with it.
 * So it now reads only what the table can actually infer — the **dealt** dogs still held (`Dog.dealt`)
 * and the styles of dealt dogs that left, as the table knew them when they went (`dealtGone`). If
 * exactly one held dealt dog is still unknown and no dealt dog left unknown, the one style missing
 * from the deal is its style. Anything less and nobody can say, so nobody is told.
 */
export function revealStyles(s: GameState, ran: readonly Dog[]): void {
  const reveal = (d: Dog, how: string) => {
    d.styleKnown = true;
    log(s, `${d.name} ${how} ${STYLE_BY_ID[d.style].name.toLowerCase()} — it is on the card now.`);
  };
  for (const d of ran) if (d.ownerId !== 'local' && !d.styleKnown) reveal(d, 'showed itself a');
  for (const p of s.players) {
    if (p.dealtGone.includes(null)) continue;
    const dealt = p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d && d.dealt);
    const hidden = dealt.filter((d) => !d.styleKnown);
    if (hidden.length !== 1) continue;
    const known = [
      ...dealt.filter((d) => d.styleKnown).map((d) => d.style),
      ...p.dealtGone.filter((x): x is StyleId => x !== null),
    ];
    const missing = STYLE_IDS.filter((id) => !known.includes(id));
    if (
      known.length === STYLE_IDS.length - 1 &&
      missing.length === 1 &&
      missing[0] === hidden[0]!.style
    )
      reveal(hidden[0]!, 'is, by elimination, the stable’s');
  }
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
  d.form = clamp(Math.round(d.form + (expected - place)), -balance.formMax, balance.formMax);
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
  // What it ate at the last jump (GDD_V3 §6.3): Ambrosia halves it for the week that follows.
  if (d.lastMeal) p *= good(d.lastMeal).injuryMult;
  if (!ctx.rng.chance(p)) return 0;
  return ctx.rng.int(balance.injuryWeeksMin, balance.injuryWeeksMax);
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
    const runners = field.map((e, i) => runnerFrom(s, dogs[i]!, e.trap));
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
      runs: sim.runs,
      injuries: {},
      payouts: [],
    };

    sim.order.forEach((dogId, idx) => {
      const place = idx + 1;
      const d = dog(s, dogId);
      const delta = applyRaceOutcome(s, d, place, dogs);
      result.ratingDeltas[dogId] = delta;
      if (race === HEADLINE_TYPE_ID && place === 1) d.goldCupWins++;
      if (d.ownerId !== 'local') {
        const owner = player(s, d.ownerId);
        // A lent local (GDD_V3 §4.4) pays its stable the prize and nothing else: it is nobody's
        // asset, so it is not rolled for injury.
        const weeks = d.loan ? 0 : rollInjury(ctx, d, planet.track.hazard);
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

    revealStyles(s, dogs);

    const winner = dog(s, sim.order[0]!);
    log(
      s,
      `${raceType(race).label}: ${winner.name} wins${sim.photoFinish ? ' in a photo finish' : ''} (${result.margin} m).`,
    );
    races.push(result);
  }

  s.races = races;

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
