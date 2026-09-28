# V3 Phase G: balance — a stake cap a rich stable hits

> **Corrected before commit** (CANON: a prompt is written before its phase and corrected before it
> lands). Two things in the draft were wrong, and both are fixed inline below:
>
> 1. **Neon Snout's special is `{ bettingMargin: 0.1 }` only.** The 100%-of-cash stake fraction
>    belongs to **Collar Prime**, the Grand Final. Jesse was asked where the ×2 should go and said
>    **Neon Snout only**.
> 2. **The goldens do not move.** Both are six Normal stables, and Normal never stakes over 500, so a
>    1,000 ceiling is never reached in either. Nothing in this phase may move them.

Phase F is done (`v3f2`, pushed): every file in the art contract is finished. **Phase G is the first
balance phase since the art, and it comes from Jesse's own game.**

## What Jesse's game showed

Jesse played a **two-season game**: one human (Zingis, red) against five AIs. Sly Pete Manx (white) and
Baroness Vex (blue) were **Hard**, and the other three were **Normal**. The game-end screen read:

| Stable | Final worth | Races won | Gold Cups | Prize money | Trainers' cut | Trading | Betting | Food & bills |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Sly Pete Manx (AI, Hard)** | **285,151** | 6 | 3 | 55,875 | −6,705 | +11,481 | **+197,908** | −5,095 |
| Zingis (human) | 94,054 | **13** | **5** | **87,196** | −11,134 | −11,451 | +12,512 | −26,391 |
| Old Man Torvald (AI) | 63,596 | 10 | 0 | 46,779 | −5,615 | +2,013 | −2,529 | −10,715 |
| Fizz Molloy (AI) | 48,485 | 3 | 0 | 34,013 | −6,803 | +8,256 | −2,758 | −9,253 |
| Captain Blort (AI) | 47,212 | 5 | 1 | 37,650 | −4,551 | +6,148 | −608 | −10,105 |
| Baroness Vex (AI, Hard) | 42,109 | 4 | 1 | 33,675 | −3,213 | +6,098 | **−19,721** | −6,628 |

- Season 1: Sly Pete 63,062, Captain Blort second on 37,920. Season 2: Sly Pete 285,151, Zingis second
  on 94,054. The lead last changed in season 2, week 7.
- **Best bet: 109,719 Bones on Genuine Eclipse.** Sly Pete staked 15,563 at 8.05 to win, in the Gold
  Cup, season 2, week 10.
- **The best racing stable** (most races won, most Gold Cups, most prize money) **finished a third of
  the way to a stable that won the game on betting.** The other Hard stable lost almost 20,000 betting.
  The spread between the two is the problem: betting decided the game, and it was a coin toss.

**Why the current cap did not stop it.** GDD_V3 §7.4 caps a stake at **50% of cash** (100% at Collar
Prime — *corrected: the draft said Neon Snout*). Hard stakes a *share of its cash*
(`balance.aiBetFraction` 3%, up to ×4 or ×6 for an edge bet, `ai/hard.ts`), so its bets grow with its
bank, and a share-of-cash ceiling grows with them. Sly Pete's 15,563 was far below half his cash.
`state.ts`'s own comment on `maxStakeFor` says so: "a fractional ceiling cannot bind a rich stable,
because it *is* a fraction of a bigger number." v3 deleted v2's flat ceiling (BUILD_PLAN_V3 §2.1) on
the grounds that with no borrowing, bets are "affordable by construction". That is true, but a rich
stable can still compound its winnings.

## Jesse's calls

- **Betting is broken. Fix it with a smaller stake cap**, in the form of **one flat number**: a ceiling on
  what a stable may stake on one race (all its bets on that race together, as the cap is checked now),
  the same for every race, set in the spreadsheet. **A stable's stake on a race is capped at the lesser
  of 50% of cash and the flat ceiling.** Keep the 50%: it still protects a poor stable.
