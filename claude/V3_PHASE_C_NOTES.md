# V3 Phase C build notes — running styles (23 September 2026)

**Status: Phase C complete, tagged `v3c`.** Eleven commits on `main` after `01c386c`, which is where
GitHub's `main` is — checked with `git ls-remote origin` before these notes were written, not
assumed. **Not pushed.** The bundle and the commands are at the end; it is a plain fast-forward.

Before building, two questions went to Jesse and both came back as recommended:

- **Fix the deal in this phase** — deal each dog to an equal *rating*, keeping the shape difference
  (decision C1). Landed in the same commit as §5.5's one-of-each-style deal.
- **Hard's head-to-head: yes, as a measurement** — give Hard the field-shape read and report what it
  is worth. ⚠️ It was not built, because the contest rule was cut and left nothing in the field to
  read. The measurement is below (C11).

The golden snapshot changed **seven times — six moves and one step back** (the contest rule's cut
returned it to move 1's hash exactly), each in a commit whose message says so and why; four commits
say in their message that it did **not** move.

| | | golden |
|---|---|---|
| `fbf862e` | Add the style and contest rows to the spreadsheet | unmoved |
| `9c772c8` | **Deal one of each style at an equal rating; styles on the pace curve (items 1, 2, 4, 5 + C1)** | **move 1** |
| `67aa702` | **Add the contest rule, alone (item 3)** | **move 2** |
| `d26e01b` | **Cut the contest rule — the kill switch read +0.7** | **back to move 1** |
| `4cc36bb` | **The fade in metres (item 9, A7), and the style curve re-balanced under it** | **move 3** |
| `30e124c` | **Eight traits, not sixteen (item 10)** | **move 4** |
| `6effc69` | **The bookie prices a public style on the trip (item 8)** | **move 5** |
| `b62204a` | Race Office board, commentary, results (items 6, 7) | unmoved |
| `75696f1` | Harness `--styles` (item 11) | unmoved |
| `f31058d` | **Refit `oddsScale` to 18.75 (C7) — the harness found an overlay** | **move 6** |
| *(this one)* | GDD_V3's C1–C11 rows, BUILD_PLAN_V3 and CANON notes, the prompt and these notes | — |

| | `stateHash` |
|---|---|
| `v3b` | `309daf58…` |
| styles and the deal | `01141983…` |
| + the contest rule | `1daac003…` |
| contest rule cut | `01141983…` (identical to move 1) |
| + the fade in metres | `0a3f7a69…` |
| + eight traits | `3808f2f5…` |
| + the book's style edge | `1ffc5090…` |
| + `oddsScale` 18.75 (`v3c`) | `31f93a85…` |

`npm test` is **26 green** at `v3c` — Phase B's 23 plus three added tests (two in
`properties.test.ts`, one in `determinism.test.ts`). **No existing assertion was edited**; the one
existing line touched in either file is a name added to `properties.test.ts`' import list.
`race.test.ts` needed nothing, because `Runner.style` is optional and a runner without one runs the
stalker's baseline curve. All eleven commits are signed.

---

## ⚠️ Read this first: five things the record should know

1. **The contest rule is cut.** V14's kill switch, applied as written: built alone, measured at
   **+0.7 points** against a 4-point floor, swept, deleted at the next commit. Everything that depends
   on it — §5.6's field-shape overlay, the "field worth reading" half of §7.3, Hard's field read — is
   thinner than the GDD imagined, and that is the finding of this phase more than anything the
   acceptance table says. Details under Miss 1.
2. **§5.1's style estimates were not a redistribution.** At ±0.12 and ×0.8 a closer won **24.7%** of
   eight-dog fields and a front-runner **4.7%**. The curve was fixed before anything else was
   measured, then fixed again after A7 moved the ground under it (C2).
3. **`oddsScale` is 18.75 now, not 15.5, and BUILD_PLAN_V3 §2.3 listed 15.5 as kept whole** — so this
   needs Jesse's confirmation. A7 changed the race model the book is calibrated against; at 15.5 the
   book in real fields left **+9.8% a Bone on every stable dog** and a house margin of 4% instead of
   15%. D52's own criterion (no accidental overlay) says move it; D52's instrument (one dog against
   seven 50s) said stay. The instrument was the thing that was wrong (C7).
