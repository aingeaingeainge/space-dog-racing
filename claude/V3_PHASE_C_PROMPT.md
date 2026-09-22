# V3 Phase C — running styles

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase C was built from,
> committed alongside `V3_PHASE_C_NOTES.md`. Where it turned out to be wrong it is corrected in place,
> each correction marked **⚠️ Corrected:** so the original claim and the fix can both be read. Nothing
> else is changed. Six corrections:
>
> 1. **The stat-leverage row did not "order itself"** once the fade was measured in metres. At a 480 m
>    reference, stamina at 480 m rose to 26.9%. It ordered at a 600 m reference with a 250 m fade
>    (GDD_V3 C5), found by a sweep.
> 2. **The fade point is metres from the boxes, not "from home".** Measured from home, the fade window
>    is the same length on every trip and stamina is worth the same everywhere — the A7 miss again.
> 3. **The book did not "see rating, fitness, form and style"** — `odds.ts` has only ever priced the
>    rating. Built: the rating plus a public style on the trip (C6). Fitness and form are GDD_V3 §14 Q9.
> 4. **The snapshot moved six times and stepped back once**: the contest rule was built, measured and
>    cut in two commits, and the new harness found an overlay that moved `oddsScale` (C7) in a commit
>    the prompt's order did not have.
> 5. **"A v3b action log cannot replay"** is true as measured — three stopped within ten actions — but
>    by accident of the rng stream. `SAVE_VERSION` is the guarantee, and it was verified.
> 6. **Hard's field-shape read was not built**: with the contest rule cut there is nothing in the field
>    for it to read (C11). The measurement Jesse asked for is in the notes.
>
> And the device shell did mount at handoff, as this prompt said it would: the bundle was written into
> the repo folder, and nothing that touches the index was run there.

## ⚠️ First: the mechanics, because you are not in Jesse's working tree

- `git clone https://github.com/aingeaingeainge/space-dog-racing` into the container and work there.
  `npm install`, then verify before touching anything: **`npm test` 23 green**, `npm run lint` clean,
  `npm run harness -- --seasons 20` runs, `npx tsx packages/web/scripts/season-check.ts` passes. If
  any of those fails on a fresh clone, stop and say so — you have found something Phase B missed, and
  it matters more than this phase does.
- `git config user.name "Claude"` and `user.email "noreply@anthropic.com"` in the clone. The container
  has no git identity and a commit without one fails. Commits are signed: `git log -1 --format=%G?`
  reads `N` because there is no allowed-signers file to verify against, so check for a `gpgsig` header
  with `git cat-file -p HEAD | head -6` instead, and keep every commit in the phase signed.
- You cannot push — there are no credentials in the container, and pushing deploys to Cloudflare
  Pages, which is Jesse's call, not yours.
- ⚠️ **Before you write a word of handoff instructions, run `git ls-remote origin`.** Build the bundle
  to fast-forward from whatever `origin/main` actually is, and round-trip test it: clone `main` from
  GitHub into a temp directory, fetch the bundle, `git merge --ff-only`, `npm ci`, `npm test`.
- ⚠️ **The Cowork shell into `C:\Users\jesse\Documents\CoWork\dog racing game` mounts again** — it had
  not since 8 September, and Phase B found it working at handoff. Two things follow. **You can write
  the bundle straight into his repo folder** with `device_commit_files`, which saves him a download.
  And **do not run `git status`, `git add` or anything else that touches the index in that folder from
  the Linux shell**: deletes are blocked there, so git cannot clean up `.git/index.lock` and leaves a
  stale lock that blocks his next git command. Phase B did exactly that and had to ask for delete
  permission to clear it. `git log`, `git rev-parse` and `git bundle verify` are safe; anything that
  writes the index is not. **Build the phase in the clone either way.**
- Jesse is in Cowork, not at a terminal. He reads the conversation; he does not see your tool output.
  Ask one clear question at a time and stop.

## ⚠️ Second: snapshot before you read further

```
npm run snapshot
```

**`v3b` is the tag to fall back to, and unlike `v3a` it is on `main`** (`01c386c`). `v3a` points at
`18a5bfb`, a pre-replay commit that is not on `main` — do not fall back to it; use `6978b96` if you
ever need Phase A's code.

