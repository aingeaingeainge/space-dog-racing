/**
 * v3 Phase L3 (ONLINE_PLAN §10, L3): **the online table, walked headless.** N browsers-worth of the
 * web's own store — each a real `gameStore` in online mode, zustand running in Node, Node's global
 * `WebSocket` standing in for the browser's — against a room under `wrangler dev`. Each walks
 * `screenFor` online and presses only what its screen offers, with `table-walk.ts`'s plain line.
 *
 *   npx vite-node --root packages/web packages/web/scripts/online-table-walk.ts
 *
 * (It needs `npm run server:install` once: it starts and stops `wrangler dev` itself.)
 *
 * It checks, over 4 humans + 2 AIs for two seasons and 8 humans for one:
 * - every game finishes, and **no pass screen (nor the hotseat roll-call) ever appears online**;
 * - a private screen is only ever the client's own seat's;
 * - every `waiting` screen names only seats that are on the clock;
 * - a client's final report equals hotseat's `lib/report.ts` run over the room's `ended` setup and
 *   log, plus the stand-in line (one client closes its tab mid-game, the host lets an AI play for
 *   it, and it comes back by its token);
 * - Play again: the host presses it, and every store follows to the same new room, same seats.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aiChoiceFor,
  createSeason,
  replay,
  viewFor,
  type Action,
  type GameLength,
} from '@sdr/engine';
import { makeGameStore, type GameStoreHook } from '../src/store/gameStore';
import { PRIVATE_SCREENS, screenFor, type ScreenUi } from '../src/store/loop';
import { memoryStore } from '../src/store/online';
import { buildReport } from '../src/lib/report';
import { EMPTY_PACE } from '../src/lib/pace';
import { waitingLine } from '../src/lib/waiting';
import { bettingTurn, draftPress, planetTurn } from './table-walk';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '../../server');
const STATE = resolve(HERE, '../../../shots/online-table-walk');
const PORT = Number(process.env.WALK_PORT ?? 8791);
const HTTP = `http://127.0.0.1:${PORT}`;
const BASE = 'http://walk.local/';

// ── wrangler dev ─────────────────────────────────────────────────────────────────────────────────

let wrangler: ChildProcess | null = null;

async function startWrangler(): Promise<void> {
  rmSync(STATE, { recursive: true, force: true });
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
      STATE,
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: SERVER,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
    },
  );
  wrangler = proc;
  await new Promise<void>((ok, fail) => {
    let out = '';
    const timer = setTimeout(() => fail(new Error(`wrangler dev did not start:\n${out}`)), 90_000);
    const read = (b: Buffer) => {
      out += b.toString();
      if (out.includes('Ready on')) {
        clearTimeout(timer);
        ok();
      }
    };
    proc.stdout!.on('data', read);
    proc.stderr!.on('data', read);
    proc.on('exit', (code) => fail(new Error(`wrangler dev exited ${code}:\n${out.slice(-2000)}`)));
  });
}

function stopWrangler(): void {
  try {
    if (wrangler && wrangler.exitCode === null) process.kill(-wrangler.pid!, 'SIGKILL');
  } catch {
    // Gone.
  }
  wrangler = null;
}
process.on('exit', stopWrangler);

function sleep(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

async function until(what: string, test: () => boolean, ms = 180_000): Promise<void> {
  const t0 = Date.now();
  while (!test()) {
    if (Date.now() - t0 > ms) {
      for (const c of clients) console.error(`  ${c.name}: ${c.describe()}`);
      throw new Error(`timed out waiting for ${what}`);
    }
    await sleep(15);
  }
}

// ── A headless browser: one store, walking its own screens ───────────────────────────────────────

interface ClientOpts {
  name: string;
  colour: number;
  /** Picks its door and presses "Fly on" before its turn, so the room holds them. */
  early: boolean;
}

let clients: Client[] = [];

