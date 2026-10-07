# V3 Phase Q notes: the rules, on Claude's judgement (8 October 2026)

> ⚠️ **Push `v3q` only when nobody is playing online. This push ends every live room**: `STATE_VERSION`
> moved 14 → 15, so each room open at the time shows its standings and "This room was started on an
> older version of the game (14, now 15) and cannot play on." `PROTOCOL_VERSION` is 2.

Built **unattended**, in Cowork from a clone in the container, with nobody to ask. Tag **`v3q`**. The
fallback is `v3p` (`e23f37e`). The prompt is `claude/V3_PHASE_Q_PROMPT.md`, with its corrections in a box
at the top.

**In one line:** an audit of every system against §0's test and §11, a new harness mode that asks
whether each of §1.1's five decisions is a decision, and **three rule changes** — the book prices fitness
(Q1), the opening draft's round 3 runs the way round 2 did (Q2), and the style-read trainer gives a
race-day tip a week (Q3). Each is its own commit, a sheet cell or a sentence, and a GDD_V3 §13 row for
Jesse to **keep or revert**. Two more were tried and dropped with their numbers.

---

## The morning read

| | What it does, in a sentence | The number that justified it | What a player will notice | How to revert it |
|---|---|---|---|---|
| **Q1** | **The bookie prices fitness**: one rating point for every five points of fitness above or below a local's 75. | A 1-Bone win bet on a stable runner at fitness 100 returned **+92%** (80–99: about +20%; under 60: −33%) — "back the fresh dog" was always right, and free. At 0.2 the six bands read −5…+10%. | A fresh dog is shorter odds and a tired one longer. The Bookie's "?" says "it prices the rating, the style and the fitness". The blind-spot line stops naming fitness. | **One cell:** `bookFitnessPerPoint` → 0 (below) |
| **Q2** | **The opening draft's round 3 goes the same way as round 2** (the "third-round reversal"); the snake carries on from there. | Win rate by draft position, widest gap from fair at 3 / 6 / 8 stables: **4.4 / 5.2 / 4.7 → 1.0 / 1.4 / 2.7** points against ±3 (2,000 games: 2.3 / 1.1 / 2.7). | The pick order strip: whoever picked first picks last in rounds 2 *and* 3. The draft's "?" says why. | **One cell:** `draftThirdRoundReverses` → 0 (below) |
| **Q3** | **"Hears the kennel gossip": a race-day tip a week**, instead of making one rival dog's style public. | Since the draft every drafted dog's style is public, so the read found only Pound dogs: **−1,125 (± 439)** of end worth by D12's regression. The tip: **+278 (± 376)**, a fair cut of 2.9% against its 2%. | Whoever drafts Whisper Jhett, Zeb Fontaine or Hex gets a whisper on the Bookie each weekend ("…took a knock in the kennel this week"). | `git revert 4470b9f` (reverts clean) |

