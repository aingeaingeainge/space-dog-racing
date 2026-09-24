# V3 Phase E1 build notes: the game's shape (24 September 2026)

**Status: Phase E1 is complete and tagged `v3e1`. Phase E is not finished.** E2 is still to come:
the table and the playtest. E1 was built in a clone in the cloud and landed in Jesse's repo folder
as a fast-forward (the mechanics are at the end). **Nothing is pushed.** The two push commands are
the last thing in these notes.

E1 is the game's shape:

- the free local runner is gone
- a game is 1–5 seasons or a Race to a Target
- there is an off-season between seasons
- a whole game saves, resumes and replays
- `--game` measures whole games

One question went to Jesse mid-phase, about mean end worth (Read this first 2). His answer was to
leave it and report. The golden snapshot moved in five commits and was left alone in seven, and
each commit message says which and why.

| | | golden |
|---|---|---|
| `230bce3` | Spreadsheet rows: game length, targets, the off-season | unmoved |
| `138078c` | **Delete the free local runner** | **move 1** |
| `a85763c` | **Game length and Target mode in the engine** | stateHash only, from the state's new fields (rows unmoved, proven) |
| `6170b5f` | **The off-season, and the age tick moved there from week 7** | **move 2** |
| `2f677fd` | The AI's off-season | unmoved |
| `0e0ad3c` | A two-season golden (added), season-keyed week marks, CI on Node 20/22/24 | unmoved; second golden written |
| `477dce2` | The minimal UI: length on the Title, season end, off-season, game-end line | unmoved |
| `9a82408` | `--game`, season-check, property and determinism tests | unmoved |
| `d5c113b` | **`STATE_VERSION` 10 → 11, `SAVE_VERSION` 9 → 10** | stateHash of both |
| `4002024` | `--game` reads the Target finish as it can happen | unmoved |
| `25168f6` | The top bar names the season; the Title's Target line corrected | unmoved |
| *(this one)* | Notes, prompt, GDD_V3 E1–E7, BUILD_PLAN_V3, CANON | — |

One-season `stateHash`: `v3d2` `1f5e508e…` → `v3e1` **`777d21bf…`**. The new two-season golden
is **`e68d8f28…`**.

`npm test` is **43 green**: D2's 35 plus three in `golden.test.ts` (the two-season game), four in
`properties.test.ts` and one in `determinism.test.ts`. Two existing tests were edited because item
1 forced it, and each edit is commented where it is. They are in Phase D1's block of
`properties.test.ts`:

- `checkD1` now asserts that no stable or dog carries a loaner, instead of checking the loaner.
- "refuses … a loaner outside the Bronze Dash" lost its loaner half and was renamed.

No test asserted the week-7 age tick. All commits are signed.

---

## ⚠️ Read this first: six things the record should know

1. **Removing the free runner changed almost nothing.** Measured at 800 seasons, before → after:

   | Measure | Before | After |
   |---|---|---|
   | Races entered a weekend | 2.16 | 2.11 |
   | Races per dog | 6.59 | 6.47 |
   | Mean end worth | 39,193 | 39,194 |
   | Injuries a stable-season | 1.15 | 1.14 |

   The injury-halving trainer, regressed on end worth by D2's method (OLS of end worth on the dealt
   bonuses, 4,800 stable-seasons), read **−1,188 (se 331) before and −1,156 (se 321) after**. So D2's
   conclusion was only half right. The halver is worth nothing, but the runner is not the reason. A
   stable with three dogs and a fitness budget is resting one dog most weeks anyway, so an injury
   usually costs a rest it was going to take. §14 Q4 is updated. If an injury should hurt, the dial
   is the base rate, and the prompt said not to touch it.

2. **Moving the age tick took one-season mean end worth out of its band: 39,194 → 42,151** (band
   25–40k).
   - §4.3 says age ticks once, in the off-season. The build had ticked it at week 7 since v3a, which
     no document asked for. So a one-season game now has no ageing.
   - All of the rise is book value. A stable's dogs are worth 18,639 at the end, against 15,923.
     Cash went 23,338 → 23,602. The 4-year-olds no longer turn 5 in week 7 and drop from ×0.85 to
     ×0.65.
   - Asked mid-phase whether to retune with the named dials (`dogOfferRatingMean`, the Strip's
     gifts), **Jesse said leave it and report.** Nothing was tuned. The old figure fit the band only
     because of a mid-season ageing nobody designed.

