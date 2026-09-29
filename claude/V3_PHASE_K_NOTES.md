# V3 Phase K notes: online multiplayer, planned (29 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3k`**. The fallback is `v3j` (`5e92034`).

**In one line:** a design session. Nothing under `packages/` changed. Part 1 measured what a plan
needs (the log, the state, the secrets, the engine inside a Cloudflare Worker, Cloudflare's current
prices); Jesse answered five questions (GDD_V3 **V24–V28**); **`design/ONLINE_PLAN.md`** is the plan,
with four build phases, L1–L4.

---

## ⚠️ Read this first: four things the record should know

1. **Only the Bookie is "simultaneous" in the engine.** GDD_V3 §3 and V20 say Explore, Kennel and the
   Bookie resolve at once, and the prompt's question 2 was written that way. At `v3j`, **Explore is
   "simultaneous, played in turn order"** (`phases/explore.ts`): each door is opened and its card
   resolved in turn order, because a one-of-a-kind card goes to the first stable through the door, and
   `pendingEvent` holds one card at a time. **The Kennel is part of the Market/Race Office sitting**
   (`planetPre`, in turn order). The off-season is in turn order too. Only the Bookie takes any order
   (E8). Online this matters more than in hotseat, where the laptop is sequential anyway. The plan does
   **not** change the rule: the room lets a stable pick its door early and applies it when its turn comes
   (a queue in the server, no engine change), and the off-season is made any-order in L1 on E8's pattern
   (every answer is rolled when it opens, so the order cannot matter; the goldens are all-AI in turn order
   and cannot move). Written into the question Jesse answered (V25).
2. **A pending card tells its own holder more than the card does.** `pendingEvent.params` holds an
   offered dog's true stats and a `lie` flag, and `pendingEvent.rng` holds the dice behind a gamble's
   outcome; and **`players[].stats.liesTold` is counted when an offer is rolled**, not when it is taken,
   so a stable reading its own stats before choosing can tell the seller is lying. None of this is on any
   hotseat screen; all of it is in devtools, including the owner's. `viewFor` cuts all three (plan
   §3.1). No engine change now: counting `liesTold` at resolve instead would be a rule-neutral fix, and
   L1 can make it if the view's workaround reads badly.
3. **The dark calendar is only dark on screen.** `calendar` holds all ten planets from week 1, and
   `GalaxyMap` calls `planetOf` for every week, dark ones included, then hatches them. The rumours read
   the seed and the calendar two weeks out (`web/lib/rumours.ts`, which calls the calendar "public"). The
   view blanks dark weeks, so L3 moves `GalaxyMap`'s lookup inside the lit branch (one line), and L1
   moves `rumours` into the engine as `rumoursFor` so the view can carry the list.
4. **The spike's timings are `workerd` on this 2-core container, cold**, not Cloudflare's edge. They say
   the engine fits a Durable Object's 30 s with three orders of magnitude to spare, not what a player
   will wait. The Worker's free-plan CPU (10 ms) is not a constraint only because the plan's Worker
   routes and the Durable Object runs the engine.

(The prompt's other small misses are in its correction box.)

---

## Part 1: the measurements (scratch in `shots/`, not committed)

Probes: `shots/measure.ts`, `per-action.ts`, `update-size.ts`, `node-standings.ts`, and the Worker in
`shots/worker/`. Seed 42 unless said; "humans" are `table-walk.ts`'s plain line (a door a week, a crate
of staple when short, the best three declared, 100 on each favourite), so a real human's log has more
`TradeFood` than these.

### 1. The log

| Table | Seasons | Actions (player) | JSON | gzip | Replay on Node |
|---|---|---|---|---|---|
| 6 AI | 1 | 658 (618) | 36.4 KB | 2.3 KB | 98 ms |
| 4 humans + 2 AI | 1 | 672 (632) | 38.2 KB | 2.3 KB | 74 ms |
| 8 humans | 1 | 852 (812) | 48.7 KB | 2.3 KB | 111 ms |
| 6 AI | 3 | 2,000 (1,878) | 110.4 KB | 5.7 KB | 224 ms |
| 4 humans + 2 AI | 3 | 2,064 (1,942) | 117.2 KB | 5.5 KB | 204 ms |
| 8 humans | 3 | 2,646 (2,524) | 151.7 KB | 5.9 KB | 212 ms |
| 6 AI | 5 | 3,452 (3,248) | 194.3 KB | 9.5 KB | 328 ms |
| 4 humans + 2 AI | 5 | 3,534 (3,330) | 202.9 KB | 8.8 KB | 342 ms |
| 8 humans | 5 | 4,367 (4,163) | 249.5 KB | 9.5 KB | 343 ms |

