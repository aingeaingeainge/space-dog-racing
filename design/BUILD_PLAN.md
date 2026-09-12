# Space Dog Racing — Build Plan

Companion to `GDD.md`. This is the *how*: architecture, repo layout, milestones, acceptance criteria, and a ready-to-paste prompt for each milestone to hand to Claude Opus (or whichever model builds it).

**Working assumption:** Jesse reviews and playtests between milestones; the builder model works one milestone per session with the GDD, this plan, and the spreadsheet in the repo. Nothing below assumes the builder remembers a previous session.

> **Where things stand, 11 September 2026.** v1 is shipped and tagged `m4`. §6 is history — it is kept because its acceptance criteria are still the regression floor. **The live plan is §6b (the four v2 phases) and §7a (the rebuilt harness).** Online multiplayer was M5 and is now M6, behind v2.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  UI  (React + TypeScript, Vite)                          │
│   screens/  components/  hooks/   ← reads state, sends   │
│   race-view/ (Canvas 2D renderer, replays tick logs)      │
│                                   actions               │
├──────────────────────────────────────────────────────────┤
│  Store  (Zustand)  holds GameState + action log + seed    │
├──────────────────────────────────────────────────────────┤
│  Engine  (pure TypeScript, zero DOM, zero React)         │
│   reduce(state, action, rng) → state'                    │
│   simulateRace(field, track, rng) → RaceResult + ticks   │
│   ai/ decide(state, playerId, difficulty, rng) → actions │
│   content/ planets, events, traits, names, balance.json  │
└──────────────────────────────────────────────────────────┘
```

Rules that make multiplayer cheap later:

1. **The engine is pure.** No `Math.random`, no `Date.now`, no imports from React or the DOM. Every random draw comes from an injected seeded PRNG (`mulberry32` or `xoshiro128**`). Same seed + same actions ⇒ identical season, on any machine.
2. **Everything is an action.** `BuyDog`, `SellDog`, `Declare`, `PlaceBet`, `HireStaff`, `TradeFood`, `EndPhase`, `ResolveEvent{choice}` … The action log plus the seed *is* the save file and *is* the multiplayer protocol.
3. **Races emit a tick log.** `simulateRace` returns per-tick positions; the renderer only replays. A server can send the log; a client can never disagree about who won.
4. **Balance numbers live in `balance.json`,** generated from the spreadsheet's Assumptions sheet (a small script keeps them in sync). Designers tune the sheet; the game reads the JSON.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | Everywhere, including tests and scripts |
| Build | Vite | Fast dev server, static output |
| UI | React 18 | Function components, no class components |
| State | Zustand | One store: `{ game: GameState, log: Action[], seed }` |
| Styling | CSS Modules + CSS variables | Theme tokens from the art bible; no Tailwind (keeps the grimy look bespoke) |
| Race view | Canvas 2D via a thin `useCanvas` hook | PixiJS only if perf demands (it won't for 8 sprites) |
| Tests | Vitest | Engine has ≥80% coverage; UI smoke tests only |
| Lint/format | ESLint + Prettier | Pre-commit via `lint-staged` |
| Hosting | Cloudflare Pages (Git-connected) | Build command `npm run build`, output `packages/web/dist`; every push to `main` deploys, every PR gets a preview URL |
| Multiplayer (M6) | Cloudflare Workers + Durable Objects (one object per game room), via PartyKit or raw | Same Cloudflare account as hosting; runs the same engine package server-side |

## 3. Repository layout

```
space-dog-racing/
├─ CLAUDE.md                 ← builder instructions (see §4)
├─ design/
│  ├─ GDD.md
│  ├─ BUILD_PLAN.md
│  ├─ space_dog_racing_economy.xlsx
│  └─ economy_sim.py         ← Python reference for the race sim
├─ packages/
│  ├─ engine/                ← pure TS, published internally as @sdr/engine
│  │  ├─ src/
│  │  │  ├─ types.ts         (GameState, Dog, Player, Planet, Action, …)
│  │  │  ├─ rng.ts           (seeded PRNG + helpers: pick, gauss, shuffle)
│  │  │  ├─ reduce.ts        (root reducer; dispatches to phases/*)
│  │  │  ├─ phases/          (arrival, events, planet, declarations, raceDay, endTurn)
│  │  │  ├─ race/            (simulateRace, interference, tickLog, odds)
│  │  │  ├─ economy/         (dogValue, netWorth, market, food, loans)
│  │  │  ├─ ai/              (easy.ts, normal.ts, hard.ts, shared heuristics)
│  │  │  ├─ content/         (planets.ts, events.ts, traits.ts, names.ts, balance.json)
│  │  │  └─ index.ts
│  │  ├─ test/               (vitest; golden-seed replay tests)
│  │  └─ scripts/
│  │     ├─ balance-from-xlsx.ts   (xlsx Assumptions → balance.json)
│  │     └─ harness.ts             (run N seasons headless, print stats)
│  └─ web/                   ← Vite React app
│     ├─ src/
│     │  ├─ store/           (zustand store, persistence)
│     │  ├─ screens/         (Title, GalaxyMap, PlanetHub, Stable, Market, Docks, RaceOffice, Bookie, RaceView, Leaderboard, SeasonEnd)
│     │  ├─ components/      (DogCard, StatBar, RaceCard, OddsChip, Panel, NeonButton, …)
│     │  ├─ race-view/       (renderer.ts, camera.ts, sprites.ts, commentary.ts)
│     │  ├─ theme/           (tokens.css, planet themes)
│     │  └─ assets/          (generated art; placeholders first)
│     └─ index.html
├─ .github/workflows/ci.yml       ← tests on push (deploys are Cloudflare's job)
├─ scripts/snapshot.mjs           ← dated local backup of the repo (see §7b)
├─ wrangler.toml                  ← M6: Workers/Durable Objects config
└─ package.json              (npm workspaces)
```

## 4. `CLAUDE.md` for the repo

The live copy is `CLAUDE.md` at the repo root and it has moved on since M0 — it gained the `Math.pow`/`exp`/`log` prohibition in M1 after Node 22 and Node 24 disagreed about every stored odds value. **Read the file, not this section.** The only thing worth repeating here is why the rule that matters most is there:

> Same seed + same action log must reproduce the same season, **on any machine and any JS engine**. `test/golden.test.ts` guards the rules; `test/determinism.test.ts` guards the arithmetic.

**v2 adds one line to it**, in Phase A:

> Content is data. A race type, a good, a tier and a staff member are all *rows*. Adding the ninth race type or the thirteenth feed is not a code change — if it is, the shape is wrong.

## 5. Core data model (sketch — the builder finalises)

```ts
type Id = string;

interface GameState {
  seed: number; week: number;                 // 1..13
  phase: 'arrival'|'events'|'planetPre'|'declare'|'race'|'planetPost'|'endTurn'|'seasonEnd';
  calendar: { week: number; planetId: Id; major: boolean; grandFinal: boolean }[];
  planets: Record<Id, PlanetState>;           // market stock, food prices this week
  players: Player[]; turnOrder: Id[]; activePlayer: Id | null;
  dogs: Record<Id, Dog>;                      // all dogs incl. locals for sale
  declarations: Record<RaceClass, Record<Id /*playerId*/, Id /*dogId*/>>;
  bets: Bet[]; results: RaceResult[]; eventLog: LogLine[];
  toggles: { cleanSport: boolean; betting: boolean; trading: boolean; casualEvents: boolean };
}

