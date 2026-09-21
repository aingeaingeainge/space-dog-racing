# V3 Phase B build notes — the market (21 September 2026)

**Status: Phase B complete, tagged `v3b`.** Eleven commits on `main` after `6978b96`, which is where
GitHub's `main` is — checked with `git ls-remote origin` before these notes were written, not
assumed. **Not pushed.** The bundle and the commands are at the end, and they are a plain
fast-forward.

Before building, two of Phase A's open decisions went to Jesse and came back as recommended:

- **A1 — the calendar: 8 regular planets + the week-5 Major venue + Collar Prime at week 10.** What
  Phase A built stands. GDD_V3 §2.1's "9 regular planets" is corrected to 8 in this commit.
- **A7 — the stat-leverage row: deferred to Phase C**, where `fadeStart` becomes an absolute distance
  alongside running styles. Nothing in the race model was touched here; `--stats` still reads
  22.4 / 16.9 / 17.6, identical to `v3a`.

The golden snapshot moved **four times**, each in a commit whose message says so and why, and six
commits say in their message that it did **not** move.

| | | golden |
|---|---|---|
| `22a702a` | Add Phase B's numbers to the spreadsheet | unmoved |
| `0f9d1b0` | Charge an empty hold in fitness, not Bones (item 5) | unmoved — see below |
| `7c84068` | **Six goods on 8× bands, a finite shelf each, `foodBand` a per-planet map (item 1)** | **move 1** |
| `d23f995` | **Cluster prices mid-band with rare excursions to the ends (item 2)** | **move 2** |
| `9364ea4` | **The hold at 50, six foods as training, the sticky diet, You Paid (items 3, 4)** | **move 3** |
| `0a588fb` | Turn order: `20 − cargo ÷ 5 + d10` in exact arithmetic, with its sum (item 7) | unmoved — see below |
| `30789e0` | Add You Paid to the Market table (item 6) | unmoved |
| `8dc0f24` | **Let no AI stable sail hungry with money in its pocket** | **move 4** |
| `6ae2764` | Harness: a row per good with band position, and the market rows (item 8) | unmoved |
| `f57b384` | Market: a quiet marker for a carried good, and "free" | unmoved |
| *(this one)* | GDD_V3's B1–B9 rows, the A1/A7 follow-through, CANON, the prompt and these notes | — |

| | `stateHash` |
|---|---|
| `v3a` | `a784eed9…` |
| after the six goods | `06f26cf5…` |
| after the price distribution | `bcd4ca79…` |
| after the hold, the feeding and the diet | `3a274394…` |
| after the dinner guard (`v3b`) | `309daf58…` |

`npm test` is **23 green** at every commit — Phase A's 22 plus one new property test. **41 files
changed, 2,504 insertions, 1,078 deletions.** All eleven commits are signed.

---

## ⚠️ Read this first: five corrections to the record

Four are to the record *other* sessions left, found while building this one; the fifth is to mine.
They are at the top because a reader trusting the earlier documents would be misled.

1. **`STATE_VERSION` and `SAVE_VERSION` did not move when three phases said they had.**
   `STATE_VERSION` was **5 from `v2d` through `v3a`** — its own comment described a "6 for v2 Phase
   E" that was never applied — and `SAVE_VERSION` was **4 from `v2c` through `v3a`**. v3 Phase A
   deleted nine action types and changed `Dog`, `Player` and the calendar and bumped neither, so
   a v2c, v2d or v2e save *passed* `readSave` at `v3a` and failed later, at replay, with "That save
   could not be replayed". **`V3_PHASE_A_NOTES.md` says such a save "fails soft to the title
   screen", and it did not.** Nothing broke badly — `gameStore` catches the replay error — but the
   claim was wrong, and nothing reads `GameState.version` at all: `SAVE_VERSION` is the only gate
   there is. Both move in this phase (5 → 6, 4 → 5), and both comments now say what each number
   actually meant in code.
2. **The `v3a` tag on GitHub is not on `main`.** It points at `18a5bfb`, the Phase A notes commit
   from *before* the replay onto `c83debc` described in Phase A's own correction 4. `main`'s
   equivalent is `6978b96`; the two trees differ only in `claude/V3_PHASE_A_NOTES.md` (the corrected
   push instructions). So checking out `v3a` gives you the right code on a branch `main` never
   had. **Harmless, and yours to fix or leave** — it is a force-push of a published tag, and these
   notes do not do that for you. The command is in the push section.
3. **Phase A's decision A3 is arithmetically wrong, and V2's equal-deal promise does not hold.**
   A3 reads: "With rating weights summing to 1, 150 points over three stats rates exactly 50
   *whatever the split*." That is only true if the weights are equal, and they are 0.40 / 0.35 /
   0.25. Measured over 500 deals of six stables: **a dealt dog rates anywhere from 44 to 55**, and the
   best stable at the table starts **a median 16 rating points ahead of the worst**, summed across
   its three dogs (p90 22, max 29). That is the "you got better dogs" complaint V2 exists to prevent,
   and it is part of why the p90/p10 spread is mostly racing luck. **Not fixed here** — it is not a
   market question, and the fix (deal to a rating rather than a stat total, or weight the budget)
   moves every dealt dog. It is at the top of Carried forward.