4. **GDD_V3 §5.6 says the book prices "rating, fitness, form and style". It has only ever priced the
   rating**, and §1.1 says "ratings and styles". Built: rating plus public style on the trip. Fitness
   and form are not priced, and that is a GDD question (§14 Q9), not a quiet addition (C6).
5. **A7 made the races more processional.** The median winning margin went from **7.3 m to 10.6 m**
   and photo finishes from 2.2% to 1.8% of races. Nothing measures this against a target, which is
   why it is at the top rather than buried (§14 Q11).

---

## The acceptance table

`BUILD_PLAN_V3` Phase C, every row. `--styles` rows are 6,000 races a cell for the synthetic ones and
200 all-Normal seasons (6,000 races) for the ones read off the game.

| Measure | Target | Read | |
|---|---|---|---|
| Closer's win rate, 1 front-runner in the field vs 3 | ≥ 4 points better (kill switch) | **+0.7** with the rule (12.9 → 13.6); **−0.3** with it cut (13.1 → 12.8) | ⚠️ **MISSED → rule CUT**, as V14 requires |
| Style expression's share of race outcome variance | below fitness's, above form's | fitness **2.6%**, expression **1.6%**, form **1.0%** | **MET** |
| Backing the lone closer blind, return per Bone | negative | **−0.172** (914 bets); in a field of 3+ front-runners −0.193 | **MET** — see C7: at 15.5 it read +0.012 |
| Stat leverage, +10 from a balanced rating-50 dog at 480 m | speed > accel > stamina, all 14–26% | **24.5 / 18.3 / 16.7** | **MET** (A7) |
| Lead changes per race, mean | ≥ 1.0 | **2.66** | **MET** |
| A player can name a dog's style after watching one of its races | 🎲 yes | built three ways (commentary, "New on the card", the dog card); screenshotted; **needs you** | **OPEN** |
| `npm test` green, snapshot moved in named commits only | ✅ | 26 green; 6 moves and 1 step back, each named; 4 commits name that it did not | **MET** |

And the no-advantage check the prompt asked for first, printed by `--styles` row 1:

```
   trip           front-runner   stalker   closer     (12.5 is even)
   sprint 350          18.1      11.0      8.4
   standard 480        12.7      12.4     12.4
   staying 600          6.5      11.9     19.1
   tight 480           12.9      12.4     12.2
   the calendar        12.9      12.0     12.6     weighted 4 / 11 / 3 by trip
```

No style wins systematically across the calendar (0.9 points apart). What is left is the trip, on
purpose — §12's "a long straight favours a closer", now measured.

### The rows that carry over

800 all-Normal seasons unless the row says otherwise (`--seasons 800`, 23.1 s).

| | Target | `v3b` | `v3c` | |
|---|---|---|---|---|
| Race calibration, 65 vs seven 50s | 45–60% | 56.6% | **49.5%** | **MET** — best-fit `oddsScale` 18.75 |
| Races entered per weekend | 1.8–2.4 of 3 | 2.02 | **2.02** | **MET** |
| Races per dog | 5–7 | 6.74 | **6.75** | **MET** |
| Mean end worth, all-Normal | 25–40k | 40,242 | **39,143** | **MET** — back inside, see below |
| Fitness at declaration | 60–80 | 69.3 | **68.6** | **MET** |
| …under 60 | 10–25% | 24.8% | **26.2%** | ⚠️ **MISSED by 1.2** |
| Food as a share of gross | 20–35% | 28.9% | **31.0%** | **MET** |
| Crossover week | 4–7 | 4.3 | **4.3** | **MET** |
| p99 trading leg | < 40% of mean worth | 13.5% | **13.7%** (5,380) | **MET** |
| Empty hold at the jump | < 5% | 0.1% | **0.2%** | **MET** |
| Ambrosia on one shelf | ≤ 8 | 5.5 | **5.5** | **MET** |
| Decisions per weekend (`hub-clicks`) | ≤ 10 | 10.5 | **10.6** (6.6 decisions, 4.0 navigation) | ⚠️ **MISSED by 0.6** |

