# V2 Phase E build notes — make the roads real (14 September 2026)

**Status: Phase E complete, tagged `v2e`.** Seven commits on `main` after `ae95cd5`, **not pushed**
— the bundle and the commands are at the end.

The golden snapshot moved **once**, not twice. The budget was two; nothing measured this phase
demanded a balance number move, so nothing moved one.

| | |
|---|---|
| `1cd0e73` | Item 0: say which road the player walked, and what it paid |
| `9d5701b` | **The Fixer stops being a weekly wage — snapshot move 1** |
| `73f51a8` | Diagnose mixability before changing it, then change the agent |
| `ba6a186` | Hard was using two different rulers *(the +2.5 claim in this message is wrong; see the next commit)* |
| `66a4eda` | Pay the two instrument debts: tag the crate, bound apLoss |
| `58fa567` | **Correct the Hard ablation: it was run at the wrong table** |
| *(this one)* | GDD 0.7, BUILD_PLAN, the decision log and these notes |

`npm test` is 22 green at every commit. `determinism.test.ts` needed no changes; `properties.test.ts`
gained four invariants and edited none.

---

## ⚠️ Read this before the numbers: there was no playtest, and there still is not one

Every phase prompt before this one opened with Jesse's sentence after playing the previous build,
and three times running that sentence was the most load-bearing thing in the document. Phase D was
not played, and Phase E was built without it. **`v2e` is two phases of unplayed change.**

What that cost, stated rather than hidden: the harness decides what a thing is *worth* and has never
once decided whether a thing *reads*. Every legibility finding in this project — §8.4's supplement,
the feed counter, the click budget — came from a season a human played. So nothing in this phase was
changed on a hunch about how something feels, and the experience questions are all still open. They
are at the end, and there are nine of them now rather than five.

---

## ⚠️ The headline: §13 pays, and the whole of it was the shape of one hire

Phase D built the crook's road, priced it correctly, swept every knob inside it, and measured it as
a **3,498-Bone mistake**. D42 named the thing eating it in one line: *a Fixer is charged every week
and used about twice a season, against a gross of about 840 a fix.*

Phase E took the wage away and changed nothing else. The fee, the fine, the catch rate, the stake
ceiling and the sabotage's −25 fitness are all still the numbers Phase D swept. What changed is that
the Fixer is **not staff**. He is one man at the far table of whatever planet you are on this
weekend, at one grade, and you hire him **for the job**.

Same ablation, same agent, the same 250 seasons, now behind `--crookAblation`:

| crook | mean | p10 | p90 | betting | fixing | jobs | caught |
|---|---|---|---|---|---|---|---|
| the road worked | **39,630** | 3,912 | 101,312 | **+7,938** | −2,426 | 1.6 | 52.1% |
| §13 ablated | 33,568 | 16,348 | 54,678 | −891 | 0 | 0.0 | 0.0% |

**+6,061 instead of −3,498 — a swing of about 9,500 Bones from a change of shape rather than of
price.** Three things inside that are worth more than the headline.

**The punishment tail survived.** The p10 still collapses, 16,348 → 3,912. The worry with making a
road pay is that you make it safe, and §2.1's crook column asks for "high variance, with a
punishment tail". It is still there and it is still severe.

**Betting is the crook's second income line now**, not a rounding error and not merely positive:
+7,938 against the road's −2,426 of fees and fines. §10 has said since v1 that betting "is only a
road because §13 manufactures the knowledge that makes it positive". That sentence is now a
measurement with a margin on it.

**The ablation itself got cleaner.** Switching the road off used to switch off a *wage* as well, so
D42's control was a slightly richer stable for a reason that had nothing to do with §13. With no
wage to remove, the two arms differ in exactly the jobs.

### The price list, and where the three multipliers came from

A job costs the fee on the row times the man's grade: **×1.0 Rough, ×1.5 Proper, ×2.0 Prime**. These
are the only new numbers in the phase and they were derived rather than swept, from the same
break-even the deterrent was sized against — `S × (edge − fineStakeMult × catch) − fee − fineBase ×
catch`:

| grade | fee | caught | fixed cost | % of the stake | break-even at a 27% edge |
|---|---|---|---|---|---|
| Rough | 500 | 37.5% | 950 | 9.4% | **5,391** |
| Proper | 750 | 25.0% | 1,050 | 6.3% | **5,061** |
| Prime | 1,000 | 12.5% | 1,150 | 3.1% | **4,817** |

Chosen so the three break even at roughly the **same stake**, which makes the grade a choice about
*variance* rather than a ladder of whether the road pays at all. The careful man is dearer per job
and marginally better per Bone; what he really buys is a smaller chance of the **season ban**, which
is the half of the deterrent that grows with use.

And all three break-evens sit **above** the ~3,000 a racing stable carries spare and **below** the
8,000 flat ceiling a borrowed bankroll reaches. That is §2.1's crook column in one line — *in
bursts, at the biggest races* — and it is the shape a wage cannot make, because a wage is charged in
the quiet weeks too.

### The two things this forced the design to say out loud

**D11 gets a named exception, and the replacement guard is stronger.** D11's second guard is *"Prime
staff are a weekly wage, not a purchase"*, so the top tier is a liability when the run ends rather
than an "I have already won" button. It cannot apply to a man who is not on the books. What replaces
it: **a Prime job is paid every time**, so a leader who wants the careful man buys him again on
every race he fixes and can never bank him — a wage at least gets cheaper the more you use it. The
ladder itself is untouched, because the *job* carries the tier: the grade sets the price and the
catch multiplier, and a planet-week offers one man at one grade, so D41's "you cannot buy the good
one everywhere" survives intact.

**The season ban got simpler rather than harder**, which is the one thing the brief hoped for and
the only prediction in it that came out cleanly. Being struck off used to mean "your fixer is gone
*and* you may not take another on", which needed a flag *and* a staff list to empty. There are no
books now, so `flags.fixerBarred` is the whole of it — and `properties.test.ts` can assert the
stronger statement it could not make before: **no job was ever bought after the enquiry that barred
the stable**, anywhere, for the rest of the season.

### ⚠️ And the availability question the brief asked

D41 moved a crook from a working fixer in 30% of its weeks to 67% by making the ladder a ladder of a
number, and the brief asked what a per-job hire does to that, because a hire *persists* and a job
does not. It is a real cut: a man is about on 45% of planet-weeks plus Lagrange Lows' guarantee, so
the road is open about **half** the weeks rather than two thirds of them. It was given its own
balance row (`fixerHereChance`) rather than sharing `staffAppearChance`, so the two can move
independently — and it was **not raised**, because the road pays at 45% and raising a number to fix
a problem the measurement does not show is how a design drifts. The crook places **1.6 jobs a
season**, which is §2.1's "in bursts" and not a starved road.

---

## The second finding: the roads mix, and no rule had to change

D43 measured §2.1's promise for the first time and found a mixed stable **28% behind** the trainer.
It named three suspects — three roads competing for three staff slots, one kennel's cash, one week's
attention — and settled between them not at all.

`--mixability` relaxes each on its own, same seeds, 400 seasons, with the control row that makes the
cash suspect mean anything:

| row | mean | p10 | p90 | against the trainer |
|---|---|---|---|---|
| mixed, Phase D's intensities | 32,148 | 6,447 | 66,860 | +1.6% |
| + a fourth staff slot | **32,148** | 6,447 | 66,860 | +1.6% |
| + twice the starting cash | 44,163 | 9,944 | 100,875 | +39.5% |
| + every road at full intensity | 34,185 | 6,921 | 74,947 | +8.0% |
| trainer (the bar) | 31,651 | 8,033 | 68,976 | 0.0% |
| *(control)* trainer + twice the cash | 41,304 | 16,273 | 81,636 | +30.5% |

**The slot row is identical to the Bone.** Not small — *zero*. A mixed stable never fills three slots
even when it is offered four, so a suspect that had been sitting in the decision log as a plausible
cause turns out to be nothing at all, and one line of measurement retires it.

