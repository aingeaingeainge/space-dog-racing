# V3 Phase T notes: the weekend at once, and three staff (22 October 2026)

> ⚠️ **Pushing `v3t` ends every live room.** Rules moved: `STATE_VERSION` / `SAVE_VERSION` 15 → **16**,
> `PROTOCOL_VERSION` 2 → **3**, both goldens re-recorded once (`5442350`). Push only when nobody is
> mid-game (CLAUDE.md). The fallback is `v3s` (`1fd3e84`).

Built in Cowork from a clone, on Jesse's two calls (`claude/V3_PHASE_T_PROMPT.md`, with the four
answers he gave before the build). Tag **`v3t`**.

**In one line:** nobody waits their turn any more — every stable plays its whole weekend at once with a
shelf of its own and its Race Office sealed until everybody is done — and every stable has a Trainer, a
Trade Advisor and a Gambling Advisor, each paid from their own side of the game.

---

## What changed

| | Before (`v3s`) | Now (`v3t`) | GDD_V3 |
|---|---|---|---|
| **Turn order** | Rolled every arrival: `20 − crates ÷ 5 + d10`. | Gone. `turnOrder` is the seating order and means nothing. | T1 |
| **The weekend** | Explore (a phase), then Market + Kennels + Race Office in turn order, then the Bookie at once, then after the races in turn order. | One `planetPre` phase everybody plays at once: the door first, then the stable's own market, kennels and Race Office in any order. The Bookie and after the races are also any order. The AIs play the moment a phase opens. | T1 |
| **The market** | One shelf a planet, shared, first come first served. | Every stable gets **its own shelf**: `privateShelfShare` (0.2) of the posted depth, rounded up. A Mash glut or shortage behind a door moves only the finder's price. | T2 |
| **Declarations** | Public the moment they were made, in turn order (V16). | **Sealed** until the last stable finishes; the whole card goes up at the lock. The Race Office shows each rival's sound dogs ("could run 52 front-runner, 48 closer…"). AIs are sealed the same way (`sealedFor`). | T1 |
| **One-of-a-kind cards** | Gone for the next stable through the door. | Every stable draws from the whole deck. A staff offer is never somebody being offered to another stable that weekend. | T1 |
| **Arrive first / last** | The wormhole, the pilot's chart, the fried navicomp. | They land the dogs rested (+10 fitness) or shaken (−10). Blackreach's reversed turn order became **every shelf ×2**. | T1 |
| **Staff** | Two trainers, each a cut of purses. | **One Dog Trainer, one Trade Advisor, one Gambling Advisor**, each a cut of their own side. 41 people (17 / 12 / 12); 17 new, drawn as SVG. | T2–T4 |
| **The opening draft** | Six rounds: four dogs, two trainers. | Seven: four dogs, one of each role. Q2's third-round reversal kept (measured below). Off-season: a hire replaces that role's holder. | T2 |
| **The Bar** | Four trainer cards. | Six staff cards: two for trainers, one for a Trade Advisor (`traderWithALedger`), one for a Gambling Advisor (`tipsterAtTheRail`), the old hand (trainers) and the agent (any role). | T2 |

### The advisors (T3, T4 — sheet cells, first measurements)

| Role | Bonus | Size | Cut |
|---|---|---|---|
| Trade | next week's prices (was a trainer's) | — | 5% of trading profit |
| Trade | buys cheaper | −5% | 20% |
| Trade | sells dearer (never up to the buy price) | +4% | 3% |
| Trade | a deeper shelf | +25% | 15% |
| Gambling | a race-day tip a week, **rivals' dogs only** (was a trainer's, any dog) | 1 | 10% of winnings |
| Gambling | a better price on every slip | +5% odds | 15% |
| Gambling | a higher flat stake ceiling | +50% | 2% |

Trading profit is crates × (sell − You Paid) on a sale, above zero; winnings are payout − stake on a
winning slip. Pair premium 2%; an advisor is capped at 40% of their side, a Trainer at 10% of purses.

---

## Measurements

**The economy (`npm run harness -- --seasons 50`, six Normal):**

| | `v3s` | `v3t` |
|---|---|---|
| End net worth mean / p10 / p90 | 56,207 / 41,319 / 71,089 | 56,045 / 42,465 / 73,079 |
| Prize / trade / betting (net) | 29,943 / 3,047 / −964 | 28,481 / 3,729 / −920 |
| Food sold, share of gross income | 24.6% | 28.3% (band 20–35%: MET) |
| Cash-bound → hold-bound week | 4.6 (73% cross) | 5.5 (43%) (band 4–7: MET) |
| p99 best trading leg | 5,512 (9.8% of worth) | 4,287 (7.6%) |
| Races entered a weekend / races a dog a season | 2.70 / 6.34 | 2.72 / 6.38 |
| AI decisions a weekend (the harness's count, not a human's) | 8.60 | 11.50 |

The decisions row rose and was not broken down here; it is the AI's own action count (`hub-clicks` is the
human's budget, below).

