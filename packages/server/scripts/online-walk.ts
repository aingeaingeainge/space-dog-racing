/**
 * **`online-walk`** (ONLINE_PLAN §8 item 3, the headless half): fake players finish games in a room
 * under `wrangler dev`, over real WebSockets, and it prints a line per row of §10's Phase L2 table.
 *
 *   npm run walk            (in packages/server; it starts and stops `wrangler dev` itself)
 *
 * Each client presses **only what its own view offers**, with `table-walk.ts`'s plain line: a door a
 * week, a crate of staple when short, the best three dogs declared, 100 on each favourite, the
 * off-season answered. Some clients pick their door and press "Fly on" early, which the room holds
 * (§5.1).
 *
 * **Leaks are scanned two ways, on every view a client ends up holding (patches applied):**
 * 1. *against the secret rows*: every `SEAT_SECRETS` row's redaction is run over the received view;
 *    a view that still had a secret in it changes, and the row is named;
 * 2. *against the whole state*: when the game ends, the room's `ended` log is replayed on Node, and
 *    at every `rev` a client saw, `viewFor(state, seat)` must be byte-identical to what it held.
 *
 * The dev-only hook is the `debug` message (`protocol.ts`), answered only because this script starts
 * `wrangler dev` with `--var DEV_DEBUG:1`: the room's state hash and its last wake's replay time.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aiChoiceFor,
  cargoTotal,
  createSeason,
  HOLD_CAP,
  maxStakeFor,
  PROTOCOL_VERSION,
  raceType,
  reduceMut,
  replay,
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
import { driveRoom } from '../src/game';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..');
const SHOTS = resolve(SERVER, '../../shots/online-walk');
const PORT = Number(process.env.WALK_PORT ?? 8790);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;

// ── wrangler dev ─────────────────────────────────────────────────────────────────────────────────

class Wrangler {
  private proc: ChildProcess | null = null;
  constructor(private persist: string) {}

  async start(): Promise<number> {
    const t0 = Date.now();
    const proc = spawn(
      'npx',
      [
        'wrangler',
        'dev',
        '--port',
        String(PORT),
        '--ip',
        '127.0.0.1',
        '--persist-to',
        this.persist,
        '--var',
        'DEV_DEBUG:1',
        '--show-interactive-dev-session=false',
      ],
      {
        cwd: SERVER,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
      },
    );
    this.proc = proc;
    await new Promise<void>((ok, fail) => {
      let out = '';
      const timer = setTimeout(
        () => fail(new Error(`wrangler dev did not start:\n${out.slice(-2000)}`)),
        90_000,
      );
      const read = (b: Buffer) => {
        out += b.toString();
        if (out.includes('Ready on')) {
          clearTimeout(timer);
          ok();
        }
      };
      proc.stdout!.on('data', read);
      proc.stderr!.on('data', read);
      proc.on('exit', (code) =>
        fail(new Error(`wrangler dev exited ${code}:\n${out.slice(-2000)}`)),
      );
    });
    return Date.now() - t0;
  }

  /** On any exit, including an uncaught throw in a client's hook: never leave workerd running. */
  killNow(): void {
    try {
      if (this.proc && this.proc.exitCode === null) process.kill(-this.proc.pid!, 'SIGKILL');
    } catch {
      // Gone.
    }
  }

  async stop(): Promise<void> {
    const proc = this.proc;
    if (!proc || proc.exitCode !== null) return;
    const gone = new Promise<void>((ok) => proc.on('exit', () => ok()));
    try {
      process.kill(-proc.pid!, 'SIGTERM');
    } catch {
      // Already gone.
    }
    await Promise.race([gone, sleep(10_000)]);
    try {
      process.kill(-proc.pid!, 'SIGKILL');
    } catch {
      // Gone.
    }
    this.proc = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

/** Every client, for a stall's post-mortem. */
const everyone: Client[] = [];

async function until(what: string, test: () => boolean, ms = 120_000): Promise<void> {
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

async function createRoom(): Promise<string> {
  const r = await fetch(`${HTTP}/room`, { method: 'POST' });
  const body = (await r.json()) as { code: string };
  if (r.status !== 201 || !/^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(body.code))
    throw new Error(`POST /room gave ${r.status} ${JSON.stringify(body)}`);
  if (r.headers.get('access-control-allow-origin') !== '*')
    throw new Error('POST /room sent no CORS header');
  return body.code;
}

// ── The plain line (table-walk.ts's, pressed from a view) ────────────────────────────────────────

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligible(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

function planetTurn(s: GameState, p: Player): Action[] {
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

function bettingTurn(s: GameState, p: Player): Action[] {
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

function offSeasonPress(s: GameState, me: Player): Action {
  const n = s.offSeason!.notices[me.id]!;
  if (n.retired === undefined) return { t: 'Retire', playerId: me.id, dogId: null };
  if (n.candidate && n.hired === undefined)
    return { t: 'ResolveStaffNotice', playerId: me.id, hire: true };
  return { t: 'EndPhase', playerId: me.id };
}

// ── Hashing and the leak scan ────────────────────────────────────────────────────────────────────

/** A view's JSON with its top-level keys sorted (patches may not keep the room's key order). */
function canon(v: GameState): string {
  return JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))));
}

function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Run every secret row's redaction over a view the seat received. A view with no secret in it is
 * unchanged, because each row is idempotent on its own output. Returns the rows that changed it.
 */
function leakedRows(v: GameState, seat: Id): string[] {
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

interface ClientOpts {
  name: string;
  colour: number;
  /** Pick the door early and press "Fly on" early when not on the clock. */
  early: boolean;
}

type Hook = (c: Client) => boolean;

class Client {
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
    const ws = new WebSocket(`${WS}/room/${this.code}`);
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
    this.ws!.send(JSON.stringify({ ...msg, seq }));
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
    } else if (s.phase === 'offSeason' && !s.done.includes(this.seat)) {
      actions = [offSeasonPress(s, me)];
    }
    if (!actions) return;
    if (early) this.queuedSent.push({ kind: early, season: s.season, week: s.week });
    if (this.expectHandBack && this.firstOwnPressAt === null) this.firstOwnPressAt = this.rev;
    this.presses += actions.length;
    const seq = ++this.seq;
    this.busy = seq;
    this.ws.send(JSON.stringify({ t: 'act', seq, actions } satisfies ClientMsg));
  }
}