4. **Two Phase A residue items of exactly the class Phase A warned about**, both a screen describing
   a rule that no longer exists: Neon Snout's planet screen has said **"Everything +20%"** since
   Phase A and nothing applied it (`PlanetSpecial.everythingMarkup`, removed); and the hub's turn
   order panel was subtitled **"ship speed × 10 − cargo ÷ 5 + d10"** with no ship in the game. Also
   removed: a Train-state fitness outlook nothing rendered (`fitnessOutlook().training` and its
   spreadsheet row), v2's `coverageGaps` in the AI, a title screen describing "a whole 13-week
   season", and a galaxy map telling you to "buy the file" for a stop. Found by sweeping, not by
   luck — and the sweep also found `fitnessOutlook` promising a seven-year-old +30 fitness at rest
   where the engine has given it +20 since Phase A. Fixed.
5. **Mine: I put the phase's empty-hold row through a harness that was lying to me, and nearly
   committed it.** The first run of the new rows read **4.8% of dog-weeks hungry — MET, against
   < 5%**. It was a pass for the wrong reason. Traced, it was the Normal agent: the staple can be
   sold out by the stables ahead in the turn order (which is the design working), and a Normal
   stable holding 22,786 Bones would find one crate of Grey Mash, sell its Vat Steak and sail with
   two dogs unfed, because nothing asked "can the yard eat?" after the trading. `8dc0f24` fixes the
   agent, not the row: hungry dog-weeks 507 → 41 over the same 60 seasons, and the row now reads
   0.3%. **The lesson is the Phase A lesson in a new place: a row that passes is not a row that
   measured what it says.**

---

## The acceptance table

`BUILD_PLAN_V3` Phase B, every row, at **800 all-Normal seasons** (`npm run harness -- --seasons 800`,
34.9 s) unless the row says otherwise.

| Measure | Target | Read | |
|---|---|---|---|
| Food sold as a share of gross income | 20–35% | **28.9%** (9,507 of 32,887) | **MET** |
| The week a Normal stable stops being cash-bound and becomes hold-bound | weeks 4–7 | **4.3** — but see below: 76.8% of stable-seasons ever cross, and the curve is flat | **MET, weakly** |
| Best single trading leg in a season, p99 | < 40% of mean end worth | **5,445 = 13.5%** of 40,242 (p50 1,807, max 9,244) | **MET** |
| Share of weeks a stable's hold is empty | < 5% | **0.1%** of stable-weeks · 0.3% of dog-weeks hungry | **MET** |
| Mean units of Ambrosia obtainable on one planet | ≤ 8 | **5.5** mean, 8 max | **MET** |
| A new player can say whether a posted price is good | 🎲 from the Price Range column alone | built; rendered and checked by screenshot; **needs you** | **OPEN** |
| Decisions per weekend per player (`hub-clicks`) | ≤ 10 | **10.5** presses — 6.5 decisions, 4.0 navigation | ⚠️ **MISSED by 0.5** |
| `npm test` green, snapshot moved in named commits only | ✅ | 23 green; moved 4×, each named; 6 commits name that it did not | **MET** |

And the rows carried from Phase A, which must not regress:

| Measure | Target | `v3a` | `v3b` | |
|---|---|---|---|---|
| Mean end worth, all-Normal | 25–40k | 39,417 | **40,242** | ⚠️ **MISSED by 242** |
| Races entered per weekend | 1.8–2.4 of 3 | 2.02 | **2.02** | **MET** |
| Races per dog per season | 5–7 | 6.72 | **6.74** | **MET** |
| Race calibration, 65 vs seven 50s | 45–60% | 56.6% | **56.6%** | **MET** — the race model is untouched |

**Nothing was tuned toward a row.** No balance number was moved to meet one; the two misses are
reported with their arithmetic below and left alone, as the phase instruction says. The p99 leg —
the one row that would have licensed tightening the distribution — met at a third of its limit.

### The two diagnostics, reported whatever they said

| | `v3a` | `v3b` | |
|---|---|---|---|
| **`autoplan%`** | 30.8% | **30.1%** (entries 30.2%, states 95.0%) | **unmoved** |
| **p90 / p10 net worth** | 2.3× | **2.31×** (57,478 / 24,854) | **unmoved** |

**Both are unmoved, and the prompt's own test says that means the market has not landed.** Taken at
its word, that is the finding of this phase. What it does and does not mean is the section after
the misses, and it is the most important thing in these notes.

---

## Miss 1 — mean end worth, 40,242 against a ceiling of 40,000

**Over by 242, or 0.6%.** `v3a` was 39,417, at the top of the band already. The move is the new road:

| per stable-season | `v3a` | `v3b` | |
|---|---|---|---|
| prize | 19,448 | 19,184 | −264 |
| trade, net | +1,598 | **+2,997** | **+1,399** |
| betting | −1,190 | −1,258 | −68 |
| costs (food eaten, events) | 3,762 | 3,506 | −256 |

A market worth more than the placeholder adds money to the economy, and 800 seasons put the mean
242 Bones over a line it was 583 Bones under. **Left alone.** The band was written for a game with
one good; if it should move, that is a decision for the table in the GDD rather than something a
builder does to make a row green.

