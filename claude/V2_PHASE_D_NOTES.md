# V2 Phase D build notes — the dark side and the scoreboard (13 September 2026)

**Status: Phase D complete, tagged `v2d`.** Seven commits on `main` after `a261ff5`, **not
pushed** — the bundle and the commands are at the end.

The golden snapshot moved **three times**, not the usual two, and the split was planned before a
line was written because the brief asked for it:

| | |
|---|---|
| `de96c29` | Item 0: what a bet is worth, before the rules that make it one |
| `b45ae87` | **The trap draw — snapshot move 1**, alone, with a full re-baseline |
| `6002b20` | **The crook's road — snapshot move 2**: §13's actions and state, the stake ceiling, the championship purse |
| `8265d1c` | Harness part 4: the crook, the mixed agent, `--fix`, `infoROI` |
| `b7f1cb7` | **Content and balance — snapshot move 3**: the information cards, the swept numbers, Hard's two ablations |
| `073820d` | The screens: the Fixer's counter, the box, and the price on both |
| *(this one)* | GDD 0.6, BUILD_PLAN, the decision log and these notes |

**Why three moves rather than two.** The brief's own suggestion was §13's state and then the
content pass. A third arrived because the steward's bribe turned out to buy nothing (below), and
the fix for that is a **race-simulation rule under everything else in the game** — the same class
of change as Phase A's §6.2 rebalance, for which BUILD_PLAN §11 prescribes exactly one treatment:
land it alone, first, and re-baseline immediately. Following the project's own precedent seemed
better than obeying the letter of a two-move budget. `npm test` is 22 green at every commit and
`determinism.test.ts` needed no changes; `properties.test.ts` gained **seven** invariants and
edited none.

---

## The sentence this phase was measured against

> *Jesse plays a season and can say whether he was ever tempted to cheat, and whether he was right
> to be.*

The honest answer this session can give is: **the temptation is priced, on the screen, in Bones —
and by the harness's own measurement you would usually be right not to.** Both halves of that
matter, and the second one is the phase's main finding.

---

## ⚠️ The headline: §13 is built, and measured, and it does not pay

Everything §13 describes now exists. The Fixer is hireable for the first time since M4 session 1.
A steward will sell you your dog's box before the draw; a man will take 25 fitness off a rival
after the prices have gone up and while the book goes on quoting them. The stewards catch you at
a rate that depends on where you are and who you employ, fine you a flat sum **plus a quarter of
what you had on that race**, strike your fixer off, bar you from hiring another for the season,
and tell the whole table who it was.

And then the ablation — the same agent, the same seeds, once with the road and once with it
switched off — says this, over 250 seasons:

| crook | mean | p10 | p90 | betting income |
|---|---|---|---|---|
| with §13 | **26,957** | 2,592 | 46,667 | **+1,885** |
| §13 ablated | **30,455** | 15,349 | 51,362 | −713 |

**Working the crook's road costs 3,498 Bones of end worth.** It is not close and it is not noise.

Two things inside that table are worth more than the headline:

1. **Betting turns positive for the first time in this project.** −713 → +1,885. §7.1 has called
   betting "a rounding error" since v1 and §10 says it "is only a road because §13 manufactures
   the knowledge that makes it positive". That sentence is now *true*. The knowledge is
   manufactured and it is worth money.
2. **The p10 collapses, 15,349 → 2,592.** The punishment tail is real and it is severe. That is
   §2.1's crook column — "high variance, with a punishment tail" — working exactly as described.

So the road exists, the edge is real, and the thing that eats it is not the deterrent.

### What eats it is the wage

The arithmetic, all of it measured this phase:

- A nobbling is worth a **percentage** of the stake. `--fix`, 5,850 real locked fields: backing
  your own runner is worth a mean **23.2%** (§13 said +23%, on a hand-built field, three phases of
  economy ago — it holds); backing the best price left on the board is **27.4%**, and **33.1%** at
  a Major.
- A stable's affordable stake is about **3,000**, because the 50%-of-cash fraction binds on cash
  of six or seven thousand. So an average fix grosses about **840**.
