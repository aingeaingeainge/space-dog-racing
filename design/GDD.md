# Space Dog Racing — Game Design Document

**Working title:** Space Dog Racing
**Version:** 0.2 — 11 September 2026 (v1 shipped at tag `m4`, 9 September 2026)
**Author:** Jesse Colbert, with Claude as design partner
**Status:** v2 design. ⚖️ marks a tunable that lives in `space_dog_racing_economy.xlsx`; ❓ marks an open decision; **[measured]** marks a number this design was tested against and **[estimate]** one that is a starting point for the phase that builds it.

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

**The championship purse.** Points accrue from race finishes all season and are paid out once, at the Galactic Collar, as prize money. It is a purse, not a scoreboard: it rewards racing breadth, which is the trainer's road only, so it is deliberately modest — **12,000 / 6,000 / 3,000 to the top three on points [estimate]**, about 6% of a champion's end worth. Points **10 / 6 / 3 / 1** for the first four home in any race [estimate].

## 5. Dogs

### 5.1 Stats (all 1–99, visible)

| Stat | Race effect | Marginal worth **[measured]** |
|---|---|---|
| **Speed** | Top speed. | +10 → win rate 13.3% → **23.0%** |
| **Stamina** | How late the dog fades; best on 600 m. | +10 → **20.4%**, and 21.0% on a stayer |
| **Acceleration** | How fast it reaches top speed; best on 350 m. | +10 → **15.8%**, and 17.6% on a sprint |
| **Trap** | Break out of the boxes and bend craft. | +10 → **14.4%**, and 15.3% on tight bends |

Rating weights: `0.40 speed + 0.20 accel + 0.25 stamina + 0.15 trap`, then adjusted by results (§5.3).

⚠️ **Those figures are the v2 targets, not v1's behaviour, and they require the §6.2 rebalance.** On v1's constants the same test gives speed 27.6%, stamina 17.9%, accel 14.6% and **trap 11.6% — worse than not feeding at all**, at every track length. Four stat feeds on v1's race sim would be one good and three traps, so §8.2's goods depend on §6.2 shipping first. This is the single most load-bearing dependency in the v2 plan.

### 5.2 Condition

- **Fitness 0–100.** Multiplies every stat: `fitScale = 0.90 + 0.10 × fitness/100` ⚖️.
  ⚠️ **This is a deliberate softening, and it is the fix for "fitness never bites".** v1 used `0.80 + 0.20 × fitness/100`, which sounds gentler and is savage: at equal ratings a dog at 90 fitness wins 13.0%, at 80 wins 7.0%, at 70 wins 3.0% and at 60 wins 1.3% **[measured]**. The whole meaningful range was 85–100, which is precisely why nothing ever fell to the threshold — there was no room to fall. Flattened to `0.90 + 0.10`, the curve reads across the range a player can actually reach: 100 → 26.1%, 80 → 16.6%, 60 → 8.8%, 40 → 5.4% **[measured]**. *Then* the weekly swings can be large enough to see.
- **Weekly fitness by state** (§5.7): **Race −25, Train +8, Rest +30** ⚖️ **[estimate, sized against the curve above]**. A dog racing two weeks in three holds station; three weeks running does not. Over 13 weeks a dog can take about **8 races**, which is why a 3-race card wants **5 dogs** to fill it (§6.4).
- **Form −10…+10.** Momentum from recent results. Decays 2/week toward 0.
- **Age 1–7 (seasons).** Age **1: +2 stat points a week; age 2: +1; ages 3–4: none; age 5+: −1** ⚖️. This is a change from v1's "+1 every second week", and it is what makes a pup visibly a pup: raising one is now a real compounding curve rather than a rounding error (§5.6). Value multiplier by age: 1.15 / 1.10 / 1.00 / 0.85 / 0.65 / 0.45 / 0.30. Age ticks once per season (week 7).
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

**Starting stable:** 3 dogs, ratings ≈ 38–48, mixed ages 2–4, **4 kennel slots**, 6,000 Bones, basic ship. Kennel slots rise to **6** at the top ship tier ⚖️.

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

**Under Race/Train/Rest, those are not calendar weeks.** A dog only gains from feed on a **Train** week, so a pup that trains 8 of 13 weeks needs **7–9 points per training week**, plus growth. That arithmetic is what sets the tier numbers in §8.2 and §8.3, and it is the trainer's road in one sentence: *a pup that has to race to pay its way arrives late or never.*

