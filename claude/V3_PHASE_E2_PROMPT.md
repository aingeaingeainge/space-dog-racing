# V3 Phase E2: the table

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase E2 was built from,
> committed alongside `V3_PHASE_E2_NOTES.md`. Where it was wrong, the correction is here, above the
> original, which is otherwise unchanged. There are four corrections:
>
> 1. **"Check the Actions tab result with `gh run list` if `gh` is authenticated."** `gh` is not
>    installed in the build container, and the GitHub API refused the session. So CI was not
>    checked, and the notes say so. Check it by hand before pushing.
> 2. **"The one-season golden does not [move]" held for the fresh season, but not for the whole
>    phase.** Item 4's archive (`SeasonRecord.moments`) and the version bump both change the one-season
>    `stateHash`, as E1's new fields did. The rows never moved, and with `moments` deleted the state
>    hashes to the previous commit's exactly. `777d21bf…` → `8dc05e06…`.
> 3. **"Public moments are watched together, with no pass"** needed a reading. The arrival and the
>    board are public screens, and each ends on a button that *is* the pass when the laptop has to
>    move, so neither costs a press on top of a handover. The results were not public before E2: they
>    showed the first human's slips to the table. At a table they now show no slips.
> 4. **"Explore, Kennel and the Bookie take no more passes than privacy needs"** is met in the sense
>    that the rules allow. Explore and the Market/Race Office sitting are both in turn order, and one
>    must end before the other opens, so each human still needs a sitting for each. Merging them is a
>    rules call, and it is carried forward.

---

Phase E is two sessions, and this is the second. **E1 built the game's shape** (`v3e1`):

- no free local runner
- 1–5 seasons or a Race to a Target
- the off-season
- multi-season save and replay
- `--game`

**E2 is the table:** three to eight people round one laptop finish a game in forty minutes and
want another. Four things:

1. the hotseat loop, with the laptop passed as little as privacy allows
2. race day that can be skipped
3. the real season-end and game-end screens
4. the playtest kit

