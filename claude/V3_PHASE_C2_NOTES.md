# V3 Phase C2 build notes: the race, retuned (23 September 2026)

**Status: Phase C2 is complete and tagged `v3c2`.** There are eight commits on `main` after `5bc0165`,
which is where GitHub's `main` is. I checked that with `git ls-remote origin` before writing these
notes rather than assuming it. **Nothing is pushed.** The bundle and the commands are at the end; it
is a plain fast-forward.

One question went to Jesse mid-phase, because the prompt said to ask it: no sane hot pace reached
+4. He chose **option A: a +2 floor, with the style re-balance that keeps the calendar even**
(C12, C13).

The golden snapshot changed **four times**. Each change is in a commit whose message says so and
why. Four other commits say in their message that the snapshot did **not** move.

| | | golden |
|---|---|---|
| `3005a97` | Add the hot pace rows to the spreadsheet | unmoved |
| `557c34d` | **Add the hot pace, with the style re-balance it forces (C12, C13)** | **move 1** |
| `ea50653` | **Add the run-in: the whole field tires into the line (C14)** | **move 2** |
| `05e3229` | **Refit `oddsScale` to 19 on the real-field reading (C15)** | **move 3** |
| `d08d737` | Commentary for the hot pace; the `--styles` rows and `--hotGrid` | unmoved |
| `471929d` | Two property tests: the hot pace and the run-in | unmoved |
| `e7d18b0` | **`STATE_VERSION` 7 → 8, `SAVE_VERSION` 6 → 7** | **move 4** |
| *(this one)* | The notes, the prompt, GDD_V3's C12–C15, BUILD_PLAN_V3 and CANON | — |

| | `stateHash` |
|---|---|
| `v3c` | `31f93a85…` |
| + the hot pace and the re-balance | `807c4fae…` |
| + the run-in | `bad1886b…` |
| + `oddsScale` 19 | `3f7e4609…` |
| + the version bump (`v3c2`) | `da2d00a2…` |

`npm test` is **28 green** at `v3c2`: Phase C's 26, plus two new tests in `properties.test.ts`. **No
existing assertion was edited.** Two names were added to the file's import list. All eight commits
are signed.

---

## ⚠️ Read this first: four things the record should know

1. **The kill switch's floor is now +2, not +4. Jesse chose it with the full grid in front of him.**
   In real seasons, 79% of races have two or more front-runners. Any hot pace strong enough to
   reach +4 therefore made the front-runner the worst style across the calendar. With the styles
   re-balanced to even, the rule can only move wins between a lone front-runner and a crowded one,
   and a closer collects about two points of that. Details under Miss 1.
2. **Two numbers on the style curve moved.** The prompt said not to touch it. The shape is the same,
   but the front-runner's fade shift went −0.07 → −0.05 and the closer's +0.06 → +0.035. Jesse chose
   that in option A (C13), and the run-in added the last half-hundredth (C14).
3. **The finishes were fixed with a new pair of cells, the run-in, not with one of the listed
   dials.** None of those dials could reach the target without breaking calibration (Miss 2). Over
   the last 15 m every dog slows alike, reaching 50% at the line. **It reads only where that dog is,
   so it pulls nobody back.** Nobody gains time on anybody. The same time gap just shows as fewer
   metres. That is honest about what it is: the finishes *look* closer. Nobody wins by less time than
   before.
4. **In practice, "a hot pace" means "two or more front-runners in the race".** With 4 m at the head
   and the whole field bunched out of the boxes, it lights in 99.8% of two-front-runner fields and in
   78.7% of real races. What stays emergent is **how much** each dog pays, which depends on how long
   it stays in the lead group. Checklist question 2 asks whether that is enough to see.

---

## The acceptance table

Synthetic rows use 6,000 races a cell. Rows read off the game use 800 all-Normal seasons (24,000
races) unless marked otherwise.

