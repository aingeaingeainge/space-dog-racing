/**
 * Making dogs, and the empty planet.
 *
 * ⚠️ **This module is what is left of `economy/market.ts` after v3 Phase A.** BUILD_PLAN_V3 §2.1
 * cuts the dog market — buying, selling, pups, the shelf of dogs, the asking price, the Scout's
 * private finds, the staff hall, the Fixer's far table and the whole ship/kennel upgrade list — but
 * a game still has to *make* a dog: three at the start of a season (GDD_V3 §5.5) and up to seven
 * locals to fill a short field (§7.1). Those are the functions here, and the name says what the
 * module does now rather than what the file used to be called.
 *
 * `createDog` stays the single place a `Dog` comes into existence, so Phase B's food bonuses and
 * Phase C's running styles each have exactly one constructor to extend.
 */
import { balance } from '../content/balance';
import { NAME_FIRST, NAME_SECOND, NAME_SOLO } from '../content/names';
import { LOCAL_RATING_BY_TIER, raceType } from '../content/raceTypes';
import { TRAIT_IDS } from '../content/traits';
import type { Dog, GoodId, GoodMarket, Id, PlanetState, RaceTypeId, TraitId } from '../types';
import { GOOD_IDS } from '../types';
import { clamp, type Rng } from '../rng';
import { baseRating } from './dogValue';

export type IdGen = (prefix: string) => Id;

export function generateName(rng: Rng): string {
  const roll = rng.next();
  if (roll < 0.08) return rng.pick(NAME_SOLO);
  const a = rng.pick(NAME_FIRST);
  const b = rng.pick(NAME_SECOND);
  if (roll < 0.2) return `${a} of ${b}`;
  if (roll < 0.28) return `${b} the ${a}`;
  return `${a} ${b}`;
}

export interface DogSpec {
  quality: number; // centre of the stat distribution
  age: number;
  owner: Dog['ownerId'];
  traits?: TraitId[];
  statSd?: number;
}

/** Roll a dog whose stats sit around `quality` (GDD §5.1 / economy_sim.py Dog). */
export function createDog(spec: DogSpec, rng: Rng, nextId: IdGen): Dog {
  const sd = spec.statSd ?? balance.dogStatSd;
  const stat = () => Math.round(clamp(rng.gauss(spec.quality, sd), 20, 99));
  const dog: Dog = {
    id: nextId('dog'),
    name: generateName(rng),
    ownerId: spec.owner,
    speed: stat(),
    accel: stat(),
    stamina: stat(),
    rating: 0,
    fitness: 90,
    form: 0,
    age: spec.age,
    traits: spec.traits ?? rollTraits(rng),
    injuryWeeks: 0,
    wins: 0,
    runs: 0,
    openWins: 0,
    outOfMoneyFor: 0,
    raceBonus: 0,
    // GDD §5.7: every dog starts the week pointed at a race. That is the state a player who
    // touches nothing gets, and it is v1's behaviour, so the Kennels is a decision you may
    // take rather than a form you must fill in.
    weekState: 'race',
    trainStat: 'speed',
    look: { body: rng.int(0, 11), palette: rng.int(0, 5), accessory: rng.int(0, 7) },
  };
  dog.rating = baseRating(dog);
  return dog;
}

export function rollTraits(rng: Rng, forced?: TraitId): TraitId[] {
  const n = rng.chance(0.35) ? 2 : 1;
  const traits: TraitId[] = forced ? [forced] : [];
  let guard = 0;
  while (traits.length < n && guard++ < 20) {
    const t = rng.pick(TRAIT_IDS);
    if (!traits.includes(t)) traits.push(t);
  }
  return traits;
}

/** Nudge a freshly rolled dog's stats until its rating lands in [lo, hi]. */
export function fitRating(dog: Dog, lo: number, hi: number): Dog {
  let guard = 0;
  while ((dog.rating < lo || dog.rating > hi) && guard++ < 200) {
    const dir = dog.rating < lo ? 1 : -1;
    dog.speed = clamp(dog.speed + dir, 20, 99);
    dog.accel = clamp(dog.accel + dir, 20, 99);
    dog.stamina = clamp(dog.stamina + dir, 20, 99);
    dog.rating = baseRating(dog);
  }
  return dog;
}

/** A starting-stable dog: ratings 38–48, ages 2–4 (GDD §5.6). */
export function createStartingDog(owner: Id, rng: Rng, nextId: IdGen): Dog {
  const target = rng.int(balance.startDogRatingMin, balance.startDogRatingMax);
  const dog = createDog(
    { quality: target, age: rng.int(balance.startDogAgeMin, balance.startDogAgeMax), owner },
    rng,
    nextId,
  );
  return fitRating(dog, balance.startDogRatingMin, balance.startDogRatingMax);
}

/**
 * A planet's own runner filling an empty trap (GDD §6.1, §6.3).
 *
 * The dog is drawn around the level of the race's *purse tier* — a rich race draws a strong home
 * team — and is then shaped by the race's own `LocalSpec` so that it satisfies the same entry
 * criterion every declared dog is held to. Locals bypass `Declare`, so nothing else would stop a
 * four-year-old turning up in a Juvenile; `properties.test.ts` asserts every entrant, local
 * included, passes its race's predicate.
 */
export function createLocalDog(
  race: RaceTypeId,
  major: boolean,
  nervy: boolean,
  rng: Rng,
  nextId: IdGen,
): Dog {
  const type = raceType(race);
  const spec = type.local;
  const mid = LOCAL_RATING_BY_TIER[type.tier] + (major ? balance.localRatingMajorBonus : 0);
  // The tier says how good the home team is; the row's window says what the race will admit.
  // The draw is squeezed into the window rather than rejected, so an Invitational's locals are
  // pushed up to its floor and a Handicap's squashed under its cap — which is how a race that
  // posts a number still fields eight dogs that satisfy it.
  const lo = spec.ratingMin ?? 15;
  const hi = spec.ratingMax ?? 99;
  const target = clamp(Math.round(rng.gauss(mid, balance.localRatingSd)), lo, hi);
  const dog = createDog(
    {
      quality: target,
      age: rng.int(spec.ageMin ?? 2, spec.ageMax ?? 5),
      owner: 'local',
      traits: nervy ? ['nervy'] : undefined,
    },
    rng,
    nextId,
  );
  // A local turns up fresh but not perfect. v1 left every dog on createDog's 90, which cost
  // nothing while campaigning stables declared at a mean fitness of 96 — and became a standing
  // handicap the moment §5.7 put them in the 60–80 band the design asks for. Locals now run at
  // the top of that band: still the fresher home team, no longer a rating class better.
  dog.fitness = balance.localFitness;
  if (spec.outOfMoney) dog.outOfMoneyFor = balance.consolationReach;
  return fitRating(dog, Math.max(lo, target - 3), Math.min(hi, target + 3));
}

export function emptyPlanetState(planetId: Id): PlanetState {
  return {
    planetId,
    // Prices are rolled on arrival; before that every shelf is empty and free, which no phase
    // ever reads because arrival runs before anything can trade.
    goods: Object.fromEntries(GOOD_IDS.map((id) => [id, { buy: 0, sell: 0, stock: 0 }])) as Record<
      GoodId,
      GoodMarket
    >,
  };
}
