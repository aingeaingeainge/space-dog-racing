# V3 Phase G build notes: balance — a stake cap a rich stable hits (28 September 2026)

Built in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3g`**. The fallback is `v3f2` (`256b4db`).

**In one line:** a stable's stake on one race is now **the lesser of 50% of its cash and 1,000
Bones**, and Neon Snout doubles the 1,000. Nothing else in the engine moved.

---

## ⚠️ Read this first: four things the record should know

1. **Neither golden moved, although the prompt said both would.** Both goldens are six **Normal**
   stables (`test/golden.test.ts`), and Normal sizes its own stake at no more than 500
   (`betFavourites`, `cap ?? 500`). So nothing in either golden game ever reaches a 1,000 ceiling. The
   rule commit says so. The digests are still **`8dc05e06…`** (one season) and **`dc357422…`** (two
   seasons). The six-Normal `--seasons 50` harness and `--game` printouts are the same as `v3f2`, byte
   for byte apart from the timings. The rule shows up only at a table with Hard stables or humans.
   That is also why a CI run on Jesse's push cannot see it.
2. **The prompt had Neon Snout's special wrong.** Neon Snout's row was `{ bettingMargin: 0.1 }`, with
   no stake fraction. The 100%-of-cash fraction is **Collar Prime's** (the Grand Final), along with its
   own 10% margin. I asked Jesse: **the ×2 goes on Neon Snout only.** Collar Prime keeps its 100%
   under the ordinary 1,000 ceiling. The committed prompt is corrected.
3. **The cap makes Hard stronger, not weaker.** Hard vs Normal goes from 50.6% to 62.1% in two-season
   games with 2 Hard and 4 Normal, and from 49.7% to 54.0% in one season with 3 v 3. Hard's own-dog
   bets have a real edge, and what used to sink it was its compounding *losing* runs, which the cap
   cuts harder than its wins. That is reported, not tuned, per Jesse.
4. **The sweep numbers are from a scratch instrument, `shots/sweep.ts`, which is not committed.** It
   plays whole games through `decide` exactly as `harness-game.ts` does, and reads each stable's ledger
   from the season archive. It also lets the ceiling be set per run by writing `balance.maxStake` at
   runtime. The committed harness has no knob for that, and the rule's number belongs in the sheet.

---

## Jesse's game, and why the old cap did not stop it

Two seasons: one human (Zingis) against five AIs, two of them Hard (Sly Pete Manx, Baroness Vex).

| Stable | Final worth | Races won | Gold Cups | Prize money | Trainers' cut | Trading | Betting | Food & bills |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Sly Pete Manx (AI, Hard)** | **285,151** | 6 | 3 | 55,875 | −6,705 | +11,481 | **+197,908** | −5,095 |
| Zingis (human) | 94,054 | **13** | **5** | **87,196** | −11,134 | −11,451 | +12,512 | −26,391 |
| Old Man Torvald (AI) | 63,596 | 10 | 0 | 46,779 | −5,615 | +2,013 | −2,529 | −10,715 |
| Fizz Molloy (AI) | 48,485 | 3 | 0 | 34,013 | −6,803 | +8,256 | −2,758 | −9,253 |
| Captain Blort (AI) | 47,212 | 5 | 1 | 37,650 | −4,551 | +6,148 | −608 | −10,105 |
| Baroness Vex (AI, Hard) | 42,109 | 4 | 1 | 33,675 | −3,213 | +6,098 | **−19,721** | −6,628 |

The best bet was 109,719 Bones on Genuine Eclipse: Sly Pete staked 15,563 at 8.05 in the season 2,
week 10 Gold Cup. Hard stakes a *share of its cash* (3%, up to ×4 or ×6 on an edge), so its bets grow
with its bank, and a 50%-of-cash ceiling grows with them. The best racing stable finished on a third of
the worth of a stable that won at the bookie, and the other Hard stable lost almost 20,000 at it.

**Jesse's calls, given before the phase:**

- Betting is broken: fix it with a smaller stake cap, one flat number from the sheet. The cap is the
  lesser of 50% of cash and that number.
- Neon Snout doubles it.
- Change only the cap: no odds cap, no change to the margin, `aiBetFraction` or Hard's logic.
- Feeding stays as it is. He fed well on purpose, and it is why his dogs won: "worth it".
- The event cards are **"great"**. Nothing else felt off: purses, game length and the off-season are
  fine.

---

## The sweep, and Jesse's pick

The same seeds for every ceiling, with Neon Snout ×2 in every row that has a ceiling. The main table
has 2 Hard + 4 Normal, like Jesse's game: 1,000 two-season games, 1,000 one-season games, and 300 each
at three and five seasons.

**Two-season games (2 Hard + 4 Normal):**

| Ceiling | Betting's share of the winner's income | Won by a stable whose betting > its prize money | Most-prize stable wins | Hard betting p10 / median / p90 | Hard vs Normal | Gap 1st–last, season end | Hard bets capped | Human 10%-of-cash bet capped |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| none (`v3f2`) | 28.8% | 32.5% | 55.9% | −27,704 / −8,159 / +107,037 | 50.6% | 78,554 | 0% | 0% |
| **1,000** | **15.8%** | **5.3%** | **63.5%** | **−15,198 / +3,529 / +33,302** | 62.1% | 48,075 | 58.6% | 72.8% |
| 1,500 | 21.3% | 13.4% | 57.8% | −19,298 / +3,745 / +46,500 | 61.2% | 53,053 | 43.9% | 57.4% |
| 2,000 | 24.5% | 20.7% | 56.2% | −21,404 / +3,254 / +56,829 | 59.9% | 57,127 | 33.9% | 45.2% |
| 3,000 | 28.0% | 28.6% | 53.6% | −25,149 / +970 / +73,843 | 57.3% | 62,566 | 22.1% | 27.1% |
| 5,000 | 30.1% | 34.8% | 55.0% | −26,760 / −4,110 / +100,263 | 53.4% | 69,188 | 11.8% | 8.1% |

**Across game lengths (2 Hard + 4 Normal), none → 1,000:**

| Game | Won by betting | Most-prize stable wins | Betting's share of winner | Hard betting p10 / p90 | Gap 1st–last |
|---|---|---|---|---|---|
| 1 season | 17.2% → 7.9% | 67.1% → 69.6% | 17.8% → 13.7% | −10,356 / +23,188 → −8,155 / +16,860 | 41,383 → 35,162 |
| 2 seasons | 32.5% → 5.3% | 55.9% → 63.5% | 28.8% → 15.8% | as above | 78,554 → 48,075 |
| 3 seasons | 41.3% → 2.0% | 63.3% → 69.3% | 34.8% → 13.9% | −46,662 / +260,297 → −18,547 / +43,951 | 139,157 → 62,586 |
| 5 seasons | 43.0% → 0.3% | 61.7% → 74.7% | 36.8% → 10.5% | −93,137 / +586,353 → −21,131 / +58,724 | 323,385 → 88,733 |

**Six-Normal tables do not move at any ceiling**, because Normal never stakes more than 500. The mean
end worth after one season is 42,170 at every ceiling. It is still above §11's 25–40k, as it has been
since `v3e1` (42,151); that is not this phase's number. **3 Hard v 3 Normal, one season:** Hard vs
Normal 49.7% (the old "49.9%") → 54.0% at 1,000.

**"Capped" means the ceiling was below 50% of cash and the stake came out at exactly the ceiling.** The
human column is an estimate, because there is no human in the harness. It is the share of
stable-weekends at the bookie where 10% of that stable's cash is over the ceiling. Median cash at the
bookie is about 10,000 in season 1 and 19,000 across a two-season game. **A 1,000 ceiling binds for
"a tenth of my cash" about half the time in season 1, and more often after that.** No ceiling in the
sweep met the prompt's aim that it never bind a sensible bet on a stable's own dog. Only 1,000 clearly
moves "the best racing stable wins": at 1,000 two-season games the standard error is about 1.6 points,
so 1,500's +1.9 is noise.

**The question and the answer.** Jesse was shown the table with a recommendation of 1,000 and the
options 1,500 and 2,000. He picked **1,000**, and **Neon Snout only** for the ×2. My one line for it:
it is the only ceiling that clearly makes the best racing stable win more often, it ends almost every
game won at the bookie, and a 1,000 bet at 8.05 still returns 8,050, more than a Gold Cup win.

---

## The rule

- **The sheet:** `design/space_dog_racing_economy.xlsx`, Assumptions, under *Betting*: **"Max stake
  per race (flat ceiling, Bones)" = 1,000**. It was upserted by
  `packages/engine/scripts/add-phase-g-rows.ts`, a copy of E2's, and mapped to `maxStake` in
  `balance-from-xlsx.ts`'s `LABELS`. `balance.json` was regenerated by `npm run balance`, never
  hand-edited.
- **`state.ts`:** a new `maxStakeCeiling(s)` returns `balance.maxStake × (planet.special.maxStakeMultiplier ?? 1)`.
  `maxStakeFor(s, p)` = `Math.min(Math.floor(cash × maxStakeFraction(s)), maxStakeCeiling(s))`. The
  comment above it now says why a flat ceiling is back after BUILD_PLAN_V3 §2.1 cut it: Jesse's game,
  a share-of-cash stake compounding, and that this ceiling is not about debt. The arithmetic is integer
  `*` and `Math.min`, so there are no transcendentals.
- **`types.ts`:** `PlanetSpecial.maxStakeMultiplier?`. **`planets.ts`:** Neon Snout `{ bettingMargin: 0.1,
  maxStakeMultiplier: 2 }`. The Collar Prime comment is rewritten, and its row is unchanged.
- **`placeBet`** already summed the stable's slips on the race against `maxStakeFor`. Only its comment
  changed.
- **The AIs needed no change.** Hard computes `min(cash × fraction, maxStakeFor(...))`, so a stake over
  the ceiling is **clamped and still placed**: 58.6% of Hard's two-season bets land at exactly 1,000.
  The `stake < 50` skip is unchanged, because a ceiling of 1,000 cannot push a stake under 50. Normal
  (≤ 500) and Easy never reach it.
- **Probed** (`shots/rule-probe.ts`): a rich stable (50,000 cash) at Tinkertown is refused 1,001
  ("Max stake on this race is 1000"), takes 1,000, and is then refused a further 10 on the same race.
  At Neon Snout a rich stable's cap is 2,000 and a poor one's (1,500 cash) is 750. At Collar Prime a
  rich stable's is 1,000 and a poor one's (700 cash) is all 700.

## What changed on screen

- **The Bookie's header** reads `Neon Snout · margin 10% · max stake 2,000 Bones a race`, which is the
  cap this stable actually has here: whichever of the two ceilings binds. A player with little cash sees
  the 50% figure in Bones.
- **The Bookie's note** gives both halves: "You may have up to 2,000 Bones on one race: 50% of your cash
  or 2,000 Bones, whichever is less — the ceiling is doubled here." The last clause appears only where
  the ceiling is doubled.
- **Neon Snout's local rules** (`planetText.ts`, on the hub, the Galaxy map and the table screen):
  "Stake ceiling ×2: 2,000 Bones a race".
- **The stake slider** already clamped to `maxStakeFor` less what is already on the race, so it cannot
  offer more than the cap. It is unchanged.

Screenshots at 1280 and 390, from a save that stops a human at the Bookie (`shots/`, not committed):
Neon Snout's Bookie (week 7, 16,471 cash, so 2,000), Tinkertown's Bookie (1,000), and Neon Snout's
Local Rules panel.

## The ledger check: food is counted once

`shots/ledger-probe.ts --controlled`: one stable alone at the table, with the AI's own food trades
suppressed. It buys 40 crates of Grey Mash at 44 (they sell for 40 there) and never sells any. All 40
are eaten.

| | Bones |
|---|---:|
| Paid for the 40 crates | 1,760 |
| Trading, from food: −1,760 bought + 1,558 eaten | −202 |
| Food & bills, from food: eaten, at the sell price where it was eaten | 1,558 |
| **Trading + Food & bills, from food** | **1,760**, which is the cash, counted once ✅ |

The uncontrolled run agrees. That is a Normal AI trading and feeding across a season, with every
change to `tradeIncome` and `costs` attributed to what caused it (TradeFood, the jump, Explore cards).
**Why both columns are negative for a stable that feeds well:** a crate is charged to Trading at its
buy price when bought. When a dog eats it, its resale value on that planet (`eaten()` in `endTurn.ts`)
moves from Trading into Food & bills. What stays in Trading is the markup: the gap between what was paid
and what the crate would have fetched where it was eaten. That is about 10% on a crate eaten where it
was bought, and more on premium food bought dear. Crates still in the hold at the end sit in Trading at
their buy price. Jesse's −11,451 is a heavy feeder's markup, and not a double count. Nothing changed.

## Saves

`SAVE_VERSION` 11 → **12**, with a history paragraph in `persist.ts`. A `v3f2` log can hold a bet the
rule now refuses, so it would stop at replay. The check sends it to the title screen instead.
**Verified** (`shots/save-probe.mts`, with a fake `localStorage`): a v11 blob carrying Sly Pete's
15,563 stake reads back **null**, and a v12 blob loads.

## The acceptance table

| Measure | Target | `v3g` |
|---|---|---|
| Stake = lesser of 50% of cash and the flat ceiling; Neon Snout 2× | ✅, `maxStakeFor`, sheet + planet row | ✅ |
| The ceiling | Jesse's pick | **1,000** ✅ |
| Betting's share of the winner's income, 2 Hard + 4 Normal, two seasons | well under today's | 28.8% → **15.8%**; won by betting 32.5% → 5.3% ✅ |
| The most-prize stable wins | more often | 55.9% → **63.5%** ✅ |
| Hard's betting total p10 / p90 | much narrower | −27,704 / +107,037 → **−15,198 / +33,302** ✅ |
| Mean end worth, all-Normal, one season | 25–40k | 42,170, unchanged (❌ since `v3e1`) |
| Hard vs Normal | reported | 49.7% → 54.0% (3 v 3, one season) · 50.6% → 62.1% (2 v 4, two seasons) |
| Bookie says the cap; Neon Snout says its doubled ceiling | ✅, 1280 and 390 | ✅ |
| Food bought and fed counted once | probed; fixed or explained | explained, no bug ✅ |
| A `v3f2` save goes softly to the title | `SAVE_VERSION` 12, verified | ✅ |
| Goldens once, in the rule's commit | moved once | **not moved at all** (see ⚠️ 1) |
| `npm test` / lint / `season-check` / build / `asset-check` | ✅ | 47 green / clean / passes / ✅ / 288 · 0 · 0 |

### The re-baseline

- `npm test` **47 green**; `npm run lint` clean; `npm run build` ✅.
- `season-check`: all seasons played out clean (four humans, two seasons: 217 passes, 0 leaks).
- `hub-clicks`: **9.4** a weekend; the table at 4 humans **10.7** passes, at 8 **22.4**. Unchanged.
- `race-view-check`: 150 races, every one replays the same twice.
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**
- `npm run harness -- --game` (six Normal): unchanged from `v3f2`. One season gap 26,510; five seasons
  ending on 147,689.

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

This is identical to the `v3f2` snapshot, as it should be: six Normal stables never stake over 500.

## Commits

1. `Add the flat stake ceiling to the sheet: 1,000 Bones a race`: the upserter, the row, `LABELS` and
   `balance.json`.
2. `Cap a stable's stake on a race at the lesser of 50% of cash and 1,000`: the rule, Neon Snout's row
   and the comments. The goldens did not move, and the message says why.