interface Dog {
  id: Id; name: string; ownerId: Id | 'market' | 'local';
  speed: number; accel: number; stamina: number; trap: number;   // 1..99
  rating: number; fitness: number; form: number; age: number;
  traits: TraitId[]; injuryWeeks: number; wins: number; runs: number;
  look: { body: number; palette: number; accessory: number };
}

interface Player {
  id: Id; name: string; colour: number; kind: 'human'|'ai'; difficulty?: 'easy'|'normal'|'hard';
  cash: number; dogIds: Id[]; kennelSlots: number;
  ship: { speed: number; cargoCap: number; coldStore: boolean; upgradesPaid: number };
  cargo: number;                              // food units
  staff: { trainer?: StaffId; vet?: StaffId; fixer?: StaffId };
  training?: { dogId: Id; stat: 'speed'|'accel'|'stamina'|'trap' };
  loans: { lender: 'bank'|'shark'; principal: number }[];
  flags: { caughtDoping: boolean; };
}

type Action =
  | { t: 'BuyDog'; playerId: Id; dogId: Id }
  | { t: 'SellDog'; playerId: Id; dogId: Id }
  | { t: 'Declare'; playerId: Id; cls: RaceClass; dogId: Id | null }
  | { t: 'PlaceBet'; playerId: Id; cls: RaceClass; dogId: Id; kind: 'win'|'place'; stake: number }
  | { t: 'TradeFood'; playerId: Id; units: number }            // +buy / −sell
  | { t: 'HireStaff'|'FireStaff'; playerId: Id; role: StaffRole; staffId?: Id }
  | { t: 'SetTraining'; playerId: Id; dogId: Id; stat: StatKey }
  | { t: 'BuyUpgrade'; playerId: Id; upgrade: UpgradeId; dogId?: Id }
  | { t: 'Borrow'|'Repay'; playerId: Id; lender: 'bank'|'shark'; amount: number }
  | { t: 'ResolveEvent'; playerId: Id; choice: number }
  | { t: 'EndPhase'; playerId: Id }
  | { t: 'AdvancePhase' };                                       // system
