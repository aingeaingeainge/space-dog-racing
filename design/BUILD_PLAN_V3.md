# Space Dog Racing — Build Plan, v3

> **Status: CURRENT.** Build from this document.
>
> Canonical copy: `design/BUILD_PLAN_V3.md` in the `space-dog-racing` repo. A copy in a claude.ai
> Project is a **mirror**, last synced 30 September 2026 (at `v3l2`) — edit the repo, never the mirror. See
> `design/CANON.md`.
>
> Supersedes `design/BUILD_PLAN.md` from §6 onward. **That document's §§1–5 — architecture, tech
> stack, repo layout, `CLAUDE.md` and the data model — are still CURRENT** and are not restated
> here; read them there.

Companion to `design/GDD_V3.md`. This is the *how*: what gets deleted, five phases in dependency
order, acceptance criteria with numbers, and a ready-to-paste prompt per phase.

**Supersedes** `design/BUILD_PLAN.md` from §6b onward. §§1–5 of that document (architecture, stack,
repo layout, `CLAUDE.md`, the data model) are still correct and are **not** restated here — read
them there.

> **Where things stand, 16 September 2026.** v2 is complete and tagged `v2e`: a correct,
> deterministic, six-phase-balanced management sim. v3 is a deliberate change of genre and the
> first phase of it is **subtractive**. Nothing in this plan requires a rewrite of the engine's
> architecture; the purity rules, the action log, the tick-log contract and the determinism
> guarantees all carry over untouched.

---

## 1. The governing constraint

v2's build plan optimised for *measurement*: every phase ended with a harness table and a decision
log entry, and that discipline is why v2 works. **v3 keeps the discipline and changes what is being
measured.** The question is no longer "are the three roads within 15% of each other" — it is "does
four players take forty minutes, and does anything memorable happen in it".

Two consequences for how these phases are run:

1. **Playtest is promoted from a checkpoint to an acceptance criterion.** Several rows in the tables
   below can only be answered by Jesse playing with other humans. They are marked 🎲 and a phase is
   not done until they are answered, even if every harness number is green.
2. **The harness is still the instrument for everything it can reach**, and §7a of the old plan
   (the careless agent, the measurement caveats, the 800-season rule for anything under 5 points)
   applies verbatim. In particular: **a head-to-head is a property of the table it is played at**
   (v2 D49), and ablations must be run at the table their acceptance row is about.

---

## 2. The delete list

Phase A is this list. It is written out in full because a subtractive phase is easy to do
half-way, and a half-deleted system is worse than either state.

### 2.1 Cut entirely

| System | Files/concepts affected |
|---|---|
| Dog market (buying, selling, pups, the market shelf of dogs) | `economy/market`, Market screen, `BuyDog`/`SellDog`, AI buy/sell heuristics |
| Staff market and the six-role ladder | `content/staff`, Saloon screen, `HireStaff`/`FireStaff`, wage bill |
| Ship upgrades, cargo upgrades, kennel modules, cold store, engine tiers | `BuyUpgrade`, Docks screen, `Player.ship` |
| Fuel and its cargo penalty | `endTurn` costs |
| Kennel upkeep per dog | `endTurn` costs |
| Staff wages | `wageBill` |
| Loans, the bank, Fat Tony, interest, repossession | `Borrow`/`Repay`, `Player.loans`, Saloon |
| Bankruptcy, the forced-sale cascade, the Bust screen | `endTurn`, `bankruptRate` |
| The Fixer as a hireable or per-job person | `PlanetState.fixer`, `flags.fixerBarred` |
| Kennel gear, the racing muzzle, the track-day pass, the purchasable supplement | `content/items` |
| The Trap stat | `Dog.trap`, rating weights, feed rows |
| Kibble and the four stat feeds × three tiers | `content/goods` |
| The Rough / Proper / Prime tier ladder | `content/tiers`, chevron glyphs |
| The seven fact-gated race types, the Handicap cap, the Invitational floor, the Consolation | `content/raceTypes`, eligibility predicates, `cardCoverage` |
| Championship points and the Collar purse | `roadSplit`, Season End |
| Dossiers and the Tipster | `BuyUpgrade` (information), Galaxy Map purchase |
| The Train state | `Dog.weekState`, `SetDogState` |
| The Docks and Saloon screens | two screens |
| The flat stake ceiling | `maxStakeFlat` |
| Path agents `trainer` / `trader` / `crook` / `mixed`, and `careless` | `ai/`, harness printouts |

### 2.2 Kept, changed

| System | Change |
|---|---|
| `simulateRace` | `bendCraft` and the trap-draw edge read Acceleration; styles modify the pace curve; the contest rule is new |
| Race card | Seven types → three purse tiers, open entry |
| Goods | Thirteen rows → six, on 8× bands, with shelf depth |
| Feeding | Gated behind Train → every dog, every week |
| Staff | Six roles × three tiers on wages → two trainers on commission |
| Season | 13 weeks → 10; one season → 1–5 or a target |
| Turn structure | Two planet phases → one; Explore, Kennel and Bookie become simultaneous |
| Declarations | Hidden until lock → public in turn order |
| Traits | 16 → 8, with the three pace traits removed |
| `foodBand` | One commodity's band → a multiplier over six |
| Planets | Gain `exploreDoors`; lose `marketBias`, shops, banks, sharks |

### 2.3 Kept whole

The engine's purity rules and the `CLAUDE.md` non-negotiables. `rng.ts`. The action-log-as-save-file
and as-protocol design. The tick log and the never-re-simulate renderer contract. `determinism.ts`
and the `exp`/`log`/`pow` prohibition. The race constants from v2 §6.2. The fitness curve
(`0.90 + 0.10 × fit/100`). The Elo rating update. The odds model at `oddsScale` 15.5 — ⚠️ *moved to
18.75 at `v3c` (GDD_V3 C7): A7 changed the race model the book is calibrated against, and 15.5 left
a +9.8% overlay on every stable dog in real fields. Jesse's call to confirm.* The fog. The
18 planets as data. `dogValue`. The harness, its 800-season rule, and its methodology warnings.

---

## 3. The phases

Five, in dependency order. Each ends with tests green, a harness run, a playtest, and a tag
(`v3a` … `v3e`). Each moves the golden snapshot in named commits only.

---

### Phase A — the cull (1–2 sessions) → `v3a`

**Goal:** a playable 10-week season with three dogs, three purse tiers and one placeholder market,
with everything in §2.1 gone. **No new mechanics.** This phase exists to get the surface area down
before anything is built on it, and it is the phase most likely to be rushed.

**Deliverables**

1. Execute §2.1 in full. Delete, do not disable — a flag that turns a system off is a system that
   still has to be reasoned about.
2. Three stats. `Dog.trap` removed; rating weights `0.40 / 0.35 / 0.25`; `bendCraft` and the
   trap-draw edge read `accel`.
3. Race or Rest. `Train` removed from `weekState`; Race −20, Rest +30.
4. Three purse tiers replacing `RaceType`. Open entry, one dog per stable per race, locals at
   55 / 45 / 35 and fitness 75.
