# V3 Phase A build notes — the cull (17 September 2026)

**Status: Phase A complete, tagged `v3a`.** Seven commits on `main` after `c83debc`, which is where
GitHub already is. **Not pushed** — the bundle and the commands are at the end, and this time they are
a plain fast-forward.

The golden snapshot moved **three times**, each in a commit whose message says so and why. No commit
moved it as a side effect.

| | |
|---|---|
| `767f10e` | Add the v3 design documents: CANON, GDD_V3, BUILD_PLAN_V3 — *pushed last session* |
| `c83debc` | Mark v2's documents historical and point CLAUDE.md at CANON — *pushed last session* |
| `fe1f7ec` | **Execute §2.1: delete the four markets, the debt system and the crook's road — snapshot move 1** |
| `ee998f1` | **Fold Trap into Acceleration: three stats, 0.40 / 0.35 / 0.25 — snapshot move 2** |
| `9aff85f` | **Race or Rest, three purse tiers, ten weekends, an equal starting deal — snapshot move 3** |
| `adcf2c0` | Cut the harness down to v3 and add the three pace measures |
| `fc2855b` | Sweep the §2.1 residue out of `packages/` |
| `f1fdad3` | Reject unknown harness flags instead of running the default silently |
| *(this one)* | GDD_V3's A1–A7 decision rows, CANON, the corrected prompt and these notes |

⚠️ **The two design-document commits are the ones already on GitHub, not copies of them.** An earlier
draft of these notes had them re-created with new hashes and told you to `git reset --hard` back to
`v2e` — which would have thrown away commits you had already published, and is why your first push was
rejected. The phase is now replayed on top of `c83debc`, so the merge is an ordinary fast-forward and
nothing on GitHub is rewritten. The cost is that those two commits stay **unsigned**, because signing
them would mean force-pushing over published history to gain nothing. The seven Phase A commits are
all signed.

`npm test` is 22 green at every commit. **81 files changed, 3,341 insertions, 9,782 deletions** — the
first phase in this project's history where the second number is three times the first, which is what
a subtractive phase is supposed to look like.

---

## ⚠️ Read this first: four corrections to the record I made during this phase

The standing warning from Phase E was about producing *a number nobody can undo later*. I produced
four in this phase; three I caught myself and the fourth was caught by a rejected push. They are at
the top because a reader who trusts the earlier half of this session would be misled.

1. **The snapshot hashes in the first three commit messages were wrong when written.** They cited
   `594c5a55…` → `30b3d10e…` → `de9d2e38…`, none of which appears in
   `test/__snapshots__/golden.test.ts.snap` at any commit. The real chain is below. The messages were
   rewritten (the commits were unpushed, so only messages moved; every tree is byte-identical to
   before the rewrite, verified with `git diff`). **`V2_PHASE_E_NOTES.md` cites `594c5a55…` as `v2e`'s
   golden and that is also wrong** — `v2e`'s is `7970212b…`. I do not know where 594c5a55 came from.
2. **`--fix` had stopped existing and still printed a plausible-looking run.** The crook's road is
   deleted, so the flag fell through to a default 50-season harness — output that reads exactly like
   the mode's own if you are not looking for it. Unknown flags now throw.
3. **The `Card` column header in the galaxy map survived its cells**, with a `colSpan` one too wide
   under it. A cosmetic bug, but it is the same class of thing: the UI was describing a deleted
   system and nothing failed.
4. **⚠️ And one I did not catch until Jesse's push was rejected: I wrote merge instructions that told
   him to `git reset --hard` past two commits he had already pushed to GitHub.** An earlier draft of
   these notes re-created the two design-document commits with new hashes, on the assumption that
   `v3-design-docs.bundle` was still sitting unmerged in his folder. It was not — GitHub's `main` was
   already at `c83debc`. **The lesson is a small one and worth writing down: check `git ls-remote`
   before writing a handoff that asserts where somebody's branch is.** The phase is now replayed onto
   `c83debc` and fast-forwards from it.

The golden chain, verified against the file:

| | `stateHash` |
|---|---|
| `v2e` | `7970212b…` |
| after the §2.1 deletions | `838c19e2…` |
| after the Trap fold | `767994e0…` |
| after the rules changes (`v3a`) | `a784eed9…` |

---

## The acceptance table

`BUILD_PLAN_V3` Phase A, every row, at 800 all-Normal seasons unless the row says otherwise.

| Measure | Target | Read | |
|---|---|---|---|
| `npm test` green, golden snapshot moved in named commits only | ✅ | 22 green; moved 3×, each named | **MET** |
| `npm run lint` clean, no `any` in engine, no `exp`/`log`/`pow` | ✅ | clean; eslint enforces both | **MET** |
| A 10-week season completes headless with 6 AI stables | ✅ | 5 seeds + the toggle variant, every one to week 10 | **MET** |
| Stat leverage, +10 from a balanced rating-50 dog | speed > accel > stamina, all 14–26% | **22.4 / 16.9 / 17.6** — all in band, ordering out by 0.7 | ⚠️ **MISSED** |
| Race calibration (rating 65 vs seven 50s) | 45–60% | **56.6%** | **MET** |
| Races entered per weekend per stable | 1.8–2.4 of 3 | **2.02** | **MET** |
| Races per dog per season | 5–7 | **6.72** | **MET** |
| Mean end worth, all-Normal, one season | 25–40k | **39,417** | **MET** (at the top) |
| Decisions per weekend per player (`hub-clicks`) | ≤ 10 | **11.1** presses, of which 7.1 are decisions | ⚠️ **MISSED by 1.1** |
| Nothing in §2.1 remains referenced anywhere in `packages/` | ✅ | swept; see `fc2855b` for what it found | **MET** |

**⚠️ The tunable row met its band first time, so the Race fitness cost was not moved.** Phase A's
instruction was that if `races entered per weekend` missed 1.8–2.4 the Race cost moves and nothing
else does. It reads **2.02**, dead centre. −20/+30 was called an estimate in the plan and it turns out
to be a good one. Nothing was tuned in this phase at all — no balance number was moved to reach an
acceptance row.

The two misses are both real and neither is fixable with a number. They are below.

---

## Miss 1 — the stat-leverage ordering, and why a rating weight is not a leverage

V9 folded Trap's rating weight into Acceleration: 0.30 / 0.25 / 0.25 / 0.20 over four stats became
**0.40 / 0.35 / 0.25** over three. The acceptance row asks for speed > accel > stamina on the standard
480 m trip, all inside 14–26%.

```
  track        |    none    | +10 speed   +10 accel   +10 stam
  sprint 350   |  11.6/35.6 |  22.1/53.3   17.8/45.4   17.8/47.4
  standard 480 |  11.8/35.3 |  22.4/53.0   16.9/44.5   17.6/45.9
  staying 600  |  11.9/35.5 |  22.2/53.9   15.9/42.3   17.8/46.2
  tight 480    |  11.5/35.7 |  22.7/53.5   18.0/45.6   17.6/46.3
```

All three are in band. The ordering fails at 480 m by **0.7 points**, and the reason is worth stating
precisely, because "raise `ratingWeightAccel`" is the obvious fix and it is the wrong one.

**A rating weight says what a stat is worth to the *number on the dog's card*. A leverage says what it
is worth to *winning a race*.** These are different quantities computed by different code, and folding
one does not fold the other. Trap's leverage lived in the trap draw and in `bendCraft`; both now read
accel, so the fold *did* work — you can see it in the per-track rows, which are the honest evidence:

- **accel peaks where it should.** 17.8 on the sprint and **18.0 on the tight bends** — the break and
  the line — and falls to 15.9 on the staying trip, where neither matters much.
- **stamina is flat at every distance**: 17.6, 17.6, 17.8, 17.8. That flatness, not any weakness in
  accel, is what puts it ahead at 480 m.

And the flatness has a named cause in the race model: `fadeStart` is a *fraction* of the distance, so
the fade window is proportionally identical at 350 m and 600 m. Stamina therefore cannot be worth more
on a staying trip than on a sprint, which is both wrong as a model and the whole of this miss.

