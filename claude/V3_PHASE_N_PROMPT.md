# V3 Phase N: the draft — four dogs and two trainers, picked from a board

> **⚠️ Corrected before commit, where the prompt was wrong or the build had to differ** (the record of
> what happened is `claude/V3_PHASE_N_NOTES.md`):
>
> 1. **The commit order is not quite the one below.** Jesse's three balance calls moved the goldens'
>    inputs, and the goldens must move once, in a commit of their own. So the balance commit comes
>    *before* the goldens: sheet rows → engine (goldens skipped) → the `--draft` harness mode → the
>    balance moves (with Jesse's answers) → the goldens alone → web → online → docs → notes.
> 2. **`race-view-check` cannot be identical to `shots/before/`.** It plays seeded seasons, and the draft
>    moves every draw after the seats, so the 150 races are different races. What does not bend is
>    that every one replays the same way twice and shows the finish the engine recorded: clean, 150
>    races, at `v3m` and at `v3n`.
> 3. **The off-season stays the `offSeason` phase** (the prompt offered a one-round `draft` phase or the
>    off-season taking the new action in turn order): both drafts share one module, one state
>    (`GameState.drafts`) and one action, and the opening one is a `draft` phase.
> 4. **The off-season board got a rating range of its own** (`offDraftRatingMin` / `Max`, GDD_V3 N1),
>    which the prompt did not list: Jesse narrowed the opening board to 45–55 and chose one dog a stable
>    at the off-season, and with one shared range the narrowing took the good dog away from the back of
>    the table. Asked, he chose the split.
> 5. **Two DONE WHEN rows are not green, and `main` was landed anyway, at Jesse's calls:** draft
>    position (4.4 / 5.2 / 4.7 points at 3 / 6 / 8 stables against ±3) and V23's long-game rows (27.0% /
>    9.3% at 600 games against 31% / 14%). Each was asked with its measured options; his answers are
>    V31's 45–55 and V32/N1's board. Everything else in DONE WHEN is green.
> 6. **`startCargo` lived in `balance.extras.json`, not the sheet.** It moved to the sheet (a row under
>    Starting position) so the draft's numbers are all in one place.
> 7. **The browser walk gained a row** (the draft) and reads "All 8 rows pass"; `server:test` is 11.
> 8. **`browser-walk` failed one row on the fresh clone of `v3m`** (the held "Fly on", M's flake) and
>    passed all 7 on a rerun alone; recorded, not asked.

Phase M is done (`v3m`, pushed). Hotseat is ready for the evening, and online is built but not live
(L4 has not deployed, so **`PROTOCOL_VERSION` 1 is not frozen yet**). Jesse has changed how a game
starts, and this phase builds it **before the evening and before L4**, so the evening tests the draft
with real people and the first deploy freezes a protocol that already has it.

**What Jesse asked for, in his words:** "change the start of the game so players select their dogs and
trainers in a draft style. A random draw for first pick then reverse order for round 2 etc. 4 dogs
instead of 3, so there would be 6 rounds of the draft, 4 dogs and 2 trainers, where players take turns
selecting from a board; they can pick a dog or a trainer on their turn. In between seasons, a similar
system, with the reverse order of the current standings to pick new dogs."

**Decided with Jesse before this prompt** (each is a GDD_V3 §13 row, V29–V33 below):

| | Decision |
|---|---|
| **V29** | **The opening draft.** Every stable holds **4 dogs and 2 trainers**, picked in a **snake draft**: round 1's order is a random draw, round 2 reverses it, and so on, **6 rounds**. On its turn a stable takes **one dog or one trainer** from the board. A stable with 4 dogs can only take trainers, and one with 2 trainers can only take dogs. Nothing is dealt any more. |
| **V30** | **The board shows everything:** each dog's age, three stats, rating, book value **and running style**; each trainer's bonuses and cut. Every drafted dog's style is public from the start. Styles stay hidden, as today, for a dog that arrives any other way (the Pound). |
| **V31** | **The board's dogs are not equal:** ratings spread over **about 40–60**, so a pick matters and the snake order is what keeps it fair. This replaces §5.5's "every dealt dog rates 50, one of each style". |
| **V32** | **The off-season is one round of the same draft, in reverse order of the season's standings** (last place picks first) from a fresh board. On its turn a stable takes a dog (and retires one of its own, paid book value), takes a trainer (and lets one go if it has two), or passes. This **replaces** the retirement offer, the staff-notice candidate and V23's breeder's pick. Aging and the staff notice (a trainer leaving) still happen first. |
| **V33** | **Four dogs, not three.** The kennel is four; the Pound's "discard one to take one" keeps it at four. Every number tuned for three is measured again (below). |

The rest of the game — the weekend, Explore, the market, the races, the Bookie, the Pound, winning — is
**unchanged**.

## ⚠️ First: the mechanics. They are M's.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`, then
     `npm run server:install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and ask.
     - `npm test` is **184 green**; `npm run lint` is clean; `npm run build` passes
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws**
     - `npm run server:test` is **10 green**; `npm run online-walk` ends **"All 25 rows pass."**;
       `npm run online-table-walk` ends **"All 10 rows pass."**; `npm run browser-walk` ends **"All 7
       rows pass."** (each starts and stops `wrangler dev` itself; run them with `nohup … &` and poll,
       **one at a time** — two at once on 2 cores makes `browser-walk` time out)
  3. **Then run `npm run snapshot`, before any change.**
  4. **Save the baseline** into `shots/before/`: `season-check`, `hub-clicks`, `race-view-check`,
     `view-walk`, **`npm run harness -- --seasons 50`**, **`npm run harness -- --game`** (whole games at
     1, 3 and 5 seasons and both targets; the V23 long-game rows in §11 come from it), and **`npm run hotseat-shots -- <dist> shots/before/png`**
     from a build without `VITE_ROOMS_URL`.
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** `git tag -s v3n -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing, check the permission reached the shell:** in `device_bash`,
     `touch .git/sdr-probe && rm .git/sdr-probe && echo ok`. If the `rm` says "Operation not
     permitted", ask for the permission once more, say why, and probe again.
  3. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` and `git log --oneline -1`. **His
     `package-lock.json` may show a local change** (26 `"peer": true` lines removed by his own
     `npm install`; at M he chose to leave it). If that is the only change and no commit of yours
     touches `package-lock.json`, land anyway and say so. **If this phase changes `package-lock.json`,
     or anything else is dirty, stop and ask.** Build the bundle from whatever his `main` actually is:
     `git bundle create <out> <his main>..main v3n`. Do not reset anything.
  4. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3n.bundle main:refs/heads/work refs/tags/v3n:refs/tags/v3n
     git merge --ff-only work
     git branch -d work
     rm v3n.bundle
     ```

     Check the tree is clean (but for the lock above) and no `index.lock` is left. If a merge stops
     half-way, remove git's own leftover locks, check every untracked file it wrote is byte-identical to
     the commit's (`git hash-object` against `git rev-parse work:<path>`), remove only those, and merge
     again.
  5. **You cannot push.** Give him `git push origin main` and `git push origin v3n`. A stop hook will
     say there are unpushed commits. That is expected: say so, and do not push.
  6. **Never run `npm` in his folder.** This phase should add no dependency.
- ⚠️ **Pushing `main` deploys the live site**, and the evening is played from it. **Land on `main` only
  when every check in DONE WHEN is green.** If the session runs short, commit what is done on a branch
  `draft-wip`, land that branch instead (`git bundle create <out> <his main>..draft-wip`, fetched to
  `refs/heads/draft-wip`), write the notes so far, and tell Jesse `main` is untouched.
- **Keep scratch out of the repo.** Probes, sweeps, screenshots and measurements go in `shots/`, added to
  `.git/info/exclude`. Stage paths, not `-A`.
- **Killing `wrangler dev`:** never `pkill -f wrangler` / `pkill -f vite` / `pgrep -f workerd` from a
  Bash call whose own command line contains those words (it kills the shell). Match on
  `/proc/<pid>/comm` being `node` or `workerd`, from a script file.
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long with
  `nohup … &` and poll. Chromium is at `/opt/pw-browsers`; **never `playwright install`**.
- **Jesse is in Cowork, not at a terminal. Ask one clear question at a time, multiple choice, with a
  recommendation first, and stop.** He has chosen the simple option every time. V29–V33 are decided;
  ask only where a measurement leaves a real choice that changes what a player sees (the likely one is
  in "Balance" below).

`v3m` is the tag to fall back to.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: §2.2 (the off-season, with its E4/E5, E9 and V23 notes), §3 (what is public and
   private in hotseat, E8), §4.2 (the fitness arithmetic, written for three dogs), §5.4–5.5 (styles
   hidden then public; the opening hand), §8 (staff, and D9–D12's pricing by regression), §9.2 (the
   Pound), §10.1 (the click budget), §11 (the targets, V22 and V23's long-game rows), §13 V23.
3. `design/ONLINE_PLAN.md` §3.1 and L1b (the off-season "in any order"), §5.1, §10.
4. `claude/V3_PHASE_I_NOTES.md` (V23, the breeder's pick, and how it was measured) and
   `claude/V3_PHASE_D2_NOTES.md` (the trainers and their regression).
5. The engine: `state.ts` (`createSeason`: the dealt dogs, the `rng.shuffle(STYLE_IDS)` hand, the staff
   pool at line ~509), `economy/dogs.ts` (`createStartingDog`, `fitRating`), `economy/staff.ts`
   (`hardWorth`, `unemployedStaff`), `phases/offSeason.ts`, `ai/offSeason.ts`, `reduce.ts`,
   `view.ts` (the secret table), `test/draft.test.ts` (V23's test, which this phase rewrites), and
   `scripts/add-phase-i-rows.ts` (the sheet upserter to copy).
6. The web: `store/loop.ts` (`screenFor`, `passReason`), `screens/OffSeason.tsx`, `screens/Title.tsx`
   (the build panel says "three dealt dogs"), `lib/report.ts` (the draft line), `store/persist.ts`.
7. The room: `packages/server/src/game.ts` (the phases that take presses in any order).

## What to build

### 1. The engine (`packages/engine`)

- **A new phase, `draft`**, the first player phase of a game, before week 1's `arrival`. And the
  off-season's pick becomes the same phase shape (a `draft` of one round, or the off-season phase taking
  the new action in turn order — pick whichever is simpler and say which).
- **One new action** replaces `Retire` and `ResolveStaffNotice`:
  `{ t: 'DraftPick'; playerId; pick: { dog: Id } | { staff: Id } | null; release?: Id }`.
  `null` is a pass (off-season only). `release` names the dog retired or the trainer let go when the
  kennel or the staff is full. The engine refuses an illegal pick with an `ActionError`, as now.
- **The opening board**, built in `createSeason` from the game's stream, so the same seed gives the same
  board and the same order:
  - **Dogs: `draftDogsPerStable` (5) × stables.** Ratings **evenly spaced from `draftRatingMin` (40) to
    `draftRatingMax` (60)**, each shaped with `fitRating` and `startDogShapeSpread` as today, ages
    `startDogAgeMin`–`startDogAgeMax`. **Styles split evenly, and each style spans the rating range**
    (stratify within style, then shuffle the board), so no style is the strong one and a table can
    always build one of each.
  - **Trainers: `draftTrainersPerStable` (3) × stables**, capped by the pool of 24 (eight stables see
    all 24).
  - **The order:** round 1 a shuffle of the stables, then snake for 6 rounds (`startDogs` +
    `staffSlots`).
  - Every drafted dog has `styleKnown: true`.
- **The off-season board:** after aging and the staff notice, a fresh board of **`offDraftDogsPerStable`
  (1.5, rounded up) × stables** dogs, rated and styled by the same rules, ages `dogOfferAgeMin`–
  `startDogAgeMax`, plus **every unemployed trainer**, up to one per stable. The order is **the reverse
  of the season's standings** (§2.4's order, the one the season's end shows). One pick each. Taking a
  dog retires one of your own (paid `dogValue`, as the retirement window pays today). Taking a trainer
  with two already lets one go (back to the pool). A stable the notice left with one trainer takes a
  trainer without letting one go. A pass is always legal.
- **Retire:** V23's `draftLevelShift`, the retirement offer and its patter (`describeRetirementOffer`),
  and the staff candidate. Their sheet rows go on the upserter's REMOVE list.
- **The AI drafts.** Score every legal item on the board in Bones and take the best:
  - a dog: its book value plus its expected season purses by rating (fit that curve from the harness:
    purses won against rating at declaration), with a need bonus for a style the stable lacks;
  - a trainer: its measured worth net of cut (`hardWorth`'s table, which D12's regression made);
  - **Easy** takes the highest-rated dog it can and a trainer only when it must; **Normal** as above;
    **Hard** also weighs age (growth and decline over the game's remaining seasons);
  - in the off-season: take the best item if it beats what it would release by a margin (⚖️, a sheet
    cell), otherwise pass.
- **`view.ts`:** the board, the order and every pick are public; add them to the view and to the secret
  table's test (nothing about the draft is secret).
- **Versions:** `STATE_VERSION` and `SAVE_VERSION` go to **14** (a v13 save goes to the Title with the
  message `persist.ts` already has for an old save). **`PROTOCOL_VERSION` stays 1**: nothing has been
  deployed, and L4's first deploy freezes whatever v1 is then. Say so in the notes.
- **Goldens:** both move, deliberately, **in one commit of their own** that says why. Record the new
  hashes.

### 2. Balance (the spreadsheet, then `npm run balance`)

Add the rows with `packages/engine/scripts/add-phase-n-rows.ts` (a copy of the Phase I upserter):
`startDogs` 4, `draftDogsPerStable` 5, `draftTrainersPerStable` 3, `draftRatingMin` 40, `draftRatingMax`
60, `offDraftDogsPerStable` 1.5, the AI's off-season margin; remove `startDogsDealt` and `draftLevelShift`. Keep
`startDogRating`: `ai/explore.ts` reads it as the Pound's reference rating (say if 50 is still right with
a 40–60 board). **Never hand-edit `balance.json`.**

Then measure, with the harness, **before and after**, and report every row:

| Measure | Target |
|---|---|
| Races entered per weekend per stable | **2.2–2.8 of 3** (was 1.8–2.4 for three dogs; four dogs are meant to fill more of the card) |
| Races per dog per season | 5–7 (unchanged) |
| Fitness at declaration / under 60 | 60–80 / 10–25% (unchanged) |
| **Win rate by opening draft position**, all Normal, 1,000 one-season games at 3, 6 and 8 stables | every position within **±3 points** of fair; report mean end worth by position too |
| Start worth spread (1st to last before week 1) | reported |
| V23's long-game rows (poorest at season 3 finishing top 3; poorest at the last season's start having its biggest gain) | **no worse than `v3i`'s 31% / 14%** |
| Mean end worth; poorer than they started | reported, not tuned (V22) |
| Commission as a share of purses; each trainer bonus re-priced by D12's regression | reported. ⚠️ The style-read bonus now only helps against Pound dogs: if it prices at ≤ 1%, **say so as an open question**; do not redesign it |
| `hub-clicks` | the weekend unchanged at ~9.4; **the draft ≤ 2 presses a pick** for a human, reported separately |

- **Food:** four dogs eat four crates a week. Scale `startCargo` so a stable starts with the same weeks
  of food as today (5 for three dogs → **7**), and say what it did.
- **If races entered land outside 2.2–2.8**, sweep the fitness cells (Race −20 / Rest +30) with `--set`
  and bring Jesse **one** multiple-choice question with the measured options (recommended first). Do not
  retune anything else without asking.
- **If draft position is unfair** beyond ±3, the first lever is the board's rating spread
  (`draftRatingMin/Max`), then its size; report what moved it.

### 3. The web (`packages/web`)

- **`screens/Draft.tsx`**, a **public table screen**: nobody passes the laptop for it, as the arrival and
  race day (E8). Hotseat: the board in two lists — dogs (name, age, style, the three stats as bars,
  rating, book value) and trainers (name, bonuses, cut) — and beside it the **pick order** (faces, the
  snake laid out by round, whose turn it is) and **every stable's picks so far**. On a human's turn: press
  an item, then "Take *name*" (two presses). AI picks show one at a time with a short beat so the table
  sees them, and can be skipped. Keys for the lists. **No new art**: reuse the kennel's dog card and the
  trainer card (`StaffCard`).
- **The off-season screen** becomes the one-round draft, public, in reverse standings order: the aging
  and the staff notice read first, then the board; taking a dog asks which of yours to retire (with its
  book value), and "Pass" is a button. Its title says why the order is what it is ("Last at the table
  picks first").
- **At 390 and 360** the board is readable and pickable: a stacked list, not a wide table. Check it with
  `hotseat-shots` (add `06-draft` and `07-off-season` to it) and by eye.
- **The Title's build panel** says "three dealt dogs": change it to "a draft of four dogs and two
  trainers". **`lib/report.ts`:** a "THE DRAFT" block (round 1's order, then each stable's picks in
  order), and the season-by-season line names each off-season's picks instead of V23's draft line.
- **`store/loop.ts`**: `screenFor` routes the new phase for hotseat and online; `passReason` for the
  first private screen after the draft.
- `season-check`, `hub-clicks`, the table walk, `race-view-check` and `view-walk` learn the draft.

### 4. Online (`packages/server` and the web's online path)

- The draft is **in turn order**, like the Market: the waiting line names the stable on the clock, and
  Nudge works. The off-season was "in any order" (L1b); **its pick now is not** — update
  `packages/server/src/game.ts` and ONLINE_PLAN (a note on L1b, and §10's L4 row still stands).
- `online-walk`, `online-table-walk` and `browser-walk` play the draft (the browser walk's race to 1
  Bone opens with it) and stay green; `server:test` gains a row for a draft pick out of turn being refused.

## RULES THAT DO NOT BEND

- **The weekend does not change.** Explore, the market, declarations, the races, the Bookie and the
  Pound read the same; `race-view-check` is identical to `shots/before/`, and every difference in
  `season-check` and `hub-clicks` is explained by four dogs and the draft.
- **Determinism:** same seed + same action log reproduces the game, the board and the order included, on
  any JS engine. No `Math.random`, `Date`, `Math.pow`/`exp`/`log`/trig in the engine. `npm test` green,
  with the draft's tests (below).
- **Tests** (`test/draft.test.ts`, rewritten): the snake order for 3, 6 and 8 stables; the 4 + 2 limits;
  an illegal pick refused; a whole draft by AI at every difficulty completes; the board's styles and
  ratings as specified; the off-season order is the reverse of the standings; a pass; a retirement pays
  book value; replay reproduces it. `view.test.ts`: nothing about the draft is secret.
- **Goldens** move once, in their own commit, with the reason. `STATE_VERSION` / `SAVE_VERSION` 14,
  `PROTOCOL_VERSION` 1.
- `view-walk` 0 throws. `asset-check` 288 / 0 / 0 (no new art). All three online walks green.
- **The Pages build on Node 20** from a clean `npm ci && npm run build` passes; **no dependency added**.
- **Lint and strict TypeScript** cover everything new, no `any`. **Format only what you edit.**

## The commit discipline, in this order

1. The sheet rows and `balance.json` (`add-phase-n-rows.ts`, `npm run balance`).
2. The engine: the board, the `draft` phase, `DraftPick`, the off-season pick, the AI, the view, the
   tests (goldens still old: skip or mark them for commit 3, and say so).
3. **The goldens, alone**, with why they moved and the new hashes.
4. Balance moves, if any, each with its measurement in the message (and Jesse's answer, if asked).
5. The web: `Draft.tsx`, the off-season screen, `screenFor`, the report, the Title panel, the checks.
6. Online: `game.ts`, the walks, `server:test`.
7. The docs:
   - **GDD_V3:** V29–V33 in §13; §2.2 rewritten for the off-season draft (keep the old notes as the
     record, marked superseded by V32); §5.5 and §8.1 amended ("dealt" → drafted); §4.2's arithmetic
     note for four dogs; §11's races-entered band 2.2–2.8 and the new draft-position row; §14 gains the
     style-read question if it arose.
   - **ONLINE_PLAN:** the L1b note (the off-season pick is in turn order).
   - **PLAYTEST_CHECKLIST:** the evening's sheet gains the draft: how long the opening draft took at the
     table, whether picking felt fair, whether anyone ended with a lopsided kennel, whether four dogs felt
     like too many to manage; and the off-season pick in game 2. `last synced`.
   - **BUILD_PLAN_V3:** a Phase N entry (not an L phase). **CANON:** `v3n`, last synced.
8. `claude/V3_PHASE_N_NOTES.md`, and this prompt as `claude/V3_PHASE_N_PROMPT.md`, corrected before
   commit where it was wrong, with the corrections in a box at the top. Tag **`v3n`** on that commit.

## DONE WHEN

| Measure | Target |
|---|---|
| A game opens with a 6-round snake draft of 4 dogs and 2 trainers; round 1's order drawn | ✅ hotseat, online, headless |
| The board shows everything; ratings 40–60, styles even across the range | ✅ tests |
| The off-season is one reverse-standings pick: dog, trainer or pass | ✅ tests, both screens |
| Races entered 2.2–2.8; races/dog 5–7; fitness in band | ✅ harness, or Jesse's answer |
| Draft position fair within ±3 points at 3, 6 and 8 stables | ✅ 1,000 games each |
| V23's long-game rows no worse than 31% / 14% | ✅ |
| The draft ≤ 2 presses a pick; the weekend's `hub-clicks` unchanged | ✅ |
| The board readable at 1280, 390 and 360 | ✅ `hotseat-shots` PNGs |
| Report has THE DRAFT; the Title panel says four dogs | ✅ |
| Goldens moved once, explained; versions 14 / 14 / 1 | ✅ |
| `npm test`, lint, build, `season-check`, `hub-clicks`, `race-view-check`, `view-walk`, `asset-check`, `server:test`, the three online walks, harness, Pages on Node 20 | ✅ |

## Then, in order

1. **Re-baseline** everything in step 4 of the mechanics into `shots/after/`, and paste the harness
   summary (and the draft-position table) into the notes.
2. `npm run snapshot`.
3. **Write `claude/V3_PHASE_N_NOTES.md`** in the style of the M notes: "Read this first"; what was built;
   every balance row before and after; the screenshots named; the rules that did not bend; open
   questions; and a **short** multiple-choice `v3n` checklist whose main question is **"the evening now,
   or L4 first?"**
4. Commit this prompt, corrected, and tag `v3n` on it.
5. **Land it** in Jesse's folder (the probe first; `main` only if everything is green) and give him
   `git push origin main` and `git push origin v3n`.
6. **Sync the Project** with `project_write`, and update each status header's `last synced`: the changed
   `design/*.md` (CANON, GDD_V3, BUILD_PLAN_V3, PLAYTEST_CHECKLIST, ONLINE_PLAN), and the new `claude/`
   notes and prompt.

## Still open, and not this phase's

- **The evening**, now with the draft. **L4** after it: the first deploy freezes `PROTOCOL_VERSION` 1.
- A trade between stables during the draft; keepers across seasons; a draft timer online. Not asked for.
- Still waiting: §5.2 hotseat inside an online room; §7.5 / §14 Q5 split view; §14 Q9; more human faces;
  the goldens cannot see betting or humans.
