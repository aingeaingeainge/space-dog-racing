# V3 Phase L3: the web online

> **⚠️ Corrections, made before this file was committed** (CANON: a prompt is written before its phase,
> and is corrected in the record, never after). The notes, `claude/V3_PHASE_L3_NOTES.md`, have the why.
>
> 1. **"The UI-only acknowledgements are per browser, in memory."** Per browser, yes; in memory, no. A
>    refresh would have forgotten that the arrival was read and the races watched, and "a refresh
>    mid-sitting comes back to the same screen" could not have held. They are kept in `localStorage`
>    beside the seat's token, under the room's own key (`sdr.room.<CODE>`), never the save's.
> 2. **"The one server change of this phase" is Play again.** There is a second, as small: a `hello` with
>    no token, name or face is a browser **only looking** — the room answers with the `lobby` and keeps
>    sending it, and seats nobody. Without it a joiner at the door could not see which faces are taken.
> 3. **"Two real browsers"**: the walk uses three contexts, so that one joins by the link and one by the
>    typed code, as the table asks.
> 4. **The protocol's new types** (`playAgain`, `moved`, the looking `hello`) landed in commit 1 with the
>    web's plumbing that reads them; the room's half is commit 2, as planned.
> 5. **`online-walk` now ends "All 25 rows pass."** (the look-only `hello` and Play again are new rows).
> 6. The ⚠️ about §5.1's diet was right: the Kennels are read-only while waiting (GDD_V3 L3b).
> 7. **"The host adds two AIs"** in the browser walk: it adds one (three humans and an AI is four
>    stables, inside 3–8) and sets a race to 1 Bone, so the weekend played is the whole game and the
>    same walk reaches the game's end and tests Play again in the browsers.

Phase L2 is done (`v3l2`, pushed). The room exists: `packages/server` has a Worker that only routes and a
`Room` Durable Object that holds a game, checks every press with the engine, drives the AI seats, the
stand-ins and the two held actions, and sends each seat only its own `viewFor`. `npm run online-walk`
finishes whole games in a room under `wrangler dev` with headless clients: 23 rows green, 0 leaks in
4,719 views. Nothing under `packages/engine` or `packages/web` moved. **A browser still cannot play
online.** This phase makes it able to.

**The evening has still not been played.** L3 is "before or after the evening; after is safer"
(ONLINE_PLAN §10), and Jesse has chosen to build it now. So the rule of this phase is the one that makes
that safe: **hotseat reads byte for byte as at `v3l2`, and a build without `VITE_ROOMS_URL` is today's
game.** The live Pages site has no rooms URL until L4, so nothing Jesse's friends open changes.

**Phase L3 builds the browser half**: the lobby, the store on a socket, `screenFor` without pass screens,
the waiting line and the nudge, reconnecting, the stand-in button, "Play again" across rooms, and the
report's stand-in line. It ends when **two real browsers create a room, join it by link and by code,
play a weekend, read the results**, and a script of headless browsers-worth of stores finishes a game,
all against `wrangler dev` in the container. **No deploy, no Cloudflare account.** That is L4.

The spec is **`design/ONLINE_PLAN.md`**: §2.4–§2.6 (the protocol, reconnecting, how a room ends), §3.2,
§5 (the table online), **§6 (the web changes, items 1–7)**, §7, §8 items 4–5, and **§10's Phase L3
table, which is this phase's acceptance**. The decisions are GDD_V3 **V24–V28**, **L1a–L1b** and
**L2a–L2b**. The room is `packages/server/src` and its wire is **`src/protocol.ts`**. Build from the plan.
Where it is silent, choose the simplest thing and write the choice down.

## ⚠️ First: the mechanics. They are L2's, and they worked.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`, then
     `npm run server:install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **184 green**; `npm run lint` is clean; `npm run build` passes
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws** (and "GalaxyMap reading a dark week's planet: 14 weekends")
     - `npm run server:test` is **10 green**; `npm run online-walk` ends **"All 23 rows pass."** (it starts
       and stops `wrangler dev` itself; run it with `nohup … &` and poll)
  3. **Then run `npm run snapshot`, before any change.**
  4. **Save the hotseat baseline:** `season-check`, `npx tsx packages/web/scripts/hub-clicks.ts` and
     `npx tsx packages/web/scripts/race-view-check.ts` into `shots/before/`, and **screenshots of the
     Title and of one hotseat weekend at 1280 and 390, built without `VITE_ROOMS_URL`**. You diff all of
     them at the end.
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** `git tag -s v3l3 -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle from whatever his `main` actually is: `git bundle create <out> <his main>..main v3l3`.
     If his tree is dirty or his `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3l3.bundle main:refs/heads/work refs/tags/v3l3:refs/tags/v3l3
     git merge --ff-only work
     git branch -d work
     rm v3l3.bundle
     ```

     Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Give him `git push origin main` and `git push origin v3l3`. A stop hook will
     say there are unpushed commits. That is expected: say so, and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. If this phase adds a web
     dependency (`partysocket`), tell him to run `npm install` at the root after pulling.