- **Neon Snout doubles the ceiling.** The casino moon stays the place for a big bet, not an unlimited
  one. It keeps its 10% margin, and its ceiling is **2×** the flat number. *(Corrected: the draft said
  it also kept "its 100%-of-cash fraction"; that fraction is Collar Prime's, and Collar Prime keeps it
  under the ordinary ceiling.)*
- **Only the cap.** Jesse was offered odds caps and a change to Hard's betting, and chose neither. Do not
  change the odds, the margin, `aiBetFraction` or Hard's betting logic. The AI is capped by the same rule
  as a human, through `maxStakeFor`, as it is now.
- **Feeding stays as it is.** Jesse fed his dogs well on purpose, and it is why they won: "worth it".
  Food & bills of −26,391 and trading of −11,451 were his choice, not a bug to fix. (See item 4: check the
  ledger adds them up once.)
- **The event cards were "great".** That answers the `v3f2` checklist's first three rows. Record it.
- **Nothing else felt off** across the two seasons: purses, game length and the off-season are fine.
- **The number itself: measure it, then ask Jesse.** Run the sweep below, recommend a number, and ask
  him **one** question with the table in front of him. Build with his answer.

## ⚠️ First: the mechanics. They are F2's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **47 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
  3. **Then run `npm run snapshot`, before any change.** F2 missed this and took it at the end.
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
     giving him the two push commands. (A stop hook will say there are unpushed commits. That is
     expected: say so and do not push.)
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. Build and test in the
     container.
- **Keep scratch out of the repo.** Put probes, sweeps and screenshots in `shots/`, and add that to
  `.git/info/exclude`. Stage paths, not `-A`.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

**`v3f2` is the tag to fall back to** (`256b4db`, pushed). **The golden digests at `v3f2`:**

- one season: **`8dc05e06…`**
- two seasons: **`dc357422…`**

~~⚠️ **This phase moves both goldens, on purpose.**~~ *Corrected:* **neither golden moves.** Both are six
Normal stables, and Normal's stake is at most 500, under any ceiling in the sweep. The rule's commit says
so. If a golden *does* move, something other than the cap changed: stop and find it.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: **§7.4 Betting**, §11 balance targets, §12 (the planets), §13 the decision log
   (V18 and the v2 decisions it cites on the flat ceiling), §14 open questions.
3. `design/BUILD_PLAN_V3.md`: §2.1 (why the flat ceiling went) and Phases E and F (the acceptance-table
   style).
4. **`claude/V3_PHASE_F2_NOTES.md`**, the last session, and the harness notes in `V3_PHASE_E1_NOTES.md` /
   `V3_PHASE_E2_NOTES.md` (`--game`, "Hard 49.9%").
5. The code the rule lives in:
   - `packages/engine/src/state.ts`: `maxStakeFraction`, `maxStakeFor` and the comment above it
   - `packages/engine/src/phases/planet.ts`: where a `PlaceBet` is checked against the cap (it sums the
     stable's bets already on that race). Its comment also says the flat ceiling is gone: rewrite it too.
   - `packages/engine/src/ai/hard.ts` (≈ lines 250–340) and `ai/shared.ts`: how the AIs size a stake.
     Hard clamps through `maxStakeFor`, so the cap reaches it for free; Normal caps itself at 500.
   - `packages/engine/src/content/planets.ts`: Neon Snout's `special` (`bettingMargin: 0.1`) and Collar
     Prime's (`bettingMargin: 0.1, maxStakeFraction: 1`) *(corrected)*
   - `packages/web/src/screens/Bookie.tsx` and `lib/planetText.ts`: what a player is told about the cap
   - `packages/engine/scripts/add-phase-e2-rows.ts` and `balance-from-xlsx.ts`: how a number gets into
     `design/space_dog_racing_economy.xlsx` and then `balance.json` (**never hand-edit `balance.json`**)
   - `packages/web/src/store/persist.ts`: `SAVE_VERSION` and its history
   - `packages/web/src/screens/SeasonEnd.tsx`, `IncomeSplit`: the ledger Jesse read

## BUILD THIS SESSION

### 1. Measure first: the sweep (scratch, before any commit)

Before changing the rule for real, try ceilings in a scratch branch and measure. Start with **no
ceiling (today), 1,000, 1,500, 2,000, 3,000 and 5,000**. For scale: start cash is 6,000; the Gold Cup
pays 6,000 / 3,000 / 1,500; Bronze pays 1,500 / 750 / 375. Run the harness against a table like
Jesse's, **two Hard and four Normal** (`--ai hard,hard,normal,normal,normal,normal`), and against six
Normal. Use `--seasons` for one-season numbers and `--game` for the one-, three- and five-season games.

For each ceiling, report:

- **betting's share of the winner's income**, and the share of games **won by a stable whose betting
  total is bigger than its prize money**
- the **spread of Hard's betting total** (p10 / median / p90). Jesse's game had +197,908 and −19,721
  from the same AI.
- **how often the stable with the most prize money wins** the game
- **Hard's win rate** against Normal (49.9% was the last measure), and the mean end worth, all-Normal,
  one season (§11: 25–40k)
- **how often the ceiling binds** at all, for humans' stake choices as well as AIs'. A ceiling that never
  binds for a sensible bet on a stable's own dog is the aim.
- the 1st-to-last gap at a season's end (§11: narrower than v2's)

