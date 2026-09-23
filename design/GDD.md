# Space Dog Racing — Game Design Document

> **Status: HISTORICAL.** v2, shipped at tag `v2e`. Superseded by `design/GDD_V3.md`.
>
> ⚠️ **Do not build from this document.** v3 is a deliberate change of genre and most of the rules
> below are cut. `design/GDD_V3.md` §0 explains what was kept and why.
>
> It is kept, and should not be archived, because its measurements and its decision log (D1–D53)
> are the record of *why* the game works the way it does — the fitness curve, the race constants,
> the trap-draw findings, the reasons a wage for the Fixer failed — and GDD_V3 cites them by name.
>
> Canonical copy: `design/GDD.md` in the `space-dog-racing` repo. A copy in a claude.ai Project is
> a **mirror**, last synced 24 September 2026. See `design/CANON.md`.

**Working title:** Space Dog Racing
**Version:** 0.7 — 14 September 2026 (v1 shipped at tag `m4`; v2 Phase A at `v2a`, Phase B at `v2b`, Phase C at `v2c`, Phase D at `v2d`, Phase E at `v2e`)
**Author:** Jesse Colbert, with Claude as design partner
**Status:** v2 design. ⚖️ marks a tunable that lives in `space_dog_racing_economy.xlsx`; ❓ marks an open decision; **[measured]** marks a number this design was tested against and **[estimate]** one that is a starting point for the phase that builds it.

> **What changed in 0.7, in one paragraph.** Phase E changed the *shape* of one hire and most of
> the phase followed from it. **The Fixer is no longer staff**: he is one man at the far table of
> whatever planet you are on this week, hired a **job at a time** at his own grade's price, and the
> road that cost 3,498 Bones to walk in Phase D now pays **+6,061** on the same ablation (D45,
> §13). Nothing else about §13 moved — the fee, the fine, the catch rate and the stake ceiling are
> the numbers Phase D swept — so the whole of that 9,500-Bone swing is the difference between a
> wage and a price list. §2.1's "the roads are meant to be mixable" is **true as measured**: the
> three roads land **3.8% apart** against a 15% target, the closest they have ever been, and a
> stable playing all three ends above the best single road (D46, §20 Q2). ⚠️ **Three of this
> phase's findings are negative and they are the ones worth keeping.** Hard's head-to-head was
> chased through six ablations and **none of its decisions is a bad one** — two are load-bearing —
> so whatever keeps it off 63–68% is not on that list (D49). `apLoss` is retired as a debt and
> replaced with a **bound** rather than a figure (D48). And the careless bankruptcy row turns out
> to have been measuring a cascade rather than ruin: the flag fires 3.6% of the time and **15.7% of
> careless stables end on nothing or less** (D51). `infoROI` is repaired and says information is
> not currently paying for itself (D44). Races per dog gets a band that is arithmetic rather than a
> guess (D50). ⚠️ **None of it has been played.** Phase D was not playtested either, so `v2e` is
> two phases of unplayed change and the checklist at the end of `claude/V2_PHASE_E_NOTES.md` is
> written for both.
>
> **What changed in 0.6, in one paragraph.** Phase D is built and v2 is complete. §13 exists in
> code for the first time — the Fixer is hireable, a steward will sell you a box, a man will take
> fitness off a rival after the prices have gone up, and the stewards will fine you a flat sum plus
> a quarter of what you had on the race. **The edge is real and the road does not pay**: the same
> crook with §13 switched off ends **3,498 Bones richer** (D42), because a percentage edge on the
> 3,000 a stable can stake cannot carry a Fixer's weekly wage for a man it uses twice. Two things
> inside that are worth more than the headline — betting turns **positive for the first time in the
> project** (−713 → +1,885), and the crook's p10 collapses 15,349 → 2,592, which is §2.1's
> punishment tail working exactly as written. Along the way the steward's bribe turned out to buy
> **nothing** (the trap draw was read in one place in the whole simulation) and an accidental
> tie-break was silently worth 9.1% against 17.3% between identical dogs; both are fixed and the
> draw is now a real decision (D37), which bought Q12 a third of a week that nothing aimed at it
> ever has. §2.1's "the roads are meant to be mixable" is measured for the first time and is **not
> true** (D43). §9.3's information cards are finally paid, and the championship purse is a third
> of the size §4.3 estimated (D39).
>
> **What changed in 0.5, in one paragraph.** Phase C is built. §8.1's ladder, §8.2's twelve feeds,
> §8.3's six roles in three slots, §9.2's two fuel levers and §7.5's wage bill are what the game
> does rather than what it intended, and every ⚖️ in those sections is a cell in the spreadsheet.
> **D22's purse cut is dead, and the way it died is the most useful finding of the phase**: cutting
> the pool 10% costs 15% of a stable's end worth and moves the prize share from 77.3% to *77.4%*,
> because prize money is the working capital of the other two roads — so the ratio is invariant to
> the cut at any depth (D29, §6.4). Three targets are met for the first time: bankruptcy is
> reachable (5.5% of careless seasons, D6), the two roads that exist are worth the same to within
> 1.4% (§20 Q2), and a cargo upgrade pays for itself (§20 Q6). Hard's head-to-head recovered 4.7
> points by hiring *less* (D30). Two things are still missed and said so in place: the 65% prize
> share, which D29 retires as a target, and races per dog.
>
> **What changed in 0.4, in one paragraph.** Phase B is built. §6.3's card and §9.3's fog are
> what the game does: Bronze, Silver and Gold are gone, every weekend runs The Open plus two of
> seven fact-gated types, and the circuit is dark past next week unless you buy it. §6.4's purse
> cut is the one deliverable that was measured and **deliberately not applied** — the arithmetic
> is in §7.1 and D22, and the short version is that cutting the pool cannot reach the ratio it
> was meant to reach, because the ratio moves when the other two roads grow. Two numbers the plan
> did not anticipate were fitted from the coverage sweep (D23), and two instruments turned out to
> be measuring nothing (D25, §20 Q11).
>
> **What changed in 0.3, in one paragraph.** Phase A is built. §5.1's stat table, §5.2's curve,
> §5.7's states, §5.6's pups and §6.2's constants are now what the game does rather than what it
> intended, and every ⚖️ in those sections is a cell in the spreadsheet. Three numbers moved that
> the plan did not anticipate — the local dogs' rating and fitness, and Easy's skip rate — all for
> the same reason, recorded as D17. Two targets are missed and said so in place: bankruptcy is
> still structurally unreachable until Phase C's wage ladder exists (§7.5), and stamina still
> reads the same at every track length because the fade is a fraction of the distance (§6.2).
>
> **What changed in 0.2, in one paragraph.** v1 is a finished, correct, deterministic game that does not have enough decisions in it. The fix is not more racing — it is three ways to get rich (§2.1) and a stable you raise rather than buy (§5.6). This rewrite hangs on eleven decisions recorded in §19 and on a measurement pass whose results are in §20. Two of those results changed the plan rather than confirming it: the race simulation turned out to be an almost pure speed contest, which would have made three of the four new feeds worthless (§6.2), and fitness turned out to be far *too* violent rather than too weak, which is why it never bit (§5.2).

---

## 1. Vision

A 45–60 minute, 13-week season of managing a stable of greyhounds on the grimy underground dog-racing circuit of a cartoon future. You hop planet to planet in a rattly transport ship, decide what each dog does with its week, watch the card play out top-down, and spend what you make on whichever of three roads to a rich stable you fancy: raising dogs, working the hold, or knowing a man who knows a steward.

**Tone:** Gazillionaire's pastel absurdity crossed with Death Rally's soot and neon. Gritty but cartoonish: dogs get injured, "supplements" exist, stewards can be bribed, loan sharks have names — but nothing dies on screen and the humour is always dark rather than cruel.

**References**
- *Gazillionaire* (1994): planet-hopping trading loop, quirky commodities, random events with choices, hotseat multiplayer, hand-drawn cartoon look, toggleable complexity.
- *Death Rally* (1996): career progression through tiers, garage/black market screens, loan shark, bribing a mechanic to sabotage the leader, top-down race view, criminal-underground humour.
- *Greyhound Manager 2*: stats, grading, trap draws, fitness/rest cycles, and the lesson that gambling is how kennels really pay the bills.

## 2. Design pillars

1. **The skill is deciding how to spend your money.** Three roads to a rich stable — the trainer, the trader, the crook — roughly equal in expected value, different in variance and in when they pay off, and mixable. Any rule that only touches racing is only touching a third of the game.
2. **You play the hand you're dealt.** The season's texture comes from what you are offered, not from a plan you execute. The circuit is hidden past next week (§9.3) and the good staff and feed are rare (§8.3), which are the same principle from two directions.
3. **A season you finish.** Thirteen weekends, always.
4. **Readable luck.** Races are random, but every stat and every event visibly nudges the odds. A player should always be able to say *why* a dog won — and, under pillar 2, should always be able to price what they have just been offered the instant it appears. Luck the player cannot respond to is noise, not design.
5. **Everyone can see the scoreboard.** Cash, net worth, every dog's rating and stat bars — all public. What is *not* public is the future: the circuit, the card, next week's prices.
6. **Grimy choices with real teeth.** The shady options must be tempting *and* punishable. Never dominant, never useless.
7. **Multiplayer-ready from line one.** The rules engine is a pure, deterministic function of (state, action, seed).

### 2.1 The three roads

Every rule in this document is tested against the question *does this make one of these better, worse, or more interesting to choose between?*

| | **The trainer** | **The trader** | **The crook** |
|---|---|---|---|
| What you buy | pups, feed, trainers, a bigger kennel | hold capacity, inventory, information | fixers, information, betting bank |
| Where the money comes from | prize money and the dogs' own book value | the spread between two planets | the gap between what the bookie knows and what you know |
| When it pays | late — a pup is worth nothing until about week 10 | steadily, but only on the legs worth acting on | in bursts, at the biggest races |
| Variance | low–medium | medium | high, with a punishment tail |
| The thing that can kill it | a Prime trainer's wage bill outliving the run of form | a hold full of kibble and nowhere good to sell it | getting caught |

They are meant to be mixable. A stable that trains a pup, pays for it by trading, and backs it at 9/1 when it is ready is playing all three, and should be about as rich as one that commits.

✅ **True as measured, as of Phase E — and it was a wage and a badly written agent rather than a
rule (D46).** D43 measured the sentence for the first time in Phase D and found a mixed stable
**28% behind** the trainer. Phase E relaxed each of the three suspects it named, one at a time, on
the same seeds, with the control row that makes the cash suspect mean anything:

| relaxed | mixed mean | against the trainer |
|---|---|---|
| nothing — Phase D's intensities | 32,148 | +1.6% |
| a fourth staff slot | **32,148** | +1.6% |
| twice the starting cash | 44,163 | +39.5% |
| every road at full intensity | 34,185 | +8.0% |
| *(control)* the trainer on twice the cash | 41,304 | +30.5% |

⚠️ **The slot row is identical to the Bone**: a mixed stable never fills three slots even when
offered four, so that suspect is not small, it is *zero*. The cash row lifts the mixed stable 37.4%
and the trainer 30.5%, so nearly all of it is compound interest rather than anything about mixing.
What is left is attention — worth +6.3% — and the Fixer's wage, which D45 removed and which is why
the first row is already *ahead* of the trainer rather than 28% behind it.

Four roads in the same seasons, 400 of them, two stables each:

| agent | mean | p10 | p90 | p90/p10 | prize | trade | bet | fixing | caught |
|---|---|---|---|---|---|---|---|---|---|
| trainer | 32,526 | 7,082 | 70,454 | 9.9 | 34,241 | 1,041 | 0 | 0 | — |
| trader | 33,758 | 10,964 | 61,795 | **5.6** | 24,746 | 7,720 | 0 | 0 | — |
| crook | 33,529 | 4,742 | 87,861 | **18.5** | 27,482 | 1,657 | 3,203 | −2,269 | 49.4% |
| **mixed** | **36,598** | 5,917 | 79,934 | 13.5 | 36,510 | 3,381 | 1,439 | −1,017 | 23.8% |

**3.8% apart** against a 15% target, and the mixed stable above the best single road. The spread
is §2.1's own column read back: the crook widest, the trader narrowest, the trainer between them.

## 3. Players and session

- 3–8 stables per season. Single player = 1 human + 2–7 AI at Easy / Normal / Hard. Online (M6): any mix.
- Target session: 45–60 minutes. v1 measured about an hour once every venue was in use (PLAYTEST_NOTES finding 4), and v2 adds decisions, so §15.3's click budget is now a hard constraint rather than an observation.
- Save/resume at any weekend boundary (single JSON blob).

## 4. Season structure

### 4.1 The calendar

13 race weekends. Weeks **4, 7, 10 and 13** are **Majors**, with week 13 doubling as the **Grand Final**.

- The **Grand Final is always week 13 at Collar Prime** (*The Galactic Collar*). The other three Major venues are shuffled into weeks 4, 7 and 10.
- 9 regular weekends drawn without replacement from a pool of 14 regular planets, random order.
- **The circuit is hidden.** You know the planet you are standing on completely. You know next week's planet by name and Major status only. Beyond that, nothing, unless you buy it. See §9.3 — this reverses v1, where the whole route was printed on the Galaxy Map from week 1.

The rhythm of the season therefore stays plannable (Majors are always 4/7/10/13, the Grand Final is always the Collar) while its content does not.

### 4.2 Weekend turn structure

1. **Arrival & turn order.** Score = `shipSpeed × 10 − cargoUnits ÷ 5 + d10`. Highest goes first, shown with the reason.
2. **Event phase.** Each player draws one random event (some planet-specific). Events with choices pause for the player.
3. **Planet phase (pre-race).** In turn order: Market (dogs, feed, gear), Kennels (**set each dog to Race, Train or Rest** — §5.7), Docks (ship, goods), Saloon (staff, loans, rumours, information), Bookie, Race Office (declare into the card).
4. **Declarations lock.** Each player may enter one dog per race, subject to that race's entry criteria (§6.3). Empty traps are filled with local dogs. Declarations are public; bookies then open.
5. **Race day.** The three races are simulated and shown in order. Prize money paid, bets settled, championship points awarded, ratings/form/fitness/injuries updated.
6. **Planet phase (post-race).** Same venues.
7. **End turn → Jump.** Weekly costs charged. Each dog's chosen state resolves: **Race** has already happened, **Train** applies feed and trainer, **Rest** recovers fitness. Growth and decline apply by age. Then the jump.

### 4.3 Season end and scoring

**Net Worth** decides the season. It is the only condition under which all three roads compete: the trader and the crook do not produce race wins, so a championship-points scoreboard would delete two thirds of the design (§19, D3).

```
netWorth = cash
         + Σ dogValue(rating, age, injuryStatus)
         + shipValue (purchase prices × 0.7)
         + Σ cargo × localSellPrice          (every good, not just kibble)
         − outstanding loans (principal + one week's interest)
```

Highest net worth wins. Tie-break: most Open wins, then most Majors.

**The championship purse.** Points accrue from race finishes all season and are paid out once, at the Galactic Collar, as prize money. It is a purse, not a scoreboard: it rewards racing breadth, which is the trainer's road only, so it is deliberately modest — **5,000 / 2,500 / 1,250 to the top three on points** ⚖️. Points **10 / 6 / 3 / 1** for the first four home in any race ⚖️. ✅ Built.

⚠️ **The estimate was 12,000 / 6,000 / 3,000 and "about 6% of a champion's end worth", and it
was two and a half times too big (D39).** A champion ends on about 70,000, so 12,000 is **15.5%**
— and the shape is the giveaway: swept over 200 seasons a cell, **p10 does not move at all while
p90 rises 16%**, because the purse is paid in the last week of the season to whoever is already in
front. 5,000 lands at 7.1%, which is the number §4.3 meant. It costs the "decided by" week a
tenth of a week (6.80 with no purse, 6.70 at 5,000, 6.71 at 12,000), so the hope that a
late-paying purse would delay the season's decision is answered: it does the opposite, very
slightly.

✅ **Points are derived from the race archive, not stored.** `RaceResult` already carries the
finishing order and the owner of each runner on the day, so a field on the Player would be a
second copy to keep honest — the same argument that kept the dossier out of state (D36). Selling
a dog does not sell the points it has already won you, and the standings cannot drift out of step
with the results they are a scoreboard of.

## 5. Dogs

### 5.1 Stats (all 1–99, visible)

| Stat | Race effect | Marginal worth **[measured]** |
|---|---|---|
| **Speed** | Top speed. | +10 → win rate 12.8% → **24.2%** |
| **Stamina** | How late the dog fades. | +10 → **19.2%** |
| **Acceleration** | How fast it reaches top speed; best on 350 m. | +10 → **16.1%**, and 17.2% on a sprint |
| **Trap** | Break out of the boxes and bend craft; best on tight bends. | +10 → **15.3%**, and 17.0% on tight bends |

Rating weights: `0.40 speed + 0.20 accel + 0.25 stamina + 0.15 trap`, then adjusted by results (§5.3).

✅ **Built and measured** (tag `v2a`, `npm run harness -- --stats`, 3,000 races a cell, standard 480 m against a 12.8% baseline). On v1's constants the same test gave speed 28.8%, stamina 16.5%, accel 13.9% and **trap 13.4% against a 12.7% baseline — worth nothing at all**, identically at every track length. All four now sit inside BUILD_PLAN §6b's bands and in rating-weight order, which is what §8.2's four stat feeds need in order to be four goods rather than one good and three traps.