- **Keep scratch out of the repo.** Spikes, probes, screenshots and measurements go in `shots/`, added to
  `.git/info/exclude`. Stage paths, not `-A`.
- **Killing `wrangler dev`:** never `pkill -f wrangler` or `pgrep -f workerd` from a Bash call whose own
  command line contains those words: it matches the calling shell and kills the tool call (exit 144).
  L2's walk kills its own process group; for anything by hand, match on `/proc/<pid>/comm` being
  `node` or `workerd`, from a script file.
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long, including
  `wrangler dev` and `vite`, with `nohup … &` and poll. Chromium is at `/opt/pw-browsers`
  (`PLAYWRIGHT_BROWSERS_PATH` is set); **never `playwright install`**.
- **Jesse is in Cowork, not at a terminal. Ask one clear question at a time, multiple choice, with a
  recommendation first, and stop.** He has chosen the simple option every time. The two L2 questions are
  **decided below**; ask only if something else the plan does not cover would change what a player sees.

`v3l2` is the tag to fall back to. The goldens: one season **`41a8c8b5…`**, two seasons **`d4bb14c3…`**.
**Neither moves.** `SAVE_VERSION` and `STATE_VERSION` stay **13**. **`PROTOCOL_VERSION` stays 1**: no room
has been deployed and no browser in the wild speaks it, so the protocol can still gain messages and
optional fields in this phase without a bump. **L4's first deploy freezes v1**; say so in the notes.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. **`design/ONLINE_PLAN.md`, all of it**, with the `v3l2` notes in §2.2, §5.3, §5.5 and §10.
3. `claude/V3_PHASE_L2_NOTES.md`: "Read this first" and "How a press goes through the room". Then
   `packages/server/src/protocol.ts` (every message, and `RoomMeta`), `game.ts` (`clockOf`, `queueKind`)
   and `room.ts` (`hello`, `act`, `broadcast`, `standIn`).
4. GDD_V3 §2.3 (the weekend's order), §3 (hotseat's pass screens and public moments) and §13's V24–V28,
   L1a–L1b, L2a–L2b.
5. The web:
   - `src/store/gameStore.ts` (the store, `dispatch`, the save), `store/loop.ts` (`applyActions`,
     `screenFor`, `ScreenUi`, `PRIVATE_SCREENS`), `store/persist.ts`, `src/App.tsx`;
   - `screens/Title.tsx` (the roster, the face picker, `GameLengthPicker`), `screens/Table.tsx`
     (Arrival, Board, AfterRaces), `screens/RaceView.tsx` ("Skip the rest of race day"),
     `screens/SeasonEnd.tsx` ("Play again", "Copy the report"), `screens/GalaxyMap.tsx`, `lib/report.ts`,
     `lib/rumours.ts`, `lib/pace.ts`;
   - `scripts/table-walk.ts`, `scripts/season-check.ts` and `scripts/view-walk.tsx` (how the web is
     walked headless; `view-walk` runs under `vite-node` because the art uses `import.meta.glob`).

## Decided before this phase (the two `v3l2` checklist questions)

- **The waiting line names only the humans being waited on.** At the Bookie and in the off-season,
  `meta.clock.seats` also lists AI and stood-in seats waiting behind the turn order (L2b); the line shows
  the human seats in it, in turn order. If only AI or stood-in seats are left, it says "Waiting on the
  AIs" (they are about to play). A display choice; the room is unchanged.
- **A lobby seat left empty stays** (L2a, as built). The lobby shows a seat whose browser has closed as
  "away"; the host can still start, and a stand-in can play it.

## What to build

**Shared with hotseat, unchanged:** every screen, `race-view/`, the pace timer, the report, the face
picker. They read a `GameState`; online it is the seat's view. **Hotseat's code path must not change
behaviour**: where a shared function needs an online branch, it takes a new *optional* argument whose
absence is exactly today's code.

1. **Config (§6 item 7).** `VITE_ROOMS_URL` is a build variable (`http://127.0.0.1:8787` locally). The
   WebSocket URL is derived from it (`http` → `ws`, `https` → `wss`). **Without it the Title does not
   render "Play online" at all**, and a build without it must match `shots/before/`'s screenshots.
