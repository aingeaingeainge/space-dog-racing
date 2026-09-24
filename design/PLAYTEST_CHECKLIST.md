# Space Dog Racing — playtest checklist

> **Current section: "v3 Phase E2 — the table", directly below.** It is the playtest for tag `v3e2`
> and closes BUILD_PLAN_V3 Phase E's four 🎲 rows. Everything after it — the "One season" template
> and the two seasons filled in on 7 September 2026 — is **v1's checklist (milestone M1)**, kept as the
> record of what those seasons found. Its venues (the Docks, the Saloon, borrowing) no longer exist.

---

## v3 Phase E2 — the table

Three to eight people round one laptop. What `v3e2` needs from a table is four timed games and four
answers. The game times itself: nobody has to start a stopwatch.

### The four timed rows (BUILD_PLAN_V3 Phase E)

| Row | Target | Setup | This table's time |
|---|---|---|---|
| 1 | ≤ 25 min | 4 humans, 1 season, **races skipped** (press "Skip the rest of race day" each weekend) | |
| 2 | ≤ 40 min | 4 humans, 1 season, races **watched** | |
| 3 | ≤ 70 min | 8 humans, 1 season | |
| 4 | worth watching | any table, **Race to 60,000** (or a figure of your own), played to its finish | |

AI stables can fill a table out, but they do not count as humans: rows 1–3 are about people passing a
laptop. Four humans and two AIs is fine for rows 1 and 2.

### How to read the timer

The game-end screen has a panel, **"The clock"**:

> This game took *m* minutes, *s* a weekend, of which race day *r*.

Under it, a weekend is split four ways:

- **private screens**: a door and its card, the market, the kennels and the Race Office, the Bookie
- **race day**: the race view, the locked card on a no-bookie weekend, and the results
- **passing the laptop**: the "Pass to …" screens
- **the table's own screens**: the arrival (the planet and the turn order), the locked board before
  the Bookie, and the roll-call after the races

