import type { Id, RaceResult, StyleId } from '@sdr/engine';

/**
 * The commentary bar.
 *
 * Every line is derived from the tick log the engine handed us — the break out of the boxes, the
 * lead changes and bumps the simulator recorded, and a fade worked out from a runner's own
 * tick-on-tick speed dropping away. Nothing here re-simulates and nothing here rolls a number:
 * the same log always produces the same call, in the same order, at the same moment.
 *
 * ⚠️ **It names the style and the day (GDD_V3 §7.5).** The result carries how every runner ran —
 * its style and that day's expression (`RaceResult.runs`) — so a front-runner that burned out is
 * called as a front-runner that burned out, not as a dog that faded. This is how a player learns
 * §5.4 without being told it: after one race, the commentary has said out loud how the dog runs, and
 * the dog card says the same thing from then on.
 */

export type CommentaryKind =
  | 'opening'
  | 'break'
  | 'breakSlow'
  | 'leadChange'
  | 'bump'
  | 'fade'
  | 'lateRun'
  | 'burnedOut'
  | 'aloneInFront'
  | 'closerGot'
  | 'closerShort'
  | 'flatDay'
  | 'fromTheFront'
  | 'stalked'
  | 'hotPace'
  | 'piecesPicked'
  | 'marker'
  | 'photo'
  | 'win';

export interface CommentaryLine {
  /** Seconds into the replay. */
  t: number;
  text: string;
  kind: CommentaryKind;
}

interface Slots {
  dog?: string;
  other?: string;
  trap?: number;
  gap?: string;
  distance?: number;
  class?: string;
  track?: string;
  planet?: string;
}

