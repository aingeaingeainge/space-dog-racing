# Space Dog Racing — Build Plan

Companion to `GDD.md`. This is the *how*: architecture, repo layout, milestones, acceptance criteria, and a ready-to-paste prompt for each milestone to hand to Claude Opus (or whichever model builds it).

**Working assumption:** Jesse reviews and playtests between milestones; the builder model works one milestone per session with the GDD, this plan, and the spreadsheet in the repo. Nothing below assumes the builder remembers a previous session.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  UI  (React + TypeScript, Vite)                          │
│   screens/  components/  hooks/   ← reads state, sends   │
│   race-view/ (Canvas 2D renderer, replays tick logs)      │
│                                   actions               │
├──────────────────────────────────────────────────────────┤
│  Store  (Zustand)  holds GameState + action log + seed    │
├──────────────────────────────────────────────────────────┤
│  Engine  (pure TypeScript, zero DOM, zero React)         │
│   reduce(state, action, rng) → state'                    │
│   simulateRace(field, track, rng) → RaceResult + ticks   │
│   ai/ decide(state, playerId, difficulty, rng) → actions │
│   content/ planets, events, traits, names, balance.json  │
└──────────────────────────────────────────────────────────┘
```

Rules that make multiplayer cheap later:

1. **The engine is pure.** No `Math.random`, no `Date.now`, no imports from React or the DOM. Every random draw comes from an injected seeded PRNG (`mulberry32` or `xoshiro128**`). Same seed + same actions ⇒ identical season, on any machine.
2. **Everything is an action.** `BuyDog`, `SellDog`, `Declare`, `PlaceBet`, `HireStaff`, `TradeFood`, `EndPhase`, `ResolveEvent{choice}` … The action log plus the seed *is* the save file and *is* the multiplayer protocol.
3. **Races emit a tick log.** `simulateRace` returns per-tick positions; the renderer only replays. A server can send the log; a client can never disagree about who won.
4. **Balance numbers live in `balance.json`,** generated from the spreadsheet's Assumptions sheet (a small script keeps them in sync). Designers tune the sheet; the game reads the JSON.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | Everywhere, including tests and scripts |
| Build | Vite | Fast dev server, static output |
| UI | React 18 | Function components, no class components |
| State | Zustand | One store: `{ game: GameState, log: Action[], seed }` |
| Styling | CSS Modules + CSS variables | Theme tokens from the art bible; no Tailwind (keeps the grimy look bespoke) |
| Race view | Canvas 2D via a thin `useCanvas` hook | PixiJS only if perf demands (it won't for 8 sprites) |
| Tests | Vitest | Engine has ≥80% coverage; UI smoke tests only |
| Lint/format | ESLint + Prettier | Pre-commit via `lint-staged` |
| Hosting | Cloudflare Pages (Git-connected) | Build command `npm run build`, output `packages/web/dist`; every push to `main` deploys, every PR gets a preview URL |
| Multiplayer (M5) | Cloudflare Workers + Durable Objects (one object per game room), via PartyKit or raw | Same Cloudflare account as hosting; runs the same engine package server-side |

## 3. Repository layout

```
space-dog-racing/
├─ CLAUDE.md                 ← builder instructions (see §4)
├─ design/
│  ├─ GDD.md
│  ├─ BUILD_PLAN.md
│  ├─ space_dog_racing_economy.xlsx
│  └─ economy_sim.py         ← Python reference for the race sim
├─ packages/
│  ├─ engine/                ← pure TS, published internally as @sdr/engine
│  │  ├─ src/
│  │  │  ├─ types.ts         (GameState, Dog, Player, Planet, Action, …)
│  │  │  ├─ rng.ts           (seeded PRNG + helpers: pick, gauss, shuffle)
│  │  │  ├─ reduce.ts        (root reducer; dispatches to phases/*)
│  │  │  ├─ phases/          (arrival, events, planet, declarations, raceDay, endTurn)
│  │  │  ├─ race/            (simulateRace, interference, tickLog, odds)
│  │  │  ├─ economy/         (dogValue, netWorth, market, food, loans)
│  │  │  ├─ ai/              (easy.ts, normal.ts, hard.ts, shared heuristics)
│  │  │  ├─ content/         (planets.ts, events.ts, traits.ts, names.ts, balance.json)
│  │  │  └─ index.ts
│  │  ├─ test/               (vitest; golden-seed replay tests)
│  │  └─ scripts/
│  │     ├─ balance-from-xlsx.ts   (xlsx Assumptions → balance.json)
│  │     └─ harness.ts             (run N seasons headless, print stats)
│  └─ web/                   ← Vite React app
│     ├─ src/
│     │  ├─ store/           (zustand store, persistence)
│     │  ├─ screens/         (Title, GalaxyMap, PlanetHub, Stable, Market, Docks, RaceOffice, Bookie, RaceView, Leaderboard, SeasonEnd)
│     │  ├─ components/      (DogCard, StatBar, RaceCard, OddsChip, Panel, NeonButton, …)
│     │  ├─ race-view/       (renderer.ts, camera.ts, sprites.ts, commentary.ts)
│     │  ├─ theme/           (tokens.css, planet themes)
│     │  └─ assets/          (generated art; placeholders first)
│     └─ index.html
├─ .github/workflows/ci.yml       ← tests on push (deploys are Cloudflare's job)
├─ scripts/snapshot.mjs           ← dated local backup of the repo (see §7b)
├─ wrangler.toml                  ← M5: Workers/Durable Objects config
└─ package.json              (npm workspaces)
```

## 4. `CLAUDE.md` for the repo (paste as-is)

```markdown
# Space Dog Racing — builder notes

Read design/GDD.md and design/BUILD_PLAN.md before any change. The GDD is the source of truth for rules; the spreadsheet is the source of truth for numbers (packages/engine/src/content/balance.json is generated from it — never hand-edit).

## Non-negotiables
- packages/engine has no DOM, React, Date, or Math.random. All randomness via rng.ts. If you need a random number, thread the rng through.
- Every state change is an Action handled in reduce.ts. UI never mutates state directly.
- Same seed + same action log must reproduce the same season. test/golden.test.ts guards this; update the golden file only when a rule deliberately changes and say so in the commit.
- Races return a tick log; the renderer replays it and never re-simulates.
- Keep TypeScript strict; no `any` in engine.
- Run `npm test` and `npm run harness -- --seasons 50` before declaring a milestone done; paste the harness summary into the PR description.

## Conventions
- Currency is "Bones"; format with formatBones().
- Ratings, stats 0–99 integers in state (floats only inside a race).
- Content (planets/events/traits) is data, not code: add a row, not a branch.
- Commit small, message in imperative mood.
```

## 5. Core data model (sketch — the builder finalises)

```ts
type Id = string;

interface GameState {
  seed: number; week: number;                 // 1..13
  phase: 'arrival'|'events'|'planetPre'|'declare'|'race'|'planetPost'|'endTurn'|'seasonEnd';
  calendar: { week: number; planetId: Id; major: boolean; grandFinal: boolean }[];
  planets: Record<Id, PlanetState>;           // market stock, food prices this week
  players: Player[]; turnOrder: Id[]; activePlayer: Id | null;
  dogs: Record<Id, Dog>;                      // all dogs incl. locals for sale
  declarations: Record<RaceClass, Record<Id /*playerId*/, Id /*dogId*/>>;
  bets: Bet[]; results: RaceResult[]; eventLog: LogLine[];
  toggles: { cleanSport: boolean; betting: boolean; trading: boolean; casualEvents: boolean };
}

