# V3 Phase L3 notes: the web online, local only (30 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3l3`**. The fallback is `v3l2` (`f687457`).

**In one line:** a browser can now play online. "Play online" on the Title (only in a build with
`VITE_ROOMS_URL`) opens a lobby — create a room or join by its link or code — and the game plays through
the same screens as hotseat, one stable a browser, with no pass screens, a waiting line and a nudge. Three
real Chromium browsers played a weekend, read the results and followed "Play again" into a new room, and
headless stores finished whole games, all against `wrangler dev`. **No deploy, no account.** Nothing under
`packages/engine` changed, and hotseat reads byte for byte as at `v3l2`, screenshots and all.

The prompt is `claude/V3_PHASE_L3_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: five things the record should know

1. **Jesse: after pulling, run `npm install` at the root once.** The web gained one dependency,
   `partysocket` 1.3.0 (with `event-target-polyfill`), +0.3 MB installed. `playwright` 1.56.1 (pinned: its
   Chromium is the container's `chromium-1194`) is a devDependency of `packages/server` only, so neither
   Pages nor the root install ever fetches it.
2. **This browser's marks are kept, not only held in memory.** The prompt said the UI acknowledgements
   (races watched, results read, the arrival and the board read, the season's end read) are "per browser,
   in memory". In memory, a refresh would bring back the arrival or the start of race day, and "a refresh
   mid-sitting comes back to the same screen" could not hold. They live in `localStorage` beside the
   seat's token under the room's own key, `sdr.room.<CODE>` — never `sdr.save.v1`. The pace timer is in
   memory only.
3. **There are two server changes, not one.** Play again (`playAgain`, `moved`) as planned, and a
   **look-only `hello`** (no token, no name, no face): the room answers with the `lobby` and keeps sending
   it, and seats nobody. `lobby` had only gone to seated sockets, so a joiner at the door could not have
   seen which faces were taken. Both are additions under `PROTOCOL_VERSION` **1**. **L4's first deploy
   freezes v1**: from then on any change to a message is a bump and a `reload`.
4. **§5.1's diet was wrong, and the plan is corrected (GDD_V3 L3b).** The engine takes `SetDogState` only
   from the stable on the clock. The Kennels are read-only while waiting (`Stable.tsx` reads the store's
   `meta`); the engine did not change.
5. **The store is a factory now.** `makeGameStore(world?)` builds one; the app's `useGame` is
   `makeGameStore()`. That is how `online-table-walk` runs eight browsers' stores in one Node process,
   each with its own `localStorage` stand-in and Node's `WebSocket`. Prettier re-indented the whole
   store one level for it, so `gameStore.ts`'s diff is larger than its change.

---

## What was built

| Piece | Where |
|---|---|
| Config: `roomsUrl()` from `VITE_ROOMS_URL`, `socketUrl` (`http`→`ws`), codes, `?room=`, the room link, `POST /room` | `web/src/store/online.ts` |
| The socket: `RoomLink`, one `partysocket` reconnecting WebSocket a room, `hello` on every open, sends only while open (`maxEnqueuedMessages: 0`: a buffered press would reach the room before the `hello` that says whose it is) | `store/online.ts` |
| The store's online half: `source`, `seat`, `code`, `host`, `meta`, `lobby`, `conn`, `rev`, `inFlight`, `nudged`, `stale`, `reloadNeed`; `createRoom`, `joinRoom`, `sitDown`, `setTable`, `startRoom`, `nudge`, `standIn`, `leaveRoom`; online `dispatch` sends `act`; `save()` never writes the save online; `abandon` leaves the room; `playAgain` sends `playAgain` (host) | `store/gameStore.ts` |
| `screenFor(s, ui, online?)`: no pass screens, no roll-call, the arrival and the board once a weekend per browser, and `waiting`; `onClock` | `store/loop.ts` |
| The waiting line's words: who (humans only), what, since | `lib/waiting.ts` |
| The nudge: a two-note Web Audio blip and a flashing tab title until focus | `lib/nudge.ts`, `App.tsx` |
| The lobby: create / join, name and face (the Title's `FaceButton`/`FacePicker`, faces taken from `lobby`), the code big with its link and Copy, the seats with "away", the host's `GameLengthPicker`, AI rows and Start with its reason; a stale room's standings | `screens/Lobby.tsx` |
| Off the clock: tabs (hub, Kennels, map), the board filling live, "Fly on" early, the phase's line; the hub with the Market and Race Office shut ("Not your turn: …") | `screens/Waiting.tsx`, `PlanetHub`/`venues` (optional `waiting`) |
| The strips: waiting line, away seats with "Let an AI play for them", reconnecting, reload | `components/OnlineTable.tsx` |
| Online branches, each on an optional argument or `source === 'online'`: Explore's held door; Results' "Fly on" (held when early), no public purses; `LastSlips` off; the race view's "you"; Bookie's "Done betting"; Top bar "Leave"; the game's end (Play again host-only, the report's stand-in line) | the screens named |
| `GalaxyMap` never looks up a dark week's planet | `screens/GalaxyMap.tsx` |
| The report's optional `standIns` | `lib/report.ts` |
| The room: the look-only `hello`, `playAgain` → a successor via `POST /successor` on a fresh code, `movedTo`, `moved` to every socket and every later `hello`; `start` split into `begin(setup)` | `server/src/room.ts`, `protocol.ts` |
| Walks: `npm run online-table-walk`, `npm run browser-walk`, two new `online-walk` rows | `web/scripts/online-table-walk.ts`, `server/scripts/browser-walk.ts`, `server/scripts/online-walk.ts` |

### The choices the plan left open

- **The marks under the room's key** (Read this first 2), and the pace timer counts `waiting` as the
  table's time, as hotseat's roll-calls are (`lib/pace.ts`).
- **Explore is shown to a seat off the clock** while it has not picked, with a line saying the door is
  kept for it; once held, the doors dim and "Your door is chosen, and you will see what is behind it when
  your turn comes."
- **The arrival shows at Explore only**, as in hotseat; the board before this stable's first slip.
- **Nudge** in the waiting line nudges every human named, and turns to "Nudged" for a minute (the room's
  own limit). A browser that is nudged also shows a notice, and the title flashes for a few seconds even
  when the window already has focus.
- **The host's length is a local draft** in the lobby, so typing a target is not a round trip a keystroke.
- **The address bar carries `?room=CODE`** while in a room (so a refresh or a copied URL rejoins) and
  drops it on leaving; only in a build with a rooms URL, so a hotseat seed link is never touched.
- **A `patch` before any whole view reconnects** (`RoomLink.reconnect`). A token the room does not know
  is forgotten, and the browser looks instead.
- **Leaving** keeps the token: the link brings the browser back into its seat.

---

## The walks' output

### `npm run online-table-walk` (headless `gameStore`s)

```
online table walk: wrangler dev up in 2.4 s on http://127.0.0.1:8791
✓ game one: a store that closes rejoins by its token; the stand-in hands back: Cal's seat p3 again, whole view at rev 439; a stand-in played 3 weekend(s); meta.standIn []
  game one (4 + 2, two seasons): a press, dispatch to the view that answers it: median 18.3 ms, p95 74.3 ms, max 101.8 ms over 381 presses
