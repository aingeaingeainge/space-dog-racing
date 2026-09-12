import { balance } from '../content/balance';
import {
  NAME_FIRST,
  NAME_SECOND,
  NAME_SOLO,
  SCOUT_NAMES,
  TIPSTER_NAMES,
  TRADER_NAMES,
  TRAINER_NAMES,
  VET_NAMES,
} from '../content/names';
import { LOCAL_RATING_BY_TIER, raceType } from '../content/raceTypes';
import { GOODS, TIER_WAGE } from '../content/goods';
import { HIREABLE_ROLES } from '../content/staff';
import { TRAIT_IDS } from '../content/traits';
import type {
  Dog,
  GoodId,
  GoodMarket,
  GoodTier,
  Id,
  Planet,
  PlanetState,
  RaceTypeId,
  StableFinds,
  StaffOffer,
  StaffRole,
  TraitId,
  UpgradeId,
  Player,
} from '../types';
import { GOOD_IDS } from '../types';
import { clamp, type Rng } from '../rng';
import { baseRating, dogValue } from './dogValue';
import { emptyCargo as emptyCargoRecord } from './goods';
import { bestTier, scoutDogs, scoutFindsBargain } from './staff';

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

/** One dog on the block, priced. Shared by the open shelf and by a Scout's private finds. */
export function rollOneMarketDog(planet: Planet, week: number, rng: Rng, nextId: IdGen): Dog {
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
  return dog;
}

/** Roll a planet's market dogs for the week (GDD §8). */
export function rollMarketDogs(planet: Planet, week: number, rng: Rng, nextId: IdGen): Dog[] {
  const count = rng.int(balance.marketDogsMin, balance.marketDogsMax);
  const dogs: Dog[] = [];
  for (let i = 0; i < count; i++) dogs.push(rollOneMarketDog(planet, week, rng, nextId));
  return dogs;
}

const NAMES_BY_ROLE: Partial<Record<StaffRole, readonly string[]>> = {
  trainer: TRAINER_NAMES,
  vet: VET_NAMES,
  scout: SCOUT_NAMES,
  trader: TRADER_NAMES,
  tipster: TIPSTER_NAMES,
};

/**
 * Who is drinking here this week (GDD §8.3, §8.1).
 *
 * Five hireable roles, each with a chance of turning up at all and then a **tier drawn on the same
 * 70 / 25 / 5 ladder as the goods**. The two planets the GDD names — a trainer is always about at
 * one, a vet works out of the back room at another — get a guaranteed appearance rather than a
 * guaranteed tier: what is on offer there is *someone*, not someone good.
 *
 * ⚠️ **No Fixer.** §13's sabotage and steward bribes are not actions yet, so hiring one would be a
 * wage bill for nothing — a trap rather than a difficulty (GDD §19, 2026-09-08). `HIREABLE_ROLES`
 * is the single place that says so, and the Saloon reads the same list.
 */
export function rollStaff(planet: Planet, rng: Rng, nextId: IdGen): StaffOffer[] {
  const offers: StaffOffer[] = [];
  const sp = planet.special;
  for (const role of HIREABLE_ROLES) {
    const guaranteed = (role === 'trainer' && !!sp.trainer) || (role === 'vet' && !!sp.vet);
    if (!guaranteed && !rng.chance(balance.staffAppearChance)) continue;
    const tier = rollTier(rng, 1);
    const names = NAMES_BY_ROLE[role] ?? TRAINER_NAMES;
    const name = rng.pick(names);
    const gristle = role === 'trainer' && name === 'Gristle McGraw';
    offers.push({
      id: nextId('staff'),
      role,
      tier,
      name,
      wage: TIER_WAGE[tier],
      quirk: gristle ? `+1 on top of his tier, but 5%/week a dog turns Nervy` : undefined,
    });
  }
  return offers;
}

/**
 * Draw a tier on the one ladder (GDD §8.1): roughly 70 / 25 / 5, with `bias` multiplying the two
 * upper chances — which is how Rustgut rarely has anything above Rough and Vatgrown is where the
 * good stuff is.
 *
 * Exactly one rng draw whatever the bias, so the draw count does not depend on the planet.
 */
export function rollTier(rng: Rng, bias: number): GoodTier {
  const prime = balance.stockChancePrime * bias;
  const proper = balance.stockChanceProper * bias;
  const roll = rng.next();
  if (roll < prime) return 'prime';
  if (roll < prime + proper) return 'proper';
  return 'rough';
}

/**
 * What a stable's own staff turned up for it here (GDD §8.3) — a Scout's dogs and a Trader's
 * consigned crates, both invisible to every other stable.
 *
 * Rolled at arrival, per stable, in `turnOrder` so the draw order is the same for the same season
 * whatever the players do. A stable with neither hire gets an empty record, and pays no draws for
 * it: the whole feature costs nothing at the table it is not being used at.
 */
export function rollFinds(
  p: Player,
  planet: Planet,
  week: number,
  goods: Record<GoodId, GoodMarket>,
  rng: Rng,
  nextId: IdGen,
): { finds: StableFinds; dogs: Dog[] } {
  const finds: StableFinds = { dogIds: [], goods: emptyCargoRecord() };
  const dogs: Dog[] = [];
  const wanted = scoutDogs(p);
  for (let i = 0; i < wanted; i++) {
    const d = rollOneMarketDog(planet, week, rng, nextId);
    // Proper and above turn up one dog priced under book — the offer the Market's Book column
    // exists to make visible (§7.3). The first of them, so the count and the bargain are separate
    // rewards rather than the same one twice.
    if (i === 0 && scoutFindsBargain(p)) {
      d.askingPrice = Math.round(dogValue(d) * balance.scoutUnderBook);
    }
    dogs.push(d);
    finds.dogIds.push(d.id);
  }
  const tier = bestTier(p, 'trader');
  if (tier === 'proper' || tier === 'prime') {
    // A consignment is crates of one good at that tier, drawn from what the ladder offers. It is
    // not free: it is stock you may buy at the shelf price that nobody else can reach.
    const wantTier: GoodTier = tier;
    const pool = GOODS.filter((g) => g.tier === wantTier);
    const g = rng.pick(pool);
    const crates = wantTier === 'prime' ? balance.traderConsignPrime : balance.traderConsignProper;
    finds.goods[g.id] += crates;
    // A consigned good always has a price, even where the planet stocked none of it.
    if (goods[g.id].buy <= 0) {
      const [lo, hi] = planet.foodBand;
      const mid = Math.round(((lo + hi) / 2) * g.priceMult);
      goods[g.id] = { buy: mid, sell: Math.round(mid * (1 - balance.foodSpread)), stock: 0 };
    }
  }
  return { finds, dogs };
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
    finds: {},
    staff: [],
    muzzlesInStock: false,
    trackDayPasses: false,
  };
}