Replay is `replay(createSeason(setup), log)`, mean of five. The log compresses ~20× because it is the
same few shapes over and over. **Per action**, on a 4h+2AI season: every action under 1 ms except race
day's `AdvancePhase` (median 10.6 ms, max 17.5 ms); the betting lock 0.3 ms.

### 2. The state and the tick logs

| What | JSON | gzip |
|---|---|---|
| `GameState` at week 1 (Explore) | 14.0 KB | 2.5 KB |
| at week 10 of season 1 | 147.3 KB | 24.1 KB (`results` 91.3 KB, `eventLog` 301 lines, 35.0 KB) |
| at the end of season 5 | 182.0 KB | 30.2 KB (`results` 102.4 KB, `eventLog` 39.0 KB, `seasons` 14.3 KB, `bets` 11.1 KB) |
| on race day, with the tick logs | 125.6 KB | 35.5 KB |
| one race's `RaceResult` (373 ticks × 8 runners) | 23.3 KB | 8.9 KB (the ticks alone 20.0 / 7.6 KB) |
| a race day's three | 68.5 KB | 25.6 KB |

**What goes over the wire:** sending the whole state after every human action of a 4h+2AI season is a
mean 100.3 KB a time (17.2 KB gzipped), **40 MB a seat a season**. Sending only the top-level fields that
changed is a mean 15.3 KB (2.6 KB gzipped), max 158 KB on race day, **6.1 MB a seat a season** (1.1 MB
gzipped). Measured on the full state; a view is a little smaller. The plan sends changed fields.

### 3. The secret list

Eighteen rows, walked from `types.ts`; the table is in `ONLINE_PLAN.md` §3.1. In short:

- **Nobody, not even the owner:** `seed` and `rng`; the calendar past next week; next week's market
  (bar the goods a stable holds `intel` for); every stable's Explore stream (`explore.seeds`, which
  computes every card behind every door); `explore.taken`; a pending card's `params` and `rng` (a dog's
  true stats and the lie; a gamble's dice); a style that has not raced.
- **Only the stable concerned:** its door and card, its pending card, `liesTold` until it answers, its
  race-day tips (`conditions` where it is `tipped`; the owner is not told), its jobs (nobble, box), its
  bets, its `intel`, its private flags, You Paid, its off-season notice, its private log lines.
- **Public:** cash, cargo, every dog's stats and known style, declarations, the locked fields, races,
  results, the Stewards' findings, turn order and reasons, `done`, standings, staff.
- **Devtools and the full state:** every secret row is readable. **The log and the seed:** every row is
  computable, future draws included, because the seed and the log *are* the game; and the log alone, with
  no seed, already shows every door, bet, box and card choice as it is made.

### 4. The engine in a Worker

`shots/worker/`: `wrangler` **4.143.0** installed locally, `wrangler dev` on `workerd`, **no account and
no login needed**. A Worker route and a SQLite-backed Durable Object (`new_sqlite_classes`, as the free
plan requires), importing `packages/engine/src/index.ts` directly. Bundle: **261 KiB, 69.9 KiB gzipped**.

| Where | What | Time (in `Date.now()`) | Wall |
|---|---|---|---|
| Worker | create + drive 6 Normal AIs, 1 season | 147 ms (cold) | 0.17 s |
| Worker | the same, 5 seasons | 344 ms | 0.35 s |
| Durable Object | 1 season, and store the 37 KB log | 77 ms | 0.10 s |
| Durable Object | replay that season from storage (read 1 ms) | 63 ms | 0.07 s |
| Durable Object | 5 seasons, store the 199 KB log in two 100 KB values | 253 ms | 0.26 s |
| Durable Object | replay five seasons from storage (read 1–2 ms) | 217–220 ms | 0.22 s |

