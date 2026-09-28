# V3 Phase H: balance pass 2 — the season's money, and how hard Hard is

> ⚠️ **Corrected before commit, per CANON's write-once rule.** The prompt below is as given, except
> for this box. It expected a rule change, but **Jesse chose to change nothing** (GDD_V3 V22). So the
> parts about building a pick did not happen: `add-phase-h-rows.ts`, a rule commit, moving the goldens,
> a screen change and `SAVE_VERSION` 13. Commits 2–5 of the discipline below do not exist. The goldens
> are still `8dc05e06…` and `dc357422…`, and `SAVE_VERSION` stays 12, because a `v3g` log replays into
> the same game. One more correction: the "Now" figure of **42,170** is Phase G's sweep sample. The
> committed harness at `v3g` reads **42,334** over 400 seasons (seeds 1–400) and 42,495 over 50.
> See `claude/V3_PHASE_H_NOTES.md`.

Phase G is done (`v3g`, pushed): a stable's stake on a race is the lesser of 50% of its cash and 1,000
Bones, and Neon Snout doubles the 1,000. Betting no longer decides games. **Phase H is the second balance
phase. It goes after the two §11 rows that have been ❌ since `v3e1`, and after one side effect that G
reported.**

## What is wrong, as measured

| Measure | Target (GDD_V3 §11) | Now (`v3g`) | Since |
|---|---|---|---|
| Mean end worth, all-Normal, one season | 25–40k | **42,170** ❌ | `v3e1` (42,151) |
| Stables ending a season on less than they started | 10–25% | **0.8%** ❌ | `v3e1` |
| Hard vs Normal (share of pairings Hard finishes above) | reported, not tuned | **62.1%** (2 Hard + 4 Normal, two seasons); 54.0% (3 v 3, one season) | `v3g`: the cap cut Hard's losing runs |
| Stables mathematically out at week 8 of the *last* season | — | 48.8% in 5-season games | `v3e2` (E9) |

- **The two ❌ rows are one problem.** GDD_V3 V10 left food as the only running cost, so almost every
  stable grows every season. Going backwards is §11's only failure state, and the game has almost none
  of it. The E1 notes said so at the time.
- **Hard is not obviously a problem.** The M4 target, still printed by the harness, was "hard > normal
  ~65%". Jesse chose to leave Hard alone at 49.9%, and Phase G moved it to about 62% without touching
  its logic. **Do not tune Hard unless Jesse asks.** Measure it and put it in front of him.
- **Jesse's standing calls (from Phase G): purses, game length and the off-season are fine; feeding is
  "worth it" and stays as it is; betting is fixed.** Do not reach for purses, the calendar, feeding's
  effects or the stake cap to solve this. If the numbers say one of them is the only lever that works,
  say so and ask. Do not build it.

## ⚠️ First: the mechanics. They are G's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **47 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
  3. **Then run `npm run snapshot`, before any change.**
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed. Check for a `gpgsig` header with `git cat-file -p HEAD | head -6`, and keep every commit signed.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder.
     Give this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.* Delete
     nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build the
     bundle to fast-forward from whatever his `main` actually is. If his tree is dirty or his `main` is
     not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** `git bundle create` in the container (write it under `/mnt/user-data/outputs/`), then
     `device_commit_files` it into his folder. Then in `device_bash`: `git fetch <bundle>
     main:refs/heads/work` plus the tag, `git merge --ff-only work`, `git branch -d work`, and
     `rm <bundle>`. Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Pushing deploys to Cloudflare Pages, and that is Jesse's call. End by giving
     him the two push commands. A stop hook will say there are unpushed commits. That is expected: say
     so and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds.
- **Keep scratch out of the repo.** Put probes, sweeps and screenshots in `shots/`, and add that to
  `.git/info/exclude`. Stage paths, not `-A`.
- **The container has 2 cores.** A two-season game of six AIs takes about 0.3 s. A full sweep of 6
  settings × 8 tables took about 40 minutes in Phase G. Run long sweeps with `nohup … &` and poll,
  because a tool call times out at 10 minutes.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

**`v3g` is the tag to fall back to.** **The golden digests at `v3g`** are unchanged since `v3f2`:

- one season: **`8dc05e06…`**
- two seasons: **`dc357422…`**