**Nothing was moved.** Raising accel's rating weight would reach the row by making the *card* lie about
the dog rather than by making the stat matter more, and would move `dogValue`, the bookie's prices, the
AI's whole assignment search and every dog in the golden season, to fix a 0.7-point ordering. The fix
is to make `fadeStart` an absolute distance so a staying trip actually taxes stamina — a race-model
change, and out of a subtractive phase's scope. **Jesse's call (A7): widen the row, or take the model
change in Phase C when running styles are being built into the same code.**

## Miss 2 — the click budget, 11.1 against ≤ 10

GDD_V3 §10.1 cut the budget from v2's 14.5 to 10 and named `hub-clicks.ts` as the instrument.

| | weekend | 10-week season |
|---|---|---|
| before the hub told you what was in each venue | 13.0 | 130 |
| after | **11.1** | 111 |

§2.1 removed three of the hub player's decisions outright — hiring, buying a dog, buying gear — and
that is most of the 14.1 → 11.1. What is left is **8 fixed presses and 3.1 venue visits**, and the
eight break down as: three declarations, one "plan the week", then **four navigation presses** — head
to the track, run the races, back to the planet, end turn.

**The headline number stays the full press count.** It would be easy to report 7.1 by calling
navigation "not a decision" and claim the row, and that is redefining the instrument inside the phase
whose job is to measure it — the exact move the standing instruction forbids. The split is now printed
beside it, because presses are how long the evening takes and decisions are how much of it was a
choice, and §1 asks both.

Where the remaining 1.1 actually is, for whoever wants it:

- **The four navigation presses are the cheapest target and none of them is a decision.** §7.5's open
  question 5 already asks whether the three races should run in split view; a single "run the
  weekend" that plays all three and lands on the results would take two presses out at once.
- **3.1 venue visits on a planet with four fewer venues** is the surprise. The Market, the Bar and
  the Bookie are worth a walk most weeks, which is the hub working as designed rather than a problem.
- **Phase D's Explore adds one back**, so this row gets worse before it gets better.

---

## What the re-baseline says, and the standing instruction it satisfies

> *Every number below the race level was fitted to 13 weeks, four stats and a dog market, so treat all
> of them as unverified rather than inherited.*

Taken literally: every row below is a fresh measurement against v3's rules, and `v2e`'s column is
there only to show the size of the move, never as a target.

`npm run harness -- --seasons 800`, all Normal:

| | `v2e` | `v3a` | |
|---|---|---|---|
| mean end worth | 32,543 | **39,417** | band 25–40k, **MET** |
| p10 / p50 / p90 | 8,582 / 26,323 / 68,646 | **24,696 / 37,961 / 56,834** | see below |
| prize / trade / betting / costs | 33,632 / +1,893 / −849 / 24,119 | **19,448 / +1,598 / −1,190 / 3,762** | |
| prize share of gross | 78.2% | **78.2%** | target "falls toward 65%", unmoved |
| fitness at declaration | 71.5, 19.8% under 60 | **69.2, 25.0% under 60** | 60–80 and 10–25%, both **MET** |
| races per dog | 5.1 | **6.72** | band now 5–7, **MET** |
| races entered a weekend | 1.97 | **2.02** | band 1.8–2.4, **MET** |
| decisions a weekend (AI) | — | **5.06** | new measure |
| purse share to players | 53.8% | **48.3%** | ⚠️ down 5.5 points, see below |
| concentration, champion | 0.278 | **0.355** | target below 0.400, **MET** |
| decided by week | 6.7 | **5.9** | ⚠️ *earlier*, and the season is shorter |
| autoplan% | 8.9% | **30.8%** | target 15–30%, in band for the first time |
| hub-clicks | 14.1 | **11.1** | budget ≤ 10, missed |

