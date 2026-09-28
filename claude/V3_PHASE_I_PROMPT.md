# V3 Phase I: a human picks their face, then the long game

> ⚠️ **Corrected before commit, per CANON's write-once rule.** The prompt below is as given, except
> for this box. Four things it said turned out differently:
> 1. **"Part 2 moves them only if Jesse picks a rule change"**, meaning the goldens. Jesse picked
>    the draft (GDD_V3 V23), so the **two-season golden** moved: `dc357422…` → `d4bb14c3…`. The
>    **one-season golden moved too, but only its `stateHash`**: `8dc05e06…` → `41a8c8b5…`. An
>    off-season notice can now carry `draft`, so `STATE_VERSION` went 12 → 13, and the hash covers
>    `state.version`. Every other field of the one-season digest is unchanged. Both moved in one
>    commit, the rule's (`484f308`).
> 2. **"An AI's face is keyed by its name, not its colour"**: this is true for every name on
>    `AI_STABLE_NAMES`, which covers any AI row left blank on the Title. **An AI row the table has
>    renamed** falls back to `colour % 12` (`ownerIndexFor`), so a human's pick that moves that AI's
>    colour also changes its face. It is decided once, at Start, and never changes during the game.
>    The notes list it as an open question.
> 3. **"`npm test` stays 47 green"**: it is **51**, because four tests were added. `colour.test.ts`
>    (2) proves colour touches no draw, and `draft.test.ts` (2) guards the draft.
> 4. **`table-walk` is not a script you run on its own.** It is a module, and its table (10.7 / 22.4
>    passes) prints from `hub-clicks`. It is unchanged.
>
> Part 1's "no `SAVE_VERSION` bump" held for the face picker. `SAVE_VERSION` went to **13** for the
> draft, in commit 6. See `claude/V3_PHASE_I_NOTES.md`.

Phase H is done (`v3h`, pushed). It added `--set key=value` to the harness and changed no rule. Jesse
kept food as the only running cost at one crate a dog. His reason: a table growing richer together is
fine, "as it is the same for everyone" (GDD_V3 V22).

**Phase I has two parts, in this order:**

1. **The face picker.** A human chooses their own face on the Title screen. It is UI only, and it
   has been open since F1.
2. **The long game.** In a five-season game, **48.8%** of stables are mathematically out by week 8
   of the last season. Measure why, sweep what could change it, and ask Jesse one question before
   building anything.

Part 1 is a quick win and moves no golden. Part 2 is a balance phase in H's style, and "change
nothing" is a legitimate answer to it.

## ⚠️ First: the mechanics. They are H's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **47 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
  3. **Then run `npm run snapshot`, before any change.**
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** use `git tag -s v3i -m "…"`, like `v3g` and `v3h`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder.
     Give this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.* Delete
     nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build the
     bundle to fast-forward from whatever his `main` actually is: `git bundle create <out> <his
     main>..main v3i`. If his tree is dirty or his `main` is not what you expect, stop and ask. Do not
     reset anything.
  3. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then run this in `device_bash`:

     ```
     git fetch ./v3i.bundle main:refs/heads/work refs/tags/v3i:refs/tags/v3i
     git merge --ff-only work
     git branch -d work
     rm v3i.bundle
     ```

     Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Pushing deploys to Cloudflare Pages, and that is Jesse's call. End by giving
     him the two push commands. A stop hook will say there are unpushed commits. That is expected: say
     so and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds.
- **Keep scratch out of the repo.** Put probes, sweeps and screenshots in `shots/`, and add that to
  `.git/info/exclude`. Stage paths, not `-A`.
- **The container has 2 cores.** One `npm run harness -- --game` (200 games a mode) takes about 2.5
  minutes. Phase H's four-table sweep took about 2.7 minutes a setting on each of two workers. Run long
  sweeps with `nohup … &` and poll, because a tool call times out at 10 minutes.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

**`v3h` is the tag to fall back to.** The golden digests are unchanged since `v3f2`:

- one season: **`8dc05e06…`**
- two seasons: **`dc357422…`**

Both are six Normal stables with no humans, so **Part 1 cannot move them**. Part 2 moves them only if
Jesse picks a rule change, and then **in one commit**: the one that changes the rule or the number,
with a message that says so (CLAUDE.md).

## Jesse's standing calls: do not reach for these

- **Food is the only running cost, at one crate a dog a week.** No kennel rent, upkeep or fee of any
  kind: "charging every kennel 300 a week is kind of pointless, if anything it punishes the poorer
  players the most" (V22).
