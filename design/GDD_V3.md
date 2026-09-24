# Space Dog Racing — Game Design Document, v3

> **Status: CURRENT.** Build from this document.
>
> Canonical copy: `design/GDD_V3.md` in the `space-dog-racing` repo. A copy in a claude.ai Project
> is a **mirror**, last synced 24 September 2026 (at `v3e1`) — edit the repo, never the mirror. See `design/CANON.md`.
>
> Supersedes `design/GDD.md` (v2, shipped at tag `v2e`), which is kept as historical reference and
> is cited by name throughout this document.

**Working title:** Space Dog Racing
**Version:** 3.0 — 16 September 2026
**Author:** Jesse Colbert, with Claude as design partner
**Status:** v3 design, unbuilt. Supersedes GDD 0.7 (`design/GDD.md`, shipped through tag `v2e`).

> ⚖️ marks a tunable that belongs in `space_dog_racing_economy.xlsx` → `balance.json`.
> ❓ marks an open decision. **[estimate]** marks a number nobody has measured yet.
> **[v2 measured]** marks a number inherited from v2's harness that v3 does not invalidate.

---

## 0. What v3 is, and why it exists

v2 is a finished, correct, deeply instrumented management sim. Six phases of measurement got three
roads to a rich stable within 3.8% of each other, a crook's road that pays, a bookie that cannot be
arbitraged and a bankruptcy rate that means something. It is also **a one-player game about
arithmetic that takes an hour**, and the thing Jesse actually wants to build is a game three to
eight people play together in forty minutes and argue about afterwards.

So v3 is not a tuning pass. It is a deliberate change of genre: **from management sim to party
game.** The test every rule below is held to is no longer *does this make one of the three roads
better or more interesting to choose between* — it is:

> **Can a new player learn this in one weekend of play, and does it produce a story at the table?**

### 0.1 What that costs, stated honestly

v3 deletes four markets, the debt system, a stat, a whole staff economy and the entire crook's
road as a *purchasable* thing. A great deal of measured, working design goes in the bin, and the
arithmetic that made v2's three roads balance goes with it.

More importantly, **v3 is a much more random game than v2**, and that is a choice rather than an
accident. Count the dice: starting dogs are dealt, starting staff are dealt, new dogs arrive blind,
new staff arrive by luck, every upgrade comes from an event, the event itself is a draw, the running
style of a dog you are handed is unknown, and the race is a race. v2's pillar 4 — *luck the player
cannot respond to is noise, not design* — is the line v3 pushes hardest against, and §2 rewrites it
rather than pretending otherwise.

The compensation is that **every remaining decision has to matter more**, and §2.1 is the list of
the five that are left. If any of those five turns out to be shallow in playtest, v3 has a problem
that no amount of event content will paper over.

### 0.2 The one-paragraph summary

Three dogs, dealt. Ten race weekends a season, one to five seasons, or play until somebody is rich
enough. Each weekend you land on a planet, choose one of three places to poke around (which is where
everything unpredictable comes from), work the one market that exists — six kinds of dog food that
are simultaneously your trade goods and your training programme — decide which dogs run and which
rest, put one dog in each of three races, have a bet, and watch. Your dogs run differently from each
other and you do not start out knowing how. Richest stable wins.

---

## 1. Pillars

1. **Learnable in one weekend.** Every system is explainable in a sentence and visible on one
   screen. If a rule needs a worked example, it is the wrong rule.
2. **Luck you can price, or luck you can watch.** Randomness is allowed to be large, but it must
   either arrive as an *offer the player can evaluate and decline*, or as something entertaining to
   watch happen. Randomness that silently changes a number is out.
3. **Stories at the table.** The measure of an event, a race or a sabotage is whether anyone
   mentions it after the game. This is what replaces v2's balance-first instinct.
4. **The scoreboard is public, the future is not.** Cash, net worth and every dog's stats are open.
   Next week's prices, the card two planets out, and a dog that has never raced are not.
5. **Nobody is out before the end.** No bankruptcy, no elimination, no death spiral. A player who
   has had a terrible season must still be able to do something interesting on week 9.
6. **Forty minutes for four players.** Pace is a hard constraint, not an aspiration. Every rule
   below has been checked against it and §15.3 carries the budget.

### 1.1 The five decisions v3 has left

Everything else was cut. If these five are not deep enough, the game is not deep enough.

| | The decision | Where it lives | What makes it hard |
|---|---|---|---|
| 1 | **Which door do I open?** | Explore | Three places a week, one pick, and what you need (a dog, a trainer, money, revenge) changes weekly |
| 2 | **Buy, sell, or feed it?** | Market | The same six goods are your inventory and your training programme, and the price band tells you which |
| 3 | **Who runs, who rests?** | Kennel | Fitness is a budget spent over ten weeks with three dogs and thirty race slots |
| 4 | **Which dog in which race?** | Race Office | Three purse tiers, public declarations in turn order, and running styles that interact |
| 5 | **What do I know that the bookie doesn't?** | Bookie | The book prices ratings and styles; it does not price the shape of the field |

**Tone is unchanged from v2 §1:** Gazillionaire's pastel absurdity crossed with Death Rally's soot
and neon. Cartoonish grime. Dogs get hurt, stewards take money, nothing dies on screen.

---

## 2. The season, the game, and how it ends

### 2.1 Structure

- **10 race weekends per season** (was 13). Week 5 is a **Major** (purses ×2). Week 10 is the
  **Grand Final** at Collar Prime (purses ×3) ⚖️.
- **Game length is chosen at setup:** **1 to 5 seasons**, or **Race to a Target** — play until any
  stable's net worth passes a figure the table picks ⚖️ (suggested: 60,000 for a short game,
  150,000 for a long one).
- In Target mode, net worth is checked **at the end of every race weekend**. The first crossing
  ends the game at the end of that weekend — and the winner is the **highest net worth**, not
  necessarily the stable that crossed. Somebody can be overtaken on the line by a bet.
- **8 regular planets** drawn without replacement from the pool of 14, random order, for weeks 1–4
  and 6–9; **week 5's Major venue** drawn from the three Major venues other than Collar Prime; and
  **Collar Prime at week 10**. Ten weekends. *(This read "9 regular planets", which with the Major
  venue made eleven; Jesse confirmed 8 in v3 Phase B — A1, B9.)*
- **The circuit stays dark past next week** (v2 §9.3, kept). You know this planet completely and
  next week's planet by name only. The fog is what makes the food trade a judgement rather than a
  lookup, and it is now the *only* thing information is for.

*Built at `v3e1` (E2, E3): `SeasonSetup.length` is 1–5 seasons or a target, and no length is one
season. Target mode checks worth once, at the end of each weekend after the dinner, and caps a game
at 10 seasons (never reached in 400 games). ⚠️ **Because worth is checked once, the richest stable at
the check has always crossed too**, so "not necessarily the stable that crossed" can only mean two
stables crossing on the same weekend (9% of 60,000 games) or the stable that led into the last
weekend being caught (27%). A 60,000 game lasts 13 weekends on average (p10 10, p90 17): usually
into season 2, which is §14 Q6's worry.*

### 2.2 Between seasons — the off-season

Multi-season play needs dogs to turn over, or a 5-season game ends with everyone shepherding three
seven-year-olds. Between seasons, in one short screen:

1. **Every dog ages one year.** Growth and decline apply per §4.3.
2. **The retirement window.** Each stable *may* retire exactly one dog. If it does, a replacement
   is offered under §5.2's partial-information rules — you see what you are being offered before
   you accept, but not everything. Retiring pays out the dog's book value.
3. **Staff notice.** Each member of staff has a small chance ⚖️ of leaving for a better stable. A
   stable below two staff is offered one candidate.
4. **Cash, cargo and net worth carry over untouched.** The circuit reshuffles and prices reset.

That is the whole off-season: at most three clicks, and it exists so a long game has an arc rather
than a slow decay.