### 5.7 Race, Train or Rest

Each week, in the Kennels, every dog is set to exactly one of three states. This is the decision the two reserve slots always wanted and never got.

| State | Fitness | Stats | Money |
|---|---|---|---|
| **Race** | −25 | none | prize money, championship points, rating movement |
| **Train** | +8 | consumes one unit of feed; gains the feed's and the trainer's points | nothing, and the feed cost |
| **Rest** | +30 | none | nothing |

A dog that is injured or banned is in a fourth state, **Layoff**, which is imposed rather than chosen and does all of Rest's recovery. There is deliberately no chosen fourth state: three is the number a player can hold in their head across six dogs, and everything a fourth might do (light work, a trial) is a tier of Train.

## 6. Races

### 6.1 Race parameters

Each planet has one track: **distance** (Sprint 350 m / Standard 480 m / Staying 600 m), **bend tightness**, **surface hazard**, and a visual theme. 8 traps. Short fields are filled with local dogs drawn around each race's own level.

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

**Everything in this block is `balance.json` — no code changes.** It moves the golden snapshot once and shifts the whole economy, which is why it is Phase A's first commit and not a corner of a later one.

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
| **Consolation** | ran and finished out of the money last week | the one deliberate catch-up mechanic |

Two drawn per weekend, plus The Open. **Content is data: the eighth and ninth types are rows, not code.**

**Why facts rather than ratings.** A rating can be suppressed — that is the objection to §5.3 — but an age and a win cannot. And because the circuit is hidden (§9.3), this is not about aiming a dog at a race you can see coming. It is about keeping a stable that covers several eligibilities, which is exactly the force that kills one-dog concentration.

**Measured, and it works.** Against random draws of two types, a **broad 5-dog stable fills all three races 59% of weeks and at least two of them 97%**. A stable built around one very good dog plus fillers **fills all three 14% of the time and is down to a single race 29% of the time** — because a 72-rated 4-year-old with wins is barred from Maiden, Juvenile, Veterans, Novice and Handicap by construction, and can only enter The Open and the Invitational. Six dogs adds little over five (65% against 59%), and three dogs is clearly short (36%) **[measured]**.

**The risk to watch in playtest** is arbitrariness — not knowing next week's types is doing design work here, but the pool has to stay small and memorable enough that "keep a young one" reads as an obviously sound bet rather than a lottery.

### 6.4 Purses

⚖️ **[estimate — the harness sets these in Phase B]**

| Race | 1st / 2nd / 3rd |
|---|---|
| The Open | 4,000 / 2,000 / 1,000 |
| Each drawn type | 2,200 / 1,100 / 550 |

Majors ×2.0; the Grand Final ×3.5. Weekly base pool 14,700 against v1's 20,100 — **a deliberate 27% cut to the prize pool**, and the reason is §7.1: prize money is currently 87% of the economy, and three roughly equal roads is arithmetic rather than intent.

### 6.5 Race presentation

Unchanged from v1 and working: top-down track, camera on the pack, position ticker, commentary bar, photo-finish freeze, 1×/2×/skip. Two additions v2 requires: the commentary must be able to say **"faded — no stamina over 600"** and **"never got going"** now that those are true (§6.2), and the card header must name each race's entry criterion, since it changes weekly.

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

### 7.2 Costs (weekly)

Kennel upkeep 150/dog (half for *Cheap date*) · feed eaten 1 unit/dog (2 for *Glutton*) · fuel 250 base, +5 per cargo unit over 20 ⚖️ · **staff wages by tier: Rough 250, Proper 600, Prime 1,400** ⚖️ **[estimate]**.

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

### 8.2 Goods

**Kibble** sits below the ladder: the staple. Dogs eat it, an empty hold still costs the penalty at the gate, and it is the base trade commodity — so v1's eating and trading machinery survives untouched and everything else layers on top. A dog that **Trains** on plain kibble gains **+1–3 to a random stat**, which is the floor of improvement and why a stable that spends nothing still drifts upward very slowly.

**Feeds** are four stats × three tiers ⚖️ **[estimate]**:

| | Rough | Proper | Prime |
|---|---|---|---|
| Gain to the named stat, per Train week | +1–3 | +2–4 | +4–6 |

