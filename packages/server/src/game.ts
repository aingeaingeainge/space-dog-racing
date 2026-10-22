/**
 * The room's game logic with no Durable Object in it, so the server's own tests run it under Node:
 * who is on the clock, the two queued actions (§5.1), driving AI seats, stand-ins and system phases
 * after a press (§2.3), and the view's top-level diff (§2.4).
 */
import {
  ActionError,
  decide,
  isSeasonOver,
  needsAdvance,
  onTheClock,
  reduceMut,
  waitingOn,
  type Action,
  type GameState,
  type Id,
} from '@sdr/engine';
import { MAX_ACTIONS } from './guard';

/**
 * Who the table is waiting on (`meta.clock`): nobody while the system moves or once it is over.
 *
 * ⚠️ **Phase T (GDD_V3 T1): every part of a weekend is played at once** — the planet, the Bookie (as
 * since E8) and after the races — so every stable not yet finished is on the clock together. Only the
 * drafts are in turn order (Phase N): there the stable on the clock is the one picking.
 */
export function clockOf(s: GameState): Id[] {
  return onTheClock(s);
}

export type QueueKind = 'door' | 'flyOn';

/**
 * Would the room **hold** this action rather than apply it (§5.1)?
 *
 * ⚠️ **Never, since Phase T.** The room used to hold a door picked before its seat's turn at Explore
 * and a "Fly on" pressed before its turn after the races. Everybody plays the weekend at once now, so
 * no seat is ever waiting for its turn to do either: the engine takes the action at once. The queue's
 * plumbing is kept (the room's storage, `meta.queued`) so that a change of mind is one line here.
 */
export function queueKind(s: GameState, seat: Id, a: Action): QueueKind | null {
  void s;
  void seat;
  void a;
  return null;
}

/** A held action, with the `seq` of the `act` that sent it, for the `rejected` if it is dropped. */
export interface Queued {
  kind: QueueKind;
  action: Action;
  seq?: number;
}

export interface DriveSeats {
  /** Human seats a stand-in is playing (§5.3). */
  standIn: ReadonlySet<Id>;
  /** Held actions by seat. `driveRoom` removes each one it applies or drops. */
  queue: Map<Id, Queued>;
}

export interface DriveOutcome {
  /** Queued actions the engine refused when their turn came: the seat is sent `rejected`. */
  dropped: { seat: Id; seq?: number; error: string }[];
  /** Seats a stand-in played, with the weekend (`season:week`) it played them in. */
  stoodIn: { seat: Id; weekend: string }[];
}

function appliedAll(s: GameState, actions: readonly Action[], log: Action[]): void {
  for (const a of actions) {
    reduceMut(s, a);
    log.push(a);
  }
}

/**
 * Drive a room's game **in place** after an accepted press, as `store/loop.ts`'s `applyActions` does
 * in the browser, until a human is on the clock or the game is over: system phases advance, AI seats
 * act through `decide`, and two things a browser's loop does not have —
 *
 * - **a held action** is applied the moment its seat comes on the clock, on a copy, so a refusal
 *   (the seat has since been handed a card, say) throws nothing away but the action itself;
 * - **a stand-in** plays its seat with `decide(state, seat, 'normal')` whenever the seat is on the
 *   clock. `decide` returns a whole sitting, so a sitting is never split, and a human who comes back
 *   takes over at their next decision (in a draft a sitting is one pick). At the Bookie a stood-in
 *   seat plays when the engine's turn order reaches it, as an AI seat does: `decide` plays only the active
 *   stable, and a human ahead of it in the order is still free to bet first.
 *
 * Every action applied is pushed to `log`, `AdvancePhase`s included, so `replay` is exact.
 */