const TEMPLATES: Record<CommentaryKind, readonly string[]> = {
  opening: [
    'The {class} over {distance} metres at {planet}. Lids up!',
    '{distance} metres of the {class} here at {planet}. And they are off!',
    'Hare is running for the {class}. {distance} metres at {planet}.',
    'Traps rattling for the {class} — {distance} metres, {planet}.',
  ],
  break: [
    '{dog} is out of trap {trap} like a scalded cat!',
    'Fast away from the boxes — {dog} pings the lids.',
    '{dog} breaks best and the {distance} is on.',
    'Lids up and {dog} is gone, textbook out of trap {trap}.',
    'Cleanest break of the night from {dog}.',
    '{dog} beats the lot of them out of the traps.',
    'They are away, and {dog} has stolen a length already.',
    '{dog} first to show, hugging the rail from trap {trap}.',
  ],
  breakSlow: [
    '{dog} is slow to stand up in trap {trap} — plenty to do.',
    'A dreadful break from {dog}, away last of all.',
    '{dog} misses the lids and gives them a start.',
    'Trap {trap} did {dog} no favours there, away last.',
    '{dog} was still thinking about it when the lids went up.',
    'Nothing doing early for {dog}.',
  ],
  leadChange: [
    '{dog} takes it up!',
    'And here comes {dog} to head the field.',
    '{dog} sweeps through into the lead.',
    'New leader — {dog} in front.',
    'That is {dog} on top now, and going well.',
    '{dog} has the lure and does not want to give it back.',
    'A change at the head of affairs: {dog}.',
    'Up goes {dog} into first.',
    '{dog} grabs the lead off the rail.',
  ],
  bump: [
    'Trouble! {dog} and {other} come together.',
    '{dog} is checked badly by {other}.',
    'Bumped — {dog} takes a bad one there.',
    'Scrimmaging on the bend, and {dog} loses out to {other}.',
    '{dog} is knocked sideways by {other} and loses ground.',
    'A crunching bump between {dog} and {other}.',
    '{dog} has to snatch up behind {other}.',
    'Interference, and it is {dog} who pays for it.',
    '{other} leans on {dog} going into the turn.',
  ],
  fade: [
    '{dog} is emptying — the {distance} is finding it out.',
    'The tank is dry for {dog}.',
    '{dog} is stopping to nothing now.',
    'That is {dog} in bother, legs gone in the closing stages.',
    '{dog} has run its race and is going backwards.',
    'Stamina told there, and {dog} fades right away.',
    '{dog} is treading water while the others come by.',
    'It has all been a shade too quick for {dog}.',
    '{dog} paid for that early pace and is dropping out.',
  ],
  lateRun: [
    '{dog} is flying home!',
    'Here comes {dog} on the outside, eating up the ground.',
    '{dog} has come from absolutely nowhere.',
    'A storming finish from {dog}.',
    '{dog} is picking them off one by one.',
    'Late and fast — {dog} is going to be involved.',
    '{dog} is running on strongly at the death.',
    'Watch {dog}, still with a run to make.',
  ],
  // ---- GDD_V3 §7.5: the style and the day, by name ----
  burnedOut: [
    '{dog} went off like a rocket and there is nothing left — the front-runner has run its race.',
    'That early speed is costing {dog} now. Front-runners pay for it, and this one is paying.',
    '{dog} led them a merry dance early and the legs have gone — nothing left at the turn.',
    'The front-runner {dog} is coming back to them, and coming back fast.',
    'Too keen by half from {dog} — blazed away in front and is stopping to nothing.',
  ],
  aloneInFront: [
    'Nobody has taken {dog} on — the front-runner is dictating this, {gap} m clear.',
    '{dog} has been left alone in front and is bowling along, {gap} m to spare.',
    'Front-runner {dog} out on its own and loving it — {gap} m clear.',
    'Nothing is going with {dog}, and a front-runner left alone is a dangerous thing.',
  ],
  closerGot: [
    'Here comes the closer! {dog} was last of all and has got there!',
    '{dog}, nowhere at halfway, comes home like a train — that is how a closer does it.',
    'The closer {dog} has swallowed the lot of them up the straight!',
    '{dog} saved it all for the finish and it has paid — the closer gets up.',
  ],
  closerShort: [
    '{dog} is closing hardest of all — but the line comes too soon for the closer.',
    'A huge late run from {dog}, too late. Another fifty metres and the closer wins it.',
    '{dog} left it all to the straight and has run out of track.',
    'The closer {dog} is flying now — and the post is not going to wait for it.',
  ],
  fromTheFront: [
    '{dog} went from the front and is hanging on — a front-runner making them come and get it.',
    'Front-runner {dog} set it up early and is still there at the business end.',
    '{dog} bounced out and led, and has just about enough left.',
  ],
  stalked: [
    '{dog} sat handy all the way, stalking the leaders, and pounces now.',
    'The stalker {dog} tracked them round and has picked its moment.',
    '{dog} has been sitting just off the pace — and here it comes, right on cue.',
  ],
  // ---- GDD_V3 §5.3: the hot pace, and the closer who picks up the pieces ----
  hotPace: [
    '{dog} and {other} are taking each other on up front — this pace is too hot to last.',
    'Two front-runners and neither will give an inch: {dog} and {other}, cutting each other’s throats.',
    '{dog} will not let {other} go, and they are burning each other up out there.',
    'A proper duel for the lead between {dog} and {other} — somebody is going to pay for this.',
  ],
  piecesPicked: [
    'They cut each other up in front and the closer {dog} picks up the pieces!',
    'The front-runners went too hard, and {dog} has come from last to collect.',
    '{dog} sat out the duel at the back and walks past the wreckage — the closer’s day.',
    'That is what a hot pace does: the leaders are cooked and {dog} comes home over the top.',
  ],
  flatDay: [
    '{dog} never went forward today — a front-runner running like a stalker.',
    'No early dash from {dog} this time; not its day for making the running.',
    '{dog} is usually up there early. Not today — it has not gone with them at all.',
  ],
  marker: [
    'Halfway, and {dog} leads by {gap} m.',
    'Down the back and it is {dog} by {gap}.',
    '{dog} still in front at the halfway mark.',
    'Turning for home it is {dog}, {gap} m clear.',
    'Into the straight and {dog} leads.',
    '{dog} has {gap} m on the field with work still to do.',
    'They are strung out now, {dog} in charge.',
    'The lure belongs to {dog}, for the moment.',
  ],
  photo: [
    'It is too close to call! They go to the photo.',
    'Photo finish — nothing between them on the line.',
    'Who got it? {dog} and {other} inseparable at the line.',
    'A blanket finish, and the judge will have to sort it out.',
    'Neck and neck on the line — call for the photo!',
    'You could not split them. Photo.',
  ],
  win: [
    '{dog} wins it by {gap} m!',
    'It is {dog}, and trap {trap} has done it again.',
    '{dog} holds on for a famous win.',
    'A comfortable one in the end for {dog}.',
    '{dog} takes the {class} and the purse with it.',
    'First past the post: {dog}.',
    '{dog} wins going away.',
    'Job done for {dog} on the {track}.',
    '{dog} gets there, and that is the {class} decided.',
  ],
};