✓ game one (4 + 2, two seasons): every store finishes the game: 2 season(s), 20 weekends, 1472 log rows, 862 actions pressed, 6.3 s
✓ game one (4 + 2, two seasons): no pass screen ever appears online: 0 pass or roll-call screens in 1553 screens seen (waiting 685 · explore 274 · planet 192 · arrival 77 · race 77 · results 77 · board 73 · betting 73 · seasonEnd 11 · offSeason 10 · fields 4)
✓ game one (4 + 2, two seasons): private screens are the seat's own; every waiting screen names seats on the clock: 685 waiting screens checked; 29 doors and 29 "Fly on"s pressed early
✓ game one (4 + 2, two seasons): every store's report equals hotseat's over the room's log: 4 reports, 33 lines each, byte-identical to lib/report.ts over replay(setup, log), and every final view equals viewFor over it; the stand-in line: "Cal's seat was played by an AI for 3 weekends."
✓ game one: Play again — a new room, same seats and seed, every store follows: JMPZXX → WTGEBM, 4 stores followed; seats p1:Aroha,p2:Bex,p3:Cal,p4:Dot; season 1 week 1; the same AI stables: Sly Pete Manx, Madame Ossory
  game two (8 humans, one season): a press, dispatch to the view that answers it: median 34.7 ms, p95 183.3 ms, max 395.1 ms over 375 presses