class Client {
  readonly store: GameStoreHook;
  readonly name: string;
  paused = true;
  finished = false;
  screens: Record<string, number> = {};
  failures: string[] = [];
  presses = 0;
  early = { door: 0, flyOn: 0 };
  waitingScreens = 0;
  private scheduled = false;
  /** When the last press left, and how long each took to come back as a view (ms). */
  private pressedAt = 0;
  trips: number[] = [];
  private lastPress = '';

  constructor(
    readonly opts: ClientOpts,
    readonly storage = memoryStore(),
  ) {
    this.name = opts.name;
    this.store = makeGameStore({
      storage,
      WebSocket: globalThis.WebSocket,
      roomsUrl: HTTP,
    });
    this.store.subscribe(() => this.schedule());
  }

  get g() {
    return this.store.getState();
  }

  describe(): string {
    const g = this.g;
    return `seat ${g.seat} code ${g.code} conn ${g.conn} rev ${g.rev} ${g.state?.phase} s${g.state?.season}w${g.state?.week} inFlight ${g.inFlight.length} error ${g.error} paused ${this.paused} last ${this.lastPress} clock ${JSON.stringify(g.meta?.clock.seats)} queued ${JSON.stringify(g.meta?.queued)}`;
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      try {
        this.step();
      } catch (e) {
        this.failures.push(`threw: ${(e as Error).stack ?? String(e)}`);
      }
    }, 0);
  }

  kick(): void {
    this.paused = false;
    this.schedule();
  }

  private fail(what: string): void {
    if (this.failures.length < 20) this.failures.push(what);
  }

  private press(what: string, ...actions: Action[]): void {
    this.lastPress = `${what} s${this.g.state?.season}w${this.g.state?.week}`;
    this.presses += actions.length;
    this.pressedAt = performance.now();
    this.g.dispatch(...actions);
  }

  /** One look at the screen, and at most one press — exactly as a person at this browser would. */
  step(): void {
    const g = this.g;
    if (this.pressedAt && !g.inFlight.length) {
      this.trips.push(performance.now() - this.pressedAt);
      this.pressedAt = 0;
    }
    if (this.paused || this.finished || !g.state || !g.seat || g.inFlight.length || !g.meta) return;
    if (g.conn !== 'open') return;
    const s = g.state;
    const ui: ScreenUi = {
      racesWatchedWeek: g.racesWatchedWeek,
      resultsSeenWeek: g.resultsSeenWeek,
      fieldsSeenWeek: g.fieldsSeenWeek,
      passAck: g.passAck,
      bustAck: g.bustAck,
      seasonSeen: g.seasonSeen,
      arrivalSeenWeek: g.arrivalSeenWeek,
      boardSeenWeek: g.boardSeenWeek,
      postTrade: g.postTrade,
    };
    const online = { seat: g.seat, meta: g.meta };
    const screen = screenFor(s, ui, online);
    this.screens[screen.kind] = (this.screens[screen.kind] ?? 0) + 1;
    const where = `s${s.season}w${s.week} ${s.phase}`;
    if (screen.kind === 'pass' || screen.kind === 'afterRaces')
      this.fail(`${where}: a hotseat ${screen.kind} screen online`);
    if (PRIVATE_SCREENS.has(screen.kind) && screen.me?.id !== g.seat)
      this.fail(`${where}: ${screen.me?.id}'s ${screen.kind} screen on ${g.seat}'s browser`);
    const me = screen.me;
    switch (screen.kind) {
      case 'seasonEnd':
        if (s.phase === 'offSeason') return g.ackSeason();
        if (g.log.length) this.finished = true;
        return;
      case 'noHuman':
        return this.fail(`${where}: noHuman`);
      case 'fields':
        return g.ackFields();
      case 'race':
        return g.ackRaces();
      case 'results':
        return g.ackResults();
      case 'arrival':
        return g.ackArrival();
      case 'board':
        return g.ackBoard();
      case 'explore': {
        const on = g.meta.clock.seats.includes(g.seat);
        const held = g.meta.queued[g.seat] === 'door';
        if (held) return;
        if (!on && !this.opts.early) return;
        if (!on) this.early.door++;
        return this.press('door', { t: 'ChooseDoor', playerId: g.seat, door: s.week % 3 });
      }
      case 'betting':
        return this.press('bets', ...bettingTurn(s, me!));
      case 'draft': {
        // Phase N: public, in turn order — press only when this seat is the one picking.
        if (s.activePlayer !== g.seat) return;
        return this.press('draft', draftPress(s, me!).action);
      }
      case 'planet': {
        if (s.pendingEvent && s.pendingEvent.playerId === g.seat) {
          let choice = 0;
          try {
            choice = aiChoiceFor(s, g.seat);
          } catch {
            choice = 0;
          }
          return this.press('card', { t: 'ResolveEvent', playerId: g.seat, choice });
        }
        return this.press('planet', ...planetTurn(s, me!));
      }
      case 'waiting': {
        this.waitingScreens++;
        const line = waitingLine(s, g.meta, g.seat);
        if (line)
          for (const p of line.who)
            if (!g.meta.clock.seats.includes(p.id))
              this.fail(`${where}: waiting names ${p.name}, who is not on the clock`);
        if (
          this.opts.early &&
          s.phase === 'planetPost' &&
          !s.done.includes(g.seat) &&
          !g.meta.queued[g.seat]
        ) {
          this.early.flyOn++;
          return this.press('early fly on', { t: 'EndPhase', playerId: g.seat });
        }
        return;
      }
      default:
        return this.fail(`${where}: unexpected screen ${screen.kind}`);
    }
  }
}

