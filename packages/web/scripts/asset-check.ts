/**
 * Audit the art against the contract.
 *
 *   npm run asset-check              (from the repo root)
 *   npm run asset-check -- --all     every entry, not just the interesting ones
 *   npm run asset-check -- --prune   delete the .svg stand-in of anything that now has a .webp
 *
 * Reads `scripts/assets.ts`, the same list `make-placeholders.ts` writes and
 * `asset-list.ts` publishes, so this cannot drift from the contract. For every entry it
 * answers: is it here as finished `.webp`, still a `.svg` stand-in, or missing altogether;
 * if it is here, what size is it really (parsed out of the WebP header, not trusted from the
 * filename) and does that match the spec; what does it weigh and is that inside its cap.
 *
 * The WebP header is parsed here rather than by a library on purpose: the audit must not add a
 * dependency, because `package-lock.json` staying untouched is what keeps Cloudflare's
 * `npm ci` happy (M1 session 2, note 8).
 *
 * Exit code is 1 if any present file is the wrong size or over its cap — missing art is not a
 * failure, it is the normal state of a half-generated library and the game ships without it.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, type AssetSpec } from './assets';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', 'src', 'assets');
const DIST = join(here, '..', 'dist');

const args = new Set(process.argv.slice(2));
const SHOW_ALL = args.has('--all');
const PRUNE = args.has('--prune');

// ---------------------------------------------------------------- the WebP header

interface WebpInfo {
  w: number;
  h: number;
  alpha: boolean;
  kind: 'lossy' | 'lossless' | 'extended';
}

/**
 * Enough of RIFF/WebP to answer "how big is it, and does it have alpha".
 *
 * Three encodings are in the wild and every generator picks a different one: a bare `VP8 `
 * lossy frame, a `VP8L` lossless one, or a `VP8X` extended container that states the canvas
 * size itself and flags alpha. The extended header wins where it is present, because that is
 * the size the browser will actually draw at.
 */
function readWebp(buf: Buffer): WebpInfo | null {
  if (buf.length < 16) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;

  let off = 12;
  let info: WebpInfo | null = null;
  let alpha = false;

  while (off + 8 <= buf.length) {
    const tag = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (body + size > buf.length + 1) break;

    if (tag === 'VP8X' && size >= 10) {
      alpha = alpha || (buf[body]! & 0x10) !== 0;
      const w = 1 + (buf[body + 4]! | (buf[body + 5]! << 8) | (buf[body + 6]! << 16));
      const h = 1 + (buf[body + 7]! | (buf[body + 8]! << 8) | (buf[body + 9]! << 16));
      info = { w, h, alpha, kind: 'extended' };
    } else if (tag === 'ALPH') {
      alpha = true;
    } else if (tag === 'VP8 ' && size >= 10) {
      if (!info) {
        const w = buf.readUInt16LE(body + 6) & 0x3fff;
        const h = buf.readUInt16LE(body + 8) & 0x3fff;
        info = { w, h, alpha, kind: 'lossy' };
      }
    } else if (tag === 'VP8L' && size >= 5) {
      // Signature byte, then 14 bits width−1, 14 bits height−1, 1 bit alpha_is_used, LSB first.
      const bits =
        (buf[body + 1]! |
          (buf[body + 2]! << 8) |
          (buf[body + 3]! << 16) |
          (buf[body + 4]! << 24)) >>>
        0;
      const used = ((bits >>> 28) & 1) === 1;
      alpha = alpha || used;
      if (!info) {
        info = {
          w: (bits & 0x3fff) + 1,
          h: ((bits >>> 14) & 0x3fff) + 1,
          alpha,
          kind: 'lossless',
        };
      }
    }
    off = body + size + (size & 1);
  }

  if (info) info.alpha = info.alpha || alpha;
  return info;
}

// ---------------------------------------------------------------- one entry

type StateName = 'webp' | 'placeholder' | 'missing';

interface Row {
  spec: AssetSpec;
  state: StateName;
  bytes: number;
  /** Bytes of the .svg stand-in, present or not. */
  standInBytes: number;
  info: WebpInfo | null;
  problems: string[];
}

function kb(bytes: number): number {
  return bytes / 1024;
}

function fmtKb(bytes: number): string {
  return `${kb(bytes).toFixed(1)} kB`;
}

function fmtMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function inspect(spec: AssetSpec): Row {
  const webp = join(ROOT, `${spec.stem}.webp`);
  const svg = join(ROOT, `${spec.stem}.svg`);
  const hasWebp = existsSync(webp);
  const hasSvg = existsSync(svg);
  const standInBytes = hasSvg ? statSync(svg).size : 0;
  const problems: string[] = [];

  if (!hasWebp) {
    return {
      spec,
      state: hasSvg ? 'placeholder' : 'missing',
      bytes: 0,
      standInBytes,
      info: null,
      problems,
    };
  }

  const bytes = statSync(webp).size;
  const buf = readFileSync(webp);
  const info = readWebp(buf);

  if (!info) problems.push('not a readable WebP');
  else {
    if (info.w !== spec.w || info.h !== spec.h)
      problems.push(`is ${info.w}×${info.h}, spec says ${spec.w}×${spec.h}`);
    if (spec.alpha && !info.alpha) problems.push('needs alpha and has none');
  }
  if (kb(bytes) > spec.capKb) problems.push(`${fmtKb(bytes)} is over its ${spec.capKb} kB cap`);

  return { spec, state: 'webp', bytes, standInBytes, info, problems };
}

// ---------------------------------------------------------------- the run

const groups = GROUPS.map((g) => ({ group: g, rows: g.assets.map(inspect) }));
const rows = groups.flatMap((g) => g.rows);
const present = rows.filter((r) => r.state === 'webp');
const placeholders = rows.filter((r) => r.state === 'placeholder');
const missing = rows.filter((r) => r.state === 'missing');
const broken = rows.filter((r) => r.problems.length);

const pad = (s: string, n: number) => s.padEnd(n);
const num = (s: string | number, n: number) => String(s).padStart(n);

console.log('');
console.log('Asset check — packages/web/src/assets against scripts/assets.ts');
console.log('');
console.log(
  `${pad('Group', 22)}${num('files', 6)}${num('webp', 6)}${num('stand', 6)}${num('gone', 6)}` +
    `${num('on disk', 11)}${num('target', 10)}${num('cap', 10)}`,
);
console.log('─'.repeat(77));

for (const { group, rows: gr } of groups) {
  const w = gr.filter((r) => r.state === 'webp');
  const p = gr.filter((r) => r.state === 'placeholder');
  const m = gr.filter((r) => r.state === 'missing');
  const onDisk = w.reduce((n, r) => n + r.bytes, 0);
  const target = gr.reduce((n, r) => n + r.spec.targetKb, 0);
  const cap = gr.reduce((n, r) => n + r.spec.capKb, 0);
  console.log(
    `${pad(group.title, 22)}${num(gr.length, 6)}${num(w.length, 6)}${num(p.length, 6)}` +
      `${num(m.length, 6)}${num(onDisk ? fmtKb(onDisk) : '—', 11)}` +
      `${num(`${(target / 1024).toFixed(1)} MB`, 10)}${num(`${(cap / 1024).toFixed(1)} MB`, 10)}`,
  );
}

const onDiskAll = present.reduce((n, r) => n + r.bytes, 0);
const targetAll = rows.reduce((n, r) => n + r.spec.targetKb, 0);
const capAll = rows.reduce((n, r) => n + r.spec.capKb, 0);
console.log('─'.repeat(77));
console.log(
  `${pad('All of it', 22)}${num(rows.length, 6)}${num(present.length, 6)}` +
    `${num(placeholders.length, 6)}${num(missing.length, 6)}` +
    `${num(onDiskAll ? fmtKb(onDiskAll) : '—', 11)}` +
    `${num(`${(targetAll / 1024).toFixed(1)} MB`, 10)}${num(`${(capAll / 1024).toFixed(1)} MB`, 10)}`,
);
console.log('');

// ---------------------------------------------------------------- the files that exist

const listed = SHOW_ALL ? rows : present.length || broken.length ? [...present] : [];
if (listed.length) {
  console.log('Finished art on disk');
  console.log('');
  for (const r of listed) {
    const dims = r.info ? `${r.info.w}×${r.info.h}` : r.state === 'webp' ? '?' : '—';
    const size = r.state === 'webp' ? fmtKb(r.bytes) : r.state;
    const head = `  ${pad(`${r.spec.stem}.webp`, 42)}${num(dims, 11)}${num(size, 11)}`;
    const capNote =
      r.state === 'webp'
        ? `  ${num(`cap ${r.spec.capKb} kB`, 12)}  ${
            kb(r.bytes) <= r.spec.targetKb
              ? 'inside target'
              : kb(r.bytes) <= r.spec.capKb
                ? 'over target, inside cap'
                : 'OVER CAP'
          }${r.info?.alpha ? ', alpha' : ''}`
        : '';
    console.log(head + capNote);
    for (const p of r.problems) console.log(`      ✗ ${p}`);
  }
  console.log('');
}

if (broken.length) {
  console.log(`${broken.length} file${broken.length === 1 ? '' : 's'} the contract disagrees with:`);
  for (const r of broken) console.log(`  ${r.spec.stem}.webp — ${r.problems.join('; ')}`);
  console.log('');
}

