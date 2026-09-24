# Space Dog Racing — Build Plan, v3

> **Status: CURRENT.** Build from this document.
>
> Canonical copy: `design/BUILD_PLAN_V3.md` in the `space-dog-racing` repo. A copy in a claude.ai
> Project is a **mirror**, last synced 25 September 2026 (at `v3e2`) — edit the repo, never the mirror. See
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
> | CI green on Node 20/22/24 | ✅ | **not checked**: no GitHub access from the build session. Look at the Actions tab |
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