```

## 6. Milestones

Each milestone ends with: tests green, harness run, a short demo Jesse can click through, and a tag (`m0`, `m1`, …).

### M0 — Skeleton and engine core (1 session)
**Goal:** a repo where `npm test` passes, the engine can create a season and run a full 13-week season *headless* with three Normal AIs, and the harness prints net-worth stats.
**Deliverables:** workspaces scaffold; `types.ts`, `rng.ts`, `reduce.ts` with all phases (stubbed where content is missing); `simulateRace` ported from `economy_sim.py`; `dogValue`, `netWorth`; `balance-from-xlsx.ts` + generated `balance.json`; Normal AI (declare-by-EV, trade food on spread, keep a trainer); `harness.ts`; golden-seed test; CI running tests; `CLAUDE.md`.
**Accept when:** `npm run harness -- --seasons 200` completes in < 30 s and reports mean end worth for Normal AI in the 45–75k band; race calibration (rating-65 vs seven 50s) wins 45–60%.

### M1 — Ugly but complete playable season (1–2 sessions)
**Goal:** a human can play a whole season in the browser against AIs using plain HTML tables and buttons. No art.
**Deliverables:** Zustand store + localStorage save/resume; screens: New Season, Galaxy Map (list), Planet hub (buttons), Stable, Market, Docks (food + ship), Saloon (staff, loans), Race Office (declarations with cap validation), Bookie, Results (text), Leaderboard, Season End. Events deck (≥25 cards) with choice modals. All 18 planets as data with specials implemented. Traits (≥12). Toggles. Hotseat: any mix of human and AI players in one browser (required for v1, decided 2026-09-07). Human turns are taken in turn order with a 'pass the laptop' interstitial; declarations and bets stay hidden from the other humans until lock.
**Accept when:** Jesse completes two seasons without a blocker; every GDD §4.2 phase is reachable; save/resume mid-season works; the season takes ≤ 60 min without the race animation.

### M2 — Race view (1 session)
**Goal:** the three races are watchable and exciting.
**Deliverables:** Canvas renderer replaying tick logs along an SVG spline track (one spline per planet, placeholders OK); camera follows the leader with easing; dog sprites (coloured capsules with numbers for now); lure; position ticker; commentary generator (~60 lines with slots); 1×/2×/skip; photo-finish freeze; results overlay with payouts and rating deltas.
**Accept when:** a race replays identically from the same log; 60 fps on a mid laptop; skipping never desyncs state.

### M3 — World, content and art integration (2 sessions)
**Goal:** it looks like the game in the art bible.
**Deliverables:** theme tokens; planet hub screens with painted backdrops and hotspots (generated art dropped into `assets/planets/<id>/`); dog portrait compositor (body × palette × accessory); track top-downs per planet; event cards with illustrations; UI kit (riveted panels, neon buttons, ticket-stub race cards, betting slip); AI stable-owner portraits and personalities; name generator word lists (≥200 words each side). Asset pipeline doc: exact filenames/sizes the game expects, so Jesse can generate/replace images without touching code.
**Accept when:** every screen uses final-style assets or a clearly marked placeholder; a new planet can be added with one data row + three image files.

### M4 — AI, balance, polish, ship (1–2 sessions)
**Goal:** a v1 you'd put a link to on a forum.
**Deliverables:** Easy and Hard AI; balance pass using the harness (target: Hard beats Normal ~65% of seasons, Normal beats Easy ~80%, human-with-a-clue beats Normal ~50% after two plays); Majors purse-share decision (§20 Q2); season-end moments and worth chart; sound (optional); keyboard shortcuts; mobile-width layout check; Cloudflare Pages deploy; README with a play link; seed sharing ("challenge a friend to the same season").
**Accept when:** deployed URL works from a phone and a laptop; harness targets met; no console errors across a season.

### M5 — ~~Online multiplayer~~ → **renumbered M6 and moved behind v2** (GDD §19, D16)

**M5 no longer exists.** Online multiplayer is now M6 and runs *after* the four v2 phases below. Building a server for rules that are about to change is the wrong order: v2 rewrites declarations, eligibility, the goods market, staff, and adds a whole information layer, and every one of those is protocol surface. Nothing in v2 breaks the engine's purity, so M6 is exactly the job it always was — just later. Its spec is kept verbatim at §6b.9 for when it comes round.

---

## 6b. V2 — the mechanics rethink

v1 shipped at tag `m4` on 9 September 2026: a whole 13-week season against three AI difficulties, deployed and correct. The problem it has is that there are not enough decisions in it. GDD 0.2 is the answer; this section is how it gets built.

**Four phases, in dependency order** (GDD §19, D9). Each moves the golden snapshot exactly once, the way M4 session 1 did, and each ends with Jesse playing a season before the next begins.

**The specifications for C and D are provisional on purpose.** This design has grown a great deal on paper and none of it has been played. Expect Phase A's playtest to change them, and do not let the volume of decisions substitute for that.

### Phase A — the training game (2 sessions)

**Goal:** a stable you raise. Pups, Race/Train/Rest, fitness that reads, a kennel worth filling, and a bankruptcy that can happen.

**Deliverables**
1. **The race rebalance (GDD §6.2 / D12) — first commit, on its own.** `balance.json` only: `raceBaseSpeed` 13.75, `raceSpeedCoef` 4.5, `raceFadePenalty` 0.50, `raceAccelBase` 2.0, `raceAccelCoef` 5.5, `raceBreakMetres` 7, `raceBumpChance` 0.30, `raceBumpPenalty` 0.30, `raceBumpDistance` 1.2. Mirror into the spreadsheet. Re-fit `oddsScale` (GDD §20 Q4) and say what was chosen and why.
2. **The fitness softening (D13):** `fitScale` becomes `0.90 + 0.10 × fitness/100`. This is a *code* constant in `simulateRace` today — move it to `balance.json` as part of this change.
3. **Race / Train / Rest (GDD §5.7).** A new per-dog weekly state, set in the Kennels. New action `SetDogState`. Race −25, Train +8, Rest +30. Layoff is imposed by injury or ban, not chosen.
4. **Pups (GDD §5.6).** Market stock weighted to age-1; growth becomes +2/week at age 1, +1 at age 2, −1 at age 5+. Kennel slots 4 → 6 at the top ship tier.
5. **Bankruptcy reachable (D6).** No new mechanism — verify the above reaches 5–10% on the careless agent, and adjust upkeep or the forced-sale floor only if it does not.
6. **AI:** every difficulty needs a Race/Train/Rest policy. Normal: a fitness rule. Hard: a policy that values a Train week against the purse it is passing up.
7. **Harness rebuild, part 1** — §7 below. The careless agent and the new core measures ship in this phase, because nothing after it can be judged without them.

**Accept when** — ✅ built and measured at tag `v2a`. Nine of fourteen met, and the five that are not are named in place; see `claude/V2_PHASE_A_NOTES.md`.

| Measure | Target | Measured | |
|---|---|---|---|
| `+10` to one stat, from a balanced rating-50 dog | speed 21–25%, stamina 18–22%, accel 14–18%, trap 12–16% | 24.2 / 19.2 / 16.1 / 15.3 | ✅ |
| accel's edge on a 350 m track vs a 600 m | measurably larger | 17.2 vs 15.4 | ✅ |
| the same for trap on tight bends | measurably larger | 17.0 vs 15.3 | ✅ |
| the same for stamina on stayers | measurably larger | 19.0 vs 19.2 — flat | ❌ structural; the fade is a fraction of the distance (GDD §5.1) |
| §6.2 calibration (balanced 65 vs seven 50s) | 45–60% | 58.5% | ✅ near the top, as predicted |
| mean fitness at declaration | 60–80 (v1: 96) | 70.5 | ✅ |
| share of declarations below 60 fitness | 10–25% (v1: 0%) | 21.5% | ✅ |
| races per dog per season | 7–9 | 5.2 | ❌ the fitness budget allows ~7 and the card does not make the last two worth running |
| mean dogs owned at week 13 | ≥ 4.5 (v1: ~3.4) | 3.9 | ❌ the kennel module does not pay back (GDD D21) |
| bankruptcies, careless agent | 5–10% | 0.0% | ❌ moved to Phase C (GDD D20) |
| bankruptcies, Normal | ≤ 2% | 0.1% | ✅ |
| a pup bought week 1, trained throughout | reaches par in The Open between weeks 9 and 11 | week 8 with a trainer, never without | ✅ on the early edge |
| `npm test` | green, golden snapshot moved **twice**, in the two commits that say so | 22 green | ✅ |
| `hub-clicks.ts` | ≤ 13.3 | 14.0 | ❌ +1 for the per-dog decision, with the summary already in (GDD §15.3) |

### Phase B — the card and the fog (1–2 sessions)

**Goal:** you do not know what is coming, and the races you can enter depend on what you have raised.

**Deliverables**
1. **The race card (GDD §6.3).** ✅ Built. `RaceClass` is replaced by a `RaceType` **row** — id, label, an eligibility predicate keyed off fields already in `Dog`, a purse tier, and a *local spec* the plan did not anticipate: a short field is filled with locals, locals bypass `Declare`, and without one the Juvenile fills with four-year-olds. Landed in two commits exactly as §11 asks — the shape with the three classes still in it, then the seven types on top.
2. **Purses (GDD §6.4)** and the 27% pool cut (D15). ⚠️ **Measured and deferred to Phase C — see GDD D22.** The pool stays at 19,250.
3. **The fog (D5).** ✅ Built. The Galaxy Map shows this planet in full, next week by name and Major status, and nothing else. Dossiers are bought on the map rather than in the Market and add **nothing to GameState** — the purchase is in the action log, which is where "this stable paid to look" already lives. The Tipster and the information event cards are Phase C, both for stated reasons.
4. **Re-tune `lib/rumours.ts`** — ✅ horizon 4 → 2, `NOTABLE` 14 → 10, `CHATTER` 0.55 → 0.75.
5. **Harness rebuild, part 2**: per-type entry counts, the concentration measure. ✅ Built, plus
   `cardCoverage`, the fill-rate distribution, purse share to players, the "decided by" week, the
   gross road split, `autoplan%` and a `--card` eligibility probe. `apLoss%` is built and reports
   an error bar around zero — see GDD D25.

**Accept when** — ✅ built and measured at tag `v2b`. Four of seven met, and the three that are
not are named in place; see `claude/V2_PHASE_B_NOTES.md`.

| Measure | Target | Measured | |
|---|---|---|---|
| broad 5-dog stable fills all three races | 55–70% of weeks | **76.3%** | ❌ over by 6 points — eligibility constrains a broad stable less than the estimate assumed. In a real season the same stable fills all three 20.4% of weeks, because fitness binds first (GDD §20 Q13) |
| one-dog-concentrated stable fills all three | ≤ 20% | **10.3%** with two fillers, 13.0% with four, **0.0%** for four good dogs | ✅ and almost exactly GDD 0.3's predicted 14% |
| each race type used | ≥ 8% of all races run | **8.8%** (Consolation) to 33.3% (The Open) | ✅ every type |
| a maiden win visibly costs future eligibility | maiden entries fall after a first win | entries per Maiden run **5.64 → 4.85 → 4.11** across the thirds of the season | ✅ |
| prize share of a stable's income | falls from 87% toward 65% | **81.7%** gross | ❌ and unreachable by cutting the purse: the other roads gross 7,016 a season, so 65% needs a 59% cut (GDD §6.4, D22) |
| season "decided by" week | later than v1's 7.6 | **6.4** | ❌ *earlier*. Fewer contested races a weekend means fewer chances to overturn a lead; the Consolation is the lever and it is enterable 29% of the time (GDD §20 Q12) |
| `concentration`, champion's mean (§7a.4) | below 0.4 | **0.278** | ✅ |
| `npm test` | green, golden snapshot moved **twice** | 22 green, moved twice | ✅ |
| `hub-clicks.ts` | ≤ 14.5 | **13.9** | ✅ under Phase A's 14.0 |

**The re-baseline**, 800 all-Normal seasons: mean end worth **31,600** (p10 8,052, p50 25,836,
p90 67,035), prize 31,334 · trade −4,220 · betting −912 · costs 16,652, bankruptcy 0.0%. Fitness
at declaration 72.1 with 18.6% below 60; **races per dog 4.8** (was 5.2) and dogs at week 13 3.84.
Head to head: Normal beats Easy **77.9%**, Hard beats Normal **56.0%** (v1 60.6, Phase A 56.8).
Calibration 58.5%; stat leverage 24.2 / 19.2 / 16.1 / 15.3, unmoved. Purse pool 358,685 posted a
season with **52.4%** of it reaching a player.

⚠️ **D15's purse cut is measured and deferred to Phase C (GDD D22).** It is the deliverable this
phase deliberately did not ship, and §6.4 carries the four measurements behind that.

### Phase C — the economy (2 sessions)

**Goal:** something worth spending money on, three ways.

**Deliverables**
1. **Goods (GDD §8.2):** ✅ Built. Kibble as the staple plus four stat feeds × three tiers, twelve rows generated from one price formula. `cargo` is a **dense** per-good record and `PlanetState` posts a price and a shelf depth per good; `STATE_VERSION` and `SAVE_VERSION` are both 4. Landed in two commits exactly as §11 asks — the shape with kibble alone, where **only `stateHash` moved in the golden digest**, then the content on top.
2. **The tier ladder (D11):** ✅ Built. Rough / Proper / Prime as a word and one to three chevrons, shared by the goods, the staff, the stock chances and the ship's engine, which is folded from five tiers to three.
3. **Staff (D7):** ✅ Built. `Player.staff` is a list of up to three in any mix; six roles × three tiers; wages by tier, so `trainerWage` and `vetWage` are gone. Stacking measured at 49.1–51.4% and no penalty added. The Fixer stays unhireable until §13.
4. **A busier market (D10)**, inside the budget. ✅ Built: thirteen goods, five hireable roles, and a per-stable shelf the Scout and Trader fill. It broke the budget at 15.3 and summaries brought it back to **13.9** — see GDD D34 for the principle that did it.
5. **The trader's road:** ✅ Built and sized by ablation. Fuel 5 → 2 a crate, hold 2,500 → **1,400**, and the first upgrade returns 1,506. The finding worth keeping is that the *second* returns 996 and the fifth less than nothing.
6. **Harness rebuild, part 3**: ✅ Built. A row per good and tier, kept gross; the trainer and trader agents with the three-way printout and §7a.5's caveat printed beneath it; `leadConversion`, read off the action stream so nothing was added to `GameState` (GDD D36); plus `--holdPayback` and `--stacking` for the two acceptance rows that needed an ablation each.

**Accept when** — ✅ built and measured at tag `v2c`. **Five of seven met**, and the two that are
not are named in place; see `claude/V2_PHASE_C_NOTES.md`.

| Measure | Target | Measured | |
|---|---|---|---|
| trade income, Normal | positive | **+1,939** | ✅ and it took a measurement fix to see it (GDD D33) |
| trade income, trader agent | 8–15k | **6,680** | ❌ short by 1,300. The road *pays* — it ends level with the trainer's — but the income line is bound by cash to buy stock, not by capacity or margin (GDD §9.2, §20 Q15) |
| a +20-unit cargo upgrade | pays back inside one season | **1,506 back on 1,400 paid** | ✅ by ablation, 600 seasons. The second returns 996 and the third 395 |
| stacking three of one staff role | no more than 5 points of head-to-head over a mixed three | **49.1–51.4%** across all five roles | ✅ comfortably, so no penalty goes in (GDD §21) |
| Prime offers seen per season | 2–5 | **2.93** a stable-season | ✅ |
| lead conversion | the gap Prime creates is no larger for the leader | leader **+0.11**, trailer **+0.24** | ✅ D11's guards hold |
| `hub-clicks.ts` | ≤ 14.5 | **13.9** | ✅ after it went to 15.3 and was fixed with summaries, not by cutting decisions (GDD D34) |
| bankruptcies, careless agent | 5–10% | **5.5%** | ✅ D6 met for the first time, and `upkeepPerDog` never moved |
| the three roads, mean end worth | within 15% of each other | trainer 31,724, trader 31,361 — **1.4% apart** | ✅ for the two roads that exist; the crook is Phase D's |
| `npm test` | green, golden snapshot moved **twice** | 22 green, moved twice | ✅ |
| `npm run lint` | clean | clean | ✅ |

**The re-baseline**, 800 all-Normal seasons: mean end worth **31,382** (p10 9,113, p50 25,909, p90
64,538), prize 32,185 · trade **+1,939** · betting −814 · costs 24,120, bankruptcy 0.1%. Fitness at
declaration 71.5 with 19.9% below 60; **races per dog 5.1** (was 4.8) and dogs at week 13 3.83. Purse
pool 358,685 posted with **53.8%** reaching a player. Prize share **77.3%** gross (was 81.7%).
Head to head: Normal beats Easy **79.3%**, **Hard beats Normal 58.6%** (v1 60.6, Phase A 56.8, Phase
B 53.9 — recovered 4.7 points by hiring *less*, GDD D30). Calibration 58.5%; stat leverage 24.2 /
19.2 / 16.1 / 15.3, unmoved. Season decided by week **6.6** (was 6.4).

⚠️ **D15's purse cut is dead and that is this phase's most useful result (GDD D29).** Cutting the
pool 10% costs 15% of a stable's end worth and moves the prize share from 77.3% to **77.4%**: the
ratio is invariant to the cut at any depth, because prize money is the working capital of the other
two roads. The 65% prize share is retired as a target in favour of §20 Q2's direct measurement.

### Phase D — the dark side and the scoreboard (1–2 sessions)

**Goal:** the third road exists, and all three are worth the same.

**Deliverables**
1. **GDD §13 built:** the Fixer returns to hire; steward bribe; sabotage at −25 fitness; detection, fines, the season ban, and telling the wronged stable who did it.
2. **A flat stake ceiling** alongside the fractional one (GDD §20 Q7).
3. **Championship points and the purse at the Collar (D3).**
4. **The three-path balance pass** — the whole point of the phase.
5. **Harness rebuild, part 4**: the crook agent; the three-way comparison as a first-class printout.

**Accept when**
| Measure | Target |
|---|---|
| trainer / trader / crook agent mean end worth | within 15% of each other |
| each path's p90/p10 spread | distinct — the crook widest, the trainer narrowest |
| crook agent caught at least once | 40–70% of seasons |
| a caught crook's mean end worth | below the trainer agent's |
| a mixed agent (all three) | not worse than the best single path |
| Hard beats Normal | 63–68% |

### 6b.9 — M6, online multiplayer (2–3 sessions, after v2)

Unchanged from the old M5 in every respect; see §9's Prompt M6. `Action` gains `SetDogState` and the goods record, and `RaceClass` becomes `RaceType`, so the protocol surface is larger than it was — but it is still just the action log.

**Goal:** a lobby code, 2–8 people, same engine.
**Deliverables:** `packages/server` as a Cloudflare Worker + Durable Object per room running the engine authoritatively (PartyKit optional); lobby (create/join by code, fill with AI); simultaneous planet phases with a 90 s timer and turn-order-resolved contention; action log sync + reconnect; spectator/replay of finished seasons; optional async "play-by-link" mode.
**Accept when:** two browsers on different machines finish a season together; a refresh mid-season rejoins with no state loss.

## 7. Testing and balance strategy

- **Golden seed tests:** seed 42 + a scripted action list ⇒ snapshot of final state. Any rule change must update the snapshot deliberately.
- **Property tests (engine):** cash never negative except via loans; a dog is never in two races; declared dogs meet their race's entry criterion; net worth formula equals sum of parts; **every dog has exactly one weekly state**; **every good in a hold is non-negative and the hold never exceeds capacity**.
- **The harness is the balance instrument**; the spreadsheet is the design instrument. When they disagree the harness wins and the spreadsheet gets updated.
- **Playtest checklist (Jesse, after every v2 phase):** Did any week present a choice you had to think about? Did you ever leave a race to the locals on purpose? Did you ever want to buy information? Did any purchase feel pointless after week 8? Was there a week where nothing happened?

**A methodology warning that still stands.** Pairings inside a season are correlated — two Hards against three Normals is six pairings but one season — so the effective sample is the *season* count. At 200 seasons the standard error on a head-to-head is about **3.5 points**, not 1.4. **Use 800 seasons for any decision worth under 5 points.** M4 session 1 lost an hour tuning against 200-season runs and watched a "+5 point" change evaporate when the RNG stream shifted underneath it.

### 7a. The rebuilt harness — specification

⚠️ **Every v2 change invalidates part of the current instrument.** "Average Gold field rating by week" is meaningless with no Gold. The income split needs a row per good and tier. And `naive%` — the single measure that made M4's balance tractable — assumed one decision a week and there are now up to six. This is the deliverable most likely to be skipped and the most expensive to skip, so it is specified here rather than left to the builder.

#### 7a.1 What survives unchanged
Mean / p10 / p50 / p90 end worth and win rate by difficulty; head-to-head by difficulty; elapsed time and actions per season; supplement use and catch rate; the calibration mode (`--calibrate`).

#### 7a.2 What is replaced

| v1 measure | v2 replacement | Why |
|---|---|---|
| `average Gold field rating by week` | **`field strength by week, per race type`** — mean entrant rating for The Open and for each drawn type | There is no Gold. The Open's curve is the one that reports the same thing (are stables racing up?), and the per-type rows are how you see a type going unused |
| `income split: prize / trade / bet / costs` | **a row per good and tier** for trade, and a **road split**: prize / trade / betting / information bought / dog trading | §7.1's whole problem is that these three numbers are 87 / −9 / −1. You cannot balance three roads on one trade column |
| `naive%` / `nLoss%` | **`autoplan%` / `apLoss%`** — see 7a.3 | Race/Train/Rest replaced a one-decision week with a six-decision one |
| `seasons where the champion won a Major Gold` | **`seasons where the champion won a Major Open`**, plus **`champion's prize share of end worth`** | The second is the one that actually reports whether racing is still the only road |