*Built at `v3e1` (E4, E5): the order is age, then retirement, then the staff notice. The stable sees
the replacement first (§9.2's age, one true stat and patter that lies at 0.35) and then chooses
"retire *name*" or "keep them all"; a retirement pays `dogValue` and the new dog arrives unknown and
not dealt. Each trainer leaves at 15%; a stable left short is offered one candidate, never its own
leaver and never one offered to another stable. Everything is rolled when the off-season opens, on
each stable's own stream, from one game-stream seed per stable, so no answer moves anything else.
Normal retires any dog of 6 or older, or its cheapest dog when the offer reads 500 Bones better;
Hard uses half the margin. In 5-season games 64% of stables retire a dog each off-season, and a
kennel turns over 1.81 dogs per two seasons (1.02 retired, 0.79 taken in the Pound).*

### 2.3 The weekend

One planet phase, not two. v2 ran a market phase before *and* after the races; v3 runs one, because
halving the screen visits is worth more to pace than the flexibility is worth to play. Winnings are
spent next week, which gives the season a rhythm.

1. **Arrival & turn order.** `score = 20 − cargoUnits ÷ 5 + d10` ⚖️. Highest goes first. Shown
   with the reason. **There is no ship speed to buy**, so turn order is bought with empty cargo
   space and nothing else.
2. **Explore** — simultaneous. Everyone picks one of the planet's three destinations at once;
   events resolve in turn order where two stables want the same thing.
3. **Market** — in turn order, because the shelf is shared and depth is finite (§6.2). This is what
   going first is *for*.
4. **Kennel** — simultaneous. Set each dog to Race or Rest, and set its diet.
5. **Race Office** — **in turn order, and declarations are public as they are made.** See §7.3;
   this is the one place where going *last* is the advantage, and it is deliberate.
6. **Bookie** — after declarations lock, prices are posted, everyone bets at once.
7. **Race day.** Three races run and are watched. Prizes paid, staff take their cut, bets settled.
8. **Jump.** Fitness, food, growth and injuries resolve. Next planet.

⚠️ **Turn order cuts both ways, and that is the design.** First pick of a shelf that runs out
against last look at a field you have to commit a dog into. A stable that loads its hold to the roof
goes last all season, which makes it rich and predictable — a trade the whole table can see it
making.

### 2.4 Winning

```
netWorth = cash
         + Σ dogValue(rating, age, injuryStatus)
         + Σ cargo × localSellPrice
```

No ship value (there is nothing to buy), no debt (there is none). Highest net worth wins. Tie-break:
most Gold Cup wins, then most race wins.

⚠️ **Championship points are cut.** They were a purse paid to whoever was already winning (v2 D39),
they need a scoreboard nobody looks at, and in a multi-season game they need a second scoreboard on
top. Net worth is the whole scoring system.

---

## 3. Players

- **3 to 8 stables.** Any mix of humans and AI.
- **Hotseat local multiplayer is the target the rules are written for** — humans round one screen,
  passing a laptop or a tablet. Online is later and unchanged in difficulty (the engine stays pure
  and action-driven, so it is the same job it always was).
- **Simultaneous wherever the shelf is not shared.** Explore, Kennel and the Bookie all resolve at
  once for every player; only Market and Race Office are taken in turn. With 8 players that is the
  difference between a brisk game and an unplayable one, and it is the single biggest pacing lever
  in the design.
- **Hidden information between humans:** a stable's Explore choice and its bets are private. Its
  declarations are public the moment they are made (§7.3), and its dogs' stats are always public.

---

## 4. Dogs

### 4.1 Stats — three, not four

| Stat | What it does |
|---|---|
| **Speed** | Top speed. |
| **Acceleration** | How fast the dog reaches top speed, *and* how well it breaks from the boxes and holds a line through a bend. |
| **Stamina** | How late it fades. |

`rating = 0.40 speed + 0.35 accel + 0.25 stamina` ⚖️, then moved by results (§4.4).

⚠️ **Trap is folded into Acceleration, not deleted.** v2 spent a phase making Trap worth 15.3%
marginal win rate and then built the whole trap-draw mechanic on it (D37: the rail is the short way
round and also where the traffic is, worth +3.5 points of win rate on tight bends). Deleting the
stat would make the box worthless again, which is exactly the hole the steward's bribe fell into.
Folding keeps the sim's bend logic intact — `bendCraft` reads Acceleration instead of Trap — and
gets the stat count down to three. The old 0.15 trap weight is absorbed into accel's 0.20, giving
0.35.

### 4.2 Fitness, and the Race/Rest decision

**Fitness 0–100**, multiplying every stat: `fitScale = 0.90 + 0.10 × fitness/100` ⚖️. Kept from v2
D13 unchanged — this curve was hard-won and reads properly across the range a player can reach
(100 → 26.1% win rate, 60 → 8.8%, 40 → 5.4%) **[v2 measured]**.

**Each dog is set to Race or Rest each week. There is no Train state.**

| State | Fitness |
|---|---|
| **Race** | −20 ⚖️ |
| **Rest** | +30 ⚖️ |

⚠️ **Dropping Train is a v3 simplification and it is load-bearing.** v2 had three states because
training was how food reached a dog. In v3 **a dog eats every week and gains its food's bonus every
week, whatever it is doing** (§6.3), so Train had nothing left to do except be a third option that
mostly resolved itself. Three dogs × a binary is three decisions a week; three dogs × a ternary was
the thing that pushed v2's click budget over. Race or Rest.

**The arithmetic this produces.** Two races and a rest is −40 +30 = −10 per three weeks. A dog that
races two weeks in three starts a season near 90 and finishes near 60 — fresh early, tired late,
with the exotic foods' fitness bonuses (§6.3) mattering more as the season goes on. Across ten
weekends a stable should fill roughly **two of the three races** most weeks, which is the number the
card is built around **[estimate — the first thing Phase A must measure]**.

A dog that is **injured or banned** is in a fourth state, **Layoff**, which is imposed rather than
chosen and recovers like Rest. It is derived, never stored.

### 4.3 Age

Age matters in v3 in a way it never could in v2, because a game can run five seasons. Age ticks
once, in the off-season.

| Age | Growth | Rest recovery | Injury chance | Value × |
|---|---|---|---|---|
| 1 | +1 stat/week | +30 | ×1.0 | 1.15 |
| 2 | +1 stat/week | +30 | ×1.0 | 1.10 |
| 3–4 | — | +30 | ×1.0 | 1.00 |
| 5 | −1 stat/week | +25 | ×1.3 | 0.65 |
| 6 | −1 stat/week | +20 | ×1.6 | 0.45 |
| 7 | −1 stat/week | +20 | ×2.0 | 0.30 |

All ⚖️ **[estimate]**. Growth is *on top of* whatever the dog's food gives it, so a young dog fed
well compounds and an old dog fed well merely holds station. That is the shape that makes the
retirement window a real decision rather than a formality.

*Built at `v3e1` (E6): age ticks in the off-season and nowhere else. Until `v3e1` the build ticked it
at week 7, which §4.3 never said, so a one-season game now has no ageing at all. This raised
one-season mean end worth from 39,194 to 42,151, above the 25–40k band. All of the rise is book
value: the 4-year-olds no longer turn 5 mid-season and fall from ×0.85 to ×0.65. Jesse's call:
leave it and report. Over five seasons the kennels do not age into 7s (mean age 3.0 → 4.0; 1.9% are
seven at the start of season 5).*

### 4.4 Rating, form, injury

- **Rating 0–99**, public, moved only by race results, Elo-style, exactly as v2 §5.3:
  `expectedPlace = 1 + (n−1) / (1 + 10^((rating − fieldAvg) / 15))`, `delta = (expected − actual) × 1.6` ⚖️.
- **Food and growth move stats. Results move rating.** Kept from v2 D1, and it is more important in
  v3 than it was in v2: it is the whole of the betting edge now that the Fixer is gone. A dog you
  have fed well is quietly better than its number, the bookie prices the number, and every player
  can see the stat bars if they look.
- **Form −10…+10**, decaying 2/week toward 0.
- **Injury:** base 4% per race ⚖️, ×2 below 50 fitness, ×1.5 on hazardous tracks, × the age factor
  above. Duration 1–3 weeks. An injured dog cannot be declared; its value is ×0.7 while injured.

⚠️ **With three dogs and no market, an injury is much more painful than it was in v2.** Losing one
of three for three weeks is a third of your stable for a third of a season. Two guards: a stable
with fewer than three fit dogs is offered a **free local runner** for the Bronze Dash (it races in
your colours, you keep the prize, it is nobody's asset), and the injury explore door can shorten a
layoff. If playtest says injuries still feel like being sent off, the base rate is the dial.

*Built at `v3d1` (D6): the runner is lent after Explore to a stable with fewer than three uninjured
dogs at 30+ fitness, 1.2 times a stable-season; the vet door is the Pound's "A vet who owes somebody
a favour" (and a riskier one in the Back Alley).*

*⚠️ **Deleted at `v3e1` (E1, Jesse's call): there is no free local runner.** The vet cards are the
one guard left. Removing the runner moved almost nothing: races entered went 2.16 → 2.11 a weekend,
mean end worth stayed at 39.2k, and injuries went 1.15 → 1.14 a stable-season. The injury-halving
trainer still regresses at about −1,160 (± 320) on end worth.*

### 4.5 Traits

Trimmed to a short, memorable list — the v2 set of 16 was a management-sim list. **Eight** ⚖️,
shown as icons on the dog card:

*Railer · Wide runner · Mudlark · Fragile · Iron · Glutton · Showboat · Bad blood*

⚠️ *Slow starter*, *Sprinter* and *Stayer* are **gone as traits**, because §5 replaces them with
running styles and distance preference. Two systems saying the same thing is the mistake v2 fixed
once already with `SetTraining` (D19).

*Built at `v3c` (C8): the list is these eight. Nervy took Lagrange Lows' one special rule with it.*

---

## 5. Running styles — the centre of v3's racing

Every dog runs its race a particular way. This is the single biggest addition in v3 and it is
worth more than it costs, for three reasons: it makes thirty races a game watchable instead of
identical, it turns a race into something you read rather than something you compute, and it is
almost free in the existing simulation.

### 5.1 The three styles

| Style | How it runs | Leans on |
|---|---|---|
| **Front-runner** | Bursts from the boxes, leads early, fades late | Acceleration |
| **Stalker** | Even pace, sits handy, wins by being better | Speed |
| **Closer** | Slow away, comes home hardest over the last third | Stamina |

**A style is a redistribution of the same energy, not a bonus.** It is expressed as a pair of
modifiers on the pace curve the simulation already has:

```
Front-runner:  early topSpeed ×1.08,  fadeStart −0.12     ⚖️ [estimate]
Stalker:       baseline
Closer:        early topSpeed ×0.94,  fadeStart +0.12, fade penalty ×0.8   ⚖️ [estimate]
```

`fadeStart = 0.45 + 0.45 × stamina/100` already exists (v2 §6.2). A style shifts it. No new model,
no new maths, and — importantly — **nothing that needs `exp` or `log`**, so the determinism rules in
`CLAUDE.md` are untouched.

⚠️ **Measured at `v3c` (C2): the estimates above were not a redistribution.** At ±0.12 and ×0.8 a
closer won 24.7% of eight-dog fields and a front-runner 4.7%, against 12.5% even — the fade is convex,
so a speed loss *p* costs time *p* / (1 − *p*). What was built: front-runner ×1.08 early / −0.07;
closer ×0.97 early / +0.06 / ×1.0; "early" is the first third of the trip; shifts are fractions of the
600 m reference trip (C5). Across the calendar the three read 12.9 / 12.0 / 12.6; what is left is the
trip — a front-runner wins 18% of sprints and 6.5% of staying trips, a closer 8% and 19%.

*At `v3c2` (C13, C14): the front-runner's fade shift is −0.05 and the closer's +0.035, re-balanced
so that the calendar stays even under the hot pace and the run-in. The shape is unchanged. Across
the calendar the styles read 11.8 / 12.7 / 13.0.*

### 5.2 Day-to-day variance — where Jesse's ±30% goes

Every race, each dog draws a **style expression** multiplier, `U(0.30, 1.30)` ⚖️, that scales *how
strongly its style applies that day*. A front-runner who draws 0.35 simply runs like a stalker; one
who draws 1.25 goes off like a rocket and pays for it.

⚠️ **This is deliberately not ±30% on the dog's speed, and the difference is the whole game.** v2
learned this the expensive way: the fitness multiplier used to span 20% and it was so violent that
a dog at 70 fitness won 3% of the time against equals, which is why D13 halved it to 10%. A ±30%
daily roll on top speed would swamp stats, food, age, form and every decision in §1.1. Putting the
variance in the *shape* of the run gives you all of the "he didn't run his race today" drama and
none of the damage — the area under the curve is constant.

### 5.3 The contest rule — why three front-runners burn each other out

> ⚠️ **Cut at `v3c` (C3), as V14 required.** Built alone (`67aa702`), measured, and deleted at the
> next commit: a closer's gap between one front-runner and three read **+0.7 points** against a 4-point
> floor, and no setting in the sweep reached 4. The section is kept as the record of what was tried.
>
> ✅ **Replaced at `v3c2` by the hot pace (C12, C13).** While the leader is inside the first third
> and **two or more** front-runners are within 4 m of the leader, the pace is hot. While it is hot,
> **every** runner within 6 m of the leader has its fade point moved earlier, up to 90 m for a whole
> window, charged by the ground it covers in that group. It needs two front-runners, so a lone one is
> never burned. A closer, slow away, is mostly out of the group. The closer's gap (1 front-runner
> against 3) reads **+2.3 points**, against a **+2 floor Jesse set** once the sweep showed that no
> setting could reach +4 with the calendar even: 79% of real races already carry two front-runners.
> A lone front-runner wins 15.8% (was 14.2%) and one with two rivals 11.7% (was 13.2%). The paragraphs
> below describe the `v3c` rule.

Styles on their own are independent: three front-runners would each run their own curve, fade at
their own points, and a closer would beat them by exactly as much as it beats one. **The
interaction has to be written, or it does not exist.**

> While a front-runner is inside the first third of the race and another dog is within **2 m** of it
> at the head of the field, both get **+3% to current speed** and their `fadeStart` moves **0.05
> earlier** ⚖️ — a cost larger than the boost is worth.

Over-exertion costs more than it gains, so contested front-runners come back to the field. The
closer's own curve never changes; the leaders simply come back to it.

Three properties make this the right shape:

- **It is emergent, not declared.** The contest depends on who actually got out that day, so a
  front-runner who draws a low expression is not burned. It interacts with §5.2 rather than
  fighting it, and the same three dogs give a different race each time.
- **There is precedent in the sim.** The bend clash is already a positional interaction between two
  runners within 1.2 m, with `bendCraft` deciding who comes off worse. This is that pattern applied
  to the front of the race.
- **It can be measured directly.** Win rate of a closer against a field with one front-runner
  versus three. **If that gap is not worth several points, drop the rule rather than tuning it up**
  — a small effect nobody can see is worse than no effect.

### 5.4 Hidden, then public

**A dog's style is hidden until it races. After its first race it is public to the whole table.**

- One race is usually enough to read it — you watch your dog lead and fade, and the commentary says
  so out loud. That matters because a dog only runs five or six times a season; a style that took
  four races to identify would be learned too late to use.
- **It is written on the dog card once known**, not left for the player to remember. Anything that
  rewards note-taking in a forty-minute party game rewards whoever brought a pen.
- **Public-after-racing is what makes §7.3 work.** If a rival's style stayed private, there would be
  no field to read and the whole declaration layer would collapse.
- It gives a dog acquired by event (§9.2) a second unknown: you take it not knowing how it runs, and
  you find out by risking a race on it.

### 5.5 The opening hand

**Each stable is dealt one front-runner, one stalker and one closer.** Styles are revealed as normal
— by racing — but the *distribution* is known, so a player who has identified two knows the third.

This solves two problems with one rule: nobody gets a structurally broken opening hand they cannot
fix in a game with no dog market, and a new player meets all three styles on the first race weekend.

⚠️ **Starting stats must also be dealt fair.** Each stable's three dogs are rolled to the same
**total stat budget** ⚖️ with different distributions, ages 2–4. In a game people play against each
other, "you got better dogs" is the complaint that ends the evening.

*Amended at `v3c` (C1, Jesse's call): an equal stat total is not an equal dog when the rating weights
are 0.40 / 0.35 / 0.25 — it dealt 44–55. Every dealt dog now rates exactly 50, with its shape drawn.*

### 5.6 What the bookie knows

The book prices **rating, fitness, form and style**. It does **not** price the interaction between
styles in a field.

That is a deliberate, bounded overlay, and it is the replacement for everything the Fixer used to
manufacture. A closer in a field of three front-runners is genuinely better than its price, and the
player who notices gets paid. v2 was careful never to leave a standing overlay by accident (D52
settled `oddsScale` at 15.5 specifically to keep the largest accidental overlay at 0.5 points); this
one is on purpose, it is discoverable by reading the card, and §11 measures its size.

❓ **Open:** how big is the field-shape overlay in practice? If backing the lone closer blind beats
the 15% margin reliably, it is free money and the book needs to see one more thing.

*Built at `v3c` (C6, C7): the book prices a **public** style on the **trip** — nine cells of rating
points — and never the field. It does not price fitness or form, and never has (§1.1 says "ratings
and styles"; this section's "fitness, form" was not built — ❓ Q9). Backing the lone closer blind
returns −17% a Bone. With the contest rule cut there is almost no field-shape effect to price: a
closer wins 13.1% against one front-runner and 12.8% against three.*

*At `v3c2` the hot pace gives the field shape something to read: a lone closer against three or
more front-runners returns +2.2% a Bone at the posted price, against −12.9% for the average runner.
Backed blind, every lone closer returns −2.7%. So the overlay pays a player who reads the board, and
it is not free money. `oddsScale` is 19 (C15).*

---

## 6. The market — six foods, and nothing else

There is exactly one market in v3. It sells six kinds of dog food, which are simultaneously the
game's trade goods and its training programme. **Every market decision is therefore also a training
decision**, and that is the mechanic the whole economy hangs on.

### 6.1 The goods and their bands

Modelled directly on Gazillionaire's commodity table, which does something clever: **every band is
exactly 8× from floor to ceiling**, so every good is the same *bet* and differs only in how much
capital it takes to make it.

| # | Good | Price band ⚖️ | Shelf depth per planet ⚖️ |
|---|---|---|---|
| 1 | **Grey Mash** | 10 – 80 | 40–60 units |
| 2 | **Scrapmeat** | 20 – 160 | 30–45 |
| 3 | **Glow Tripe** | 30 – 240 | 20–30 |
| 4 | **Vat Steak** | 60 – 480 | 10–18 |
| 5 | **Pulsar Marrow** | 75 – 600 | 6–12 |
| 6 | **Ambrosia** | 90 – 720 | 3–8 |

The across-good ladder at the floor is 1 / 2 / 3 / 6 / 7.5 / 9 — **a 9× spread across goods against
an 8× spread inside each one.** That near-equality is what makes six goods a decision instead of
one:

- A unit of Ambrosia swings 630 Bones; a unit of Grey Mash swings 70. If your **hold** is the
  constraint, only ever carry the dear stuff.
- Ambrosia at its floor still costs 90 a unit. If your **cash** is the constraint, you can afford
  nine times as much Grey Mash.

**Which constraint binds changes over the game, and that is the progression curve v3 gets for
free.** With a 50-unit hold and 6,000 starting Bones you can fill a fifth of the hold with
Ambrosia — cash binds. By week six, with prize money in, the hold binds and you graduate up the
ladder. An early game and a late game, out of a price table, with nothing to buy.

**Shelf depth is the scarcity rule**, and it is what stops "fill the hold with Ambrosia" being the
answer to everything. You cannot buy more than about eight units of the top good on any one planet,
so the big trade has to be *assembled* across several weeks — under a fog that hides where you are
going after next week. Some explore events award food, which is the other supply line.

### 6.2 What the screen shows

Copied from Gazillionaire more or less intact, because it is a complete trading UI in five columns:

| Your Hold | On Planet | You Paid | Market Price | Price Range |
|---|---|---|---|---|

- **Price Range** is the whole reason the market is legible on the first play. "198" means nothing;
  "198, range 60–480" means *cheap, buy it*, instantly, with no memory and no notes.
- **You Paid** is your average purchase price, so the player never does break-even arithmetic in
  their head.
- Hold gauge across the top: **50 / 50**, fixed, for everyone, forever.

### 6.3 Food as training

**Every dog eats one unit a week, whatever it is doing, and gains that food's bonus.**

| Good | Weekly effect ⚖️ **[estimate]** |
|---|---|
| **Grey Mash** | +1 to a random stat |
| **Scrapmeat** | +1–2 Stamina |
| **Glow Tripe** | +1–3 Acceleration |
| **Vat Steak** | +2–4 Speed |
| **Pulsar Marrow** | +2–4 to a random stat, **+5 fitness** |
| **Ambrosia** | +3–6 to a random stat, **+8 fitness**, injury chance halved this week |

⚠️ **The bonuses keep a light aim rather than being fully random, and that is a change from the
brief.** If the only difference between six foods is magnitude, five of them are pure trade goods
and the feeding decision collapses to "buy the best I can afford." Three cheap foods each pointed at
one of the three stats, and three exotics that are broader and touch condition, gives six distinct
identities without a 3 × 3 matrix to learn. The randomness sits inside each row, where it adds
texture rather than removing choice.

**The diet setting**, per dog, in the Kennel — set once, sticky, not a weekly click:

- a **named food**, or
- **best available**, or
- **worst available**.

If the chosen food runs out, the dog falls back to the cheapest thing aboard.

⚠️ **If the hold is empty, the dog loses 10 fitness that week and gains nothing** ⚖️. This one rule
is v3's entire running cost. There is no upkeep, no fuel, no wages charged in the quiet weeks and no
debt, so **food is the only pressure keeping money scarce** — which means the penalty for not paying
it has to be real, or the market becomes optional and the economy floats away.

### 6.4 The decision this creates

Feeding a dog one unit of Ambrosia costs you 720 Bones of opportunity when it is peaked and 90 when
it has bottomed out. So a well-played stable's **diet fluctuates with the market**: exotic food in
the cheap weeks, Grey Mash in the weeks it is worth selling. The best move in the game is catching
your dog's dinner on sale, and the price band on screen is what makes that readable without a
spreadsheet.

⚠️ **The number to watch.** Fifty units of Ambrosia bought at 90 and sold at 720 is a 31,500-Bone
profit — a whole season's prize money in one leg. Shelf depth (§6.1) already stops you assembling
that in a week, but the distribution matters too: **prices must cluster mid-band with rare
excursions to the ends**, so the 8× is something a player hunts rather than something that happens
to them. Use `normalDeviate()` from `determinism.ts`; do not reach for `exp`.

---

## 7. Races

### 7.1 Three purse tiers, everyone eligible

Three races a weekend. **Every dog may enter any race. One dog per stable per race.**

| Race | 1st / 2nd / 3rd ⚖️ | Local field rated ⚖️ |
|---|---|---|
| **Gold Cup** | 6,000 / 3,000 / 1,500 | 55 |
| **Silver Plate** | 3,000 / 1,500 / 750 | 45 |
| **Bronze Dash** | 1,500 / 750 / 375 | 35 |

Weekly pool 18,375. Major ×2.0, Grand Final ×3.0. 8 traps; short fields filled with local dogs at
the tier's rating and **fitness 75** ⚖️ (v2's figure, kept).

⚠️ **v2's seven fact-gated race types are cut.** Maiden, Juvenile, Veterans, Novice, Handicap,
Invitational and Consolation were a good answer to a question v3 no longer asks. They exist to
reward a *broad stable you built*; v3 deals you three dogs and has no market, so eligibility would
be luck rather than planning — the exact failure mode the system was designed to avoid. Three purse
tiers with open entry is one sentence, and the depth comes from styles and the field instead.

The decision the card asks is simple and real: your second-best dog can probably win the Silver
Plate outright, or finish fourth in the Gold Cup for nothing.

### 7.2 The simulation

Unchanged from v2 in shape and constants, with three amendments:

1. `bendCraft` and the trap-draw edge read **Acceleration** instead of Trap (§4.1).
2. Style modifies the pace curve (§5.1) and the daily expression scales it (§5.2).
3. The front-runner contest rule (§5.3) is a new positional interaction.

*At `v3c`: amendment 3 was built, measured and cut (C3); the fade point became metres rather than a
fraction of the trip (A7, C5).*

*At `v3c2`: amendment 3 is the hot pace (§5.3, C12). A fourth amendment is **the run-in** (C14):
over the last 15 m every runner slows by the same fraction at the same point on the track, reaching
50% at the line. It reads where a dog is and never where the others are, so it pulls nobody back.
A time gap stays the same time gap, and it shows as fewer metres at the line. Median winning margin
6.3 m, photo finishes 3.5%.*

Everything else — `raceBaseSpeed` 13.75, `raceSpeedCoef` 4.5, `raceFadePenalty` 0.50, the bend
model, the tick log, the renderer replay contract — carries over. **These constants were fitted over
six phases and there is no reason to disturb them.** Phase C re-baselines against them rather than
replacing them.

### 7.3 Declaring — the one place going last is better

**Declarations are made in turn order and are public the instant they are made.**

This is a deliberate inversion. Going first buys the best of a finite shelf; going last buys the
right to see what you are running into before you commit. A stable that has loaded its hold to the
roof takes the late slot all season and gets the better half of that trade — legibly, in front of
everyone.

It is also what makes §5 pay off. If declarations were simultaneous and hidden, running styles would
only matter to the bettor, not to the manager. Public-in-turn-order means the last player to declare
into the Gold Cup can see two front-runners already in it and put their closer in.

### 7.4 Betting

Win and Place, any race, any dog, including your own. `odds = (1 − margin) / p`. Margin 15% ⚖️
(10% on Neon Snout; no betting on Holy Bark). **Max stake 50% of cash** ⚖️.

No flat stake ceiling is needed — v2 added one because the crook could borrow a bankroll, and there
is no borrowing in v3. Bets are always affordable by construction, which is part of how the game
avoids debt.

### 7.5 Watching

The v2 race view carries over intact: top-down, camera on the pack, ticker, commentary bar,
photo-finish freeze, 1× / 2× / skip. Two additions v3 requires:

- **Commentary must name the style and the day.** "Went off like a rocket, nothing left at the
  turn" and "came from last, never looked like getting there until the final bend" are how a player
  learns §5.4 without being told it.
- **Races a stable has no runner and no bet in resolve to a result line** rather than a full
  animation, at the player's option. Thirty races a season × up to five seasons is a lot of
  watching, and §1's forty minutes will not survive watching all of them.

❓ **Open:** should all three races be watchable simultaneously in split view? It would cut the
watching time by two thirds at some cost in drama.

---

## 8. Staff — two trainers on commission

### 8.1 The shape

- **Two slots. Everyone is a trainer.** No roles, no ladder, no market.
- **Dealt at the start of a game.** The only way to change staff is a random event or the
  off-season notice.
- **Paid a percentage of race prize money, 1–10%** ⚖️, roughly proportional to how good their
  bonuses are. **Not** a wage.
- **The cut is on race prize money only** — not betting returns, not trading profit, not the sale
  of a dog. Otherwise it becomes an accounting rule nobody can hold in their head.

⚠️ **Commission is what makes staff safe to randomise.** A wage is charged in the quiet weeks and
has to be budgeted; that arithmetic is what broke v2's Fixer (D42/D45) and what made three staff
slots a trap for the AI (D30). A percentage is self-balancing — you only pay when you win — and it
is the reason v3 can hand you two people at random without it being a punishment.

It also has a texture nobody designed: **the same 10% trainer is cheap for a stable that makes its
money trading and expensive for one that races hard.** Whether your staff are a bargain depends on
how you are playing, which is free strategic depth.

### 8.2 The bonus pool

Each trainer carries one bonus (or two, at the top of the range). Drawn from ⚖️ **[estimate]**:

| Bonus | Cut |
|---|---|
| +1 to one stat per week, on top of food | 3% |
| +5 fitness recovery per week | 3% |
| Injury chance halved | 4% |
| Injury duration −1 week | 2% |
| Reveals one rival dog's running style without it racing, once a week | 2% |
| Shows next planet's price band position for all six goods | 3% |
| +10% prize money | 5% |
| Explore events are less likely to go badly | 3% |
| Two of the above | 6–10% |

⚠️ **The randomness risk, named.** You cannot shop for staff, so "I got the good trainer and you
didn't" is a real complaint waiting to happen. Two mitigations: the **staff door** in Explore (§9.1)
must come up often enough that every stable gets two or three swings a season, and the top of the
range must be genuinely expensive — a 10% trainer on a stable earning 30,000 in prizes costs 3,000,
which should be enough that taking one is a decision.

*Built at `v3d2` (D9–D12): 24 trainers, twelve with one bonus and twelve with two, two dealt to each
stable; a trainer's cut is the sum of its bonuses' cuts plus 2% for a pair, capped at 10%, taken
where a purse is paid and nowhere else. "+1 to one stat" is one stat on one dog a week, the
lowest-rated (D10). The cuts were re-priced by regressing end worth on the dealt bonuses: +1 stat 3%,
+5 recovery 5%, injuries halved 4%, layoff −1 week 2%, a style read 2%, next week's prices 8%, +10%
prize money 6%, safer Explore 3%. Commission is 13.2% of a stable's purses. A stable that opens the
Bar whenever there is one meets 2.2 trainers a season; four Bar cards carry them. The style read is
public (D11).*

---

## 9. Explore — where everything unpredictable comes from

This is the load-bearing screen of v3. Dogs, staff, food, money, sabotage, information and every
one-off perk that used to be a purchase now arrives through it.

### 9.1 The three doors

Each planet offers **three destinations**, themed and named to the planet, drawn from five
categories. The player picks **one**, privately, and it resolves into an event with two or three
choices.

| Category | What it tends to offer |
|---|---|
| **The Pound** | Dogs. New dogs offered, strays, a vet who will shorten a layoff, a dog's style revealed |
| **The Bar** | People and talk. Trainers looking for work, tips on next week's prices, rumours about the circuit |
| **The Back Alley** | Trouble. Sabotage, a steward who will sell you a trap draw, stolen food at 60%, things that can go wrong |
| **The Strip** | Money and food. Free crates, a card game, a sponsor, a price tip, a fine |
| **The Track** | Racing. A trial that reveals your own dog's style, a private match, a track-day that buys fitness |

⚠️ **The deck is now the entire content budget of the game.** v2 had 40 cards and a dozen other
systems supplying variety; v3 has 40 cards and nothing else. **Target ≥ 80 events at launch**,
weighted by category, with planet-specific rows on top. If the third play-through feels samey, this
is why, and the fix is rows rather than rules.

⚠️ **Planet identity now lives here.** v3 deletes the market variation, the ship shop, the staff
hall and the loan sharks that used to make eighteen planets feel different. What is left is the
track, the food band, and **which three doors this planet offers** — so the doors must be named and
flavoured per planet, not drawn generically.

*Built at `v3d1` (D1, D5, D8): 54 named doors, three a planet, no planet with two of one kind; each
category is on 5.7–6.2 of a season's ten weeks. The deck is 86 cards (Pound 19, Bar 19, Back Alley
17, Strip 16, Track 15); Staff and sabotage (D2) take it past 90. All-Normal door share 17–23% per
category. One seat's cards recur 13% from one season to the next. Every stable explores on its own
stream seeded at arrival, so no door moves anybody else's draws.*

### 9.2 Acquiring a dog

The rule Jesse asked for, with one amendment: **you see enough to price the gamble.**

When a dog is offered, you see its **age**, **one revealed stat**, and **the seller's description**
— which is sometimes a lie ⚖️. You do not see its other stats, its rating, or its running style.
Accepting means discarding one of your own dogs (you choose which) and paying nothing.

⚠️ **The amendment matters.** A fully blind swap is a coin flip with extra steps, and pillar 2 says
randomness has to arrive as something the player can evaluate. Age plus one stat plus patter that
might be false is a gamble a player can reason about and get wrong on purpose — which is the version
they will tell a story about afterwards.

*Built at `v3d1` (D2, D5): six Pound cards offer a dog, one of a kind a planet-week. The patter lies
at 0.35 × the seller's honesty (a monk never, a man in a long coat nearly two times in three); offers
centre on rating 42, so the gamble is mostly a step down with a chance of a real dog. A stable that
opens the Pound whenever there is one gets 2.9 swings a season. The acquired dog arrives
style-unknown and outside the §5.5 elimination.*

### 9.3 Sabotage

Available through the Back Alley, **freely targetable** — any rival, any race, the same cost.

- **Nobble a runner:** −25 fitness for that race only ⚖️, applied after declarations lock, so the
  bookie's prices have already been struck and do not move. The victim's *stated* fitness never
  changes. This is v2 §13's mechanic kept whole, because it works and because it is the best story
  generator in the game.
- **Buy a trap draw:** choose your dog's box ⚖️ (worth ~3.5 points of win rate on tight bends, and
  visibly nothing on a straight — the screen says so).
- **Getting caught:** a flat fine plus a quarter of what you had on the race ⚖️, rolled on race day,
  and **the whole table is told who did it.** In hotseat that penalty finally bites, which is
  exactly what v2 D40 said it was waiting for.
- Catch chance varies by planet (Lagrange Lows 20%, Holy Bark 60%) ⚖️.

⚠️ **The Fixer as a hireable person is gone entirely.** Both his jobs live in the Back Alley as
events now. v2 spent two phases discovering that a wage for a service used twice a season does not
pay (D42) and then that a price list does (D45); v3's answer is that if it is used twice a season it
should be an *event*, which is the same finding taken one step further.

❓ **Open, and it is the sharpest open question in v3:** free targeting means eight players can all
pile onto one person, or onto whoever is most annoying rather than whoever is winning. In a game
with friends that is either the best part of the evening or the end of it. Playtest it before
deciding whether the leader needs to be the cheaper target.

*Built at `v3d2` (D13, D14): two nobble cards (500 and 350) with a button per rival, each naming one
of that rival's sound dogs; the job is booked against the dog and bites if it runs, −25 on the runner
after the book has priced it. The steward sells the right to a box at Explore and it is named in the
Race Office (`ChooseBox`). Caught at the planet's rate (Lagrange Lows 20%, Holy Bark 60%, 35%
elsewhere): 800 plus a quarter of the stake, and a public "Stewards' enquiry" on everybody's Results.
69% of all-AI seasons see one; Normal targets the leader 45% of the time without being told to. **A
box is worth about 2 points on tight bends, not 3.5** — re-measured on the v3 race model (D14).*

