# V3 Phase D2: the people

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase D2 was built from,
> committed alongside `V3_PHASE_D2_NOTES.md`. Where it turned out to be wrong it is corrected here,
> above the original, which is otherwise unchanged. Six corrections:
>
> 1. **"It is worth about 3.5 points of win rate on tight bends" — it is worth about 2.** That was
>    v2's figure (D37), kept in `race/draw.ts` and read by nothing, so nobody saw the v3 race model
>    move under it. Re-measured: +2.1 tight, +1.2 medium, +0.7 wide, nothing on a straight. The
>    screens print the engine's measured figure (D14).
> 2. **"+1 to one stat a week" was first built as +1 to every dog**, which made a 3% trainer worth
>    ~3,900 of end worth and took mean end worth out of its band. It is one stat on one dog a week,
>    the lowest-rated (D10). The cuts of three other bonuses were re-priced by the same measurement:
>    a regression of end worth on the dealt bonuses, a clean experiment because the deal is random.
> 3. **"season-check.ts must FAIL on a scripted season with zero sabotages" is checked across the
>    run.** At its own target (40–70% of seasons) a third of honest seasons have no sabotage, so a
>    per-season row fails by design; seed 7 did. Dog offers and staff offers fail per season.
> 4. **Gross prize money is the purse before the trainers' cut.** Not in the prompt: `roadSplit.ts`
>    said commission would land in costs, and the first build banked it net, which moved Phase B's
>    food-share row. Named because it moves that row by about two and a half points.
> 5. **Hard misses 63–68% (50.7%)**, as the prompt allowed for; each piece is reported (D15). The
>    measured lever is Hard's own betting, which is not a D2 piece.
> 6. **Commit order.** Items 1–10 are ten commits. Four more follow the re-baseline, each saying
>    whether the snapshot moved: the box re-measured (and `--autoplan` fixed for `ChooseBox`),
>    gross prize, the retune at 800 seasons, and the trainer offer's layout found in the screenshots.

Phase D is two sessions, and this is the second. **D1 built the deck** (`v3d1`): the Explore screen,
54 named doors, 86 cards, dog offers that can lie, next week's shelf in the Bar, race-day conditions
sold as tips, and the free local runner. **D2 is the people**:

- staff on commission
- sabotage and the bought trap draw
- Hard reading the field
- the click saving Jesse approved
- the rest of Phase D's acceptance table

When D2 is done, Phase D is done.

## ⚠️ First: the mechanics. They are the same as D1's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **31 green**
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
     giving him the two push commands.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. Build and test in the
     container.
- **Keep scratch probes out of the repo.** D1 committed two by accident and had to amend them out.
  Put probes outside the clone, or in `.git/info/exclude`, and stage paths, not `-A`.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then run `npm run snapshot`. **`v3d1` is the tag to fall back to.** GitHub's `main` is at `v3d1`
(`d84db64`), pushed. The golden `stateHash` is **`5b68cbd3…`**.

Jesse's calls for D2, asked before this prompt was written:

- **Drop the "plan the week" press (item 5).** Race/Rest is inert for a dog that is not declared,
  so the weekly press that `hub-clicks` counts as fixed changes nothing.
- **Sabotage is freely targetable**, as GDD_V3 §9.3 says. Playtest before making the leader the
  cheaper target (§14 Q1).

**Do not touch:**
- the race model (the hot pace, the run-in, the style curve)
- `oddsScale`
- Phase B's market numbers
- D1's tip sizing: buzzing +3 speed, a knock −30, off its feed −15, and their chances

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. In `design/GDD_V3.md`:
   - **§8 in full**: staff, the two slots, commission, the §8.2 bonus pool
   - **§9.3 in full**: sabotage, the trap draw, getting caught
   - §9.1, and decisions **D1–D8** (the draw point, offers, conditions and tips, the shelf, the local
     runner, the click count)
   - §5.6 and C12–C13 (the field Hard should read)
   - §14 Q1 and Q12
3. In `design/BUILD_PLAN_V3.md`: Phase D's deliverables and acceptance table, and the D1 status box.
4. `claude/V3_PHASE_D1_NOTES.md`, especially "Read this first" and "Carried forward". It lists D2's
   seams.
5. The code:
   - `phases/explore.ts`: the per-stable Explore stream and `lendRunners`
   - `content/eventKit.ts` and `content/deck/*.ts`: how a card is written
   - `content/conditions.ts`: race-day effects that land on the runner, not the dog
   - `phases/raceDay.ts`: `lockDeclarations`, the untouched trap-draw point, `runnerFrom`
   - `ai/explore.ts`, `ai/shared.ts`, `ai/hard.ts`
   - `scripts/harness.ts --explore`
   - `packages/web/scripts/hub-clicks.ts`, and the note at its bottom