**Which way item 9 moved mean end worth:** down. As a block, commit by commit:

| after | mean end worth | p90/p10 | betting | under 60 |
|---|---|---|---|---|
| `v3b` | 40,242 | 2.31× | −1,258 | 24.8% |
| styles + the deal | 39,950 | 1.86× | −1,670 | 26.0% |
| + contest rule (then cut) | 40,154 | 1.91× | — | 26.0% |
| + fade in metres (A7) | **39,209** | 1.89× | −1,762 | 25.9% |
| + eight traits | 38,139 | 1.90× | −1,811 | 26.5% |
| + book's style edge | 38,249 | 1.89× | −1,800 | 26.0% |
| + `oddsScale` 18.75 | **39,143** | 1.87× | **−1,193** | 26.2% |

A7 took 741 off; the trait trim took 1,070 (the cut traits were mostly bonuses — +5 fitness a week,
+3% on a sprint or a staying trip); the refit gave 894 back, all of it in betting, because a book that
over-rated favourites was taking the AI's favourite bets at bad prices.

**Nothing was tuned toward a row.** The two carried misses are reported and left alone:

- **Under 60 at declaration, 26.2%** — moved at the deal commit (24.8 → 26.0) and not since. Equal
  dogs are entered more evenly, so all three race more of the time. Race cost 20 / rest 30 is the dial,
  and it is Phase A's number.
- **`hub-clicks` 10.6** — the Race Office board is read, not pressed, and the walk does not use it. It
  is 0.1 over `v3b`, from the AI's week shifting under the new book. §7.5's split view is still the
  cheapest two presses in the game.

---

## The diagnostics, reported whatever they said

| | `v3b` | `v3c` | |
|---|---|---|---|
| **`autoplan%`** (`--autoplan --seasons 200`) | 30.1% | **27.4%** | moved 2.7 points |
| …entries alone | 30.2% | **27.4%** | moved 2.8 points |
| …states alone | 95.0% | **99.2%** | ⚠️ *more* automatic |
| apLoss | −268 ± 413 | **−54 ± 366** | inside two standard errors, as before |
| **p90/p10**, all-Normal | 2.31× | **1.87×** | narrower — the deal |
| p90/p10, 3 Hard v 3 Normal (400 seasons) | 3.6× / 2.2× | **3.24× / 1.95×** (table 2.47×) | |
| **Hard beats Normal** | 47.5% | **51.5%** | band 63–68% |

**The headline, said plainly: the styles moved the card a little and Race-or-Rest not at all.** The
entries row fell from 30.2% to 27.4% — styles plus a book that prices them on the trip made *which
dog goes where* a decision slightly more often, and that is the direction the phase wanted. But
2.8 points is small, and the states row went the other way, to **99.2%**: whether a dog races is now
almost exactly "is it fit?". The prompt's test — *if the entries row moves and the states row does
not, styles made the card a decision and Race-or-Rest is still automatic* — is met in the least
flattering way.

The honest cause is C3. Without the contest rule, a style's value depends on **the trip**, which is
the same for all three races of a weekend, not on **the field**, which is what differs between them.
So a style changes whether a dog is worth running *this week* a little (a closer on a sprint is worth
three or four rating points less), and changes which *race* it goes in hardly at all. §7.3's board
was built to make the second question hard. It can only do that if the shape of a field matters, and
at `v3c` it does not.

**The spread narrowed, and it should have.** 2.31× → 1.86× landed at the deal commit and stayed. The
deal had been handing out a median 16 rating points of head start; now it hands out none. Between
different agents the spread is still wide (Hard 3.2×, Normal 2.0×), which is where Phase B said it
would be.

**Hard gained four points of head-to-head on changes every agent got** — mostly the refit (Hard's
bets are sized by edge and a mis-priced book was costing it more than Normal). It has no new
behaviour in this phase.

---

## Miss 1 — the kill switch, and why the contest rule cannot reach it as written