### 9.4 Information

The fog (§2.1) is kept, but there is no dossier to buy and no Tipster to hire. Information reaches
you through **Bar events** and **staff bonuses**, and it has exactly one use: knowing whether next
week's planet buys your Ambrosia high. That makes it easy to price for the first time in the
project.

*Built at `v3d1` (D3, D4): two kinds, both only through a door. **Next week's shelf** — three Bar
cards sell the band position of two, three or all six goods, rolled a week early and read by nobody
else. **Race-day tips** — five Bar and Back Alley cards tell one stable about a hidden knock, loss of
appetite or buzz on a stable dog, which the book never prices: a tipped buzzing dog returns about
+20% a Bone, and this is the insider knowledge betting was missing.*

---

## 10. Screens

Down from eleven to seven. The Docks and the Saloon are gone entirely.

1. **Title / New game** — players, seasons or target, toggles, seed.
2. **Galaxy map** — this planet in full, next week's name, the rest hatched.
3. **Planet hub** — backdrop with four hotspots: Explore, Market, Kennel, Race Office. Plus the
   Bookie, which opens after declarations lock.
4. **Explore** — three doors, then an event card with choices.
5. **Market** — the six-row table of §6.2 and a fixed 50-unit hold gauge.
6. **Kennel** — three dog cards. Race/Rest, diet, fitness trajectory, style once known, staff.
7. **Race Office** — three purse tiers, everyone's declarations as they are made, and what a run
   costs each dog in fitness.