**Standings identical to Node, to the Bone**, for one season (Auntie Gruel 64,046 … The Widow Cray
35,485) and five (The Widow Cray 175,076 … Madame Ossory 117,729). No `wrangler.toml` in the repo, no
deploy; `shots/worker` has its own `wrangler.jsonc` and `node_modules`, both excluded.

### 5. Cloudflare and PartyKit, searched today

Cited in `ONLINE_PLAN.md` §9. The facts the plan leans on:

- **Durable Objects are on the Workers Free plan** (since 7 April 2025), **SQLite storage only**: 100,000
  requests and 13,000 GB-s a day; rows read 5 M and written 100,000 a day; 5 GB stored. SQLite storage
  billing began 7 January 2026. Paid: $5 a month minimum; 1 M requests and 400,000 GB-s a month included.
- **Incoming WebSocket messages bill at 20 : 1**; a hibernation-eligible object is **not billed for
  duration** while idle. `serializeAttachment` holds 16 KiB a socket; a WebSocket message can be 32 MiB
  (raised from 1 MiB, October 2025).
- **CPU:** a Worker gets 10 ms on the free plan; a Durable Object 30 s by default (up to 5 minutes).
  Per object: 10 GB, a soft 1,000 requests a second.
- **PartyKit** joined Cloudflare in April 2024 ("deploy to your own Cloudflare account"). It is now the
  `cloudflare/partykit` repo of libraries on Durable Objects: `partyserver` (rooms, hooks, broadcast,
  hibernation) and `partysocket` (a reconnecting WebSocket), plus `y-partyserver`, `partysub`,
  `partysync` and others. The old hosted platform's future is not stated anywhere I could find.
- A third-party tracker had logged a "2 September 2026 restriction" on free-plan Durable Objects and
  retracted it: the same terms are on the pricing page as far back as April 2025.

**An evening** (three games, 4 humans + 2 AIs): about 2,000 incoming messages (≈100 billed requests), a
few thousand rows written, under 1 MB stored, a few GB-s. **Under 1% of one day's free allowance.**

---

## Part 2: Jesse's answers

Five questions, one at a time, each with the recommendation first. **Jesse took the recommendation all
five times.**

| # | Question | Answer | Decision |
|---|---|---|---|
| 1 | What may a browser see? | **Own view only** — the room holds the game and sends each seat what it may see | **V24** |
| 2 | Waiting for a slow player | **No timer, a nudge** — the waiting line names who and how long | **V25** |
| 3 | Somebody's connection drops | **Wait; the host can hand the seat to a Normal AI** until they are back; no kicking | **V26** |
| 4 | Race day together | **Each browser moves on alone** | **V27** |
| 5 | Joining | **A link that shows a six-letter code; one seat a browser** (hotseat inside online waits) | **V28** |

---

## Part 3: the plan in brief

`design/ONLINE_PLAN.md`, CURRENT, mirrored.

- **The shape:** a Worker that only routes `/room/:code`, and one Durable Object per room with the
  Hibernation API, storing the setup and one SQLite row per action, replaying on wake, driving the AI
  seats with `drive()`, and sending each socket its seat's `viewFor` as changed top-level fields.
  `partysocket` on the client; raw Durable Objects on the server (`partyserver` allowed if the L2
  builder argues for it).
- **The protocol:** `hello` / `act` / `nudge` / `lobby` / `start` / `standIn` in; `welcome` / `lobby` /
  `view` / `rejected` / `nudged` / `ended` / `reload` out. A seat token in `localStorage` is the whole of
  identity. Two actions are queued by the room: an early door, and "Fly on" after the races.
- **The engine (L1), all additive, no golden moves:** `viewFor` and a `SEAT_SECRETS` table;
  `rumoursFor`; the off-season in any order; `PROTOCOL_VERSION`. **The named-AI draw does not matter to a
  room** (it stores its setup, names included); it matters only for an online report's seed link, as in
  hotseat.
- **The web (L3):** the lobby; the store with an online source; `screenFor` without pass screens and with
  a waiting state; the two fog readers; reconnect and reload strips; "Play online" only when
  `VITE_ROOMS_URL` is set.
