# V3 Phase D2 build notes: the people (24 September 2026)

**Status: Phase D2 is complete and tagged `v3d2`. Phase D is complete.** It was built in a clone in
the cloud and landed in Jesse's repo folder as a fast-forward (the mechanics are at the end).
**Nothing is pushed**; the two push commands are the last thing in these notes.

D2 is the second of Phase D's two sessions: **the people**. Staff on commission, trainers offered in
the Bar, sabotage and the bought trap draw, Hard reading the field, and Jesse's call to drop the
"plan the week" press. D1 built the deck.

No question went to Jesse mid-phase. The golden snapshot moved **six times** and its action count
once more, each in a commit whose message says so and why; seven commits say it did not move.

| | | golden |
|---|---|---|
| `8a52649` | Spreadsheet rows: staff cuts and sizes, the nobble, the stewards | unmoved |
| `9c6d9c1` | **Drop the plan-the-week press: the week follows the declarations** | action count only |
| `b079b94` | **Staff: 24 trainer rows, two dealt a stable, commission on purses only** | **move 1** |
| `ec5d71c` | **Staff bonuses, and the `risk` helper across the deck** | **move 2** |
| `8e4059e` | **Trainer offers in the Bar** | **move 3** |
| `c68eadb` | **Sabotage and the bought trap draw, with getting caught** | **move 4** |
| `a7eda08` | Hard reads the field | unmoved |
| `bc3a499` | The screens, the art contract and the click count | unmoved |
| `4f6002a` | `--explore`, `season-check`, property and determinism tests | unmoved |
| `1c1a8ba` | **`STATE_VERSION` 9 → 10, `SAVE_VERSION` 8 → 9** | **move 5** |
| `8537ceb` | The bought box is worth about two points, not 3.5 (re-measured) | unmoved |
| `d368e9a` | Gross prize is the purse before the trainers' cut | unmoved |
| `7f857b6` | **Retune at 800 seasons: a drilling trainer works one dog; three cuts re-priced** | **move 6** |
| `5c1446f` | A trainer's offer shows the trainers, not the card art | unmoved |
| *(this one)* | Notes, prompt, GDD_V3 D9–D16, BUILD_PLAN_V3, CANON | — |

`stateHash`: `v3d1` `5b68cbd3…` → `v3d2` **`1f5e508e…`**.

`npm test` is **35 green**: D1's 31 plus three in `properties.test.ts` and one in
`determinism.test.ts`, all additions. No existing test was edited. All commits are signed.

---

## ⚠️ Read this first: six things the record should know

1. **Mean end worth went out of its band and came back by a rule reading, not only by a dial.**
   With every bonus live it read 40,449 (band 25–40k). Because the deal is random, regressing a
   stable's end worth on the bonuses it was dealt is a clean experiment, and at 800 seasons it said
   one bonus was the whole problem: **+1 stat a week to every dog, at 3%, was worth about 3,900 to
   the stable that held it.** §8.2 says "+1 to one stat per week", and I had built it as one stat
   *per dog*. It is now one stat a week to one dog — the lowest-rated, on its weakest stat (D10) —
   and worth ~640. Three cuts were re-priced by the same regression (the commission dial the prompt
   names): +5 recovery 3 → 5%, next week's six prices 3 → 8%, +10% prize money 5 → 6%. After:
   **39,193**, every bonus within about a standard error or two of neutral. `dogOfferRatingMean`
   and the Strip were not touched.
2. **The bought box is worth about 2 points on tight bends, not 3.5**, and the screens now say so.
   The re-baseline showed boxed runners winning at their book price, so I measured the rail on
   today's race model: +2.1 tight, +1.2 medium, +0.7 wide, nothing on a straight (eight equal
   dogs, 20,000 races a track). `race/draw.ts` still held v2's 0.035 from D37; nothing read it, so
   nothing noticed the race model move under it. It is 0.021 now, and the card and the Race Office
   print `boxWorthText(track)`, which reads it. The race model is untouched.
3. **Hard beats Normal 50.7%** (800 seasons, 3 v 3; band 63–68%, `v3d1` 50.5%). Every one of the
   five new pieces is inside the 2.5-point standard error, and all five together read *−2* (not
   significant). The one thing measured this session that moves the head-to-head is not a D2 piece:
   **Hard betting like Normal reads 54.4%** (300 seasons), because Hard's own-dog edges at 4–6× the
   stake add 4,700 to its *mean* and widen its spread so much that its *median* sits under
   Normal's. Not adopted — it trades mean for median, and that is a call for Jesse (carried forward).