3. **The betting rows moved too, and two are now out of band.** `oddsScale` and the tips were not
   touched.

   | Row | Band | `v3d2` | No runner | `v3e1` |
   |---|---|---|---|---|
   | House margin | −12 to −15% | −11.6% | −11.0% | −10.9% ❌ |
   | A stable dog backed blind | ≤ +2% | −0.4% | +1.5% | **+2.6% ❌** |
   | A tipped buzzing dog | +10–30% | +27.5% | +30.1% | +30.0% (at the top) |

   The blind-stable-dog edge is D1's "a fed dog is quietly better than its number". Without the
   week-7 tick, a 2-year-old grows +1 a week all season while its Elo rating lags, and a 4-year-old
   no longer declines. So the book underprices stable dogs a little more than it did. It is a
   consequence of §4.3, not a tuning error, and it is Jesse's call whether the book should see
   age.

4. **Stables almost never end a season poorer than they started: 0.8%, against §11's 10–25%.** The
   row had never been measured. With food as the only running cost, a stable that races at all grows,
   in every season of a 5-season game (0.6%). This is the biggest miss in E1, and it belongs to the
   economy, not to E1's systems. §11 calls going backwards "the only failure state", and the game
   barely has one. Reported, not tuned: no named dial reaches it.

5. **"Crosser not the winner" can never happen**, and the Title's copy was wrong about it. Target mode
   checks net worth once, at the end of the weekend (§2.1). Whoever is richest at that moment has
   crossed too, so the richest stable is always a crosser: 0 of 400 games. What §2.1's "overtaken on
   the line by a bet" can mean is one of two things:
   - two stables crossing on the same weekend: 9.0% at 60,000, 6.5% at 150,000
   - the stable that led into the last weekend losing it: 27.0% at 60,000, 12.0% at 150,000

   `--game` prints both, and the Title's line now says so (`25168f6`).

6. **Pillar 5 holds for a season, not for the last season of a long game.** By E7's definition, 0% of
   stables are mathematically out at the start of week 8 in a one-season game. In the last season:

   | Game | Stables out at week 8 |
   |---|---|
   | 3 seasons | 12.8% |
   | 5 seasons | 42.2% |
   | Target 150,000 | 27.8% |

   The rich compound, modestly. In seasons 2–5 the richer half of a table gains 27,116 a season and
   the poorer half 20,998. The leader after season 1 wins a 5-season game 43% of the time (1 in 6 by
   chance). Reported. Whether a long game needs a catch-up is a design question for Jesse, and E2's
   playtest should ask it.

---

## The acceptance table (BUILD_PLAN_V3 Phase E, E1's rows)

`--game --games 200`: six Normal stables. 400 one-season games, and 200 each of 3 seasons, 5
seasons, Target 60,000 and Target 150,000. The one-season rows are from 800 seasons.

| Measure | Target | `v3e1` | |
|---|---|---|---|
| Stables ending a season on less than they started | 10–25% | **0.8%** (1 season) · 0.6% (5 seasons) · 7.0% (Target 60,000) | ❌ reported (Read this first 4) |
| Net worth gap, 1st to last, end of season | narrower than v2's | 26,510 · 62% of the table mean · 1st/last 1.85×, against v2e's 63,530 · 195% · 8.16× | ✅ |
| Nobody mathematically out before week 8 (E7) | ✅ | one season **0.0%** · last season of 3 / 5-season games 12.8% / 42.2% | ✅ / ❌ reported |
| A 5-season game's roster turns over | ≥ 1 per stable per 2 seasons | **1.81** (1.02 retired, 0.79 in the Pound) | ✅ |
| Seed + log reproduces a whole multi-season game | ✅ tests; Node 20/22/24 in CI | two-season golden replays; a 3-season log replays in the scratch check; the CI matrix is added but **has not run** (it runs on push) | ✅ / pending |
| One-season rows | in band, or reported | mean end worth **42,151** ❌ · races entered 2.12 · races/dog 6.54 · food 32.6% · crossover wk 4.4 · p99 leg 12.7% of worth · house −10.9% ❌ · blind +2.6% ❌ · buzzing +30.0% | reported |
| `npm test`; `npm run build` → `packages/web/dist` | ✅ | 43 green; built | ✅ |