This phase rewrites the race model. Every number below the race level moves, including ones Phase A
and Phase B fitted, and that is expected rather than a failure — but it means a snapshot and a clean
head before you start are worth more here than in either of the last two phases.

## Two questions for Jesse, in his first reply, before you build

Both are his calls from Phase B's carried-forward list, and both change what you build:

- **The starting deal is not equal, and Phase C touches the dealing code anyway.** Phase A's decision
  A3 claims "150 points over three stats rates exactly 50 whatever the split". That is only true if the
  rating weights are equal, and they are 0.40 / 0.35 / 0.25. Measured over 500 deals of six stables: a
  dealt dog rates **44 to 55**, and the best stable at the table starts a median **16 rating points**
  ahead of the worst across its three dogs (p90 22, max 29). GDD_V3 V2 exists to stop exactly that
  ("you got better dogs" is the complaint that ends the evening). §5.5 has you re-deal anyway — one
  front-runner, one stalker, one closer per stable — so this is the cheap moment to fix it. Ask
  whether to **fix the deal in this phase** (the recommendation: deal each dog to an equal *rating*
  rather than an equal stat total, keeping the shape difference) or leave it for a later phase.
- **Hard beats Normal 47.5% against a 63–68% band.** Phase A found Hard's good decisions were in the
  delete list; Phase B deliberately gave Hard no market edge. §5.6 hands Phase C one for free — the
  book prices style but not the *shape of the field*, so a stable that reads a field of three
  front-runners and enters its closer is genuinely better than its price. Ask whether **restoring
  Hard's head-to-head is a goal of this phase** (the recommendation: yes, but as a measurement — give
  Hard the field-shape read and report what it is worth, rather than tuning until the band is met) or
  whether Hard waits for Phase D's deck.

## The standing instruction

**THIS PHASE'S REAL JOB IS TO MAKE THE WEEK A DECISION AGAIN. The number that says whether it worked
is `autoplan%`, and Phase B could not move it.**

Read the numbers rather than the adjective:

- `autoplan%` is **30.1%** — how often the naive plan and Normal's plan agree about the entries — and
  the `states alone` row is **95.0%**. Race-or-Rest is very nearly automatic and **which dog goes in
  which race is the decision this phase has to make hard**. §7a.3's gloss is "above 40 the week makes
  itself"; the band is 15–30%, and the honest reading of 30.1% is *only just inside it*.
- Phase B's market added decisions *beside* that one (AI decisions a weekend went 5.06 → 7.52, food is
  28.9% of gross income) without touching it, because the autoplan measures entries and nothing else.
  **So this is the first phase since the cull whose headline diagnostic it can actually move**, and if
  it does not move, say so plainly rather than claiming the styles landed because they are watchable.
- The p90/p10 net-worth spread is **2.31×**, and Phase B's finding is that it cannot widen at a table
  of six identical agents. Report it, do not chase it. Where it can move is between *different*
  stables — Hard against Normal read 3.6× for Hard and 2.2× for Normal in the same seasons.

**And the guard, which is the sentence to keep in front of you.** BUILD_PLAN_V3 Phase C:

> ⚠️ The first row is a kill switch, not a tuning target. If the closer's gap against a
> front-runner-heavy field is under 4 points after a sweep, **cut the contest rule** and keep styles
> for the watching alone. A rule nobody can perceive is worse than no rule, and this one costs the
> simulation its independence between runners.

**A style is a redistribution of the same energy, not a bonus** (§5.1). Before you go anywhere near
the contest rule, check that a field of one of each style has no systematic advantage — if stalkers
win 40% of eight-dog fields, the curve is wrong and every measurement after it is noise.

**The scope guard.** Explore and the event deck are Phase D; the hotseat loop, multi-season and Target
mode are Phase E. **The market is Phase B's and is finished** — do not re-tune the bands, the price
distribution, the shelf depths or the diet. If you find yourself designing a mechanic that is not in
the ten items below, you have taken a wrong turn — write it up as a question instead.

## Read, in this order

1. `CLAUDE.md` — the non-negotiables. The `Math.pow` / `exp` / `log` rule binds a race-model phase
   hardest of all: a pace curve is exactly where a builder reaches for `exp`. `+ − × ÷` and
   `Math.sqrt` are exact everywhere; everything else goes through `determinism.ts`.
