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
  balance,
  createSeason,
  drive,
  isSeasonOver,
  planetOf,
  reduceMut,
  waitingOn,
  RACE_CLASSES,
  type Action,
  type RaceResult,
} from '@sdr/engine';
import { buildCommentary } from '../src/race-view/commentary';
import { sampleAt } from '../src/race-view/renderer';
import { trackBlurb, trackFor } from '../src/race-view/tracks';

const SAMPLES = 240;

function checkRace(result: RaceResult): void {
  const where = `week ${result.week} ${result.cls} at ${result.planetId}`;
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
    classLabel: result.cls,
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
      for (const cls of RACE_CLASSES) {
        const r = state.races[cls];
        if (!r?.ticks.length) continue;
        checkRace(r);
        races++;
        if (r.photoFinish) photos++;
        const track = trackFor(r.planetId);
        lines += buildCommentary({
          result: r,
          tickSeconds: balance.raceTickSeconds,
          distance: track.distance,
          classLabel: cls,
          planetName: planetOf(r.planetId).name,
          trackBlurb: trackBlurb(r.planetId),
          endTime: (r.ticks.length - 1) * balance.raceTickSeconds,
        }).length;
      }
    }
    const who = waitingOn(state);
    if (!who) break;
    if (state.pendingEvent)
      reduceMut(state, { t: 'ResolveEvent', playerId: state.pendingEvent.playerId, choice: 0 });
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
        `Every one replays the same way twice and shows the finish the engine recorded.`,
);
process.exit(failures ? 1 : 0);