/** Which call wins when two land on top of each other. */
const PRIORITY: Record<CommentaryKind, number> = {
  win: 6,
  photo: 6,
  burnedOut: 5,
  aloneInFront: 5,
  closerGot: 5,
  closerShort: 5,
  flatDay: 5,
  fromTheFront: 5,
  stalked: 5,
  piecesPicked: 5,
  hotPace: 4,
  fade: 4,
  lateRun: 4,
  leadChange: 3,
  bump: 3,
  break: 2,
  breakSlow: 2,
  opening: 1,
  marker: 1,
};

/** FNV-1a. Picks a template from the moment itself, so the same log gives the same words. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function fill(template: string, slots: Slots): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = (slots as Record<string, unknown>)[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function say(kind: CommentaryKind, t: number, key: string, slots: Slots): CommentaryLine {
  const pool = TEMPLATES[kind];
  const pick = pool[hash(`${kind}:${key}`) % pool.length]!;
  return { t, kind, text: fill(pick, slots) };
}

export interface CommentaryContext {
  result: RaceResult;
  tickSeconds: number;
  distance: number;
  classLabel: string;
  planetName: string;
  trackBlurb: string;
  /** Stop calling the race here — the replay does not wait for the tail-enders. */
  endTime: number;
}

const MIN_GAP = 1.15;
/** When the break is called. Late enough that the opening line gets its moment first. */
const BREAK_CALL_AT = 1.2;
/** Lead changes inside this many ticks are the boxes sorting themselves out, not a move. */
const SETTLE_TICKS = 18;
/** Two runners emptying is a story; five is a list. */
const MAX_FADES = 2;
/** Style calls a race: a burned-out front-runner and a closer is a story; five is a list. */
const MAX_STYLE_CALLS = 3;
/** An expression this low and a front-runner is barely one (GDD_V3 §5.2: 0.35 "runs like a stalker"). */
const FLAT_DAY = 0.5;
const SPEED_WINDOW = 10;

/** Place of every runner at a tick, by distance. Index-aligned with `result.entries`. */
function placesAt(ticks: number[][], k: number, n: number): number[] {
  const row = ticks[k] ?? [];
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => (row[b] ?? 0) - (row[a] ?? 0));
  const place = new Array<number>(n).fill(n);
  idx.forEach((i, rank) => {
    place[i] = rank + 1;
  });
  return place;
}