Price and stock by how much that stat is worth in the race sim (§5.1), so **Speed feed is dearest and scarcest at every tier** and Trap feed is the cheap one. Four stats and three grades is one concept, not twelve things, and no planet stocks more than a handful.

**Do not add a fifth stat food to make the market busier.** §8.5's busier market is served by tiers and by stock depth. The stat list is what keeps the economy legible.

**Hold or feed** is the decision this exists for, and it only bites if the good is scarce and the upgrade is worth roughly what the resale is. That balance is deliberately different per tier: **Rough feed should be obviously worth eating; Prime feed should be a genuine agony.**

### 8.3 Staff — three slots, any mix

Three slots, filled with any combination — three trainers if you like. **No stacking penalty: the cost of better staff is the gate** (§19, D7). That moves the whole balance burden onto making the roles *differently shaped*, which is the right place for it, because it is also what makes pillar 1 real.

| Role | Road | Rough | Proper | Prime |
|---|---|---|---|---|
| **Trainer** | trainer | +1 stat point per Train week | +2 | +4 |
| **Vet** | protects the asset | injury −1 week | injury halved, Rest +5 | injury halved, Rest +10, −25% injury chance |
| **Fixer** | crook | steward bribe only | bribe + sabotage | bribe + sabotage, detection halved |
| **Scout** | trainer / trader | +1 dog in every market | +2 dogs, one priced under book | +3 dogs, one under book, stats shown for pups |
| **Trader** | trader | +10 hold | +20 hold, Proper goods stocked | +30 hold, Prime goods stocked, −5% buy prices |
| **Tipster** | trader / crook | this planet's card a phase early | next week's card and food band | next *two* weeks' planets and cards |

⚖️ All **[estimate]**. Wages per §7.2. Specify, then **measure whether stacking one role dominates**; if it does, re-shape the roles. Only if that fails does a penalty go in — do not start with the penalty.

**Rarity is the point, not a side effect.** A Prime trainer appearing in week 3, in week 9, or not at all makes three different seasons out of the same seed. That is pillar 2.

### 8.4 Kennel items and the supplement

Track-day pass (+3 to one stat, 800) · Racing muzzle (+2 Trap, 600) · **Supplement** (+12 Speed for one race ⚖️, 400; 15% base chance the stewards catch it — purse forfeited, rating −5, one-week ban; 0% on Vatgrown, 30% at Cosmodrome, 40% at Old Wembley).

⚠️ The supplement is v2's cautionary tale and §13 must not repeat its shape. Because being caught forfeits the *purse*, the punishment scales with the size of the race while the benefit is a fixed speed bump — **so the supplement gets worse the bigger the race, which is exactly backwards from "tempting"** (§19, 2026-09-08).

### 8.5 A busier market

More staff on offer, more dogs, more goods per planet, everywhere. You cannot have a spending decision if there is nothing to spend on, and this is generation and data, so it is cheap.

**The cost to watch is pace.** `hub-clicks.ts` measures 13.3 decisions a weekend and that is the budget. If a busier market pushes it up, spend the difference on better summaries — `venueStatus.ts` already puts what is worth a walk on the hub's hotspots, and it was built for exactly this.

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

| Carrier | Reach | Reliability | Price ⚖️ |
|---|---|---|---|
| Saloon rumours | 1–2 weeks | can be wrong — it is a rumour | free |
| Dossier (Market) | a named planet, next week or the week after | exact | 500–800 |
| Event cards | varies | usually exact, sometimes a lie | varies |
| **Tipster** (staff) | 1–2 weeks, standing | exact | a wage |

⚠️ **Re-tune `lib/rumours.ts`.** The Saloon rumours built in M4 session 2 are currently near-redundant: they hint at food prices on planets whose bands the Galaxy Map already printed in full for the whole season. Hiding the map is what makes them do the job they were written for — and their four-week horizon will be far too generous once nothing else is visible.

## 10. Betting

Bookies open after declarations lock. **Win** and **Place**, any race, any dog, including your own. Odds = `(1 − margin) / p`, p from the bookie's rating model. Margin 15% (10% on Neon Snout; no betting on Holy Bark). Max stake per race 50% of cash ⚖️.

Betting is zero-sum minus the house, and is only a road **because §13 manufactures the knowledge that makes it positive**. See §13.

