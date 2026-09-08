import { balance } from '../content/balance';
import {
  NAME_FIRST,
  NAME_SECOND,
  NAME_SOLO,
  TRAINER_NAMES,
  VET_NAMES,
} from '../content/names';
import { TRAIT_IDS } from '../content/traits';
import type {
  Dog,
  Id,
  Planet,
  PlanetState,
  StaffOffer,
  TraitId,
  UpgradeId,
  Player,
} from '../types';
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
    goldWins: 0,
    supplemented: false,
    raceBonus: 0,
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

/** A planet's own runner filling an empty trap (GDD §6.1). */
export function createLocalDog(
  cls: 'bronze' | 'silver' | 'gold',
  major: boolean,
  nervy: boolean,
  rng: Rng,
  nextId: IdGen,
): Dog {
  const mid =
    (cls === 'bronze'
      ? balance.localRatingBronze
      : cls === 'silver'
        ? balance.localRatingSilver
        : balance.localRatingGold) + (major ? balance.localRatingMajorBonus : 0);
  const target = Math.round(rng.gauss(mid, balance.localRatingSd));
  const cap = cls === 'bronze' ? balance.capBronze : cls === 'silver' ? balance.capSilver : 99;
  const dog = createDog(
    { quality: target, age: rng.int(2, 5), owner: 'local', traits: nervy ? ['nervy'] : undefined },
    rng,
    nextId,
  );
  return fitRating(dog, Math.max(15, target - 3), Math.min(cap, target + 3));
}

export function askingPrice(dog: Dog, planet: Planet, rng: Rng): number {
  const mod = (planet.special.dogValueMod ?? 1) * (1 + (planet.special.everythingMarkup ?? 0));
  const fell = dog.fellOffAShip ? 0.6 : 1;
  return Math.round(
    dogValue(dog) * mod * fell * rng.uniform(balance.marketAskMin, balance.marketAskMax),
  );
}

/** Roll a planet's market dogs for the week (GDD §8). */
export function rollMarketDogs(planet: Planet, week: number, rng: Rng, nextId: IdGen): Dog[] {
  const count = rng.int(balance.marketDogsMin, balance.marketDogsMax);
  const dogs: Dog[] = [];
  for (let i = 0; i < count; i++) {
    const bias = planet.special.marketAgeBias;
    const age = bias === 'old' ? rng.int(5, 7) : bias === 'pups' ? 1 : rng.int(1, 5);
    let quality = rng.gauss(45 + (planet.special.marketQualityBonus ?? 0), 10);
    if (bias === 'old') quality += 12; // knackered but once good — cheap by age factor
    if (bias === 'pups') quality -= 8;
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
  }
}

export function emptyPlanetState(planetId: Id): PlanetState {
  return {
    planetId,
    foodBuy: 0,
    foodSell: 0,
    foodMod: 1,
    marketDogIds: [],
    staff: [],
    muzzlesInStock: false,
    trackDayPasses: false,
  };
}