interface Dog {
  id: Id; name: string; ownerId: Id | 'market' | 'local';
  speed: number; accel: number; stamina: number; trap: number;   // 1..99
  rating: number; fitness: number; form: number; age: number;
  traits: TraitId[]; injuryWeeks: number; wins: number; runs: number;
  look: { body: number; palette: number; accessory: number };
}

interface Player {
  id: Id; name: string; colour: number; kind: 'human'|'ai'; difficulty?: 'easy'|'normal'|'hard';
  cash: number; dogIds: Id[]; kennelSlots: number;
  ship: { speed: number; cargoCap: number; coldStore: boolean; upgradesPaid: number };
  cargo: number;                              // food units
  staff: { trainer?: StaffId; vet?: StaffId; fixer?: StaffId };
  training?: { dogId: Id; stat: 'speed'|'accel'|'stamina'|'trap' };
  loans: { lender: 'bank'|'shark'; principal: number }[];
  flags: { caughtDoping: boolean; };
}

type Action =
  | { t: 'BuyDog'; playerId: Id; dogId: Id }
  | { t: 'SellDog'; playerId: Id; dogId: Id }
  | { t: 'Declare'; playerId: Id; cls: RaceClass; dogId: Id | null }
  | { t: 'PlaceBet'; playerId: Id; cls: RaceClass; dogId: Id; kind: 'win'|'place'; stake: number }
  | { t: 'TradeFood'; playerId: Id; units: number }            // +buy / −sell
  | { t: 'HireStaff'|'FireStaff'; playerId: Id; role: StaffRole; staffId?: Id }
  | { t: 'SetTraining'; playerId: Id; dogId: Id; stat: StatKey }
  | { t: 'BuyUpgrade'; playerId: Id; upgrade: UpgradeId; dogId?: Id }
  | { t: 'Borrow'|'Repay'; playerId: Id; lender: 'bank'|'shark'; amount: number }
  | { t: 'ResolveEvent'; playerId: Id; choice: number }
  | { t: 'EndPhase'; playerId: Id }
  | { t: 'AdvancePhase' };                                       // system
