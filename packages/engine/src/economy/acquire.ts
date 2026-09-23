/**
 * A dog offered in the Pound (GDD_V3 §9.2, V4): **age, one revealed stat, and the seller's patter —
 * which is sometimes a lie.** You do not see its other stats, its rating or its style. Accepting means
 * letting one of your own go, and pays nothing either way.
 *
 * ⚠️ **The offer lives in the card's params, not in `GameState.dogs`**, until it is taken: a dog that
 * nobody took never existed, so it never takes an id, never shows up in a rating table and never has
 * to be swept. Everything about it is rolled when the card is drawn, on the stable's own Explore
 * stream (decision D1), in a fixed number of draws — so what the seller says, and whether it is true,
 * never depends on anything but the draw.
 *
 * **What a lie is.** The seller always talks up one stat you cannot see. Honest, it is
 * `dogOfferClaimHonest` above the dog's level; lying, `dogOfferClaimLie` below it. The rate is
 * `dogOfferLieRate` times the card's own multiplier — a monk never lies, a man in a long coat usually
 * does — which is the thing a player can reason about (pillar 2: randomness arrives as a priceable
 * offer). A lie is *caught* the moment the dog is in your kennel, because its stat bars are public.
 */
import { balance } from '../content/balance';
import { STYLE_BY_ID } from '../content/styles';
import { clamp, type Rng } from '../rng';
import type { Dog, GameState, Id, Player, StatKey } from '../types';
import { STAT_KEYS, STYLE_IDS } from '../types';
import { generateName, rollTraits, type IdGen } from './dogs';
import { baseRating, dogValue } from './dogValue';

/** How the seller talks up each stat. Read by a player; a lie reads exactly the same. */
export const PATTER: Record<StatKey, string> = {
  speed: 'the fastest thing on four legs I ever saw',
  accel: 'out of the boxes like a cork out of a bottle',
  stamina: 'runs all day and asks for more',
};

export const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  accel: 'Acceleration',
  stamina: 'Stamina',
};

export interface OfferOptions {
  /** × `dogOfferLieRate`. 0 is a seller who never lies. */
  lieMult: number;
  ageMin?: number;
  ageMax?: number;
  /** Added to `dogOfferRatingMean`: a lab's batch dog is not a farmyard runt. */
  levelShift?: number;
}

/**
 * Roll the offer into card params, on the stable's own Explore stream: level, age, three stat
 * deviations, which stat is shown, which is talked up, the lie, the style, the name, the traits and the
 * look. The lie is drawn whatever the rate, so a monk's offer and a liar's use the same draws.
 */
export function rollOffer(rng: Rng, opts: OfferOptions): Record<string, number | string> {
  const level = clamp(
    Math.round(
      rng.gauss(balance.dogOfferRatingMean + (opts.levelShift ?? 0), balance.dogOfferRatingSd),
    ),
    25,
    80,
  );
  const age = rng.int(opts.ageMin ?? balance.dogOfferAgeMin, opts.ageMax ?? balance.dogOfferAgeMax);
  const dev = STAT_KEYS.map(() => Math.round(rng.gauss(0, balance.dogStatSd / 2)));
  const shown = rng.int(0, 2);
  const claimed = (shown + rng.int(1, 2)) % 3;
  const lie = rng.chance(balance.dogOfferLieRate * opts.lieMult);
  const stats = STAT_KEYS.map((_, i) => clamp(level + dev[i]!, 20, 95));
  stats[claimed] = clamp(
    level + (lie ? -balance.dogOfferClaimLie : balance.dogOfferClaimHonest),
    20,
    95,
  );
  const style = rng.pick(STYLE_IDS);
  const name = generateName(rng);
  const traits = rollTraits(rng).join(',');
  const look = [rng.int(0, 11), rng.int(0, 5), rng.int(0, 7)];
  return {
    offerName: name,
    age,
    speed: stats[0]!,
    accel: stats[1]!,
    stamina: stats[2]!,
    shown: STAT_KEYS[shown]!,
    claimed: STAT_KEYS[claimed]!,
    lie: lie ? 1 : 0,
    style,
    traits,
    body: look[0]!,
    palette: look[1]!,
    accessory: look[2]!,
  };
}

