# V3 Phase I build notes: a human picks their face, then the long game (29 September 2026)

Built in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3i`**. The fallback is `v3h` (`3c87b58`).

**In one line:** a human now picks one of eight faces on the Title. The long game was measured against
pillar 5's own question, three levers were swept, and **Jesse picked the draft**. At each off-season,
the stable last on the season's standings is offered a replacement dog 15 points above the ordinary
offer (GDD_V3 §2.2, V23).

---

## ⚠️ Read this first: five things the record should know

1. **E7's 48.8% is mostly its window, but the back of the table really was stuck.** At the *start* of a
   five-season game's last season, only 0.8% of stables are mathematically out. So the 48.8% at week 8
   is mostly three weeks of purses set against a lead built over years. The comeback measures were bad
   all the same. The stable poorest at the start of season 3 finished top 3 in 12% of games, where 50%
   would be chance. The poorest at the last season's start won that season 6% of the time (chance 17%).
   So "redefine the target" alone would have hidden a real problem. It was offered, and not picked.
2. **The cause is dogs, not money.** The richer half gains 7.1k more a season. Of that, +8.9k is gross
   purses, from dogs rated 2.6 higher at declaration. Trading, betting, food, trainers and races entered
   are level between the halves. The richer half holds 29k more cash, but cash buys nothing that
   races. That is why the draft works where the trainers' cut did not.
3. **Both goldens moved in the rule's commit (`484f308`), the one-season golden only by a version
   number.**
   - The two-season golden went `dc357422…` → **`d4bb14c3…`**: the draft changes the dog the last
     stable takes at the off-season.
   - The one-season golden went `8dc05e06…` → **`41a8c8b5…`**, but only its `stateHash` moved. An
     off-season notice can now carry `draft`, so `STATE_VERSION` went 12 → 13, and the hash covers
     `state.version`. Every other field of the one-season digest is byte-identical: a one-season game
     has no off-season.

   The prompt expected a golden to move only through a rule. This one moved through the state version,
   in the same commit.
4. **`SAVE_VERSION` is 13**, for the draft, not the faces. A `v3h` save goes to the title screen.
   Verified: a `v: 12` blob reads back null, and the Title offers no Resume. The face picker needed no
   bump: a face is `setup.colour`, which the save always carried, and a save without colours still
   means seat index (checked by loading a colour-less setup).
5. **A renamed AI's face can follow its colour.** The prompt said an AI's face is keyed by its name.
   That is true for every name on the list, which covers every AI row left blank. An AI row the table
   has *typed a name into* falls back to `colour % 12`, so a human's pick that moves that AI's colour
   also changes its face. It is decided once, at Start, and never changes mid-game. Open question 2.

---

## Part 1: the face picker

### The rule

- **A face is a colour.** Picking a face sets the row's `PlayerSetup.colour`. `humanFaceFor` already
  keys the face off `player.colour`, so the face and the swatch always agree. No new field, no engine
  change.
- **`resolveColours`** (`lib/owners.ts`) gives every row an explicit colour at Start:
  1. humans who picked a face, on their pick;
  2. humans who did not pick, on their seat index, bumped to the next free colour on a clash;
  3. the AI rows, the same way, in seat order.

  A table nobody touches gets colour = seat index, exactly as before. A human's face moves only when
  another human picks it. A human's pick beats an AI's seat colour. `createSeason`'s de-dup is
  unchanged, and never fires on a list this returns.
- **No two humans share a face.** A face another human holds is `aria-disabled`, greyed, and named
  ("Blue — grinning antennaed alien, taken by Stable 4"). Pressing it does nothing.
- **The twelve painted owners are not offered.** They are the AI stables. Open question 1 asks whether
  Jesse wants more human faces instead.

### The picker

- On the Title roster, a human row's swatch cell is a button showing the face and the swatch
  ("Face: Red — goggled pilot. Change face"). An AI row keeps its bare swatch.
- Pressing it opens a row of eight face buttons under that row: 8 across at 1280, 4 × 2 at 390. The
  picker sticks to the left edge of the roster, which scrolls sideways on a phone. Each button's
  accessible name is "Red — goggled pilot", plus ", your face" or ", taken by …".
- **Keyboard:** opening puts focus on your own face; Tab walks the faces; Enter picks one and closes;
  Escape closes. Either way focus returns to the row's face button. Checked by the Playwright walk
  (`shots/shoot.mjs`): Tab × 5 + Enter from Red picks Green.

### Colour touches no draw

**`test/colour.test.ts`** is the proof. Four humans and two Normal AIs play two seasons, with the humans
played by the Normal AI so the run is headless. It runs once with the default colours and once with
every colour permuted (`[7, 3, 5, 0, 6, 2]`). The action logs are equal, and the final states are equal
once `Player.colour` is blanked. Every human declared a dog. A seed link carries no colours, so this is
also what makes a shared link replay a game whose humans picked faces.

### Checked, with screenshots in `shots/`

| What | Screenshots | Result |
|---|---|---|
| Title, 1 human: default, picker open, Green picked | `title-1h-*`, `title-1h-picker-*`, `title-1h-green-*` | ✅ |
| Title, 4 humans (rows 0, 2, 3, 5): row 3 picks Blue, row 0 Pink, row 2's picker open with three taken | `title-4h-picker-*` | colours passed `[7, 3, 2, 1, 4, 5]`: Blue beats the AI in seat 1 ✅ |
| Title, 8 humans: only your own face is free | `title-8h-picker-*` | ✅ |
| Start, reload, Resume: the save keeps the colours | `game-4h-resumed-*` | ✅ |
| Hub + leaderboard chip, Results, season end, game end, off-season, at 1 / 4 / 8 humans | `h{1,4,8}-{hub,hub-leaderboard,results,season,game,offseason}-*` | every human face on the leaderboard is the save's colour ✅ |
| All of the above at 1280 and 390 | `*-1280.png`, `*-390.png` | no page errors ✅ |

The in-game screens were reached by building saves headless (`shots/make-saves.ts`) and resuming them.
`season-check`, `hub-clicks` (9.4 a weekend) and the table walk (10.7 / 22.4 passes) are unchanged.

---

## Part 2: the long game

### The measurement (`v3h`, `--game`, six Normal, 200 games a mode)

`harness --game` now prints a **long-game** table and the **richer and poorer halves' ledger**
(commit `f44173a`, tooling).

| Mode | Out @ wk 8, last season (E7) | Out at the last season's **start** | Poorest at the start of s3 / s4 / s5 → top 3 | Last season's leader overtaken | Poorest wins the last season |
|---|---:|---:|---:|---:|---:|
| 3 seasons | 15.8% | 0.0% | 5.0% / — / — | 35.0% | 7.5% |
| 5 seasons | **48.8%** | **0.8%** | **12.0% / 7.5% / 3.0%** | 22.0% | **6.0%** |
| Target 150,000 | 25.2% | 0.0% | 10.0% / 4.0% / 4.4% | 21.0% | 5.5% |

Chance is 50% for "top 3" and 1 in 6 for "wins the last season".

**Where the richer half's extra comes from** (5-season games, seasons 2–5, split at the median start
worth):

| | Richer | Poorer | Diff |
|---|---:|---:|---:|
| Worth gained in the season | 30,294 | 23,201 | **7,094** |
| Purses, gross | 33,666 | 24,807 | **8,860** |
| Trainers' cut (−) | 4,213 | 3,168 | 1,046 |
| Trading | 3,317 | 3,465 | −148 |
| Betting | −874 | −865 | −10 |
| Food eaten (−) | 4,114 | 4,212 | −98 |
| Stewards' fines (−) | 33 | 63 | −30 |
| The rest (dog value, cargo, bills) | 2,546 | 3,236 | −690 |
| Mean rating at declaration | **55.3** | **52.7** | **2.6** |
| Races entered | 20.9 | 20.7 | 0.2 |
| Cash at the season's start | 77,627 | 48,772 | 28,855 |
| Trainers' combined cut | 12.5% | 12.7% | −0.2 |
| Prize-money trainers | 0.56 | 0.52 | 0.05 |

The gap is **better dogs winning more purses**. Cash in hand, trading and trainers are level.

### The sweep

Two scratch rules and one sheet lever. Each was run at four tables with the same seeds:
- `--game`: 400 one-season games, and 200 each at 3 and 5 seasons and both targets
- 400 one-season games for §11's worth, food share and races entered (`shots/aux.ts`)
- 300 two-season games at 2 Hard + 4 Normal, for Hard vs Normal

The scratch rules were:
- **"Last arrives first":** a temporary `arrivalTrailBonus` key, plus four lines in `arrival.ts`. The
  stable lowest on the last leaderboard adds the bonus to its arrival score.
- **The draft:** temporary `draftLevelShift` and `draftCount` keys, plus a `levelShift` on
  `openOffSeason`'s `rollOffer`.

Both were reverted before any commit. The draft was then rebuilt properly from the sheet.

| Setting | Out @ 8 last: 3s / **5s** / T150k | Out @ 8 any, 5s | Out at last start, 5s | Poorest at s3 / s4 / s5 → top 3 | Leader overtaken | Poorest wins last season | 1s worth | 1s poorer | 1s gap | Food | Entered | H v N | 5s end worth |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **`v3h`** | 15.8 / **48.8** / 25.2% | 20.6% | 0.8% | **12 / 7.5 / 3%** | 22% | **6%** | 42,334 | 0.8% | 26,510 | 32.8% | 2.12 | 62.1% | 147,689 |
| cut ×1.5 | 12.9 / 43.0 / 25.3% | 17.3% | 0.5% | 15 / 9.5 / 2% | 25.5% | 8% | 40,910 | 1.0% | 25,235 | 32.8% | 2.12 | 63.1% | 138,429 |
| cut ×2 | 11.6 / 42.3 / 30.3% | 16.9% | 0.3% | 12 / 7 / 1% | 22% | 5.5% | 39,553 | 1.3% | 23,617 | 32.9% | 2.12 | 62.2% | 131,965 |
| cut ×3 | 9.0 / 36.8 / 29.0% | 14.2% | 0.3% | 12.5 / 9 / 3% | 23% | 9% | 36,968 | 2.3% | 21,341 | 33.2% | 2.12 | 63.2% | 115,281 |
| last arrives +3 | 13.0 / 45.4 / 23.4% | 18.1% | 0.3% | 18 / 10 / 1.5% | 22% | 10% | 42,445 | 0.5% | 25,496 | 32.8% | 2.12 | 67.3% | 146,362 |
| last arrives +6 | 9.4 / 39.8 / 18.0% | 15.6% | 0.6% | 20 / 13 / 4% | 25.5% | 12% | 42,324 | 0.3% | 25,921 | 32.6% | 2.12 | 64.4% | 146,001 |
| last arrives first | 9.3 / 40.0 / 18.4% | 15.0% | 0.8% | 31 / 20 / 8.5% | 25.5% | 14% | 42,109 | 0.2% | 23,995 | 32.8% | 2.11 | 64.5% | 146,758 |
| draft +8 | 16.0 / 48.8 / 22.5% | 20.3% | 0.7% | 21 / 10.5 / 3% | 21% | 8% | = | = | = | = | = | 60.6% | 149,757 |
| **draft +15** | 14.3 / **41.3** / 23.2% | 17.9% | 0.1% | **31 / 18.5 / 6%** | 29% | **14%** | = | = | = | = | = | 61.6% | 150,784 |
| draft +25 | 13.8 / 41.5 / 19.2% | 17.2% | 0.7% | 34.5 / 23.5 / 9.5% | 25.5% | 12% | = | = | = | = | = | 61.1% | 153,306 |
| draft +15, bottom three | 10.7 / 39.7 / 18.0% | 15.9% | 0.6% | 24.5 / 10 / 1% | 25.5% | 6% | = | = | = | = | = | 62.0% | 158,226 |

- "Cut ×k" multiplies every `staffCut…` key, the pair premium and `staffCutMax`, as in H. Its numbers
  reproduce H's.
- "=" means unchanged by construction: the draft needs an off-season, and a one-season game has none.
- The `v3h` row reproduces `--game`, and 62.1% Hard vs Normal, exactly. Food share reads 32.8% here
  against H's 32.6%, because `aux.ts` prices food sold at the sell price before the trade.
- Hard vs Normal has a standard error of about 1.6 points, so its 60.6–67.3% spread is mostly noise.
  The comeback columns are one stable per game over 200 games, so about ±3 points.

**What the table says:**
- **The trainers' cut lowers E7 but helps nobody come back.** It shrinks everyone's gains in
  proportion and leaves the dog gap where it is.
- **"Last arrives first" and the draft both about double the comebacks.** "Last arrives first" also
  touches one-season games (gap 26,510 → 23,995). It also overrides §2.3's "turn order is bought with
  an empty hold" for one stable every week.
- **The draft goes at the cause** (dogs), is an offer the stable reads and can decline (pillar 2), and
  touches only games with an off-season. +25 buys little over +15. Spreading +15 over the bottom three
  dilutes it until the last stable no longer gains.

### The question, and Jesse's answer

The table above, a recommendation of **the draft at +15**, and four options: the draft; last arrives
first; change nothing and redefine the target; change nothing at all. (The first attempt at the question
was cut off after the table was sent. It was asked again.) **Jesse's answer: the draft, +15.**

---

## The rule

- **The sheet:** one row under the off-season section, *"Off-season: the draft, last stable's offer
  level above the ordinary (points)"* = **15**, added by `add-phase-i-rows.ts`, mapped to
  `draftLevelShift` in `balance-from-xlsx.ts`. `balance.json` is generated (`6a02772`).
- **The engine** (`phases/offSeason.ts`, `484f308`): `openOffSeason` finds the stable last on the
  season's standings. That is §2.4's order, the one the season's end shows, so a tie goes the way the
  table reads it. Its `rollOffer` gets `levelShift: draftLevelShift`, and its notice carries
  `draft: true`. Nobody is drafted at a one-stable table.
  - The offer makes the same draws with or without the shift. So no other stable's offer, notice or
    candidate moves, and the game's stream is untouched.
  - **`test/draft.test.ts`** checks both: exactly one notice is drafted, and it is the last standing.
    With the shift set to 0, every other offer and draw is identical, and the drafted offer's stats sum
    lower.
- **`STATE_VERSION` 13**, with a history paragraph in `state.ts`.

## What the player sees (`aaa7eda`)

- **The season's end**, read by the whole table: after "The off-season first: …" it says **"Last at the
  table: *name* gets the breeder's pick, a better dog than anybody else is offered."**
- **The drafted stable's retirement window:** the panel's subtitle reads *"last at the table: the
  breeder's pick — a better dog than anybody else is offered"*. The offer itself opens *"Last at the
  table, so the breeder's agent brings you the pick of the litter — a better dog than anybody else is
  offered, for whoever retires one: …"* (`describeRetirementOffer`). Screenshot:
  `shots/h8-offseason-1280.png`.
- It is still the ordinary offer's shape: the age, one true stat and patter that can lie. The stable can
  keep them all.

## Saves

`SAVE_VERSION` **13** (`fa49504`), with a history paragraph in `persist.ts`. A `v3h` log that reached
an off-season took a different dog there, so every `v3h` save goes to the title screen. Verified by
writing a `v: 12` blob: `readSave` returns null and the Title offers no Resume.

---

## The goldens, and the harness before → after

- **Goldens:** both moved once, in `484f308`. Two seasons: `dc357422…` → `d4bb14c3…`. One season:
  `8dc05e06…` → `41a8c8b5…`, by `stateHash` alone (`STATE_VERSION` 13). See Read this first 3.
- **Out at week 8 of the last season, five-season games: 48.8% → 41.3%.** At three seasons 15.8% →
  14.3%; Target 150,000 25.2% → 23.2%.
- **Comebacks, five-season games:**
  - the poorest at the start of s3 / s4 / s5 finishing top 3: 12 / 7.5 / 3% → **31 / 18.5 / 6%**
  - the poorest wins the last season: 6% → **14%**
  - the last season's leader overtaken: 22% → 29%
- **The gap, 1st to last, at a five-season game's end:** 67,668 → 60,868 (2.01× → 1.88×). Mean end
  worth 147,689 → 150,784.
- **Hard vs Normal** (2 Hard + 4 Normal, two seasons): 62.1% → 61.6%.
- **§11's one-season rows are untouched:** 42,334 end worth, 0.8% poorer, gap 26,510, food 32.8%,
  entered 2.12.

### The acceptance table

| Measure | Target | `v3i` |
|---|---|---|
| A human picks one of eight faces on the Title, and the pick sets their colour | ✅, 1 / 4 / 8 humans, 1280 and 390 | ✅ |
| No two humans share a face; a human's pick beats an AI's seat colour; defaults unchanged | ✅ | ✅ |
| Colour touches no draw | ✅, a permuted-colour game | ✅ `colour.test.ts` (four humans, two seasons) |
| A resumed game keeps the face; an old save loads | ✅ | resumed ✅; a colour-less setup still means seat index ✅; a `v3h` save goes to the title because of the draft (`SAVE_VERSION` 13) |
| The picker is keyboard- and screen-reader-usable | ✅ | ✅ |
| The long game measured | ✅ | ✅ |
| Two or three levers swept, Jesse asked one question | ✅ | three levers, eleven settings ✅ |
| His pick built from the sheet | ✅ | the draft, +15 ✅ |
| Out at week 8, last season, 5 seasons; Hard vs Normal; §11's one-season rows | before → after | 48.8% → 41.3%; 62.1% → 61.6%; unchanged |
| Goldens once; tests; lint; `season-check`; build; `asset-check` | ✅ | once, in the rule's commit; **51 green**; clean; passes; ✅; 288 / 0 / 0 |

### The re-baseline

- `npm test` **51 green** (47 + `colour.test.ts` 2 + `draft.test.ts` 2); `npm run lint` clean; `npm run
  build` ✅.
- `season-check`: all seasons played out clean (four humans, two seasons: 217 passes, 0 leaks).
- `hub-clicks`: **9.4** a weekend; the table at 4 humans **10.7** passes, at 8 **22.4**. Unchanged.
- `race-view-check`: every race replays clean (seeds 42, 7, 1234, 90210, 2026; 30 races each).
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**
- `npm run harness -- --game`: as above.

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

Identical to `v3h`'s. A one-season game has no off-season, so the draft never runs.

## Commits

1. `b0a916c` Let a human pick their face on the Title (UI, plus `colour.test.ts`; no golden).
2. `f44173a` Measure the long game in `harness --game` (tooling; no golden).
3. `6a02772` Add the draft's row to the sheet (`add-phase-i-rows.ts`, `balance.json`).
4. `484f308` Add the draft (the rule, `STATE_VERSION` 13, `draft.test.ts`; **both goldens moved**).
5. `aaa7eda` Tell the table who gets the draft (UI).
6. `fa49504` Bump `SAVE_VERSION` to 13.
7. The notes, the prompt (with its correction box), GDD_V3 §2.2, §10, §11 and V23, BUILD_PLAN_V3
   Phase I, and CANON's `v3i`. Tagged **`v3i`**.

---

## Open questions and carried forward

1. ❓ **More human faces?** There are eight, one per saddle-cloth colour, so a face is a colour. More
   faces would need a face that is not a colour, which means a new field and a save bump. The twelve AI
   owners were not offered, per the prompt.
2. ❓ **A renamed AI's face follows its colour** (Read this first 5). If that matters, key a renamed
   AI's face by a hash of its name instead. UI only.
3. ❓ **A seed link carries no faces.** It replays the game exactly (colour touches no draw), but the
   humans get seat-index faces. Adding faces to the link is a small `seedLink.ts` change.
4. ❓ **The pass screen shows no face.** "Pass to Human 3" could show that human's face. UI only.
5. ❓ **E7 still reads 41.3%.** It is kept as defined, with three rows beside it in §11: out at the last
   season's start (0.1%) and two comeback measures. If the headline should move to one of those, that
   is a GDD and harness-printout change, and it is Jesse's call.
6. **The goldens cannot see betting or humans.** Carried. `colour.test.ts` now plays humans, but only as
   a determinism check.
7. Carried, untouched: Phase E's four 🎲 rows; the F1, `v3g` and `v3h` checklists; §7.5's split view.

---

## ⚠️ The v3i checklist, multiple choice

1. **Picking your face:** *Feels right · Fiddly · I'd rather have more faces*
2. **In a long game, did the stable at the back still have something to play for in the last season?**
   *Yes, the draft helped · Yes, but not because of the draft · No*
3. **The Hard AI is:** *Too strong · About right · Too soft*
4. **What next?** *The four-human playtest · Something else*