5. Ten weekends. Major at 5, Grand Final at 10 at Collar Prime.
6. Three dogs, dealt at start on an equal stat budget, ages 2–4. No kennel slots.
7. A placeholder single-good market so the trade loop still runs (Phase B replaces it).
8. Age reworked per GDD §4.3 — growth, recovery and injury bands.
9. Harness cut down: delete the path agents, `bankruptRate`, `cardCoverage`, the tier rows and the
   road split's staff/fuel/upkeep columns. **Add the pace measures**: decisions per weekend per
   player, races entered per weekend, races per dog.
10. **A full re-baseline.** Everything below the race level was fitted to 13 weeks, four stats and a
    dog market; none of those numbers survives this phase.

**Accept when**

| Measure | Target |
|---|---|
| `npm test` green, golden snapshot moved in named commits only | ✅ |
| `npm run lint` clean, no `any` in engine, no `exp`/`log`/`pow` | ✅ |
| A 10-week season completes headless with 6 AI stables | ✅ |
| Stat leverage, +10 from a balanced rating-50 dog | speed > accel > stamina, all 14–26% |
| Race calibration (rating 65 vs seven 50s) | 45–60% |
| Races entered per weekend per stable | **1.8–2.4 of 3** |
| Races per dog per season | **5–7** |
| Mean end worth, all-Normal, one season | 25–40k |
| Decisions per weekend per player (`hub-clicks`) | ≤ 10 |
| Nothing in §2.1 remains referenced anywhere in `packages/` | ✅ |

⚠️ **The row most likely to miss is races entered per weekend**, because it is pure fitness
arithmetic and −20/+30 is an estimate. If it comes in under 1.8, move the Race cost before anything
else; if over 2.4, raise it. Do not compensate by changing the purses.

---

### Phase B — the market (1–2 sessions) → `v3b`

**Goal:** six foods that are simultaneously the inventory and the training programme, on
Gazillionaire's bands, with the price-range UI that makes them legible on the first play.

**Deliverables**

1. Six goods per GDD §6.1: bands, shelf depth per planet, `foodBand` as a per-planet multiplier
   over all six.
2. **The price distribution.** Prices cluster mid-band with rare excursions to the ends —
   `normalDeviate()` from `determinism.ts`, never `exp`. This is the guard that stops one lucky
   Ambrosia leg deciding a game.
3. Fixed 50-unit hold for every stable, forever. `Player.ship` reduced to nothing or removed.
4. Feeding: one unit per dog per week, always; the bonus table of GDD §6.3; the sticky per-dog diet
   setting (named food / best available / worst available) with a cheapest-aboard fallback.
5. **The empty-hold penalty: −10 fitness, no gain.** This single rule is the whole of v3's running
   cost — build it first in this phase and make sure it is visible in the Kennel before the week
   resolves.
6. The Market screen of GDD §6.2: Your Hold / On Planet / You Paid / Market Price / **Price Range**,
   and a fixed hold gauge.
7. Turn order = `20 − cargo ÷ 5 + d10`, shown with its reason.
8. Harness: a row per good (bought, sold, fed, mean price paid vs band position), and the
   cash-bound-vs-hold-bound crossover week.

**Accept when**

| Measure | Target |
|---|---|
| Food sold as a share of gross income | 20–35% |
| The week a Normal stable stops being cash-bound and starts being hold-bound | weeks 4–7 |
| Best single trading leg in a season, p99 | **< 40% of mean end worth** |
| Share of weeks a stable's hold is empty | < 5% |
| Mean units of Ambrosia obtainable on one planet | ≤ 8 |
| A new player can say whether a posted price is good | 🎲 without asking, from the Price Range column alone |
| Decisions per weekend per player | ≤ 10 |
| `npm test` green, snapshot moved once | ✅ |

⚠️ **The p99 leg row is the one that protects the game.** If a single trade can be worth 40% of a
season, the rest of the design is decoration. Tighten the distribution, not the bands — the 8× is
the whole point.

---

### Phase C — running styles (1 session) → `v3c`

> **Built, tagged `v3c` (23 September 2026).** See `claude/V3_PHASE_C_NOTES.md`. The contest rule
> (deliverable 3) was built, measured at +0.7 against the 4-point kill switch, and **cut** (GDD_V3
> C3). The equal-rating deal was fixed here by Jesse's call (C1), and `oddsScale` moved to 18.75
> (C7) — which §2.3 below lists as kept whole, so it is flagged there too.

**Goal:** thirty races a season that are worth watching, and a field that is worth reading.

**Deliverables**

1. `Dog.style` — front-runner / stalker / closer — with the pace-curve modifiers of GDD §5.1.
2. **Style expression** drawn per dog per race, `U(0.30, 1.30)`, scaling the modifiers. Drawn at a
   fixed point in race setup so the rng stream does not shift with the field size.
3. **The contest rule** of GDD §5.3: two front-runners within 2 m at the head inside the first
   third both get +3% current speed and `fadeStart` 0.05 earlier.
4. Hidden until raced, then public. Written on the dog card. `Dog.styleKnown` is a **set of player
   ids**, not a boolean, because in hotseat different stables learn it at different times — except
   that racing reveals it to everyone at once, so in practice it is a boolean plus the owner. Pick
   the simpler one that is still correct.
5. Each stable dealt one of each style (GDD §5.5).
6. Declarations public in turn order (GDD §7.3) — a Race Office that shows the field as it fills.
7. Commentary lines that name the style and the day: at minimum, a burned-out front-runner, a
   closer that got there, a closer that did not, and a front-runner that was left alone in front.
8. The bookie prices style but not field interaction (GDD §5.6).
9. Harness: `--styles`. Closer win rate against fields with 1 vs 2 vs 3 front-runners; the variance
   decomposition of §11; the blind-lone-closer betting return.
10. **A7, deferred here from Phase A by Jesse's call (GDD_V3 B9):** make `fadeStart` an absolute
    distance rather than a fraction of the trip, so a staying trip actually taxes stamina. It is what
    puts stamina ahead of accel at 480 m (22.4 / 16.9 / 17.6 at `v3a` and `v3b`), and it is a
    race-model change that moves every dog in the golden season — which is why it lands with the
    running-style curve rather than in a phase about the economy. Its own commit, with a re-baseline
    either side, like the contest rule.

**Accept when**

| Measure | Target |
|---|---|
| Closer's win rate, 1 front-runner in the field vs 3 | **≥ 4 points better** |
| Style expression's share of race outcome variance | below fitness's, above form's |
| Backing the lone closer blind, return per Bone | **negative** (i.e. below the 15% margin) |
| Stat leverage, +10 from a balanced rating-50 dog (A7) | speed > accel > stamina at 480 m, all 14–26% |
| Lead changes per race, mean | ≥ 1.0 |
| A player can name a dog's style after watching one of its races | 🎲 yes |
| `npm test` green, snapshot moved once (the race model changed) | ✅ |