**The cash row is mostly compound interest**, and without the control it would have been the
phase's wrong conclusion. Doubling the bankroll lifts the mixed stable 37.4% and the trainer 30.5%.
Seven points of differential is not nothing, but it is not a 28% gap either, and "cash binds a mixed
stable" would have been a finding about arithmetic on money rather than about mixing.

What is left is **attention**, worth +6.3% — and the Fixer's wage, which is why the first row is
already *ahead* of the trainer rather than 28% behind it. Phase D's mixed agent wanted a trainer, a
fixer and a trader: three slots, three wages, one of them for a road it worked 0.8 times a season.

⚠️ **So D43 was a wage plus a badly written agent, and no rule needed to change. That is the best
possible outcome and it is worth saying loudly.** The mixed agent now plays each road at the
intensity the single-road agent plays it — the trainer's pups and feed, the trader's hold and spread
— and fixes opportunistically, which costs it no slot at all.

`--roads`, 400 seasons, two stables of each agent in the same seasons:

| agent | mean | p10 | p90 | p90/p10 | prize | trade | bet | fixing | jobs | caught | win |
|---|---|---|---|---|---|---|---|---|---|---|---|
| trainer | 32,526 | 7,082 | 70,454 | 9.9 | 34,241 | 1,041 | 0 | 0 | 0.0 | — | 12.6% |
| trader | 33,758 | 10,964 | 61,795 | **5.6** | 24,746 | 7,720 | 0 | 0 | 0.0 | — | 9.6% |
| crook | 33,529 | 4,742 | 87,861 | **18.5** | 27,482 | 1,657 | 3,203 | −2,269 | 1.5 | 49.4% | 11.3% |
| **mixed** | **36,598** | 5,917 | 79,934 | 13.5 | 36,510 | 3,381 | 1,439 | −1,017 | 0.7 | 23.8% | **16.5%** |

**3.8% apart** against a 15% target — the closest the three roads have ever been — and the mixed
stable above the best single road. The spread row is §2.1's own column read back: the crook widest,
the trader narrowest.

---

## ⚠️ The third finding is negative, and it is the one I nearly got wrong

Hard beats Normal **57.8%** against a 63–68% band, the sixth phase running: 60.6 (v1) → 56.8 (A) →
53.9 (B) → 58.6 (C) → 57.7 (D) → **57.8 (E)**.

The record says the only thing that has ever moved it is *removing a bad decision* — D30's "hire
less" recovered 4.7 points, both of Phase D's additions lost — so the phase ablated six of Hard's
own decisions rather than inventing a seventh.

### The mistake, first, because it is the more useful half

I built `--hardAblation` as **three Hard against three Normal**, found that repairing an asymmetry
in Hard's own arithmetic was worth **+2.5 points**, wrote it up, and committed it as a result.

It is not a result. At the **standing table** — easy, normal ×3, hard ×2, the configuration every
"hard beats normal" number in this project has ever been quoted from — the same repair reads
**−0.2**, which is noise. The rig also reads Hard a full point weaker than the standing measure
does at baseline (56.8 against 58.0), so it is not a cleaner version of the same question; it is a
different question.

**A head-to-head is a property of the table it is played at.** That belongs in the decision log
(D49) more than the repair does, because it is the sort of error that produces a number nobody can
undo later — which is exactly what this phase's brief warned about, and I walked into it anyway.

### The table, re-run where it belongs — 800 seasons, the standing table

| row | beats Normal | Hard mean | p10 | Normal mean |
|---|---|---|---|---|
| as built | **58.0%** | 40,997 | 9,783 | 29,928 |
| rates its dogs like Normal | 57.8% | 40,509 | 9,511 | 30,282 |
| one ruler: stats on both sides | 57.8% | 40,920 | 9,649 | 30,135 |
| does not hold for a Major | **55.9%** | 40,362 | 9,873 | 30,623 |
| never throws the cheap race | 57.9% | 41,493 | 9,572 | 30,112 |
| does not sell before the tick | **56.1%** | 40,271 | 9,261 | 30,729 |
| works §13 per job | **53.6%** | 37,670 | 10,461 | 31,274 |

Standard error about 1.8 points at 800 seasons.