| Measure | Target | Read | |
|---|---|---|---|
| Closer's win %, 3 front-runners vs 1 (hot pace on) | ≥ 4 points, **or Jesse decides the floor** | **+2.3** (12.0 → 14.4) against the **+2 floor he chose** | **MET** (the floor) |
| A lone front-runner, vs `v3c` | not worse off | **15.8%** (v3c 14.2%) | **MET** |
| Style no-advantage across the calendar | within 1.5 points | 11.8 / 12.7 / 13.0, **1.2 apart** | **MET** |
| Winning margin, median | 4–7 m | **6.3 m** (mean 9.8) | **MET** |
| Photo finishes | ≥ 3% | **3.5%** | **MET** |
| Stat leverage at 480 m | speed > accel > stamina, all 14–26% | **24.1 / 17.3 / 17.1** (`--stats`, 3,000 a cell) | **MET, by 0.2** ⚠️ |
| Calibration, 65 v seven 50s | 45–60% | **51.8%** | **MET** |
| Real-field house margin / every stable dog | −12 to −15% / ≤ +2% | **−12.9% / +2.3%** (200 seasons: −12.6% / +0.6%) | **MET / over by 0.3, within a standard error** ⚠️ |
| Expression's variance share | below fitness, above form | 3.0 / **2.3** / 1.1 | **MET** |
| Lead changes per race | ≥ 1.0 | **2.68** | **MET** |
| `npm test` green, snapshot moved in named commits only | ✅ | 28 green; four moves, each named | **MET** |

Two of the MET lines are thin, so here they are in full:

- **Accel over stamina is 0.2 points at 480 m.** At 6,000 races a cell it reads 17.3 against 17.2.
  The run-in is not what closed it. Most of it is the hot pace. `--stats` fields carry random styles,
  and an accel dog gets to the front and gets burned: accel went 18.3 → 17.5 at the hot-pace commit,
  and the run-in took 0.2 more. Stamina still climbs with the trip: 13.4 / 17.1 / 23.2.
- **A stable dog backed blind reads +2.3% at 800 seasons and +0.6% at 200.** The standard error is
  about 0.8 points. At `oddsScale` 19.25 the same run reads +2.0%, which does not justify another
  snapshot move. See C15.

### The rows that carry over (800 all-Normal seasons)

| | Target | `v3c` | `v3c2` | |
|---|---|---|---|---|
| Races entered per weekend | 1.8–2.4 | 2.02 | **2.02** | **MET** |
| Races per dog | 5–7 | 6.75 | **6.74** | **MET** |
| Mean end worth | 25–40k | 39,143 | **39,207** | **MET** |
| Food as a share of gross | 20–35% | 31.0% | **30.9%** | **MET** |
| Crossover week | 4–7 | 4.3 | **4.3** | **MET** |
| p99 trading leg | < 40% of worth | 13.7% | **13.7%** | **MET** |
| Empty hold at the jump | < 5% | 0.2% | **0.1%** | **MET** |
| Ambrosia on one shelf | ≤ 8 | 5.5 | **5.5** | **MET** |
| Fitness at declaration / under 60 | 60–80 / 10–25% | 68.6 / 26.2% | **68.6 / 26.3%** | ⚠️ under 60 still missed by 1.3, not tuned |

**The market did not move.** No row in it shifted by more than noise.

---

## The diagnostics, reported whatever they said

| | `v3c` | `v3c2` |
|---|---|---|
| `autoplan%` (200 seasons) | 27.4% | **27.6%** |
| …entries / …states | 27.4% / 99.2% | **27.6% / 99.1%** |
| apLoss | −54 ± 366 | **−444** (−1.1%) |
| p90/p10, all-Normal | 1.87× | **1.89×** |
| p90/p10, 3 Hard v 3 Normal (400 seasons) | 3.24× / 1.95× | **3.45× / 1.88×** |
| **Hard beats Normal** | 51.5% | **53.1%** |
| `hub-clicks` | 10.6 | **10.5** (6.5 decisions, 4.0 navigation) |
| betting, a stable-season | −1,193 | **−1,038** |