A rating-50 closer against seven rating-50 dogs, *k* front-runners and the rest stalkers, 480 m,
6,000 races a cell:

```
                                        1 FR    2 FR    3 FR    gap (3 v 1)
  rule off                              12.6    12.6    13.1    +0.5
  rule on, GDD values (2 m, +3%, 0.05)  12.9    12.9    13.6    +0.7
  2 m, ×3 the fade cost                 13.6    14.1    14.8    +1.2
  2 m, ×6 the fade cost                 14.2    15.3    14.9    +0.7
  4 m, ×3                               15.1    14.9    14.9    −0.2
  4 m, ×6                               15.6    16.7    16.6    +1.0
  "another front-runner" only, 2 m, ×3  13.1    13.2    14.4    +1.3
  "another front-runner" only, 4 m, ×6  13.1    14.4    16.7    +3.6
```

Nothing in the sweep reaches 4, and the GDD's own values read 0.7. **Cut, as V14 says, rather than
tuned.** The code is in the history at `67aa702`.

The sweep says why, and it is worth more than the number:

- **A burned front-runner's wins do not go to the closer. They go to everybody behind it.** In a field
  of eight, a closer collects roughly a fifth of what three front-runners lose; the four stalkers take
  the rest. For the closer's win rate to move 4 points, the front-runners would have to lose about
  twenty between them.
- **"Another dog within 2 m at the head" burns a lone front-runner too** — on the stalkers that sit on
  its shoulder. So one front-runner and three are both punished, and the gap between them, which is
  what the row measures, barely opens. Only the "another *front-runner*" reading separates them, and
  it needs six times the cost at twice the distance to get near.

So **a rule meant to pay closers against a crowded front has to be about closers** — or the kill
switch's floor is the wrong number for an eight-dog field. That is GDD_V3 §14 Q10, written as a
question. It is not this phase's to answer.

## Miss 2 — the book, twice

**First, what the book prices (C6).** A public style, on the trip, in nine cells, fitted by `--styles`
from each style's win rate in equal fields: front-runner +4 / 0 / −6, stalker −1 / 0 / 0, closer
−4 / 0 / +4 (sprint / standard / staying). A style the table has not seen is priced at nothing — the
book knows exactly what the table knows. `RaceEntry.bookRating` records the rating the odds were
struck on, so an agent re-pricing a posted field uses the book's ruler. It does **not** see the field,
which was §5.6's point — and with C3 there is almost nothing in the field to see: the lone closer
in a field of three or more front-runners returns −19% a Bone.

**Second, the scale it prices on (C7).** `--styles` row 5 was built to read the field-shape overlay,
and it found a bigger one first:

```
  a Bone a runner, to win, at the posted price   v3b (15.5)   before (15.5)   after (18.75)
  every runner — the house margin                  −14.2%         −4.2%          −12.2%
  every stable dog                                  −5.7%         +9.8%           +0.2%
  the lone closer                                     —           +1.2%          −17.2%
```

At 15.5 **every stable dog was worth backing blind**. That is A7: fades are gentler at 480 m, so the
better dog wins more of the time than the book's curve says (a rating-65 dog wins 49.5%; the book said
57%), and the mid-priced runners — which is where stable dogs usually sit against locals — were
under-priced. D52 settled 15.5 on the rule *never leave an overlay by accident*, measured on one dog
against seven 50s; on that probe 15.5 still looks best (largest overlay 0.06 points against 2.27 at
18.75). **The probe stopped representing the game; the rule did not stop applying.** 18.75 is the
least-squares fit, puts the house margin back near the 15% the rules charge, and leaves +0.2% on a
stable dog — which is D1's deliberate edge, a fed dog being quietly better than its rating.
`--calibrate` now says the real-field reading is `--styles` row 5.

⚠️ **This is Jesse's call to confirm**, because BUILD_PLAN_V3 §2.3 listed 15.5 as kept whole. If it
goes back, the book leaves money on every stable dog.

---

## The build, item by item

### Items 1, 2, 4, 5 and C1 — styles, the expression, the reveal, the deal (`9c772c8`)

