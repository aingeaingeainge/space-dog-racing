# V3 Phase K: online multiplayer, planned

> ⚠️ **Corrected before commit, per CANON's write-once rule.** The prompt below is as given, except
> for this box. Four things it said turned out differently:
> 1. **"The simultaneous phases (Explore, Kennel, Bookie)"** (question 2, and GDD_V3 §3 / V20 behind it):
>    in the engine only the **Bookie** takes any order. Explore is "simultaneous, played in turn order"
>    (`phases/explore.ts`: a one-of-a-kind card goes to the first stable through the door, and
>    `pendingEvent` holds one card), the Kennel is part of the Market/Race Office sitting (`planetPre`),
>    and the off-season is in turn order. Question 2 was asked with this corrected: online, a door can be
>    picked early and is applied in turn order by the room, and L1 makes the off-season any-order. No rule
>    changes. Notes, Read this first 1.
> 2. **The secret list is longer than "at least" suggested**, and two rows are secret from the owner too:
>    a pending card's `params` and `rng` (an offered dog's true stats and lie; a gamble's dice), and
>    `players[].stats.liesTold`, which is counted when an offer is rolled. The calendar past next week is
>    in the state and only hidden on screen. Eighteen rows in all (`ONLINE_PLAN.md` §3.1). "Trap draws"
>    are public once declarations lock; the secret is the box bought before then, which is a `job`.
> 3. **"How long a season takes there"** was measured on `workerd` under `wrangler dev` in this 2-core
>    container, cold: it bounds the engine against a Durable Object's 30 s CPU, and is not what a player
>    at the edge will wait.
> 4. **The GDD_V3 §13 entries** are V24–V28, dated 29 September 2026, as asked; the prompt's "§3's note on
>    online" is an italic note under §3's E8 paragraph, in the style of the others there.

Phase J is done (`v3j`, pushed). The pass screen shows the next human's face, a seed link carries the
humans' faces, a renamed AI's face follows its name, the game's end has **Copy the report**, and
`design/PLAYTEST_CHECKLIST.md` is one evening of three games that answers every open 🎲 row.

**The evening has not been played yet.** Jesse has no time for it this week, and he will come back to
it. Nothing in this phase waits on it, and nothing in it may make the evening harder to play.

**Phase K is a design session, not a build.** Online multiplayer has been the project's long-term goal
since the first page of the brief ("eventually I would like to make it online multiplayer, where you
choose how many human and AI players"). It was M5, then M6 behind v2 (GDD D16), and since then the rules
have been rewritten twice. Phase K writes the plan for building it on v3's rules, so the build phases
after it can start straight away. The output is a document and a handful of decisions, not code.

**Why now, before the playtest:** the netcode is mostly rule-agnostic. Rooms, joining, reconnecting,
who runs the engine, and what each browser is allowed to see do not change if the evening moves a purse
or Hard's strength. The parts that *do* depend on the evening (the pace budget online, whether split
view exists) are named in the plan as waiting on it.

**Nothing in the engine or the game changes.** No rule, no sheet row, no golden, no `SAVE_VERSION`, no
`packages/web` change. If the plan needs an engine change (it probably does: see question 1), the plan
*describes* it and a later build phase makes it.