**None of Hard's decisions is a bad one.** Two are load-bearing: holding the best dog out the week
before a Major is worth **2.1 points** and selling before the age tick **1.9**, and both would have
been quietly deleted by a phase that went looking for things to remove and found them. The rest are
inside the error.

So the phase's contribution to the most-missed number in the project is: **there is nothing left on
this list to take away, and whatever keeps Hard off 63–68% is not a decision it makes badly.** That
is worth more than another two points would have been, because it closes off a direction six phases
have been probing.

**Hard working §13 per job is worse by 4.4 points**, which is Phase D's third-slot rejection
confirmed from a direction that removes its explanation: there is no slot cost any more, and it is
*still* worse. `HARD_KNOBS.worksTheFix` stays off with the table in its comment. Note the p10 goes
*up* (10,461 against 9,783) — Hard fixing trades a floor for a ceiling it does not need, because a
stable that already earns well from purses is the one with the least use for a percentage edge.

### The one repair that was kept anyway

`effectiveRating` says a well-drilled dog is quietly better than its public number, and Hard has
acted on it since M4. `expectedField` never took a ruler, so every *rival* was rated by the public
number. Hard has therefore been comparing a generous estimate of itself against a plain estimate of
the field, and systematically thinking it was more likely to win than it was.

That is arithmetic with two different rulers, not an edge over the bookie, and it is repaired — on
**correctness**, not on measurement. Its comment says so, rather than claiming the +2.5 that only
exists at one table.

---

## The four unexamined targets, decided in writing

The standing instruction: *a target missed five phases running is either a broken game or a wrong
number, and this phase's job is to say which, with the arithmetic, before tuning toward it.*

### Races per dog — 5.1 against 7–9. **The band was wrong. Adopted 5–6 (D50).**

The identity, both halves measured this phase rather than assumed: a stable enters **1.97** of the
weekend's three races and owns **4.98** distinct dogs across a season.

    1.97 × 13 ÷ 4.98 = 5.14

which is the figure, to the second decimal. So it is not a symptom; it is arithmetic on two numbers
the design chose on purpose.

Reaching 7 needs **entries above 2.68 of three**, or **fewer than 3.7 distinct dogs**. The first is
unreachable while §5.7's fitness binds — §6.3's probe says a broad five-dog stable is *eligible* for
all three races 76.3% of weeks and a real season fills all three **23.3%** of them, so eligibility
is not what is stopping it — and the second contradicts §5.6's pup problem and §8.5's market being a
road worth walking. Both are things this design pushes the other way, which is what a wrong target
looks like. **Band adopted: 5–6.** The game meets it.

### The broad-stable band — 76.3% against 55–70%. **Deliberately left alone (D50's neighbour).**

Nobody can re-derive 55–70, and I am not going to move a number this phase missed without one. What
Phase E *can* say is that the band is in **tension with the races-per-dog band**, and the mechanism
is arithmetic: eligibility is a **ceiling**, fitness is what binds under it, and a real season turns
a 76.3% ceiling into all three filled 23.3% of weeks and 1.97 entries a weekend. Tightening
eligibility toward 55–70% pulls the season fill rate down with it, and `races/dog = entries × 13 ÷
dogs` — so *meeting* this band pushes the other one further out of reach.

Two targets cannot both be right when one is the ceiling of the other. Nothing moved; what is
recorded is that the row carrying the design intent is the **season fill rate**, not the probe.

### Careless bankruptcy — 3.6%, and the band is a band of the wrong quantity (D51)

Phase D read 4.0% at 400 seasons and called it a near-miss inside one standard error. At **1,600**
seasons it reads **3.6% ± 0.5**, which is three standard errors outside the 5–10% band: a real miss,
not noise. Settling the noise before arguing about the band was the cheapest thing in this phase.

Then the more useful half. `bankruptRate` reads `flags.bankrupt`, which fires only when `endTurn`'s
whole cascade fails in one week — Fat Tony covers the shortfall, then repossesses, then the cheapest
dogs are sold, *then* you are bust. A stable can grind down to nothing across thirteen weeks without
ever having the week where all of that fails. Measured directly, same 1,600 seasons:

| careless stables | |
|---|---|
| `flags.bankrupt` set | **3.6%** |
| ended on nothing or less | **15.7%** |
| ended under 2,000 | 24.4% |

**§7.5's intent — carelessness ruins you — is met several times over.** D6 asked "is the bankruptcy
rate 5–10%" and the band has been read against a cascade measure ever since. The band's numbers are
left alone because nothing re-derives them; what changed is what BUILD_PLAN says it is a band *of*,
and the ruin row is now reported beside it. ⚠️ Note the ruin row is *above* the band's top, so if
anyone ever does re-derive 5–10%, the answer may be that the flag is too forgiving rather than that
the game is too kind — and that is a change to §7.5's cascade, which is a rule and out of this
phase's scope.

### The spread row — corrected (D53)

BUILD_PLAN has said "the trainer narrowest" since before anything was measured. Phase C measured the
opposite, Phase D measured the opposite, and Phase E measures the opposite a third time: crook
**18.5**, trainer 9.9, trader **5.6**. The row now reads *the crook widest, the trader narrowest*
and is met.

---

## The instrument debts, both paid

### `infoROI` — repaired, and the repair is a lesson about measures (D44)

It read −65 a leg for two phases: covered legs *worse* than uncovered ones. A "leg" was week w's
sales against week w−1's purchases, and a hold does not turn over neatly every week — an informed
stable buys deeper and holds longer, so its purchases and sales fell in different buckets more often
than a blind one's, and the split quietly compared two different things.

A crate now carries the week it was bought and whether the stable could see past the free horizon
**at that moment**, and a sale is matched against the oldest crates first. Two further errors of the
same family surfaced on the way, and both are worth recording because they are the same mistake:

1. `informedAtWeek` is written at `endTurn`, **after** the planet phase the buying happens in, so a
   crate tagged from it carries last week's answer. The old leg measure read `seen[w − 1]` and was
   correct by accident of being a week behind. The tag is now asked of the stable at the moment of
   purchase — and it counts a **dossier** bought that week as well as a Tipster, which is half the
   information economy §9.3 describes and was never in the measure at all.
2. The first working version reported season **totals**, which are dominated by volume: a stable is
   informed for a few weeks and blind for the rest, so the blind bucket holds far more crates and
   wins any comparison of totals whatever the information was worth. It reports **per crate**.

| trader, 200 seasons | crates | per crate |
|---|---|---|
| bought informed | 4.8 | **126.5** |
| bought blind | 42.3 | **124.2** |

+2.3 a crate against a 124 margin, over 4.8 crates a season, against **2,357** spent looking ahead:
`infoROI` **0.00**. So the sign is no longer wrong, and the answer is that **information is not
currently paying for itself on the trader's road** — because of how few crates it covers rather than
because of what it does to them. A real finding where there was a broken one, and a candidate lever
for whoever picks up §9.2 next: the Tipster is held for too few weeks to cover enough of the hold.

⚠️ **It lives in the harness, not on the crate.** The brief suggested a field on the hold. The
harness applies every action itself, so it already knows the week, the price and the units of every
purchase; a state field would be the second copy of a fact D36 exists to keep out, and would move
the golden snapshot to build an instrument.

### `apLoss` — retired as a debt, replaced with a bound (D48)

§7a.3 asks for two rollouts "on the same downstream seed" and `GameState` carries one linear rng
stream, so the instant the forced plan consumes a different number of draws the rest of the season is
a different random season.

Both rollouts are now re-anchored to `hash(seed, week)` at each week boundary, which cancels the part
of the difference that is pure draw-mismatch. **sd 20,041 → 17,810** — a 13% cut and nothing like
enough on its own. What it buys is that the mean stops wandering: Phase D read −1,047 at 568
rollouts; this reads **−54 at 2,488, standard error 357**.

So the measure is quotable as an **interval**: one week of naive play costs **less than ±714 Bones**
on a ~32,000 season, under 2.2%. That is not a broken instrument — it is the game saying a single
week out of thirteen is worth very little at season end, which is the same shape as §20 Q12, where
the season is decided by compounding rather than by any one weekend.

