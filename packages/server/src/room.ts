/**
 * **`Room`, one Durable Object per game** (ONLINE_PLAN §2). It holds the setup and the log in SQLite,
 * rebuilds the state from them on every wake, checks each press with the engine, drives the AI seats,
 * the stand-ins and the system phases, and sends each socket its own seat's view.
 *
 * WebSocket Hibernation API throughout: the object can be evicted between messages with every
 * socket still open, and the next message wakes a fresh instance that replays. So nothing here may
 * live only in memory that a player would miss: the queue is stored too. What does live only in
 * memory is a cache — the state, what each socket last saw (a missing record just means the next
 * view is sent whole) and the nudge clock.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  createSeason,
  gameLengthOf,
  netWorth,
  PROTOCOL_VERSION,
  reduceMut,
  replay,
  STATE_VERSION,
  viewFor,
  type Action,
  type AiAgent,
  type GameLength,
  type GameState,
  type Id,
  type SeasonSetup,
} from '@sdr/engine';
import { codeFrom } from './code';
import { frameTooBig, seqOf } from './guard';
import {
  clockOf,
  driveRoom,
  fieldsOf,
  message,
  patchOf,
  queueKind,
  refuseAct,
  seatColours,
  wholeOf,
  type Queued,
} from './game';
import type {
  ClientMsg,
  DebugMsg,
  DebugReplyMsg,
  LobbySeat,
  LobbyStateMsg,
  RoomMeta,
  RoomMsg,
  StaleRoom,
} from './protocol';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  /** Set only by `wrangler dev --var DEV_DEBUG:1`: answers the dev-only `debug` message. */
  DEV_DEBUG?: string;
  /** `v3l4`: the pages that may make a room or open a socket, comma-separated (`guard.ts`). */
  ALLOWED_ORIGINS?: string;
}

/** §2.2: a room is deleted 30 days after its last action. */
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const NUDGE_EVERY_MS = 60 * 1000;
const MAX_STABLES = 8;
const MIN_STABLES = 3;
const DIFFICULTIES: readonly AiAgent[] = ['easy', 'normal', 'hard'];

interface RoomRow {
  code: string;
  createdAt: number;
  host: Id | null;
  protocol: number;
  stateVersion: number;
  length: GameLength;
  ai: { difficulty: AiAgent }[];
  clockSince: number;
  /** What `clockSince` is the start of: season, week, phase and the seats on the clock. */
  clockKey?: string;
  standings: StaleRoom['standings'];
  standingsAt: { season: number; week: number };
  /** *`v3l3`:* Play again made this room's successor (§2.6). Every later `hello` is sent there. */
  movedTo?: string;
}

/** What an old room hands its successor (§2.6): the same seats, AI rows, length and setup. */
interface Successor {
  host: Id;
  seats: SeatRow[];
  length: GameLength;
  ai: { difficulty: AiAgent }[];
  setup: SeasonSetup;
}

interface SeatRow {
  id: Id;
  name: string;
  colour: number;
  token: string;
  standIn: boolean;
  /** The weekends (`season:week`) a stand-in played this seat. */
  standInWeekends: string[];
}

interface Attachment {
  seat: Id | null;
  /** A socket that said a look-only `hello` (§5.5): it is sent the lobby, and nothing else. */
  looking?: boolean;
}

type Socket = WebSocket;

