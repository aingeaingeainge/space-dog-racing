import { EVENTS, EVENT_BY_ID, type EventCard, type EventCtx } from '../content/events';
import { currentPlanet, log, player, type Ctx } from '../state';
import { ActionError, type Id } from '../types';
import { startPlayerPhase } from './turn';

function eventCtx(ctx: Ctx, playerId: Id, params: EventCtx['params']): EventCtx {
  const p = player(ctx.s, playerId);
  return {
    s: ctx.s,
    rng: ctx.rng,
    nextId: ctx.nextId,
    p,
    planet: currentPlanet(ctx.s),
    params,
    log: (text) => log(ctx.s, text, playerId),
  };
}

function drawCard(ctx: Ctx, playerId: Id): { card: EventCard; params: EventCtx['params'] } | null {
  const { s, rng } = ctx;
  const planet = currentPlanet(s);
  const deck = EVENTS.filter((e) => !(s.toggles.casualEvents && e.kind === 'swing'));
  const weights = deck.map((e) => {
    let w = e.weight;
    if (e.planets?.includes(planet.id)) w *= e.planetBoost ?? 3;
    return w;
  });
  for (let attempt = 0; attempt < 12; attempt++) {
    const card = rng.pickWeighted(deck, weights);
    const base = eventCtx(ctx, playerId, {});
    const params = card.roll ? card.roll(base) : {};
    if (params) return { card, params };
  }
  return null;
}

function applyChoice(
  ctx: Ctx,
  playerId: Id,
  card: EventCard,
  params: EventCtx['params'],
  choice: number,
): void {
  const c = card.choices[choice] ?? card.choices[0]!;
  const ectx = eventCtx(ctx, playerId, params);
  log(ctx.s, `Event: ${card.name} — ${c.label}.`, playerId);
  c.apply(ectx);
}

/** Draw for everyone still in the queue; stop when a human must choose. */
export function drawEvents(ctx: Ctx): void {
  const { s } = ctx;
  while (s.eventQueue.length && !s.pendingEvent) {
    const playerId = s.eventQueue.shift()!;
    const p = player(s, playerId);
    const drawn = drawCard(ctx, playerId);
    if (!drawn) continue;
    const { card, params } = drawn;
    if (card.choices.length > 1) {
      if (p.kind === 'ai') {
        const choice = card.aiChoice ? card.aiChoice(eventCtx(ctx, playerId, params)) : 0;
        applyChoice(ctx, playerId, card, params, choice);
      } else {
        s.pendingEvent = {
          playerId,
          eventId: card.id,
          params,
          choices: card.choices.map((c) => c.label),
        };
        s.activePlayer = playerId;
        return;
      }
    } else {
      applyChoice(ctx, playerId, card, params, 0);
    }
  }
  if (!s.eventQueue.length && !s.pendingEvent) startPlayerPhase(s, 'planetPre');
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
  if (choice < 0 || choice >= card.choices.length) {
    throw new ActionError('Bad event choice', { t: 'ResolveEvent', playerId, choice });
  }
  s.pendingEvent = null;
  s.activePlayer = null;
  applyChoice(ctx, playerId, card, pending.params, choice);
  drawEvents(ctx);
}