```

## 6. Milestones

Each milestone ends with: tests green, harness run, a short demo Jesse can click through, and a tag (`m0`, `m1`, …).

### M0 — Skeleton and engine core (1 session)
**Goal:** a repo where `npm test` passes, the engine can create a season and run a full 13-week season *headless* with three Normal AIs, and the harness prints net-worth stats.
**Deliverables:** workspaces scaffold; `types.ts`, `rng.ts`, `reduce.ts` with all phases (stubbed where content is missing); `simulateRace` ported from `economy_sim.py`; `dogValue`, `netWorth`; `balance-from-xlsx.ts` + generated `balance.json`; Normal AI (declare-by-EV, trade food on spread, keep a trainer); `harness.ts`; golden-seed test; CI running tests; `CLAUDE.md`.
**Accept when:** `npm run harness -- --seasons 200` completes in < 30 s and reports mean end worth for Normal AI in the 45–75k band; race calibration (rating-65 vs seven 50s) wins 45–60%.

### M1 — Ugly but complete playable season (1–2 sessions)
**Goal:** a human can play a whole season in the browser against AIs using plain HTML tables and buttons. No art.
**Deliverables:** Zustand store + localStorage save/resume; screens: New Season, Galaxy Map (list), Planet hub (buttons), Stable, Market, Docks (food + ship), Saloon (staff, loans), Race Office (declarations with cap validation), Bookie, Results (text), Leaderboard, Season End. Events deck (≥25 cards) with choice modals. All 18 planets as data with specials implemented. Traits (≥12). Toggles. Hotseat: any mix of human and AI players in one browser (required for v1, decided 2026-09-07). Human turns are taken in turn order with a 'pass the laptop' interstitial; declarations and bets stay hidden from the other humans until lock.
**Accept when:** Jesse completes two seasons without a blocker; every GDD §4.2 phase is reachable; save/resume mid-season works; the season takes ≤ 60 min without the race animation.

### M2 — Race view (1 session)
**Goal:** the three races are watchable and exciting.
**Deliverables:** Canvas renderer replaying tick logs along an SVG spline track (one spline per planet, placeholders OK); camera follows the leader with easing; dog sprites (coloured capsules with numbers for now); lure; position ticker; commentary generator (~60 lines with slots); 1×/2×/skip; photo-finish freeze; results overlay with payouts and rating deltas.
**Accept when:** a race replays identically from the same log; 60 fps on a mid laptop; skipping never desyncs state.

### M3 — World, content and art integration (2 sessions)
**Goal:** it looks like the game in the art bible.
**Deliverables:** theme tokens; planet hub screens with painted backdrops and hotspots (generated art dropped into `assets/planets/<id>/`); dog portrait compositor (body × palette × accessory); track top-downs per planet; event cards with illustrations; UI kit (riveted panels, neon buttons, ticket-stub race cards, betting slip); AI stable-owner portraits and personalities; name generator word lists (≥200 words each side). Asset pipeline doc: exact filenames/sizes the game expects, so Jesse can generate/replace images without touching code.
**Accept when:** every screen uses final-style assets or a clearly marked placeholder; a new planet can be added with one data row + three image files.

### M4 — AI, balance, polish, ship (1–2 sessions)
**Goal:** a v1 you'd put a link to on a forum.
**Deliverables:** Easy and Hard AI; balance pass using the harness (target: Hard beats Normal ~65% of seasons, Normal beats Easy ~80%, human-with-a-clue beats Normal ~50% after two plays); Majors purse-share decision (§20 Q2); season-end moments and worth chart; sound (optional); keyboard shortcuts; mobile-width layout check; Cloudflare Pages deploy; README with a play link; seed sharing ("challenge a friend to the same season").
**Accept when:** deployed URL works from a phone and a laptop; harness targets met; no console errors across a season.

### M5 — Online multiplayer (2–3 sessions, later)
**Goal:** a lobby code, 2–8 people, same engine.
**Deliverables:** `packages/server` as a Cloudflare Worker + Durable Object per room running the engine authoritatively (PartyKit optional); lobby (create/join by code, fill with AI); simultaneous planet phases with a 90 s timer and turn-order-resolved contention; action log sync + reconnect; spectator/replay of finished seasons; optional async "play-by-link" mode.
**Accept when:** two browsers on different machines finish a season together; a refresh mid-season rejoins with no state loss.

## 7. Testing and balance strategy

- **Golden seed tests:** seed 42 + a scripted action list ⇒ snapshot of final state. Any rule change must update the snapshot deliberately.
- **Property tests (engine):** cash never negative except via loans; a dog is never in two races; declared dogs respect caps; net worth formula equals sum of parts.
- **Harness:** `harness.ts --seasons N --ai normal,normal,hard,easy` prints: mean/p10/p90 end worth per difficulty, win rate per difficulty, prize vs trade vs betting income split, bankruptcies, average Gold field rating by week, supplement catch rate. This is the balance instrument; the spreadsheet is the design instrument. When they disagree, the harness wins and the spreadsheet gets updated.
- **Playtest checklist (Jesse, after M1 and M4):** Did the Bronze/Silver decision ever feel hard? Did you ever want to bet against yourself? Did any purchase feel pointless after week 8? Did a Major swing the season? Was there a week where nothing happened?

## 7b. Local backups and rollback

Git is the real rollback mechanism: every milestone is tagged (`m0`, `m1`, …) and `git checkout m2` restores that exact build. As belt-and-braces, the repo also keeps dated local snapshots outside version control:

- `npm run snapshot` (scripts/snapshot.mjs) copies the repo — excluding `node_modules`, `dist`, `.git` and `backups/` — into `backups/YYYY-MM-DD_HHMM_<tag-or-short-hash>/` and writes `SNAPSHOT.md` inside it with the commit hash, tag and harness summary. `backups/` is git-ignored.
- The builder runs it at the end of every milestone and before any balance pass or refactor that touches the engine. Jesse can run it any time.
- Rollback: copy a snapshot folder over the repo (or `git checkout <tag>`), `npm install`, done. Cloudflare Pages also keeps every deployment; a previous deploy can be re-promoted from the dashboard with one click.

## 8. How to run the build sessions

1. **Done (7 Sept 2026):** GitHub repo `aingeaingeainge/space-dog-racing` exists (public, README + Node .gitignore, branch `main`), and a Cloudflare Pages project `space-dog-racing` is already connected to it (build `npm run build`, output `packages/web/dist`, `NODE_VERSION=20`), deploying to `space-dog-racing.pages.dev` on every push to `main`. The local project root is `Documents\CoWork\dog racing game`, which already holds `design/`. The M0 prompt tells the builder to `git init` there, add the remote, pull, and push.
2. One milestone per session. Start every session with the prompt below for that milestone. Opus reads `CLAUDE.md`, the GDD, this plan, and the code — nothing else is needed.
3. At the end of each milestone: tag, `npm run snapshot`, deploy (from M4), playtest against the checklist, write findings into `design/PLAYTEST_NOTES.md`, and bring them to the next planning conversation. Rule changes go into the GDD's decision log *before* the next build session.
4. Balance changes: edit the spreadsheet → `npm run balance` → commit both.

## 9. Ready-to-paste prompts for the builder

Each prompt assumes the repo is checked out and `design/` is present.

### Prompt M0
```
You are building "Space Dog Racing", a browser game. Read design/GDD.md, design/BUILD_PLAN.md (sections 1–6, milestone M0) and design/economy_sim.py fully before writing code.