- **A style is a row** in `content/styles.ts` — early top-speed multiplier, fade shift, fade penalty
  multiplier, and (since `6effc69`) the book's edge per trip. `simulateRace` reads the cells and never
  asks which style it is looking at.
- **"Early" is the first third of the trip** (`styleEarlyFraction`, a sheet cell). The early
  multiplier applies there; the fade shift moves the fade point; the multiplier scales the fade.
- **The expression, U(0.30, 1.30), is drawn in a third per-runner loop after the break and before the
  first tick** (C9) — eight draws a race, always, since short fields are filled with locals. It scales
  the style's shape: `1 + (mult − 1) × e` and `shift × e`. It never touches the dog's speed.
- **The curve, measured (C2).** The GDD's ±0.12 / ×0.8 gave the closer 24.7% and the front-runner
  4.7%. A grid over the shifts settled at ×1.08 / −0.06 and ×0.94 / +0.05 / ×1.0 on the fraction
  model; A7 then moved it again (below). The closer's ×0.8 went: its later fade carries "comes home
  hardest" on its own, and the softer fade on top was worth ten points of win rate.
- **Hidden, then public (C4): a boolean.** Racing is watched by everybody at once, so a set of player
  ids would only ever be empty or full. The owner does not know either — §5.5's elimination only
  makes sense if the owner is finding out by racing too — and since the deal is public, the engine does
  the elimination for the whole table and logs it. **Locals are public from the start** (the form
  guide), or the §7.3 board would be half question marks. ⚠️ The elimination assumes a stable holds the
  three dogs it was dealt; Phase D's acquisition breaks that, and `revealStyles` says so.
- **The deal (C1).** Every dealt dog rates exactly `startDogRating` 50. Speed and accel are drawn
  within ±15 of it; stamina solves for the rating; a deterministic walk fixes any rounding, with no
  further draws. The stat *total* varies instead. Styles are dealt one of each, shuffled, so the list
  order gives nothing away. The old budget row and the unread "Average starting dog rating" (43) left
  the sheet.
- **Stored state:** `STATE_VERSION` 6 → 7, `SAVE_VERSION` 5 → 6. **Verified, not asserted:** a
  v3b-shaped save blob reads back as `null` (the title screen), and three v3b action logs replayed at
  `v3c` all stopped within ten actions ("It is not p4's turn" — the new deal moves the rng and so the
  turn order). That is an accident of the stream; the save version is the guarantee.

### Item 3 — the contest rule, and its cut (`67aa702`, `d26e01b`)

Built as §5.3 reads: positions at the start of each tick, a front-runner inside the first third and at
the head, any dog within 2 m of it at the head, both +3%, both paying 0.05 of fade point for a whole
first third contested, pro rata to the ground covered while contesting. A `duel` event, and
`RunNote.contested`. Measured, swept, cut — Miss 1. The revert is exact: the snapshot came back to
`01141983…`, and the contest rows and the three "contests the lead" flags left the sheet with the
reason written into the row writer.

### Item 9 — the fade in metres (`4cc36bb`, C5)

`fadeStart = 600 × (0.45 + 0.45 × stamina/100 + style shift)` metres from the boxes; the penalty then
grows linearly to `raceFadePenalty` (0.50) over **250 m** and holds to the line. Two new sheet rows say
what trip the old constants are measured on and how fast a tiring dog slows; the three old constants
keep their values and meanings.

⚠️ **The prompt said the stat-leverage row "should order itself". It did not.** Converted at a 480 m
reference with the old fade rate, stamina at 480 m went *up*, to 26.9% — a fixed rate per metre
charges a longer fade more than the old normalised one did. The sweep over reference 520–600 m and fade
length 250–400 m found 600 / 250 met the row with the widest margin and gave stamina the steepest climb
with the trip:

```
  +10 from a balanced rating-50 dog (win %)     speed   accel   stamina
  sprint 350      v3b 22.1 / 17.8 / 17.8   →    22.4    18.9    12.7
  standard 480    v3b 22.4 / 16.9 / 17.6   →    24.5    18.3    16.7    ← the row: MET
  staying 600     v3b 22.2 / 15.9 / 17.8   →    23.6    16.9    22.0
  tight 480       v3b 22.7 / 18.0 / 17.6   →    24.1    19.8    16.0
```