// ── Checks shared by every game ──────────────────────────────────────────────────────────────────

interface Replayed {
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
function replayAndCompare(clients: Client[]): Replayed {
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

async function debug(c: Client, op: DebugMsg['op'] = 'hash'): Promise<DebugReplyMsg> {
  const r = await c.request({ t: 'debug', op });
  if (r.t !== 'debug') throw new Error(`debug: ${JSON.stringify(r)}`);
  return r;
}

async function quiet(clients: Client[], ms = 400): Promise<void> {
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

async function join(code: string, opts: ClientOpts[]): Promise<Client[]> {
  const clients: Client[] = [];
  for (const o of opts) {
    const c = new Client(code, o);
    const w = await c.connect({ name: o.name, colour: o.colour });
    if (w.t !== 'welcome') throw new Error(`${o.name} was not welcomed: ${JSON.stringify(w)}`);
    clients.push(c);
  }
  return clients;
}

async function startGame(host: Client, length: GameLength, ai: number): Promise<void> {
  const l = await host.request({
    t: 'lobby',
    length,
    ai: Array.from({ length: ai }, () => ({ difficulty: 'normal' as const })),
  });
  if (l.t === 'rejected') throw new Error(`lobby: ${l.error}`);
  const s = await host.request({ t: 'start' });
  if (s.t !== 'view') throw new Error(`start: ${JSON.stringify(s).slice(0, 200)}`);
}

function go(clients: Client[]): void {
  for (const c of clients) {
    c.paused = false;
    c.maybeAct();
  }
}

const results: { row: string; ok: boolean; detail: string }[] = [];
function row(name: string, ok: boolean, detail: string): void {
  results.push({ row: name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
}

function summary(clients: Client[], label: string, rep: Replayed, t0: number): void {
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

// ── Game 1: four clients and two AIs, two seasons ────────────────────────────────────────────────

async function gameOne(wr: Wrangler): Promise<void> {
  const t0 = Date.now();
  const code = await createRoom();
  const clients = await join(code, [
    { name: 'Aroha', colour: 3, early: false },
    { name: 'Bex', colour: 0, early: true },
    { name: 'Cal', colour: 5, early: false },
    { name: 'Dot', colour: 6, early: true },
  ]);
  const [a, b, c] = clients as [Client, Client, Client, Client];

  // v3l3: a browser at the door, only looking, is sent the lobby (the faces taken) and no seat.
  const looker = new Client(code, { name: 'Looking', colour: 0, early: false });
  const look = await looker.connect({});
  await looker.close();
  row(
    'a look-only hello gets the lobby and no seat',
    look.t === 'lobby' && look.seats.length === 4 && !looker.welcome && !looker.seat,
    look.t === 'lobby'
      ? `${look.seats.length} seats, faces ${look.seats.map((x) => x.colour).join(', ')} taken, started ${look.started}; seated: ${looker.seat || 'nobody'}`
      : JSON.stringify(look).slice(0, 200),
  );

  // Joining: a face already taken is refused; the host is the first to sit down.
  const dup = new Client(code, { name: 'Eve', colour: 0, early: false });
  const dupReply = await dup.connect({ name: 'Eve', colour: 0 });
  await dup.close();
  row(
    'a face already taken is refused at the door',
    dupReply.t === 'rejected',
    dupReply.t === 'rejected' ? `"${dupReply.error}"` : dupReply.t,
  );

  await startGame(a, { kind: 'seasons', seasons: 2 }, 2);
  await until('every client to hold a view', () => clients.every((x) => x.view));

  // The three refusals of §10's table, before anybody plays.
  const spoof = await a.request({ t: 'act', actions: [{ t: 'EndPhase', playerId: b.seat }] });
  const adv = await a.request({ t: 'act', actions: [{ t: 'AdvancePhase' }] });
  const stale = new Client(code, { name: 'Old', colour: 7, early: false });
  const reload = await stale.connect({
    v: PROTOCOL_VERSION - 1,
    name: 'Old',
    colour: 7,
  } as Partial<ClientMsg>);
  await stale.close();
  const late = new Client(code, { name: 'Late', colour: 7, early: false });
  const lateReply = await late.connect({ name: 'Late', colour: 7 });
  await late.close();
  const onHere = await a.request({ t: 'standIn', seat: b.seat, on: true });
  row(
    'spoofed playerId, client AdvancePhase, stale v',
    spoof.t === 'rejected' && adv.t === 'rejected' && reload.t === 'reload',
    `${spoof.t} ("${spoof.t === 'rejected' ? spoof.error : ''}"), ${adv.t} ("${adv.t === 'rejected' ? adv.error : ''}"), ${reload.t}${reload.t === 'reload' ? ` (need ${reload.need})` : ''}`,
  );
  row(
    'a new browser cannot take a seat after Start; a present seat cannot be stood in for',
    lateReply.t === 'rejected' && onHere.t === 'rejected',
    `"${lateReply.t === 'rejected' ? lateReply.error : lateReply.t}"; "${onHere.t === 'rejected' ? onHere.error : onHere.t}"`,
  );

  // Nudge: whoever is on the clock hears it once; a second inside the minute is refused.
  const target = clients.find((x) => a.meta!.clock.seats.includes(x.seat));
  if (target) {
    const n1 = await b.request({ t: 'nudge', seat: target.seat });
    const n2 = await c.request({ t: 'nudge', seat: target.seat });
    await until('the nudge', () => target.nudged > 0, 5000);
    row(
      'nudge reaches the seat on the clock, once a minute',
      n1.t === 'view' && n2.t === 'rejected' && target.nudged === 1,
      `${target.opts.name} nudged ${target.nudged}×; the second: "${n2.t === 'rejected' ? n2.error : n2.t}"`,
    );
  }

  // The drop: Bex, on the clock at her first Market sitting after week 1, drops and rejoins.
  let dropDone = false;
  let dropDetail = '';
  let dropOk = false;
  b.hook = (x) => {
    const s = x.view!;
    if (dropDone || s.phase !== 'planetPre' || s.week < 2 || !x.meta!.clock.seats.includes(x.seat))
      return false;
    dropDone = true;
    const before = x.seen.get(x.rev)!;
    const rev = x.rev;
    void (async () => {
      x.paused = true;
      await x.close();
      await sleep(300);
      const offline = a.meta!.online.includes(x.seat) === false;
      x.view = null;
      await x.connect({ token: x.token });
      await until('Bex back', () => x.view !== null && x.rev === rev);
      dropOk = x.seen.get(rev) === before && offline && x.fullViews >= 2;
      x.paused = false;
      dropDetail = `week ${s.week}, rev ${rev}: the table saw her go (${offline ? 'offline' : 'still online'}), and the whole view on rejoin is ${x.seen.get(rev) === before ? 'byte-identical' : 'DIFFERENT'}`;
      x.maybeAct();
    })();
    return true;
  };

  // The stand-in: Cal leaves at season 1 week 4; the host lets an AI play him; he is back at week 7.
  let standInState: 'waiting' | 'away' | 'standing' | 'back' = 'waiting';
  let standInWeeks = 0;
  let standInDetail = '';
  c.hook = (x) => {
    if (standInState !== 'waiting') return false;
    const s = x.view!;
    if (s.season !== 1 || s.week < 4 || x.meta!.clock.seats.includes(x.seat)) return false;
    standInState = 'away';
    void (async () => {
      await x.close();
      await until('the table to see Cal go', () => !a.meta!.online.includes(x.seat));
      const r = await a.request({ t: 'standIn', seat: x.seat, on: true });
      if (r.t !== 'view') throw new Error(`standIn: ${JSON.stringify(r).slice(0, 200)}`);
      standInState = 'standing';
      await until('week 7', () => a.view!.season > 1 || a.view!.week >= 7, 300_000);
      x.view = null;
      x.expectHandBack = true;
      await x.connect({ token: x.token });
      await until('Cal back', () => x.view !== null);
      // Read from his own first view: the stand-in stopped the moment his hello landed.
      standInWeeks = x.meta!.standInWeekends[x.seat] ?? 0;
      standInState = 'back';
      standInDetail = `played ${standInWeeks} weekends while he was away; on his return meta.standIn is [${x.meta!.standIn.join(', ')}]`;
      x.maybeAct();
    })();
    return true;
  };

  // Evicted and woken: at season 2 week 3 the table stops, wrangler dev is killed and restarted on
  // the same persisted state, and everybody reconnects by token.
  let evicted = false;
  let evictDetail = '';
  let evictOk = false;
  const evictAt = (x: Client) => !evicted && x.view!.season === 2 && x.view!.week >= 3;
  a.hook = (x) => {
    if (!evictAt(x)) return false;
    evicted = true;
    void (async () => {
      for (const y of clients) y.paused = true;
      await until('Cal back before the eviction', () => standInState === 'back');
      await quiet(clients);
      const before = await debug(a);
      const held = clients.map((y) => ({
        rev: y.rev,
        hash: y.seen.get(y.rev)!,
        queued: JSON.stringify(y.meta!.queued),
      }));
      for (const y of clients) await y.close();
      await wr.stop();
      const bootMs = await wr.start();
      const t1 = Date.now();
      for (const y of clients) {
        y.view = null;
        await y.connect({ token: y.token });
      }
      const firstHelloMs = Date.now() - t1;
      await until('views after the wake', () => clients.every((y) => y.view));
      const after = await debug(a);
      const same = clients.every(
        (y, i) => y.seen.get(y.rev) === held[i]!.hash && y.rev === held[i]!.rev,
      );
      const queueKept = clients.every((y, i) => JSON.stringify(y.meta!.queued) === held[i]!.queued);
      evictOk = before.hash === after.hash && same && queueKept;
      evictDetail = `rev ${before.rev}: hash ${before.hash.slice(0, 12)}… before, ${after.hash.slice(0, 12)}… after (replayed ${after.logRows} rows in ${after.wakeMs} ms; wrangler up in ${(bootMs / 1000).toFixed(1)} s; four rejoins in ${firstHelloMs} ms); every client's whole view ${same ? 'identical' : 'DIFFERENT'}; queue ${queueKept ? `kept (${JSON.stringify(a.meta!.queued)})` : 'LOST'}`;
      go(clients);
    })();
    return true;
  };

  go(clients);
  await until('game one to end', () => clients.every((x) => x.ended), 600_000);
  await sleep(300);
  const rep = replayAndCompare(clients);
  const room = await debug(a);

  row(
    '4 clients + 2 AIs finish a two-season game',
    rep.final.phase === 'seasonEnd' && rep.final.seasons.length === 2,
    `${rep.final.seasons.length} seasons, ${rep.final.seasons.reduce((n, s) => n + s.weeks, 0)} weekends; ${rep.final.players.find((p) => p.id === rep.final.finalStandings?.[0]?.playerId)?.name} wins`,
  );
  row('a dropped client rejoins by token to the same view', dropOk, dropDetail || 'never dropped');
  const handBack =
    c.firstOwnPressAt !== null &&
    (a.meta!.standInWeekends[c.seat] ?? 0) === standInWeeks &&
    standInWeeks > 0;
  row(
    'stand-in plays a dropped seat and hands back at the next decision',
    handBack && (standInState as string) === 'back',
    `${standInDetail}; his own next press at rev ${c.firstOwnPressAt}, and the stand-in's weekends stayed ${a.meta!.standInWeekends[c.seat] ?? 0}`,
  );
  row(
    'evicted and woken: the replayed state hash equals the state before',
    evictOk,
    evictDetail || 'never evicted',
  );
  queueRow(clients, rep, 'game one');
  row(
    "final state equals Node's replay of the room's log",
    room.hash === rep.finalHash,
    `room ${room.hash.slice(0, 16)}…, Node ${rep.finalHash.slice(0, 16)}… over ${rep.logRows} actions`,
  );
  summary(clients, 'game one', rep, t0);
  await playAgain(clients, code, rep);
  for (const x of clients) await x.close();
}

/**
 * v3l3, Play again (§2.6): only the host, only after the end. The room makes a successor with the
 * same seats (names, faces, tokens), AI rows, length and setup — so the same seed — starts it, and
 * sends everybody `moved`; a later `hello` on the old room is sent there too. Each client follows
 * with its own token. The successor's state at its first rev must hash the same as Node's
 * `createSeason(setup)` driven to the first human, over the old room's `ended` setup.
 */
async function playAgain(clients: Client[], code: string, rep: Replayed): Promise<void> {
  const [a, b] = clients as [Client, Client];
  const setup = clients.find((x) => x.ended)!.ended!.setup;
  const notHost = await b.request({ t: 'playAgain' });
  const first = await a.request({ t: 'playAgain' });
  await until('everybody told', () => clients.every((x) => x.moved));
  const second = await a.request({ t: 'playAgain' });
  const next = first.t === 'moved' ? first.code : '';
  const probe = new Client(code, { name: 'Probe', colour: 0, early: false });
  const later = await probe.connect({ token: b.token });
  await probe.close();
  const followers: Client[] = [];
  for (const x of clients) {
    const y = new Client(next, x.opts);
    const w = await y.connect({ token: x.token });
    if (w.t !== 'welcome' || w.seat !== x.seat) throw new Error(`${x.opts.name} did not follow`);
    followers.push(y);
  }
  await until('the successor views', () => followers.every((y) => y.view));
  const room = await debug(followers[0]!);
  const st = createSeason(setup);
  const log: Action[] = [];
  driveRoom(st, log, { standIn: new Set(), queue: new Map() });
  const nodeHash = sha(JSON.stringify(st));
  const v = followers[0]!.view!;
  const ok =
    notHost.t === 'rejected' &&
    first.t === 'moved' &&
    second.t === 'moved' &&
    second.code === next &&
    later.t === 'moved' &&
    later.code === next &&
    clients.every((x) => x.moved === next) &&
    room.hash === nodeHash &&
    room.rev === log.length &&
    v.season === 1 &&
    v.week === 1 &&
    followers.every((y) => y.host === (y.seat === a.seat));
  row(
    'Play again: a new room, same seats and seed, every browser follows',
    ok,
    `${code} → ${next}; the non-host: "${notHost.t === 'rejected' ? notHost.error : notHost.t}"; a second press and a later hello on ${code}: moved to ${second.t === 'moved' ? second.code : second.t} and ${later.t === 'moved' ? later.code : later.t}; ${followers.length} clients back in seats ${followers.map((y) => y.seat).join(', ')}; the successor at rev ${room.rev} hashes ${room.hash.slice(0, 12)}…, Node's createSeason(setup, seed ${setup.seed}) driven ${nodeHash.slice(0, 12)}… (the old game ended at rev ${rep.logRows})`,
  );
  for (const y of followers) await y.close();
}

/**
 * Queued doors and "Fly on"s: every one sent was held (the client was told so), applied later with
 * nothing refused, and — since the engine takes a door and an `EndPhase` at `planetPost` only from
 * the seat on the clock — in turn order. The replay checks that order again, directly.
 */
function queueRow(clients: Client[], rep: Replayed, label: string): void {
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

// ── Game 2: eight clients, one season ────────────────────────────────────────────────────────────

async function gameTwo(): Promise<void> {
  const t0 = Date.now();
  const code = await createRoom();
  const names = ['Hana', 'Ira', 'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Ori'];
  const clients = await join(
    code,
    names.map((name, i) => ({ name, colour: (i * 3) % 8, early: i % 2 === 1 })),
  );
  const full = new Client(code, { name: 'Nine', colour: 0, early: false });
  const fullReply = await full.connect({ name: 'Nine', colour: 0 });
  await full.close();
  row(
    'a ninth browser is refused',
    fullReply.t === 'rejected',
    fullReply.t === 'rejected' ? `"${fullReply.error}"` : fullReply.t,
  );
  await startGame(clients[0]!, { kind: 'seasons', seasons: 1 }, 0);
  go(clients);
  await until('game two to end', () => clients.every((x) => x.ended), 600_000);
  await sleep(300);
  const rep = replayAndCompare(clients);
  const room = await debug(clients[0]!);
  row(
    '8 clients finish a season',
    rep.final.phase === 'seasonEnd',
    `${rep.final.seasons[0]!.weeks} weekends; ${rep.final.players.find((p) => p.id === rep.final.finalStandings?.[0]?.playerId)?.name} wins`,
  );
  queueRow(clients, rep, 'game two');
  row(
    "game two: final state equals Node's replay",
    room.hash === rep.finalHash,
    `room ${room.hash.slice(0, 16)}…, Node ${rep.finalHash.slice(0, 16)}…`,
  );
  summary(clients, 'game two', rep, t0);
  for (const x of clients) await x.close();
}

// ── Game 3: a five-season room, for the wake ─────────────────────────────────────────────────────

async function gameThree(wr: Wrangler): Promise<void> {
  const t0 = Date.now();
  const code = await createRoom();
  const clients = await join(code, [{ name: 'Pip', colour: 1, early: true }]);
  await startGame(clients[0]!, { kind: 'seasons', seasons: 5 }, 5);
  go(clients);
  await until('game three to end', () => clients.every((x) => x.ended), 900_000);
  const rep = replayAndCompare(clients);
  const before = await debug(clients[0]!);
  for (const x of clients) await x.close();
  // The same replay on Node, cold and warm, for scale.
  const ended = clients[0]!.ended!;
  const nodeMs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    replay(createSeason(ended.setup), ended.log);
    nodeMs.push(Math.round(performance.now() - t));
  }
  const wakes: { hello: number; replay: number; read: number }[] = [];
  for (let i = 0; i < 3; i++) {
    await wr.stop();
    await wr.start();
    const x = clients[0]!;
    x.view = null;
    const t1 = Date.now();
    await x.connect({ token: x.token });
    await until('the final view', () => x.view !== null);
    const hello = Date.now() - t1;
    const after = await debug(x);
    if (after.hash !== before.hash) throw new Error('the five-season room woke different');
    wakes.push({ hello, replay: after.wakeMs, read: after.readMs });
    await x.close();
  }
  row(
    'wake + replay time for a five-season room',
    true,
    `${rep.logRows} log rows (${(rep.logBytes / 1024).toFixed(0)} KB); wake in the room ${wakes.map((w) => w.replay).join(' / ')} ms (of which reading the rows ${wakes.map((w) => w.read).join(' / ')} ms); the same replay on Node ${nodeMs.join(' / ')} ms; hello to whole view after a restart ${wakes.map((w) => w.hello).join(' / ')} ms (spike: ~220 ms)`,
  );
  row(
    "game three: final state equals Node's replay",
    before.hash === rep.finalHash,
    `room ${before.hash.slice(0, 16)}…, Node ${rep.finalHash.slice(0, 16)}…`,
  );
  summary(clients, 'game three', rep, t0);
}

// ── Game 4: a room from an older engine (§7) ─────────────────────────────────────────────────────

async function gameFour(): Promise<void> {
  const code = await createRoom();
  const clients = await join(code, [{ name: 'Quin', colour: 2, early: false }]);
  await startGame(clients[0]!, { kind: 'seasons', seasons: 1 }, 2);
  const x = clients[0]!;
  await debug(x, 'stale');
  await x.close();
  x.view = null;
  const w = await x.connect({ token: x.token });
  const act = await x.request({ t: 'act', actions: [{ t: 'EndPhase', playerId: x.seat }] });
  const ok =
    w.t === 'welcome' &&
    !!w.stale &&
    w.stale.standings.length === 3 &&
    act.t === 'rejected' &&
    x.view === null;
  row(
    'a room on an older STATE_VERSION says so, shows its standings and plays no more',
    ok,
    w.t === 'welcome' && w.stale
      ? `version ${w.stale.stateVersion} vs ${w.stale.engineVersion}; standings ${w.stale.standings.map((s) => s.name).join(', ')}; a press: "${act.t === 'rejected' ? act.error : act.t}"`
      : JSON.stringify(w).slice(0, 200),
  );
  await x.close();
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const wr = new Wrangler(resolve(SHOTS, 'state'));
  process.on('exit', () => wr.killNow());
  const boot = await wr.start();
  console.log(
    `online walk: wrangler dev up in ${(boot / 1000).toFixed(1)} s on ${HTTP}, state in shots/online-walk/state`,
  );
  try {
    const only = process.argv.slice(2);
    const want = (n: string) => only.length === 0 || only.includes(n);
    if (want('one')) await gameOne(wr);
    if (want('two')) await gameTwo();
    if (want('four')) await gameFour();
    if (want('three')) await gameThree(wr);
  } finally {
    await wr.stop();
  }
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} row(s) FAILED` : `All ${results.length} rows pass.`);
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
