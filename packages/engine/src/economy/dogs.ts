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
import { raceType } from '../content/raceTypes';
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
    goldCupWins: 0,
    raceBonus: 0,
    // GDD §5.7: every dog starts the week pointed at a race. That is the state a player who
    // touches nothing gets, and it is v1's behaviour, so the Kennels is a decision you may
    // take rather than a form you must fill in.
    weekState: 'race',
    // GDD_V3 §6.3's diet, defaulting to the cheapest food aboard — which is also §6.3's fallback,
    // so a player who never touches the setting gets the rule's own behaviour and their dogs never
    // eat the Ambrosia they bought to sell. "Best available" has to be *chosen*.
    diet: { kind: 'worst' },
    lastMeal: null,
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

/**
 * A starting-stable dog: **an equal stat budget, split differently, ages 2–4** (GDD_V3 §5.5).
 *
 * ⚠️ **Every stable's three dogs are rolled to the same total, and that is a rule rather than a
 * nicety.** §5.5 is blunt about why: *"In a game people play against each other, 'you got better
 * dogs' is the complaint that ends the evening."* v2 fitted each dog into a **rating band** instead,
 * which is a different and weaker promise — two dogs inside 38–48 can be ten rating points apart, and
 * across three dogs a stable could start a season a class up on the table.
 *
 * So the budget is exact: `startStatBudget` points spread over three stats, with the split drawn at
 * random. What varies between stables is the *shape* of a dog, never the total — which is also the
 * shape Phase C wants, because §5.5 deals one of each running style and a style is a redistribution
 * of the same energy (§5.1).
 *
 * The rating that falls out of a budget is not free to choose: with weights summing to 1, a dog with
 * 150 points over three stats rates 50 whatever the split, so this function does not need to fit a
 * band at all. That is worth knowing before anybody re-adds one.
 */
export function createStartingDog(owner: Id, rng: Rng, nextId: IdGen): Dog {
  const dog = createDog(
    { quality: 0, age: rng.int(balance.startDogAgeMin, balance.startDogAgeMax), owner },
    rng,
    nextId,
  );
  // Split the budget three ways by drawing two cut points, then clamp each stat into the legal
  // 20–99 range and give any rounding remainder to the largest stat, so the total is exact.
  const budget = balance.startStatBudget;
  const cuts = [rng.int(1, budget - 1), rng.int(1, budget - 1)].sort((a, b) => a - b);
  const raw = [cuts[0]!, cuts[1]! - cuts[0]!, budget - cuts[1]!];
  const parts = raw.map((x) => clamp(x, 20, 99));
  let drift = budget - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; drift !== 0 && i < 300; i++) {
    const at = i % 3;
    const step = Math.sign(drift);
    const next = parts[at]! + step;
    if (next >= 20 && next <= 99) {
      parts[at] = next;
      drift -= step;
    }
  }
  const order = rng.shuffle([0, 1, 2]);
  dog.speed = parts[order[0]!]!;
  dog.accel = parts[order[1]!]!;
  dog.stamina = parts[order[2]!]!;
  dog.rating = baseRating(dog);
  return dog;
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
  // The race's own home-team level (GDD_V3 §7.1): Gold 55, Silver 45, Bronze 35. A rich race draws a
  // strong home team, and with open entry that IS the whole of what makes the Gold Cup hard — there
  // is no eligibility gate left to keep a good dog out of it.
  //
  // ⚠️ **`LocalSpec`'s rating and age windows are gone with the fact-gated types (§2.1).** They
  // existed so that a local generated for a Juvenile was actually two years old and one for a
  // Handicap was actually under the cap — a race that posts a number still needing eight dogs that
  // satisfy it. Nothing posts a number any more, so a local is simply a dog of about the right
  // standard.
  const mid = raceType(race).localRating + (major ? balance.localRatingMajorBonus : 0);
  const target = clamp(Math.round(rng.gauss(mid, balance.localRatingSd)), 15, 99);
  const dog = createDog(
    {
      quality: target,
      age: rng.int(2, 5),
      owner: 'local',
      traits: nervy ? ['nervy'] : undefined,
    },
    rng,
    nextId,
  );
  // A local turns up fresh but not perfect. v1 left every dog on createDog's 90, which cost
  // nothing while campaigning stables declared at a mean fitness of 96 — and became a standing
  // handicap the moment the weekly state put them in the 60–80 band the design asks for. Locals run
  // at the top of that band: still the fresher home team, no longer a rating class better.
  dog.fitness = balance.localFitness;
  return fitRating(dog, Math.max(15, target - 3), Math.min(99, target + 3));
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
