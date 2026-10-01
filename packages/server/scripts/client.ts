/**
 * **The headless client** shared by `online-walk` (against `wrangler dev`) and, from `v3l4`,
 * `live-smoke` (against the live room): a fake player that presses only what its own view offers,
 * scans every view it holds for secrets, and checks the whole game against Node's replay at the end.
 * Moved out of `online-walk.ts` at `v3l4` unchanged but for the endpoint, which is now set by the
 * script that uses it (`setEndpoint`), and an `Origin` the live room needs.
 */
import { createHash } from 'node:crypto';
import {
  aiChoiceFor,
  cargoTotal,
  createSeason,
  decide,
  HOLD_CAP,
  maxStakeFor,
  PROTOCOL_VERSION,
  raceType,
  reduceMut,
  SEAT_SECRETS,
  STAPLE_ID,
  thisWeeksCard,
  viewFor,
  type Action,
  type Dog,
  type GameLength,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import type {
  ClientMsg,
  DebugMsg,
  DebugReplyMsg,
  EndedMsg,
  LobbyStateMsg,
  RoomMeta,
  RoomMsg,
  WelcomeMsg,
} from '../src/protocol';

// ── Where the room is ────────────────────────────────────────────────────────────────────────────

export interface Endpoint {
  /** `http://127.0.0.1:8790` or `https://sdr-rooms.….workers.dev`, no trailing slash. */
  http: string;
  /** The same with `ws` / `wss`. */
  ws: string;
  /** The `Origin` every request sends: the live room refuses a request without an allowed one. */
  origin?: string;
}

export const endpoint: Endpoint = { http: '', ws: '' };

export function setEndpoint(http: string, origin?: string): void {
  endpoint.http = http.replace(/\/+$/, '');
  endpoint.ws = endpoint.http.replace(/^http/, 'ws');
  if (origin) endpoint.origin = origin;
  else delete endpoint.origin;
}

/** Node's WebSocket (undici) takes headers in its second argument; the DOM typing does not say so. */
export function openSocket(url: string, origin?: string): WebSocket {
  const Ctor = WebSocket as unknown as new (u: string, init?: unknown) => WebSocket;
  return origin ? new Ctor(url, { headers: { Origin: origin } }) : new Ctor(url);
}

// ── The largest act sent (`v3l4`: what the 16 KB frame cap was set against) ──────────────────────

export const actStats = { frames: 0, maxBytes: 0, maxActions: 0 };

function noteAct(text: string, actions: number): void {
  actStats.frames++;
  actStats.maxBytes = Math.max(actStats.maxBytes, Buffer.byteLength(text));
  actStats.maxActions = Math.max(actStats.maxActions, actions);
}

// ── Waiting ──────────────────────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

/** Every client, for a stall's post-mortem. */
export const everyone: Client[] = [];

export async function until(what: string, test: () => boolean, ms = 120_000): Promise<void> {
  const t0 = Date.now();
  while (!test()) {
    if (Date.now() - t0 > ms) {
      for (const c of everyone)
        console.error(
          `  ${c.opts.name} ${c.seat}: rev ${c.rev} ${c.view?.phase} s${c.view?.season}w${c.view?.week} busy ${c.busy} paused ${c.paused} ws ${!!c.ws} meta ${JSON.stringify(c.meta)} errors ${JSON.stringify(c.errors.slice(-3))} dropped ${JSON.stringify(c.dropped.slice(-3))}`,
        );
      throw new Error(`timed out waiting for ${what}`);
    }
    await sleep(20);
  }
}

export async function createRoom(): Promise<string> {
  const r = await fetch(`${endpoint.http}/room`, {
    method: 'POST',
    ...(endpoint.origin ? { headers: { Origin: endpoint.origin } } : {}),
  });
  const body = (await r.json()) as { code: string };
  if (r.status !== 201 || !/^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(body.code))
    throw new Error(`POST /room gave ${r.status} ${JSON.stringify(body)}`);
  // v3l4: CORS names the page that asked, never `*`; a client that sends no Origin gets none.
  const cors = r.headers.get('access-control-allow-origin');
  if (cors !== (endpoint.origin ?? null))
    throw new Error(`POST /room sent CORS ${cors} for Origin ${endpoint.origin ?? '(none)'}`);
  return body.code;
}

// ── The plain line (table-walk.ts's, pressed from a view) ────────────────────────────────────────

export function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

export function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

export function planetTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  const dogs = ownDogs(s, p);
  if (s.phase === 'planetPre') {
    if (s.toggles.trading && p.cargo[STAPLE_ID] < dogs.length * 2) {
      const units = Math.min(
        HOLD_CAP - cargoTotal(p.cargo),
        dogs.length * 2,
        s.planet.goods[STAPLE_ID].stock,
        Math.floor(Math.max(0, p.cash - 1500) / Math.max(1, s.planet.goods[STAPLE_ID].buy)),
      );
      if (units > 0) out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units });
    }
    const taken = new Set<Id>();
    for (const race of [...thisWeeksCard()].reverse()) {
      const pick = dogs
        .filter((d) => !taken.has(d.id) && eligible(d, race) && d.fitness > 40)
        .sort((a, b) => b.rating - a.rating)[0];
      if (pick) {
        taken.add(pick.id);
        out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
      }
    }
  }
  if (s.phase === 'planetPost' && s.toggles.trading && p.cargo[STAPLE_ID] > 0)
    out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units: -1 });
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

