# V3 Phase H build notes: balance pass 2 — the season's money (28 September 2026)

Built in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3h`**. The fallback is `v3g` (`5dfb329`).

**In one line:** the harness gained **`--set key=value`**. The two §11 rows that have been ❌ since
`v3e1` were measured and swept, and **Jesse chose to change nothing** (GDD_V3 V22). No rule, sheet
row, golden or save version moved.

---

## ⚠️ Read this first: four things the record should know

1. **Nothing in the game changed, on purpose.** The sweep found two levers that bring both rows into
   band: a per-dog **kennel rent** (300 a week: 33.7k end worth, 15.2% poorer) and dogs eating
   **three crates a week** (34.9k, 11.6%). Jesse turned both down, in his words:
   - Rent: *"We want to keep it simple, food as the only ongoing cost, charging every kennel 300 a week
     is kind of pointless, if anything it punishes the poorer players the most."*
   - Food: *"leave it at 1 crate a week, it doesnt matter if people get a bit richer, as it is the same
     for everyone."*

   So commits 2–5 of the prompt's discipline do not exist. There is no `add-phase-h-rows.ts`, no rule
   commit, no screen change, and no `SAVE_VERSION` bump.
2. **Neither golden moved**, because nothing a game reads changed. They are still **`8dc05e06…`**
   (one season) and **`dc357422…`** (two seasons). `SAVE_VERSION` stays **12**: a `v3g` log replays
   into the same game at `v3h`, so a `v3g` save loads and does not need to go to the title screen.
   That is the right outcome here, not a skipped step.
3. **Dog value is not what carries worth over 40k.** Dogs are 44% of end worth, but they barely move
   in a season (17.4k → 18.6k). The whole gain is cash. So re-valuing dogs moves the worth row and
   not the poorer row. Only a cost that takes 7–10k a season from every stable reaches the poorer
   band. That is the finding the decision rests on.
4. **The prompt's 42,170 is Phase G's sweep sample.** The committed harness reads **42,334** over 400
   seasons (seeds 1–400) and 42,495 over 50. The table below uses 42,334. The committed prompt carries
   a correction box.

---

## The two ❌ rows, and where they came from

- **Mean end worth, one season: 42,334** against 25–40k. It left the band at `v3e1` (39,194 →
  42,151), when the age tick moved from week 7 to the off-season. A one-season game has no ageing, so
  4-year-olds keep their ×0.85 book value instead of dropping to ×0.65 (E1 notes, Read this first 2).
- **Poorer than they started: 0.8%** against 10–25%. It was first measured at `v3e1` and has never
  been in band. V10 made food the only running cost, and a Normal stable eats Grey Mash, so food
  costs it about 3,200 a season.

## Where a Normal stable's money comes from

Six Normal stables, one season, 400 games (`shots/sweep.ts --detail`, the same `decide` loop as
`harness-game.ts`):

| | Cash | Dogs | Hold | **Worth** |
|---|---:|---:|---:|---:|
| Season start (week 1, after arrival) | 6,000 | 17,432 | 199 | **23,631** |
| End of week 1 | 7,077 | 17,627 | 855 | **25,558** |
| End of week 5 | 13,364 | 17,870 | 1,241 | **32,476** |
| End of week 10 | 23,602 | 18,639 | 92 | **42,334** |

**The season's ledger, per stable (mean):**

| Line | Bones |
|---|---:|
| Purses, gross | 21,685 |
| Trainers' cut | −2,868 |
| Trading (food sold − bought, markup on food eaten included) | +3,516 |
| Betting (returns − 3,447 staked) | −1,072 |
| Food eaten, at its local sell price | −3,231 |
| Card bills and stewards' fines | −914 |

Food sold is 11,658 gross, or 32.6% of gross income.

**Worth change by week (mean):** +1,928, +1,865, +1,105, +841, **+3,106** (the Major), +760, +1,798,
+1,419, +1,145, **+4,737** (the Grand Final).

**Losing weeks and losing seasons:**

| Weeks a stable's worth falls, in a season | 0 | 1 | 2 | 3 | 4+ |
|---|---:|---:|---:|---:|---:|
| Share of stable-seasons | 0.5% | 5.7% | 16.0% | 26.2% | 51.6% |

- **93.8% of stables have two or more losing weeks.** Most of these are weeks spent turning cash into
  cargo at a price the next planet does not match.
- **A losing season is rare: 0.8%.** The season's gain per stable is p5 +4,172, p10 +6,699, p15
  +8,421, p25 +11,260, p50 +17,714, mean +18,703 (sd 10,036).
- **So 10–25% poorer needs every stable to lose about 7–10k a season, whatever it earns.** A lever
  that only scales down the winners cannot get there.

## The sweep

`--set` on every row. Each lever was run at four tables, all with the same seeds:
- one season, six Normal, 400 games
- two seasons, 2 Hard + 4 Normal, 300 games (Hard vs Normal)
- two seasons, six Normal, 200 games
- five seasons, six Normal, 200 games

The kennel rent needed code, so it was a **scratch prototype**. It was a `kennelFeePerDog` key and three
lines in `runEndTurn`, charged at most down to zero cash. It was reverted before anything was
committed. The other three levers are sheet keys.

| Lever | End worth, 1 season (25–40k) | Poorer, 1s (10–25%) | Gap, 1s (< 63,530) | Food share (20–35%) | Entered (1.8–2.4) | Hard v Normal, 2H+4N 2s | Final worth, 2s | Poorer, 2s | Final worth, 5s | Poorer, 5s | Out @ wk 8, last season, 5s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **`v3g`** | **42,334** | **0.8%** | 26,510 | 32.6% | 2.12 | 62.1% | 65,625 | 0.7% | 147,689 | 0.6% | 48.8% |
| `valueCurve` 1.8 | 39,181 | 0.7% | 25,778 | 32.6% | 2.12 | 64.9% | 62,079 | 0.6% | 143,326 | 0.6% | 48.3% |
| `valueCurve` 1.4 | 36,007 | 0.7% | 25,155 | 32.6% | 2.12 | 65.1% | 58,237 | 0.6% | 137,514 | 0.8% | 46.4% |
| `valueCurve` 1.0 | 32,855 | 0.6% | 24,343 | 32.6% | 2.12 | 63.3% | 54,908 | 0.4% | 133,430 | 0.6% | 46.8% |
| `foodPerDog` 2 | 38,661 | 4.2% | 27,006 | 31.9% | 2.12 | 63.7% | 57,666 | 3.5% | 127,108 | 2.9% | 46.0% |
| `foodPerDog` 3 | 34,938 | 11.6% | 27,114 | 31.1% | 2.11 | 64.0% | 50,021 | 9.4% | 106,389 | 8.5% | 46.8% |
| `foodPerDog` 4 | 31,053 | 24.4% | 26,211 | 30.6% | 2.10 | 59.4% | 42,886 | 19.9% | 87,194 | 16.4% | 47.2% |
| rent 150 a dog a week | 37,924 | 5.6% | 26,494 | 32.9% | 2.12 | 62.5% | 56,454 | 4.1% | 124,944 | 2.9% | 46.0% |
| rent 250 | 35,115 | 11.2% | 27,189 | 33.1% | 2.12 | 61.5% | 50,626 | 8.8% | 111,608 | 6.6% | 46.7% |
| rent 300 | 33,666 | 15.2% | 26,673 | 33.1% | 2.11 | 62.1% | 48,082 | 12.0% | 103,894 | 9.1% | 48.6% |
| rent 350 | 32,378 | 19.9% | 26,803 | 33.1% | 2.12 | 60.3% | 45,582 | 15.9% | 96,419 | 12.4% | 46.4% |
| trainers' cuts ×1.5 | 40,910 | 1.0% | 25,235 | 32.7% | 2.12 | 63.1% | 62,612 | 0.7% | 138,429 | 0.6% | 43.0% |
| trainers' cuts ×2 | 39,553 | 1.3% | 23,617 | 32.8% | 2.12 | 62.2% | 59,992 | 1.0% | 131,965 | 0.8% | 42.2% |
| trainers' cuts ×3 | 36,968 | 2.3% | 21,341 | 33.1% | 2.12 | 63.2% | 53,605 | 1.8% | 115,281 | 1.2% | 36.8% |

"Trainers' cuts ×k" multiplies every `staffCut…` key, the pair premium and `staffCutMax` (0.10 → 0.15 /
0.20 / 0.30). **The `v3g` row reproduces `--game` exactly:** 0.8% poorer, a 26,510 gap, 147,689 at five
seasons and 48.8% out at week 8. Hard vs Normal has a standard error of about 1.6 points at 300
two-season games, so the 59–65% spread across levers is mostly noise.

**What the table says:**

- **Only the rent and the extra crates reach the poorer band.** They are the only two that take a
  fixed amount from every stable.
- **The value curve moves worth alone.** It takes dog value off both ends of the season, so start
  and end fall together and nobody goes backwards.
- **The trainers' cut is the only lever that touches the long game.** It is self-balancing (V11), so
  it takes from the winners. It is also the only lever that narrows the 1st-to-last gap, and five-season
  out-at-week-8 falls from 48.8% to 36.8% at ×3. It barely makes anyone poorer.
- **The food band's price level was not swept.** Scaling the bands scales trading profit along with
  the cost of eating. `foodPerDog` raises only the cost, so it is the cleaner test of "food as the
  running cost". The deck's bills have no sheet row (they are literals in `content/events.ts` and
  `eventKit.ts`), so they could not be swept.

**The kennel rows at the two in-band candidates** (plain harness, 200 seasons, `--set`):
- **Rent 300:** mean fitness at declaration 69.6, hungry dogs 0.4% of dog-weeks, the rent could not
  be paid in full in 1.1% of stable-weeks, p90/p10 2.13×.
- **3 crates:** mean fitness 69.5, hungry dogs **2.2%** of dog-weeks (hold empty 1.1% of
  stable-weeks), trading +1,866 against +3,516, p90/p10 2.09×.

## The question, and Jesse's answers

**First question.** The table, with a recommendation of **rent 300**: it lands both rows and leaves
feeding and purses alone, at the cost of reversing V10's "no upkeep". The options were rent 250,
three crates, and leaving the rows. **Answer: no rent.** It is quoted in Read this first 1: keep it
simple, food is the only ongoing cost, and a flat charge punishes the poorer players most.

**Second question.** With the rent gone, the options were three crates, two crates, a lower dog value,
or a bigger trainers' cut. **Answer: leave it at one crate.** It is quoted in Read this first 1: a table
getting a bit richer is the same for everyone.

I read the second answer as covering the whole economy, not only food. It gives the reason, that the
table growing richer together is fine, and that reason rules out the value curve and the cut as well.
**So nothing was built.**

## The rule

None. `balance.json`, the sheet and `packages/engine/src` are byte-identical to `v3g`. The
`kennelFeePerDog` prototype was never committed.

## What the player sees

Nothing new, because nothing changed. The season-end ledger (`IncomeSplit`) already shows every line
the measurement used: prize money, trainers' cut, trading, betting, and food & bills.

## Saves

`SAVE_VERSION` stays **12**. No rule or number changed, so every `v3g` log replays into the same game
at `v3h`. A `v3g` save loads.

## The one commit that changed code: `--set`

- **`packages/engine/scripts/balance-set.ts`** parses every `--set key=value` in `argv`, writes it into
  the in-memory `balance`, and exports the list for the headers. It refuses a key not in `balance`, a
  non-numeric key (`currencyName`) and a value that is not a finite number. Set twice, the last value
  wins, and the header still names the sheet's value.
- ⚠️ **It applies itself on import, and it is `harness.ts`'s first import.** Some content reads
  `balance` once, at load: every trainer's `cut` in `content/staff.ts` is `balance.staffCut…`
  evaluated when the module loads. An override written in `main()` would be silently ignored by those
  rows. Probed: `--set staffCutStatWeek=0.09` reads back 0.09 on `STAFF_BONUS_BY_ID.statWeek.cut`, and
  0.03 without it.
- **The headers:** the plain run and `--game` print `⚠️ balance overridden for this run (--set):
  valueCurve 2.2 → 1.2` under their title. Every other mode (`--calibrate`, `--styles`, …) prints the
  same line first.
- **No `--set`, no change:** a `--seasons 400` run is byte-identical to `v3g`'s apart from the
  "Elapsed" line.

## Hard vs Normal, and the long game: before → after

- **Hard vs Normal, 2 Hard + 4 Normal, two seasons: 62.1% → 62.1%.** Nothing changed. For the record,
  it holds at 60–65% under every lever swept.
- **Out at week 8 of the last season, five-season games: 48.8% → 48.8%.** Only a bigger trainers' cut
  moved it (36.8% at ×3).

## The acceptance table

| Measure | Target | `v3h` |
|---|---|---|
| Mean end worth, all-Normal, one season | 25–40k, or as close as Jesse's pick gets | **42,334, unchanged: Jesse's pick is no change (V22)**; 33.7–39.2k was on offer |
| Poorer than they started | 10–25%, or reported with the lever that would reach it | **0.8%**. Reached by rent 250–350 (11.2–19.9%) or 3–4 crates (11.6–24.4%), both declined |
| 1st-to-last gap | narrower than v2's 63,530 | 26,510 ✅ |
| Food share; races entered | 20–35%; 1.8–2.4 | 32.6%; 2.12 ✅ |
| Hard vs Normal | before → after | 62.1% → 62.1% |
| Out at week 8, last season, 5-season games | before → after | 48.8% → 48.8% |
| `--set` on `--seasons` and `--game`, refuses an unknown key | ✅ | ✅ |
| The change comes from the sheet | ✅ | no change was made |
| A `v3g` save | `SAVE_VERSION` 13, or explained | **12, explained**: a `v3g` log replays unchanged, so the save loads ✅ |
| Goldens once; 47 green; lint; `season-check`; build; `asset-check` | ✅ | **neither golden moved**; 47 green; clean; passes; ✅; 288 / 0 / 0 |

### The re-baseline

- `npm test` **47 green**; `npm run lint` clean; `npm run build` ✅.
- `season-check`: all seasons played out clean (four humans, two seasons: 217 passes, 0 leaks).
- `hub-clicks`: **9.4** a weekend; the table at 4 humans **10.7** passes, at 8 **22.4**. Unchanged.
- `race-view-check`: every race replays clean (seeds 42, 7, 1234, 90210; 30 races each).
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**
- `npm run harness -- --game` (six Normal): identical to `v3g`. One season: 0.8% poorer, gap 26,510.
  Three seasons: out at week 8 of the last season 15.8%. Five seasons: 48.8%, ending on 147,689.

### `npm run harness -- --seasons 50` (per CLAUDE.md)

```
Space Dog Racing harness — 50 seasons, stables: normal, normal, normal, normal, normal, normal, seeds 1…50