A stamina-50 dog now tires 405 m out: a sprint barely reaches it, a staying trip runs 195 m past.
The style curve had to survive this and did not — under metres the old shifts gave the front-runner
14.2% at 480 m and the closer 10.0 — so it was re-balanced in the same commit to ×1.08 / −0.07 and
×0.97 / +0.06.

**The cost (§14 Q11):** the old fade dragged the whole field back to half speed at the line, which
bunched it. Median winning margin 7.3 m → 10.6 m, photo finishes 2.2% → 1.8% of races, lead changes
2.36 → 2.66. The races look strung out in the screenshots too.

### Item 10 — eight traits (`30e124c`, C8)

Railer, Wide runner, Mudlark, Fragile, Iron, Glutton, Showboat, Bad blood. **The prompt's eleven
readers were eleven** — `simulateRace` ×5, `raceDay`'s form swing, `endTurn` ×2, `state.ts`'s rest
bonus, the web selector mirroring it, and `createLocalDog`'s `nervy` argument — plus four more it did
not count: Lagrange Lows' `localsNervy` special and the three screens that described it. Lagrange Lows
has no special rule now; its tight bends and food map stay. The Race Office's "Sprinters and fast
starters" / "Stayers and stamina" lines describe styles and stamina instead. A final grep for every
id and name finds only the two comments recording their going.

### Item 8 — the bookie (`6effc69`, `f31058d`, C6, C7)

Miss 2. `publicStyle()` in `content/styles.ts` is the one definition of "what the table knows", read
by the book, both AIs, and every screen. `determinism.test.ts` gained a test proving every integer in
the book's widened input domain (rating 5–99 plus the edges) sits thousands of ULPs from a rounding
boundary, and it passes at 18.75 as at 15.5.

### Items 6 and 7 — the screens (`b62204a`)

- **The Race Office board (C10).** Each race lists the other stables **in turn order** — runner,
  rating and style once public, or "declares after you" — under a line that reads the field so far:
  *"In so far: 3 stalkers and a closer. This trip suits front-runners."* v2 hid a human's picks until
  the lock; V16 reverses that on purpose, and turn order already stops anybody seeing a pick not yet
  made. Your own dogs' styles are in the week ledger and the runner picker.
- **Commentary** names the style and the day, from `RaceResult.runs` and the tick log: a front-runner
  that burned out, one left alone in front, one that went from the front and held, a flat day, a
  stalker that pounced, a closer that got there, a closer that ran out of track. At most three a race.
  `race-view-check` tallies them — five seeds, 150 races: burnedOut 44, aloneInFront 26, fromTheFront
  40, flatDay 36, stalked 52, closerGot 17, closerShort 17.
- ⚠️ **A dog's first race names its style out loud only 19% of the time** (14 of 75). There are eight
  dogs and three style calls a race, and a mid-pack dog has no story to call. So the reveal is also
  written down: the Results screen gains a **"Ran as"** column and a **"New on the card"** panel naming
  every style the weekend made public, and the dog card carries it from then on. §5.4's "one race is
  enough" rests on those more than on the commentary.
- The Bookie's field table has a Style column (what the table knew at the lock).

**Looked at, not only read.** The build was served with `vite preview` and driven with Playwright
(`?seed=4242&players=h,normal,normal,normal,hard,hard`) through six weeks: the Race Office mid-way
through declarations at week 6 (last in the turn order, the board full), a race with "The front-runner
Deluxe Slobber is coming back to them, and coming back fast" on the bar, the Bookie and the Results.
That found two things a code read had not: the week ledger did not show your own dogs' styles, and the
"New on the card" panel rendered flush to its edge. Both fixed before the commit.

### Item 11 — the harness (`75696f1`)

