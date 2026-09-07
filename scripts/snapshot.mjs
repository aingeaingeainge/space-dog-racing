#!/usr/bin/env node
/**
 * Dated local backup of the repo (BUILD_PLAN §7b).
 *   npm run snapshot
 * Copies everything except node_modules, dist, .git and backups/ into
 *   backups/YYYY-MM-DD_HHMM_<tag-or-short-hash>/
 * and writes SNAPSHOT.md there with the commit hash, tag and a harness summary.
 * backups/ is git-ignored. Rollback: copy a snapshot over the repo, `npm install`, done.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE = new Set(['node_modules', 'dist', '.git', 'backups']);

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const hash = sh('git rev-parse --short HEAD', 'nogit');
const tag = sh('git describe --tags --exact-match', '');
const dirty = sh('git status --porcelain', '') ? ' (uncommitted changes)' : '';
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const dest = join(root, 'backups', `${stamp}_${tag || hash}`);

if (existsSync(dest)) {
  console.error(`Snapshot ${dest} already exists`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
// Copy top-level entries one by one: cpSync refuses to copy a directory into itself.
for (const entry of readdirSync(root)) {
  if (EXCLUDE.has(entry)) continue;
  cpSync(join(root, entry), join(dest, entry), {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(root.length).split(sep).filter(Boolean);
      return !rel.some((part) => EXCLUDE.has(part));
    },
  });
}

console.log('Running harness for SNAPSHOT.md …');
const harness = sh('npm run harness --silent -- --seasons 50', '(harness did not run)');
const md = `# Snapshot ${stamp}

- Commit: ${hash}${dirty}
- Tag: ${tag || '(none)'}
- Taken: ${now.toISOString()}

## Harness (50 seasons)

\`\`\`
${harness}
\`\`\`
`;
writeFileSync(join(dest, 'SNAPSHOT.md'), md);
console.log(`Snapshot written to ${dest}`);