✓ game two (8 humans, one season): every store finishes the game: 1 season(s), 10 weekends, 904 log rows, 864 actions pressed, 9.9 s
✓ game two (8 humans, one season): no pass screen ever appears online: 0 pass or roll-call screens in 2899 screens seen (waiting 1675 · explore 624 · planet 192 · arrival 80 · race 80 · results 80 · board 72 · betting 72 · seasonEnd 16 · fields 8)
✓ game two (8 humans, one season): private screens are the seat's own; every waiting screen names seats on the clock: 1675 waiting screens checked; 31 doors and 31 "Fly on"s pressed early
✓ game two (8 humans, one season): every store's report equals hotseat's over the room's log: 8 reports, 35 lines each, byte-identical to lib/report.ts over replay(setup, log), and every final view equals viewFor over it
All 10 rows pass.
```

Each client walks `screenFor` online from its own store after every change and presses at most one thing
(`table-walk.ts`'s plain line, now exported from there). Cal closes his "tab" (`leaveRoom`) at season 1
week 4 while off the clock; the host's store presses `standIn`; at week 7 Cal `joinRoom`s with the same
storage and is back in his seat. The final view is compared with `viewFor(replay(setup, log), seat)`, with
top-level keys sorted (a patch keeps the client's key order; the view carries `rumours`).

### `npm run browser-walk` (three Chromium contexts, the real app)

```
browser walk: two builds in 7.0 s
✓ a build without VITE_ROOMS_URL shows no "Play online"; with it, one: 0 without, 1 with
✓ three browsers in one room: created, joined by link and by code: room EAEHHU, link http://127.0.0.1:4180/?room=EAEHHU; B's lobby shows 4 seats
✓ A nudges B: the tab title flashes: A's line: "Waiting on Bex — Market and Race Office · 0:00Nudge"; B's tab title: "★ Aroha nudged you"; B's notice shown
✓ a refresh mid-sitting comes back to the same screen: before "…Week 1/10 · HushmarketPlanet — before the racesBex · 6,900 Bones…", after the same; http://127.0.0.1:4180/?room=EAEHHU
  Aroha: read the arrival → picked a door → answered a card → waiting line: Waiting on Cal — Market and Race Office · 0:00Nudge → declared a dog → headed to the track → read the board → placed a bet → done betting → skipped the rest of race day → read the results → ended the turn
  Bex: read the arrival → picked a door early (held) → answered a card → declared a dog → headed to the track → read the board → placed a bet → done betting → skipped the rest of race day → read the results → pressed Fly on early (held)
  Cal: read the arrival → picked a door → answered a card → declared a dog → headed to the track → read the board → placed a bet → done betting → skipped the rest of race day → read the results → ended the turn
