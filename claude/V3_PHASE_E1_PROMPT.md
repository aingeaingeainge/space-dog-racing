# V3 Phase E1: the game's shape

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase E1 was built from,
> committed alongside `V3_PHASE_E1_NOTES.md`. Where it turned out to be wrong, the correction is
> here, above the original, which is otherwise unchanged. There are six corrections:
>
> 1. **"Snapshot unmoved for a one-season setup" (commit 3) cannot hold for the `stateHash`.** The
>    golden hashes the whole state, and the state gains `season`, `length`, `seasons` and
>    `gameOver`. Every other row of the digest was unmoved. With those four fields deleted, the
>    state hashes to the previous commit's exactly, and the commit says so.
> 2. **"How often the crosser is not the winner" is zero by construction.** Worth is checked once,
>    at the end of the weekend, so the richest stable at the check has crossed too. `--game` reports
>    it with the reason, plus two things that can happen: two stables crossing together, and the
>    leader going into the last weekend losing (GDD_V3 E3).
> 3. **"A two-season game … retire a dog in one season, keep them all in another"** needs two
>    off-seasons, and a two-season game has one. season-check walks two two-season games instead:
>    seed 42 retires and seed 7 keeps them all.
> 4. **The "Mean end worth" band moved (item 3) and was reported first, as asked.** It went 39,194
>    → 42,151, all of it book value from the age tick moving. Jesse's answer mid-phase: leave it and
>    report. Nothing was tuned.
> 5. **The betting rows** (house margin −10.9%, a stable dog backed blind +2.6%) left their bands
>    because of items 1 and 3, not a tip or `oddsScale` change. They are reported and not tuned.
> 6. **Commit order.** Items 1–9 are nine commits. Two small ones follow the re-baseline, each
>    snapshot unmoved: `--game` reading the Target finish as it can happen, and the top bar naming
>    the season with the Title's Target line corrected.

Phase E is two sessions, and this is the first. **E1 is the game's shape**:

- no free local runner (Jesse's call)
- multi-season: 1–5 seasons and the off-season between them
- Race to a Target
- a game that saves, resumes and replays across seasons
- the harness for whole games

**E2 is the table**: simultaneous hotseat, skippable races, the season-end and game-end screens,
and the playtest. Do not build E2's systems here, but leave the seams they will need.

## ⚠️ First: the mechanics. They are the same as D2's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **35 green**
     - `npm run lint` is clean
     - `npm run harness -- --seasons 20` runs
     - `npx tsx packages/web/scripts/season-check.ts` passes
- **Commits:**
  - Set `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`.
  - Commits are signed. Check for a `gpgsig` header with `git cat-file -p HEAD | head -6`, and keep
    every commit signed.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder.
     Give this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle to fast-forward from whatever his `main` actually is. If his tree is dirty or his
     `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:**
     1. `git bundle create` in the container.
     2. `device_commit_files` the bundle into his folder.
     3. In `device_bash`: `git fetch <bundle> main:refs/heads/work` plus the tag, then
        `git merge --ff-only work`, `git branch -d work`, and `rm <bundle>`.
     4. Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Pushing deploys to Cloudflare Pages, and that is Jesse's call. End by
     giving him the two push commands. (A stop hook may tell you there are unpushed commits. That
     is expected: say so and do not push.)
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. Build and test in the
     container.
- **Keep scratch probes out of the repo.** Put them in `.git/info/exclude` or outside the clone, and
  stage paths, not `-A`.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then run `npm run snapshot`. **`v3d2` is the tag to fall back to.** GitHub's `main` is at `v3d2`
(`1a51081`), pushed. The golden `stateHash` is **`1f5e508e…`**.

Jesse's calls for E, asked before this prompt was written:

- **Two sessions.** E1 is the game's shape, and E2 is the table.
- **Leave Hard alone.** It beats Normal 50.7% on head-to-head, with a mean 7,000 higher. Report it,
  and do not tune it.
- **No free local runner at all** (item 1). D2 found an injury nearly free because of it.
- **Retirement pays the dog's book value**, as GDD_V3 §2.2 says.

**Do not touch:**
- the race model
- `oddsScale`
- Phase B's market numbers
- D1's tip sizing
- D2's staff cuts and the nobble

If a band moves, report it first. The dials for mean end worth are still `dogOfferRatingMean` and
the Strip's gifts.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. In `design/GDD_V3.md`:
   - **§2 in full**: the season, game length, Target mode, the off-season, winning
   - §3, §4.3 (age), §4.4 (injury and the runner), §9.2 (offers) and §8 (staff)
   - decisions D1–D16
3. In `design/BUILD_PLAN_V3.md`: Phase E's deliverables and acceptance table.
4. `claude/V3_PHASE_D2_NOTES.md`, especially "Read this first" and "Carried forward".
5. The code:
   - `state.ts`: `createSeason`, `buildCalendar`, `STATE_VERSION`
   - `phases/endTurn.ts`: `finishSeason`, and the age tick at week 7
   - `phases/explore.ts`: `lendRunners`, the streams
   - `economy/acquire.ts`: the §9.2 offer
   - `economy/staff.ts`: `unemployedStaff`, `hireSlot`
   - `store/gameStore.ts`, `store/persist.ts`, `store/loop.ts`
   - `screens/Title.tsx`, `screens/SeasonEnd.tsx`

## The baseline (`v3d2`, golden `1f5e508e…`, 800 seasons all-Normal)

| Measure | Value |
|---|---|
| Mean end worth | **39,193** (band 25–40k) |
| Races entered / races per dog / p90:p10 | 2.16 / 6.59 / 1.93× |
| Phase B rows | food 33.1% · crossover week 4.4 · p99 leg 13.7% of worth |
| House margin / blind stable dog / buzzing dog | **−11.6%** (on the line) / −0.4% / +27.5% |
| Commission / seasons with a sabotage | 13.2% of purses / 69.1% |
| Local runners lent | about 1.2 a stable-season |
| Hard beats Normal (3 v 3) | 50.7% |
| `hub-clicks` | 9.4 a weekend |
| Under 60 at declaration | 23.1% |

## BUILD THIS SESSION

### 1. No free local runner (Jesse's call)

D2 measured that an injury is nearly free. It almost always lends the stable a Bronze runner, so
stables with half the injuries raced *less*.

- **Delete the runner outright:**
  - `lendRunners`, `LOAN_RACE`, `LOAN_STREAM`
  - `Dog.loan`, `Player.loanerId`
  - `localRunnerFitAt` (remove its row with the phase row script's `REMOVE` list)
  - the loaner's branches in `declare`, `runRaces`, `endTurn` and `emitDeclarations`
  - the Race Office's loaner text
- **Keep the vet cards.** They are the one guard left (§4.4).
- **Report the effect:** races entered, races per dog, mean end worth, injuries a stable-season,
  and the injury-halving trainer's regression coefficient (D2's method). A band may move. If races
  entered falls under 1.8, say so and stop there; do not tune the injury rate.
- The snapshot moves.

### 2. Game length (GDD_V3 §2.1)

- `SeasonSetup` gains a game length:
  - `{ kind: 'seasons', seasons: 1–5 }`, or
  - `{ kind: 'target', worth }` ⚖️
  - Suggested targets are sheet cells: 60,000 short and 150,000 long.
  - The default stays one season, and a v3d2-shaped setup must still mean one season.
- `GameState` gains:
  - the season number
  - the game length
  - a per-season record of standings and of each stable's season stats
- `stats` stays per season: reset at the new season, archived first. A game total is derived, not
  stored twice.
- **Target mode:**
  - Net worth is checked at the end of every weekend.
  - The first crossing ends the game at the end of that weekend.
  - The **highest** net worth wins, which is not necessarily the stable that crossed.
  - Tie-breaks as §2.4.
  - Target mode can run past five seasons; cap it at a sheet cell ⚖️ (say 10) and report how often
    the cap is hit.
- `finishSeason` becomes "finish the season, then either the off-season or the game's end".
  `finalStandings` means the game's.

### 3. The off-season (GDD_V3 §2.2): at most three clicks

This is a new phase between seasons, in this order.

1. **Every dog ages a year.** ⚠️ **The age tick moves here from week 7**, as §4.3 says ("age ticks
   once, in the off-season"). So a one-season game has no ageing at all. That is a rule change:
   - say so in the commit
   - retire `ageTickWeek`
   - report what it does to mean end worth
2. **The retirement window.** Each stable *may* retire one dog.
   - Retiring pays the dog's **book value** (`dogValue`; Jesse's call).
   - A replacement is offered under §9.2's rules: age, one true stat, patter that can lie. Reuse
     `rollOffer`, `describeOffer` and `acceptOffer`.
   - **Decide the order and say it.** Our reading: the stable sees the offer first, then chooses
     "retire *name*" or "keep them all". §2.2 says you see what you are offered before you accept.
   - The new dog arrives style-unknown and not dealt. `dealtGone` and `revealStyles` must stay
     sound (C4, D2).
3. **The staff notice.**
   - Each trainer has a small chance ⚖️ of leaving (a sheet cell; start at 15%).
   - A stable left with fewer than two trainers is offered one candidate from `unemployedStaff`,
     hired or refused as the Bar card does it.
4. **Carry over:**
   - Cash, cargo, dogs, trainers and known styles carry over untouched.
   - The circuit is re-drawn, prices reset, and conditions, jobs, bets and declarations are cleared.
   - Turn order is rolled as at any arrival.

**The actions and the streams:**
- The off-season's choices are `Action`s: for example `Retire { playerId, dogId | null }` and
  `ResolveStaffNotice`.
- Every stable's off-season draws run on its own stream, seeded once from the game's stream at the
  start of the off-season, in seating order. This is decision D1's pattern: no choice moves the
  game's stream or another stable's draws.
- Add that to the determinism test.

**The AI:**
- Normal retires its lowest-value dog when the offer, as it can see it, is worth more than that
  dog's book value plus a margin, or when a dog is 6 or older. Say the margin.
- Normal takes a staff candidate by `hireSlot`.
- Hard may do better.
- Easy keeps everybody.

**The screen:**
- One off-season screen per human.
- It shows the three steps with the ageing shown, not asked.
- No more than three presses. `hub-clicks` or a sibling counts them.

### 4. Save, resume and replay across seasons

- The save is still seed + log. A multi-season log must replay exactly.
- `STATE_VERSION` and `SAVE_VERSION` move.
- **A second golden:** add a golden digest for a **two-season** game (addition, not an edit). The
  existing one-season golden moves with items 1 and 3, and its commits say so.
- **CI:** `.github/workflows/ci.yml` runs Node 20 only. Add a matrix of **20, 22 and 24** (BUILD_PLAN
  Phase E's row), and say in the notes that it has not run until Jesse pushes.
- **Minimal UI so a whole game is playable:**
  - The Title screen chooses the length (seasons, or a target with the two suggestions and a custom
    figure).
  - The season end offers "On to season *N*", then the off-season screen.
  - A plain game-end line names the winner.
  - The real season-end and game-end screens are E2's.

### 5. The harness for whole games

Add `--game`:
- full games at **1, 3 and 5 seasons**, and in **Target mode** at both suggested targets
- six Normal stables, with a `--ai` mix allowed

Report every row below, each against its band:

| Measure | Band / note |
|---|---|
| Stables ending a season on less than they started | **10–25%** (§11) |
| Net worth gap, 1st to last, end of season | narrower than v2's (see below) |
| Nobody mathematically out before week 8 | ✅ (see below) |
| Dogs replaced per stable per two seasons, 5-season games | **≥ 1** |
| Target mode: weekends to finish, how often the crosser is not the winner, how often the cap is hit | reported; the finish is E2's playtest row |
| Age mix of kennels at the start of each season, 5-season games | reported: is the game ageing into seven-year-olds? |
| Mean end worth per season, and whether rich stables compound | reported |
| Engine wall-clock per player-weekend | reported |

- **The v2 gap:** find v2's equivalent in the v2 notes if it was recorded. If it was not, measure it
  in a scratch clone at `v2e` with that tag's own harness, and say which.
- **"Mathematically out":** define it before you measure it. For example, at the start of week 8,
  last place's worth plus every purse still to run is still under the leader's worth. Report the
  share of stables that are out.

### 6. The checks

- `season-check` walks:
  - a two-season game with a human through the off-season (retire a dog in one season, keep them all
    in another)
  - a Target-mode game to its end
  - It fails if the off-season never offered a retirement or a staff candidate across the run.
- **Property tests (additions only):**
  - ages rise by exactly one per off-season and never at week 7
  - a retirement pays exactly the dog's book value
  - a Target game ends at the end of the first weekend anybody crosses, and the highest worth wins
  - stats reset at a new season and the archive keeps the old ones
  - no dog anywhere carries `loan`
- Existing tests that assert the runner or the week-7 tick will need edits. Say so in the commit and
  the notes, as D1 did.

## RULES THAT DO NOT BEND

- **The engine:** `packages/engine` has no DOM, React, `Date` or `Math.random`, and no
  `pow`/`exp`/`log`/trig. Randomness goes through `rng.ts`, threaded, and per-stable streams stay the
  rule.
- **Actions and ticks:** every state change is an `Action`. The renderer replays the tick log.
- **Content is data:** a target, a retirement margin cell, a staff-notice chance and a season cap are
  rows.
- **Numbers:** they go in the spreadsheet through `add-phase-e1-rows.ts`, a copy of
  `add-phase-d2-rows.ts`. Never hand-edit `balance.json`. An AI's own threshold may live in `ai/` as
  D2's did.
- **Scope:**
  - no simultaneous hotseat, no skippable-race option, and no new end screens (E2)
  - no race-model, `oddsScale`, tip or staff-cut change
- **Tests:** the golden snapshot moves only in commits that say so and why. `properties.test.ts` and
  `determinism.test.ts` take additions, and edits only where item 1 or 3 forces them, named.
- **Formatting:** format only what you edit. `design/*.md` is outside the format globs.

## The commit discipline, in this order

1. Spreadsheet rows, data only. Snapshot unmoved.
2. No free local runner. Snapshot moves.
3. Game length and Target mode in the engine. Snapshot unmoved for a one-season setup, and say so.
4. The off-season, and the age tick moved there. Snapshot moves.
5. The AI's off-season.
6. Save, resume and the second golden; the CI matrix.
7. The minimal UI: Title, season end, the off-season screen, the game-end line.
8. `--game`, `season-check` and property tests. Snapshot unmoved.
9. The version bump.

Retunes after the re-baseline get their own commits.

## DONE WHEN (BUILD_PLAN_V3 Phase E, E1's rows)

| Measure | Target |
|---|---|
| Stables ending a season on less than they started | 10–25% |
| Net worth gap, 1st to last, end of season | narrower than v2's |
| Nobody is mathematically out of contention before week 8 | ✅, by the definition you write down |
| A 5-season game's dog roster turns over | ≥ 1 dog replaced per stable per 2 seasons |
| Seed + action log reproduces a whole multi-season game | ✅ in tests; Node 20/22/24 in CI once pushed |
| One-season rows: mean end worth, races entered, races/dog, Phase B rows, the betting rows | inside their bands, or reported |
| `npm test` green; `npm run build` → `packages/web/dist` | ✅ |

E2's rows are the playtest rows (🎲): 25 minutes for four humans with races skipped, 40 with them
watched, 70 for eight, and a Target finish worth watching. List them as outstanding.

## Then, in order

1. **Full re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - `season-check`, `hub-clicks`, `race-view-check`
   - 800 all-Normal
   - `--explore`, `--styles`, `--calibrate`, `--autoplan`
   - 3 Hard v 3 Normal
   - `--game` at 1/3/5 seasons and both targets
2. **Serve the build and screenshot:**
   - the Title with a game length chosen
   - the off-season screen with a retirement offer
   - the hub in season 2
   - a Target game's final weekend

   Build them from saves generated headlessly, as D1 and D2 did.
3. `npm run snapshot`, then `git tag v3e1` on the notes commit.
4. **Write `claude/V3_PHASE_E1_NOTES.md`** in the style of the D2 notes. End it with a **short**
   multiple-choice `v3e1` checklist:
   - did a second season feel different from the first
   - was the retirement a real decision
   - did injuries feel worse without the runner
   - does 60,000 make a good short game
5. **Update the design docs:**
   - decision rows **E1, E2, …** in `design/GDD_V3.md`: the runner cut, game length and Target, the
     off-season order and streams, the age tick, the definition of "mathematically out"
   - inline notes in §2.1, §2.2, §4.3 and §4.4
   - §14 Q4 and Q6 updated
   - Phase E1's status in `design/BUILD_PLAN_V3.md`
   - the `v3e1` tag in `design/CANON.md`
6. Commit this prompt as `claude/V3_PHASE_E1_PROMPT.md`, corrected before commit where it was wrong.
7. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3e1`. Sync the changed `design/*.md` and the new
   `claude/` notes and prompt to the claude.ai Project with `project_write`, and update each status
   header's `last synced`.