**⚠️ The distribution collapsed inward, and that is the largest single effect of this phase.** The
p90/p10 spread went from **8.0× to 2.3×**. The floor more than doubled (8,582 → 24,696) and the
ceiling fell 17%. Read it against pillar 5 — *nobody is out before the end* — and it is the design
working exactly as intended: with no debt, no wages, no upkeep and no dog market, there is almost
nothing a stable can do to ruin itself and almost nothing it can do to compound a lead. Read it
against §1's *does anything memorable happen* and it is the phase's biggest open worry. **A 2.3×
spread across six stables is a game where the finishing order is mostly the racing luck.** Phases B
through E have to put variance back through the *market* and the *events*, and this number is the one
to watch while they do.

**The season is decided earlier than v2's in a season three weeks shorter.** 5.9 of 10 against 6.7 of
13 — 59% of the way in against 52%. Compounding is not the cause any more (there is nothing to
compound into), so the candidate is the opposite: with a narrow spread, whoever gets ahead early is
hard to *catch* rather than hard to beat. Untested, and worth a probe in Phase B once the market can
move money late.

**Purse share to players fell to 48.3%.** The locals take more than they did, and the mechanism is
V15: with open entry, a stable declares its best dog into the Gold Cup and the locals at rating 55 win
their share of it. 48.3% is below v1's 54% and Phase A-of-v2's 52%. Not touched — the instruction was
explicitly not to compensate with the purses — but it is a real lever for Phase B, which is where the
purses can be sized against a market that is actually worth money.

**`autoplan%` is in band for the first time in the project's history, and it is not good news.** It
measures how often the naive plan and Normal's plan agree about the entries. 8.9% → **30.8%** means
the week has got *much* easier to play correctly, which is what deleting two thirds of the decisions
does. The `states alone` row is **95.6%** — Race or Rest is very nearly automatic. §7a.3's gloss
("above 40 the week makes itself") puts this within ten points of "there is no decision here". Phase
B's market is what has to earn that back.

`--calibrate`: a balanced 65 beats seven 50s **56.6%** — band 45–60, **MET**. Best fit `oddsScale`
**15.75** against 15.5 in the sheet, the same 0.25 gap as `v2e`, so D52 stands untouched: the design's
own criterion (never leave a standing overlay) picks 15.5.

`--lead`: leader **−0.42** ranks, trailer **+0.42** — betting is mean-reverting on rank, which is
§20 Q7's row, **MET**. Note every stable bets, so the "did not bet" column is empty and the split is
doing no work at this table.

`--stats`, `--hardAblation`: below.

---

## ⚠️ Hard is at 50.9% against a 63–68% band, and that is a consequence of the cull

`--hardAblation`, 600 seasons at the standing table:

| row | beats Normal | Hard mean | p10 | Normal mean |
|---|---|---|---|---|
| as built | **50.9%** | 44,842 | 19,703 | 39,553 |
| rates its dogs like Normal | 50.6% | 44,250 | 20,027 | 38,919 |
| one ruler: stats on both sides | 49.9% | 45,513 | 19,802 | 39,647 |
| **does not hold for a Major** | **47.1%** | 43,230 | 18,700 | 39,758 |
| never throws the cheap race | 51.0% | 45,025 | 19,885 | 39,440 |

Standard error about 2.0 points. **Only one of Hard's surviving decisions earns anything: holding a dog
back the week before a Major is worth 3.8 points.** Everything else is inside the noise.

Phase E's finding was "there is no bad decision left to remove, and 57.8% is what Hard is worth". Phase
A's is sharper and more uncomfortable: **the decisions that made Hard good were in §2.1.** Selling a
dog before the age tick was worth 1.9 points at `v2e` and there is no dog market. Spending down to its
reserve to own the best dog it could is gone with the same market. The staff arithmetic is gone. What
is left is a fitness threshold two points lower than Normal's and a bookie edge, and it beats Normal by
a coin toss plus one.

Two things follow, and they belong to later phases:

- **There is no Hard row in Phase A's acceptance table**, which is the plan being right: you cannot ask
  a phase that deletes the decisions to keep the agent that made them well.
