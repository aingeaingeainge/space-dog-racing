# V2 Phase B build notes — the card and the fog (12 September 2026)

**Status: Phase B complete, tagged `v2b`.** Eight commits on `main` after `e9072d6`, **not
pushed** — the bundle and the two commands are at the end.

The golden snapshot moved **exactly twice**, as the brief required: `d0a4d05` for the `RaceType`
shape change and `434bf13` for the seven types. Every other commit leaves it byte-identical and
`npm test` is 22 green at each. `properties.test.ts` gained three invariants and edited none;
`determinism.test.ts` needed no changes at all.

---

## The one sentence that mattered most

> "season feels ok for now, not much feels like it's changed."

**Why a player will now open the Kennels, specifically.** Under v1 and Phase A every dog raced
every week, so the Kennels was a screen with nothing to decide. The card changes the arithmetic:
a Normal stable owns about five dogs and enters **1.90 of the weekend's three races**, so on a
typical weekend **two or three dogs have nothing to do** — not because you chose to rest them,
but because nothing on the card will have them. The Kennels is the only screen that says so, and
it is where you decide whether an idle dog trains or rests. A pup you train in week 4 is the dog
that fills week 8's Juvenile.

And the Race Office now prints the price. Phase A's real failure was structural, not numerical:
every dog defaults to Race, declaring one sets it to Race, and the declaring screen never
mentioned fitness, so a player could walk from the hub, declare their best three and end the turn
having played v1 exactly. There is now a **week ledger** above the card — every dog, its rating,
its fitness now, and the number it lands on next week if it runs against if it rests — and every
fitness line in the Kennels names the number as well as the delta. "−25 fitness" is a rule;
"74 → 49" is a decision.

That is the change I would ask you to feel for. The harness rows are below, but the question is
whether week 6 now involves a dog you cannot enter anywhere and have to find a use for.

---

## What was built

Eight commits, in order:

| | |
|---|---|
| `feb81ea` | The week ledger, the entry criteria on the stubs, "why this dog cannot run" |
| `d0a4d05` | **`RaceType` as a row — snapshot move 1**, three classes still in it |
| `434bf13` | **The seven types and the weekly draw — snapshot move 2** |
| `e43df51` | Harness part 2: cardCoverage, fill, purse share, concentration, `--card` |
| `4ff8994` | The fog: a dark map, dossiers, re-tuned rumours, the AI horizon guard |
| `56d4fcb` | `autoplan%`, and the report that `apLoss%` cannot answer its question |
| `e1fd218` | Hard buys for coverage; the Easy attempt, measured and reverted |
| `2d54f03` | GDD 0.4 and the acceptance table |

---

## ⚠️ The biggest call: D15's purse cut was measured and **not applied**

The brief said this was "the session's most likely place to do real damage by following the plan
literally", and having measured it, I think that is exactly right. The pool stays at **19,250** —
the Open takes the old Gold and each drawn race the mean of the old Bronze and Silver, to the
Bone. Four measurements, and they point the same way.

**1. The card already cut the economy, by cutting the fill rate rather than the pool.** Stables
now enter 1.90 of three races instead of pointing their best three at whatever is going, races
per dog fell 5.2 → 4.8, and mean end worth went **33,160 → 30,714 on an unchanged pool: −7.4%**.
Part of D15's intent has already arrived.

**2. The fill rate went *down*, and D15 assumed it would go up.** §6.3 hoped a fact-gated card
would raise how much of the card a stable fills, which is what would have paid for the cut. It
does the opposite, so the cut costs more than the plan assumed rather than less.

**3. The cut cannot reach its own target, and it is not close.** D15 exists to move prize money
from 87% of income toward 65%. Measured properly for the first time — gross, off the cash each
action moves, because `tradeIncome` is sold-minus-bought and cannot answer "where did the money
come *in*" — 800 all-Normal seasons:

| | prize | dogs sold | bets returned | food sold | prize share |
|---|---|---|---|---|---|
| Normal | 31,334 | 3,022 | 3,294 | 700 | **81.7%** |