⚠️ **Max stake is a rich-get-richer channel.** The crook's edge is a *percentage*, so its cash value scales with what you can stake, which means the leader earns most from the same fixer's fee. Phase D must cap the crook's road with a flat stake ceiling as well as a fractional one ⚖️.

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
| **Cosmodrome** *(Major — The Cosmodrome Classic)* | Standard 480, wide | 80–110 | Bank; strict stewards (30%); buyers +15%; sells finished dogs |
| **Ossuary** *(Major — The Bonemeal Cup)* | Staying 600, tight, hazard ×1.5 | 80–110 | Shark; dog values +10%; *Stayer* shines |
| **Blackreach** *(Major — The Void Derby)* | Sprint 350, no bends | 90–130 | Turn order reversed; *Sprinter* paradise |
| **Collar Prime** *(Major — The Galactic Collar)* | Standard 480, medium | 90–130 | Always week 13; championship purse paid here; margin 10%, max stake 100% |
| **Kibbleton Prime** | Standard, wide | 40–60 | Cheapest; best place to load |
| **Rustgut** | Standard, tight | 110–140 | Cheap knackered dogs; rarely stocks above Rough |
| **Neon Snout** | Standard | 100–140 | Margin 10%; everything else +20% |
| **The Drift** | Sprint 350 | 70–100 | Ship upgrades −30%; *Pirates!* likelier |
| **Mudhaven** | Staying 600, hazard ×1.5, mud | 70–100 | *Mudlark* +5%; injury ×1.5; Vet for hire |
| **Glassfall** | Sprint 350, slippery | 85–120 | Acceleration matters more; food spoils without a cold store |
| **Port Slobber** | Standard | 70–100 | Every staff role for hire; 10% tax on winnings; bank |
| **Vatgrown** | Standard | 45–70 | Supplements legal; **the pup market**; always Prime pup feed |
| **Old Wembley** | Standard, classic | 70–100 | Doping catch 40%; purse +20% |
| **Hushmarket** | Standard, tight | 100–140 | Fell-off-a-ship dogs and goods at 60%; shark |
| **Sunbleach** | Standard, hazard ×1.2 | 100–130 | Fitness −5 on arrival; cheap kennel modules |
| **Tinkertown** | Sprint 350 | 70–100 | Engine upgrades −40%; muzzles |
| **Holy Bark** | Staying 600, serene | 45–70 | No betting; no upkeep; +5 fitness |
| **Lagrange Lows** | Standard, tight | 100–140 | **Fixer for hire (§13)**; shark; locals are *Nervy* |

## 13. The crook's road

⚠️ **This section is the one part of the GDD that has never existed in code.** The Fixer was withdrawn from hire in M4 session 1 because nothing read `staff.fixer` except a 350-a-week wage. He returns when this does.

- **Steward bribe** (Fixer, 800 ⚖️) — choose your dog's trap draw.
- **Sabotage** (Fixer, 1,200 ⚖️) — target one rival dog in one race: **−25 fitness for that race** ⚖️.
- **Supplement** — §8.4, unchanged.
- **Throwing a race** — stays out. Measured at exactly ±0 for the Hard AI, and deliberately losing tends to feel bad.

**Why −25 and not the −15 the first draft proposed.** Measured on a Gold-class field (my rating-58 dog, one rival at 68, six locals at 58): nobbling the rival by 15 moves his win rate 35.4% → 20.5% and mine 8.8% → 12.1%, worth +163 of purse EV against a 1,200 fee — not a strategy. At **−25** he falls to 11.6% and mine rises to 13.4%, and, crucially, **because the bookie still prices him at 68, backing my own dog at its unmoved 9.12 odds is worth +23% EV** **[measured]**.

**The money is in the bookie, not the purse** — +288 of purse EV against a betting edge that scales with the stake. That is the honest shape of the crook's road and it dictates two things: the Fixer's economics must be capped by a stake ceiling (§10), and the deterrent must be sized against the *bet*, not the race.

**Two hard constraints, or this road eats the game:**

1. **Getting caught must be severe, and must not scale with the purse.** Guaranteed information is worth a great deal and the punishment tail is the only thing holding the road in line. A fine of 3,000 at 25% detection is −750 expected against a gross of roughly +1,400 — not enough. Phase D's starting point is **detection 35% at Rough, and a penalty compounded of a fine, the Fixer barred for the rest of the season, and the wronged stable being told who did it** ⚖️.
2. **It must not be strictly better than the other two.** Measure all three against each other before it ships (§20 Q2).

