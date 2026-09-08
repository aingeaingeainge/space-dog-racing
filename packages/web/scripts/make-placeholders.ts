/**
 * Write a stand-in for every entry in the asset contract.
 *
 *   npm run placeholders          (from the repo root)
 *
 * The convention, which is what keeps "obviously unfinished" honest without a manifest to
 * maintain: **a placeholder is a .svg, finished art is a .webp.** lib/assets.ts prefers the
 * .webp, so dropping the real file in takes over immediately and every component that is still
 * showing an .svg stamps PLACEHOLDER on it by itself. Delete the .svg afterwards or leave it;
 * nothing changes either way.
 *
 * SVG rather than PNG on purpose: a few hundred bytes each instead of a few kilobytes, crisp
 * text at any size, drawable to a canvas like any other image, and no encoder to depend on.
 * The whole set of 149 comes to well under 100 kB, so the placeholders never distort what the
 * real art will cost.
 *
 * Re-running is safe: it only ever writes .svg files, and it never touches a .webp. A slot that
 * already holds finished art is skipped outright rather than given a stand-in it does not need
 * — `npm run asset-check -- --prune` deletes those, and this must not put them back.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS, type AssetSpec } from './assets';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', 'src', 'assets');

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Chop a line to something that fits the frame at the chosen size. */
function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function svgFor(a: AssetSpec): string {
  const { w, h } = a;
  const [a1, a2] = a.accents;
  const small = Math.min(w, h) < 200;
  const short = w / h > 6;
  // Type scales with the smaller side so a 128px icon and a 2048px ground both read.
  const unit = Math.min(w, h);
  const big = Math.max(11, Math.round(unit * (small ? 0.13 : 0.075)));
  const mid = Math.max(9, Math.round(big * 0.52));
  const pad = Math.max(4, Math.round(unit * 0.03));
  const stroke = Math.max(2, Math.round(unit * 0.012));
  const cx = w / 2;
  const perLine = Math.max(8, Math.floor(w / (mid * 0.62)));

  const lines: { t: string; size: number; fill: string; weight: number }[] = [];
  lines.push({ t: clip(a.label, Math.floor(w / (big * 0.62))), size: big, fill: a1, weight: 700 });
  if (!small && !short) {
    lines.push({ t: clip(a.what, perLine), size: mid, fill: '#cfc9de', weight: 400 });
    lines.push({ t: `${a.stem}.webp`, size: mid, fill: '#8f8aa3', weight: 400 });
    lines.push({ t: `${w} × ${h} · ${a.targetKb} kB target`, size: mid, fill: '#8f8aa3', weight: 400 });
  }
  lines.push({
    t: 'PLACEHOLDER',
    size: small ? Math.max(8, Math.round(mid * 0.9)) : mid,
    fill: '#F4C542',
    weight: 700,
  });

  const lh = lines.reduce((sum, l) => sum + l.size * 1.5, 0);
  let y = h / 2 - lh / 2 + lines[0]!.size;
  const text = lines
    .map((l) => {
      const el =
        `<text x="${cx}" y="${Math.round(y)}" font-size="${l.size}" fill="${l.fill}" ` +
        `font-weight="${l.weight}" text-anchor="middle" ` +
        `font-family="'Space Mono',ui-monospace,monospace">${esc(l.t)}</text>`;
      y += l.size * 1.5;
      return el;
    })
    .join('');

  // Transparent art keeps its transparency, so a compositor layer really is see-through; the
  // dashed frame is what says "there is meant to be something here".
  const ground = a.alpha
    ? ''
    : `<rect width="${w}" height="${h}" fill="#161520"/>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(a.label)} placeholder">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a2}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${a1}" stop-opacity="0.10"/>` +
    `</linearGradient>` +
    `<pattern id="h" width="28" height="28" patternUnits="userSpaceOnUse" ` +
    `patternTransform="rotate(-45)">` +
    `<rect width="14" height="28" fill="${a1}" fill-opacity="0.10"/>` +
    `</pattern>` +
    `</defs>` +
    ground +
    `<rect width="${w}" height="${h}" fill="url(#h)"/>` +
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" fill="none" ` +
    `stroke="${a1}" stroke-opacity="0.55" stroke-width="${stroke}" ` +
    `stroke-dasharray="${stroke * 6} ${stroke * 4}"/>` +
    text +
    `</svg>`
  );
}

let written = 0;
let skipped = 0;
let bytes = 0;
for (const a of ASSETS) {
  const target = join(ROOT, `${a.stem}.svg`);
  const finished = join(ROOT, `${a.stem}.webp`);
  if (existsSync(finished)) {
    skipped++;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  const svg = svgFor(a);
  writeFileSync(target, svg, 'utf8');
  bytes += Buffer.byteLength(svg);
  written++;
}

console.log(
  `${written} placeholders written under packages/web/src/assets/ ` +
    `(${(bytes / 1024).toFixed(0)} kB in total).`,
);
if (skipped)
  console.log(`${skipped} slot${skipped === 1 ? '' : 's'} skipped — finished .webp art is already there.`);
