# V3 Phase C2 — the race, retuned

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase C2 was built from,
> committed alongside `V3_PHASE_C2_NOTES.md`. Where it turned out to be wrong it is corrected in
> place. Each correction is marked **⚠️ Corrected:** so the original claim and the fix can both be
> read. Nothing else is changed. Five corrections:
>
> 1. **No sane hot pace reached +4.** The prompt said to stop and ask if that happened, and it did.
>    Jesse chose a **+2 floor**, along with a re-balance of two style numbers so the calendar stays
>    even (front-runner fade −0.07 → −0.05, closer +0.06 → +0.04, and +0.035 once the run-in landed). That re-balance crosses the prompt's
>    "do not touch the style curve" line, and he took that call explicitly (C12, C13).
> 2. **None of the listed finish dials could reach the target inside the calibration band.** Race-day
>    luck is what holds a rating-65 dog to about half its races, and the fade makes margins *wider*,
>    not narrower. The dial built was a new pair of cells under "the fade penalty's shape": the
>    **run-in**, where the whole field tires alike over the last 15 m (C14). It is not a catch-up rule.
> 3. **`--calibrate`'s least squares moved the wrong way.** It said 18; the real-field reading said 18
>    left a stable dog +2.8% a Bone. The refit went to **19** instead (C15). That is C7's lesson again.
> 4. **The snapshot moved four times, not three.** A v3c log replays into a different season, so
>    `STATE_VERSION` and `SAVE_VERSION` moved in their own commit. There is also a property-test commit
>    the prompt's order did not have.
> 5. **"The fade cost is never larger than the fade itself" needed a reading.** Built: what a burned
>    front-runner actually pays in metres of fade point is no more than its own style fade shift at the
>    mean expression (24.6 m against 24.0 m, at the line).

A short phase between C and D, and **Jesse's call after playing `v3c`**. Two jobs and nothing else:
a front-runner contest that pays closers, and finishes close enough to be worth watching. Phase D
(Explore and the event deck) comes after, unchanged.

## ⚠️ First: the mechanics, because you are not in Jesse's working tree

- `git clone https://github.com/aingeaingeainge/space-dog-racing` into the container and work there.
  `npm install`, then verify before touching anything: **`npm test` 26 green**, `npm run lint` clean,
  `npm run harness -- --seasons 20` runs, `npx tsx packages/web/scripts/season-check.ts` passes. If
  any of those fails on a fresh clone, stop and say so.