- **Versions:** `PROTOCOL_VERSION` in `hello`, `reload` on a mismatch; a room remembers the
  `STATE_VERSION` it started on and closes rather than replay under another; deploy between evenings.
- **Testing:** `viewFor`'s row tests and an indistinguishability test; `online-walk.ts` with headless
  clients that scans every view received for secrets; wake-and-replay hashes; two browsers in Playwright;
  hotseat's checks unchanged.
- **Phases:** **L1** the engine's half (before the evening); **L2** the room, local only (before);
  **L3** the web online (either; after is safer); **L4** live on Jesse's account and the first online
  evening (after).

---

## Open questions

1. ❓ **Which build phase first?** The plan says L1, then L2, both safe before the evening because they
   touch nothing the evening plays. Or the evening first and nothing online until it is read.
2. ❓ **L4's deploy:** Workers Builds from the repo (deploys on every push to `main`, so pushes wait for
   quiet evenings) or `wrangler deploy` by hand. Decide at L4.
3. ❓ **`liesTold` at resolve** (Read this first 2): a rule-neutral engine fix, or leave it to the view.
4. Carried, untouched: **the evening** (`design/PLAYTEST_CHECKLIST.md`, unplayed); the Title's stale
   "What is in this build" panel and a seed link that carries AI names (J's open questions 1 and 2);
   §7.5 / §14 Q5 split view; §14 Q9; more human faces; the goldens cannot see betting or humans.

---

## The rules that did not bend

```
$ git diff v3j --stat -- packages
(nothing)
```

- **Goldens:** `41a8c8b5…` (one season) and `d4bb14c3…` (two seasons), unmoved. `npm test` **51 green**.
- **`SAVE_VERSION` 13, `STATE_VERSION` 13.**
- No `packages/server`, no `wrangler.toml` in the repo, no deploy, nothing on Jesse's Cloudflare account.
- Only the documents this phase edits were touched; nothing was reformatted.

### The re-baseline

- `npm test` 51 green; `npm run lint` clean; `npm run build` ✅.
- `season-check`: all seasons played out clean (four humans, two seasons: 217 passes, 0 leaks; the short
  target: 135 passes, 0 leaks).
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**

### `npm run harness -- --seasons 50` (per CLAUDE.md)

```
Space Dog Racing harness — 50 seasons, stables: normal, normal, normal, normal, normal, normal, seeds 1…50

End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

  all stables: decisions 7.53 a weekend · entered 2.12 of 3 (band 1.8–2.4: MET) · races/dog 6.64 (band 5–7: MET)
Purse pool: 240,860 posted a season, 47.6% of it reaching a player (v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)
```

Identical to `v3j`'s.

### The acceptance table

| Measure | Target | `v3k` |
|---|---|---|
| Log, state and tick-log sizes; replay time; the secret list; the engine in a Worker | measured, in the notes | ✅ Part 1 |
| Cloudflare's current limits and prices, and PartyKit's status | searched and cited | ✅ `ONLINE_PLAN.md` §9 |
| Jesse's questions | ≤ 5, one at a time, each a V decision | ✅ five, V24–V28 |
| `design/ONLINE_PLAN.md` | written, CURRENT, mirrored | ✅ |
| The build phases | one session each, acceptance tables, before / after the evening | ✅ L1–L4 |
| No change under `packages/`; goldens; tests; lint; `season-check`; `asset-check` | ✅ | ✅ all, 288 / 0 / 0 |

## Commits

1. `e23e02e` Write the online plan: a room per game, each seat its own view.
2. `fc1805d` Record V24–V28, Phase K and the L phases, and ONLINE_PLAN in CANON (GDD_V3 §3 and §13,
   BUILD_PLAN_V3 Phase K and L1–L4, BUILD_PLAN.md §6b.9 and Prompt M6 marked superseded, CANON).
3. These notes and the prompt, with its correction box. Tagged **`v3k`**.

---

## ⚠️ The v3k checklist, multiple choice

1. **Does the plan read right?** *Yes · Mostly, one thing's off (what?) · No, rethink it*
2. **Which build phase first?** *L1 then L2 now, before the evening · The evening first, then L1 ·
   Straight to L1–L3 in one go*
3. **When it's live, how will you deploy the server?** *Automatically on every push · By hand when I
   choose · Decide at L4*