2. **The protocol, shared.** The web imports `packages/server/src/protocol.ts` **type-only**, by relative
   path (`packages/server` is not a workspace, and must not become one: Pages builds on Node 20). Check
   that `tsc` and `vite build` are happy with a type-only import from outside `packages/web`, and that
   nothing from `packages/server` ends up in the bundle.
3. **The socket (§2.5).** `src/store/online.ts`: one connection per browser, **`partysocket`** as the
   plan says (a web dependency; check its size and that it installs on Node 20), sending `hello` on every
   (re)connect with the seat token kept in `localStorage` under the room code (wrapped in try/catch; a
   browser without storage can still play, it just cannot rejoin). It applies `view` messages (whole, or
   the patch's top-level fields over the last view), keeps `meta`, and matches replies by `seq`.
   If a patch arrives before any whole view, it reconnects rather than guess.
4. **The store's online source (§6 item 2).** `gameStore` gets `source: 'local' | 'online'` (absent reads
   as local). Online: `dispatch` sends `act` and the next `view` replaces `state`; `log` is empty until
   `ended`, then it is the room's log and `setup` the room's setup; **nothing is written to the save** (the
   room is the save, and a hotseat save must survive an online game untouched); `rejected` lands in the
   same `error` field the screens already show; the UI-only acknowledgements (`racesWatchedWeek`,
   `resultsSeenWeek`, …) are per browser, in memory. The store also holds `seat`, `code`, `host`,
   `meta`, the lobby, the connection's state and a `nudged` flag.
5. **`screenFor` online (§6 item 3).** An optional online argument (`{ seat, meta }`): `me` is always the
   browser's own seat; **no pass screens** and no `arrival`/`board`/`afterRaces` roll-calls as hotseat
   has them (online, the arrival and the locked board are read by each browser alone, once a weekend,
   through the same `ui` marks); and a new **`waiting`** kind when this seat is not on the clock and has
   nothing it may do. `PRIVATE_SCREENS` stays the hotseat rule and `season-check` still enforces it; a
   `waiting` screen is public.
   - **What a seat not on the clock can do (§5.1):** read its own kennel, the leaderboard and the map;
     watch declarations land on the board; **pick its door early** (the room holds it: the Explore screen
     says "your door is chosen, and you will see what is behind it when your turn comes", from
     `meta.queued`); **press "Fly on" early** after the races (held the same way); bet at the Bookie and
     answer the off-season at once.
   - ⚠️ **§5.1 also says a waiting seat can "pick next week's diet". The engine refuses that**:
     `SetDogState` is `planetPre`/`planetPost` only and needs the active stable (`activeOrFail` in
     `phases/planet.ts`). **Do not change the engine.** The diet control is simply not offered while
     waiting; correct §5.1 in the plan and say so in the notes.
6. **The waiting line (§5.1, V25):** "Waiting on Ruby — Market and Race Office · 1:20 · Nudge", over the
   hub, from `meta.clock` (who, as decided above, and `since`), the phase's plain name, a ticking clock,
   and a Nudge button that sends `nudge`. **A `nudged` message plays a short sound and flashes the tab
   title** until the window has focus, at most as often as the room sends it (once a minute a seat). The
   sound is generated (Web Audio, a short blip), not an asset, and failing to play it is silent.
7. **The lobby (§5.5, §6 item 1): `screens/Lobby.tsx`.** "Play online" on the Title opens "Create a
   room" (`POST /room`) or "Join" with a code. `?room=KFZQPX` in the URL opens the join straight away. A
   joiner types a name and picks a face with the Title's picker (faces taken shown taken, from the
   `lobby` message). The room's link and code are shown **big**, for reading aloud, with a Copy button.
   The seats fill in as people join, "away" beside a closed seat. The host sets the length (the Title's
   `GameLengthPicker`) and AI rows (Easy / Normal / Hard) and presses **Start** (3–8 stables, one human
   at least; the button says why when it cannot). A browser with a token for the room goes straight back
   into its seat, lobby or game.
8. **Reconnecting and `reload` (§6 item 6):** a small "reconnecting…" strip while the socket is down;
   `reload` shows "A new version is out — reload" with a button; a `welcome` with `stale` shows the room's
   last standings and that it cannot play on. A refresh mid-sitting comes back to the same screen.
9. **The two fog readers (§6 item 4):** `GalaxyMap` calls `planetOf` only for weeks that are not dark
   (the one-line move). `view-walk`'s GalaxyMap line should drop from 14 weekends to 0: that is the only
   `view-walk` number allowed to move. `rumours` already come from the view (`v3l1`).
