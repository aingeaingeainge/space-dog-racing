/**
 * **`screen-words`** (v3 Phase P): the ruler for "pick up and play". For each screen a single player
 * sees in their first weekend, at 1280 and 390, it counts what is on the page:
 *
 * - **words** — visible words (text whose element is rendered; a closed `<select>` counts only its
 *   chosen option, a tooltip counts nothing);
 * - **controls** — visible buttons, links, selects and inputs;
 * - **panels** — visible `.panel` boxes;
 * - **screens** — the page's height in viewports (900 px tall at 1280, 844 at 390): how far there is
 *   to scroll. A page wider than the viewport is flagged `↔`.
 *
 *   npm run screen-words -- <dist> [outFile.json] [--png <dir>]      (from the repo root)
 *
 * `<dist>` is a built web without `VITE_ROOMS_URL`, as for `hotseat-shots`. The game is the one a new
 * player gets: a fresh browser, the Title as it opens (one human against Normal AIs, one season), and
 * the first weekend played straight through: the draft, a door, the hub, the Market, the Kennels, the
 * Race Office (three dogs declared), the Bookie, a race, the results, the hub after, then week 2's
 * doors. The game's end is a second game, a race to 1 Bone with the same table. `--png` also writes a
 * full-page screenshot of each.
 *
 * Deterministic as `hotseat-shots` is: `Math.random` fixed, `Date.now` pinned.
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const from = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);
const pngAt = args.indexOf('--png');
const PNG = pngAt >= 0 ? resolve(from, args[pngAt + 1] ?? 'screen-words-png') : null;
const plain = args.filter((_, i) => pngAt < 0 || (i !== pngAt && i !== pngAt + 1));
const [distArg, outArg] = plain;
if (!distArg) {
  console.error('usage: npm run screen-words -- <dist> [out.json] [--png <dir>]');
  process.exit(2);
}
const DIST = resolve(from, distArg);
if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`no index.html in ${DIST}: build the web first`);
  process.exit(2);
}

/** The new player's game is the Title's own default; the game's end is a race to 1 Bone. */
const GAME_END = '?seed=7&players=h,normal,normal,normal,normal,normal&len=t1';
const SIZES = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;
const FIXED_TIME = new Date('2026-09-30T20:00:00Z');
/** The screens that make up the weekend's total (the Title, the draft and the game's end do not). */
const WEEKEND = [
  'explore',
  'event',
  'hub',
  'market',
  'kennels',
  'race-office',
  'bookie',
  'race',
  'results',
  'hub-after',
];

// ── A static server for the build (as hotseat-shots) ─────────────────────────────────────────────

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
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

const FIXED_RANDOM = `(() => {
  let a = 0x5d6b2f1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

// ── Measuring ────────────────────────────────────────────────────────────────────────────────────

interface Measure {
  words: number;
  controls: number;
  panels: number;
  screens: number;
  wide: boolean;
}
type Row = { screen: string } & Record<'w1280' | 'w390', Measure>;
const rows: Row[] = [];

/**
 * Runs in the page: what a reader actually has in front of them. A string, not a function, because
 * tsx's transform wraps named inner functions in a helper the page does not have.
 */
const MEASURE_IN_PAGE = `(() => {
  const shown = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  };
  let words = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,canvas')) continue;
    const opt = el.closest('option');
    if (opt && !opt.selected) continue;
    if (!shown(el)) continue;
    words += (n.textContent || '').split(/\\s+/).filter((w) => /[\\p{L}\\p{N}]/u.test(w)).length;
  }
  const controls = Array.from(
    document.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea, [role=button]'),
  ).filter((e) => shown(e) && e.getClientRects().length > 0).length;
  const panels = Array.from(document.querySelectorAll('.panel')).filter(shown).length;
  const doc = document.scrollingElement || document.documentElement;
  return { words, controls, panels, h: doc.scrollHeight, sw: doc.scrollWidth };
})()`;

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const img of Array.from(document.images))
      if (img.loading === 'lazy') img.loading = 'eager';
    await document.fonts.ready;
  });
  await sleep(250);
}

async function measure(page: Page, screen: string): Promise<void> {
  const row = { screen } as Row;
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await settle(page);
    const m = (await page.evaluate(MEASURE_IN_PAGE)) as {
      words: number;
      controls: number;
      panels: number;
      h: number;
      sw: number;
    };
    row[size.width === 1280 ? 'w1280' : 'w390'] = {
      words: m.words,
      controls: m.controls,
      panels: m.panels,
      screens: Math.round((m.h / size.height) * 10) / 10,
      wide: m.sw > size.width + 1,
    };
    if (PNG)
      await page.screenshot({
        path: join(PNG, `${String(rows.length).padStart(2, '0')}-${screen}-${size.width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
  }
  await page.setViewportSize(SIZES[0]);
  rows.push(row);
  const a = row.w1280;
  const b = row.w390;
  console.log(
    `  ${screen.padEnd(14)} ${String(a.words).padStart(5)} words ${String(a.controls).padStart(3)} controls ${String(a.panels).padStart(2)} panels ${a.screens.toFixed(1)} screens   | 390: ${String(b.words).padStart(5)} w ${b.screens.toFixed(1)} screens${b.wide ? ' ↔' : ''}`,
  );
}