2. `design/CANON.md` — which documents are current. Short.
3. `design/GDD_V3.md` — **§5 in full** (this phase's specification almost line by line) and **§7 in
   full**, plus §4.1 and §4.5 (three stats, and the eight traits the list still does not match), §2.3
   (the weekend, and why the Race Office runs in turn order), §11 (the balance targets) and the
   decision log's V9, V12, V13, V14, V16, A7 and B7.
4. `design/BUILD_PLAN_V3.md` — Phase C with its acceptance table, and §2.3 for what you must not touch.
5. `design/BUILD_PLAN.md` §§1–5 — architecture, tech stack, repo layout, data model. Current, not
   restated in V3. Also §7a for the harness methodology and the **800-season rule for anything under 5
   points**, and §7b for the snapshot contract.
6. `claude/V3_PHASE_B_NOTES.md` — the immediately preceding session. Read the baseline numbers from
   here, not from any figure quoted in an older prompt. Its five corrections and its "Carried forward"
   are most of your context.
7. `claude/V3_PHASE_A_NOTES.md` — for the A7 analysis (miss 1) in the builder's own words, since A7 is
   item 9 of this phase.
8. `design/GDD.md` — v2, historical, do not build from it. Keep it open: GDD_V3 cites its D1–D53 log by
   name, and D12, D13, D37 and D52 are all about the race model and the book you are changing.

## What Phase B actually left you

So you are not re-deriving it. `v3b` = `01c386c`, golden `stateHash` `309daf58…`, 800 all-Normal
seasons unless the row says otherwise:

| | `v3b` |
|---|---|
| mean end worth | 40,242 (band 25–40k — **242 over**, because the market is a new road) |
| p10 / p50 / p90 | 24,854 / 38,883 / 57,478 — spread **2.31×** |
| prize / trade / betting / costs | 19,184 / +2,997 / −1,258 / 3,506 |
| prize share of gross | 58.3% (food 28.9%, bets 12.8%) |
| fitness at declaration | 69.3, 24.8% under 60 |
| races entered a weekend | 2.02 of 3 · races per dog 6.74 |
| decisions a weekend (AI) | 7.52 · hub-clicks **10.5** against ≤ 10 |
| purse share reaching players | 47.6% · season decided by week 6.0 |
| `autoplan%` | **30.1%** (entries 30.2%, states 95.0%) |
| `--calibrate`, 65 vs seven 50s | **56.6%**; best-fit `oddsScale` 15.75 against 15.5 in the sheet |
| `--stats`, +10 to one stat at 480 m | **22.4 / 16.9 / 17.6** — the A7 miss, unchanged since `v3a` |
| Hard beats Normal (3 v 3, 400 seasons) | **47.5%** |
| the market rows | food 28.9% · crossover week 4.3 · p99 leg 5,445 = 13.5% · empty hold 0.1% · Ambrosia shelf 5.5 |

And the state of the code you are changing:

- **`race/simulateRace.ts` is 270 lines and `Runner` is pure data** — `speed`, `accel`, `stamina`,
  `fitness`, `form`, `traits`, `speedBonus`, and no ownership or money. A style and its daily
  expression belong on `Runner`, set by `raceDay.ts` when it builds the field.
- **Per-dog draws already happen in two loops before the tick loop**: race-day `luck`
  (`rng.gauss(0, raceLuckSd)`, "drawn once") and the break from the boxes. **That is where the style
  expression goes** — §5.2's `U(0.30, 1.30)`, one draw per runner, before the first tick. **A field is
  always 8 runners** (short fields are filled with locals at `balance.traps`), so the draw count per
  race is fixed and the stream does not shift with the number of stables.
- **`fadeStart = raceFadeBase + raceFadeStamina × stamina/100 + fadeShift[i]`**, computed inside the
  tick loop as a *fraction of the trip*. `fadeShift` already exists (the `slowStarter` trait uses it),
  so a style's fade shift has a slot waiting. Item 9 (A7) changes what `fadeStart` is measured in.
- **The bend clash is the precedent for the contest rule**: a positional interaction between two
  runners within `raceBumpDistance` (1.2 m) on a bend, with `bendCraft` (Accel) deciding who comes off
  worse. Read it before writing §5.3 — the shape is already in the file.
- **The trait list is still v2's sixteen.** §4.5 wants **eight**: Railer, Wide runner, Mudlark,
  Fragile, Iron, Glutton, Showboat, Bad blood. The three pace traits — `slowStarter`, `sprinter`,
  `stayer` — are the ones §4.5 says styles *replace*, and `nervy`, `cheapDate`, `primaDonna`,
  `bouncesBack` and `oldSoul` are the rest of the trim. Phase A did not do it; it is item 8.
- **`race/odds.ts` prices ratings and nothing else** (59 lines). §5.6 has the book price style too, and
  that moves `--calibrate` and the `oddsScale` fit. D52 settled 15.5 precisely to avoid leaving a
  standing overlay *by accident*; §5.6's overlay is on purpose and §11 measures its size.
- **`STATE_VERSION` is 6 and `SAVE_VERSION` is 5** (Phase B bumped both). ⚠️ **Nothing reads
  `GameState.version` at all** — `SAVE_VERSION` in `web/src/store/persist.ts` is the only thing that
  stops an old save replaying, and it had not moved for three phases before Phase B. `Dog.style` is a
  stored field, so both move again, and a `v3b` save must fail soft to the title screen.
- **`packages/engine/scripts/add-phase-b-rows.ts` is the row writer** — TypeScript, idempotent, adds
  and removes, and it documents the two properties of the workbook that make rewriting it safe. Copy
  it to `add-phase-c-rows.ts`; do not reach for openpyxl.
- **The renderer never re-simulates**: it replays the tick log. Commentary (`web/src/race-view/
  commentary.ts`, 419 lines) reads the tick log and the state, so a style has to be somewhere the race
  view can see it.
- **You can look at the built screens.** Phase B served `packages/web/dist` with `npx vite preview` and
  drove it with Playwright (chromium is at `/opt/pw-browsers`), reaching a planet with
  `?seed=4242&players=h,normal,normal,normal,hard,hard`. It found two UI faults a code read had
  missed. Do the same for the Race Office and a race.

## BUILD THIS SESSION

Ten items. One through nine are BUILD_PLAN_V3 Phase C's deliverables; item 10 is the trait trim §2.2
asks for and Phase A left. The commentary is about the traps.

### 1. `Dog.style` and the pace curve (§5.1)

Front-runner / stalker / closer, as a **redistribution of the same energy**:

```
Front-runner:  early topSpeed ×1.08,  fadeStart −0.12
Stalker:       baseline
Closer:        early topSpeed ×0.94,  fadeStart +0.12, fade penalty ×0.8
```

All ⚖️ estimates — they are sheet cells, not literals. ⚠️ **Measure the no-advantage property first**
and say the number: a field of eight with the styles spread evenly should show no style winning
systematically. If one does, fix the curve before anything else in this phase means anything.

### 2. Style expression, `U(0.30, 1.30)` (§5.2, V13)

One draw per runner per race, at the fixed point named above, scaling *how strongly the style applies
that day*. ⚠️ **This is not ±30% on the dog's speed and the difference is the whole game** — v2 D13
learned that a 20%-wide fitness multiplier made everything else invisible. The area under the curve
stays constant; only its shape moves.

### 3. The contest rule (§5.3, V14) — in its own commit, with a re-baseline either side

> While a front-runner is inside the first third of the race and another dog is within 2 m of it at
> the head of the field, both get +3% to current speed and their `fadeStart` moves 0.05 earlier — a
> cost larger than the boost is worth.

⚠️ **This is the kill switch.** Sweep it, measure a closer's win rate against fields with 1, 2 and 3
front-runners at 800 seasons, and **if the gap is under 4 points, delete the rule** and say so. Do not
tune it up. It is the one rule in v3 that costs the simulation its independence between runners, and
it has to earn that.

### 4. Hidden, then public (§5.4)

A style is unknown until the dog races, then public to the whole table and **written on the dog card**.
Phase C's plan says to pick the simpler of "a set of player ids" and "a boolean plus the owner" — pick
one, say which, and remember §5.4's reason: a game that rewards note-taking rewards whoever brought a
pen. ⚠️ Stored state: `STATE_VERSION` and `SAVE_VERSION` both move, a `v3b` save fails soft, a `v3b`
action log cannot replay. Verify the fail-soft rather than asserting it.

**⚠️ Corrected:** a v3b log *did* fail to replay — three of them stopped within ten actions — but
because the new deal moves the rng and so the turn order, not because anything checks for it. The save
version is the guarantee.

### 5. One of each style per stable (§5.5)

Dealt at the start. ⚠️ **This is the same code as the equal-deal question above** — if Jesse says fix
the deal, it is one commit with §5.5, not two.

### 6. Declarations public in turn order (§7.3, V16)

The Race Office shows the field as it fills. This is what makes styles a *manager's* problem rather
than only a bettor's: the last stable to declare into the Gold Cup can see two front-runners already
in it and enter its closer. ⚠️ Watch `hub-clicks`: it is 10.5 against a ≤ 10 budget already, and a
board that has to be *read* may add a press. Report the number either way.

### 7. Commentary that names the style and the day (§7.5)

At minimum: a burned-out front-runner, a closer that got there, a closer that did not, and a
front-runner left alone in front. This is how a player learns §5.4 without being told it, and it is the
only part of the phase that cannot be measured — so it is the part to look at in a screenshot.

### 8. The bookie prices style, not field shape (§5.6)

The book sees rating, fitness, form and style. It does **not** see the interaction between styles in a
field. ⚠️ That is a deliberate standing overlay, and §11's row is that **backing the lone closer blind
must still lose money** — an edge for a player who reads the card, not free money. Re-fit `oddsScale`
and report the fit; D52's criterion (never leave an accidental overlay) still decides the sheet value.

**⚠️ Corrected:** the book had only ever seen the rating; fitness and form were never priced and were
not added (GDD_V3 C6, §14 Q9). And D52's criterion moved the sheet value to 18.75, because in real
fields 15.5 left a +9.8% overlay on every stable dog after A7 — D52's calibration probe no longer
represents the game (C7).

### 9. A7 — `fadeStart` becomes an absolute distance

Deferred here from Phase A by Jesse's call (GDD_V3 B9). Today the fade window is a fraction of the
trip, so it is proportionally identical at 350 m and 600 m and **stamina is worth the same on a sprint
as on a staying trip** — which is both wrong as a model and the whole of the A7 miss (22.4 / 16.9 /
17.6 against a row wanting speed > accel > stamina). Make the fade start a fixed number of metres from
home, scaled by stamina, and the stat-leverage row should order itself.

**⚠️ Corrected:** from the *boxes*, not from home — measured from home, the fade window is the same
length on every trip and stamina is worth the same everywhere. And it did not order itself: converted
at a 480 m reference, stamina at 480 m rose to 26.9%. A sweep found a 600 m reference with a 250 m
fade (C5), which reads 24.5 / 18.3 / 16.7.

⚠️ **Its own commit, with a re-baseline either side**, like the contest rule. It moves every dog in
every race: expect `--calibrate`, `--stats`, races entered per weekend, races per dog and mean end
worth all to move, and report them as a block rather than one at a time.

### 10. Eight traits, not sixteen (§4.5, §2.2)

Cut `slowStarter`, `sprinter` and `stayer` — styles replace them, and two systems saying the same
thing is the mistake `SetTraining` fixed once already (D19) — and `nervy`, `cheapDate`, `primaDonna`,
`bouncesBack` and `oldSoul` with them, leaving §4.5's eight. ⚠️ Sweep for each id afterwards: eleven
places outside `content/traits.ts` and `types.ts` read one of these today, including `simulateRace`'s
`fadeShift` and `endTurn`'s age handling. A trait that leaves the list and stays in a branch is Phase
A's residue problem all over again.

### 11. The harness

Add `--styles`, and keep everything Phase B's rows print:

- a closer's win rate against fields with **1 vs 2 vs 3** front-runners (the kill-switch row);
- **the variance decomposition of §11**: style expression's share of race outcome variance, which must
  land below fitness's and above form's;
- **the blind-lone-closer betting return**, which must be negative;
- **lead changes per race**, mean ≥ 1.0;
- and the no-advantage check from item 1, printed rather than remembered.

⚠️ **`autoplan%` is this phase's headline, so run it and print it next to the entries/states split.**
If the entries row moves and the states row does not, that is the finding: styles made the *card* a
decision and Race-or-Rest is still automatic.

## RULES THAT DO NOT BEND

From `CLAUDE.md` and BUILD_PLAN_V3 §2.3:

- `packages/engine` has no DOM, React, `Date` or `Math.random`. All randomness through `rng.ts`,
  threaded.
- **No `Math.pow` / `exp` / `log` / trig anywhere in `packages/engine/src`.** Use `pow10()` /
  `normalDeviate()` from `determinism.ts`, or wrap in `quantize()` and put it in that module. eslint
  enforces it; do not disable the rule.
- Every state change is an `Action` handled in `reduce.ts`. UI never mutates state.
- Same seed + same action log reproduces the same season on any machine and any JS engine.
- **Races return a tick log; the renderer replays it and never re-simulates.**
- TypeScript strict; no `any` in engine. Ratings and stats are 0–99 integers in state.
- Content is data, not code. A style is a row; if adding one needs a branch, stop.
- Numbers live in the spreadsheet, generated into `balance.json` by `npm run balance`. Never hand-edit
  the JSON. A number that ends up as a literal in `packages/engine/src` is a bug.
- The race constants of v2 §6.2 carry over (`raceBaseSpeed` 13.75, `raceSpeedCoef` 4.5,
  `raceFadePenalty` 0.50, the bend model). **Phase C re-baselines against them rather than replacing
  them** — item 9 changes what `fadeStart` measures, not the constants around it.
- Do not run `npx prettier --write` across the repo. Format only what you edited; `design/*.md` is
  outside the format globs.
- **Do not build Phase D or E.** No Explore doors, no event deck, no staff, no hotseat loop, no
  multi-season.
- **Do not re-tune Phase B's market.**

## The commit discipline

The golden snapshot moves only in commits whose message says that it does and why, and a commit that
does *not* move it should say that too — Phase B's log reads well because six of its eleven commits
say so explicitly. Expect at least four moves here: the style curve, the contest rule, `fadeStart`, and
the trait trim (plus the deal, if Jesse says fix it).

**⚠️ Corrected:** six moves and one step back — the curve and the deal, the contest rule, its cut
(back to the first hash), `fadeStart`, the trait trim, the bookie's style edge and the `oddsScale`
refit — in eleven commits. See the notes' commit table.

Land in this order, because it is also the order that makes each commit measurable:

1. The spreadsheet rows, data only, moving nothing.
2. `Dog.style`, the curve and the expression (items 1, 2, 4, 5) — with the no-advantage check.
3. **The contest rule alone** (item 3), with a re-baseline either side.
4. **`fadeStart` alone** (item 9), likewise.
5. The trait trim (item 10).
6. The bookie (item 8) — this moves `--calibrate`, so it is its own commit too.
7. Screens: the Race Office board and the commentary (items 6, 7) — these should not move the snapshot.
8. The harness (item 11) — must not move the snapshot.

`properties.test.ts` and `determinism.test.ts` should need **additions, not edits**. Phase B had two
forced edits and named both; if an existing assertion has to change here, stop and work out whether you
broke something before you change it, then say which and why in the notes.

⚠️ **Phase B's own cautionary tale, worth having in front of you:** the first run of its new harness
row read 4.8% against a < 5% target and *passed* — for the wrong reason, because the agent was broken
rather than the rule. A row that passes is not a row that measured what it says. When a new measure
comes in just inside its band, go and look at what produced it.

## DONE WHEN

BUILD_PLAN_V3 Phase C's acceptance table, every row, with its reading pasted into your final message:

| Measure | Target |
|---|---|
| Closer's win rate, 1 front-runner in the field vs 3 | **≥ 4 points better** (kill switch) |
| Style expression's share of race outcome variance | below fitness's, above form's |
| Backing the lone closer blind, return per Bone | **negative** |
| Stat leverage, +10 from a balanced rating-50 dog | speed > accel > stamina at 480 m, all 14–26% (A7) |
| Lead changes per race, mean | ≥ 1.0 |
| A player can name a dog's style after watching one of its races | 🎲 yes |
| `npm test` green, snapshot moved in named commits only | ✅ |

Plus the rows that carry over and must not regress:

| | |
|---|---|
| Race calibration, 65 vs seven 50s | 45–60% |
| Races entered per weekend / races per dog | 1.8–2.4 of 3 / 5–7 |
| Mean end worth, all-Normal | 25–40k (it is 40,242 today — say which way item 9 moved it) |
| Fitness at declaration | 60–80, under 60 in 10–25% |
| **Phase B's market rows** | food 20–35% · crossover 4–7 · p99 leg < 40% · empty hold < 5% · Ambrosia ≤ 8 |
| Decisions per weekend (`hub-clicks`) | ≤ 10 (10.5 today) |

And the diagnostics — report them whatever they say, and do not tune toward them:

- **`autoplan%`, from 30.1%** (entries 30.2%, states 95.0%). **This is the phase's headline.** Lower is
  a card that became a decision again.
- **The p90/p10 spread, from 2.31×**, all-Normal, and the same figure for Hard and Normal at a mixed
  table (3.6× / 2.2× at `v3b`).
- **Hard beats Normal, from 47.5%** against a 63–68% band.

⚠️ **On a missed row, the default is report it with the arithmetic and leave it alone.** The
exceptions are the two the plan names: the contest rule is cut rather than tuned if its gap is under 4
points, and if the style curve gives one style a systematic advantage it is fixed before anything else.

## Then, in order

1. A full re-baseline: `npm test`, `npm run lint`, `npm run build`, the three headless checks
   (`season-check.ts`, `race-view-check.ts`, `hub-clicks.ts`), then **800 all-Normal seasons**,
   `--calibrate`, `--stats`, `--autoplan`, `--styles`, and a 3 Hard v 3 Normal table.
2. Look at it: serve the build and screenshot the Race Office mid-declaration and a race in progress.
3. `npm run snapshot`.
4. `git tag v3c` **on the notes commit**, as `v3b` was — so the tag names the commit that carries its
   own record.
5. Write `claude/V3_PHASE_C_NOTES.md` in the style of `claude/V3_PHASE_B_NOTES.md`: what was measured,
   what missed, what the next phase inherits, a corrections section for anything you or an earlier
   phase got wrong, and the `v3c` playtest checklist. `claude/*_NOTES.md` is write-once from the commit
   that adds it.
6. Add decision rows **C1, C2, …** to `design/GDD_V3.md` for every decision the GDD does not already
   cover — the style constants if you moved them, the expression's draw point, how `styleKnown` is
   stored, what `fadeStart` is measured in now, which traits went and why, and the bookie's style term.
7. Commit this prompt as `claude/V3_PHASE_C_PROMPT.md` alongside the notes, **correcting anything in it
   that turned out to be wrong before you commit it** — CANON says write-once begins at the commit that
   adds a prompt, precisely so a prompt that misdescribed the phase can be fixed once rather than left
   to mislead.
8. `git ls-remote origin`, build the bundle to fast-forward from `origin/main`, round-trip test it from
   a fresh GitHub clone, write it into Jesse's repo folder, and spell out the PowerShell.

⚠️ If you changed a design document, say so: `design/CANON.md` requires the claude.ai Project mirrors
to be re-synced, and that is a separate job. **They are already one phase behind** — Phase B changed
`GDD_V3.md`, `BUILD_PLAN_V3.md` and `CANON.md` and the mirrors have not been synced since.

## And the acceptance test that is not a number

Phase B is the first build where the economy is a game; **Phase C is the first build where a race is a
story**. End the notes with a checklist for `v3c`, and write it for a season played with the race view
on. The questions as they stand today:

- **Could you tell why a dog won?** Not from the result line — from watching. If a player cannot say
  "he went off too fast and stopped", §5's whole case is unproven whatever the harness says.
- **Could you name a dog's style after one of its races?** §5.4 assumes yes and the whole reveal rule
  depends on it. If it takes three races, styles arrive too late to use in a ten-week season.
- **Did the field ever change your mind at the Race Office?** §7.3 makes declarations public in turn
  order so that seeing two front-runners in the Gold Cup changes which dog you put in it. Did it?
- **Did three front-runners burning each other out ever actually happen in front of you** — and did you
  notice it without being told? That is the contest rule's real test; the 4-point row is only its floor.
- **Are thirty races a season still worth watching?** §7.5 lets you skip the ones you are not in. Did
  you want to?
- **And the standing question**: did any week present a choice you had to think about?