8. **Bookie** → **Race view** → **Results**.
9. **Leaderboard** (always available) and **Season / Game end**.

### 10.1 The click budget

v2 measured 13.3–14.3 decisions a weekend for one player and treated 14.5 as a ceiling. **v3's
budget is 10 ⚖️**, because the number that matters now is decisions × players: eight players at 14
is an unplayable evening, and eight at 10 with Explore, Kennel and Bookie resolving simultaneously
is about right.

The arithmetic: one Explore door + up to six market lines (realistically two) + three Race/Rest
+ three declarations + a bet. Diet is sticky and normally costs nothing.

⚠️ **v2's hard-won principle carries over verbatim (D34): a hotspot flags what CHANGES, not what is
always there.**

*`v3d2`: Race/Rest is no longer a press — the week follows the declarations (D16) — and `hub-clicks`
reads 9.4 a weekend.*

---

## 11. Balance targets

v2's harness survives and most of its measures still mean something. New and changed targets:

| Measure | Target | Why |
|---|---|---|
| Season length, 4 players, no race animation | ≤ 25 min | §1's forty minutes with watching included |
| Decisions per weekend per player | ≤ 10 | §10.1 |
| Races entered per weekend, per stable | 1.8–2.4 of 3 | §4.2's fitness arithmetic; the card is built for it |
| Races per dog per season | 5–7 | §4.2, 10 weeks |
| A closer's win rate, 1 front-runner in the field vs 3 | ≥ 4 points better · **≥ 2 since `v3c2` (C13)** | §5.3 — **if this misses, cut the contest rule** · *`v3c`: +0.7, cut (C3)* · *`v3c2`: the hot pace, +2.3 against the +2 floor Jesse set* |
| Winning margin, median / photo finishes | 4–7 m / ≥ 3% | §14 Q11 · *`v3c2`: 6.3 m / 3.5% (v3c 10.6 m / 1.8%)* |
| Style expression's share of race variance | below fitness's, above form's | §5.2 — the ±30% must not swamp the stats |
| Field-shape betting overlay, backing the lone closer blind | below the 15% margin | §5.6 — an edge for a player who reads, not free money |
| Mean end worth, all-Normal, one season | 25–40k | roughly v2's band on a 10-week season |
| Stables ending a season on less than they started | 10–25% | there is no bankruptcy; going backwards is the only failure state |
| Explore doors chosen, spread across five categories | none below 12% | a door nobody opens is dead content |
| Food sold as a share of gross income | 20–35% | the trade is a real road, not a side hustle |
| Net worth gap, 1st to last, at the end of a season | narrower than v2's | §1's "nobody is out before the end" |
| Seed + action log reproduces a game | exactly, on any JS engine | unchanged and non-negotiable |