Plus one rule change: dogs start a new season fresh (Jesse's call).

## ⚠️ First: the mechanics. They are the same as E1's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **43 green**
     - `npm run lint` is clean
     - `npm run harness -- --game --games 20` runs
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
  stage paths, not `-A`. E1's probes lived in `shots/` (excluded) and the scratchpad; do the same.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then run `npm run snapshot`. **`v3e1` is the tag to fall back to.** GitHub's `main` is at `v3e1`
(`58bc643`), pushed. **The golden digests:**

- one season: **`777d21bf…`**
- two seasons: **`e68d8f28…`**

**The first push has now run CI** on the Node 20/22/24 matrix. Check the Actions tab result with
`gh run list` if `gh` is authenticated. Otherwise say it could not be checked. If a leg failed,
that is the first thing to fix.

## What Jesse said after `v3e1`

He played a race to 60,000.

- **It ended at week 6 of season 1**: an AI crossed with Jesse close behind. He never reached the
  off-season, so the retirement and the second season are still unplayed by a human.
- **"It's fine as is."** Six weeks is a fine short game. Do not change the target or the rule.
  (The harness's mean is 13.2 weekends, with p10 at 10; week 6 is early but inside the spread.
  Report where week 6 sits in `--game`'s distribution, and nothing more.)
- **The rest was fun: keep going.** No bug reports, and no complaints about pace.

**His calls for E2, asked before this prompt was written:**

- **Races: watch everything, with a Skip button.** Nothing is auto-skipped. A Skip already exists in
  the race view (`RaceView.tsx`: the button and the `S` key skip to the result). E2 adds
  **"Skip the rest of race day"**, so one press skips every race left this weekend to the results.
  No auto-skip, and no Title toggle.
- **Dogs start a new season fresh.** The off-season counts as a long rest: at `startNextSeason`,
  every dog's fitness goes to full and any layoff clears. It is a sheet cell (fitness at the start of
  a season, 100) and a rule change. The snapshot's two-season golden moves, and the commit says so.
- **The economy waits for the playtest.** Do not tune for E1's two misses: 0.8% of stables end a
  season poorer, and the leader runs away in long games. Measure them again after the fresh-season
  rule, report them, and change nothing to move them.

**Still true from before:** leave Hard alone (49.9%), and do not touch the race model, `oddsScale`,
Phase B's market numbers, D1's tip sizing, D2's staff cuts or the nobble. If a band moves, report
it first.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. In `design/GDD_V3.md`:
   - §2.3 (the weekend: which steps are simultaneous and which are in turn order)
   - §3 (players, hidden information)
   - §7.5 (watching)
   - §10 and §10.1 (screens and the click budget)
   - §2.2
   - decisions E1–E7
3. In `design/BUILD_PLAN_V3.md`: Phase E's deliverables and acceptance table, and E1's status block.
4. `claude/V3_PHASE_E1_NOTES.md`, especially "Read this first" and "Carried forward".
5. The code:
   - `store/loop.ts`: `screenFor`, the pass screen, `weekKey`, `seasonSeen`
   - `store/gameStore.ts`, `store/persist.ts`
   - `components/PassTo.tsx`
   - `screens/Explore.tsx`, `screens/Bookie.tsx`, `screens/RaceView.tsx`, `screens/Results.tsx`,
     `screens/SeasonEnd.tsx`, `screens/OffSeason.tsx`
   - `lib/seasonEnd.ts` (moments), `components/WorthChart.tsx`
   - `engine/src/phases/turn.ts`, `phases/explore.ts`, `phases/game.ts`
   - `web/scripts/hub-clicks.ts`, `season-check.ts`

## BUILD THIS SESSION

### 1. The hotseat loop (GDD_V3 §2.3, §3, V20)

§3: "Simultaneous wherever the shelf is not shared." Explore, Kennel and the Bookie resolve at
once; only the Market and the Race Office are taken in turn. The engine already resolves Explore
in turn order on private streams (D1). The Bookie is still a turn-order player phase, and the
laptop is passed at every change of active human.

- **Count first.** Add to `hub-clicks` (or a sibling script) the **pass screens a weekend** at a
  table of 4 humans and of 8, and the presses each human spends. That is the baseline.
- **Then cut the passes:**
  - Each human's private steps should be one sitting per phase. Explore's door and card, their
    Market and Kennel, the Race Office, and their bets should chain into as few hand-overs as the
    rules allow, without showing anyone else's private business.
  - What the engine needs, if anything (for example a betting phase that takes each human's slips in
    one sitting rather than in turn order), is an `Action`-level change with the determinism
    argument written down. Bets never read another stable's bets, so order-independence should hold.
    Prove it in the determinism test.
  - Anything purely presentational stays in the UI.
- **Public moments are watched together, with no pass:**
  - the turn order at arrival
  - the Race Office board
  - race day and the results
  - the season end
- **The pass screen** names who is next and why ("Market, in turn order"), and it is skipped when
  the same human acts twice in a row.
- **Report** the passes a weekend and presses a human a weekend, before and after, at 4 and at 8.

### 2. Race day that can be skipped

- **"Skip the rest of race day"** in the race view jumps every remaining race this weekend to the
  results (Jesse's call). It is one press.
- The existing per-race Skip stays.
- Watching changes nothing in the engine, so this is UI only, and `racesWatchedWeek` still marks the
  weekend.
- The Results screen stays public and is read once by the table.

### 3. Fresh at the new season (Jesse's call)

- At `startNextSeason`, every dog's fitness goes to a sheet cell (`seasonStartFitness`, 100) and its
  `injuryWeeks` goes to 0.
- **A rule change:** the two-season golden moves, and the one-season golden does not. Say both.
- **Report** races entered by season in 5-season games (E1: 2.12 → about 1.87). Also report mean
  worth by season, the poorer-than-they-began row and the out-at-week-8 row, all before → after.
  Tune nothing.

### 4. The season-end and game-end screens (GDD_V3 §10, BUILD_PLAN_V3 Phase E item 5)

E1's screens are minimal: the old one-season podium, plus a line.

- **The season end** (between seasons, and the last season of any game):
  - the podium
  - the income split (prizes, trading, betting, the trainers' cut: `roadSplit`)
  - the net-worth chart
  - the moments
  - a one-line "on to season N" that leads to the off-season
- **The game end:**
  - **the winner, big**, and the reason the game ended (seasons ran out / target crossed / cap)
  - **a whole-game net-worth chart across every season**, drawn from the archive
    (`SeasonRecord.stats[*].worthByWeek`), with the season boundaries marked
  - **the game's moments**. The archive does not yet keep moments or races. Decide whether a
    season's moments are computed at `finishSeason` and archived, or whether the game end shows
    only the last season's plus totals. Say which and why. If the archive grows, it is a state change
    (`STATE_VERSION`).
  - **a table of seasons**: who topped each season, and the game totals (Gold Cups and races won
    come from `gameTotal`)
  - **in a Target game:** who crossed, on which weekend, and whether two crossed together or the
    leader was caught on the last weekend (E3)
  - "Play again" (the same setup, from the start) and "New game"
- **No new rules.** Both screens read the archive and the live state.

### 5. The playtest kit

The four 🎲 rows need humans in a room, and E2 cannot close them. Build what makes them cheap to
run:

- **A pace timer.** A UI-only record, kept in the save's `ui` block rather than in game state:
  - the wall-clock seconds each weekend took from arrival to "Fly on"
  - split into time on private screens, on race day, and on pass screens

  Show it on the game-end screen as "this game took *m* minutes, *s* per weekend, of which race day
  *r*". Wall-clock time must never enter the engine or the log.
- **`design/PLAYTEST_CHECKLIST.md`**, updated for E2:
  - the four timed rows (4 humans with races skipped ≤ 25 min, watched ≤ 40, 8 humans ≤ 70, a Target
    finish worth watching)
  - how to read the timer
  - the E1 checklist's unplayed questions (a second season, the retirement)

### 6. The checks

- **`season-check`:**
  - walks a four-human table through a two-season game and a Target game
  - presses "skip the rest of race day" at least once
  - fails if any human ever sees another's private screen without a pass in between. Write the check
    as a rule about `screenFor`: the screen's owner changed and it was not a public screen or a pass.
- **`hub-clicks`:** reports passes and presses a weekend at 4 and at 8 humans.
- **Property and determinism tests (additions only):**
  - every dog's fitness is `seasonStartFitness`, and nobody is injured, at the first arrival of every
    season after the first
  - if the betting phase changes shape, the order humans place bets in never changes the state after
    the lock
- Existing tests that the fresh-season rule forces are edited, and named in the commit.

## RULES THAT DO NOT BEND

- **The engine:** `packages/engine` has no DOM, React, `Date` or `Math.random`, and no
  `pow`/`exp`/`log`/trig. Randomness goes through `rng.ts`, threaded, and per-stable streams stay the
  rule. **The pace timer is UI-only.**
- **Actions and ticks:** every state change is an `Action`. The renderer replays the tick log.
- **Content is data:** `seasonStartFitness` is a sheet row, through `add-phase-e2-rows.ts`, a copy of
  `add-phase-e1-rows.ts`. Never hand-edit `balance.json`.
- **Scope:**
  - no economy change for E1's two misses
  - no target or Target-rule change
  - no auto-skip
  - no online multiplayer
  - no race-model, `oddsScale`, tip, staff-cut or Hard change
- **Tests:** a golden moves only in commits that say so and why. `properties.test.ts` and
  `determinism.test.ts` take additions, and edits only where item 3 forces them, named.
- **Formatting:** format only what you edit. `design/*.md` is outside the format globs.

## The commit discipline, in this order

1. Spreadsheet rows, data only. Snapshots unmoved.
2. Fresh at the new season. The two-season golden moves; the one-season golden does not.
3. The pass count in `hub-clicks`, as a baseline. Snapshots unmoved.
4. The hotseat loop: the engine piece if any (with its determinism test), then the UI. Say whether
   either golden moved.
5. "Skip the rest of race day."
6. The season-end screen.
7. The game-end screen, and the archive change if item 4 needs one.
8. The pace timer and the playtest checklist.
9. `season-check`, `hub-clicks` and the property tests.
10. The version bump, if the state or the save changed.

Retunes after the re-baseline get their own commits. None are expected.

## DONE WHEN (BUILD_PLAN_V3 Phase E, E2's rows)

| Measure | Target |
|---|---|
| Explore, Kennel and the Bookie take no more passes than privacy needs | ✅, with passes a weekend at 4 and 8 humans reported before → after |
| Race day skippable in one press | ✅ |
| Season-end and game-end screens: income split, net-worth chart (whole game at the end), moments | ✅ |
| A new season starts every dog fresh | ✅ property test |
| `season-check` walks four humans with no private screen leaking | ✅ |
| CI green on Node 20/22/24 | ✅ (check the run from the `v3e1` push) |
| One-season rows unmoved; E1's `--game` rows re-measured after the fresh-season rule | reported |
| 🎲 4 humans, 1 season, races skipped ≤ 25 min · watched ≤ 40 · 8 humans ≤ 70 · a Target finish worth watching | outstanding, with the pace timer built to measure them |
| `npm test` green; `npm run build` → `packages/web/dist` | ✅ |

## Then, in order

1. **Full re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - `season-check`, `hub-clicks`, `race-view-check`
   - 800 all-Normal (should be unmoved)
   - `--game` at 1/3/5 seasons and both targets
   - `--explore` only if the betting phase changed
2. **Serve the build and screenshot:**
   - a pass screen at a four-human table
   - race day with "skip the rest"
   - the season end between seasons
   - the game end of a three-season game (the whole-game chart)
   - the game end of a Target game

   Build them from saves generated headlessly.
3. `npm run snapshot`, then `git tag v3e2` on the notes commit.
4. **Write `claude/V3_PHASE_E2_NOTES.md`** in the style of the E1 notes. End it with a **short**
   multiple-choice `v3e2` checklist, which is the playtest:
   - how long a four-player season took by the timer
   - did the passing feel right
   - did anyone skip races, and which
   - did the game-end screen tell the story of the game
   - now that there is an off-season to reach: was the retirement a real decision
5. **Update the design docs:**
   - decision rows **E8, E9, …** in `design/GDD_V3.md`: the hotseat loop and what it passes, the
     fresh season, the archive's moments if they changed, and the pace timer
   - inline notes in §2.2, §2.3, §3, §7.5 and §10.1
   - Phase E's status in `design/BUILD_PLAN_V3.md`: E2 built, and the 🎲 rows outstanding until
     Jesse's table has played
   - the `v3e2` tag in `design/CANON.md`
6. Commit this prompt as `claude/V3_PHASE_E2_PROMPT.md`, corrected before commit where it was wrong.
7. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3e2`. Sync the changed `design/*.md` and the new
   `claude/` notes and prompt to the claude.ai Project with `project_write`, and update each status
   header's `last synced`.
