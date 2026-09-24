# V3 Phase E2 build notes: the table (25 September 2026)

**Status: Phase E2 is built and tagged `v3e2`. Phase E's four 🎲 rows are still open**: they need
people round a laptop, and the pace timer is built to measure them. E2 was built in a clone in the
cloud and landed in Jesse's repo folder as a fast-forward. **Nothing is pushed.** The two push commands
are the last thing in these notes.

E2 is the table:

- the hotseat loop, with the laptop passed only when privacy needs it
- race day that can be skipped in one press
- every dog starts a new season fresh (Jesse's call)
- the real season-end and game-end screens
- the pace timer and the playtest checklist

No question went to Jesse mid-phase. The golden moved in one commit for a rule (the fresh season: the
two-season golden only). Its stateHash moved in two more, from new state fields only, each proven. Every
other commit left it alone, and each commit message says which.

| | | golden |
|---|---|---|
| `9722dd2` | Spreadsheet row: `seasonStartFitness` | unmoved |
| `c448ed2` | **Every dog starts a new season fresh** | **two-season moves**; one-season unmoved |
| `5022503` | The pass count in `hub-clicks`, as a baseline | unmoved |
| `2847536` | **The Bookie takes bets in any order** (the engine's half, with a determinism test) | unmoved |
| `c8e1a30` | The hotseat loop (UI) | unmoved |
| `77b78c8` | Skip the rest of race day | unmoved |
| `868f79e` | The season-end screen | unmoved |
| `e69749f` | **The game-end screen; each season's moments archived** | stateHash only (rows unmoved, proven) |
| `7568cd9` | The pace timer and the playtest checklist | unmoved |
| `aec1454` | `season-check` at a four-human table; property tests | unmoved |
| `01a7e59` | **`STATE_VERSION` 11 → 12, `SAVE_VERSION` 10 → 11** | stateHash only |
| `63b2f20` | The table's results button; `table-walk` hands its log to `onScreen` | unmoved |
| *(this one)* | Notes, prompt, GDD_V3 E8–E11, BUILD_PLAN_V3, CANON | — |

**The goldens:**

| | `v3e1` | `v3e2` | Why |
|---|---|---|---|
| One season | `777d21bf…` | **`8dc05e06…`** | stateHash only. The rows did not move. It moved twice, from the archive's `moments` field (`837ab019…`) and then `state.version`. With `moments` deleted from each record the state hashes to `777d21bf…` exactly |
| Two seasons | `e68d8f28…` | **`dc357422…`** | The fresh season moved the rows (`ae3d6f0a…`, 1,330 → 1,298 actions). Then the same two stateHash-only moves |

`npm test` is **47 green**: E1's 43 and four additions. One is in `determinism.test.ts` (the Bookie in
any order) and three are in `properties.test.ts` (the fresh season, the archive's moments, betting out of
turn). No existing test had to change except the two-season golden snapshot. All commits are signed.

**CI could not be checked.** `gh` is not installed in the build container, and the GitHub API refused
this session ("GitHub access to this repository is not enabled"). So the Node 20/22/24 run from the
`v3e1` push is unread. **Look at the Actions tab before pushing `v3e2`.** If a leg failed, it is the
first thing to fix.

---

## ⚠️ Read this first: five things the record should know

1. **The laptop moves about a quarter less, and not by half.** Measured by `hub-clicks` over five
   seeds, a season each:

   | Table | Passes a weekend, `v3e1` → `v3e2` | Presses a human a weekend |
   |---|---|---|
   | 4 humans + 2 AIs | 14.5 → **10.7** | 13.8 → 12.9 |
   | 8 humans | 30.4 → **22.4** | 14.1 → 13.1 |

   What is left is what the rules need. Explore and the Market/Kennels/Race Office sitting are both in
   turn order, and one must finish before the next opens (a sabotage or a trainer's word lands between
   them), so each human needs a sitting for each. That is 2 passes a human. The Bookie saves one: the
   human who holds the laptop after the Race Office bets first. The roll-call after the races saves the
   rest: before E2 every human but the first took the laptop just to press "Fly on". **Merging a human's
   door with their market would halve the passes. It is a rule change (Explore would resolve interleaved
   with the Market), and it is not made here.**

2. **The results screen was leaking at a multi-human table, and is now public.** Before E2 the results
   were shown to the whole table with the first human's "Your bets" and "Your business in the Back
   Alley" on them. Bets are private (§3). At a table the results now show every stable's purses and
   nobody's slips, and each human reads their own settled slips on their next private screen: the next
   door, or the off-season. One human sees exactly what they saw before.

3. **The fresh season does what it was for, and widens the long game.** In 5-season games (200
   games, six Normal, before → after):

   | Season | Races entered a weekend | Worth at the season's end |
   |---|---|---|
   | 1 | 2.12 → 2.12 | 42,186 → 42,186 |
   | 2 | 1.89 → **2.12** | 61,321 → 65,625 |
   | 3 | 1.88 → 2.09 | 85,012 → 91,356 |
   | 4 | 1.86 → 2.06 | 110,596 → 119,161 |
   | 5 | 1.86 → 2.04 | 136,740 → **147,689** |

   | Row | Before | After |
   |---|---|---|
   | Poorer than they began: 1 / 3 / 5 seasons | 0.8 / 0.7 / 0.6% | 0.8 / 0.7 / 0.6% |
   | Poorer than they began: Target 60k / 150k | 7.0 / 1.7% | 5.5 / 1.6% |
   | Out at week 8 of the last season: 3 / 5 seasons | 12.8 / 42.2% | **15.8 / 48.8%** |
   | Out at week 8 of the last season: Target 150k | 27.8% | 25.2% |
   | Gap, 1st to last: 5 seasons | 61,808 | 67,668 |
   | Richer half's gain a season (seasons 2–5) against the poorer half's | 27,116 v 20,998 | 30,294 v 23,201 |
   | The leader after season 1 wins a 5-season game | 43.0% | 35.5% |

   Everybody earns more each season, so the long game's absolute gap grows and more stables are out by
   week 8 of the last season. The season-1 leader converts less often, though. **Nothing was tuned**, as
   the prompt said. E1's two misses (0.6–0.8% poorer, the runaway leader) are measured above and are
   left for the playtest.

4. **Jesse's week-6 finish was a 1-in-200 game.** Of 400 races to 60,000 (six Normal AIs, seeds
   1–400), 0.5% ended by weekend 6, 2.5% by weekend 8 and 26% by weekend 10. The mean is 12.2 weekends
   (13.1 at `v3e1`), the median 12 and p10 10. At `v3e1` the share by weekend 6 was the same 0.5%: the
   fresh season only matters after weekend 10. A human who plays better than a Normal AI will finish
   sooner, so this puts an upper bound on how rare it was. Nothing changed.

