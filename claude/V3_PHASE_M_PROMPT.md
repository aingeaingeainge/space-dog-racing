# V3 Phase M: four small fixes before the evening

> **⚠️ Corrections, made before this file was committed** (CANON: a prompt is written before its phase,
> and is corrected in the record, never after). The notes, `claude/V3_PHASE_M_NOTES.md`, have the why.
>
> 1. **"If any fails on a fresh clone, stop and say so."** One did: `browser-walk` passed 1 run in 4 on
>    a fresh `v3l3` clone, a race in the walk (look, the room moves the screen, the click waits 30 s).
>    Asked, Jesse chose to keep a fix and go on: a walk-only commit, **before** `hotseat-shots`, so the
>    commit order below gained a step 0. Nothing under `packages/server/src` changed.
> 2. **"A listed AI's name or a blank row needs none."** A blank row needs none; a listed name *typed
>    in* does, because it takes that name's personality where the seat would have been dealt another.
>    `names=` is written whenever an AI row carries a name the table typed. Human names stay out.
> 3. **"Every link from J's 3,006-check probe."** J's probe was scratch (`shots/`) and is not in the
>    repo; it was rebuilt to the same shape and run against `v3l3`'s own `seedLink.ts` from git.
> 4. **"Then run `npm run snapshot`, before any change."** It ran with a draft of `hotseat-shots.ts`
>    untracked in the tree (so the snapshot says "uncommitted changes"); no tracked file had changed.
> 5. **The door overflow was far wider than two doors**: 134 of 288 door checks at 390 / 360 / 720
>    covered their words at `v3l3`, 0 after.

Phase L3 is done (`v3l3`, pushed). A browser can play online behind the build variable `VITE_ROOMS_URL`,
the live Pages site has no rooms URL yet, and hotseat read byte for byte as at `v3l2`. **L4 (live on
Cloudflare) is not this phase.** Neither is the evening. Jesse chose to clear the small things first:
four fixes that newcomers would trip over on the evening, all in `packages/web` and the docs.

1. **The Title's "What is in this build" panel is stale** (J notes, Read this first 2 and open question
   1). It says "v3 Phase E1 — the game's shape" and "Most of the pictures are still stand-ins … 11 of the
   149 files in the art library are real so far". Every file has been finished since `v3f2`.
2. **A seed link from a table that named an AI does not replay that game** (J notes, Read this first 1
   and open question 2). `createSeason` looks a listed AI's personality up by name and draws one from the
   game's stream (`rng.pick(AI_PERSONALITIES)`, `state.ts`) for an AI the table typed a name into. A link
   carries no names, so the AI comes back blank and the game is different from the first draw on.
3. **A door whose name wraps on a phone overflows its card** (L3 notes, open question 2;
   `shots/browser-walk/03-explore-held-door-390.png`, Hushmarket's "The Fence's Parlour", and Vatgrown's
   doors in an earlier run). The art keeps its 3:4 ratio as a two-line name makes the card taller, so it
   grows wider than its 112 px column and covers the words.
4. **At 390 the game's end's final-standings table has very tall rows** (L3 notes, open question 3;
   `09-game-over-guest-390.png`).

This phase **does change what hotseat shows**, on purpose, in those four places and nowhere else. So the
rule is not "byte for byte" this time. It is: **every difference against `v3l3` is one of the four, and
is named in the notes.**