The three non-racing rows total 7,016 and **a purse cut does not touch any of them**. Reaching
65% needs prize down to 13,000 — a **59% cut**. D15's own 24% reaches 77.6%. The ratio is not
reachable from the numerator; it becomes reachable when Phase C makes "food sold: 700" into
something else and Phase D gives betting a reason to be positive.

**4. It makes a missed target worse.** Races per dog is 4.8 against a 7–9 band, and the marginal
run is precisely the one that stops being worth the injury risk when the purse falls.

So the cut is Phase C's, sized against the roads it is meant to make room for. This is D22.

**One number to carry forward:** the posted pool is 358,685 a season and **52.4% of it reaches a
player** — v1 54%, Phase A 52%. The other half leaves the economy with the local dogs. Any future
cut should be sized against the 52%, not the headline.

---

## The acceptance table, every row, met or not

| Measure | Target | Measured | |
|---|---|---|---|
| broad 5-dog stable fills all three | 55–70% of weeks | **76.3%** | ❌ over by 6 |
| one-dog-concentrated fills all three | ≤ 20% | **10.3%** / 13.0% / **0.0%** | ✅ |
| each race type used | ≥ 8% of all races run | 8.8% – 33.3% | ✅ every type |
| a maiden win costs future eligibility | entries fall after a first win | **5.64 → 4.85 → 4.11** | ✅ |
| prize share of a stable's income | toward 65% | **81.7%** | ❌ unreachable by cutting |
| season "decided by" week | later than v1's 7.6 | **6.4** | ❌ *earlier* |
| `concentration`, champion's mean | below 0.4 | **0.278** | ✅ |
| `npm test` | green, snapshot moved twice | 22 green, twice | ✅ |
| `npm run lint` | clean | clean | ✅ |
| `hub-clicks.ts` | ≤ 14.5 | **13.9** | ✅ under Phase A's 14.0 |

### The three misses, and what each is

**Broad stable 76.3% against 55–70%.** The card is more forgiving to a well-spread stable than
GDD 0.3's estimate assumed. The concentrated rows land almost exactly on 0.3's predicted 14%, so
the model was right about the punishment and generous about the reward. It may not matter, and
this is the useful part: **the probe measures eligibility, and in a real season eligibility is
not the binding constraint — fitness is.** A broad stable *may* fill the card 76% of weeks and
actually fills it 20.4%. The gap is Race/Train/Rest. Worth deciding whether the band was ever the
right target (GDD §20 Q13) before tuning toward it.

**Prize share 81.7% against 65%.** Arithmetically unreachable this phase; see D22 above.

**Decided by week 6.4 against "later than 7.6".** The season is being settled *earlier*, and the
likeliest cause is the same arithmetic: three contested races a weekend became 1.90, and fewer
purses in play means fewer chances to overturn a lead. The design already has the lever — the
Consolation is the one catch-up mechanic — and it is enterable on only **29%** of the weekends it
runs, because the dog that qualifies for it is by definition the dog that raced last week and is
25 fitness down. **Widening its reach to two weekends is the obvious first thing to try, and it is
a rule the GDD does not cover, so I did not do it.** It is GDD §20 Q12 and it wants your answer.

---

## cardCoverage — the number that says whether the card is a decision

800 all-Normal seasons. The share of the weekends a type ran where a stable had a **fit, eligible**
dog for it:

| | Open | Novice | Maiden | Handicap | Juvenile | Invitational | Veterans | Consolation |
|---|---|---|---|---|---|---|---|---|
| coverage | 99% | 97% | 91% | 85% | 63% | **45%** | **30%** | **29%** |
| player entries | 40.0% | 13.4% | 12.5% | 12.4% | 8.4% | 5.9% | 3.7% | 3.8% |

Filling the card: **all three 20.4%, two 51.9%, one 25.5%, none 2.2%** — mean 1.90.

Veterans and Consolation at ~30% are both structural rather than broken. A stable starts with
dogs aged 2–4 and the age tick is week 7, so about 70% of stables have a veteran and only from
week 8: 0.70 × 6/13 ≈ 32%, which is what the harness reads. The Consolation's tension is real
design — qualifying for the catch-up race and being fit enough to take it pull against each other
— but at 29% it is barely a mechanic, which is why Q12 above matters.

---

## ⚠️ The two posted numbers were fitted, not chosen (D23)