*Measured at `v3e1` (`--game`, six Normal):*
- *Stables ending a season on less than they started: **0.8%** against 10–25% ❌. There are no costs
  but food, so almost every stable grows every season. Going backwards is §11's only failure state,
  and the game has almost none of it.*
- *1st-to-last gap at a season's end: 26,510 (62% of the table's mean, 1st/last 1.85×), against
  v2e's 63,530 (195%, 8.16×) ✅.*
- *Stables mathematically out at week 8 (E7): 0% in a one-season game ✅.*

⚠️ **Two v2 measures are retired.** `bankruptRate` has nothing to measure. The three-road printout
(`trainer` / `trader` / `crook` agents) goes with the three roads — v3 has one road with a trading
sideline and a betting sideline, and the honest replacement is the income split on the season-end
screen.

---

## 12. Planets

All 18 planets survive as data. What changes is which fields do work:

- **`foodBand`** becomes a per-planet multiplier on the six global bands of §6.1 — it is the
  trader's whole map, and it is now the main thing that distinguishes one planet from another
  economically. *It multiplies where a good's price clusters in its band, not the price itself, so
  §6.1's 8× stays a hard range on every planet (B2); and the map is public, shown wherever the planet
  is, while the week's draw stays in the fog (B8).*
- **`exploreDoors`** is a new field: the three named destinations this planet offers, mapped to
  §9.1's categories. **This is where planet character lives in v3.**
- **Track** (distance, bends, hazard) is unchanged and matters more than it did, because running
  styles interact with it: a tight-bend track favours a front-runner who gets the rail, a long
  straight favours a closer.
- **`marketBias`**, ship shops, banks, sharks, staff halls and the supplement rules are **cut**.

---