**`autoplan%` did not move.** The hot pace does make the field matter: a closer is worth two more
points in a crowd, and a lone front-runner 1.6 more than at `v3c`. But the Normal AI does not read
field shape and the autoplan does not either. So this is a better game for a human who reads the
board, and it cannot yet show up in a row about the AI. Hard gained 1.6 points without any new
behaviour. **Hard still does not read the field.** That remains the obvious next Hard edge, and
there is now something for it to read.

---

## Miss 1: the kill switch, and the floor Jesse set

**The rule as built (C12).** While the leader is inside the first third, the pace goes hot if two or
more runners whose style `lightsPace` are within **4 m** of the leader. While the pace is hot, every
runner within **6 m** of the leader pays with its fade point moved earlier. A whole window costs
**90 m**, charged in proportion to the ground the runner covers in that group. The rule reads
positions at the start of each tick. It makes no rng draw, and it is a style row, not a branch.

**The sweep.** The rule alone runs on the `v3c` style curve. Figures are 6,000 races a cell;
`npm run harness -- --styles --hotGrid` prints it again. Each cell reads: closer's win % with 1 / 2 /
3 front-runners, the gap, then the calendar FR / ST / CL and its spread.

```
  lights group cost   closer 1 / 2 / 3     gap    calendar FR / ST / CL   spread
  rule off            13.1  13.1  12.8    −0.3    13.0  11.9  12.7     1.1
  2 m    4 m    90    13.1  13.4  14.2    +1.2    11.8  12.3  13.4     1.7
  2 m    6 m   120    13.1  13.7  15.0    +1.9    11.4  12.3  13.8     2.4
  2 m    8 m   180    13.1  14.1  16.2    +3.2    10.8  12.3  14.4     3.6
  4 m    4 m    60    13.1  14.2  14.8    +1.7    11.2  12.5  13.8     2.7
  4 m    6 m    60    13.1  14.2  15.0    +1.9    11.2  12.3  13.9     2.7
  4 m    6 m    90    13.1  14.6  16.3    +3.3    10.4  12.5  14.6     4.2
  4 m    6 m   120    13.1  14.9  17.4    +4.4     9.6  12.6  15.2     5.6
  4 m    8 m   120    13.1  15.2  17.9    +4.8     9.7  12.4  15.4     5.7
  6 m    4 m   120    13.1  16.0  17.5    +4.5     9.2  12.8  15.5     6.3
  6 m    6 m   120    13.1  16.9  19.9    +6.8     8.4  12.8  16.3     8.0
  6 m    8 m   180    13.1  19.1  22.9    +9.9     6.8  13.1  17.6    10.9
```

These are selected rows; there are 45 cells in all. The rule does what the prompt designed it to
do: **the closer collects, not the field.** At 4 / 6 / 120 the closer gains 4.4 while a front-runner
with two rivals falls from 13.2 to 9.4. The trouble is the calendar. **79% of real races hold two
or more front-runners** (60 seasons: 0 FR 4.9%, 1 FR 16.1%, 2+ 79%). So the crowded field is the
normal case, and a rule that burns crowds burns front-runners in general.

**Re-balanced to even, the gap falls back.**

```
                                        gap    spread   lone FR   paid (3 FR) vs own fade
  A. 4/6/90, FR −0.05, CL +0.04         +2.2    1.0      16.1      24.6 m vs 24.0 m        ← built
     4/6/60, FR −0.06, CL +0.05         +1.6    1.1      15.2      16.4 m vs 28.8 m
     4/6/120, FR −0.05, CL +0.04        +3.1    2.3 ✗    16.1      32.8 m vs 24.0 m ✗
  C. 4/6/240, FR −0.01, CL +0.04        +4.1    2.1 ✗    19.5      65.5 m vs  4.8 m ✗
```

This is Phase C's cap, now pinned down. If no style may win across the calendar and most fields
already carry a crowd up front, the rule can only move wins between a lone front-runner and a crowded
one, and an eight-dog field hands the closer about two points of that. Reaching +4 while the calendar
stays even means removing the front-runner's own fade and replacing it with the hot pace (option C).
Even that left the calendar 2.1 apart.