## Miss 2 — the click budget, 10.5 against ≤ 10

`hub-clicks` read 11.1 at `v3a` and reads **10.5** now, of which 6.5 are decisions and 4.0 the same
four navigation presses Phase A identified (to the track, run the races, back, end turn). The
improvement is the hub's market hotspot: it now names a specific good in the bottom or top quarter
of its band ("cheap Steak", "sell Ambrosia"), and flags nothing otherwise, so the walk-through
visits the Market less often on weeks with nothing in it — §10.1's D34 principle, *a hotspot flags
what changes*, doing its job.

What it does **not** yet measure is a human actually trading: the hub walk buys dinner and nothing
else. §10.1 budgets "up to six market lines, realistically two", and a player who works the table
properly will spend two to four presses there. **So the honest reading is that the budget is tighter
than 10.5 makes it look.** Phase A's cheapest lever still stands: §7.5's split-view question would
take two navigation presses out at once.

---

## ⚠️ What the unmoved diagnostics actually say — and what they cannot

The standing instruction put it plainly: *if at the end of this phase `autoplan%` has not moved and
the spread has not widened, the market has not landed, and that is a finding worth more than any
acceptance row.* Neither moved. Three things are true at once, and all three matter.

**1. `autoplan%` cannot see the market, by construction.** It measures how often a naive plan and
Normal's plan *agree about the entries* — which dogs race, and where. The market adds decisions
*beside* that one; it does not make the entries less obvious. A market that was the deepest system
in the game would leave this row exactly where it is. So "unmoved" here is not evidence the market
failed — but it *is* confirmation of something worse for §1.1: **decision 3, Race or Rest, is still
95% automatic, and nothing in Phase B was ever going to change that.** Phase C's running styles and
§7.3's public declarations are the phase that has to move this row, and it should be measured there
as the headline.

**2. The spread cannot widen through skill at a table of six identical agents.** Every stable runs
the same trading policy with the same information, so whatever the market gives one, it gives all —
and the price distribution was *built* to stop it handing out luck (the p99 leg is 13.5% of a
season, a third of its limit). So at this table, the spread measures the deal and the dice, and the
market deliberately adds little of either. That is the p99 guard and the "variance comes back"
hope pulling against each other exactly as the prompt said they would, and at an all-Normal table
the guard wins. **Where variance *can* come back through the market is between different
players**, and there is one table in this harness that has them:

| 400 seasons, 3 Hard v 3 Normal | mean | p10 | p50 | p90 | p90/p10 |
|---|---|---|---|---|---|
| Hard | 44,004 | 20,153 | 36,930 | 72,317 | **3.6×** |
| Normal | 40,607 | 25,513 | 39,313 | 56,498 | 2.2× |

Hard beats Normal head-to-head **47.5%** (v3a 50.9%, band 63–68%). Hard's market code is *identical*
to Normal's in this phase — its only market difference is filling the hold before Blackreach — so
this spread is Hard's betting and entries, not its trading. **Hard has not been given a better
market brain, deliberately**: §6.4's "exotic food in the cheap weeks" is the obvious Hard behaviour,
and building it would have been inventing agent tuning inside a phase meant to measure the market.
It is at the top of the agent list in Carried forward.

**3. What *did* move is where the money comes from, and how the season is decided.**

| | `v3a` | `v3b` |
|---|---|---|
| prize as a share of gross income | 78.2% | **58.3%** (target: falls toward 65%) |
| food sold as a share of gross | 4.2% | **28.9%** |
| AI decisions a weekend | 5.06 | **7.52** |
| season decided by week | 5.9 | **6.0** (it read 6.5 with the hold at 20) |

Prize share has fallen *past* the 65% the old plan asked for — food is now a third of the money
that comes in. And the AI takes half as many decisions again per weekend, which is the market adding
choices rather than the week gaining depth; the decisions that matter are whether those choices are
*hard*, which only a person can answer.

**So, stated as the finding:** the market has landed as a road — 29% of gross income, a real
trading curve across six goods, prices bought at a band position of 0.31–0.44 and sold at 0.52–0.64 —
and it has **not** landed as a source of *table* variance, and it could not have at an all-Normal
table. Whether it gives a *person* a decision is the 🎲 row, and the checklist at the end is built
to answer exactly that.

---

## The market, good by good

800 all-Normal seasons, per stable-season. `paid@` and `sold@` are the mean **band position** of
every crate bought and sold — 0.0 at the floor, 1.0 at the ceiling. A stable buying at 0.5 is not
trading; one buying at 0.2 is.

```
  good               bought   paid@   Bones out     sold   sold@    Bones in      fed   shelf
  Grey Mash            54.3    0.43       2,182     38.3    0.64       2,096     19.2    50.1
  Scrapmeat            23.1    0.33       1,517     18.3    0.56       1,809      4.0    37.5
  Glow Tripe           17.7    0.35       1,818     11.2    0.53       1,597      5.9    25.0
  Vat Steak            11.4    0.37       2,440      5.7    0.52       1,582      5.5    14.0
  Pulsar Marrow         4.0    0.31         938      3.7    0.56       1,363      0.1     9.0
  Ambrosia              2.4    0.32         709      2.3    0.59       1,060      0.1     5.5
```