export function bettingTurn(s: GameState, p: Player): Action[] {
  const out: Action[] = [];
  let cash = p.cash;
  for (const { race, entries } of s.fields ?? []) {
    const cap = Math.min(maxStakeFor(s, { ...p, cash }), Math.floor(cash));
    const fav = [...entries].sort((a, b) => b.winProb - a.winProb)[0];
    if (!fav || cap < 100) continue;
    out.push({ t: 'PlaceBet', playerId: p.id, race, dogId: fav.dogId, kind: 'win', stake: 100 });
    cash -= 100;
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/**
 * Phase N (V29, V32): a draft pick, when this seat is the one picking — what Normal would take, read
 * off the seat's own view (the draft is public, so the view has the whole board).
 */
export function draftPress(s: GameState, me: Player): Action {
  return decide(s, me.id, 'normal')[0]!;
}

// ── Hashing and the leak scan ────────────────────────────────────────────────────────────────────

/** A view's JSON with its top-level keys sorted (patches may not keep the room's key order). */
export function canon(v: GameState): string {
  return JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))));
}

export function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Run every secret row's redaction over a view the seat received. A view with no secret in it is
 * unchanged, because each row is idempotent on its own output. Returns the rows that changed it.
 */
export function leakedRows(v: GameState, seat: Id): string[] {
  if (v.phase === 'seasonEnd') return [];
  const before = JSON.stringify(v);
  const all = structuredClone(v);
  for (const row of SEAT_SECRETS) row.redact(all, seat, v);
  if (JSON.stringify(all) === before) return [];
  return SEAT_SECRETS.filter((row) => {
    const one = structuredClone(v);
    row.redact(one, seat, v);
    return JSON.stringify(one) !== before;
  }).map((row) => row.field);
}

// ── A client ─────────────────────────────────────────────────────────────────────────────────────

export interface ClientOpts {
  name: string;
  colour: number;
  /** Pick the door early and press "Fly on" early when not on the clock. */
  early: boolean;
}

export type Hook = (c: Client) => boolean;

export class Client {
  ws: WebSocket | null = null;
  seat: Id = '';
  token = '';
  host = false;
  view: GameState | null = null;
  rev = -1;
  meta: RoomMeta | null = null;
  lobby: LobbyStateMsg | null = null;
  ended: EndedMsg | null = null;
  welcome: WelcomeMsg | null = null;
  /** `v3l3`: the successor's code, from a `moved` (Play again, §2.6). */
  moved: string | null = null;
  private seq = 0;
  private waiting = new Map<number, (m: RoomMsg | DebugReplyMsg) => void>();
  busy: number | null = null;
  paused = true;
  /** Hashes of every view held, by rev. */
  seen = new Map<number, string>();
  leaks: string[] = [];
  errors: string[] = [];
  views = 0;
  fullViews = 0;
  bytes = 0;
  nudged = 0;
  presses = 0;
  queuedSent: { kind: 'door' | 'flyOn'; season: number; week: number }[] = [];
  dropped: string[] = [];
  /** Called before the client acts; returning true means "not now". */
  hook: Hook | null = null;
  /** Set after a stand-in hands back: the rev of this seat's first own press since. */
  firstOwnPressAt: number | null = null;
  expectHandBack = false;

