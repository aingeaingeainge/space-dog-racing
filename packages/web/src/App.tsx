import { useEffect, type ReactNode } from 'react';
import { bucketOf } from './lib/pace';
import { EventModal } from './components/EventModal';
import { LeaderboardOverlay } from './components/LeaderboardOverlay';
import { Nav } from './components/Nav';
import { PassTo } from './components/PassTo';
import { TopBar } from './components/TopBar';
import { Bookie } from './screens/Bookie';
import { Explore } from './screens/Explore';
import { GalaxyMap } from './screens/GalaxyMap';
import { LockedField } from './screens/LockedField';
import { Market } from './screens/Market';
import { OffSeason } from './screens/OffSeason';
import { PlanetHub } from './screens/PlanetHub';
import { RaceView } from './screens/RaceView';
import { RaceOffice } from './screens/RaceOffice';
import { Results } from './screens/Results';
import { SeasonEnd } from './screens/SeasonEnd';
import { Stable } from './screens/Stable';
import { AfterRaces, Arrival, Board } from './screens/Table';
import { Title } from './screens/Title';
import { Lobby } from './screens/Lobby';
import { Waiting } from './screens/Waiting';
import { AwaySeats, ConnectionStrip, ReloadStrip, WaitingLine } from './components/OnlineTable';
import { blip, flashTitle } from './lib/nudge';
import { roomFromUrl, roomsUrl } from './store/online';
import { PlanetTheme } from './theme/planetTheme';
import { screenFor, weekKey } from './store/loop';
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
  const racesWatchedWeek = useGame((g) => g.racesWatchedWeek);
  const resultsSeenWeek = useGame((g) => g.resultsSeenWeek);
  const fieldsSeenWeek = useGame((g) => g.fieldsSeenWeek);
  const passAck = useGame((g) => g.passAck);
  const bustAck = useGame((g) => g.bustAck);
  const seasonSeen = useGame((g) => g.seasonSeen);
  const arrivalSeenWeek = useGame((g) => g.arrivalSeenWeek);
  const boardSeenWeek = useGame((g) => g.boardSeenWeek);
  const postTrade = useGame((g) => g.postTrade);
  const error = useGame((g) => g.error);
  const clearError = useGame((g) => g.clearError);
  const markPace = useGame((g) => g.markPace);
  // Online (ONLINE_PLAN §6). All of it is inert in hotseat: `source` is 'local' and nothing below
  // that reads these changes what a hotseat table sees.
  const source = useGame((g) => g.source);
  const lobbyOpen = useGame((g) => g.lobbyOpen);
  const seat = useGame((g) => g.seat);
  const meta = useGame((g) => g.meta);
  const code = useGame((g) => g.code);
  const nudged = useGame((g) => g.nudged);
  const ackNudge = useGame((g) => g.ackNudge);
  const joinRoom = useGame((g) => g.joinRoom);
  const online = source === 'online' && seat ? { seat, meta } : undefined;

  // `?room=KFZQPX` opens the join straight away (§5.5): a browser holding the room's token goes
  // straight back into its seat. Only in a build that has a rooms server.
  useEffect(() => {
    if (!roomsUrl()) return;
    const room = roomFromUrl(window.location.search);
    if (room && useGame.getState().source !== 'online') joinRoom(room);
  }, [joinRoom]);
  // …and the address bar carries the room while this browser is in one, so a refresh comes back.
  useEffect(() => {
    if (!roomsUrl()) return;
    try {
      const url = new URL(window.location.href);
      const want = source === 'online' && code ? code : null;
      if (url.searchParams.get('room') === want) return;
      if (want) url.search = `?room=${want}`;
      else url.searchParams.delete('room');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // An address bar that cannot be written: the room still plays.
    }
  }, [source, code]);
  // A nudge (§5.1): a short sound, and the tab's title flashing until the window has focus.
  useEffect(() => {
    if (!nudged) return;
    blip();
    return flashTitle(`★ ${nudged.by} nudged you`, ackNudge);
  }, [nudged, ackNudge]);

  // Phase E2's pace timer. Every change of screen kind (or of weekend) closes one timed stretch and
  // opens the next; a hidden window stops the clock. UI only — nothing here reaches the engine.
  const screenNow = state
    ? screenFor(
        state,
        {
          racesWatchedWeek,
          resultsSeenWeek,
          fieldsSeenWeek,
          passAck,
          bustAck,
          seasonSeen,
          arrivalSeenWeek,
          boardSeenWeek,
          postTrade,
        },
        online,
      ).kind
    : null;
  const bucket =
    !state || !screenNow
      ? null
      : screenNow === 'seasonEnd'
        ? state.phase === 'offSeason'
          ? 'between'
          : null
        : bucketOf(screenNow);
  const paceKey = state ? weekKey(state) : 0;
  useEffect(() => {
    markPace(bucket, paceKey);
  }, [bucket, paceKey, markPace]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) markPace(null, paceKey);
      else markPace(bucket, paceKey);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [bucket, paceKey, markPace]);

  if (!state) {
    if (source === 'online' || lobbyOpen)
      return (
        <PlanetTheme>
          <Lobby />
          <ConnectionStrip />
          <ReloadStrip />
        </PlanetTheme>
      );
    return (
      <PlanetTheme>
        <Title />
      </PlanetTheme>
    );
  }

  // Every screen sits inside the planet's two accent hues (GDD §16). The wrapper reads them
  // from Planet.accents, so a screen never knows which rock it is on and a new planet tints
  // the whole game from its data row alone.
  const planetId = state.calendar[state.week - 1]?.planetId ?? null;
  const screen = screenFor(
    state,
    {
      racesWatchedWeek,
      resultsSeenWeek,
      fieldsSeenWeek,
      passAck,
      bustAck,
      seasonSeen,
      arrivalSeenWeek,
      boardSeenWeek,
      postTrade,
    },
    online,
  );

  // Online, the connection and reload strips float over every screen, the race view's included.
  const wrap = (node: ReactNode) => (
    <PlanetTheme planetId={planetId}>
      {online ? (
        <>
          {node}
          <ConnectionStrip />
          <ReloadStrip />
        </>
      ) : (
        node
      )}
    </PlanetTheme>
  );

  if (screen.kind === 'seasonEnd') return wrap(<SeasonEnd s={state} />);
  if (screen.kind === 'noHuman' || !screen.me) {
    return wrap(
      <div className="app">
        <div className="notice error">
          This season has no human stable left to play it. Start a new one.
        </div>
      </div>,
    );
  }
  const me = screen.me;
  if (screen.kind === 'race') return wrap(<RaceView s={state} me={me} />);
  if (screen.kind === 'fields')
    return wrap(
      <>
        <TopBar s={state} me={me} />
        <div className="app">
          <LockedField s={state} me={me} />
        </div>
      </>,
    );
  if (screen.kind === 'results') return wrap(<Results s={state} me={me} />);
  if (screen.kind === 'pass') return wrap(<PassTo s={state} next={me} />);
  // Phase E2: a hotseat table's public moments — read together, passed to nobody.
  if (screen.kind === 'arrival') return wrap(<Arrival s={state} me={me} />);
  if (screen.kind === 'board') return wrap(<Board s={state} me={me} />);
  if (screen.kind === 'afterRaces') return wrap(<AfterRaces s={state} me={me} />);

  const s = state;
  const inTurn = s.phase === 'planetPre' || s.phase === 'planetPost';

  /** The venue the player picked, falling back to the hub when it is shut. */
  function venue() {
    if (view === 'stable') return <Stable s={s} me={me} />;
    if (view === 'map') return <GalaxyMap s={s} me={me} />;
    if (view === 'office' && s.phase === 'planetPre') return <RaceOffice s={s} me={me} />;
    if (inTurn && view === 'market') return <Market s={s} me={me} />;
    return <PlanetHub s={s} me={me} />;
  }

  return wrap(
    <>
      <TopBar s={s} me={me} />
      {online ? (
        <>
          {!online.meta?.clock.seats.includes(me.id) ? <WaitingLine s={s} me={me} /> : null}
          <AwaySeats s={s} me={me} />
        </>
      ) : null}
      <div className="app">
        {online && nudged ? (
          <div className="notice nudge" onClick={ackNudge}>
            <b>{nudged.by}</b> nudged you — the table is waiting.{' '}
            <span className="muted">(click to dismiss)</span>
          </div>
        ) : null}
        {error ? (
          <div className="notice error" onClick={clearError}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        ) : null}

        {screen.kind === 'offSeason' ? (
          <OffSeason s={s} me={me} />
        ) : screen.kind === 'explore' ? (
          <Explore s={s} me={me} />
        ) : screen.kind === 'betting' ? (
          <Bookie s={s} me={me} />
        ) : screen.kind === 'waiting' ? (
          <Waiting s={s} me={me} />
        ) : (
          <>
            {inTurn ? <Nav s={s} me={me} /> : null}
            {venue()}
          </>
        )}
      </div>
      {s.pendingEvent ? <EventModal s={s} /> : null}
      {leaderboard ? <LeaderboardOverlay s={s} meId={me.id} /> : null}
    </>,
  );
}