**The private shelf share, swept** (food sold a stable-season / crossover week / share that crosses):
0.15 → 10,313 / 5.1 / 19%; **0.2 → 13,417 / 4.7 / 45%**; 0.25 → 15,489; 0.3 → 18,500; the whole posted
shelf to every stable → 34,737 / 1.9 / 100%. 0.2 is nearest `v3s` on the crossover row.

**Draft position fairness** (`harness --draft`, 1,000 one-season games a table size, widest gap from a
fair win rate at 3 / 6 / 8 stables, ±3 is the target):

| Run | Result |
|---|---|
| Seven rounds, Q2's reversal on, first-guess cuts and Normal's old price list | 1.7 / 5.5 / 4.7 — MISSED |
| Plain snake, same | 1.4 / 0.9 / 1.7 — MET |
| Plain snake, re-priced advisors, Normal's list = measured worth | 4.0 / 4.7 / 6.8 — MISSED |
| Reversal on, same | 1.7 / 1.8 / 2.2 — MET |
| **As shipped** (reversal on, the cuts above) | **1.7 / 1.0 / 3.0 — MET** |

Which way the snake runs only matters because the staff rounds (5–7) follow the dogs and the Trainer
round is the one that counts; with Normal reading every bonus at its measured worth, the reversal keeps
the first pick off the first Trainer. Re-pricing the trainers too (fitness 9%, prize money 10%) did not
help (4.9 / 4.0 / 5.4) and is not shipped.

**The advisors' prices** (D12's regression, 17,000 drafted stables; sides a season ≈ 28,700 purses,
4,800 trading profit, 1,400 winnings). The advisor rows are loose: ±250–450 Bones of end worth each, and
four runs moved every advisor's fair cut by ten points or more. As shipped: next week's prices +334
(fair 12%), buys cheaper +146 (23%), sells dearer −735 (−12%), deeper shelf +997 (36%), the tip −111
(2%), better odds −498 (−21%), higher limit +211 (17%). Read: **the deeper shelf is the bargain and
better odds the dud, within the noise**. Normal's price list (`STAFF_WORTH`) is the measured worth, so it
drafts the bargains. GDD_V3 §14 Q18 asks the table.

**Pace (`hub-clicks`, 20 seasons):**

| | `v3s` | `v3t` |
|---|---|---|
| Hotseat, 4 humans: passes a weekend | 10.6 | **5.9** |
| Hotseat, 8 humans: passes a weekend | 22.4 | **13.7** |
| Presses a human a weekend at the table | 13.4 / 13.6 | 12.3 / 12.4 |
| Solo clicks a weekend | 9.3 (MET ≤ 10) | **10.2 — MISSED by 0.2** |

⚠️ The solo row missed because the Market is worth a visit more often (venue visits 1.4 → 1.9): a shelf
of your own is never bought bare by the stables ahead of you, so the hub flags it more. That is the
market being there, not a screen getting worse; not chased.

Online, nobody waits a turn: in `online-walk`'s games 116 of 1,701 and 129 of 1,034 actions were a door
or a "Fly on" from a seat the engine was not naming — all applied at once, none held.

---

## Checks

- `npm test` **233 green** (`simultaneous.test.ts` new: any order, the same weekend whichever order three
  humans play it in, private shelves, sealed declarations for a view and an AI, the advisors' prices and
  commissions, one of each role through two seasons).
- `server:test` **14 green**; `online-walk` **All 27 rows pass**; `online-table-walk` **All 10 rows pass**;
  `browser-walk` **All 8 rows pass** (a weekend in three browsers at once, a seven-round draft).
- `season-check` clean (0 leaks); `view-walk` **0 throws**; `race-view-check` clean; `asset-check`
  **307 finished, 0 stand-ins, 0 missing**; `eslint`, `prettier`, both typechecks clean.
- `hotseat-shots` taken; the draft page is long now (27 staff cards at six stables) but reads.

---

## For Jesse to look at

1. **The sealed Race Office** (T1). Running styles now matter to the manager only as a guess from the
   rivals' kennels; the field's shape is read at the Bookie. If declaring stops being interesting, the
   alternative you turned down was a live public board, changeable until you lock (§14 Q17).
2. **The advisors' prices** (T4) are measured loosely. If one is everybody's first staff pick or nobody's,
   it is a sheet cell (`staffCut…`, `staff…` in the Phase T section).
3. **The private shelf** is a fifth of the old shared one. A solo or three-stable game now has a smaller
   shelf than it had (it was shared with fewer); an eight-stable game a bigger one. `privateShelfShare`.
4. **Solo clicks 10.2** against a budget of 10, from the market being worth more visits.
5. **Seventeen new portraits and two Bar cards** are hand-built SVG from `draw-staff-portraits.py`, in
   the trainers' style. Easy to redraw if any face misses.

## Not done

- Hard's "board read" (it read the public declarations) is gone with the board; Hard declares from its own
  kennel as Normal does. Not re-measured against Normal.
- `ONLINE_PLAN.md` §5.1's table is kept as the record with a superseded note above it, not rewritten.
