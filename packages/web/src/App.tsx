import { EventModal } from './components/EventModal';
import { LeaderboardOverlay } from './components/LeaderboardOverlay';
import { Nav } from './components/Nav';
import { PassTo } from './components/PassTo';
import { TopBar } from './components/TopBar';
import { Bookie } from './screens/Bookie';
import { Docks } from './screens/Docks';
import { GalaxyMap } from './screens/GalaxyMap';
import { Market } from './screens/Market';
import { PlanetHub } from './screens/PlanetHub';
import { RaceOffice } from './screens/RaceOffice';
import { Results } from './screens/Results';
import { Saloon } from './screens/Saloon';
import { SeasonEnd } from './screens/SeasonEnd';
import { Stable } from './screens/Stable';
import { Title } from './screens/Title';
import { screenFor } from './store/loop';
import { useGame } from './store/gameStore';

/**
 * One human is on the clock at any moment: the store drives AI stables and system phases in
 * the engine, so whatever is on screen belongs to that player. `screenFor` decides which
 * screen that is — the same function a headless run of a whole season walks through.
 */
export function App() {
  const state = useGame((g) => g.state);
  const view = useGame((g) => g.view);
  const leaderboard = useGame((g) => g.leaderboard);
  const resultsSeenWeek = useGame((g) => g.resultsSeenWeek);
  const passAck = useGame((g) => g.passAck);
  const error = useGame((g) => g.error);
  const clearError = useGame((g) => g.clearError);

  if (!state) return <Title />;

  const screen = screenFor(state, { resultsSeenWeek, passAck });

  if (screen.kind === 'seasonEnd') return <SeasonEnd s={state} />;
  if (screen.kind === 'noHuman' || !screen.me) {
    return (
      <div className="app">
        <div className="notice error">
          This season has no human stable left to play it. Start a new one.
        </div>
      </div>
    );
  }
  const me = screen.me;
  if (screen.kind === 'results') return <Results s={state} me={me} />;
  if (screen.kind === 'pass') return <PassTo s={state} next={me} />;

  const s = state;
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';

  /** The venue the player picked, falling back to the hub when it is shut. */
  function venue() {
    if (view === 'stable') return <Stable s={s} me={me} />;
    if (view === 'map') return <GalaxyMap s={s} />;
    if (view === 'office' && s.phase === 'planetPre') return <RaceOffice s={s} me={me} />;
    if (inTurn && view === 'market') return <Market s={s} me={me} />;
    if (inTurn && view === 'docks') return <Docks s={s} me={me} />;
    if (inTurn && view === 'saloon') return <Saloon s={s} me={me} />;
    return <PlanetHub s={s} me={me} />;
  }

  return (
    <>
      <TopBar s={s} me={me} />
      <div className="app">
        {error ? (
          <div className="notice error" onClick={clearError}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        ) : null}

        {screen.kind === 'betting' ? (
          <Bookie s={s} me={me} />
        ) : (
          <>
            {inTurn ? <Nav s={s} me={me} /> : null}
            {venue()}
          </>
        )}
      </div>
      {s.pendingEvent ? <EventModal s={s} /> : null}
      {leaderboard ? <LeaderboardOverlay s={s} meId={me.id} /> : null}
    </>
  );
}
