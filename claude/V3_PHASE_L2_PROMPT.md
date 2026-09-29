> **Corrections, made before this file was committed** (`design/CANON.md`: a prompt is corrected before
> it lands, and frozen after). The prompt below is as given, apart from this box.
>
> 1. **"Queued actions live in memory and in `meta`"** — they are also stored, in a `queue` table (never
>    the log). With the Hibernation API a room is evicted between messages with its sockets still open,
>    so a held door kept only in memory would vanish; the walk's eviction shows one surviving.
> 2. **"The Worker never imports the engine"** — true of the routing code (`src/index.ts` imports no
>    engine; codes are in `src/code.ts`), but a Durable Object class is exported by the Worker script that
>    hosts it, so the bundle holds `Room` and the engine (297 KiB). The Worker's `fetch` never runs it.
> 3. **"While it is on, whenever that seat is on the clock the room plays it"** — at the Bookie and in the
>    off-season, where every unfinished stable is on the clock, a stand-in plays when the turn order
>    reaches the seat, as an AI seat does: `decide` returns nothing for a stable that is not the active
>    one. GDD_V3 L2b.
> 4. **The Pages question** has the answer the prompt allowed: `wrangler`'s `engines` is `node >=22`, so
>    `packages/server` is not a root workspace (its own `package.json` and lock). The root's
>    `workspaces` now names `packages/engine` and `packages/web`.
> 5. **`PROTOCOL_VERSION` stays 1**, but three shapes gained optional fields no browser reads yet: `seq`
>    on `lobby` and `reload` (every reply echoes it), and `stale` on `welcome` (§7's room). The dev-only
>    `debug` message is outside the protocol's unions.
> 6. Not a correction, a pointer: this phase needed no question for Jesse.

---

# V3 Phase L2: the room, local only

Phase L1 is done (`v3l1`, pushed). The engine can now say what each seat may see:
`viewFor(state, seat)` and its table `SEAT_SECRETS` (twenty rows), `rumoursFor`, the off-season
answered in any order, and `PROTOCOL_VERSION = 1`. `test/view.test.ts` proves every secret row is hidden
and indistinguishable. `npm run view-walk` renders every screen from every seat's view with 0 throws.
No rule, golden or save version moved.

**The evening has still not been played.** Nothing in this phase waits on it, and nothing in it may make
it harder to play. L2 touches nothing the evening plays.

**Phase L2 builds the room**: a Cloudflare Worker and a Durable Object that hold a game, run the engine,
drive the AI seats and talk to browsers over WebSockets. Everything is tested with headless clients
against `wrangler dev` in the container. **No deploy, no Cloudflare account, no web change.** A browser
cannot play online until L3. This phase ends when a script of fake players can finish a game in a room.

The spec is **`design/ONLINE_PLAN.md`**: §2 (the shape, storage, AI seats, **the protocol in §2.4**,
reconnecting, how a room ends), §3 (what each browser sees), §5 (waiting, the queue, stand-ins, race
day, joining), §7 (versions), §8 (testing) and **§10's Phase L2 table, which is this phase's acceptance**.
Jesse's decisions behind it are GDD_V3 **V24–V28**, and L1's are **L1a–L1b**. Build from the plan. Where
it is silent, choose the simplest thing and write the choice down.

## ⚠️ First: the mechanics. They are L1's, and they worked.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **184 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws** (it runs under `vite-node`)
  3. **Then run `npm run snapshot`, before any change.**
  4. **Save the hotseat baseline:** run `season-check`, `npx tsx packages/web/scripts/hub-clicks.ts` and
     `npx tsx packages/web/scripts/race-view-check.ts` into `shots/before/`. You will diff against these
     at the end.
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** `git tag -s v3l2 -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle from whatever his `main` actually is: `git bundle create <out> <his main>..main v3l2`.
     If his tree is dirty or his `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3l2.bundle main:refs/heads/work refs/tags/v3l2:refs/tags/v3l2
     git merge --ff-only work
     git branch -d work
     rm v3l2.bundle
     ```

     Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Give him `git push origin main` and `git push origin v3l2`. A stop hook will
     say there are unpushed commits. That is expected: say so, and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. His folder will not have
     `packages/server`'s dependencies until he runs `npm install` himself, and that is fine: nothing he
     runs needs them yet.
- **Keep scratch out of the repo.** Spikes, probes and measurements go in `shots/`, added to
  `.git/info/exclude`. Stage paths, not `-A`. `wrangler dev`'s local state (`.wrangler/`) must be
  git-ignored.
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long, including
  `wrangler dev` itself, with `nohup … &` and poll. Never `cat > file` without a heredoc.
- **Jesse is in Cowork, not at a terminal. Ask one clear question at a time, multiple choice, with a
  recommendation first, and stop.** He has chosen the simple option every time. **This phase should need
  no questions**, because the plan and V24–V28 decide everything he would notice. Ask only if something
  the plan does not cover would change what a player sees online.

`v3l1` is the tag to fall back to. The goldens: one season **`41a8c8b5…`**, two seasons **`d4bb14c3…`**.
**Neither moves.** `SAVE_VERSION` and `STATE_VERSION` stay **13**, and `PROTOCOL_VERSION` stays **1**
unless this phase changes the shape of a message or a view (it should not need to; if it does, say why).

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. **`design/ONLINE_PLAN.md`, all of it.** It is short, and it is the spec.
3. `claude/V3_PHASE_L1_NOTES.md` ("Read this first", especially 1 and 2), and `claude/V3_PHASE_K_NOTES.md`
   Part 1 §4: the Worker spike. It ran `wrangler` 4.143.0 on `workerd` with no account, a SQLite-backed
   Durable Object (`new_sqlite_classes`) importing `packages/engine/src/index.ts` directly: a 261 KiB
   bundle, a season replayed from storage in 63 ms, five in about 220 ms, with standings identical to Node.
4. GDD_V3 §2.3 (the weekend's order) and §13's V24–V28 and L1a–L1b.
5. The code:
   - `packages/engine/src/view.ts` (`viewFor`, `SEAT_SECRETS`), `season.ts` (`drive`, `waitingOn`),
     `reduce.ts` (`reduceMut`, `needsAdvance`, the any-order phases), `state.ts` (`createSeason`,
     `STATE_VERSION`, `PROTOCOL_VERSION`), `ai/index.ts` (`decide`)
   - `packages/web/src/store/loop.ts` (`applyActions`: how hotseat drives AI seats after a human's
     press; the room does the same) and `packages/web/scripts/table-walk.ts` (how a human is played
     headless: `online-walk.ts` should play the same plain line)

## What to build

**`packages/server`**, a new workspace package:

- **The Worker only routes** (ONLINE_PLAN §2.1): `POST /room` draws a six-letter code from
  `ABCDEFGHJKMNPQRSTUVWXYZ`, retries if that room already has state, and returns the code.
  `GET /room/:code` passes a WebSocket upgrade to `env.ROOM.idFromName(code)`. Send CORS headers so the
  Pages site can call `POST /room` in L3. **The Worker never imports the engine.** A free-plan Worker has
  10 ms of CPU, and a Durable Object has 30 s.
- **`Room`, a SQLite-backed Durable Object using the WebSocket Hibernation API** (`ctx.acceptWebSocket`,
  `webSocketMessage`, `webSocketClose`, and `serializeAttachment` to hold a socket's seat, 16 KiB max).
  Raw Durable Objects, as the plan says. `partyserver` is an acceptable swap only if it makes the server
  clearly shorter; if you take it, say why in one paragraph in the notes.
- **Storage (§2.2):** `room` (code, created-at, host seat, `PROTOCOL_VERSION` and `STATE_VERSION` at
  creation), `seats` (name, colour, kind, difficulty, seat token, stand-in on/off, stand-in weekends),
  `setup` (the `SeasonSetup` at Start, names included), and **the log as one SQLite row per applied
  action**. **Never store the state.** On wake, rebuild it with `replay(createSeason(setup), log)`. An
  alarm deletes the room **30 days after its last action**.
- **The seed** is drawn by the room at Start with `crypto.getRandomValues`. CLAUDE.md's no-`Math.random`
  rule is about the engine, and it still holds: the engine receives a seed and nothing else random.
- **The protocol, exactly §2.4's messages.** Client to room: `hello`, `act`, `nudge`, `lobby`, `start`,
  `standIn`. Room to client: `welcome`, `lobby`, `view`, `rejected`, `nudged`, `ended`, `reload`.
  Put the message types in one file that L3's web code can import (for example
  `packages/server/src/protocol.ts`, type-only, with no Worker imports), so the two sides cannot drift.
- **Checking every `act` (§2.4):** the `playerId` must be the socket's own seat. `AdvancePhase` is never
  accepted from a browser. Apply the actions to a copy with `reduceMut`; on an `ActionError`, throw the
  copy away and send `rejected` with the engine's message. Nothing reaches the log that the engine
  refused.
- **After every accepted action, drive** as `applyActions` does: system phases advance, AI seats act
  through `decide`, until a human is on the clock or the game is over. Every action this produces goes
  into the log, `AdvancePhase`s included, so replay is exact.
- **The two queued actions (§5.1):** a `ChooseDoor` from a seat not yet on the clock at Explore, and the
  after-races "Fly on" (`EndPhase` at `planetPost`) from a seat not yet on the clock. The room **holds**
  each one and applies it the moment that seat comes on the clock, then drives on. A queued action that
  the engine refuses when its turn comes (for example, the seat has since been handed a card) is dropped,
  and the seat is sent `rejected`. Queued actions live in memory and in `meta`, never in the log until
  they are applied. Everything else from a seat not on the clock is refused, exactly as the engine would.
  The Bookie and the off-season already take any order in the engine (E8, L1a), so they need no queue.
- **Views (§2.4, §3):** after every change, send each socket its seat's `viewFor(state, seat)`. Send it
  whole (`full: true`) on `hello` and whenever the client's `rev` is behind; otherwise send **only the
  top-level fields that changed** since that socket's last view, compared as JSON. `rev` is the log
  length. `meta` carries what the view does not: who is on the clock and since when, who is connected,
  who has a stand-in, whose door or "Fly on" is queued, and the host. Game over sends `ended` with the
  setup and the log (§2.6); after that the room only answers `hello` with the final view.
- **Nudge (§5.1):** anybody may nudge the seat on the clock; the room sends that seat `nudged`, at most
  once a minute per seat. The sound and the flashing tab are L3's job.
- **Stand-in (§5.3, V26):** the host, or the next connected human in seat order while the host is away,
  can turn a stand-in on for a **disconnected** human seat. While it is on, whenever that seat is on the
  clock the room plays it with `decide(state, seat, 'normal')`: L1 tested that `decide` plays a human
  seat through a season. When the human reconnects the stand-in turns off, and the human takes over from
  their next decision; `decide` returns a whole sitting at once, so a sitting is never split. Record the
  weekends a stand-in played, per seat, for L3's report line. **Nobody can be kicked.**
- **Joining (§5.5, V28):** `hello` with a name and a colour takes an open seat in the lobby. `hello` with
  a seat token takes that seat back, before or after Start. The token is random, made by the room,
  returned in `welcome`, and kept in `localStorage` by the browser in L3. A browser without the token
  cannot take an occupied human seat. The host sets the length and the AI rows with `lobby` and presses
  `start`: 3–8 stables, at least one human. Seats are in joining order, and a face already taken is
  refused, as in hotseat.
- **Versions (§7):** `hello` carries `v`. On a mismatch the room answers `reload` and nothing else. A
  room whose stored `STATE_VERSION` is not the engine's cannot trust its log: it says so to every
  `hello`, with the last standings it can still read, and plays no further.
- **`wrangler.jsonc`** in `packages/server`, with the `Room` class under `new_sqlite_classes` (the free
  plan needs SQLite). No `account_id`, **no deploy**, and nothing on Jesse's Cloudflare account. Add
  `npm` scripts to run it locally.

⚠️ **The workspace and Cloudflare Pages.** Pages builds every push to `main` on **Node 20** by running
`npm install` at the root, so a new workspace's dependencies are installed there too.
- **Check that `wrangler`'s `engines` accepts Node 20.** If it does not, do not let it break the Pages
  build. Keeping `packages/server` out of the root `workspaces`, with its own `package.json` and lock,
  is an acceptable answer.
- **Prove the Pages build still works:** a clean `npm ci && npm run build` under Node 20 (use `npx -p
  node@20` or an `nvm`-style install if the container has none), and say what it added to install time.
- **The root `npm test` must not start needing `workerd`.** Give the server its own test script.

**`packages/server/scripts/online-walk.ts`**, the headless half of ONLINE_PLAN §8 item 3:

- **Setup:** start `wrangler dev` (with `--persist-to` a folder under `shots/`), create a room over HTTP,
  and open N clients with the global `WebSocket` (Node 22 has one).
- **How clients play:** each client presses **only what its own view offers**, with `table-walk.ts`'s
  plain line: a door a week, a crate of staple when short, the best three dogs declared, 100 on each
  favourite, the off-season answered. Pick a door early sometimes, to exercise the queue, and press
  "Fly on" early.
- **What it scans:** every `view` a client receives, patches applied, is checked against the room's
  secret rows. **Zero leaks.** To have something to compare with, the walk needs the full state. Give
  the room a dev-only way to hand it over (for example a `debug` message or route that only answers when
  a `.dev.vars` flag is set, and is refused otherwise), or replay the log from `ended`. Say which you
  chose.
- **What it checks**, and what it prints, a line per row of §10's L2 table:
  - 4 clients plus 2 AIs finish a **two-season** game, and 8 clients finish a season;
  - a client dropped mid-sitting rejoins by token to the same view;
  - **evicted and woken:** restart `wrangler dev` on the same persisted state, reconnect, and the
    replayed state's hash equals the hash before;
  - a stand-in plays a dropped seat and hands back at the next decision;
  - a queued door and a queued "Fly on" apply in turn order;
  - a spoofed `playerId` is `rejected`, a client `AdvancePhase` is `rejected`, and a stale `v` gets
    `reload`;
  - wake and replay time for a five-season room, measured.
- **The final state:** it equals `replay(createSeason(setup), log)` on Node, byte for byte, from the log
  in `ended`.

## RULES THAT DO NOT BEND

- **No change under `packages/engine` or `packages/web`.** `git diff v3l1 --stat -- packages/engine
  packages/web` must be empty. Root files may change only for the new package: the workspaces or ignore
  entry, the lockfile, eslint and TypeScript config, and npm scripts. If the server needs something the
  engine does not export, stop and say so. Do not patch the engine in this phase.
- **Neither golden moves.** `npm test` stays **184 green**. `SAVE_VERSION` 13, `STATE_VERSION` 13.
- **Hotseat reads byte for byte as at `v3l1`:** `season-check`, `hub-clicks` (9.4; the table walk 10.7 /
  22.4 passes, 0 leaks) and `race-view-check`, diffed against `shots/before/`. `view-walk` still 0.
- **No deploy.** No `account_id` and no `wrangler login`. Nothing touches Jesse's Cloudflare account.
- **Lint and strict TypeScript cover `packages/server`**, with no `any`.
- **Format only what you edit.**

## The commit discipline, in this order

1. `packages/server`: the Worker, `Room`, the protocol types, `wrangler.jsonc`, plus the root wiring.
2. `online-walk.ts` and the server's own tests.
3. The docs:
   - `design/ONLINE_PLAN.md`: §10's L2 status box with the results, and any choice the plan left open
     (the debug hook, `partyserver` or not, the workspace answer);
   - `design/BUILD_PLAN_V3.md`: the L outline marks L2 done;
   - `design/CANON.md`: `v3l2`, and last synced;
   - GDD_V3 §13, **only if** a choice changes something a player will see (numbered L2a…).
4. `claude/V3_PHASE_L2_NOTES.md`, and this prompt as `claude/V3_PHASE_L2_PROMPT.md`, corrected before
   commit where it was wrong, with the corrections in a box at the top. Tag **`v3l2`** on that commit.

## DONE WHEN

| Measure | Target |
|---|---|
| 4 clients + 2 AIs finish a two-season game; 8 clients finish a season | ✅ |
| No client ever receives a secret | 0 leaks, every view scanned |
| A dropped client rejoins by token to the same view | ✅ |
| Evicted and woken: replayed state hash equals the state before | ✅ |
| Stand-in plays a dropped seat and hands back at the next decision | ✅ |
| Queued door and queued "Fly on" apply in turn order | ✅ |
| Spoofed `playerId`, client `AdvancePhase`, stale `v` | rejected, rejected, `reload` |
| Final state equals Node's replay of the room's log | byte for byte |
| Wake + replay time for a five-season room | measured (spike: ~220 ms) |
| Pages build on Node 20 from a clean install | ✅, and the install-time cost stated |
| Nothing under `packages/engine` or `packages/web` changes | `git diff v3l1 --stat` shows none |
| Goldens; `npm test` 184; lint; hotseat checks byte-identical; `view-walk` 0; `asset-check`; harness | ✅ |

## Then, in order

1. **Re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks`, `race-view-check`
     (diffed against `shots/before/`), `view-walk` and `asset-check`;
   - `npm run harness -- --seasons 50`. Paste the summary into the notes; it must equal `v3l1`'s.
2. `npm run snapshot`.
3. **Write `claude/V3_PHASE_L2_NOTES.md`** in the style of the L1 notes:
   - "Read this first";
   - what was built, and the choices the plan left open;
   - `online-walk`'s output;
   - the measurements;
   - the rules that did not bend;
   - open questions;
   - a **short** multiple-choice `v3l2` checklist. The main question: "L3 now, or the evening first?"
4. Commit this prompt, corrected, and tag `v3l2` on it.
5. **Land it** in Jesse's folder and give him `git push origin main` and `git push origin v3l2`.
6. **Sync the Project** with `project_write`, and update each status header's `last synced`:
   - the changed `design/*.md`;
   - the new `claude/` notes and prompt.

## Still open, and not this phase's

- **The evening.** `design/PLAYTEST_CHECKLIST.md`'s three games are unplayed.
- **L3, the web online.** It covers:
  - the lobby;
  - the store on a socket;
  - `screenFor` without pass screens;
  - GalaxyMap's dark-week lookup (ONLINE_PLAN §6 item 4, the one throw `view-walk` counts apart);
  - "Play again" (§2.6);
  - the nudge's sound;
  - the stand-in line in the report.
- **L4's deploy:** Workers Builds, or `wrangler deploy` by hand.
- **Two small fixes from the J notes:** the Title's stale "What is in this build" panel, and a seed link
  that carries AI names.
- **Still waiting:**
  - §7.5 / §14 Q5, split view;
  - §14 Q9;
  - more human faces;
  - the goldens cannot see betting or humans.