- **A6 is the measurement that says where the difficulty has to come from.** Normal's and Hard's weekly
  rules now differ by a single number. Phase B's six-good market and Phase C's running styles are where
  a Hard stable can know something again — reading a field's styles, or a food's price band, is exactly
  the kind of thing a better player does better.

---

## The build, item by item

### 1. §2.1, executed by deletion

The four markets (dogs, staff, ship, gear), the debt system, the crook's road, championship points and
the purse, the dossier, the Scout's private finds, the Fixer, kennel slots, pups, fuel, upkeep, wages.
`grep`-swept afterwards rather than assumed, which is `fc2855b`; the sweep found the three
`add-phase-*-rows.ts` migration scripts still able to re-add deleted tunables to the sheet, the AI
still carrying `trainThroughCheapWeeks`, and four places where the UI was describing v2's rules to the
player.

**Two §2.1 deletions were missed by the first commit and caught by the second and third:**
`championshipPoints` / `championshipTable` (live code, deleted in `9aff85f`) and the whole
`trainThroughCheapWeeks` chain (deleted in `fc2855b`). Worth recording because both survived a commit
that claimed to be complete: a deletion phase needs the sweep as a separate step, not as a habit.

### 2–3. Three stats, Race or Rest

`Dog.trap` gone; weights 0.40 / 0.35 / 0.25; `bendCraft` and the trap-draw edge read accel.
`WeekState` is `'race' | 'rest'`. Race −20, Rest +30 before the age band. `trainOneWeek` became
`feedOneWeek` and now runs for **every** dog **every** week (V8), which is the change that left Train
with nothing to be.

### 4. Three purse tiers

Gold Cup / Silver Plate / Bronze Dash, open entry, one dog per stable per race, locals at 55 / 45 / 35
and fitness 75. **Each row carries its own purse and its own local rating** rather than reading a
shared tier table — decision **A2**, and a deliberate reversal of v2's D24. With the gates gone the
home team's standing is the only thing that makes the Gold Cup hard, so it belongs on the row that
describes the race.

It works: entries split **37.7% / 36.4% / 26.0%** across Bronze / Silver / Gold, and the Gold Cup gets
**3.14 entrants a race** against Bronze's 4.56. Nobody is stopping a stable entering the Gold Cup; the
locals are simply better there, and a quarter of entries go anyway. That is V15's whole design intent
in one table.

### 5. Ten weekends

Eight regular planets, the Major at week 5 (×2), the Grand Final at Collar Prime at week 10 (×3).
`drawCard` and `CalendarEntry.card` are gone; `thisWeeksCard()` takes no argument and returns the same
three races every weekend.

**⚠️ §2.1's arithmetic does not close, and this is decision A1 for Jesse.** It says "9 regular planets
… plus Collar Prime at week 10" and separately names "week 5's Major venue" — which is 11 weekends in a
10-week season. The build reads **8 + 1 + 1** from `balance.regularPlanets`, so if the intended answer
is 9 regular planets and a 9-week regular season, or a Major that is one of the nine, it is one sheet
row and no code.

### 6. Three dogs on an equal stat budget

Dealt at the start, ages 2–4, `startStatBudget` = 150 points split three ways at random. Kennel slots
gone.

**Decision A3, and it removes a piece of machinery rather than adding one.** v2 fitted each new dog
into a *rating band*, which is a weaker promise than V2 makes — two dogs inside 38–48 can be ten rating
points apart, and across three dogs a stable could start a class up on the table. With the weights
summing to 1, **150 points over three stats rates exactly 50 whatever the split**, so the budget
delivers the equal-strength guarantee and `fitRating` is not needed for starting dogs at all. What
varies between stables is the *shape* of a dog, never the total — which is also the shape Phase C
wants, because a running style is a redistribution of the same energy.

### 7. Age bands

Growth to age 2, decline from 5, rest recovery falling with age (30 / 25 / 20 / 20) and the injury
multiplier rising (1.0 / 1.3 / 1.6 / 2.0). Written as bands in one function rather than as a lookup
table, because §4.3 bands rather than enumerates and changing a band should be changing one line.

