import { formatBones, planetOf, type GameState, type Player } from '@sdr/engine';
import { NeonButton } from './NeonButton';
import { useGame } from '../store/gameStore';

/** Always on screen: where we are, whose turn it is, and the way into the leaderboard. */
export function TopBar({ s, me }: { s: GameState; me: Player | null }) {
  const setLeaderboard = useGame((g) => g.setLeaderboard);
  const abandon = useGame((g) => g.abandon);
  const online = useGame((g) => g.source === 'online');
  const entry = s.calendar[s.week - 1];
  const planet = entry ? planetOf(entry.planetId) : null;

  return (
    <div className="topbar">
      <span className="brand">Space Dog Racing</span>
      <span className="stat">
        {s.season > 1 || s.length.kind === 'target' || s.length.seasons > 1 ? (
          <>
            Season <b>{s.season}</b>
            {s.length.kind === 'seasons' ? `/${s.length.seasons}` : ''} ·{' '}
          </>
        ) : null}
        Week <b>{s.week}</b>/{s.calendar.length}
        {planet ? (
          <>
            {' '}
            · <b>{planet.name}</b>
            {entry?.grandFinal ? (
              <span className="star"> ★ Grand Final</span>
            ) : entry?.major ? (
              <span className="star"> ★ Major</span>
            ) : null}
          </>
        ) : null}
      </span>
      {me ? (
        <span className="stat">
          <b>{me.name}</b> · {formatBones(me.cash)}
        </span>
      ) : null}
      <span className="spacer" />
      <NeonButton small onClick={() => setLeaderboard(true)}>
        Leaderboard
      </NeonButton>
      <NeonButton
        small
        variant="danger"
        onClick={() => {
          if (online) {
            if (confirm('Leave this room? The game goes on, and the link brings you back.'))
              abandon();
          } else if (confirm('Abandon this season? The save is deleted.')) abandon();
        }}
      >
        {online ? 'Leave' : 'Quit'}
      </NeonButton>
    </div>
  );
}