- A Fixer is a **wage**, charged every week, and gets used about **twice a season**.

840 a week of gross against 250–1,400 a week of wage, before a fee or a fine. The deterrent was
never the problem; the payroll was. And the same arithmetic shows up from the other side in Hard's
ablation below, which is what makes it a finding rather than a story about one agent.

### The deterrent was far too strong — the opposite of what §13 feared

§13 worried the punishment was too *light*: "a fine of 3,000 at 25% detection is −750 expected
against a gross of roughly +1,400 — not enough." The gross it assumed is the part that was wrong.
Swept, 150–250 seasons a cell, the crook against the trainer and the trader in the same seasons:

| catch | fine | fee | ceiling | crook mean | fixes | caught |
|---|---|---|---|---|---|---|
| 0.35 | 1,500 + 0.50 × stake | 1,200 | 4,000 | 29,493 | 0.8 | 36% |
| 0.30 | 1,500 + 0.25 × stake | 1,200 | 4,000 | 29,533 | 1.0 | 38% |
| 0.25 | 1,500 + 0.25 × stake | 800 | 4,000 | 31,607 | 1.4 | 46% |
| **0.25** | **1,200 + 0.25 × stake** | **500** | **8,000** | **34,600** | **2.6** | **64%** |

At §13's own starting numbers the average fix **loses money at any stake a stable can reach**.
Settled at the last row.

⚠️ **The flat stake ceiling is the single biggest lever, and the reason is structural:** the edge
is a percentage and the fee is not, so the whole road scales with what you can have on. Which is
also §10's warning — "max stake is a rich-get-richer channel" — seen from the inside. The guard
holds at 8,000: `leadConversion` split on whether the stable bet reads **leader −0.11 against
trailer −0.05**, so having had a bet costs a leader *more* than a trailer. MET.

### The lever named for next time

**The stake, and where the money for it comes from.** §20 Q7 asked what flat ceiling stops the
leader; the measurement says the ceiling is not what binds at all — the **50%-of-cash fraction**
is, at about 3,000. The crook agent borrows from Fat Tony to get past it (§20 Q15's question,
answered for the wrong road: it is the *crook* who wants a shark, not the trader), and 10% a week
is dear enough that it barely helps. The honest next question is whether a road whose edge is a
percentage can ever be a third road while the bankroll is a racing stable's working capital.

---

## ⚠️ The second finding: the steward's bribe bought nothing, and the reason was a bug

§13's bribe is "choose your dog's trap draw, 800 ⚖️". Measured before building it: `simulateRace`
reads the trap **number** in exactly one place — the Nervy trait's penalty at traps 1 and 8. Trap
*craft* decides the bends; the draw decides nothing. So the bribe as written was §8.4's supplement
again, which this phase's brief names as the trap not to repeat, twice.

And measuring it turned up something else. `const victim = ri.trapStat <= rj.trapStat ? i : j`
made the lower array index — which is the lower trap — the victim of **every** bend clash between
two dogs of equal craft. In a field of identical dogs on a tight track that was worth

    trap  1     2     3     4     5     6     7     8
    win  9.1%  9.7% 10.4% 11.3% 12.7% 14.1% 15.4% 17.3%

Nothing intended it, nothing printed it, and it has been in every race with bends since M0. In
real fields craft differs and the tie rarely fires, so it was a quiet bias rather than a broken
game — but it was the trap number mattering a great deal, by accident, while the design said it
mattered not at all.

Jesse's call was to give the draw a real effect. Two rules, pulling opposite ways, one number
each (D37):

- **the rail is the short way round** — `trapDrawEdge` 0.018, a top-speed multiplier running +half
  at trap 1 to −half at the outside box, scaled by how tight the bends are and **zero where there
  are none**;
- **the rail is where the traffic is** — `trapTraffic` 20, so the dog with less craft *for the line
  it is on* comes off worse, and a dog on the inside needs the craft to hold it.