#### 7a.3 `autoplan%` — the redefinition

`naive%` asked: how often is "best dog to the biggest race, next to the next" *exactly* the EV-optimal assignment? It ran 59% before M4's purse change and 19% after, and that number is why the change was made.

The v2 equivalent has to cover a stable's whole week: a state for every dog, then an entry for every race it is eligible for. Define the **autoplan** as:

> every fit dog Races if it is eligible for anything; the best eligible dog goes into the richest race it can enter; anything under 50 fitness Rests; nobody Trains.

That is the v2 shape of "just enter everything", and it is what a player does before they have understood the game.

- **`autoplan%`** — share of stable-weeks where the autoplan is exactly the optimal plan.
- **`apLoss%`** — expected worth given up, over the *rest of the season*, by playing it. ⚠️ Unlike `nLoss%` this cannot be a one-week expected-purse figure: a Train week pays off in weeks 9–13, so the loss has to be evaluated against season-end worth. The honest implementation is a **rollout**: from the state at that week, play the season out twice — once with the autoplan forced for that week, once with the agent's own plan — on the same downstream seed, and difference the end worth. Expensive, so sample it (one week in four is enough) and say so in the printout.

**Target: `autoplan%` between 15% and 30%.** Above 40% the week is making itself. Below 10% the player cannot find the plan at all and it reads as noise rather than depth.