export function buildCommentary(ctx: CommentaryContext): CommentaryLine[] {
  const { result, tickSeconds, distance } = ctx;
  const entries = result.entries;
  const n = entries.length;
  const ticks = result.ticks;
  const lastTick = Math.max(0, ticks.length - 1);
  if (lastTick < 2) return [];
  const secs = (tick: number) => tick * tickSeconds;
  const nameOf = (id: Id) => entries.find((e) => e.dogId === id)?.name ?? 'that one';
  const trapOf = (id: Id) => entries.find((e) => e.dogId === id)?.trap ?? 0;
  const base: Slots = {
    distance,
    class: ctx.classLabel,
    track: ctx.trackBlurb,
    planet: ctx.planetName,
  };

  const out: CommentaryLine[] = [];
  out.push(say('opening', 0, `${result.week}:${result.race}:${result.planetId}`, base));

  // --- The break, read off the first few ticks ---
  const breakTick = Math.min(7, lastTick);
  const early = ticks[breakTick] ?? [];
  let fast = 0;
  let slow = 0;
  for (let i = 1; i < n; i++) {
    if ((early[i] ?? 0) > (early[fast] ?? 0)) fast = i;
    if ((early[i] ?? 0) < (early[slow] ?? 0)) slow = i;
  }
  const spread = (early[fast] ?? 0) - (early[slow] ?? 0);
  // Read off tick 7 but called a beat later, so the opening line is not immediately buried.
  out.push(
    say('break', BREAK_CALL_AT, `${result.race}:${entries[fast]!.dogId}`, {
      ...base,
      dog: entries[fast]!.name,
      trap: entries[fast]!.trap,
    }),
  );
  if (spread > 1.6) {
    out.push(
      say('breakSlow', BREAK_CALL_AT + 1.3, `${result.race}:${entries[slow]!.dogId}`, {
        ...base,
        dog: entries[slow]!.name,
        trap: entries[slow]!.trap,
      }),
    );
  }

  // --- Lead changes and bumps, straight out of the engine's event list ---
  for (const ev of result.events) {
    if (ev.kind === 'leadChange') {
      if (ev.tick < SETTLE_TICKS) continue;
      out.push(
        say('leadChange', secs(ev.tick), `${result.race}:${ev.tick}:${ev.dogId}`, {
          ...base,
          dog: nameOf(ev.dogId),
          trap: trapOf(ev.dogId),
        }),
      );
    } else if (ev.kind === 'hotPace') {
      // Called when it lights (§5.3): two front-runners at the head, and the lead group paying.
      out.push(
        say('hotPace', Math.max(BREAK_CALL_AT + 1.2, secs(ev.tick)), `${result.race}:hot`, {
          ...base,
          dog: nameOf(ev.dogId),
          other: ev.otherId ? nameOf(ev.otherId) : 'the other front-runner',
        }),
      );
    } else if (ev.kind === 'bump') {
      out.push(
        say('bump', secs(ev.tick), `${result.race}:${ev.tick}:${ev.dogId}`, {
          ...base,
          dog: nameOf(ev.dogId),
          other: ev.otherId ? nameOf(ev.otherId) : 'the one inside it',
        }),
      );
    }
  }

  // --- Markers: where the leader is at halfway and at the turn for home ---
  for (const [frac, offset] of [
    [0.5, 0],
    [0.78, 1],
  ] as const) {
    const want = distance * frac;
    let k = 0;
    while (k < lastTick && Math.max(...(ticks[k] ?? [0])) < want) k++;
    if (k <= 0 || k >= lastTick) continue;
    const row = ticks[k] ?? [];
    const place = placesAt(ticks, k, n);
    const lead = place.indexOf(1);
    const second = place.indexOf(2);
    if (lead < 0) continue;
    const gap = Math.max(0, (row[lead] ?? 0) - (row[second] ?? 0));
    out.push(
      say('marker', secs(k), `${result.race}:${frac}:${entries[lead]!.dogId}${offset}`, {
        ...base,
        dog: entries[lead]!.name,
        gap: gap.toFixed(1),
      }),
    );
  }

  // --- Fades and late runs, derived from each runner's own tick-on-tick speed ---
  const step = 5;
  const samples: { k: number; place: number[] }[] = [];
  for (let k = SPEED_WINDOW; k <= lastTick; k += step)
    samples.push({ k, place: placesAt(ticks, k, n) });
  const speedAt = (i: number, k: number): number => {
    const a = ticks[Math.max(0, k - SPEED_WINDOW)]?.[i] ?? 0;
    const b = ticks[k]?.[i] ?? 0;
    return (b - a) / (SPEED_WINDOW * tickSeconds);
  };

  const fades: { i: number; line: CommentaryLine }[] = [];
  const closers: { i: number; line: CommentaryLine }[] = [];
  for (let i = 0; i < n; i++) {
    const id = entries[i]!.dogId;
    const finish = result.finishTicks[id] ?? lastTick;
    let peak = 0;
    for (const { k } of samples) {
      if (k > finish) break;
      if (k > lastTick * 0.65) break;
      peak = Math.max(peak, speedAt(i, k));
    }
    if (peak <= 0) continue;
    let bestEarly = n;
    let fadeDone = false;
    for (const { k, place } of samples) {
      if (k > finish) break;
      const frac = (ticks[k]?.[i] ?? 0) / distance;
      if (frac < 0.5) {
        bestEarly = Math.min(bestEarly, place[i]!);
        continue;
      }
      if (fadeDone) continue;
      const v = speedAt(i, k);
      if (v < peak * 0.87 && place[i]! - bestEarly >= 2 && bestEarly <= 4) {
        fades.push({
          i,
          line: say('fade', secs(k), `${result.race}:${id}`, {
            ...base,
            dog: entries[i]!.name,
            trap: entries[i]!.trap,
          }),
        });
        fadeDone = true;
      }
    }
    // A late run: well beaten at halfway, in the money by the line.
    const finalPlace = result.order.indexOf(id) + 1;
    let midPlace = 0;
    for (const { k, place } of samples) {
      if ((ticks[k]?.[i] ?? 0) / distance >= 0.5) {
        midPlace = place[i]!;
        break;
      }
    }
    const gained = midPlace - finalPlace;
    if (finalPlace > 0 && ((gained >= 2 && finalPlace <= 3) || (gained >= 3 && finalPlace <= 4))) {
      closers.push({
        i,
        line: say('lateRun', Math.max(0, secs(finish) - 3.4), `${result.race}:${id}`, {
          ...base,
          dog: entries[i]!.name,
          trap: entries[i]!.trap,
        }),
      });
    }
  }

  // --- The style and the day (GDD_V3 §7.5) ---
  const styled = styleCalls(ctx, samples, base);
  const called = new Set(styled.map((c) => c.i));
  fades.sort((a, b) => a.line.t - b.line.t);
  out.push(
    ...fades
      .filter((f) => !called.has(f.i))
      .slice(0, MAX_FADES)
      .map((f) => f.line),
    ...closers.filter((c) => !called.has(c.i)).map((c) => c.line),
    ...styled.map((c) => c.line),
  );

  // --- The line ---
  const winner = result.order[0];
  const runnerUp = result.order[1];
  if (winner) {
    const at = secs(result.finishTicks[winner] ?? lastTick);
    if (result.photoFinish) {
      out.push(
        say('photo', at, `${result.race}:${winner}`, {
          ...base,
          dog: nameOf(winner),
          other: runnerUp ? nameOf(runnerUp) : 'the other',
        }),
      );
    }
    out.push(
      say('win', at + (result.photoFinish ? 1.4 : 0.25), `${result.race}:${winner}:w`, {
        ...base,
        dog: nameOf(winner),
        trap: trapOf(winner),
        gap: result.margin.toFixed(2),
      }),
    );
  }

  // Sort, then thin: a call needs a moment to land, and the bigger moment wins a clash.
  out.sort((a, b) => a.t - b.t || PRIORITY[b.kind] - PRIORITY[a.kind]);
  const kept: CommentaryLine[] = [];
  for (const line of out) {
    if (line.t > ctx.endTime + 0.4) continue;
    const last = kept[kept.length - 1];
    if (last && line.t - last.t < MIN_GAP) {
      if (PRIORITY[line.kind] > PRIORITY[last.kind]) kept[kept.length - 1] = line;
      continue;
    }
    kept.push(line);
  }
  return kept;
}