**Q1 and Q2 are switched by a sheet cell each, and that is the revert.** At 0 the engine is `v3p`'s and
the screens' words follow (`c4e69f6`, `c7f07b0`). Checked in a scratch clone: with both cells at 0, Q3
reverted and `STATE_VERSION` put back to 14, **both goldens are byte-identical to `v3p`'s** and all 211
tests pass. (`git revert ef7aa79` or `d670ba3` would conflict on the sheet, which is binary, and on the
upserter's lines: the cell is the clean way.)

To turn **Q1** or **Q2** off — in Excel, or in the upserter:

```
# Either: open design/space_dog_racing_economy.xlsx, sheet Assumptions, section "Phase Q (v3q)", and set
#   "Book: rating points a fitness point is worth, against a local at 75"   0.2 → 0   (Q1)
#   "Draft: round 3 runs the way round 2 did (1 yes, 0 a plain snake)"      1   → 0   (Q2)
# Or: change that row's `value` in packages/engine/scripts/add-phase-q-rows.ts, then
npx tsx packages/engine/scripts/add-phase-q-rows.ts
# Then, either way:
npm run balance
cd packages/engine && npx vitest run test/golden.test.ts -u && cd ../..
npm test
git commit -am "Turn Q1 off (Jesse's call)"
```

To revert **Q3**:

```
git revert 4470b9f
cd packages/engine && npx vitest run test/golden.test.ts -u && cd ../..
npm test
git commit -am "Re-record the goldens without Q3"
```

**Re-record the goldens after any of them** — `npm run test -- -u` does **not** do it (the root script is
a typecheck chained to the engine's tests). Leave the versions at 15 / 15 / 2 whatever is reverted: a
version moved once too often harms nothing, and this push ends live rooms either way.

---

## What was tried and dropped

| Tried | The number | Why it was dropped |
|---|---|---|
| **The three trainer bonuses that do nothing priced at 1%** (injuries halved 4%, layoffs −1w 2%, keeps you out of trouble 3%) | D12's regression at 1%: **−958 (± 237), −520 (± 277), −957 (± 233)**, held 0.29 → 0.52, 0.28 → 0.36, 0.13 → 0.35; +5 recovery's share fell 0.47 → 0.17; commission 11.7% → 9.3% | Cheaper did not make them worth having: the AI (which prices them at 1.5–3% of purses) drafted them **in place of** useful trainers. The cost was never the cut; the bonuses do nothing (below). |
| **Making injuries bite** (longer layoffs, a higher rate) | Six Normal, 200 seasons: injury rate **0% / 4% / 8% / 12% → mean end worth 55,483 / 55,459 / 55,565 / 55,657**; layoffs 2–4 weeks −0.5k, 2–5 weeks at 6% −1.7k, 3–6 weeks at 6% −3.0k | Four dogs for three races keep one dog resting most weeks, so a layoff is a rest. Making it hurt means more luck nobody can price (pillar 2) in an already random game, for a number no table misses. §14 Q4, answered with the numbers, for Jesse. |
| Q1 at **0.1** and **0.3** rating points a fitness point | 0.1: fitness 100 still **+34.8%**, under 60 −21.9%. 0.3: fitness 100 **−14.8%**, under 60 **+16.3%** (the book now over-reads it) | 0.2 is flattest: −5.0 / +1.6 / −0.6 / +4.2 / −4.7 / +10.2% across the six bands. |
| Q3 at **1%** instead of 2% | the tip +464 (± 325), a fair cut of 2.6% | 2% is close to fair (2.9%) and leaves its price where it was, so only the bonus changed. |

---

## The audit, in short (the full table is in `shots/audit.md`)

`npm run harness -- --decisions` (new, committed as `889cda3`): one seat plays a naive rule for one
decision and Normal for the rest, against five Normal, 1,200 one-season games a rule, the seat moving
round the table, the same seeds for every rule. The number is the naive seat's end worth against the
five Normal in the same game, paired with the control (± one standard error).

| §1.1 decision | Naive rule | `v3p` | `v3q` | Verdict |
|---|---|---|---|---|
| 1 Which door? | a door at random | +114 (± 279) | +303 (± 266) | **shallow in Bones** — the five categories pay within ~1.6k (the Alley least, −1,251; the Track most, +321); the door is about what you want to happen. §14 Q14 |
| 2 Buy, sell or feed? | never trades | −3,961 (± 465) | −4,968 (± 486) | **fine** — a real road |
| 2 | never touches the diet | −2,121 (± 469) | −1,330 (± 472) | **fine** |
| 3 Who runs, who rests? | the three best race every week | **−14,711 (± 470)**, win 2.4% | **−15,379 (± 455)**, win 1.2% | **fine** — the deepest decision in the game |
| 4 Which dog in which race? | Normal's runners, best in the Gold | +860 (± 495) | **+1,556 (± 483)** | **shallow for the AI** — at `v3q` the ladder beats Normal's priced assignment by three standard errors; the board's read is a human's. §14 Q15 |
| 5 What do I know that the bookie doesn't? | never bets | +1,271 (± 60) | +887 (± 61) | **was shallow** (fitness was always the answer); **Q1**. Normal's bets on favourites still lose the margin, as blind bets should |

**What is fine:** the season's shape, the market and the diet, Race/Rest, the styles, the hot pace, the
run-in (median margin 6.3 m, photo finishes 3.2%), the stake ceiling, the doors' spread (none below
12%), the click budget. **What is still open:** the long game's comeback (Jesse's calls; §14 Q16), the
doors paying alike (§14 Q14), Normal's declarations (§14 Q15), injuries and the three trainer bonuses
that ride on nothing (§14 Q4), and draft position **with people**, which no harness can play.

---

## Every balance row, before and after

`v3p` = `shots/before/`; `v3q` = `shots/after/`. Six Normal unless said.

