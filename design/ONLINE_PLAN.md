# Space Dog Racing — Online Plan

> **Status: CURRENT.** Build online multiplayer from this document.
>
> Canonical copy: `design/ONLINE_PLAN.md` in the `space-dog-racing` repo. A copy in a claude.ai
> Project is a **mirror**, last synced 30 September 2026 (at `v3l3`) — edit the repo, never the mirror.
> See `design/CANON.md`.
>
> Written in v3 Phase K (`v3k`). It replaces `design/BUILD_PLAN.md` §6b.9 and "Prompt M6", which were
> written for v1's rules and are now historical. The rules are `design/GDD_V3.md`; this document is
> only about how several browsers play them together. Jesse's five answers are GDD_V3 §13's
> **V24–V28**. The measurements behind every number here are in `claude/V3_PHASE_K_NOTES.md`.

Companion to `design/GDD_V3.md` and `design/BUILD_PLAN_V3.md`. The brief's first page asked for this
("eventually I would like to make it online multiplayer, where you choose how many human and AI
players"). It was M5, then M6 behind v2 (GDD D16). This is the plan for building it on v3's rules.

---

## 0. In one paragraph

The host opens a room and gets a link with a six-letter code on it. Friends open the link, type a name,
pick a face, and sit down; the host fills the empty seats with AIs and presses Start. **A Cloudflare
Durable Object — one per room — holds the game and runs the same `@sdr/engine` the browser runs in
hotseat.** Browsers send actions; the room checks them with the engine, drives the AI seats, stores the
log, and sends **each seat only what that player may see** (`viewFor`). Nobody's browser ever holds the
seed, next week's market, another stable's door, bet or nobble, or a style that has not raced. Turns
that are in order in hotseat are in order online, with no timer: the screen says who we are waiting on,
and anybody can nudge them. A dropped player's seat waits for them, and the host can let a Normal AI
play it until they are back. Race day plays from the same tick logs in every browser, and each browser
moves on when it is done. Hotseat stays exactly as it is.

---

## 1. Standing calls this plan keeps

- Every rule, number and 🎲 target is as `v3j` left it. **Nothing here changes a rule.**
- **Hotseat stays.** Online is added beside it: a "Play online" button on the Title, and the same
  screens. `season-check` and the table walk must read exactly what they read at `v3j`.
- **Hosting stays on Cloudflare**, on the same account as the Pages site.
- **Keep it simple.** No accounts, no database, no matchmaking, no payments. A game is played with
  friends by link. §11 lists what is out.

---

## 2. The shape

```
 browser (seat A) ─┐   WebSocket    ┌──────────────────────────────────────────────┐
 browser (seat B) ─┼──────────────▶ │ Worker "sdr-rooms" (routes /room/CODE only)   │
 browser (seat C) ─┘                │   └▶ Durable Object "Room", one per code      │
                                    │        setup + log in SQLite                 │
                                    │        GameState in memory (replayed on wake) │
                                    │        drive(): AI seats and system phases    │
                                    │        viewFor(state, seat) → each socket     │
                                    └──────────────────────────────────────────────┘
 Pages site (unchanged host) serves the web app; the app reads the rooms URL from a build variable.
```

### 2.1 Server pieces

- **`packages/server`**: one Worker and one Durable Object class, `Room`. **Raw Durable Objects with the
  WebSocket Hibernation API**, not PartyKit: the whole server is a few hundred lines, and PartyKit today
  is a set of libraries on top of the same Durable Objects (§9.3). The client uses **`partysocket`** for
  reconnection and buffering, which works against a plain WebSocket.
- **The Worker only routes** `GET /room/:code` (WebSocket upgrade) and `POST /room` (create, returns a
  code) to `env.ROOM.idFromName(code)`. It never runs the engine: on the free plan a Worker invocation
  has 10 ms of CPU; a Durable Object request has 30 s (§9.1).
- **Codes:** six letters from an alphabet with no look-alikes (`ABCDEFGHJKMNPQRSTUVWXYZ`), drawn in the
  Worker; `POST /room` retries if a room already has state.
- **Seeds are drawn by the room** (`crypto.getRandomValues`) at Start. The room is not the engine, so
  CLAUDE.md's `Math.random` rule is untouched: the engine still receives a seed and nothing else random.

### 2.2 What a room stores, and for how long

| Key | What | When written |
|---|---|---|
| `room` | code, created-at, host seat, protocol and `STATE_VERSION` it was created on | on create |
| `seats` | per seat: name, face (colour), kind, AI difficulty, a random **seat token**, stand-in on/off | lobby, stand-in |
| `setup` | the `SeasonSetup` it started with, names and all | at Start |
| `log` | one SQLite row per applied action, in order | every action |
| `queue` *(added at `v3l2`)* | a held door or "Fly on" per seat (§5.1), until applied or dropped; never the log | a held press |

- **The state is never stored.** On wake the room replays `setup` + `log` (measured: 63 ms for a season,
  220 ms for five, in `workerd`). One source of truth, and nothing to migrate.
- **A room lives 30 days after its last action**, then an alarm deletes it. That covers "we'll finish it
  tomorrow" and reading the report the next day, and keeps the free plan's 5 GB untouched (a five-season
  log is ~200 KB).
- **No personal data** beyond the names typed at the door.

### 2.3 Where AI seats run