✓ a weekend played in three browsers: doors, a declaration, a bet, the races, the results: 34 presses
✓ a held door and a held "Fly on" show as held, and land in turn order: doors held for Bex ("Your door is chosen" shown); "Fly on" held for Bex; every stable reached the game's end, which needs every door and every "Fly on" applied
✓ Play again: a new room, and every browser follows: EAEHHU → ZYKVRP, ZYKVRP, ZYKVRP; C's first screen: "Season 1 · Week 1 of 10"
All 7 rows pass.
```

(The waiting line reads "· 0:00 Nudge" on screen; `textContent` runs the button's word on.) The host adds
one AI and sets **a race to 1 Bone**, so the weekend is the whole game and the same walk reaches the end
and Play again. Screenshots, all at 1280 and 390, in `shots/browser-walk/`: `00-title-online`,
`01-lobby-join-by-link`, `02-lobby-host`, `02-lobby-guest`, `03-explore-held-door`, `04-bookie`,
`05-race-view`, `06-results`, `07-waiting-line`, `08-nudged`, `09-game-over-host`, `09-game-over-guest`,
`10-play-again-follows`. I looked at them all: the lobby is the kit's panels, the code in the display face
with the planet's glow; the waiting line is a lit strip under the top bar.

### `npm run online-walk`: 25 rows (23 + 2 new)

```
✓ a look-only hello gets the lobby and no seat: 4 seats, faces 3, 0, 5, 6 taken, started false; seated: nobody
✓ Play again: a new room, same seats and seed, every browser follows: TABFWA → ESAYGT; the non-host: "Only the host can play again"; a second press and a later hello on TABFWA: moved to ESAYGT and ESAYGT; 4 clients back in seats p1, p2, p3, p4; the successor at rev 1 hashes 0352f938724d…, Node's createSeason(setup, seed 444428968) driven 0352f938724d… (the old game ended at rev 1456)
…
All 25 rows pass.
```

Every L2 row passed as before (0 leaks in 4,627 views, every view byte-identical to Node's `viewFor`).

### The save

A scratch script (`shots/save-check.mjs`) served the `v3l2` build and then this one on the same origin,
in one browser: `v3l2` wrote a hotseat save (`v` 13); `v3l3` offered Resume; an online game was made,
started and played (a door, a card) with the save **byte-identical** throughout; then Leave, Resume, and
the hotseat game played on (log 2 → 3 rows, `v` 13). ("Byte-identical" is measured from the moment
`v3l3` opened: the `v3l2` page itself adds its pace timer to the save as it is navigated away from.)

---

## The measurements

| | |
|---|---|
| A press, as a round trip against `wrangler dev` (dispatch to the `view` that answers it, the room's drive included) | median **18 ms**, p95 74 ms (4 humans + 2 AIs); median **35 ms**, p95 183 ms (8 humans, eight stores in one Node process on 2 cores). Race day's `AdvancePhase` is the tail |
| Bytes a seat a season | ~**2.8 MB** raw (`online-walk`: 5.6 MB a client over two seasons at four humans, 4.4 MB over one at eight); unchanged by L3 |
| The web bundle | JS 473.05 → **508.48 KB** (+35.4 KB; gzip 159.48 → 170.43, +11.0 KB), of which the plumbing and `partysocket` are ~15 KB and the screens the rest; CSS 39.5 → 41.5 KB. Nothing from `packages/server` is in it: the protocol import is `import type` |
| The Pages build, Node 20.20.2, clean clone, `npm ci && npm run build` | ✅ `v3l2` 144 MB (146,928 KB), `v3l3` 144 MB (147,276 KB: **+348 KB**, `partysocket`); install 3.8 s against 4.0–4.5 s at `v3l2` (noise); build 21 s against 19 s |
| `online-walk` wake, five seasons | 476–658 ms in `workerd`, as at `v3l2` |

---

## The rules that did not bend

```
$ git diff v3l2 --stat -- packages/engine
(empty)
```

- **Goldens** `41a8c8b5…` / `d4bb14c3…` unmoved; `npm test` **184 green**. `SAVE_VERSION` **13**,
  `STATE_VERSION` **13**, `PROTOCOL_VERSION` **1**.
- **Hotseat, byte for byte against `v3l2`:** `season-check`, `hub-clicks` (9.4; the table walk 10.7 /
  22.4, 0 leaks) and `race-view-check`, saved to `shots/before/` before any change and compared with
  `cmp` at each commit: identical. **The hotseat screenshots** — the Title, and a two-human weekend's
  arrival, Explore and the hub after a door, at 1280 and 390, from a build without `VITE_ROOMS_URL` —
  **byte-identical PNGs** to `v3l2`'s (`shots/before/hotseat/`, `shots/after/hotseat/`; the same script
  twice on `v3l2` gives identical bytes, so the comparison can see a difference).
- `view-walk` **0 throws**; its GalaxyMap line 14 → **0**. Its "drew a screen" count rose 45,216 →
  46,892, the same move: GalaxyMap renders that threw on a dark week now draw.
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.** `server:test` 10 green. Lint clean,
  strict TypeScript, no `any`, across web, server and both walks.
- No `account_id`, no `wrangler login`, no deploy.
- Formatted only what was edited.

### `npm run harness -- --seasons 50`

```
End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