⚠️ **Stamina is the exception and it is structural.** It reads 19.0% on a sprint and 19.2% on a stayer — no edge on the longer track, at any constant. `fadeStart` is a *fraction* of the distance, so the fade window is proportionally identical at 350 m and 600 m and stamina is distance-invariant by construction. Making a stayer favour stamina needs the model's shape changed — the fade expressed in metres rather than in fractions — which §6.2 deliberately does not do. Until then *Stayer* is a flat 3% bonus on long tracks (§5.4) rather than a stat interaction, and **§8.2 should price stamina feed on its flat 19% and not on a distance story.** Phase B's to take or leave.

### 5.2 Condition

- **Fitness 0–100.** Multiplies every stat, at every level: `fitScale = 0.90 + 0.10 × fitness/100` ⚖️ (`fitScaleBase`, `fitScaleCoef`). ✅ Built.
  ⚠️ **This is a deliberate softening, and it is the fix for "fitness never bites".** v1 used `0.80 + 0.20 × fitness/100`, which sounds gentler and is savage: at equal ratings a dog at 90 fitness wins 13.0%, at 80 wins 7.0%, at 70 wins 3.0% and at 60 wins 1.3% **[measured]**. The whole meaningful range was 85–100, which is precisely why nothing ever fell to the threshold — there was no room to fall. Flattened to `0.90 + 0.10`, the curve reads across the range a player can actually reach: 100 → 26.1%, 80 → 16.6%, 60 → 8.8%, 40 → 5.4% **[measured]**. *Then* the weekly swings can be large enough to see.
- **Weekly fitness by state** (§5.7): **Race −25, Train +8, Rest +30**, and **+40 resting with a vet** ⚖️. ✅ Built.
  ⚠️ **The arithmetic in 0.2 was wrong and the correction matters.** Two weeks racing in three is −25 −25 +30 = **−20**, not station-holding. A dog that rests every week it does not race can take `390 ÷ 55 ≈ 7` races in thirteen weeks, not 8, and fewer if it ever trains. **[measured]** a Normal stable's dogs take **5.2**, and the difference is the races the card does not make worth running. So a 3-race card wants five dogs for the *eligibility* reason of §6.3, not for this one.
- **Local dogs run at fitness 75** ⚖️ (`localFitness`). v1 left them on the dog factory's default of 90, which cost nothing while campaigning stables declared at a mean fitness of 96 — and became a standing handicap the moment this section put them in the 60–80 band. See D17.
- **Form −10…+10.** Momentum from recent results. Decays 2/week toward 0.
- **Age 1–7 (seasons).** Age **1: +2 stat points a week; age 2: +1; ages 3–4: none; age 5+: −1** ⚖️. ✅ Built. This is a change from v1's "+1 every second week", and it is what makes a pup visibly a pup: raising one is now a real compounding curve rather than a rounding error (§5.6). Value multiplier by age: 1.15 / 1.10 / 1.00 / 0.85 / 0.65 / 0.45 / 0.30. Age ticks once per season (week 7).
- **Injury.** Base 4% per race, ×2 if fitness < 50, ×2 with *Fragile*, ×1.5 on hazardous tracks. Duration 1–3 weeks (a Vet shortens it). Injured dogs cannot be declared; value ×0.7 while injured.

### 5.3 Rating

Every dog has a public **Rating 0–99**, initialised from stats and updated Elo-style after each race:

```
expectedPlace = 1 + (n−1) / (1 + 10^((rating − fieldAvgRating) / 15))
ratingDelta   = (expectedPlace − actualPlace) × 1.6        ⚖️
```

**Rating moves only through race results. Feed and training move stats.** This is deliberate and it is what makes the trainer's and the crook's roads both work: a dog you have fed is quietly better than its number, it still enters the races its number allows, and the bookie still prices the number. That informational edge is the reward for playing well, and it is fair rather than hidden — the DogCard's stat bars show it, so any player who looks sees exactly what the Hard AI sees.

The obvious objection is that it lets you farm easy races with a secretly-brilliant dog. §6.3 removes that objection, which is why the two go together.

**How big is the edge?** A rating-55 dog whose quality is all in Speed beats seven balanced rating-55 dogs 40.8% of the time where the bookie prices it at 9.9% **[measured, v1 constants]**. After the §6.2 rebalance that gap narrows sharply and — importantly — **balanced feeding overtakes monofeeding by week 13** (a pup fed evenly reaches 57.8% against a rating-57 field where the same points poured into Speed alone reach 26.5%, because Speed caps at 99 and stops paying) **[measured]**. The edge survives; the degenerate version of it does not.

### 5.4 Traits

Each dog has 1–2 quirks, shown as icons. The initial set of 16 stands: *Railer · Wide runner · Slow starter · Mudlark · Fragile · Iron · Showboat · Glutton · Nervy · Sprinter · Stayer · Cheap date · Prima donna · Bounces back · Old soul · Bad blood*.

⚠️ *Sprinter* and *Stayer* only mean anything after §6.2. On v1's constants track length has no measurable effect on which stats matter, so a distance trait was decorating a difference that did not exist.

### 5.5 Names and looks

Unchanged: procedurally generated grimy/absurd names, greyhound silhouettes with alien flourishes, colour-coded per stable with a saddle-cloth number.

### 5.6 The stable, and the pup problem

**Starting stable:** 3 dogs, ratings ≈ 38–48, mixed ages 2–4, **4 kennel slots**, 6,000 Bones, basic ship. Kennel slots rise to **6** at the top ship tier ⚖️. ✅ Built.

⚠️ **The sixth slot is not worth buying, measured.** A kennel module costs 2,000 and the fifth dog's upkeep another 1,950 over a season, against roughly 3,000 of extra prize money — the races a fifth dog adds are the *cheapest* five, because the good ones were already covered. Teaching the Normal AI to buy one cost it 5,000 Bones of end worth and nine points of head-to-head. This is M4's ship-upgrade finding surviving the rules that were supposed to overturn it, and it is why `dogs owned at week 13` comes in at **3.9 against a target of 4.5**. The lever is ship economics, which §9.2 and §20 Q6 hand to Phase C — the module has to get cheaper or the fifth runner has to be worth more.

**The market mostly sells pups.** v1's flaw, in Jesse's words, was that "the best strategy is to just wait for a great dog in the market". So the market's stock is weighted heavily to **age-1 pups** — cheap, useless now, and worth something only if you spend a season on them. Finished dogs still appear, rarely and dearly, and at Major venues.

**How fast should a pup compound?** This is the most important number in the redesign and it was measured directly. A pup starts at age 1 with all stats around 37 (rating 37, book value ≈ 3,900). "Competitive in The Open" means beating par — better than 1-in-8 — against the rating-57 field the harness reports mid-season. Raw stat points gained per week, against win rate in The Open **[measured, on the §6.2 constants]**:

| points/week | week 4 | week 8 | week 10 | week 13 |
|---|---|---|---|---|
| 2 | 0.2% | 1.0% | 0.8% | 2.8% |
| 3 | 0.3% | 1.7% | 2.5% | 5.2% |
| 4 | 0.2% | 2.5% | 3.5% | 9.5% |
| **5** | 0.3% | 5.0% | **10.3%** | 19.5% |
| **6** | 1.5% | 7.3% | **13.5%** | 30.7% |
| 8 | 1.5% | 15.5% | 32.5% | 57.8% |
| 10 | 3.2% | 28.8% | 55.8% | 66.2% |

So **a pup needs 5–6 raw stat points a week to arrive around week 10**, which is the target. Below 4 it never arrives at all; at 8 it is a monster by week 10 and the season is over. The band is narrow, which is a risk worth naming: the difference between 4 and 6 points a week is the difference between a dead mechanic and a dominant one.

✅ **Measured in the live engine** (`npm run harness -- --pups`), against the rating-50 Gold locals the game now fields. Par is 12.5%:

| trainer | trains | pts/train-week | pts/week | week it reaches par |
|---|---|---|---|---|
| none | 13/13 | 3.5 | 3.5 | 13 |
| none | 8/13 | 4.5 | 2.8 | **never** |
| **Rough +1** | **13/13** | **4.5** | **4.5** | **8** |
| **Rough +1** | **8/13** | **5.5** | **3.4** | **8** |
| Rough +1 | 6/13 | 6.3 | 2.9 | never |
| Gristle +2 | 8/13 | 6.5 | 4.0 | 6 |
| Prime (Phase C) +4 | 8/13 | 8.5 | 5.2 | 4 |

**The trainer is what makes the pup road exist.** With one, a pup arrives at week 8 — a week early against the 9–11 target, and on the line rather than clear of it (12.6% at week 8 against par 12.5). Without one it arrives in week 13 or not at all, whatever it does with its weeks. And a pup that has to race to pay its way — six training weeks out of thirteen — **never arrives**, which is §5.6's own sentence, now measured rather than asserted.

Two honest caveats. The target is met partly because the locals came down to rating 50 (D17); against 0.2's rating-57 field the same pup would be a fortnight short. And the Prime row is what §8.2 and §8.3 promise in Phase C, priced here so the gap is visible before it is built — it is a *monster*, and the tier numbers will want trimming rather than hitting.

**Under Race/Train/Rest, those are not calendar weeks.** A dog only gains from feed on a **Train** week, so a pup that trains 8 of 13 weeks needs **7–9 points per training week**, plus growth. That arithmetic is what sets the tier numbers in §8.2 and §8.3, and it is the trainer's road in one sentence: *a pup that has to race to pay its way arrives late or never.*

### 5.7 Race, Train or Rest

Each week, in the Kennels, every dog is set to exactly one of three states. This is the decision the two reserve slots always wanted and never got. ✅ Built: `Dog.weekState`, the `SetDogState` action, resolved at end of turn.

| State | Fitness | Stats | Money |
|---|---|---|---|
| **Race** | −25 | none | prize money, championship points, rating movement |
| **Train** | +8 | consumes one unit of feed; gains the feed's and the trainer's points | nothing, and the feed cost |
| **Rest** | +30 | none | nothing |

A dog that is injured or banned is in a fourth state, **Layoff**, which is imposed rather than chosen and does all of Rest's recovery. It is **derived, never stored**, so a dog that comes sound again is still set to whatever its owner chose. There is deliberately no chosen fourth state: three is the number a player can hold in their head across six dogs, and everything a fourth might do (light work, a trial) is a tier of Train.

**Which way the dependency runs.** Declaring a dog implies it races — the Race Office sets the state for you. Standing a *declared* dog down is refused and asks you to withdraw it from its race first, exactly as selling one does. The friendly implication runs from the specific act to the general state and never the other way, where it would quietly bin an entry.

A dog **set to race that nothing enters** does not run and takes Rest's recovery. The Kennels says so on the card, because otherwise a stable would lose a week to a state it thought was doing something.

**A Train week eats a second crate of kibble** on top of the week's dinner, so training has a running cost from the first week (§7.2). In Phase A the feed is plain kibble and the gain is the trainer's points plus **+1–3 to a random stat** ⚖️; Phase C's four feeds × three tiers (§8.2) are what aim those points at the stat the player chose.

⚠️ **Training does not yet pay for itself, and that is expected rather than broken.** A Train week on plain kibble is worth about 0.75 rating points, against a race worth hundreds of Bones — so a Hard stable asked to price the two never once chose the yard over the track **[measured, ±0 in ablation]**. It starts choosing it at roughly Prime-feed strength. Until Phase C, the Kennels' real decision is Race against Rest, and Train is where a pup goes.

## 6. Races

### 6.1 Race parameters

Each planet has one track: **distance** (Sprint 350 m / Standard 480 m / Staying 600 m), **bend tightness**, **surface hazard**, and a visual theme. 8 traps. Short fields are filled with local dogs drawn around **the level of the race's purse tier** — The Open **50**, a drawn race **30** ⚖️ (+5 at a Major), at **fitness 75** ⚖️ — and then shaped so they satisfy that race's own entry criterion (§6.3). ✅ Built.

⚠️ **A local must pass the same predicate a declared dog does**, or the Juvenile fills with four-year-olds: locals bypass Declare entirely, so nothing in the eligibility system sees them. Each race-type row therefore carries a *local spec* — an age window, a rating window, the out-of-the-money flag — and the generator squeezes the tier's draw into it. That is how the Handicap's locals come out under its cap and the Invitational's at its floor. `properties.test.ts` asserts it for every runner in every field.

✅ **The re-fit D17 promised did not turn out to be needed.** Expressing the locals by purse tier at 50 / 30 landed the share of the purse reaching players at **52.4%** first time — against v1's 54% and Phase A's 52% — so nothing was touched. That number is now a first-class harness row rather than a probe somebody writes twice.

### 6.2 Simulation — and the rebalance v2 depends on

Deterministic and tick-based, as v1. The model is unchanged in shape; four constants change.

```
break       = trap/100 × 7 m × U(0.6, 1.4)                    ⚖️  was 3 m
topSpeed    = (13.75 + 4.5 × speed/100 + 0.05×form + 0.4×luck) ⚖️  was 13 + 6 × speed/100
              × fitScale × traitMultipliers
fadeStart   = 0.45 + 0.45 × stamina/100
if progress > fadeStart:  topSpeed *= 1 − 0.50 × …            ⚖️  was 0.35
accel       = 2.0 + 5.5 × accel/100  (m/s²)                   ⚖️  was 4 + 6
bends       : bump chance 0.30 within 1.2 m, −30% v for 0.5 s ⚖️  was 0.10 within 0.6 m, −15%
```

**Why.** On v1's constants, Speed spans 13→19 m/s while every other stat moves a few percent of a lap, so Speed is not "the biggest single factor" — it is the only one. Measured from a balanced rating-50 dog, +10 to one stat moved the win rate to speed 27.6%, stamina 17.9%, accel 14.6%, trap 11.6% against a 12.3% baseline, **identically at 350 m, 480 m and 600 m**. A stamina-fed dog wins 3.9% on a 600 m stayer where a speed-fed one wins 50.6%. Trap is worth nothing at all, while still being 15% of the rating and therefore 15% of the dog's price.

The constants above were found by sweep and give **speed 23.0% / stamina 20.4% / accel 15.8% / trap 14.4%** — the rating-weight order, for the first time — with **accel peaking on sprints and trap on tight bends**, which is what §5.1 has claimed since the first draft **[measured]**.

**Costs of the change, honestly:** the §6.2 calibration moves from 52.4% to 57.9% (a balanced 65 against seven 50s; the target band is 45–60%, so it holds but sits near the top), a 480 m race runs 33.8 s instead of 31.6 s, and the bookie's `oddsScale` will want refitting — the sim now runs slightly hotter than the model at every rating. **That last one is a feature if it is chosen and a bug if it is not:** a known, small, stable divergence between the sim and the bookie is exactly the edge the crook's road needs, and Phase A should decide its size deliberately rather than inherit it.

✅ **Phase D adds the draw, and it is the one rule change to the simulation since (D37).**

```
insideness  = (4.5 − trap) / 7                       +0.5 at trap 1, −0.5 at trap 8
topSpeed   *= 1 + trapDrawEdge × insideness × bend   ⚖️ 0.018, and zero where there are no bends
bendCraft   = trapStat − trapTraffic × insideness    ⚖️ 20; the lower comes off worse in a clash
```

**The rail is the short way round, and the rail is where the traffic is.** Two numbers pulling
opposite ways, so which end of the boxes a dog wants depends on the dog — and **zero on a track
with no bends**, which makes the Void Derby's straight a race where the draw provably does not
matter and the screens say so.

⚠️ **This exists because §13's steward bribe bought nothing.** Measured before it was built: the
trap *number* was read in exactly one place in the whole simulation — the Nervy trait's penalty at
traps 1 and 8. Trap *craft* decided the bends; the draw decided nothing, so "choose your dog's
trap draw, 800" was §8.4's supplement again.

⚠️ **And measuring it turned up a bug that had been in every race with bends since M0.**
`victim = ri.trapStat <= rj.trapStat ? i : j` made the lower array index — which is the lower trap
— the victim of *every* bend clash between two dogs of equal craft. Between eight identical dogs
on a tight 480 that was worth **trap 1 winning 9.1% against trap 8's 17.3%** [measured]. Nothing
intended it and nothing printed it. It is now `bendCraft`: deliberate, sized in the spreadsheet,
and paid for by the shorter trip on the rail.

**Measured**, one dog walked across all eight boxes against seven craft-50 rivals, 9,000 races a
box on a tight 480: choosing your box is worth **+3.5 points of win rate**, to a good-craft dog
and a poor one alike, tapering with the bends to nothing on a straight. It costs the economy
**1.3%** of mean end worth, leaves stat leverage unmoved and in rating-weight order, and moves the
"decided by" week **6.6 → 6.9** — which is Q12 responding, for the first time, to something nobody
aimed at it.

**Everything in this block is `balance.json` — no code changes.** It moves the golden snapshot once and shifts the whole economy, which is why it is Phase A's first commit and not a corner of a later one.

✅ **Shipped, and it cost the economy 7.7%** — mean end worth 40,696 → 37,554 over 800 all-Normal seasons, with p90 falling furthest (−9.8%), which is the change doing what it was for: with Speed no longer the only stat a very good dog beats the field less often. Well inside the 20% that would have forced a purse re-fit. `oddsScale` settled at **15.5** — see §20 Q4.

### 6.3 The race card

Bronze / Silver / Gold are gone. Every weekend has three races: **The Open**, plus two drawn from a pool of types.

**The Open** — any dog may enter, biggest purse, every weekend, run last.

**The pool** ⚖️ — every criterion is a fact the game already stores, and every one except Handicap is a fact a player *cannot suppress*:

| Type | Entry | Note |
|---|---|---|
| **Maiden** | never won a race | winning it destroys your own eligibility — a real cost to a win |
| **Juvenile** | age ≤ 2 | what a bought pup is *for* |
| **Veterans** | age ≥ 5 | a late-career job for an old dog, and a reason to keep one |
| **Novice** | fewer than 6 career runs | early-season, and distinct from Maiden |
| **Handicap** | rating ≤ a posted cap | the v1 system, surviving as one type among many |
| **Invitational** | rating ≥ a posted floor | the good-dogs race; no cap, so no hiding |
| **Consolation** | ran out of the money in the last **2** weekends ⚖️ | the one deliberate catch-up mechanic — but see D28 |

Two drawn per weekend, plus The Open. **Content is data: the eighth and ninth types are rows, not code.**

**Why facts rather than ratings.** A rating can be suppressed — that is the objection to §5.3 — but an age and a win cannot. And because the circuit is hidden (§9.3), this is not about aiming a dog at a race you can see coming. It is about keeping a stable that covers several eligibilities, which is exactly the force that kills one-dog concentration.

✅ **Built, and the two posted numbers were fitted rather than guessed.** The Handicap's cap is **45** and the Invitational's floor **48** ⚖️ — one point apart, so ratings 46 and 47 sit outside both and everything else has one of them. Both started at 55 and both ends were wrong: a stable could fill the Handicap on 97.5% of the weekends it ran, so it asked nothing, and the Invitational on 12.5%, so players took 1.2% of its entries and the locals owned a tenth of the card. At 45 / 48 they read **85% and 46%** — a reliable fallback and one you have to have raised something to enter (D23).

The Consolation carries a `minWeek` of 2, because nobody ran in week 0. Its criterion is a *stored fact* on the dog (`outOfMoneyLastWeek`, written every week for every dog it owns) rather than a lookup into last week's results, so that a generated local can carry it too.

**Measured, and it works — with one row over its band.** `npm run harness -- --card`, 20,000 rolled stables against 20,000 random cards, eligibility only:

| stable | fills all three | two or more | just one |
|---|---|---|---|
| broad, 5 dogs | **76.3%** | 98.5% | 1.5% |
| broad, 3 dogs | 46.8% | 92.8% | 7.1% |
| one good dog + 2 fillers | **10.3%** | 63.3% | 36.7% |
| one good dog + 4 fillers | 13.0% | 68.3% | 31.7% |
| four good dogs | 0.0% | 28.8% | 71.2% |

The concentrated rows land almost exactly where 0.3 predicted (14%), which is the design's own arithmetic confirming itself. The broad row comes in at 76% against a 55–70% band — the card is more forgiving to a well-spread stable than the estimate assumed. That is a near-miss on the high side and not a broken mechanic: the spread between broad and concentrated is six-fold, and a broad stable is still short one race a quarter of the time.

⚠️ **In a real season the binding constraint turns out not to be eligibility at all — it is fitness.** The probe says a broad five-dog stable *may* fill the card 76% of weeks; a Normal stable actually fills all three **20.4%** of weeks and two of three 51.9%, for a mean of **1.90 races entered of 3** **[measured, 800 seasons]**. The gap between 76 and 20 is Race/Train/Rest. That is worth knowing before Phase C tunes anything: the card decides *which* races a stable can contest, and §5.7 decides how many.

**`cardCoverage`** — the share of the weekends a type ran where a stable had a fit, eligible dog — is the number that says whether a race is a decision or a lottery **[measured, 800 all-Normal seasons]**:

| | Open | Maiden | Novice | Handicap | Juvenile | Invitational | Consolation | Veterans |
|---|---|---|---|---|---|---|---|---|
| coverage | 99% | 91% | 97% | 85% | 63% | 45% | 29% | 30% |
| share of player entries | 40.0% | 12.5% | 13.4% | 12.4% | 8.4% | 5.9% | 3.8% | 3.7% |

Veterans and Consolation sit at about 30% and both are structural rather than broken. A stable starts with dogs aged 2–4 and the age tick is week 7, so roughly 70% of stables have a veteran and only from week 8 — 0.70 × 6/13 ≈ 32%, which is what the harness reads. The Consolation's dog is by definition one that raced last week, so it is also the dog that is 25 fitness down: qualifying for the catch-up race and being fit enough to take it pull against each other.

✅ **It does, as of 12 September, and the result is worth reading twice (D28).** `consolationReach`
is **2** ⚖️. Coverage went **29% → 71%** and its share of player entries 3.8% → 8.9%, so the race
that was barely enterable is now a real part of the card. The fill rate rose 1.90 → 1.95, the purse
share reaching players 52.4% → 53.4%, and a stable's floor rose sharply — p10 end worth **8,052 →
9,620, up 19%**.

⚠️ **And the "decided by" week did not move at all: 6.4 before, 6.4 after.** The reason is that
the Consolation is not actually a catch-up mechanic. Its criterion keys off *a dog that ran badly*,
which the leader has as often as the tail — a champion's fourth dog finishing fifth qualifies
exactly like a struggling stable's best. It redistributes toward weak **dogs**, not weak
**stables**, which is why it lifts p10 and Easy's head-to-head while leaving the ordering of the
season alone. If Q12 wants answering, the criterion has to key off *standing*, and that is a
different rule.

**The risk to watch in playtest** is arbitrariness — not knowing next week's types is doing design work here, but the pool has to stay small and memorable enough that "keep a young one" reads as an obviously sound bet rather than a lottery.

### 6.4 Purses

| Race | 1st / 2nd / 3rd |
|---|---|
| The Open | **5,800 / 2,900 / 1,450** |
| Each drawn type | **2,600 / 1,300 / 650** |

Majors ×2.0; the Grand Final ×3.5. Weekly base pool **19,250** ⚖️. ✅ Built.

⚠️ **D15's purse cut was measured and deliberately not applied. This is the largest judgement
call of Phase B and the whole argument is here.**

The plan was 4,000 / 2,000 / 1,000 and 2,200 / 1,100 / 550, a pool of 14,700 and a 24% cut. What
landed instead keeps the pool exactly where it was: The Open takes the old Gold and each drawn
race the mean of the old Bronze and Silver, to the Bone. Four measurements say why.

1. **The card already cut the economy by itself.** Fact-gating means a stable fills 1.90 of the
   three races rather than pointing its best three at whatever is going, and races per dog fell
   5.2 → 4.8. Mean end worth went 33,160 → 30,714 on an *unchanged* pool — **−7.4%**. Part of
   D15's intent has already arrived, through the fill rate rather than through the purse.
2. **The fill rate went down, not up.** §6.3 hoped the card would raise how much of the card a
   stable fills, which would have paid for the cut. It does the opposite, so the cut's cost is
   larger than D15 assumed rather than smaller.
3. **The cut cannot reach its own target, and the arithmetic is not close.** D15 exists to take
   prize money from 87% of income toward 65%. Gross income by road now reads prize 31,334, dogs
   sold 3,022, bets returned 3,294, food sold 700 — **prize is 81.7%**. The other three total
   7,016 and a purse cut does not touch them, so reaching 65% needs prize down to 13,000: a
   **59% cut**, not 24%. D15's own 24% moves the ratio to 77.6%. **The ratio moves when the other
   two roads grow, not when racing shrinks.**
4. **It makes a missed target worse.** Races per dog is 4.8 against a 7–9 band, and the marginal
   run is exactly the one that stops being worth the injury risk when the purse falls.

So the cut was deferred to Phase C, where §8.2's goods market would give a player something to
spend the room on and the cut could be sized against the roads it was meant to make room for (D22).

✅ **Phase C sized it, and the answer is that the lever does not exist. The pool stays at 19,250
and D15 is closed (D29).** The market was built first, as D22 asked, and `other` grew from 7,016 a
season to **9,469** — prize share 81.7% → **77.3%** with no cut at all, which is the ratio moving
exactly the way D22 predicted it would. Then the cut was swept, 400 all-Normal seasons a cell:

| cut | mean end worth | prize share | purse reaching players | dogs sold | bets returned | food sold |
|---|---|---|---|---|---|---|
| **0%** | **31,370** | **77.3%** | **53.8%** | 2,687 | 3,049 | 3,689 |
| 10% | 26,805 (−15%) | **77.4%** | 51.1% | 1,944 | 2,514 | 3,568 |
| 20% | 22,831 (−27%) | **77.6%** | 48.3% | 1,234 | 2,049 | 3,380 |

**The prize share does not move. It gets very slightly worse.** D22 reasoned that the cut could not
reach its target because the other roads were untouched by it; the truth is worse than that — the
other roads are *financed* by prize money, so cutting the purse shrinks them at least as fast. Dogs
sold falls 54%, bets returned 33%, food sold 8%: a poorer stable buys fewer dogs, stakes less and
finances a smaller hold. The ratio is invariant to the cut **at any depth**, and a 10% cut buys
nothing for 15% of the economy.

What *did* move the ratio is making the other roads more productive per Bone — the feeds and the
hold, worth 4.4 points of prize share between them without touching a purse. See §20 Q2 for the
measure that replaces this one.

### 6.5 Race presentation

Unchanged from v1 and working: top-down track, camera on the pack, position ticker, commentary bar, photo-finish freeze, 1×/2×/skip. Two additions v2 requires: the commentary must be able to say **"faded — no stamina over 600"** and **"never got going"** now that those are true (§6.2), and **the card header must name each race's entry criterion**, since it changes weekly. ✅ Built — the stub prints "never won a race" where it used to print "cap 45".

✅ **And the Race Office now prints what a run costs.** Phase A built the Race/Train/Rest
decision and left it on a screen the player had no reason to open: every dog defaults to Race,
declaring one sets it to Race, and the declaring screen never mentioned fitness — so a player
could walk from the hub, declare their best three and end the turn having played v1 exactly. The
Race Office carries a **week ledger** above the card: every dog with its rating, its fitness now,
and the number it lands on next week if it runs against if it rests. One table rather than a line
on each of three stubs, because the answer does not change per race. Every fitness line in the
Kennels names the number as well as the delta — "−25 fitness" is a rule, "74 → 49" is a decision
— and a dog nothing on the card will have says so, in both screens.

## 7. Economy

Currency: **Bones**.

### 7.1 Where the money comes from — the problem, stated plainly

v1, all-Normal, 800 seasons **[measured]**:

| | mean per stable-season |
|---|---|
| Prize money | **35,766** |
| Food trading | **−3,747** |
| Betting | **−325** |
| Costs | 13,605 |
| End net worth | 40,943 |

**Prize money is 87% of income; the trade is a net loss to every difficulty and betting is a rounding error.** Pillar 1 asks for three roads worth roughly the same, so the target is each road worth something like a third of a good stable's worth — 12–15k a season. That is **4× where trading is and 45× where betting is**, and it cannot be reached by making racing better. It is reached by cutting the purse pool (§6.4), giving the trade an edge it can actually work (§9), and building §13 so the crook has anything to do at all.

This is a bigger change than any single proposal in the brief, and it is the honest content of "the skill is deciding how to spend your money".

✅ **Measured properly for the first time, and the shape of the problem changed.** v1's 87% was
an estimate off net figures; `tradeIncome` is sold minus bought and `betIncome` is returns minus
stakes, and neither can answer "where did the money come *in*". The harness now tallies the cash
each action moves. 800 all-Normal seasons, gross, per stable-season:

| | prize | dogs sold | bets returned | food sold | prize share |
|---|---|---|---|---|---|
| Normal | 31,334 | 3,022 | 3,294 | 700 | **81.7%** |

⚠️ **And this is why D15's purse cut was not applied (§6.4, D22).** The three non-racing rows
total 7,016 and a purse cut does not touch any of them, so 65% needs prize down to 13,000 — a 59%
cut, which would halve the game. The ratio is not reachable from the numerator. It becomes
reachable when Phase C's goods market makes food sold something other than 700 a season and
Phase D gives betting a reason to be positive.

✅ **Phase C, 800 all-Normal seasons, gross, per stable-season:**

| | prize | food sold | dogs sold | bets returned | prize share |
|---|---|---|---|---|---|
| Normal | 32,185 | **3,708** | 2,694 | 3,067 | **77.3%** |

Food sold went 700 → 3,708 and the prize share 81.7% → 77.3% **with the pool untouched**, which is
the mechanism D22 named working as it said it would. `other` is 9,469 against 7,016.

⚠️ **And 65% is now retired as a target (D29).** Sweeping the cut showed the ratio is invariant to
it — see §6.4's table — because prize money is what finances the other two roads. The question 65%
was a proxy for is "are the roads worth the same", and that now has a direct measurement: §20 Q2
reads the trainer's road and the trader's road **1.4% apart** on mean end worth. A proxy that needs
a 45% purse cut to satisfy, while the thing it proxies for is already met, is the wrong number to
steer by.

⚠️ **One column is still honestly bad: `trade` was reported as a loss for three phases and it was
a measurement bug.** `stats.tradeIncome` is sold minus bought, so a stable that bought a crate of
Prime speed feed and fed it to a dog looked like a trader who had lost 900 Bones. §7.2 lists "feed
eaten" among the weekly costs and that is what it is, so the crate's value now moves out of the
trade column and into costs at the moment it is consumed, valued at what it would have fetched.
Normal's trade income reads **+1,939**. Nothing about the game changed; two columns stopped lying.

⚠️ **Half the posted purse never reaches a player.** The pool is 358,685 a season across six
stables and **52.4%** of it is paid out to them; the rest goes to local dogs and leaves the
economy. v1 ran 54% and Phase A 52%, so this is stable rather than new — but it means the pool
is nearly twice the size of the prize money the players are actually competing for, and any
future cut should be sized against the 52% rather than the headline.

### 7.2 Costs (weekly)

Kennel upkeep 150/dog (half for *Cheap date*) · feed eaten 1 crate/dog (2 for *Glutton*) · fuel 250 base, **+2** per cargo crate over 20 ⚖️ · **staff wages by tier: Rough 250, Proper 600, Prime 1,400** ⚖️. ✅ Built.

✅ **A wage is a fact about the tier, not the role.** `trainerWage` and `vetWage` are gone: what a
member of staff costs is where they sit on the one ladder (§8.1), which is what makes "three slots,
any mix" a budget rather than a shopping list. The whole bill is `wageBill(p)` over the list.

✅ **`fuelPerCargoUnitOver` is 2, and it is one half of §20 Q6's answer** — the other half is the
hold's price, 2,500 → 1,400. Both were sized by ablation rather than estimate; see §9.2.

✅ **A crate out of the hold is charged here, not silently.** Feed eaten was landing in the trade
column, which is why "trade" read as a loss for three phases. See §7.1.

With three staff slots and a 6-dog kennel, a stable committed to Prime staff is paying **4,200 a week in wages alone** — 50,000 over a season. That is the point (§19, D6): a Prime hire is a commitment to a run of form continuing, and the most interesting way to go bust.

### 7.3 Dog valuation

`value = (400 + 2.2 × rating²) × ageFactor × injuryFactor`, unchanged. Rating 45 ≈ 4.9k, 60 ≈ 8.3k, 80 ≈ 14.5k at age 3. A fresh pup is ≈ 3,900. Selling gets 80% of value.

⚠️ Note the interaction with §5.3: a fed dog's *value* tracks its rating, not its stats, so a dog you have made genuinely fast is under-priced on the leaderboard until its results catch up. Monofeeding Speed maximises race performance and *minimises* book value per point spent — a real tension, and a reason the balanced feeder wins the net-worth game even though the Speed feeder wins more races.

### 7.4 Loans

- **Bank** (Port Slobber, Cosmodrome): up to 5,000 at 3%/week.
- **Loan shark — "Fat Tony Nebula"** (Lagrange Lows, Hushmarket, Neon Snout, and by event): up to 15,000 at 10%/week. Miss a payment and Tony repossesses your highest-value dog.

### 7.5 Bankruptcy

Target **5–10% of carelessly played seasons** ⚖️, reported by the harness as a first-class number.

v1's rate is not low, it is **structurally zero**: 22 deliberate attempts in M4 session 2 — including selling down to the one dog the engine will not let you sell, hiring staff purely for the wages, borrowing from every lender on the circuit and entering no races — all finished solvent, the closest at 1,719 Bones. The forced-sale loop at end of turn sells your cheapest dogs to cover the bills, so going bust requires one week's deficit to outrun the sale value of the whole kennel.

Three v2 changes reach it without touching that loop: pups are worth little, so the forced sale raises little; Prime wages are a large fixed weekly commitment; and Race/Train/Rest means a stable can be simultaneously expensive and earning nothing. The Bust screen already exists and is correct — it has been waiting for a trigger that can fire.

✅ **Phase C reaches it: the careless agent goes bust in 5.5% of 400 seasons, inside the 5–10%
band, and `upkeepPerDog` never moved.** The mechanism is the one §7.5 named all along — a wage bill
it cannot carry — plus one addition: a careless stable also **buys the dearest crate on the shelf**,
whether or not it owns a dog that would eat it. §7a.5's "buys the dearest dog it can reach" was
written before the shelves had anything on them, and the extension is the same line.

The arithmetic that gets there is not three Prime staff — those are rare, and a careless stable
mostly ends up with Rough and Proper ones at 250–600 a week. It is the combination: three wages it
did not price, a crate a week it cannot use, no rest weeks, and every dog entered every weekend so
the injuries compound. Its mean end worth is **9,443** against Normal's 34,836, and its p10 is
**−2,210** — a stable in the red with nothing left to sell.

⚠️ **The Phase A attempt, kept because it is the trade not to make.** Phase A measured 0.0% and
tried the obvious lever: Only the first of those three changes exists yet, and it is the weakest of them. Raising `upkeepPerDog` was tried first, as the plan asks: **150 → 200 → 250 → 300** takes the careless rate to 0.5 / 1.5 / 1.0% and costs a Normal stable **27% of its end worth** on the way. That is a bad trade for a target it still misses, so upkeep stays at 150.

