/**
 * **The wire between a browser and a room** (ONLINE_PLAN §2.4), in one file both sides import, so the
 * two cannot drift. Type-only: no Worker imports and no runtime code, so the web's online store (L3)
 * can import it under Vite as it is.
 *
 * JSON text frames. Every client → room message may carry `seq`, and the reply to it — the `view`
 * sent to that socket, a `rejected`, or the `welcome` — echoes it. `v` is the engine's
 * `PROTOCOL_VERSION` (§7): a `hello` whose `v` is not the room's gets `reload` and nothing else.
 */
import type { Action, AiAgent, GameLength, GameState, Id, SeasonSetup } from '@sdr/engine';

// ── Client → room ────────────────────────────────────────────────────────────────────────────────

/**
 * On every (re)connect. With a `token`, take that seat back, before or after Start. Without one, a
 * `name` and a `colour` (a face, 0–7) take a new seat in the lobby; after Start that is refused.
 */
export interface HelloMsg {
  t: 'hello';
  v: number;
  seq?: number;
  token?: string;
  name?: string;
  colour?: number;
}

/** Any game action, for the socket's own seat only. `AdvancePhase` is the room's, never a browser's. */
export interface ActMsg {
  t: 'act';
  seq?: number;
  actions: Action[];
}

/** Anybody, at a seat on the clock: that seat is sent `nudged`, at most once a minute (§5.1). */
export interface NudgeMsg {
  t: 'nudge';
  seq?: number;
  seat: Id;
}

/** The host, before Start: the length and the AI rows. Either may be left out to keep it. */
export interface LobbyMsg {
  t: 'lobby';
  seq?: number;
  length?: GameLength;
  ai?: { difficulty: AiAgent }[];
}

/** The host, once: 3–8 stables, at least one human. */
export interface StartMsg {
  t: 'start';
  seq?: number;
}

/**
 * The host, or while the host is away the next connected human in seat order (§5.3, V26): let a
 * Normal AI play a **disconnected** human seat until its human is back.
 */
export interface StandInMsg {
  t: 'standIn';
  seq?: number;
  seat: Id;
  on: boolean;
}

export type ClientMsg = HelloMsg | ActMsg | NudgeMsg | LobbyMsg | StartMsg | StandInMsg;

// ── Room → client ────────────────────────────────────────────────────────────────────────────────

/** A room that cannot trust its log (§7): its `STATE_VERSION` is not the engine's. It plays no more. */
export interface StaleRoom {
  /** The `STATE_VERSION` the room started on, and the one this build's engine is. */
  stateVersion: number;
  engineVersion: number;
  /** The last standings the room stored, richest first, and the week they were read. */
  standings: { name: string; netWorth: number }[];
  season: number;
  week: number;
}

export interface WelcomeMsg {
  t: 'welcome';
  v: number;
  seq?: number;
  code: string;
  seat: Id;
  /** Keep it (L3: `localStorage`, under the room code): it is the only way back into this seat. */
  token: string;
  host: boolean;
  /** Present only on a room that cannot play on (§7). */
  stale?: StaleRoom;
}

export interface LobbySeat {
  seat: Id;
  name: string;
  colour: number;
  kind: 'human' | 'ai';
  difficulty?: AiAgent;
  /** A human with a socket open. AI rows are always true. */
  online: boolean;
}

export interface LobbyStateMsg {
  t: 'lobby';
  /** Echoed to the socket whose `hello` or `lobby` changed it. */
  seq?: number;
  seats: LobbySeat[];
  length: GameLength;
  host: Id;
  started: boolean;
}

/** What the view does not carry and the room knows (§2.4). */
export interface RoomMeta {
  /**
   * Who the table is waiting on, and since when (epoch ms). One seat in turn order; every stable
   * not yet finished at the Bookie and in the off-season (any order, E8 and L1a). Empty between
   * a game's end and nothing.
   */
  clock: { seats: Id[]; since: number };
  /** Human seats with a socket open. */
  online: Id[];
  /** Human seats a stand-in is playing now. */
  standIn: Id[];
  /** Per human seat that has had one: how many weekends a stand-in played (L3's report line). */
  standInWeekends: Record<Id, number>;
  /** A door or a "Fly on" the room is holding for a seat until it comes on the clock (§5.1). */
  queued: Record<Id, 'door' | 'flyOn'>;
  host: Id;
}

/**
 * The seat's `viewFor` (§3). `full: true` is the whole view, on `hello` and whenever the room has no
 * record of what this socket last saw (after a wake). Otherwise `patch` holds **only the top-level
 * fields that changed** since this socket's last view, compared as JSON, and the client replaces
 * those fields. `rev` is the log's length. A `view` with an empty patch is a change of `meta` alone.
 */
export interface ViewMsg {
  t: 'view';
  seq?: number;
  rev: number;
  full: boolean;
  patch: Partial<GameState>;
  meta: RoomMeta;
}

export interface RejectedMsg {
  t: 'rejected';
  seq?: number;
  error: string;
}

export interface NudgedMsg {
  t: 'nudged';
  by: string;
}

/** Game over (§2.6): the secrets are not secret any more, so the whole setup and log. */
export interface EndedMsg {
  t: 'ended';
  setup: SeasonSetup;
  log: Action[];
}

/** The browser's build is not the room's. `need` is the room's `PROTOCOL_VERSION`. */
export interface ReloadMsg {
  t: 'reload';
  seq?: number;
  need: number;
}

export type RoomMsg =
  WelcomeMsg | LobbyStateMsg | ViewMsg | RejectedMsg | NudgedMsg | EndedMsg | ReloadMsg;

// ── Dev only ─────────────────────────────────────────────────────────────────────────────────────

/**
 * **Not part of the protocol.** Answered only by a room running under `wrangler dev` with the
 * `DEV_DEBUG` var set to `1` (`online-walk.ts` passes `--var DEV_DEBUG:1`); anywhere else it is
 * `rejected` like any unknown message. `hash` is SHA-256 over `JSON.stringify(state)`; `wakeMs` is
 * how long the room's last wake took to read and replay its log. `stale` marks the room as started
 * on an older `STATE_VERSION`, to test §7.
 */
export interface DebugMsg {
  t: 'debug';
  seq?: number;
  op: 'hash' | 'stale';
}

export interface DebugReplyMsg {
  t: 'debug';
  seq?: number;
  rev: number;
  hash: string;
  wakeMs: number;
  /** Of `wakeMs`, reading the rows back (the rest is `replay`). */
  readMs: number;
  logRows: number;
}