Handicap cap **45**, Invitational floor **48**. Both started at 55, which is the obvious first cut
and wrong at both ends:

| cap / floor | Handicap coverage | Invitational coverage | fill (mean) | all three |
|---|---|---|---|---|
| 55 / 55 | 97.5% | 12.5% | 1.87 | 18.2% |
| 50 / 52 | 94.1% | 20.8% | 1.88 | 18.7% |
| **45 / 48** | **85.5%** | **45.8%** | **1.90** | **20.6%** |
| 40 / 45 | 63.7% | 65.7% | 1.91 | 20.3% |

At 55 the Handicap could be filled on 97.5% of the weekends it ran, so it asked nothing, and the
Invitational on 12.5%, so players took **1.2%** of its entries and the locals owned a tenth of the
card. One point apart at 45/48 means ratings 46 and 47 sit outside both and nothing else does.

**The local re-fit D17 promised did not turn out to be needed** (D24). Expressing the locals by
purse tier — The Open 50, a drawn race 30 — landed the purse share at 52.4% first time, against
v1's 54% and Phase A's 52%. The rating *window* is then squeezed by the row's own criterion, which
is how the Handicap's locals come out under its cap and the Invitational's at its floor.

---

## Two instruments that turned out to be measuring nothing

**`apLoss%` cannot work as §7a.3 specifies (D25).** The spec asks for two rollouts "on the same
downstream seed". There is no such thing: `GameState` carries one rng stream, so the moment the
forced plan consumes a different number of draws, the rest of the season is a *different random
season*. Each sample is one decision plus thirteen weeks of variance — sd **20,041** — and the
mean reads **−1,047 ± 1,231**, inside two standard errors of zero.

I nearly acted on it. The first run came out −1,856, which would mean the naive "enter everything"
plan ends *richer* than Normal's fitness rule, so I swept Normal's `raceAbove` at 65 / 60 / 55 /
52 / 50 expecting races per dog to move. **It does not move at all** — 4.8 at every setting, mean
end worth flat to falling — because the fill rate is limited by what a stable is eligible for, not
by what it is fit for. Normal is unchanged. The printout now prints the standard error next to the
mean and says in words when the answer is noise.

Fixing it needs the engine to fork a per-decision rng stream so two rollouts share their
downstream draws. That is a real change to how randomness is threaded.

**`autoplan%` works and is exact: 8.8%**, over 7,800 stable-weeks — 32.3% on the entries alone and
27.3% on the states alone. That is below the 15–30% band, which on its own would read as "the
player cannot find the plan". The honest gloss is narrower: Normal's plan and the naive plan
rarely coincide, which is not the same as either being right, and with apLoss silent there is
nothing to say which.

---

## The fog, and the AI audit

The Galaxy Map shows this planet in full, next week by name and Major status, and the rest as
hatched, redacted rows. The Majors stay public — weeks 4/7/10/13 and the Collar last — so the
rhythm is plannable while the content is not.

**The dossier adds nothing to GameState, deliberately.** The circuit is already in `calendar`
because the reducer has to build it; the fog is a rule about *who may look*, and "this stable paid
to look" is a fact the action log already carries. So a dossier is a `BuyUpgrade` naming a week —
650 Bones, reaching two weeks (next week is free, so what you buy is the week after) — and the
client shows what that stable's own log entitles it to. No `Player.intel`, and **no third snapshot
move**, which is the constraint that shaped the design.

`lib/rumours.ts` re-tuned: horizon **4 → 2**, `NOTABLE` 14 → 10, `CHATTER` 0.55 → 0.75. Four weeks
was written when the map printed every band for the whole season, so a rumour hinted at something
already in a table; with the map dark it is the only free look past next week and four weeks of
them would hand back most of what D5 took.

**⚠️ The AI audit came back clean, and I made it stay clean.** Every read of the future was already
inside the free horizon: `tradeFoodPlan` and Hard's Blackreach hold-fill both look one week ahead,
and `weeksToMajor` scans the calendar for something §4.1 makes public. But nothing *enforced* it,
and nothing would have failed if a later change broke it — Hard would simply have stayed quietly
too good, which is exactly the failure the brief warned about. `planetAhead` now throws past
`FREE_HORIZON` rather than returning a planet.