**The blocker was arithmetic, not tuning.** A careless stable owns about ten dogs across a season and each is worth thousands on a forced sale, so one bad week is covered by selling one dog, and thirteen weeks is not long enough to bleed out at 150 or even 300 a dog. Raising upkeep to 300 reached 1% and cost a Normal stable 27% of its end worth: a bad trade for a target it still missed. **The forced-sale loop was left alone throughout, as the plan asks** — what changed is how fast a careless stable can spend, not how hard the game is on a solvent one. Normal's bankruptcy rate is 0.1%.

## 8. Marketplace, upgrades and the tier ladder

### 8.1 One ladder, one vocabulary

Goods and staff share a single three-tier ladder, learned once and read everywhere. Shown as a word **and** a glyph (one, two or three chevrons) so a market table scans without being parsed.

| Tier | Name | Availability ⚖️ | Role |
|---|---|---|---|
| 1 | **Rough** | most planets, always affordable | the floor; what you start with |
| 2 | **Proper** | common but not everywhere | the working middle of the game |
| 3 | **Prime** | rare, expensive, sometimes event-only | what you are aiming at |

Stock rolls roughly **70 / 25 / 5** ⚖️, modified by each planet's `marketBias` (Vatgrown always has Prime pup feed; Rustgut rarely has anything above Rough) and by event cards, which are where most Prime offers should come from — a trainer between jobs, a pallet that fell off a ship.

**The ship folds onto the same ladder**: engine tiers 1–5 become **Rough / Proper / Prime**, three steps instead of five. One vocabulary was the whole point of the decision, and two competing ladders would have been worse than none. Cargo hold, kennel module and cold store stay as one-off fits.

⚠️ **The danger, named.** Rare expensive things get bought by whoever is already winning, which fights everything §5.6 and §5.7 do to the procession. Two shapes guard against it, and Phase C must measure whether they are strong enough (§20 Q3):

1. **Prime *food* is a consumable supply, not a permanent upgrade.** You get N units, they are spent, the advantage decays. The leader can rent superiority; they cannot bank it.
2. **Prime *staff* are a weekly wage, not a purchase.** A Prime trainer taken on at the top of a run is a liability when the run ends.

That makes the top tier a risk as well as a reward, which is the right shape for this game's tone and stops it being an "I have already won" button.

✅ **Built, and the guards were measured rather than trusted.** `leadConversion` (§7a.4) splits every
stable by net-worth rank at week 6 and asks what taking a Prime thing was worth to each, 800 seasons:

| group | took Prime | took none | the gap Prime makes |
|---|---|---|---|
| ahead at week 6 | −0.45 (n 1,092) | −0.57 (n 1,308) | **+0.11** |
| behind at week 6 | +0.69 (n 570) | +0.46 (n 1,830) | **+0.24** |

Places gained between week 6 and 13, so a bigger number is a stable climbing. **The trailer gains
more than twice as much from a Prime offer as the leader does**, which is D11's guards holding — and
read the two columns against each other *within* a row, because a leader has fewer places to gain
than a trailer by construction.

✅ **Prime offers seen: 2.93 a stable-season**, inside the 2–5 the plan asked for. 13 planets × 4
feeds × a 5% stock chance, plus whatever is drinking in the Saloon. Prime crates actually *bought*
are 0.80 — rare, seen more often than taken, which is what an agony is supposed to look like.

✅ **The stock chances are the one ladder and nothing else.** `stockChanceRough/Proper/Prime` are
70 / 25 / 5 and they are used by the goods *and* by the staff draw, so learning the ladder once tells
you how often a Prime anything turns up. `feedBias` is §8.1's `marketBias` as a number: Rustgut
multiplies the two upper chances by 0.25 and Vatgrown by 3.

### 8.2 Goods

**Kibble** sits below the ladder: the staple. Dogs eat it, an empty hold still costs the penalty at the gate, and it is the base trade commodity — so v1's eating and trading machinery survives untouched and everything else layers on top. A dog that **Trains** on plain kibble gains **+1–3 to a random stat**, which is the floor of improvement and why a stable that spends nothing still drifts upward very slowly.

**Feeds** are four stats × three tiers ⚖️ **[estimate]**:

| | Rough | Proper | Prime |
|---|---|---|---|
| Gain to the named stat, per Train week | +1–3 | +2–4 | +4–6 |

Price and stock by how much that stat is worth in the race sim (§5.1), so **Speed feed is dearest and scarcest at every tier** and Trap feed is the cheap one. Four stats and three grades is one concept, not twelve things, and no planet stocks more than a handful.

**Do not add a fifth stat food to make the market busier.** §8.5's busier market is served by tiers and by stock depth. The stat list is what keeps the economy legible.

**Hold or feed** is the decision this exists for, and it only bites if the good is scarce and the upgrade is worth roughly what the resale is. That balance is deliberately different per tier: **Rough feed should be obviously worth eating; Prime feed should be a genuine agony.**

✅ **Built, twelve rows generated from one formula.** A crate's price is `feedPriceBase × stat × tier`
against the planet's own kibble band, so a cheap planet is cheap for feed too and one cell in the
sheet moves twelve prices. On an average band: Rough trap 120, Rough speed 190, Proper speed 418,
**Prime speed about 950** — the dearest thing in the market that is not a dog. Per stat point the
tiers get *dearer* as they climb (95 / 139 / 190 a point), so Rough buys points cheaply and Prime
buys them fast, which is what makes the top tier an agony rather than simply better.

⚠️ **Stamina is priced on its flat 19% and nothing on any screen sells a distance story.** §5.1 is
explicit and `--stats` confirms it again this phase: stamina reads **19.0% on a sprint and 19.2% on
a stayer**, because `fadeStart` is a fraction of the distance. Stayer is a flat 3% trait bonus, not a
stat interaction. "Stamina feed for the long tracks" would be a lie the simulation does not support.

✅ **A Train week eats one crate, and the dog eats the best feed aboard for the stat it is on.** With
none aboard it eats kibble and takes 1–3 on a *random* stat, which is v1's floor unchanged and the
reason a stable that spends nothing still drifts upward. **Best-aboard rather than player-chosen**,
deliberately: asking which week as well as which stat would cost a click per dog per week against a
budget with half a click left in it (§8.5, D10). What the player controls is what is in the hold and
which stat the dog is on — two decisions that already have screens — and the consequence is that
Prime feed disappears fast, which is §8.1's consumable guard working rather than failing.

✅ **And the price is printed where the decision is made.** The Docks' feed counter names what the
crate does to the dog in the dropdown, in that dog's own numbers: "Rosco: Speed 54 → 56–59 next Train
week, rating 47 → 48 · Speed 71 and rating 54 by week 13 if he ate it every week." That sentence is
the whole reason this phase exists; see the note at the head of `lib/priceTag.ts`.

### 8.3 Staff — three slots, any mix

Three slots, filled with any combination — three trainers if you like. **No stacking penalty: the cost of better staff is the gate** (§19, D7). That moves the whole balance burden onto making the roles *differently shaped*, which is the right place for it, because it is also what makes pillar 1 real.

| Role | Road | Rough | Proper | Prime |
|---|---|---|---|---|
| **Trainer** | trainer | +1 stat point per Train week | +2 | +4 |
| **Vet** | protects the asset | injury −1 week | injury halved, Rest +5 | injury halved, Rest +10, −25% injury chance |
| **Fixer** ⚠️ *not staff* | crook | bribe + sabotage, caught ×1.5, job ×1.0 | caught ×1.0, job ×1.5 | caught ×0.5, job ×2.0 |
| **Scout** | trainer / trader | +1 dog in every market | +2 dogs, one priced under book | +3 dogs, one under book, stats shown for pups |
| **Trader** | trader | +10 hold | +20 hold, Proper goods stocked | +30 hold, Prime goods stocked, −5% buy prices |
| **Tipster** | trader / crook | this planet's card a phase early | next week's card and food band | next *two* weeks' planets and cards |

⚖️ All **[estimate]**. Wages per §7.2. Specify, then **measure whether stacking one role dominates**; if it does, re-shape the roles. Only if that fails does a penalty go in — do not start with the penalty.

**Rarity is the point, not a side effect.** A Prime trainer appearing in week 3, in week 9, or not at all makes three different seasons out of the same seed. That is pillar 2.

✅ **Built, all six rows, in `content/staff.ts`. `Player.staff` is a list of up to three, any mix.**
v1's "you already employ a trainer" refusal *was* the stacking penalty D7 exists to leave out, so it
is gone. Within a role the **best hire acts** — two trainers do not add their points — which is not a
penalty but the absence of a bonus, and it is what makes the stacking question measurable rather than
rhetorical.

✅ **Stacking measured, and no penalty goes in.** Three stables forced to stack one role against three
playing Normal's mixed line, in the same seasons, 200 seasons a row:

| stacked role | stacker mean | mixed mean | stacker beats mixed |
|---|---|---|---|
| trainer | 31,704 | 31,371 | **50.7%** |
| vet | 32,144 | 32,122 | **49.8%** |
| trader | 30,503 | 30,624 | **50.4%** |
| scout | 31,273 | 30,296 | **51.4%** |
| tipster | 29,670 | 30,596 | **49.1%** |

Every role inside D7's 45–55% band, so §21's "a stacking penalty only if measurement demands one"
stands and nothing was added.

⚠️ **The finding that was not expected: three slots is more than a racing stable can profitably
fill.** Hard began the phase wanting all five hireable roles and *lost* 11 points of head-to-head by
it (48.0% against 58.7% with trainer and vet alone). The trader-road staff are only worth their wage
to a stable that plays the trader's road — a Trader's hold and a Tipster's week are worth nothing to
an agent whose income is purses, and a wage is charged whether or not the capability is used. So the
slots are a budget rather than a checklist, and knowing which two to fill is decision quality, which
is exactly what §14 says difficulty is made of (D30).

✅ **The Scout and the Trader turn up stock nobody else at the table can see** (`PlanetState.finds`),
which is how a per-stable reward lands in a market whose shelf is shared and whose turn order is
first look. That is also §8.5's answer to "busier without longer": the extra depth is yours, so it
appears under one heading on your own screen.

⚠️ **The Tipster's ladder starts one rung above the table in §9.3, deliberately.** As built, next
week's planet comes with its kibble band — the Docks has always printed it and `tradeFoodPlan` has
always read it — so "next week's band" is already free and a Rough tipster who sold it would be the
Fixer all over again: a wage for a service the game gives away. Rough sells next week's **card**,
Proper adds the band a week further out, Prime sells both. The AI's `planetAhead` guard is raised by
exactly the hire, so no agent sees further than a player with the same Tipster.

⚠️ **The Fixer is on this table and is not one of the three slots** (D45). Phase D put him on the
wage ladder and Phase E took him off it: he is hired **by the job**, at `PlanetState.fixer`, and
his row is kept here because the *ladder* still applies to him — the grade sets what a job costs
and how well he covers his tracks. What does not apply is the wage, and §13 has the arithmetic.
GDD §19's 2026-09-08 decision — no wage for a service the game does not provide — was discharged
in Phase D and is now superseded by a sharper version of itself: **no wage for a service used in
bursts**, whether or not the game provides it.

✅ **Which frees the third slot, and nothing wanted it.** D30 found three slots is more than a
racing stable can profitably fill; with the Fixer gone, the crook agent was ablated head-to-head on
what to do with the room — nothing, a trainer, or a trainer and a vet — and every pairing came in
inside the standard error. So the slot is worth nothing to a stable that does not race for its
living either, which is D30 confirmed from a direction it did not anticipate. Lagrange Lows guarantees one, because its row has promised "Fixer for
hire" since M0 and nothing ever read the flag.

⚠️ **His ladder is a ladder of a *number*, and the version that was not cost the road its
existence (D41).** *(Phase E kept this rule and changed what the number is attached to: the price
list as well as the catch rate, and both carried on the job rather than on a hire.)* He shipped mid-phase with a Rough man who could buy a box and not get at a dog,
which reads well — the cheap half of the road has no punishment tail, so why should the cheap man
sell you the half that does? What it did was starve the road: a Proper-or-better fixer turns up at
30% of the 45% of planet-weeks that offer one, so a crook had a working fixer in **30% of its
weeks, first arriving in week 6.5**. Any fixer now does either job and what you pay for is how
well he covers his tracks. Same crook, same seeds: **67% of weeks, first arriving in week 3.8**.
Every other role on the ladder withholds a number rather than an ability, and the exception was
the mistake.

⚠️ **A Trader's hold is a wage, not an asset**, so letting one go takes the capacity with him. Firing
is **refused** while the hold is over the ship's own capacity — the same shape as "withdraw the dog
from its race first" — rather than spilling crates, which would be a punishment this document does
not describe.

### 8.4 Kennel items and the supplement

Track-day pass (+3 to one stat, 800) · Racing muzzle (+2 Trap, 600) · **Supplement** (+12 Speed for one race ⚖️, 400; 15% base chance the stewards catch it — purse forfeited, rating −5, one-week ban; 0% on Vatgrown, 30% at Cosmodrome, 40% at Old Wembley).

⚠️ The supplement is v2's cautionary tale and §13 must not repeat its shape. Because being caught forfeits the *purse*, the punishment scales with the size of the race while the benefit is a fixed speed bump — **so the supplement gets worse the bigger the race, which is exactly backwards from "tempting"** (§19, 2026-09-08).

### 8.5 A busier market

More staff on offer, more dogs, more goods per planet, everywhere. You cannot have a spending decision if there is nothing to spend on, and this is generation and data, so it is cheap.

**The cost to watch is pace.** `hub-clicks.ts` measures 13.3 decisions a weekend and that is the budget. If a busier market pushes it up, spend the difference on better summaries — `venueStatus.ts` already puts what is worth a walk on the hub's hotspots, and it was built for exactly this.

✅ **Built, it did push the budget up, and the summary that fixed it is a principle worth keeping.**
Thirteen goods, five hireable roles and a per-stable shelf took `hub-clicks` from 13.9 to **15.3**
against a 14.5 budget. The fix is the one BUILD_PLAN §11 asks for — a better summary, not fewer
decisions — and the summary is this:

> **A hotspot flags what CHANGES, not what is always there.**

The measured culprit was not the new market at all. It was "you could afford an engine tier", firing
in **533 of 650 planet phases**, because that is true every week for the rest of the season once it is
true once. A permanent fit does not expire and a bank does not close, so both became quiet-line
material — still named, never urgent. Stock, prices and who is drinking here *do* expire, so those
stayed news. Three further tightenings followed from the same principle: a Rough hire into a free slot
is not an event (another will be along), a Rough crate is only news when the dog would otherwise eat
kibble, and the kibble trade has to beat **the fuel as well as the spread** — which is the same
break-even arithmetic the Docks now prints, so the hotspot and the screen agree.

**13.9 a weekend**, level with Phase B and under budget, with a market several times deeper.

## 9. Goods, trading and information

### 9.1 The trade, and what was actually wrong with it

Every planet posts a buy and a sell price per good (spread ~10%) drawn from its band; prices drift ±15% week to week and react to events. Your dogs eat kibble from your hold first; with none aboard you pay the local price ×1.5 on arrival. Cargo slows your ship and raises fuel.

**GDD 0.1 claimed a "typical realised margin ≈ 45/unit". The real number is −9.5.** Carrying kibble to the next planet blind loses nine and a half Bones a unit on an average leg (p10 −56, p50 −10, p90 +37) **[measured over 72,000 legs]**, because the 10% spread plus the random draw is a tax on every crossing. That is exactly R3: Easy −3,990, Normal −3,584, Hard −3,334 a season. The AI was not bad at trading. **Trading was a losing game and every stable was forced to play it.**

### 9.2 Which makes information the trader's road

Knowing only **next week's planet** turns the same trade from −9.5 to **+23.6 a unit on the 40% of legs worth acting on** **[measured]** — the trader stops carrying and starts *selecting*. On a 20-unit hold that is +473 a leg; on a 100-unit hold, +2,363 less 400 of extra fuel.

So hiding the circuit (§9.3) does not hurt the trader's road. **It creates it.** And it prices everything else: a dossier on the week after next is worth roughly `hold × 24`, so **500–800 Bones is a clear buy for a trader with a big hold and a waste of money for a trainer** ⚖️ — which is what a good price looks like.

Two consequences to own:
- **Hold capacity has to be worth buying.** At v1's numbers a +20-unit cargo upgrade returns about 1,000 a season against 2,500 spent — it does not pay back inside a season, which is why ship upgrades cost the Hard AI seven points of head-to-head. Phase C must fix this from the fuel side (`fuelPerCargoUnitOver` 5 → 2 ⚖️), the price side, or both.
- **Kibble alone is too thin a market for a road.** The specialist feeds (§8.2) are the trader's real inventory: scarcer, dearer, and wanted by every trainer in the field.

### 9.3 The fog, and the information economy

**What you always know:** everything about the planet you are on — its card, its market, its prices, its rules. Next week's planet by name and Major status.

**What you never know for free:** anything beyond next week.

**What you can buy:**

| Carrier | Reach | Reliability | Price ⚖️ | |
|---|---|---|---|---|
| Saloon rumours | **2 weeks** | can be wrong — it is a rumour | free | ✅ Built |
| Dossier (**Galaxy Map**) | the week after next, in full | exact | **650** | ✅ Built |
| Event cards | 2 weeks | **usually exact, sometimes a lie** | 150–260 | ✅ Built (Phase D) |
| **Tipster** (staff) | 1–2 weeks, standing | exact | a wage | ⏳ Phase C |

