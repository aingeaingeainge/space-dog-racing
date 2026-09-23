import { EVENTS, EVENT_BY_ID, type EventCard, type EventCtx } from '../content/events';
import { currentPlanet, log, player, type Ctx } from '../state';
import { mulberry32, type Rng } from '../rng';
import { ActionError, type Action, type GameState, type Id } from '../types';
import { revealStyles } from './raceDay';
import { startPlayerPhase } from './turn';

/**
 * Explore (GDD_V3 §2.3 step 2, §9.1): every stable opens one of the planet's three doors, and what is
 * behind it is an event card with two or three choices, or a bit of flavour.
 *
 * ⚠️ **It replaces the arrival draw entirely.** v3 has no arrival events: the 26 cards that used to be
 * dealt one a stable on landing live behind the five kinds of door now, and count toward the deck.
 *
 * **The draw point (decision D1).** At arrival, before anybody picks, the game's stream makes one draw
 * per stable, in seating order: that stable's Explore seed for the week. Everything Explore does —
 * which card is behind the door, what it rolls, what the choice does — runs on that stable's own
 * stream. So the game's stream never depends on a door or a choice, and a stable's draws never depend
 * on another's door. The one thing that does cross between stables is contention: a `unique` card
 * drawn by the first stable through a door is gone for the next, which is §2.3's "resolved in turn
 * order" and is a fact about the deck, not about anybody's stream.
 *
 * **Simultaneous, played in turn order.** Nobody sees anybody else's door: the screen never shows
 * it and an AI never reads it. Because the picks are private and contention is settled in turn order
 * anyway, resolving each stable's door the moment it is opened, in turn order, is the same game as
 * collecting every pick and then resolving — and it lets a hotseat table pass the laptop once.
 */

/** Seed every stable's Explore stream for the week. Called once, at arrival. */
export function seedExplore(ctx: Ctx): void {
  const { s, rng } = ctx;
  const seeds: Record<Id, number> = {};
  for (const p of s.players) seeds[p.id] = Math.floor(rng.next() * 4294967296);
  s.explore = { seeds, picks: {}, cards: {}, taken: [] };
}

function eventCtx(
  s: GameState,
  ctx: Ctx,
  rng: Rng,
  playerId: Id,
  params: EventCtx['params'],
): EventCtx {
  return {
    s,
    rng,
    nextId: ctx.nextId,
    p: player(s, playerId),
    planet: currentPlanet(s),
    params,
    log: (text) => log(s, text, playerId),
  };
}

/** The deck behind a door: its category, less swings on Casual and anything one-of-a-kind already gone. */
export function deckFor(s: GameState, door: number): { cards: EventCard[]; weights: number[] } {
  const planet = currentPlanet(s);
  const category = planet.exploreDoors[door]!.category;
  const taken = s.explore?.taken ?? [];
  const cards = EVENTS.filter(
    (e) =>
      e.category === category &&
      !(s.toggles.casualEvents && e.kind === 'swing') &&
      !(e.unique && taken.includes(e.id)),
  );
  const weights = cards.map((e) =>
    e.planets?.includes(planet.id) ? e.weight * (e.planetBoost ?? 3) : e.weight,
  );
  return { cards, weights };
}

function applyChoice(ectx: EventCtx, card: EventCard, choice: number): void {
  const c = card.choices[choice] ?? card.choices[0]!;
  const label = card.labels ? (card.labels(ectx)[choice] ?? c.label) : c.label;
  ectx.log(`${card.name} — ${label}.`);
  c.apply(ectx);
  // A card can make a style public (a trial, a breeder, a rival's bragging); the §5.5 elimination
  // follows from it at once rather than waiting for race day.
  revealStyles(ectx.s, []);
}

/** What a card's labels read for this stable — a card may name the dogs it is about. */
export function choiceLabels(card: EventCard, ectx: EventCtx): string[] {
  return card.labels ? card.labels(ectx) : card.choices.map((c) => c.label);
}