In the room, with `drive()`, exactly as `store/loop.ts`'s `applyActions` does in the browser: after
every human action the room drives AI seats and system phases until a human is on the clock. A
Normal AI's weekend costs well under a millisecond per action; the only heavy step is race day's
`AdvancePhase` (median 10.6 ms, max 17.5 ms).

### 2.4 The protocol

JSON text frames. `v` is **`PROTOCOL_VERSION`** (§7). Every client→server message may carry `seq`, echoed
in the reply.

**Client → room**

| Message | When | Example |
|---|---|---|
| `hello` | on every (re)connect | `{"t":"hello","v":1,"token":"k3…" }` or, new at the door, `{"t":"hello","v":1,"name":"Aroha","colour":3}` |
| `act` | any game action, own seat only | `{"t":"act","seq":41,"actions":[{"t":"TradeFood","playerId":"p2","good":"scrapmeat","units":4}]}` |
| `nudge` | anybody, at the seat on the clock | `{"t":"nudge","seat":"p3"}` |
| `lobby` | host, before Start: length, AI rows, empty seats | `{"t":"lobby","length":{"kind":"seasons","seasons":2},"ai":[{"difficulty":"normal"},{"difficulty":"hard"}]}` |
| `start` | host, once | `{"t":"start"}` |
| `standIn` | host (§5.3), for a disconnected human | `{"t":"standIn","seat":"p3","on":true}` |
| `hello`, looking *(added at `v3l3`)* | at the door, before a name: no token, no name, no face | `{"t":"hello","v":1}` — answered with `lobby`, and every change to it; seats nobody |
| `playAgain` *(added at `v3l3`)* | host, after the game's end (§2.6) | `{"t":"playAgain"}` |

**Room → client**

| Message | When | Example |
|---|---|---|
| `welcome` | after `hello` | `{"t":"welcome","v":1,"code":"KFZQPX","seat":"p2","token":"k3…","host":false}` |
| `lobby` | lobby changes | `{"t":"lobby","seats":[{"name":"Jesse","colour":7,"kind":"human","online":true},…],"length":…}` |
| `view` | after every change, to every socket | `{"t":"view","rev":212,"full":false,"patch":{"planet":{…},"done":["p1"]},"meta":{…}}` |
| `rejected` | an action the engine refused | `{"t":"rejected","seq":41,"error":"Only 3 crates of Scrapmeat on the shelf"}` |
| `nudged` | to the nudged seat | `{"t":"nudged","by":"Aroha"}` |
| `ended` | game over, to everybody | `{"t":"ended","setup":{…},"log":[…]}` |
| `reload` | the browser's build is not the room's | `{"t":"reload","need":2}` |
| `moved` *(added at `v3l3`)* | Play again made a successor (§2.6): to every socket, and to every later `hello` | `{"t":"moved","code":"TABFWA"}` |

- **`view`** carries the seat's `viewFor` (§3) as either the whole view (`full:true`, on `hello` and
  whenever `rev` jumps) or **the top-level fields that changed** (`full:false`). Measured on a four-human
  season: mean 15.3 KB a change (2.6 KB gzipped), max 158 KB (race day's tick logs), about **6 MB a seat
  a season** raw; sending the whole state every time would be ~40 MB. No diff library is needed: the
  client replaces those fields.
- **`meta`** is what the view does not carry and the room knows: who is on the clock and since when,
  who is connected, who has a stand-in, whose door is queued, the host.
- **The room checks every `act`:** the `playerId` must be the socket's own seat; `AdvancePhase` is never
  accepted from a browser; the actions are applied to a copy with `reduceMut` and, on an `ActionError`,
  the copy is thrown away and the seat is told why. Nothing reaches the log that the engine refused.
- **Two queued actions (§5.1):** a `ChooseDoor` from a seat that is not yet on the clock at Explore, and
  the after-races "Fly on" `EndPhase` at `planetPost`, are **held** by the room and applied the moment
  that seat comes on the clock. Everything else from a seat not on the clock is `rejected`, exactly as
  the engine would.

### 2.5 Reconnecting

The seat token is kept in the browser's `localStorage` under the room code. Reopening the link sends
`hello` with it and gets the same seat, a `full` view and the same screen. `partysocket` retries a
dropped socket on its own. **A refresh mid-season loses nothing**, because the browser holds nothing the
room does not. A new browser without the token cannot take an occupied human seat; it can take a seat
the host left open in the lobby, and nothing else.

### 2.6 How a room ends

At game over the room sends `ended` with the full `setup` and `log` — the game is over, so the secrets
are not secret any more — and every browser shows the game's end exactly as hotseat does: chart,
moments, **Copy the report** (`lib/report.ts` runs on the log unchanged). The room then only answers
`hello` with the final view. **Play again** on the game's end opens a new room with the same seats and
the same seed, and the same people's links follow it (the old room sends its successor's code).

*Built at `v3l3` (GDD_V3 L3c):* the host's `playAgain` has the old room draw a code and hand the new
room its seats (names, faces **and tokens**), AI rows, length and `setup` — so the same seed — which
starts at once. The old room keeps the code (`movedTo`) and sends `moved` to every socket, and to every
later `hello`. Each browser copies its token to the new code and follows. A second press gets the same
`moved`; anyone else's is refused.

---

## 3. What each browser sees

**V24: the room holds the game and sends each seat its own view.** Anyone with devtools could otherwise
read next week's prices, every door and card, rivals' bets and nobbles and every hidden style
(pillar 4). Among friends the bigger reason is that these are **spoilers**: with only its own view in
the browser, no UI slip can ever show one.