## ⚠️ First: the mechanics. They are L3's, with one lesson added.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`, then
     `npm run server:install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **184 green**; `npm run lint` is clean; `npm run build` passes
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws** (and "GalaxyMap reading a dark week's planet: 0 weekends")
     - `npm run server:test` is **10 green**; `npm run online-walk` ends **"All 25 rows pass."**;
       `npm run online-table-walk` ends **"All 10 rows pass."**; `npm run browser-walk` ends **"All 7
       rows pass."** (each starts and stops `wrangler dev` itself; run them with `nohup … &` and poll)
  3. **Then run `npm run snapshot`, before any change.**
  4. **Save the baseline** into `shots/before/`: `season-check`, `npx tsx packages/web/scripts/hub-clicks.ts`,
     `npx tsx packages/web/scripts/race-view-check.ts`, `view-walk`, and **screenshots** (see item 5):
     the Title, a hotseat weekend (arrival, Explore, the hub after a door) and the game's end, at 1280
     and 390, built without `VITE_ROOMS_URL`, including a planet whose door names wrap at 390.
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** `git tag -s v3m -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. ⚠️ **L3's lesson: check the permission reached the shell before you land.** At L3 the first grant
     did not, and the fast-forward stopped half-way on `index.lock` (the new files written, `main` not
     moved). Before landing, in `device_bash`: `touch .git/sdr-probe && rm .git/sdr-probe && echo ok`.
     If the `rm` says "Operation not permitted", ask for the permission once more, say why, and probe
     again. Never create a probe file outside `.git`.
  3. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle from whatever his `main` actually is: `git bundle create <out> <his main>..main v3m`.
     If his tree is dirty or his `main` is not what you expect, stop and ask. Do not reset anything.
  4. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3m.bundle main:refs/heads/work refs/tags/v3m:refs/tags/v3m
     git merge --ff-only work
     git branch -d work
     rm v3m.bundle
     ```

     Check the tree is clean and no `index.lock` is left. **If a merge stops half-way anyway**, do what
     L3 did and nothing more: remove git's own leftover locks, check every untracked file it wrote is
     byte-identical to the commit's (`git hash-object` against `git rev-parse work:<path>`), remove
     only those, and run the merge again.
  5. **You cannot push.** Give him `git push origin main` and `git push origin v3m`. A stop hook will
     say there are unpushed commits. That is expected: say so, and do not push.
  6. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. This phase should add
     no dependency; if it does, tell him to run `npm install` at the root after pulling.
- **Keep scratch out of the repo.** Spikes, probes, screenshots and measurements go in `shots/`, added to
  `.git/info/exclude`. Stage paths, not `-A`.
- **Killing `wrangler dev`:** never `pkill -f wrangler` or `pgrep -f workerd` from a Bash call whose own
  command line contains those words. Match on `/proc/<pid>/comm` being `node` or `workerd`, from a
  script file.
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long with
  `nohup … &` and poll. Chromium is at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` is set; its
  revision matches `playwright` 1.56.1, pinned in `packages/server`); **never `playwright install`**.
- **Jesse is in Cowork, not at a terminal. Ask one clear question at a time, multiple choice, with a
  recommendation first, and stop.** He has chosen the simple option every time. The fixes' shapes are
  **decided below**; ask only if something the prompt does not cover would change what a player sees.

`v3l3` is the tag to fall back to. The goldens: one season **`41a8c8b5…`**, two seasons **`d4bb14c3…`**.
**Neither moves. No change under `packages/engine`.** `SAVE_VERSION` and `STATE_VERSION` stay **13**;
`PROTOCOL_VERSION` stays **1**, and nothing under `packages/server/src` changes either.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `claude/V3_PHASE_J_NOTES.md`: "Read this first" 1–2, §1b ("A seed link carries the faces"), §1c ("A
   renamed AI keeps its face") and open questions 1–2.
3. `claude/V3_PHASE_L3_NOTES.md`: "Read this first", "The rules that did not bend" (how the screenshots
   were compared) and open questions 2–3.
4. The web:
   - `src/lib/seedLink.ts` (`seasonLinkFor`, `parseSeasonLink`, `playersParam`), `src/lib/faces.ts`
     (`aiOwnerIndices`), `src/lib/report.ts` (the "Note: … the table named" line), `screens/Title.tsx`
     (the shared-link notice, the roster, the stale panel);
   - `packages/engine/src/state.ts` around `rng.pick(AI_PERSONALITIES)` — **to read, not to change**;
   - `src/theme/app.css`: `.door`, `.door-art` and the `@media (max-width: 720px)` block under them; and
     `screens/SeasonEnd.tsx` `FinalStandings` with whatever CSS it uses.
5. `design/PLAYTEST_CHECKLIST.md`'s current section (it tells the table to leave AI names blank).

## What to build

1. **The Title's panel.** Rewrite "What is in this build" so it is true today and stays true: a short
   description of the game's shape (one to five seasons or a race to a target, Easy / Normal / Hard AI,
   three dealt dogs, Explore's doors, the six-food market, three purse tiers, the Bookie, the off-season,
   every planet painted), and **the build's own name from `__SDR_BUILD__`** in its sub-title, so the
   panel never needs editing for a version again. No art counts, no phase letters in the copy. Keep it to
   the length it is now.