/** GDD_V3 §9.1: open a door. Resolves at once for an AI; a human with a choice to make is asked. */
export function chooseDoor(ctx: Ctx, action: Extract<Action, { t: 'ChooseDoor' }>): void {
  const { s } = ctx;
  const { playerId, door } = action;
  if (s.phase !== 'explore' || !s.explore) throw new ActionError('Nothing to explore now', action);
  if (s.activePlayer !== playerId) throw new ActionError(`It is not ${playerId}'s turn`, action);
  if (s.pendingEvent) throw new ActionError('Resolve your event first', action);
  if (!Number.isInteger(door) || door < 0 || door > 2)
    throw new ActionError('No such door', action);
  const planet = currentPlanet(s);
  const p = player(s, playerId);
  const rng = mulberry32(s.explore.seeds[playerId] ?? 0);
  s.explore.picks[playerId] = door;
  log(s, `${p.name} goes to ${planet.exploreDoors[door]!.name}.`, playerId);

  const { cards, weights } = deckFor(s, door);
  let drawn: { card: EventCard; params: EventCtx['params'] } | null = null;
  // A card that cannot apply to this stable (nothing in the hold to spoil, no dog with three wins)
  // is put back and another drawn — twelve tries, as the arrival draw always allowed.
  for (let attempt = 0; attempt < 12 && cards.length && !drawn; attempt++) {
    const card = rng.pickWeighted(cards, weights);
    const params = card.roll ? card.roll(eventCtx(s, ctx, rng, playerId, {})) : {};
    if (params) drawn = { card, params };
  }
  if (!drawn) {
    s.explore.cards[playerId] = '';
    log(s, 'Nothing doing. You have a look round and leave.', playerId);
    passOn(ctx, playerId);
    return;
  }
  const { card, params } = drawn;
  s.explore.cards[playerId] = card.id;
  if (card.unique) s.explore.taken.push(card.id);
  const ectx = eventCtx(s, ctx, rng, playerId, params);
  if (card.choices.length > 1 && p.kind === 'human') {
    s.pendingEvent = {
      playerId,
      eventId: card.id,
      params,
      choices: choiceLabels(card, ectx),
      ...(card.detail ? { detail: card.detail(ectx) } : {}),
      door,
      rng: rng.state(),
    };
    return;
  }
  const choice = card.choices.length > 1 && card.aiChoice ? card.aiChoice(ectx) : 0;
  applyChoice(ectx, card, choice);
  passOn(ctx, playerId);
}

export function resolveEvent(ctx: Ctx, playerId: Id, choice: number): void {
  const { s } = ctx;
  const pending = s.pendingEvent;
  if (!pending || pending.playerId !== playerId) {
    throw new ActionError('No event waiting for this player', {
      t: 'ResolveEvent',
      playerId,
      choice,
    });
  }
  const card = EVENT_BY_ID[pending.eventId];
  if (!card) throw new Error('Unknown event ' + pending.eventId);
  if (!Number.isInteger(choice) || choice < 0 || choice >= card.choices.length) {
    throw new ActionError('Bad event choice', { t: 'ResolveEvent', playerId, choice });
  }
  s.pendingEvent = null;
  applyChoice(eventCtx(s, ctx, mulberry32(pending.rng), playerId, pending.params), card, choice);
  passOn(ctx, playerId);
}

/**
 * The choice a Normal AI would take on the card waiting for this stable — for a human seat played by
 * a script (season-check, hub-clicks), so it answers the way an AI would rather than always "0".
 * Runs on a copy of the stable's stream and changes nothing.
 */
export function aiChoiceFor(s: GameState, playerId: Id): number {
  const pending = s.pendingEvent;
  if (!pending || pending.playerId !== playerId) return 0;
  const card = EVENT_BY_ID[pending.eventId];
  if (!card?.aiChoice) return 0;
  const noIds = () => {
    throw new Error('aiChoice may not make things');
  };
  const ectx: EventCtx = {
    s,
    rng: mulberry32(pending.rng),
    nextId: noIds,
    p: player(s, playerId),
    planet: currentPlanet(s),
    params: pending.params,
    log: () => {},
  };
  return card.aiChoice(ectx);
}

/** This stable has explored; hand the turn on, or open the market once everybody has. */
function passOn(ctx: Ctx, playerId: Id): void {
  const { s } = ctx;
  const i = s.turnOrder.indexOf(playerId);
  const next = s.turnOrder.slice(i + 1).find((id) => s.explore!.picks[id] === undefined);
  if (next) {
    s.activePlayer = next;
    return;
  }
  s.activePlayer = null;
  startPlayerPhase(s, 'planetPre');
}