5. **Each season's moments are archived now (E10)**, so the game's end tells the whole game's story.
   The alternative was to show only the last season's moments plus totals. It was rejected because each
   new season clears the results and the book, and a five-season game's end would lose four-fifths of
   what happened. It is a state change, and `STATE_VERSION` is 12.

---

## The acceptance table (BUILD_PLAN_V3 Phase E, E2's rows)

| Measure | Target | `v3e2` | |
|---|---|---|---|
| Explore, Kennel and the Bookie take no more passes than privacy needs | ✅, reported at 4 and 8 humans | 14.5 → 10.7 and 30.4 → 22.4 passes a weekend (Read this first 1) | ✅ |
| Race day skippable in one press | ✅ | "Skip the rest of race day", Shift+S | ✅ |
| Season-end and game-end screens: income split, net-worth chart (whole game at the end), moments | ✅ | both built; screenshots below | ✅ |
| A new season starts every dog fresh | ✅ property test | three 3-season games, six new seasons, every dog on 100 with no layoff | ✅ |
| `season-check` walks four humans with no private screen leaking | ✅ | two games at a 4-human table, 0 leaks; the check reports 200 with the planet's pass removed on purpose | ✅ |
| CI green on Node 20/22/24 | ✅ | **not checked** (no GitHub access) | ❓ |
| One-season rows unmoved; `--game` re-measured | reported | 800 all-Normal seasons **byte-identical** to `v3e1`, the timings aside; `--explore` identical; `--game` in Read this first 3 | ✅ |
| 🎲 4 humans, 1 season, races skipped ≤ 25 min · watched ≤ 40 · 8 humans ≤ 70 · a Target finish worth watching | 🎲 | outstanding: the pace timer measures them | — |
| `npm test`; `npm run build` → `packages/web/dist` | ✅ | 47 green; built | ✅ |