**The v2 gap** was not recorded in any v2 notes. It was measured in a scratch clone at `v2e` with
that tag's own engine: 800 seasons, six Normal, `runSeason` and `netWorth` at the season's end.
Mean worth 32,543; gap 63,530 mean (62,783 median); gap/mean 195%; 1st/last median 8.16×.

**E2's rows (🎲) are outstanding:**

- 25 minutes for four humans with races skipped
- 40 minutes with races watched
- 70 minutes for eight
- a Target finish worth watching

### The rest of `--game`

| | 1 season | 3 seasons | 5 seasons | Target 60k | Target 150k |
|---|---|---|---|---|---|
| Seasons played | 1.00 | 3.00 | 5.00 | 1.75 | 4.41 |
| Poorer than they began | 0.8% | 0.7% | 0.6% | 7.0% | 1.7% |
| Gap, 1st to last (mean) | 26,510 | 42,468 | 61,808 | 26,858 | 51,886 |
| Out at week 8, any season / the last | 0.0 / 0.0% | 4.6 / 12.8% | 17.1 / 42.2% | 0.0 / 0.0% | 7.3 / 27.8% |
| Engine, ms a player-weekend | 0.89 | 0.87 | 0.84 | 0.85 | 0.83 |

**5-season games, season by season:**

| Season | Worth at first arrival → season end | Races entered a weekend | Mean age at start | Age 6 / 7 at start |
|---|---|---|---|---|
| 1 | 23,663 → 42,186 | 2.12 | 2.97 | 0 / 0 |
| 2 | 41,549 → 61,321 | 1.89 | 3.62 | 0.1% / 0 |
| 3 | 60,721 → 85,012 | 1.88 | 3.94 | 6.1% / 0 |
| 4 | 84,389 → 110,596 | 1.86 | 4.07 | 9.7% / 1.1% |
| 5 | 110,784 → 136,740 | 1.86 | 3.98 | 18.1% / 1.9% |

- **Races entered drop after season 1, from 2.12 to about 1.87.** Fitness and layoffs carry over
  untouched (§2.2), and dogs of 5 and over rest back 25 or 20 a week, not 30. The drop stays inside
  the 1.8–2.4 band, but only just. §2.2 does not say whether a dog should come back fresh, and that
  question is worth asking Jesse.
- **The game does not age into seven-year-olds.** Normal retires at 6, and the retirement window
  is used a lot: 63.9% of stables retire a dog at an off-season.
- **Trainers** leave 0.29 a stable an off-season. 27.9% of stables are offered a candidate, and
  every AI takes one: `hireSlot` always fills an empty slot.

**Target mode:**

| Target | Weekends to finish (mean / p10 / p90) | Two or more crossed | Leader into the last weekend lost | Hit the 10-season cap |
|---|---|---|---|---|
| 60,000 | 13.2 / 10 / 17 | 9.0% | 27.0% | 0.0% |
| 150,000 | 40.6 / 34 / 48 | 6.5% | 12.0% | 0.0% |

At 60,000 the game usually ends in the first half of season 2, which is exactly §14 Q6's worry
("week 4 of season 2"). The checklist asks whether 60,000 makes a good short game.

**Engine wall-clock: 0.85 ms a player-weekend** (184,572 player-weekends in 157 s, AI decisions
included). The engine is not what will make a game long.

### The re-baseline (one season, 800 seasons, six Normal unless said)

| Measure | `v3d2` | `v3e1` |
|---|---|---|
| Mean end worth (band 25–40k) | 39,193 | **42,151** ❌ |
| Races entered / races per dog / p90:p10 | 2.16 / 6.59 / 1.93× | 2.12 / 6.54 / 1.84× |
| Phase B rows | food 33.1% · crossover 4.4 · p99 leg 13.7% | food 32.6% · crossover 4.4 · p99 leg 12.7% ✅ |
| House margin / blind stable dog / buzzing dog | −11.6% / −0.4% / +27.5% | −10.9% ❌ / +2.6% ❌ / +30.0% |
| Commission / seasons with a sabotage | 13.2% / 69.1% | 13.2% / 69.0% |
| Doors chosen per category | 17.2–22.7% | 17.2–22.7% |
| Local runners lent | 1.2 a stable-season | **0** |
| Hard beats Normal (3 v 3) | 50.7% | 49.9% (not tuned, per Jesse) |
| `hub-clicks` | 9.4 | 9.4 |
| Under 60 at declaration | 23.1% | 23.2% |
| autoplan% (target 15–30) | 25.6% | 30.0% (at the top) |
| Calibration (65 v seven 50s) | 51.8% | 51.8% (race model untouched) |
| Margin / photo finishes / closer's hot-pace gap | 6.3 m / 3.1% / +2.3 | 6.5 m / 3.1% / +2.3 |
| Season decided by week | — | 7.5 |