4. **Gross prize is now the purse before the trainers' cut** (`d368e9a`). `roadSplit.ts` had said
   Phase D's commission would land in costs; my first build banked the purse net of the cut, which
   moved Phase B's food-share row up on money nobody traded. This is named because it moves that
   row by about two and a half points.
5. **season-check's sabotage row is checked across the run, not per season.** At its own target —
   one sabotage in 40–70% of seasons — about a third of honest seasons have none, so a per-season
   row would fail by design (seed 7 did). Dog offers and staff offers are per season. Proved both
   ways: zeroing the nobble cards' weights fails the run; zeroing the trainer cards' fails all five.
6. **Halving injuries is worth nothing, and the free local runner is why.** The bonus does halve
   them (0.66 a stable-season against 1.37), but its holders race *fewer* times (21.4 v 21.8)
   because an injury almost always lends the stable a free Bronze runner (D6). So an injury is
   close to free, and §14 Q4 has a new wrinkle. Reported, not tuned.

---

## The acceptance table (the rest of BUILD_PLAN_V3 Phase D)

800 seasons, six Normal stables, unless the row says otherwise.

| Measure | Target | `v3d2` | |
|---|---|---|---|
| Events in the deck | ≥ 80, each category ≥ 12 | **93**: Pound 19, Bar 23, Alley 20, Strip 16, Track 15 | ✅ |
| Doors chosen per category, all-Normal | none below 12% | 18.3 / 17.2 / 22.7 / 19.3 / 22.5% | ✅ |
| Commission, share of a stable's prize money | 4–14% | **13.2%** (2,798 a stable-season) | ✅ |
| A stable that wants a dog / a trainer gets a swing | ≥ 2 a season each | **2.93** / **2.19** | ✅ |
| Seasons with at least one sabotage, 6 AI | 40–70% | **69.1%** (1.18 nobbles a season) | ✅ (top) |
| Tipped buzzing / blind stable dog / house margin | +10–30% / ≤ +2% / −12 to −15% | +27.5% / −0.4% / **−11.6%** | ✅ / ✅ / ⚠️ |
| Consecutive seasons share ≤ ⅓ of events (per seat) | ✅ | 13.0% (the table 52.1%) | ✅ |
| `hub-clicks` | ≤ 10.5 (target ≤ 10) | **9.4** | ✅ |
| Phase B rows | in band | food 33.1% · crossover wk 4.4 · p99 leg 13.7% of worth | ✅ |
| Races entered / races per dog | 1.8–2.4 / 5–7 | 2.16 / 6.59 | ✅ |
| Mean end worth | 25–40k | **39,193** | ✅ |
| Hard beats Normal (3 v 3) | 63–68%, or each piece reported | **50.7%**; pieces below | ❌, reported |
| `npm test`; season-check fails on zero sabotages, dog offers, staff offers | ✅ | 35 green; proved both ways (Read this first 5) | ✅ |

⚠️ **The house margin reads −11.6%**, 0.4 outside its band. The same code before the retune read
−12.5%, and the standard error on that row is about 0.7 points, so it is on the line rather than
off it. `oddsScale` and the tip sizes were not touched, as the prompt says.

### Reported, not tuned

| | `v3d1` | `v3d2` |
|---|---|---|
| `autoplan%` (entries / states) | 22.9% (22.9 / 92.3) | **25.6%** (25.6 / 93.6) |
| p90 / p10 | 1.96× | 1.93× |
| Under 60 at declaration | 24.3% | 23.1% |
| Betting income, a stable-season | −995 | −1,033 |
| Calibration (65 v seven 50s) | 51.8% | 51.8% (race model untouched) |
| Winning margin / photo finishes (`--styles`) | 6.3 m / 3.6% | 6.3 m / 3.1% |
| `--styles` row 5, the lone closer blind | −14.2% | **+3.7%** (938 bets; a standard error of ~8 points — noise, and flagged by the row) |

---

## The build, item by item

### 1. Staff on commission (GDD_V3 §8, D9)