Swept on one dog walked across all eight boxes against seven craft-50 rivals, 9,000 races a box:
choosing your box is worth **+3.5 points of win rate** on a tight 480, tapering with the bends and
to nothing on a straight. So the bribe pays at a Major or alongside a bet and does not pay on a
quiet Tuesday — the *benefit* scales with the race while the fine does not, which is §8.4's shape
turned the right way up.

**It cost the economy almost nothing and bought Q12 a third of a week.** 800 all-Normal seasons,
mean end worth 31,382 → 30,980 (−1.3%), stat leverage unmoved and still in rating-weight order,
and the season **decided at week 6.9 instead of 6.6**. Q12 has resisted two phases of deliberate
attempts and moved for a change nobody aimed at it, because a random draw is one more thing a
leader cannot bank. (The championship purse then gave most of it back; the phase ends at 6.7.)

### The test that was quietly not testing what it said

`race.test.ts`'s calibration shuffled the field **after** numbering the boxes, so the hero —
created first, numbered trap 1 — ran from trap 1 in all 1,200 races however the array was
reordered. That cost nothing while the trap number was worth nothing. The moment it was not, the
test read 60.9% against the harness's own `--calibrate` on 57.4%. Traps are numbered after the
shuffle now, which is the engine's own rule, and `properties.test.ts` gained the invariant that
makes it true everywhere: **a runner's trap is its position in the field** — which §13's bribe is
about to start moving dogs between.

---

## ⚠️ The third finding: the roads are not mixable

BUILD_PLAN §6b's last acceptance row — "a mixed agent playing all three, not worse than the best
single path" — is the only row in the plan that had never been attempted, and §2.1 states the
claim it tests in as many words: *"They are meant to be mixable. A stable that trains a pup, pays
for it by trading, and backs it at 9/1 when it is ready is playing all three, and should be about
as rich as one that commits."*

400 seasons, all four in the same seasons:

| agent | mean | p10 | p90 | p90/p10 | prize | trade | bet | fixes | caught |
|---|---|---|---|---|---|---|---|---|---|
| trainer | **35,644** | 7,592 | 77,094 | 10.2 | 38,123 | 589 | 0 | 0.0 | — |
| trader | 29,532 | 8,995 | 50,232 | **5.6** | 23,834 | 5,511 | 0 | 0.0 | — |
| crook | 28,785 | 1,295 | 77,072 | **59.5** | 27,421 | 1,231 | 1,311 | 2.1 | 61.0% |
| **mixed** | **25,803** | 3,192 | 45,815 | 14.4 | 31,136 | 1,995 | 614 | 0.8 | 30.5% |

**The mixed agent is worse than every single road, by 10% against the trader and 28% against the
trainer.** It plays the same steps with one options object each, so this is not a fourth agent
written worse than the other three: it is three roads competing for three staff slots, one
kennel's worth of cash and one week's worth of attention, and losing to any one of them played
properly. §2.1's sentence is measured for the first time and it is not true of the game as built.

Whether that is a fault is a design question rather than a measurement one, and it is Jesse's. The
case for leaving it: committing to a road is a *decision*, and a game where the safe answer is
"a bit of each" has fewer of those. The case against: §2.1 promises otherwise in print, and a
player who spreads their bets should not be punished for it as hard as this.

---

## The acceptance table, every row, met or not

| Measure | Target | Measured | |
|---|---|---|---|
| trainer / trader / crook mean end worth | within 15% of each other | **23.8% apart** (35,644 / 29,532 / 28,785) | ❌ |
| each path's p90/p10 spread | distinct — the crook widest, the trainer narrowest | crook **59.5**, mixed 14.4, trainer 10.2, trader **5.6** | ⚠️ half |
| crook agent caught at least once | 40–70% of seasons | **61.0%** | ✅ |
| a caught crook's mean end worth | below the trainer agent's | 38,281 against 35,644 | ❌ and **confounded** |
| a mixed agent playing all three | not worse than the best single path | **25,803** against 35,644 | ❌ |
| Hard beats Normal | 63–68% | **57.7%** | ❌ |
| `hub-clicks.ts` | ≤ 14.5 | **14.3** | ✅ |
| `npm test` | green, snapshot moved only in its named commits | 22 green, moved three times, each named | ✅ |
| `npm run lint` | clean | clean | ✅ |
| `npm run build` | → `packages/web/dist` | yes | ✅ |
| `season-check.ts` exercises the bribe, the sabotage and a caught crook | walked, not survived | 8 jobs, 3 enquiries, 3 bans — and the run **fails** if any is zero | ✅ |