`npm run harness -- --styles --seasons 200` prints six numbered rows: the no-advantage check by trip
and across the calendar, the book's edges fitted beside the sheet, the kill switch (labelled cut), the
variance decomposition, the field-shape returns beside two baselines, and the watching rows. The
variance decomposition re-runs 2,000 real races on the same rng with one source pinned — fitness at the
field mean, expression at 0.8, form at 0 — and prints the share of finishing-time variance that moves.
Pinning the expression needed `Runner.expression`, a probe-only field that still makes the draw, so it
cannot shift the stream; nothing in the game sets it.

⚠️ **Phase B's cautionary tale, re-told:** row 5 first read *+0.012 on the lone closer — MISSED* and
the obvious reading was "field-shape overlay, the book needs to see more". It was not: every stable
dog read +0.098. The row is printed against that baseline now, and the thing it found was C7.

---

## Verification

| | |
|---|---|
| fresh clone of `01c386c` before anything was touched | 23 green, lint clean, 20-season harness ran, `season-check` passed, snapshot taken |
| `npm test` | **26 green** at `v3c`; golden moved 6× and back once, each named |
| `npm run lint` | clean; no `exp`/`log`/`pow` in `packages/engine/src` |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seeds + the toggle variant, every one to week 10, every log replays; 103 declarations, 94 Race/Rest changes, 64 trades, 228 bets, 14 hungry dog-weeks, 5 of 6 goods |
| `race-view-check.ts` | 150 races, every one replay-identical, 4 photo finishes, 10.6 calls each; the style-call tally above |
| `hub-clicks.ts` | 10.6 a weekend (6.6 decisions, 4.0 navigation) |
| `--seasons 800` | 23.1 s |
| `--calibrate` | 65 v seven 50s **49.5%**; best-fit and sheet `oddsScale` 18.75 |
| `--stats` | 24.5 / 18.3 / 16.7 at 480 m |
| `--autoplan --seasons 200` | 27.4%; entries 27.4%, states 99.2% |
| `--styles --seasons 200` | the six rows above |
| 3 Hard v 3 Normal, 400 seasons | Hard beats Normal 51.5% |
| a v3b save, read at v3c | `null` — the title screen |
| three v3b action logs, replayed at v3c | all stop within ten actions |
| screenshots | Race Office (weeks 1 and 6), a race, the Bookie, the Results |

---

## To push

Built in a clone in the cloud, as every phase since v2 D, and arriving as **`phase-v3c.bundle`**,
written **into your repo folder, next to `package.json`**. Your working tree was not touched: the
only commands run in it from here were `git log` and `git rev-parse` (nothing that writes the index,
so no stale `index.lock` this time), and `git bundle verify` passes against it.

⚠️ **GitHub's `main` is at `01c386c`** — `git ls-remote origin`, run before these notes were written
— and your local `main` is at `01c386c` too. The bundle fast-forwards from exactly that. It was round-
trip tested: a fresh clone of `main` from GitHub, fetch the bundle, `git merge --ff-only`, `npm ci`,
`npm test` 26 green.

```powershell
git fetch origin                            # origin/main should be 01c386c
git status                                  # expect nothing modified
git log --oneline -1                        # expect 01c386c locally too
git fetch phase-v3c.bundle "refs/heads/main:refs/heads/v3c-work" "refs/tags/v3c:refs/tags/v3c"
git merge --ff-only v3c-work
git branch -d v3c-work
git log --oneline -12                       # eleven new commits on top of 01c386c

npm test                                    # 26 green
npm run build
npm run harness -- --styles --seasons 200   # the Phase C rows
npm run dev                                 # and go and watch a season — see below

git push origin main
git push origin v3c
del phase-v3c.bundle
```

If `git log --oneline -1` does not say `01c386c`, stop and tell me what it does say rather than
resetting anything. **`package-lock.json` is untouched**, so no reinstall.

- **`design/space_dog_racing_economy.xlsx` changed**: rows added, updated and removed by the new
  `packages/engine/scripts/add-phase-c-rows.ts` (a copy of Phase B's upserter; the workbook re-checked
  for formulas and styles first). `balance.json` regenerated with `npm run balance`, never hand-edited.
  `oddsScale` lives in `balance.extras.json`, which is where it has always lived.