- **A table growing richer together is fine.** §11's end-worth and poorer rows are reported, not tuned.
- **Keep it simple.** He has chosen the simple option every time it was offered. Weigh that when you
  recommend.
- **Unchanged since Phase G:** purses, the calendar, game length, the off-season, what feeding does,
  the `v3g` stake cap (1,000, ×2 on Neon Snout), Hard's logic, the race model and the odds.

If the numbers say one of these is the only lever that works, say so and ask. Do not build it.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`:
   - §1 pillar 5: "nobody is out before the end", and "must still be able to do something
     interesting on week 9"
   - §2.1–2.2 (game length, the off-season), §8 (trainers' commission, V11)
   - §10 (the F1 note on human faces), §11 (the targets and the `v3h` measurements)
   - §13: E7 (the definition of "out"), V10, V11, V22
3. `design/BUILD_PLAN_V3.md`: Phases E, F and H.
4. **`claude/V3_PHASE_H_NOTES.md`**, the last session: the money measurement, the sweep table and
   Jesse's answers. Then:
   - `V3_PHASE_E1_NOTES.md` (Read this first 6) and `V3_PHASE_E2_NOTES.md` (item 3): the long game
     first measured and then widened by the fresh season
   - `V3_PHASE_F1_NOTES.md` §3 and Open questions 1: the human faces and the picker question
5. The code:
   - **Part 1:**
     - `packages/web/src/lib/owners.ts` (`humanFaceFor`, keyed by `player.colour`)
     - `packages/web/src/screens/Title.tsx` (the roster; today a row's colour is its index)
     - `createSeason` in `packages/engine/src/state.ts` (`PlayerSetup.colour`, and the de-duplicating loop
       at about line 450)
     - `packages/web/src/store/persist.ts` (the setup lives in the save)
     - the `human-01`…`08` briefs in `packages/web/scripts/assets.ts`
   - **Part 2:**
     - `packages/engine/scripts/harness-game.ts` (`outAtWeek8`, the per-mode table, the richer and poorer
       halves, the season-1 leader)
     - `scripts/balance-set.ts` (`--set`)
     - `src/phases/arrival.ts` (turn order), `economy/staff.ts` and `content/staff.ts` (commission)

## PART 1 — BUILD: a human picks their face

**The design, and why:**
- F1 made the eight human faces wear their saddle-cloth colour (a red bandana, a blue scarf, …).
  `humanFaceFor` keys the face off `player.colour`, so face and swatch always agree.
- **So picking a face is picking a colour.** `PlayerSetup.colour` already exists, `createSeason`
  already honours it, and the setup is already in the save. That means:
  - no new field
  - no engine change
  - no `SAVE_VERSION` bump: an old save has no `colour` on its rows and keeps meaning what it meant
- **Verify, don't assume, that colour touches no draw.** `grep colour packages/engine/src` shows only
  `state.ts`. Prove it: play a four-human season at a fixed seed with the default colours, then again
  with the humans' colours permuted. The results must be identical apart from the colours.
- If it does touch a draw, or if this design runs into something the prompt did not see, stop and
  ask Jesse. Do not store the face somewhere new instead.

**Build it:**
- **On the Title roster, a human row shows its face**, the `OwnerFace` art for `human-NN`, in place of
  (or beside) the bare swatch. Pressing it opens a picker of the eight faces. Picking one sets that row's
  `colour`.
  - An AI row keeps its swatch and does not get a picker. AI faces are the twelve painted owners,
    keyed by name.
  - Do not offer the twelve owners to humans. They are the AI stables' identities, and a human
    wearing Baroness Vex's face at a table with Baroness Vex is a bug. If you think Jesse would want
    them anyway, put it in the notes as a question.
- **No two humans share a face.** A face another human holds is shown taken and cannot be picked.
- **The human's pick wins over an AI's seat colour.** Today `createSeason` walks the rows in order and
  bumps a clash to the next free colour. An AI row *earlier* in the list than a human would therefore
  keep the colour and push the human off their face. **The Title must pass an explicit colour for every
  row:** humans' picks first, then the AI rows fill the remaining colours in seat order.
  - Leave `createSeason`'s de-dup as it is. It is an engine rule, and it is what old saves and the
    harness rely on.
  - An AI's face is keyed by its name, not its colour, so reassigning AI colours changes no AI face.
    Check that.
- **Defaults are unchanged:** a table nobody touches gets colour = seat index, exactly as today, so a
  seed link means what it did.
- **A resumed game keeps the face** (it is `setup.colour`). Check it by reloading mid-season.
- Check the Title, the hub, the leaderboard chip, Results, the season end and the game end at **1280
  and 390**, with 1, 4 and 8 humans. Screenshots go in `shots/`.
- **Keyboard and screen reader:**
  - every face in the picker is a button with an accessible name, e.g. "Red — goggled pilot"
  - a taken face is `aria-disabled`, and says whose it is
- **`season-check`, `hub-clicks` and `table-walk` must be unchanged.** The picker lives on the Title,
  which the click budget does not count.

## PART 2 — MEASURE, THEN ASK: the long game

### What is measured (`v3h`, `npm run harness -- --game`, six Normal)

| Game | Out at week 8, any season | Out at week 8, **last** season | Gap, 1st to last | 1st / last |
|---|---:|---:|---:|---:|
| 1 season | 0.0% | 0.0% | 26,510 | 1.85× |
| 3 seasons | 6.0% | 15.8% | 45,851 | 1.96× |
| 5 seasons | 20.6% | **48.8%** | 67,668 | 2.01× |
| Target 150,000 | 6.9% | 25.2% | 53,346 | 1.95× |

In seasons 2–5, the richer half at a season's start gains **30,294** in it and the poorer half
**23,201**. The leader after season 1 wins a five-season game **35.5%** of the time (1 in 6 by
chance). Worth by season, five-season games: 42,186 → 65,625 → 91,356 → 119,161 → 147,689.

### 1. Is the measure the right one?

E7 defines "out" as follows: at the start of week 8, worth plus every first-place purse left *in that
season* is under the leader's worth. In the last season of a five-season game, three weeks of purses
are set against a lead built over four and a half seasons. So a large number here may be the
arithmetic of a long game, not a runaway.

Pillar 5 asks for something slightly different: a stable that has had a terrible season "must still
be able to do something interesting on week 9". Before sweeping anything, write down, for five-season
games:

- **E7's number** (48.8%), and the same test run at **the start of the last season**, with the whole
  season's first-place purses left.
- **Comebacks:**
  - the share of games where the stable last at the start of season 3, 4 or 5 finishes in the top 3
  - the share where the leader at the start of the last season is overtaken
- **Where the richer half's extra ~7k a season comes from:** prize, trading, betting or the trainers'
  cut. Also say whether it is better dogs (rating at declaration), more cash to trade with, or better
  trainers. That tells you which lever touches it.

If a comeback measure reads healthy while E7 reads 48.8%, say so plainly. The recommendation may then
be to **redefine the target**, not to change the game. That is a GDD change, and it is Jesse's call.

### 2. Sweep two or three levers

Sweep with `--set` where a sheet key exists. Where one does not, prototype in scratch as Phase H did:
add a temporary key to `balance.json` in the working tree and add the rule. **Revert both before any
commit.** Use three to five values each. These are candidates, not a menu:

- **The trainers' cut** (`staffCut…` keys and `staffCutMax`; V11 is self-balancing and bites the
  winners). It is the only lever that has moved this so far: ×3 took five-season out-at-week-8 from
  48.8% to 36.8% (H's sweep).
- **Turn order.** First look at the market is the advantage the brief names. Today the arrival score
  in `arrival.ts` is base − crates ÷ div + a die. What happens if the trailing stable gets a visible
  bonus? It must be something a player can read, per pillar 2: randomness that silently changes a
  number is out.
- **What the deck offers a trailing stable**, for example the Pound's offer quality or a door's odds.
  Only as a visible rule, same reason.

Constraints:
- Nothing that costs the poorer stables.
- Nothing on the standing-calls list above.

For each value, report:
- **the long game:** out at week 8 (any and last season) at 3 and 5 seasons and Target 150k, and
  the comeback measures above
- **§11 at one season, all-Normal:** mean end worth, poorer, the gap, food share, and races entered
- **Hard vs Normal** (2 Hard + 4 Normal, two seasons), reported

### 3. Then stop and ask Jesse one question

Send the table, a recommendation, one line on why, and the others as options. **"Change nothing,
redefine the target" and "change nothing at all" should both be options.** Build with his answer.

### 4. Build his pick (if there is one)

- Numbers live in the sheet. Copy `add-phase-g-rows.ts` to `add-phase-i-rows.ts`, run `npm run
  balance`, and never hand-edit `balance.json`. Add each new label to `LABELS` in
  `balance-from-xlsx.ts`.
- The rule goes in the engine, with its reason in a comment. Content stays data.
- **The goldens move in that one commit**, and its message says so and why.
- **What the player is told:** if a trailing stable gets something, the screen where it lands says why
  ("last at the table: first look at the market").
- **`SAVE_VERSION` 13** if an old log would replay into a different game, with a history paragraph in
  `persist.ts`. Verify that a v12 blob reads back null.
- If he picks "redefine the target", change §11 and E7's text, and `harness-game.ts` if the printout
  should lead with the new measure. That is tooling: no golden and no save bump.

## RULES THAT DO NOT BEND

- **Only what Jesse picks changes.** The standing calls above hold.
- **Numbers come from the spreadsheet.** `balance.json` is generated.
- **The goldens move at most once**, in the rule's commit. `npm test` stays 47 green, plus any tests you
  add.
- **No `Math.pow` / `exp` / `log` / trig in the engine.** Use `determinism.ts`.
- **Same seed + same log reproduces a game on Node 20, 22 and 24.** CI checks it on Jesse's push.
- **Format only what you edit.**

## The commit discipline, in this order

1. **The face picker** (UI only; no golden, no save bump).
2. Any new harness measures for the long game (tooling; no golden).
3. `add-phase-i-rows.ts`, the row(s) and `balance.json`, if Jesse picks a number.
4. **The rule**, if any, with the golden snapshots. The message says the goldens moved and why.
5. What the player is told, if anything.
6. `SAVE_VERSION` 13, if needed.
7. Notes, prompt and design docs. Tag **`v3i`** on it.

## DONE WHEN

| Measure | Target |
|---|---|
| A human picks one of eight faces on the Title, and the pick sets their colour | ✅, 1 / 4 / 8 humans, 1280 and 390 |
| No two humans share a face; a human's pick beats an AI's seat colour; defaults unchanged | ✅ |
| Colour touches no draw | ✅, proven by a permuted-colour season |
| A resumed game keeps the face; an old save loads | ✅ |
| The face picker is keyboard- and screen-reader-usable | ✅ |
| The long game measured: E7, the whole-last-season version, the comebacks, and where the richer half's gain comes from | ✅ |
| Two or three levers swept, and Jesse asked one question | ✅ |
| His pick built from the sheet, or the target redefined, or nothing | ✅ |
| Out at week 8 (last season, 5 seasons); Hard vs Normal; §11's one-season rows | reported before → after |
| Goldens at most once, in the rule's commit; `npm test` green; lint; `season-check`; build; `asset-check` 288 / 0 / 0 | ✅ |

## Then, in order

1. **Re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - `season-check`
   - `hub-clicks` (9.4 a weekend, and 10.7 / 22.4 passes at the table)
   - `race-view-check`
   - `npm run harness -- --seasons 50` (paste the summary into the notes, per CLAUDE.md)
   - `npm run harness -- --game`
   - `asset-check`
2. `npm run snapshot`, then `git tag -s v3i` on the notes commit.
3. **Write `claude/V3_PHASE_I_NOTES.md`** in the style of the H notes. Put a "Read this first" at the
   top, then cover:
   - the face picker, with screenshots named
   - the long-game measurement, the sweep and Jesse's pick
   - the rule, what the player sees and the save
   - the goldens, and the harness before → after
   - open questions

   End with a **short** multiple-choice `v3i` checklist:
   - does picking your face feel right, and would you rather have more faces
   - in a long game, did the trailing stable still have something to play for in the last season
   - Hard: too strong, about right, or too soft
   - what next: the four-human playtest, or something else
4. **Update the design docs:**
   - `design/GDD_V3.md`: the §10 note on faces; §11 and E7 if the measure changes; the section a rule
     lives in; a §13 entry (the next V number is **V23**) for any decision, including "change nothing"
   - `design/BUILD_PLAN_V3.md`: a **Phase I** section in Phase H's style
   - `design/CANON.md`: the `v3i` tag
5. Commit this prompt as `claude/V3_PHASE_I_PROMPT.md`, corrected before commit where it was wrong.
   Put the corrections in a box at the top, as H's prompt did.
6. **Land it** in Jesse's folder and give him `git push origin main` and `git push origin v3i`.
7. **Sync the Project:** push the changed `design/*.md` and the new `claude/` notes and prompt with
   `project_write`, and update each status header's `last synced`.

## Still open, and not this phase's

- Phase E's four 🎲 rows (the four-human playtest), and the F1, `v3g` and `v3h` checklists.
- §7.5's split view.
- The goldens cannot see betting or humans: both are six Normal. A Hard seat or a human seat in a
  golden would guard them, but it moves the goldens for a reason other than a rule, so it needs
  Jesse's say-so.