### Two rows that cannot mean what they say

**"the trainer narrowest"** was already contradicted in Phase C and is contradicted again. §20 Q2
measured it last phase — "the trainer's road is the volatile one and the trader's is the safe one"
— so the acceptance row and the GDD section disagree, and the GDD is the one with the numbers
under it. The row should read *the crook widest, the trader narrowest*, and it is met on that
reading.

**"a caught crook's mean end worth, below the trainer agent's"** reads as *crime does not pay* and
measures something else entirely. Measured naively it comes out backwards — a caught crook makes
**38,281** where one that fixed and got away with it makes **14,117** — and the reason is
selection, not crime paying: a crook that never gets caught is mostly one whose road never opened,
so "clean" quietly means *poor and honest by accident*, and a crook that fixes often enough to get
caught is one that had the bankroll to fix often. The harness now splits on "fixed at least once"
and prints the caveat underneath. **The row's real question is answered by the ablation instead**:
the road costs 3,498 Bones, which is the only comparison that holds everything else equal. Same
class of problem as D25's `apLoss%` — the measure was reaching for something the obvious
implementation cannot express.

---

## Hard: two things tried, both measured, both rejected

Hard beats Normal **57.7%** against a 63–68% row. It has now gone 60.6 (v1) → 56.8 (A) → 53.9 (B)
→ 58.6 (C) → 57.7 (D), and it remains the project's most-missed number. Both of the brief's own
candidates were built and ablated.

| Hard's betting, 300 seasons | beats Normal | mean | p10 | bet income |
|---|---|---|---|---|
| flat fraction of cash (kept) | **58.3%** | 41,109 | 9,390 | +867 |
| quarter-Kelly on the measured edge | 56.7% | 37,915 | 11,061 | −178 |

| Hard's third slot, 200 seasons | beats Normal | mean | p10 | fixes |
|---|---|---|---|---|
| trainer + vet (kept) | **58.8%** | 41,663 | 8,919 | 0.0 |
| trainer + vet + fixer, **and working him** | 49.3% | 33,973 | 7,460 | 0.8 |

⚠️ **The Kelly result is the more interesting of the two.** §14 has asked since M4 for Hard to
price its own information, and it does — and then stakes the same fraction of cash whether the
edge is 16% or 90%, which is most of the way to not knowing. Sizing by it is *worse*, and the
reason is specific: Kelly stakes **more as the price shortens**, so it moves money off the long
shots — which is exactly where `effectiveRating` finds its edge, because a fed dog that has not
had the results yet is a dog the book has long — and onto short ones, where Hard's own estimate is
least likely to beat the book's. Sizing a bet by an edge you have *measured* is right; sizing it
by one you have *estimated* is right only where the estimate is good, and Hard's is good in one
corner of the board.

The second is D30's question re-asked now that §13 gives the third slot something to do, and the
answer is a flat no by **9.5 points** — the same per-job-value-against-per-week-wage arithmetic
that stopped the crook's own road paying, seen from the side of a stable that already earns well.

Both are kept behind `HARD_KNOBS` with the tables in the comment, so the next session does not
re-try them.

---

## Everything else that landed

**The Fixer's ladder is a ladder of a number, not of abilities (D41).** He shipped in move 2 with a
Rough man who could buy a box and not get at a dog. It read well — the cheap half of the road has
no punishment tail, so why should the cheap man sell you the half that does — and it starved the
road: a Proper-or-better fixer turns up at 30% of the 45% of planet-weeks that offer one, so a
crook had a working fixer in **30% of its weeks, first arriving in week 6.5**. Any fixer now does
either job and what you pay for is how well he covers his tracks (×1.5 / ×1.0 / ×0.5 on the catch
rate). Same crook, same seeds: a working fixer in **67% of weeks, first arriving in week 3.8**.
That is how every other role on the ladder works, and the exception was the mistake.