## The baseline (`v3d1`, golden `5b68cbd3…`)

| Measure | Value |
|---|---|
| Mean end worth, all-Normal (800) | **39,710** (band 25–40k; about 200 of seed noise, so it is on the line) |
| Races entered / races per dog / p90:p10 | 2.14 / 6.52 / 1.96× |
| Phase B rows | food 30.7% · crossover week 4.5 · p99 leg 13.8% of worth |
| House margin / blind stable dog / buzzing dog | −12.6% / −1.3% / +20.1% a Bone |
| Betting, a stable-season | −995 |
| Doors chosen | Pound 19.2 · Bar 16.8 · Alley 22.5 · Strip 19.1 · Track 22.4% |
| Deck | 86 cards: Pound 19 · Bar 19 · Alley 17 · Strip 16 · Track 15 |
| Dog offers: all-Normal / a stable that wants one | 0.90 / 2.89 a season |
| `autoplan%` | 22.9% (entries 22.9, states 92.3) |
| Hard beats Normal (3 v 3) | **50.5%** (Hard's mean worth 45,535 v 40,161) |
| `hub-clicks` | **11.3** a weekend (Explore 1.75, Fly on −0.78). Limit 10.5, target 10 |
| Under 60 at declaration | 24.3% (band 10–25) |

## BUILD THIS SESSION

### 1. Staff on commission (GDD_V3 §8)

- **Slots and the deal:**
  - **Two slots, everyone a trainer.** No roles, no ladder, no market.
  - **Dealt at the start of a game**, two per stable, drawn at `createSeason`. That moves the deal's
    stream, so say so in the commit.
  - The only way to change staff in D2 is a Bar card (item 2). The off-season notice (§2.2) is
    Phase E's.
- **Commission:**
  - A cut of **race prize money only**, **1–10%** ⚖️, roughly in proportion to how good the bonuses
    are. Never betting, trading or anything else.
  - Taken where the purse is paid, and logged.
- **The bonus pool, §8.2.**
  - Each bonus is a **row** in a new `content/staff.ts`. Its cut and size are sheet cells.
  - A staff member is one or two bonuses and a cut. The engine reads the row, never the name.
  - The bonuses, and how each fits what is already built:

    | Bonus | How it fits the build |
    |---|---|
    | +1 to one stat a week, on top of food | at the jump, beside `feedOneWeek` |
    | +5 fitness recovery a week | in `weeklyFitnessDelta`'s bonus, which is already threaded |
    | Injury chance halved | in `rollInjury` |
    | Injury duration −1 week | at the roll, never below 1 |
    | Reveals one rival dog's style, once a week | ⚠️ **public, by decision C4** (see below) |
    | Shows next planet's band position for all six goods | sets `Player.intel`, as the freight clerk does |
    | +10% prize money | before commission |
    | Explore events less likely to go badly | ⚠️ needs a helper (see below) |

  - ⚠️ **The style reveal is public, by decision C4.** A style is known or it is not, and nobody knows
    one privately. The trainer "has a word around the kennels" and the table learns it. D1 made the
    same call for tips on styles.
  - ⚠️ **"Events less likely to go badly" needs a helper, not a branch.** D1's cards roll their risks
    inline (`ctx.rng.chance(0.25)`). Add a kit helper, for example `risk(ctx, p)`, that scales a bad
    outcome's chance by the stable's staff. Move the deck's bad-outcome rolls onto it, so every card
    reads it.
- **Screens:**
  - The Kennels shows the two staff, their bonuses and their cut. So do the hub and the season end.
  - Portraits resolve through `lib/assets.ts`.
  - `scripts/assets.ts` already has two trainer briefs. Give every staff row a portrait entry,
    briefed in the house style.

### 2. Staff arrive through the Bar

Add Bar cards that offer a trainer looking for work. You see the trainer's bonus(es) and cut. You
can hire into a slot (letting the current trainer go, named on the button) or walk away. Walk away
comes first, as D1's dog offers do, so Enter never fires anybody.

- **A trainer is one of a kind on the planet-week (`unique`).**
- **The row that matters:** a stable that wants a trainer gets **≥ 2 swings a season** (§8.2's
  "two or three"). Measure it the way D1 measured dogs: one seat opens the Bar whenever there is one.
- Normal's `aiChoice` hires when the offer's bonuses, priced against its own prize income, beat the
  cut, by a margin. Say what the margin is.

### 3. Sabotage and the bought trap draw (GDD_V3 §9.3)

Both are Back Alley cards (`content/deck/alley.ts`), freely targetable: any rival, any race, the
same cost.

- **Nobble a runner:** −25 fitness ⚖️ for that race only.
  - Apply it at race day on the runner, the way a condition is applied (`runnerFrom`). The book has
    struck its prices and the victim's *stated* fitness never changes.
  - Explore comes before the Race Office, so the job is booked against a rival's **dog**, not a race
    entry. It bites if that dog runs this weekend. Say how the target is chosen on the card:
    a button per rival, with the dog named or chosen at random.
- **Buy a trap draw:** choose your dog's box ⚖️. It is worth about 3.5 points of win rate on tight
  bends and nothing on a straight, and the screen says so.
  - The card buys the right at Explore. Spend it with a new `Action` in the Race Office once you
    know the race. Apply it at the one untouched point in `lockDeclarations`.
- **Getting caught:**
  - A flat fine plus a quarter of what you had on the race ⚖️, rolled on race day.
  - **The whole table is told who did it**: a public log line and a line on Results.
  - Catch chance is a planet row ⚖️: Lagrange Lows 20%, Holy Bark 60%, a default for the rest.
- **The rng:**
  - Anything booked at Explore runs on the stable's own stream (decision D1).
  - Anything rolled on race day (the catch) must be drawn whether or not a job was booked. Or give it
    its own stream. Either way it must not move the game's stream. Say which, and add it to the
    determinism test.
- **Normal's rule:** a simple, readable target. For example, the rival dog most likely to beat its
  own best runner, or the leader. Say which, and don't tune it to make sabotage land in band: the
  AI's rule is not the sabotage mechanic.
- **The rows:** seasons with at least one sabotage, 6 AI stables, **40–70%**. Report what a job
  earns, what getting caught costs, and who gets targeted (leader or not).

### 4. Hard reads the field (the first new Hard behaviour since Phase A)

C12–C13 left something in the field to read: a lone front-runner is worth +1.6 points, and a closer
in a crowd +2.3 (`--styles`).

- Hard reads the declarations board (§7.3), going last where it can:
  - in its entries: the closer into the crowded race, the front-runner into the empty one
  - in its betting: the book never sees the field (§5.6)
- Hard may also use sabotage and the trap draw, and hire staff, better than Normal does. That is
  §14's "better decisions, same rules".
- Report Hard v Normal against **63–68%** (the old band; `v3d1` 50.5%). If it misses, report what
  each piece was worth, the way `HARD_KNOBS` did.

### 5. Drop the "plan the week" press (Jesse's call)

Race/Rest is inert for an undeclared dog: `weeklyFitnessDelta` rests it either way. So the declaration
is the decision.

- **Engine:** the week's state follows the declarations. Keep `SetDogState` for the diet, and for
  a player who wants to mark a dog.
- **Kennels:** show "racing" or "resting" as the Race Office leaves them, not as a form to fill.
- **`hub-clicks`:** the fixed count goes from 8 to 7, and a note in the script says why and when.
  The target is **≤ 10**. The limit is ≤ 10.5.
- **Checks:** `season-check`'s "Race/Rest changes" walked counter must still mean something, or be
  retired with a note.
- If staff or sabotage add a press, count it honestly, the way D1 counted Explore.

### 6. The deck and the checks

- The deck passes **80** with the staff and sabotage cards. Every card keeps D1's shape: two or three
  choices or flavour, an `aiChoice`, a log line, a story.
- **`--explore` grows:**
  - staff commission as a share of a stable's prize money (**4–14%**)
  - trainer offers a season, and the wanting-a-trainer swings
  - sabotages a season, seasons with at least one, catches, and targets
  - trap draws bought and what they were worth
- **`season-check.ts` must FAIL** on a scripted season with zero sabotages, zero dog offers or zero
  staff offers. D1's zero-doors and zero-tips checks stay.
- **Property tests (additions only):**
  - a stable has at most two staff
  - commission is taken only from purses
  - a nobble never touches stored fitness
  - a bought box is honoured

## RULES THAT DO NOT BEND

- **The engine:** `packages/engine` has no DOM, React, `Date` or `Math.random`, and no
  `pow`/`exp`/`log`/trig. Randomness goes through `rng.ts`, threaded, and Explore's per-stable
  streams stay the rule.
- **Actions and ticks:** every state change is an `Action`. The renderer replays the tick log.
- **Content is data:** a staff member, a bonus, a card and a planet's catch chance are rows. A
  bonus that needs a branch in a phase file belongs in a helper the rows call.
- **Numbers:** they go in the spreadsheet through `add-phase-d2-rows.ts`, a copy of
  `add-phase-d-rows.ts`. Never put a literal in `packages/engine/src`, and never hand-edit
  `balance.json`. A card's own prices stay on the card row, as in D1.
- **Scope:**
  - no off-season, multi-season or hotseat work (Phase E)
  - no race-model, `oddsScale` or tip-sizing change
  - Phase B's market numbers stay as they are
- **Tests:** the golden snapshot moves only in commits that say so and why. `properties.test.ts` and
  `determinism.test.ts` take additions. If a rename forces an edit, as it did in D1, say so in the
  commit and the notes.
- **Versions:** `STATE_VERSION` and `SAVE_VERSION` move.
- **Formatting:** format only what you edit. `design/*.md` is outside the format globs.

## The commit discipline, in this order

1. Spreadsheet rows, data only. Snapshot unmoved.
2. Drop the plan-the-week press (engine and `hub-clicks`).
3. Staff: the rows, the deal and commission. Snapshot moves.
4. Staff bonuses, and the `risk` helper across the deck. Snapshot moves.
5. Trainer offers in the Bar.
6. Sabotage and the trap draw, with getting caught.
7. Hard reads the field.
8. The screens, the art contract and the click count. Snapshot unmoved.
9. Harness, `season-check` and property tests. Snapshot unmoved.
10. The version bump.

Retunes after the re-baseline get their own commits, as in D1.

## DONE WHEN (the rest of BUILD_PLAN_V3 Phase D)

| Measure | Target |
|---|---|
| Events in the deck | **≥ 80**, each category ≥ 12 |
| Share of doors chosen, per category, all-Normal | none below 12% |
| Staff commission as a share of a stable's prize money | **4–14%** |
| A stable that wants a dog / a trainer gets a swing at it | **≥ 2** a season each |
| Seasons with at least one sabotage, 6 AI stables | **40–70%** |
| Tipped buzzing bet / blind stable dog / house margin | still +10–30% / ≤ +2% / −12 to −15% |
| Two consecutive seasons share ≤ a third of their events (per seat, D8) | ✅ |
| `hub-clicks` | **≤ 10.5** (target ≤ 10) |
| Phase B's rows, races entered, races/dog, mean end worth | inside their bands |
| Hard beats Normal | 63–68%, or each piece's worth reported |
| `npm test` green; `season-check` fails on zero sabotages, dog offers or staff offers | ✅ |

⚠️ **Mean end worth is on the line already.** Staff add prize money (+10%, stat points, fitness) and
take commission. If the balance tips it out of band, the dials are:

- the commission cells
- `dogOfferRatingMean`
- the Strip's gifts

Say which you moved and why. Do not reach for the race model.

Also report, and tune toward none of them: `autoplan%`, p90/p10, under 60 at declaration, betting
income.

## Then, in order

1. **Full re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - the three headless checks: `season-check`, `hub-clicks`, `race-view-check`
   - 800 all-Normal, `--explore`, `--styles`, `--calibrate`, `--autoplan`
   - 3 Hard v 3 Normal
2. **Serve the build and screenshot:**
   - a trainer offer
   - the Kennels with two staff and their cut
   - a sabotage that landed, and one that was caught with the table told
   - a bought trap draw in the Race Office

   D1 built its screens from saves generated headlessly (seed + log into `sdr.save.v1`), which works
   well.
3. `npm run snapshot`, then `git tag v3d2` on the notes commit. **Phase D is complete at `v3d2`.**
4. **Write `claude/V3_PHASE_D2_NOTES.md`** in the style of the D1 notes. End it with a **short**
   multiple-choice `v3d2` checklist, four or five questions:
   - did a trainer feel worth their cut
   - did sabotage make the evening better or worse (§14 Q1)
   - did you buy a box and could you see it matter
   - did Hard feel like a harder opponent
   - does the week feel quicker without the plan-the-week press
5. **Update the design docs:**
   - decision rows **D9, D10, …** in `design/GDD_V3.md`: staff, the style reveal, the risk helper,
     sabotage's streams and target, the trap-draw action, plan-the-week, Hard's read
   - inline notes in §8 and §9.3, and §14 Q1 and Q12 updated
   - Phase D's status in `design/BUILD_PLAN_V3.md`: complete
   - the `v3d2` tag in `design/CANON.md`
6. Commit this prompt as `claude/V3_PHASE_D2_PROMPT.md`, corrected before commit where it was wrong.
7. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3d2`. Sync the changed `design/*.md` and the new
   `claude/` notes and prompt to the claude.ai Project with `project_write`, and update each status
   header's `last synced`.