⚠️ **The first row is a kill switch, not a tuning target.** If the closer's gap against a
front-runner-heavy field is under 4 points after a sweep, **cut the contest rule** and keep styles
for the watching alone. A rule nobody can perceive is worse than no rule, and this one costs the
simulation its independence between runners.

⚠️ **Land the style curve and the contest rule in separate commits**, with a re-baseline between
them. v2's own prescription for a change to the race model (old §11), and the trap draw is the
precedent for why.

---

### Phase C2 — the race, retuned (1 session) → `v3c2`

> **Built and tagged `v3c2` (23 September 2026).** See `claude/V3_PHASE_C2_NOTES.md` and
> `claude/V3_PHASE_C2_PROMPT.md`. This phase was not in the original plan. It is Jesse's call after
> playing `v3c`: he wanted the contest rule back, and the races were too strung out.

Two jobs:

1. **The hot pace (GDD_V3 §5.3, C12, C13).** It replaces the contest rule. Two front-runners at the
   head light it, and every runner in the lead group pays with an earlier fade. The kill switch's
   floor moved from +4 to **+2 at Jesse's call**, once the sweep showed that +4 could not be reached
   with the calendar even. Built: +2.3. Two numbers on the style curve were re-balanced.
2. **Closer finishes (§14 Q11, C14).** A run-in slows every runner alike over the last 15 m, to half
   pace at the line. Median margin 10.6 → 6.3 m, photo finishes 1.8% → 3.5%.

The race model moved under the book, so `oddsScale` went 18.75 → 19 on the real-field reading (C15).
Stat leverage still orders (24.1 / 17.3 / 17.1 at 480 m), calibration reads 51.8%, and the market
rows did not move.

| Measure | Target | `v3c2` |
|---|---|---|
| Closer's gap, 3 front-runners vs 1 | ≥ 4, or Jesse's floor | **+2.3** against **+2** |
| Lone front-runner vs `v3c` | not worse off | 15.8% (14.2%) |
| Style no-advantage, calendar | within 1.5 | 1.2 |
| Winning margin, median / photos | 4–7 m / ≥ 3% | 6.3 m / 3.5% |
| Real-field house margin / stable dog | −12 to −15% / ≤ +2% | −12.9% / +2.3% (within a standard error) |

**What Phase D inherits:** Hard has a field to read now (a lone front-runner +1.6 points, a closer
in a crowd +2.3), but it does not read it yet. Accel over stamina at 480 m is only 0.2 points.

### Phase D — Explore and the deck (2 sessions) → `v3d`

> **Status: COMPLETE — D1 tagged `v3d1`, D2 tagged `v3d2` (24 September 2026).** D1 built the
> Explore screen, 54 named doors, the deck, dog offers that can lie, next week's shelf in the Bar,
> race-day tips and the free local runner (GDD_V3 D1–D8, `claude/V3_PHASE_D1_NOTES.md`). D2 built
> staff on commission, trainers in the Bar, sabotage and the bought box, Hard's field read, and
> dropped the plan-the-week press (GDD_V3 D9–D16, `claude/V3_PHASE_D2_NOTES.md`). At 800 seasons:
>
> | Measure | Target | `v3d1` | `v3d2` |
> |---|---|---|---|
> | Events in the deck | ≥ 80, each category ≥ 12 | 86 | **93** (19 / 23 / 20 / 16 / 15) |
> | Doors chosen per category | none below 12% | 16.8–22.5% | 17.2–22.7% |
> | Commission, share of prize money | 4–14% | — | **13.2%** |
> | Swings for a stable that wants a dog / a trainer | ≥ 2 each | 2.89 / — | 2.93 / **2.19** |
> | Seasons with a sabotage, 6 AI | 40–70% | — | **69.1%** |
> | Tipped buzzing / blind stable dog / house margin | +10–30% / ≤ +2% / −12 to −15% | +20.1 / −1.3 / −12.6% | +27.5 / −0.4 / **−11.6%** ⚠️ on the line |
> | Consecutive seasons share ≤ ⅓ of events | ✅ | 13.3% a seat | 13.0% a seat |
> | Decisions per weekend (`hub-clicks`) | ≤ 10.5 (target 10) | 11.3 ❌ | **9.4** |
> | Mean end worth | 25–40k | 39,710 | **39,193** |
> | Hard beats Normal | 63–68% | 50.5% | **50.7% ❌** — each piece reported (D15) |
> | `season-check` fails on zero sabotages, dog offers, staff offers | ✅ | — | ✅ (sabotage run-wide) |

**Goal:** the screen that carries v3's entire content budget.

**Deliverables**

1. The Explore screen: three doors per planet, named and flavoured per planet, resolving to an event
   card with 2–3 choices. Simultaneous across players; contention resolved by turn order.
2. `Planet.exploreDoors` as data, mapped to the five categories of GDD §9.1.
3. **≥ 80 events**, weighted by category, as rows. This is the deliverable of the phase and the one
   that will be under-delivered if the session runs long — write the content before the polish.
4. Dog acquisition (GDD §9.2): age + one revealed stat + a description that is sometimes a lie;
   accepting means discarding one of your own.
5. Staff acquisition and the two-slot commission model (GDD §8): the bonus pool, the 1–10% cut, on
   race prize money only.
6. Sabotage and the bought trap draw as Back Alley events (GDD §9.3), with the public naming of a
   caught saboteur.
7. Information as Bar events (GDD §9.4) — next planet's band position.
8. The free local runner for a stable with fewer than three fit dogs (GDD §4.4).
9. Harness: door-choice distribution by category, event outcome spread, staff commission as a share
   of prize money.

**Accept when**

| Measure | Target |
|---|---|
| Events in the deck | ≥ 80 |
| Share of doors chosen, per category | none below 12% |
| Staff commission as a share of a stable's prize money | 4–14% *(D2)* |
| A stable that wants a specific thing (a dog, a trainer) gets a swing at it | ≥ 2 per season |
| Seasons in which at least one sabotage happens, 6 AI stables | 40–70% |
| Two consecutive seasons share no more than a third of their events | ✅ |
| Decisions per weekend per player | ≤ 10 |
| `npm test` green; `season-check.ts` fails if zero sabotages, zero dog offers or zero staff offers occur across a scripted season | ✅ |

---

### Phase E — the table (1–2 sessions) → `v3e`