⚠️ **Open question 4 in GDD_V3 asks whether an injury is too punishing with three dogs, and Phase A
cannot answer it** — the harness has no instrument for "how bad did that feel". What it can say is
that `dogs at week 10` is 3.00 in every one of 4,800 stable-seasons, so no stable is ever reduced
below three; an injury costs entries, never a dog.

### 8. The placeholder market

Kibble keeps an unlimited shelf, one price, one hold. **The hold is `holdCap` = 20, deliberately not
GDD_V3 §6.1's 50** — 50 belongs to Phase B's six goods, and bringing it forward would quietly change
the economy in the phase that is supposed to be measuring what deleting things did. `HOLD_CAP` is a
constant rather than a field because there is no ship to upgrade.

⚠️ **The clearest argument for Phase B's 50 came out of a broken test.** `properties.test.ts` asserted
that a stable which spends down ends below a cash threshold; with no upgrades to buy, the *hold* binds
before the cash does, so the assertion failed. It now asserts the hold cap instead, and the finding is
that 20 crates is not enough hold for the trade to be a road — a stable fills it and then has nowhere
to put money. Phase B needs both the six goods and the 50.

### 9. The spreadsheet

**Assumptions pruned from 194 rows to 113**, and given the new sections: the fitness costs, the three
purse tiers, the local ratings and their fitness, the age bands, the 10-week calendar with its ×2 and
×3. `balance.json` regenerated with `npm run balance` — **213 keys → 122**, 120 removed and 29 added —
and committed with the sheet. The JSON was never hand-edited.

⚠️ **"Keep formulas intact" guards a hazard this workbook does not have.** Before pruning I checked
every sheet's XML for `<f>` elements and there are **none, in any of the eight sheets** — every cell is
a literal. So a deleted row cannot break a reference, and the instruction's real risk was somewhere
else: the *reader*. `balance-from-xlsx.ts` matches rows by their human-readable label, so pruning a row
whose label is still in `LABELS` fails loudly (good) and renaming one silently reads the wrong cell
(bad). The `LABELS` map was rewritten alongside the sheet in the same commit for that reason.

**openpyxl was used**, against this phase prompt's own advice to prefer the repo's TypeScript pattern.
The reason: the TS writers are *upserters*, built to add rows, and this item is overwhelmingly a
deletion of 81 of them. openpyxl 3.1.5 was already on the machine. There is now **no** row-writing
script in the repo — the three v2 ones are deleted (they would re-add pruned rows) — so whoever adds
rows in Phase B should write a fresh one in TS.

### 10. The harness

**Deleted**: the path agents (trainer / trader / crook / mixed), `careless`, `bankruptRate`,
`cardCoverage`, the tier rows, the road split's staff / fuel / upkeep columns, `--card`, `--fix`,
`--roads`, `--crookAblation`, `--mixability`, `--stacking`, `--holdPayback`, `--pups`, `--hold`, and
the information economy's `infoSpend` / `infoROI` with the FIFO crate tagging they needed. **1,398
lines out, 187 in** — the file went from 19 flags to 10.

**`cardCoverage` is decision A5** and the reason it is deleted rather than re-fitted is worth keeping:
it asked "on the weekends this type ran, could the stable have filled it", which is only a question
while a race can refuse a dog. Every v3 race is open entry, so coverage collapses to the fitness floor
— which the kennel table already reports.

**Losing `careless` costs the bankruptcy instrument, and that is correct.** There is no debt, no upkeep
and no bankruptcy left to measure. GDD_V3 §11's replacement failure state — stables ending a season on
less than they started — is a row the harness already prints, and at `v3a` the answer is that it
essentially never happens, which is the p10 finding above wearing a different hat.

**Added**, printed together with their bands at the level of one weekend:

```
Pace (GDD_V3 §1, §10.1) — the three rows v3 is about
  agent     decisions/weekend   races entered/weekend   races/dog/season
  normal                5.06                    2.02               6.72
  all stables: decisions 5.06 a weekend · entered 2.02 of 3 (band 1.8–2.4: MET) · races/dog 6.72 (band 5–7: MET)
```