3. `Tell the player the stake cap they actually have, and Neon Snout's doubled ceiling`: Bookie and
   `planetText`.
4. `Bump SAVE_VERSION to 12 for the stake cap`.
5. (No ledger fix: the probe found no double count.)
6. The notes, the prompt, and GDD_V3 §7.4, §12, §13 V21; BUILD_PLAN_V3 Phase G; CANON's `v3g`. Tagged
   **`v3g`**.

---

## ⚠️ The v3g checklist, multiple choice

Play a season with two Hard AIs at the table, and have a bet at Neon Snout.

1. **Does a big bet still feel worth making?** *Yes · Only at Neon Snout · No, 1,000 is too small*
2. **Does the best racing stable now win?** *Yes · Usually · No, something else is still deciding it
   (what?)*
3. **Is the cap clear on the Bookie?** *Yes · I found it but it took reading · No, I was surprised by
   a refusal*
4. **Is Neon Snout still the place for a big bet?** *Yes · It doesn't feel different · I didn't get
   there*
5. **What next?** *The four-human playtest (Phase E's 🎲 rows) · The human face picker · Another
   balance pass (on what?)*

**Already answered, recorded here:** the `v3f2` checklist. The cards are **"great"** (rows 1–3),
nothing else looked unfinished (row 4), and next was a balance phase (row 5, this one). The two-season
game was **one human against five AIs**. It is not Phase E's four-human playtest, so **the four 🎲 rows
are still open**.

---

## Open questions and carried forward

1. ❓ **Hard is now clearly stronger than Normal at a mixed table** (62% in two-season games). If Hard
   should be harder, that is fine. If Hard is now too good, the dial is Hard's play, which Jesse chose
   not to touch this phase.
2. ❓ **The ceiling binds for ordinary bets once a stable is rich.** In a long game a tenth of cash is
   over 1,000 most weeks. That is the point of the cap, and the checklist's first row asks whether it
   still feels worth betting.
3. ❓ **Mean end worth, all-Normal, one season, is 42,170 against 25–40k.** It is unchanged by this
   phase, and has been ❌ since `v3e1`.
4. **The goldens cannot see the cap.** Both are six Normal. A Hard seat in a golden would guard the
   betting rules. That was not added here, because it would move the goldens for a reason other than a
   rule change.
5. Carried, untouched: Phase E's four 🎲 rows; the F1 checklist; a human choosing their own face; the
   long game widening; §7.5's split view.
