import { useState } from 'react';
import { formatBones, netWorth, runSeason, type GameState } from '@sdr/engine';

/**
 * M0 shell: proves the engine bundles for the browser by running a headless season.
 * The real screens arrive in M1.
 */
export function App() {
  const [seed, setSeed] = useState(42);
  const [state, setState] = useState<GameState | null>(null);
  const [ms, setMs] = useState(0);

  const run = () => {
    const t0 = performance.now();
    const { state: s } = runSeason({
      seed,
      players: Array.from({ length: 6 }, () => ({
        name: '',
        kind: 'ai' as const,
        difficulty: 'normal' as const,
      })),
    });
    setMs(performance.now() - t0);
    setState(s);
  };

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: 'var(--acid)', fontFamily: 'Bungee, Impact, sans-serif' }}>
        Space Dog Racing
      </h1>
      <p style={{ color: 'var(--hazard)' }}>Milestone M0 — engine only. The game arrives in M1.</p>
      <label>
        Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
      </label>{' '}
      <button
        onClick={run}
        style={{ background: 'var(--pink)', border: 0, padding: '0.4rem 1rem', color: '#000' }}
      >
        Simulate a season (6 Normal AIs)
      </button>
      {state && (
        <section>
          <p>
            Season {state.seed} simulated in {ms.toFixed(0)} ms.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--cyan)', textAlign: 'left' }}>
                <th>#</th>
                <th>Stable</th>
                <th>Cash</th>
                <th>Dogs</th>
                <th>Net worth</th>
              </tr>
            </thead>
            <tbody>
              {(state.finalStandings ?? []).map((row, i) => {
                const p = state.players.find((x) => x.id === row.playerId)!;
                return (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>{formatBones(p.cash)}</td>
                    <td>
                      {p.dogIds
                        .map((id) => `${state.dogs[id]?.name} (${state.dogs[id]?.rating})`)
                        .join(', ')}
                    </td>
                    <td>{formatBones(netWorth(state, p))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