#### 7a.4 New measures

**`bankruptRate` (D6), as a first-class number, per agent.** Reported for the careless agent, where the 5–10% target lives, *and* for each difficulty, where it should stay near zero. v1's "0 bankrupt" was quietly reporting that the economy could not kill you.

**`concentration`** — Herfindahl index over each stable's dog values at week 13 (`Σ (value_i / Σvalue)²`). 1.0 is one dog, 0.2 is five equal dogs. R1 says v1 rewards the top end; v2 should push the champion's mean below 0.4.

**`leadConversion` (GDD §20 Q3)** — the Prime-tier amplification test, and the reason it needs its own machinery: take every season, split stables into *ahead at week 6* and *behind at week 6* by net worth rank, and for each, record the change in worth rank from week 6 to 13 **conditional on having taken a Prime offer**. Report the two deltas side by side. **If the leader's gain from a Prime offer is larger than the trailer's, D11's consumable/wage guards are not strong enough.** Requires the engine to log Prime acquisitions; a two-field addition to `PlayerSeasonStats`.

**`cardCoverage`** — for each race type, the share of weekends where the stable had an eligible, fit dog. This is the number that says whether the fog plus fact-gating is a decision or a lottery (GDD §20 Q5).

**`infoSpend` and `infoROI`** — Bones spent on dossiers, tipsters and information events, and the trade profit on the legs that information covered, minus the same stable's profit on uncovered legs. Prices the information economy directly (GDD §9.2).