End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

Pace: decisions 7.53 a weekend · entered 2.12 of 3 (band 1.8–2.4: MET) · races/dog 6.64 (band 5–7: MET)
Purse pool: 240,860 posted a season, 47.6% of it reaching a player
```

Identical to `v3g`'s.

## Commits

1. `Add --set key=value to the harness: override a numeric balance key for one run`: tooling, no
   golden.
2. (Commits 2–5 do not exist: Jesse chose no change.)
3. The notes, the prompt (with its correction box), GDD_V3 §6.3, §11 and V22, BUILD_PLAN_V3 Phase H,
   and CANON's `v3h`. Tagged **`v3h`**.

---

## ⚠️ The v3h checklist, multiple choice

Play a season or two with two Hard AIs at the table.

1. **Did anyone go backwards, and did you miss it?** *Nobody did, and that's fine · Nobody did, and
   it felt too easy · Someone did*
2. **Does a stable that races well still pull ahead?** *Yes · Only with a good market · No*
3. **The Hard AI is:** *Too strong · About right · Too soft*
4. **Is the `v3g` stake cap still right?** *Yes · A big bet isn't worth making any more · Neon Snout
   doesn't feel different*
5. **What next?** *The four-human playtest · The human face picker · The long game (48.8% out at
   week 8 of a five-season game's last season)*

---

## Open questions and carried forward

1. ❓ **§11's two rows are out of band by choice.** V22 records them as reported, not tuned. If a
   playtest says a season is too comfortable, the sweep above is the menu: rent 250–350 or 3–4 crates
   for the poorer row, and the value curve for worth alone.
2. ❓ **The long game.** Out at week 8 of a five-season game's last season is 48.8%. The only lever
   that moved it is a bigger trainers' cut (×3 → 36.8%), which also narrows the gap. That would be a
   V11 decision, and it is the first thing to sweep if the long game is next.
3. ❓ **Hard vs Normal is 62%.** It is reported, not tuned. The checklist's third row asks.
4. **The goldens cannot see betting.** Carried from G: a Hard seat in a golden needs Jesse's say-so.
5. Carried, untouched: Phase E's four 🎲 rows; the F1 and `v3g` checklists; a human choosing their own
   face; §7.5's split view.