**"The fade cost is never larger than the fade itself"** was read as follows. What a burned
front-runner actually pays, in metres of fade point, is compared with its own style fade shift at the
mean expression (0.8 × 600 m × the shift). Option A sits at the line: 24.6 m against 24.0.

**Also reported:** a front-runner's win % with 0 / 1 / 2 other front-runners is **15.8 / 12.8 / 11.7**
(`v3c`: 14.2 / 13.7 / 13.2). The pace goes hot in **78.7%** of real races.

## Miss 2: the finishes, and why the dial is new

I diagnosed before choosing. Each change below was applied to the same 1,800 real fields (60
all-Normal seasons), re-run:

```
                                   median   photos   under 2 m   top two within 3 pts
  as played (v3c)                   10.7 m    1.1%     10.9%       10.3 m
  re-run, v3c                       10.8      1.7      10.7        10.7
  no race-day luck                   5.5      3.1      20.3         5.0
  no tick noise                     10.6      2.3      11.7        10.3
  no form                           11.0      1.6      11.3        10.8
  the fade over 600 m               11.8      1.4      10.3        11.5
  no fade at all                    12.7      1.3      10.7        12.6
```

**The prompt's diagnosis stands.** The spread is made inside the race, and race-day luck is most of
it. **But luck is also what keeps calibration honest.** At `raceLuckSd` 1.2 a rating-65 dog wins 79%
against seven 50s; at 0.8 it wins 91%. The band is 45–60%, which allows about 1.9, and at 1.9 the
median is still 9.5 m. Tick noise does nothing to the margin. A harder or longer fade makes the
margin *wider*, because it spreads the field by stamina and style faster than it slows it.

**What a margin in metres is.** A margin is a time gap multiplied by the speed at the line. A7
changed a stamina-50 dog's speed at the 480 m line from half pace (the fade was a fraction of the
trip and was always complete by the line) to about 85% of it. The median went from 7.3 m to 10.6 m.
So the dial is the field's speed at the line, applied to everybody alike. Re-shaping each dog's own
fade toward the line did not work: a fade complete by the line at 0.5 moved calibration to 60.5% and
stamina ahead of accel. A field-wide run-in does work, because it reads where the dog is and nothing
else.

```
                                   median   photos   under 2 m   480 m speed / accel / stamina
  v3c + hot pace                    10.3 m    2.2%     11.9%     23.9 / 17.5 / 16.8
  run-in 40 m / 0.50                 5.6      4.1      20.7      23.7 / 17.2 / 17.7  ✗ stamina
  run-in 15 m / 0.50                 6.2      4.4      20.4      23.8 / 17.4 / 17.2  ← built
  run-in 10 m / 0.55                 6.3      4.5      21.2      23.8 / 17.4 / 17.2
  luck 2.0 + run-in 40 m / 0.45      5.7      3.7      21.2      (luck is calibration's dial: left alone)
```

**Why it is short.** A run-in gives the last metres to whoever is quickest over them, so a long one
favours stamina and closers. At 40 m it put stamina ahead of accel. At 15 m the effect is small,
and the closer's fade shift was trimmed +0.04 → +0.035 (C14) to put the calendar back to 1.2
apart. As played across 800 seasons: **6.3 m median, 3.5% photos, 20.7% under 2 m**, and 6.2 / 6.3 /
7.2 m by top-two rating gap (within 3 / 3–8 / 8+).

**⚠️ What it looks like.** The screenshot shows the field closing in the last few metres. Everybody
slows through the line, and that is what the eye reads as a close finish. v3b's dogs also finished
at half pace. Question 4 of the checklist asks whether it looks like braking.

## The book (C15)

The race model moved under the book twice. `--calibrate`'s least squares went from 18.75 **to 18**,
and the real-field reading said that was the wrong direction:

```
  a Bone a runner, to win         17.5     18     18.75     19     19.25    19.75
  every runner (house margin)    −7.5%  −9.9%  −11.8%  −12.6%  −13.6%  −13.5%
  every stable dog               +5.8%  +2.8%   +1.4%   +0.6%   −0.5%   −1.2%
  (200 all-Normal seasons at each scale, played through so the AI bets against what it sees)
```

