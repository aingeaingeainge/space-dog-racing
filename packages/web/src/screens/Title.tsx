import { useState } from 'react';
import type { Difficulty, PlayerSetup, Toggles } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Notes, Swatch } from '../components/ui';
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

export function Title() {
  const { newSeason, resume, hasSave, error } = useGame();
  const [seed, setSeed] = useState(randomSeed);
  const [roster, setRoster] = useState<PlayerSetup[]>(defaultRoster);
  const [toggles, setToggles] = useState<Toggles>({
    cleanSport: false,
    betting: true,
    trading: true,
    casualEvents: false,
  });

  const update = (i: number, patch: Partial<PlayerSetup>) =>
    setRoster((r) => r.map((p, j) => (i === j ? { ...p, ...patch } : p)));

  const humans = roster.filter((p) => p.kind === 'human').length;
  const canStart = roster.length >= 1 && roster.length <= MAX_STABLES && humans >= 1;

  const start = () =>
    newSeason({
      seed,
      toggles,
      players: roster.map((p, i) => ({
        ...p,
        name: p.name.trim() || (p.kind === 'human' ? `Stable ${i + 1}` : ''),
      })),
    });

  return (
    <div className="app">
      <div className="centre">
        <h1>Space Dog Racing</h1>
        <p className="muted">
          Thirteen weekends on the grimy underground circuit. Richest stable at the Galactic Collar
          wins.
        </p>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      {hasSave ? (
        <Panel title="Saved season" sub="the seed and the action log, replayed">
          <div className="row">
            <button className="primary" onClick={resume}>
              Resume season
            </button>
            <span className="muted">Picks up exactly where the last save left off.</span>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="New season"
        sub="hotseat: any mix of human and AI stables"
        actions={
          <button className="primary" disabled={!canStart} onClick={start}>
            Start season
          </button>
        }
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <label>
            Seed{' '}
            <input
              type="number"
              value={seed}
              style={{ width: 120 }}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
            />
          </label>
          <button onClick={() => setSeed(randomSeed())}>Roll a new seed</button>
          <span className="muted">Same seed + same choices = the same season, on any machine.</span>
        </div>

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
                    <button
                      className="link"
                      disabled={roster.length <= 1}
                      onClick={() => setRoster((r) => r.filter((_, j) => j !== i))}
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            disabled={roster.length >= MAX_STABLES}
            onClick={() =>
              setRoster((r) => [...r, { name: '', kind: 'ai', difficulty: 'normal' as Difficulty }])
            }
          >
            Add stable
          </button>
          <span className="muted">
            {roster.length} stables, {humans} human. Easy and Hard play as Normal until M4.
          </span>
        </div>
        {!canStart ? <p className="muted">A season needs at least one human stable.</p> : null}
      </Panel>

      <Panel title="Complexity toggles" sub="GDD §13 — Gazillionaire-style, set before the season starts">
        <div className="grid2">
          <Toggle
            on={toggles.cleanSport}
            set={(v) => setToggles((t) => ({ ...t, cleanSport: v }))}
            label="Clean Sport"
            blurb="No supplements, no fixers, no sabotage or steward bribes."
          />
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
            blurb="No kibble trade. Your dogs still eat: you pay the local price at the gate."
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

      <Panel title="What is in this build" sub="milestone M1, session 2">
        <p className="muted" style={{ margin: 0 }}>
          A whole 13-week season: declarations, races, results, events, the leaderboard, and every
          venue on the planet — Market, Kennels, Docks, Saloon, Bookie and Race Office. The race
          view and the art arrive in M2 and M3.
        </p>
      </Panel>
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
    <label className="shop-row" style={{ alignItems: 'flex-start' }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="what">
        <b>{label}</b>
        <span className="muted">{blurb}</span>
      </span>
    </label>
  );
}