/** What a player is shown: age, one stat, and the patter. Never the rest. */
export function describeOffer(params: Record<string, number | string>): string {
  const shown = String(params.shown) as StatKey;
  const claimed = String(params.claimed) as StatKey;
  return (
    `${params.offerName}, age ${params.age}. ${STAT_LABEL[shown]} ${params[shown]} — you can see that for yourself. ` +
    `The seller swears it is "${PATTER[claimed]}". Its other stats, its rating and how it runs, you will find out.`
  );
}

/** The offered dog as it would be if taken — for the AI's own estimate, never shown. */
export function offerStats(params: Record<string, number | string>) {
  return {
    speed: Number(params.speed),
    accel: Number(params.accel),
    stamina: Number(params.stamina),
  };
}

/**
 * Take the offered dog, let `outId` go (GDD_V3 §9.2). The new dog arrives **style-unknown** (§5.4's
 * second unknown) and not dealt, so the §5.5 elimination never counts it (`revealStyles`). The dog
 * let go leaves the game: it was not sold, and it is not worth anything to anybody now.
 */
export function acceptOffer(
  s: GameState,
  p: Player,
  params: Record<string, number | string>,
  outId: Id,
  nextId: IdGen,
): { joined: Dog; left: Dog } {
  const left = s.dogs[outId];
  if (!left || !p.dogIds.includes(outId)) throw new Error(`${outId} is not ${p.id}'s to let go`);
  const traits = String(params.traits || '')
    .split(',')
    .filter(Boolean) as Dog['traits'];
  const joined: Dog = {
    id: nextId('dog'),
    name: String(params.offerName),
    ownerId: p.id,
    ...offerStats(params),
    rating: 0,
    fitness: 80,
    form: 0,
    age: Number(params.age),
    traits,
    style: String(params.style) as Dog['style'],
    styleKnown: false,
    dealt: false,
    injuryWeeks: 0,
    wins: 0,
    runs: 0,
    goldCupWins: 0,
    raceBonus: 0,
    weekState: 'race',
    diet: { ...left.diet },
    lastMeal: null,
    look: {
      body: Number(params.body),
      palette: Number(params.palette),
      accessory: Number(params.accessory),
    },
  };
  joined.rating = baseRating(joined);
  // The table's knowledge of the dealt three survives the swap (`revealStyles`): a dealt dog that
  // leaves takes its style with it, public or not.
  if (left.dealt) p.dealtGone.push(left.styleKnown ? left.style : null);
  p.dogIds[p.dogIds.indexOf(outId)] = joined.id;
  delete s.dogs[outId];
  if (p.fanClubDogId === outId) delete p.fanClubDogId;
  s.dogs[joined.id] = joined;
  return { joined, left };
}

/**
 * The Normal AI's read of an offer: the shown stat is taken as the dog's level, the talked-up stat
 * is expected at the card's honest/lying mix, the third at the level — a rating estimate, then a
 * value at the offer's age. It knows the card's lie rate because the card says who is selling.
 */
export function estimateOffer(params: Record<string, number | string>, lieMult: number): number {
  const shown = String(params.shown) as StatKey;
  const claimed = String(params.claimed) as StatKey;
  const level = Number(params[shown]);
  const q = Math.min(1, balance.dogOfferLieRate * lieMult);
  const est: Record<StatKey, number> = { speed: level, accel: level, stamina: level };
  est[claimed] = level + balance.dogOfferClaimHonest * (1 - q) - balance.dogOfferClaimLie * q;
  return dogValue({ rating: baseRating(est), age: Number(params.age), injuryWeeks: 0 });
}

/** The stable's dog it would let go for an offer: the one worth least. */
export function cheapestDog(s: GameState, p: Player): Dog | undefined {
  return p.dogIds
    .map((id) => s.dogs[id])
    .filter((d): d is Dog => !!d)
    .sort((a, b) => dogValue(a) - dogValue(b) || (a.id < b.id ? -1 : 1))[0];
}

export const styleName = (params: Record<string, number | string>): string =>
  STYLE_BY_ID[String(params.style) as Dog['style']].name;