**19 is the smallest step that puts both rows in band** and keeps a sliver of D1's edge. At 800
seasons it reads −12.9% / +2.3%, as reported above. The style edges were left alone, because the
scope said no betting changes; fitted against the sheet, all nine are within a point.
`determinism.test.ts` passes unchanged at 19.

**What the hot pace did to the field-shape overlay.** A lone closer in a field of three or more
front-runners returns **+2.2% a Bone**, against −12.9% for the average runner (2,982 bets). That is
§5.6's deliberate overlay, finally with a rule behind it. Backing every lone closer blind returns
−2.7%, which still loses. The overlay pays a player who reads the board, and it is not free money.

---

## The build, item by item

### Item 1: the hot pace (`557c34d`)

- **A row per style.** `RunningStyle.lightsPace` is read from `Front-runner / Stalker / Closer:
  lights the pace (1 = yes)`. The rule counts that flag and never asks for a style's name.
- **Four cells:** the window (0.333 of the trip), the distance at which the pace lights (4 m), the
  lead group (6 m) and the cost (90 m for a whole window).
- **No rng.** A property test proves that a lone front-runner gives an identical race whatever the
  cost, and leaves the rng where it was.
- **A `hotPace` event**, once a race at most, naming the two front-runners, plus `RunNote.hot`, each
  runner's share of the window spent in a hot lead group.

### Item 2: the run-in (`ea50653`)

Two cells: `Race: the run-in, the last metres of every trip` (15) and `Race: speed lost at the line
in the run-in` (0.5). A property test proves that a field of equal dogs is identical up to the
run-in and never finishes wider than it would without it.

### Item 3: the harness and the commentary (`d08d737`)

- **`--styles` row 3** is now the hot pace: the closer's 1 / 2 / 3, the front-runner's 0 / 1 / 2,
  the hot share and the +2 floor.
- **Row 6** gains the diagnosis's breakdown: median, photos, under 2 m, the median by top-two gap,
  and the hot share of real races.
- **`--styles --hotGrid`** prints the sweep.
- **Commentary.** A `hotPace` call when the event fires, for example *"Scrawny Wonder will not let
  Deluxe Slobber go, and they are burning each other up out there."* A closer who gets up after a hot
  pace is called as **picking up the pieces**. `race-view-check` over five seeds and 150 races: the
  pace lit in 115 races and was called in all 115. piecesPicked 18, closerGot 2, burnedOut 44,
  fromTheFront 50, stalked 47, flatDay 32, aloneInFront 26, closerShort 13. Eight photo finishes.
  Every race replays identically.

### The versions (`e7d18b0`)

`STATE_VERSION` 7 → 8 and `SAVE_VERSION` 6 → 7. **Verified, not only asserted:** a `v3c`-shaped
blob (`v: 6`) reads back as `null`, which lands on the title screen.

---

## Verification

| | |
|---|---|
| fresh clone of `5bc0165` | 26 green, lint clean, 20-season harness ran, `season-check` passed, snapshot taken |
| `npm test` | **28 green**; golden moved 4×, each named |
| `npm run lint` / `npm run build` | clean / → `packages/web/dist` |
| `season-check.ts` | every seed to week 10, every log replays; 100 declarations, 97 Race/Rest changes, 67 trades, 228 bets |
| `race-view-check.ts` | 150 races replay-identical, 10.8 calls each, 8 photos; the tally above |
| `hub-clicks.ts` | 10.5 a weekend |
| `--seasons 800` | the tables above |
| `--calibrate` | 51.8%; best fit 18, sheet 19 (C15) |
| `--stats` | 24.1 / 17.3 / 17.1 at 480 m |
| `--autoplan --seasons 200` | 27.6%; entries 27.6%, states 99.1% |
| `--styles --seasons 800` | rows 1–6 above |
| 3 Hard v 3 Normal, 400 seasons | Hard beats Normal 53.1% |
| screenshots | a hot-pace race at 6 s (the call on the bar), the same race at 10 s, a photo finish on the line |