function randomToken(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export class Room extends DurableObject<Env> {
  private sql: SqlStorage;
  private loaded = false;
  private room: RoomRow | null = null;
  private seats: SeatRow[] = [];
  private setup: SeasonSetup | null = null;
  private log: Action[] = [];
  private state: GameState | null = null;
  private queue = new Map<Id, Queued>();
  /** A room whose log this engine cannot trust (§7). */
  private stale = false;
  private wakeMs = 0;
  private readMs = 0;
  private lastSeen = new Map<Socket, Map<string, string>>();
  private nudgedAt = new Map<Id, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql
      .exec(`CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS seats (ord INTEGER PRIMARY KEY, id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS setup (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (i INTEGER PRIMARY KEY, action TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS queue (seat TEXT PRIMARY KEY, json TEXT NOT NULL);`);
  }

  /**
   * *`v3l4`:* one line to Workers Logs, so a stalled room can be read afterwards. The room's code and
   * what happened, never a name or anything else a player typed.
   */
  private note(event: string, extra: Record<string, string | number | boolean> = {}): void {
    console.log(JSON.stringify({ room: this.room?.code ?? '?', event, ...extra }));
  }

  // ── Storage ────────────────────────────────────────────────────────────────────────────────────

  /** Read the room back and, if it has started, rebuild the state: `replay(createSeason(setup), log)`. */
  private load(): void {
    if (this.loaded) return;
    const t0 = Date.now();
    const room = this.sql.exec<{ json: string }>('SELECT json FROM room').toArray()[0];
    this.room = room ? (JSON.parse(room.json) as RoomRow) : null;
    this.seats = this.sql
      .exec<{ json: string }>('SELECT json FROM seats ORDER BY ord')
      .toArray()
      .map((r) => JSON.parse(r.json) as SeatRow);
    const setup = this.sql.exec<{ json: string }>('SELECT json FROM setup').toArray()[0];
    this.setup = setup ? (JSON.parse(setup.json) as SeasonSetup) : null;
    this.queue = new Map(
      this.sql
        .exec<{ seat: string; json: string }>('SELECT seat, json FROM queue')
        .toArray()
        .map((r) => [r.seat, JSON.parse(r.json) as Queued]),
    );
    this.stale = !!this.room && this.room.stateVersion !== STATE_VERSION;
    this.log = [];
    this.state = null;
    let t1 = Date.now();
    if (this.setup && !this.stale) {
      this.log = this.sql
        .exec<{ action: string }>('SELECT action FROM log ORDER BY i')
        .toArray()
        .map((r) => JSON.parse(r.action) as Action);
      t1 = Date.now();
      this.state = replay(createSeason(this.setup), this.log);
    }
    this.readMs = t1 - t0;
    this.wakeMs = Date.now() - t0;
    this.loaded = true;
    if (this.room)
      this.note('wake', {
        rows: this.log.length,
        ms: this.wakeMs,
        ...(this.stale ? { stale: this.room.stateVersion } : {}),
      });
  }

  private saveRoom(): void {
    this.sql.exec(
      'INSERT OR REPLACE INTO room (id, json) VALUES (1, ?)',
      JSON.stringify(this.room),
    );
  }

  private saveSeat(ord: number): void {
    const seat = this.seats[ord]!;
    this.sql.exec(
      'INSERT OR REPLACE INTO seats (ord, id, json) VALUES (?, ?, ?)',
      ord,
      seat.id,
      JSON.stringify(seat),
    );
  }

  private saveQueue(): void {
    this.sql.exec('DELETE FROM queue');
    for (const [seat, q] of this.queue)
      this.sql.exec('INSERT INTO queue (seat, json) VALUES (?, ?)', seat, JSON.stringify(q));
  }

  /** Append to the log, one row per action, and push the room's deletion 30 days out. */
  private appendLog(from: number): void {
    for (let i = from; i < this.log.length; i++)
      this.sql.exec('INSERT INTO log (i, action) VALUES (?, ?)', i, JSON.stringify(this.log[i]));
    void this.ctx.storage.setAlarm(Date.now() + LIFETIME_MS);
  }

  override async alarm(): Promise<void> {
    this.load();
    this.note('expired');
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'This room has closed');
    await this.ctx.storage.deleteAll();
    this.loaded = false;
  }

  // ── HTTP: create, and the WebSocket upgrade ────────────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    this.load();
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/create') {
      if (this.room) return new Response('taken', { status: 409 });
      const code = request.headers.get('x-room-code') ?? '';
      this.room = {
        code,
        createdAt: Date.now(),
        host: null,
        protocol: PROTOCOL_VERSION,
        stateVersion: STATE_VERSION,
        length: { kind: 'seasons', seasons: 1 },
        ai: [],
        clockSince: Date.now(),
        standings: [],
        standingsAt: { season: 0, week: 0 },
      };
      this.saveRoom();
      await this.ctx.storage.setAlarm(Date.now() + LIFETIME_MS);
      this.note('created');
      return new Response(code, { status: 201 });
    }
    if (request.method === 'POST' && url.pathname === '/successor') {
      // Play again (§2.6), asked by the old room: the same seats and setup, started at once.
      if (this.room) return new Response('taken', { status: 409 });
      const code = request.headers.get('x-room-code') ?? '';
      const from = (await request.json()) as Successor;
      this.room = {
        code,
        createdAt: Date.now(),
        host: from.host,
        protocol: PROTOCOL_VERSION,
        stateVersion: STATE_VERSION,
        length: from.length,
        ai: from.ai,
        clockSince: Date.now(),
        standings: [],
        standingsAt: { season: 0, week: 0 },
      };
      this.saveRoom();
      this.seats = from.seats.map((x) => ({ ...x, standIn: false, standInWeekends: [] }));
      this.seats.forEach((_, ord) => this.saveSeat(ord));
      await this.ctx.storage.setAlarm(Date.now() + LIFETIME_MS);
      this.note('created', { playAgain: true });
      this.begin(from.setup);
      return new Response(code, { status: 201 });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Expected a WebSocket', { status: 426 });
    if (!this.room) return new Response('No such room', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Sockets ────────────────────────────────────────────────────────────────────────────────────

  private seatOf(ws: Socket): Id | null {
    return (ws.deserializeAttachment() as Attachment | null)?.seat ?? null;
  }

  private open(): Socket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  private online(except?: Socket): Set<Id> {
    const out = new Set<Id>();
    for (const ws of this.open()) {
      if (ws === except) continue;
      const seat = this.seatOf(ws);
      if (seat) out.add(seat);
    }
    return out;
  }

  private send(ws: Socket, msg: RoomMsg | DebugReplyMsg): void {
    this.sendRaw(ws, JSON.stringify(msg));
  }

  private sendRaw(ws: Socket, text: string): void {
    try {
      ws.send(text);
    } catch {
      // A socket closing under us: its close handler tidies up.
    }
  }

  private reject(ws: Socket, error: string, seq?: number): void {
    this.send(ws, { t: 'rejected', ...(seq !== undefined ? { seq } : {}), error });
  }

  override async webSocketMessage(ws: Socket, data: string | ArrayBuffer): Promise<void> {
    this.load();
    // `v3l4`: a frame over 16 KB is refused unread; the room and the socket carry on.
    if (frameTooBig(data)) {
      const seq = seqOf(data);
      this.note('refused', { why: 'frame too big' });
      return this.reject(ws, 'That message is too big', seq);
    }
    let msg: ClientMsg | DebugMsg;
    try {
      msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)) as
        ClientMsg | DebugMsg;
    } catch {
      this.reject(ws, 'Not JSON');
      return;
    }
    if (!msg || typeof msg !== 'object') return this.reject(ws, 'Not a message');
    const seq = typeof msg.seq === 'number' ? msg.seq : undefined;
    try {
      if (msg.t === 'hello') return this.hello(ws, msg, seq);
      if (msg.t === 'debug' && this.env.DEV_DEBUG === '1') return await this.debug(ws, msg, seq);
      const seat = this.seatOf(ws);
      if (!seat) return this.reject(ws, 'Say hello first', seq);
      if (this.stale) return this.reject(ws, this.staleText(), seq);
      switch (msg.t) {
        case 'act':
          return this.act(ws, seat, msg.actions, seq);
        case 'nudge':
          return this.nudge(ws, seat, msg.seat, seq);
        case 'lobby':
          return this.lobby(ws, seat, msg, seq);
        case 'start':
          return this.start(ws, seat, seq);
        case 'standIn':
          return this.standIn(ws, seat, msg.seat, msg.on, seq);
        case 'playAgain':
          return await this.playAgain(ws, seat, seq);
        default:
          return this.reject(ws, `No such message: ${String((msg as { t: unknown }).t)}`, seq);
      }
    } catch (e) {
      this.note('error', { message: message(e).slice(0, 200) });
      this.reject(ws, `The room could not do that: ${message(e)}`, seq);
    }
  }

  override async webSocketClose(ws: Socket, code: number, reason: string): Promise<void> {
    this.load();
    this.lastSeen.delete(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, reason);
    } catch {
      // Already closed.
    }
    this.broadcast(ws);
  }

  override async webSocketError(ws: Socket): Promise<void> {
    this.lastSeen.delete(ws);
    this.broadcast(ws);
  }

  // ── hello (§2.5, §5.5, §7) ─────────────────────────────────────────────────────────────────────

  private hello(ws: Socket, msg: Extract<ClientMsg, { t: 'hello' }>, seq?: number): void {
    const room = this.room!;
    if (msg.v !== PROTOCOL_VERSION) {
      this.send(ws, { t: 'reload', ...(seq !== undefined ? { seq } : {}), need: PROTOCOL_VERSION });
      return;
    }
    // Play again moved this game on (§2.6): the same token is a seat in the successor.
    if (room.movedTo) {
      this.send(ws, { t: 'moved', ...(seq !== undefined ? { seq } : {}), code: room.movedTo });
      return;
    }
    const looking =
      !(typeof msg.token === 'string' && msg.token) &&
      msg.name === undefined &&
      msg.colour === undefined;
    if (looking) {
      // *`v3l3`:* a browser at the door, only looking: the lobby, and every change to it, but no
      // seat. How a joiner sees the faces taken before sitting down (§5.5).
      ws.serializeAttachment({ seat: null, looking: true } satisfies Attachment);
      this.send(ws, { ...this.lobbyMsg(), ...(seq !== undefined ? { seq } : {}) });
      return;
    }
    let ord = -1;
    if (typeof msg.token === 'string' && msg.token) {
      ord = this.seats.findIndex((s) => s.token === msg.token);
      if (ord < 0) return this.reject(ws, 'That seat is not in this room', seq);
    } else {
      if (this.setup)
        return this.reject(ws, 'This game has started: only its players can rejoin', seq);
      if (this.seats.length + room.ai.length >= MAX_STABLES)
        return this.reject(ws, 'The table is full', seq);
      const name = typeof msg.name === 'string' ? msg.name.trim() : '';
      const colour = msg.colour;
      if (!name || name.length > 24)
        return this.reject(ws, 'A name, please (up to 24 letters)', seq);
      if (!Number.isInteger(colour) || colour! < 0 || colour! > 7)
        return this.reject(ws, 'Pick a face', seq);
      if (this.seats.some((s) => s.colour === colour))
        return this.reject(ws, 'That face is taken', seq);
      ord = this.seats.length;
      this.seats.push({
        id: `p${ord + 1}`,
        name,
        colour: colour!,
        token: randomToken(),
        standIn: false,
        standInWeekends: [],
      });
      this.saveSeat(ord);
      if (!room.host) {
        room.host = this.seats[ord]!.id;
        this.saveRoom();
      }
    }
    const seat = this.seats[ord]!;
    ws.serializeAttachment({ seat: seat.id } satisfies Attachment);
    this.lastSeen.delete(ws);
    this.send(ws, {
      t: 'welcome',
      v: PROTOCOL_VERSION,
      ...(seq !== undefined ? { seq } : {}),
      code: room.code,
      seat: seat.id,
      token: seat.token,
      host: room.host === seat.id,
      ...(this.stale ? { stale: this.staleRoom() } : {}),
    });
    if (this.stale) return;
    // Back in the seat: the stand-in hands straight back, at the seat's next decision (§5.3). It
    // never holds a seat on the clock (it plays the moment the seat comes up), so there is nothing
    // to drive: the human simply has the next decision.
    if (seat.standIn) {
      seat.standIn = false;
      this.saveSeat(ord);
    }
    if (!this.setup) return this.broadcastLobby();
    this.broadcast(undefined, ws, seq);
    if (this.state?.phase === 'seasonEnd') this.send(ws, this.ended());
  }

  private staleRoom(): StaleRoom {
    const r = this.room!;
    return {
      stateVersion: r.stateVersion,
      engineVersion: STATE_VERSION,
      standings: r.standings,
      season: r.standingsAt.season,
      week: r.standingsAt.week,
    };
  }

  private staleText(): string {
    return `This room was started on an older version of the game (${this.room!.stateVersion}, now ${STATE_VERSION}) and cannot play on.`;
  }

  // ── The lobby (§5.5) ───────────────────────────────────────────────────────────────────────────

  private lobbySeats(): LobbySeat[] {
    const room = this.room!;
    const online = this.online();
    const rows = [...this.seats.map((s) => ({ colour: s.colour })), ...room.ai.map(() => ({}))];
    const colours = seatColours(rows);
    return [
      ...this.seats.map((s, i) => ({
        seat: s.id,
        name: s.name,
        colour: colours[i]!,
        kind: 'human' as const,
        online: online.has(s.id),
      })),
      ...room.ai.map((a, i) => ({
        seat: `p${this.seats.length + i + 1}`,
        name: '',
        colour: colours[this.seats.length + i]!,
        kind: 'ai' as const,
        difficulty: a.difficulty,
        online: true,
      })),
    ];
  }

  private lobbyMsg(): LobbyStateMsg {
    const room = this.room!;
    return {
      t: 'lobby',
      seats: this.lobbySeats(),
      length: room.length,
      host: room.host ?? '',
      started: !!this.setup,
    };
  }

  private looking(ws: Socket): boolean {
    return !!(ws.deserializeAttachment() as Attachment | null)?.looking;
  }

  private broadcastLobby(replyTo?: Socket, seq?: number): void {
    const msg = this.lobbyMsg();
    const text = JSON.stringify(msg);
    for (const ws of this.open()) {
      if (!this.seatOf(ws) && !this.looking(ws)) continue;
      if (ws === replyTo && seq !== undefined) this.send(ws, { ...msg, seq });
      else this.sendRaw(ws, text);
    }
  }

  private lobby(ws: Socket, seat: Id, msg: Extract<ClientMsg, { t: 'lobby' }>, seq?: number): void {
    const room = this.room!;
    if (this.setup) return this.reject(ws, 'The game has started', seq);
    if (seat !== room.host) return this.reject(ws, 'Only the host sets the table', seq);
    let length = room.length;
    if (msg.length !== undefined) {
      try {
        length = gameLengthOf({ length: msg.length });
      } catch (e) {
        return this.reject(ws, message(e), seq);
      }
    }
    let ai = room.ai;
    if (msg.ai !== undefined) {
      if (!Array.isArray(msg.ai) || msg.ai.some((a) => !DIFFICULTIES.includes(a?.difficulty)))
        return this.reject(ws, 'An AI is Easy, Normal or Hard', seq);
      ai = msg.ai.map((a) => ({ difficulty: a.difficulty }));
    }
    if (this.seats.length + ai.length > MAX_STABLES)
      return this.reject(ws, `At most ${MAX_STABLES} stables`, seq);
    room.length = length;
    room.ai = ai;
    this.saveRoom();
    this.broadcastLobby(ws, seq);
  }

  private start(ws: Socket, seat: Id, seq?: number): void {
    const room = this.room!;
    if (this.setup) return this.reject(ws, 'The game has started', seq);
    if (seat !== room.host) return this.reject(ws, 'Only the host starts the game', seq);
    const stables = this.seats.length + room.ai.length;
    if (stables < MIN_STABLES || stables > MAX_STABLES)
      return this.reject(ws, `A game needs ${MIN_STABLES} to ${MAX_STABLES} stables`, seq);
    if (this.seats.length < 1) return this.reject(ws, 'A game needs a human', seq);
    // The seed is the room's (§2.1): the engine is handed a number and nothing else random.
    const draw = new Uint32Array(1);
    crypto.getRandomValues(draw);
    this.begin(
      {
        seed: draw[0]! % 2147483647,
        length: room.length,
        players: [
          ...this.seats.map((s) => ({ name: s.name, kind: 'human' as const, colour: s.colour })),
          ...room.ai.map((a) => ({ name: '', kind: 'ai' as const, difficulty: a.difficulty })),
        ],
      },
      ws,
      seq,
    );
  }

  /** Start a game on `setup`: the first drive, stored, and everybody told. */
  private begin(setup: SeasonSetup, ws?: Socket, seq?: number): void {
    const state = createSeason(setup);
    const log: Action[] = [];
    driveRoom(state, log, { standIn: new Set(), queue: this.queue });
    this.setup = setup;
    this.sql.exec('INSERT OR REPLACE INTO setup (id, json) VALUES (1, ?)', JSON.stringify(setup));
    this.state = state;
    this.log = log;
    this.appendLog(0);
    this.note('started', {
      stables: setup.players.length,
      humans: this.seats.length,
      length: JSON.stringify(setup.length ?? null),
    });
    this.broadcastLobby();
    this.afterChange(ws, seq);
  }

  // ── Play again (§2.6) ──────────────────────────────────────────────────────────────────────────

  /**
   * The host, after the end: draw a code, have that room take the same seats (tokens and all), AI
   * rows, length and setup — so the same seed — and start; then send everybody `moved`. Pressed
   * twice, the second press just gets `moved` again.
   */
  private async playAgain(ws: Socket, seat: Id, seq?: number): Promise<void> {
    const room = this.room!;
    if (seat !== room.host) return this.reject(ws, 'Only the host can play again', seq);
    if (this.state?.phase !== 'seasonEnd' || !this.setup)
      return this.reject(ws, 'The game is not over yet', seq);
    if (!room.movedTo) {
      const from: Successor = {
        host: room.host,
        seats: this.seats,
        length: room.length,
        ai: room.ai,
        setup: this.setup,
      };
      for (let tries = 0; tries < 8 && !room.movedTo; tries++) {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        const code = codeFrom(bytes);
        const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
        const r = await stub.fetch('https://room/successor', {
          method: 'POST',
          headers: { 'x-room-code': code, 'Content-Type': 'application/json' },
          body: JSON.stringify(from),
        });
        if (r.status === 201) room.movedTo = code;
      }
      if (!room.movedTo) return this.reject(ws, 'No free room code: try again', seq);
      this.saveRoom();
    }
    const text = JSON.stringify({ t: 'moved', code: room.movedTo } satisfies RoomMsg);
    for (const sock of this.open()) {
      if (sock === ws && seq !== undefined)
        this.send(sock, { t: 'moved', seq, code: room.movedTo });
      else this.sendRaw(sock, text);
    }
  }

  // ── act (§2.4) and the queue (§5.1) ────────────────────────────────────────────────────────────

  private act(ws: Socket, seat: Id, actions: Action[], seq?: number): void {
    const s = this.state;
    if (!s) return this.reject(ws, 'The game has not started', seq);
    if (s.phase === 'seasonEnd') return this.reject(ws, 'The game is over', seq);
    const why = refuseAct(seat, actions);
    if (why) return this.reject(ws, why, seq);
    if (actions.length === 1) {
      const kind = queueKind(s, seat, actions[0]!);
      if (kind) {
        const a = actions[0]!;
        if (a.t === 'ChooseDoor' && (!Number.isInteger(a.door) || a.door < 0 || a.door > 2))
          return this.reject(ws, 'No such door', seq);
        this.queue.set(seat, { kind, action: a, ...(seq !== undefined ? { seq } : {}) });
        this.saveQueue();
        this.broadcast(undefined, ws, seq);
        return;
      }
    }
    const copy = structuredClone(s);
    try {
      for (const a of actions) reduceMut(copy, a);
    } catch (e) {
      return this.reject(ws, message(e), seq);
    }
    this.advance(copy, [...actions], ws, seq);
  }

  /**
   * Drive `next` (a copy: the live state is untouched until this succeeds) on from a change, then
   * make it the room's: store what was applied, and tell everybody. `added` is what the press
   * applied; the drive appends everything it applies after it.
   */
  private advance(next: GameState, added: Action[], ws?: Socket, seq?: number): void {
    const queue = new Map(this.queue);
    let outcome;
    try {
      outcome = driveRoom(next, added, {
        standIn: new Set(this.seats.filter((x) => x.standIn).map((x) => x.id)),
        queue,
      });
    } catch (e) {
      this.note('error', { drive: message(e).slice(0, 200) });
      if (ws) this.reject(ws, `The room could not drive the game on: ${message(e)}`, seq);
      return;
    }
    const from = this.log.length;
    this.state = next;
    this.log.push(...added);
    this.appendLog(from);
    const queueChanged = queue.size !== this.queue.size;
    this.queue = queue;
    if (queueChanged) this.saveQueue();
    for (const { seat, weekend } of outcome.stoodIn) {
      const ord = this.seats.findIndex((x) => x.id === seat);
      const row = this.seats[ord]!;
      if (!row.standInWeekends.includes(weekend)) {
        row.standInWeekends.push(weekend);
        this.saveSeat(ord);
      }
    }
    for (const d of outcome.dropped)
      for (const sock of this.open())
        if (this.seatOf(sock) === d.seat) this.reject(sock, d.error, d.seq);
    this.afterChange(ws, seq);
  }

  private afterChange(ws?: Socket, seq?: number): void {
    const s = this.state!;
    const room = this.room!;
    // The last standings a room can still show if a later engine cannot replay it (§7).
    if (
      room.standingsAt.season !== s.season ||
      room.standingsAt.week !== s.week ||
      s.phase === 'seasonEnd'
    ) {
      room.standings = s.players
        .map((p) => ({ name: p.name, netWorth: netWorth(s, p) }))
        .sort((a, b) => b.netWorth - a.netWorth);
      room.standingsAt = { season: s.season, week: s.week };
    }
    const key = `${s.season}:${s.week}:${s.phase}:${clockOf(s).join(',')}`;
    if (key !== room.clockKey) {
      room.clockKey = key;
      room.clockSince = Date.now();
    }
    this.saveRoom();
    this.broadcast(undefined, ws, seq);
    if (s.phase === 'seasonEnd') {
      this.note('ended', { rows: this.log.length });
      const text = JSON.stringify(this.ended());
      for (const sock of this.open()) if (this.seatOf(sock)) this.sendRaw(sock, text);
    }
  }

  private ended(): RoomMsg {
    return { t: 'ended', setup: this.setup!, log: this.log };
  }

  // ── Views (§2.4, §3) ───────────────────────────────────────────────────────────────────────────

  private meta(except?: Socket): RoomMeta {
    const s = this.state!;
    const standInWeekends: Record<Id, number> = {};
    for (const x of this.seats)
      if (x.standInWeekends.length) standInWeekends[x.id] = x.standInWeekends.length;
    const queued: Record<Id, 'door' | 'flyOn'> = {};
    for (const [seat, q] of this.queue) queued[seat] = q.kind;
    return {
      clock: { seats: clockOf(s), since: this.room!.clockSince },
      online: [...this.online(except)],
      standIn: this.seats.filter((x) => x.standIn).map((x) => x.id),
      standInWeekends,
      queued,
      host: this.room!.host ?? '',
    };
  }

  /**
   * Send every socket its seat's view: whole to a socket the room has no record of, otherwise the
   * top-level fields that changed. `closing` is a socket on its way out, left out of `online`;
   * `replyTo` gets `seq` echoed.
   */
  private broadcast(closing?: Socket, replyTo?: Socket, seq?: number): void {
    if (!this.state) {
      if (this.room && !this.stale) this.broadcastLobby();
      return;
    }
    if (this.stale) return;
    const rev = this.log.length;
    const meta = JSON.stringify(this.meta(closing));
    const views = new Map<Id, Map<string, string>>();
    for (const ws of this.open()) {
      if (ws === closing) continue;
      const seat = this.seatOf(ws);
      if (!seat) continue;
      let fields = views.get(seat);
      if (!fields) {
        fields = fieldsOf(viewFor(this.state, seat));
        views.set(seat, fields);
      }
      const prev = this.lastSeen.get(ws);
      const patch = prev ? patchOf(prev, fields) : null;
      const echo = ws === replyTo && seq !== undefined ? `"seq":${seq},` : '';
      const body = patch ?? wholeOf(fields);
      this.sendRaw(
        ws,
        `{"t":"view",${echo}"rev":${rev},"full":${patch === null},"patch":${body},"meta":${meta}}`,
      );
      this.lastSeen.set(ws, fields);
    }
  }

  // ── Nudge (§5.1) and the stand-in (§5.3) ───────────────────────────────────────────────────────

  private nudge(ws: Socket, seat: Id, target: Id, seq?: number): void {
    const s = this.state;
    if (!s) return this.reject(ws, 'The game has not started', seq);
    if (!clockOf(s).includes(target))
      return this.reject(ws, 'That stable is not on the clock', seq);
    const now = Date.now();
    if (now - (this.nudgedAt.get(target) ?? 0) < NUDGE_EVERY_MS)
      return this.reject(ws, 'They were nudged under a minute ago', seq);
    this.nudgedAt.set(target, now);
    const by = this.seats.find((x) => x.id === seat)?.name ?? 'Somebody';
    const text = JSON.stringify({ t: 'nudged', by } satisfies RoomMsg);
    for (const sock of this.open()) if (this.seatOf(sock) === target) this.sendRaw(sock, text);
    this.broadcast(undefined, ws, seq);
  }

  /** Who may press "Let an AI play for them": the host, or while the host is away the next human. */
  private mayStandIn(seat: Id): boolean {
    const host = this.room!.host;
    const online = this.online();
    if (host && online.has(host)) return seat === host;
    return this.seats.find((x) => online.has(x.id))?.id === seat;
  }

  private standIn(ws: Socket, seat: Id, target: Id, on: boolean, seq?: number): void {
    if (!this.state) return this.reject(ws, 'The game has not started', seq);
    if (this.state.phase === 'seasonEnd') return this.reject(ws, 'The game is over', seq);
    if (!this.mayStandIn(seat)) return this.reject(ws, 'Only the host can do that', seq);
    const ord = this.seats.findIndex((x) => x.id === target);
    if (ord < 0) return this.reject(ws, 'That is not a human seat', seq);
    const row = this.seats[ord]!;
    if (on && this.online().has(target))
      return this.reject(ws, `${row.name} is here: nobody can be played for while they are`, seq);
    if (row.standIn === on) return this.broadcast(undefined, ws, seq);
    row.standIn = on;
    this.saveSeat(ord);
    this.advance(structuredClone(this.state), [], ws, seq);
  }

  // ── Dev only ───────────────────────────────────────────────────────────────────────────────────

  private async debug(ws: Socket, msg: DebugMsg, seq?: number): Promise<void> {
    if (msg.op === 'stale' && this.room) {
      this.room.stateVersion = STATE_VERSION - 1;
      this.saveRoom();
      this.loaded = false;
      this.load();
    }
    const json = this.state ? JSON.stringify(this.state) : '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    const logRows = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM log').one().n;
    this.send(ws, {
      t: 'debug',
      ...(seq !== undefined ? { seq } : {}),
      rev: this.log.length,
      hash,
      wakeMs: this.wakeMs,
      readMs: this.readMs,
      logRows,
    });
  }
}
