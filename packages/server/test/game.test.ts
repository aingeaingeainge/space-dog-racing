/**
 * The room's game logic under Node (`game.ts`): no `workerd` needed. The room itself, over sockets,
 * is `scripts/online-walk.ts`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSeason,
  decide,
  reduceMut,
  replay,
  waitingOn,
  type Action,
  type GameState,
  type SeasonSetup,
} from '@sdr/engine';
import { CODE_ALPHABET, CODE_RE, codeFrom } from '../src/code';
import {
  clockOf,
  driveRoom,
  fieldsOf,
  patchOf,
  queueKind,
  refuseAct,
  seatColours,
  wholeOf,
  type Queued,
} from '../src/game';

const setup = (humans: number, ais: number, seed = 7): SeasonSetup => ({
  seed,
  players: [
    ...Array.from({ length: humans }, (_, i) => ({ name: `H${i + 1}`, kind: 'human' as const })),
    ...Array.from({ length: ais }, () => ({
      name: '',
      kind: 'ai' as const,
      difficulty: 'normal' as const,
    })),
  ],
});

function started(
  humans: number,
  ais: number,
  seed = 7,
): { s: GameState; log: Action[]; setup: SeasonSetup } {
  const su = setup(humans, ais, seed);
  const s = createSeason(su);
  const log: Action[] = [];
  driveRoom(s, log, { standIn: new Set(), queue: new Map() });
  return { s, log, setup: su };
}

test('room codes are six letters with no look-alikes', () => {
  assert.equal(CODE_ALPHABET.length, 23);
  for (const ch of 'ILO') assert.ok(!CODE_ALPHABET.includes(ch));
  for (let i = 0; i < 200; i++) {
    const bytes = Uint8Array.from({ length: 6 }, (_, k) => (i * 37 + k * 101) % 256);
    assert.match(codeFrom(bytes), CODE_RE);
  }
});

test('a browser may act only for its own seat, and never AdvancePhase', () => {
  assert.equal(refuseAct('p1', [{ t: 'EndPhase', playerId: 'p1' }]), null);
  assert.equal(refuseAct('p1', [{ t: 'EndPhase', playerId: 'p2' }]), 'That is not your stable');
  assert.equal(refuseAct('p1', [{ t: 'AdvancePhase' }]), 'Only the room moves the game on');
  assert.equal(refuseAct('p1', []), 'Nothing to do');
  assert.equal(refuseAct('p1', 'EndPhase'), 'Nothing to do');
});

test('a started room waits on a human at Explore, and the clock names them', () => {
  const { s } = started(2, 2);
  assert.equal(s.phase, 'explore');
  const who = waitingOn(s)!;
  assert.deepEqual(clockOf(s), [who]);
  assert.equal(s.players.find((p) => p.id === who)!.kind, 'human');
});

test('a door from a seat not on the clock is held, and applied when its turn comes', () => {
  const { s, log } = started(2, 1);
  const first = waitingOn(s)!;
  const other = s.players.find((p) => p.kind === 'human' && p.id !== first)!.id;
  const door: Action = { t: 'ChooseDoor', playerId: other, door: 1 };
  assert.equal(queueKind(s, other, door), 'door');
  assert.equal(queueKind(s, first, { t: 'ChooseDoor', playerId: first, door: 0 }), null);
  const queue = new Map<string, Queued>([[other, { kind: 'door', action: door, seq: 4 }]]);
  const from = log.length;
  // The seat on the clock answers; resolve any card, then the drive reaches the held door.
  reduceMut(s, { t: 'ChooseDoor', playerId: first, door: 0 });
  log.push({ t: 'ChooseDoor', playerId: first, door: 0 });
  while (s.pendingEvent?.playerId === first) {
    const a: Action = { t: 'ResolveEvent', playerId: first, choice: 0 };
    reduceMut(s, a);
    log.push(a);
  }
  const out = driveRoom(s, log, { standIn: new Set(), queue });
  assert.equal(queue.size, 0);
  assert.deepEqual(out.dropped, []);
  assert.ok(log.slice(from).some((a) => a.t === 'ChooseDoor' && a.playerId === other));
  assert.equal(s.explore!.picks[other], 1);
});

test('a held action the engine refuses when its turn comes is dropped, with its seq', () => {
  const { s, log } = started(2, 1);
  const first = waitingOn(s)!;
  const other = s.players.find((p) => p.kind === 'human' && p.id !== first)!.id;
  const queue = new Map<string, Queued>([
    [other, { kind: 'door', action: { t: 'ChooseDoor', playerId: other, door: 5 }, seq: 9 }],
  ]);
  reduceMut(s, { t: 'ChooseDoor', playerId: first, door: 0 });
  while (s.pendingEvent?.playerId === first)
    reduceMut(s, { t: 'ResolveEvent', playerId: first, choice: 0 });
  const out = driveRoom(s, log, { standIn: new Set(), queue });
  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0]!.seat, other);
  assert.equal(out.dropped[0]!.seq, 9);
  assert.equal(waitingOn(s), other, 'the seat is on the clock to choose again');
});

test('"Fly on" is held from a seat not on the clock after the races', () => {
  const { s } = started(3, 0);
  // Play everybody as a Normal AI would, up to the first planetPost.
  while (s.phase !== 'planetPost') {
    const who = waitingOn(s);
    if (!who) reduceMut(s, { t: 'AdvancePhase' });
    else for (const a of decide(s, who, 'normal')) reduceMut(s, a);
  }
  const on = waitingOn(s)!;
  const off = s.turnOrder.find((id) => id !== on && !s.done.includes(id))!;
  assert.equal(queueKind(s, off, { t: 'EndPhase', playerId: off }), 'flyOn');
  assert.equal(queueKind(s, on, { t: 'EndPhase', playerId: on }), null);
  assert.equal(
    queueKind(s, off, { t: 'TradeFood', playerId: off, good: 'scrapmeat', units: 1 }),
    null,
  );
});

test('a stand-in plays a human seat through a season, and the log replays exactly', () => {
  const su = setup(3, 1, 11);
  const s = createSeason(su);
  const log: Action[] = [];
  const out = driveRoom(s, log, { standIn: new Set(['p1', 'p2', 'p3']), queue: new Map() });
  assert.equal(s.phase, 'seasonEnd');
  assert.ok(out.stoodIn.some((x) => x.seat === 'p2'));
  assert.equal(new Set(out.stoodIn.filter((x) => x.seat === 'p2').map((x) => x.weekend)).size, 10);
  assert.equal(JSON.stringify(replay(createSeason(su), log)), JSON.stringify(s));
});

test('a stood-in seat stops at the human who is not stood in', () => {
  const { s, log } = started(2, 0);
  const first = waitingOn(s)!;
  const other = s.players.find((p) => p.id !== first)!.id;
  const before = log.length;
  driveRoom(s, log, { standIn: new Set([first]), queue: new Map() });
  assert.ok(log.length > before);
  assert.equal(waitingOn(s), other);
});

test('the view diff sends only changed top-level fields, and a patch rebuilds the view', () => {
  const { s, log } = started(2, 2);
  const before = structuredClone(s);
  const a = fieldsOf(before);
  const who = waitingOn(s)!;
  reduceMut(s, { t: 'ChooseDoor', playerId: who, door: 2 });
  log.push({ t: 'ChooseDoor', playerId: who, door: 2 });
  const b = fieldsOf(s);
  const patch = JSON.parse(patchOf(a, b)!) as Partial<GameState>;
  assert.ok(Object.keys(patch).length > 0 && Object.keys(patch).length < b.size);
  assert.ok(!('calendar' in patch));
  const rebuilt = { ...before, ...patch };
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(s));
  assert.equal(wholeOf(b), JSON.stringify(s));
  assert.equal(patchOf(new Map([['x', '1']]), b), null, 'a different set of fields sends it whole');
});

test('the lobby shows the faces createSeason will give', () => {
  const rows = [{ colour: 3 }, { colour: 0 }, {}, {}];
  const colours = seatColours(rows);
  const s = createSeason({
    seed: 1,
    players: [
      { name: 'A', kind: 'human', colour: 3 },
      { name: 'B', kind: 'human', colour: 0 },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
    ],
  });
  assert.deepEqual(
    colours,
    s.players.map((p) => p.colour),
  );
});