### The re-baseline

- **`npm test`** is 47 green, **`npm run lint`** is clean and **`npm run build`** builds.
- **`season-check`** passes. It walked the single-human games E1 walked, then a four-human table
  through a two-season game (seed 42, 10.8 passes a weekend) and a race to 60,000 (seed 1234, 11.3),
  with 16 race days skipped, 0 leaks and both logs replaying.
- **`hub-clicks`**: one human still reads **9.4** a weekend. The table is in Read this first 1.
  "Table presses" now read 5.3 a weekend, because a watched race day costs a press a race. At the
  baseline it counted as one, which read 2.2.
- **`race-view-check`** passes, unchanged.
- **800 all-Normal seasons** match `v3e1` line for line, the timings aside:
  - mean end worth 42,151
  - races entered 2.12
  - races/dog 6.54
  - food 32.6%
  - crossover week 4.4
  - p99 leg 12.7%
  - decided by week 7.5

  All-AI play goes through no code E2 changed: AIs still bet in turn order and still file their slips
  where they always did.
- **Hard (49.9%)** was not re-run, because its play is unchanged. The race model, `oddsScale`, the
  market, the tips, the staff cuts and the nobble were not touched.
- **`--explore`** is identical to `v3e1`. It was run because the betting phase changed shape.
- **`--game`** at 1, 3 and 5 seasons and both targets: Read this first 3 and 4. Target 150,000 now
  finishes in 37.2 weekends (40.6 before; p10 30, p90 43).

---

## The build, item by item

### 1. The hotseat loop (GDD_V3 §2.3, §3, E8)

**The rule the loop keeps:** a private screen whose owner is not the human who last held the laptop comes
after a pass. Private screens are listed in `PRIVATE_SCREENS` (`store/loop.ts`):

- the door and its card
- the market, kennels and Race Office
- the Bookie
- the off-season

Everything else is public.

- **The pass screen** is skipped for the human already holding the laptop. It names who is next and
  why, from `passReason`: "Market, Kennels and Race Office — in turn order: the shelf is shared and
  the declarations are public", or "The Bookie — everybody bets privately, in any order".
- **The Bookie is taken in any order. This is the engine's half (`2847536`):**
  - `placeBet` and EndPhase accept any stable that has not finished betting.
  - `endPhaseFor` hands the turn to the first stable in the turn order still to finish.
  - A slip is spliced into `s.bets` after every slip this weekend from a stable at or before it in the
    turn order.

  **The determinism argument:**
  - a bet reads nothing another stable's bet writes (prices are fixed at the lock, and the cap is a
    fraction of the stable's own cash)
  - no AI reads the book
  - the book is filed in turn order
  - nothing draws
  - `done` is cleared when the phase ends

  The test plays four humans and two AIs through all 24 orders the humans can bet in, on two weekends,
  and gets the same state byte for byte. With `push()` in place of the splice, it fails. The UI seats
  the laptop's holder first (`bookieSitter`), and the rest follow in turn order.
- **Public moments** (`screens/Table.tsx`). Each ends on a button that *is* the pass when the laptop
  has to move ("I am Human 3"), so none costs a press on top of a handover:
  - **the arrival**: the planet and the turn order with its reasons, before the first door
  - **the board**: the locked card and the prices (`LockedField` with `board`), before the first slip
  - **after the races**: a roll-call in turn order. Each human presses "fly on" in public, or "trade
    first" to take the laptop back to their own planet screen. They fly on from there.
- **The results are public at a table.** They show every stable's purses and no slips or Back Alley
  business. `LastSlips` shows each human's settled slips on the next door or the off-season. The race
  view has no "you" at a table, and the worth chart's "— you" appears only when one human plays.
- One human sees exactly what they saw before. None of the table's screens appear, and `hub-clicks`
  still reads 9.4.