> **Status: E2 BUILT, tagged `v3e2` (25 September 2026); the four 🎲 rows are outstanding until
> Jesse's table has played.** E1 (`v3e1`, 24 September) built the game's shape: no free local runner,
> 1–5 seasons or a Target, the off-season, multi-season save and replay, CI on Node 20/22/24 and
> `--game`. E2 built the table: the hotseat loop (the laptop moves only when a private screen changes
> hands; the Bookie in any order), "Skip the rest of race day", every dog fresh at a new season, the
> real season-end and game-end screens with each season's moments archived, the pace timer and the
> playtest checklist (GDD_V3 E1–E11; `claude/V3_PHASE_E1_NOTES.md`, `claude/V3_PHASE_E2_NOTES.md`).
>
> | Measure | Target | `v3e2` |
> |---|---|---|
> | Explore, Kennel and the Bookie take no more passes than privacy needs | ✅, reported at 4 and 8 humans | 4 humans (+2 AIs) **14.5 → 10.7** passes a weekend · 8 humans **30.4 → 22.4**; presses a human 13.8 → 12.9 and 14.1 → 13.1 ✅ |
> | Race day skippable in one press | ✅ | "Skip the rest of race day" (Shift+S) ✅ |
> | Season-end and game-end screens: income split, net-worth chart (whole game at the end), moments | ✅ | ✅ (moments archived per season, `STATE_VERSION` 12) |
> | A new season starts every dog fresh | ✅ property test | ✅ |
> | `season-check` walks four humans with no private screen leaking | ✅ | two games, 0 leaks ✅ (the check reports 200 leaks with the planet's pass removed on purpose) |
> | CI green on Node 20/22/24 | ✅ | 3/3 green (Jesse checked the Actions tab after the `v3e2` push) |
> | One-season rows unmoved; E1's `--game` rows re-measured after the fresh-season rule | reported | 800 seasons byte-identical to `v3e1` ✅; `--game` in the E2 notes |
> | Stables ending a season on less than they started | 10–25% | 0.8% (1 season) · 0.6% (5 seasons) ❌ reported, not tuned (Jesse) |
> | Nobody mathematically out before week 8 | ✅ | one season 0.0% ✅ · last season of 3 / 5-season games 15.8% / 48.8% ❌ reported |
> | 🎲 4 humans, 1 season, races skipped ≤ 25 min · watched ≤ 40 · 8 humans ≤ 70 · a Target finish worth watching | 🎲 | **outstanding** — the pace timer on the game-end screen measures them; `design/PLAYTEST_CHECKLIST.md` |
> | `npm test`; `npm run build` | ✅ | 47 green; build ✅ |

**Goal:** three to eight humans finish a game in forty minutes and want another.

**Deliverables**

1. The hotseat turn loop of GDD §2.3 with **Explore, Kennel and Bookie resolving simultaneously**
   and only Market and Race Office in turn order. A "pass to <name>" interstitial where privacy
   requires one.
2. Multi-season: 1–5 seasons, the off-season screen of GDD §2.2 (age, one retirement window, staff
   notice), circuit reshuffle, everything carrying over.
3. **Race to a Target** mode: net worth checked at the end of every weekend; the first crossing ends
   the game at the end of that weekend; highest net worth wins.
4. Skippable race animation for races a stable has no runner and no bet in.
5. Season-end and game-end screens: the income split (prizes, trading, betting, staff cut), a
   net-worth-over-time chart, and the moments list.
6. Seed sharing, save/resume at any weekend boundary.
7. Harness: full-game runs at 1/3/5 seasons and in target mode; wall-clock per player-weekend.

**Accept when**

| Measure | Target |
|---|---|
| 4 humans, 1 season, races skipped | 🎲 ≤ 25 min |
| 4 humans, 1 season, races watched | 🎲 ≤ 40 min |
| 8 humans, 1 season | 🎲 ≤ 70 min |
| Net worth gap, 1st to last, end of season | narrower than v2's equivalent |
| Stables ending a season on less than they started | 10–25% |
| Nobody is mathematically out of contention before week 8 | ✅ |
| A 5-season game's dog roster turns over | ≥ 1 dog replaced per stable per 2 seasons |
| Target mode produces a finish worth watching | 🎲 |
| Seed + action log reproduces a whole multi-season game, on Node 20, 22 and 24 | ✅ |
| `npm test` green, `npm run build` → `packages/web/dist` | ✅ |

---

### Phase F — the look (art sessions) → `v3f`

> **Status: DONE at `v3f2` (25 September 2026). Every file in the art contract is finished.**
>
> **F1**, tagged `v3f1`, drew as SVG the 54 Explore doors (one silhouette per category, dressed per
> planet), the 22 trainer portraits, and eight faces for the human stables keyed by saddle-cloth colour;
> fixed the Explore screen's layout for 3:4 doors; pruned the v2 portraits and the stand-ins beside
> finished art; and moved CI to current actions on a pinned runner (`claude/V3_PHASE_F1_NOTES.md`).
>
> **F2**, tagged `v3f2`, drew the 67 event cards that were still stand-ins, door by door (Bar, Back
> Alley, Pound, Track, Strip), each staged inside its door's setting; and pruned the 67 stand-ins and six
> orphaned v2 ones. No code changed (`claude/V3_PHASE_F2_NOTES.md`).
>
> | Measure | Target | `v3f1` | `v3f2` |
> |---|---|---|---|
> | Explore doors finished | 54 / 54, under cap | 54 / 54, 11–42 kB (target 60) ✅ | — |
> | Staff portraits finished | 22 / 22 | 22 / 22, under 9 kB each ✅ | — |
> | A human stable has a face on the podium and the game-end screen | ✅, by saddle-cloth colour | `human-01`…`08`, `lib/owners.ts` ✅ | — |
> | Event cards finished | 93 / 93, under cap | 26 / 93 | **93 / 93**; the new 67 are 8–33 kB (target 70) ✅ |
> | `asset-check` | 0 stand-ins, 0 missing, nothing over cap | 221 finished, 67 stand-ins, 0 missing | **288 finished, 0 stand-ins, 0 missing**, none on disk ✅ |
> | Neither golden moves; no engine change | ✅ | `8dc05e06…` / `dc357422…` unmoved ✅ | unmoved; `packages/engine` untouched ✅ |
> | `npm test`, lint, `season-check`, `npm run build` | ✅ | 47 green; clean; passes; ✅ | 47 green; clean; passes; ✅ |
> | CI on current actions, runner pinned | ✅ | `checkout@v7`, `setup-node@v7`, `ubuntu-24.04` ✅ | — |
> | Checked where each piece is seen, desktop and phone | ✅ | ✅ | modal and hub, 1280 and 390, every door ✅ |
> | 🎲 The doors read as their category, each planet's set feels like that planet, the trainers look like what they do, the human faces feel like yours | 🎲 | **outstanding** — the `v3f1` checklist | — |
> | 🎲 The cards read at a glance, feel like their door, and the dark ones are funny rather than nasty | 🎲 | — | **outstanding** — the `v3f2` checklist in the F2 notes |

**Goal:** every screen a player sees each weekend looks finished.

**Deliverables**

1. **F1** — the Explore doors, the trainer portraits, faces for human stables, the prune.
2. **F2** — the event cards (67 still stand-ins), in an order Jesse picks. **Built at `v3f2`**, door by
   door.

**Accept when**

| Measure | Target |
|---|---|
| `asset-check` | 0 stand-ins, 0 missing, nothing over cap |
| Neither golden moves | ✅ — art is data the engine never reads |
| Checked where each piece is seen, desktop and phone | ✅ |

---

### Phase G — balance: a stake cap a rich stable hits (1 session) → `v3g`

> **Status: DONE at `v3g` (28 September 2026).** The first balance phase since the art, and it came
> from Jesse's own game: a two-season game, one human against five AIs (two Hard), won by a Hard
> stable on **+197,908 at the bookie** while the best racing stable (13 wins, 5 Gold Cups, the most
> prize money) finished on a third of its worth. Hard stakes a share of its cash, so its bets
> compound, and §7.4's 50%-of-cash cap could not bind it. §2.1 had cut v2's flat ceiling as a guard
> against borrowed bankrolls; Phase G puts one back as a guard against compounding (GDD_V3 V21).
> Notes: `claude/V3_PHASE_G_NOTES.md`.
>
> | Measure | Target | `v3g` |
> |---|---|---|
> | A stable's stake on a race is the lesser of 50% of cash and the flat ceiling; Neon Snout's is 2× | ✅, `maxStakeFor`, from the sheet and a planet row | `maxStake` row under Betting; `maxStakeMultiplier: 2` on Neon Snout ✅ |
> | The ceiling | Jesse's pick from the sweep | **1,000** (Neon Snout 2,000) ✅ |
> | Won by a stable whose betting beat its purses, 2 Hard + 4 Normal, two seasons | well under today's | 32.5% → **5.3%**; betting's share of the winner's income 28.8% → 15.8% ✅ |
> | The stable with the most prize money wins | more often than today | 55.9% → **63.5%** (5 seasons 61.7% → 74.7%) ✅ |
> | Hard's betting total, p10 / p90 | much narrower | −27,704 / +107,037 → **−15,198 / +33,302** ✅ |
> | Mean end worth, all-Normal, one season | 25–40k | 42,170, unchanged — Normal's stakes are under the ceiling (❌ since `v3e1`, not this phase's) |
> | Hard vs Normal | reported, not tuned | 3 v 3, one season 49.7% → 54.0%; 2 v 4, two seasons 50.6% → 62.1% |
> | The Bookie says the cap a player has; Neon Snout says its doubled ceiling | ✅, 1280 and 390 | "max stake 1,000 Bones a race"; "Stake ceiling ×2: 2,000 Bones a race" ✅ |
> | Food bought and fed is counted once on the ledger | ✅, probed | counted once — the markup on food eaten stays in Trading ✅ |
> | A `v3f2` save goes softly to the title screen | ✅ | `SAVE_VERSION` 12, a v11 blob reads null ✅ |
> | Goldens, tests, lint, `season-check`, build, `asset-check` | ✅ | **neither golden moved** (both are six Normal; see the notes); 47 green; clean; passes; ✅; 288 / 0 / 0 |
> | 🎲 A big bet still feels worth making; the best racing stable wins; the cap is clear; Neon Snout is still the place for a big bet | 🎲 | **outstanding** — the `v3g` checklist |