| Measure | Target | `v3p` | `v3q` |
|---|---|---|---|
| **Draft position, widest gap from fair, 3 / 6 / 8 stables** (1,000 games) | ±3 | 4.4 / 5.2 / 4.7 ❌ | **1.0 / 1.4 / 2.7** ✅ |
| Start worth, first pick to last | reported | 745 / 522 / 796 | 728 / 742 / 782 |
| **Book's return on a stable runner, fitness <60 / 60s / 70s / 80s / 90s / 100** | (new) | −32.5 / −14.3 / −2.2 / +21.5 / +18.3 / +92.2% | **−7.0 / +0.0 / −2.5 / +3.0 / −2.5 / +11.7%** (± 1.3–2.4) |
| Every stable dog backed blind (`--styles` row 5) | for scale | +6.5% | **0.0%** |
| The lone closer backed blind / against 3+ front-runners | below the margin | −3.4% / −2.3% ✅ | −3.3% / +0.8% ✅ |
| Every runner backed blind (the margin) | — | −8.1% | −12.6% |
| The tip-a-week / style-read bonus (D12's regression) | ≥ its cut | −1,125 (± 439) | **+278 (± 376)** |
| Races entered a weekend | 2.2–2.8 | 2.66 ✅ | 2.67 ✅ |
| Races a dog a season | 5–7 | 6.31 ✅ | 6.31 ✅ |
| Fitness at declaration / under 60 | 60–80 / 10–25% | 74.6 / 13.9% ✅ | 74.5 / 13.9% ✅ |
| Food sold, share of gross | 20–35% | 25.6% ✅ | 25.1% ✅ |
| Mean end worth, one season | reported (V22) | 55,459 | 55,992 |
| Betting, a stable-season | — | −1,386 | −762 |
| Commission, share of purses | reported | 11.7% | 11.6% |
| Season decided by week | later is better | 7.5 | 7.6 |
| Closer's gap, 1 front-runner v 3 | ≥ +2 | +2.3 ✅ | +2.3 ✅ |
| Median margin / photo finishes | 4–7 m / ≥ 3% | 6.2 m / 3.7% ✅ | 6.3 m / 3.2% ✅ |
| Doors opened, lowest category | ≥ 12% | 17.5% ✅ | 17.4% ✅ |
| **AI** (800 seasons, E N N H H N): Normal beats Easy / Hard beats Normal | reported | 98.1% / 57.9% | **98.0% / 57.8%** |
| Hard's betting, a stable-season | — | +3,811 | +3,598 |
| V23's long-game rows (600 five-season games) | reported (V32, N1) | 27.0% / 9.3% | 31.0% / 9.5% (± about 1.9 / 1.2; not aimed at) |
| Out at week 8 of the last season (5-season) | reported | 39.8% | 40.6% |
| Poorer than they started (1 / 3 / 5 seasons) | reported (V22) | 0.5% / 0.4% / 0.4% | 0.5% / 0.4% / 0.4% |
| `hub-clicks`, one human, a weekend | ≤ 9.5 | 9.5 | **9.5** ✅ |
| Table walk: passes a weekend, 4 / 8 humans | — | 10.6 / 22.5 | 10.7 / 22.4 |
| The draft, presses a pick | ≤ 2 | 2.00 | 2.00 ✅ |

### Harness summary (`--seasons 50`, six Normal)

```
End net worth: mean 56,608 · p10 41,749 · p50 54,897 · p90 73,906
Income a stable-season: prize 30,006 · trade 3,071 · betting −647 · costs 8,434
Pace: decisions 8.73 a weekend · entered 2.67 of 3 (band 2.2–2.8: MET) · races/dog 6.28 (band 5–7: MET)
Kennel: fitness at declaration 74.7 · under 60 13.0% · dogs at week 10 4.00
Food sold, share of gross income 24.5% (band 20–35%: MET)
```

---

## What was built, commit by commit

| Commit | What |
|---|---|
| `889cda3` | `npm run harness -- --decisions` (`scripts/harness-decisions.ts`): the naive-seat table and the book's return by fitness. Measuring only. |
| `ef7aa79` | **Q1.** `fitnessEdge()` in `race/odds.ts`; `raceDay.ts` prices a stable runner on rating + style + fitness, a local on rating + style. Sheet row `bookFitnessPerPoint` (0.2) via the new `add-phase-q-rows.ts`. The web's Bookie: the "?" line and the whisper say the book prices fitness; `bookieBlindSpot` lost its fitness clause (put back behind the cell at `c4e69f6`). Tests: the fitness edge is a whole number, the odds domain widened by it still clears thousands of ULPs, every posted price is rating + style + fitness. |
| `d670ba3` | **Q2.** `snakeOrder(round1, rounds, thirdReverses)`; sheet row `draftThirdRoundReverses` (1). The draft's "?" line. `draft.test.ts` asserts the new order and keeps the plain snake as a unit test. |
| `4470b9f` | **Q3.** Bonus `styleReveal` → `whisper`: `staffWeek` tells the stable the best-rated dog carrying an untold condition, privately, as D3's tips do. The sheet's staff-cut row renamed in place (`RENAME` in the upserter). Normal prices it at 1% of prize money. A property test over six seeds. |
| `6addb6c` | `STATE_VERSION` / `SAVE_VERSION` 15, `PROTOCOL_VERSION` 2 (`view.test.ts`). |
| `b34fa2b` | **The goldens, alone.** One season `acdcf108…` → **`7dc1fedc…`**; two seasons `3d1bf31a…` → **`fb2e5a71…`**. |
| `c4e69f6` | The Bookie's and the draft's words read Q1's and Q2's cells, so a cell at 0 brings `v3p`'s words back (the blind-spot line names fitness again). No rule. |
| `c7f07b0` | Q1's and Q2's tests follow their cells. With both at 0, Q3 reverted and `STATE_VERSION` 14, both goldens are byte-identical to `v3p`'s and 211 tests pass (a scratch clone). |
| (docs) | GDD_V3 §5.5, §5.6, §8.2, §9.4, §11, §13 (Q1–Q3), §14 (Q4, Q9, Q13 answered; 14–16 new); BUILD_PLAN_V3's Phase Q line; PLAYTEST_CHECKLIST rows 34–36 and questions 1.14, 2.9, A.7; ONLINE_PLAN §7; CANON. README unchanged (nothing in it became wrong). |
| (this) | These notes and the prompt; tag `v3q`. |

---

## The rules that did not bend

- **Jesse's calls stand.** Nothing in V22, V23/V32, N1 (the boards' ranges, one dog a stable), L4a–c, M1
  or P1–P3 moved. Q2 changes the order of the snake, not the 45–55 board he picked.