### 3.1 The secret list

Walked field by field from `GameState` (`types.ts`) at `v3j`. "Full state" is what the old M6 spec
would have put in every browser; "log + seed" is what its action broadcast would have. **Every row is
readable in devtools from the full state, and computable from the log and the seed** — the seed and the
log reproduce the whole game, including every draw not yet made; and the log alone, without the seed,
already shows every door, bet, box and card choice as it is made.

| Field | The secret | Who may see it | `viewFor` does |
|---|---|---|---|
| `seed`, `rng` | every future draw | nobody until game over | `0` |
| `calendar[w].planetId`, w > week + 1 | the circuit past next week (§2.1's fog) | nobody (week 10 is Collar Prime and public) | `''` for the dark weeks |
| `nextPlanet` | next week's market (§9.4) | a stable holding `intel` for it, for those goods | keep the seat's intel goods; the rest zeroed |
| `explore.seeds` | every stable's Explore stream: every card behind every door | nobody | `{}` |
| `explore.picks`, `explore.cards` | which door a stable opened, what was behind it | that stable | own entries only |
| `explore.taken` | which one-of-a-kind cards others drew | nobody (it reveals doors) | `[]` |
| `pendingEvent.params`, `.rng` | an offered dog's true stats and whether the patter lies; the dice behind a gamble's outcome | nobody, **not even its owner** | params cut to the display keys (`staffId`, `offerName`); `rng` `0` |
| `pendingEvent` (another's) | their card | its owner | `null` unless it is the seat's |
| `players[].stats.liesTold` | counted when the offer is **rolled**, so it says "he's lying" before the choice | the seat, after it chooses | the pending offer's lie taken back off until resolved |
| `dogs[d].style` where `!styleKnown` | a style that has not raced (§5.4), the owner's included | nobody | a placeholder, with `styleKnown` still false |
| `conditions` | a hidden knock, off-feed or buzz (§9.4) | the stables it `tipped` (not the owner, unless tipped) | only entries tipping the seat |
| `jobs` | a nobble booked, a box bought, before they land | the stable that booked it | own jobs only |
| `bets` (another's) | rivals' slips (§3) | their owner; the season's archived moments later | own bets only |
| `players[].intel` | what a Bar card told a stable | that stable | own only |
| `players[].flags.tipOff`, `arriveFirstNextWeek`, `arriveLastNextWeek` | the result of a private card | that stable, until arrival makes it public | own only (others `false`) |
| `players[].paid` | You Paid (§6.2) | that stable | own only (others zeroed) |
| `offSeason.notices[x]` | a retirement offer (true stats, lie), the draft's pick, a candidate | that stable, as §9.2 shows it | own only, `offer` cut to what `describeRetirementOffer` shows |
| `eventLog` lines with a `playerId` | private card text, tips, "your man got to…" | that stable (the hub already filters so) | own and public lines only |
| `players[].stats`, the private counters *(added at `v3l1`)* | `betIncome`, `dogOffers`, `tips`, `nobbles`, `boxes`, `staffOffers` and the rest move **the moment** a slip, a card, a tip, a nobble or a box happens, so another stable's counters say "Ruby just booked a nobble" | that stable; the season's archive (`seasons[].stats`) is public once the season ends | zeroed on every other stable; `prizeIncome`, `commission`, `tradeIncome`, `costs`, `caught`, `fines` and `worthByWeek` stay (all public already) |
| `dogs[d].raceBonus` (another's) *(added at `v3l1`)* | a card's edge for this weekend's race (the lucky bone) | the dog's owner | `0` |

**Public, and left alone:** cash, cargo (it is in net worth, and the leaderboard shows its value), every
dog's stats, rating, fitness, form, age, traits and injuries, `styleKnown` styles, `declarations` (public
as made, §7.3), `fields` and `races` (after the lock; `RaceResult.runs` names styles only of dogs that
have now raced), `results`, the Stewards' findings, `turnOrder` and its reasons, `done`, `seasons`,
`finalStandings`, staff.

⚠️ **Cash is public, so spending shows** (found building `v3l1`). A nobble, a box, a Bar tip and a stake
all leave a stable's cash the moment they are paid, and cash is on the leaderboard. A view shows that
Ruby spent 300 Bones; it never shows on what, on whom or on which dog. That is the same as hotseat's
leaderboard and is left alone: hiding cash would hide net worth, and pillar 4 says the scoreboard is
public.

⚠️ **The table is the code.** `SEAT_SECRETS` in `packages/engine/src/view.ts` is this table, row for row
(twenty rows at `v3l1`), and `test/view.test.ts` fails if a row has no test.

⚠️ **Rumours** (`web/lib/rumours.ts`) read the seed and the calendar two weeks out. They move into the
engine as a pure `rumoursFor(s)` with the same output, and the view carries the list; the web's hotseat
calls the same function.

### 3.2 What that costs, and what it buys

- The browser cannot reduce locally online (it lacks the seed), so every press is a round trip. On
  Cloudflare's edge that is tens of milliseconds, and nothing in the game is twitchy.
- Pillar 4 holds by construction, and the screens need no online-only care about what not to show.

---

## 4. The engine changes

> **Built at `v3l1` (29 September 2026).** All four, as below; neither golden moved. The off-season's
> any-order needed one more piece than planned: see item 3. Notes: `claude/V3_PHASE_L1_NOTES.md`.

All additive and pure, in one phase (`v3l1`). **None moves a golden**: the goldens are all-AI tables
driven in turn order, which nothing below changes. `STATE_VERSION` and `SAVE_VERSION` stay 13.

1. **`viewFor(s: GameState, seat: Id): GameState`** in `src/view.ts`: a redacted deep copy of the same
   type, per §3.1, so every screen reads a view exactly as it reads a state. A table of the secret rows
   lives beside it (`SEAT_SECRETS`), so a new secret field is a row and a test, not a hunt. At game over
   it returns the state unredacted.
2. **`rumoursFor(s)`** moved from `web/lib/rumours.ts` into the engine, unchanged in output.
3. **The off-season in any order.** Every answer is rolled when the off-season opens and nothing a
   stable answers draws anything (§2.2), so `Retire`, `ResolveStaffNotice` and `EndPhase` can accept any
   stable not yet finished, as the Bookie's did at `v3e2` (E8). Proven the same way: every order of four
   humans gives the same state, byte for byte. Online this lets everybody do the off-season at once.
   *Built:* two things in the off-season do depend on order, and both are bookkeeping — a replacement dog
   takes the next id off the counter, and each answer appends to the event log. `fileInTurnOrder`
   (`phases/offSeason.ts`) re-files them as turn order would have, the Bookie's `slipIndex` pattern:
   replacements are renumbered in turn order from where the counter stood, and each stable's answer
   lines kept together, stables in turn order (the notice counts its own lines in an optional
   `logLines`, gone with the off-season at the new season). Answered in turn order both are no-ops, so no
   AI table, golden or hotseat game moves.
4. **`PROTOCOL_VERSION`** exported (§7).

**Not needed:**

- **Explore stays in turn order in the engine.** It is "simultaneous, played in turn order" (`explore.ts`)
  because a one-of-a-kind card goes to the first stable through the door. The room's queue (§5.1) gives
  the online table the simultaneous feel without touching the rule or the state's shape.
- **A stand-in needs no engine change:** it is the room calling `decide(state, seat, 'normal')` for a
  human seat and applying what comes back as ordinary actions. The log cannot tell a stand-in's action
  from its human's, and does not need to. `v3l1` tests that `decide` plays a human seat (no personality)
  through a whole season.
- **The named-AI draw (J notes, Read this first 1) does not matter to a room.** A named AI draws its
  personality from the game's stream, so a seed link without names does not replay. A room stores its
  whole `setup`, names included, so resuming, waking and Play again are all exact. It matters only for
  the seed link in an online game's copied report, exactly as in hotseat, and J's open question 2 is
  the fix for both.

---

## 5. The table online

### 5.1 Waiting (V25)

**No timer; a nudge.** The weekend runs in the same order as hotseat (GDD_V3 §2.3), and the same parts
are in turn order because the shelf is shared and the declarations are public as made.

| Step | Online |
|---|---|
| Arrival | each browser reads it and presses on alone |
| Explore | **anybody picks a door at any time.** The room queues it and applies it when that seat comes up in turn order; the card appears then. The wait is only for the stables ahead to answer their cards |
| Market + Kennel + Race Office | one sitting a stable, in turn order. Everybody else sees **"Waiting on Ruby — Market and Race Office · 1:20 · Nudge"**, can read their own kennel, the leaderboard and the map, and **watch declarations land on the board live** |
| Bookie | everybody at once (E8, already built) |
| Race day | §5.4 |
| After the races | "Fly on" is queued (§2.4); a stable that wants the market again takes its turn in order |
| Off-season | everybody at once (§4 item 3) |

⚠️ *Corrected at `v3l3` (GDD_V3 L3b):* this table said a waiting stable could also "pick next week's
diet". The engine takes a diet (`SetDogState`) only from the stable on the clock, in `planetPre` or
`planetPost`, and the engine does not change for online play; so the diet is set in the stable's own
sitting, as in hotseat, and the Kennels are read-only while waiting.

*Built at `v3l3` (GDD_V3 L3a):* the waiting line names **only the humans** being waited on, in turn
order; with only AI or stood-in seats left it says "Waiting on the AIs".

A **nudge** plays a short sound and flashes the tab title on the nudged browser, at most once a
minute per seat. The waiting line shows how long the seat has been on the clock, so the table can
see a stall for itself.

### 5.2 Hotseat inside online (V28): not yet

One browser, one seat. Two people on one laptop in an online room would bring pass screens back inside
online play; it waits until somebody asks.

### 5.3 Somebody leaves (V26)

**The table waits, and the host can hand the seat to an AI.** A seat whose socket closes shows
"reconnecting…" beside its name. The host (or, while the host is away, the next connected human in seat
order) can press **"Let an AI play for them"**: the room plays that seat as Normal (§4) whenever it is on
the clock, until its human reconnects, when it hands straight back — at the next decision, never
mid-sitting. The seat's name shows "(AI standing in)". **Nobody can be kicked.** Stand-in time is
recorded in the room so the report can say "Aroha's seat was played by an AI for 3 weekends".

*Built at `v3l2` (GDD_V3 L2b):* a stand-in weekend is one in which the stand-in pressed anything for the
seat. At the Bookie and in the off-season a stood-in seat plays when the turn order reaches it, exactly as
an AI seat does (`decide` plays only the active stable), so a human ahead of it can still bet first.

### 5.4 Race day (V27)

Every browser gets the same `races` in its view and plays them with the existing race view. **Each moves
on alone**: watch, skip a race, or "Skip the rest of race day", then the results, then the next weekend
as soon as it opens. The engine is already past race day by the time anybody watches (the tick log is a
recording), so the table is never held up by a watcher, and the race view's "you" is the seat's own
stable, as in single-player. Spoilers across a sofa or a voice call are the table's own business.

### 5.5 Joining (V28)

**A link and a code; a name at the door; no accounts.** "Play online → Create a room" on the Title opens
the lobby with a link (`…/?room=KFZQPX`) and the code, big, for reading aloud. A joiner types a name and
picks a face (the Title's picker; faces already taken are shown taken, as in hotseat). The host sets the
length (seasons or a target), adds AI seats, and presses **Start** when everybody is in. 3–8 stables, at
least one human. Seats are in joining order; a human's face is their colour, as in hotseat.

*Built at `v3l2` (GDD_V3 L2a):* the host is the first to sit down. A browser that closes in the lobby
keeps its seat and can take it back with its token; nobody can free it, so the game starts with it and a
stand-in can play it (§5.3). A name is 1–24 letters; a face is required.

---

## 6. The web changes

**Shared with hotseat, unchanged:** every screen, `race-view/`, the pace timer, the report, the face
picker. They read a `GameState`; online it is a view.

1. **The lobby:** `screens/Lobby.tsx` — create, join by link or code, name and face, the seats as they
   fill, the host's length and AI rows and Start.
2. **The store talks to a socket.** `gameStore` gets a `source: 'local' | 'online'`. Local is today's
   code. Online, `dispatch` sends `act` and the next `view` replaces `state`; `log` is empty until
   `ended`; nothing is written to the save (the room is the save); an `ActionError` comes back as
   `rejected` into the same `error` field the screens already show.
3. **`screenFor` online:** `me` is always the browser's own seat; **no pass screens**; the table's public
   moments (arrival, the board, races, results, the season's end) are acknowledged per browser in the
   `ui` fields that already exist; and a new `waiting` state over the hub when the seat is not on the
   clock (§5.1). `PRIVATE_SCREENS` stays as the hotseat rule and `season-check` still enforces it.
4. **The two fog readers:** `GalaxyMap` looks a planet up only for weeks that are not dark (a one-line
   move; it currently calls `planetOf` for every week), and `rumours` comes from the view.
5. **Race day** plays from the view's `races`; "Skip the rest of race day" only moves this browser on.
6. **Reconnect UI:** a small "reconnecting…" strip; `reload` shows "a new version is out — reload".
7. **Config:** the rooms URL is a build variable (`VITE_ROOMS_URL`); without it the Title hides "Play
   online", so a build without a server is exactly today's game.

---

## 7. Versions

- **`PROTOCOL_VERSION`**, in the engine beside `STATE_VERSION`, starts at **1** and moves when a message's
  shape, the view's shape or a rule moves — anything that would make an old browser misread a new room.
  `hello` carries it; on a mismatch the room answers `reload` and the browser offers to reload. Like
  `SAVE_VERSION`, it is a promise to fail loudly rather than play a subtly different game.
- **A room remembers the `STATE_VERSION` it started on.** If a deploy changes the engine's, the room
  cannot trust its log to replay: it says so, shows the last standings it stored, and closes. **Deploy
  the server between evenings, never during one** — with Workers Builds deploying on every push to
  `main`, that means Jesse pushes when nobody is playing.
- The Pages site and the Worker deploy separately, so for a few minutes after a push an old web build
  can meet a new room: that is exactly the `reload` case.

---

## 8. Testing

1. **Determinism.** Online, only the room reduces, so a browser cannot diverge from it. What must hold is
   that **a room replayed on wake is the room before sleep**: a test hashes the state before an eviction
   and after the replay. The engine's own guarantee (same seed and log, any JS engine) is already
   `golden.test.ts` and `determinism.test.ts`; the Phase K spike ran a 6-AI season on `workerd` and on
   Node with standings identical to the Bone (1 and 5 seasons).
2. **`viewFor`'s tests (`v3l1`), in `packages/engine/test/view.test.ts`:**
   - every `SEAT_SECRETS` row: the view hides it from every other seat and shows it to the seat allowed;
   - **indistinguishability:** change one stable's secret (a bet, a door, intel, a job, a pending offer's
     stats, a hidden style) and every *other* seat's view is byte-identical;
   - a view round-trips through the web's selectors for every seat and every screen of a two-season
     table without a throw (a headless walk, below).
3. **`online-walk.ts` (`v3l2`/`v3l3`), in the style of `table-walk.ts`:** N clients against the room under
   `wrangler dev` (or `@cloudflare/vitest-pool-workers`), each pressing only what its own view offers.
   It checks: everybody finishes a two-season game; **no client ever receives a secret** (every view
   received is scanned against the full state's secret rows); a client dropped mid-sitting rejoins with
   its token to the same view; a stand-in plays a dropped seat and hands back; a queued door and a
   queued "Fly on" apply in turn order; a stale `v` gets `reload`; a spoofed `playerId` is rejected.
4. **Two real browsers** (Playwright, two contexts) play a weekend against `wrangler dev`; screenshots at
   1280 and 390.
5. **Hotseat does not move:** `season-check`, `hub-clicks`, the table walk and `race-view-check` read
   exactly what they read at `v3j` after every online phase.

---

## 9. Cost

### 9.1 Cloudflare, searched 29 September 2026

| | Workers **Free** | Workers **Paid** ($5 a month minimum) |
|---|---|---|
| Durable Objects | **available, SQLite storage only** (since April 2025) | SQLite or key-value |
| DO requests | 100,000 a day | 1 M a month, then $0.15 a million |
| DO duration | 13,000 GB-s a day | 400,000 GB-s a month, then $12.50 a million |
| Incoming WebSocket messages | billed as requests at **20 : 1** | same |
| Hibernation | a hibernation-eligible object is **not billed for duration** while idle | same |
| SQLite rows read / written | 5 M / 100,000 a day | 25 bn / 50 M a month included |
| SQLite stored | 5 GB total | 5 GB-month, then $0.20 a GB-month |
| CPU per request | Worker: **10 ms**; Durable Object: 30 s default (up to 5 min) | Worker 30 s default; DO the same |
| Per object | 10 GB storage, ~1,000 requests a second soft limit, 32 MiB WebSocket messages, 16 KiB `serializeAttachment` | same |

### 9.2 An evening

Three games of 4 humans and 2 AIs, one or two seasons each (the playtest evening's shape): about
2,000 human actions, so 2,000 incoming messages (100 billed requests at 20 : 1) plus a few dozen
connects; a few thousand log rows written; under a megabyte stored; duration a few GB-s at most, and
nothing while hibernating. **Under 1% of one day's free allowance. The evening costs nothing, on the
free plan.** The Worker's 10 ms free-plan CPU is not a constraint because the Worker only routes; the
engine runs in the Durable Object. The paid plan buys nothing this game needs.

### 9.3 PartyKit

PartyKit joined Cloudflare in April 2024; existing projects were told they could deploy to their own
Cloudflare account. Today the code lives at `cloudflare/partykit` as libraries on Durable Objects:
**`partyserver`** (rooms, `onConnect`/`onMessage`, broadcast, connection tags, hibernation with
`static options = { hibernate: true }`) and **`partysocket`** (a reconnecting, buffering WebSocket). The
plan uses `partysocket` on the client and raw Durable Objects on the server; `partyserver` is an
acceptable swap in `v3l2` if it makes the server shorter, and the builder says why in one paragraph.

Sources: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[DO release notes](https://developers.cloudflare.com/durable-objects/release-notes/),
[WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[PartyKit joins Cloudflare](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/),
[cloudflare/partykit](https://github.com/cloudflare/partykit),
[partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md).

---

## 10. The build phases

Four sessions, in order. Each keeps both goldens, `npm test`, lint, `season-check` and `asset-check`
where they are, and each ends with the harness summary equal to `v3j`'s. **"Before the evening"** means
it cannot change how the playtest evening plays (no rule, no hotseat screen); "after" means it waits for
the evening's results.

### Phase L1 — the engine's half: `viewFor` (1 session) → `v3l1` · **before the evening**

> **Status: DONE at `v3l1` (29 September 2026).** Built in the session after K, at Jesse's call.
>
> | Measure | `v3l1` |
> |---|---|
> | Every §3.1 row hidden / shown | ✅ 20 rows × 2 tables, a plant each; the test fails on a row without one |
> | Indistinguishability | ✅ every row, 4 humans + 2 AIs and 8 humans, byte-identical views |
> | Views through the web, every seat, every screen | ✅ `npm run view-walk`: two seasons, 617 moments × 4 seats × 19 screens, 46,892 renders, **0 throws** the state does not also throw; GalaxyMap's dark-week lookup (§6 item 4) counted apart, 14 weekends |
> | Off-season in any order | ✅ 24 orders and 40 random interleavings of presses, one state |
> | `decide` plays a human seat | ✅ four human seats, a season, and the log replays |
> | `rumoursFor` unchanged | ✅ 50 seasons, 417 rumours, same hash as the web's at `v3j` |
> | Goldens, versions, tests, lint, hotseat checks, harness | `41a8c8b5…` / `d4bb14c3…` unmoved; 13 / 13; 184 green (51 + 133 new); clean; `season-check`, `hub-clicks`, `race-view-check` byte-identical to `v3k`; harness identical |

**Goal:** the engine can say what each seat may see, and the off-season can be answered at once.

**Deliverables:** `src/view.ts` (`viewFor`, `SEAT_SECRETS`), `rumoursFor` moved into the engine,
off-season in any order, `PROTOCOL_VERSION`, `test/view.test.ts`, a probe that walks every seat's view
through the web's selectors. No server, no web change beyond importing `rumoursFor`.

| Measure | Target |
|---|---|
| Every §3.1 row hidden from every other seat, shown to its owner | ✅, a test per row |
| Indistinguishability: one stable's secret changed, every other seat's view byte-identical | ✅, all rows, 4 and 8 seats |
| Views of a two-season, 4-human table render through the web's selectors, every seat, every screen | 0 throws |
| Off-season in any order: every order of four humans gives the same state | ✅, 24 orders |
| `decide` plays a human seat through a season (the stand-in) | ✅ |
| `rumoursFor` gives the hotseat rumours unchanged | ✅, 50 seasons |
| Goldens, `SAVE_VERSION`/`STATE_VERSION` 13, tests, lint, `season-check`, harness | unmoved |

### Phase L2 — the room (1 session) → `v3l2` · **before the evening**

> **Status: DONE at `v3l2` (30 September 2026).** `packages/server`, and `npm run online-walk` against
> `wrangler dev` 4.143.0 in the container. No deploy, no account, no web change. Notes:
> `claude/V3_PHASE_L2_NOTES.md`.
>
> | Measure | `v3l2` |
> |---|---|
> | 4 clients + 2 AIs finish a two-season game; 8 clients finish a season | ✅ 20 weekends, 1,431 log rows; 10 weekends, 902 rows |
> | No client ever receives a secret | ✅ **0 leaks** in 4,719 views, each run through all 20 `SEAT_SECRETS` rows, **and** each byte-identical to Node's `viewFor` at its `rev` (3,927 compared) after replaying the room's `ended` log |
> | A dropped client rejoins by token to the same view | ✅ byte-identical whole view, same `rev` |
> | Evicted and woken | ✅ `wrangler dev` killed and restarted on the same state in season 2: state hash equal (855 rows replayed in 154 ms), every client's whole view equal, a held door kept |
> | Stand-in plays a dropped seat and hands back at the next decision | ✅ 3 weekends played; off at the seat's `hello`; its human's next press is its own, and the count stays 3 |
> | Queued door and queued "Fly on" apply in turn order | ✅ 64 doors and 64 "Fly on"s held and applied, 0 dropped, 0 out of turn |
> | Spoofed `playerId`, client `AdvancePhase`, stale `v` | rejected, rejected, `reload` |
> | Final state equals Node's replay of the room's log | ✅ SHA-256 equal, three games |
> | Wake + replay time for a five-season room | **~400–510 ms** in `workerd` (3,604 rows, 204 KB; reading them 6–7 ms), ~475–590 ms `hello` to whole view after a restart. Node replays the same log in 220–315 ms on this container: the spike's 220 ms was on a faster one. Far inside a Durable Object's 30 s |
> | Pages build on Node 20 from a clean install | ✅ unchanged: `packages/server` is not a root workspace, so `npm ci` installs exactly `v3l1`'s 144 MB (no `wrangler`, no `workerd`); 4.0–4.5 s against 3.4–4.2 s, noise |
> | Nothing under `packages/engine` or `packages/web` changes | ✅ `git diff v3l1 --stat -- packages/engine packages/web` is empty |
>
> **Choices the plan left open** (the notes have the rest):
> - **Raw Durable Objects, not `partyserver`.** Almost all of `Room` is the game — the queue, the
>   stand-in, the views — and would be the same on either; `partyserver` would save the few lines of
>   socket plumbing at the cost of a dependency and a second hibernation layer to understand.
> - **`packages/server` is not a root workspace** (its own `package.json` and lock; the root's
>   `workspaces` names `engine` and `web`). `wrangler` 4 needs Node ≥ 22 and brings `workerd`; Pages
>   installs the root on Node 20. `npm run server:install` installs it; the root `npm test` never
>   touches it (`npm run server:test` does).
> - **The debug hook is a `debug` message** answered only under `wrangler dev --var DEV_DEBUG:1`
>   (state hash, wake time), and refused anywhere else. The leak scan does not need it: it replays
>   the `ended` log.
> - **The queue is stored** (a `queue` table, never the log). The prompt said memory; a hibernated
>   room would have dropped a held door.
> - **On the wire:** ~2.8 MB a seat a season (5.6 MB a client over two seasons at four humans), against
>   §2.4's estimate of ~6 MB: the room sends one view per change of the table, not per action.
> - Every reply echoes `seq`, `lobby` and `reload` included. `welcome` carries `stale` for §7's
>   room that cannot replay, with the last standings the room stored.

**Goal:** a room that plays a game with headless clients, locally.

**Deliverables:** `packages/server` (Worker + `Room` Durable Object, hibernation, SQLite log, replay on
wake, the protocol of §2.4, the queue of §5.1, nudge, stand-in, 30-day alarm), `wrangler.jsonc`, the
headless `online-walk.ts` against `wrangler dev`. **No deploy.**

| Measure | Target |
|---|---|
| 4 clients + 2 AIs finish a two-season game; 8 clients finish a season | ✅ |
| No client ever receives a secret | 0 leaks, every view scanned |
| A client dropped mid-sitting rejoins by token to the same view | ✅ |
| Evicted and woken: the replayed state's hash equals the state before | ✅ |
| Stand-in plays a dropped seat and hands back at the next decision | ✅ |
| Queued door and queued "Fly on" apply in turn order | ✅ |
| Spoofed `playerId`, client `AdvancePhase`, stale `v` | rejected, rejected, `reload` |
| Wake + replay time for a five-season room | measured (spike: ~220 ms) |
| Nothing under `packages/engine` or `packages/web` changes | `git diff v3l1 --stat` shows only `packages/server` |

### Phase L3 — the web online (1 session) → `v3l3` · **before or after the evening; after is safer**

> **Status: DONE at `v3l3` (30 September 2026).** Built before the evening, at Jesse's call, with the
> rule that made that safe: hotseat reads byte for byte as at `v3l2`, and a build without
> `VITE_ROOMS_URL` is today's game. No deploy, no account. Notes: `claude/V3_PHASE_L3_NOTES.md`.
>
> | Measure | `v3l3` |
> |---|---|
> | Two browsers create, join by link and by code, play a weekend, read the results | ✅ three Chromium contexts (`npm run browser-walk`): A creates, B by the link, C by the typed code, the host adds an AI; doors, a declaration, a bet, the races, the results; screenshots at 1280 and 390 |
> | Waiting line names who and how long; Nudge reaches them | ✅ "Waiting on Bex — Market and Race Office · 0:00 · Nudge"; B's tab title "★ Aroha nudged you" and a notice. Headless: 2,360 waiting screens, every name on the clock |
> | A refresh mid-sitting comes back to the same screen | ✅ B reloads in its own Market sitting: the same screen, the room still in the address bar |
> | A held door and a held "Fly on" show as held, and land in turn order | ✅ "Your door is chosen…" in the browser; headless 60 doors and 60 "Fly on"s held; `online-walk` counts 0 out of turn |
> | Headless stores finish 4 + 2 over two seasons and 8 over one; no pass screen online | ✅ `npm run online-table-walk`: real `gameStore`s in Node, 0 pass or roll-call screens in 4,452 |
> | The online report equals hotseat's over the room's log, plus the stand-in line | ✅ 12 reports byte-identical; "Cal's seat was played by an AI for 3 weekends." |
> | Play again: a new room, same seats and seed, every browser follows | ✅ in the browsers, the stores and `online-walk` (the successor hashes as Node's `createSeason(setup)`) |
> | Build without `VITE_ROOMS_URL` is today's game | ✅ no "Play online"; the Title and a hotseat weekend at 1280 and 390 pixel-identical to `v3l2` |
> | `season-check`, `hub-clicks` (9.4), table walk (10.7 / 22.4), `race-view-check` | byte-identical to `v3l2` |
> | A `v3l2` hotseat save loads and plays on; an online game neither reads nor writes it | ✅ same origin, same browser: byte-identical save across an online game, then resumed and played on |
> | Nothing under `packages/engine`; goldens; tests; `view-walk`; `server:test`; `online-walk`; harness; Pages on Node 20 | ✅ empty diff; unmoved; 184; 0 throws (GalaxyMap 0, from 14); 10; **25 rows** (two new); identical; ✅ +0.3 MB (`partysocket`) |
>
> **Choices the plan left open** (the notes have the rest):
> - **This browser's marks** (race day watched, results read, the arrival and the board) are kept in
>   `localStorage` beside the seat's token, under the room's own key — never the save's — so a refresh
>   comes back to the same screen rather than the arrival or the start of race day.
> - **A look-only `hello`** answers with the lobby, so a joiner sees the faces taken before sitting down.
> - **Waiting time is the pace timer's "table" time**, as the hotseat roll-calls are.
> - **`PROTOCOL_VERSION` stays 1**: no room has been deployed and no browser in the wild speaks it, so
>   the protocol gained `playAgain`, `moved` and the looking `hello` without a bump. **L4's first deploy
>   freezes v1**: from then on a change to any message is a bump and a `reload`.

**Goal:** two browsers play a weekend together against a local room, and hotseat is untouched.

**Deliverables:** the lobby, the store's online source, `screenFor`'s online mode and waiting state, the
fog readers, reconnect and `reload` UI, "Play online" behind `VITE_ROOMS_URL`, the browser half of
`online-walk.ts`, Playwright screenshots.

| Measure | Target |
|---|---|
| Two browsers create, join by link and by code, play a weekend, read the results | ✅, screenshots at 1280 and 390 |
| Waiting line names who and how long; Nudge reaches them | ✅ |
| A refresh mid-sitting comes back to the same screen | ✅ |
| Build without `VITE_ROOMS_URL` is today's game | ✅ no "Play online" |
| `season-check`, `hub-clicks` (9.4), table walk (10.7 / 22.4), `race-view-check` | unchanged from `v3j` |
| 🎲 Does the lobby make sense to someone who has never seen it? | 🎲 |

### Phase L4 — live, and the first online evening (1 session) → `v3l4` · **after the evening**

**Goal:** a room on Jesse's Cloudflare account that friends in different houses can use.

**Deliverables:** Workers Builds (or `wrangler deploy`, Jesse's choice at the time) for `packages/server`
on the Pages account; `VITE_ROOMS_URL` set in Pages; a smoke test against the live room; an online
section in `PLAYTEST_CHECKLIST.md`. The pace rows are set from the evening's clock: the online waiting
budget, and whether §7.5's split view is worth having online, where "each moves on alone" already cuts
the table's watching.

| Measure | Target |
|---|---|
| Two machines on different networks finish a season in one room | ✅ |
| A refresh mid-season rejoins with no loss | ✅ |
| An evening's use against the free plan | < 1% of a day's allowance, from the dashboard |
| 🎲 Is the wait for a sitting bearable without a timer? | 🎲 (V25's test) |
| 🎲 Did anybody need the host's "Let an AI play for them"? | 🎲 |
| 🎲 Did moving on alone after the races spoil anything? | 🎲 |
| 🎲 Forty minutes for four players online? | 🎲 (pillar 6, measured by the pace timer per browser) |

---

## 11. Out of scope

Kept as a list so ideas have to earn their way in. Each is out unless Jesse asks.

- Accounts, logins, profiles, friends lists.
- Matchmaking, public room lists, strangers.
- Chat, emotes, voice (the table has its own).
- Spectators and replays of other people's games.
- Async play-by-link (take your turn tomorrow). A room does keep for 30 days, so a game can be finished
  the next evening, but nothing is built for turns spread over days: no notifications, no email.
- Turn timers (V25) and kicking (V26).
- Hotseat inside an online room (V28, for later).
- Split view (§7.5, §14 Q5) — decided by the evening, not here.
- Payments, the paid plan, a custom domain.
- A database or KV beyond each room's own storage.