`content/staff.ts` has two kinds of row. **A bonus** is one line of §8.2's pool: what it does, its
cut and its size, both sheet cells. **A trainer** is a person — a name, a line, a portrait stem, an
art brief — and one or two bonuses. Their cut is *derived*: the sum of the bonuses' cuts, plus a
2% premium for a pair, capped at 10%. There are 24 trainers, twelve with one bonus and twelve with
two, so with eight stables eight are always out of work. Everything reads `staffBonus(p, id)`; no
code asks who a trainer is.

- **The deal:** two each at `createSeason`, from the shuffled rows, in seating order, after the
  dogs. It moves every draw after it.
- **Commission:** taken in `runRaces` where the purse is paid — after the winnings tax and the +10%
  bonus — on race prize money only, and logged. Payouts carry it; `stats.commission` holds it.
- **Where each bonus lands:**

  | Bonus | Where | Note |
  |---|---|---|
  | +1 stat a week | at the jump, beside `feedOneWeek` | the lowest-rated dog's weakest stat (D10) |
  | +5 fitness recovery | `weeklyFitnessDelta`'s bonus (`restBonus`) | a dog that did not run |
  | Injury chance halved | `rollInjury` | the length is now drawn every time (see below) |
  | Layoff −1 week | at the roll, never below 1 | |
  | Reveals a rival's style | after Explore, before the Market | **public**, by C4 (D11) |
  | Next week's six prices | after Explore; sets `Player.intel` | as the freight clerk does |
  | +10% prize money | where the purse is paid, before the cut | |
  | Explore less likely to go badly | `risk()` / `luck()` in the kit (D12) | 19 rolls moved onto them |

- **The rng:** nothing a trainer does draws. The stat and the dog are rules, the style reveal
  picks the best-rated unread rival dog, and `rollInjury` now draws the layoff length whether or
  not the dog is hurt, so a trainer who changes the chance cannot change how many draws race day
  makes.

### 2. Trainers in the Bar

Four Bar cards (between yards, walked out this morning, an old hand with one trick, an agent with
two), each `unique`. The trainer is drawn on the stable's own stream from whoever nobody employs.
The offer shows the trainer's card beside the two you would let go. **Walk away** is first; then
"Hire — let *name* go" for each slot.

**Normal's rule** (`economy/staff.ts` `hireSlot`): price each trainer against its own weekly prize
money — a share of it for the bonuses that win races, a flat figure for the ones that do not
(`STAFF_WORTH`) — less its cut. Hire into the slot of the trainer worth least if the offer beats that
trainer by **two points of its weekly prize money** (`HIRE_MARGIN`). It hires 37% of what it is
offered, 0.23 a stable-season.

### 3. Sabotage and the bought trap draw (GDD_V3 §9.3, D13, D14)

- **The nobble** — two Alley cards, a man with a syringe (500) and a kennel-boy with debts (350).
  A button per rival, each naming one of that rival's sound dogs, picked on the stable's own stream.
  The job is booked against the **dog** (`GameState.jobs`) and bites if it runs this weekend:
  −25 fitness on the runner in `runnerFrom`, after the book has priced it. The stored fitness never
  changes (a property test checks it).
- **The box** — a steward with a clipboard (250) sells the right at Explore; the new `ChooseBox`
  action spends it in the Race Office once the race is known; `honourBoxes` applies it at the one
  untouched point in `lockDeclarations`, after the shuffle and the wide runners and before the book
  prices the field. Two buyers of one box settle it by booking order.
- **Getting caught** — rolled on race day for every nobble that bit, at the planet's catch chance
  (a planet row: Lagrange Lows 20%, Holy Bark 60%, 35% elsewhere). An 800 fine plus a quarter of what
  the nobbler had on the race, capped at its cash. The whole table is told: a public log line and a
  "Stewards' enquiry" panel on everybody's Results. A box is not rolled for (D14).
- **The rng:** the stewards draw once per stable, in seating order, every race day, whether or not
  a job was booked, so the game's stream never depends on a door. The determinism test books a
  nobble and a box and checks the stream after race day is the same.
- **Normal's rule:** nobble the offered rival dog most likely to beat its own best runner — the
  best-rated — if it outrates that runner and cash is over six times the price. Buy a box on tight
  bends only, and put its richest runner on the rail. Not tuned.

