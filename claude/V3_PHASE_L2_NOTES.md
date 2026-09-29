# V3 Phase L2 notes: the room, local only (30 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3l2`**. The fallback is `v3l1` (`9f48417`).

**In one line:** `packages/server` is a Cloudflare Worker that routes and a `Room` Durable Object that
holds a game, and a script of fake players finishes whole games in it under `wrangler dev`, with no
client ever sent a secret. No deploy, no account, no web change; nothing under `packages/engine` or
`packages/web` moved, and every hotseat check reads byte for byte as at `v3l1`. **A browser still cannot
play online: that is L3.**

The prompt is `claude/V3_PHASE_L2_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: four things the record should know

1. **`packages/server` is not a root workspace.** `wrangler` 4.143.0 says `engines: node >=22` and brings
   `workerd` (~250 MB installed). Cloudflare Pages runs `npm install` at the root on Node 20, and the
   root's `"workspaces": ["packages/*"]` would have pulled all of it into every Pages build. The root now
   names `packages/engine` and `packages/web`; the server has its own `package.json` and lock, and takes
   the engine as `"@sdr/engine": "file:../engine"`. `npm run server:install` installs it. A clean
   `npm ci && npm run build` under Node 20 installs exactly `v3l1`'s 144 MB. **Jesse: after pulling, run
   `npm install` at the root once** (the lock's workspaces field changed) and, only if you want to run the
   room yourself, `npm run server:install`.
2. **The queue is stored, not only held in memory.** The prompt said queued actions "live in memory and
   in `meta`". With the Hibernation API a room is evicted between messages with every socket still open,
   so a door held in memory would have vanished silently. It is a `queue` table (never the log), and the
   eviction test in the walk shows a held door surviving a restart of `wrangler dev`.
3. **A stand-in at the Bookie and in the off-season waits for its place in the turn order** (GDD_V3 L2b).
   `decide` returns nothing for a stable that is not the active one, so the first build, which played
   stood-in seats at once in the any-order phases, looped until the step limit. It now plays them
   exactly as the engine's `drive` plays an AI seat. And every drive now runs on a copy: a drive that
   throws leaves the room's state and log untouched and tells the presser, rather than half-applying.
4. **The Worker's bundle holds the engine anyway.** A Durable Object class is exported by the Worker
   script that hosts it, so `Room` and the engine are in the same 297 KiB bundle (80 KiB gzipped, from
   `wrangler deploy --dry-run`; the spike's was 261 KiB). What the prompt asked for still holds: the
   routing file (`src/index.ts`) imports no engine (codes live in `src/code.ts`), and its `fetch` never
   replays, reduces or builds a view.

---

## What was built

| Piece | Where |
|---|---|
| The Worker: `POST /room` (draws a code from `ABCDEFGHJKMNPQRSTUVWXYZ`, has the room claim it, retries on 409), `GET /room/:code` (the WebSocket upgrade, to `idFromName(code)`), CORS on both | `src/index.ts`, `src/code.ts` |
| `Room`: SQLite-backed Durable Object, WebSocket Hibernation API (`acceptWebSocket`, `webSocketMessage`, `webSocketClose`, `serializeAttachment` holding `{ seat }`) | `src/room.ts` |
| Storage: `room` (code, created-at, host, protocol and `STATE_VERSION` at creation, the lobby's length and AI rows, the clock, the last standings), `seats` (name, face, token, stand-in, its weekends), `setup`, **`log` one row per action**, `queue`. The state is never stored: `replay(createSeason(setup), log)` on every wake | `src/room.ts` |
| The room's logic with no Durable Object in it: who is on the clock, `queueKind`, `driveRoom` (system phases, AI seats, held actions, stand-ins), `refuseAct`, the view diff | `src/game.ts` |
| The protocol, type-only, for L3's web to import: `hello` `act` `nudge` `lobby` `start` `standIn`; `welcome` `lobby` `view` `rejected` `nudged` `ended` `reload`; and the dev-only `debug` apart | `src/protocol.ts` |
| `wrangler.jsonc`: `Room` under `new_sqlite_classes`, no `account_id`, nothing deploys | `packages/server/wrangler.jsonc` |
| `npm run online-walk` (§8 item 3's headless half) and `npm run server:test` (10 tests under Node, no `workerd`) | `scripts/online-walk.ts`, `test/game.test.ts` |
| Root wiring: `workspaces`, the lock's workspaces field, `.wrangler/` and `.dev.vars*` ignored, eslint for `packages/server`, four `server:*`/`online-walk` scripts | root files |

### How a press goes through the room

1. `act` from a socket whose attachment says seat `p2`. Every action's `playerId` must be `p2`, and none
   may be `AdvancePhase` (`refuseAct`).
2. A single `ChooseDoor` at Explore from a seat not on the clock that has not picked, or a single
   `EndPhase` at `planetPost` from a seat not on the clock and not flown, is **held** (`queue` table) and
   the room answers with a `view` whose `meta.queued` shows it.
3. Anything else is applied to a `structuredClone` with `reduceMut`. An `ActionError` throws the copy away
   and answers `rejected` with the engine's message.
4. `driveRoom` drives the copy on, as `applyActions` does: `AdvancePhase` when the system is due, `decide`
   for an AI seat, `decide(…, 'normal')` for a stood-in human seat, and a held action the moment its seat
   comes on the clock (on a copy again: refused → dropped, and its seat gets `rejected` with the `seq`
   that sent it). It stops when a human is on the clock. Every action applied goes into the log.
5. The copy becomes the room's state, the new actions are appended to SQLite, the 30-day alarm is pushed
   out, and every socket is sent its seat's `viewFor`: whole if the room has no record of what that socket
   last saw (a new socket, or any socket after a wake), otherwise only the top-level fields whose JSON
   changed. `rev` is the log's length; the presser's copy echoes its `seq`.

### The choices the plan left open

- **Raw Durable Objects, not `partyserver`.** Almost all of `Room` is the game — the queue, the stand-in,
  the per-seat views and their diff, the lobby — and would be written the same on either. `partyserver`
  would save the few lines of socket plumbing (accept, attachment, iterate sockets) at the cost of a
  dependency and a second hibernation layer to learn when something goes wrong. It did not make the
  server clearly shorter, so it was not taken.
- **The debug hook** is a `debug` message (`{ t: 'debug', op: 'hash' | 'stale' }`), answered only when
  the room's env has `DEV_DEBUG === '1'`, which only `wrangler dev --var DEV_DEBUG:1` sets (the walk
  passes it; no `.dev.vars` file is needed or committed). Anywhere else it is `rejected` as an unknown
  message. It returns the SHA-256 of `JSON.stringify(state)`, the rev, the rows in the log and how long
  the last wake took; `stale` marks the room as started on `STATE_VERSION − 1`, to test §7. **The leak
  scan does not use it**: it replays the `ended` log on Node.
- **`meta`**: `clock` (`seats` and `since`), `online`, `standIn`, `standInWeekends` (a count per seat),
  `queued` (`'door' | 'flyOn'` per seat) and `host`. The clock is one seat in turn order, and every stable
  not yet finished at the Bookie and in the off-season. `since` is stored, so it survives a wake.
- **Every reply echoes `seq`**, so `lobby` and `reload` carry an optional `seq` too; `welcome` carries an
  optional `stale` (§7's room: both versions, the last standings stored, and the week they were read).
  `PROTOCOL_VERSION` stays **1**: no browser has spoken it yet, and these are additions to shapes
  nothing reads.
- **Joining** (GDD_V3 L2a): the first human to sit down is the host. A name is 1–24 letters and a face
  (0–7) is required; a face another human holds, a full table (humans plus AI rows at 8) and a name-hello
  after Start are all refused. A seat whose browser closes in the lobby is kept: it comes back with its
  token and nobody can free it.
- **Stand-in** (GDD_V3 L2b): the host, or while the host is away the first connected human in seat
  order, can turn it on for a **disconnected** human seat (a present seat is refused) and off again. The
  seat's `hello` turns it off. A stand-in weekend is a `season:week` in which it pressed for the seat.
- **Nudge**: any seat, at a seat on the clock; refused otherwise and within a minute of the last nudge of
  that seat. `nudged { by }` goes to every socket of the nudged seat.
- **After the game ends** a `hello` gets `welcome`, the whole final view and `ended` again; `act`,
  `standIn` and the rest are refused.
- **The seed** is `crypto.getRandomValues` over a `Uint32Array(1)`, taken `% 2147483647`, drawn at Start.
- **The alarm** is set at creation and pushed to 30 days after every applied action; it closes any
  sockets and `deleteAll()`s.

---

## `online-walk`'s output

The room draws its seed, so each run is a different game; this is the run recorded in ONLINE_PLAN §10.
The first full run failed the stand-in row on a bug in the walk (it read the stand-in's weekend count from the host's view a message too early, and the room played one more weekend before Cal's `hello` landed); read from Cal's own first view, every row passed in the two full runs after it.

```
online walk: wrangler dev up in 2.7 s on http://127.0.0.1:8790, state in shots/online-walk/state
✓ a face already taken is refused at the door: "That face is taken"
✓ spoofed playerId, client AdvancePhase, stale v: rejected ("That is not your stable"), rejected ("Only the room moves the game on"), reload (need 1)
✓ a new browser cannot take a seat after Start; a present seat cannot be stood in for: "This game has started: only its players can rejoin"; "Bex is here: nobody can be played for while they are"
✓ nudge reaches the seat on the clock, once a minute: Dot nudged 1×; the second: "They were nudged under a minute ago"
✓ 4 clients + 2 AIs finish a two-season game: 2 seasons, 20 weekends; Two-Fingers Grady wins
✓ a dropped client rejoins by token to the same view: week 2, rev 106: the table saw her go (offline), and the whole view on rejoin is byte-identical
✓ stand-in plays a dropped seat and hands back at the next decision: played 3 weekends while he was away; on his return meta.standIn is []; his own next press at rev 436, and the stand-in's weekends stayed 3
✓ evicted and woken: the replayed state hash equals the state before: rev 855: hash f92745a9778d… before, f92745a9778d… after (replayed 855 rows in 154 ms; wrangler up in 2.4 s; four rejoins in 270 ms); every client's whole view identical; queue kept ({"p4":"door"})
✓ game one: queued door and queued "Fly on" apply in turn order: 27 doors and 27 "Fly on"s held and applied, 0 dropped, 0 out of turn in 1431 actions
✓ final state equals Node's replay of the room's log: room b617c0cdeea98605…, Node b617c0cdeea98605… over 1431 actions
  game one: 2 season(s), 1431 log rows (80 KB), 1477 views to 4 clients (10 whole), 5.6 MB a client, 855 actions pressed, 14.0 s
