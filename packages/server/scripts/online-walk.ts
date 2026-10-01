/**
 * **`online-walk`** (ONLINE_PLAN §8 item 3, the headless half): fake players finish games in a room
 * under `wrangler dev`, over real WebSockets, and it prints a line per row of §10's Phase L2 table.
 *
 *   npm run walk            (in packages/server; it starts and stops `wrangler dev` itself)
 *
 * Each client presses **only what its own view offers**, with `table-walk.ts`'s plain line: a door a
 * week, a crate of staple when short, the best three dogs declared, 100 on each favourite, and a
 * draft pick — the opening draft's and the off-season's — when its turn comes (Phase N). Some clients pick their door and press "Fly on" early, which the room holds
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
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeason, PROTOCOL_VERSION, replay, type Action } from '@sdr/engine';
import { driveRoom } from '../src/game';
import type { ClientMsg } from '../src/protocol';
import {
  actStats,
  Client,
  createRoom,
  debug,
  go,
  join,
  originCheck,
  oversizeCheck,
  queueRow,
  quiet,
  replayAndCompare,
  results,
  row,
  setEndpoint,
  sha,
  sleep,
  startGame,
  summary,
  until,
  type Replayed,
} from './client';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..');
const SHOTS = resolve(SERVER, '../../shots/online-walk');
const PORT = Number(process.env.WALK_PORT ?? 8790);
const HTTP = `http://127.0.0.1:${PORT}`;
setEndpoint(HTTP);

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
  // v3l4: the room is public now. Another page is refused; a frame or an act too big is refused.
  const origins = await originCheck(code, 'http://localhost:5173', 'https://evil.example');
  row(
    'another page may not make a room or open a socket; CORS names the page',
    origins.ok,
    origins.detail,
  );
  const caps = await oversizeCheck(a);
  row(
    'a frame over 16 KB and an act of 65 actions are refused, and the socket carries on',
    caps.ok,
    caps.detail,
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
  console.log(
    `  the largest act sent: ${actStats.maxBytes} bytes, ${actStats.maxActions} actions (of ${actStats.frames} acts; the room's caps are 16,384 bytes and 64 actions)`,
  );
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} row(s) FAILED` : `All ${results.length} rows pass.`);
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