## 13. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-16 | **V1 — v3 is a party game, not a management sim; the pillar set is rewritten** | The stated goal is 3–8 players in 40 minutes. v2's pillars optimise for depth per decision and that is the wrong objective. Named explicitly so future changes are judged against the right test |
| 2026-09-16 | **V2 — 3 dogs, dealt, one of each running style, on an equal stat budget** | No dog market means a bad opening hand cannot be fixed. One of each style also teaches §5 on the first race weekend. Equal budgets because "you got better dogs" ends the evening |
| 2026-09-16 | **V3 — the dog, staff and ship markets are all cut; acquisition is by event only** | Four markets is three too many for a 40-minute game. The cost is that most of a stable's composition is luck, which §9.2's partial information is the guard against |
| 2026-09-16 | **V4 — a dog offered by an event shows age, one stat and a description that can lie** | A fully blind swap is a coin flip, and pillar 2 requires randomness to arrive as a *priceable offer*. Amendment to the brief |
| 2026-09-16 | **V5 — one market, six foods on Gazillionaire's 8× bands, which are also the training programme** | The best structural idea in the redesign: every market decision is also a training decision. The near-equal 8× within-good and 9× across-good spreads make cash-bound and hold-bound different games, which is a progression curve with nothing to buy |
| 2026-09-16 | **V6 — food bonuses keep a light stat aim rather than being fully random** | Amendment to the brief. If the only difference is magnitude, five of the six goods are pure trade goods and feeding collapses to "buy the best I can afford" |
| 2026-09-16 | **V7 — shelf depth falls with tier; ~8 units of Ambrosia a planet** | Jesse's fix to the fill-the-hold-with-exotics problem, adopted. It also forces the big trade to be assembled over several weeks under a fog, which makes it a plan rather than a purchase |
| 2026-09-16 | **V8 — the Train state is cut; a dog eats and gains every week, and chooses only Race or Rest** | With food no longer gated behind a state, Train had nothing to do. Three binaries a week instead of three ternaries, which is most of the click budget cut |
| 2026-09-16 | **V9 — Trap is folded into Acceleration, not deleted** | Deleting it would make the trap draw worthless again and waste D37 entirely. Folding gets to three stats and keeps `bendCraft`, the rail edge and the bought box all working |
| 2026-09-16 | **V10 — no fuel, no upkeep, no wages, no debt, no bankruptcy; food is the only running cost** | Pillar 5. Nobody should be dead at week 6 of a game with friends. The consequence is that §6.3's empty-hold penalty is carrying the whole economy's pressure and must be real |
| 2026-09-16 | **V11 — staff are two trainers paid 1–10% of race prize money** | Commission is self-balancing and is what makes randomly-dealt staff safe. A wage is what broke the Fixer (D42) and made three slots a trap (D30). Side effect worth keeping: the same trainer is cheap for a trader and dear for a racer |
| 2026-09-16 | **V12 — running styles, hidden until a dog races, then public to the table** | The highest-value-per-unit-of-work idea in the redesign: it makes 30 races watchable, gives every stat a style that loves it, and creates a field to read. Public-after-racing is what makes §7.3 work and stops the game rewarding note-taking |
| 2026-09-16 | **V13 — ⚠️ the ±30% daily variance is on the style's *expression*, not on the dog's speed** | Amendment to the brief, and the most important number in v3. v2 D13 already learned that a 20% multiplier range is violent enough to make everything else invisible. Varying the *shape* of the run keeps all the drama and none of the damage |
| 2026-09-16 | **V14 — ⚠️ front-runners burning each other out is an explicit contest rule, because it does not emerge** | Caught in review: independent pace curves do not interact, so three front-runners would simply each run their own race. The rule is positional, follows the bend-clash precedent, and **is to be cut rather than tuned if the closer's gap is under 4 points** |
| 2026-09-16 | **V15 — the seven fact-gated race types are cut for three open purse tiers** | They reward a broad stable you built; v3 deals you three dogs and has no market, so eligibility would be luck. One sentence instead of seven rows, with the depth moved into styles |
| 2026-09-16 | **V16 — declarations are made in turn order and are public as they are made** | Makes turn order two-sided: first pick of a finite shelf against last look at the field. Without it, running styles would matter only to the bettor and §5's whole strategic layer would collapse |
| 2026-09-16 | **V17 — the Fixer is cut as a person; the bribe and the sabotage become Back Alley events** | v2 found a wage does not pay for a twice-a-season service (D42) and a price list does (D45). v3 takes it one step further: something used twice a season is an *event*. Free targeting is Jesse's call and is flagged as the sharpest open question |
| 2026-09-16 | **V18 — championship points and the purse are cut; net worth is the whole scoring system** | The purse paid whoever was already winning (D39) and a multi-season game would need a second scoreboard on top of the one nobody reads |
| 2026-09-16 | **V19 — 10 weekends a season, 1–5 seasons or a net-worth target; everything carries over, with a 3-click off-season** | Jesse's call on all three. The off-season exists so a 5-season game has an arc instead of three ageing dogs and a slow decay |
| 2026-09-16 | **V20 — hotseat local multiplayer is what the rules are written for; Explore, Kennel and Bookie resolve simultaneously** | The single biggest pacing lever in the design. Only the shared shelf and the public declaration board need a turn order at all |
| 2026-09-17 | **A1 — §2.1's calendar arithmetic does not close, and Phase A implemented 8 regular + week-5 Major + week-10 Collar Prime** | §2.1 says "9 regular planets … plus Collar Prime at week 10" and separately names "week 5's Major venue", which is 11 weekends in a 10-week season. ⚠️ **Jesse's call to confirm.** The build reads 8 + 1 + 1 from `balance.regularPlanets`, so changing the answer is one sheet row, not a code change |
| 2026-09-17 | **A2 — each race row carries its own purse *and* its own local rating, rather than reading a shared tier table** | A deliberate reversal of v2 D24, and the reason is V15: with the eligibility gates cut, the home team's standing is the *only* thing that makes the Gold Cup hard. A tier table put that number one indirection away from the race it describes |
| 2026-09-17 | **A3 — a starting dog is dealt an exact stat budget rather than fitted to a rating band, and no band is needed** | v2 fitted each dog into a rating window, which is a weaker promise than V2 makes: two dogs inside 38–48 can be ten points apart. With rating weights summing to 1, 150 points over three stats rates 50 *whatever the split*, so the budget delivers the equal-strength guarantee and the band is redundant |
| 2026-09-17 | **A4 — `races per dog` adopts 5–7 and `dogs at week 10` is retired as a measure** | Both were fitted to a five-dog stable that could buy dogs. Three dealt dogs over ten weekends cannot reach v2's 7–9 by construction, and a column whose only possible value is 3.00 is a deletion check rather than a target |
| 2026-09-17 | **A5 — ⚠️ `cardCoverage` is deleted rather than re-fitted, and open entry is why** | It asked "on the weekends this type ran, could the stable have filled it", which is only a question while a race can refuse a dog. V15 removed every gate, so coverage collapses to the fitness floor — which the kennel table already reports |
| 2026-09-17 | **A6 — Hard's `trainThroughCheapWeeks` is deleted, measured inert first** | V8 feeds every dog every week, so resting buys fitness and nothing else, and pricing a purse against a rating gain the dog gets anyway is not a comparison. 200 seasons read identical to the Bone with it on and off. Hard's weekly rule and Normal's now differ by a single fitness threshold, which is where a real agent difference has to come from next |
| 2026-09-17 | **A7 — ⚠️ the stat-leverage ordering row misses by 0.7 points and nothing was tuned, because a rating weight and a simulation leverage are different quantities** | V9 folded Trap's *weight* into accel; it did not fold its *leverage*. Per-track rows confirm the fold works (accel peaks on the sprint and the tight bends, falls on the staying trip) — what puts stamina ahead of accel at 480 m is that stamina is flat at every distance, because `fadeStart` is a fraction of the trip. A model change, not a number. **Jesse's call: widen the row or re-derive it** |
| 2026-09-21 | **B1 — prices are a clamped normal draw in band-position space, sd 0.16 of the band, linear in price; buy and sell move together** | §6.4. The centre is set by the planet (B2); the tails are clamped 0.02 from either end rather than re-drawn, so every good costs a fixed two uniforms and the rng stream never depends on a price. Linear rather than log because a player reads "198, range 60–480" as a point on a line, and the cluster has to sit at the middle of the *printed* range or the Price Range column lies. The sell stays `foodSpread` below the buy, so no same-planet arbitrage exists. At 0.16 the p99 best leg is 13.5% of mean end worth against a 40% limit |
| 2026-09-21 | **B2 — `foodBand` multiplies the mid-band *centre* of each good's price, per good, and is written per planet as a level, a tilt and at most one named exception** | A multiplier on the price would let a dear planet post Ambrosia above 720 — outside §6.1's 8×, the one number §6.4 says must stay hard. Level is Phase A's old absolute band (so every planet keeps its v1/v2 character); tilt is which end of the ladder is dear there; the exception is where the planet's name is a promise (the Drift's Scrapmeat, Vatgrown's Vat Steak, Holy Bark's monks paying for Ambrosia). Clamped to 0.45–1.55; every good averages 0.98–1.03 across the eighteen |
| 2026-09-21 | **B3 — the empty-hold penalty *replaces* v2's cash penalty; a No Trading season buys the staple at the gate at the local price** | §6.3 describes one rule, and two punishments for one miss is how a number becomes impossible to reason about; the cash version also let a rich stable stop thinking about food. The penalty goes through the same clamp as the week's recovery, or a rested dog near 100 never feels it. Without the gate, No Trading would starve every dog from week 3 — and the toggle's own promise is "your dogs still eat" |
| 2026-09-21 | **B4 — You Paid is a running average per good, not FIFO** | One number per good, which is what Gazillionaire printed and what "did I pay more than this?" asks. A sale, a dinner or a spoiled crate leaves at the average and does not move it, so a partial sale leaves a sensible figure; a crate that arrives free comes in at zero and the screen says "free". FIFO would need a list of lots per good in the save file and a column nobody can check in their head |
| 2026-09-21 | **B5 — "hold-bound" means ending a week's trading ≥ 90% full with cash for another tenth of the hold of the dearest good at its mid-band price** | The crossover row needed a definition, and this one is outcome-based and read off the data: it stopped buying for want of space, not money. At 50 crates and Ambrosia's 405 mid-band, the floor is about 2,000 Bones. The crossover week is the first week a stable is hold-bound. Measured 4.3 — in band on a flat curve, which is recorded as a finding rather than a pass |
| 2026-09-21 | **B6 — a diet's "best" and "worst" are the good's place on the §6.1 ladder, not this week's price; the default is "worst"; Ambrosia's halving protects the races after the jump it is eaten at** | A diet is a standing order and cannot depend on a draw its owner has not seen. "Worst" is also §6.3's own fallback, so a player who never touches it never sees a dog eat the Ambrosia they bought to sell. A dog eats at the end of its week, after its races, so the week the halving can protect is the next one — stored as `Dog.lastMeal`, a fact about the dog rather than a rule about Ambrosia |
| 2026-09-21 | **B7 — turn order is scored in whole numbers, and ties go to the lighter hold** | Phase A's `−cargo ÷ 5 + d10` in floating point broke exact ties by rounding error (0.8 against 0.7999999999999998) — half toward the lighter hold and half toward the heavier. Scaled to integers, the constant 20 is verifiably inert. The lighter-hold tie-break is the rule's own logic, "the lighter ship lands first", applied to the one case the arithmetic cannot separate |
| 2026-09-21 | **B8 — a planet's food map is public; the week's prices are not** | The fog (§2.1) hides the week's draw, not what kind of place a planet is — and hiding the map would reward memory, which §5.4 rejects for running styles for the same reason. So the Market prints next stop's map in words ("cheap for Scrapmeat, dear for Ambrosia"), as do the galaxy map, the hub and the rumours; §8.2's staff bonus and §9.4's Bar events still have the week's *band position* to sell |
| 2026-09-21 | **B9 — A1 confirmed: 8 regular planets + the week-5 Major venue + Collar Prime. A7 deferred to Phase C** | Both Jesse's calls, asked before Phase B built anything. §2.1 now reads 8. The stat-leverage fix — `fadeStart` as an absolute distance — moves every dog in the golden season and belongs with the race-model code Phase C rewrites for running styles; it is in Phase C's deliverables and acceptance table |
| 2026-09-23 | **C1 — the opening hand is dealt to an equal *rating*, not an equal stat total; A3 is withdrawn** | Jesse's call, asked before Phase C built anything. A3 claimed 150 points over three stats "rates 50 whatever the split"; with weights 0.40 / 0.35 / 0.25 it dealt 44–55, and the best stable at a table of six started a median 16 rating points ahead of the worst (Phase B, correction 3). Every dealt dog now rates exactly `startDogRating` 50: speed and accel are drawn within ±15 of it and stamina solves for the rating. The stat *total* varies instead, which is what weighted stats mean. The p90/p10 spread fell from 2.31× to 1.86× at the same commit — the deal had been a source of it |
| 2026-09-23 | **C2 — the style curve is measured, not estimated: front-runner ×1.08 / −0.07, closer ×0.97 / +0.06 / ×1.0, over the first third** | §5.1's own test. The ⚖️ estimates gave a closer 24.7% of eight-dog fields and a front-runner 4.7%, because the fade is convex; the curve was fixed before anything else was measured. "Early" is the first third of the trip; the closer's softer fade (×0.8) went, because the later fade point carries "comes home hardest" on its own. Re-balanced once more after A7, which it had to survive: 12.9 / 12.0 / 12.6 across the calendar |
| 2026-09-23 | **C3 — ⚠️ the contest rule of §5.3 is cut: a closer's gap read +0.7 points against the 4-point kill switch** | V14, applied as written. Built alone, swept (×3 the cost: +1.2; 4 m and ×6: +1.0; "another front-runner" instead of "another dog", 4 m and ×6: +3.6), and deleted at the next commit. Why it cannot, as far as the sweep shows: a burned front-runner's wins are shared by everyone behind it, so a closer collects about a fifth; and "another dog at the head" burns a lone front-runner on the stalkers it takes on, so one front-runner and three are both punished. **A rule meant to pay closers has to be about closers** — a question for the GDD, not a tuning job (§14 Q10) |
| 2026-09-23 | **C4 — `styleKnown` is a boolean; nobody knows a style privately, including its owner; the engine does the elimination; locals are public** | BUILD_PLAN_V3 offered a set of player ids. Racing is watched by the whole table, so the set would only ever be empty or everybody. §5.5's "a player who has identified two knows the third" only makes sense if the owner is finding out by racing too — and since the deal is public the elimination is open to everyone, so the engine does it (§5.4: no rewards for bringing a pen). A local's style is on the form guide from the start, or the board of §7.3 would be half question marks. ⚠️ The elimination assumes a stable holds the three dogs it was dealt; Phase D's acquisition breaks that |
| 2026-09-23 | **C5 — the fade point is metres from the boxes: the old fraction of a 600 m reference trip, then a fixed slowing over 250 m to the 0.50 penalty** | A7 / B9. `fadeStart = 600 × (0.45 + 0.45 × stamina/100 + style shift)`; the penalty grows linearly and is reached 250 m past it, held to the line. raceFadeBase, raceFadeStamina and raceFadePenalty keep their values. Swept 520–600 m × 250–400 m; 600 / 250 met the stat-leverage row with the widest margin (24.5 / 18.3 / 16.7 at 480 m) and gave stamina the steepest climb with the trip (12.7 → 16.7 → 22.0). Cost, measured: the fade no longer drags the whole field back at the line, so the median winning margin went from 7.3 m to 10.6 m and photo finishes from 2.2% to 1.8% of races |
| 2026-09-23 | **C6 — the book prices a public style on the trip, in nine cells of rating points, and never the field; it does not price fitness or form** | §5.6. The fitted edges (front-runner +4 / 0 / −6, stalker −1 / 0 / 0, closer −4 / 0 / +4 on sprint / standard / staying) are `--styles`' own measurement, `oddsScale × log10(7w / (1 − w))`. A style the table has not seen is priced at nothing — the book knows what the table knows. The AI prices entries the same way. §5.6 says the book sees "rating, fitness, form and style"; `odds.ts` has only ever priced the rating, §1.1 says "ratings and styles", and adding fitness would take away the edge D1 leaves a player who reads the card — so it was not built and is ❓ Q9 |
| 2026-09-23 | **C7 — ⚠️ `oddsScale` moves from 15.5 to 18.75, because A7 left the book a standing overlay in real fields** | D52's criterion is the overlay; its instrument was one dog against seven 50s, and on that probe 15.5 is still least. But A7 moved the race model under the book, and in the fields the game runs 15.5 left **+9.8% a Bone on every stable dog** and a house margin of 4% instead of 15% — the accidental overlay D52 exists to stop. 18.75 is the least-squares fit and puts the house margin back at 12%, stable dogs at +0.2% (D1's deliberate edge). BUILD_PLAN_V3 §2.3 listed 15.5 as kept whole, so **Jesse's call to confirm** |
| 2026-09-23 | **C8 — sixteen traits become §4.5's eight; Lagrange Lows loses its special rule** | Slow starter, Sprinter and Stayer are what styles and the fade in metres now say; Nervy, Cheap date (an upkeep v3 does not have), Prima donna, Bounces back and Old soul went with them. Eleven readers swept by grep, not by memory. Lagrange Lows' locals were Nervy, and it keeps its tight bends and food map; Phase D's doors are where its character goes. Mean end worth fell 1,070 — the cut traits were mostly bonuses |
| 2026-09-23 | **C9 — the day's expression is drawn in its own per-runner loop after the break, before the first tick; a probe may pin it** | §5.2 asks for a fixed point. Eight draws a race, always (short fields are filled with locals), so the stream never shifts with the number of stables. `Runner.expression` lets the harness hold it still for the variance decomposition; the draw is still made, and nothing in the game sets it |
| 2026-09-23 | **C10 — the Race Office board is public in turn order; v2's "a human's pick is hidden until the lock" is reversed** | V16. v2 hid picks so hotseat was not a peeking contest; V16 makes seeing the field the thing going last buys, and turn order already stops anybody seeing a pick that has not been made |
| 2026-09-23 | **C11 — Hard's field-shape read is not built: with C3 there is nothing in the field for it to read** | Jesse's call was "give Hard the field-shape read and report what it is worth, as a measurement". Measured without building it: a closer wins 13.1% against one front-runner and 12.8% against three, and backing the lone closer in a field of three or more front-runners returns −19%. The read is worth nothing because the effect is not in the simulation. Hard beats Normal 51.5% (v3b 47.5%, band 63–68%) on the changes every agent got |
| 2026-09-23 | **C12 — the contest rule returns as the hot pace: two front-runners at the head light it, and everyone in the lead group pays** | Jesse, after `v3c`: "want it back". The `v3c` rule failed twice. It burned a lone front-runner on the stalkers beside it, and it shared a burned front-runner's wins across the whole field. So the hot pace takes **two** pace-lighting styles within 4 m of the leader, inside the first third, to light. Then every runner within 6 m of the leader pays a fade point moved earlier, 90 m for a whole window, charged by the ground it covers in that group. A closer is mostly out of the group, so the leaders come back to it. The rule reads positions, makes no rng draw, and is driven by one style cell (`lights the pace`). A `hotPace` event marks it lighting |
| 2026-09-23 | **C13 — ⚠️ the kill switch's floor is +2, not +4; the style curve is re-balanced to keep the calendar even (Jesse's call, option A)** | Swept over 45 cells at 6,000 races each. Settings that reach +4 (e.g. 4 / 6 / 120: +4.4) leave the three styles 5.6 points apart across the calendar, because 79% of real races hold two or more front-runners, so burning a crowd burns the style. Re-balanced to even, the rule only moves wins between a lone front-runner and a crowded one, and the closer collects about two points. Reaching +4 while even needs the front-runner's own fade removed (−0.01, paying 65 m against a 5 m fade), and that is still 2.1 apart. Built: 4 m / 6 m / 90 m, front-runner fade −0.07 → −0.05, closer +0.06 → +0.04. Gap +2.2, spread 1.0, a lone front-runner 16.1% (was 14.2%) |
| 2026-09-23 | **C14 — the run-in: over the last 15 m every runner slows alike, to half pace at the line; the closer's fade shift trimmed to +0.035** | §14 Q11. The margin is made inside the race, mostly by race-day luck, but luck is also what holds calibration (at 1.2 a rating-65 dog wins 79%). Tick noise does nothing to the margin, and a harder fade widens it. A margin in metres is a time gap multiplied by the speed at the line, and A7 took that speed from half pace to about 85%. So the whole field slows alike, by position only. That is not a catch-up rule: nobody gains time on anybody. Kept short because a long run-in favours stamina (at 40 m stamina passed accel). Median 10.3 → 6.3 m, photo finishes 2.2 → 3.5% |
| 2026-09-23 | **C15 — `oddsScale` 18.75 → 19, on the real-field reading; least squares said 18 and was the wrong way** | C7 again. The probe (65 v seven 50s, 51.8%) fitted 18. Played through at 18, the house margin was −9.9% and a stable dog backed blind returned +2.8%; at 18.75 the figures were −11.8% and +1.4%; at 19, −12.6% and +0.6% (200 seasons) or −12.9% and +2.3% (800 seasons, within a standard error of the +2% line). 19 is the smallest step that puts both in band. `STATE_VERSION` 8 and `SAVE_VERSION` 7 moved in their own commit: a `v3c` log is a different season now |

