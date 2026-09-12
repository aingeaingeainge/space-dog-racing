import { useEffect, useMemo, useRef, useState } from 'react';
import {
  balance,
  formatBones,
  planetOf,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
  type RaceResult,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Delta, STABLE_COLOURS } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { playerById, raceLabel } from '../lib/selectors';
import { useGame, type RaceSpeed } from '../store/gameStore';
import { buildCommentary, lineAt, type CommentaryLine } from '../race-view/commentary';
import { createRenderer, type RaceSample, type RunnerStyle } from '../race-view/renderer';
import { paletteFor } from '../race-view/palette';
import { spriteAt } from '../race-view/sprites';
import { trackBlurb, trackFor } from '../race-view/tracks';
import { planetGround, planetSurface } from '../lib/assets';
import { loadImage, peekImage } from '../lib/imageCache';

/**
 * GDD §6.3 — the three races, replayed from the tick logs the engine recorded. Bronze, then
 * Silver, then Gold, then the results screen that already exists. Races are public, so this
 * sits where the results sat: after the last stable has declared, before the laptop is passed.
 */
export function RaceView({ s, me }: { s: GameState; me: Player }) {
  const ackRaces = useGame((g) => g.ackRaces);
  const [idx, setIdx] = useState(0);
  const races = s.races;
  // A save from before the race view, or a week whose logs were pruned, must not strand anybody:
  // fail soft to the results rather than showing an empty track.
  const playable = !!races && races.length > 0 && races.every((r) => (r.ticks?.length ?? 0) > 1);

  useEffect(() => {
    if (!playable) ackRaces();
  }, [playable, ackRaces]);

  if (!races || !playable) return null;
  const result = races[Math.min(idx, races.length - 1)]!;

  return (
    <RaceReplay
      key={result.race}
      s={s}
      me={me}
      result={result}
      index={idx}
      count={races.length}
      onDone={() => (idx >= races.length - 1 ? ackRaces() : setIdx(idx + 1))}
    />
  );
}

type Stage = 'run' | 'photo' | 'result';

const PHOTO_HOLD_MS = 1700;
const RESULT_HOLD_MS = 4500;

function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return lum > 140 ? '#12111a' : '#f4f4f4';
}