**Goal:** betting is a sideline again, not the way to win the game.

**Deliverables:** the flat ceiling as one sheet row; the rule in `maxStakeFor`; Neon Snout's ×2 as a
planet row; the Bookie and local rules saying the cap; `SAVE_VERSION` 12; a ledger probe.

---

### Phase H — balance pass 2: the season's money (1 session) → `v3h`

> **Status: DONE at `v3h` (28 September 2026). Jesse chose to change nothing.** The phase went after
> §11's two rows that had been ❌ since `v3e1`: mean end worth (42,334 against 25–40k) and stables
> ending a season poorer (0.8% against 10–25%). It measured where a Normal stable's money comes from,
> committed a sweep knob (`--set`), and swept four levers. Only a new kennel rent or dogs eating more
> food reached both bands. Jesse turned both down: food stays the only running cost at one crate a
> dog, and a table growing richer together is fine (GDD_V3 V22). No rule, sheet row, golden or save
> version moved. Notes: `claude/V3_PHASE_H_NOTES.md`.
>
> | Measure | Target | `v3h` |
> |---|---|---|
> | `--set key=value` on `--seasons` and `--game`, refuses an unknown key | ✅ | `scripts/balance-set.ts`, first import of `harness.ts`; refuses an unknown key, a non-numeric key and a non-number; printed in the header ✅ |
> | Where the money comes from, worth at weeks 1 / 5 / 10, dog value against cash, losing weeks | measured | 25,558 / 32,476 / 42,334; dogs 17.4k → 18.6k, cash 6.0k → 23.6k; 94% have ≥ 2 losing weeks, 0.8% a losing season ✅ |
> | Two to three levers, three to five values each, against §11 at one, two and five seasons | swept | four levers: dog value curve, trainers' cuts, crates a dog eats, a kennel rent ✅ |
> | Mean end worth, all-Normal, one season | 25–40k, or Jesse's call | **42,334, unchanged: Jesse's call (V22)** |
> | Stables ending a season poorer | 10–25%, or reported with the lever | **0.8%, unchanged**; reached by a 250–350 rent or 3–4 crates, both declined (V22) |
> | 1st-to-last gap; food share; races entered | still in band | 26,510 (< 63,530); 32.6%; 2.12, unchanged ✅ |
> | Hard vs Normal (2 Hard + 4 Normal, two seasons) | reported, not tuned | 62.1% → 62.1% (nothing changed) |
> | Out at week 8 of the last season, five-season games | reported | 48.8% → 48.8% |
> | Goldens, tests, lint, `season-check`, build, `asset-check` | ✅ | **neither golden moved** (no rule changed); 47 green; clean; passes; ✅; 288 / 0 / 0 |
> | A `v3g` save | loads, or goes softly to the title | loads: `SAVE_VERSION` stays 12, because a `v3g` log replays into the same game ✅ |
> | 🎲 Does the table still feel right growing richer together? Is Hard too strong? | 🎲 | **outstanding**: the `v3h` checklist |

**Goal:** find out why nobody goes backwards, and let Jesse decide whether that matters.

**Deliverables:** the `--set` harness knob; the measurement and the sweep, in the notes; the decision in
GDD_V3 §6.3, §11 and V22.

### Phase I — a human picks their face, then the long game (1 session) → `v3i`

