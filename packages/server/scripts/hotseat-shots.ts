/**
 * **`hotseat-shots`** (v3 Phase M): the hotseat screenshots every phase since L3 compared by hand,
 * taken the same way every time, so two builds can be compared PNG for PNG.
 *
 *   npm run hotseat-shots -- <dist> <outDir>        (from the repo root)
 *
 * `<dist>` is a built web (`npm run build`, or `vite build --outDir …`), normally **without**
 * `VITE_ROOMS_URL`. Paths are read from where npm was run. It serves the build on a local port,
 * drives Chromium (`playwright`, a devDependency of this package only), and writes full-page PNGs at
 * 1280 and 390, animations off, of:
 *
 * - `00-title` — the Title, as a fresh browser sees it;
 * - `01-arrival`, `02-explore`, `03-hub-after-door` — a two-human weekend from a seed link (the
 *   hub reads the door back under "Behind the door", with its card up over it if the card asks);
 * - `04-explore-wrap` — the Explore of Hushmarket, whose door names wrap on a phone;
 * - `05-game-over` — a game's end: one human and one AI in a race to 1 Bone;
 * - `06-draft` — the opening draft at a table of six, a human's item pressed (Phase N; also at 360);
 * - `07-off-season` — a two-season game at its off-season draft, resumed from a save the engine plays
 *   to that moment (Phase N; also at 360).
 *
 * **Deterministic:** `Math.random` is a fixed generator (an init script, before the app loads) and
 * `Date.now` is pinned (`page.clock.setFixedTime`), so the Title's seed, the pace timer and anything
 * else that reads them come out the same. Run twice on the same build, it gives identical bytes.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  createSeason,
  decide,
  needsAdvance,
  reduceMut,
  waitingOn,
  type Action,
  type SeasonSetup,
} from '@sdr/engine';
import { SAVE_VERSION } from '../../web/src/store/persist';

const from = process.env.INIT_CWD ?? process.cwd();
const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) {
  console.error('usage: npm run hotseat-shots -- <dist> <outDir>');
  process.exit(2);
}
const DIST = resolve(from, distArg);
const OUT = resolve(from, outArg);
if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`no index.html in ${DIST}: build the web first`);
  process.exit(2);
}

/** The seed links. Each fills the Title in; the script presses Start. */
const WEEKEND = '?seed=42&players=h,h';
const WRAP = '?seed=4&players=h,h'; // Hushmarket in week 1: "The Fence's Parlour" wraps at 390
const GAME_END = '?seed=7&players=h,normal&len=t1';
/** Phase N: the opening draft at a table of six, and a two-season game to its off-season draft. */
const DRAFT = '?seed=42&players=h,h,normal,normal,normal,normal';
/**
 * The off-season draft is reached from a **save**, not by clicking through ten weekends: the engine
 * plays a two-season game (the human as Normal would) to the human's off-season pick, and the page
 * resumes it. Deterministic, and seconds rather than minutes.
 */
const OFF_SEASON: SeasonSetup = {
  seed: 7,
  length: { kind: 'seasons', seasons: 2 },
  players: [
    { name: 'Stable 1', kind: 'human' },
    { name: '', kind: 'ai', difficulty: 'normal' },
    { name: '', kind: 'ai', difficulty: 'normal' },
  ],
};

const WIDTHS: readonly number[] = [1280, 390];
/** Phase N: the draft's board must read and pick at 360 too. */
const DRAFT_WIDTHS: readonly number[] = [1280, 390, 360];
/** Wall-clock time as the pages see it (Date.now only; timers still run). */
const FIXED_TIME = new Date('2026-09-30T20:00:00Z');