✅ **Built, and the dossier adds nothing to GameState.** The whole circuit is in `calendar`
because the reducer has to build it once; the fog is a rule about *who may look*, and "this
stable paid to look" is a fact the action log already carries. So a dossier is a `BuyUpgrade`
naming a week — it charges 650, writes a line addressed to the buyer, and the client shows what
that stable's own log entitles it to. No `Player.intel`, and the golden snapshot did not move for
it. It reaches `dossierReach` = 2 weeks, because next week is free, so what you are buying is the
week after: one extra leg to price a hold against.

Next week is a *name*, not a briefing — the planet and its Major status, and nothing about its
track, its kibble band or its card. Those are what the dossier sells.

✅ **`lib/rumours.ts` re-tuned, horizon 4 → 2.** Four weeks was written when the Galaxy Map
printed every band for the whole season, so a rumour hinted at something already in a table and
did no job at all. With the map dark it is the only free look past next week, and four weeks of
them would hand back most of what D5 took. `NOTABLE` came down 14 → 10 and `CHATTER` up 0.55 →
0.75 to compensate, because over two weeks rather than four there are half as many planets to
gossip about and the Saloon was silent most weeks.

⚠️ **Two carriers were deferred. One is built and one moved again.** The Tipster is built with the
staff ladder (§8.3), and its ladder starts one rung higher than the table above because next week's
kibble band turned out to be free already — see §8.3.

✅ **The information cards landed in Phase D, and what they add is the thing the other three
carriers cannot do.** A drunk navigator sells the week after next for 260 and two drinks; a
customs clerk sells the kibble band two weeks out for 200 and is **wrong a quarter of the time**;
a tout sells next week's card for 150 and is wrong a fifth of the time. A dossier is a purchase
you chose and a rumour is free; a card is an **offer you did not ask for, at a price you did not
set, from a source you cannot check**. They add nothing to `GameState` — what a card sells is a
log line addressed to the buyer (D5, D36) — and a card that lies writes a line that is wrong with
nothing anywhere marking it. The lie is rolled when the card is *drawn*, so a human and an AI meet
the same manifest and the rng stream does not depend on which button is pressed.

⚠️ **The Phase C note, kept: the reason they slipped twice was the snapshot rule rather than the
work.** Adding a card re-weights the whole deck and moves the golden digest; Phase C's two moves were
spent on the goods record and the ladder's content, and a third was not available. Prime offers, the
other job §11 gives the deck, turned out not to need a card at all — the shelf's own 5% stock chance
delivers **2.93 offers a stable-season**, inside the 2–5 target — so the deck has one job left rather
than two, which is a better shape for Phase D to take on.

✅ **The AI was audited and does not cheat — and now it cannot.** §14 requires every difficulty
to see exactly what a player sees. Every read of the future turned out to be inside the free
horizon already: `tradeFoodPlan` and Hard's Blackreach hold-fill both look one week ahead, and
`weeksToMajor` scans the calendar for something §4.1 makes public. But nothing enforced it, and
nothing would have *failed* if a later change broke it — Hard would simply have stayed quietly
too good. `planetAhead` now throws past `FREE_HORIZON` rather than returning a planet.

## 10. Betting

Bookies open after declarations lock. **Win** and **Place**, any race, any dog, including your own. Odds = `(1 − margin) / p`, p from the bookie's rating model. Margin 15% (10% on Neon Snout; no betting on Holy Bark). Max stake per race 50% of cash ⚖️.

Betting is zero-sum minus the house, and is only a road **because §13 manufactures the knowledge that makes it positive**. See §13.

✅ **And it now is.** Phase D's ablation — the same crook agent, the same seeds, with §13 switched
off — moves betting income from **−713 to +1,885** a season. The sentence above has been an
intention since 0.2; it is a measurement as of `v2d`.

⚠️ **Max stake is a rich-get-richer channel.** The crook's edge is a *percentage*, so its cash value scales with what you can stake, which means the leader earns most from the same fixer's fee. Phase D must cap the crook's road with a flat stake ceiling as well as a fractional one ⚖️.

✅ **Built: `maxStakeFlat` is 8,000, applied alongside the 50% fraction, and the lower one binds**
(§20 Q7). Collar Prime multiplies it by 3, because §2.1 gives the crook's road "bursts, at the
biggest races" and the Grand Final is the one week where letting it have one costs the rest of the
design nothing. The guard holds: `leadConversion` split on whether a stable bet reads **leader
−0.11 against trailer −0.05**, so having had a bet costs a leader *more* than a trailer.

⚠️ **And the measurement turned the question around.** The flat ceiling is not what binds in
practice — the **fraction** is, at about 3,000 on a stable carrying six or seven thousand. The
ceiling matters only to a stable that has borrowed itself a bankroll, which is exactly the crook.
So §20 Q7's "what ceiling stops the leader" has an answer, and a more interesting question is left
behind it: can a road whose edge is a percentage ever be a third road while the bankroll is a
racing stable's working capital? See §13 and §20 Q15.

## 11. Events

One random event per player per weekend, from a weighted deck of 40+ cards. Roughly 60% flavour-with-a-nudge, 30% meaningful choice, 10% big swings.

v2 gives the deck two new jobs, and both are content rather than code:

1. **Prime offers live here.** A trainer between jobs; a pallet of Prime speed kibble that fell off a ship; a fixer who owes somebody a favour. This is the main mechanism by which the top tier stays rare and memorable, and Hushmarket's existing `fellOffAShip` special is already exactly this flavour.
2. **Information is sold here.** A drunk navigator with next-next week's route; a customs clerk with a manifest; a tip that turns out to be wrong.

The v1 deck otherwise stands: *Stowaway pup · Customs shakedown · Glorbo's Meat Paste · Kennel cough · Talent scout · Solar flare · Dodgy steward · Tip-off · Fat Tony calls in a favour · Kibble glut/shortage · Fan club · Pirates! · Wormhole shortcut · Retirement offer · Local derby · Rival's trainer poached.*

**Still open, and now overdue:** `personality` is displayed and flavours nothing — every difficulty answers `choice: 0` to every card. With 40 cards and a busier deck this is the cheapest remaining characterisation in the game.

## 12. Planets

Four Major venues and fourteen regular planets, unchanged from v1 in name, track, vibe and special. Two data fields gain new work in v2:

- **`foodBand`** now governs a market of many goods rather than one, and is the trader's whole map.
- **`marketBias`** is where the tier ladder gets its planet character (§8.1) — "Vatgrown always has Prime pup feed" is a row, not a branch.

| Planet | Track | Food | Special |
|---|---|---|---|
| **Cosmodrome** *(Major — The Cosmodrome Classic)* | Standard 480, wide | 80–110 | Bank; strict stewards (doping 30%, fixing 50%); buyers +15%; sells finished dogs |
| **Ossuary** *(Major — The Bonemeal Cup)* | Staying 600, tight, hazard ×1.5 | 80–110 | Shark; dog values +10%; *Stayer* shines |
| **Blackreach** *(Major — The Void Derby)* | Sprint 350, no bends | 90–130 | Turn order reversed; *Sprinter* paradise |
| **Collar Prime** *(Major — The Galactic Collar)* | Standard 480, medium | 90–130 | Always week 13; championship purse paid here; margin 10%, max stake 100% and the flat ceiling ×3 |
| **Kibbleton Prime** | Standard, wide | 40–60 | Cheapest; best place to load |
| **Rustgut** | Standard, tight | 110–140 | Cheap knackered dogs; rarely stocks above Rough |
| **Neon Snout** | Standard | 100–140 | Margin 10%; everything else +20% |
| **The Drift** | Sprint 350 | 70–100 | Ship upgrades −30%; *Pirates!* likelier |
| **Mudhaven** | Staying 600, hazard ×1.5, mud | 70–100 | *Mudlark* +5%; injury ×1.5; Vet for hire |
| **Glassfall** | Sprint 350, slippery | 85–120 | Acceleration matters more; food spoils without a cold store |
| **Port Slobber** | Standard | 70–100 | Every staff role for hire; 10% tax on winnings; bank |
| **Vatgrown** | Standard | 45–70 | Supplements legal; **the pup market**; always Prime pup feed |
| **Old Wembley** | Standard, classic | 70–100 | Doping catch 40%, fixing 55%; purse +20% |
| **Hushmarket** | Standard, tight | 100–140 | Fell-off-a-ship dogs and goods at 60%; stewards catch 25%; shark |
| **Sunbleach** | Standard, hazard ×1.2 | 100–130 | Fitness −5 on arrival; cheap kennel modules |
| **Tinkertown** | Sprint 350 | 70–100 | Engine upgrades −40%; muzzles |
| **Holy Bark** | Staying 600, serene | 45–70 | No betting — so no sabotage either; no upkeep; +5 fitness; stewards catch 60% |
| **Lagrange Lows** | Standard, tight | 100–140 | **A Fixer is always for hire (§13)**; stewards catch 20%; shark; locals are *Nervy* |

## 13. The crook's road

✅ **Built at `v2d`, and re-shaped at `v2e`. This was the one part of the GDD that had never
existed in code** — the Fixer was withdrawn from hire in M4 session 1 because nothing read
`staff.fixer` except a 350-a-week wage, and three phases upheld that on the grounds that charging
for a service the game does not provide is a trap rather than a difficulty. Every line below is
now a rule.

⚠️ **He went back on the staff ladder for exactly one phase.** Phase D made him hireable and
measured the road as a net loss because of it; Phase E took him off again for the opposite reason
to the original one — not "there is nothing for him to do" but **"what he does is a job, and a job
is not a week"** (D45). He lives at `PlanetState.fixer` now: one man, this planet, this weekend,
this price list. The test that leaves a seventh role off the wage ladder is the same one: *is the
thing it sells used every week?* If it is used in bursts, it wants a price list.