**What it all does** (800 seasons):

| | |
|---|---|
| Seasons with a sabotage / nobbles a season | 69.1% / 1.18 |
| Bit (the dog ran) / caught | 629 / 227 (36% of those that bit) · mean fine 825 |
| Who gets targeted | the net-worth leader 44.8% · a stable above the nobbler 83.3% |
| The victim | won 8.3% of its races against a book price of 23.8% |
| The nobbler, in a race it shared with the victim | won 14.8% against 11.0% |
| A job's cost | its price plus about 300 in expected fines |
| Boxes | 0.05 a stable-season; boxed runners won 11.9% against 11.2% priced (227) |

Normal targets the leader nearly half the time without being told to, because the leader's dogs
are the best-rated. That is what §14 Q1 asks about, and it is emergent, not a rule.

### 4. Hard reads the field (D15)

- **Entries:** `bestAssignment` takes an `adjust(dog, race)` hook. Hard's adds what its dog's
  public style is worth given the front-runners already on the board, counting every hidden style
  and every unfilled trap as a third of one. `FIELD_READ` is `--styles` row 3 in rating points: a
  lone front-runner +2.5, a closer behind three or more +1.4, a front-runner into a crowd −0.6.
- **Bookie:** every posted runner is priced on the field's shape, which the book never sees; own
  runners' edges include it, and anybody's runner it makes better than its price by
  `EDGE_REQUIRED` is backed.
- **Explore:** a card's new optional `hardChoice`. Hard hires on its own price list, nobbles the
  leader's dog when it is not leading, and buys a box on medium bends as well as tight.
- `HARD_KNOBS` moved to `ai/knobs.ts` (re-exported from `ai/hard.ts`) so a card can read it, and
  gained five switches. `--hardD2` ablates them, 3 v 3, 400 seasons:

  | row | beats Normal | Hard mean | Hard p50 |
  |---|---|---|---|
  | as built | 50.8% | 47,435 | 38,545 |
  | no field read in its entries | 51.3% | 46,263 | 38,252 |
  | no field read at the bookie | 50.1% | 47,163 | 38,175 |
  | hires on Normal's price list | 50.8% | 47,467 | 38,545 |
  | nobbles by Normal's rule | 50.9% | 46,990 | 38,672 |
  | boxes on tight bends only | 50.4% | 47,367 | 38,468 |
  | all five off (`v3d1` Hard) | 52.8% | 46,064 | 38,917 |

  Every row is inside the standard error. The field read adds ~1,200 to Hard's mean and nothing to
  the head-to-head: the hot pace is worth one or two rating points, and the head-to-head is decided
  by Hard's betting spread (Read this first 3).

### 5. The plan-the-week press is gone (D16)

`followDeclarations()` sets every stable dog's `weekState` from the declarations — at arrival
(nothing declared, so everybody rests), on every Declare and at the lock. The Kennels shows a
racing / resting / on layoff badge where the buttons were. `SetDogState` stays for the diet and
for a player who wants to mark a dog. The golden season played out identically (only its action
count moved, 685 → 650).

`hub-clicks`: the fixed count is 7, with a note saying why. It reads **9.4**: −1.0 for the press,
−0.8 because the Kennels hotspot no longer flags an "undecided" dog, and +0.02 for naming a box.
`season-check`'s "Race/Rest changes" counter is retired; it now counts dog-weeks checked at the
lock to be in the state the Race Office left, and fails otherwise.

### 6. The deck and the checks

93 cards: D1's 86, four trainer offers, two nobbles and the steward. Every one has two or three
choices, an `aiChoice`, a log line and a story; the nobble has a button per rival and hides the
seats it has nothing for. `--explore` gained the Staff and Sabotage sections, and a measurement of
what box 1 is worth by bends. Property tests (additions): at most two trainers and none shared;
commission equals the commission on the payouts; a nobble leaves the stored fitness as it was; a
bought box is honoured.

### Screens and art

- **Kennels:** a Trainers panel (portrait, name, line, bonuses, cut) and what they have taken.
- **The offer:** the trainer on offer and the two you would let go, as cards; no card art.
- **Race Office:** "The steward's box" — the box buttons, the race if you have several, and what a
  box is worth on this track.