### 2. Skip the rest of race day

- A button in the race view (and Shift+S) calls `ackRaces`. That marks the weekend's races watched,
  exactly as reaching the end of the last race does.
- The per-race Skip stays. Nothing is auto-skipped, and there is no Title toggle.
- The button is hidden on the last race's result card, where Next does the same.

### 3. Fresh at the new season (E9)

- At `startNextSeason`, every stable dog's fitness is set to `balance.seasonStartFitness` (100, a sheet
  row written by `add-phase-e2-rows.ts`) and its `injuryWeeks` to 0.
- This is after the off-season. So a retirement still pays an injured dog's book value, and an injured
  dog shows as injured on the off-season screen.
- The off-season screen's carry-over line says so.

### 4. The season-end and game-end screens (E10)

**Between seasons** (`SeasonOver`):

- the season's champion
- "On to season N", with what the off-season holds
- the podium
- **where the money came from**: prize money before the cut, the trainers' cut, trading, betting, food
  and bills, and the ledger
- the season's chart
- the moments
- the season's standings

All of it is read off the season's archive record, because the off-season has already aged the dogs.

**The game's end** (`GameOver`):

- **the winner, big**, and why the game ended ("The seasons ran out", "Target crossed", "The season cap")
- the clock (item 5)
- in a Target game, **the finish**: who crossed, at which week and which weekend of the game, whether
  two crossed together, and whether the stable that led into the last weekend was caught
- **the whole game's chart**, every season laid end to end from the archive's `worthByWeek`, with each
  off-season marked S2, S3…
- **the game's moments**:
  - the longest-priced winner of any season
  - the most valuable dog left
  - the best slip of any season
  - everybody the stewards caught
  - the last time the lead changed, across the whole game ("Season 1, week 7")
- **season by season**: who topped each season and the runner-up, then each stable's seasons topped,
  Gold Cups and races won (from `gameTotal`) and final worth
- the whole game's income split
- the final standings
- **Play again** (the same setup, from the first weekend) and **New game**

A one-season game shows its season's podium and chart in place of the table of seasons. E1's "Overtaken
on the line!" is gone, because it cannot happen (E3).

**The archive:** `SeasonRecord.moments = { upset, bet, betsStruck }`, computed at `finishSeason`. Names
are copied in, because locals are swept at the jump and dogs retire. A property test checks both against
the season's own results and book.

### 5. The pace timer and the checklist (E11)

- `lib/pace.ts` records wall-clock seconds for each weekend, arrival to "Fly on", in four buckets:
  private screens, race day, pass screens, and the table's own screens. Time between seasons is kept
  separately.
- App.tsx closes one stretch and opens the next on every change of screen kind or weekend. A hidden
  window stops the clock, and a stretch counts ten minutes at most.
