/**
 * The kit every Explore card is written with (GDD_V3 §9.1): the card's shape, the context its choices
 * run in, and the handful of effects the engine already had — fitness, form, stats, crates, cash,
 * prices inside the band, style reveal and injury weeks. **A card is a row**; if a card needs
 * something new, it belongs here as a helper the rows call, never as a branch in a phase file.
 *
 * Split out of `events.ts` in v3 Phase D1 so the deck can live in one file per door (`deck/*.ts`)
 * without a runtime import cycle.
 */
import { balance } from './balance';
import { good } from './goods';
import { STYLE_BY_ID } from './styles';
import { CONDITION_BY_ID } from './conditions';
import { type IdGen } from '../economy/dogs';
import { cargoTotal, recordPurchase } from '../economy/goods';
import { clamp, type Rng } from '../rng';
import type { DoorCategory, Dog, GameState, GoodId, Id, Planet, Player, StatKey } from '../types';
import { GOOD_IDS } from '../types';

export type EventParams = Record<string, number | string>;

export interface EventCtx {
  s: GameState;
  rng: Rng;
  nextId: IdGen;
  p: Player;
  planet: Planet;
  params: EventParams;
  log: (text: string) => void;
}

export interface EventChoice {
  label: string;
  apply: (ctx: EventCtx) => void;
}

export interface EventCard {
  id: Id;
  name: string;
  text: string;
  /** Relative weight inside its category's deck (GDD_V3 §9.1). */
  weight: number;
  /** Which door it lives behind (GDD_V3 §9.1). Every card is behind exactly one kind of door. */
  category: DoorCategory;
  /**
   * One of a kind on a planet-week — a particular dog in a particular pen. Once a stable has drawn
   * it, nobody later in the turn order can (§2.3 step 2's contention, resolved in turn order).
   */
  unique?: boolean;
  /** 'flavour' | 'choice' | 'swing' — swings are excluded by the Casual events toggle. */
  kind: 'flavour' | 'choice' | 'swing';
  /** Planet ids where this card is more likely; the weight is multiplied by `planetBoost`. */
  planets?: Id[];
  planetBoost?: number;
  /** Return rolled parameters, or null if the card cannot apply to this player right now. */
  roll?: (ctx: Omit<EventCtx, 'params' | 'log'>) => EventParams | null;
  choices: EventChoice[];
  /**
   * What the buttons say for this stable, when that depends on the stable — a Pound card that asks
   * which of your dogs to let go names them. Defaults to each choice's `label`; must return one label
   * per choice, in order.
   */
  labels?: (ctx: EventCtx) => string[];
  /** What the player is shown beyond `text`, rolled for them: a dog offer's age, stat and patter. */
  detail?: (ctx: EventCtx) => string;
  /** Which choice a Normal AI takes (default 0). */
  aiChoice?: (ctx: EventCtx) => number;
}

export const ownDogs = (s: GameState, p: Player): Dog[] =>
  p.dogIds.map((id) => s.dogs[id]!).filter(Boolean);
export const randomDog = (ctx: { s: GameState; p: Player; rng: Rng }): Dog | undefined => {
  const dogs = ownDogs(ctx.s, ctx.p);
  return dogs.length ? ctx.rng.pick(dogs) : undefined;
};
// What the hold is worth at this planet's *buy* prices — what a customs officer would tax, which
// is not the same as the sell-side valuation net worth uses.
export const holdValue = (ctx: { s: GameState; p: Player }): number => {
  let total = 0;
  for (const id of GOOD_IDS) total += ctx.p.cargo[id] * ctx.s.planet.goods[id].buy;
  return Math.round(total);
};
export const crates = (ctx: { p: Player }): number => cargoTotal(ctx.p.cargo);
/** Move one good's buy and sell price on this planet until the field leaves. */
/**
 * Move one good's price on this planet by a factor, **inside its §6.1 band**.
 *
 * ⚠️ Clamped since v3 Phase B, because the band became a hard global range: every good is exactly
 * 8× from floor to ceiling on every planet (GDD_V3 §6.1), and §6.4's whole guard on the p99 trading
 * leg is that no price escapes it. An event that doubled a price already near the ceiling would be
 * the one way left to break that, so the event moves the price as far as the band allows and no
 * further. The sell price is re-derived from the buy rather than scaled separately, so the spread
 * stays `foodSpread` exactly — the same rule the weekly draw keeps.
 */
export const scaleGood = (ctx: { s: GameState }, id: GoodId, mult: number): void => {
  const m = ctx.s.planet.goods[id];
  const g = good(id);
  m.buy = clamp(Math.round(m.buy * mult), g.floor, g.ceiling);
  m.sell = Math.max(1, Math.round(m.buy * (1 - balance.foodSpread)));
};
export const fit = (d: Dog, delta: number) => {
  d.fitness = clamp(Math.round(d.fitness + delta), 0, 100);
};

/** The dog a card rolled, by its `dogId` param. */
export const dogOf = (ctx: EventCtx, key = 'dogId'): Dog | undefined =>
  ctx.s.dogs[String(ctx.params[key])];