**Lagrange Lows guarantees a Fixer**, because its row has said "Fixer for hire (§13)" since M0 and
nothing ever read the flag.

**§9.3's information cards — Phase B's debt, deferred twice — are paid.** A drunk navigator sells
the week after next for 260 and two drinks; a customs clerk sells the kibble band two weeks out
for 200 and is **wrong a quarter of the time**; a tout sells next week's card for 150 and is wrong
a fifth of the time. They add nothing to `GameState` (D5, D36): what a card sells is a log line
addressed to the buyer, and a card that lies writes a line that is wrong with nothing anywhere
marking it. That is the one thing the other three carriers cannot do — a dossier is a purchase you
chose, a navigator is an offer you did not. The lie is rolled when the card is **drawn**, so a
human and an AI meet the same manifest and the rng stream does not depend on which button is
pressed.

**The championship purse is 5,000 / 2,500 / 1,250, not 12,000 / 6,000 / 3,000.** §4.3 marks it
[estimate] and calls it "about 6% of a champion's end worth". Measured, 200 seasons a cell:

| purse | mean | p10 | p90 | champion | decided by | share of a champion |
|---|---|---|---|---|---|---|
| 12,000 / 6,000 / 3,000 | 34,163 | 8,361 | 73,114 | 77,325 | 6.71 | **15.5%** |
| 8,000 / 4,000 / 2,000 | 32,994 | 8,349 | 69,779 | 73,480 | 6.64 | 10.9% |
| **5,000 / 2,500 / 1,250** | 32,117 | 8,349 | 66,922 | 70,636 | 6.70 | **7.1%** |
| nothing | 30,654 | 8,301 | 63,027 | 66,027 | 6.80 | 0.0% |

At 12,000 it is two and a half times the size §4.3 intended, and the shape is the giveaway: **p10
does not move at all while p90 rises 16%**, because it is paid in the last week of the season to
whoever is already in front. Points are **derived from the race archive rather than stored** — the
finishing order and the owner on the day are already in `RaceResult`, so a field would be a second
copy to keep honest (D36 again). One ordering bug found on the way: the purse has to be counted
*after* `s.races` is published, or the Grand Final's own three races would not have counted toward
the championship they decide.

**§7a.4's last unbuilt measure, `infoSpend` / `infoROI`, is in — and reads negative.** The trader
agent spends 3,694 on dossiers and a Tipster's wages; its covered legs return −201 against
uncovered legs' −137, so information makes a leg **65 Bones worse**. ⚠️ Read that as a statement
about the *instrument*, not the economy: a leg is week w's sales against week w−1's purchases, and
a hold does not turn over neatly every week — an informed stable buys deeper and holds longer, so
its purchases and sales fall in different buckets more often. The honest fix is to tag crates with
the week they were bought, which is a state change this phase did not have a snapshot move left
for. Named rather than explained away.

---

## The full re-baseline

`npm run harness -- --seasons 800`, all Normal:

| | Phase C (`v2c`) | Phase D (`v2d`) |
|---|---|---|
| mean end worth | 31,382 | **32,543** |
| p10 / p50 / p90 | 9,113 / 25,909 / 64,538 | 8,582 / 26,323 / 68,646 |
| prize | 32,185 | **33,632** |
| trade / betting / costs | +1,939 / −814 / 24,120 | +1,893 / −849 / 24,119 |
| prize share of gross | 77.3% | **78.2%** |
| food sold, gross | 3,708 | 3,676 |
| bankruptcy, Normal | 0.1% | 0.1% |
| fitness at declaration | 71.5, 19.9% under 60 | 71.5, 19.8% under 60 |
| races per dog | 5.1 | 5.1 |
| dogs at week 13 | 3.83 | 3.83 |
| purse share to players | 53.8% | 53.8% |
| concentration, champion | 0.276 | 0.278 |
| decided by week | 6.6 | **6.7** |
| autoplan% | 9.1% | 8.8% |
| hub-clicks | 13.9 | **14.3** |