⚠️ **This phase almost certainly moves both goldens, on purpose.** Both goldens are six Normal stables,
and anything that changes a Normal stable's cash changes every later draw. Move them **in one commit**,
the one that changes the rule or the number, and say so in its message (CLAUDE.md). No other commit may
move them.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: §6 (food, the only running cost), §8 (trainers and their commission), §9 (the
   deck: every card that charges or pays Bones), **§11** (the targets and the `v3e1` measurements under
   the table), §13 V10 and V21, §14.
3. `design/BUILD_PLAN_V3.md`: Phases E and G (the acceptance-table style).
4. **`claude/V3_PHASE_G_NOTES.md`**, the last session: the sweep method, the ledger probe (food is
   counted once, and the markup on food eaten stays in Trading) and its open questions. Then
   `V3_PHASE_E1_NOTES.md` for where the two ❌ rows were first measured.
5. The code:
   - `packages/engine/scripts/harness.ts` and `harness-game.ts`: what they measure, and how (`--ai`,
     `--seasons`, `--game`, the "poorer" and "gap" columns)
   - `packages/engine/src/phases/endTurn.ts` (the week's costs, `eaten()`), `economy/food.ts`,
     `economy/staff.ts` (commission), `economy/netWorth.ts` (what worth counts, including dog value)
   - `packages/engine/src/content/balance.json`, which is generated from
     `design/space_dog_racing_economy.xlsx`: the rows that set income and costs
   - `packages/engine/scripts/add-phase-g-rows.ts`: the upserter to copy

## BUILD THIS SESSION

### 1. A committed sweep knob (a tool, not a rule)

Phase G swept with a scratch script that wrote `balance.<key>` at runtime. Make that a committed harness
option instead, so the next sweep does not need scratch code: **`--set key=value`** (repeatable) on
`harness.ts` and `--game`. It overrides a numeric `balance` key for that run only, refuses a key that
does not exist, and prints the override in the header. It is tooling. It changes no rule and moves no
golden, so it gets its own commit.

### 2. Measure first: where does a Normal stable's money come from, and what could take some back?

Before proposing anything, write down, for six Normal stables over one season (`--seasons 400`):

- the income split (prize / trade / betting / costs) and **worth at weeks 1, 5 and 10**, including how
  much of end worth is **dog value** and how much is cash. If dog value is carrying worth up, the fix
  may be in `netWorth`'s dog valuation, which is a rule and a number, not a new cost.
- what a stable spends each week and on what, and **what share of stables have one losing week, two, or
  a losing season**.

Then sweep **two or three candidate levers, one at a time**, with `--set`, each over three to five
values. Examples, not a menu (read the sheet and pick the ones the numbers point at):

- dog book value (the valuation curve or age factors), if dog value is what carries worth over 40k
- trainers' commission range (V11: self-balancing, so it bites the winners)
- the cost side of the deck's bills, if there is a sheet row for them
- the food bands' level (price, **not** what feeding does — Jesse's call)