**Two of §9.3's four carriers are deferred and named.** The Tipster is Phase C's staff ladder. The
information event cards are Phase C too, because adding a card re-weights the whole deck and moves
the golden snapshot — §11 gives the deck two new jobs and the other one, Prime offers, is Phase
C's, so they should land together in one move rather than two.

---

## The AI, and one honest failure

**Hard buys for coverage (D27).** The fact-gated card is the first thing that makes a coverage gap
exist — under Bronze/Silver/Gold every dog could enter the top class. A market dog is now credited
with rating points for each race type the kennel cannot field a runner for, and `sellAgeingDog`
will not sell the last dog that could take a Veterans trap.

Ablation at `coverageGain` 0 / 4 / 8 / 14 / 20: head-to-head against Normal reads 56.7 / 56.8 /
57.4 / 56.6 / 56.5 — **±0.7 points, inside the noise**. What it *does* move is coverage: against
Normal on the same card, Juvenile 72.3% vs 63.4%, Invitational 52.3% vs 45.1%, Maiden 94.7% vs
91.2%, and it fills all three races 21.7% of weeks against 20.8%. Kept on the same footing as M4's
Bronze throw and Phase A's train-through-cheap-weeks.

**Easy was tried and reverted, and the negative result is the useful part (D26).** The brief
offered the card as a third option — an Easy that wastes its good dogs in the wrong races. I built
it (walk the card in printed order, best qualifying dog into the first race that will have it, so
its good dog goes in a 2,600 drawn race and The Open's 5,800 goes to the leftovers) and swept the
skip rate at 0.0 / 0.1 / 0.2 / 0.3 / 0.5 / 0.65 / 0.75 / 0.85.

It does not work, for a reason worth writing down. **At the same skip rate the new Easy is
*stronger*, not weaker** — Normal beats it 74.3% against 77.9% at 0.85 — because what it replaced
was not "the right dog in the wrong race" but "a *random* dog in a random race", and
best-in-the-wrong-race beats random. Dropping the skip rate to make Easy visible costs the ladder
outright: at 0.3 it enters half the card and Normal beats it **50.0%**.

Easy's difficulty is structurally "does not turn up", and every other line §14 gives it — never
hires, never bets, never buys — is a *saving* in this economy rather than a handicap. The fix
needs a weakness that costs money while racing, and Phase C's goods market is the first thing that
will offer one. Easy is unchanged at 0.85.

---

## The full re-baseline

`npm run harness -- --seasons 800`, all Normal:

| | Phase A (`v2a`) | Phase B (`v2b`) |
|---|---|---|
| mean end worth | 32,674 | **31,600** |
| p10 / p50 / p90 | 9,803 / 25,732 / 69,644 | 8,052 / 25,836 / 67,035 |
| prize / trade / betting / costs | 32,544 / −4,126 / −930 / 15,630 | 31,334 / −4,021 / −842 / 16,433 |
| bankruptcy, Normal | 0.1% | 0.0% |
| fitness at declaration | 70.5, 21.5% under 60 | **72.1, 18.6% under 60** |
| races per dog | 5.2 | **4.8** |
| dogs at week 13 | 3.88 | 3.84 |
| purse share to players | 52% | **52.4%** |

`--ai easy,normal,normal,hard,hard,normal`, 800 seasons: **Normal beats Easy 77.9%** (target ~80),
**Hard beats Normal 56.0%** (target ~65; v1 60.6, Phase A 56.8). Hard's mean end worth is 39,614
against Normal's 29,724 and Easy's 12,578, so the *money* ladder is steep — it is the rank
comparison that is flat, because Hard's p10 (8,319) is barely above Normal's (7,515). Hard wins
bigger, not more often.

`--calibrate`: a balanced 65 beats seven 50s **58.5%** (band 45–60, near the top as predicted);
best-fit `oddsScale` 15.25 against the 15.5 in the sheet — unmoved from Phase A, as it should be,
since §6.2's constants did not change.

`--stats`: **24.2 / 19.2 / 16.1 / 15.3** on the standard 480, all four in band and in rating-weight
order. Accel still peaks on the sprint (17.2) and trap on tight bends (17.0). Stamina still flat
across distance — structural, unchanged, GDD §5.1.

`--pups`: a pup with a Rough trainer still reaches par at **week 8**, unchanged. The row that moved
is Gristle +2, now par at week 6 rather than 8 with 10/13 training weeks, which is the local
re-expression rather than anything about pups.

`--ai careless,normal,normal,normal`, 400 seasons: **careless bankruptcy 0.0%** — still Phase C's
per D20, and careless now *out-earns* nobody but ends on 29,622 against Normal's 32,018, which is
closer than it was. The card punishes it less than fitness did, because entering everything is
cheap when half of everything will not have you.

---

## Verification

| | |
|---|---|
| `npm test` | **22 green**, golden snapshot moved twice and no more |
| `npm run lint` | clean |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 5 seeds + the toggle variant, all to week 13, no `ActionError`, every log replays byte-identical; buys a dossier every other week so the new action and its refusals are both walked |
| `race-view-check.ts` | 195 races, every one replay-identical, 4 photo finishes |
| `hub-clicks.ts 20` | **13.9** a weekend (Phase A 14.0, Phase C's budget 14.5) |
| `asset-check` | 11 finished, 138 stand-ins, 0 missing |
| golden snapshot | `23fbf7ad…` → (shape) → (content) → `a478c0e6…` |

---

## Still open, for the playtest or Phase C

- **You have not played it.** The specific thing to feel: on a week where two of your dogs are
  barred from everything on the card, is finding them something to do a decision or a chore?
- **The Consolation reaches one weekend and is enterable 29% of the time** (Q12). It is the only
  catch-up mechanic and the "decided by" week went the wrong way. Two weekends is the fix and it
  needs your say-so.
- **`apLoss%` needs a forked rng stream** before it can measure anything (D25).
- **Easy needs a weakness that costs money while racing** (D26) — Phase C's market is where one
  becomes available.
- **Veterans coverage is ~30% and Hard's is worse than Normal's** (24.2% vs 29.8%), because buying
  pups churns the old dogs out faster than the last-veteran guard saves them.
- **`hub-clicks` is 13.9 and Phase C's budget is 14.5.** There is 0.6 of a click left for a busier
  market, a staff roster and the tier ladder. That is not much.
- **The purse cut, sized properly** (D22), in the same pass as the goods market.

---

## To push

Same as Phase A: the commits are real but they live in a clone in Anthropic's cloud, because the
shell into your folder still does not mount (`sandbox-helper: no Plan9 drive shares mounted`,
unchanged since 8 September). They arrive as **`phase-b.bundle`**, attached to the conversation.
Download it into the repo root, next to `package.json`.

Your `main` should be at `e9072d6` with a clean tree:

```powershell
git status                                  # expect nothing modified
git fetch phase-b.bundle "refs/heads/main:refs/heads/phase-b" "refs/tags/v2b:refs/tags/v2b"
git merge --ff-only phase-b                 # fast-forwards main onto the eight commits
git branch -d phase-b
```

Then check it is what these notes describe, and push:

```powershell
npm test                                    # 22 green
npm run build                               # -> packages/web/dist
npm run harness -- --seasons 200            # mean ~31,600
npm run harness -- --card                   # D2's two acceptance rows
npm run dev                                 # and go and play a season

git push origin main
git push origin --tags
del phase-b.bundle
```

**`package-lock.json` is untouched, so no reinstall.** Cloudflare Pages will build the push on
Node 20; nothing added needs anything newer.

Three smaller things:

- **The commits are authored `Claude <noreply@anthropic.com>`**, set before the first commit this
  time rather than rewritten afterwards. Your `Co-Authored-By` trailers are on every message.
- **`design/space_dog_racing_economy.xlsx` changed** and `balance.json` was regenerated from it
  with `npm run balance` — the JSON was never hand-edited. The Assumptions sheet lost the three
  class purses and two rating caps and gained two purse tiers, the Handicap cap, the Invitational
  floor, the two local-rating rows and the dossier's price and reach.
- **A v2a save will not load.** `STATE_VERSION` and `SAVE_VERSION` are both 3 and `readSave`'s
  version check drops an old save to the title screen rather than replaying it into a different
  game.
