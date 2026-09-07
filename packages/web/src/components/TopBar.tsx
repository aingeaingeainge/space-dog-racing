import { formatBones, planetOf, type GameState, type Player } from '@sdr/engine';
import { PHASE_LABEL } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/** Always on screen: where we are, whose turn it is, and the way into the leaderboard. */
export function TopBar({ s, me }: { s: GameState; me: Player | null }) {
  const setLeaderboard = useGame((g) => g.setLeaderboard);
  const abandon = useGame((g) => g.abandon);
  const entry = s.calendar[s.week - 1];
  const planet = entry ? planetOf(entry.planetId) : null;

  return (
    <div className="topbar">
      <span className="brand">Space Dog Racing</span>
      <span className="stat">
        Week <b>{s.week}</b>/{s.calendar.length}
        {planet ? (
          <>
            {' '}
            · <b>{planet.name}</b>
            {entry?.grandFinal ? ' ★ Grand Final' : entry?.major ? ' ★ Major' : ''}
          </>
        ) : null}
      </span>
      <span className="stat">{PHASE_LABEL[s.phase]}</span>
      {me ? (
        <span className="stat">
          <b>{me.name}</b> · {formatBones(me.cash)}
        </span>
      ) : null}
      <span className="spacer" />
      <button onClick={() => setLeaderboard(true)}>Leaderboard</button>
      <button
        className="danger"
        onClick={() => {
          if (confirm('Abandon this season? The save is deleted.')) abandon();
        }}
      >
        Quit
      </button>
    </div>
  );
}
