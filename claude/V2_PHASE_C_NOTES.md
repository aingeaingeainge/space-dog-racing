# V2 Phase C build notes — the economy (12 September 2026)

**Status: Phase C complete, tagged `v2c`.** Four commits on `main` after `8c1c263`, **not pushed** —
the bundle and the commands are at the end.

The golden snapshot moved **exactly twice**, as the brief required: `671ec44` for the goods-record
shape change and `5a09c5f` for the content on top of it. The other two commits leave it
byte-identical and `npm test` is 22 green at each. `determinism.test.ts` needed no changes;
`properties.test.ts` gained two invariants and **re-expressed two** — the reason is below, because
the brief asked me to stop and work out whether I had broken something.

---

## The sentence this phase was measured against

> "If at the end of this session you cannot point at the screen where a player learns what Prime
> speed feed is worth to their dog, you have built the economy and not the game."

**The Docks, the feed counter, the column headed "What it does".** Pick a dog in the dropdown and
every row of the shelf says, in that dog's own numbers:

> Rosco: Speed 54 → 56–59 next Train week, rating 47 → 48 · Speed 71 and rating 54 by week 13 if
> he ate it every week

next to the price, the shelf depth and anything your Trader has put aside for you. The panel's
subtitle says how many dogs are on a Train week and how many of them have the right feed aboard,
because that is the number that decides how many crates you need. Item 0 landed first, before the
refactor, and built `lib/priceTag.ts` for exactly this — so when the goods arrived four weeks of
work later they had somewhere to say what they were worth.