- **Steward bribe** (a fixer's job, 800 ⚖️ × his grade) — choose your dog's trap draw. ✅ Placed in the **planet phase**,
  because the draw is made when declarations lock, and honoured **last** in `lockDeclarations` —
  after the shuffle, after wide runners are put outside, after the dodgy-steward card — because a
  bribe a later rule could undo would be §8.4 wearing a hat.
- **Sabotage** (a fixer's job, 500 ⚖️ × his grade) — target one runner that is not yours in one race: **−25 fitness for
  that race** ⚖️. ✅ Placed in the **betting phase**, and *that is the mechanic* (see below).
- **Supplement** — §8.4, unchanged.
- **Throwing a race** — stays out. Measured at exactly ±0 for the Hard AI, and deliberately losing
  tends to feel bad.

**Why −25 and not the −15 the first draft proposed.** Measured on a Gold-class field (my rating-58
dog, one rival at 68, six locals at 58): nobbling the rival by 15 moves his win rate 35.4% → 20.5%
and mine 8.8% → 12.1%, worth +163 of purse EV against the fee — not a strategy. At **−25** he
falls to 11.6% and mine rises to 13.4%, and, crucially, **because the bookie still prices him at
68, backing my own dog at its unmoved 9.12 odds is worth +23% EV** **[measured]**.

✅ **Re-measured in Phase D on the fields the game actually produces, and +23% holds.**
`npm run harness -- --fix`, 5,850 locked fields across 150 real seasons:

| what you back | mean edge | p50 | p90 | share worth backing |
|---|---|---|---|---|
| a stable-owned runner (§13 as written) | **23.2%** | 13.2% | 58.3% | 83.8% |
| the best price left on the board (§10) | **27.4%** | 15.4% | 67.2% | 93.0% |
| …of those, at a Major | **33.1%** | 18.8% | 79.9% | 95.3% |

⚠️ **The second row is a correction to this section.** §13 describes the move as "backing your own
dog at its unmoved odds", which is one case of a more general fact: nobbling the favourite lifts
the true chance of **every other runner in the race** while all eight prices stand still, and §10
has allowed a bet on any dog in any race since v1. A crook restricted to its own runner found a
positive fix in **10 of 1,600 stable-weeks** — a mid stable's dog is a 2% chance at 42/1, and 45%
of nearly nothing is nearly nothing. The honest optimum is to nobble the favourite and take
whichever price the market is now most wrong about (D38).

**The money is in the bookie, not the purse** — +288 of purse EV against a betting edge that scales
with the stake. That is the honest shape of the crook's road and it dictates two things: the
Fixer's economics must be capped by a stake ceiling (§10), and the deterrent must be sized against
the *bet*, not the race.

### ⚠️ The phase a sabotage sits in *is* the mechanic

A nobbling lands in the **betting** phase and nowhere else. The prices are struck when
declarations lock and nothing re-prices them, so a job placed after the lock is money in a market
that has not heard about it. Placed any earlier it would either be priced in, or could only reach
the stables that happened to declare before you — an edge handed to whoever went last. The dog's
**stated** fitness never moves: `nobbled` is a separate figure and the field table goes on printing
the number the victim and the book both believe. That divergence is not untidiness to be cleaned
up later; it is the road.

One consequence to own: **Holy Bark has no bookie, so it skips the betting phase, so no sabotage is
possible there at all.** A bought box still is. The crook's road needs a market to sell into, which
is coherent rather than a limitation.

### The deterrent, and what measuring it found

**Two hard constraints, or this road eats the game:**

1. **Getting caught must be severe, and must not scale with the purse.** ✅ Built as **a flat fine
   plus a quarter of what you had on that race** ⚖️, rolled **on race day** — after the bets are
   struck, which is the only order in which a fine can be sized against a bet at all. The purse is
   untouched, because taking it would be §8.4 again: a punishment that grows with the race while
   the benefit does not. The Fixer is struck off and no other will work for the stable for the rest
   of the season, which is the half of the deterrent that grows with how often the road is used.
2. **It must not be strictly better than the other two.** ✅ Measured (§20 Q2). It is not; it is
   considerably worse.

⚠️ **This section feared the deterrent was too light, and it was far too heavy.** 0.4 reasoned:
"a fine of 3,000 at 25% detection is −750 expected against a gross of roughly +1,400 — not enough."
**The gross was the part that was wrong.** A stable's affordable stake is about 3,000, because the
50%-of-cash fraction binds on six or seven thousand of working capital, so an average fix grosses
about **840** — not 1,400. At the specified 1,200 fee and 35% detection the average fix **loses
money at any stake a stable can reach**. Swept, 150–250 seasons a cell:

| catch | fine | fee | ceiling | crook mean | fixes a season | caught |
|---|---|---|---|---|---|---|
| 0.35 | 1,500 + 0.50 × stake | 1,200 | 4,000 | 29,493 | 0.8 | 36% |
| 0.30 | 1,500 + 0.25 × stake | 1,200 | 4,000 | 29,533 | 1.0 | 38% |
| 0.25 | 1,500 + 0.25 × stake | 800 | 4,000 | 31,607 | 1.4 | 46% |
| **0.25** | **1,200 + 0.25 × stake** | **500** | **8,000** | **34,600** | **2.6** | **64%** |

Settled at the last row, with the catch rate multiplied by the planet (Lagrange Lows 20% up to
Holy Bark 60%) and by the grade of fixer (×1.5 / ×1.0 / ×0.5). The constraint that shapes the whole
thing is one line: **the fine's stake multiple must stay below (the edge ÷ the catch chance), or
no stake is ever worth fixing.**

### ⚠️ It did not pay, and then the Fixer stopped being a wage (D42 → D45)

Phase D's ablation — the same crook agent, the same seeds, once with §13 and once with it switched
off, 250 seasons — read **26,957 with the road against 30,455 without**: working it cost **3,498
Bones**. The deterrent was not what ate it. Every knob inside this section had been swept, and what
was left was the arithmetic in one line: *a Fixer is charged every week and used about twice a
season, against a gross of about 840 a fix.*

✅ **Phase E took the wage away, and nothing else.** The Fixer is not staff. He is one man at the
far table of whatever planet you are on this weekend, at one grade, and you hire him **for the
job**: a box at the Race Office before the draw, a word at the Bookie after the prices are up. The
fee, the fine, the catch rate and the stake ceiling are the numbers Phase D swept, untouched. Same
ablation, same seeds, 250 seasons:

| crook | mean | p10 | p90 | betting | fixing | jobs | caught |
|---|---|---|---|---|---|---|---|
| the road worked | **39,630** | 3,912 | 101,312 | **+7,938** | −2,426 | 1.6 | 52.1% |
| §13 ablated | 33,568 | 16,348 | 54,678 | −891 | 0 | 0.0 | 0.0% |

**Walking the road is worth +6,061 of end worth** — a swing of about 9,500 Bones from a change of
*shape* rather than of price, and the row BUILD_PLAN §6b had never met. Betting is not merely
positive now but the crook's second income line, and the **p10 still collapses 16,348 → 3,912**,
so §2.1's punishment tail survives the road becoming worth walking, which is the outcome that
mattered.

⚠️ **The ablation is also cleaner than D42's.** Switching the road off used to switch off a *wage*
as well, so the control was a slightly richer stable for a reason that had nothing to do with §13.
With no wage to remove, the two arms differ in exactly the jobs.

**The price list, and why the grades are priced the way they are.** A job costs the fee on the row
times the man's grade: ×1.0 Rough, ×1.5 Proper, ×2.0 Prime ⚖️. The multipliers are derived from the
same break-even the deterrent was sized against — a fix clears `S × (edge − fineStakeMult × catch)
− fee − fineBase × catch` — and are chosen so the three grades break even at roughly the **same
stake**:

| grade | fee | caught | fixed cost | % of the stake | break-even at a 27% edge |
|---|---|---|---|---|---|
| Rough | 500 | 37.5% | 950 | 9.4% | **5,391** |
| Proper | 750 | 25.0% | 1,050 | 6.3% | **5,061** |
| Prime | 1,000 | 12.5% | 1,150 | 3.1% | **4,817** |

Which makes the grade a choice about **variance** rather than a ladder of whether the road pays at
all: the careful man is dearer per job and very slightly better per Bone, and what he really buys is
a smaller chance of the season ban — the half of the deterrent that grows with use. And every one of
those break-evens is above the ~3,000 a racing stable carries spare and below the 8,000 flat
ceiling a *borrowed* bankroll reaches, which is §2.1's crook column in one line: **in bursts, at the
biggest races**. A wage could not produce that shape, because a wage is charged in the quiet weeks
too.

⚠️ **This is the named exception to D11**, and it has to be written down as one. D11's second guard
is *"Prime staff are a weekly wage, not a purchase"*, so the top tier is a liability when the run
ends rather than an "I have already won" button. That sentence cannot apply to a man who is not on
the books — and what replaces it is a **stronger** version of the same guard rather than a hole in
it: a Prime job is paid *every time*, so a leader who wants the careful man buys him again on every
race he fixes and can never bank him. A wage at least gets cheaper the more you use it. The ladder
itself is untouched: the job carries the tier, the tier sets the price *and* the catch multiplier,
and a planet-week offers one man at one grade, so you still cannot buy the good one wherever you
like (D41's rule, kept).

**The season ban got simpler rather than harder.** Being struck off used to mean "your fixer is gone
*and* you may not take another on", which needed a flag and a staff list to empty. There are no
books now, so `flags.fixerBarred` is the whole of it: every job, on every planet, refused for the
rest of the season, however many men are drinking wherever you travel.

**What is left of §20 Q17.** The question was whether a road whose edge is a percentage can be a
third road while the bankroll is a racing stable's working capital. The answer is **yes, if the
road is not also a standing charge** — the bankroll was never the binding half. §20 Q15's loan shark
is still how a crook reaches the ceiling, and 10% a week is still dear, but it is now a burst of
borrowing for a week there is a man to spend it with rather than a permanent second bill.

All shady options are off under the **Clean Sport** toggle. ✅ Both actions and the hire refuse
under it, and the Saloon, the hub and the walk-through all respect the refusal rather than offering
a button the reducer throws on.

⚠️ **§13's third penalty — "the wronged stable being told who did it" — is logged and does nothing,
and that is a decision rather than an omission (D40).** The line is public, so it reaches every
stable at the table; but an AI holds no grudge, so in single-player it is flavour. Making it bite
means retaliation, which is a rule this document does not describe and a fourth thing to balance.
It is a **multiplayer** feature, written up for M6 (§18), and the fine and the season ban are sized
to carry the whole deterrent without it.

## 14. AI stables

AI plays by the same rules with no stat bonuses. Difficulty changes decision quality only.

- **Easy** — near-random declarations respecting entry criteria; **rests anything under 40 and never trains**; never bets; buys food only when out; never hires; sells only when broke. It also leaves **85%** of the card to the locals ⚖️ — see D17.
- **Normal** — declares to maximise `Σ P(win) × purse`; keeps a Rough or Proper trainer; **races above 65 fitness, rests below 45 and trains in between**; trades on a visible spread; bets small on favourites.
- **Hard** — as Normal, plus: prices its own dogs by `effectiveRating` rather than rating (the §5.3 edge, which any player can also see); **races a little deeper into the fitness range (58)**; **prices a Train week against the purse it is passing up**; raises a pup when the market offers a good one; **buys information when its hold is big enough to pay for it**; uses supplements where the stewards are lax; uses the Fixer when the numbers say so.

✅ Built. Two notes worth keeping:

**A fitness threshold is a preference, not a rule.** Every difficulty offers its tired dogs to any race the fit ones left empty, above a floor of 50 where the injury roll doubles. A flat threshold would have left a trap to the locals rather than run a dog at 60 — deleting the exact choice §5.2 says the softened curve exists to create.

**Hard's "value the training against the purse" is worth ±0.0 today, and it is in anyway.** It compares the purse a dog would pass up against the uplift its training buys on every remaining race, and at Phase A's feed strength that comparison is never close — so it never fires. It starts firing at roughly Prime-feed strength. Like M4's Bronze throw, §14 asks for it, it is free rather than good, and the ablation is recorded rather than the behaviour quietly dropped.

✅ **`naive%` has a replacement: `autoplan%`, and it reads 8.8%** (§20 Q11). Its partner
`apLoss%` is built and cannot answer its question — the rollout it needs cannot hold the
downstream seed, so it reports an error bar around zero (D25).

✅ **Hard buys for coverage** (D27): the fact-gated card is the first thing that makes a coverage
gap exist, so a market dog is credited with rating points for each race type the kennel cannot
field a runner for, and `sellAgeingDog` will not sell the last dog that could take a Veterans
trap. Worth ±0 in head-to-head and kept for the same reason the Bronze throw is.

⚠️ **Phase D tried two more things on Hard and rejected both, and the second is a finding about
§13 rather than about Hard.** It beats Normal **57.7%** against the 63–68% row.

| Hard's betting, 300 seasons | beats Normal | mean | p10 | bet income |
|---|---|---|---|---|
| a flat fraction of cash (kept) | **58.3%** | 41,109 | 9,390 | +867 |
| quarter-Kelly on the edge it measured | 56.7% | 37,915 | 11,061 | −178 |

§14 has asked since M4 for Hard to price its own information, and it does — then stakes the same
fraction of cash whether the edge is 16% or 90%, which is most of the way to not knowing. Sizing
by it is *worse*, and the reason is specific: **Kelly stakes more as the price shortens**, so it
moves money off the long shots — which is exactly where `effectiveRating` finds its edge, because
a fed dog that has not had the results yet is a dog the book has long — and onto short ones, where
Hard's own estimate is least likely to beat the book's. Sizing a bet by an edge you have
*measured* is right; sizing it by one you have *estimated* is right only where the estimate is
good, and Hard's is good in one corner of the board.

| Hard's third slot, 200 seasons | beats Normal | mean | p10 | fixes |
|---|---|---|---|---|
| trainer + vet (kept) | **58.8%** | 41,663 | 8,919 | 0.0 |
| trainer + vet + fixer, **and working him** | 49.3% | 33,973 | 7,460 | 0.8 |

That is D30's question re-asked now that §13 gives the third slot something to do, and the answer
is a flat no by **9.5 points** — the same per-job-value-against-per-week-wage arithmetic that stops
the crook's own road paying (§13). Both are kept behind `HARD_KNOBS` with the tables in the
comment, so the next session does not re-try them.

⚠️ **Easy is unchanged, and the attempt to fix it is recorded as D26.** An Easy that puts its
good dog in the wrong race turns out to be *stronger* than one that puts a random dog in a random
race, so the card's third option makes the ladder worse rather than better.

Each AI stable keeps its name, colour, portrait and one-line personality.

## 15. Screens

1. **Title / New season** — players, toggles, seed.
2. **Galaxy map** — ⚠️ **now a fog.** ✅ Built. This planet in full; next week's name and Major star; the rest of the route as hatched, redacted rows. Anything bought shows here, and the dossier is bought here rather than in the Market — one place, one click, and it is the screen the information is *about*. The v1 file's own comment read "the whole circuit is visible from week 1 so players can plan"; that line is gone.
3. **Planet hub** — painted backdrop with hotspots; planet rules on a signpost; `venueStatus` hints.
4. **Kennels** — ⚠️ **the new centre of the game.** Each dog as a card with **Race / Train / Rest** as the primary control, its fitness trajectory, what feed it would eat, and what it would gain.
5. **Market** — dogs (mostly pups), feeds by tier with chevrons, items, staff by tier, dossiers.
6. **Docks** — ship, and a multi-good hold gauge with price history.
7. **Race Office** — ✅ three race cards, each naming **its entry criterion**, with your eligible dogs, everyone's declarations, the **week ledger** (§6.5) that prints what a run costs, and ✅ **the steward's box** (§13), priced against this race's purse and this track's bends — which on a track with no bends says plainly that the box is a starting position and to keep your money.
8. **Bookie** — odds, stake slider, and ✅ **the Fixer's counter** (§13): what nobbling the
   favourite is worth *in Bones on the stake dialled in*, what the stewards cost you if they
   notice, and the stake at which the whole thing stops losing. A button reading "−25 fitness · 500
   Bones" would be §8.4's supplement in a new coat — a correct rule with its price in the wrong
   units — and §13's road is a percentage edge whose cash value **is** the stake.
9. **Race view** — unchanged.
10. **Leaderboard** — cash, dogs, ship, cargo, debt, net worth, championship points, syringes.
11. **Season end** — podium, worth chart, moments, championship purse.

### 15.3 The click budget
13.3 decisions a weekend in v1. **Phase B measures 13.9** — the card and the fog together came in
*under* Phase A's 14.0, because a race a stable cannot fill is a race it does not walk to and the
map is only worth a visit while there is a week left to buy. Inside the 14.5 BUILD_PLAN sets for
Phase C. The Phase A note, for the record: **Phase A measured 14.0** ⚠️ — §5.7's per-dog state is six decisions for a full kennel, and the Kennels' **"Plan the week"** button sets the whole yard by fitness in one press, so the mechanic costs one click a weekend rather than six. A player who never touches it pays nothing and gets v1's behaviour, every dog pointed at a race. 14.0 is over v1's budget and inside the 14.5 BUILD_PLAN sets for Phase C. It is a budget, not a reading.

## 16. Art bible

Unchanged. One addition: **the tier ladder needs a glyph set** — one, two and three chevrons in the kit's existing hazard yellow, used identically on a sack of kibble and on a man in a coat.

## 17. Audio

Unchanged, and still later.

## 18. Multiplayer notes

Moved to **M6, behind v2**. Building a server for rules that are about to change is the wrong order (BUILD_PLAN §6). Nothing in v2 breaks the engine's purity, so M6 is the same job it always was.

## 19. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-07 | Medium dog depth (4 stats + fitness/form/age/traits) | Readable races; enough texture for training and buying |
| 2026-09-07 | Class eligibility by rating caps, racing up always allowed | *Superseded 2026-09-11 by D2* |
| 2026-09-07 | 45–60 minute season, no endless mode | Avoid Gazillionaire's never-finished problem |
| 2026-09-07 | Shuffled circuit with 4 Majors at weeks 4/7/10/13 | Replay variety plus golf-style tent-poles |
| 2026-09-07 | Grand Final always at Collar Prime | Tradition; a fixed finale to build toward |
| 2026-09-07 | Hotseat multiplayer in v1 | Nearly free given the pure engine |
| 2026-09-07 | Everything visible (cash, worth, ratings) | *Narrowed 2026-09-11 by D5: the scoreboard stays public, the future does not* |
| 2026-09-07 | Betting on any race including your own | On-theme; the main "edge" mechanic |
| 2026-09-07 | Gritty but cartoonish tone | Death Rally humour without cruelty |
| 2026-09-07 | Top-down race view | Matches Death Rally; each planet gets a track |
| 2026-09-07 | AI-generated art to a style bible | Only realistic pipeline for 18 planets |
| 2026-09-07 | TypeScript + React + Canvas, pure engine, Cloudflare Pages | Multiplayer-ready without a server on day one |
| 2026-09-08 | Local dogs 30 / 46 / 58, Bronze and Silver purses raised | PLAYTEST_NOTES finding 1: autopilot-right fell 59% → 19%. 35/57/78 was measured and rejected — mean end worth collapsed 47k → 17k |
| 2026-09-08 | Majors ×2.0 and the Grand Final ×3.5 | Adopted *with* the locals change, not instead of it; alone the multiplier moved nothing measurable |
| 2026-09-08 | Supplement +12 speed (was +8) | At +8 it was worth feeding in 10% of real declarations and 0% under a strict steward — a trap rather than a choice |
| 2026-09-08 | The Fixer is not hireable until §13 exists | Charging for a service the game does not provide is a trap, not a difficulty |
| **2026-09-11** | **D1 — rating stays performance-based; feed and training move stats only** | The informational edge is the reward for playing well. Fair rather than hidden: the stat bars show it. Goes together with D2, which removes the "farm easy races" objection |
| **2026-09-11** | **D2 — the race card is gated mostly by facts (age, wins, runs), not by rating; Bronze/Silver/Gold replaced by The Open plus two drawn from a pool of seven** | Facts cannot be suppressed and a rating can. Measured: a broad 5-dog stable fills all three races 59% of weeks, a one-dog-concentrated stable 14%, so this is the structural answer to R1 |
| **2026-09-11** | **D3 — net worth stays the win condition; championship points become a purse, not a scoreboard** | Under points the trader and the crook could not win at all, deleting two thirds of the design. Points would also not have fixed the procession — compounding runs through prize money either way |
| **2026-09-11** | **D4 — goods are four stat feeds on the three-tier ladder, plus kibble as the staple** | Keeps v1's eating and trading machinery untouched. Mental model is four stats × three grades, not twelve things. **Conditional on D12** |
| **2026-09-11** | **D5 — the circuit is hidden past next week; information becomes a purchasable good** | Pillar 2. And it is what *creates* the trader's road rather than hurting it: blind carrying loses 9.5/unit, knowing next week's planet earns 23.6/unit on the 40% of legs worth acting on |
| **2026-09-11** | **D6 — bankruptcy becomes reachable; target 5–10% of carelessly played seasons** | v1's rate is structurally zero, not low: 22 deliberate attempts all finished solvent. Prime wages plus cheap pups reach it without touching the forced-sale loop |
| **2026-09-11** | **D7 — three staff slots, any mix, no stacking penalty; price is the gate and role shape is the balance** | Moves the balance burden onto making the roles differently shaped, which is what makes pillar 1 real. Measure whether stacking dominates before adding a penalty |
| **2026-09-11** | **D8 — §13 gets built; sabotage is −25 fitness, not −15; the deterrent is sized against the bet, not the purse** | Betting is only a road because sabotage manufactures the knowledge. Measured: −15 is worth +163 against a 1,200 fee; −25 gives a +23% betting edge because the bookie's price does not move |
| **2026-09-11** | **D9 — four phases: A the training game, B the card and the fog, C the economy, D the dark side and the scoreboard** | Dependency-driven. B's fact-gated races only matter once you raise your own dogs; C needs something worth feeding; D needs the other roads to exist before it can be balanced against them |
| **2026-09-11** | **D10 — a busier market on every planet, inside the 13.3-click budget** | No spending decision without something to spend on. Generation and data, so cheap; pace is the cost to watch |
| **2026-09-11** | **D11 — one three-tier ladder (Rough / Proper / Prime) shared by goods, staff and the ship engine** | One vocabulary learned once. Prime food is a consumable and Prime staff are a wage, so the top tier is a risk as well as a reward rather than an "I have already won" button. The ship's five engine tiers fold in |
| **2026-09-11** | **D12 — ⚠️ the race simulation is rebalanced so all four stats matter (balance.json only)** | **Measured and load-bearing.** On v1's constants, +10 to one stat from a balanced rating-50 dog gives speed 27.6%, stamina 17.9%, accel 14.6%, trap 11.6% against a 12.3% baseline — *identically at every track length*. Trap is worth less than nothing while costing 15% of the dog's price. D4's four feeds would be one good and three traps. The new constants give 23.0 / 20.4 / 15.8 / 14.4 in rating-weight order, with accel peaking on sprints and trap on tight bends |
| **2026-09-11** | **D13 — ⚠️ the fitness multiplier is softened to 0.90 + 0.10 × fit/100, and *then* the weekly swings are enlarged (Race −25 / Train +8 / Rest +30)** | **R2 read the problem backwards, and so did session 1's −18/+10.** Fitness is the most violent lever in the game: at equal ratings 90 → 13.0%, 80 → 7.0%, 70 → 3.0%, 60 → 1.3%. Its whole usable range was 85–100, which is why nothing ever reached the threshold. Softened, the curve is legible from 40 to 100 and the swings can be seen |
| **2026-09-11** | **D14 — pups compound at 5–6 raw stat points a week, delivered only on Train weeks; age 1 grows +2 a week and age 2 +1** | Measured: below 4 points a week a pup never arrives, at 8 it is a monster by week 10. The band is narrow and that is a named risk |
| **2026-09-11** | **D15 — the purse pool is cut about 27%** | Prize money is 87% of v1's economy (35,766 against trade −3,747 and betting −325). Three roughly equal roads is arithmetic: the other two need to be worth 12–15k, which cannot be reached by making racing better |
| **2026-09-11** | **D16 — M5 online multiplayer moves behind v2, becoming M6** | No sense building a server for rules about to change |
| **2026-09-11** | **D17 — ⚠️ the local dogs and Easy's skip rate are re-fitted to the game §5.7 made: locals 30/46/58 → 22/38/50 at fitness 90 → 75, Easy's skip rate 0.5 → 0.85** | **The one unplanned change in Phase A, and all of it is one cause.** The locals are a fixed benchmark and Race/Train/Rest changed what a stable can field against it: a campaigning kennel's mean declared rating fell 47.9 → 42.3 as the good dogs started needing weeks off, while the locals stood still. The share of the purse reaching players collapsed **54% → 30%** and a Normal stable's racing ran at a loss. The same cause hit Easy's handicap from the other side — fitness rations races for everybody now, so skipping them is far less of a penalty, and at 0.5 Normal beat Easy 55.5%. This is M4's finding-1 lever pulled the other way, for the same reason it was pulled the first time. **Phase B re-fits all three again** with the new card (§6.3) and the purse cut (D15) |
| **2026-09-11** | **D18 — declaring a dog implies it races; standing a declared dog down asks you to withdraw it first** | The friendly implication runs from the specific act to the general state. The other direction would quietly bin an entry from another screen |
| **2026-09-11** | **D19 — `Player.training` and the `SetTraining` action are retired; a trainer's points land on every dog on a Train week, on that dog's own stat** | §5.7 and §8.3 both describe per-dog training. One dog, one stat, stable-wide was a second system saying something different, and the Kennels is where the decision belongs |
| **2026-09-11** | **D20 — D6's bankruptcy target moves to Phase C** | Measured at 0.0% of careless seasons. Two of §7.5's own three mechanisms are Phase C, and the one that does the work is the Prime wage bill. Raising upkeep to 300 reaches 1% and costs a Normal stable 27% of its worth — a bad trade for a target it still misses |
| **2026-09-11** | **D21 — the kennel module stays unbought by the AI, and `dogs owned at week 13` misses its target** | Measured: teaching Normal to buy one cost 5,000 Bones and nine points of head-to-head. M4's ship-upgrade finding survives the rules meant to overturn it; the lever is Phase C's ship economics (§20 Q6) |
| **2026-09-12** | **D22 — ⚠️ D15's purse cut is measured and deferred to Phase C; the pool stays at 19,250** | **The largest call of Phase B and the one the plan most invited getting wrong.** Four measurements, in §6.4 in full: the card already cost the economy 7.4% by cutting the *fill rate* rather than the pool; the fill rate went down where D15 assumed it would go up, so the cut costs more than planned rather than less; the cut cannot reach its own target, because prize is 81.7% of gross income and the other 7,016 a season is untouched by it, so 65% needs a 59% cut and D15's own 24% reaches only 77.6%; and it makes `races per dog` — already 4.8 against a 7–9 band — worse, because the marginal run is the first thing a smaller purse kills. The ratio moves when the other two roads grow. Phase C is where they grow and where the cut can be sized against them |
| **2026-09-12** | **D23 — the Handicap's cap is 45 and the Invitational's floor 48, fitted from cardCoverage rather than chosen** | Both started at 55 and both ends were wrong: the Handicap could be filled on 97.5% of the weekends it ran and so asked nothing, and the Invitational on 12.5%, so players took 1.2% of its entries and the locals owned a tenth of the card. Swept over 150 seasons a cell; 45/48 reads 85% and 46%. One point apart, so ratings 46 and 47 sit outside both and nothing else does |
| **2026-09-12** | **D24 — locals are priced by the race's purse tier (Open 50, drawn 30), and the third re-fit D17 promised was not needed** | A rich race draws a strong home team; what the race *asks* of a dog is a separate question, answered by the row's local spec squeezing the draw into the window its criterion allows. The share of the purse reaching players landed at 52.4% first time, against v1's 54% and Phase A's 52%, so nothing was tuned. It is a first-class harness row now rather than a probe written twice |
| **2026-09-12** | **D25 — `apLoss%` is built and reported as an error bar around zero; the measure cannot work as §7a.3 specifies** | It asks for two rollouts "on the same downstream seed" and there is no such thing: GameState carries one rng stream, so the moment the forced plan consumes a different number of draws the rest of the season is a different random season. Each sample is one decision plus thirteen weeks of variance — sd 20,041, mean −1,047 ± 1,231. I nearly acted on the first run's −1,856 and swept Normal's `raceAbove` looking for the cause; races per dog does not move at any setting. `autoplan%` is exact and stands at 8.8% |
| **2026-09-12** | **D26 — Easy's "wastes its good dogs in the wrong races" was built, measured and reverted** | At the same skip rate the new behaviour makes Easy *stronger*, not weaker (Normal beats it 74.3% against 77.9%), because what it replaced was a random dog in a random race and best-in-the-wrong-race beats random. Dropping the skip rate to make Easy visible costs the ladder outright: at 0.3 Normal beats it 50.0%. Easy's difficulty is structurally "does not turn up", and every other line §14 gives it is a *saving* in this economy |
| **2026-09-12** | **D28 — the Consolation reaches two weekends, not one; it fixed the race and did not fix Q12** | Jesse's call. At one weekend the only qualifying dog was the one that had just raced and was 25 fitness down, so the catch-up race was enterable on 29% of the weekends it ran and took 3.8% of player entries — barely a mechanic. At two it reads **71%** and 8.9%, the fill rate goes 1.90 → 1.95, the purse share reaching players 52.4% → 53.4% and p10 end worth **8,052 → 9,620 (+19%)**. But the "decided by" week is **6.4 before and 6.4 after**, because the criterion keys off a dog that ran badly rather than a stable that is behind, and the leader has one of those as often as the tail. Cost: Hard beats Normal 56.0% → **53.9%**, on a target already 9 points away — the extra cheap race helps the weaker stables more. Kept because the race is now worth having; the head-to-head cost is real and named |
| **2026-09-12** | **D27 — Hard buys for coverage and keeps its last veteran; worth ±0 in head-to-head and kept anyway** | The fact-gated card is the first thing that makes a coverage gap exist — under the old ladder every dog could enter the top class. Ablation at `coverageGain` 0/4/8/14/20 reads 56.7/56.8/57.4/56.6/56.5, inside the noise. What it moves is coverage: against Normal, Juvenile 72% vs 63%, Invitational 52% vs 45%. Kept on the same footing as M4's Bronze throw — §14 asks for the decision quality, it is free rather than good today, and the ablation is recorded |

| **2026-09-12** | **D29 — ⚠️ D15's purse cut is dead. The pool stays at 19,250 and the 65% prize share is retired as a target** | **The most useful finding of Phase C, and it is a negative one.** D22 built the market first, as it asked, and `other` grew 7,016 → 9,469 with the prize share falling 81.7% → 77.3% on an *unchanged* pool — the mechanism working. Then the cut was swept: 10% costs **15% of a stable's end worth and moves the prize share to 77.4%**; 20% costs 27% and moves it to 77.6%. **The ratio is invariant to the cut at any depth**, because prize money is the *working capital* of the other two roads — cut it and dogs sold falls 54%, bets returned 33%, food sold 8%. D22 thought the other roads were untouched by a cut; they are financed by it. The question 65% was a proxy for now has a direct measurement, and §20 Q2 reads the two roads **1.4% apart**. A proxy that needs a 45% cut while the thing it proxies for is already met is the wrong number to steer by |
| **2026-09-12** | **D30 — ⚠️ Hard hires a trainer and a vet and leaves its third slot empty; three slots is more than a racing stable can profitably fill** | Hard began the phase wanting all five hireable roles and **beat Normal 48.0%**, down from Phase B's 53.9%, with a mean above Normal's and a p10 well below. Ablated over 300 seasons a cell: all five 48.0%, +scout 55.8%, +tipster 55.8%, **trainer+vet 58.7%** (mean 41,346, p10 9,825). The trader-road staff are only worth their wage to a stable that plays that road, and a wage is charged whether the capability is used or not. So the slots are a budget rather than a checklist — and D7's no-penalty design is what makes over-hiring a mistake a player can make, which is the good version of this |
| **2026-09-12** | **D31 — a Train week eats one crate of the *best* feed aboard for the dog's chosen stat; the player never picks the week** | Asking which week as well as which stat would cost a click per dog per week against a budget with half a click left (§8.5, D10). The player controls what is in the hold and which stat the dog is on, both of which already have screens. The consequence — Prime feed disappearing fast — is §8.1's consumable guard working rather than failing |
| **2026-09-12** | **D32 — the hold is a dense record over every good; spoilage is a fraction of the total, off the largest stacks first** | A sparse record would make the golden digest depend on the order a stable bought things in, because `GameState` is the save file. On spoilage, both obvious readings are wrong: rounding *up* per good costs a hold split across thirteen goods a crate of each (13 of 13 at a 25% rate), and rounding *down* per good lets a hold of thin stacks spoil nothing. Largest-stacks-first is proportional, cannot be dodged by splitting a hold, and consumes no rng draw |
| **2026-09-12** | **D33 — feed eaten is a running cost, not a failed trade** | `stats.tradeIncome` is sold minus bought, so a stable that bought a crate of Prime speed feed and fed it to a dog looked like a trader who had lost 900 Bones — which is why "trade" read as a loss for three phases. §7.2 already lists feed eaten among the weekly costs. The crate's value now moves to costs at consumption, valued at what it would have fetched, and Normal's trade income reads **+1,939**. Same class of fix as Phase B's gross road split: you cannot balance three roads while one of the numbers measures something else |
| **2026-09-12** | **D34 — a hotspot flags what CHANGES, not what is always there** | The market got several times deeper and `hub-clicks` went 13.9 → 15.3 against a 14.5 budget. The culprit was not the new market: it was "you could afford an engine tier", firing in **533 of 650 planet phases**, true every week once true at all. A permanent fit does not expire and a bank does not close, so both became quiet-line material; stock, prices and who is drinking here do expire, so they stayed news. Back to **13.9** with a market several times deeper, which is §8.5's "spend the difference on better summaries" done properly rather than promised |
| **2026-09-12** | **D35 — the Tipster's ladder starts at next week's card, not next week's band** | §9.3's table gives a Rough tipster "next week's kibble band", but the band has always been free in the build: the Docks prints it and `tradeFoodPlan` reads it, and that one-week visibility is what makes the trade a judgement. Selling it would have been the Fixer again — a wage for what the game gives away |
| **2026-09-13** | **D37 — ⚠️ the trap *draw* gets a real effect: the rail is the short way round and where the traffic is** | §13's steward bribe sells you your dog's box, and **the box was worth nothing**: the trap number was read in one place in the whole simulation (the Nervy trait at traps 1 and 8), so the bribe was §8.4's supplement again. Measuring it also turned up a bug of M0's vintage — the bend tie-break made the **lower array index**, which is the lower trap, the victim of every clash between two dogs of equal craft, worth **9.1% against 17.3%** between identical dogs on a tight 480. Two numbers now, pulling opposite ways: `trapDrawEdge` 0.018 makes the inside faster, `trapTraffic` 20 makes it need craft to hold. Choosing your box is worth **+3.5 points of win rate** on tight bends and nothing on a straight. Cost: 1.3% of the economy; bought: the season decided at 6.9 instead of 6.6, which is Q12 moving for something nobody aimed at it |
| **2026-09-13** | **D38 — a sabotage is placed in the *betting* phase, and a crook may back any runner rather than only its own** | The phase is the mechanic: the prices are struck at the lock, so a job placed after it is money in a market that has not heard. Earlier it would be priced in, or could only reach whoever declared before you. And §13's "backing your own dog at its unmoved odds" is one case of a general fact — nobbling the favourite lifts the true chance of *every* other runner while all eight prices stand still, which §10 has allowed a bet on since v1. Restricted to its own runner a crook found a positive fix in **10 of 1,600 stable-weeks**; a mid stable's dog is a 2% chance at 42/1 |
| **2026-09-13** | **D39 — the championship purse is 5,000 / 2,500 / 1,250, and points are derived rather than stored** | §4.3 estimated 12,000 and called it "about 6% of a champion's end worth"; measured, a champion ends on 70,000 and 12,000 is **15.5%**. The shape is the giveaway: swept over 200 seasons a cell, **p10 does not move at all while p90 rises 16%**, because the purse is paid in the last week to whoever is already in front. 5,000 lands at 7.1%. Points come off `RaceResult`'s own finishing order and owner-on-the-day, so a field would be a second copy to keep honest — D36's argument again |
| **2026-09-13** | **D40 — "the wronged stable is told who did it" is logged and inert until M6** | §13's third penalty. The line is public and reaches the whole table, but an AI holds no grudge, so in single-player it is flavour. Making it bite means retaliation — a rule the GDD does not describe and a fourth thing to balance in a phase that already carries a three-road pass. Jesse's call: write it up for M6 and size the fine and the season ban to carry the deterrent without it |
| **2026-09-13** | **D41 — ⚠️ the Fixer's ladder is a ladder of a *number*, not of abilities** | He shipped mid-phase with a Rough man who could buy a box and not get at a dog. It reads well — the cheap half of the road has no punishment tail — and it **starved the road**: a Proper-or-better fixer turns up at 30% of the 45% of planet-weeks that offer one, so a crook had a working fixer in **30% of its weeks, first arriving in week 6.5**. Any fixer does either job now and what you pay for is how well he covers his tracks (caught ×1.5 / ×1.0 / ×0.5). Same crook, same seeds: **67% of weeks, week 3.8**. Every other role on the ladder withholds a number rather than an ability; the exception was the mistake |
| **2026-09-13** | **D42 — ⚠️ §13 is built, correctly priced, and does not pay. The wage is what eats it, not the deterrent** | The ablation, 250 seasons, the same agent and seeds with the road switched off: **crook 26,957 with §13 against 30,455 without**. The edge is real and re-measured (23.2% on your own runner, 27.4% on the best price left) and **betting turns positive for the first time in the project**, −713 → +1,885; the p10 collapses 15,349 → 2,592, which is §2.1's punishment tail working. But a stable can stake about 3,000, so a fix grosses ~840, and a Fixer is a *weekly* wage for a man used *twice a season*. §14's mirror image: teaching Hard to take one and work him costs 9.5 points of head-to-head. The deterrent was swept out — §13 feared it was too light and it was far too heavy — and what is left is a named lever: the stake, and where the money for it comes from |
| **2026-09-13** | **D43 — ⚠️ the three roads are *not* mixable, measured for the first time** | §2.1: "They are meant to be mixable… and should be about as rich as one that commits." The mixed agent plays the same steps as the other three with one options object each, and over 400 seasons in the same seasons it ends on **25,803** against the trader's 29,532 and the trainer's 35,644 — worse than every single road. Three roads compete for three staff slots, one kennel's cash and one week's attention. Whether that is a fault is a design question rather than a measurement one, and it is Jesse's: committing is a *decision*, and a game whose safe answer is "a bit of each" has fewer of them — but §2.1 promises otherwise in print |
| **2026-09-14** | **D45 — ⚠️ the Fixer leaves the staff ladder and is hired by the job. The named exception to D11** | D42 measured §13 as a 3,498-Bone net loss with every knob inside it already swept, and named the wage as the thing eating it. Phase E took the wage away and changed nothing else: he is one man at `PlanetState.fixer`, on one planet, for one weekend, at a price list of ×1.0 / ×1.5 / ×2.0 on the fees ⚖️, with the job carrying the tier so the catch chance belongs to the job rather than to the stable. Same ablation, same seeds: **+6,061 instead of −3,498**, a swing of ~9,500 Bones from a change of shape. D11's "Prime staff are a weekly wage, not a purchase" cannot apply to a man who is not on the books, and what replaces it is stronger: a Prime job is paid every time, so a leader can never bank the careful man. The season ban got *simpler* — no books to strike him off, so `fixerBarred` is the whole of it |
| **2026-09-14** | **D46 — the three roads mix after all; D43 was a wage and a badly written agent, not a rule** | Each of D43's three suspects relaxed on its own, same seeds, with the control row that makes the cash suspect mean anything. **A fourth staff slot is worth zero to the Bone** — a mixed stable never fills three. **Twice the cash lifts the mixed stable 37.4% and the trainer 30.5%**, so nearly all of it is compound interest. What is left is attention (+6.3%) and D45's wage. The mixed agent now plays each road at the intensity the single-road agent plays it and fixes opportunistically, which costs it no slot: four roads in the same seasons come in **3.8% apart** against a 15% target, the closest they have been, with the mixed stable above the best single road. **No rule changed** |
| **2026-09-14** | **D47 — Hard was comparing two different rulers, and it is a defect whether or not it moves a head-to-head** | Since M4 Hard has rated its own dogs by `effectiveRating` (stats, not the public number) and `expectedField` has gone on rating every rival by the public number, because it never took a ruler. So every race Hard priced compared a generous estimate of itself against a plain one of the field. Repaired — one ruler, both sides. ⚠️ **Worth +2.5 points three-against-three and −0.2 at the standing table**, i.e. nothing; kept on correctness, and its comment says so rather than claiming a gain |
| **2026-09-14** | **D48 — `apLoss` is a bound, not a figure, and that closes it rather than carrying it** | Re-anchoring both rollouts to `hash(seed, week)` at each week boundary cancels the part of the difference that is pure draw-mismatch: sd 20,041 → 17,810, and the mean stops wandering (Phase D read −1,047 at 568 rollouts; this reads −54 at 2,488, s.e. 357). Read as an interval, **one week of naive play costs under ±714 Bones on a ~32,000 season** — under 2.2%. That is the game saying one week in thirteen is worth very little at season end, the same shape as Q12, not a broken instrument. A point estimate needs the engine to key randomness by event rather than by sequence, which is a rebalance of every number in the game to sharpen one measure. **Declined, in writing** |
| **2026-09-14** | **D49 — ⚠️ a head-to-head is a property of the table it is played at, and none of Hard's decisions is a bad one** | The Phase E ablation was first run three Hard against three Normal and disagreed with the project's standing measure — D47 read +2.5 there and −0.2 at the standing table (easy, normal ×3, hard ×2), which is the configuration every "hard beats normal" number in this project has been quoted from. Re-run there, 800 seasons: holding the best dog out the week before a Major is worth **2.1 points**, selling before the age tick **1.9**, working §13 per job **−4.4**, and the two rating variants are inside the error. **So there is no bad decision left in Hard to take away**, and whatever keeps it off 63–68% is not on that list. Six phases: 60.6 → 56.8 → 53.9 → 58.6 → 57.7 → **57.8** |
| **2026-09-14** | **D50 — races per dog is 5–6, not 7–9: the band was set for a game that no longer exists** | The identity, measured this phase: a stable enters **1.97** of the weekend's three races and owns **4.98** distinct dogs across the season, and 1.97 × 13 ÷ 4.98 = **5.14**, which is the figure. Reaching 7 needs entries above 2.68 of three or fewer than 3.7 distinct dogs. The first is unreachable while §5.7's fitness binds (a stable is *eligible* for all three 76.3% of weeks and actually fills all three 23.3%) and the second contradicts §5.6's pup problem and the market being a road. Both are things the design deliberately pushes the other way, so the band was fitted to v1, where every dog raced every week. **Adopted: 5–6**, which the game meets |
| **2026-09-14** | **D51 — ⚠️ `bankruptRate` measures a cascade, not ruin, and the careless row was reading the wrong one** | At 400 seasons careless bankruptcy read 4.0% and was called a near-miss inside one standard error. At **1,600** seasons it reads **3.6% ± 0.5**, three standard errors outside the 5–10% band — a real miss, not noise. But the flag fires only when endTurn's whole cascade fails in one week (Fat Tony covers, then repossesses, then the cheapest dogs are sold); a stable can grind down to nothing across thirteen weeks without ever tripping it. Measured directly: **15.7% of careless stables end on nothing or less** and 24.4% under 2,000. So §7.5's intent — carelessness ruins you — is met several times over, and the 5–10% band is a band of the wrong quantity. The band's numbers are **left alone** because nothing re-derives them; what changes is what BUILD_PLAN says it is a band *of*, and the ruin row is reported beside it |
| **2026-09-14** | **D52 — `oddsScale` stays at 15.5, decided on the error profile rather than deferred again** | Q4 left 15.5 against a least-squares best fit of 15.75 with the profile at 15.75 never printed. Printed: worst-case error across ratings 35–75 is 1.9 points at 15.5 and **1.4 at 15.75**, and the rms is a hair better at 15.75 too — so on symmetric error 15.75 wins. It loses on the criterion §20 Q4 actually names: the danger is the **overlay**, the bookie *under*-rating a dog and leaving free money, and the largest overlay anywhere in 35–75 is **0.5 points at 15.5 against 1.3 at 15.75**, all of it at rating 65 where stables actually race. Against a 15% margin neither is dangerous, and the design's own criterion picks 15.5. **Settled, not carried** |
| **2026-09-14** | **D53 — the spread row reads "the crook widest, the trader narrowest"** | BUILD_PLAN has said "the trainer narrowest" since before anything was measured, and Phase C (§20 Q2) and Phase D both measured the opposite. Phase E measures it a third time — crook 18.5, trainer 9.9, trader **5.6** — and the row is corrected rather than carried into a sixth phase as a row everybody knows is wrong |
| **2026-09-12** | **D36 — `leadConversion` reads the action stream rather than `PlayerSeasonStats`** | §7a.4 specifies a two-field addition to the engine's stats. The harness applies every action itself, so "this stable bought a Prime thing" is already in front of it; doing it there added nothing to GameState and kept the golden snapshot at its two moves. The same argument that kept the dossier out of state in Phase B |

## 20. Open questions ❓

1. ~~Grand Final venue~~ — decided: always Collar Prime.
2. ~~Major purse share~~ — decided 2026-09-08.
3. ~~Hotseat in v1~~ — decided: yes.
4. ~~**Q1 — How much does the §6.2 rebalance cost the rest of the economy?**~~ — **answered: 7.7%.** Mean end worth 40,696 → 37,554 over 800 all-Normal seasons; p10 −5.0%, p50 −6.3%, p90 −9.8%; costs flat; head-to-head unmoved. Well inside the 20% that would have forced a purse re-fit. The *mechanics* of §5.7 then cost a further 13% on top (37,554 → 32,674), most of which was the local re-fit of D17 winning back a much larger fall.
5. ~~**Q2 — Are the three roads actually equal?**~~ — **answered for the two that exist, and the answer is yes.** The path agents are built (BUILD_PLAN §7a.5) and the three-way printout is a first-class harness deliverable. 400 seasons, three trainers against three traders in the same seasons:

    | agent | mean | p10 | p90 | prize | trade | crates carried | hold |
    |---|---|---|---|---|---|---|---|
    | trainer | 31,724 | 6,936 | 70,579 | 33,829 | 809 | 7.2 | 20 |
    | trader | 31,361 | 12,208 | 54,367 | 24,465 | 6,680 | 20.4 | 111 |

    **1.4% apart on the mean, against a 15% target — and visibly different in spread**, which is the
    second half of §7a.5's ask: the trainer's road is the volatile one (p10 6,936, p90 70,579) and the
    trader's is the safe one (12,208 to 54,367). One road wins big, the other rarely loses. That is a
    better outcome than "equal" and it is exactly the shape pillar 1 wanted.

    ✅ **Phase D adds the other two, 400 seasons, all four in the same seasons:**

    | agent | mean | p10 | p90 | p90/p10 | prize | trade | bet | fixes | caught |
    |---|---|---|---|---|---|---|---|---|---|
    | trainer | **35,644** | 7,592 | 77,094 | 10.2 | 38,123 | 589 | 0 | 0.0 | — |
    | trader | 29,532 | 8,995 | 50,232 | **5.6** | 23,834 | 5,511 | 0 | 0.0 | — |
    | crook | 28,785 | 1,295 | 77,072 | **59.5** | 27,421 | 1,231 | 1,311 | 2.1 | 61.0% |
    | mixed | **25,803** | 3,192 | 45,815 | 14.4 | 31,136 | 1,995 | 614 | 0.8 | 30.5% |

    **23.8% apart against a 15% target — missed.** The spread row is met on the half that matters:
    the crook is by far the widest (59.5 against the trainer's 10.2), which is §2.1's "high, with a
    punishment tail". The half that is not met was already wrong: BUILD_PLAN says "the trainer
    narrowest" and Phase C measured the opposite — **the trader** is the safe road, at 5.6.

    ⚠️ And the mixed row was the finding: see D43. ✅ **Phase E, four roads in the same 400 seasons,
    two stables each — and the three are 3.8% apart, the closest they have ever been (D46):**

    | agent | mean | p10 | p90 | p90/p10 | prize | trade | bet | fixing | caught |
    |---|---|---|---|---|---|---|---|---|---|
    | trainer | 32,526 | 7,082 | 70,454 | 9.9 | 34,241 | 1,041 | 0 | 0 | — |
    | trader | 33,758 | 10,964 | 61,795 | **5.6** | 24,746 | 7,720 | 0 | 0 | — |
    | crook | 33,529 | 4,742 | 87,861 | **18.5** | 27,482 | 1,657 | 3,203 | −2,269 | 49.4% |
    | **mixed** | **36,598** | 5,917 | 79,934 | 13.5 | 36,510 | 3,381 | 1,439 | −1,017 | 23.8% |

    The mixed stable is **above** the best single road, so §2.1's sentence and BUILD_PLAN's last
    unmet acceptance row are both met. Two things did it and neither was a rule: D45's per-job
    Fixer, which stopped a mixed stable paying a wage for a road it works twice a season, and the
    agent playing each road at the intensity the single-road agent plays it. ⚠️ The spread row
    reads **the crook widest, the trader narrowest** for the third measurement running (D53).

    ⚠️ **Two things to hold onto.** The trader's own trade income is **6,680** against BUILD_PLAN §6b's
    8–15k row, so that row is *missed* even though the road pays: what is short is the income line, not
    the outcome. Diagnosis in §9.2 — the road is bound by the cash to buy stock, and the honest next
    lever is a bigger bankroll or more credit rather than better prices, since the return *rate* per
    Bone is set by the band spread and is already good. And the crook's road is unmeasured because §13
    does not exist, so this answers Q2 for two roads out of three.

    ⚠️ **§7a.5's caveat travels with these numbers and the harness prints it under the table:** three
    hand-written agents measure whether the roads *can* pay, not whether they are balanced against a
    good player. Jesse beat three Hard and three Normal stables with a line no agent plays. It is a
    floor test, not a proof.
6. ~~**Q3 — Does the Prime tier amplify the runaway?**~~ — **answered: no, and the guards hold.** `leadConversion` is built (§7a.4) and reads, over 800 seasons, a Prime offer worth **+0.11** places to a stable ahead at week 6 and **+0.24** to one behind. The trailer gains more than twice as much. D11's consumable food and wage-not-purchase staff are doing their job, and §11's ugly rubber band stays out. Two caveats: a leader has fewer places to gain than a trailer by construction, so the columns are read *within* a row; and the effect is small either way, which is what a guard that works looks like.
7. ~~**Q4 — What is the right `oddsScale` after D12?**~~ — **answered: 15.5** (from 17.5; the least-squares best fit is 15.25 and the bowl is flat between 15.0 and 15.5). 15.5 minimises the *worst-case* error across ratings 35–75 at 2.1 points. It leaves the bookie under-pricing the very best dogs by that 2.1 — a deliberate, stable divergence in the direction §6.2 wants, and small enough that backing favourites blind still loses to the 15% margin. **At 17.5 the gap was 8.4 points at rating 65**, which is a standing overlay big enough to beat the margin: free money for anyone who noticed, and Phase D's crook would have been balanced against a bug. The edge the crook's road needs comes from what the bookie *cannot see* — a fed dog, a supplement, a sabotage — not from a mis-fitted scale.
8. **Q5 — Does the fact-gated card feel arbitrary under the fog?** Measured to work structurally (§6.3); untested as an experience.
9. ~~**Q6 — How big does the hold have to be, and how cheap the fuel, before the trader's road pays?**~~ — **answered: fuel 2 a crate and a 1,400 hold, and the first upgrade is the only one worth buying.** Sized by ablation rather than estimate (§9.2's table): the first +20 hold returns **1,506 against 1,400 paid**, the second 996, the third 395 and the fifth less than nothing. The useful half of the answer is the shape rather than the number — **capacity has sharply diminishing returns because the road is bound by the cash to buy stock, not the room to put it in** — and that is now printed on the Docks' own cargo row so a player meets it before paying for it.
10. ~~**Q7 — What flat stake ceiling keeps the crook's road from scaling with the leader's bankroll?**~~ — **answered: 8,000, ×3 at Collar Prime — and the question turns out to be the wrong one.** The guard works: `leadConversion` split on whether a stable bet reads **leader −0.11 against trailer −0.05**, so having had a bet costs a leader *more* than a trailer. But the flat ceiling is **not what binds in practice** — the 50%-of-cash fraction is, at about 3,000 on a stable carrying six or seven thousand. The ceiling only reaches a stable that has borrowed itself a bankroll, which is exactly the crook, and it is the **single biggest lever on whether §13 pays at all** (the sweep in §13: 4,000 → 8,000 is worth more than the fee, the fine and the catch rate put together), because the edge is a percentage and the fee is not. The question left behind it is Q17.
11. **Q8 — Retirement at age 7, or decay?** Default: decay, player chooses. Veterans races (§6.3) make an old dog worth keeping for the first time, which may settle this on its own.
12. **Q9 — Reputation as a visible stat?** Default: still v2-plus.
13. **Q10 — Does the human ever see the exact bookie probability?** Default: odds only.
14. ~~**Q11 — What replaces `naive%`?**~~ — **answered, half of it: `autoplan%` works and reads 8.8%; `apLoss%` cannot work as specified.** The autoplan is BUILD_PLAN §7a.3's own definition and the comparison is exact — the agent and the autoplan agree on the entries 32.3% of the time, on the states 27.3%, and on both 8.8%, over 7,800 stable-weeks. That is below the 15–30% band, and the honest gloss is that Normal's plan and the naive plan rarely coincide rather than that either is right. **`apLoss%` is a measurement problem, not a balance one** — see D25. Fixing it needs the engine to fork a per-decision rng stream so two rollouts share their downstream draws.
15. **Q12 — Why is the season decided *earlier* than v1? Phase C's two late-paying roads moved it 6.4 → 6.6, which is a tenth of the way and honest about it.** The Phase C prompt's own hypothesis was that a road paying *late* — a pup arriving at week 10, a hold that finally has something worth carrying — would delay the decision where another cheap race could not. Both were built and the number moved **0.2 weeks**. So the hypothesis is not refuted but it is not the answer either: the roads pay late enough to lift the floor (p10 8,052 → 9,113) and not late enough to change who is winning. What is left of the diagnosis below stands.
    <br><br>**Q12, as originally written:** The "decided by" week reads **6.4** against v1's 7.6. The obvious lever was pulled on 12 September — the Consolation now reaches two weekends, coverage 29% → 71% — and **it moved the number not at all** (D28). What it moved was the *floor*: p10 end worth up 19%, Easy's head-to-head up 1.3 points, Hard's down 2.1. The diagnosis that follows is that the Consolation redistributes toward weak **dogs**, not weak **stables** — a leader has a dog that ran badly as often as anybody. A mechanic that actually delays the decision has to key off standing, and the design does not currently have one. Worth asking whether it should: the honest alternative is that a 13-week season with compounding prize money is decided at week 6 and the fix is somewhere else entirely.
16. **Q13 — Is 76% too generous for a broad five-dog stable? — ⚠️ examined and deliberately left alone (D50's neighbour).** Unchanged at **76.3%**, against a 55–70% band nobody can re-derive. What Phase E can say is that the band is in **tension with Q14's**, and the mechanism is arithmetic: eligibility is a *ceiling*, fitness is what binds under it, and a real season turns a 76.3% ceiling into all three races filled **23.3%** of weeks and 1.97 entries a weekend. Tightening eligibility toward 55–70% would pull the season fill rate down with it, and races per dog is `entries × 13 ÷ dogs` — so meeting this band would push Q14's band further out of reach. Two targets cannot both be right when one is the ceiling of the other. **Nothing is moved**, because moving a number this phase missed is the failure the standing instruction guards against and 55–70 has no derivation to argue with; what is recorded is that the row to watch is the **season fill rate**, not the probe.

17. ~~**Q14 — Is `races per dog` the wrong measure, or is the game still under-racing?**~~ — **answered: the measure is right and the band was fitted to v1. Adopted 5–6 (D50).** It reads **5.1** against a 7–9 band and has missed in every phase since v1 (5.2, 5.2, 4.8, 5.1, 5.1, 5.1). The identity, both halves measured this phase: a stable enters **1.97** of the weekend's three races and owns **4.98** distinct dogs across a season, and 1.97 × 13 ÷ 4.98 = **5.14**. So the figure is not a symptom, it is arithmetic on two numbers the design chose on purpose. Reaching 7 needs entries above **2.68 of three** or fewer than **3.7 distinct dogs**. The first is unreachable while §5.7's fitness binds — §6.3's probe says a broad five-dog stable is *eligible* for all three 76.3% of weeks and a real season fills all three **23.3%** of them, so eligibility is not what is stopping it — and the second contradicts §5.6's pup problem and §8.5's market being a road worth walking. Both are things this design pushes the other way, which is exactly what a wrong target looks like. The band is **5–6** and the game meets it.

⚠️ **Q15's answer turned out to be about the wrong road.** The crook agent borrows from Fat Tony because its edge is a percentage of what it can stake, and 10% a week is still dear enough that it barely helps (see D42 and Q17). The trader's road is bound by cash too, but a trader can at least *hold* what it buys; a crook's bankroll is spent and settled in the same weekend. If Tony is ever the answer to anything, it is the crook.

18. **Q15 — Should the trader be able to borrow more?** The trader agent's road pays (Q2) but its trade income is 6,680 against an 8–15k row, and the binding constraint is measured: cash, not capacity or margin. The bank lends 5,000 at 3% a week and the agent now uses it; Fat Tony lends 15,000 at 10% and it does not. A road financed on Tony's terms is a different and more interesting game than one financed on the bank's, and it is the sort of thing §13's phase could price properly.

19. ~~**Q17 — Can a road whose edge is a percentage ever be a third road, while the bankroll is a racing stable's working capital?**~~ — **answered: yes, provided the road is not also a standing charge (D45).** The two honest moves were a Fixer who is not a weekly wage or a bankroll that is not working capital. Jesse chose the first, and it was the whole of it: the fee, the fine, the catch rate and the stake ceiling are all still the numbers Phase D swept, and the same ablation on the same seeds goes from **−3,498 to +6,061**. So the bankroll was never the binding half — **the standing charge was**, and a percentage edge can carry a *price list* on the two or three weekends a season it is worth paying. What the bankroll still decides is the *size* of the burst: the break-evens sit at 4,800–5,400 against the ~3,000 a stable carries spare and the 8,000 a borrowed bank reaches, which is why §20 Q15's shark is the crook's lender and not the trader's.

20. **Q16 — Is the Prime trainer too strong when it lands early?** `--pups` reads a pup reaching par at **week 4** with a Prime trainer and plain kibble, against week 8 with a Rough one. That is a big lever, and with Prime feed on top it is bigger. `leadConversion` says the Prime tier is not amplifying the leader (Q3), so the guards are holding *in aggregate* — but a Prime trainer hired in week 2 by a stable that then buys a pup is a specific line the aggregate may be hiding. Worth a probe rather than a change.

## 21. The v2 list — what is deliberately out

This list exists to keep things out. An idea that has not earned a place in one of the four phases goes here.

- Breeding, bloodlines, stud fees.
- Reputation as a mechanic.
- A fifth stat, or a fifth stat feed (§8.2).
- Throwing your own races as a supported action (§13).
- Multi-season careers, dog retirement ceremonies, hall of fame.
- Sponsors as a system rather than an event.
- Weather, going, track bias as separate systems.
- A stacking penalty for staff (§8.3) — only if measurement demands it.
- Lay betting / betting exchanges. Tempting for the crook's road, and a whole second market to balance.
