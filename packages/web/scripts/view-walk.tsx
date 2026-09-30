/**
 * v3 Phase L1 (ONLINE_PLAN §10, L1's third row): **every seat's view, through every screen**.
 *
 * Online, a browser holds `viewFor(state, seat)` and never the state (GDD_V3 V24), and every screen
 * reads the view exactly as it reads a state. This walks a two-season table of four humans and two
 * AIs — the humans played by the stand-in, `decide(…, 'normal')`, so the game is full of the secrets a
 * view cuts (doors, cards, bets, nobbles, tips; the draft since Phase N, which is public) — and at every moment the table
 * could be looking at (each change of week, phase, seat on the clock or card) server-renders every
 * screen and component for every human seat from that seat's view.
 *
 * A render that throws from the view is counted **only if the same screen renders from the whole
 * state**: some screens are not meant for some phases, and the question is what the view breaks, not
 * what a screen does out of place. Target: **0**.
 *
 * Also counted, and reported rather than failed: the screens that read a dark week's planet
 * (`GalaxyMap`'s `planetOf` on every week — ONLINE_PLAN §6 item 4, a one-line move in L3).
 *
 *   npm run view-walk
 *
 * It needs Vite (for the art's `import.meta.glob`), so it runs under `vite-node`, not `tsx`.
 */
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';
import {
  createSeason,
  decide,
  isSeasonOver,
  needsAdvance,
  player,
  reduceMut,
  viewFor,
  waitingOn,
  type GameState,
  type Player,
  type SeasonSetup,
} from '@sdr/engine';
import { Bookie } from '../src/screens/Bookie';
import { Explore } from '../src/screens/Explore';
import { GalaxyMap } from '../src/screens/GalaxyMap';
import { LockedField } from '../src/screens/LockedField';
import { Market } from '../src/screens/Market';
import { Draft } from '../src/screens/Draft';
import { PlanetHub } from '../src/screens/PlanetHub';
import { RaceOffice } from '../src/screens/RaceOffice';
import { RaceView } from '../src/screens/RaceView';
import { Results } from '../src/screens/Results';
import { SeasonEnd } from '../src/screens/SeasonEnd';
import { Stable } from '../src/screens/Stable';
import { AfterRaces, Arrival, Board } from '../src/screens/Table';
import { TopBar } from '../src/components/TopBar';
import { Nav } from '../src/components/Nav';
import { EventModal } from '../src/components/EventModal';
import { LeaderboardOverlay } from '../src/components/LeaderboardOverlay';
import { rumours } from '../src/lib/rumours';

const SCREENS: Record<string, (s: GameState, me: Player) => ReactElement> = {
  TopBar: (s, me) => <TopBar s={s} me={me} />,
  Nav: (s, me) => <Nav s={s} me={me} />,
  PlanetHub: (s, me) => <PlanetHub s={s} me={me} />,
  Stable: (s, me) => <Stable s={s} me={me} />,
  GalaxyMap: (s, me) => <GalaxyMap s={s} me={me} />,
  Market: (s, me) => <Market s={s} me={me} />,
  RaceOffice: (s, me) => <RaceOffice s={s} me={me} />,
  Explore: (s, me) => <Explore s={s} me={me} />,
  EventModal: (s) => <EventModal s={s} />,
  Bookie: (s, me) => <Bookie s={s} me={me} />,
  LockedField: (s, me) => <LockedField s={s} me={me} />,
  RaceView: (s, me) => <RaceView s={s} me={me} />,
  Results: (s, me) => <Results s={s} me={me} />,
  Arrival: (s, me) => <Arrival s={s} me={me} />,
  Board: (s, me) => <Board s={s} me={me} />,
  AfterRaces: (s, me) => <AfterRaces s={s} me={me} />,
  Draft: (s, me) => <Draft s={s} me={me} />,
  LeaderboardOverlay: (s, me) => <LeaderboardOverlay s={s} meId={me.id} />,
  SeasonEnd: (s) => <SeasonEnd s={s} />,
};

const SETUP: SeasonSetup = {
  seed: 42,
  length: { kind: 'seasons', seasons: 2 },
  players: [
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Human ${i + 1}`, kind: 'human' as const })),
    { name: 'AI 1', kind: 'ai', difficulty: 'normal' },
    { name: 'AI 2', kind: 'ai', difficulty: 'hard' },
  ],
};

function tryRender(node: () => ReactElement): string | null {
  try {
    renderToString(node());
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// React logs a render error to the console before it throws; keep the output to the summary.
const quiet = console.error;
console.error = () => {};

const s = createSeason(SETUP);
const humans = s.players.filter((p) => p.kind === 'human').map((p) => p.id);
let lastKey = '';
let moments = 0;
let renders = 0;
let rendered = 0;
let rumourMismatch = 0;
const broken = new Map<string, { n: number; first: string }>();
const darkMap = new Set<string>();

function look(): void {
  const key = [s.season, s.week, s.phase, s.activePlayer, s.pendingEvent?.playerId, s.locked].join(
    '|',
  );
  if (key === lastKey) return;
  lastKey = key;
  moments++;
  for (const id of humans) {
    const v = viewFor(s, id);
    const meView = player(v, id);
    const meFull = player(s, id);
    if (JSON.stringify(rumours(v)) !== JSON.stringify(rumours(s))) rumourMismatch++;
    for (const [name, render] of Object.entries(SCREENS)) {
      renders++;
      const err = tryRender(() => render(v, meView));
      if (!err) {
        rendered++;
        continue;
      }
      if (tryRender(() => render(s, meFull))) continue; // the screen is out of place here anyway
      if (name === 'GalaxyMap' && /Unknown planet $/.test(err)) {
        darkMap.add(`${s.season}.${s.week}`);
        continue;
      }
      const k = `${name}: ${err}`;
      const b = broken.get(k) ?? { n: 0, first: key };
      b.n++;
      broken.set(k, b);
    }
  }
}

const t0 = Date.now();
while (!isSeasonOver(s)) {
  look();
  if (needsAdvance(s)) {
    reduceMut(s, { t: 'AdvancePhase' });
    continue;
  }
  const who = waitingOn(s)!;
  const p = player(s, who);
  for (const a of decide(s, who, p.kind === 'human' ? 'normal' : p.difficulty)) reduceMut(s, a);
}
look();
console.error = quiet;

console.log(
  `view walk: two seasons, 4 humans + 2 AIs (seed 42): ${moments} moments × ${humans.length} seats, ${renders} renders from a view (${rendered} drew a screen) in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
console.log(
  `  rumours from the view equal the hotseat's: ${rumourMismatch === 0 ? 'yes' : `NO (${rumourMismatch})`}`,
);
console.log(
  `  GalaxyMap reading a dark week's planet (L3's one-line move): ${darkMap.size} weekends`,
);
if (broken.size) {
  console.log(
    `  ✗ ${[...broken.values()].reduce((n, b) => n + b.n, 0)} throws that the whole state does not:`,
  );
  for (const [k, b] of broken) console.log(`    ${b.n}× ${k} (first at ${b.first})`);
  process.exit(1);
}
console.log('  ✓ 0 throws that the whole state does not');