The screenshots were taken from a preview build served with Playwright, from a save blob generated
by the engine. The resume path in `gameStore` skips re-watching a week's races, so a throwaway build
with that one line relaxed was used for the capture. The patch was never committed.

---

## To push

This was built in a clone in the cloud and arrives as **`phase-v3c2.bundle`**, written **into your
repo folder, next to `package.json`**. Your working tree was not touched. The only git commands run
in it from here were `git log`, `git rev-parse` and `git bundle verify`.

⚠️ **GitHub's `main` is at `5bc0165`**, checked with `git ls-remote origin`. The bundle
fast-forwards from exactly there. It was round-trip tested: fresh clone, fetch the bundle,
`merge --ff-only`, `npm ci`, `npm test` 28 green.

```powershell
git fetch origin                            # origin/main should be 5bc0165
git status                                  # expect nothing modified
git log --oneline -1                        # expect 5bc0165 locally too
git fetch phase-v3c2.bundle "refs/heads/main:refs/heads/v3c2-work" "refs/tags/v3c2:refs/tags/v3c2"
git merge --ff-only v3c2-work
git branch -d v3c2-work
git log --oneline -9                        # eight new commits on top of 5bc0165

npm test                                    # 28 green
npm run build
npm run harness -- --styles --seasons 200   # the Phase C2 rows
npm run dev                                 # and go and watch — see the checklist

git push origin main
git push origin v3c2
del phase-v3c2.bundle
```

If `git log --oneline -1` does not say `5bc0165`, stop and tell me what it does say rather than
resetting anything. **`package-lock.json` is untouched.**

- **`design/space_dog_racing_economy.xlsx` changed.** New rows come from
  `packages/engine/scripts/add-phase-c2-rows.ts`, the hot pace's seven and the run-in's two. Phase
  C's two fade-shift rows were updated in place. `oddsScale` lives in `balance.extras.json`, as it
  always has.
- **A `v3c` save will not load**; it lands on the title screen.
- ⚠️ **Design documents changed:**
  - `GDD_V3.md`: decision rows C12–C15, notes in §5.1, §5.3, §5.6, §7.2 and §11, and §14 Q10–Q11.
  - `BUILD_PLAN_V3.md`: a Phase C2 section.
  - `CANON.md`: the `v3c2` tag.

  The claude.ai Project mirrors are **now three phases behind**. Ask a Cowork session to *sync the
  project docs from the repo*.

---

## ⚠️ The v3c2 checklist: five questions, multiple choice

Play a season with the race view on, at 1× for the races you are in.

1. **Did the finishes feel closer?** *Yes, much · A little · No difference · Too close now*
2. **Did you see a hot pace happen, and did the closer get there?** *Yes, and the closer came
   through · I saw the duel but the closer didn't benefit · Never noticed one*
3. **Did it change where you entered your closer?** *Yes, into the race with the most front-runners ·
   Sometimes · No, I still entered by the trip*
4. **Does the last few metres look right?** *Looks like a tight finish · Looks like everyone
   brakes · Didn't notice*
5. **Does anything feel worse than `v3c`?** *No · Front-runners feel weak · Races feel random ·
   Something else*

---

## Carried forward

- **The kill switch's floor is +2 (C13).** If question 3 says players do not enter by field shape,
  two points is too small to see. Option C, which hollows out the front-runner, is in the grid and
  the notes.
- **Hard still does not read the field.** There is now something to read: a lone front-runner is
  worth +1.6 points, and a closer in a crowd +2.3. It is Hard's obvious edge for Phase D or later.
- **Accel over stamina at 480 m is 0.2 points.** The next change that touches the fade or the early
  pace will cross it. Watch `--stats` first.
- **A stable dog blind: +2.3% at 800 seasons.** This is within a standard error of the +2 line. If a
  later phase moves the race again, refit on the real-field reading, as C7 and C15 did.
- **Under 60 at declaration: 26.3%**, band 10–25. `hub-clicks` is 10.5 against a limit of ≤ 10.
  Both are reported and neither was tuned.
- **The row writer is `packages/engine/scripts/add-phase-c2-rows.ts`.** Copy it for Phase D.