#### 7a.5 The four new agents

The existing `easy` / `normal` / `hard` measure *difficulty*. These measure *strategy*, and they are what open questions Q2 and Q3 need. They live alongside the difficulties in `ai/` and are selectable by `--ai`, but they are **not offered to players** — a player picking "Trader" as an opponent would be picking an opponent that is deliberately bad at two thirds of the game.

| Agent | Plays | Exists to answer |
|---|---|---|
| **`careless`** | enters everything, never rests, never trains, hires whatever is offered, never repays a loan, buys the dearest dog it can reach | **D6**: is the bankruptcy rate 5–10%? Nothing else can measure it, because a competent agent never goes bust |
| **`trainer`** | buys pups, trains them, keeps a trainer and a vet, does not trade beyond eating, never bets | **Q2**, road 1 |
| **`trader`** | keeps three cheap dogs, buys hold and information, works the spread, races only when the purse is free money | **Q2**, road 2 |
| **`crook`** | keeps a mid stable, hires a Fixer, sabotages the favourite in the richest race it is in, backs its own dog | **Q2**, road 3, and it is the only way to price §13 before it ships |

Each takes the same `Plan` steps in `ai/shared.ts` with a different options object — the M4 session 1 refactor already made every step configurable, and that is the shape this depends on.

**The three-way printout is the deliverable**, not the agents: mean / p10 / p90 end worth for `trainer`, `trader`, `crook` in the same seasons, with the road split beside it. **Target: within 15% of each other on the mean, and visibly different in spread.**

⚠️ **A caveat to state in the printout.** Three hand-written agents measure whether three roads *can* pay, not whether they are *balanced against a good player*. Jesse beat three Hard and three Normal stables with a line no agent plays. The agents are a floor test, not a proof.

#### 7a.6 Invocation

```
npm run harness -- --seasons 800 --ai easy,normal,normal,hard,hard,normal
npm run harness -- --seasons 800 --ai trainer,trainer,trader,trader,crook,crook   # Q2
npm run harness -- --seasons 400 --ai careless,normal,normal,normal               # D6
npm run harness -- --seasons 400 --leadConversion                                 # Q3
npm run harness -- --seasons 200 --autoplan                                       # the rollout, sampled
npm run harness -- --calibrate
```

At v1's ~77 ms a season, 800 seasons is about a minute. The rollout mode is roughly 4× that and should say so.

## 7b. Local backups and rollback

Git is the real rollback mechanism: every milestone is tagged (`m0`, `m1`, …) and `git checkout m2` restores that exact build. As belt-and-braces, the repo also keeps dated local snapshots outside version control:

- `npm run snapshot` (scripts/snapshot.mjs) copies the repo — excluding `node_modules`, `dist`, `.git` and `backups/` — into `backups/YYYY-MM-DD_HHMM_<tag-or-short-hash>/` and writes `SNAPSHOT.md` inside it with the commit hash, tag and harness summary. `backups/` is git-ignored.
- The builder runs it at the end of every milestone and before any balance pass or refactor that touches the engine. Jesse can run it any time.
- Rollback: copy a snapshot folder over the repo (or `git checkout <tag>`), `npm install`, done. Cloudflare Pages also keeps every deployment; a previous deploy can be re-promoted from the dashboard with one click.

## 8. How to run the build sessions

1. **Done (7 Sept 2026):** GitHub repo `aingeaingeainge/space-dog-racing` exists (public, README + Node .gitignore, branch `main`), and a Cloudflare Pages project `space-dog-racing` is already connected to it (build `npm run build`, output `packages/web/dist`, `NODE_VERSION=20`), deploying to `space-dog-racing.pages.dev` on every push to `main`. The local project root is `Documents\CoWork\dog racing game`, which already holds `design/`. The M0 prompt tells the builder to `git init` there, add the remote, pull, and push.
2. One milestone per session. Start every session with the prompt below for that milestone. Opus reads `CLAUDE.md`, the GDD, this plan, and the code — nothing else is needed.
3. At the end of each milestone: tag, `npm run snapshot`, deploy (from M4), playtest against the checklist, write findings into `design/PLAYTEST_NOTES.md`, and bring them to the next planning conversation. Rule changes go into the GDD's decision log *before* the next build session.
4. Balance changes: edit the spreadsheet → `npm run balance` → commit both.

## 9. Ready-to-paste prompts for the builder

Each prompt assumes the repo is checked out and `design/` is present.