// ── The checks ───────────────────────────────────────────────────────────────────────────────────

const rows: { ok: boolean; text: string }[] = [];
function row(name: string, ok: boolean, detail: string): void {
  rows.push({ ok, text: `${ok ? '✓' : '✗'} ${name}: ${detail}` });
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
}

/** SHA-256 of a state with its top-level keys sorted: a patch keeps the client's key order. */
function sha(v: object): string {
  const sorted = Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

function standInsOf(c: Client): { name: string; weekends: number }[] {
  const g = c.g;
  return Object.entries(g.meta?.standInWeekends ?? {}).map(([id, weekends]) => ({
    name: g.state!.players.find((p) => p.id === id)?.name ?? id,
    weekends,
  }));
}

/** The report a browser would copy, and hotseat's over the room's setup and log. */
function reports(c: Client): {
  online: string;
  hotseat: string;
  stateSame: boolean;
  differ: string[];
} {
  const g = c.g;
  const standIns = standInsOf(c);
  const common = { pace: EMPTY_PACE, base: BASE, build: 'walk', standIns };
  const online = buildReport({ s: g.state!, setup: g.setup!, log: g.log, ...common });
  const replayed = replay(createSeason(g.setup!), g.log);
  const hotseat = buildReport({ s: replayed, setup: g.setup!, log: g.log, ...common });
  // At game over a view is the whole state, plus the rumours (engine view.ts).
  const want = viewFor(replayed, g.seat!);
  const differ = Object.keys({ ...want, ...g.state }).filter(
    (k) =>
      JSON.stringify((want as unknown as Record<string, unknown>)[k]) !==
      JSON.stringify((g.state as unknown as Record<string, unknown>)[k]),
  );
  return { online, hotseat, stateSame: sha(want) === sha(g.state!), differ };
}

async function sitDown(opts: ClientOpts[]): Promise<{ code: string; table: Client[] }> {
  const table = opts.map((o) => new Client(o));
  clients = table;
  const host = table[0]!;
  await host.g.createRoom(host.opts.name, host.opts.colour);
  await until('the host to sit down', () => !!host.g.seat);
  const code = host.g.code!;
  for (const c of table.slice(1)) {
    c.g.joinRoom(code, { name: c.opts.name, colour: c.opts.colour });
    await until(`${c.name} to sit down`, () => !!c.g.seat || !!c.g.error);
    if (!c.g.seat) throw new Error(`${c.name}: ${c.g.error}`);
  }
  return { code, table };
}

async function start(host: Client, length: GameLength, ai: number): Promise<void> {
  host.g.setTable({
    length,
    ai: Array.from({ length: ai }, () => ({ difficulty: 'normal' as const })),
  });
  await until(
    'the lobby to take the table',
    () =>
      host.g.lobby?.seats.filter((x) => x.kind === 'ai').length === ai &&
      JSON.stringify(host.g.lobby.length) === JSON.stringify(length),
  );
  host.g.startRoom();
  await until('the game to start', () => clients.every((c) => !!c.g.state));
}

function screenSummary(table: Client[]): string {
  const all: Record<string, number> = {};
  for (const c of table) for (const [k, n] of Object.entries(c.screens)) all[k] = (all[k] ?? 0) + n;
  return Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(' · ');
}

function common(label: string, table: Client[], t0: number): void {
  const failures = table.flatMap((c) => c.failures.map((f) => `${c.name}: ${f}`));
  const passes = table.reduce((n, c) => n + (c.screens.pass ?? 0) + (c.screens.afterRaces ?? 0), 0);
  const s = table[0]!.g.state!;
  const trips = table.flatMap((c) => c.trips).sort((a, b) => a - b);
  const pct = (q: number) => trips[Math.min(trips.length - 1, Math.floor(q * trips.length))] ?? 0;
  console.log(
    `  ${label}: a press, dispatch to the view that answers it: median ${pct(0.5).toFixed(1)} ms, p95 ${pct(0.95).toFixed(1)} ms, max ${pct(1).toFixed(1)} ms over ${trips.length} presses`,
  );
  row(
    `${label}: every store finishes the game`,
    table.every((c) => c.finished),
    `${s.seasons.length} season(s), ${s.seasons.reduce((n, r) => n + r.weeks, 0)} weekends, ${table[0]!.g.log.length} log rows, ${table.reduce((n, c) => n + c.presses, 0)} actions pressed, ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  row(
    `${label}: no pass screen ever appears online`,
    passes === 0,
    `${passes} pass or roll-call screens in ${table.reduce((n, c) => n + Object.values(c.screens).reduce((a, b) => a + b, 0), 0)} screens seen (${screenSummary(table)})`,
  );
  row(
    `${label}: private screens are the seat's own; every waiting screen names seats on the clock`,
    failures.length === 0,
    failures.length
      ? failures.slice(0, 6).join('; ')
      : `${table.reduce((n, c) => n + c.waitingScreens, 0)} waiting screens checked; ${table.reduce((n, c) => n + c.early.door, 0)} doors and ${table.reduce((n, c) => n + c.early.flyOn, 0)} "Fly on"s pressed early`,
  );
  const bad: string[] = [];
  let lines = 0;
  for (const c of table) {
    const r = reports(c);
    if (r.online !== r.hotseat) bad.push(`${c.name}: the reports differ`);
    if (!r.stateSame)
      bad.push(
        `${c.name}: the final view is not viewFor over the replayed state (${r.differ.join(', ')})`,
      );
    lines = r.online.split('\n').filter((l) => /played by an AI/.test(l)).length;
  }
  const sample = reports(table[0]!).online.split('\n');
  row(
    `${label}: every store's report equals hotseat's over the room's log`,
    bad.length === 0,
    bad.length
      ? bad.join('; ')
      : `${table.length} reports, ${sample.length} lines each, byte-identical to lib/report.ts over replay(setup, log), and every final view equals viewFor over it${lines ? `; the stand-in line: "${sample.find((l) => /played by an AI/.test(l))}"` : ''}`,
  );
}

// ── Game one: 4 humans + 2 AIs, two seasons; a tab closed and a stand-in; Play again ─────────────

async function gameOne(): Promise<void> {
  const t0 = Date.now();
  const { code, table } = await sitDown([
    { name: 'Aroha', colour: 3, early: false },
    { name: 'Bex', colour: 5, early: true },
    { name: 'Cal', colour: 1, early: false },
    { name: 'Dot', colour: 7, early: true },
  ]);
  const [host, , cal] = table as [Client, Client, Client, Client];
  await start(host, { kind: 'seasons', seasons: 2 }, 2);
  const calSeat = cal.g.seat!;
  for (const c of table) c.kick();

  // Cal closes his tab at season 1 week 4, while he is not on the clock; the host lets an AI play for
  // him from the away strip; he comes back at week 7 with the same browser's token.
  await until('season 1 week 4', () => (cal.g.state?.week ?? 0) >= 4);
  await until(
    'Cal off the clock',
    () => !cal.g.meta!.clock.seats.includes(calSeat) && !cal.g.inFlight.length,
  );
  cal.paused = true;
  cal.g.leaveRoom();
  await until('the host to see Cal away', () => !host.g.meta!.online.includes(calSeat));
  host.g.standIn(calSeat, true);
  await until('the stand-in', () => host.g.meta!.standIn.includes(calSeat));
  await until(
    'season 1 week 7',
    () => (host.g.state?.week ?? 0) >= 7 || (host.g.state?.season ?? 1) > 1,
  );
  cal.g.joinRoom(code);
  await until('Cal back in his seat', () => cal.g.seat === calSeat && !!cal.g.state);
  const back = cal.g.meta!.standIn.length === 0;
  const weekends = cal.g.meta!.standInWeekends[calSeat] ?? 0;
  cal.kick();
  row(
    'game one: a store that closes rejoins by its token; the stand-in hands back',
    back && weekends > 0,
    `Cal's seat ${calSeat} again, whole view at rev ${cal.g.rev}; a stand-in played ${weekends} weekend(s); meta.standIn ${JSON.stringify(cal.g.meta!.standIn)}`,
  );

  await until('game one to end', () => table.every((c) => c.finished), 600_000);
  common('game one (4 + 2, two seasons)', table, t0);

  // Play again (§2.6): the host's press, and every store follows to the same new room.
  const seats = table.map((c) => `${c.g.seat}:${c.name}`).join(',');
  const oldCode = host.g.code;
  host.g.playAgain();
  await until('every store to follow', () =>
    table.every((c) => c.g.code !== oldCode && c.g.state?.phase !== 'seasonEnd' && !!c.g.state),
  );
  const newCode = host.g.code;
  const same = table.every((c) => c.g.code === newCode);
  const seatsAfter = table
    .map((c) => `${c.g.seat}:${c.g.state!.players.find((p) => p.id === c.g.seat)?.name}`)
    .join(',');
  const s = host.g.state!;
  row(
    'game one: Play again — a new room, same seats and seed, every store follows',
    same && seats === seatsAfter && s.season === 1 && s.week === 1 && !!host.g.host,
    `${oldCode} → ${newCode}, ${table.length} stores followed; seats ${seatsAfter}; season ${s.season} week ${s.week}; the same AI stables: ${s.players
      .filter((p) => p.kind === 'ai')
      .map((p) => p.name)
      .join(', ')}`,
  );
  for (const c of table) c.g.leaveRoom();
}

// ── Game two: 8 humans, one season ───────────────────────────────────────────────────────────────

async function gameTwo(): Promise<void> {
  const t0 = Date.now();
  const names = ['Mo', 'Nia', 'Oz', 'Pip', 'Quin', 'Rua', 'Sol', 'Tui'];
  const { table } = await sitDown(
    names.map((name, i) => ({ name, colour: i, early: i % 2 === 1 })),
  );
  await start(table[0]!, { kind: 'seasons', seasons: 1 }, 0);
  for (const c of table) c.kick();
  await until('game two to end', () => table.every((c) => c.finished), 600_000);
  common('game two (8 humans, one season)', table, t0);
  for (const c of table) c.g.leaveRoom();
}

async function main(): Promise<void> {
  const t0 = Date.now();
  await startWrangler();
  console.log(
    `online table walk: wrangler dev up in ${((Date.now() - t0) / 1000).toFixed(1)} s on ${HTTP}`,
  );
  try {
    await gameOne();
    await gameTwo();
  } finally {
    stopWrangler();
  }
  const bad = rows.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} row(s) FAILED` : `All ${rows.length} rows pass.`);
  process.exit(bad.length ? 1 : 0);
}

void (async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    stopWrangler();
    process.exit(1);
  }
})();