Purse pool: 240,860 posted a season, 47.6% of it reaching a player (v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)
```

Identical to `v3l2`'s: 60 of the harness's 61 lines are in the `v3l2` snapshot taken at the start, and the
61st is its elapsed time.

### The acceptance table (ONLINE_PLAN §10, L3)

| Measure | Target | `v3l3` |
|---|---|---|
| Two browsers create, join by link and by code, play a weekend, read the results | ✅, 1280 and 390 | ✅ three |
| Waiting line names who and how long; Nudge reaches them (sound, tab title) | ✅ | ✅ (the sound is not observable headless; it is guarded and silent on failure) |
| A refresh mid-sitting comes back to the same screen | ✅ | ✅ |
| A held door and a held "Fly on" show as held, and land in turn order | ✅ | ✅ |
| Headless stores finish 4 + 2 over two seasons and 8 over one; no pass screen online | ✅ | ✅ 0 in 4,452 |
| The online report equals hotseat's over the room's log, plus the stand-in line | ✅ | ✅ 12 of 12 |
| Play again: a new room, same seats and seed, every browser follows | ✅ | ✅ browsers, stores, `online-walk` |
| Build without `VITE_ROOMS_URL` is today's game | ✅ | ✅ no "Play online"; PNGs identical |
| `season-check`, `hub-clicks`, table walk, `race-view-check` | unchanged | ✅ |
| A `v3l2` hotseat save loads and plays on | ✅ | ✅ |
| Nothing under `packages/engine` | empty diff | ✅ |
| Goldens, tests, lint, `view-walk`, `asset-check`, `server:test`, `online-walk`, harness, Pages on Node 20 | ✅ | ✅ |
| 🎲 Does the lobby make sense to someone who has never seen it? | 🎲 | the evening's |

## Commits

1. `Add the web's online plumbing: the socket, the store's online source, screenFor online` (hotseat
   checks and screenshots identical at this commit).
2. `Add the online screens: the lobby, the waiting line, the nudge, the stand-in, Play again`.
3. `Add online-table-walk, browser-walk, and online-walk's look-only and Play-again rows`.
4. `Record L3 in ONLINE_PLAN, GDD_V3 (L3a–L3c), BUILD_PLAN_V3 and CANON`.
5. These notes and the prompt. Tagged **`v3l3`**.

---

## Open questions

1. ❓ **What next?** L4 (live on Cloudflare: a deploy, `VITE_ROOMS_URL` in Pages, a smoke test) or the
   evening first. Hotseat is untouched, so the evening can be played on this build.
2. ❓ **A door name that wraps on a phone overflows its card** (`03-explore-held-door-390`: "The Fence's
   Parlour"). It is hotseat's own CSS — the art keeps its 3:4 ratio as a two-line name makes the card
   taller — and not L3's; Holy Bark's short names never show it. Left alone here because hotseat must not
   move; a one-line fix for any later phase.
3. ❓ **At 390 the game's end's final-standings table has very tall rows** (`09-game-over-guest-390`).
   Also hotseat's, also left alone.
4. Carried, untouched: the Title's stale "What is in this build" panel and a seed link that carries AI
   names; §5.2 hotseat inside a room; §7.5 split view; §14 Q9; more human faces; the goldens cannot see
   betting or humans.

---

## ⚠️ The v3l3 checklist, multiple choice

1. **Next session?** *The evening first (recommended by the plan: nothing online is live yet) · L4 now,
   live on Cloudflare · The two small J fixes and the two phone layouts above*
2. **When L4 deploys:** *Workers Builds on every push to `main` (push only between evenings) ·
   `wrangler deploy` by hand from a session*