> **Status: DONE at `v3i` (29 September 2026).** Two parts. **The face picker:** a human chooses one of
> the eight human faces on the Title, and the pick is the row's saddle-cloth colour (GDD_V3 §10). **The
> long game:** E7's 48.8% out at week 8 of a five-season game's last season was measured against
> pillar 5's own question. At the last season's *start* only 0.8% are out, but the back of the table did
> not come back, because its dogs were worse. Three levers were swept; Jesse picked **the draft**: the
> stable last on a season's standings is offered an off-season replacement 15 points above the
> ordinary (GDD_V3 §2.2, V23). Notes: `claude/V3_PHASE_I_NOTES.md`.
>
> | Measure | Target | `v3i` |
> |---|---|---|
> | A human picks one of eight faces on the Title; the pick sets their colour | ✅, 1 / 4 / 8 humans, 1280 and 390 | ✅ `shots/title-*` |
> | No two humans share a face; a human's pick beats an AI's seat colour; defaults unchanged | ✅ | `resolveColours`: picks, then unpicked humans, then AIs; a table nobody touches is colour = seat ✅ |
> | Colour touches no draw | proven | `test/colour.test.ts`: four humans, two seasons, default vs permuted colours, same log and state ✅ |
> | A resumed game keeps the face; an old save loads | ✅ | resumed ✅; a colour-less setup still means seat index; a `v3h` save goes to the title (`SAVE_VERSION` 13, for the draft) |
> | Picker keyboard- and screen-reader-usable | ✅ | buttons named "Red — goggled pilot"; taken faces `aria-disabled` and name the holder; focus in, Escape out ✅ |
> | The long game measured: E7, E7 at the last season's start, comebacks, the richer half's ledger | ✅ | 48.8% / 0.8%; last → top 3 from season 3 12%; the richer half's extra is purses from better dogs ✅ |
> | Two or three levers swept, Jesse asked one question | ✅ | trainers' cut, last arrives first, the draft; **the draft at +15** |
> | Out at week 8, last season, 5-season games | before → after | 48.8% → **41.3%** |
> | Comebacks, 5-season games | reported | last → top 3 from s3 / s4 / s5: 12 / 7.5 / 3% → **31 / 18.5 / 6%**; last wins the last season 6% → 14% |
> | Hard vs Normal; §11's one-season rows | before → after | 62.1% → 61.6%; one season untouched: 42,334, 0.8%, 26,510, 32.8%, 2.12 |
> | Goldens once, in the rule's commit; tests; lint; `season-check`; build; `asset-check` | ✅ | both moved in `484f308` (the one-season golden only by `STATE_VERSION` 13 in its hash); 51 green; clean; passes; ✅; 288 / 0 / 0 |
> | 🎲 Does the trailing stable still have something to play for in a long game's last season? | 🎲 | **outstanding**: the `v3i` checklist |

**Goal:** let a human be themselves at the table, and give a long game's back of the table a way back.

**Deliverables:** the face picker; the long-game measures in `harness --game`; the draft's sheet row, rule,
screen text and `SAVE_VERSION` 13; GDD_V3 §2.2, §10, §11 and V23.

### Phase J — ready for the table (1 session) → `v3j`

> **Status: DONE at `v3j` (29 September 2026).** No rule, sheet row, golden or save version moved. The
> design is waiting on people, so Phase J makes one evening with friends answer as many 🎲 rows as it
> can. Two parts. **Hotseat polish:** the pass screen shows the next human's face; a seed link carries
> the humans' faces (`h1`…`h8`); a renamed AI's face is keyed by its name and never shared at the table.
> **The evening:** a "Copy the report" button on the game's end (the build, the link, the table, the
> result, the clock, each season's draft, as plain text), and `design/PLAYTEST_CHECKLIST.md` rewritten
> as one ordered evening of three games, with every open 🎲 row mapped to the game that answers it.
> Notes: `claude/V3_PHASE_J_NOTES.md`.
>
> | Measure | Target | `v3j` |
> |---|---|---|
> | The pass screen shows the next human's face | ✅, 4 and 8 humans, 1280 and 390 | ✅ `shots/j-pass-{4h,8h}-*` |
> | A seed link carries picked faces and round-trips them; a `v3i` link parses as before; `hard` is Hard | ✅ | 1, 4, 8 humans, with and without picks: 3,006 checks, 0 failures ✅ |
> | A renamed AI's face is keyed by its name, never shared; unrenamed AIs unchanged | ✅ | 3, 6, 8 stables × 300 seeds × 0–3 renamed: 24,800 checks, 0 failures ✅ |
> | "Copy the report": link, table, result, clock, each season's draft, plain text; fails soft | ✅ | ✅ clipboard read back; a refused clipboard opens a text box ✅ |
> | The playtest sheet is one evening, ordered, every open 🎲 row mapped | ✅ | 27 rows, three games, ≤ 8 questions a game ✅ |
> | No engine change; goldens; `SAVE_VERSION`; tests; lint; `season-check`; build; `asset-check` | ✅ | `git diff v3i -- packages/engine/src design/*.xlsx` empty; `41a8c8b5…` / `d4bb14c3…` unmoved; 13; **51 green**; clean; passes; ✅; 288 / 0 / 0 |
> | `hub-clicks`; the table walk; `harness --seasons 50` | unchanged | 9.4; 10.7 / 22.4; identical to `v3i` ✅ |
> | 🎲 **Every row still open** | 🎲 | **outstanding**: `design/PLAYTEST_CHECKLIST.md`, "v3 Phase J — the evening" |

**Goal:** one evening with friends answers as many 🎲 rows as possible, and comes back as text.

**Deliverables:** the pass screen's face; faces in a seed link; a renamed AI's face by its name;
"Copy the report"; the evening's sheet; GDD_V3 §10's note.

### Phase K — online multiplayer, planned (1 session) → `v3k`

> **Status: DONE at `v3k` (29 September 2026).** A design session, not a build: nothing under
> `packages/` changed, no rule, sheet row, golden or save version moved, and the evening is still
> unplayed. Online has been the brief's long-term goal since its first page (M5, then M6 behind v2, GDD
> D16). Phase K measured what a plan needs, asked Jesse five questions (GDD_V3 V24–V28) and wrote
> **`design/ONLINE_PLAN.md`**, which replaces `BUILD_PLAN.md` §6b.9 and Prompt M6. The shape: one
> Cloudflare Durable Object per room runs the engine and sends each seat only its own view; no timer
> and a nudge; a dropped seat waits and the host can let an AI stand in; race day moves on per browser;
> a link with a code, one seat a browser. Notes: `claude/V3_PHASE_K_NOTES.md`.
>
> | Measure | Target | `v3k` |
> |---|---|---|
> | Log, state and tick-log sizes; replay time; the secret list; the engine in a Worker | measured | a 4h+2AI season's log 38 KB (2.3 KB gz), five seasons 203 KB (8.8 KB gz), replay 74–343 ms; state 14 KB at week 1, 182 KB after five seasons; a race day's tick logs 68.5 KB (25.6 KB gz); 18 secret rows; a 6-AI season on `workerd` (`wrangler dev`) in 77–147 ms, standings identical to Node ✅ |
> | Cloudflare's limits and prices; PartyKit's status | searched, cited | `ONLINE_PLAN.md` §9: DOs on the free plan (SQLite), an evening < 1% of a day's allowance; PartyKit is `partyserver`/`partysocket` libraries ✅ |
> | Jesse's questions | ≤ 5, one at a time | five: V24 own view, V25 no timer + nudge, V26 wait + host stand-in, V27 each moves on, V28 link + code ✅ |
> | `design/ONLINE_PLAN.md` | written, CURRENT, mirrored | ✅ |
> | The build phases | one session each, acceptance tables, before/after the evening | L1–L4 ✅ |
> | No change under `packages/`; goldens; tests; lint; `season-check`; `asset-check`; harness | ✅ | `git diff v3j --stat -- packages` empty; `41a8c8b5…` / `d4bb14c3…`; 51 green; clean; passes; 288 / 0 / 0; identical to `v3j` ✅ |