| 2026-09-24 | **D1 — Explore is simultaneous and played in turn order, and every stable explores on its own stream, seeded at arrival** | §2.3 step 2, §9.1. The arrival draw is gone; the 26 cards are re-homed behind the five doors. At arrival the game's stream draws one seed per stable, in seating order, and everything a door does — the card, its roll, the choice's effect — runs on that stable's stream, so no door and no choice moves the game's stream or another stable's draws (a determinism test opens all three doors and compares). Picks are private and contention is turn order, so resolving each door as it opens is the same game as collecting picks first, and passes a hotseat laptop once. The Tip-off's lazy local is drawn every week for the same reason; the Solar flare no longer reshuffles the table mid-Explore |
| 2026-09-24 | **D2 — a dog offer shows age, one true stat and patter about another, which lies at 0.35 × the seller's own honesty; the §5.5 elimination reads only dealt dogs** | §9.2, V4. The talked-up stat is 10 above the dog's level when true and 12 below when a lie; a monk ×0, a man in a long coat ×1.8 — the seller is the thing a player reasons about. Walk away is the first button. An acquired dog is style-unknown and not dealt; `revealStyles` counts dealt dogs held plus dealt dogs gone (as known when they left), which is C4's caveat closed. Measured: 32% of offers lie; Normal took 28% of the lies, which is when a lie is caught (the stat bars are public) |
| 2026-09-24 | **D3 — betting's insider knowledge is race-day conditions, drawn at arrival, applied to the runner, never priced, and told only by a tip** | Jesse's call after `v3c`. One draw per stable dog: a knock 6% (−30 fitness on race day), off its feed 6% (−15), buzzing 8% (+3 speed). Nobody knows, the owner included, until a Bar or Back Alley card tells one stable. Sized by `--styles` row 5's method at 800 seasons: a buzzing dog +20.1% a Bone, a stable dog blind −1.3%, the house margin −12.6% (buzzing +8 read +53%, +5 read +33%). A private style reveal was not built: C4 has no private knowing |
| 2026-09-24 | **D4 — next week's market is rolled a week early and sold in the Bar** | §9.4. Arrival rolls next week's prices and posts them when the week comes; only a stable whose `intel` names a good may read it, and Normal trades on it. 1.8% of sales are made on a tip, at a mean leg of 461 against 296; Phase B's rows stay in band |
| 2026-09-24 | **D5 — offered dogs centre on 42, not the dealt 50, and Normal's door is mostly a hash** | Measured, not designed. At 50 the Pound was a free upgrade for a stable that takes only the good ones — ~2,000 of mean end worth, out of its band; at 42 mean end worth is 39,710. Normal's first door rule leaned so hard on "cash > 3000" that it opened the Bar 39% and the Alley 6%; with small need bonuses and `weight × (0.25 + hash)` every category is 17–23% |
| 2026-09-24 | **D6 — the free local runner goes to a stable with fewer than three uninjured dogs at 30+ fitness, for the Bronze Dash** | §4.4. Lent after Explore, drawn on the stable's own stream, nobody's asset (`Dog.loan`: never in the kennel, net worth or a rating table, not rolled for injury, swept at the jump). At the injury-doubling line of 50 it was lent 4.8 times a stable-season — a purse, not a guard; at 30, 1.2 |
| 2026-09-24 | **D7 — `hub-clicks` counts Explore, and Results gains "Fly on"** | §10.1. The old count never included the arrival card. Explore is 1.75 presses a weekend (a door, and a choice on ~75% of cards); "Fly on" does back-to-the-planet and end-turn in one press when there is nothing left to do, saving 0.78. 11.3 against the 10.5 limit — **missed**, reported, and a candidate saving named in the D1 notes (Race/Rest is inert for an undeclared dog) |
| 2026-09-24 | **D8 — "two consecutive seasons share ≤ a third of their events" is read per seat** | One seat's cards recur 13.3% season to season; the whole table's 53.8%, because six stables draw 60 cards from 86. The row asks whether a player's third play-through is samey, which is a seat's question; both numbers are printed |
| 2026-09-24 | **D9 — staff: two trainers dealt at the start; a trainer is one or two bonus rows and a derived cut; commission on purses only, after the winnings tax and the prize bonus** | §8.1–8.2. The engine reads a bonus, never a name, so a trainer is data. The cut is §8.2's table summed, plus 2% for a pair, capped at 10%. Commission is taken where the purse is paid and banked net; the income split counts the purse before it and the cut as a cost (`roadSplit`). 13.2% of a stable's purses at 800 seasons |
| 2026-09-24 | **D10 — "+1 to one stat a week" is one stat on one dog: the lowest-rated dog's weakest stat** | Built first as +1 to every dog, a 3% trainer was worth ~3,900 of end worth and mean end worth left its band (40,449). Measured by regressing end worth on the dealt bonuses — the deal is random, so it is a clean experiment. Read as written, it is worth ~640. The cuts for +5 recovery (5%), next week's prices (8%) and +10% prize money (6%) were re-priced by the same regression |
| 2026-09-24 | **D11 — a trainer's style read is public** | C4: nobody knows a style privately. The trainer "has a word around the kennels", the best-rated unread rival dog is made public to the whole table, and what the stable buys is which dog. As D1 did for tips on styles |
| 2026-09-24 | **D12 — "less likely to go badly" is a kit helper, `risk()` / `luck()`, not a branch** | Nineteen mishap rolls across the deck read the stable's staff through it. Gambles — cards, dice, arm-wrestles, match races, the slot machine, a dog offer's lie — stay on `rng.chance`: a trainer who made you better at dice would be an edge, not a minder. With no such trainer each helper is the same single draw |
| 2026-09-24 | **D13 — sabotage: a nobble is booked against a dog; the stewards draw once per stable every race day** | §9.3. Explore comes before the Race Office, so the job names a dog and bites if it runs, on the runner, after the book has priced it. The catch draws are made whether or not a job was booked, so the game's stream never depends on a door (a determinism test checks it). Freely targetable; Normal's rule is the best-rated rival dog on offer if it outrates its own best, with six times the price in cash. 69% of seasons see one |
| 2026-09-24 | **D14 — the bought box is a Race Office action (`ChooseBox`), honoured at the lock, not rolled for by the stewards, and worth ~2 points** | The right is bought at Explore and spent once the race is known; it is placed after the shuffle and the wide runners, before the book prices the field. The stewards do not enquire into their own man. `race/draw.ts` still said v2's 3.5 points (D37); re-measured on the v3 race model it is +2.1 tight, +1.2 medium, +0.7 wide, 0 on a straight, and the screens read it |
| 2026-09-24 | **D15 — Hard reads the field: the board in its entries, the field's shape at the bookie; and a card can have a `hardChoice`** | §7.3, §5.6, §14. Worth ~1,200 of Hard's mean and nothing measurable in the head-to-head (50.7% at 800 seasons; each piece inside the standard error; all five off 52.8%). Hard's own betting spread is what holds its median under Normal's: with Normal's bets it reads 54.4% |
| 2026-09-24 | **D16 — the plan-the-week press is dropped: the week's state follows the declarations** | Jesse's call. Race/Rest was inert for an undeclared dog, so the Race Office sets it — a declared dog races, the rest rest — at arrival, on every Declare and at the lock, and the Kennels shows it. `hub-clicks` 11.3 → 9.4 (fixed presses 8 → 7; the Kennels is no longer worth a weekly walk) |
| 2026-09-24 | **E1 — the free local runner is deleted; the vet cards are §4.4's one guard** | Jesse's call before Phase E1. D2 found an injury nearly free because of the runner: an injury almost always lent the stable a Bronze runner. Deleted whole (`lendRunners`, `Dog.loan`, `Player.loanerId`, `localRunnerFitAt`). Measured: races entered 2.16 → 2.11 a weekend, races per dog 6.59 → 6.47, mean end worth unchanged, injuries 1.15 → 1.14 a stable-season. The injury-halving trainer's coefficient barely moved (−1,188 → −1,156, se ~320). So an injury was cheap because the stable raced its other two dogs, not because of the runner, and the injury rate was not tuned |
| 2026-09-24 | **E2 — game length is set up front: 1–5 seasons or a target; no length means one season** | §2.1. `SeasonSetup.length` is optional so a pre-E setup, seed link or harness call means what it meant. The limits (1–5), the targets (60,000 and 150,000) and the cap (10 seasons) are sheet cells. `finalStandings` is the game's, and each finished season is archived (standings, stats, Gold Cups, wins, calendar). `stats` stays per season, and game totals are summed from the archive |
| 2026-09-24 | **E3 — Target mode checks worth once, at the end of each weekend after the dinner; ties go to Gold Cups, then races won, across the game** | §2.1, §2.4. The check reads the same figure as `worthByWeek`. Because it is the only check, the richest stable at that moment has always crossed, so "not necessarily the stable that crossed" can only happen as two stables crossing together or a leader caught on the last weekend. `--game` reports both. v2's second tie-break (most Majors) becomes §2.4's races won |
| 2026-09-24 | **E4 — the off-season runs age → retirement (offer first) → staff notice → carry-over, and every answer is an Action** | §2.2. `Retire { dogId \| null }` and `ResolveStaffNotice { hire }`, then EndPhase, at most three presses. Our reading of "you see what you are being offered before you accept": the offer is on screen before the choice to retire *name* or keep them all. Carried over: cash, cargo, You Paid, dogs (fitness and layoffs included), trainers, styles and `dealtGone`. Cleared: the calendar, prices, conditions, jobs, bets, declarations, results, the log, and `intel`, which is keyed by week numbers that repeat |
| 2026-09-24 | **E5 — each stable's off-season runs on its own stream, rolled in full when it opens** | Decision D1's pattern. The game's stream draws one seed per stable in seating order and nothing else. From its seed each stable rolls its offer and its trainers' notices, then its candidate in a second pass once everybody's leavers are in the pool. Answers draw nothing, so no choice moves the game's stream or another stable's draws, which a determinism test checks |
| 2026-09-24 | **E6 — age ticks in the off-season only, not at week 7** | §4.3 as written. The week-7 tick was a build artefact, never a rule, and removing it means a one-season game has no ageing. One-season mean end worth went 39,194 → 42,151 (band 25–40k); all of the rise is dog book value. Jesse's call: leave it and report. It also moved the betting rows: a stable dog backed blind went +1.5% → +2.6% (the band is ≤ +2%), because young dogs now grow all season while their rating lags. `oddsScale` was not touched |
| 2026-09-24 | **E7 — "mathematically out" is a purse definition: at the start of week 8, worth plus every first-place purse left in the season is under the leader's** | Defined before it was measured. Multipliers and the stable's prize-money trainers are counted; commission, tax, trading and betting are not. One-season games: 0.0% of stables out ✅. In the last season of a long game the gap has grown for years: 12.8% of stables are out in 3-season games, 42.2% in 5-season games and 27.8% in 150,000 games ❌ reported. Pillar 5 holds for a season, not for the fifth season of a long game |