// ── Driving ──────────────────────────────────────────────────────────────────────────────────────

const btn = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' });

async function seen(loc: ReturnType<Page['locator']>): Promise<boolean> {
  try {
    return await loc.first().isVisible();
  } catch {
    return false;
  }
}

async function until(page: Page, what: string, test: () => Promise<boolean>, ms = 60_000) {
  const end = Date.now() + ms;
  while (!(await test())) {
    if (Date.now() > end)
      throw new Error(
        `waited for ${what}; buttons: ${(await page.getByRole('button').allInnerTexts()).join(' | ')}`,
      );
    await sleep(150);
  }
}

async function fresh(browser: Browser, url: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: SIZES[0] });
  await ctx.addInitScript(FIXED_RANDOM);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_TIME);
  page.on('pageerror', (e) => console.error(`  page error: ${e.message}`));
  await page.goto(url);
  return page;
}

/**
 * The Title's start: "Start season" when it is showing (a seed link opens the custom game; a build
 * before Phase P has no other start), else "Play".
 */
async function startGame(page: Page): Promise<void> {
  await btn(page, /^(Play|Start season)$/)
    .first()
    .waitFor();
  const custom = btn(page, 'Start season');
  await ((await seen(custom)) ? custom : btn(page, 'Play')).first().click();
}