All shady options are off under the **Clean Sport** toggle.

## 14. AI stables

AI plays by the same rules with no stat bonuses. Difficulty changes decision quality only.

- **Easy** — near-random declarations respecting entry criteria; never bets; buys food only when out; never hires; sells only when broke.
- **Normal** — declares to maximise `Σ P(win) × purse`; keeps a Rough or Proper trainer; **sets Race/Train/Rest by a simple fitness rule**; trades on a visible spread; bets small on favourites.
- **Hard** — as Normal, plus: prices its own dogs by `effectiveRating` rather than rating (the §5.3 edge, which any player can also see); raises a pup when the market offers a good one; **buys information when its hold is big enough to pay for it**; uses supplements where the stewards are lax; uses the Fixer when the numbers say so.

⚠️ **v2 gives every difficulty a new decision it does not have: Race/Train/Rest.** That is the AI work in Phase A, and `naive%` — the measure that made v1's balance tractable — has to be redefined around it (§20 Q11).

Each AI stable keeps its name, colour, portrait and one-line personality.

## 15. Screens

1. **Title / New season** — players, toggles, seed.
2. **Galaxy map** — ⚠️ **now a fog.** This planet in full; next week's name and Major star; the rest of the route as unknown stops. Anything bought shows here. The v1 file's own comment reads "the whole circuit is visible from week 1 so players can plan" — that is the line being deleted.
3. **Planet hub** — painted backdrop with hotspots; planet rules on a signpost; `venueStatus` hints.
4. **Kennels** — ⚠️ **the new centre of the game.** Each dog as a card with **Race / Train / Rest** as the primary control, its fitness trajectory, what feed it would eat, and what it would gain.
5. **Market** — dogs (mostly pups), feeds by tier with chevrons, items, staff by tier, dossiers.
6. **Docks** — ship, and a multi-good hold gauge with price history.
7. **Race Office** — three race cards, each naming **its entry criterion**, with your eligible dogs and everyone's declarations.
8. **Bookie** — odds, stake slider.
9. **Race view** — unchanged.
10. **Leaderboard** — cash, dogs, ship, cargo, debt, net worth, championship points, syringes.
11. **Season end** — podium, worth chart, moments, championship purse.

### 15.3 The click budget
13.3 decisions a weekend, measured. It is a budget, not a reading.

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

## 20. Open questions ❓

1. ~~Grand Final venue~~ — decided: always Collar Prime.
2. ~~Major purse share~~ — decided 2026-09-08.
3. ~~Hotseat in v1~~ — decided: yes.
4. **Q1 — How much does the §6.2 rebalance cost the rest of the economy?** Every measured number in this document below the race level was taken on v1's constants. The rebalance moves them all. Phase A's first job after the change is a full re-baseline.
5. **Q2 — Are the three roads actually equal?** Nothing measures it yet. Needs the three path agents in the rebuilt harness (BUILD_PLAN §7). §7.1's arithmetic says the gap to close is 4× on trading and 45× on betting.
6. **Q3 — Does the Prime tier amplify the runaway?** D11's guard is specified and unmeasured. Test it directly: does a stable ahead at week 6 convert a Prime offer into a bigger lead than a stable behind? If yes, the consumable/wage shapes are not strong enough.
7. **Q4 — What is the right `oddsScale` after D12?** The sim now runs hotter than the bookie at every rating. A small, deliberate, stable divergence is the crook's edge; an accidental one is a bug.
8. **Q5 — Does the fact-gated card feel arbitrary under the fog?** Measured to work structurally (§6.3); untested as an experience.
9. **Q6 — How big does the hold have to be, and how cheap the fuel, before the trader's road pays?** §9.2 names the two levers and neither is sized.
10. **Q7 — What flat stake ceiling keeps the crook's road from scaling with the leader's bankroll?** (§10)
11. **Q8 — Retirement at age 7, or decay?** Default: decay, player chooses. Veterans races (§6.3) make an old dog worth keeping for the first time, which may settle this on its own.
12. **Q9 — Reputation as a visible stat?** Default: still v2-plus.
13. **Q10 — Does the human ever see the exact bookie probability?** Default: odds only.
14. **Q11 — What replaces `naive%`?** The measure that made v1's balance tractable assumed one decision a week. With Race/Train/Rest there are up to six. BUILD_PLAN §7 proposes `autoplan%`; it is the least settled thing in the harness spec.

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
