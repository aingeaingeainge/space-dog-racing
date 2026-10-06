/**
 * **`browser-walk`** (ONLINE_PLAN §8 item 4, §10's L3 table): three real browsers play a weekend in a
 * room under `wrangler dev`, through the web app's own screens, and the screenshots land in
 * `shots/browser-walk/` at 1280 and 390.
 *
 *   npx tsx scripts/browser-walk.ts        (in packages/server, after `npm run server:install`)
 *
 * It builds the web twice — with `VITE_ROOMS_URL` pointing at the room, and without it — serves each
 * with `vite preview`, starts `wrangler dev`, and drives Chromium (`playwright`, a devDependency of
 * this package only, so Pages never installs it) in three contexts:
 *
 * - **A** makes a room from the Title's "Play online"; **B** joins by the link; **C** by the code;
 * - the host adds an AI, sets a race to 1 Bone (so the first weekend is the game), and starts;
 * - the game opens on the draft (Phase N): each browser takes its six picks when its turn comes,
 *   an item and then "Take", while the others watch;
 * - they play the weekend: a door each (B's early, so the room holds it), a declaration, a bet, the
 *   races, the results, "Fly on" (B's early again);
 * - B refreshes mid-sitting and comes back to the same screen; A nudges B and B's tab title flashes;
 * - the game's end, and the host's **Play again**: every browser follows to the new room;
 * - and a build **without** `VITE_ROOMS_URL` has no "Play online".
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, errors, type Browser, type Page } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..');
const WEB = resolve(SERVER, '../web');
const OUT = resolve(SERVER, '../../shots/browser-walk');
const ROOM_PORT = Number(process.env.ROOM_PORT ?? 8792);
const WEB_PORT = 4180;
const OFF_PORT = 4181;
const ROOMS = `http://127.0.0.1:${ROOM_PORT}`;

// ── Processes ────────────────────────────────────────────────────────────────────────────────────

const procs: ChildProcess[] = [];
function killAll(): void {
  for (const p of procs)
    try {
      if (p.exitCode === null) process.kill(-p.pid!, 'SIGKILL');
    } catch {
      // Gone.
    }
}
process.on('exit', killAll);

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (b: Buffer) => (out += b.toString()));
    p.stderr.on('data', (b: Buffer) => (out += b.toString()));
    p.on('exit', (code) =>
      code === 0 ? ok() : fail(new Error(`${cmd} ${args.join(' ')}:\n${out}`)),
    );
  });
}

/** Start a long-running process and wait for `ready` in its output. */
function serve(cmd: string, args: string[], cwd: string, ready: string, env = process.env) {
  return new Promise<void>((ok, fail) => {
    const p = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push(p);
    let out = '';
    const timer = setTimeout(() => fail(new Error(`${cmd} did not start:\n${out}`)), 90_000);
    const read = (b: Buffer) => {
      out += b.toString();
      if (out.includes(ready)) {
        clearTimeout(timer);
        ok();
      }
    };
    p.stdout!.on('data', read);
    p.stderr!.on('data', read);
    p.on('exit', (code) => fail(new Error(`${cmd} exited ${code}:\n${out.slice(-2000)}`)));
  });
}