### Prompt M0
```
You are building "Space Dog Racing", a browser game. Read design/GDD.md, design/BUILD_PLAN.md (sections 1–6, milestone M0) and design/economy_sim.py fully before writing code.

Task: complete milestone M0 exactly as specified in BUILD_PLAN.md §6.
- First, git: this folder is the project root and already contains design/. Run `git init`, `git remote add origin https://github.com/aingeaingeainge/space-dog-racing.git`, `git pull origin main` (the repo has a README and a Node .gitignore), and from then on commit as you go and push to `main` at the end. Do not create a new repository. Cloudflare Pages is already connected to this repo and will try to build every push with `npm run build` → `packages/web/dist`, so make sure the root `npm run build` produces that folder (an empty Vite shell is fine for M0).
- Scaffold npm workspaces: packages/engine (pure TypeScript, strict) and packages/web (Vite + React, can be an empty shell for now).
- Implement the engine: types.ts per the data model sketch (finalise it), rng.ts (mulberry32 with pick/gauss/shuffle/int helpers), reduce.ts with every phase from GDD §4.2, race/simulateRace.ts ported faithfully from economy_sim.py run_race() and returning a tick log, race/odds.ts (logistic win-probability model calibrated against simulateRace by running it), economy/ (dogValue, netWorth, market pricing, food prices, loans), content/ (all 18 planets from GDD §12 as data, ≥12 traits, ≥25 events, name word lists), ai/normal.ts per GDD §14.
- scripts/balance-from-xlsx.ts reads design/space_dog_racing_economy.xlsx Assumptions sheet (column A labels → column B values) into content/balance.json; the engine imports numbers only from balance.json.
- scripts/harness.ts runs N headless seasons and prints the stats listed in BUILD_PLAN §7.
- test/golden.test.ts: seed 42, 6 Normal AIs, full season ⇒ snapshot. Plus the property tests in §7.
- Write CLAUDE.md from BUILD_PLAN §4 verbatim. Add a GitHub Actions workflow running npm test on push. Add scripts/snapshot.mjs and the `npm run snapshot` script per BUILD_PLAN §7b, and run it once at the end of the milestone.
Acceptance: npm test green; `npm run harness -- --seasons 200` < 30 s, mean Normal-AI end worth 45–75k Bones; calibration check (one rating-65 dog vs seven rating-50) wins 45–60% — adjust race noise constants in balance.json if not, and report what you changed. Paste the harness output in your final message. Do not build UI beyond the Vite shell.
```

### Prompt M1
```
Read CLAUDE.md, design/GDD.md, design/BUILD_PLAN.md (milestone M1) and the existing packages/engine code. Do not change engine rules unless the GDD requires it; if you must, update the golden snapshot and explain why.

Task: milestone M1 — an ugly but complete playable season in packages/web.
- Zustand store holding { seed, log: Action[], state } with derived state via engine.reduce; persist log+seed to localStorage; "Resume season" on the title screen.
- Screens listed in GDD §15 as plain, functional React (tables, buttons, simple modals). No art, no canvas. Use one shared Panel component so M3 can reskin without rewriting screens.
- Human turns follow GDD §4.2 phases; AI turns resolve instantly via engine.ai. Support any mix of human/AI players (hotseat) in the New Season screen — this is a v1 requirement. Between human turns show a 'Pass to <name>' interstitial; a human's pending declarations and bets are not shown to other humans until declarations lock.
- Declarations screen must enforce rating caps and show all other stables' declarations and the local dogs. Bookie shows odds from engine odds.ts. Results screen lists finishing order, payouts, rating deltas, injuries.
- Events show as a modal with choices; planet specials are applied and displayed on the planet hub.
- Leaderboard: every stable's cash, dogs value, ship, debt, net worth, Gold wins, doping icon; visible from every screen.
- Season End: podium + table.
Acceptance: I can play two full seasons; save/resume works mid-week; a season takes under 60 minutes; npm test green. Finish by writing design/PLAYTEST_CHECKLIST.md from BUILD_PLAN §7 for me to fill in.
```

### Prompt M2
```
Read CLAUDE.md, design/GDD.md §6.3 and §16, design/BUILD_PLAN.md (milestone M2), and packages/web. 