**Goal:** a plan for online multiplayer on v3's rules that the next session can start building from.

**Deliverables:** `design/ONLINE_PLAN.md`; GDD_V3 §3's note and V24–V28; this section; CANON's `v3k`.

### Phases L1–L4 — online multiplayer (4 sessions) → `v3l1` … `v3l4`

> **Status: L1 DONE at `v3l1` (29 September 2026); L2 DONE at `v3l2` (30 September 2026); L3–L4
> PLANNED.** The spec, acceptance tables and order are in **`design/ONLINE_PLAN.md` §10**, with L1's and
> L2's results there; this is only the outline. L1: `viewFor` and twenty secret rows, `rumoursFor`, the
> off-season in any order (GDD_V3 L1a, L1b), `PROTOCOL_VERSION`, `test/view.test.ts` (133 tests) and
> `npm run view-walk` (0 throws). No rule, golden or save version moved; the hotseat checks read byte for
> byte as at `v3k`. Notes: `claude/V3_PHASE_L1_NOTES.md`. L2: `packages/server` (the routing Worker, the
> `Room` Durable Object, `protocol.ts`), not a root workspace so the Pages build is untouched, and
> `npm run online-walk`: headless clients finish whole games in a room under `wrangler dev` with 0 leaks
> (GDD_V3 L2a, L2b). Nothing under `packages/engine` or `packages/web` changed. Notes:
> `claude/V3_PHASE_L2_NOTES.md`.
>
> | Phase | Goal | When |
> |---|---|---|
> | **L1** `v3l1` ✅ | the engine's half: `viewFor` and its secret table, `rumoursFor`, the off-season in any order, `PROTOCOL_VERSION`. No golden moves | before the evening — **done** |
> | **L2** `v3l2` ✅ | the room: `packages/server`, a Worker and a Durable Object, the protocol, headless clients against `wrangler dev`. No deploy | before the evening — **done** |
> | **L3** `v3l3` | the web online: lobby, the store on a socket, `screenFor` without pass screens, two browsers. Hotseat untouched | either; after is safer |
> | **L4** `v3l4` | live on Jesse's Cloudflare account, and the first online evening | after the evening |

---

## 4. Effort estimate

| Phase | Sessions | Confidence |
|---|---|---|
| **A — the cull** | 1–2 | **good on the deleting, poor on the re-baseline.** Removing four markets touches nine engine files and six screens, but it is all subtractive. The unknown is where the economy lands with no costs and 10 weeks |
| **B — the market** | 1–2 | **good.** Data-heavy, one new screen, one price distribution to get right |
| **C — running styles** | 1 | **fair.** The curve is small; the contest rule is a positional interaction in the tick loop and the measurement is what takes the time |
| **D — Explore and the deck** | 2 | **poor, and it is the content that will slip.** 80 events is a lot of writing. Budget a session for the machinery and a session for the rows, and do not let the rows be the thing that gets cut |
| **E — the table** | 1–2 | **fair on the loop, poor on the playtest.** Four of its acceptance rows need other humans in a room |

**Total: 6–9 sessions**, roughly what v2 cost, for a game that plays nothing like it.

**Where the estimate is least trustworthy, in order:** (1) Phase D's 80 events; (2) Phase A's
re-baseline, because nothing below the race level survives it; (3) Phase E's human playtests, which
cannot be scheduled by a builder.

---

## 5. Risks

- **⚠️ v3 is a much more random game and nobody has played it.** Every acquisition is a draw. The
  guards are §9.2's partial information, §5.5's one-of-each opening hand and §5.2's variance being
  in the shape rather than the magnitude — but the aggregate has never been felt. *Mitigation:*
  Phase A is playable and should be played before Phase D adds more dice.
- **⚠️ Phase D under-delivers on content and the game is samey by the third play.** The most likely
  failure of the whole plan. *Mitigation:* the event count is an acceptance row with a number on it,
  and the machinery must be data-driven enough that the 81st event is a row.
- **⚠️ The contest rule may not be perceptible.** *Mitigation:* it has an explicit kill switch in
  Phase C's acceptance table. Cut it rather than tune it up.
- **⚠️ Free-target sabotage may sour a table.** *Mitigation:* it is a one-line change to make the
  leader cheaper to hit, and the decision waits for a real game with real people.
- **⚠️ The empty-hold penalty is carrying the entire economy.** With no upkeep, wages, fuel or debt,
  it is the only thing making money scarce. If it is too weak the market becomes optional and cash
  compounds without pressure. *Mitigation:* the "share of weeks with an empty hold" row in Phase B,
  and a willingness to make the penalty bite harder.
- **Pace with 8 players.** *Mitigation:* simultaneous phases are in the design from line one rather
  than retrofitted, and decisions-per-weekend is an acceptance row in every phase.
- **Carried from v1/v2:** art consistency across 18 planets (the prompt template and
  `ASSET_LIST.md` are the contract); scope creep (GDD §15 is the list that keeps things out, and
  nothing enters without a decision-log row).

---

## 6. Builder prompts

### Prompt V3-A
```
Read design/CANON.md first, then design/GDD_V3.md and design/BUILD_PLAN_V3.md (§1, §2 and Phase A)
in full before writing any code. §§1-5 of design/BUILD_PLAN.md are still current and are your
reference for architecture, repo layout and the data model. design/GDD.md is v2 and is historical -
do not build from it, but keep it open, because GDD_V3 cites its findings by name.

Before you start, run `npm run snapshot`. This phase deletes a great deal; `v2e` is the tag to fall
back to.

Task: Phase A - the cull. THIS PHASE IS SUBTRACTIVE. Do not add mechanics. The six-food market,
running styles, Explore and the hotseat loop are Phases B-E; building any of them here is how this
session overruns.

1. Execute BUILD_PLAN_V3 §2.1 in full. Delete the code, do not flag it off - a system behind a
   disabled flag is a system that still has to be reasoned about in Phase B.
2. Three stats: Dog.trap removed, rating weights 0.40 speed / 0.35 accel / 0.25 stamina, and
   bendCraft plus the trap-draw edge read accel.
3. Race or Rest only. Train leaves weekState. Race -20, Rest +30.
4. Three purse tiers replacing RaceType: Gold Cup / Silver Plate / Bronze Dash, open entry, one dog
   per stable per race, locals at 55 / 45 / 35 and fitness 75.
5. Ten weekends. Major at week 5 (x2), Grand Final at week 10 at Collar Prime (x3).
6. Three dogs dealt at the start on an equal stat budget, ages 2-4. Kennel slots gone.
7. Age bands per GDD_V3 §4.3 - growth, rest recovery and injury multiplier by age.
8. A placeholder single-good market so the trade loop still runs. Phase B replaces it; do not build
   the six goods now.
9. The spreadsheet. Prune design/space_dog_racing_economy.xlsx's Assumptions sheet of every tunable
   §2.1 deletes, and add the new ones: the fitness costs, the three purse tiers, the local ratings,
   the age bands, the 10-week calendar. Keep formulas intact, use openpyxl, regenerate balance.json
   with `npm run balance`, and commit both. The engine reads numbers only from balance.json.
10. Harness: delete the path agents (trainer/trader/crook/mixed), careless, bankruptRate,
    cardCoverage, the tier rows, and the staff/fuel/upkeep columns of the road split. Add three pace
    measures - decisions per weekend per player, races entered per weekend per stable, and races per
    dog per season.

Commits: land the deletions and the rule changes separately. The golden snapshot moves only in
commits whose message says that it does and why.

Finish with a FULL re-baseline, 800 all-Normal seasons, and paste every row of Phase A's acceptance
table into your final message. Every number below the race level was fitted to 13 weeks, four stats
and a dog market, so treat all of them as unverified rather than inherited.

Acceptance: the table in BUILD_PLAN_V3 Phase A. If "races entered per weekend" misses its 1.8-2.4
band, move the Race fitness cost and nothing else, and report what you changed and what it did. Do
not compensate by changing the purses.

Then run `npm run snapshot`, tag v3a, and write claude/V3_PHASE_A_NOTES.md in the style of the
existing phase notes: what was measured, what missed, and what the next phase inherits.
```

