import { Fragment, useEffect, useRef, useState } from 'react';
import { balance, formatBones } from '@sdr/engine';
import type { Difficulty, GameLength, PlayerSetup, Toggles } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Swatch } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { parseSeasonLink } from '../lib/seedLink';
import { portraitArt } from '../lib/assets';
import { HUMAN_FACES, humanFaceStem, resolveColours } from '../lib/owners';
import { useGame } from '../store/gameStore';
import { roomsUrl } from '../store/online';

const MAX_STABLES = 8;

function defaultRoster(): PlayerSetup[] {
  return [
    { name: 'My Stable', kind: 'human' },
    { name: '', kind: 'ai', difficulty: 'normal' },
    { name: '', kind: 'ai', difficulty: 'normal' },
    { name: '', kind: 'ai', difficulty: 'normal' },
    { name: '', kind: 'ai', difficulty: 'normal' },
    { name: '', kind: 'ai', difficulty: 'normal' },
  ];
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/** The build's own name (`__SDR_BUILD__`, a Vite define from `git describe`), for the footer. */
const BUILD = typeof __SDR_BUILD__ === 'string' ? __SDR_BUILD__ : 'unknown';

const DEFAULT_TOGGLES: Toggles = {
  betting: true,
  trading: true,
  casualEvents: false,
};

export function Title() {
  const { newSeason, resume, hasSave, error, openLobby } = useGame();
  // ONLINE_PLAN §6 item 7: without a rooms server in the build, there is no way online at all.
  const [online] = useState(() => roomsUrl() !== null);
  /**
   * A shared season link (lib/seedLink.ts), read once. It *fills this screen in* — it does not
   * start a season and it does not touch the save, so opening someone's link in a tab where a
   * season is half-played costs nothing until Start is pressed.
   */
  const [shared] = useState(() =>
    parseSeasonLink(typeof window === 'undefined' ? '' : window.location.search),
  );
  const [seed, setSeed] = useState(() => shared?.seed ?? randomSeed());
  const [roster, setRoster] = useState<PlayerSetup[]>(() =>
    shared && shared.players.length ? shared.players : defaultRoster(),
  );
  const [toggles, setToggles] = useState<Toggles>(() => ({
    ...DEFAULT_TOGGLES,
    ...shared?.toggles,
  }));

  // GDD_V3 §2.1: one to five seasons, or a race to a target. The default is one season.
  const [length, setLength] = useState<GameLength>(
    () => shared?.length ?? { kind: 'seasons', seasons: 1 },
  );

  const update = (i: number, patch: Partial<PlayerSetup>) =>
    setRoster((r) => r.map((p, j) => (i === j ? { ...p, ...patch } : p)));

  // Phase I: a human's face is their saddle-cloth colour. Every row's colour is resolved here, picks
  // first, and passed explicitly, so a human's pick beats an AI's seat colour (lib/owners.ts).
  const colours = resolveColours(roster);
  const [picking, setPicking] = useState<number | null>(null);
  const rowName = (p: PlayerSetup, i: number) => p.name.trim() || `Stable ${i + 1}`;

  const humans = roster.filter((p) => p.kind === 'human').length;
  const canStart = roster.length >= 1 && roster.length <= MAX_STABLES && humans >= 1;

  const start = () =>
    newSeason({
      seed,
      toggles,
      length,
      players: roster.map((p, i) => ({
        ...p,
        name: p.name.trim() || (p.kind === 'human' ? `Stable ${i + 1}` : ''),
        colour: colours[i],
      })),
    });

  /**
   * Phase P (P1): the new player's path is one press. **Play** is the Title's own default table — you
   * against five Normal AIs, one season, a fresh seed, the default toggles — whatever the custom form
   * below says, so a returning player's edits there never surprise a quick game.
   */
  const quick = () => {
    const table = defaultRoster();
    const faces = resolveColours(table);
    newSeason({
      seed: randomSeed(),
      toggles: DEFAULT_TOGGLES,
      length: { kind: 'seasons', seasons: 1 },
      players: table.map((p, i) => ({ ...p, colour: faces[i] })),
    });
  };
  // A shared link fills the custom game in, so it opens with the form showing.
  const [custom, setCustom] = useState(() => !!shared);

  return (
    <div className="app">
      <div className="centre">
        <h1>Space Dog Racing</h1>
        <p className="muted tagline">
          Race a kennel of space greyhounds round the grimy underground circuit. Richest stable
          wins.
        </p>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="title-start centre">
        <div className="row centre">
          {hasSave ? (
            <NeonButton variant="primary" className="big" onClick={resume}>
              Resume season
            </NeonButton>
          ) : null}
          <NeonButton variant={hasSave ? 'default' : 'primary'} className="big" onClick={quick}>
            Play
          </NeonButton>
          {online ? (
            <NeonButton className="big" onClick={() => openLobby(true)}>
              Play online
            </NeonButton>
          ) : null}
        </div>
        <p className="muted">
          You against five AI stables, one season.
          {hasSave ? ' Play starts a new game in place of the saved one.' : ''}
        </p>
        <NeonButton variant="link" aria-expanded={custom} onClick={() => setCustom(!custom)}>
          {custom ? 'Custom game ▾' : 'Custom game ▸'}
        </NeonButton>
      </div>

      {custom && shared ? (
        <div className="notice">
          Somebody shared <b>seed {shared.seed}</b> with you
          {shared.players.length ? ` and a table of ${shared.players.length}` : ''}
          {shared.players.some((p) => p.colour !== undefined) ? ', faces and all' : ''}. It is
          filled in below — press <b>Start season</b> when you are ready.
          {hasSave ? ' Starting it will replace the season you have saved.' : ''}
        </div>
      ) : null}

      {custom ? (
        <>
          <Panel
            title="Custom game"
            sub="hotseat: any mix of human and AI stables"
            actions={
              <NeonButton variant="primary" disabled={!canStart} onClick={start}>
                Start season
              </NeonButton>
            }
          >
            <div className="row gap-b">
              <label>
                Seed{' '}
                <input
                  type="number"
                  value={seed}
                  className="seed"
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                />
              </label>
              <NeonButton onClick={() => setSeed(randomSeed())}>Roll a new seed</NeonButton>
              <span className="muted">Same seed + same choices = the same game.</span>
            </div>

            <GameLengthPicker length={length} setLength={setLength} />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Stable</th>
                    <th>Played by</th>
                    <th>Difficulty</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p, i) => (
                    <Fragment key={i}>
                      <tr>
                        <td>
                          {p.kind === 'human' ? (
                            <FaceButton
                              colour={colours[i]!}
                              open={picking === i}
                              onClick={() => setPicking(picking === i ? null : i)}
                            />
                          ) : (
                            <Swatch colour={colours[i]!} />
                          )}
                        </td>
                        <td>
                          <input
                            value={p.name}
                            placeholder={
                              p.kind === 'ai' ? '(random stable name)' : `Stable ${i + 1}`
                            }
                            onChange={(e) => update(i, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            value={p.kind}
                            onChange={(e) => {
                              // A pick belongs to a human row; a row that changes hands starts unpicked.
                              update(i, {
                                kind: e.target.value as PlayerSetup['kind'],
                                colour: undefined,
                              });
                              if (picking === i) setPicking(null);
                            }}
                          >
                            <option value="human">Human</option>
                            <option value="ai">AI</option>
                          </select>
                        </td>
                        <td>
                          {p.kind === 'ai' ? (
                            <select
                              value={p.difficulty ?? 'normal'}
                              onChange={(e) =>
                                update(i, { difficulty: e.target.value as Difficulty })
                              }
                            >
                              <option value="easy">Easy</option>
                              <option value="normal">Normal</option>
                              <option value="hard">Hard</option>
                            </select>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <NeonButton
                            variant="link"
                            disabled={roster.length <= 1}
                            onClick={() => {
                              setRoster((r) => r.filter((_, j) => j !== i));
                              setPicking(null);
                            }}
                          >
                            remove
                          </NeonButton>
                        </td>
                      </tr>
                      {picking === i && p.kind === 'human' ? (
                        <tr className="face-picker-row">
                          <td colSpan={5}>
                            <FacePicker
                              who={rowName(p, i)}
                              current={colours[i]!}
                              takenBy={(c) => {
                                const j = roster.findIndex(
                                  (q, k) => k !== i && q.kind === 'human' && colours[k] === c,
                                );
                                return j >= 0 ? rowName(roster[j]!, j) : null;
                              }}
                              onPick={(c) => update(i, { colour: c })}
                              onClose={() => setPicking(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row gap-t">
              <NeonButton
                disabled={roster.length >= MAX_STABLES}
                onClick={() =>
                  setRoster((r) => [
                    ...r,
                    { name: '', kind: 'ai', difficulty: 'normal' as Difficulty },
                  ])
                }
              >
                Add stable
              </NeonButton>
              <span className="muted">
                {roster.length} stables, {humans} human. Two or more humans share this screen,
                hotseat.
              </span>
            </div>
            {!canStart ? <p className="muted">A season needs at least one human stable.</p> : null}
          </Panel>

          <Panel title="Toggles" sub="part of the game: a shared seed needs the same ones">
            <div className="grid2">
              <Toggle
                on={!toggles.betting}
                set={(v) => setToggles((t) => ({ ...t, betting: !v }))}
                label="No Betting"
                blurb="The bookie never opens."
              />
              <Toggle
                on={!toggles.trading}
                set={(v) => setToggles((t) => ({ ...t, trading: !v }))}
                label="No Trading"
                blurb="The market is shut; your dogs eat Grey Mash at the gate."
              />
              <Toggle
                on={toggles.casualEvents}
                set={(v) => setToggles((t) => ({ ...t, casualEvents: v }))}
                label="Casual events"
                blurb="Drops the big-swing event cards."
              />
            </div>
          </Panel>
        </>
      ) : null}

      {/* Phase M named the build here, so a screenshot says which build it is. */}
      <p className="muted small centre">build {BUILD}</p>
    </div>
  );
}

/**
 * GDD_V3 §2.1: how long the game is. Seasons, or a target net worth — the two suggestions are sheet
 * cells (`targetShort`, `targetLong`), and any other figure can be typed in.
 */
export function GameLengthPicker({
  length,
  setLength,
}: {
  length: GameLength;
  setLength: (l: GameLength) => void;
}) {
  const seasons = Array.from(
    { length: balance.gameSeasonsMax - balance.gameSeasonsMin + 1 },
    (_, i) => balance.gameSeasonsMin + i,
  );
  const suggested = [balance.targetShort, balance.targetLong];
  const value =
    length.kind === 'seasons'
      ? `s${length.seasons}`
      : suggested.includes(length.worth)
        ? `t${length.worth}`
        : 'custom';
  const pick = (v: string) => {
    if (v.startsWith('s')) setLength({ kind: 'seasons', seasons: Number(v.slice(1)) });
    else if (v.startsWith('t')) setLength({ kind: 'target', worth: Number(v.slice(1)) });
    else setLength({ kind: 'target', worth: length.kind === 'target' ? length.worth : 100_000 });
  };
  return (
    <div className="row gap-b">
      <label>
        Game length{' '}
        <select value={value} onChange={(e) => pick(e.target.value)}>
          {seasons.map((n) => (
            <option key={n} value={`s${n}`}>
              {n} season{n === 1 ? '' : 's'}
            </option>
          ))}
          <option value={`t${balance.targetShort}`}>
            Race to {formatBones(balance.targetShort)} — a short game
          </option>
          <option value={`t${balance.targetLong}`}>
            Race to {formatBones(balance.targetLong)} — a long game
          </option>
          <option value="custom">Race to a figure of your own…</option>
        </select>
      </label>
      {value === 'custom' && length.kind === 'target' ? (
        <label>
          Target{' '}
          <input
            type="number"
            className="seed"
            min={1}
            step={5000}
            value={length.worth}
            onChange={(e) =>
              setLength({
                kind: 'target',
                worth: Math.max(1, Math.round(Number(e.target.value) || 0)),
              })
            }
          />
        </label>
      ) : null}
      <span className="muted">
        {length.kind === 'seasons'
          ? length.seasons === 1
            ? 'Ten weekends; the richest stable wins.'
            : 'Ten weekends a season, with an off-season draft between.'
          : `The weekend anybody's net worth passes it is the last; the richest stable then wins. At most ${balance.targetSeasonCap} seasons.`}
      </span>
    </div>
  );
}

function Toggle({
  on,
  set,
  label,
  blurb,
}: {
  on: boolean;
  set: (v: boolean) => void;
  label: string;
  blurb: string;
}) {
  return (
    <label className="shop-row toggle">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="what">
        <b>{label}</b>
        <span className="muted">{blurb}</span>
      </span>
    </label>
  );
}

/** A human row's face on the roster: the portrait in its saddle-cloth colour, and the picker's toggle. */
export function FaceButton({
  colour,
  open,
  onClick,
}: {
  colour: number;
  open: boolean;
  onClick: () => void;
}) {
  const face = HUMAN_FACES[colour % 8]!;
  const art = portraitArt(humanFaceStem(colour));
  return (
    <button
      type="button"
      className="face-pick"
      data-face-trigger
      aria-expanded={open}
      aria-label={`Face: ${face.colour} — ${face.who}. Change face`}
      title="Pick your face"
      onClick={onClick}
    >
      {art && !art.placeholder ? <img src={art.url} alt="" decoding="async" /> : null}
      <Swatch colour={colour} />
    </button>
  );
}

/**
 * Phase I: the eight human faces. Picking one sets the row's colour. A face another human holds is
 * shown taken, `aria-disabled`, and names whose it is. The twelve painted owners are not offered:
 * they are the AI stables' identities.
 */
export function FacePicker({
  who,
  current,
  takenBy,
  onPick,
  onClose,
}: {
  who: string;
  current: number;
  takenBy: (colour: number) => string | null;
  onPick: (colour: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, []);
  const close = () => {
    const trigger = ref.current
      ?.closest('tr')
      ?.previousElementSibling?.querySelector<HTMLButtonElement>('[data-face-trigger]');
    onClose();
    trigger?.focus();
  };
  return (
    <div
      ref={ref}
      className="face-picker"
      role="group"
      aria-label={`Choose a face for ${who}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="face-grid">
        {HUMAN_FACES.map((f, c) => {
          const holder = takenBy(c);
          const mine = c === current;
          const art = portraitArt(humanFaceStem(c));
          const label = `${f.colour} — ${f.who}${mine ? ', your face' : ''}${holder ? `, taken by ${holder}` : ''}`;
          return (
            <button
              key={c}
              type="button"
              className={`face-choice${mine ? ' mine' : ''}${holder ? ' taken' : ''}`}
              aria-pressed={mine}
              aria-disabled={holder ? true : undefined}
              aria-label={label}
              title={label}
              onClick={() => {
                if (holder) return;
                onPick(c);
                close();
              }}
            >
              {art && !art.placeholder ? <img src={art.url} alt="" decoding="async" /> : null}
              <span className="face-cap">
                <Swatch colour={c} />
                {f.colour}
              </span>
              {holder ? <span className="face-taken">{holder}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="muted flush">
        Your face wears your saddle-cloth colour. A face another human has picked is taken.
      </p>
    </div>
  );
}