`season-check`, `hub-clicks` and `race-view-check` all pass.

---

## The build, item by item

### 1. No free local runner (GDD_V3 E1)

Deleted outright, as the prompt listed:

- `lendRunners`, `LOAN_RACE`, `LOAN_STREAM`
- `Dog.loan`, `Player.loanerId`
- `localRunnerFitAt`, removed through the phase row script's `REMOVE` list. ⚠️ `add-phase-d-rows.ts`
  still writes that row, so re-running it would put the row back.
- the loaner's branches in `declare`, `followDeclarations`, `runRaces` and the jump's sweep
- the injury roll's loan exemption
- `emitDeclarations`' Bronze fill
- the Race Office's loaner text and option

The Race Office now says, when a dog is on layoff, that nobody lends a runner and that a vet
behind the Pound (or the Back Alley) can shorten it.

### 2. Game length and Target mode (E2, E3)

- **Setup.** `SeasonSetup.length?: { kind: 'seasons', seasons } | { kind: 'target', worth }`,
  checked by `gameLengthOf`. No length means one season.
- **State.** `GameState` gains `season`, `length`, `seasons: SeasonRecord[]` and `gameOver`. A
  season record holds the season's standings, each stable's stats as the season left them, its Gold
  Cups and race wins, the calendar and the weekends played. `emptySeasonStats()` is factored out of
  `createSeason`.
- **`phases/game.ts`.** `finishSeason` moves here. It archives the season, then either ends the game
  or opens the off-season:
  - the seasons ran out → `seasons`
  - a target was crossed → `target`
  - a Target game reached `targetSeasonCap` → `cap`
- **`finalStandings` is the game's.** It is final net worth, with ties broken on Gold Cups and then
  races won across the whole game (§2.4). v2's second tie-break was most Majors.
- **`newSeason`** is a new system phase. Its AdvancePhase:
  - re-draws the circuit on the game's stream
  - clears next week's market, so arrival rolls fresh prices
  - clears conditions, jobs, bets, declarations, results, the log and `intel`, which is keyed by a
    week number that repeats
  - resets every stable's stats
- **Target check.** It runs at the end of every weekend, after the dinner and before the jump, and
  reads the same figure as `worthByWeek`.
- **The golden.** The one-season golden's rows did not move in this commit. Its stateHash did,
  because the state gained four fields. With those four fields deleted, the seed-42 state hashes to
  the previous commit's `cdf538ba…` exactly.
- **The phase name.** `seasonEnd` is still the terminal phase's name, now meaning "the game is
  over", because every screen, script and test asks it. The alternative was renaming it through the
  golden test.

### 3. The off-season (E4, E5, E6), `phases/offSeason.ts`

1. **Every dog ages a year**, capped at 7. The week-7 tick is gone, and so is `ageTickWeek`.
2. **The offers are rolled.** The game's stream draws one seed per stable, in seating order, and
   nothing else. Each stable's stream then rolls:
   - its replacement: `rollOffer` at `retireOfferLieMult` × 0.35, the "breeder's agent"
   - one draw per trainer at `staffNoticeChance` (15%). Leavers go at once.

   A second pass, in seating order once everybody's leavers are in the pool, offers a stable left
   short one candidate from `unemployedStaff`. It is never one of its own leavers and never one
   already offered to another stable. Everything is rolled before anybody answers.