- `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are signed; check
  for a `gpgsig` header with `git cat-file -p HEAD | head -6` (`%G?` reads `N` in the container), and
  keep every commit signed.
- You cannot push. Pushing deploys to Cloudflare Pages, which is Jesse's call.
- ⚠️ **Run `git ls-remote origin` before writing any handoff.** At the time of writing, GitHub's `main`
  is `5bc0165` and `v3c` is pushed. Build the bundle to fast-forward from whatever `origin/main`
  actually is, and round-trip test it (fresh clone, fetch the bundle, `merge --ff-only`, `npm ci`,
  `npm test`).
- The Cowork shell into `C:\Users\jesse\Documents\CoWork\dog racing game` mounted at the end of Phase
  C. Write the bundle there with `device_commit_files`. **Never run anything that writes the index in
  that folder** (`git status`, `git add`, …): deletes are blocked, so git leaves a stale
  `.git/index.lock`. `git log`, `git rev-parse` and `git bundle verify` are safe. Build in the clone.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then `npm run snapshot`. **`v3c` (`5bc0165`) is the tag to fall back to.**

## What Jesse said after playing `v3c`

Multiple-choice checklist, his answers:

| Question | Answer |
|---|---|
| Could you tell why a dog won, from watching? | **Yes, usually** |
| Could you name a dog's style after one race, before the screen said? | **Yes, from watching** |
| Did the Race Office board change your entries? | **Both — the trip and the field** |
| Did you miss the contest rule? | **Yes, want it back** |
| Are the races too strung out? | **Yes, too spread out** |
| Thirty races a season worth watching? | Only the ones I'm in |
| The book at `oddsScale` 18.75? | Fair — but without insider knowledge, betting didn't feel worth it (that is Phase D's job: race-day events) |
| Did any week present a real choice? | **Most weeks** |

So styles work and are readable — **do not touch the style curve's shape or the reveal**. What is
missing is the interaction between front-runners, and finishes that bunch. Betting is Phase D.

**⚠️ Corrected:** the curve's *shape* was left alone (a burst and a fade; slow away and home late),
but two of its numbers moved to keep the calendar even under the hot pace and the run-in. Jesse
chose that when the kill-switch grid was put to him: front-runner fade shift −0.07 → −0.05, closer
+0.06 → +0.035 (C13, C14).

## Read, in this order

1. `CLAUDE.md` — the non-negotiables. No `Math.pow` / `exp` / `log` in `packages/engine/src`.
2. `claude/V3_PHASE_C_NOTES.md` — **all of it**, especially Miss 1 (why the contest rule could not
   reach its floor) and C5 (why A7 widened the margins). Baseline numbers come from here.
3. `design/GDD_V3.md` — §5 in full with its `v3c` notes, §7.2, §11, decision rows C1–C11, §14 Q10–Q11.
4. `design/BUILD_PLAN_V3.md` — Phase C's acceptance table and §2.3.
5. The contest rule as built and measured is in the history: `git show 67aa702`. Read it before
   writing anything; the tick-loop plumbing (positions at the start of the tick, a `duel` event,
   `RunNote.contested`) is reusable, the rule is not.

## The baseline you are changing (`v3c`, golden `31f93a85…`)

| | `v3c` |
|---|---|
| winning margin, median / mean | **10.6 m / 13.8 m** (v3b 7.3 m) |
| photo finishes | **1.8%** of races (v3b 2.2%) |
| lead changes per race | 2.66 |
| closer's win %, 1 / 2 / 3 front-runners (equal dogs, 480 m) | 13.1 / 13.1 / 12.8 |
| no-advantage, across the calendar | 12.9 / 12.0 / 12.6 |
| stat leverage at 480 m | 24.5 / 18.3 / 16.7 |
| calibration, 65 v seven 50s | 49.5%; `oddsScale` 18.75 = least-squares fit |
| house margin in real fields (`--styles` row 5) | −12.2%; every stable dog +0.2% |
| variance shares: fitness / expression / form | 2.6% / 1.6% / 1.0% |
| mean end worth | 39,143 · races entered 2.02 · races/dog 6.75 |
| `autoplan%` | 27.4% (entries 27.4, states 99.2) |

**⚠️ A diagnosis made while writing this prompt, so you do not re-derive it:** the margins are *not*
coming from uneven fields. Over 60 all-Normal seasons, races whose two best-rated runners are within
3 rating points still have a **9.9 m** median margin; races with an 8+ point gap, 12.3 m. Bronze,
Silver and Gold all sit at 10–11 m. The spread is made **inside the race** — per-dog race-day luck
(`raceLuckSd` 2.2 × `raceLuckCoef` 0.4 on top speed, about ±5% a dog) and, since A7, a fade that no
longer drags the whole field back together at the line. Confirm this yourself before choosing a dial.

## BUILD THIS SESSION

### 1. A contest rule that pays closers (GDD_V3 §5.3, V14, §14 Q10)

The `v3c` rule failed for two reasons, both measured (Phase C notes, Miss 1):

- **"Another dog within 2 m at the head" burned a lone front-runner** on the stalkers beside it, so
  one front-runner and three were punished alike and the gap between them never opened.
- **A burned front-runner's wins went to everybody behind it**, so a closer collected about a fifth.

The replacement is a **hot pace**, and it has to fix both:

> When **two or more front-runners** are within `contestDistance` of each other at the head of the
> field inside the first third, the pace is **hot**. While it is hot, **every runner within
> `hotPaceDistance` of the leader** pays a fade cost pro rata to the ground it covers in that lead
> group — front-runners and the stalkers sitting on them alike. A dog far enough back pays nothing.

A lone front-runner is never burned (it takes two front-runners to light the pace). A closer, slow
away by its own curve, is mostly out of the lead group and pays nothing, so the leaders — stalkers
included — come back to it and not to each other. That is "front-runners burning each other out"
with the benefit landing on the style it is meant for. Everything is a sheet cell; a style's
`contests` flag comes back as a row, not a branch.

⚠️ **Measure it the same way `v3c` did** (`--styles` row 3: a rating-50 closer against seven equal
dogs, *k* front-runners and the rest stalkers, 480 m, 6,000 races a cell) **and sweep** the lead-group
distance and the cost. Report the whole grid, as Phase C did.

⚠️ **The kill switch changes, and this is Jesse's decision already taken:** he wants the rule. So if
no sane setting reaches **+4 points** (closer, 3 front-runners vs 1), **do not cut it and do not tune
past sense — stop and ask him** with the grid in front of him, and a recommendation for the floor
(Phase C's analysis suggests an eight-dog field caps what any one runner can collect). "Sane" means:
the no-advantage check still holds across the calendar (styles within 1.5 points), a front-runner in
a field with no other front-runner is not worse off than at `v3c`, and the fade cost is never larger
than the fade itself.

**⚠️ Corrected:** it happened, and he chose the floor. With 79% of real races holding two or more
front-runners, any setting strong enough for +4 made the front-runner the worst style across the
calendar (4 / 6 / 120: +4.4, spread 5.6). Re-balanced to even, the rule can only move wins between a
lone front-runner and a crowded one. Built: +2.3 at 4 m / 6 m / 90 m, with a floor of +2 (C12, C13).

Also report, whatever it says: a front-runner's win % with 0 / 1 / 2 other front-runners, and how
often a real season's race has a hot pace at all.

### 2. Closer finishes (GDD_V3 §14 Q11)

Jesse: **too spread out.** Target for this phase, 800 all-Normal seasons:

| | target | `v3c` | v3b |
|---|---|---|---|
| winning margin, median | **4–7 m** | 10.6 | 7.3 |
| photo finishes (< 0.3 m) | **≥ 3%** | 1.8% | 2.2% |
| finishes under 2 m | report | 10.9% | — |

Diagnose first (the note above), then choose. The candidate dials, all in the sheet: `raceLuckSd` /
`raceLuckCoef` (the per-dog race-day spread), `raceFadeLengthMetres` (250 m since A7) and the fade
penalty's shape, `raceTickNoiseSd`. **Do not add a catch-up or rubber-band rule** — a race that
pulls the leader back artificially is a different game, and the fields would stop meaning anything.

**⚠️ Corrected:** `raceLuckSd` and `raceTickNoiseSd` live in `balance.extras.json`, not the sheet.
And none of these four dials can make the target on its own:

- Luck is also what holds calibration. At 1.2, a rating-65 dog wins 79%.
- Tick noise does nothing to the margin.
- Every longer or harder fade made margins *wider*.

A margin in metres is the time gap multiplied by the speed at the line. So the dial built is the
field's speed at the line: over the last 15 m, every runner slows by the same fraction at the same
point on the track (C14). It reads only where that dog is, so it pulls nobody back.

⚠️ **What must not break while you do it**, because every one of these dials moves them:

- **Stat leverage at 480 m**: speed > accel > stamina, all 14–26% (A7's row). Stamina still climbing
  with the trip.
- **Calibration**, 65 v seven 50s: 45–60%. Less luck means the better dog wins more — expect it to
  rise, and watch the ceiling.
- **The book**: re-fit `oddsScale` if the race model moves (`--calibrate` least squares), and check
  the **real-field** reading — `--styles` row 5's house margin back near 12–15%, every stable dog no
  better than +2%. C7 is the precedent: the calibration probe alone is not the criterion.
- **Variance shares**: expression below fitness, above form. Cutting luck raises every other share.
- **Style no-advantage** across the calendar, and the trip effect (front-runners on sprints, closers
  on staying trips) still visible.
- **The market rows** and races entered / races per dog — they should not move much; say if they do.

**⚠️ Corrected:** least squares said 18; the real-field reading said 18 was the wrong way. The refit is
19 (C15).

### 3. The harness

`--styles` gains the hot-pace rows (item 1's grid can live behind a flag if it is slow) and a margin
row broken down the way the diagnosis above was: median margin, photo %, under-2 m %, and median by
top-two rating gap. `race-view-check.ts` keeps its style-call tally; add a commentary line for a hot
pace (two front-runners taking each other on, and the closer who picks up the pieces) — and check
it fires, the way Phase C counted the others.

## RULES THAT DO NOT BEND

- `packages/engine`: no DOM, React, `Date`, `Math.random`; no `pow`/`exp`/`log`/trig. Randomness via
  `rng.ts`, threaded. **The hot-pace rule must not draw from the rng** — it reads positions, so the
  stream cannot shift with it.
- Every state change an `Action`; the renderer replays the tick log and never re-simulates.
- Numbers in the spreadsheet via `add-phase-c2-rows.ts` (copy `add-phase-c-rows.ts`), never a literal
  in `packages/engine/src`, never a hand-edit of `balance.json`.
- A style is a row. If the hot pace needs a branch on a style's name, stop.
- **Scope**: no events, no Explore, no staff, no betting changes beyond the `oddsScale` refit. Do not
  touch the style curve, the reveal, the deal, the trait list or Phase B's market. Hard gets no new
  behaviour this phase — but report Hard v Normal, since a field-shape effect is exactly what Hard
  could read later.
- Format only what you edit; `design/*.md` is outside the format globs.

## The commit discipline

The golden snapshot moves only in commits that say so and why; commits that do not move it say that
too. `properties.test.ts` and `determinism.test.ts` take additions, not edits. Land in this order:

1. Spreadsheet rows, data only, nothing reads them — snapshot unmoved.
2. **The hot pace alone**, with a re-baseline either side and the sweep in the message.
3. **The finishes alone** — the dial(s) and any style re-balance they force — re-baseline either side.
4. **The `oddsScale` refit**, if the race model moved it, with the real-field reading.
5. Commentary and harness rows — snapshot unmoved.

**⚠️ Corrected:** two more commits landed after 5. One adds property tests (no snapshot move). The
other bumps `STATE_VERSION` 7 → 8 and `SAVE_VERSION` 6 → 7, which is snapshot move 4.

## DONE WHEN

| Measure | Target |
|---|---|
| Closer's win %, 3 front-runners vs 1 (hot pace on) | **≥ 4 points better**, or Jesse has decided the floor |
| A lone front-runner, vs `v3c` | not worse off |
| Style no-advantage across the calendar | within 1.5 points |
| Winning margin, median | 4–7 m |
| Photo finishes | ≥ 3% |
| Stat leverage at 480 m | speed > accel > stamina, all 14–26% |
| Calibration, 65 v seven 50s | 45–60% |
| Real-field house margin / every stable dog | −12 to −15% / ≤ +2% |
| Expression's variance share | below fitness, above form |
| Lead changes per race | ≥ 1.0 |
| `npm test` green, snapshot moved in named commits only | ✅ |

Carry-overs that must not regress: races entered 1.8–2.4, races/dog 5–7, mean end worth 25–40k, the
five market rows. Report `autoplan%`, p90/p10, Hard v Normal, under-60 at declaration and
`hub-clicks` whatever they say, and tune toward none of them.

## Then, in order

1. Full re-baseline: `npm test`, `npm run lint`, `npm run build`, the three headless checks, 800
   all-Normal seasons, `--calibrate`, `--stats`, `--autoplan`, `--styles`, 3 Hard v 3 Normal.
2. Serve the build and screenshot a hot-pace race mid-way and a photo finish.
3. `npm run snapshot`; `git tag v3c2` on the notes commit.
4. `claude/V3_PHASE_C2_NOTES.md` in the style of the Phase C notes, ending with a **short** `v3c2`
   checklist — four or five questions, written to be asked as multiple choice (that is how Jesse
   answered the last one): did the finishes feel closer, did a hot pace ever happen in front of you
   and did the closer get there, did it change where you entered your closer, anything that now feels
   worse.
5. Decision rows **C12, C13, …** in `design/GDD_V3.md` (the hot pace and its floor, the finish dials,
   any refit); update §5.3's and §14 Q10–Q11's `v3c` notes; add a short **Phase C2** section to
   `design/BUILD_PLAN_V3.md` before Phase D, and the `v3c2` tag to `design/CANON.md`.
6. Commit this prompt as `claude/V3_PHASE_C2_PROMPT.md`, corrected before commit where it was wrong.
7. `git ls-remote origin`, bundle, round-trip test, write it into Jesse's repo folder, spell out the
   PowerShell. Say that the claude.ai Project mirrors need re-syncing.