10. **Race day (§5.4, V27):** plays from the view's `races`; "Skip the rest of race day" only moves this
    browser on; the race view's "you" is the seat's own stable.
11. **The stand-in (§5.3, V26, L2b):** beside a disconnected human's name, "reconnecting…"; the host (or,
    while the host is away, the first connected human in seat order, the room's `mayStandIn`) sees **"Let
    an AI play for them"**, which sends `standIn`; the seat then shows "(AI standing in)". Nobody can be
    kicked, so there is no other button.
12. **The game's end (§2.6):** on `ended`, the browser shows the game's end exactly as hotseat does:
    chart, moments, **Copy the report** from the room's setup and log. **The report gains one line** when
    `meta.standInWeekends` has anyone: "Aroha's seat was played by an AI for 3 weekends." (`lib/report.ts`
    takes it as an optional input; a hotseat report reads byte for byte as before.)
13. **Play again across rooms (§2.6)**, the one server change of this phase: the host's **Play again**
    on the game's end asks the old room for a successor. Add, in `protocol.ts` and `room.ts`, a client
    message `playAgain` (host only, only after the end) and a room message `moved { code }`: the old room
    draws a code, creates the new room with the **same seats (names, faces and tokens), the same AI rows,
    length and seed**, and starts it; it sends `moved` to every socket and answers every later `hello`
    with it too. Each browser copies its token to the new code and follows. Test it in `online-walk` (a
    new row) and in the browsers. Keep it small; if it turns out not to be, stop and ask whether Play
    again can wait for L4.

**Tests and walks:**