Three readings:

- **The agent is trading, not paying the going rate.** It buys every good in the bottom third of its
  band and sells in the upper half. That is the clustered distribution making bargains *findable*
  rather than common: the gap between `paid@` and `sold@` is about a quarter of the band.
- **Vat Steak is bought more than it is sold** (11.4 in, 5.7 out) — the difference is dinner. Normal
  names the food aimed at a dog's weakest weighted stat, and speed is most often it. The exotics are
  almost never fed (0.1 a season) because nothing in Normal chooses them. That is the missing Hard
  behaviour, visible in a column.
- **The hold binds, but rarely.** Hold-bound at the jump, by week:

  ```
  week    1      2      3      4      5      6      7      8      9     10
         11.6%  14.5%  15.2%  18.3%  14.9%  15.6%  16.4%  15.9%  25.1%   0.0%
  ```

  §6.1's promise is a curve — cash binds early, the hold binds by week 6. What the agent produces is
  a floor of ~15% that barely rises until the stock-up before the Grand Final, and a mean crossover of
  **4.3** that meets the 4–7 band on the *first* week a stable happens to end full. **The row is met
  and the shape is not.** The honest cause is the agent's own reserve (it commits 80% of spare cash)
  and the shelf depth, which caps the dear goods well below a full hold: 5.5 Ambrosia, 9 Marrow and
  14 Steak a planet is 28.5 crates of the top three goods, and the rest of a 50-crate hold has to be
  cheap stuff with a thin margin a crate. Whether a *person* feels the graduation is checklist
  question 3.

---

## The build, item by item

### Item 5 — the empty-hold penalty, first (`0f9d1b0`)

A dog the hold cannot feed loses **10 fitness** and gains nothing (§6.3). **Replaced, not kept
alongside**: v2's cash penalty (`foodNoCargoPenalty`, 1.5× the local price at the gate) is gone.
Two overlapping punishments for one miss is how a number becomes impossible to reason about, and
the cash version had the wrong shape for v3 — a rich stable could stop thinking about food at all.

- The penalty goes through **the same clamp as the week's recovery**. Applied on its own it
  vanishes: a rested dog at 95 takes −10 and then +30 into a ceiling of 100. A new property test
  drops a yard to 50 fitness before the jump for that reason, and asserts the hungry copy of a season
  ends exactly 10 below the fed copy and no Bones poorer.
- `planFeeding` is **in the engine, and the Kennel reads it**. The hold is drawn down in the stable's
  own dog order, so *which* dog goes hungry is a fact, and the Kennel names it before the turn ends
  — BUILD_PLAN_V3's "visible in the Kennel before the week resolves". So does the hub.
- ⚠️ **A No Trading season would have starved every dog from week 3** under the new rule: the market
  is shut, so the hold cannot be restocked. The toggle's title-screen promise is *"your dogs still
  eat: you pay the local price at the gate"*, so with the market shut the staple is bought at the
  gate at the buy price, no multiplier. In a trading season that path is always zero.
- **The golden snapshot did not move, and that was itself the first finding**: the old and new code
  draw the same rng in the same order whenever a hold is not empty, and at `v3a`'s economics no
  stable in the golden season — or in 40 harness seasons — ever sailed empty. The rule that is
  supposed to carry the economy did not fire at all.

### Item 1 — six goods (`7c84068`)

**`GOOD_IDS` is cheapest-first and chosen once**: Grey Mash, Scrapmeat, Glow Tripe, Vat Steak,
Pulsar Marrow, Ambrosia — the order §6.1 prints them, the order a player reads them. It is part of
every save's hash, and `content/goods.ts` now fails at load if its rows ever disagree with it. Every
band is exactly 8×; nothing was rounded. **`STOCK_UNLIMITED` is gone**: every shelf is finite and
every buy draws it down. `KIBBLE_ID` became `STAPLE_ID`, read off the rows' floors.

**`foodBand` — how the multipliers were chosen (decision B2).** It changes meaning, from an absolute
price band for one good to **six multipliers over each good's mid-band centre**. 108 hand-picked
numbers would be a map nobody can read, so each planet is written as two and a half:

- **level** — how dear the planet is for everything, taken from Phase A's absolute band so every
  planet keeps its v1/v2 character: Kibbleton's old [40, 60] is 0.70, Rustgut's [110, 140] is 1.25,
  and the pool's median [80, 110] is 1.00;
- **tilt** — which end of the ladder is dear there: positive for a poor or farming world (staples
  cheap, exotics dear — Kibbleton, Lagrange Lows), negative for a rich or smuggler's one (Collar
  Prime, the Hushmarket). Good *i* of six gets `level × (1 + tilt × (i − 2.5) ÷ 2.5)`;
- **at most one exception, where the planet's name is a promise** — six planets carry one: the Drift
  (an orbital scrapyard) sells Scrapmeat cheap, Vatgrown Vat Steak, Mudhaven Glow Tripe, Ossuary
  Pulsar Marrow, the Hushmarket Ambrosia, and the monks of Holy Bark, who worship the Good Boy, pay
  through the nose for it.

Every good's bias averages **0.98–1.03 across the eighteen**, so the map is about *where*, not a
drift in *how much*. The whole table:

```
planet         greyMas scrapme glowTri vatStea pulsarM ambrosi
cosmodrome        1.15    1.09    1.03    0.97    0.91    0.85
ossuary           0.90    0.94    0.98    1.02    0.60    1.10
blackreach        1.10    1.10    1.10    1.10    1.10    1.10
collarPrime       1.38    1.26    1.16    1.05    0.94    0.83
kibbleton         0.49    0.57    0.66    0.74    0.83    0.91
rustgut           1.13    1.17    1.23    1.27    1.33    1.38
neonSnout         1.32    1.27    1.22    1.18    1.13    1.08
drift             0.95    0.55    0.95    0.95    0.95    0.95
mudhaven          0.95    0.95    0.55    0.95    0.95    0.95
glassfall         0.89    0.96    1.02    1.08    1.14    1.21
portSlobber       1.14    1.06    0.99    0.91    0.84    0.76
vatgrown          0.75    0.75    0.75    0.50    0.75    0.75
oldWembley        0.86    0.89    0.93    0.97    1.01    1.05
hushmarket        1.55    1.39    1.23    1.07    0.91    0.60
sunbleach         0.92    1.01    1.10    1.20    1.29    1.38
tinkertown        1.05    1.01    0.97    0.93    0.89    0.86
holyBark          0.56    0.64    0.71    0.79    0.86    1.30
lagrangeLows      0.86    1.00    1.13    1.27    1.40    1.54
mean, all 18      1.00    0.98    0.98    1.00    0.99    1.03
```

**The map is public (decision B8)**: the Market prints next stop's map in words — "cheap for Grey
Mash, Scrapmeat, Glow Tripe and Vat Steak" — and so do the galaxy map, the hub signpost and the
rumours. The fog hides the *week's draw*, not what kind of place Rustgut is; a game that made you
memorise that would reward whoever brought a pen, which is §5.4's own reason for writing a dog's
style on its card.

The AI was **rewritten for six goods rather than patched** — see the dinner guard below for the
one thing the rewrite got wrong.

### Item 2 — the price distribution (`d23f995`, decision B1)

Landed alone, so its snapshot move is attributable to the shape and nothing else.

- **A normal deviate in band-position space**: `centre + 0.16 × z`, z from `rng.gauss()` →
  `normalDeviate()`. No `exp`, no `log`, no `pow` in `packages/engine/src`; eslint is still on.
- **The standard deviation is 0.16 of the band.** On a planet that prices a good mid-band, a draw
  reaches the outer twentieth of the band at either end about one time in four hundred, and the outer
  quarter about one time in seventeen. On a planet whose map puts the good in its cheap part (centre
  0.3), the bottom quarter comes up about two weeks in five. **The p99 leg it produces is 5,445, or
  13.5% of mean end worth** — a third of the 40% limit.
- **The centre** is 0.5 × the planet's multiplier, clamped to 0.45–1.55 first, so it stays within
  0.225–0.775 and every planet can still throw an excursion to either end.
- **The tails are clamped, not re-drawn**, 0.02 of the band from either end. Clamping keeps the draw
  at exactly two uniforms per good; rejection sampling would make the rng stream depend on the price.
- **Linear in price, not in ratio.** A player reads "198, range 60–480" as a point on a line, so the
  cluster has to sit at the middle of the *printed* range. A log-scale draw would put the typical
  price well left of it and make the Price Range column lie.
- **Buy and sell drift together**, as since v1: the sell is `foodSpread` below the buy, now derived
  from the rounded buy. A separate sell draw would open a same-planet arbitrage nobody could see.
- ⚠️ **The comment the prompt flagged is rewritten, not just the code.** Phase A's `rollGoodPrices`
  skipped rng draws for a shelf that could not vary, "which is what lets a change to the good list
  replay an unchanged season draw for draw". Every shelf varies now, so every good makes the same
  three draws always, and the comment says that property is gone and why.

With the hold still at 20, the shape alone took trade profit from 5,566 to 2,953 a stable-season and
food's share of gross from 30.4% to 25.5% — the distribution doing what §6.4 asks, not a number being
tuned.

### Items 3 and 4 — the hold at 50, feeding and the diet (`9364ea4`)

**The hold is 50 in the spreadsheet.** `Player.ship` was already gone in Phase A; checked, nothing to
do. The sheet row was deliberately held back from the first, data-only commit, because raising it
there would have moved the economy from a commit that claimed to move nothing.

**§6.3's table**, every number a sheet cell: Grey Mash +1 random, Scrapmeat +1–2 Stamina, Glow Tripe
+1–3 Accel, Vat Steak +2–4 Speed, Pulsar Marrow +2–4 random and +5 fitness, Ambrosia +3–6 random, +8
fitness and injury chance ×0.5. The randomness stays inside each row (V6). **Ambrosia's halving
protects the races *after* the jump it is eaten at** — a dog eats at the end of its week, after its
races — so race day reads a new `Dog.lastMeal`. It is a fact about the dog, not a rule about
Ambrosia: any row with an `injuryMult` below 1 does the same.