A point estimate would need the engine to key its randomness by event rather than by sequence: a
rebalance of every number in the game to sharpen one measure. **Declined, in writing**, rather than
carried into a fourth phase as "still unbuilt".

---

## `oddsScale` — settled at 15.5, on the profile that was missing (D52)

Q4 left 15.5 against a least-squares best fit of 15.75, with the error profile at 15.75 never
printed. Printed, across ratings 35–75:

| oddsScale | errors (model − sim) | worst | rms |
|---|---|---|---|
| 15.25 | +1.0 +1.3 −0.1 −0.3 +0.5 +2.7 | 2.7 | 1.31 |
| **15.50** | +1.0 +1.4 −0.1 −0.5 −0.4 **+1.9** | 1.9 | 1.08 |
| 15.75 | +1.1 +1.4 −0.1 −0.7 **−1.3** +1.2 | **1.4** | **1.06** |
| 16.00 | +1.1 +1.5 −0.1 −0.9 −2.1 +0.4 | 2.1 | 1.21 |

On symmetric error 15.75 wins on both criteria — worst case 1.4 against 1.9, and a hair better rms.
It loses on the criterion §20 Q4 actually names. The danger is the **overlay**: the bookie
*under*-rating a dog and leaving standing free money (at 17.5 the gap was 8.4 points at rating 65,
"free money for anyone who noticed"). The largest overlay anywhere in the range is **0.5 points at
15.5 against 1.3 at 15.75**, and at 15.75 it sits at rating 65, which is where stables actually
race. Against a 15% margin neither is dangerous; the design's own criterion picks 15.5.

**Settled, not carried.** No third phase of "worth a look if anything else moves the sim".

---

## The full re-baseline

`npm run harness -- --seasons 800`, all Normal:

| | Phase D (`v2d`) | Phase E (`v2e`) |
|---|---|---|
| mean end worth | 32,543 | **32,543** |
| p10 / p50 / p90 | 8,582 / 26,323 / 68,646 | 8,582 / 26,323 / 68,646 |
| prize / trade / betting / costs | 33,632 / +1,893 / −849 / 24,119 | identical |
| prize share of gross | 78.2% | 78.2% |
| bankruptcy, Normal | 0.1% | 0.1% |
| fitness at declaration | 71.5, 19.8% under 60 | 71.5, 19.8% under 60 |
| races per dog | 5.1 | 5.1 *(band now 5–6 — MET)* |
| dogs at week 13 | 3.83 | 3.83 |
| purse share to players | 53.8% | 53.8% |
| concentration, champion | 0.278 | 0.278 |
| decided by week | 6.7 | 6.7 |
| autoplan% | 8.8% | 8.9% |
| hub-clicks | 14.3 | **14.1** |

⚠️ **Identical, to the Bone, and that is the point rather than a coincidence.** The golden season
changed only in the dog **ids** — `rollStaff` no longer allocates a staff id for a fixer, so the id
counter shifted — and every race result, margin, cash figure and net worth in it is unchanged. The
reason is simple once seen: **Normal never hired a fixer.** `DEFAULT_WANT` is trainer and vet, so a
season in which nobody works §13 is a season D45 could not touch. The hub-clicks drop is the Saloon
no longer flagging a hire that no longer exists.

Head to head, `--ai easy,normal,normal,hard,hard,normal`, 800 seasons: **Normal beats Easy 81.0%**,
**Hard beats Normal 57.8%**, Hard beats Easy 84.9%. Means: Easy 11,360, Normal 30,135, Hard 40,920.

`--calibrate`: a balanced 65 beats seven 50s **57.4%**, unmoved — nothing this phase touched the race
model. `oddsScale` stays 15.5 (D52).

`--stats`: **24.6 / 18.8 / 15.9 / 15.1**, all in band and in rating-weight order, trap peaking on
tight bends (16.1 against 15.1).

`--pups`: Rough trainer reaches par at week 8, Proper week 6, Prime week 4. Unmoved (Q16 stays open).

`--card`: unmoved. Broad five-dog 76.3%, broad three-dog 46.8%, one-good-dog 10.3%.