Task: complete milestone M0 exactly as specified in BUILD_PLAN.md §6.
- First, git: this folder is the project root and already contains design/. Run `git init`, `git remote add origin https://github.com/aingeaingeainge/space-dog-racing.git`, `git pull origin main` (the repo has a README and a Node .gitignore), and from then on commit as you go and push to `main` at the end. Do not create a new repository. Cloudflare Pages is already connected to this repo and will try to build every push with `npm run build` → `packages/web/dist`, so make sure the root `npm run build` produces that folder (an empty Vite shell is fine for M0).
- Scaffold npm workspaces: packages/engine (pure TypeScript, strict) and packages/web (Vite + React, can be an empty shell for now).
- Implement the engine: types.ts per the data model sketch (finalise it), rng.ts (mulberry32 with pick/gauss/shuffle/int helpers), reduce.ts with every phase from GDD §4.2, race/simulateRace.ts ported faithfully from economy_sim.py run_race() and returning a tick log, race/odds.ts (logistic win-probability model calibrated against simulateRace by running it), economy/ (dogValue, netWorth, market pricing, food prices, loans), content/ (all 18 planets from GDD §12 as data, ≥12 traits, ≥25 events, name word lists), ai/normal.ts per GDD §14.
- scripts/balance-from-xlsx.ts reads design/space_dog_racing_economy.xlsx Assumptions sheet (column A labels → column B values) into content/balance.json; the engine imports numbers only from balance.json.
- scripts/harness.ts runs N headless seasons and prints the stats listed in BUILD_PLAN §7.
- test/golden.test.ts: seed 42, 6 Normal AIs, full season ⇒ snapshot. Plus the property tests in §7.
- Write CLAUDE.md from BUILD_PLAN §4 verbatim. Add a GitHub Actions workflow running npm test on push. Add scripts/snapshot.mjs and the `npm run snapshot` script per BUILD_PLAN §7b, and run it once at the end of the milestone.
Acceptance: npm test green; `npm run harness -- --seasons 200` < 30 s, mean Normal-AI end worth 45–75k Bones; calibration check (one rating-65 dog vs seven rating-50) wins 45–60% — adjust race noise constants in balance.json if not, and report what you changed. Paste the harness output in your final message. Do not build UI beyond the Vite shell.
```

### Prompt M1
```
Read CLAUDE.md, design/GDD.md, design/BUILD_PLAN.md (milestone M1) and the existing packages/engine code. Do not change engine rules unless the GDD requires it; if you must, update the golden snapshot and explain why.