**The diet (decision B6)**: `{ named, good } | { best } | { worst }`, per dog, in the Kennel, sticky,
falling back to the cheapest thing aboard. **"Best" and "worst" are the good's place on the ladder,
not this week's price** — a diet is a standing order, and a standing order cannot depend on a draw the
owner has not seen. **The default is `worst`**, which is also §6.3's fallback, so a player who never
touches the setting never sees a dog eat the Ambrosia they bought to sell. "Best available" has to be
chosen.

**You Paid is a running average, not FIFO (decision B4)**: a purchase moves it toward its own price
in proportion to the crates it adds; a sale, a dinner, a spoiled crate or a pirate's cut takes
crates out at the average and leaves it where it was, which is what makes a partial sale sensible;
a free crate comes in at zero, and the Market says "free". `settleHold` zeroes it for any good no
longer aboard after every action, rather than hooking the six places a crate can leave.

⚠️ **The stored-state change, as the prompt asked it said:**
- `Dog.trainStat` → `Dog.diet` and `Dog.lastMeal`; `Player.paid`; `SetDogState`'s `stat?` → `diet?`.
- `STATE_VERSION` 5 → 6 and `SAVE_VERSION` 4 → 5 — see correction 1 for what they had been.
- **A `v3a` save fails soft to the title screen.** Verified by reading `readSave` (a version mismatch
  returns null) and the store (null is `hasSave: false`, the title screen).
- **A `v3a` action log cannot replay**: its `TradeFood` actions trade `kibble`, which does not exist,
  and its diet pointers would be silently dropped.

**`properties.test.ts` — the two changes the phase allowed, and no others.** The prompt named one; the
field swap forced a second, and both are the same kind of change:
- the `trainStat` invariant is **re-pointed** at the field that replaced it (a diet names a real good),
  and You Paid gets two invariants of its own;
- the spend-down test, as Phase A asked, is **re-examined for 50 crates**. It now shops dearest-first
  and asserts that **cash** runs out with the hold not full — §6.1's "cash binds early". **Checked the
  other way round:** with `holdCap` put back to 20 the same walk stops on the hold and the test fails,
  so it measures the hold rather than passing trivially.

### Item 7 — turn order (`0a588fb`, decision B7)

`20 − cargo ÷ 5 + d10`, and every stable's reason now carries the whole sum — *"heavy hold: 20 − 42
crates ÷ 5 + 3 on the die = 14.6"* — because a stable that loads its hold to the roof goes last all
season, and that is a trade the table has to see it making. The hub adds: a full hold is 10 points,
more than the die can make up.

⚠️ **The prompt said that if putting the constant back moved the snapshot, something else in the
commit did it. It moved it, and it was the constant — through the arithmetic.** Phase A computed
`−crates / 5 + die` in floating point, and 0.2 is not a binary fraction, so two stables on *exactly*
the same score (1 crate and a 1, 11 crates and a 3) compared as 0.8 against 0.7999999999999998, and
the tie went to whoever the rounding favoured. Of the exact ties a season can reach, the float broke
884 pairs — half toward the lighter hold, half toward the heavier — and left 2,056 to the seating
order. Deterministic on every engine, since IEEE `+ − ÷` are exact per spec; not a rule anybody could
read. Adding 20 changed *which* ties the rounding broke.

The score is now whole numbers, `20×5 − crates + die×5`, and **verifiably inert in the constant**: the
golden season hashes identically (`6cbfd946…`) with the base at 0, 7 and 20. **One rule changed**: ties
go to **the lighter hold**, then the seating order — "the lighter ship lands first", applied to the one
case the arithmetic cannot separate. With it the golden season is back to `3a274394…`, because its
ties happened to fall the way the rounding already broke them. Other seeds can differ in a handful of
weeks; the re-baseline above is on this code.

### Item 6 — the Market screen (`7c84068`, `30789e0`, `f57b384`)

§6.2's table whole: **Your Hold | On Planet | You Paid | Market Price | Price Range**, a hold gauge at
50 / 50 across the top, and next stop's food map underneath.

- **The Price Range column is printed as numbers** — `60 ▕━━●━━━▏ 480` — with a marker on a bar
  between them as an aid, never a replacement. The bar's ends are tinted for the quartiles and the
  marker lights green in the bottom quarter and pink in the top; the numbers are the answer and are at
  full weight either side.
- **You Paid** goes green when this planet's sell price beats it and pink when it does not.
- Hovering Market Price says what the next stop usually pays, from the same `expectedPrice` the AI
  trades on (§14: every difficulty sees what a player sees).
- `lib/priceTag.ts`'s `feedEffect` was **extended, not duplicated**: it now reads a food's fitness and
  injury clauses off the row, and the Kennel prints it under each dog as "Eats Vat Steak at the jump —
  Speed 25 → 27–29 next week, rating 51 → 52".

**Checked by rendering, not by reading.** The built app was served and screenshotted at the Market
and the Kennel. That found two things the code review did not: the carried-good row borrowed the
field tables' loud "this row is you" style and drew an orange box round every cell, and a starting
hold's You Paid showed a green **0** — correct, and read as a bug. `f57b384` fixes both.

### The dinner guard (`8dc0f24`) — see correction 5