✓ game one: no client ever receives a secret: 0 leaks in 1477 views scanned against 20 rows (the same scan finds 10 rows' secrets in the whole state mid-game)
✓ game one: every view held equals Node's viewFor at that rev: 1256 compared, 0 differ
✓ a ninth browser is refused: "The table is full"
✓ 8 clients finish a season: 10 weekends; Mo wins
✓ game two: queued door and queued "Fly on" apply in turn order: 37 doors and 37 "Fly on"s held and applied, 0 dropped, 0 out of turn in 902 actions
✓ game two: final state equals Node's replay: room c2fa0f8672d72d77…, Node c2fa0f8672d72d77…
  game two: 1 season(s), 902 log rows (51 KB), 3000 views to 8 clients (8 whole), 4.2 MB a client, 862 actions pressed, 19.6 s
✓ game two: no client ever receives a secret: 0 leaks in 3000 views scanned against 20 rows (the same scan finds 14 rows' secrets in the whole state mid-game)
✓ game two: every view held equals Node's viewFor at that rev: 2432 compared, 0 differ
✓ a room on an older STATE_VERSION says so, shows its standings and plays no more: version 12 vs 13; standings Quin, Old Man Torvald, Madame Ossory; a press: "This room was started on an older version of the game (12, now 13) and cannot play on."
✓ wake + replay time for a five-season room: 3604 log rows (204 KB); wake in the room 398 / 506 / 512 ms (of which reading the rows 6 / 7 / 6 ms); the same replay on Node 251 / 220 / 316 ms; hello to whole view after a restart 475 / 578 / 592 ms (spike: ~220 ms)
✓ game three: final state equals Node's replay: room b70e070548560197…, Node b70e070548560197…
  game three: 5 season(s), 3604 log rows (204 KB), 242 views to 1 clients (4 whole), 12.2 MB a client, 567 actions pressed, 14.0 s
✓ game three: no client ever receives a secret: 0 leaks in 242 views scanned against 20 rows (the same scan finds 11 rows' secrets in the whole state mid-game)
✓ game three: every view held equals Node's viewFor at that rev: 239 compared, 0 differ
All 23 rows pass.
```

### What the walk does, and how it checks

- **Four games.** One: four clients (Aroha the host, Bex, Cal, Dot) and two Normal AIs, two seasons. Two:
  eight clients, one season. Four: a room made stale (§7). Three: one client and five AIs, five seasons,
  for the wake.
- **The clients** press only what their own view offers, `table-walk.ts`'s plain line, re-typed in the
  script (web scripts are out of bounds): the door `week % 3`, `aiChoiceFor` on its own card (the view cuts
  the params, so a throw falls back to choice 0), two weeks of staple when short, the best three dogs
  declared, 100 on each favourite, keep them all and hire the candidate in the off-season. Bex and Dot
  (and every other client in game two) pick their door and press "Fly on" early, so the room holds them.
  A client sends one `act` at a time and waits for the reply echoing its `seq`.
- **Leaks, two ways, on every view held (patches applied):** every `SEAT_SECRETS` row's redaction is run
  over the view the seat holds; each row is idempotent on its own output, so a view with nothing secret in
  it does not change, and one that does names the row. To prove the scan can see a secret, the same scan
  over the whole state mid-game finds 10–14 rows. Then, at the end, the `ended` log is replayed on Node
  and **at every `rev` a client held, `viewFor(state, seat)` must hash the same** (SHA-256, top-level keys
  sorted, because a patch keeps the client's key order).
- **Final state:** the room's `debug` hash of its state against SHA-256 over `JSON.stringify` of Node's
  replay, three games.
- **The drop:** Bex, on the clock at her first Market sitting from week 2, closes her socket, the table's
  `meta.online` loses her, she reconnects with her token, and her whole view is byte-identical at the
  same `rev`.
- **The stand-in:** Cal closes his socket at season 1 week 4 while not on the clock; the host turns the
  stand-in on; at week 7 Cal reconnects. His own first view says `standIn: []`; his next press is his, and
  the stand-in's weekend count never moves again.
- **The eviction:** at season 2 week 3 every client pauses, the room's hash is taken, every socket closes,
  `wrangler dev` is killed and restarted on the same `--persist-to` folder, everybody reconnects by token,
  and the hash, every client's whole view and `meta.queued` are compared.
- **Turn order of held actions:** the engine takes a `ChooseDoor`, and an `EndPhase` at `planetPost`, only
  from the seat on the clock, so an applied held action is in turn order by construction. The walk counts
  every one sent, requires 0 dropped, and walks the log again to confirm each door and each "Fly on" was
  from the active seat.

---

## The measurements

| | |
|---|---|
| Wake + replay, five seasons | **398–512 ms** in `workerd` (3,604 rows, 204 KB, read in 6–7 ms); **475–592 ms** from `hello` to the whole view after a restart. Node replays the same log in 220–316 ms on this container, so `workerd` is ~1.6× Node here; the spike's 220 ms was measured on a faster container. A Durable Object has 30 s |
| Wake, a room in season 2 of two | 154–187 ms for 855–897 rows |
| On the wire | 5.6 MB a client over two seasons at four humans, 4.2 MB over one season at eight: **~2.8 MB a seat a season**, against §2.4's ~6 MB. One view per change of the table, whole only on `hello` and after a wake |
| Log | 80 KB for two seasons (1,431 rows), 204 KB for five |
| Bundle | 297 KiB, 80 KiB gzipped (`wrangler deploy --dry-run`; no upload) |
| The Pages build, Node 20, clean clone, `npm ci && npm run build` | ✅ `v3l1`: 3.4 / 4.2 s install, 19.6 s build, 144 MB. `v3l2`: 4.0 / 4.5 s install, 19.3 / 19.7 s build, 144 MB, **no `wrangler`, no `workerd`**. The install-time difference is noise; the web bundle differs only in its build label (`v3l1` → `v3l1-2-g…`, from `git describe`) |
| `wrangler dev` up | 2.3–2.9 s |

---

## The rules that did not bend

```
$ git diff v3l1 --stat -- packages/engine packages/web
(empty)
```

- **Goldens:** `41a8c8b5…` (one season) and `d4bb14c3…` (two seasons), unmoved; the golden files were not
  touched. `SAVE_VERSION` **13**, `STATE_VERSION` **13**, `PROTOCOL_VERSION` **1**.
- `npm test` **184 green**. `npm run lint` clean, covering `packages/server` (`no-explicit-any` an error
  there too). `npm run build` ✅. `npm run server:test`: both `tsconfig`s strict (the Worker's with
  `@cloudflare/workers-types`, the scripts' with Node's), and 10 tests green.
- **Hotseat, byte for byte against `v3l1`:** `season-check`, `hub-clicks` (9.4 clicks; the table walk
  10.7 / 22.4 passes, 0 leaks) and `race-view-check`, saved to `shots/before/` before any change and
  diffed with `cmp` after: identical. `view-walk` 0 throws (46,892 renders). `asset-check`: **288 finished,
  0 still a stand-in, 0 missing.**
- No `account_id`, no `wrangler login`, no deploy. Nothing touched Jesse's Cloudflare account.
- Formatted only what was edited (`packages/server`).

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

Identical to `v3l1`'s: every one of the harness's 59 lines is in the `v3l1` snapshot taken at the start.

### The acceptance table (ONLINE_PLAN §10, L2)

| Measure | Target | `v3l2` |
|---|---|---|
| 4 clients + 2 AIs finish a two-season game; 8 clients finish a season | ✅ | ✅ |
| No client ever receives a secret | 0 leaks, every view scanned | ✅ 0 in 4,719, and 3,927 byte-identical to Node's `viewFor` |
| A dropped client rejoins by token to the same view | ✅ | ✅ |
| Evicted and woken: replayed state hash equals the state before | ✅ | ✅ |
| Stand-in plays a dropped seat and hands back at the next decision | ✅ | ✅ |
| Queued door and queued "Fly on" apply in turn order | ✅ | ✅ 64 and 64, 0 dropped |
| Spoofed `playerId`, client `AdvancePhase`, stale `v` | rejected, rejected, `reload` | ✅ |
| Final state equals Node's replay of the room's log | byte for byte | ✅ three games |
| Wake + replay time for a five-season room | measured (spike ~220 ms) | ~400–510 ms (Node here 220–315 ms) |
| Pages build on Node 20 from a clean install | ✅, install cost stated | ✅ nothing added |
| Nothing under `packages/engine` or `packages/web` changes | empty diff | ✅ |
| Goldens; `npm test` 184; lint; hotseat checks byte-identical; `view-walk` 0; `asset-check`; harness | ✅ | ✅ |

## Commits

1. `Add the room: a routing Worker and the Room Durable Object` (`packages/server`, root wiring).
2. `Add online-walk and the room's own tests`.
3. `Record L2 in ONLINE_PLAN, GDD_V3 (L2a, L2b), BUILD_PLAN_V3 and CANON`.
4. These notes and the prompt. Tagged **`v3l2`**.

---

## Open questions

1. ❓ **What next?** L3 (the web online: the lobby, the store on a socket, `screenFor` without pass
   screens, two real browsers against a local room) or the evening first. Nothing in L2 touched the
   evening, and L3 would not either, but the plan says after is safer.
2. ❓ **The waiting line at the Bookie** lists every stable not yet finished, AI and stood-in seats
   included, because they wait behind the turn order (L2b). L3 may want to say "waiting on Ruby" rather
   than naming the AI behind her. A display choice; the room's `meta` has what it needs either way.
3. ❓ **A ghost seat in the lobby** (L2a): if someone sits down and wanders off before Start, the host
   cannot free the seat. The game can start with it and a stand-in can play it. If the evening finds that
   annoying, "the host can clear an empty lobby seat" is a small addition.
4. Carried, untouched: **the evening** (`design/PLAYTEST_CHECKLIST.md`, unplayed); L3's list (§6 items
   1–7, "Play again", the nudge's sound, the stand-in line in the report); L4's deploy; the Title's stale
   "What is in this build" panel and a seed link that carries AI names; §7.5 split view; §14 Q9; more
   human faces; the goldens cannot see betting or humans.

---

## ⚠️ The v3l2 checklist, multiple choice

1. **Next session?** *L3 now, still before the evening · The evening first (recommended by the plan) · The two small J fixes*
2. **The waiting line at the Bookie:** *name only the humans being waited on · name every stable, AIs included*
3. **A lobby seat left empty:** *keep it, a stand-in can play it (as built) · let the host clear it*