2. **A seed link carries the AI names** — **in the link, not the engine** (decided: the engine keeps its
   draw, so no golden, save or old link moves).
   - `seasonLinkFor` adds a `names=` parameter **only when an AI row has a name** the table typed (a
     listed AI's name or a blank row needs none, so a table that never named an AI keeps exactly today's
     link). The simplest shape: one entry a stable, in seat order, empty for every row that needs none,
     URL-encoded, e.g. `&names=,,Gravy%20Train,`. Human names may ride along or not — they touch no draw;
     pick the simpler and say which.
   - `parseSeasonLink` reads it back onto the roster, so the Title fills the names in and **Start replays
     the same game**. A link without `names=` parses exactly as today; a malformed or over-long one is
     ignored, never refused (the file's rule: "ignore what you do not understand").
   - `lib/report.ts`: drop the "A link carries no names, so it opens a different game" note, since it is
     no longer true; the report reads byte for byte as before for a table with no named AI.
   - `PLAYTEST_CHECKLIST.md`: the "leave the AI rows' names blank" line goes (or says names are fine now).
   - **Prove it:** seed 99 with an AI named "Gravy Train" (J's own example): play a season headless, take
     the link, parse it, start again, replay the same actions, and the state hashes the same; and 300
     seeds × 0–3 named AIs round-trip through `seasonLinkFor` → `parseSeasonLink` to the same
     `SeasonSetup` (names, faces, difficulties, length, toggles). Every link from J's 3,006-check probe
     that had no named AI must come out character for character as before.
3. **The door card on a phone.** In the 720 px block, stop the art growing past its column when the words
   beside it are taller (for example, let the art stretch to the row's height and crop, `object-fit:
   cover` is already set, instead of holding 3:4). Check it on every planet's three doors at 390, not only
   the two named above: **no door's art may cover its words at 390, 360 and 720**, and at 1280 the doors
   must be unchanged (compare the PNGs).
4. **The final standings on a phone.** Find why the rows are so tall at 390 (a wrapping cell, a min-height,
   a chart in a cell) and fix it so the table reads at 390 and is unchanged at 1280.
5. **A screenshot script in the repo**, because every phase since L3 has rebuilt one by hand in `shots/`:
   `packages/server/scripts/hotseat-shots.ts` (it lives in `packages/server` because that is where
   `playwright` is, and only there), run as `npm run hotseat-shots -- <dist> <outDir>`. It serves a built
   `dist`, fixes `Math.random` with an init script, and takes full-page PNGs at 1280 and 390 with
   animations off, of: the Title; a two-human weekend from a seed link (arrival, Explore, the hub after a
   door); the Explore of a planet whose door names wrap; and a game's end (a race to 1 Bone is the
   quickest way to one). Run twice on the same build it must give identical bytes; say that you checked.

## RULES THAT DO NOT BEND

- **No change under `packages/engine` or `packages/server/src`.** `git diff v3l3 --stat -- packages/engine
  packages/server/src` must be empty.
- **Every hotseat difference against `v3l3` is one of the four fixes, and named.** `season-check`,
  `hub-clicks` (9.4; the table walk 10.7 / 22.4, 0 leaks) and `race-view-check` are diffed against
  `shots/before/`: byte-identical, or each changed line explained. The screenshots: every PNG that
  differs is the Title's panel, a door card at a phone width, or the game's end's standings at a phone
  width; **every 1280 screenshot but the Title's is byte-identical**.
- **An old link still opens.** A `v3j`/`v3l3` link (no `names=`) parses to exactly the same setup as
  before; a table with no named AI gets exactly the same link as before.
- **Neither golden moves.** `npm test` stays **184 green** (add tests only if they belong with the web's
  own checks, not the engine's). `SAVE_VERSION` 13, `STATE_VERSION` 13, `PROTOCOL_VERSION` 1.
- **Online unchanged:** `online-walk` 25 rows, `online-table-walk` 10 rows, `browser-walk` 7 rows, all
  green (the online report may now carry `names=` in its link when an AI was named; say so if the walks
  see it).
- **`view-walk` 0 throws**, GalaxyMap 0. `asset-check` 288 / 0 / 0.
- **The Pages build on Node 20** from a clean `npm ci && npm run build` still passes; no dependency added.
- **Lint and strict TypeScript cover everything new**, with no `any`. **Format only what you edit.**

## The commit discipline, in this order

1. `hotseat-shots.ts` and its npm script, **before any fix**, with the baseline it took (the baseline
   PNGs stay in `shots/`, not the repo).
2. The Title's panel.
3. The seed link's names, the report line, and the probe's results in the commit message.
4. The door card and the final standings (two commits if they are unrelated CSS).
5. The docs:
   - `design/PLAYTEST_CHECKLIST.md`: the AI-names line; `last synced`;
   - `design/CANON.md`: `v3m`, and last synced (PLAYTEST_CHECKLIST is mirrored);
   - `design/BUILD_PLAN_V3.md`: a one-line status for Phase M beside the L outline (it is not an L
     phase);
   - GDD_V3 §13 only if a choice changes something a player will see beyond the four fixes as described
     here (numbered M1…). The `names=` parameter is one row: **M1 — a seed link carries the names the
     table gave its AIs**.
6. `claude/V3_PHASE_M_NOTES.md`, and this prompt as `claude/V3_PHASE_M_PROMPT.md`, corrected before
   commit where it was wrong, with the corrections in a box at the top. Tag **`v3m`** on that commit.

## DONE WHEN

| Measure | Target |
|---|---|
| The Title's panel is true, and names the build from `__SDR_BUILD__` | ✅, screenshot at 1280 and 390 |
| A link from a table with a named AI replays the same game | ✅ seed 99 "Gravy Train": same state hash |
| Links round-trip; a link with no named AI is exactly today's; an old link parses as before | ✅ 300 seeds × 0–3 named AIs; J's probe links unchanged |
| The report drops the "opens a different game" note, and is unchanged otherwise | ✅ |
| No door's art covers its words at 390, 360, 720; doors unchanged at 1280 | ✅ every planet, PNGs |
| The final standings read at 390; unchanged at 1280 | ✅ PNGs |
| `hotseat-shots` in the repo, deterministic | ✅ same bytes twice |
| Every other hotseat difference against `v3l3`: none | ✅ `season-check`, `hub-clicks`, `race-view-check`, the 1280 PNGs |
| Nothing under `packages/engine` or `packages/server/src` changes | empty diff |
| Goldens; `npm test` 184; lint; `view-walk` 0; `asset-check`; `server:test`; the three online walks; harness; Pages on Node 20 | ✅ |

## Then, in order

1. **Re-baseline:** `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks`,
   `race-view-check` (diffed against `shots/before/`), `view-walk`, `asset-check`, `server:test`,
   `online-walk`, `online-table-walk`, `browser-walk`, and `npm run harness -- --seasons 50`. Paste the
   harness summary into the notes; it must equal `v3l3`'s (every line but the elapsed time).
2. `npm run snapshot`.
3. **Write `claude/V3_PHASE_M_NOTES.md`** in the style of the L3 notes, shorter: "Read this first"; what
   changed, fix by fix, with the before and after screenshots named; the link probe's numbers; the rules
   that did not bend; open questions; and a **short** multiple-choice `v3m` checklist whose main question
   is **"L4 (live on Cloudflare) now, or the evening first?"**
4. Commit this prompt, corrected, and tag `v3m` on it.
5. **Land it** in Jesse's folder (the probe first) and give him `git push origin main` and
   `git push origin v3m`.
6. **Sync the Project** with `project_write`, and update each status header's `last synced`: the changed
   `design/*.md` (CANON, PLAYTEST_CHECKLIST, BUILD_PLAN_V3, and GDD_V3 if M1 went in), and the new
   `claude/` notes and prompt.

## Still open, and not this phase's

- **The evening.** `design/PLAYTEST_CHECKLIST.md`'s three games are unplayed; hotseat can be played on any
  build from `v3j` on, and after this phase a named AI no longer spoils a link.
- **L4, live:** Workers Builds, or `wrangler deploy` by hand; `VITE_ROOMS_URL` set in Pages; a smoke test
  against the live room; an online section in `PLAYTEST_CHECKLIST.md`. The first deploy freezes
  `PROTOCOL_VERSION` 1.
- **Still waiting:** §5.2 hotseat inside an online room (V28: not yet); §7.5 / §14 Q5 split view; §14 Q9;
  more human faces; the goldens cannot see betting or humans.