3. **Answers:**
   - `Retire { dogId }` pays `dogValue` into cash and brings in the offer through `acceptOffer`:
     style unknown, not dealt, `dealtGone` kept, then `revealStyles`.
   - `Retire { dogId: null }` keeps them all.
   - `ResolveStaffNotice { hire }` answers the staff notice.
   - Each is answered once. EndPhase is refused until everything is answered.
   - The last EndPhase moves the game to `newSeason`.

**The order, and our reading of it:** the offer is on screen before the stable chooses between
"Retire *name*" (one button per dog, with its book value) and "Keep them all". §2.2's "you see what
you are being offered before you accept" is the reason.

**What carries over:**

- cash, cargo and You Paid
- dogs, including their fitness and any layoff (see "Carried forward")
- trainers
- styles and `dealtGone`
- the arrival flags

### 4. The AI's off-season, `ai/offSeason.ts`

- **Easy** keeps everybody and takes a candidate into an empty slot.
- **Normal** retires any dog of `aiRetireAge` (6) or older, the lowest-valued if it has two.
  Otherwise it retires its cheapest dog when `estimateOffer` reads the replacement as more than
  that dog's book value plus `aiRetireMargin`. **The margin is 500 Bones.** It takes a candidate by
  `hireSlot`, which always fills an empty slot.
- **Hard** uses half the margin and prices the candidate with `hardWorth`.

The margin and the age are sheet rows.

### 5. Save, resume, replay; the second golden; CI

- **The save** is still seed + log, and the setup carries `length`.
- **The UI's week marks** (races watched, results read, fields read) are now `weekKey(state)`. That
  is the week itself in season 1, and `100 × (season − 1) + week` after it. A new mark,
  `seasonSeen`, records which season's end the table has read.
- **Resume** replays the whole multi-season log.
- **The second golden** is added in `golden.test.ts`, below the first, which is untouched: seed 42,
  six Normal, two seasons. The digest records both seasons' calendars and standings, the game's
  standings, the retirements and hires (one of each), every stable's staff and dogs, and the
  stateHash. It replays.
- **CI** is a matrix of Node 20, 22 and 24. ⚠️ **It has not run.** It runs when Jesse pushes.

### 6. The minimal UI

- **Title:** a game-length select. The options are 1–5 seasons, "Race to 60,000 — a short game",
  "Race to 150,000 — a long game" and a figure of your own. Seed links carry the length (`len=3`,
  `len=t60000`).
- **Season end:** between seasons, the table sees "Season N over" with "On to season N+1".
- **Off-season:** then each human, behind the pass screen, gets `screens/OffSeason.tsx`:
  - the ageing, shown and not asked: age before → after, book value, and what the year means
  - the retirement window
  - the staff notice
  - "On to season N"

  Answers dispatch as they are pressed, so presses are actions: at most three, and season-check
  saw two at most.
- **Game over:** a plain line names the winner. In a Target game it also names who crossed, and
  says "Overtaken on the line!" if the winner did not cross, which cannot happen (Read this first
  5).
- **Top bar:** reads "Season 2/3 · Week 3/10" in a longer game.

The real season-end and game-end screens are E2's.

### 7. The checks

- **`season-check`** now also walks:
  - seed 42 as a two-season game, retiring the human's cheapest dog
  - seed 7 as a two-season game, keeping them all
  - seed 1234 as a race to 60,000, to its end

  It presses one button at a time. It fails if an off-season takes more than three presses, or if,
  across the run, any of these never happened: a retirement offered, a staff candidate offered,
  either answer given, a Target game finished. Its per-season counts now sum the season archive.
  The run saw 3 off-season screens (2 presses at most), 18 retirements on offer and 3 staff
  candidates.
- **Property tests** (additions):
  - ages rise by exactly one per off-season and never within a season
  - no dog carries `loan` in any season
  - a retirement pays exactly the book value and brings in the offered dog, unknown and not dealt;
    each answer is refused a second time, and EndPhase is refused until the staff notice is answered
  - a Target game ends at the end of the first weekend anybody crosses, and the richest wins
  - stats reset at a new season, and the archive keeps the old ones
- **Determinism test** (addition): two humans answering the off-season opposite ways get the same
  off-season notices, the same next circuit, turn order and Explore seeds, and every rival keeps
  the same kennel and trainers.

## Screenshots

From `vite preview` of the build, with saves generated headlessly (seed + log into `sdr.save.v1`,
then Resume). They are in the session outputs:

- **`v3e1-title-target.png`:** the Title, with "Race to 60,000 Bones — a short game" chosen.
  *(Taken before `25168f6` corrected the line under it.)*
- **`v3e1-offseason.png`:** seed 18, three seasons, between seasons 1 and 2.
  - Terror the Fried is 4 → 5 (book value ×0.65).
  - The breeder's agent offers Auntie Torque, age 3, Stamina 45, "out of the boxes like a cork out
    of a bottle".
  - Doc Rumbold has handed in his notice, and Pops Varga (7%) is looking for work.
- **`v3e1-hub-season2.png`:** seed 12, Holy Bark. The top bar reads "Season 2/3 · Week 3/10".
- **`v3e1-target-final.png`:** seed 21, race to 60,000. "Jesse crossed the target at week 6 of
  season 2. Jesse wins with 62,032 Bones."

---

## To push

Landed in your folder as a fast-forward from `1a51081` (`v3d2`), the `main` that
`git ls-remote origin` reported. Your tree was clean before and after, and there is no
`index.lock`. **`package-lock.json` is untouched.** A `v3d2` save will not load: it lands on the
title screen.

```
git push origin main
git push origin v3e1
```

- **`design/space_dog_racing_economy.xlsx` changed.** The rows come from
  `packages/engine/scripts/add-phase-e1-rows.ts`: nine added, one removed (`localRunnerFitAt`).
- **`.github/workflows/ci.yml` changed**, to the Node 20/22/24 matrix. Pushing runs it for the
  first time.
- **Design documents changed** and are synced to the claude.ai Project:
  - `GDD_V3.md`: decisions E1–E7, notes in §2.1, §2.2, §4.3, §4.4 and §11, and §14 Q4 and Q6
  - `BUILD_PLAN_V3.md`: Phase E1 complete
  - `CANON.md`: the `v3e1` tag

---

## ⚠️ The v3e1 checklist: four questions, multiple choice

Play a three-season game, or a race to 60,000. Retire somebody at least once.

1. **Did a second season feel different from the first?** *Yes, the kennel had changed · A bit,
   the ages showed · No, it was the same season again · Didn't get to one*
2. **Was the retirement a real decision?** *Yes, I weighed the offer against my dog · Easy, an old
   dog had to go · I always kept them all · The offer was never worth it*
3. **Did injuries feel worse without the local runner?** *Yes, a layoff hurt · About the same ·
   Didn't notice it was gone · Had no injuries*
4. **Does 60,000 make a good short game?** *Yes, a good length · Too short, it ended just as season
   2 got going · Too long · Didn't play Target*

---

## Carried forward

- **Mean end worth is 42,151, above its band.** Jesse's call is to leave it. If it is retuned
  later, the dials are `dogOfferRatingMean` and the Strip's gifts, or §4.3's value column (age 4 is
  ×0.85 in the sheet, which §4.3 does not list).
- **The book underprices stable dogs by 2.6%, and the house margin is −10.9%.** Both come from the
  runner going and the age tick moving, not from the book. Whether the book should see age (or
  fitness, §14 Q9) is a question for Jesse.
- **Almost no stable ends a season poorer (0.8% against 10–25%).** This is §11's failure state, and
  the economy has almost none of it. It is the largest open miss.
- **The last season of a long game has stables out of it by week 8** (42% in 5-season games). A
  catch-up rule, or a shorter default, is a design question. E2's playtest should ask it.
- **Dogs start a new season on last season's fitness.** Races entered drop from 2.12 to about 1.87
  after season 1. §2.2 is silent. A "fresh for the new season" rule would be one line in
  `startNextSeason`.
- **§2.1's "not necessarily the stable that crossed" cannot happen** with one check a weekend. If
  Jesse wants the crosser to be caught by someone who did not cross, the check has to move (for
  example, crossing is checked after race day, and the winner is decided after the jump). That is a
  rules call.
- **Hard 49.9%**, not tuned, per Jesse.
- **E2** takes simultaneous hotseat, skippable races, the real season-end and game-end screens, and
  the playtest rows. The seams it will need:
  - `seasonSeen` and `weekKey` in the store
  - the season archive, for a game-end screen
  - `gameOver.crossers`, for the Target finish
  - `OffSeason.tsx`, already one screen per human behind the pass screen
