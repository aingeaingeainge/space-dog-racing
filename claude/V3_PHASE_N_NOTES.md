# V3 Phase N notes: the draft (30 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3n`**. The fallback is `v3m` (`e267c59`).

**In one line:** a game opens on a six-round snake draft of four dogs and two trainers from a public
board, and each off-season is one round of it, last on the standings first — a dog (retiring one of
yours), a trainer, or a pass. Nothing is dealt any more (GDD_V3 V29–V33, N1). The weekend is untouched.

The prompt is `claude/V3_PHASE_N_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: five things the record should know

1. **Two DONE WHEN rows are not green, and `main` was landed with them, at Jesse's calls.** Each was
   asked with its measured options, one question at a time:
   - **Draft position** — widest gap from a fair win rate at 3 / 6 / 8 stables: **4.4 / 5.2 / 4.7
     points** against ±3 (one standard error 1.5 / 1.2 / 1.0). The first pick's edge is the board's
     one best dog and the trainers: 5 of the 24 give +10% prize money, all-Normal tables take their
     dogs first, and the last seat of six never gets one. Nothing tried reached ±3 at every size (sweep
     below). Jesse: **narrow the board to 45–55**, and watch it at the evening.
   - **V23's long-game rows** — the poorest at season 3 finishing top 3 / the poorest at the last
     season's start having its biggest gain, 600 five-season games: **27.0% / 9.3%** against `v3i`'s
     31% / 14% (`v3m` re-measured at 600: 30.7% / 12.0%). Jesse: **one dog a stable** at the off-season,
     then (N1) **the off-season board its own range, 40–60**, because his two picks pulled against each
     other through one shared range (45–55 on both boards read 20.5% / 7.7%).
2. **The goldens moved once, but the commit order is not the prompt's.** Jesse's calls came after the
   engine was built, so the balance commit sits *before* the goldens (history was rewritten locally
   before anything left the container): rows → engine (goldens skipped) → `--draft` → balance → goldens
   → web → online → docs → notes.
3. **`race-view-check` is clean but not identical to `shots/before/`.** It plays seeded seasons, and the
   draft moves every draw, so the 150 races are different races. All replay the same way twice and show
   the finish the engine recorded, as at `v3m`.
4. **`browser-walk` failed one row on the fresh clone of `v3m`** — the held "Fly on", M's old flake — and
   passed all 7 on a rerun alone (`shots/before/browser-walk-rerun.txt`). On `v3n` it ran three times:
   pass, the same row failing once more in the re-baseline (it ran straight after the other two walks),
   pass alone. It is the walk's timing, not the room — every other row of every run passed — and it is
   carried forward rather than chased in this phase.
5. **`PROTOCOL_VERSION` stays 1**, on purpose: the view's shape and a rule moved, but nothing has been
   deployed, so no browser holds an older 1. L4's first deploy freezes whatever 1 is then, with the
   draft in it.

---

## What was built, commit by commit

| Commit | What |
|---|---|
| `1023b02` | The six new rows under a new sheet section, via `add-phase-n-rows.ts` (a copy of I's upserter). Nothing read them yet. |
| `5229f20` | **The engine.** `phases/draft.ts`: the opening draft (a `draft` phase before week 1's arrival) and the off-season's one round (the `offSeason` phase keeps its name; both share `GameState.drafts` and `DraftPick`). `buildBoardDogs`: ratings evenly spaced, each run of three ratings carrying all three styles in a shuffled order, then the board shuffled; every drafted dog `styleKnown`, `dealt` false. The off-season: ageing, the staff notice on each stable's own stream (E5's pattern), then the board and the reversed standings. `DraftPick` replaced `Retire` / `ResolveStaffNotice`; a pick is the turn (EndPhase is refused in a draft). `ai/draft.ts`: every legal item scored in Bones. The Pound's card offers four slots. `startDogs` 4, starting crates 5 → 7 (moved from `balance.extras.json` to the sheet), the dealt-dog, V23 and retirement rows removed. The off-season's `SEAT_SECRETS` row went with the offer it hid. `STATE_VERSION` 14. Tests rewritten; goldens skipped. |
| `9f19fa1` | `npm run harness -- --draft`: win rate, start and end worth by draft position at 3 / 6 / 8 stables, and D12's regression on drafted trainers. The races-entered band is 2.2–2.8. |
| `f081446` | **Jesse's calls**, each measurement in the message: opening board 45–55, one dog a stable at the off-season, the off-season board's own 40–60 (two new cells). |
| `f4ddc16` | **The goldens, alone.** One season `41a8c8b5…` → **`acdcf108…`**; two seasons `d4bb14c3…` → **`3d1bf31a…`**. |
| `477e846` | **The web.** `screens/Draft.tsx` for both drafts; `OffSeason.tsx` gone; the report's THE DRAFT; the Title panel; `SAVE_VERSION` 14; the checks. |
| `10e3dab` | **Online**, the walks, `server:test`, `hotseat-shots` 06 / 07. |
| (docs) | GDD_V3, ONLINE_PLAN, PLAYTEST_CHECKLIST, BUILD_PLAN_V3, CANON. |
| (this) | These notes and the prompt; tag `v3n`. |

### The AI (`ai/draft.ts`)

- **A dog** = `dogValue` + `RUNS_A_SEASON` (6) × `purseAt(rating)` × seasons ahead, + 400 for a style
  the stable lacks. `PURSE_CURVE` was fitted from the harness with four-dog kennels (mean gross purse a
  declaration, by rating at declaration): 35 → 450, 40 → 630, 45 → 660, 50 → 880, 55 → 1,220, 60 →
  1,710, 65 → 2,280, 70 → 2,780. It is convex: better dogs go in the Gold Cup.
- **A trainer** = `trainerNet` (STAFF_WORTH, Hard's `hardWorth`) × 10 weeks × seasons ahead.
- **Easy** takes the best-rated dog it can, a trainer when it must. **Hard** walks the rating forward
  by §4.3's growth before counting purses.
- **Off-season:** the best item's gain over what it would let go must beat `aiDraftMargin` (500), or
  it passes. 5-season games: 62% a dog, 15% a trainer, 23% a pass.
- All-Normal tables draft four dogs and then two trainers (the golden reads `dddd…ssss`); that is why
  the scarce prize-money trainers go by position. A 6× or 8× heavier trainer score changed nothing.
- **`startDogRating` (50)** is still right as the Pound's reference in `ai/explore.ts`: a 45–55 board
  averages 50.

### The screen (`screens/Draft.tsx`)

Public (E8): no pass either side. Dogs strongest first on the kennel's `DogCard` (age, style and book
value in its sub-line), trainers on `StaffCard`, the pick order round by round with faces and the
stable on the clock lit, every stable's picks so far. Two presses a pick: the card, then "Take
*name*" in a bar that sticks to the bottom of the screen; in the off-season with a full kennel the
second press is "Retire *dog* (*value*) and take *name*" (one button a dog), with full staff "Let *t*
go and take *name*"; "Pass" is one press. AI picks land on a 700 ms beat; Skip (S) shows them all.
Keys ↑/↓ through the legal items, Enter, P. The off-season reads "A year older" (every stable's dogs and
ages, §4.3 in three lines, the staff notice) above the board.

Screen kind `draft` in `screenFor`, hotseat (the human on the clock, or the table's first while the AIs
pick) and online (every seat watches; the one on the clock presses). The off-season left
`PRIVATE_SCREENS`, so **a hotseat human no longer reads the Grand Final's slips on a private screen**;
the season's best slip is in its moments. The top bar's stats may wrap at ≤ 480 px: a Grand Final week
of a multi-season game was wider than 390.

---

## Every balance row, before and after

`v3m` = `shots/before/`; `v3n` = `shots/after/` (final values: 45–55, one dog a stable at 40–60).

| Measure | Target | `v3m` | `v3n` |
|---|---|---|---|
| Races entered a weekend a stable (`--seasons 50`) | 2.2–2.8 | 2.12 | **2.67** ✅ |
| Races a dog a season | 5–7 | 6.64 | **6.30** ✅ |
| Fitness at declaration / under 60 | 60–80 / 10–25% | 69.7 / 22.8% | **74.7 / 13.3%** ✅ |
| Decisions a weekend (AI) | — | 7.53 | 8.72 |
| Draft position, widest gap from fair, 3 / 6 / 8 stables (1,000 games each) | ±3 | — | **4.4 / 5.2 / 4.7** ❌ (Jesse's call) |
| Start worth, first pick to last | reported | — | 30,817 → 30,072 / 30,700 → 30,178 / 30,868 → 30,176 |
| Kennels with all three styles (Normal) | — | 3 of 3 dealt | 77% / 87% / 90% |
| V23 rows, 5-season, 600 games | ≥ 31% / 14% | 30.7% / 12.0% | **27.0% / 9.3%** ❌ (Jesse's calls) |
| Same, 200 games (`--game`) | | 31.0% / 14.0% | 29.0% / 7.5% |
| Out at week 8 of the last season (5-season, 600) | reported | 40.6% | 39.8% |
| Mean end worth, one season | reported (V22) | 42,495 | **55,249** |
| Poorer than they started | reported (V22) | 0.6–0.9% | 0.4–0.6% |
| Commission as a share of purses | reported | 13.2% (`v3d2`) | **11.7%** |
| Food sold, share of gross | 20–35% | — | 25.2% ✅ |
| Kennel turnover, dogs a stable per two seasons | ≥ 1 | 1.78 | 1.80 ✅ |
| Kennels at season 5's start aged 7 | — | 2.4% | 14.3% |
| `hub-clicks`, one human, a weekend | ~9.4 | 9.4 | **9.5** ✅ |
| The draft, presses a pick (human) | ≤ 2 | — | **2.00** ✅ |
| Table walk: passes a weekend, 4 / 8 humans | — | 10.7 / 22.4 | 10.5 / 22.5 |

### The draft-position table (final, `npm run harness -- --draft`, win rate / mean end worth)

```
3 stables  pos 1 36.7% 62,030 · pos 2 34.4% 61,582 · pos 3 28.9% 59,940          (fair 33.3%)
6 stables  19.2% 57,054 · 20.6% 57,280 · 19.0% 56,478 · 15.6% 55,722 · 14.1% 54,426 · 11.5% 53,070   (fair 16.7%)
8 stables  16.3% · 15.1% · 15.5% · 13.0% · 13.1% · 9.9% · 9.3% · 7.8%   (end 59,316 … 52,163; fair 12.5%)
```

### What was swept for draft position (widest gap, 3 / 6 / 8 stables)

40–60 4.0 / 3.4 / 7.1 · 42–58 3.1 / 3.9 / 5.5 · 45–55 4.4 / 5.2 / 4.7 · 47–53 3.7 / 3.4 / 5.4 · seven
dogs a stable 1.9 / 5.4 / 5.7 · trainers re-priced by the regression (cap 15%) 2.4 / 4.4 / 5.3, (cap
10%) 2.9 / 6.2 / 5.9 · the AI's trainer score ×8 (scratch, 600 games) 5.2 / 4.3 / 6.5. By position at six
stables (400 games): pos 1 holds 1.00 prize-money trainers and a 59.7 top dog; pos 6 holds 0.00 and 57.2.

### What was swept for the long game (5-season, 600 games)

1.5 dogs a stable 26.5% / 7.2% · 0.75 24.0% / 8.0% · 0.5 30.0% / 8.8% · 1.0 26.2% / 9.3% · 1.0 with
45–55 on both boards 20.5% / 7.7% · **1.0, opening 45–55, off-season 40–60: 27.0% / 9.3%** (chosen).

### Trainer bonuses by D12's regression (drafted, start worth as the control, 17,000 stables)

+1 stat +215 (± 196) · +5 recovery +792 (± 316) · injuries halved −1,795 (± 326) · layoffs −1w −662
(± 240) · **the style read −1,125 (± 439): fair cut −1.7% against its 2%** · next week's prices +565
(± 304) · +10% prize money +1,201 (± 282) · safer Explore −1,017 (± 381). Reported, nothing re-priced.
Drafted trainers are chosen, so this regression is noisier than D12's dealt one.

### Harness summary (`--seasons 50`, six Normal)

```
End net worth: mean 55,249 · p10 40,440 · p50 54,208 · p90 71,159
Income a stable-season: prize 29,490 · trade 3,100 · betting −1,371 · costs 8,537
Pace: decisions 8.72 a weekend · entered 2.67 of 3 (band 2.2–2.8: MET) · races/dog 6.30 (band 5–7: MET)
Kennel: fitness at declaration 74.7 · under 60 13.3% · dogs at week 10 4.00
Food sold, share of gross income 25.2% (band 20–35%: MET)
```

---

## Screenshots

`shots/before/png/` (the `v3m` build) and `shots/after/png/` (this one), from `npm run hotseat-shots`.
Not in the repo.

- **`06-draft-1280/390/360`** (new): a table of six, the AIs' picks shown, a human's first card pressed
  and "Take Fearless Panic" up. At 360 the board is one column of cards and every card is pickable.
- **`07-off-season-1280/390/360`** (new): seed 7, a two-season game resumed from a save at the human's
  off-season pick, a dog pressed and the four "Retire … and take …" buttons up. Found by it: the top
  bar overflowed 390 on a Grand Final week (fixed), and a lazy image below the fold never loads, which
  hung the shot's wait (fixed in `hotseat-shots`).
- `02-explore` is byte-identical. `00-title` differs by the build panel's line; `01-arrival`,
  `03-hub-after-door`, `04-explore-wrap` and `05-game-over` differ because the draft moves every draw:
  7 crates in the hold, "4 resting", a different card, the draft's lines in "This week".

---

## The rules that did not bend

- **The weekend is unchanged.** No screen of the week was edited but the top bar's wrap under 480 px.
  `hub-clicks` 9.4 → 9.5 (four dogs); `season-check` walks the same week, and its differences are the
  draft's screens and four dogs.
- **Determinism:** the board and the order come from the game's stream; replay of a whole two-season
  game (`draft.test.ts`), the online rooms' logs (all three walks) and the table walks reproduce.
- `npm test` **207 green** (184 at `v3m`); lint clean; build passes; **Pages on Node 20** (v20.20.2,
  clean `npm ci && npm run build`) passes; no dependency added; `package-lock.json` untouched.
- `season-check` passes (race-day tips are counted run-wide now, like sabotage: seed 7's first season
  drew none after the draft moved every draw). `view-walk` **0 throws**. `asset-check` 288 / 0 / 0.
- `server:test` **11 green**; `online-walk` **All 25 rows pass**; `online-table-walk` **All 10 rows
  pass**; `browser-walk` **All 8 rows pass** alone (see item 4 above for the one flaky run; a row for the draft; its nudge landed during the draft:
  "Waiting on Bex — the draft").
- Versions **14 / 14 / 1**.

---

## Open questions

1. **Draft position** (§11): watch it at the evening (checklist rows 28–30). If the first pick still
   feels lucky with people, the next levers are the trainers (more copies of the scarce bonuses, or
   D12's prices) rather than the dogs.
2. **The long game** (§11): 27.0% / 9.3% against V23's 31% / 14%. Four dogs dilute one new dog, and
   kennels age more (14% sevens at season 5's start). A second off-season pick for the bottom half is
   the obvious next rule if the evening's game 2 says the back of the table had nothing to play for.
3. **The style-read trainer** (§14 Q13): prices below zero now that every drafted dog is public.
4. **The Grand Final's slips** are no longer read privately at a hotseat table.

---

## The `v3n` checklist (for Jesse)

| | Question | Tick one |
|---|---|---|
| 1 | **The evening now, or L4 first?** | The evening now (push `v3n`), L4 after (Recommended) · L4 first |
| 2 | Draft a quick game alone before the evening? | Yes, one opening draft to see it · No, the table sees it fresh |
| 3 | If the first pick feels lucky at the table | Try more prize-money trainers · Try re-pricing trainers · Leave it |