**Then stop and ask Jesse one question:** the table, a recommended number, one line on why, and the
other candidates as options. Build with his answer.

### 2. The rule

- `maxStakeFor(s, p)` = **the lesser of** `floor(cash × maxStakeFraction)` and **`maxStake`** (the flat
  ceiling), where Neon Snout's ceiling is `maxStake × 2`. Put the ×2 in Neon Snout's `special` row as
  data (for example `maxStakeMultiplier: 2`), not as a branch for the planet (CLAUDE.md: content is
  data).
- **The number lives in the spreadsheet.** Write `packages/engine/scripts/add-phase-g-rows.ts` as a copy
  of E2's upserter, add the row under the betting section, add its label to `balance-from-xlsx.ts`'s
  `LABELS`, run it and then `npm run balance`. The Neon Snout multiplier is a planet row in
  `planets.ts`, as its other specials are.
- **Rewrite the comment on `maxStakeFor`.** It says a flat ceiling is gone and why. It now needs to say
  why one is back: Jesse's two-season game, the compounding of a share-of-cash stake, and that the
  ceiling is not about debt.
- **The AIs need no change.** They already clamp to `maxStakeFor`. Check that a clamped Hard bet is still
  placed at the ceiling (not skipped), and that the `stake < 50` skip still behaves.

### 3. What the player is told

- **The Bookie** says the cap where it says it today: the lesser of the two, in Bones, for this stable on
  this planet ("Max stake 2,000 Bones": whichever binds). A player with little cash still sees the 50%.
- **Neon Snout's local rules** (`planetText.ts`) say the doubled ceiling.
- If the stake input or its presets can offer more than the cap, clamp them.

### 4. A ledger check (read only, unless it is a bug)

Jesse's own row was trading **−11,451** and food & bills **−26,391**. He fed his dogs well on purpose. Check
that **food bought and then eaten is counted once**: either as goods bought under trading or as food
under food & bills, not both. Build a small probe: one stable, buy N crates of a food, feed them, and
read the split. If it double-counts, fix `IncomeSplit`'s arithmetic or its footnote (UI, in scope) and
say so in the notes. If it does not, write one line in the notes saying why the two columns are both
negative for a stable that feeds well. **Do not change what feeding costs or does.**

### 5. Saves

A saved log may hold a bet over the new ceiling, which the new rule rejects, so the log no longer
replays. **Bump `SAVE_VERSION` to 12** with a history paragraph in `persist.ts`'s comment block, as every
bump before it has. A `v3f2` save then goes to the title screen softly, not to an error. Verify it by
writing a `v3f2`-shaped blob and reading it back: null.

## RULES THAT DO NOT BEND

- **One rule changes: the stake cap.** Nothing else in the engine moves: no odds, no margin, no
  `aiBetFraction`, no purses, no feeding.
