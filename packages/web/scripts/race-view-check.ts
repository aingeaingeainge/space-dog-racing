/**
 * Prove the race view cannot disagree with the tick log it is given.
 *
 *   npx tsx packages/web/scripts/race-view-check.ts [seed ...]
 *
 * For every race of every season it checks that:
 *  - sampling the replay twice gives byte-identical results (same log ⇒ same race);
 *  - a dog that has crossed the line keeps the place `result.order` gave it, for ever;
 *  - the standing at the end of the replay is `result.order`;
 *  - the commentary built from a log is the same commentary every time;
 *  - the track a race is run on is exactly as long as the race.
 *
 * Not part of `npm test` (which is the engine's own suite), the same as season-check.ts.
 */
import {
  aiChoiceFor,
  balance,
  createSeason,
  drive,
  isSeasonOver,
  planetOf,
  reduceMut,
  waitingOn,
  type Action,
  type RaceResult,
} from '@sdr/engine';
import { buildCommentary, type CommentaryKind } from '../src/race-view/commentary';
import { sampleAt } from '../src/race-view/renderer';
import { trackBlurb, trackFor } from '../src/race-view/tracks';

const SAMPLES = 240;

/**
 * GDD_V3 §7.5's calls that name a style, tallied — the commentary is the only part of Phase C that
 * cannot be measured by the harness, so this counts how often it actually says the thing.
 */
const STYLE_KINDS: readonly CommentaryKind[] = [
  'burnedOut',
  'aloneInFront',
  'closerGot',
  'closerShort',
  'flatDay',
  'fromTheFront',
  'stalked',
  'piecesPicked',
];
const styleTally = new Map<CommentaryKind, number>(STYLE_KINDS.map((k) => [k, 0]));
/** A stable dog's first race, and whether the commentary named how it runs in it (§5.4). */
let firstRaces = 0;
/** Races whose pace went hot (§5.3), and how many of them the commentary called out loud. */
let hotRaces = 0;
let hotCalled = 0;
let firstRacesNamed = 0;
const seenDogs = new Set<string>();

function checkRace(result: RaceResult): void {
  const where = `week ${result.week} ${result.race} at ${result.planetId}`;
  const track = trackFor(result.planetId);
  if (Math.abs(track.distance - planetOf(result.planetId).track.distance) > 1e-9)
    throw new Error(`${where}: the track is not the length of the race`);

  const tickSeconds = balance.raceTickSeconds;
  const duration = Math.max(0, result.ticks.length - 1) * tickSeconds;
  const settled = new Map<string, number>();

  for (let i = 0; i <= SAMPLES; i++) {
    const t = (duration * i) / SAMPLES;
    const a = sampleAt(result, track, tickSeconds, t);
    const b = sampleAt(result, track, tickSeconds, t);
    if (JSON.stringify(a) !== JSON.stringify(b))
      throw new Error(`${where}: two samples of the same log differ`);

    for (const r of a.standing) {
      if (!r.finished) {
        if (settled.has(r.dogId)) throw new Error(`${where}: ${r.name} un-finished itself`);
        continue;
      }
      const official = result.order.indexOf(r.dogId) + 1;
      if (r.place !== official)
        throw new Error(`${where}: ${r.name} shown ${r.place}, the log says ${official}`);
      const seen = settled.get(r.dogId);
      if (seen !== undefined && seen !== r.place)
        throw new Error(`${where}: ${r.name} changed place after finishing`);
      settled.set(r.dogId, r.place);
    }
  }

  const last = sampleAt(result, track, tickSeconds, duration);
  const shown = last.standing.map((r) => r.dogId).join(',');
  if (shown !== result.order.join(','))
    throw new Error(`${where}: the finish shown is not the finish the engine recorded`);

  const args = {
    result,
    tickSeconds,
    distance: track.distance,
    classLabel: result.race,
    planetName: planetOf(result.planetId).name,
    trackBlurb: trackBlurb(result.planetId),
    endTime: duration,
  };
  const c1 = buildCommentary(args);
  const c2 = buildCommentary(args);
  if (JSON.stringify(c1) !== JSON.stringify(c2))
    throw new Error(`${where}: the same log was called two different ways`);
  if (!c1.length) throw new Error(`${where}: nobody called the race`);
  for (const line of c1) {
    if (line.t < 0 || line.t > duration + 0.5) throw new Error(`${where}: a call landed off-race`);
    if (line.text.includes('{')) throw new Error(`${where}: an unfilled slot in "${line.text}"`);
  }
}