// ── A static server for the build ────────────────────────────────────────────────────────────────

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveDist(): Promise<Server> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = resolve(DIST, `.${path}`);
    if (file !== DIST && !file.startsWith(DIST + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ── The browser ──────────────────────────────────────────────────────────────────────────────────

/** mulberry32 in place of Math.random, installed before any of the app's code runs. */
const FIXED_RANDOM = `(() => {
  let a = 0x5d6b2f1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

function sleep(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

const taken: string[] = [];
/** The same moment at 1280 and 390, full page. The page is left at 1280. */
async function shoot(page: Page, name: string, widths = WIDTHS): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    const file = `${name}-${width}.png`;
    await page.screenshot({ path: join(OUT, file), fullPage: true, animations: 'disabled' });
    taken.push(file);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** Every image loaded and fonts ready, then a beat for layout. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Phase N: the draft's board has a trainer portrait per card, most of them below the fold, and a
    // lazy image off-screen never loads — so the wait below would never end. Load them all now.
    for (const img of Array.from(document.images))
      if (img.loading === 'lazy') img.loading = 'eager';
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (img) =>
        img.complete ? null : new Promise((ok) => img.addEventListener('load', ok, { once: true })),
      ),
    );
  });
  await sleep(300);
}

async function fresh(browser: Browser, url: string, save?: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(FIXED_RANDOM);
  if (save)
    await ctx.addInitScript((blob: string) => {
      if (!localStorage.getItem('sdr.save.v1')) localStorage.setItem('sdr.save.v1', blob);
    }, save);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_TIME);
  page.on('pageerror', (e) => console.error(`  page error: ${e.message}`));
  await page.goto(url);
  // Phase P: every Title has Play; a seed link also opens the custom game's "Start season".
  await page.getByRole('button', { name: 'Play', exact: true }).first().waitFor();
  return page;
}

function btn(page: Page, name: string | RegExp) {
  return page.getByRole('button', { name, exact: typeof name === 'string' });
}

async function seen(loc: ReturnType<Page['locator']>): Promise<boolean> {
  try {
    return await loc.first().isVisible();
  } catch {
    return false;
  }
}

/**
 * From a filled-in Title to the first human's Explore. The arrival is the table's screen: with one
 * human it ends in "…: open a door", with more in "I am …", the hotseat handover.
 */
async function toExplore(page: Page, arrival?: string): Promise<void> {
  await btn(page, 'Start season').first().click();
  // Phase N: the game opens on the draft; every human picks, an item and then "Take".
  const turnOrder = page.getByText('Turn order').first();
  for (let i = 0; i < 400 && !(await seen(turnOrder)); i++)
    if (!(await draftStep(page))) await sleep(150);
  await turnOrder.waitFor();
  if (arrival) await shoot(page, arrival);
  const doors = page.locator('.doors button.door');
  const onward = btn(page, /: open a door$/).or(btn(page, /^I am /));
  for (let i = 0; i < 20 && !(await seen(doors)); i++) {
    if (await seen(onward)) await onward.first().click();
    await sleep(150);
  }
  await doors.first().waitFor();
}

/** Phase N: one press on a draft, if this human is picking: the item, then "Take" (or "Retire …"). */
async function draftStep(page: Page): Promise<boolean> {
  if (!(await seen(page.locator('.draft-take')))) return false;
  const take = btn(page, /^Take /).or(btn(page, /^Retire /));
  if (await seen(take)) {
    await take.first().click();
    return true;
  }
  const item = page.locator('button.draft-item:not([disabled])');
  if (await seen(item)) {
    await item.first().click();
    return true;
  }
  return false;
}

/**
 * The save the off-season shot resumes (`store/persist.ts`'s blob): OFF_SEASON played by the engine,
 * every seat as Normal, to the moment the human is on the clock in the off-season draft, with the
 * season's end and its last race day marked read.
 */
function offSeasonSave(): string {
  const s = createSeason(OFF_SEASON);
  const log: Action[] = [];
  for (let i = 0; i < 100_000 && !(s.phase === 'offSeason' && waitingOn(s) === 'p1'); i++) {
    const acts: Action[] = needsAdvance(s)
      ? [{ t: 'AdvancePhase' }]
      : decide(s, waitingOn(s)!, 'normal');
    for (const a of acts) {
      reduceMut(s, a);
      log.push(a);
    }
  }
  if (s.phase !== 'offSeason') throw new Error('the off-season never came');
  const wk = s.week;
  return JSON.stringify({
    v: SAVE_VERSION,
    setup: OFF_SEASON,
    log,
    ui: {
      resultsSeenWeek: wk,
      racesWatchedWeek: wk,
      fieldsSeenWeek: wk,
      bustAck: [],
      raceSpeed: 2,
      seasonSeen: s.season,
      arrivalSeenWeek: wk,
      boardSeenWeek: wk,
    },
  });
}

/** Look at the screen and press one thing, as a person playing a quick weekend would. */
async function step(page: Page, declared: { done: boolean }): Promise<boolean> {
  if (await draftStep(page)) return true;
  if (await seen(btn(page, /^On to season /))) {
    await btn(page, /^On to season /).click();
    return true;
  }
  if (await seen(page.locator('.scrim.event'))) {
    await page.locator('.scrim.event .row button').first().click();
    return true;
  }
  for (const name of [/: open a door$/, /: to the Bookie$/, /^I am /]) {
    if (await seen(btn(page, name))) {
      await btn(page, name).click();
      return true;
    }
  }
  const doors = page.locator('.doors button.door:not([disabled])');
  if (await seen(doors)) {
    await doors.nth(1).click();
    return true;
  }
  for (const name of [
    'Skip the rest of race day',
    'Next ⏎',
    'Back to the planet',
    'Done betting',
    'Run the races',
  ]) {
    if (await seen(btn(page, name))) {
      await btn(page, name).click();
      return true;
    }
  }
  if (await seen(btn(page, /^(Head to the track|Next: Race Office)$/))) {
    if (!declared.done) {
      declared.done = true;
      await page.locator('nav.tabs').getByRole('button', { name: 'Race Office' }).click();
      const select = page.locator('select.wide').first();
      await select.waitFor({ timeout: 5000 });
      const values = await select
        .locator('option:not([disabled])')
        .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      const dog = values.find((v) => v);
      if (dog) await select.selectOption(dog);
      return true;
    }
    await btn(page, /^(Head to the track|Next: Race Office)$/).click();
    return true;
  }
  if (await seen(btn(page, 'End turn'))) {
    await btn(page, 'End turn').click();
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = await serveDist();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const browser = await chromium.launch();
  try {
    // The Title, as a fresh browser sees it.
    const title = await fresh(browser, base);
    await shoot(title, '00-title');
    await title.context().close();

    // A two-human weekend from a seed link: the arrival, Explore, and the hub after a door.
    const weekend = await fresh(browser, base + WEEKEND);
    await toExplore(weekend, '01-arrival');
    await shoot(weekend, '02-explore');
    await weekend.locator('.doors button.door').nth(1).click();
    // The hub reads the door back under "Behind the door"; a card with a choice is up over it.
    await weekend.locator('.behind-door').first().waitFor();
    await shoot(weekend, '03-hub-after-door');
    await weekend.context().close();

    // A planet whose door names wrap at 390.
    const wrap = await fresh(browser, base + WRAP);
    await toExplore(wrap);
    await shoot(wrap, '04-explore-wrap');
    await wrap.context().close();

    // A game's end: a race to 1 Bone is over after the first weekend.
    const end = await fresh(browser, base + GAME_END);
    const declared = { done: false };
    const over = end.getByRole('heading', { name: 'Game over' });
    const deadline = Date.now() + 180_000;
    await btn(end, 'Start season').first().click();
    while (!(await seen(over))) {
      if (Date.now() > deadline)
        throw new Error(
          `the game's end never came; buttons: ${(await end.getByRole('button').allInnerTexts()).join(' | ')}`,
        );
      if (!(await step(end, declared))) await sleep(150);
    }
    await shoot(end, '05-game-over');
    await end.context().close();

    // Phase N: the opening draft at a table of six — the AIs' picks shown, a human's item pressed.
    const draft = await fresh(browser, base + DRAFT);
    await btn(draft, 'Start season').first().click();
    await draft.locator('.draft-take').first().waitFor({ timeout: 30_000 });
    await draft.locator('button.draft-item:not([disabled])').first().click();
    // Pressing a card scrolls it into view; the shot is of the page from its top.
    await draft.evaluate(() => window.scrollTo(0, 0));
    await shoot(draft, '06-draft', DRAFT_WIDTHS);
    await draft.context().close();

    // Phase N: a two-season game at its off-season draft, resumed from a save; the human's dog pressed.
    const off = await fresh(browser, base, offSeasonSave());
    await btn(off, 'Resume season').first().click();
    await off.getByRole('heading', { name: 'The off-season draft' }).first().waitFor();
    await off.locator('.draft-take').first().waitFor({ timeout: 30_000 });
    await off.locator('button.draft-item:not([disabled])').first().click();
    await off.evaluate(() => window.scrollTo(0, 0));
    await shoot(off, '07-off-season', DRAFT_WIDTHS);
    await off.context().close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`hotseat-shots: ${taken.length} PNGs in ${OUT}`);
  for (const f of taken) console.log(`  ${f}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