### Prompt V3-B
```
Read CLAUDE.md, design/GDD_V3.md (§6 in full, §2.3) and design/BUILD_PLAN_V3.md (Phase B), and the
Phase A code.

Task: Phase B — the market.

- Six goods on the bands and shelf depths of GDD_V3 §6.1, with foodBand as a per-planet multiplier
  over all six. Prices cluster mid-band with rare excursions: use normalDeviate() from
  determinism.ts. Never exp/log/pow.
- Fixed 50-unit hold for everyone. Feeding: one unit per dog per week regardless of state, bonuses
  per §6.3, sticky per-dog diet with a cheapest-aboard fallback. Build the empty-hold penalty
  (-10 fitness, no gain) FIRST and make it visible in the Kennel before the week resolves.
- The Market screen exactly as §6.2: Your Hold / On Planet / You Paid / Market Price / Price Range.
  The Price Range column is the most important thing in this phase - it is what makes the market
  legible on a first play. Do not replace it with a cheap/dear icon.
- Turn order = 20 - cargo/5 + d10, shown with its reason.
- Harness: a row per good, and the cash-bound-to-hold-bound crossover week.

Acceptance: the table in BUILD_PLAN_V3 Phase B. The p99 best-single-leg row is the one that
protects the game - if a single trade can be worth 40% of a season's end worth, tighten the price
distribution rather than the bands.
```

### Prompt V3-C
```
Read CLAUDE.md, design/GDD_V3.md (§5 and §7 in full) and design/BUILD_PLAN_V3.md (Phase C), and the
Phase B code.

Task: Phase C — running styles.

- Dog.style (front-runner / stalker / closer) modifying the pace curve per §5.1. A style is a
  REDISTRIBUTION of the same energy, not a bonus - check that a field of one style each has no
  systematic advantage before you go further.
- Style expression drawn per dog per race, U(0.30, 1.30), scaling the modifiers, drawn at a fixed
  point in race setup so the rng stream does not shift with field size. This varies the SHAPE of
  the run, never the dog's speed - GDD_V3 D13/V13 explains why that distinction is the whole game.
- The contest rule of §5.3, in its OWN commit with a re-baseline before and after.
- Hidden until raced, then public and written on the dog card. One of each style dealt per stable.
- Declarations public in turn order (§7.3) - the Race Office shows the field as it fills.
- Commentary that names the style and the day. The bookie prices style but not field interaction.
- Harness: --styles, per Phase C.9.

Acceptance: the table in BUILD_PLAN_V3 Phase C. The first row is a KILL SWITCH: if a closer's
advantage against a three-front-runner field is under 4 points after a sweep, remove the contest
rule entirely and keep styles for the watching. Report the sweep either way.
```

### Prompt V3-D
```
Read CLAUDE.md, design/GDD_V3.md (§8 and §9 in full) and design/BUILD_PLAN_V3.md (Phase D), and the
Phase C code.

Task: Phase D — Explore and the event deck.

- The Explore screen: three named, planet-flavoured doors resolving to an event card with 2-3
  choices. Simultaneous across players, contention by turn order. Planet.exploreDoors as data.
- AT LEAST 80 EVENTS, as rows, weighted by the five categories. This is the deliverable of the
  phase. If the session is running long, cut polish, not events - v3 has no other source of
  variety and a thin deck is the single most likely way this design fails.
- Dog acquisition per §9.2: age, one revealed stat, and a description that is sometimes a lie.
  Accepting means discarding one of your own.
- Staff per §8: two slots, all trainers, 1-10% of RACE PRIZE MONEY only, bonuses from §8.2.
- Sabotage and the bought trap draw as Back Alley events per §9.3, with the caught saboteur named
  publicly to the whole table. Information as Bar events.
- The free local runner for a stable with fewer than three fit dogs.

Acceptance: the table in BUILD_PLAN_V3 Phase D. season-check.ts must FAIL if a scripted season
produces zero sabotages, zero dog offers or zero staff offers.
```

### Prompt V3-E
```
Read CLAUDE.md, design/GDD_V3.md (§2 and §3) and design/BUILD_PLAN_V3.md (Phase E), and the Phase D
code.

Task: Phase E — the table.

- The hotseat loop of §2.3 for 3-8 players. Explore, Kennel and Bookie resolve SIMULTANEOUSLY for
  every player; only Market and Race Office are taken in turn order. This is the single biggest
  pacing lever in the design - if you implement it sequentially the game is unplayable at 8.
- Multi-season: 1-5 seasons plus the three-click off-season of §2.2. Race to a Target mode with the
  check at the end of every weekend and the highest net worth winning.
- Skippable animation for races a stable has no runner and no bet in.
- Season-end and game-end: income split, net-worth chart, moments. Seed sharing, save/resume.
- Harness: full-game runs at 1/3/5 seasons and target mode; wall-clock per player-weekend.

Acceptance: the table in BUILD_PLAN_V3 Phase E. Four of its rows are marked with a die and need
Jesse and other humans in a room - report the harness rows, list the playtest rows as outstanding,
and do not claim the phase is done until they are answered.
```

---

## 7. Working notes

- **Balance numbers still live in the spreadsheet**, generated into `balance.json`. Every ⚖️ in
  GDD_V3 is a cell. Phase A should prune the Assumptions sheet of everything §2.1 deletes.
- **Local backups unchanged:** `npm run snapshot` at the end of every phase and before any balance
  pass.
- **Playtest after every phase**, against a revised checklist. The v2 questions still work and gain
  three: *Did any week produce something you told someone about afterwards? Could you tell why a dog
  won? Did you ever wish you could buy something that does not exist?*
