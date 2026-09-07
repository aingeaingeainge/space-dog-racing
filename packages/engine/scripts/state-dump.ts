/**
 * Diagnostic: dump the golden-seed season state as flat, sorted `path = value` lines
 * so two platforms can be diffed line by line. Temporary — delete when the golden
 * cross-platform mismatch is resolved.
 */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runSeason, type SeasonSetup } from '../src/index';

const SETUP: SeasonSetup = {
  seed: 42,
  players: Array.from({ length: 6 }, (_, i) => ({
    name: `AI ${i + 1}`,
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  })),
};

const { state } = runSeason(SETUP);
const json = JSON.stringify(state);

const lines: string[] = [];
const walk = (node: unknown, path: string): void => {
  if (node === null || typeof node !== 'object') {
    lines.push(`${path} = ${typeof node} ${String(node)}`);
    return;
  }
  if (Array.isArray(node)) {
    lines.push(`${path} = array[${node.length}]`);
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  const keys = Object.keys(node as Record<string, unknown>);
  lines.push(`${path} = object{${keys.join(',')}}`);
  for (const k of keys) walk((node as Record<string, unknown>)[k], `${path}.${k}`);
};
walk(JSON.parse(json), '$');

const out = process.argv[2] ?? 'state-dump.txt';
writeFileSync(
  out,
  [
    `# node ${process.version} ${process.platform} ${process.arch}`,
    `# sha256(JSON.stringify(state)) = ${createHash('sha256').update(json).digest('hex')}`,
    `# lines ${lines.length}`,
    ...lines,
  ].join('\n') + '\n',
  'utf8',
);
console.log(`wrote ${out} (${lines.length} lines)`);
console.log(`sha256 = ${createHash('sha256').update(json).digest('hex')}`);
console.log(`node ${process.version} ${process.platform} ${process.arch}`);