`--stacking`, 300 seasons: trainer 53.7%, vet 51.2%, trader 50.3%, scout 52.6%, tipster 51.0% — every
role inside D7's 45–55% band, so §21's "a stacking penalty only if measurement demands one" stands
for a third phase.

`--holdPayback`, 400 seasons: the first upgrade returns **1,409 against 1,400 paid** — MET — and the
marginal column still falls away sharply (479, 859, then −256 with no cap). §20 Q6's shape holds.

`--fix`, 150 seasons, 5,850 locked fields: own runner **23.2%** mean edge, best price left **27.4%**,
at a Major **33.1%** — all unmoved, as they should be, since the race model did not change.

`--ai careless,normal,normal,normal`, 1,600 seasons: flag **3.6%**, ruined **15.7%** (D51).

`--roads` and `--crookAblation` and `--mixability`: the tables above.

---

## Verification

| | |
|---|---|
| `npm test` | **22 green**, golden snapshot moved **once** and no more |
| `npm run lint` | clean |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seasons + the toggle variant, all to week 13, no `ActionError`, every log replays byte-identical. **7 jobs, 4 enquiries, 4 bans** — and the run fails if any of the three is zero |
| `race-view-check.ts` | 195 races, every one replay-identical, 5 photo finishes |
| `hub-clicks.ts 25` | **14.1** a weekend (budget 14.5) |
| golden snapshot | `b2c3a3fd…` → (the Fixer) → `594c5a55…` |

`properties.test.ts` gained four invariants and edited none: no fixer is on anybody's books; no job
was bought after the enquiry that barred the stable, and every caught stable is barred; every job's
fee is the price list's answer for the grade that took it, and a fine only exists on a job the
stewards noticed; the archive holds no job from the current week, so the split cannot double-count.

---

## Carried forward

- **Hard beats Normal 57.8% against 63–68%, and there is no bad decision left to remove** (D49).
  Six phases. The next idea has to come from somewhere other than "what does Hard do that Normal
  does not".
- **A broad five-dog stable fills all three 76.3% against 55–70%**, deliberately untouched, with the
  tension against races per dog written down (D50).
- **`bankruptRate` is a cascade measure**: the flag fires 3.6%, ruin is 15.7%. If anyone re-derives
  5–10%, the lever is §7.5's cascade, which is a rule (D51).
- **`infoROI` is 0.00 and the reason is coverage**, not margin: information improves a crate by 2.3
  Bones and reaches 4.8 crates a season against 2,357 spent (D44). A lever for whoever picks up §9.2.
- **`apLoss` is a bound, not a figure**, and that is now its permanent state unless the engine's
  randomness is ever keyed by event (D48).
- **The trader's trade income is 7,720** against BUILD_PLAN's 8–15k row — much closer than Phase D's
  5,511, and still short.
- **Q16**: a Prime trainer reaches par with a pup at week 4 against a Rough trainer's week 8.
  `leadConversion` says the tier is not amplifying the leader in aggregate. Still a probe, not a
  change.
- **Veterans coverage 30.2%**, essentially unchanged since Phase B.
- **The "told who did it" half of §13's penalty** is logged and inert until M6 (D40). Unchanged.
- **The championship purse is paid and nobody knows whether it is noticed.** An experience question,
  and it is on the checklist below for the second phase running.

---

## To push

Same as A through D: the commits are real but they live in a clone in Anthropic's cloud, because the
shell into your folder still does not mount (`sandbox-helper: no Plan9 drive shares mounted`,
unchanged since 8 September). They arrive as **`phase-e.bundle`**, attached to the conversation.
Download it into the repo root, next to `package.json`.

Your `main` should be at `ae95cd5` with a clean tree:

```powershell
git status                                  # expect nothing modified
git fetch phase-e.bundle "refs/heads/main:refs/heads/phase-e" "refs/tags/v2e:refs/tags/v2e"
git merge --ff-only phase-e                 # fast-forwards main onto the seven commits
git branch -d phase-e
git log --oneline -1
```

Then check it is what these notes describe, and push:

```powershell
npm test                                    # 22 green
npm run build                               # -> packages/web/dist
npm run harness -- --seasons 200            # mean ~32,500
npm run harness -- --crookAblation --seasons 250      # the road, on and off
npm run harness -- --seasons 200 --ai trainer,trader,crook,mixed,trainer,trader,crook,mixed
npx tsx packages/web/scripts/season-check.ts
npm run dev                                 # and go and play a season — see below

git push origin main
git push origin --tags
del phase-e.bundle
```

**`package-lock.json` is untouched, so no reinstall.** Cloudflare Pages will build the push on Node
20; nothing added needs anything newer.

Three smaller things:

- **The commits are authored `Claude <noreply@anthropic.com>`**, set before the first commit. Your
  `Co-Authored-By` trailers are on every message.
- **`design/space_dog_racing_economy.xlsx` changed** and `balance.json` was regenerated from it with
  `npm run balance` — the JSON was never hand-edited. The Assumptions sheet gained **four rows**
  (the Fixer's three job-price multipliers and his own appearance chance) and nothing was
  superseded. `packages/engine/scripts/add-phase-e-rows.ts` is the record of what was added.
- **A `v2d` save will not load.** `STATE_VERSION` is 6: the planet carries a fixer, every fix
  carries the man and his grade, and the season carries a `fixArchive`. A Phase D action log could
  not replay anyway — it can contain `HireStaff` naming a fixer, and nothing here would know what to
  do with one.

---

## ⚠️ What to play for — the checklist for **two** unplayed phases

Phase D was never played and Phase E was built on the harness alone. So this is D's five questions
and E's four, and the D ones come first because they are older and because two of them are about
things E has now changed underneath them.

**From Phase D, still unanswered:**

1. **Was the temptation to cheat legible?** Open the Bookie with a stake dialled in, where a fixer is
   about. The counter under the odds tells you, in Bones, what nobbling the favourite is worth on the
   money you have on, what the stewards cost you if they notice, and the stake at which it stops
   losing. Does that read as an **offer you are weighing**, or as **arithmetic being done at you**?
2. **Buy a box at a Major, and then at a small meeting.** It should be obviously worth it at one and
   obviously not at the other — and on the Void Derby's straight it should tell you to keep your
   money.
3. **Get caught.** The fine, the man struck off, the line naming you in front of the whole table. Is
   that "fair enough", or does it feel like the game punishing you for walking a road it offered you?
4. **Was the championship ever noticed before week 13?** Points accrue all season and pay at the
   Collar. Did you ever put a dog in a race because of them?
5. **Did any week present a choice you had to think about?** (§7's standing question, every phase.)

**From Phase E, new:**

6. **⚠️ Does hiring a fixer for one job read as a decision, where a weekly wage read as a
   commitment?** This is the phase's central question and the harness cannot touch it. The wage was a
   thing you signed up to and then felt every week; the price list is a thing you walk past on most
   planets and buy on two. Does the road feel like something you *choose* on the weekend it matters —
   or does it feel like it has stopped being a road at all, because there is nothing to commit to?
7. **Does the far table read, on the planets where there is nobody at it?** He is about on roughly
   half of planet-weeks. Is "nobody here knows a steward worth knowing" a piece of texture you notice
   and price, or a panel you stop reading?
8. **Does a stable that spreads across roads feel punished?** The harness says it is not — a mixed
   stable now ends above the best single road. But "as rich as one that commits" and "as interesting
   as one that commits" are different sentences, and only a season answers the second. If spreading
   is now both richer *and* safer, the design may have lost a decision rather than gained one.
9. **Does the Season End screen make you see which road you actually walked?** It prints prize,
   trading, betting, fixing and costs for every stable. After an hour of small decisions, does the
   line about *you* match the story you thought you were in? That mismatch — if there is one — is the
   most useful sentence you can bring back, because it is the one thing in this phase that was built
   for the playtest rather than for the harness.

⚠️ And the standing warning, sharper than usual this time: **five of the acceptance rows flipped from
missed to met this phase and not one of them was checked by a human.** A road that measures well and
plays badly is exactly what §8.4's supplement was, and the supplement measured fine too.