Between seasons (the season's end and the off-season) is counted separately and is in the total.

Three things to know:

- A stretch on one screen counts for **ten minutes at most**, and the clock **stops while the window
  is hidden**. A laptop left open over dinner does not make the game slow.
- The clock lives in the save's UI block, so it survives a reload. **"Play again" starts it from
  zero.** It is wall-clock time and never enters the game: the same seed and the same presses are the
  same game however long they took.
- Row 1 minus row 2 is roughly what watching costs. If race day is most of a weekend, that is the
  split view question (GDD_V3 §7.5's ❓).

### What the passing should feel like

- The laptop moves **only when somebody's private business is about to go on screen**, and the pass
  screen says who is next and why ("Market, Kennels and Race Office — in turn order …").
- The arrival, the locked board and the roll-call after the races are **public**: read them together.
  Their button is the pass when the laptop has to move ("I am Jesse").
- **The Bookie is in any order**: whoever holds the laptop after the Race Office bets first.
- After the races, each human **flies on from the roll-call** with one press; only somebody who wants
  to trade takes the laptop.
- Slips are private: each human sees their own settled slips on their next private screen (the next
  door, or the off-season), not on the public results.

`hub-clicks` measures the loop at `v3e2`: 10.7 passes a weekend at four humans (14.5 at `v3e1`) and
22.4 at eight (30.4). If it feels like more than that, something is wrong.

### Still unplayed by a human (carried from the `v3e1` checklist)

Jesse's race to 60,000 ended at week 6 of season 1, so nobody has yet reached an off-season. Play a
**two- or three-season game** at least once and answer these:

1. **Did a second season feel different from the first?** *Yes, the kennel had changed · A bit, the
   ages showed · No, it was the same season again*
2. **Was the retirement a real decision?** *Yes, I weighed the offer against my dog · Easy, an old dog
   had to go · I always kept them all · The offer was never worth it*
3. **Did starting the season fresh feel right?** (new in E2: every dog back to full fitness, layoffs
   healed) *Yes · It made the off-season too kind · Didn't notice*

### One game, filled in

| | |
|---|---|
| Date | |
| Seed, and the game's length | |
| Humans / AIs | |
| Races skipped or watched | |
| **The clock**: minutes, a weekend, race day | |
| Who won, and how (seasons ran out / target crossed) | |
| Did the game-end screen tell the story of the game? | |

---

# v1's checklist (milestone M1) — historical

From BUILD_PLAN §7. Fill this in after **each** season you play (M1 asks for two, M4 for two more).
Copy the whole "One season" block per playthrough. When you are done, write the findings up in
`design/PLAYTEST_NOTES.md` and bring them to the next planning conversation — rule changes go into
the GDD decision log *before* the next build session.

Build under test: milestone M1 (no race animation, no art — those are M2 and M3).

---

## One season

| | |
|---|---|
| Date | |
| Seed | |
| Stables (human / AI, difficulty) | |
| Toggles (Clean Sport / No Betting / No Trading / Casual events) | |
| Wall-clock time, start to podium | |
| Where you finished, and net worth | |
| Champion, and their net worth | |

### The five questions BUILD_PLAN §7 asks

1. **Did the Bronze/Silver decision ever feel hard?**
   Which week, and what made it hard (or what made it obvious)?

   >

2. **Did you ever want to bet against yourself?**
   Did you? What did it pay?

   >

3. **Did any purchase feel pointless after week 8?**
   Ship upgrades, kennel gear, a dog, a staff member — anything you regretted or would never buy again.

   >

4. **Did a Major swing the season?**
   Which one, and did it feel earned or arbitrary?

   >

5. **Was there a week where nothing happened?**
   Which week, and what would have made it matter?

   >

### Did every venue earn its place?

Tick what you actually used, and say in a line whether it was worth the click.

- [ ] **Market** — bought a dog / sold a dog / compared with your own
- [ ] **Kennels** — track-day pass / racing muzzle / supplement / read the traits
- [ ] **Docks** — engine / cargo hold / kennel module / cold store / traded kibble
- [ ] **Saloon** — hired staff / set a training focus / borrowed / repaid
- [ ] **Bookie** — win bet / place bet / backed your own dog / backed against one
- [ ] **Race Office** — the declaration itself

>

### Money

| | |
|---|---|
| Cash at week 1 / 5 / 9 / 13 | |
| Biggest single win | |
| Biggest single loss | |
| Did you ever borrow? From whom, and did it work out? | |
| Did the weekly bill ever surprise you? | |
| Roughly what share of your income was prize / trading / betting? | |

### Legibility

- [ ] I could always tell **why** a dog won or lost.
- [ ] I knew what each planet's special rule did to me **before** I spent money.
- [ ] Traits meant something I could act on.
- [ ] Fitness and form were visible when they mattered.
- [ ] I understood the odds well enough to bet deliberately rather than at random.
- [ ] The turn order and its reason made sense.

Anything you had to guess at:

>

### Pace

| | |
|---|---|
| Minutes per weekend, roughly | |
| The screen you spent the most time on | |
| The screen you skipped | |
| Did 13 weeks feel right, short or long? | |

### Blockers and bugs

| Week | Screen | What happened | Reproducible? |
|---|---|---|---|
| | | | |

### Balance notes for M4

Anything that felt too strong, too weak, or too safe — Majors, Gold purses, food margins, the
bookie's margin, the loan sharks, doping, local dog ratings.

>

### One line

If you had to change **one** thing before the next session, what?

>

---

## Standing questions carried from the GDD (§20)

- Major purse share is ~56% of the season. Too swingy? (Alternative: ×2.0 / ×3.5.)
- Retire dogs at age 7 with a stud payment, or let them decay?
- Reputation as a visible stat — v1 or v2?


---

# Filled in

## Season 1 — 7 September 2026

| | |
|---|---|
| Date | 7 September 2026 |
| Seed | not recorded |
| Stables (human / AI, difficulty) | 1 human + 5 AI, all Normal |
| Toggles | all default — nothing switched on |
| Wall-clock time, start to podium | 30–45 minutes |
| Where you finished, and net worth | mid-table; worth not recorded |
| Champion, and their net worth | not recorded |

### The five questions BUILD_PLAN §7 asks

1. **Did the Bronze/Silver decision ever feel hard?**

   > Sometimes, at the Majors — the purse multiplier was what made racing a dog up a class worth
   > the risk. The rest of the time it did not really bite.

2. **Did you ever want to bet against yourself?**

   > Yes, and I did. It did not pay — the stake went down the drain.

3. **Did any purchase feel pointless after week 8?**

   > A dog or a staff member: something in the kennel or on the wage bill was still being paid for
   > and no longer earning.

4. **Did a Major swing the season?**

   > It helped, but it did not decide it. The season was built on the regular weekends.

5. **Was there a week where nothing happened?**

   > No — every week had something worth doing.

### Did every venue earn its place?

- [x] **Market** — bought and sold dogs, compared against my own kennel
- [x] **Kennels** — fed supplements (see below)
- [x] **Docks** — kibble and/or a ship upgrade
- [x] **Saloon** — staff and/or a loan
- [x] **Bookie** — put bets on
- [x] **Race Office** — the declaration itself

> All six were used in the first season, without being prompted to go looking for them.

**Shady options:** used supplements and was never caught.

### Money

Not recorded in this pass (see the quick-pass note at the end).

### Legibility

Not walked through line by line this time; nothing was flagged as unclear.

### Pace

| | |
|---|---|
| Minutes per weekend, roughly | ~2.5–3.5 (30–45 minutes over 13 weeks) |
| Did 13 weeks feel right, short or long? | inside the 45–60 minute target |

### Blockers and bugs

| Week | Screen | What happened | Reproducible? |
|---|---|---|---|
| — | — | Nothing broke. No console errors, no screen that misbehaved. | — |

---

## Season 2 — 7 September 2026

| | |
|---|---|
| Date | 7 September 2026 |
| Seed | not recorded |
| Stables (human / AI, difficulty) | 1 human + 5 AI, all Normal — same setup as season 1 |
| Toggles | all default — nothing switched on |
| Wall-clock time, start to podium | over an hour |
| Where you finished, and net worth | **won it**; worth not recorded |
| Champion, and their net worth | me |

**What changed from season 1:** played it through the economy — worked the market, the kibble
trade and the shops much harder than the first time. That is what turned mid-table into a win.

### The five questions BUILD_PLAN §7 asks

1. **Did the Bronze/Silver decision ever feel hard?**

   > No — still obvious. Second time through, with the screens understood, the best dog to each
   > race picked itself every weekend. **This is the standing risk in BUILD_PLAN §11 and it is now
   > observed twice: the assignment puzzle is not carrying the weight the GDD's first design
   > pillar gives it.**

2. **Did you ever want to bet against yourself?**

   > Barely bet at all this season. Prize money and trading were the game; the bookie did not pull
   > me in once the economy was open.

3. **Did any purchase feel pointless after week 8?**

   > Again a dog or a staff member — the same shape of waste as season 1.

4. **Did a Major swing the season?**

   > Yes — the Grand Final. Week 13 at Collar Prime was where it was decided.

5. **Was there a week where nothing happened?**

   > No — every week had something.

### Did every venue earn its place?

- [x] **Market** — bought and sold dogs
- [x] **Kennels**
- [x] **Docks** — kibble and/or a ship upgrade
- [x] **Saloon** — staff and/or a loan
- [x] **Bookie** — put bets on (small)
- [x] **Race Office** — the declaration itself

### Money

Not recorded in this pass. Worth capturing next time: the prize / trade / betting split, since
this season was won on trading and the harness reports the AI's trade income as slightly negative.

### Pace

| | |
|---|---|
| Minutes per weekend, roughly | ~5 (over an hour across 13 weeks) |
| Where the time went | working the shops every week — six venues × two planet phases × 13 weeks |
| Did 13 weeks feel right, short or long? | **over the 45–60 minute target once every venue is in use** |

### Blockers and bugs

| Week | Screen | What happened | Reproducible? |
|---|---|---|---|
| — | — | Nothing broke. | — |

### Balance notes for M4

> **Gold purses are too big** — one good Gold dog snowballs the whole season. (The harness agrees:
> the champion won at least one Major Gold in 96% of 50 seasons, and the end-worth p90 is about
> twice the mean.)
>
> The shady options did not tempt: supplements were used in season 1 and never caught, and never
> felt like a real decision either way.

### One line

> **Make the shady options tempting.** Supplements, sabotage and steward bribes are supposed to be
> a real pull with real teeth (GDD pillar 5) and right now they are neither.

---

## What these two seasons say, in short

1. **The weekly assignment decision is too easy.** Asked twice, answered "hard only at Majors" then
   "still obvious". BUILD_PLAN §11 predicted this failure mode. Candidates: tighten the caps, lift
   the local dogs' ratings towards the GDD's 35/57/78, or flatten Bronze→Silver→Gold purses so
   racing up is a genuine gamble rather than an obvious yes at Majors and an obvious no elsewhere.
2. **The shady options do not tempt.** Nothing about the supplement's 15% base catch rate, its
   +8 speed for one race or its 400 Bones made it a decision worth agonising over. Needs either a
   bigger prize or a scarier penalty — and the Fixer's sabotage and bribes have never been used at
   all.
3. **Gold purses snowball.** Confirmed by both the playthrough and the harness. This is GDD §20 Q2
   (Major purse share ~56% of the season) coming due; the alternative ×2.0 / ×3.5 multipliers are
   the obvious thing to test with the harness in M4.
4. **A player who works the economy beats one who does not** — mid-table to first place on the same
   setup, which is the right shape for the game, but note it took an hour. Six venues × two phases
   × 13 weeks is a lot of clicking; M3's hub hotspots and some keyboard shortcuts in M4 should pull
   the per-weekend time back towards the 3.5-minute budget in GDD §3.
5. **Nothing broke in two full seasons**, and every venue was used in both without prompting.

*Recorded from a spoken pass over the checklist, so the seeds, the cash-by-week figures, the income
split and the legibility line-items are not filled in. Worth capturing on the next two seasons
(M4), where the harness numbers can be compared against them directly.*