## ⚠️ First: the mechanics. They are J's, and they worked.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **51 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
  3. **Then run `npm run snapshot`, before any change.**
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** `git tag -s v3k -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle from whatever his `main` actually is: `git bundle create <out> <his main>..main v3k`.
     If his tree is dirty or his `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3k.bundle main:refs/heads/work refs/tags/v3k:refs/tags/v3k
     git merge --ff-only work
     git branch -d work
     rm v3k.bundle
     ```

     Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Give him `git push origin main` and `git push origin v3k`. A stop hook will
     say there are unpushed commits: that is expected, say so and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds.
- **Keep scratch out of the repo.** Spikes, probes and measurements go in `shots/`, added to
  `.git/info/exclude`. Stage paths, not `-A`.
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long with
  `nohup … &` and poll. Never `cat > file` without a heredoc.
- **Jesse is in Cowork, not at a terminal. Ask one clear question at a time, multiple choice, with a
  recommendation first, and stop.** He has chosen the simple option every time.

`v3j` is the tag to fall back to. The goldens: one season **`41a8c8b5…`**, two seasons **`d4bb14c3…`**.
**Neither moves.** `SAVE_VERSION` and `STATE_VERSION` stay **13**.

## Jesse's standing calls: do not reach for these

- Every rule, number and 🎲 target is as `v3j` left it. The evening decides the next rules change.
- Hotseat stays. Online is added beside it, never instead of it.
- Hosting stays on Cloudflare (Pages today). The plan uses the same account.
- **Keep it simple.** A plan that needs accounts, a database, matchmaking or payments is the wrong plan
  for a game played with friends by link.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: §1 (pillars, especially 4 "the scoreboard is public, the future is not" and 6's
   forty minutes), §2.3 (the weekend), §3 (players, hotseat, hidden information), §7.3–7.5 (declaring,
   betting, watching), §9 (Explore, sabotage, information), §10 and §10.1 (screens, the click budget),
   §13's V20 and E8.
3. `design/BUILD_PLAN.md` §§1–5 (the engine's three multiplayer rules, the stack row for M6), **§6b.9
   and "Prompt M6"**: the old online spec, written for v1's rules. Read it as a starting point, not a
   plan: some of it no longer fits (see question 1).
4. `design/GDD.md` §18 and D16, and D40 (a v2 deterrent written as "a multiplayer feature").
5. `claude/V3_PHASE_E2_NOTES.md` (the hotseat loop, E8), `claude/V3_PHASE_J_NOTES.md` (Read this first
   1: a named AI draws a personality, so a link without names does not replay).
6. The code:
   - `packages/engine/src/types.ts` (`GameState`, `Action`, what is secret), `state.ts`
     (`createSeason`), `reduce.ts`, `season.ts` (`drive`, `waitingOn`), `ai/index.ts` (`decide`)
   - `packages/web/src/store/loop.ts` (`screenFor`, `PRIVATE_SCREENS`, the pass logic),
     `store/gameStore.ts`, `store/persist.ts`
   - `packages/web/scripts/table-walk.ts` (how a table is walked headless)

## PART 1: MEASURE (scratch, in `shots/`, nothing committed)

Numbers the plan needs, measured rather than guessed:

1. **The log:** actions and bytes (JSON, and gzipped) for a one-season, a three-season and a five-season
   game at 4 humans + 2 AIs, 6 AIs and 8 humans. Replay time from the log on Node, for reconnects.
2. **The state:** bytes of a `GameState` at week 1, week 10 and the end of season 5. Bytes of one race's
   tick log, and of a race day's three.
3. **What is secret in the state.** Walk `GameState` field by field and list everything one human must
   not see about another, or about the future: at least the seed and `rng`, next week's market
   (`nextPlanet`), the Explore deck and its order, dogs' hidden styles before they race, other stables'
   doors and cards, un-settled bets, sabotage before it lands, and trap draws. Say for each whether a
   client holding the full state could read it in devtools, and whether a client holding the log and
   the seed could compute it.
4. **The engine in a Worker.** A spike: bundle `@sdr/engine` into a Cloudflare Worker (`wrangler dev`
   locally, no deploy, no account needed if it can be avoided) that creates a season, drives six AIs
   through it and returns the final standings. Confirm it runs, and how long a season takes there. If
   `wrangler` cannot run in the container, say so and measure with plain Node instead.
5. **Current Cloudflare facts, searched, not remembered:** Durable Objects on the free and paid plans
   (limits, pricing, WebSocket hibernation, storage), and PartyKit's status now it is part of Cloudflare.
   Cite the pages.

## PART 2: DECIDE — Jesse's questions, one at a time

Each with a recommendation first and the cost of each option in a sentence. Ask **at most five**. The
likely ones, in order of how much they change the plan:

1. **What may a browser see?** The old M6 spec had the server broadcast *actions* and every browser
   replay them. That puts the seed and the whole state in every browser, so anyone with devtools can read
   next week's prices, the other stables' doors and bets and every hidden style (pillar 4). The
   alternative is a server that holds the game and sends each seat **its own view** (a pure
   `viewFor(state, seat)` in the engine, plus the public race tick logs). Among friends, cheating may not
   matter; the secrets are also *spoilers* that the UI would have to be careful never to show. Recommend,
   with the size of each.
2. **Waiting online.** Hotseat has no waiting: the laptop is the turn. Online, four people sit in the
   Market and Race Office one at a time. Timers (the old spec had 90 s), no timers, or a nudge? What the
   simultaneous phases (Explore, Kennel, Bookie) do while the turn-order ones wait.
3. **Somebody leaves.** A dropped human: wait for them, hand the seat to a Normal AI until they are back,
   or both after a timeout. Whether the table can kick a seat.
4. **Race day together.** Everybody's race view plays at once from the same tick logs; does the next
   screen wait for everyone to finish watching, or does each browser move on alone? "Skip the rest of
   race day" online.
5. **Joining.** A room code, a link, or both; a name typed at the door, no accounts; the host fills
   empty seats with AI and presses Start. Whether two people on one laptop can share a seat in an online
   room (hotseat inside online) or that waits.

Record each answer as a GDD_V3 §13 decision, starting at **V24**.

## PART 3: WRITE the plan

**`design/ONLINE_PLAN.md`**, a new CURRENT document with a status header like the others. In it:

- **The shape:** one Durable Object per room, running the engine; the protocol (messages both ways, with
  examples); where AI seats run; what is stored and for how long; how a reconnect works; how a room ends.
- **What each browser sees**, per Jesse's answer to question 1, with the secret list from Part 1.
- **The engine changes it needs**, each additive and pure (for example `viewFor`), and whether each moves
  a golden. Also the named-AI draw from the J notes: online, names are set once in the room, so say
  whether it matters there.
- **The web changes it needs:** a lobby, the store talking to a socket instead of reducing locally,
  `screenFor` without pass screens, and what stays shared with hotseat.
- **Versions:** what happens when a browser on an old build joins a room on a new one (a protocol
  version, like `SAVE_VERSION`).
- **Testing:** determinism across server and client; a headless multi-client walk in the style of
  `table-walk.ts`; the acceptance rows.
- **Cost:** what a room and an evening cost on Cloudflare, from Part 1's search.
- **The build phases**, each one session, in the house style, with its goal, deliverables and an
  acceptance table (🎲 rows where only people can answer). Suggest names (`v3l1`, `v3l2`, …) and say
  which could be built before the evening's results and which should wait for them.
- **Out of scope**, as a list, so ideas have to earn their way in (accounts, matchmaking, chat,
  spectators, async play-by-link, unless Jesse asks).

## RULES THAT DO NOT BEND

- **No change under `packages/`.** Prove it in the notes: `git diff v3j --stat -- packages` is empty.
- **Neither golden moves. `npm test` stays 51 green.** `SAVE_VERSION` 13.
- **The spike is scratch.** No `packages/server`, no `wrangler.toml`, no deploy, nothing on Jesse's
  Cloudflare account.
- **Format only what you edit.**

## The commit discipline, in this order

1. `design/ONLINE_PLAN.md`.
2. GDD_V3 (§3's note on online, §13's V24 onward), BUILD_PLAN_V3 (a Phase K section in J's style, and
   the build phases' outline, pointing at the plan), CANON (the new document, `v3k`, and whether
   `ONLINE_PLAN.md` is mirrored: it should be).
3. `claude/V3_PHASE_K_NOTES.md` and this prompt as `claude/V3_PHASE_K_PROMPT.md`, corrected before commit
   where it was wrong, with the corrections in a box at the top. Tag **`v3k`** on it.

## DONE WHEN

| Measure | Target |
|---|---|
| Log, state and tick-log sizes; replay time; the secret list; the engine in a Worker | measured, in the notes |
| Cloudflare's current limits and prices, and PartyKit's status | searched and cited |
| Jesse's questions | ≤ 5, one at a time, each recorded as a V decision |
| `design/ONLINE_PLAN.md` | written, CURRENT, mirrored |
| The build phases | each one session, with an acceptance table, and marked "before" or "after the evening" |
| No change under `packages/`; goldens; tests; lint; `season-check`; `asset-check` | ✅ |

## Then, in order

1. Re-baseline: `npm test`, `npm run lint`, `season-check`, `asset-check`, and
   `npm run harness -- --seasons 50` (paste the summary into the notes; it must equal `v3j`'s).
2. `npm run snapshot`, then `git tag -s v3k` on the notes commit.
3. **Write `claude/V3_PHASE_K_NOTES.md`** in the style of the J notes: "Read this first", the
   measurements, Jesse's answers, the plan in brief, open questions, and a **short** multiple-choice
   `v3k` checklist ("does the plan read right; which build phase first").
4. Commit this prompt, corrected.
5. **Land it** in Jesse's folder and give him `git push origin main` and `git push origin v3k`.
6. **Sync the Project:** `design/ONLINE_PLAN.md` (new), the changed `design/*.md`, and the new
   `claude/` notes and prompt, with `project_write`; update each status header's `last synced`.

## Still open, and not this phase's

- **The evening.** `design/PLAYTEST_CHECKLIST.md`'s three games are unplayed. The session after the
  evening reads the reports and the ticked sheet and decides the next rules build.
- Two small fixes from the J notes, worth doing before the evening: the Title's stale "What is in this
  build" panel, and a seed link that carries AI names (or leave AI names blank, as the sheet says).
- §7.5 / §14 Q5 split view; §14 Q9, the book pricing fitness and form; more human faces.
- The goldens cannot see betting or humans.