  constructor(
    readonly code: string,
    readonly opts: ClientOpts,
  ) {
    everyone.push(this);
  }

  get me(): Player | null {
    return this.view?.players.find((p) => p.id === this.seat) ?? null;
  }

  async connect(hello: Partial<ClientMsg> & { v?: number }): Promise<RoomMsg | DebugReplyMsg> {
    const ws = openSocket(`${endpoint.ws}/room/${this.code}`, endpoint.origin);
    this.ws = ws;
    this.busy = null;
    await new Promise<void>((ok, fail) => {
      ws.addEventListener('open', () => ok(), { once: true });
      ws.addEventListener('error', () => fail(new Error(`${this.opts.name}: socket error`)), {
        once: true,
      });
    });
    ws.addEventListener('message', (e) => this.onMessage(String(e.data)));
    return this.request({ t: 'hello', v: PROTOCOL_VERSION, ...hello } as ClientMsg);
  }

  close(): Promise<void> {
    const ws = this.ws;
    this.ws = null;
    if (!ws || ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((ok) => {
      ws.addEventListener('close', () => ok(), { once: true });
      ws.close();
      setTimeout(ok, 2000);
    });
  }

  request(msg: ClientMsg | DebugMsg): Promise<RoomMsg | DebugReplyMsg> {
    const seq = ++this.seq;
    const p = new Promise<RoomMsg | DebugReplyMsg>((ok, fail) => {
      this.waiting.set(seq, ok);
      setTimeout(() => fail(new Error(`${this.opts.name}: no reply to ${msg.t} #${seq}`)), 60_000);
    });
    const text = JSON.stringify({ ...msg, seq });
    if (msg.t === 'act') noteAct(text, msg.actions.length);
    this.ws!.send(text);
    return p;
  }

  private onMessage(text: string): void {
    this.bytes += text.length;
    const msg = JSON.parse(text) as RoomMsg | DebugReplyMsg;
    switch (msg.t) {
      case 'welcome':
        this.welcome = msg;
        this.seat = msg.seat;
        this.token = msg.token;
        this.host = msg.host;
        break;
      case 'lobby':
        this.lobby = msg;
        break;
      case 'view': {
        this.views++;
        if (msg.full) {
          this.fullViews++;
          this.view = msg.patch as GameState;
        } else {
          if (!this.view) this.errors.push('a patch before any whole view');
          this.view = { ...this.view!, ...msg.patch };
        }
        this.rev = msg.rev;
        this.meta = msg.meta;
        const h = sha(canon(this.view));
        const was = this.seen.get(msg.rev);
        if (was && was !== h) this.errors.push(`two different views at rev ${msg.rev}`);
        this.seen.set(msg.rev, h);
        for (const row of leakedRows(this.view, this.seat))
          this.leaks.push(`rev ${msg.rev}: ${row}`);
        break;
      }
      case 'nudged':
        this.nudged++;
        break;
      case 'moved':
        this.moved = msg.code;
        break;
      case 'ended':
        this.ended = msg;
        break;
      case 'rejected':
        if (msg.seq === undefined || !this.waiting.has(msg.seq)) this.dropped.push(msg.error);
        break;
      default:
        break;
    }
    const seq = 'seq' in msg ? msg.seq : undefined;
    if (seq !== undefined) {
      const done = this.waiting.get(seq);
      this.waiting.delete(seq);
      if (this.busy === seq) {
        this.busy = null;
        if (msg.t === 'rejected') this.errors.push(`refused: ${msg.error}`);
      }
      done?.(msg);
    }
    if (msg.t === 'view') this.maybeAct();
  }

  /** Press whatever this seat's own view offers, if anything. */
  maybeAct(): void {
    if (this.paused || this.busy !== null || !this.ws || !this.view || !this.meta || this.ended)
      return;
    const s = this.view;
    const me = this.me;
    if (!me || s.phase === 'seasonEnd') return;
    if (this.hook?.(this)) return;
    const on = this.meta.clock.seats.includes(this.seat);
    const queued = this.meta.queued[this.seat];
    let actions: Action[] | null = null;
    let early: 'door' | 'flyOn' | null = null;
    if (s.pendingEvent && s.pendingEvent.playerId === this.seat) {
      let choice = 0;
      try {
        choice = aiChoiceFor(s, this.seat);
      } catch {
        choice = 0;
      }
      actions = [{ t: 'ResolveEvent', playerId: this.seat, choice }];
    } else if (s.phase === 'explore' && !(this.seat in (s.explore?.picks ?? {}))) {
      const door: Action = { t: 'ChooseDoor', playerId: this.seat, door: s.week % 3 };
      if (on) actions = [door];
      else if (this.opts.early && !queued) {
        actions = [door];
        early = 'door';
      }
    } else if (s.phase === 'planetPre' && on) {
      actions = planetTurn(s, me);
    } else if (s.phase === 'betting' && s.locked && !s.done.includes(this.seat)) {
      actions = bettingTurn(s, me);
    } else if (s.phase === 'planetPost' && !s.done.includes(this.seat)) {
      if (on) actions = planetTurn(s, me);
      else if (this.opts.early && !queued) {
        actions = [{ t: 'EndPhase', playerId: this.seat }];
        early = 'flyOn';
      }
    } else if ((s.phase === 'draft' || s.phase === 'offSeason') && s.activePlayer === this.seat) {
      actions = [draftPress(s, me)];
    }
    if (!actions) return;
    if (early) this.queuedSent.push({ kind: early, season: s.season, week: s.week });
    if (this.expectHandBack && this.firstOwnPressAt === null) this.firstOwnPressAt = this.rev;
    this.presses += actions.length;
    const seq = ++this.seq;
    this.busy = seq;
    const text = JSON.stringify({ t: 'act', seq, actions } satisfies ClientMsg);
    noteAct(text, actions.length);
    this.ws.send(text);
  }
}

// ── Checks shared by every game ──────────────────────────────────────────────────────────────────

export interface Replayed {
  mismatches: string[];
  checked: number;
  /** Secret rows the scan finds in the whole state, mid-game: proof it can see one. */
  sanity: number;
  final: GameState;
  finalHash: string;
  logRows: number;
  logBytes: number;
}

/** Replay the room's `ended` log on Node and compare every view a client held with `viewFor`. */
export function replayAndCompare(clients: Client[]): Replayed {
  const ended = clients.find((c) => c.ended)?.ended;
  if (!ended) throw new Error('no client got ended');
  for (const c of clients)
    if (!c.ended || JSON.stringify(c.ended) !== JSON.stringify(ended))
      throw new Error(`${c.opts.name} got a different ended`);
  const want = new Map<number, Client[]>();
  for (const c of clients)
    for (const rev of c.seen.keys()) want.set(rev, [...(want.get(rev) ?? []), c]);
  const s = createSeason(ended.setup);
  const mismatches: string[] = [];
  let checked = 0;
  const check = (rev: number) => {
    for (const c of want.get(rev) ?? []) {
      checked++;
      if (sha(canon(viewFor(s, c.seat))) !== c.seen.get(rev))
        mismatches.push(`${c.opts.name} at rev ${rev}`);
    }
  };
  check(0);
  let sanity = 0;
  ended.log.forEach((a, i) => {
    reduceMut(s, a);
    check(i + 1);
    // The scan must be able to see a secret: run it over the whole state once, mid-game.
    if (i === Math.floor(ended.log.length / 2)) sanity = leakedRows(s, clients[0]!.seat).length;
  });
  if (sanity < 3)
    throw new Error(`the leak scan found only ${sanity} secret rows in a whole state`);
  const json = JSON.stringify(s);
  return {
    mismatches,
    checked,
    sanity,
    final: s,
    finalHash: sha(json),
    logRows: ended.log.length,
    logBytes: ended.log.reduce((n, a) => n + JSON.stringify(a).length, 0),
  };
}

export async function debug(c: Client, op: DebugMsg['op'] = 'hash'): Promise<DebugReplyMsg> {
  const r = await c.request({ t: 'debug', op });
  if (r.t !== 'debug') throw new Error(`debug: ${JSON.stringify(r)}`);
  return r;
}

export async function quiet(clients: Client[], ms = 400): Promise<void> {
  let last = clients.map((c) => c.rev).join();
  let since = Date.now();
  await until('the table to go quiet', () => {
    const now = clients.map((c) => c.rev).join();
    if (now !== last || clients.some((c) => c.busy !== null)) {
      last = now;
      since = Date.now();
    }
    return Date.now() - since > ms;
  });
}

export async function join(code: string, opts: ClientOpts[]): Promise<Client[]> {
  const clients: Client[] = [];
  for (const o of opts) {
    const c = new Client(code, o);
    const w = await c.connect({ name: o.name, colour: o.colour });
    if (w.t !== 'welcome') throw new Error(`${o.name} was not welcomed: ${JSON.stringify(w)}`);
    clients.push(c);
  }
  return clients;
}

export async function startGame(host: Client, length: GameLength, ai: number): Promise<void> {
  const l = await host.request({
    t: 'lobby',
    length,
    ai: Array.from({ length: ai }, () => ({ difficulty: 'normal' as const })),
  });
  if (l.t === 'rejected') throw new Error(`lobby: ${l.error}`);
  const s = await host.request({ t: 'start' });
  if (s.t !== 'view') throw new Error(`start: ${JSON.stringify(s).slice(0, 200)}`);
}

export function go(clients: Client[]): void {
  for (const c of clients) {
    c.paused = false;
    c.maybeAct();
  }
}

export const results: { row: string; ok: boolean; detail: string }[] = [];
export function row(name: string, ok: boolean, detail: string): void {
  results.push({ row: name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
}

export function summary(clients: Client[], label: string, rep: Replayed, t0: number): void {
  const leaks = clients.flatMap((c) => c.leaks.map((l) => `${c.opts.name} ${l}`));
  const views = clients.reduce((n, c) => n + c.views, 0);
  const errors = clients.flatMap((c) => c.errors.map((e) => `${c.opts.name}: ${e}`));
  const mb = clients.reduce((n, c) => n + c.bytes, 0) / clients.length / 1e6;
  console.log(
    `  ${label}: ${rep.final.seasons.length} season(s), ${rep.logRows} log rows (${(rep.logBytes / 1024).toFixed(0)} KB), ` +
      `${views} views to ${clients.length} clients (${clients.reduce((n, c) => n + c.fullViews, 0)} whole), ` +
      `${mb.toFixed(1)} MB a client, ${clients.reduce((n, c) => n + c.presses, 0)} actions pressed, ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  row(
    `${label}: no client ever receives a secret`,
    leaks.length === 0,
    `${leaks.length} leaks in ${views} views scanned against ${SEAT_SECRETS.length} rows (the same scan finds ${rep.sanity} rows' secrets in the whole state mid-game)${leaks.length ? ` — ${leaks.slice(0, 5).join('; ')}` : ''}`,
  );
  row(
    `${label}: every view held equals Node's viewFor at that rev`,
    rep.mismatches.length === 0,
    `${rep.checked} compared, ${rep.mismatches.length} differ${rep.mismatches.length ? ` — ${rep.mismatches.slice(0, 5).join('; ')}` : ''}`,
  );
  if (errors.length) row(`${label}: no unexpected refusals`, false, errors.slice(0, 8).join('; '));
}

/**
 * Queued doors and "Fly on"s: every one sent was held (the client was told so), applied later with
 * nothing refused, and — since the engine takes a door and an `EndPhase` at `planetPost` only from
 * the seat on the clock — in turn order. The replay checks that order again, directly.
 */
export function queueRow(clients: Client[], rep: Replayed, label: string): void {
  const sent = clients.flatMap((c) => c.queuedSent);
  const doors = sent.filter((q) => q.kind === 'door').length;
  const flyOns = sent.length - doors;
  const dropped = clients.flatMap((c) => c.dropped);
  // Walk the log again: every ChooseDoor and every EndPhase at planetPost is from the seat on the clock.
  const s = createSeason(clients[0]!.ended!.setup);
  let outOfTurn = 0;
  for (const a of clients[0]!.ended!.log) {
    if (a.t === 'ChooseDoor' && s.activePlayer !== a.playerId) outOfTurn++;
    if (a.t === 'EndPhase' && s.phase === 'planetPost' && s.activePlayer !== a.playerId)
      outOfTurn++;
    reduceMut(s, a);
  }
  row(
    `${label}: queued door and queued "Fly on" apply in turn order`,
    doors > 0 && flyOns > 0 && dropped.length === 0 && outOfTurn === 0,
    `${doors} doors and ${flyOns} "Fly on"s held and applied, ${dropped.length} dropped, ${outOfTurn} out of turn in ${rep.logRows} actions`,
  );
}

// ── `v3l4`: what the live room refuses ───────────────────────────────────────────────────────────

/** Can a socket be opened to this room from this `Origin`? Resolves true on open, false on refusal. */
export function socketOpens(code: string, origin: string | undefined): Promise<boolean> {
  return new Promise((ok) => {
    const ws = openSocket(`${endpoint.ws}/room/${code}`, origin);
    const done = (v: boolean) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Never opened.
      }
      ok(v);
    };
    const timer = setTimeout(() => done(false), 15_000);
    ws.addEventListener('open', () => done(true), { once: true });
    ws.addEventListener('error', () => done(false), { once: true });
  });
}

/**
 * Another page may neither make a room nor open a socket to one, and CORS names the page that asked:
 * `POST /room` from `bad` is 403 with no CORS header; from `good` it is 201 and echoes `good`; a
 * socket from `bad` is refused, from `good` it opens.
 */
export async function originCheck(
  code: string,
  good: string,
  bad: string,
): Promise<{ ok: boolean; detail: string }> {
  const post = (origin: string) =>
    fetch(`${endpoint.http}/room`, { method: 'POST', headers: { Origin: origin } });
  const refused = await post(bad);
  const allowed = await post(good);
  const badCors = refused.headers.get('access-control-allow-origin');
  const goodCors = allowed.headers.get('access-control-allow-origin');
  const madeCode = allowed.status === 201 ? ((await allowed.json()) as { code: string }).code : '';
  const badSocket = await socketOpens(code, bad);
  const goodSocket = await socketOpens(code, good);
  const ok =
    refused.status === 403 &&
    badCors === null &&
    allowed.status === 201 &&
    goodCors === good &&
    !badSocket &&
    goodSocket;
  return {
    ok,
    detail: `POST /room from ${bad}: ${refused.status} (CORS ${badCors ?? 'none'}); from ${good}: ${allowed.status} (CORS ${goodCors ?? 'none'}${madeCode ? `, room ${madeCode}` : ''}); a socket from ${bad} ${badSocket ? 'OPENED' : 'refused'}, from ${good} ${goodSocket ? 'opens' : 'REFUSED'}`,
  };
}

/**
 * A frame over 16 KB and an act of 65 actions are each answered with `rejected`, and the socket stays
 * open: a press after them is answered as usual.
 */
export async function oversizeCheck(c: Client): Promise<{ ok: boolean; detail: string }> {
  const seat = c.seat;
  const measured = { ...actStats };
  const big = await c.request({
    t: 'act',
    actions: [{ t: 'EndPhase', playerId: seat, pad: 'x'.repeat(17 * 1024) } as unknown as Action],
  });
  const many = await c.request({
    t: 'act',
    actions: Array.from({ length: 65 }, () => ({ t: 'EndPhase', playerId: seat }) as Action),
  });
  const after = await c.request({ t: 'act', actions: [{ t: 'AdvancePhase' }] });
  Object.assign(actStats, measured);
  const open = c.ws?.readyState === WebSocket.OPEN;
  const ok =
    big.t === 'rejected' &&
    big.error === 'That message is too big' &&
    many.t === 'rejected' &&
    many.error === 'Too many actions at once' &&
    after.t === 'rejected' &&
    open;
  const say = (m: RoomMsg | DebugReplyMsg) => (m.t === 'rejected' ? `"${m.error}"` : m.t);
  return {
    ok,
    detail: `17 KB frame: ${say(big)}; 65 actions: ${say(many)}; the socket ${open ? 'still open' : 'CLOSED'}, and the next press answered (${say(after)})`,
  };
}