export function driveRoom(s: GameState, log: Action[], seats: DriveSeats): DriveOutcome {
  const out: DriveOutcome = { dropped: [], stoodIn: [] };
  const stood = (seat: Id) => out.stoodIn.push({ seat, weekend: `${s.season}:${s.week}` });
  for (let steps = 0; steps < 100_000; steps++) {
    if (isSeasonOver(s)) return out;
    if (needsAdvance(s)) {
      appliedAll(s, [{ t: 'AdvancePhase' }], log);
      continue;
    }
    // Phase T: in a part of the weekend everybody plays at once, play every AI and every stood-in
    // seat still at it, in seating order, before waiting on a human; in a draft, whoever picks.
    const clock = onTheClock(s);
    if (!clock.length) throw new Error(`Engine stalled in phase ${s.phase}`);
    const who =
      clock.find((id) => seats.queue.has(id)) ??
      clock.find((id) => s.players.find((q) => q.id === id)?.kind === 'ai') ??
      clock.find((id) => seats.standIn.has(id)) ??
      waitingOn(s) ??
      clock[0]!;
    const held = seats.queue.get(who);
    if (held) {
      seats.queue.delete(who);
      const copy = structuredClone(s);
      try {
        reduceMut(copy, held.action);
      } catch (e) {
        out.dropped.push({
          seat: who,
          ...(held.seq !== undefined ? { seq: held.seq } : {}),
          error: message(e),
        });
        continue;
      }
      Object.assign(s, copy);
      log.push(held.action);
      continue;
    }
    const p = s.players.find((q) => q.id === who)!;
    if (p.kind === 'ai' || seats.standIn.has(who)) {
      if (p.kind === 'human') stood(who);
      const actions = decide(s, who, p.kind === 'ai' ? p.difficulty : 'normal');
      if (!actions.length) throw new Error(`${who} returned no actions in ${s.phase}`);
      appliedAll(s, actions, log);
      continue;
    }
    return out;
  }
  throw new Error('driveRoom exceeded its steps');
}

export function message(e: unknown): string {
  if (e instanceof ActionError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Check a browser's `act` before the engine sees it (§2.4): its own seat only, and never
 * `AdvancePhase`. Returns why not, or null.
 */
export function refuseAct(seat: Id, actions: unknown): string | null {
  if (!Array.isArray(actions) || actions.length === 0) return 'Nothing to do';
  if (actions.length > MAX_ACTIONS) return 'Too many actions at once';
  for (const a of actions as Action[]) {
    if (!a || typeof a !== 'object' || typeof a.t !== 'string') return 'Not an action';
    if (a.t === 'AdvancePhase') return 'Only the room moves the game on';
    if (a.playerId !== seat) return 'That is not your stable';
  }
  return null;
}

/** A view's top-level fields as JSON, for the diff. */
export function fieldsOf(view: GameState): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(view)) if (v !== undefined) out.set(k, JSON.stringify(v));
  return out;
}

/**
 * The top-level fields of `next` that differ from `prev`, as a ready-made JSON object body, or null
 * when the set of fields itself changed (then the room sends the view whole).
 */
export function patchOf(prev: Map<string, string>, next: Map<string, string>): string | null {
  if (prev.size !== next.size) return null;
  const parts: string[] = [];
  for (const [k, v] of next) {
    const was = prev.get(k);
    if (was === undefined) return null;
    if (was !== v) parts.push(`${JSON.stringify(k)}:${v}`);
  }
  return `{${parts.join(',')}}`;
}

/** The whole view as a JSON object body, from its fields. */
export function wholeOf(fields: Map<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of fields) parts.push(`${JSON.stringify(k)}:${v}`);
  return `{${parts.join(',')}}`;
}

/**
 * The colours `createSeason` will give each row (humans first, with their faces; AI rows on their
 * seat index, bumped past a taken one), so the lobby shows the faces the game will have.
 */
export function seatColours(rows: readonly { colour?: number }[]): number[] {
  const used = new Set<number>();
  return rows.map((r, i) => {
    let c = r.colour ?? i;
    while (used.has(c)) c = (c + 1) % 8;
    used.add(c);
    return c;
  });
}