The prize share going *up* is the championship purse, which is prize money by §4.3's own
definition. Everything else is within a phase's normal drift.

Head to head, `--ai easy,normal,normal,hard,hard,normal`, 800 seasons: **Normal beats Easy 80.8%**,
**Hard beats Normal 57.7%**, Hard beats Easy 83.4%. Means: Easy 11,686, Normal 29,940, Hard 40,856.

`--calibrate`: a balanced 65 beats seven 50s **57.4%** (was 58.5) — the draw moved it *away* from
the top of the 45–60 band rather than toward it. Best-fit `oddsScale` 15.75 against the 15.5 in
the sheet; the bowl is flat and the worst-case error across ratings 35–75 is 1.9 points at rating
75, so 15.5 stands. §20 Q4's point survives: the crook's edge comes from what the bookie *cannot
see*, not from a mis-fitted scale.

`--stats`: **24.6 / 18.8 / 15.9 / 15.1**, all inside their bands and in rating-weight order, with
trap peaking on tight bends (16.1 against 15.1). D12 survives the draw intact — it redistributes a
race rather than re-weighting a dog.

`--pups`: Rough trainer reaches par at week 8, Proper week 6, Prime week 4. Unmoved.

`--card`: unmoved — neither the card nor eligibility was touched. Broad five-dog 76.3%.

`--ai careless,normal,normal,normal`, 400 seasons: **careless bankruptcy 4.0%** (16 of 400) against
a 5–10% band, mean 10,747, p10 −1,860. A near-miss: one standard error is about a point, so 4.0%
sits within one of the band's edge. Phase C read 5.5%.

`--fix`, 150 seasons, 5,850 locked fields: own runner **23.2%** mean edge, best price left
**27.4%**, at a Major **33.1%**.

`--roads`, 400 seasons — the four-way table is above.

---

## Verification

| | |
|---|---|
| `npm test` | **22 green**, golden snapshot moved three times and no more |
| `npm run lint` | clean |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seasons + the toggle variant, all to week 13, no `ActionError`, every log replays byte-identical. It now **hires a Fixer first**, buys a box, nobbles a favourite, faces the stewards and serves the ban — 8 jobs, 3 enquiries, 3 bans — and the run fails if any of the three is zero |
| `race-view-check.ts` | 195 races, every one replay-identical, 5 photo finishes |
| `hub-clicks.ts 25` | **14.3** a weekend (budget 14.5) |
| golden snapshot | `8a19efef…` → (draw) → (§13) → (content) → `b2c3a3fd…` |

`season-check` earned its keep on its first run: the walk-through offered a barred stable another
Fixer and the reducer threw. Both of §13's refusals are now respected by the walk-through, by the
Saloon's disabled reasons and by the hub's own hotspot.

---

## Carried forward

- **§13 does not pay, and the lever is the stake.** The fee, the fine and the catch rate are all
  swept out; what is left is that a percentage edge on a 3,000 stake cannot carry a weekly wage.
  The next honest move is either a Fixer who is not a weekly wage, or a bankroll that is not a
  racing stable's working capital. §20 Q15's loan shark is the second of those and 10% a week is
  too dear for it.
- **The roads are not mixable**, measured for the first time, and §2.1 says they should be.
- **Hard beats Normal 57.7% against 63–68%**, still the most-missed number in the project, with
  both of this phase's candidates ablated and rejected.
- **Careless bankruptcy 4.0% against 5–10%**, a near-miss within one standard error.
- **`infoROI` reads negative** and the measure is the suspect, not the economy — the fix is tagging
  crates with the week they were bought.
- **Races per dog 5.1 against 7–9**, missed for a fifth phase. §20 Q14's arithmetic still says the
  band is the thing that is wrong: 1.97 races a weekend × 13 ÷ 5 dogs *is* 5.1.