- **Numbers come from the spreadsheet.** `balance.json` is generated. Never hand-edit it.
- **The goldens do not move** *(corrected)*. `npm test` stays 47 green.
- **No `Math.pow` / `exp` / `log` / trig in the engine.** A `Math.min` of two integers is safe.
- **Same seed + same log reproduces a game on Node 20, 22 and 24.** CI checks it on Jesse's push.
- **Format only what you edit.**

## The commit discipline, in this order

1. `add-phase-g-rows.ts`, the spreadsheet row and the regenerated `balance.json`.
2. **The rule:** `maxStakeFor` and Neon Snout's row. The message says the goldens did not move and why
   *(corrected)*.
3. The Bookie and `planetText` copy, and any clamp in the stake input.
4. `SAVE_VERSION` 12.
5. The ledger fix, only if item 4 found a double count.
6. Notes, prompt and design docs (below). Tag **`v3g`** on it.

## DONE WHEN

| Measure | Target |
|---|---|
| A stable's stake on a race is the lesser of 50% of cash and the flat ceiling; Neon Snout's ceiling is 2× | ✅, in `maxStakeFor`, from the spreadsheet and a planet row |
| The ceiling number | the one Jesse picked from the sweep |
| Betting's share of the winner's income, 2 Hard + 4 Normal, two-season games | well under today's. Report before → after; the sweep sets the bar |
| The stable with the most prize money wins | more often than today. Report before → after |
| Hard's betting total, p10 / p90 | a much narrower spread than today |
| Mean end worth, all-Normal, one season | still 25–40k (§11) |
| Hard vs Normal | reported (was 49.9%), not tuned |
| The Bookie says the cap a player actually has; Neon Snout says its doubled ceiling | ✅, screenshots at 1280 and 390 |
| Food bought and fed is counted once on the game-end ledger | ✅, probed, and fixed or explained |
| A `v3f2` save goes softly to the title screen | ✅, `SAVE_VERSION` 12, verified |
| Goldens unmoved *(corrected)*; `npm test` 47 green; lint clean; `season-check`; `npm run build`; `asset-check` 288 / 0 / 0 | ✅ |

## Then, in order

1. **Re-baseline:** `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks` (9.4, and
   10.7 / 22.4 passes at the table; expected unchanged), `race-view-check`, `npm run harness -- --seasons
   50` (paste the summary into the notes, per CLAUDE.md), `--game`, and `asset-check`.
2. `npm run snapshot`, then `git tag v3g` on the notes commit.
3. **Write `claude/V3_PHASE_G_NOTES.md`** in the style of the F notes: Jesse's game and its table, the
   sweep and his pick, the rule, what changed on screen, the ledger check, the save bump, the golden
   digests, the harness before → after, and open questions. Record the answers Jesse has already given:
   - the `v3f2` checklist: the cards are "great" (rows 1–3); nothing else looked unfinished (row 4); next
     was a balance phase (row 5)
   - the two-season game was **one human against five AIs**. It is not Phase E's four-human playtest, so
     the four 🎲 rows are still open.

   End with a **short** multiple-choice `v3g` checklist for Jesse:
   - does a big bet still feel worth making
   - does the best racing stable now win
   - is the cap clear on the Bookie
   - is Neon Snout still the place for a big bet
   - what next: the four-human playtest, the human face picker, or another balance pass
4. **Update the design docs:**
   - `design/GDD_V3.md` **§7.4**: the new cap, and a decision-log entry in §13 (the next V number) with
     Jesse's game as the evidence and why the flat ceiling is back after §2.1 removed it. §12: Neon
     Snout's doubled ceiling.
   - `design/BUILD_PLAN_V3.md`: a **Phase G** section in Phase F's style, with its status and acceptance
     table.
   - `design/CANON.md`: the `v3g` tag.
5. Commit this prompt as `claude/V3_PHASE_G_PROMPT.md`, corrected before commit where it was wrong.
6. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3g`. Sync the changed `design/*.md` and the new `claude/`
   notes and prompt to the claude.ai Project with `project_write`, and update each status header's
   `last synced`.