---

## 14. Open questions ❓

1. **Does free-target sabotage survive contact with eight friends?** §9.3. Either the best part of
   the evening or the end of it, and nothing but playtest will say which. *`v3d2`: built freely
   targetable (D13). All-AI, 69% of seasons see a nobble and 45% of nobbles land on the leader
   without any rule saying so — the leader's dogs are the best-rated. Caught 36% of the time; the
   `v3d2` checklist asks it.*
2. **How big is the field-shape betting overlay?** §5.6. If backing the lone closer blind beats the
   margin, the book needs to see one more thing.
3. **Is one race enough to read a style?** §5.4 assumes yes, on the strength of the commentary. If
   it takes three, styles arrive too late to use in a ten-week season.
4. **Is an injury too punishing with three dogs?** §4.4. The free local runner is the guard; the
   base rate is the dial. *`v3d1`: both guards are built (D6) — the runner, and a vet behind the
   Pound and the Back Alley.*
   *`v3d2`: perhaps not punishing enough. A trainer who halves injuries is worth nothing
   measurable, because an injury nearly always lends the stable a free Bronze runner: the stables
   with half the injuries raced slightly less (21.4 v 21.8 a season).*
   *`v3e1`: the runner is gone (E1), and that changed almost nothing. Races entered went 2.16 →
   2.11 and the halving trainer still reads about −1,160. An injury costs little because three dogs
   and a fitness budget already keep one dog resting most weeks. If it should hurt, the base rate is
   the dial. The `v3e1` checklist asks whether injuries felt worse.*
5. **Should the three races run in split view?** §7.5. Cuts watching time by two thirds at a cost
   in drama.
6. **Does the Target mode produce a good ending or an anticlimax?** Somebody crossing the line on
   week 4 of season 2 may end the game before it has a shape.
   *`v3e1`: built (E2, E3). At 60,000 a game lasts 13.2 weekends (p10 10, p90 17), which is usually
   week 3 of season 2, the case this question worries about. At 150,000 it lasts 40.6 weekends,
   finishing in season 5. The leader going into the last weekend loses 27% / 12% of the time, and
   two stables cross together 9% / 6.5%. Whether that is worth watching is E2's playtest row.*
7. **Are 80 events enough for a fifth play-through?** §9.1. The deck is the whole content budget
   now. *`v3d1`: 86 before D2's staff and sabotage; a seat sees 13% of last season's cards again.*
8. **Do 18 planets still feel distinct** when the only things that vary are the track, the food band
   and the three doors? §12. *`v3d1`: the doors are named (54) and some cards lean on a planet; the
   `v3d1` checklist asks it.*
12. **Is Explore worth its clicks?** §10.1. It costs 1.75 presses a weekend and `hub-clicks` reads
   11.3 against 10.5 (D7). Race/Rest is inert for an undeclared dog, so retiring the weekly "plan
   the week" press would pay for it — a presentation change for Jesse to call.
   *`v3d2`: Jesse called it (D16). The press is gone and the week follows the declarations;
   `hub-clicks` reads 9.4 with Explore and the steward's box counted.*
9. **Should the book price fitness and form?** §5.6 says yes, §1.1 says ratings and styles, and the
   code has only ever priced the rating (C6). Pricing fitness would close the edge a player who reads
   the card has over the book — the only one left since the Fixer went.
10. **Is there a field-shape rule worth having?** The contest rule was cut (C3), so the shape of a field
   barely matters and §7.3's board is read for the *trip*, not the field. A rule that paid closers
   against a crowded front would have to be about closers — or the kill switch's floor is wrong for
   an eight-dog field, where one runner can only ever collect a fraction of what the others lose.
   *`v3c2`: the hot pace (C12) is that rule, and the floor was wrong. With the calendar held even,
   an eight-dog field gives the closer about two points (C13). Jesse's `v3c2` playtest: he saw a hot pace
   and the closer come through, and it changed his entries — his closer went into the crowded race.*
11. **Are the races too processional?** The median winning margin is 10.6 m (v3b 7.3 m) and a photo
   finish comes up in 1.8% of races, because the fade in metres (C5) no longer drags the field back
   together at the line. Nothing measures it against a target; the race view is where to judge it.
   *`v3c2`: Jesse said yes, too spread out. The run-in (C14) gives a median of 6.3 m and 3.5% photo
   finishes. Whether the last metres look like braking is the question to watch. Jesse's `v3c2` playtest:
   finishes feel "a little" closer, and he did not notice the run-in at all — so it does not read as
   braking. Nothing felt worse than `v3c`.*

---

## 15. Deliberately out of v3

Kept as a list so ideas have to earn their way back in.

- Breeding, bloodlines, stud fees.
- Any market other than food.
- Buying or selling dogs, staff, ship parts, gear or information.
- Loans, debt, bankruptcy, elimination.
- Fuel, upkeep, wages.
- A fourth stat, a fourth running style, a seventh food.
- Race types gated on anything but purse.
- Championship points, reputation, sponsors as a system.
- Throwing your own races.
- Weather, going and track bias as separate systems.
- Lay betting.