For each value, report against §11 at one season (all-Normal): **mean end worth** (25–40k), **poorer
than they started** (10–25%), the **1st-to-last gap** (narrower than v2's), **food sold as a share of
gross income** (20–35%), **races entered a weekend** (1.8–2.4), and **Hard vs Normal** (2 Hard + 4
Normal, reported). Also report two-season and five-season games (`--game`), because a lever that fixes
season 1 can still leave season 5's out-at-week-8 at 48.8%.

**Then stop and ask Jesse one question**: the table, a recommended lever and value, one line on why,
and the other candidates as options. Hard's number goes in the same message as a fact, not a question,
unless it has moved a long way. Build with his answer.

### 3. Build his pick

- **Numbers live in the spreadsheet.** Write `packages/engine/scripts/add-phase-h-rows.ts` as a copy of
  G's upserter, run it and `npm run balance`. **Never hand-edit `balance.json`.** If his pick needs a new
  row, add its label to `balance-from-xlsx.ts`'s `LABELS`.
- If it needs code (a new cost, a new valuation term), the rule goes in the engine with its reason in a
  comment, and content stays data (CLAUDE.md).
- **The goldens move in that one commit**, and the message says so and why.

### 4. What the player is told

If the change is something a player feels (a cost, a price, a dog's value), make sure the screen that
shows it says it: the season-end ledger (`IncomeSplit`), the Kennel's dog value, or the Market. If the
change needs no screen, say that in the notes.

### 5. Saves

If the change makes an old log replay into a different game (almost any economy change does), **bump
`SAVE_VERSION` to 13** with a history paragraph in `persist.ts`, and verify it: a v12 blob reads back
null. If it genuinely does not (a UI-only change), say why in the notes and leave it at 12.

## RULES THAT DO NOT BEND

- **Only what Jesse picks changes.** No purses, no calendar, no stake cap, no change to what feeding
  does, no change to Hard's logic, no change to the race model or the odds.
- **Numbers come from the spreadsheet.** `balance.json` is generated.
- **The goldens move once**, in the rule's commit. `npm test` stays 47 green, with the snapshots updated
  in that commit.
- **No `Math.pow` / `exp` / `log` / trig in the engine.** Use `determinism.ts`.
- **Same seed + same log reproduces a game on Node 20, 22 and 24.** CI checks it on Jesse's push.
- **Format only what you edit.**

## The commit discipline, in this order

1. The `--set` harness knob (tooling; no golden moves).
2. `add-phase-h-rows.ts`, the spreadsheet row(s) and the regenerated `balance.json`. If this is what
   changes the game, it is also the commit that moves the goldens. Otherwise, 3 is.
3. **The rule**, if any code changes, with the golden snapshots. The message says the goldens moved and
   why.
4. What the player is told, if anything.
5. `SAVE_VERSION` 13.
6. Notes, prompt and design docs. Tag **`v3h`** on it.

## DONE WHEN

| Measure | Target |
|---|---|
| Mean end worth, all-Normal, one season | **25–40k** (§11), or as close as Jesse's pick gets, with the gap explained |
| Stables ending a season poorer than they started | **10–25%** (§11), or reported with the lever that would reach it |
| 1st-to-last gap at a season's end | still narrower than v2's (63,530) |
| Food sold as a share of gross income; races entered a weekend | still in band (20–35%; 1.8–2.4) |
| Hard vs Normal | reported before → after, not tuned |
| Out at week 8 of the last season, 5-season games | reported before → after (was 48.8%) |
| `--set` works on `--seasons` and `--game`, refuses an unknown key | ✅ |
| The change comes from the sheet (and code only if it must) | ✅ |
| A `v3g` save goes softly to the title screen | ✅, `SAVE_VERSION` 13, verified (or explained why not) |
| Goldens moved once, in the rule's commit; `npm test` 47 green; lint clean; `season-check`; `npm run build`; `asset-check` 288 / 0 / 0 | ✅ |

## Then, in order

1. **Re-baseline:** `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks` (9.4; 10.7
   / 22.4 passes at the table; expected unchanged), `race-view-check`, `npm run harness -- --seasons 50`
   (paste the summary into the notes, per CLAUDE.md), `--game`, and `asset-check`.
2. `npm run snapshot`, then `git tag v3h` on the notes commit.
3. **Write `claude/V3_PHASE_H_NOTES.md`** in the style of the G notes: the two ❌ rows and where they
   came from, the measurement of where the money goes, the sweep and Jesse's pick, the rule, what the
   player sees, the save bump, the new golden digests, the harness before → after, and open questions.
   End with a **short** multiple-choice `v3h` checklist for Jesse:
   - did a season feel tighter, and did anyone go backwards
   - does a stable that races well still pull ahead
   - does the Hard AI feel too strong, about right, or too soft
   - is the `v3g` cap still right (a big bet still worth making, Neon Snout still the place for one)
   - what next: the four-human playtest, the human face picker, or the long game (out at week 8)
4. **Update the design docs:** `design/GDD_V3.md` §11 (the new measurements under the table), the
   section the change lives in, and a decision-log entry in §13 (the next V number: **V22**);
   `design/BUILD_PLAN_V3.md`, a **Phase H** section in Phase G's style; `design/CANON.md`, the `v3h` tag.
5. Commit this prompt as `claude/V3_PHASE_H_PROMPT.md`, corrected before commit where it was wrong.
6. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3h`. Sync the changed `design/*.md` and the new `claude/`
   notes and prompt to the claude.ai Project with `project_write`, and update each status header's
   `last synced`.

## Still open, and not this phase's

- Phase E's four 🎲 rows (the four-human playtest), the F1 checklist, and the `v3g` checklist.
- A human choosing their own face.
- §7.5's split view.
- The goldens cannot see betting (both are six Normal). A Hard seat in a golden would guard it, but it
  moves the goldens for a reason other than a rule change, so it needs Jesse's say-so.