Task: milestone M1 — an ugly but complete playable season in packages/web.
- Zustand store holding { seed, log: Action[], state } with derived state via engine.reduce; persist log+seed to localStorage; "Resume season" on the title screen.
- Screens listed in GDD §15 as plain, functional React (tables, buttons, simple modals). No art, no canvas. Use one shared Panel component so M3 can reskin without rewriting screens.
- Human turns follow GDD §4.2 phases; AI turns resolve instantly via engine.ai. Support any mix of human/AI players (hotseat) in the New Season screen — this is a v1 requirement. Between human turns show a 'Pass to <name>' interstitial; a human's pending declarations and bets are not shown to other humans until declarations lock.
- Declarations screen must enforce rating caps and show all other stables' declarations and the local dogs. Bookie shows odds from engine odds.ts. Results screen lists finishing order, payouts, rating deltas, injuries.
- Events show as a modal with choices; planet specials are applied and displayed on the planet hub.
- Leaderboard: every stable's cash, dogs value, ship, debt, net worth, Gold wins, doping icon; visible from every screen.
- Season End: podium + table.
Acceptance: I can play two full seasons; save/resume works mid-week; a season takes under 60 minutes; npm test green. Finish by writing design/PLAYTEST_CHECKLIST.md from BUILD_PLAN §7 for me to fill in.
```

### Prompt M2
```
Read CLAUDE.md, design/GDD.md §6.3 and §16, design/BUILD_PLAN.md (milestone M2), and packages/web. 

