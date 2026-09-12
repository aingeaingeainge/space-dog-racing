import { balance } from '../content/balance';
import { NAME_FIRST, NAME_SECOND, NAME_SOLO, TRAINER_NAMES, VET_NAMES } from '../content/names';
import { LOCAL_RATING_BY_TIER, raceType } from '../content/raceTypes';
import { TRAIT_IDS } from '../content/traits';
import type {
  Dog,
  GoodId,
  GoodMarket,
  Id,
  Planet,
  PlanetState,
  RaceTypeId,
  StaffOffer,
  TraitId,
  UpgradeId,
  Player,
} from '../types';
import { GOOD_IDS } from '../types';
import { clamp, type Rng } from '../rng';
import { baseRating, dogValue } from './dogValue';

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
    trap: stat(),
    rating: 0,
    fitness: 90,
    form: 0,
    age: spec.age,
    traits: spec.traits ?? rollTraits(rng),
    injuryWeeks: 0,
    banWeeks: 0,
    wins: 0,
    runs: 0,
    openWins: 0,
    outOfMoneyFor: 0,
    supplemented: false,
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
    dog.trap = clamp(dog.trap + dir, 20, 99);
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

export function askingPrice(dog: Dog, planet: Planet, rng: Rng): number {
  const mod = (planet.special.dogValueMod ?? 1) * (1 + (planet.special.everythingMarkup ?? 0));
  const fell = dog.fellOffAShip ? 0.6 : 1;
  return Math.round(
    dogValue(dog) * mod * fell * rng.uniform(balance.marketAskMin, balance.marketAskMax),
  );
}

/**
 * The age a planet's market offers, weighted (GDD §5.6 / D14). v1 drew flat over 1–5, which is
 * why "wait for a great dog in the market" was the strongest line in the game — a finished
 * four-year-old turned up as often as a pup. The circuit now mostly sells **pups**: cheap,
 * useless this week, and worth something only if you spend a season on them.
 *
 * Finished dogs still appear, rarely, and more often where the GDD says they should — Majors
 * sell them (`marketQualityBonus`), Rustgut sells knackered old ones and Vatgrown sells nothing
 * else but pups.
 */
function rollMarketAge(planet: Planet, rng: Rng): number {
  const bias = planet.special.marketAgeBias;
  if (bias === 'old') return rng.int(5, 7);
  if (bias === 'pups') return 1;
  // 60% pups, 20% two-year-olds, 20% a finished dog of 3–5. A Major doubles the finished share:
  // it is where you go to buy a runner rather than a project.
  const finished = planet.special.marketQualityBonus ? 0.4 : 0.2;
  const roll = rng.next();
  if (roll < 1 - finished - 0.2) return 1;
  if (roll < 1 - finished) return 2;
  return rng.int(3, 5);
}

/** Roll a planet's market dogs for the week (GDD §8). */
export function rollMarketDogs(planet: Planet, week: number, rng: Rng, nextId: IdGen): Dog[] {
  const count = rng.int(balance.marketDogsMin, balance.marketDogsMax);
  const dogs: Dog[] = [];
  for (let i = 0; i < count; i++) {
    const bias = planet.special.marketAgeBias;
    const age = rollMarketAge(planet, rng);
    let quality = rng.gauss(45 + (planet.special.marketQualityBonus ?? 0), 10);
    // A pup is raw, and the market prices what it is rather than what it might be: GDD §5.6's
    // pup is rating ≈ 37 and worth ≈ 3,900. v1 rolled every age around the same 45, which is
    // half of why waiting for a good dog in the market beat raising one.
    if (age === 1) quality -= 8;
    else if (age === 2) quality -= 4;
    if (bias === 'old') quality += 12; // knackered but once good — cheap by age factor
    const dog = createDog({ quality: clamp(quality, 22, 95), age, owner: 'market' }, rng, nextId);
    if (planet.special.fellOffAShip && rng.chance(0.5)) dog.fellOffAShip = week + 3;
    dog.askingPrice = askingPrice(dog, planet, rng);
    dogs.push(dog);
  }
  return dogs;
}

export function rollStaff(planet: Planet, rng: Rng, nextId: IdGen): StaffOffer[] {
  const offers: StaffOffer[] = [];
  const s = planet.special;
  // A trainer is usually about; a vet only where the GDD says so.
  if (s.trainer || rng.chance(0.6)) {
    const name = rng.pick(TRAINER_NAMES);
    const gristle = name === 'Gristle McGraw';
    offers.push({
      id: nextId('staff'),
      role: 'trainer',
      name,
      wage: balance.trainerWage,
      quirk: gristle ? '+2/week but 5%/week a dog turns Nervy' : undefined,
    });
  }
  if (s.vet)
    offers.push({
      id: nextId('staff'),
      role: 'vet',
      name: rng.pick(VET_NAMES),
      wage: balance.vetWage,
    });
  // No fixer. GDD §13's sabotage and steward bribes do not exist as actions yet, so hiring one
  // was a 350-a-week wage bill for nothing. He comes back with §13 (GDD §19, 2026-09-08).
  return offers;
}

export function upgradePrice(upgrade: UpgradeId, planet: Planet, player: Player): number {
  const s = planet.special;
  const markup = 1 + (s.everythingMarkup ?? 0);
  const ship = 1 - (s.shipDiscount ?? 0);
  switch (upgrade) {
    case 'engine':
      return Math.round(balance.shipEngineCost * ship * (1 - (s.engineDiscount ?? 0)) * markup);
    case 'cargo':
      return Math.round(balance.shipCargoCost * ship * markup);
    case 'kennel':
      return Math.round(balance.shipKennelCost * ship * (1 - (s.kennelDiscount ?? 0)) * markup);
    case 'coldStore':
      return Math.round(balance.shipColdStoreCost * ship * markup);
    case 'trackDay':
      return Math.round(balance.itemTrackDayCost * markup);
    case 'muzzle':
      return Math.round(balance.itemMuzzleCost * markup);
    case 'supplement':
      return Math.round(
        balance.itemSupplementCost * markup * (player.flags.caughtDoping ? 1.5 : 1),
      );
    case 'dossier':
      return Math.round(balance.dossierCost * markup);
  }
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
    marketDogIds: [],
    staff: [],
    muzzlesInStock: false,
    trackDayPasses: false,
  };
}