function playSeason(seed: number): { races: number; lines: number; photos: number } {
  const setup = {
    seed,
    players: [
      { name: 'Jesse', kind: 'human' as const },
      ...Array.from({ length: 5 }, () => ({
        name: '',
        kind: 'ai' as const,
        difficulty: 'normal' as const,
      })),
    ],
  };
  const state = createSeason(setup);
  const log: Action[] = [];
  drive(state, log);
  let races = 0;
  let lines = 0;
  let photos = 0;

  for (let step = 0; step < 20000 && !isSeasonOver(state); step++) {
    if (state.races) {
      for (const r of state.races) {
        if (!r.ticks.length) continue;
        checkRace(r);
        races++;
        if (r.photoFinish) photos++;
        const track = trackFor(r.planetId);
        const calls = buildCommentary({
          result: r,
          tickSeconds: balance.raceTickSeconds,
          distance: track.distance,
          classLabel: r.race,
          planetName: planetOf(r.planetId).name,
          trackBlurb: trackBlurb(r.planetId),
          endTime: (r.ticks.length - 1) * balance.raceTickSeconds,
        });
        lines += calls.length;
        if (r.events.some((e) => e.kind === 'hotPace')) hotRaces++;
        if (calls.some((c) => c.kind === 'hotPace')) hotCalled++;
        const styleCalls = calls.filter((c) => STYLE_KINDS.includes(c.kind));
        for (const c of styleCalls) styleTally.set(c.kind, (styleTally.get(c.kind) ?? 0) + 1);
        for (const e of r.entries) {
          if (e.local || seenDogs.has(`${seed}:${e.dogId}`)) continue;
          seenDogs.add(`${seed}:${e.dogId}`);
          firstRaces++;
          if (styleCalls.some((c) => c.text.includes(e.name))) firstRacesNamed++;
        }
      }
    }
    const who = waitingOn(state);
    if (!who) break;
    // v3 Phase D1: a week opens on Explore (GDD_V3 §9.1) — the human opens the first door and
    // answers the card as the Normal AI would.
    if (state.pendingEvent)
      reduceMut(state, {
        t: 'ResolveEvent',
        playerId: state.pendingEvent.playerId,
        choice: aiChoiceFor(state, state.pendingEvent.playerId),
      });
    else if (state.phase === 'explore')
      reduceMut(state, { t: 'ChooseDoor', playerId: who, door: 0 });
    else reduceMut(state, { t: 'EndPhase', playerId: who });
    drive(state, log);
  }
  return { races, lines, photos };
}

const seeds = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => !Number.isNaN(n));
const toRun = seeds.length ? seeds : [42, 7, 1234, 90210, 2026];
let races = 0;
let lines = 0;
let photos = 0;
let failures = 0;
for (const seed of toRun) {
  try {
    const r = playSeason(seed);
    races += r.races;
    lines += r.lines;
    photos += r.photos;
    console.log(`seed ${seed}: ${r.races} races replayed clean, ${r.lines} calls`);
  } catch (e) {
    failures++;
    console.error(`seed ${seed} FAILED: ${(e as Error).message}`);
  }
}
console.log(
  failures
    ? `\n${failures} season(s) failed`
    : `\n${races} races, ${(lines / races).toFixed(1)} calls each, ${photos} photo finishes. ` +
        `Every one replays the same way twice and shows the finish the engine recorded.\n` +
        `Style calls (GDD_V3 §7.5): ${STYLE_KINDS.map((k) => `${k} ${styleTally.get(k)}`).join(' · ')}\n` +
        `A stable dog's first race named its style out loud in ${firstRacesNamed} of ${firstRaces} ` +
        `(${((100 * firstRacesNamed) / Math.max(1, firstRaces)).toFixed(0)}%) — the rest are on the card anyway.\n` +
        `The hot pace (GDD_V3 §5.3) lit in ${hotRaces} of ${races} races and was called in ${hotCalled}.`,
);
process.exit(failures ? 1 : 0);