`races/dog` adopts **5–7** (decision A4). v2's 7–9 was fitted to a five-dog stable that could buy
dogs; three dealt dogs over ten weekends cannot reach 7 by construction, and printing a miss every run
is noise. `dogs at week 10` and `distinct dogs owned` are kept for one phase as a **deletion check**
rather than as measures — with no dog market they can only read 3.00, and anything else means something
is making dogs it should not be.

---

## Verification

| | |
|---|---|
| `npm test` | **22 green**; golden snapshot moved 3×, each in a named commit |
| `npm run lint` | clean |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seeds + the toggle variant, every one to week 10, no `ActionError`, every log replays identically. 102 declarations, 79 Race/Rest changes, 28 trades, 228 bets |
| `race-view-check.ts` | 150 races, every one replay-identical, 6 photo finishes |
| `hub-clicks.ts` | 11.1 a weekend against a ≤ 10 budget |
| `--seasons 800` | 24.9 s, 31 ms/season |

`properties.test.ts` kept every invariant and **changed two assertions, both because the test was
asserting a v2 fact rather than an invariant**:

- the spend-down assertion, replaced with the hold cap (see item 8 — this is the finding, not a
  workaround);
- `race.test.ts`'s first-tick assertion, `every(p => p < 5)`. Measured across 400 seeds the maximum
  first-tick position is **7.64 m** against a theoretical break ceiling of `0.99 × 7 × 1.4 ≈ 9.70 m`.
  The old constant was seed luck, not a property. It now asserts against the derived ceiling with a
  comment explaining the arithmetic.

---

## To push

Same as v2 A through E: the commits are real but they live in a clone in Anthropic's cloud, because the
shell into your folder still does not mount (`sandbox-helper: no Plan9 drive shares mounted`, unchanged
since 8 September). They arrive as **`phase-v3a.bundle`**, attached to the conversation. Download it
into the repo root, next to `package.json`.

⚠️ **Your `main` and GitHub's `main` are both at `c83debc`**, and this bundle is built to fast-forward
from exactly that. Nothing is reset and nothing is force-pushed.

```powershell
git fetch origin                            # make sure origin/main really is c83debc
git log --oneline -1                        # expect c83debc locally too
git status                                  # expect nothing modified
git fetch phase-v3a.bundle "refs/heads/main:refs/heads/v3a-work" "refs/tags/v3a:refs/tags/v3a"
git merge --ff-only v3a-work
git branch -d v3a-work
git log --oneline -9                        # seven new commits on top of c83debc
```

If `git log --oneline -1` does **not** say `c83debc` — for instance because an earlier version of these
notes had you run `git reset --hard d0640ca` — put it back first, then run the block above:

```powershell
git reset --hard origin/main                # origin/main is c83debc; this recovers it
```

Nothing is lost by that reset: the only thing after `c83debc` on your machine would be work from a
bundle, and this bundle carries all of it.

⚠️ **Delete `v3-design-docs.bundle` from the folder** once you have pushed. Its two commits are already
in your history and on GitHub; fetching it again does nothing useful.

Then check it is what these notes describe, and push:

```powershell
npm test                                    # 22 green
npm run build                               # -> packages/web/dist
npm run harness -- --seasons 200            # mean ~39,400, pace rows MET
npm run harness -- --stats                  # 22.4 / 16.9 / 17.6
npm run harness -- --hardAblation           # 50.9%
npx tsx packages/web/scripts/season-check.ts
npx tsx packages/web/scripts/hub-clicks.ts  # 11.1, the missed row
npm run dev                                 # and go and play a season — see below

git push origin main
git push origin --tags
del phase-v3a.bundle
```

**`package-lock.json` is untouched, so no reinstall.** Cloudflare Pages will build on Node 20; nothing
added needs anything newer.

Three smaller things:

- **`design/space_dog_racing_economy.xlsx` changed** and `balance.json` was regenerated from it with
  `npm run balance`. The JSON was never hand-edited. There is no `add-phase-a-rows.ts` — the sheet was
  pruned with openpyxl and the three v2 row scripts are deleted, because running any of them would
  re-add tunables this phase removed.