function RaceReplay({
  s,
  me,
  result,
  index,
  count,
  onDone,
}: {
  s: GameState;
  me: Player;
  result: RaceResult;
  index: number;
  count: number;
  onDone: () => void;
}) {
  const speed = useGame((g) => g.raceSpeed);
  const setRaceSpeed = useGame((g) => g.setRaceSpeed);
  const race: RaceTypeId = result.race;
  const planet = planetOf(result.planetId);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<Stage>('run');
  const [stage, setStage] = useState<Stage>('run');
  const clockRef = useRef(0);
  const speedRef = useRef<RaceSpeed>(speed);
  const skipRef = useRef(false);
  const [hud, setHud] = useState<{
    time: number;
    standing: RaceSample['standing'];
    call: CommentaryLine | null;
  }>({ time: 0, standing: [], call: null });

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const track = useMemo(() => trackFor(result.planetId), [result.planetId]);
  // The track is repainted in this planet's two accents; the geometry is M2's and does not move.
  const palette = useMemo(() => paletteFor(result.planetId), [result.planetId]);
  const styles = useMemo(() => {
    return result.entries.map((e): RunnerStyle => {
      const owner = e.local ? undefined : playerById(s, e.ownerId as Id);
      const colour = owner ? STABLE_COLOURS[owner.colour % STABLE_COLOURS.length]! : '#7c7889';
      return { colour, ink: ink(colour), local: e.local, mine: !!owner && owner.id === me.id };
    });
  }, [result, s, me.id]);

  /**
   * The planet's ground and its surface tile. Both are fetched here rather than with the app,
   * so a player who never watches a race never pays for them, and both are polled by the
   * renderer rather than passed in — the first frame draws on session 1's palette colours and
   * the art takes over the moment it lands.
   *
   * Stand-ins are deliberately not used down here. A hatched 2048² placeholder under the track
   * would be less readable than the flat colour the palette already gives every planet, and
   * the hub is where the "art is missing" stamp belongs.
   */
  const groundUrl = useMemo(() => {
    const art = planetGround(result.planetId);
    return art && !art.placeholder ? art.url : null;
  }, [result.planetId]);
  const surfaceUrl = useMemo(() => {
    const art = planetSurface(result.planetId);
    return art && !art.placeholder ? art.url : null;
  }, [result.planetId]);

  useEffect(() => {
    if (groundUrl) void loadImage(groundUrl);
    if (surfaceUrl) void loadImage(surfaceUrl);
  }, [groundUrl, surfaceUrl]);

  /** One row per runner: which base body it wears and what colour its saddle cloth is. */
  const runners = useMemo(
    () =>
      result.entries.map((e, i) => ({
        // A local with no Dog record still gets a stable body, so its cycle does not flicker.
        body: s.dogs[e.dogId]?.look.body ?? e.trap % 12,
        colour: styles[i]!.local ? null : styles[i]!.colour,
      })),
    [result, s.dogs, styles],
  );
  const runnerIndex = useMemo(() => new Map(result.entries.map((e, i) => [e.dogId, i])), [result]);

  const commentary = useMemo(
    () =>
      buildCommentary({
        result,
        tickSeconds: balance.raceTickSeconds,
        distance: track.distance,
        classLabel: raceLabel(race),
        planetName: planet.name,
        trackBlurb: trackBlurb(result.planetId),
        endTime: Math.max(1, (result.ticks.length - 1) * balance.raceTickSeconds),
      }),
    [result, track, race, planet.name],
  );

  // --- the replay loop -------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas, {
      result,
      track,
      tickSeconds: balance.raceTickSeconds,
      styleFor: (i) => styles[i]!,
      palette,
      groundFor: () => (groundUrl ? peekImage(groundUrl) : null),
      surfaceFor: () => (surfaceUrl ? peekImage(surfaceUrl) : null),
      spriteFor: (dogId, _heading, distance) => {
        const i = runnerIndex.get(dogId);
        if (i === undefined) return null;
        const r = runners[i]!;
        return spriteAt(r.body, r.colour, distance);
      },
    });
    let raf = 0;
    let last = 0;
    let photoPending = result.photoFinish;
    let freezeUntil = 0;
    let hudAt = 0;
    let first = true;
    clockRef.current = 0;
    stageRef.current = 'run';
    skipRef.current = false;

    const onResize = () => renderer.resize();
    globalThis.addEventListener('resize', onResize);

    function frame(now: number): void {
      const dt = last ? Math.min(0.08, (now - last) / 1000) : 1 / 60;
      last = now;

      if (skipRef.current && stageRef.current !== 'result') {
        clockRef.current = renderer.replayEnd;
        photoPending = false;
        stageRef.current = 'result';
        setStage('result');
      } else if (stageRef.current === 'photo') {
        if (now >= freezeUntil) {
          photoPending = false;
          stageRef.current = 'run';
          setStage('run');
        }
      } else if (stageRef.current === 'run') {
        const next = clockRef.current + dt * speedRef.current;
        if (photoPending && next >= renderer.winnerAt) {
          clockRef.current = renderer.winnerAt;
          freezeUntil = now + PHOTO_HOLD_MS;
          stageRef.current = 'photo';
          setStage('photo');
        } else {
          clockRef.current = next;
        }
        if (clockRef.current >= renderer.replayEnd) {
          clockRef.current = renderer.replayEnd;
          stageRef.current = 'result';
          setStage('result');
        }
      }

      renderer.draw(clockRef.current, {
        freeze: stageRef.current === 'photo',
        dt: first || skipRef.current ? 1 : dt,
      });
      first = false;

      if (now - hudAt > 80) {
        hudAt = now;
        const sample = renderer.sample(clockRef.current);
        setHud({
          time: clockRef.current,
          standing: sample.standing,
          call: lineAt(commentary, clockRef.current),
        });
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      globalThis.removeEventListener('resize', onResize);
    };
  }, [result, track, styles, commentary, palette, groundUrl, surfaceUrl, runners, runnerIndex]);

  // --- the result overlay advances itself ------------------------------------------------
  useEffect(() => {
    if (stage !== 'result') return;
    const id = setTimeout(onDone, RESULT_HOLD_MS);
    return () => clearTimeout(id);
  }, [stage, onDone]);

  // --- one keystroke per control ---------------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === '1') setRaceSpeed(1);
      else if (e.key === '2') setRaceSpeed(2);
      else if (e.key === 's' || e.key === 'S') skipRef.current = true;
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (stageRef.current === 'result') onDone();
        else skipRef.current = true;
      } else return;
      e.preventDefault();
    }
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [setRaceSpeed, onDone]);

  const mine = result.payouts.filter((p) => p.playerId === me.id);
  const purse = result.purse[0];

  return (
    <div className="app">
      <Panel
        title={`${raceLabel(race)} — ${planet.name}`}
        sub={`race ${index + 1} of ${count} · ${trackBlurb(result.planetId)} · winner takes ${formatBones(purse)}`}
        tight
        actions={
          <span className="race-controls">
            <NeonButton
              variant={speed === 1 ? 'primary' : 'default'}
              onClick={() => setRaceSpeed(1)}
              title="Real time (key: 1)"
            >
              1×
            </NeonButton>
            <NeonButton
              variant={speed === 2 ? 'primary' : 'default'}
              onClick={() => setRaceSpeed(2)}
              title="Double speed (key: 2)"
            >
              2×
            </NeonButton>
            <NeonButton
              onClick={() => (stage === 'result' ? onDone() : (skipRef.current = true))}
              title="Skip to the result (key: S)"
            >
              {stage === 'result' ? 'Next ⏎' : 'Skip'}
            </NeonButton>
          </span>
        }
      >
        <div className="race-stage">
          <canvas ref={canvasRef} className="race-canvas" />

          <div className="race-clock">
            {hud.time.toFixed(1)}s{speed === 2 ? ' · 2×' : ''}
          </div>

          <ol className="race-ticker">
            {hud.standing.map((r) => {
              const st = styles[r.index]!;
              return (
                <li key={r.dogId} className={st.mine ? 'me' : undefined}>
                  <b>{r.place}</b>
                  <i className="cloth" style={{ background: st.colour, color: st.ink }}>
                    {r.trap}
                  </i>
                  <span className="nm">{r.name}</span>
                  <span className="gap">
                    {r.finished ? 'home' : r.behind < 0.05 ? '—' : `${r.behind.toFixed(1)}m`}
                  </span>
                </li>
              );
            })}
          </ol>

          {stage === 'result' ? null : <div className="race-call">{hud.call?.text ?? ''}</div>}

          {stage === 'photo' ? <div className="race-photo">PHOTO FINISH</div> : null}
          {stage === 'result' ? (
            <ResultCard s={s} me={me} result={result} mine={mine} onNext={onDone} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

/** The brief version, over the frozen finish. The full weekend table follows after Gold. */
function ResultCard({
  s,
  me,
  result,
  mine,
  onNext,
}: {
  s: GameState;
  me: Player;
  result: RaceResult;
  mine: RaceResult['payouts'];
  onNext: () => void;
}) {
  const won = mine.reduce((sum, p) => sum + p.amount, 0);
  const myRunner = result.entries.find((e) => e.ownerId === me.id);
  return (
    <div className="race-result">
      <h3>
        {raceLabel(result.race)} result
        {result.photoFinish ? <Badge tone="hot">photo</Badge> : null}
      </h3>
      <ol>
        {result.order.slice(0, 3).map((dogId, i) => {
          const e = result.entries.find((x) => x.dogId === dogId);
          if (!e) return null;
          const owner = e.local ? undefined : playerById(s, e.ownerId as Id);
          const colour = owner ? STABLE_COLOURS[owner.colour % STABLE_COLOURS.length]! : '#7c7889';
          return (
            <li key={dogId}>
              <b>{i + 1}</b>
              <i className="cloth" style={{ background: colour, color: ink(colour) }}>
                {e.trap}
              </i>
              <span className="nm">{e.name}</span>
              <span className="own">{owner ? owner.name : 'local'}</span>
              <span className="num">
                <Delta n={result.ratingDeltas[dogId] ?? 0} />
              </span>
              <span className="num">{formatBones(result.purse[i] ?? 0)}</span>
            </li>
          );
        })}
      </ol>
      <p className="race-margin">
        Won by {result.margin} m
        {myRunner ? (
          <>
            {' · '}
            {won ? (
              <b className="up">you collect {formatBones(won)}</b>
            ) : (
              <span className="muted">nothing for {myRunner.name}</span>
            )}
          </>
        ) : null}
      </p>
      <NeonButton variant="primary" onClick={onNext}>
        Next ⏎
      </NeonButton>
    </div>
  );
}