- **`npm run server:test` and `npm run online-walk`** still pass, with the Play-again row added.
- **The headless online table walk, `packages/web/scripts/online-table-walk.ts`** (under `vite-node`, as
  `view-walk` is): N headless clients against a room under `wrangler dev`, **each a real `gameStore` in
  online mode** (zustand runs in Node; the global `WebSocket` stands in for the browser's), walking
  `screenFor` online and pressing only what its screen offers, `table-walk.ts`'s plain line. 4 humans +
  2 AIs for two seasons, and 8 humans for one. It checks: every game finishes; **no pass screen ever
  appears online**; a private screen is only ever the client's own seat's; every `waiting` screen names
  seats that are on the clock; and a client's final report equals hotseat's `lib/report.ts` run over the
  room's `ended` setup and log (plus the stand-in line).
- **Two real browsers (§8 item 4): `packages/server/scripts/browser-walk.ts`**, with `playwright` as a
  devDependency **of `packages/server` only** (never the web's or the root's, so Pages never installs
  it). Build the web with `VITE_ROOMS_URL` pointing at `wrangler dev`, serve it (`vite preview`), and in
  two browser contexts: A creates a room; B joins **by link**; a third context joins **by code**; the host
  adds two AIs and starts; they play one weekend (a door each, one early; a declaration; a bet; the
  races; the results), with screenshots at **1280 and 390** of: the lobby, the waiting line, Explore
  with a held door, the Bookie, the race view, the results. Also: B refreshes mid-sitting and comes back
  to the same screen; A nudges B and B's tab title flashes; a build **without** `VITE_ROOMS_URL` shows no
  "Play online".
- **Look at the screenshots yourself** before calling a screen done, as every phase since F has. The
  art bible still applies; the lobby is a new screen and should look like it belongs.

## RULES THAT DO NOT BEND

- **No change under `packages/engine`.** `git diff v3l2 --stat -- packages/engine` must be empty. If the
  web needs something the engine does not export, stop and say so.
- **Hotseat reads byte for byte as at `v3l2`:** `season-check`, `hub-clicks` (9.4; the table walk 10.7 /
  22.4 passes, 0 leaks) and `race-view-check`, diffed against `shots/before/`; and the hotseat
  screenshots (built without `VITE_ROOMS_URL`) pixel-identical, or every difference explained.
- **A hotseat save survives:** a save written by `v3l2` loads and plays on in `v3l3`, and playing an
  online game in the same browser neither reads nor writes it. `SAVE_VERSION` 13.
- **Neither golden moves.** `npm test` stays **184 green**. `STATE_VERSION` 13, `PROTOCOL_VERSION` 1.
- **`view-walk` still 0 throws**; only its GalaxyMap line moves, to 0.
- **The Pages build on Node 20** from a clean `npm ci && npm run build` still passes, with the added
  install cost (from `partysocket`) stated.
- **No deploy.** No `account_id` and no `wrangler login`. Nothing touches Jesse's Cloudflare account.
- **Lint and strict TypeScript cover everything new**, with no `any`.
- **Format only what you edit.**

## The commit discipline, in this order

1. The web's online plumbing: config, the socket, the store's online source, `screenFor` online, the
   GalaxyMap move, the report's optional stand-in line. Hotseat checks green at this commit.
2. The screens: the lobby, the waiting line and the nudge, the reconnect and `reload` strips, the stand-in
   button, "Play online" on the Title; and the server's `playAgain` / `moved`.
3. `online-table-walk.ts`, `browser-walk.ts`, and the new `online-walk` row.
4. The docs:
   - `design/ONLINE_PLAN.md`: §10's L3 status box with the results; §5.1's diet correction; any choice
     the plan left open;
   - `design/BUILD_PLAN_V3.md`: the L outline marks L3 done;
   - `design/CANON.md`: `v3l3`, and last synced;
   - GDD_V3 §13, **only if** a choice changes something a player will see (numbered L3a…).
5. `claude/V3_PHASE_L3_NOTES.md`, and this prompt as `claude/V3_PHASE_L3_PROMPT.md`, corrected before
   commit where it was wrong, with the corrections in a box at the top. Tag **`v3l3`** on that commit.

## DONE WHEN

| Measure | Target |
|---|---|
| Two browsers create, join by link and by code, play a weekend, read the results | ✅, screenshots at 1280 and 390 |
| Waiting line names who and how long; Nudge reaches them (sound, tab title) | ✅ |
| A refresh mid-sitting comes back to the same screen | ✅ |
| A held door and a held "Fly on" show as held, and land in turn order | ✅ |
| Headless stores finish 4 + 2 over two seasons and 8 over one; no pass screen online | ✅ |
| The online report equals hotseat's over the room's log, plus the stand-in line | ✅ |
| Play again: a new room, same seats and seed, every browser follows | ✅ |
| Build without `VITE_ROOMS_URL` is today's game | ✅ no "Play online"; hotseat screenshots unchanged |
| `season-check`, `hub-clicks` (9.4), table walk (10.7 / 22.4), `race-view-check` | unchanged from `v3l2` |
| A `v3l2` hotseat save loads and plays on | ✅ |
| Nothing under `packages/engine` changes | `git diff v3l2 --stat` shows none |
| Goldens; `npm test` 184; lint; `view-walk` 0 (GalaxyMap 0); `asset-check`; `server:test`; `online-walk`; harness; Pages on Node 20 | ✅ |
| 🎲 Does the lobby make sense to someone who has never seen it? | 🎲 (the evening's, not this phase's) |

## Then, in order

1. **Re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks`, `race-view-check`
     (diffed against `shots/before/`), `view-walk`, `asset-check`, `server:test`, `online-walk`;
   - `npm run harness -- --seasons 50`. Paste the summary into the notes; it must equal `v3l2`'s.
2. `npm run snapshot`.
3. **Write `claude/V3_PHASE_L3_NOTES.md`** in the style of the L2 notes:
   - "Read this first";
   - what was built, and the choices the plan left open;
   - the walks' output, and the screenshots that matter (named, in `shots/`);
   - the measurements (what a press costs as a round trip against `wrangler dev`; bytes a seat a
     season; the bundle-size change);
   - the rules that did not bend;
   - open questions;
   - a **short** multiple-choice `v3l3` checklist. The main question: "L4 (live on Cloudflare) now, or
     the evening first?"
4. Commit this prompt, corrected, and tag `v3l3` on it.
5. **Land it** in Jesse's folder and give him `git push origin main` and `git push origin v3l3`, and
   `npm install` at the root if a web dependency was added.
6. **Sync the Project** with `project_write`, and update each status header's `last synced`:
   - the changed `design/*.md`;
   - the new `claude/` notes and prompt.

## Still open, and not this phase's

- **The evening.** `design/PLAYTEST_CHECKLIST.md`'s three games are unplayed. Hotseat is untouched, so it
  can be played on any build from `v3j` on.
- **L4, live:** Workers Builds, or `wrangler deploy` by hand; `VITE_ROOMS_URL` set in Pages; a smoke test
  against the live room; an online section in `PLAYTEST_CHECKLIST.md`. The first deploy freezes
  `PROTOCOL_VERSION` 1.
- **Two small fixes from the J notes:** the Title's stale "What is in this build" panel, and a seed link
  that carries AI names.
- **Still waiting:**
  - §5.2, hotseat inside an online room (V28: not yet);
  - §7.5 / §14 Q5, split view;
  - §14 Q9;
  - more human faces;
  - the goldens cannot see betting or humans.
