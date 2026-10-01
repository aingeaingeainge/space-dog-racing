/**
 * `v3l4`: what the live room lets in (`guard.ts`) — the pages that may open a room, and how big a
 * message may be. Under Node; the same checks against `wrangler dev` are in `online-walk`, and against
 * the live room in `live-smoke`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  frameTooBig,
  MAX_ACTIONS,
  MAX_FRAME_BYTES,
  originAllowed,
  parseOrigins,
  seqOf,
} from '../src/guard';
import { refuseAct } from '../src/game';

const LIVE = 'https://sdr-rooms.example.workers.dev/room';
const DEV = 'http://127.0.0.1:8787/room';

/** The production list, read from `wrangler.jsonc` itself so the test cannot drift from it. */
function productionOrigins(): string[] {
  const text = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const m = /"ALLOWED_ORIGINS"\s*:\s*"([^"]*)"/.exec(text);
  assert.ok(m, 'wrangler.jsonc has ALLOWED_ORIGINS');
  return parseOrigins(m[1]);
}

test('the live room lets in only the site and its previews', () => {
  const list = productionOrigins();
  assert.deepEqual(list, [
    'https://space-dog-racing.pages.dev',
    'https://*.space-dog-racing.pages.dev',
  ]);
  for (const ok of [
    'https://space-dog-racing.pages.dev',
    'https://SPACE-DOG-RACING.pages.dev',
    'https://4f2a91c0.space-dog-racing.pages.dev',
    'https://some-branch.space-dog-racing.pages.dev',
  ])
    assert.ok(originAllowed(ok, LIVE, list), ok);
  for (const no of [
    null,
    '',
    'null',
    'http://space-dog-racing.pages.dev',
    'https://evil.example',
    'https://space-dog-racing.pages.dev.evil.example',
    'https://evilspace-dog-racing.pages.dev',
    'https://a.b.space-dog-racing.pages.dev',
    'https://other.pages.dev',
    'http://localhost:5173',
    'http://127.0.0.1:8787',
  ])
    assert.ok(!originAllowed(no, LIVE, list), String(no));
});

test('wrangler dev lets in localhost pages and the headless walks, and nothing else', () => {
  const list = productionOrigins();
  for (const ok of [null, '', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://[::1]:80'])
    assert.ok(originAllowed(ok, DEV, list), String(ok));
  assert.ok(originAllowed('https://space-dog-racing.pages.dev', DEV, list));
  assert.ok(!originAllowed('https://evil.example', DEV, list));
  assert.ok(!originAllowed('http://localhost.evil.example', DEV, list));
});

test('a frame over 16 KB is too big, and its seq is still found', () => {
  assert.equal(MAX_FRAME_BYTES, 16384);
  assert.ok(!frameTooBig('x'.repeat(MAX_FRAME_BYTES)));
  assert.ok(frameTooBig('x'.repeat(MAX_FRAME_BYTES + 1)));
  // Measured in UTF-8: 6,000 three-byte characters are 18,000 bytes.
  assert.ok(frameTooBig('€'.repeat(6000)));
  assert.ok(!frameTooBig('€'.repeat(5000)));
  assert.ok(frameTooBig(new ArrayBuffer(MAX_FRAME_BYTES + 1)));
  const pad = 'x'.repeat(MAX_FRAME_BYTES);
  assert.equal(seqOf(`{"t":"act","seq":41,"actions":["${pad}"]}`), 41);
  assert.equal(seqOf(`{"t":"act","actions":["${pad}"],"seq":7}`), 7);
  assert.equal(seqOf(`{"t":"act","actions":["${pad}"]}`), undefined);
});

test('an act with more than 64 actions is refused', () => {
  assert.equal(MAX_ACTIONS, 64);
  const end = { t: 'EndPhase' as const, playerId: 'p1' };
  assert.equal(
    refuseAct(
      'p1',
      Array.from({ length: 64 }, () => end),
    ),
    null,
  );
  assert.equal(
    refuseAct(
      'p1',
      Array.from({ length: 65 }, () => end),
    ),
    'Too many actions at once',
  );
});