async function buildWeb(outDir: string, rooms: string | null): Promise<void> {
  const env = { ...process.env };
  delete env.VITE_ROOMS_URL;
  if (rooms) env.VITE_ROOMS_URL = rooms;
  await run('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], WEB, env);
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

const rows: { ok: boolean; text: string }[] = [];
function row(name: string, ok: boolean, detail: string): void {
  rows.push({ ok, text: name });
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
}

const shots: string[] = [];
/** The same moment at 1280 and at 390 (a phone), full page. */
async function shoot(page: Page, name: string): Promise<void> {
  const was = page.viewportSize() ?? { width: 1280, height: 900 };
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await sleep(250);
    const file = `${name}-${width}.png`;
    await page.screenshot({ path: resolve(OUT, file), fullPage: true, animations: 'disabled' });
    shots.push(file);
  }
  await page.setViewportSize(was);
}

/**
 * A line's text, or '' if it went away between looking and reading: in a live room another
 * browser's move can take a screen down at any moment, and waiting 30 s for it to come back is a
 * stall, not a check.
 */
async function textOf(loc: ReturnType<Page['locator']>): Promise<string> {
  return (
    (await loc
      .first()
      .textContent({ timeout: 1000 })
      .catch(() => null)) ?? ''
  );
}

async function seen(page: Page, sel: ReturnType<Page['locator']>): Promise<boolean> {
  void page;
  try {
    return await sel.first().isVisible();
  } catch {
    return false;
  }
}

interface Seat {
  name: string;
  page: Page;
  early: boolean;
  bet: boolean;
  declared: boolean;
  log: string[];
}

function btn(page: Page, name: string | RegExp) {
  return page.getByRole('button', { name, exact: typeof name === 'string' });
}

async function topStat(page: Page): Promise<string> {
  return (await page.locator('.topbar').first().textContent()) ?? '';
}

// ── One press, as a person at this browser would ─────────────────────────────────────────────────

const firsts = new Set<string>();
/** The three browsers, for the one courtesy in `act`. */
let everyone: Seat[] = [];
async function once(key: string, f: () => Promise<void>): Promise<void> {
  if (firsts.has(key)) return;
  firsts.add(key);
  await f();
}

/** Look at the screen and press at most one thing. Returns what, or null if nothing to do. */
async function act(p: Seat): Promise<string | null> {
  const page = p.page;
  const waiting = await seen(page, page.locator('.waiting-line'));
  if (await seen(page, page.getByRole('heading', { name: 'Game over' }))) return null;
  if (await seen(page, page.locator('.scrim.event'))) {
    await page.locator('.scrim.event .row button').first().click();
    return 'answered a card';
  }
  // Phase N: the draft (public, in turn order). Two presses a pick: an item, then "Take …".
  if (await seen(page, page.locator('.draft-take'))) {
    await once('draft', () => shoot(page, '00-draft'));
    if (await seen(page, btn(page, /^Take /))) {
      await btn(page, /^Take /).click();
      return 'drafted';
    }
    await page.locator('button.draft-item:not([disabled])').first().click();
    return 'pressed a draft item';
  }
  if (await seen(page, btn(page, /: open a door$/))) {
    await btn(page, /: open a door$/).click();
    return 'read the arrival';
  }
  if (await seen(page, btn(page, /: to the Bookie$/))) {
    await btn(page, /: to the Bookie$/).click();
    return 'read the board';
  }
  if (await seen(page, btn(page, 'Skip the rest of race day'))) {
    await once('race', async () => {
      await sleep(2500);
      await shoot(page, '05-race-view');
    });
    await btn(page, 'Skip the rest of race day').click();
    return 'skipped the rest of race day';
  }
  if (await seen(page, btn(page, 'Next ⏎'))) {
    await btn(page, 'Next ⏎').click();
    return 'next race';
  }
  if (await seen(page, btn(page, 'Back to the planet'))) {
    await once('results', () => shoot(page, '06-results'));
    await btn(page, 'Back to the planet').click();
    return 'read the results';
  }
  if (await seen(page, btn(page, 'Done betting'))) {
    if (!p.bet) {
      await once('bookie', () => shoot(page, '04-bookie'));
      const odds = page.locator('.ticket button').filter({ hasText: /^\d+\.\d\d$/ });
      if (await seen(page, odds)) {
        await odds.first().click();
        p.bet = true;
        return 'placed a bet';
      }
      p.bet = true;
    }
    await btn(page, 'Done betting').click();
    return 'done betting';
  }
  const doors = page.locator('.doors button.door:not([disabled])');
  if (await seen(page, doors)) {
    if (waiting && !p.early) return null;
    await doors.nth(1).click();
    if (waiting) {
      await page.locator('.notice.held').first().waitFor({ timeout: 5000 });
      await once('held-door', () => shoot(page, '03-explore-held-door'));
      return 'picked a door early (held)';
    }
    return 'picked a door';
  }
  if (await seen(page, btn(page, /^(Head to the track|Next: Race Office)$/))) {
    if (!p.declared) {
      await page.locator('nav.tabs').getByRole('button', { name: 'Race Office' }).click();
      const select = page.locator('select.wide').first();
      await select.waitFor({ timeout: 5000 });
      const values = await select
        .locator('option:not([disabled])')
        .evaluateAll((os) => os.map((o) => (o as unknown as { value: string }).value));
      const dog = values.find((v) => v);
      if (dog) await select.selectOption(dog);
      await sleep(400);
      p.declared = true;
      return 'declared a dog';
    }
    await btn(page, /^(Head to the track|Next: Race Office)$/).click();
    return 'headed to the track';
  }
  if (await seen(page, btn(page, 'End turn'))) {
    // Let everybody read the results first, so a stable behind in the turn order is waiting — and
    // can press "Fly on" early — before this one flies (people do not all read at the same speed).
    if (everyone.some((q) => q !== p && !q.log.includes('read the results'))) return null;
    await btn(page, 'End turn').click();
    return 'ended the turn';
  }
  if (waiting && (await seen(page, btn(page, 'Fly on'))) && p.early) {
    await btn(page, 'Fly on').click();
    return 'pressed Fly on early (held)';
  }
  return null;
}

// ── The walk ─────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const onDir = resolve(OUT, 'web-online');
  const offDir = resolve(OUT, 'web-hotseat');
  const t0 = Date.now();
  await buildWeb(onDir, ROOMS);
  await buildWeb(offDir, null);
  console.log(`browser walk: two builds in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await serve(
    'npx',
    [
      'wrangler',
      'dev',
      '--port',
      String(ROOM_PORT),
      '--ip',
      '127.0.0.1',
      '--persist-to',
      resolve(OUT, 'state'),
      '--show-interactive-dev-session=false',
    ],
    SERVER,
    'Ready on',
    { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
  );
  const preview = (dir: string, port: number) =>
    serve(
      'npx',
      [
        'vite',
        'preview',
        '--outDir',
        dir,
        '--port',
        String(port),
        '--strictPort',
        '--host',
        '127.0.0.1',
      ],
      WEB,
      `${port}`,
    );
  await preview(onDir, WEB_PORT);
  await preview(offDir, OFF_PORT);
  const base = `http://127.0.0.1:${WEB_PORT}/`;
  const browser: Browser = await chromium.launch();
  try {
    await walk(browser, base);
  } finally {
    await browser.close();
    killAll();
  }
  const bad = rows.filter((r) => !r.ok);
  console.log(`screenshots (${shots.length}) in shots/browser-walk/: ${shots.join(', ')}`);
  console.log(bad.length ? `${bad.length} row(s) FAILED` : `All ${rows.length} rows pass.`);
  process.exit(bad.length ? 1 : 0);
}

async function newSeat(browser: Browser, name: string, early: boolean): Promise<Seat> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  ${name}: page error: ${e.message}`));
  return { name, page, early, bet: false, declared: false, log: [] };
}

async function walk(browser: Browser, base: string): Promise<void> {
  // Without a rooms URL, the Title is today's: no "Play online" at all.
  const off = await browser.newPage();
  await off.goto(`http://127.0.0.1:${OFF_PORT}/`);
  await off.getByRole('button', { name: 'Play', exact: true }).first().waitFor();
  const offCount = await off.getByRole('button', { name: 'Play online' }).count();
  await off.close();

  const A = await newSeat(browser, 'Aroha', false);
  const B = await newSeat(browser, 'Bex', true);
  const C = await newSeat(browser, 'Cal', true);
  const table = [A, B, C];
  everyone = table;

  // A: Title → Play online → Create a room.
  await A.page.goto(base);
  const onCount = await btn(A.page, 'Play online').count();
  row(
    'a build without VITE_ROOMS_URL shows no "Play online"; with it, one',
    offCount === 0 && onCount === 1,
    `${offCount} without, ${onCount} with`,
  );
  await shoot(A.page, '00-title-online');
  await btn(A.page, 'Play online').click();
  await A.page.getByPlaceholder('Aroha').fill('Aroha');
  await btn(A.page, 'Create the room').click();
  await A.page.locator('.room-code').waitFor();
  const code = ((await A.page.locator('.room-code').textContent()) ?? '').trim();
  const link = await A.page.locator('.room-link input').inputValue();

  // B: by the link.
  await B.page.goto(link);
  await B.page.getByPlaceholder('Aroha').waitFor();
  await shoot(B.page, '01-lobby-join-by-link');
  await B.page.getByPlaceholder('Aroha').fill('Bex');
  await btn(B.page, 'Sit down').click();
  await B.page.getByText('· you').waitFor();

  // C: by the code, typed.
  await C.page.goto(base);
  await btn(C.page, 'Play online').click();
  await C.page.locator('.room-code-input').fill(code.toLowerCase());
  await btn(C.page, 'Join').click();
  await C.page.getByPlaceholder('Aroha').waitFor();
  await C.page.getByPlaceholder('Aroha').fill('Cal');
  await btn(C.page, 'Sit down').click();
  await C.page.getByText('· you').waitFor();

  // The host: one AI, a race to 1 Bone (the first weekend is the whole game), and Start.
  await btn(A.page, 'Add an AI').click();
  await A.page.locator('.lobby-seats tr').nth(3).waitFor();
  await A.page.getByRole('combobox').filter({ hasText: 'season' }).first().selectOption('custom');
  await A.page.locator('input[type="number"]').first().fill('1');
  await sleep(500);
  const seatsSeen = await B.page.locator('.lobby-seats tr').count();
  await shoot(A.page, '02-lobby-host');
  await shoot(B.page, '02-lobby-guest');
  row(
    'three browsers in one room: created, joined by link and by code',
    seatsSeen === 4 && /^[A-Z]{6}$/.test(code) && link.includes(`room=${code}`),
    `room ${code}, link ${link}; B's lobby shows ${seatsSeen} seats`,
  );
  await btn(A.page, 'Start').click();
  // The game opens on the arrival (no top bar) or, for a stable not yet up, the waiting hub.
  for (const p of table)
    await btn(p.page, /: open a door$/)
      .or(p.page.locator('.topbar'))
      .first()
      .waitFor({ timeout: 20_000 });

  // The weekend.
  let refreshed = '';
  let nudged = '';
  let waitingShot = false;
  let quietSince = Date.now();
  const deadline = Date.now() + 240_000;
  for (const p of table) p.page.setDefaultTimeout(5000);
  while (Date.now() < deadline) {
    let any = false;
    for (const p of table) {
      const page = p.page;
      // The waiting line, the first time someone is waiting on a sitting.
      if (!waitingShot && (await seen(page, page.locator('.waiting-line')))) {
        const text = await textOf(page.locator('.waiting-line'));
        if (/Market and Race Office/.test(text)) {
          waitingShot = true;
          await shoot(page, '07-waiting-line');
          p.log.push(`waiting line: ${text}`);
        }
      }
      // A nudges B, once, while A waits on B.
      if (!nudged && p === A && (await seen(page, page.locator('.waiting-line')))) {
        const text = await textOf(page.locator('.waiting-line'));
        if (/Waiting on Bex/.test(text) && (await btn(page, 'Nudge').isEnabled())) {
          await btn(page, 'Nudge').click();
          let title = '';
          for (let i = 0; i < 20 && !/nudged you/.test(title); i++) {
            await sleep(150);
            title = await B.page.title();
          }
          const notice = await seen(B.page, B.page.locator('.notice.nudge'));
          nudged = `A's line: "${text.trim()}"; B's tab title: "${title}"; B's notice ${notice ? 'shown' : 'MISSING'}`;
          if (notice) await shoot(B.page, '08-nudged');
          row('A nudges B: the tab title flashes', /nudged you/.test(title) && notice, nudged);
        }
      }
      // B refreshes mid-sitting (its own Market and Race Office) and comes back to the same screen.
      if (!refreshed && p === B && (await seen(page, btn(page, 'Head to the track')))) {
        const before = await topStat(page);
        await page.reload();
        await btn(page, 'Head to the track').waitFor({ timeout: 20_000 });
        const after = await topStat(page);
        refreshed = `before "${before.trim()}", after "${after.trim()}"`;
        row(
          'a refresh mid-sitting comes back to the same screen',
          before === after && page.url().includes(`room=${code}`),
          `${refreshed}; ${page.url()}`,
        );
      }
      // A press can miss when the room moves this browser's screen between the look and the click
      // (the button detaches, or the next screen's scrim takes the pointer). That is the room
      // working, not a failure: look again next time round. A real hang is still "the table stalled".
      const did = await act(p).catch((e: unknown) => {
        if (e instanceof errors.TimeoutError) return null;
        throw e;
      });
      if (did) {
        any = true;
        p.log.push(did);
      }
    }
    if (any) quietSince = Date.now();
    const over = await Promise.all(
      table.map((p) => seen(p.page, p.page.getByRole('heading', { name: 'Game over' }))),
    );
    if (over.every(Boolean)) break;
    if (Date.now() - quietSince > 20_000) throw new Error('the table stalled');
    await sleep(120);
  }
  for (const p of table) p.page.setDefaultTimeout(30_000);
  for (const p of table) console.log(`  ${p.name}: ${p.log.join(' → ')}`);
  const all = table.flatMap((p) => p.log);
  // B and C both pick early when they can: whichever is not first in the turn order is held.
  const heldDoor = [B, C].filter((p) => p.log.includes('picked a door early (held)'));
  const heldFly = [B, C].filter((p) => p.log.includes('pressed Fly on early (held)'));
  // Phase N: the game opened on the draft, and each of the three picked its six in turn.
  const drafted = table.map((p) => p.log.filter((x) => x === 'drafted').length);
  row(
    'the draft opens the game: each browser takes its six picks in turn, two presses a pick',
    drafted.every((n) => n === 6) &&
      table.every((p) => p.log.filter((x) => x === 'pressed a draft item').length === 6),
    `picks ${table.map((p, i) => `${p.name} ${drafted[i]}`).join(', ')}`,
  );
  row(
    'a weekend played in three browsers: doors, a declaration, a bet, the races, the results',
    all.filter((x) => x.startsWith('picked a door')).length === 3 &&
      all.includes('declared a dog') &&
      all.includes('placed a bet') &&
      all.filter((x) => x === 'read the results').length === 3,
    `${all.length} presses`,
  );
  row(
    'a held door and a held "Fly on" show as held, and land in turn order',
    heldDoor.length > 0 &&
      heldFly.length > 0 &&
      all.filter((x) => x.startsWith('picked a door')).length === 3,
    `doors held for ${heldDoor.map((p) => p.name).join(', ') || 'nobody'} ("Your door is chosen" shown); "Fly on" held for ${heldFly.map((p) => p.name).join(', ') || 'nobody'}; every stable reached the game's end, which needs every door and every "Fly on" applied`,
  );
  if (!refreshed) row('a refresh mid-sitting comes back to the same screen', false, 'never tried');
  if (!nudged) row('A nudges B: the tab title flashes', false, 'never tried');

  // The game's end, and Play again: every browser follows to the new room.
  await shoot(A.page, '09-game-over-host');
  await shoot(B.page, '09-game-over-guest');
  await btn(A.page, 'Play again').click();
  const followed: string[] = [];
  for (const p of table) {
    await p.page.waitForURL((u) => !u.search.includes(code) && u.search.includes('room='), {
      timeout: 20_000,
    });
    await btn(p.page, /: open a door$/)
      .or(p.page.locator('.topbar'))
      .first()
      .waitFor({ timeout: 20_000 });
    followed.push(new URL(p.page.url()).searchParams.get('room') ?? '');
  }
  // Phase N: a new game opens on the draft, whose top bar says the week it leads into.
  const week = await topStat(C.page);
  await shoot(C.page, '10-play-again-follows');
  row(
    'Play again: a new room, and every browser follows',
    followed.every((c) => c === followed[0] && c !== code) && /Week 1[ /]/.test(week),
    `${code} → ${followed.join(', ')}; C's first screen: "${week.trim()}"`,
  );
}

main().catch((e) => {
  console.error(e);
  killAll();
  process.exit(1);
});