/** A bill the stable has to pay, capped at what it has: nobody is pushed into the red by a card. */
export const pay = (ctx: EventCtx, bones: number): number => {
  const paid = Math.max(0, Math.min(Math.round(bones), Math.floor(ctx.p.cash)));
  ctx.p.cash -= paid;
  ctx.p.stats.costs += paid;
  return paid;
};

/** A price the stable chooses to pay: false, and nothing happens, if it cannot. */
export const spend = (ctx: EventCtx, bones: number): boolean => {
  if (ctx.p.cash < bones) {
    ctx.log(`You cannot find ${bones} Bones. The moment passes.`);
    return false;
  }
  ctx.p.cash -= bones;
  ctx.p.stats.costs += bones;
  return true;
};

/** Money in from a card: a sponsor, a comp, a win at cards. Not a purse, so not prize income. */
export const earn = (ctx: EventCtx, bones: number): void => {
  ctx.p.cash += Math.round(bones);
};

export const formBy = (d: Dog, delta: number): void => {
  d.form = clamp(Math.round(d.form + delta), -balance.formMax, balance.formMax);
};

export const statBy = (d: Dog, stat: StatKey, delta: number): void => {
  d[stat] = clamp(Math.round(d[stat] + delta), 1, 99);
};

/** Put a sound dog on the sidelines, or keep a laid-up one there longer. */
export const injure = (d: Dog, weeks: number): void => {
  d.injuryWeeks = Math.max(d.injuryWeeks, 0) + weeks;
};

/** A vet's work: weeks off a layoff, never below fit. */
export const heal = (d: Dog, weeks: number): void => {
  d.injuryWeeks = Math.max(0, d.injuryWeeks - weeks);
};

/**
 * Make a dog's style public (GDD_V3 §5.4, decision C4). There is only one kind of knowing: a trial
 * on a public track, a lab's print-out pinned to the board, a breeder talking in the bar — whoever
 * learns it, the table does.
 */
export const revealStyle = (ctx: EventCtx, d: Dog, how: string): void => {
  if (d.styleKnown) return;
  d.styleKnown = true;
  ctx.log(`${d.name} ${how}: a ${STYLE_BY_ID[d.style].name.toLowerCase()}. It is on the card now.`);
};

/** Crates in from a card at a price each (0 for free), as much as the hold will take. */
export const addCrates = (ctx: EventCtx, id: GoodId, crates: number, costEach: number): number => {
  const room = balance.holdCap - cargoTotal(ctx.p.cargo);
  const n = Math.max(0, Math.min(crates, room));
  if (n > 0) recordPurchase(ctx.p, id, n, costEach);
  return n;
};

/** The label a player reads for a good. */
export const goodName = (id: GoodId): string => good(id).label;

/** Own dogs that are fit to run: uninjured. */
export const soundDogs = (ctx: { s: GameState; p: Player }): Dog[] =>
  ownDogs(ctx.s, ctx.p).filter((d) => d.injuryWeeks === 0);

/** The stable's fittest sound dog — the one a stable sends to anything that is a race. */
export const fittest = (ctx: { s: GameState; p: Player }): Dog | undefined =>
  [...soundDogs(ctx)].sort((a, b) => b.fitness - a.fitness || b.rating - a.rating)[0];

/** Pick a dog with the stable's own stream, from a filtered list; null params if there is none. */
export const rollDog = (
  ctx: { s: GameState; p: Player; rng: Rng },
  keep: (d: Dog) => boolean = () => true,
): EventParams | null => {
  const dogs = ownDogs(ctx.s, ctx.p).filter(keep);
  return dogs.length ? { dogId: ctx.rng.pick(dogs).id } : null;
};

/** Every good in the hold, cheapest first. */
export const heldGoods = (p: Player): GoodId[] => GOOD_IDS.filter((id) => p.cargo[id] > 0);

/**
 * A race-day tip (Phase D1 item 6): pick one of this weekend's conditions this stable has not been
 * told, on any stable's dog — its own included, because the owner does not know either. Null if
 * there is nothing left to tell, so the card is put back.
 */
export const rollTip = (ctx: { s: GameState; p: Player; rng: Rng }): EventParams | null => {
  const open = ctx.s.conditions
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.tipped.includes(ctx.p.id) && ctx.s.dogs[c.dogId]);
  return open.length ? { tip: ctx.rng.pick(open).i } : null;
};

/** Tell this stable the condition its card rolled, and only this stable. */
export const giveTip = (ctx: EventCtx): void => {
  const c = ctx.s.conditions[Number(ctx.params.tip)];
  const d = c && ctx.s.dogs[c.dogId];
  if (!c || !d) return;
  if (!c.tipped.includes(ctx.p.id)) c.tipped.push(ctx.p.id);
  ctx.p.stats.tips++;
  const owner = ctx.s.players.find((x) => x.id === d.ownerId);
  const whose = owner?.id === ctx.p.id ? 'your own' : `${owner?.name ?? 'somebody'}’s`;
  ctx.log(`The whisper: ${d.name} — ${whose} dog — ${CONDITION_BY_ID[c.condition].tip}.`);
};
