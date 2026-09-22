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
import type {
  Dog,
  GoodId,
  GoodMarket,
  Id,
  PlanetState,
  RaceTypeId,
  StyleId,
  TraitId,
} from '../types';
import { GOOD_IDS, STYLE_IDS } from '../types';
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
  /** Dealt (GDD_V3 §5.5) rather than drawn. A local's is drawn at random. */
  style?: StyleId;
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
    // GDD_V3 §5.1. A local's style is drawn, and is public from the start — the home team's form
    // guide is pinned up at the track (decision C4). A stable's dog keeps its style to itself until
    // it races (§5.4).
    style: spec.style ?? rng.pick(STYLE_IDS),
    styleKnown: spec.owner === 'local',
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
 * A starting-stable dog: **an exact starting rating, a shape drawn at random, a dealt style, ages 2–4**
 * (GDD_V3 §5.5, V2).
 *
 * ⚠️ **Dealt to an equal *rating*, not an equal stat total — and the difference is the whole of V2's
 * promise.** Phase A dealt every dog 150 stat points over three stats on the claim (decision A3) that
 * "with rating weights summing to 1, 150 points rates 50 whatever the split". That is only true if
 * the weights are equal, and they are 0.40 / 0.35 / 0.25 — so a dealt dog rated anywhere from 44 to
 * 55, and the best stable at a table of six started a median 16 rating points ahead of the worst
 * across its three dogs (Phase B's correction 3). §5.5: *"you got better dogs" is the complaint that
 * ends the evening.*
 *
 * So the rating is the budget now: every dealt dog rates exactly `startDogRating`. What varies is its
 * *shape* — a speed dog, an accel dog, a stamina dog, anything between — and that shape is drawn as
 * two deviations from the target on speed and accel, with stamina solving for the rating. The stat
 * *total* now varies instead (a speed-heavy dog carries fewer points than a stamina-heavy one of the
 * same rating), which is the honest consequence of weighted stats and the right thing to equalise.
 *
 * The style is dealt by the caller — one of each per stable, §5.5 — and is independent of the shape:
 * a front-runner with a big engine and no gas is a dog, not a bug.
 */
export function createStartingDog(owner: Id, style: StyleId, rng: Rng, nextId: IdGen): Dog {
  const dog = createDog(
    {
      quality: 0,
      age: rng.int(balance.startDogAgeMin, balance.startDogAgeMax),
      owner,
      style,
    },
    rng,
    nextId,
  );
  const target = balance.startDogRating;
  const spread = balance.startDogShapeSpread;
  // Two draws, always: the stream never depends on the shape it produced.
  const ds = rng.int(-spread, spread);
  const da = rng.int(-spread, spread);
  const stats = { speed: target + ds, accel: target + da, stamina: 0 };
  stats.stamina = Math.round(
    (target - balance.ratingWeightSpeed * stats.speed - balance.ratingWeightAccel * stats.accel) /
      balance.ratingWeightStamina,
  );
  stats.speed = clamp(stats.speed, 20, 99);
  stats.accel = clamp(stats.accel, 20, 99);
  stats.stamina = clamp(stats.stamina, 20, 99);
  // Rounding, or a stamina that fell off the 20–99 range, can leave the rating a point or two out.
  // Walk it home one stat point at a time, stamina first, then speed, then accel — deterministic, no
  // draws, and bounded.
  const keys = ['stamina', 'speed', 'accel'] as const;
  for (let i = 0; i < 300; i++) {
    const r = baseRating(stats);
    if (r === target) break;
    const step = r < target ? 1 : -1;
    const k = keys[i % 3]!;
    const next = stats[k] + step;
    if (next >= 20 && next <= 99) stats[k] = next;
  }
  dog.speed = stats.speed;
  dog.accel = stats.accel;
  dog.stamina = stats.stamina;
  dog.rating = baseRating(dog);
  if (dog.rating !== target) throw new Error(`Dealt a dog rated ${dog.rating}, not ${target}`);
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
