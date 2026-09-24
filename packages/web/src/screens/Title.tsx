import { useState } from 'react';
import { balance, formatBones } from '@sdr/engine';
import type { Difficulty, GameLength, PlayerSetup, Toggles } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Notes, Swatch } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { parseSeasonLink } from '../lib/seedLink';
import { useGame } from '../store/gameStore';

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

const DEFAULT_TOGGLES: Toggles = {
  betting: true,
  trading: true,
  casualEvents: false,
};

export function Title() {
  const { newSeason, resume, hasSave, error } = useGame();
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
      })),
    });

  return (
    <div className="app">
      <div className="centre">
        <h1>Space Dog Racing</h1>
        <p className="muted tagline">
          Ten weekends a season on the grimy underground circuit — one season, five, or race to a
          fortune. Richest stable at the end wins.
        </p>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      {shared ? (
        <div className="notice">
          Somebody shared <b>seed {shared.seed}</b> with you
          {shared.players.length ? ` and a table of ${shared.players.length}` : ''}. It is filled in
          below — press <b>Start season</b> when you are ready.
          {hasSave ? ' Starting it will replace the season you have saved.' : ''}
        </div>
      ) : null}

      {hasSave ? (
        <Panel title="Saved season" sub="the seed and the action log, replayed">
          <div className="row">
            <NeonButton variant="primary" onClick={resume}>
              Resume season
            </NeonButton>
            <span className="muted">Picks up exactly where the last save left off.</span>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="New season"
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
          <span className="muted">Same seed + same choices = the same season, on any machine.</span>
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
                <tr key={i}>
                  <td>
                    <Swatch colour={i} />
                  </td>
                  <td>
                    <input
                      value={p.name}
                      placeholder={p.kind === 'ai' ? '(random stable name)' : `Stable ${i + 1}`}
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={p.kind}
                      onChange={(e) => update(i, { kind: e.target.value as PlayerSetup['kind'] })}
                    >
                      <option value="human">Human</option>
                      <option value="ai">AI</option>
                    </select>
                  </td>
                  <td>
                    {p.kind === 'ai' ? (
                      <select
                        value={p.difficulty ?? 'normal'}
                        onChange={(e) => update(i, { difficulty: e.target.value as Difficulty })}
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
                      onClick={() => setRoster((r) => r.filter((_, j) => j !== i))}
                    >
                      remove
                    </NeonButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row gap-t">
          <NeonButton
            disabled={roster.length >= MAX_STABLES}
            onClick={() =>
              setRoster((r) => [...r, { name: '', kind: 'ai', difficulty: 'normal' as Difficulty }])
            }
          >
            Add stable
          </NeonButton>
          <span className="muted">
            {roster.length} stables, {humans} human. Easy leaves half the card to the locals; Hard
            buys gear, prices its own runners and doses where it pays.
          </span>
        </div>
        {!canStart ? <p className="muted">A season needs at least one human stable.</p> : null}
      </Panel>

      <Panel
        title="Complexity toggles"
        sub="GDD §13 — Gazillionaire-style, set before the season starts"
      >
        <div className="grid2">
          <Toggle
            on={!toggles.betting}
            set={(v) => setToggles((t) => ({ ...t, betting: !v }))}
            label="No Betting"
            blurb="The bookie never opens; prize money and trading only."
          />
          <Toggle
            on={!toggles.trading}
            set={(v) => setToggles((t) => ({ ...t, trading: !v }))}
            label="No Trading"
            blurb="The market is shut. Your dogs still eat: Grey Mash, at the local price, at the gate."
          />
          <Toggle
            on={toggles.casualEvents}
            set={(v) => setToggles((t) => ({ ...t, casualEvents: v }))}
            label="Casual events"
            blurb="Drops the big-swing event cards; the flavour and small choices stay."
          />
        </div>
        <Notes
          lines={[
            'Toggles are part of the season, so a shared seed only replays the same way with the same toggles.',
          ]}
        />
      </Panel>

      <Panel title="What is in this build" sub="v3 Phase E1 — the game's shape">
        <p className="muted flush">
          One to five ten-week seasons, or a race to a target, against Easy, Normal and Hard
          stables: three dealt dogs, Explore&apos;s three doors, trainers on commission, the
          six-food market that is also your dogs&apos; training, three purse tiers, the bookie, and
          an off-season between seasons. Every screen is painted to the art bible and every planet
          tints its own chrome. Most of the pictures are still stand-ins — hatched slots labelled
          &ldquo;placeholder&rdquo; — because 11 of the 149 files in the art library are real so
          far.
        </p>
      </Panel>
    </div>
  );
}

/**
 * GDD_V3 §2.1: how long the game is. Seasons, or a target net worth — the two suggestions are sheet
 * cells (`targetShort`, `targetLong`), and any other figure can be typed in.
 */
function GameLengthPicker({
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
            : `Ten weekends a season, with an off-season between: a year older, one retirement, the staff notice.`
          : `Net worth is checked at the end of every weekend. The first weekend anybody is past it is the last one, and the richest stable then wins — two can cross together, and a leader can be caught on the last weekend. At most ${balance.targetSeasonCap} seasons.`}
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