Task: milestone M2 — the race view.
- packages/web/src/race-view: a Canvas 2D renderer that replays a RaceResult tick log from the engine along a track spline. Tracks: one SVG path per planet in content (add placeholder ovals/rings/straights matching each planet's GDD §12 distance and bend description). Map distance-along-track → (x,y,heading) with arc-length parameterisation.
- Camera follows the leading group with easing; zoom slightly on the finish. Dogs are coloured capsules with saddle-cloth numbers for now (sprite hook left ready for M3). Draw a lure ahead of the leader.
- HUD: live positions ticker, race class + purse, commentary bar fed by race-view/commentary.ts (≥60 templated lines keyed to events in the log: break, lead change, bump, fade, photo finish). Controls: 1×, 2×, skip. Photo-finish freeze when the winning margin < 0.3 m.
- Results overlay after each race: order, payouts, bets settled, rating deltas. Then auto-advance Bronze → Silver → Gold.
Never re-simulate in the renderer; if the log and the displayed result could ever disagree, that is a bug. Acceptance: identical replay from the same log; 60 fps on a mid laptop; skipping is state-safe; npm test green.
```

### Prompt M3
```
Read CLAUDE.md, design/GDD.md §12, §15, §16, design/BUILD_PLAN.md (milestone M3), and packages/web.

Task: milestone M3 — world and art integration.
- Theme tokens (packages/web/src/theme/tokens.css) from GDD §16 palette; per-planet theme override (two accent hues). Fonts: Bungee (display) + Space Mono (numbers) via Google Fonts with fallbacks.
- UI kit components: riveted metal Panel, NeonButton (states), TicketCard for races, BettingSlip, StatBar, DogCard with portrait slot, Signpost for planet specials. Reskin all M1 screens using these — keep behaviour identical.
- Planet hub: full-bleed backdrop image with six clickable hotspots (Market, Kennels, Docks, Saloon, Bookie, Race Office), positions per planet in data.
- Dog portrait compositor: layers body × palette × accessory PNGs (assets/dogs/{body,palette,accessory}/*.png). Race-view sprite: rotate a single top-down run-cycle sprite sheet per body.
- Asset pipeline: create design/ASSET_LIST.md listing every image the game expects — exact path, size, and a generation prompt built from the GDD §16 template with that planet's vibe and accents. Ship with clearly labelled placeholder PNGs (flat colour + text) so the game runs before real art exists.
- Event cards with an illustration slot; AI owner portraits + personality blurbs (GDD §14) as data.
Acceptance: every screen uses the kit; adding a planet = one data row + three images; placeholders are obvious; npm test green.
```

### Prompt M4
```
Read CLAUDE.md, design/GDD.md §14, §19, §20, design/BUILD_PLAN.md (milestone M4 and §7), design/PLAYTEST_NOTES.md if present, and the codebase.

Task: milestone M4 — AI, balance, polish, ship.
- Implement ai/easy.ts and ai/hard.ts per GDD §14. Extend harness to report win rate by difficulty over N seasons with mixed fields.
- Balance pass: targets in BUILD_PLAN §6/M4. Tune only via balance.json (and mirror any change into the spreadsheet's Assumptions sheet — update the xlsx with openpyxl, keep formulas intact). Address GDD §20 Q2 (Major purse share) with data from the harness and record the decision in the GDD decision log.
- Season-end: net-worth-over-time chart for all stables (SVG, no chart library), "moments" list, "Play again same seed", shareable seed link (?seed=…&players=…).
- Polish: keyboard shortcuts, mobile-width layout check, no console errors across a season, accessible focus states.
- Deploy: the Cloudflare Pages project `space-dog-racing` is already connected to the repo (build `npm run build`, output `packages/web/dist`, Node 20) — do not create another; check the latest deployment at space-dog-racing.pages.dev succeeds and add `_headers`/`_redirects` if needed for the SPA. README with play link, screenshot, and a one-paragraph pitch.
Acceptance: deployed URL works on phone and laptop; harness targets met and pasted into the PR; npm test green.
```

### Prompt M5
```
Read CLAUDE.md, design/GDD.md §18, design/BUILD_PLAN.md (milestone M5), and the whole codebase. The engine is already pure and action-driven — do not fork it.

Task: milestone M5 — online multiplayer.
- packages/server: a Cloudflare Worker with one Durable Object per game room running @sdr/engine authoritatively (use PartyKit on top of Durable Objects if it simplifies the WebSocket/room plumbing — justify the choice in one paragraph before coding). Deploy with wrangler to the same Cloudflare account as the Pages site. Rooms by 6-letter code; host sets player count and fills empties with AI; seed generated server-side.
- Protocol: clients send Actions; server validates via engine.reduce, appends to the log, broadcasts the action (not the state). Clients reduce locally and must converge; add a periodic state-hash check and a resync path that replays the log.
- Simultaneous planet phases with a 90 s timer; contested market purchases resolve by turn order at receipt; race day broadcasts the tick log.
- Reconnect by rejoining the room and replaying the log; spectators allowed; finished seasons replayable.
- Optional async mode: the room persists; players take turns whenever; email/Discord link optional.
Acceptance: two browsers on different machines finish a season; refresh mid-season rejoins with no loss; npm test green, plus server integration tests for join/leave/reconnect.
```

## 10. Effort estimate

| Milestone | Builder sessions | Jesse's time |
|---|---|---|
| M0 | 1 | 30 min review |
| M1 | 1–2 | 2 × 1 hr playtests |
| M2 | 1 | 30 min |
| M3 | 2 (+ art generation time) | 2–4 hr generating/curating images |
| M4 | 1–2 | 2 × 1 hr playtests |
| M5 | 2–3 | testing with a friend |

Roughly 8–11 builder sessions to a shippable single-player v1 (M0–M4), with M5 as a separate project once people are asking for it.

## 11. Risks and mitigations

- **Race sim feels random.** Mitigation: calibration test in M0, commentary that names causes ("faded — low stamina on a 600 m track"), rating deltas shown after each race.
- **Bronze/Silver decision collapses** (everyone always races up). Mitigation: harness tracks average Gold field rating by week; if Gold fields are stacked by week 5, lower Gold purses or raise Silver.
- **Majors decide everything.** Mitigation: §20 Q2, harness measures variance of final rank by Major results.
- **Art inconsistency across 18 planets.** Mitigation: one prompt template, locked negative list, generate in one sitting, ASSET_LIST.md as the contract.
- **Scope creep** (reputation, breeding, sponsors, more commodities). Mitigation: v2 list in the GDD; nothing enters v1 without a decision-log row.