- **A `v2e` save will not load**, and no `v2e` action log can replay: `WeekState` lost `'train'`,
  `RaceTypeId` is three new ids, `Dog.trap` is gone and the calendar is ten weeks. `readSave`'s version
  check fails soft to the title screen.
- **`claude/V3_PHASE_A_PROMPT.md` has been rewritten** for the Cowork route. The version I sent you
  last session says "you are in the working tree, do not clone", which was written for Claude Code and
  is wrong for how this phase was actually built.

---

## ⚠️ What to play for

**`v3a` is the first build of a different game, and nothing in it has been played.** That matters more
here than in any v2 phase, because the harness's verdict on this phase is *the numbers moved inward*
and only a person can say whether that reads as fair or as flat.

1. **Is a weekend still a decision?** The one question this phase's own instruments say is in trouble:
   `autoplan%` is 30.8% and the Race-or-Rest half of it is **95.6%** automatic. Play a weekend and ask
   yourself whether you chose anything, or whether you pressed the obvious button three times.
2. **Does the Gold Cup feel hard?** It is open entry — nothing stops you — and the locals are rated 55.
   A quarter of all entries go in it. Does declaring your best dog into it read as *ambition* or as
   *throwing away a run*?
3. **Do three dogs feel like a stable, or like a hand of cards?** V2's promise is that the equal budget
   makes a bad deal impossible. Does the *shape* difference — one fast, one quick away, one that stays
   — actually read off the stat bars, before styles exist to explain it?
4. **Watch a dog age.** Growth to 2, decline from 5, rest recovery worsening, injuries worse. Over ten
   weeks, did you ever *feel* an age band, or is it arithmetic happening off-screen?
5. **Take an injury on purpose** — run a dog at 40 fitness. Open question 4 asks whether that is too
   punishing with three dogs. The harness says no stable ever drops below three dogs; it cannot say
   whether losing one for three weeks ends your season emotionally.
6. **Is there anything to do with money?** There is one good, a hold of 20, and no market. This is the
   phase's deliberate hole and Phase B fills it — but play it once anyway, because what you *wish* you
   could buy on week 3 is the most useful sentence you can bring to Phase B's brief.
7. **Does the ten-week season have a shape?** It is decided at week 5.9 of 10. Did weeks 7 through 10
   feel like a run-in, or like a formality?
8. **And the standing question**: did any week present a choice you had to think about?

---

## Carried forward

- **⚠️ The p90/p10 spread is 2.3× against `v2e`'s 8.0×.** Pillar 5 working, and the phase's biggest
  worry. Phases B–E have to put variance back through the market and the events, and this is the row
  to watch while they do.
- **`autoplan%` 30.8%, states-alone 95.6%.** The week is nearly automatic. Phase B's market is what has
  to earn the decision back.
- **Hard beats Normal 50.9% against 63–68%, and its good decisions were in §2.1** (A6). Not a Phase A
  row; Phase B and C are where a better player can know something again.
- **Stat leverage ordering out by 0.7, and the cause is `fadeStart` being a fraction of the distance**
  (A7). A race-model change, best taken in Phase C alongside styles. Jesse's call.
- **The click budget is 11.1 against ≤ 10**, four of it navigation. §7.5's split-view question is the
  cheapest two presses in the game.
- **Purse share to players is 48.3%**, down 5.5 points, because open entry lets rating-55 locals win
  their share of the Gold Cup. A Phase B lever, deliberately not pulled here.
- **The season is decided at 59% of the way through**, against v2's 52%, with compounding no longer
  available as the explanation.
- **A1: §2.1's calendar arithmetic does not close.** 8 + 1 + 1 implemented; one sheet row to change.
- **The hold is 20 and needs to be 50**, and a broken test is the argument (item 8).
- **There is no row-writing script in the repo any more.** Phase B should write a fresh TS one.
- **Prize share of gross is 78.2%, unmoved from `v2e`**, against a row that wants it falling toward
  65%. It cannot move until the other roads exist, which is Phase B.