The same module prices the Saloon ("18,200 before the season ends, against the 9,000 Rosco has won
all season"), the Docks' hold ("they have to fetch 71 a crate at the next stop to break even") and
the Market's gear rows ("Rosco's weakest is Trap — 41 → 44, rating 47 → 48").

---

## ⚠️ The biggest call: **D15's purse cut is dead, and the arithmetic behind it was wrong in an
interesting way**

Phase B measured the cut and deferred it with a table: *other* was 7,016, so 65% needed a 59% cut,
and the ratio would become reachable once the other roads grew. I built the market first, as D22
asked, and the first half came true — **`other` grew to 9,469 and the prize share fell 81.7% →
77.3% with the pool untouched.**

Then I swept the cut. 400 all-Normal seasons a cell:

| cut | mean end worth | prize share | purse reaching players | dogs sold | bets returned | food sold |
|---|---|---|---|---|---|---|
| **0%** | **31,370** | **77.3%** | 53.8% | 2,687 | 3,049 | 3,689 |
| 10% | 26,805 (**−15%**) | **77.4%** | 51.1% | 1,944 | 2,514 | 3,568 |
| 20% | 22,831 (**−27%**) | **77.6%** | 48.3% | 1,234 | 2,049 | 3,380 |

**The prize share does not move. It gets slightly worse.**

D22 reasoned that a cut could not reach 65% because the other roads were *untouched* by it. The
truth is worse and more useful: the other roads are **financed** by prize money. Cut the purse and
a poorer stable buys fewer dogs (−54%), stakes less (−33%) and finances a smaller hold (−8%), so
`other` shrinks at least as fast as prize does and the ratio is invariant **at any depth**. A 10%
cut buys nothing at all for 15% of the economy.

So the pool stays at 19,250 and **D15 is closed rather than deferred again** (D29). What moved the
ratio was making the other roads more productive per Bone — the feeds and the hold, worth 4.4 points
between them with no purse touched.

And I have retired the 65% target. It was a proxy for "are the roads worth the same", and that now
has a direct measurement which says **they are, to within 1.4%**. A proxy that needs a 45% cut while
the thing it proxies for is already met is the wrong number to steer by.

---

## The acceptance table, every row, met or not

| Measure | Target | Measured | |
|---|---|---|---|
| trade income, Normal | positive | **+1,939** | ✅ |
| trade income, trader agent | 8–15k | **6,680** | ❌ short by 1,300 |
| a +20-unit cargo upgrade | pays back inside one season | **1,506 on 1,400 paid** | ✅ |
| stacking three of one role | ≤ 5 points over a mixed three | **49.1–51.4%**, all five roles | ✅ |
| Prime offers seen per season | 2–5 | **2.93** | ✅ |
| leadConversion | no larger a gap for the leader | leader **+0.11**, trailer **+0.24** | ✅ |
| bankruptcies, careless | 5–10% | **5.5%** | ✅ |
| the roads, mean end worth | within 15% | **1.4% apart** | ✅ |
| `hub-clicks.ts` | ≤ 14.5 | **13.9** | ✅ |
| `npm test` | green, snapshot moved twice | 22 green, twice | ✅ |
| `npm run lint` | clean | clean | ✅ |

### The one miss, and what it is

**The trader agent's trade income is 6,680 against 8–15k.** The road itself is fine — it ends level
with the trainer's road and with a much tighter spread — so what is short is the *income line*, not
the outcome.

The diagnosis is measured rather than guessed. The hold ablation shows the first +20 crates worth
1,506, the second 996, the third 395 and the fifth less than nothing: **the road is bound by the
cash to buy stock, not by capacity or by margin.** The return *rate* per Bone is set by the gap
between planets' bands and is already healthy; what the agent runs out of is Bones.

I tried one price lever and rejected it. Dropping `foodSpread` 0.10 → 0.06 takes the trader to 7,632
— but the 10% spread is the tax that makes blind carrying lose 9.5 a crate, which is the entire
reason §9.2 says information *creates* the trader's road. Cutting it to hit an agent's number would
have bought the row at the cost of the design, which is the trade the brief warned against. I did
give the agent the bank (3% a week, which it now uses and repays), because a trader who will not
borrow is a floor test of the road played with one hand — that took it 5,858 → 6,680.

The honest next lever is Fat Tony rather than better prices, and that is GDD §20 Q15.

---

## ⚠️ Hard lost 11 points of head-to-head by hiring, and getting it back is the phase's best AI finding

Hard began the phase wanting all five hireable roles — it has three slots and the cash, so why not —
and **beat Normal 48.0%**, down from Phase B's 53.9%, with a mean *above* Normal's and a p10 well
below it. That shape (wins bigger, loses more often) is what over-committing looks like.

Ablating the want list, 300 seasons a cell:

| Hard wants | beats Normal | mean | p10 |
|---|---|---|---|
| trainer, vet, trader, tipster, scout | **48.0%** | 32,327 | 5,625 |
| trainer, vet, scout | 55.8% | 37,603 | 7,088 |
| trainer, vet, tipster | 55.8% | 37,484 | 8,258 |
| **trainer, vet** | **58.7%** | **41,346** | **9,825** |

**The trader-road staff are only worth their wage to a stable that plays the trader's road.** A
Trader's hold and a Tipster's week are worth nothing to an agent whose income is purses, and the wage
is charged whether the capability is used or not. So three slots is *more than a racing stable can
profitably fill*, and knowing which two to fill is decision quality — which is what §14 says
difficulty is made of (D30).

Final at 800 seasons: **Hard beats Normal 58.6%** (v1 60.6, Phase A 56.8, Phase B 53.9), **Normal
beats Easy 79.3%** against a ~80 target. Hard is still 6 points short of ~65 and it is now the
project's most-missed number, but it has moved the right way for the first time since v1.

---

## D26 and D6, both answered by the same line

Phase B's D26: Easy's difficulty is structurally "does not turn up", and every other handicap §14
gives it — never hires, never bets, never buys — is a *saving*. It needed "a weakness that costs
money while racing", and Phase C's market is the first thing that could offer one.

**Easy now buys the dearest crate on the shelf whether or not it owns a dog that would eat it.** One
line, and it is the first handicap in the game that costs Easy money while it is still racing. Easy's
mean end worth is 11,808 and Normal beats it **79.3%**, up from 77.9% — so the ladder got *better*
rather than collapsing, which is what happened the last two times Easy was touched.

The same line, doubled, is what finally reaches D6. **Careless goes bust in 5.5% of 400 seasons**,
inside the 5–10% band, for the first time in the project. And `upkeepPerDog` never moved — Phase A
measured that trade (300 upkeep reaches 1% and costs a Normal stable 27% of its worth) and it stayed
rejected. What gets there is the combination §7.5 always described: three wages it did not price, a
crate a week it cannot use, no rest weeks, and every dog entered every weekend. Its p10 is **−2,210**
— a stable in the red with nothing left to sell.

---

## ⚠️ The click budget broke, and the fix is a principle rather than a number

Thirteen goods, five hireable roles and a per-stable shelf took `hub-clicks` from 13.9 to **15.3**
against a 14.5 budget. §8.5 and BUILD_PLAN §11 both say the fix is a better summary rather than
fewer decisions, so I instrumented the hotspots per venue to find out what was actually firing.

**It was not the new market at all.** It was `upgrades.length` — "you could afford an engine tier" —
firing in **533 of 650 planet phases**, because once that is true it is true every week for the rest
of the season. Cutting the hold's price to 1,400 had made it worse.

> **A hotspot flags what CHANGES, not what is always there.**

A permanent fit does not expire and a bank does not close, so both became quiet-line material: still
named, never urgent. Stock, prices and who is drinking here *do* expire, so they stayed news. Three
smaller tightenings followed from the same principle — a Rough hire into a free slot is not an event,
a Rough crate is only news when the dog would otherwise eat kibble, and the kibble trade has to beat
the fuel as well as the spread (the same break-even the Docks prints, so screen and hotspot agree).

**13.9 a weekend**, level with Phase B, with a market several times deeper. That is D34 and I think it
is the most reusable thing in this phase.

---

## The two snapshot moves

**Move 1, `671ec44` — the hold becomes a record.** `cargo: number` was threaded through 26 files.
The brief asked me to land the shape with kibble alone so the season plays identically, and there is
a clean proof that it did: **in the golden digest, only `stateHash` changed.** Every stable's cash,
every line of its worth breakdown, every dog, every ship, every stat, all six final standings and all
195 race results are byte-identical. Same draws, same season, different shape.

That was not free — it needed `rollGoodPrices` to make **no rng draw** for a shelf whose depth cannot
vary, which is why the staple's stock is a sentinel rather than a rolled number.

The four things the brief said to settle, and what each is:

- **Dense record, not sparse.** `GameState` is the save file and the golden digest hashes
  `JSON.stringify(state)`, so a sparse record would make the hash depend on the order a stable
  happened to buy things in. `emptyCargo()` builds every key in `GOOD_IDS` order. Thirteen zeroes a
  stable is a fair price for a canonical serialisation, and it removes `?? 0` at every read.
- **`fuelCost` and the arrival roll take the total.** A crate of Prime speed feed weighs what a crate
  of kibble weighs.
- **Dogs eat the staple.** A hold full of speed feed and no kibble pays the same no-cargo penalty as
  one that sailed empty, and should.
- **Spoilage is a fraction of the total, off the largest stacks first.** Both obvious readings are
  wrong: rounding *up* per good costs a hold split across thirteen goods a crate of each — 13 of 13 at
  a 25% rate — and rounding *down* per good lets a hold of twelve three-crate stacks spoil nothing.
  Largest-first is proportional, cannot be dodged by splitting a hold, and consumes no rng draw (D32).

**Move 2, `5a09c5f` — the content.** Everything that changes the golden season landed together,
because it had to: new content, new rules, Normal's use of them, and the balance sweeps. That is one
large commit, and it is what "the snapshot moves exactly twice" costs when the reference season is
six Normal AIs — any change to Normal's decisions or to a shared number moves the digest.

### ⚠️ `properties.test.ts`: two assertions re-expressed, and why that is not a weakening

The brief said to stop and work out whether I had broken something. I did, and here is the working.

1. **`p.cargo >= 0` / `p.cargo <= p.ship.cargoCap`.** The quantity changed shape, so the expression
   must. It came out **stronger**: every shelf is now checked non-negative *and* integral, and the
   total is still checked against capacity — where one number could only say the second thing.
2. **The net-worth invariant.** The cargo term is now a sum over goods at each good's own local sell
   price. It is **re-derived independently** in the test rather than calling `cargoValue`, because
   asserting it against the engine's own helper would only say `cargoValue === cargoValue`, and this
   is the assertion the brief flagged as most threatened.
3. **The bound on the hold is now `cargoCap(p)`, not `p.ship.cargoCap`** — a Trader's crates are part
   of the hold a stable has. This one *did* surface a real hole: firing a Trader would have left a
   stable carrying more than its ship can hold. It is **refused** rather than spilled, the same shape
   as "withdraw the dog from its race first", so the invariant is still the tightest true statement.

Two invariants added: the staff list never exceeds `staffSlots`, and every shelf in the hold is a
non-negative integer.

---

## The full re-baseline

`npm run harness -- --seasons 800`, all Normal:

| | Phase B (`v2b` + D28) | Phase C (`v2c`) |
|---|---|---|
| mean end worth | 32,303 | **31,382** |
| p10 / p50 / p90 | 9,620 / 26,138 / 67,342 | 9,113 / 25,909 / 64,538 |
| prize | 31,930 | **32,185** |
| trade | −4,047 | **+1,939** (and D33 is why it was ever negative) |
| betting / costs | −908 / 16,128 | −814 / 24,120 |
| prize share of gross | 81.7% | **77.3%** |
| food sold, gross | 694 | **3,708** |
| bankruptcy, Normal | 0.1% | 0.1% |
| fitness at declaration | ~72, 18% under 60 | 71.5, 19.9% under 60 |
| races per dog | 4.8 | **5.1** |
| dogs at week 13 | 3.84 | 3.83 |
| purse share to players | 53.4% | **53.8%** |
| concentration, champion | 0.278 | 0.276 |
| decided by week | 6.4 | **6.6** |
| autoplan% | 8.8% | 9.1% |
| hub-clicks | 13.9 | **13.9** |

Head to head, `--ai easy,normal,normal,hard,hard,normal`, 800 seasons: **Normal beats Easy 79.3%**,
**Hard beats Normal 58.6%**, Hard beats Easy 82.1%. Means: Easy 11,808, Normal 28,976, Hard 41,070.

`--calibrate`: a balanced 65 beats seven 50s **58.5%**; best fit `oddsScale` 15.25 against the 15.5
in the sheet — unmoved, as it should be, since §6.2's constants did not change.

`--stats`: **24.2 / 19.2 / 16.1 / 15.3**, unmoved and in rating-weight order. Stamina still flat
across distance — structural, GDD §5.1, and the reason the feed prices do not sell a distance story.

`--pups`: a pup with a **Rough** trainer reaches par at week 8 (unchanged); **Proper** week 6;
**Prime** week 4. That last one is a big lever and it is GDD §20 Q16.

`--card`: unchanged, since neither the card nor eligibility was touched. Broad five-dog stable 76.3%,
one-good-plus-two 10.3%, four good dogs 0.0%.

`--ai careless,normal,normal,normal`, 400 seasons: **careless bankruptcy 5.5%**, mean 9,443, p10
−2,210.

`--roads`, 400 seasons of three trainers against three traders:

| agent | mean | p10 | p90 | prize | trade | crates carried | hold |
|---|---|---|---|---|---|---|---|
| trainer | 31,724 | 6,936 | 70,579 | 33,829 | 809 | 7.2 | 20 |
| trader | 31,361 | 12,208 | 54,367 | 24,465 | 6,680 | 20.4 | 111 |

**1.4% apart, and visibly different in spread** — the trainer's road wins big and loses badly, the
trader's rarely does either. §7a.5's caveat is printed under the table by the harness itself: three
hand-written agents measure whether the roads *can* pay, not whether they are balanced against a good
player. Jesse beat three Hard and three Normal stables with a line no agent plays.

---

## Verification

| | |
|---|---|
| `npm test` | **22 green**, golden snapshot moved twice and no more |
| `npm run lint` | clean |
| `npm run build` | → `packages/web/dist` |
| `season-check.ts` | 3 seeds + the toggle variant, all to week 13, no `ActionError`, every log replays byte-identical. It now **buys feed for its trainees**, fills two staff slots and sacks everybody in week 9 — so the shelf limit, the consignment path, the slot limit and the FireStaff-over-capacity refusal are all walked rather than merely survived |
| `race-view-check.ts` | 195 races, every one replay-identical, 6 photo finishes |
| `hub-clicks.ts 25` | **13.9** a weekend (budget 14.5) |
| `asset-check` | 11 finished, 138 stand-ins, 0 missing |
| golden snapshot | `1f10e8f5…` → (shape) → (content) → `8a19efef…` |

---

## Carried forward

- **Hard beats Normal 58.6% against ~65.** Recovered 4.7 points this phase by hiring *less*, and it
  is still the most-missed number in the project. Phase D's row wants 63–68.
- **The trader's income line, 6,680 against 8–15k.** Diagnosis is cash, not capacity — GDD §20 Q15
  asks whether Fat Tony should be the answer.
- **Q12, the season decided at week 6.6.** Phase C's two late-paying roads were the prompt's own
  hypothesis for this and they moved it **0.2 weeks**. Not refuted, not the answer.
- **Races per dog 5.1 against a 7–9 band**, missed for a fourth phase. I think the band may be wrong
  rather than the game, and GDD §20 Q14 does the arithmetic: 1.97 races a weekend × 13 ÷ 5 dogs *is*
  5.1, and both ways to raise it are things the design deliberately pushes the other way.
- **The information event cards did not land.** Not for want of work but because a card re-weights
  the deck and moves the snapshot, and both moves were spent. Prime offers turned out not to need a
  card at all, so the deck has one job left rather than two.
- **`apLoss%` still needs a forked rng stream** (D25). `autoplan%` is exact at 9.1%.
- **Veterans coverage 29.6%** and the broad-stable band at 76.3% (Q13) are both unchanged: Phase C
  touched neither the card nor eligibility.

---

## To push

Same as Phase A and B: the commits are real but they live in a clone in Anthropic's cloud, because
the shell into your folder still does not mount (`sandbox-helper: no Plan9 drive shares mounted`,
unchanged since 8 September). They arrive as **`phase-c.bundle`**, attached to the conversation.
Download it into the repo root, next to `package.json`.

Your `main` should be at `8c1c263` with a clean tree:

```powershell
git status                                  # expect nothing modified
git fetch phase-c.bundle "refs/heads/main:refs/heads/phase-c" "refs/tags/v2c:refs/tags/v2c"
git merge --ff-only phase-c                 # fast-forwards main onto the commits
git branch -d phase-c
```

Then check it is what these notes describe, and push:

```powershell
npm test                                    # 22 green
npm run build                               # -> packages/web/dist
npm run harness -- --seasons 200            # mean ~31,400, trade positive
npm run harness -- --roads --seasons 200 --ai trainer,trainer,trainer,trader,trader,trader
npm run dev                                 # and go and play a season

git push origin main
git push origin --tags
del phase-c.bundle
```

**`package-lock.json` is untouched, so no reinstall.** Cloudflare Pages will build the push on Node
20; nothing added needs anything newer.

Three smaller things:

- **The commits are authored `Claude <noreply@anthropic.com>`**, set before the first commit. Your
  `Co-Authored-By` trailers are on every message.
- **`design/space_dog_racing_economy.xlsx` changed** and `balance.json` was regenerated from it with
  `npm run balance` — the JSON was never hand-edited. The Assumptions sheet gained 59 rows (the
  ladder, the feeds, the staff, the two fuel numbers, the hold price and the ship's three tiers) and
  four rows are marked **(superseded)**: `trainerWage`, `vetWage` and `fitnessRestVet` are no longer
  read, because a wage is a fact about the tier now and a vet does three different things at three
  prices. `packages/engine/scripts/add-phase-c-rows.ts` is kept in the repo as the record of what was
  added and what each note says.
- **A v2b save will not load.** `STATE_VERSION` and `SAVE_VERSION` are both 4, and a Phase B action
  log could not replay anyway: its `TradeFood` actions do not say what they were buying.

---

## What to feel for when you play it

Phase B's lesson was that this game's problem is legibility more often than rules, so the thing to
notice is whether the market **reads** rather than whether it balances.

1. **Open the Docks on a week when something good is on the shelf.** Does the "what it does" column
   tell you whether to buy it, or do you still have to do arithmetic in your head?
2. **Take a Prime trainer when one turns up**, and see whether the wage frightens you in week 10. It
   is meant to: that is §7.5's route to going bust and the careless agent now finds it 5.5% of the
   time.
3. **Leave your third staff slot empty for a season.** Hard does, and gained 11 points of
   head-to-head by it. I would like to know whether that reads as a deliberate choice or as the game
   failing to give you a third thing worth hiring.
4. **The hotspots.** They now stay quiet about things that will still be there next week. Does the
   hub feel quieter in a good way, or does it feel like the Docks stopped telling you things?