- It is kept in the save's `ui` block (`SaveUi.pace`, optional), never in state or the log.
- The game-end screen reads it back: "This game took *m* minutes, *s* a weekend, of which race day *r*",
  and the four-way split. It is hidden for a game with no clock (the screenshots' saves, below).
- `design/PLAYTEST_CHECKLIST.md` opens with "v3 Phase E2 — the table":
  - the four timed rows
  - how to read the clock
  - what the passing should feel like
  - E1's unplayed questions, and one on the fresh start

  v1's checklist below it is marked historical.

### 6. The checks

- **`table-walk.ts`** (new; used by `hub-clicks` and `season-check`) walks N humans through
  `screenFor` and counts passes, presses a human and table presses. It records a leak whenever a private
  screen changes owner with no pass since the last one. Options: race days watched or skipped, trips
  back to trade after the races, and an `onScreen` hook that receives the log.
- **`season-check`** additionally walks four humans through a two-season game and a race to 60,000. It
  fails on a leak or a log that does not replay. It also fails unless the run skipped a race day,
  watched one, traded after the races, and reached an off-season.
- **`hub-clicks`** prints the table at 4 and 8 humans.

## Screenshots

From `vite preview` of the build, with saves generated headlessly by `table-walk` (seed + log into
`sdr.save.v1`, then Resume). A four-human table (Human 1–4) with two Normal AIs. The saves carry no pace
record, so the clock panel is not shown. The files are in the session outputs:

- **`v3e2-pass.png`**: seed 42, week 2. "Pass to Human 4 · Market, Kennels and Race Office — in turn
  order: the shelf is shared and the declarations are public."
- **`v3e2-bookie.png`**: seed 42, week 3, the Bronze Dash at Kibbleton Prime running, with 1×, 2×,
  Skip and **Skip the rest of race day**.
- **`v3e2-after-races.png`**: the roll-call after the races, after "Skip the rest of race day" and the
  public results.
- **`v3e2-season-end.png`**: seed 42, two seasons, between them. Fizz Molloy tops season 1 on 82,837
  with 2 Gold Cups. Shows the podium, where the money came from (with the trainers' cut), the chart
  and the moments (the upset is Admiral Crumble at 66.78).
- **`v3e2-game-end-3seasons.png`**: seed 18, three seasons. Meg the Knife wins on 179,497, having
  topped all three. Shows the whole-game chart with S2 and S3 marked, the game's moments, season by
  season, the whole game's split and the final standings.
- **`v3e2-game-end-target.png`**: seed 21, race to 60,000. Two-Fingers Grady crossed at week 2 of
  season 2 (weekend 12), alone, and the leader into the last weekend held on.

---

## To push

Landed in your folder as a fast-forward from `58bc643` (`v3e1`), the `main` that `git ls-remote origin`
reported. Your tree was clean before and after, and there is no `index.lock`. **`package-lock.json` is
untouched.** A `v3e1` save will not load and lands on the title screen.

```
git push origin main
git push origin v3e2
```

- **Check the Actions tab first** for the `v3e1` run (not checked from here).
- **`design/space_dog_racing_economy.xlsx` changed**: one row, from
  `packages/engine/scripts/add-phase-e2-rows.ts`.
- **Design documents changed** and are synced to the claude.ai Project:
  - `GDD_V3.md`: decisions E8–E11, and notes in §2.2, §2.3, §3, §7.5 and §10.1
  - `BUILD_PLAN_V3.md`: Phase E2 built
  - `CANON.md`: the `v3e2` tag
  - `design/PLAYTEST_CHECKLIST.md` (not mirrored): the E2 section

---

## ⚠️ The v3e2 checklist: the playtest, multiple choice

Play a four-player game of one season at least once, and a two- or three-season game if you can.
The game-end screen's "The clock" panel has the times.

1. **How long did a four-player season take, by the clock?** *Under 25 min · 25–40 · 40–70 · Over 70
   · Didn't play four*
2. **Did the passing feel right?** *Yes, the laptop only moved when it had to · Too many passes · Too
   few (someone saw something they shouldn't) · Confusing about whose turn it was*
3. **Did anyone skip races, and which?** *Skipped the rest of race day most weekends · Skipped the
   odd race · Watched everything · Mixed: it depended on who had a runner*
4. **Did the game-end screen tell the story of the game?** *Yes · Mostly, but something was missing ·
   No, too much to read · Didn't finish a game*
5. **Now there's an off-season to reach: was the retirement a real decision?** *Yes, I weighed the
   offer against my dog · Easy, an old dog had to go · I always kept them all · Didn't reach one*

---

## Carried forward

- **CI on Node 20/22/24 is unchecked** from this session. See To push.
- **Merging each human's door into their market sitting would halve the passes** (Read this first 1).
  It is a rules call: Explore would resolve interleaved with the Market, so one stable's sabotage or
  gossip could land after another has shopped.
- **The long game widens**: out at week 8 of a 5-season game's last season is 48.8%. With the
  0.6–0.8% poorer-than-they-began row, it waits for the playtest (Jesse's call). The catch-up question
  from E1 stands.
- **Bets on the last weekend of a season are never shown to their owner** at a table: the results are
  public and the next private screen is the off-season, which does show them. At the game's end there
  is no next private screen, so a table's last-weekend slips are only in each stable's betting total.
  This is small, but it is a gap.
- **Hard 49.9%**, not re-measured and not tuned.
- **§7.5's split view** is still open. The clock's race-day figure is the evidence for it.