- **Results:** your trainers' cut; a public **Stewards' enquiry** panel; a private **Your business in
  the Back Alley** panel.
- **Hub and season end:** the trainers and their cut.
- **Art:** every staff row has a portrait entry in `scripts/assets.ts`, briefed from its `looks`
  (the first two reuse `trainer-01` and `trainer-02`). `placeholders` wrote 29 stand-ins (22
  portraits, 7 cards); `asset-list` regenerated `design/ASSET_LIST.md`; `asset-check` exits 0.

## Screenshots

From `vite preview` of the build, with saves generated headlessly (seed + log into `sdr.save.v1`).
They are in the session outputs as `v3d2-*.png`:

- **A trainer offer** — seed 1, week 3, Rustgut: an agent with a list offers Old Mossgrave (injuries
  halved, layoffs a week shorter, 8%) against the Brack Twins (10%) and Mother Glass (4%).
- **The Kennels with two trainers** — seed 12, week 1: Big Umbo (10%) and Doc Rumbold (2%).
- **A nobble that landed** — seed 1, week 3: Holy Meteor ran nobbled in the Silver Plate and
  finished 7th. Nobody saw a thing.
- **A nobble caught, the table told** — seed 3, week 5, Ossuary: "Jesse nobbled Chunky of Arrow in
  the Silver Plate. Fined 800 Bones."
- **A bought box in the Race Office** — seed 12, week 1, Hushmarket (tight bends): Grandma Sausage in
  box 1 of the Gold Cup, "worth about 2.1 points of win rate against a random draw".

---

## To push

Landed in your folder as a fast-forward from `d84db64` (`v3d1`), the `main` that `git ls-remote
origin` reported. Your tree was clean before and after, and there is no `index.lock`.
**`package-lock.json` is untouched.** A `v3d1` save will not load; it lands on the title screen.

```
git push origin main
git push origin v3d2
```

- **`design/space_dog_racing_economy.xlsx` changed.** The rows come from
  `packages/engine/scripts/add-phase-d2-rows.ts` (23 rows; one renamed in the retune).
- **Design documents changed:** `GDD_V3.md` (D9–D16, notes in §8, §9.3, §14), `BUILD_PLAN_V3.md`
  (Phase D complete) and `CANON.md` (the `v3d2` tag). All three are synced to the claude.ai Project.

---

## ⚠️ The v3d2 checklist: five questions, multiple choice

Play a season. Go to the Bar and the Back Alley whenever you can.

1. **Did a trainer feel worth their cut?** *Yes, I could see what they did · Some did · They felt
   like a tax · Never noticed them*
2. **Did sabotage make the evening better or worse?** (§14 Q1) *Better — it was the story of the
   night · Better, but it needs to cost more · Worse — it felt spiteful · Never saw one*
3. **Did you buy a box, and could you see it matter?** *Yes, and it did · Yes, and I couldn't tell ·
   Saw the card, didn't buy · Never saw the card*
4. **Did Hard feel like a harder opponent?** *Yes · About the same as Normal · Easier · Didn't play
   Hard*
5. **Does the week feel quicker without the plan-the-week press?** *Yes · No difference · I miss it
   · Didn't notice it was gone*

---

## Carried forward

- **Hard 50.7%.** The measured lever is Hard's betting: with Normal's bets it reads 54.4% and gives
  up 4,700 of mean. Whether Hard should bet smaller — or whether the head-to-head should be the
  measure at all when Hard's mean is 7,000 above Normal's — is Jesse's call.
- **Injuries are nearly free** because the local runner covers them (Read this first 6). If §14 Q4's
  answer is "an injury should hurt", the dial is `localRunnerFitAt` or the loan itself.
- **The box on tight bends is worth two points**, which is less than the 250 a steward charges is
  likely to pay back except as a bet. If Jesse wants it to matter, that is a race-model question
  (the draw constants), which D2 did not touch.
- **The house margin reads −11.6%**, on the line (see the acceptance table).
- **Sabotage is at the top of its band** (69.1%). If playtest says there is too much, Normal's
  nobble rule (six times the price in cash) or the two cards' weights are the dials.
- **Phase E** takes the off-season notice (§2.2), hotseat and multi-season play. The staff notice
  should use `unemployedStaff` and the Bar cards' `hireSlot` rather than a new path.