/**
 * The calls that name a style: a front-runner that burned out, one left alone in front, a closer
 * that got there, a closer that did not, and a front-runner that never went forward that day.
 * Read off the tick log and `result.runs` — no re-simulation, no dice.
 */
function styleCalls(
  ctx: CommentaryContext,
  samples: readonly { k: number; place: number[] }[],
  base: Slots,
): { i: number; line: CommentaryLine }[] {
  const { result, tickSeconds, distance } = ctx;
  const runs = result.runs ?? [];
  if (!runs.length) return [];
  const entries = result.entries;
  const n = entries.length;
  const ticks = result.ticks;
  const secs = (tick: number) => tick * tickSeconds;
  const styleOf = (i: number): StyleId | undefined => runs[i]?.style;
  const leaderAt = (k: number) => Math.max(...(ticks[k] ?? [0]));
  // The first sample at which the leader is a third and two thirds of the way round.
  const at = (frac: number) => samples.find((x) => leaderAt(x.k) >= distance * frac);
  const early = at(1 / 3);
  const late = at(2 / 3);
  if (!early || !late) return [];
  const out: { i: number; line: CommentaryLine }[] = [];
  // Whether the pace was hot (§5.3). A closer who gets there after one picked up the pieces.
  const hot = result.events.some((e) => e.kind === 'hotPace');
  const key = (kind: string, i: number) => `${result.race}:${kind}:${entries[i]!.dogId}`;
  const slots = (i: number, gap?: number): Slots => ({
    ...base,
    dog: entries[i]!.name,
    trap: entries[i]!.trap,
    gap: gap === undefined ? undefined : gap.toFixed(1),
  });
  for (let i = 0; i < n; i++) {
    const style = styleOf(i);
    const expression = runs[i]?.expression ?? 1;
    const finalPlace = result.order.indexOf(entries[i]!.dogId) + 1;
    const earlyPlace = early.place[i]!;
    const latePlace = late.place[i]!;
    const finish = secs(result.finishTicks[entries[i]!.dogId] ?? ticks.length - 1);
    if (style === 'frontRunner') {
      if (earlyPlace <= 3 && finalPlace >= earlyPlace + 3) {
        out.push({ i, line: say('burnedOut', secs(late.k), key('burn', i), slots(i)) });
      } else if (earlyPlace === 1 && latePlace === 1 && finalPlace === 1) {
        const row = ticks[late.k] ?? [];
        const second = late.place.indexOf(2);
        const gap = (row[i] ?? 0) - (row[second] ?? 0);
        if (gap >= 1.5)
          out.push({ i, line: say('aloneInFront', secs(late.k), key('alone', i), slots(i, gap)) });
      } else if (earlyPlace <= 2 && finalPlace <= 3) {
        out.push({
          i,
          line: say('fromTheFront', Math.max(0, finish - 2.8), key('held', i), slots(i)),
        });
      } else if (expression <= FLAT_DAY && earlyPlace >= 4) {
        out.push({ i, line: say('flatDay', secs(early.k), key('flat', i), slots(i)) });
      }
    } else if (style === 'stalker') {
      // Sat in behind the leaders early, in the frame at the line: the stalker's race, by the book.
      if (earlyPlace >= 2 && earlyPlace <= 4 && finalPlace <= 2) {
        out.push({ i, line: say('stalked', Math.max(0, finish - 2.6), key('stalk', i), slots(i)) });
      }
    } else if (style === 'closer') {
      if (earlyPlace >= 5 && finalPlace <= 3) {
        const kind = hot ? 'piecesPicked' : 'closerGot';
        out.push({ i, line: say(kind, Math.max(0, finish - 2.4), key('got', i), slots(i)) });
      } else if (
        earlyPlace >= 5 &&
        finalPlace >= 4 &&
        finalPlace <= 6 &&
        earlyPlace - finalPlace >= 2
      ) {
        out.push({
          i,
          line: say('closerShort', Math.max(0, finish - 1.6), key('short', i), slots(i)),
        });
      }
    }
  }
  out.sort((a, b) => a.line.t - b.line.t);
  return out.slice(0, MAX_STYLE_CALLS);
}

/** The line that should be showing at `t`. */
export function lineAt(lines: readonly CommentaryLine[], t: number): CommentaryLine | null {
  let found: CommentaryLine | null = null;
  for (const line of lines) {
    if (line.t > t) break;
    found = line;
  }
  return found;
}