`guardDinner` runs last in `tradeFoodPlan` and asks `planFeeding` whether the yard can eat; any dog
that cannot has its crates bought now, cheapest food on the shelf first, at whatever price — a week's
dinner at the top of its band still costs less than 10 fitness. **Easy never calls it**, which is the
penalty doing its job on the stable that does not look. The 41 hungry dog-weeks left in 60 seasons are
a sponsor week or a Glutton meeting a shelf the stables ahead had already cleared of everything —
the scarcity rule, not the agent.

### Item 8 — the harness (`6ae2764`)

In the standard printout, not behind a flag: the per-good table above, and the market rows printed
together with their bands. **Decision B5 is the crossover definition**: a stable is *hold-bound* in a
week if it ends that week's trading at least 90% full **and** with cash for another tenth of the hold
of the dearest good at its mid-band price — it stopped buying for want of space, not money. Both
thresholds are read off the data (a tenth of 50 is 5 crates; Ambrosia's mid-band is 405). A **leg**
is one week of a stable's sales, crates × (sell − You Paid), summed across goods — the conservative
reading; per-sale would be smaller.

---

## Verification

| | |
|---|---|
| fresh clone of `6978b96` before anything was touched | 22 green, lint clean, 20-season harness ran, snapshot taken |
| `npm test` | **23 green**; the golden moved 4×, each named |
| `npm run lint` | clean; no `exp`/`log`/`pow` in `packages/engine/src` |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seeds + the toggle variant, every one to week 10, no `ActionError`, every log replays. **It now fails** a trading season in which no dog went hungry (it sells its whole hold after week 3's races on purpose), and fails a run that trades fewer than four of the six goods. 99 declarations, 89 Race/Rest changes, 66 trades, 228 bets, 15 diets set, 18 hungry dog-weeks, 5 of 6 goods |
| `race-view-check.ts` | 150 races, every one replay-identical, 4 photo finishes |
| `hub-clicks.ts` | 10.5 a weekend against ≤ 10 (6.5 decisions, 4.0 navigation) |
| `--seasons 800` | 34.9 s, 44 ms/season |
| `--calibrate` | 65 vs seven 50s: **56.6%**; best-fit `oddsScale` 15.75 against 15.5 — D52 stands |
| `--stats` | 22.4 / 16.9 / 17.6, identical to `v3a` (A7, deferred to Phase C) |
| `--autoplan --seasons 200` | 30.1%; states alone 95.0%; apLoss −268 ± 413, inside two standard errors |
| 3 Hard v 3 Normal, 400 seasons | Hard beats Normal 47.5% |
| screenshots of the built Market and Kennel | rendered as designed after `f57b384` |

---

## To push

The phase was built the way every phase since v2 D has been — in a clone in the cloud — and arrives as
**`phase-v3b.bundle`**. ⚠️ **But the shell into your folder mounts again.** At handoff, a read-only
`git log` run in `dog racing game` from this session answered (`6978b96`, clean, `origin/main` at
`6978b96` too), so the 8 September `sandbox-helper: no Plan9 drive shares mounted` fault is gone, at
least today. Nothing in your working tree was changed from here: the bundle was **written into the
repo root for you, next to `package.json`**, and `git bundle verify` passes against your repository.
The merge and the push are still yours.

⚠️ **GitHub's `main` is at `6978b96`** — checked with `git ls-remote origin` before these notes were
written — and this bundle fast-forwards from exactly that. It was round-trip tested: a fresh clone of
`main` from GitHub, fetch the bundle, `git merge --ff-only`, `npm ci`, `npm test`.

```powershell
git fetch origin                            # origin/main should be 6978b96
git status                                  # expect nothing modified
git log --oneline -1                        # expect 6978b96 locally too
git fetch phase-v3b.bundle "refs/heads/main:refs/heads/v3b-work" "refs/tags/v3b:refs/tags/v3b"
git merge --ff-only v3b-work
git branch -d v3b-work
git log --oneline -12                       # eleven new commits on top of 6978b96

npm test                                    # 23 green
npm run build
npm run harness -- --seasons 200            # the market rows print under the goods table
npm run dev                                 # and go and play a season — see below

git push origin main
git push origin v3b
del phase-v3b.bundle
```

If `git log --oneline -1` does not say `6978b96`, stop and tell me what it does say rather than
resetting anything.

**`package-lock.json` is untouched**, so no reinstall.

**Optional — the `v3a` tag (correction 2).** It points at `18a5bfb`, which is not on `main`. If you
want `v3a` to be the commit on `main` it was meant to be, this moves it; it is a force-push of a
published tag, so it is your call, and leaving it alone costs nothing:

```powershell
git tag -f v3a 6978b96
git push -f origin v3a
```

Three smaller things:

- **`design/space_dog_racing_economy.xlsx` changed**: 45 rows added or updated and 6 retired, written by
  the new `packages/engine/scripts/add-phase-b-rows.ts` (TypeScript, idempotent, against the same
  `xlsx` library the reader uses). `balance.json` was regenerated with `npm run balance`, never
  hand-edited. The workbook has no formulas and no cell styles, both checked, so the round-trip loses
  nothing.
- **A `v3a` save will not load** — it lands on the title screen — and no `v3a` action log can replay.
- ⚠️ **Design documents changed**: `design/GDD_V3.md` (§2.1's calendar, §12's `foodBand`, and decision
  rows B1–B9), `design/BUILD_PLAN_V3.md` (A7 moved into Phase C) and `design/CANON.md`. CANON requires
  the **claude.ai Project mirrors to be re-synced**, and that is a separate job — ask a Cowork session
  to *sync the project docs from the repo*.

---

## ⚠️ What to play for — the v3b checklist

**`v3b` is the first build where the economy is a game**, and Phase A's "good so far" was a verdict on
a build that deliberately had nothing to spend money on. The harness can say the market is a road; it
cannot say whether it is a decision, and at a table of six identical agents it *cannot* show variance
coming back. You can. Play a season against five AIs, and if you can, a second one with another person
at the table.

1. **Can you tell, at a glance, whether a price is good?** The Price Range column is the entire bet
   §6.2 makes. Look at a row, read "292, 60 ▕━━━●━━━▏ 480", and decide. If you found yourself opening
   another screen or remembering last week, it has failed. *Also: did you ever notice the next-stop
   line under the table, or the price you get by hovering?*
2. **Did your dog's dinner ever feel like a decision?** §6.4's claim is that the best move in the game
   is catching your dog's dinner on sale. Set a named diet in week 1, then watch: did you ever switch a
   dog to Ambrosia because it was cheap, or sell your Vat Steak in a week it was dear and let the dog
   eat Mash? Or did you set it once and forget it? *The AI never does either — the fed column shows it
   almost never eats an exotic — so this is the one question the harness has no answer to at all.*
3. **Did the constraint change over the season?** Cash should bind early and the hold later. The agent
   barely graduates — ~15% of stables are hold-bound in any week, flat until the Grand Final. Did
   *you* feel yourself move up the ladder, or did one good stay obviously correct all season?
4. **Did the empty hold ever hurt?** It is the only running cost in the game. Run out on purpose once —
   sell everything after the races — and check the Kennel warned you by name before you ended the
   turn. Then: was 10 fitness a real loss, or a shrug?
5. **Was loading the hold to the roof visibly a trade?** Go heavy for two weeks and read the turn order
   panel. Did "heavy hold: 20 − 46 ÷ 5 + 4 = 14.8" make it feel like a choice you made rather than a
   punishment you received? Did going last to the shelf ever cost you a good you wanted?
6. **Six goods — too many, or not enough?** §10.1 budgets "up to six market lines, realistically two".
   Count your presses in the Market on a typical week. Two, or a table you scrolled?
7. **Does a planet feel like somewhere now?** §12 moved the planet's economic identity into the food
   map. Did "cheap for Scrapmeat" at the Drift or the Holy Bark monks paying for Ambrosia ever change
   where you wanted to be, or what you carried there?
8. **And the standing question**: did any week present a choice you had to think about?

---

## Carried forward

- **⚠️ A3 is wrong and the deal is not equal (correction 3).** Dealt dogs rate 44–55; the best stable
  starts a median 16 rating points ahead of the worst, summed across three dogs. V2's promise is broken
  by the weights, not the budget. A deal question, not a market one — whoever owns it should decide
  between dealing to a rating and weighting the budget.
- **⚠️ `autoplan%` is 30.1% and Race-or-Rest is 95.0% automatic, and the market cannot move either.**
  It measures the entries, and the market sits beside them. Phase C's running styles and public
  declarations are the phase this row belongs to, and it should be that phase's headline.
- **⚠️ The p90/p10 spread is 2.31× and will stay there at an all-Normal table.** The price distribution
  deliberately adds little luck, and identical agents cannot differ in skill. Measure variance between
  *different* players — Hard against Normal, or people — not across six copies of one.
- **Hard has no market edge, on purpose.** Its trading is Normal's. §6.4's "exotic food in the cheap
  weeks" — set a dog to Ambrosia when Ambrosia is in the bottom quarter, sell diet food when it is
  dear — is the obvious Hard behaviour and the prime candidate for putting Hard back in its 63–68%
  band. Hard beats Normal 47.5% today.
- **The hold rarely binds.** Crossover 4.3 meets its band on a flat curve. The levers are the agent's
  80% spend fraction and the shelf depth, which caps the top three goods at ~28 crates a planet; do
  not touch the bands.
- **Mean end worth is 40,242, 242 over its band**, because the market is a new road. A GDD decision if
  the band should move, not a tuning job.
- **The click budget is 10.5, and the hub walk does not trade.** A person who works the Market will
  spend more. §7.5's split view is still the cheapest two presses in the game.
- **A7 is Phase C's.** `fadeStart` becomes an absolute distance there, alongside running styles; the
  stat-leverage row is now in Phase C's acceptance table.
- **The `v3a` tag is off `main`** (correction 2) until you move it.
- **Events still describe v2's goods in a few flavour lines** (Kibble pirates, the "Kibble glut" card
  id). The ids are save keys and asset names and stay; Phase D rewrites the deck.
- **There is now a row writer**: `packages/engine/scripts/add-phase-b-rows.ts`. Copy it for Phase C
  rather than reaching for openpyxl — it is idempotent, it deletes as well as adds, and it checks the
  two properties of the workbook that make rewriting it safe.