- **`apLoss%` still needs a forked rng stream** (D25). `autoplan%` is exact at 8.8%.
- **The "told who did it" half of §13's penalty is logged and inert** until M6 (D40). An AI holds
  no grudge; the fine and the ban are sized to carry the deterrent without it.
- **`oddsScale` best-fits at 15.75 against 15.5.** Left alone; worth a look if anything else moves
  the sim.

---

## To push

Same as A, B and C: the commits are real but they live in a clone in Anthropic's cloud, because the
shell into your folder still does not mount (`sandbox-helper: no Plan9 drive shares mounted`,
unchanged since 8 September). They arrive as **`phase-d.bundle`**, attached to the conversation.
Download it into the repo root, next to `package.json`.

Your `main` should be at `a261ff5` with a clean tree:

```powershell
git status                                  # expect nothing modified
git fetch phase-d.bundle "refs/heads/main:refs/heads/phase-d" "refs/tags/v2d:refs/tags/v2d"
git merge --ff-only phase-d                 # fast-forwards main onto the seven commits
git branch -d phase-d
git log --oneline -1
```

Then check it is what these notes describe, and push:

```powershell
npm test                                    # 22 green
npm run build                               # -> packages/web/dist
npm run harness -- --seasons 200            # mean ~32,500
npm run harness -- --fix                    # what a nobbling is worth
npm run harness -- --seasons 200 --ai trainer,trader,crook,mixed,normal,normal
npx tsx packages/web/scripts/season-check.ts
npm run dev                                 # and go and play a season

git push origin main
git push origin --tags
del phase-d.bundle
```

**`package-lock.json` is untouched, so no reinstall.** Cloudflare Pages will build the push on
Node 20; nothing added needs anything newer.

Three smaller things:

- **The commits are authored `Claude <noreply@anthropic.com>`**, set before the first commit. Your
  `Co-Authored-By` trailers are on every message.
- **`design/space_dog_racing_economy.xlsx` changed** and `balance.json` was regenerated from it
  with `npm run balance` — the JSON was never hand-edited. The Assumptions sheet gained **24 rows**
  (the draw, §13's fees and deterrent, the flat stake ceiling, the championship purse) and one is
  marked **(superseded)**: `fixCatchPrimeMult`, replaced by a multiplier per grade when the Fixer's
  ladder became a ladder of a number. `packages/engine/scripts/add-phase-d-rows.ts` is kept as the
  record of what was added and what each note says; **it upserts rather than skips**, because this
  phase's numbers came from sweeps and the sheet had to be able to take the answer back.
- **A v2c save will not load.** `STATE_VERSION` and `SAVE_VERSION` are both 5, and a Phase C action
  log could not replay anyway: it has no `BribeSteward` or `Sabotage` in it and its dogs have no
  `nobbled`.

---

## What to feel for when you play it

Phase C's lesson was that this game's problem is legibility more often than rules, and Phase D's
is that a road can be legible, correctly priced and still not worth walking. So the thing to
notice is whether the *temptation* reads, separately from whether taking it was right.

1. **Get a Fixer early and open the Bookie with a stake dialled in.** The counter under the odds
   tells you, in Bones, what nobbling the favourite is worth on the money you have on, what the
   stewards cost you if they notice, and the stake at which it stops losing. Does that read as an
   offer you are weighing, or as arithmetic being done at you?
2. **Buy a box at a Major, and then at a small meeting.** The Race Office prices both. It should
   be obviously worth it at one and obviously not at the other — and on the Void Derby's straight
   it should tell you to keep your money.
3. **Get caught.** The fine, the fixer struck off, and the line naming you in front of the whole
   table. Is that "fair enough", or does it feel like the game punishing you for playing a road it
   offered you?
4. **Then tell me whether it should pay.** The harness says it does not, by 3,498 Bones — a real
   edge eaten by a weekly wage for a man you use twice. If you were tempted, took it, and came out
   behind but *wanted to do it again*, the road may be right as it is. If it just felt like a tax
   on curiosity, the wage is the thing to change.
5. **The championship.** Points now accrue all season and pay at the Collar. Did you ever notice
   them before week 13, and did you ever put a dog in a race because of them?