- **A `v3b` save will not load** — it lands on the title screen.
- ⚠️ **Design documents changed**: `GDD_V3.md` (decision rows C1–C11, inline notes in §4.5, §5.1,
  §5.3, §5.5, §5.6, §7.2 and §11, questions 9–11 in §14), `BUILD_PLAN_V3.md` (Phase C's status, §2.3's
  `oddsScale` flag) and `CANON.md`. The claude.ai Project mirrors are **now two phases behind**; ask a
  Cowork session to *sync the project docs from the repo*.
- The `v3a` tag is still off `main` (Phase B, correction 2), unchanged.

---

## ⚠️ What to play for — the v3c checklist

**Phase B was the first build where the economy is a game; Phase C is the first where a race is
meant to be a story.** Play a season with the race view on — 1× for the races you are in — and if you
can, a second with another person at the table.

1. **Could you tell why a dog won?** Not from the result line — from watching. Did you ever see a
   front-runner go off too fast and stop, and say so before the commentary did? If a player cannot,
   §5's case is unproven whatever the harness says.
2. **Could you name a dog's style after one of its races?** The Results screen now tells you ("New on
   the card"), so the real question is: *did you already know before it told you?* If the answer is
   "only because the screen said so", the styles are a label, not something you watched.
3. **Did the field ever change your mind at the Race Office?** Go last in the turn order (travel light)
   and read the board. With the contest rule cut, a crowded front is *not* a reason to enter your
   closer — the harness says it is worth nothing. Did the trip ("this trip suits front-runners") change
   which dog you ran, or where? That is the decision this build actually has.
4. **Did you miss the contest rule?** It is the one thing the GDD promised and this build does not
   have. Did three front-runners in one race ever look like a story that should have ended differently?
5. **Are the races too strung out?** Median winning margin is 10.6 m, photo finishes one race in
   fifty-five (§14 Q11). Watch a staying trip and a sprint. Is a 12-metre win a race, or a procession?
6. **Are thirty races a season still worth watching?** §7.5 lets you skip the ones you are not in. Did
   you want to?
7. **The book, with money on it.** Back your own stable dogs blind for two weeks and watch your cash.
   At `oddsScale` 18.75 that should lose slowly; at 15.5 it made money (C7). If it still feels like
   free money, tell me.
8. **And the standing question**: did any week present a choice you had to think about?

---

## Carried forward

- **⚠️ C3 — there is no field-shape rule, and §7.3's board has little to read.** A rule that paid
  closers against a crowded front would have to be about closers, or the kill switch's floor is the
  wrong number for eight-dog fields (§14 Q10). A GDD question before any Phase D code touches it.
- **⚠️ C7 — `oddsScale` 18.75 needs Jesse's confirmation**, and `--calibrate`'s probe is no longer
  D52's instrument on its own; `--styles` row 5 is the real-field reading.
- **⚠️ `autoplan%` 27.4%, states 99.2%.** The card moved a little; Race-or-Rest is now almost exactly
  "is it fit?". Phase D's events are the next thing that could make a week's plan less obvious.
- **§14 Q9 — should the book price fitness and form?** §5.6 says so; nothing ever did.
- **§14 Q11 — the races are more processional since A7.** 10.6 m median margin. If playtest agrees,
  the fade length (250 m) and the tick noise are the dials; the stat-leverage row is the guard.
- **Hard 51.5% against 63–68%.** No new Hard behaviour this phase (C11). Phase B's "exotic food in the
  cheap weeks" is still the obvious Hard market edge.
- **Under 60 at declaration 26.2%** (band 10–25%) and **`hub-clicks` 10.6** (≤ 10) — both reported,
  neither tuned.
- **`revealStyles`' elimination assumes a stable holds its dealt three.** Phase D's §9.2 acquisition
  breaks that; it is the function to revisit, and a dog acquired by event should arrive style-unknown
  (§5.4's "a second unknown").
- **Lagrange Lows has no special rule** since Nervy went (C8). Phase D's doors are where its character
  was meant to go anyway.
- **The row writer is `packages/engine/scripts/add-phase-c-rows.ts`.** Copy it for Phase D.