Task: milestone M2 — the race view.
- packages/web/src/race-view: a Canvas 2D renderer that replays a RaceResult tick log from the engine along a track spline. Tracks: one SVG path per planet in content (add placeholder ovals/rings/straights matching each planet's GDD §12 distance and bend description). Map distance-along-track → (x,y,heading) with arc-length parameterisation.
- Camera follows the leading group with easing; zoom slightly on the finish. Dogs are coloured capsules with saddle-cloth numbers for now (sprite hook left ready for M3). Draw a lure ahead of the leader.
- HUD: live positions ticker, race class + purse, commentary bar fed by race-view/commentary.ts (≥60 templated lines keyed to events in the log: break, lead change, bump, fade, photo finish). Controls: 1×, 2×, skip. Photo-finish freeze when the winning margin < 0.3 m.
- Results overlay after each race: order, payouts, bets settled, rating deltas. Then auto-advance Bronze → Silver → Gold.
Never re-simulate in the renderer; if the log and the displayed result could ever disagree, that is a bug. Acceptance: identical replay from the same log; 60 fps on a mid laptop; skipping is state-safe; npm test green.
```

### Prompt M3
```
Read CLAUDE.md, design/GDD.md §12, §15, §16, design/BUILD_PLAN.md (milestone M3), and packages/web.

Task: milestone M3 — world and art integration.
- Theme tokens (packages/web/src/theme/tokens.css) from GDD §16 palette; per-planet theme override (two accent hues). Fonts: Bungee (display) + Space Mono (numbers) via Google Fonts with fallbacks.
- UI kit components: riveted metal Panel, NeonButton (states), TicketCard for races, BettingSlip, StatBar, DogCard with portrait slot, Signpost for planet specials. Reskin all M1 screens using these — keep behaviour identical.
- Planet hub: full-bleed backdrop image with six clickable hotspots (Market, Kennels, Docks, Saloon, Bookie, Race Office), positions per planet in data.
- Dog portrait compositor: layers body × palette × accessory PNGs (assets/dogs/{body,palette,accessory}/*.png). Race-view sprite: rotate a single top-down run-cycle sprite sheet per body.
- Asset pipeline: create design/ASSET_LIST.md listing every image the game expects — exact path, size, and a generation prompt built from the GDD §16 template with that planet's vibe and accents. Ship with clearly labelled placeholder PNGs (flat colour + text) so the game runs before real art exists.
- Event cards with an illustration slot; AI owner portraits + personality blurbs (GDD §14) as data.
Acceptance: every screen uses the kit; adding a planet = one data row + three images; placeholders are obvious; npm test green.
```

### Prompt M4
```
Read CLAUDE.md, design/GDD.md §14, §19, §20, design/BUILD_PLAN.md (milestone M4 and §7), design/PLAYTEST_NOTES.md if present, and the codebase.

Task: milestone M4 — AI, balance, polish, ship.
- Implement ai/easy.ts and ai/hard.ts per GDD §14. Extend harness to report win rate by difficulty over N seasons with mixed fields.
- Balance pass: targets in BUILD_PLAN §6/M4. Tune only via balance.json (and mirror any change into the spreadsheet's Assumptions sheet — update the xlsx with openpyxl, keep formulas intact). Address GDD §20 Q2 (Major purse share) with data from the harness and record the decision in the GDD decision log.
- Season-end: net-worth-over-time chart for all stables (SVG, no chart library), "moments" list, "Play again same seed", shareable seed link (?seed=…&players=…).
- Polish: keyboard shortcuts, mobile-width layout check, no console errors across a season, accessible focus states.
- Deploy: the Cloudflare Pages project `space-dog-racing` is already connected to the repo (build `npm run build`, output `packages/web/dist`, Node 20) — do not create another; check the latest deployment at space-dog-racing.pages.dev succeeds and add `_headers`/`_redirects` if needed for the SPA. README with play link, screenshot, and a one-paragraph pitch.
Acceptance: deployed URL works on phone and laptop; harness targets met and pasted into the PR; npm test green.
```

### Prompt M6 (after v2)
```
Read CLAUDE.md, design/GDD.md §18, design/BUILD_PLAN.md (§6b.9), and the whole codebase. The engine is already pure and action-driven — do not fork it.

Task: milestone M6 — online multiplayer.
- packages/server: a Cloudflare Worker with one Durable Object per game room running @sdr/engine authoritatively (use PartyKit on top of Durable Objects if it simplifies the WebSocket/room plumbing — justify the choice in one paragraph before coding). Deploy with wrangler to the same Cloudflare account as the Pages site. Rooms by 6-letter code; host sets player count and fills empties with AI; seed generated server-side.
- Protocol: clients send Actions; server validates via engine.reduce, appends to the log, broadcasts the action (not the state). Clients reduce locally and must converge; add a periodic state-hash check and a resync path that replays the log.
- Simultaneous planet phases with a 90 s timer; contested market purchases resolve by turn order at receipt; race day broadcasts the tick log.
- Reconnect by rejoining the room and replaying the log; spectators allowed; finished seasons replayable.
- Optional async mode: the room persists; players take turns whenever; email/Discord link optional.
Acceptance: two browsers on different machines finish a season; refresh mid-season rejoins with no loss; npm test green, plus server integration tests for join/leave/reconnect.
```

## 10. Effort estimate

### v1 — done, 9 September 2026

| Milestone | Builder sessions | Jesse's time |
|---|---|---|
| M0 | 1 | 30 min review |
| M1 | 1–2 | 2 × 1 hr playtests |
| M2 | 1 | 30 min |
| M3 | 2 (+ art generation time) | 2–4 hr generating/curating images |
| M4 | 2 | 2 × 1 hr playtests |

Roughly 8–11 builder sessions to the shipped v1.

### v2 — the estimate, and where it is soft

| Phase | Builder sessions | Jesse's time | Confidence |
|---|---|---|---|
| **A** — the training game | **2** | 1 hr playtest + 1 hr re-baseline review | **good.** Mostly `balance.json` plus one new per-dog field and one new action. The unknown is how far the §6.2 rebalance moves the rest of the economy |
| **B** — the card and the fog | **1–2** | 1 hr playtest | **weakest.** `RaceClass` is a union type threaded through nine engine files, four screens, `Bet`, `RaceResult` and the AI's assignment search. The design is cheap; the refactor is not |
| **C** — the economy | **2** | 1–2 hr playtest | **fair.** Data-heavy and therefore cheap per rule, but `cargo: number` → a per-good record is a save-format break, and the market and Docks screens are substantially new |
| **D** — the dark side | **1–2** | 1 hr playtest | **fair on the build, poor on the balance.** §13 itself is small. The three-path balance pass is the part that could run long, because it is the first time anything has been measured against anything other than itself |
| **Harness rebuild** | **spread across all four**, ~0.5 a phase | — | `autoplan%`'s rollout is the one piece that might want a session of its own |

**Total: 6–8 builder sessions**, plus M6 (2–3) after. That is two thirds of what v1 cost, for a game that plays differently.

**Where the estimate is least trustworthy, in order:** (1) Phase B's `RaceClass` refactor — every other v2 change is additive and that one is not; (2) Phase A's re-baseline, because every measured number below the race level was taken on constants that are about to change; (3) Phase D's balance pass, which has no precedent in this project.

## 11. Risks and mitigations

### Carried from v1
- **Race sim feels random.** Mitigation: the calibration test, commentary that names causes, rating deltas shown after each race. v2 note: after §6.2 the commentary can finally say "faded — no stamina over 600" *truthfully*.
- **Art inconsistency across 18 planets.** Mitigation: one prompt template, locked negative list, ASSET_LIST.md as the contract.
- **Scope creep.** Mitigation: the v2 list at GDD §21; nothing enters without a decision-log row.

### New in v2, worst first

- **⚠️ The §6.2 rebalance invalidates every measured number below the race level.** Purses, dog values, the AI's whole EV model and the three difficulty targets were all fitted to constants that are about to move. *Mitigation:* it is Phase A's first commit, alone, with a full re-baseline immediately after and before anything else in Phase A lands. If the economy moves more than ~20%, re-fit purses before building on top.
- **⚠️ The pup band is narrow.** 4 points a week and the mechanic is dead; 8 and the season is over by week 10 (GDD §5.6). *Mitigation:* the acceptance criterion is the *week a pup reaches par*, not a stat number, so the builder tunes toward the outcome. Report the whole curve, not the single figure.
- ~~**⚠️ Three roads is arithmetic, and the arithmetic is brutal.**~~ **Closed for two roads out of three, and the purse cut turned out to be the wrong lever entirely.** Trading needed 4× and got it: the trader agent's road ends level with the trainer's, **1.4% apart on the mean** with visibly different spreads (GDD §20 Q2). The cut was measured and killed (D29) — the ratio it was meant to move is invariant to it. Betting is still a rounding error and is Phase D's. The honest position is **two roads plus a side hustle**, said out loud, until §13 exists.
- ~~**The Prime tier amplifies the leader.**~~ **Measured and it does not:** a Prime offer is worth +0.11 places to a stable ahead at week 6 and +0.24 to one behind (GDD §20 Q3). The consumable-food and wage-not-purchase shapes are holding, and the ugly rubber band stays out.
- **The fog reads as arbitrary rather than fresh.** *Mitigation:* the pool of race types stays small and memorable; `cardCoverage` measures it; and it is the first thing on the Phase B playtest checklist. This one cannot be settled by the harness — it is an experience question and only Jesse can answer it.
- **Pace.** v2 adds a per-dog weekly decision across up to six dogs, a busier market and an information layer, to a season already running an hour. *Mitigation:* 13.3 clicks a weekend is a budget with a number on it; `venueStatus` and the Kennels summary are where the difference gets spent; and if Phase C breaches it, the fix is summaries, not fewer decisions.
- **Phase B's refactor runs long.** *Mitigation:* land `RaceType` as a row-shaped replacement in one commit with the golden snapshot moved once, before any new type is added. Seven types is a data change on top of a type change, and mixing them is how that session overruns.