- **Determinism:** the fitness edge is rounded to whole rating points, so the book's input is still an
  integer and the odds domain (now `5 + min style edge + fitnessEdge(0)` to `99 + max + fitnessEdge(100)`)
  is proved again in `determinism.test.ts`. The tip draws nothing. No `pow` / `exp` / `log`.
- **Every change measured and revertible on its own**; one change a commit; goldens once, alone.
- **Pace:** `hub-clicks` **9.5** (unchanged); no press added; race day untouched.
- `npm test` **212 green** (207 at `v3p`); lint clean; build passes; no dependency added;
  `package-lock.json` untouched.
- `season-check` passes; `view-walk` **0 throws**; `asset-check` **288 / 0 / 0**; `race-view-check`
  clean (150 races replay clean; the draws moved, so its counts did).
- `server:test` **15 green**; `online-walk` **All 27 rows pass**; `online-table-walk` **All 10 rows pass**;
  `browser-walk` **All 8 rows pass** alone; in the re-baseline, run straight after the other two walks with the harness on the second core, it failed only the known held-"Fly on" row (`shots/after/browser-walk-run1.txt`), as at `v3n` and `v3p`.
- **`screen-words`: fewer words, not more.** Run back to back on a `v3p` build and the `v3q` build, a
  first weekend reads **1,888 → 1,807**, and the Bookie **256 → 180** (the blind-spot line no longer names
  fitness). ⚠️ The instrument is not steady from run to run: the same `v3p` build read 1,692 this morning
  and 1,888 tonight (the hub 172 → 239), so its game is not pinned as its header says; compare builds only
  within one run. A note for whoever next uses it.

---

## For Jesse: the `v3q` checklist

| | Question | Tick one |
|---|---|---|
| 1 | **Q1, the book prices fitness** | Keep · Revert · Keep, but play the evening first |
| 2 | **Q2, round 3 of the draft reversed** | Keep · Revert |
| 3 | **Q3, the gossip trainer's tip a week** | Keep · Revert |
| 4 | **What next?** | The playtest evening (rows 34–36 ask about Q1–Q3) · Another unattended pass (on what?) · The long game's comeback (§14 Q16) · Something else |

---

## Landing

Built in the container, handed back as `phase-q.bundle` (`main` and the tag `v3q`, on top of `v3p`),
written into Jesse's folder. The session tried the fast-forward itself; its last message says whether it
landed. If it did not (git in the folder can need delete permission to clear its own lock files, and
nobody was awake to grant it), these are the commands, in Jesse's folder:

```
git fetch phase-q.bundle main:refs/remotes/bundle/q-main
git fetch phase-q.bundle "refs/tags/v3q:refs/tags/v3q"
git merge --ff-only bundle/q-main        # main: e23f37e (v3p) → v3q
git log --oneline -1                     # Write the Phase Q notes and the phase prompt
```

(A fresh ref name on purpose: a stale `refs/remotes/bundle/main` from an earlier phase rejects the fetch.)
His own `package-lock.json` change is untouched by every Phase Q commit, so the fast-forward leaves it.

**Then, when nobody is playing online** (this push ends every live room):

```
git push origin main
git push origin v3q
```

Optionally `npm test` first: 212 green. Nothing in Phase Q added a dependency, so no `npm install` is
needed.