// ---------------------------------------------------------------- what the site weighs

/** Bytes a group's present art actually takes, plus what its stand-ins take where it has none. */
function weightOf(pred: (r: Row) => boolean): { real: number; standIn: number; missing: number } {
  let real = 0;
  let standIn = 0;
  let miss = 0;
  for (const r of rows.filter(pred)) {
    if (r.state === 'webp') real += r.bytes;
    else if (r.state === 'placeholder') standIn += r.standInBytes;
    else miss++;
  }
  return { real, standIn, missing: miss };
}

/** The mean weight of one file in a group as it stands: real where there is art, stand-in where not. */
function meanOf(groupId: string): number {
  const gr = rows.filter((r) => r.spec.group === groupId);
  if (!gr.length) return 0;
  const total = gr.reduce((n, r) => n + (r.state === 'webp' ? r.bytes : r.standInBytes), 0);
  return total / gr.length;
}

let bundleJs = 0;
let bundleCss = 0;
let bundleGz = 0;
const distAssets = join(DIST, 'assets');
if (existsSync(distAssets)) {
  for (const f of readdirSync(distAssets)) {
    const p = join(distAssets, f);
    const size = statSync(p).size;
    if (f.endsWith('.js')) {
      bundleJs += size;
      bundleGz += gzipSync(readFileSync(p)).length;
    } else if (f.endsWith('.css')) {
      bundleCss += size;
      bundleGz += gzipSync(readFileSync(p)).length;
    }
  }
}

const backdrop = meanOf('backdrops');
const ground = meanOf('grounds');
const surface = meanOf('surfaces');
const card = meanOf('events');
const sizeOfGroup = (id: string): number => {
  const w = weightOf((r) => r.spec.group === id);
  return w.real + w.standIn;
};
const dogKit = sizeOfGroup('bodies') + sizeOfGroup('accessories');
const runKit = sizeOfGroup('run');
const uiKit = sizeOfGroup('ui');
const everything = rows.reduce(
  (n, r) => n + (r.state === 'webp' ? r.bytes : r.standInBytes),
  0,
);

const bundle = bundleJs + bundleCss;
const firstPaint = bundle + backdrop + uiKit;
const perWeekend = backdrop + ground + surface + card;

console.log('What the site weighs, as it stands');
console.log('');
if (bundle) {
  console.log(
    `  Bundle              ${fmtKb(bundleJs)} JS + ${fmtKb(bundleCss)} CSS ` +
      `(${fmtKb(bundleGz)} gzipped)`,
  );
} else {
  console.log('  Bundle              (no dist — run npm run build for the JS and CSS figures)');
}
console.log(
  `  First paint         ${fmtKb(firstPaint)}  — bundle, the UI furniture, and one hub backdrop`,
);
console.log(
  `  Per weekend         ${fmtKb(perWeekend)}  — a backdrop, a ground, a surface tile, an event card`,
);
console.log(
  `  Dog art, once       ${fmtKb(dogKit)} portraits + ${fmtKb(runKit)} run cycles — fetched once, kept`,
);
console.log(`  Whole library       ${fmtMb(everything)} over ${rows.length} files`);
console.log(
  `  Whole site          ${fmtMb(bundle + everything)}  — every byte, if a player visited all 18 planets`,
);
console.log('');
console.log(
  `  Where it is going:  ${fmtMb(targetAll * 1024)} at the contract's targets, ` +
    `${fmtMb(capAll * 1024)} if every file went to its cap.`,
);
console.log('');

// ---------------------------------------------------------------- the stand-ins

const prunable = present.filter((r) => r.standInBytes > 0);
if (PRUNE) {
  for (const r of prunable) unlinkSync(join(ROOT, `${r.spec.stem}.svg`));
  console.log(
    prunable.length
      ? `Deleted ${prunable.length} stand-in${prunable.length === 1 ? '' : 's'} that finished art has replaced.`
      : 'No stand-ins to delete — every .webp already stands alone.',
  );
} else if (prunable.length) {
  console.log(
    `${prunable.length} .svg stand-in${prunable.length === 1 ? '' : 's'} ` +
      `${prunable.length === 1 ? 'is' : 'are'} sitting beside finished art and doing nothing. ` +
      `npm run asset-check -- --prune removes ${prunable.length === 1 ? 'it' : 'them'}.`,
  );
}
console.log('');

const summary =
  `${present.length} finished, ${placeholders.length} still a stand-in, ${missing.length} missing.`;
if (broken.length) {
  console.log(`${summary} ${broken.length} of the finished files do not match the contract.`);
  process.exit(1);
}
console.log(summary);