/** One press on the draft if this human is picking: "Pick for me", or the item and then "Take". */
async function draftStep(page: Page): Promise<boolean> {
  // Phase P: a new player's one press for the whole draft, where the build has it.
  const forMe = btn(page, 'Pick for me');
  if (await seen(forMe)) {
    await forMe.click();
    return true;
  }
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

/** A venue by its name, from the tab strip (or whatever the build calls it). */
async function goVenue(page: Page, name: RegExp): Promise<void> {
  const tab = page.locator('nav.tabs').getByRole('button', { name });
  if (await seen(tab)) await tab.first().click();
  else await page.getByRole('button', { name }).first().click();
  await sleep(200);
}

async function answerCard(page: Page): Promise<boolean> {
  if (!(await seen(page.locator('.scrim.event')))) return false;
  await page.locator('.scrim.event .row button').first().click();
  await sleep(200);
  return true;
}

async function weekend(page: Page): Promise<void> {
  await measure(page, 'title');
  await startGame(page);
  const doors = page.locator('.doors button.door:not([disabled])');
  await until(page, 'the draft', () => seen(page.locator('.draft-take')));
  await measure(page, 'draft');
  await until(page, 'the doors', async () => {
    if (await seen(doors)) return true;
    await draftStep(page);
    return false;
  });

  await measure(page, 'explore');
  await doors.nth(1).click();
  await sleep(300);
  if (await seen(page.locator('.scrim.event'))) {
    await measure(page, 'event');
    await answerCard(page);
  }
  const ahead = btn(page, /^(Head to the track|Next: Race Office)$/);
  await until(page, 'the hub', () => seen(ahead));
  await measure(page, 'hub');
  await goVenue(page, /^Market$/);
  await measure(page, 'market');
  await goVenue(page, /^Kennels?$/);
  await measure(page, 'kennels');
  await goVenue(page, /^Race Office$/);
  await measure(page, 'race-office');
  // Three dogs, one a race: the first free dog in each select.
  const selects = page.locator('select.wide');
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const free = await selects
      .nth(i)
      .locator('option:not([disabled])')
      .evaluateAll((os) =>
        os
          .map((o) => o as HTMLOptionElement)
          .filter((o) => o.value && !/ in the /.test(o.textContent ?? ''))
          .map((o) => o.value),
      );
    if (free[0]) await selects.nth(i).selectOption(free[0]);
    await sleep(150);
  }
  await ahead.first().click();

  const run = btn(page, /^(Run the races|Done betting|Skip the bet|No bet)$/);
  await until(page, 'the Bookie', () => seen(run));
  await measure(page, 'bookie');
  await run.first().click();
  await until(page, 'a race', () => seen(btn(page, 'Skip the rest of race day')));
  await sleep(1500);
  await measure(page, 'race');
  await btn(page, 'Skip the rest of race day').click();
  const back = btn(page, /^Back to the planet$/);
  await until(page, 'the results', async () => {
    if (await seen(back)) return true;
    if (await seen(btn(page, 'Next ⏎'))) await btn(page, 'Next ⏎').click();
    return false;
  });
  await measure(page, 'results');
  await back.click();
  await until(page, 'the hub after', () => seen(btn(page, /^(End turn|Fly on.*)$/)));
  await answerCard(page);
  await measure(page, 'hub-after');
  await btn(page, /^(End turn|Fly on.*)$/)
    .first()
    .click();
  await until(page, 'week 2', async () => {
    await answerCard(page);
    return seen(doors);
  });
  await measure(page, 'explore-wk2');
}

/** The game's end: press on through a race to 1 Bone. */
async function gameEnd(page: Page): Promise<void> {
  await startGame(page);
  const over = page.getByRole('heading', { name: 'Game over' });
  const end = Date.now() + 180_000;
  while (!(await seen(over))) {
    if (Date.now() > end) throw new Error('the game never ended');
    if (await draftStep(page)) continue;
    if (await answerCard(page)) continue;
    const doors = page.locator('.doors button.door:not([disabled])');
    if (await seen(doors)) {
      await doors.nth(1).click();
      continue;
    }
    let pressed = false;
    for (const name of [
      'Skip the rest of race day',
      'Next ⏎',
      'Back to the planet',
      'Run the races',
      'Head to the track',
      'Next: Race Office',
      'End turn',
    ]) {
      if (await seen(btn(page, name))) {
        await btn(page, name).click();
        pressed = true;
        break;
      }
    }
    if (!pressed) await sleep(150);
  }
  await measure(page, 'game-end');
}

async function main(): Promise<void> {
  if (PNG) mkdirSync(PNG, { recursive: true });
  const server = await serveDist();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const browser = await chromium.launch();
  try {
    console.log('screen-words: one human against Normal AIs, the first weekend, 1280 | 390');
    const p1 = await fresh(browser, base);
    await weekend(p1);
    await p1.context().close();
    const p2 = await fresh(browser, base + GAME_END);
    await gameEnd(p2);
    await p2.context().close();
  } finally {
    await browser.close();
    server.close();
  }
  const sum = (w: 'w1280' | 'w390', k: 'words' | 'controls' | 'screens') =>
    Math.round(
      rows.filter((r) => WEEKEND.includes(r.screen)).reduce((t, r) => t + r[w][k], 0) * 10,
    ) / 10;
  const total = {
    words1280: sum('w1280', 'words'),
    controls1280: sum('w1280', 'controls'),
    screens1280: sum('w1280', 'screens'),
    words390: sum('w390', 'words'),
    screens390: sum('w390', 'screens'),
  };
  console.log(
    `  weekend total  ${total.words1280} words, ${total.controls1280} controls, ${total.screens1280} screens at 1280 · ${total.screens390} screens at 390 (${WEEKEND.join(', ')})`,
  );
  if (outArg) writeFileSync(resolve(from, outArg), JSON.stringify({ rows, total }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
