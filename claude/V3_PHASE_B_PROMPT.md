# V3 Phase B — the market

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase B was built from,
> committed alongside `V3_PHASE_B_NOTES.md`. Where it turned out to be wrong it is corrected in
> place, each correction marked **⚠️ Corrected:** so the original claim and the fix can both be read.
> Nothing else is changed. Six corrections:
>
> 1. `readSave`'s version check did **not** already make an old save fail soft: `SAVE_VERSION` had
>    been 4 since `v2c`, so a v2 save passed it at `v3a`. Bumped in this phase.
> 2. `STATE_VERSION` had been 5 since `v2d`, not bumped by v2 Phase E or v3 Phase A.
> 3. Putting the constant 20 back into turn order **did** move the golden snapshot, and nothing else
>    in the commit did it — the float arithmetic was breaking exact ties by rounding error (GDD_V3 B7).
> 4. `properties.test.ts` needed **two** changes, not one: the `trainStat` invariant had to be
>    re-pointed at the field that replaced it, as well as the spend-down test being re-examined.
> 5. The snapshot moved **four** times, not "at least two", and a data-only commit landed first.
> 6. `v3a` is **not on `main`** — the tag points at the pre-replay notes commit `18a5bfb`.
>
> And one fact that changed during the phase rather than being wrong when written: **the device shell
> into Jesse's folder worked at handoff** (a read-only `git log` there answered), so the first section's
> "has not mounted since 8 September" was true when drafted and is not true now. The phase was still
> built in a clone, and nothing in his working tree was changed from here beyond writing the bundle.

## ⚠️ First: the mechanics, because you are not in Jesse's working tree

Cowork's shell into `C:\Users\jesse\Documents\CoWork\dog racing game` has not mounted since a Windows
update on 8 September (`sandbox-helper: no Plan9 drive shares mounted`). Every phase since v2 Phase D
has worked around it the same way, and Phase B does too:

- `git clone https://github.com/aingeaingeainge/space-dog-racing` into the container and work there.
  `npm install`, then verify before touching anything: `npm test` 22 green, `npm run lint` clean,
  `npm run harness -- --seasons 20` runs. If any of those fails on a fresh clone, stop and say so —
  you have found something Phase A missed, and it matters more than this phase does.
- `git config user.name "Claude"` and `user.email "noreply@anthropic.com"` in the clone. The container
  has no git identity and a commit without one fails. Check `git log -1 --format=%G?` after your first
  commit: if commits are being signed, keep it that way for every commit in the phase.
  *(`%G?` reads `N` in the container because there is no allowed-signers file to verify against; the
  commits carry a `gpgsig` header, which is what to check.)*
- You cannot push — there are no credentials in the container, and pushing deploys to Cloudflare
  Pages, which is Jesse's call, not yours.
- ⚠️ **Before you write a single word of handoff instructions, run `git ls-remote origin`.** Phase A
  ended with a rejected push because its notes asserted where Jesse's `main` was instead of checking.
  Build your bundle to fast-forward from whatever `origin/main` actually is, and round-trip test it by
  cloning `main` from GitHub, fetching the bundle and running `git merge --ff-only`.
- Jesse is in Cowork, not at a terminal. He reads the conversation; he does not see your tool output.
  Ask one clear question at a time and stop.

## ⚠️ Second: snapshot before you read further

```
npm run snapshot
```

`v3a` is the tag to fall back to. This phase touches the price model, the hold, the feeding loop and a
stored field, and it is the first phase in v3 that adds rather than removes — which is the shape that
historically overruns.

> **⚠️ Corrected:** `v3a` points at `18a5bfb`, which is **not on `main`** — it is the Phase A notes
> commit from before that phase was replayed onto `c83debc`. The code is identical to `main`'s
> `6978b96`; only `claude/V3_PHASE_A_NOTES.md` differs. Fall back to `6978b96` to stay on `main`.

## Two questions for Jesse, in his first reply, before you build

Both are decisions Phase A left explicitly to him, and both change what you do:

- **A1 — the calendar.** GDD_V3 §2.1 says "9 regular planets … plus Collar Prime at week 10" and
  separately names "week 5's Major venue", which is 11 weekends in a 10-week season. Phase A built
  8 regular + week-5 Major + week-10 Collar Prime, reading `balance.regularPlanets`. Ask him to confirm
  8 or say what he meant. It is one spreadsheet row either way — but confirm it now, because this phase
  fits an economy to a season length.
- **A7 — the stat-leverage row.** Speed/accel/stamina read 22.4 / 16.9 / 17.6 against a row asking for
  speed > accel > stamina, all 14–26%. It misses the ordering by 0.7. The cause is that `fadeStart` is
  a fraction of the distance, so stamina is worth the same on a 350 m sprint as on a 600 m staying
  trip. The fix is a race-model change best taken in Phase C alongside running styles. Ask whether he
  wants it deferred to C (the recommendation) or the row widened.

⚠️ **Do not fix A7 in this phase whatever he says about the row.** It moves every dog in the golden
season and it belongs with the code Phase C is rewriting anyway.

*(Jesse confirmed 8 + Major + Collar Prime, and deferred A7 to Phase C — GDD_V3 B9.)*

## The standing instruction

**THIS PHASE IS ADDITIVE, AND ITS REAL JOB IS TO PUT THE DECISIONS BACK. The one number that can ruin
the game is the p99 trading leg. Tighten the distribution, never the bands.**

Three things follow and they pull against each other.

**Phase A worked, and its own instruments say the game got too easy.** Read the numbers rather than
the adjective:

- `autoplan%` is 30.8% — how often the naive plan and Normal's plan agree about entries. It was 8.9% at
  `v2e`. The `states alone` row is 95.6%: Race-or-Rest is very nearly automatic. §7a.3's own gloss is
  "above 40 the week makes itself", so this is within ten points of *there is no decision here*.
- The p90/p10 net-worth spread collapsed from 8.0× to 2.3×. Floor more than doubled, ceiling down 17%.
  That is pillar 5 working — nobody is out before the end — and it is also a game where the finishing
  order is mostly racing luck.

**The market is what is supposed to fix both.** Six goods on 8× bands, where the buying decision is
also the training decision, is the mechanic the whole economy hangs on (GDD_V3 §6). If at the end of
this phase `autoplan%` has not moved and the spread has not widened, the market has not landed, and
that is a finding worth more than any acceptance row.

**And the guard, which is the sentence to keep in front of you.** BUILD_PLAN_V3 Phase B:

> ⚠️ The p99 leg row is the one that protects the game. If a single trade can be worth 40% of a
> season, the rest of the design is decoration. Tighten the distribution, not the bands — the 8× is
> the whole point.

Fifty units of Ambrosia bought at 90 and sold at 720 is 31,500 Bones — a whole season's prize money in
one leg (§6.4). Shelf depth stops you assembling it in a week. The price distribution is what stops it
happening by accident: prices must cluster mid-band with rare excursions to the ends, so the 8× is
something a player hunts rather than something that happens to them.

**The scope guard, as always.** Running styles are Phase C, Explore and the event deck are Phase D,
the hotseat loop is Phase E. If you find yourself designing a mechanic that is not in the eight items
below, you have taken a wrong turn — write it up as a question instead.

## Read, in this order

1. `CLAUDE.md` — the non-negotiables. The `Math.pow` / `exp` / `log` rule binds this phase harder than
   any before it, because §6.4 names the exact temptation: the natural way to write a clustered price
   distribution reaches for `exp`. Use `normalDeviate()` from `determinism.ts`.
2. `design/CANON.md` — which documents are current. Short.
3. `design/GDD_V3.md` — §6 in full, which is this phase's specification almost line by line, plus §2.3
   (the weekend, and why the Market runs in turn order), §2.4 (net worth: cargo is valued at the local
   sell price), §10.1 (the click budget arithmetic), §11 (the balance targets) and §12 (`foodBand`
   becomes a per-planet multiplier — see item 1's trap).
4. `design/BUILD_PLAN_V3.md` — Phase B with its acceptance table, and §2.3 for what you must not touch.
5. `design/BUILD_PLAN.md` §§1–5 — architecture, tech stack, repo layout, data model. Current, not
   restated in V3. Also §7a for the harness methodology and the 800-season rule, and §7b for the
   snapshot contract.
6. `claude/V3_PHASE_A_NOTES.md` — the immediately preceding session, and where `v3a`'s baseline
   actually lives. Read the numbers from here, not from any figure quoted in an older prompt. Its
   "Carried forward" section is most of your context, and its four-corrections section is the standard
   this project holds a builder's own record to.
7. `design/GDD.md` — v2, historical, do not build from it. Keep it open: GDD_V3 cites its D1–D53 log by
   name, and D4, D11, D26 and D44 are all about the market you are replacing.

## What Phase A actually left you

So you are not re-deriving it:

| | `v3a`, 800 all-Normal seasons |
|---|---|
| mean end worth | 39,417 (band 25–40k) |
| p10 / p50 / p90 | 24,696 / 37,961 / 56,834 |
| prize / trade / betting / costs | 19,448 / +1,598 / −1,190 / 3,762 |
| food sold as a share of gross | 4.2% — the Phase B row wants 20–35% |
| prize share of gross | 78.2% (target: falls toward 65%) |
| races entered a weekend | 2.02 of 3 |
| races per dog | 6.72 |
| decisions a weekend (AI) | 5.06 |
| hub-clicks | 11.1 presses against a ≤ 10 budget |
| purse share reaching players | 48.3% |
| decided by week | 5.9 of 10 |
| `--calibrate`, 65 vs seven 50s | 56.6% |
| Hard beats Normal | 50.9% (band 63–68%) |

And the state of the code you are extending:

- `content/goods.ts` has exactly one row, `kibble`, with `STOCK_UNLIMITED = 9999`. Its interface
  already carries `stat`, `gainMin`/`gainMax`, `priceMult` and the stock fields, so §6.1 is adding
  rows, not reworking the shape. `feedsFor()` and `bestFeedAboard()` both exist and currently always
  return nothing, which is honest rather than broken.
- `economy/food.ts`'s `rollGoodPrices` draws `rng.uniform(lo, hi)` — flat across the band, which is
  exactly what §6.4 forbids. This is item 2.
- `HOLD_CAP` is `balance.holdCap = 20`, a module constant, not a field. Phase A kept 20 on purpose
  rather than bringing §6.1's 50 forward.
- `Dog.trainStat` is a `StatKey`, kept as a placeholder diet pointer. Nothing reads it in the engine's
  feeding loop yet. This is item 4's trap.
- `phases/endTurn.ts`'s `feedOneWeek` already runs for every dog every week (V8), and already charges
  the crate to costs via `eaten()`. The empty-hold branch currently charges a **cash** penalty
  (`foodNoCargoPenalty`), not a fitness one. This is item 5.
- There is no row-writing script in the repo. The three `add-phase-*-rows.ts` files were deleted in
  Phase A because they would re-add pruned tunables. Write a fresh TypeScript one — that is the repo's
  pattern and `balance-from-xlsx.ts` is the TS reader that has to parse what you produce.
- The workbook contains no formula cells at all in any of its eight sheets (verified in Phase A). So a
  row you add or remove cannot break a reference. What can break: `balance-from-xlsx.ts` matches rows
  by their human-readable label, so a renamed label silently reads the wrong cell.

## BUILD THIS SESSION

Eight items. They are BUILD_PLAN_V3 Phase B's deliverables; the commentary is about the traps.

### 1. Six goods (GDD_V3 §6.1)

| # | Good | Band | Shelf depth per planet |
|---|---|---|---|
| 1 | Grey Mash | 10 – 80 | 40–60 |
| 2 | Scrapmeat | 20 – 160 | 30–45 |
| 3 | Glow Tripe | 30 – 240 | 20–30 |
| 4 | Vat Steak | 60 – 480 | 10–18 |
| 5 | Pulsar Marrow | 75 – 600 | 6–12 |
| 6 | Ambrosia | 90 – 720 | 3–8 |

Every band is exactly 8× floor-to-ceiling; the across-good ladder at the floor is 1 / 2 / 3 / 6 / 7.5 /
9. That near-equality is the whole design — if the hold binds, carry the dear stuff; if cash binds, you
can afford nine times as much Grey Mash. Do not round these into tidier numbers.

Three traps:

- ⚠️ `Planet.foodBand` currently holds an **absolute** price band (`[80, 110]`, `[40, 60]`, …) for all
  18 planets. §6.1 and §12 make it a **per-planet multiplier over the six global bands**. That is a data
  change to every planet row and a change of meaning, so pick the multipliers deliberately — they are
  "the trader's whole map, and the main thing that distinguishes one planet from another
  economically". Say in the notes how you chose them.
- `GOOD_IDS`' order is canonical. `emptyCargo()` builds the dense `Cargo` record in that order and the
  golden digest hashes `JSON.stringify(state)`, so the array order decides the hash. Choose it once,
  cheapest-first, and never re-order it.
- `STOCK_UNLIMITED` should disappear, not be kept for one row. Every good now has a finite shelf; that
  is the scarcity rule.

### 2. The price distribution — the row that protects the game

Prices cluster mid-band with rare excursions to the ends. Use `normalDeviate()` from `determinism.ts`.
Never `exp` — eslint will stop you, and the reason is real: ECMAScript leaves it implementation-defined
and this project spans Node 20, 22 and 24.

Decide and state, in a comment and in the notes:

- the standard deviation as a fraction of the band, and what p99 leg it produces. This is the number
  the acceptance row is actually about.
- how you clamp the tails so a draw cannot land outside the band.
- whether buy and sell drift together. They do today (`foodSpread` is a flat fraction off buy). Keep it
  unless you can say why not.

⚠️ `rollGoodPrices` currently skips rng draws for a shelf whose depth cannot vary, with a comment
explaining that this lets a change to the good list replay an unchanged season draw-for-draw. With six
finite shelves that is no longer true, and it is a deliberate snapshot move. Update the comment as well
as the code — a comment that describes a property the code no longer has is worse than no comment.

### 3. A fixed 50-unit hold, forever

`balance.holdCap` 20 → 50 in the spreadsheet, not in code. `Player.ship` was already removed in Phase A
— check rather than hunt, and if it is gone, say so in one line and move on.

⚠️ Phase A found that at a 20-unit hold the hold binds before the cash does, which is why
`properties.test.ts`'s spend-down assertion was rewritten to assert the cap. At 50 with six goods that
should stop being true in the early game and start being true around week 4–7 — which is item 8's
crossover measure and one of the acceptance rows. Re-examine that assertion when you raise the cap; if
it still passes trivially, it is measuring nothing.

### 4. Feeding and the diet setting (GDD_V3 §6.3)

One unit per dog per week, always, whatever the dog is doing. The bonus table:

| Good | Weekly effect |
|---|---|
| Grey Mash | +1 to a random stat |
| Scrapmeat | +1–2 Stamina |
| Glow Tripe | +1–3 Acceleration |
| Vat Steak | +2–4 Speed |
| Pulsar Marrow | +2–4 to a random stat, +5 fitness |
| Ambrosia | +3–6 to a random stat, +8 fitness, injury chance halved this week |

Three cheap foods each aimed at one stat, three exotics that are broader and touch condition. The
randomness sits inside each row (V6) — do not flatten them into pure magnitude, or five of the six
become plain trade goods and feeding collapses to "buy the best I can afford".

The diet setting is per dog, in the Kennel, sticky, and is not a weekly click: a named food, or best
available, or worst available, with a fallback to the cheapest thing aboard when the choice runs out.

⚠️ **This is a stored-state change and it is the trap of the phase.** `Dog.trainStat` is a `StatKey`; a
diet is `{ kind: 'named', good: GoodId } | { kind: 'best' } | { kind: 'worst' }` or equivalent. That
means `STATE_VERSION` (currently 5, in `state.ts`) moves and `SAVE_VERSION` (`web/src/store/persist.ts`)
with it, a `v3a` save must fail soft to the title screen (`readSave`'s version check already does this
— verify it), and a `v3a` action log cannot replay. Say all of that in the notes.

> **⚠️ Corrected:** verified, and the mechanism is right but the numbers had not moved. `SAVE_VERSION`
> was **4 from `v2c` through `v3a`**, so at `v3a` a v2c–v2e save *passed* `readSave` and failed later,
> at replay, with an error — not softly at the title screen as `V3_PHASE_A_NOTES.md` says.
> `STATE_VERSION` was **5 from `v2d` through `v3a`** (its comment claimed a 6 for v2 Phase E that was
> never applied), and nothing reads `GameState.version` at all. Phase B moves both: 5 → 6 and 4 → 5.

⚠️ `SetDogState`'s action shape changes too. It carries an optional `stat?: StatKey` today, which is
the diet pointer; that becomes the diet. `Action` is the save file and the replay protocol, so this is
the same version bump, not a second one.

### 5. The empty-hold penalty — build this first

If the hold is empty, the dog loses 10 fitness that week and gains nothing.

BUILD_PLAN_V3 says **build it first in this phase** and **make it visible in the Kennel before the week
resolves**. Both halves are deliberate.

This single rule is the whole of v3's running cost. There is no upkeep, no fuel, no wages and no debt
(V10), so food is the only pressure keeping money scarce — which means the penalty for not paying it
has to bite, or the market becomes optional and the economy floats away. Phase A's harness already
shows what "optional" looks like: food is 4.2% of gross income.

⚠️ The existing empty-hold branch charges **cash** — `endTurn.ts` line ~118, `shortfall × the local buy
price × balance.foodNoCargoPenalty (1.5)` — which is v2's rule, not v3's. Decide explicitly whether the
cash penalty is replaced or kept alongside, say which in the commit message, and prefer **replaced** —
§6.3 describes one rule, and two overlapping punishments for the same miss is how a number ends up
impossible to reason about.

### 6. The Market screen (GDD_V3 §6.2)

Five columns, copied from Gazillionaire more or less intact because it is a complete trading UI:

| Your Hold | On Planet | You Paid | Market Price | Price Range |
|---|---|---|---|---|

- **Price Range** is the whole reason the market is legible on the first play. "198" means nothing;
  "198, range 60–480" means *cheap, buy it*, instantly, with no memory and no notes. One of the
  acceptance rows is a human being able to answer "is this a good price" from this column alone.
- **You Paid** is the running average purchase price, so nobody does break-even arithmetic in their
  head. It is per good, per stable, and it has to survive a partial sale sensibly — decide FIFO or
  running-average and say which.
- Hold gauge across the top: **50 / 50**, fixed, for everyone, forever.

`lib/priceTag.ts` already holds the "what does this feed do for this dog" line and Phase A repointed it
from Train weeks to every week. Extend it rather than writing a second one.

### 7. Turn order, shown with its reason

`score = 20 − cargoUnits ÷ 5 + d10` (§2.3). The constant 20 is currently left out of
`phases/arrival.ts`, with a comment saying it changes no ordering and Phase B should put it back when
the 50-unit hold makes the expression something the screen has to explain. That is now.

⚠️ Adding a constant to every score changes no ordering, so this must not move the golden snapshot by
itself. If it does, something else in your commit did it — find out what before you write the message.

> **⚠️ Corrected:** it moved it, and nothing else in the commit did. Phase A's `−cargo ÷ 5 + d10` was
> computed in floating point, so two stables on *exactly* the same score could compare as 0.8 against
> 0.7999999999999998, and adding 20 changed which ties the rounding broke. Scored in whole numbers the
> constant is verifiably inert (the golden season hashes the same with it at 0, 7 and 20), and ties now
> go to the lighter hold — GDD_V3 B7.

The reason string matters as much as the number: a stable that loads its hold to the roof goes last all
season, and that is a trade the whole table can see it making. The screen has to say so.

### 8. The harness

Add:

- **A row per good**: units bought, units sold, units fed, and — the useful one — **mean price paid as
  a position in the band** (0.0 = floor, 1.0 = ceiling). A stable buying at 0.5 is not trading; a stable
  buying at 0.2 is.
- **The cash-bound → hold-bound crossover week**: the week a Normal stable stops being limited by money
  and starts being limited by space. Band 4–7. Define it precisely and say how — the honest version is
  something like the first week where the stable ends the market phase with the hold full and cash above
  some floor, and the definition is a decision worth writing down.
- **The p99 best single trading leg in a season, against mean end worth.** This is the protecting row;
  it needs to be in the standard printout, not behind a flag.
- **Share of weeks a stable's hold is empty** (target < 5%).

Keep the three pace measures Phase A added — they are how you will know whether the market put the
decisions back.

## RULES THAT DO NOT BEND

From `CLAUDE.md` and BUILD_PLAN_V3 §2.3:

- `packages/engine` has no DOM, React, `Date` or `Math.random`. All randomness through `rng.ts`,
  threaded.
- **No `Math.pow` / `exp` / `log` / trig anywhere in `packages/engine/src`.** Use `pow10()` /
  `normalDeviate()` from `determinism.ts`, or wrap in `quantize()` and put it in that module. eslint
  enforces this; do not disable the rule. Item 2 is where you will be tempted.
- Every state change is an `Action` handled in `reduce.ts`. UI never mutates state. `store/loop.ts`
  stays the only place that applies actions and decides screens.
- Same seed + same action log reproduces the same season on any machine and any JS engine.
- Races return a tick log; the renderer replays it and never re-simulates.
- TypeScript strict; no `any` in engine. Ratings and stats are 0–99 integers in state.
- **Content is data, not code.** A good is a row. If adding one needs a branch, stop.
- **Numbers live in the spreadsheet**, generated into `balance.json` by `npm run balance`. Never
  hand-edit the JSON. If a number ends up as a literal in `packages/engine/src`, that is a bug.
- Currency is Bones; format with `formatBones()`.
- Do not run `npx prettier --write` across the repo. Format only what you edited; `design/*.md` has
  never been prettier-formatted and is outside the format globs.
- **Do not build Phases C–E.** No running styles, no Explore doors, no event deck, no hotseat loop.
- **Do not build M6.** No server, no lobby, no protocol.

## The commit discipline

The golden snapshot moves only in commits whose message says that it does and why. Expect at least two
moves this phase — the price model is one, the feeding table is another — and keep them apart so each
reviews on its own.

> **⚠️ Corrected:** four moves — the six goods, the price distribution, the hold-and-feeding commit, and
> an agent fix the new harness rows found (`8dc0f24`). A data-only spreadsheet commit landed before
> item 5, moving nothing, so every later commit is a clean code diff.

Land in this order, because it is also the order that makes each commit measurable:

1. The empty-hold penalty (item 5) — smallest, and it is the rule the economy hangs on.
2. The six goods and the bands (item 1) — data, plus the `foodBand` meaning change.
3. The price distribution (item 2) — alone, so its snapshot move is attributable.
4. The hold at 50 (item 3), feeding and diets (item 4).
5. Screens (item 6) and turn order (item 7) — these should not move the snapshot.
6. The harness (item 8) — must not move the snapshot.

`properties.test.ts` and `determinism.test.ts` should need additions, not edits. If an existing
assertion has to change, stop and work out whether you broke something — with one named exception, the
spend-down assertion in item 3, which Phase A rewrote around a 20-unit hold and which you are expected
to revisit.

> **⚠️ Corrected:** two exceptions, not one. The invariant `STAT_KEYS.includes(d.trainStat)` has to
> change because item 4 replaces the field it checks; it is re-pointed at `Dog.diet` (a diet names a
> real good). No other existing assertion changed.

⚠️ Phase A's own cautionary tale, worth having in front of you: two §2.1 deletions survived a commit
that claimed to be complete, and a deleted harness flag kept printing a plausible-looking run for a
mode that no longer existed. **Sweep, do not assume.** When you finish an item, grep for the thing you
replaced.

## DONE WHEN

BUILD_PLAN_V3 Phase B's acceptance table, every row, with its reading pasted into your final message:

| Measure | Target |
|---|---|
| Food sold as a share of gross income | 20–35% |
| The week a Normal stable stops being cash-bound and becomes hold-bound | weeks 4–7 |
| Best single trading leg in a season, p99 | < 40% of mean end worth |
| Share of weeks a stable's hold is empty | < 5% |
| Mean units of Ambrosia obtainable on one planet | ≤ 8 |
| A new player can say whether a posted price is good | from the Price Range column alone |
| Decisions per weekend per player | ≤ 10 |
| `npm test` green, snapshot moved in named commits only | ✅ |

Plus the rows that carry over from Phase A, which must not regress:

| | |
|---|---|
| Mean end worth, all-Normal | 25–40k |
| Races entered per weekend | 1.8–2.4 |
| Races per dog per season | 5–7 |
| Race calibration, 65 vs seven 50s | 45–60% |

And the two diagnostic numbers that say whether the phase achieved its actual purpose — report them
whatever they say, and do not tune toward them:

- **`autoplan%`**, from 30.8%. Lower is a market that made the week a decision again.
- **The p90/p10 net-worth spread**, from 2.3×. Wider is variance that came back through the market
  rather than through racing luck.

⚠️ **On a missed row, the default is report it with the arithmetic and leave it alone.** v2 spent five
phases chasing races per dog toward a band that turned out to be the wrong number. The one exception is
the p99 leg row: if it misses, tighten the price distribution — never the bands, and never shelf depth,
which is already doing its job.

## Then, in order

1. A full re-baseline: `npm test`, `npm run lint`, `npm run build`, the three headless checks
   (`season-check.ts`, `race-view-check.ts`, `hub-clicks.ts`), then 800 all-Normal seasons,
   `--calibrate`, and the good-by-good table.
2. `npm run snapshot`
3. `git tag v3b`
4. Write `claude/V3_PHASE_B_NOTES.md` in the style of `claude/V3_PHASE_A_NOTES.md`: what was measured,
   what missed, what the next phase inherits, and a corrections section if you got anything wrong on
   the way. `claude/*_NOTES.md` is write-once from the commit that adds it.
5. Add a decision-log row to `design/GDD_V3.md` for every decision the GDD does not already cover — the
   price distribution's shape, the `foodBand` multipliers, the You Paid accounting, the crossover
   definition. Number them B1, B2, … following Phase A's A1–A7.
6. Commit this prompt as `claude/V3_PHASE_B_PROMPT.md` alongside the notes. Correct anything in it that
   turned out to be wrong before you commit it — `design/CANON.md` says write-once begins at the commit
   that adds a prompt, precisely so that a prompt which misdescribed the phase can be fixed once rather
   than left to mislead.
7. `git ls-remote origin`, build the bundle to fast-forward from `origin/main`, round-trip test it from a
   fresh GitHub clone, and spell out the PowerShell for Jesse.

*(The tag was put on the notes commit rather than before it, so that `v3b` — like `v3a` was meant to
— names the commit that carries its own record.)*

⚠️ If you changed a design document, say so: `design/CANON.md` requires the claude.ai Project mirrors
to be re-synced, and that is a separate job.

## And the acceptance test that is not a number

Jesse has played `v3a` and his verdict was "good so far" — which is encouraging and is not yet a
playtest, because `v3a` deliberately has nothing to spend money on. Phase B is the first build where the
economy is a game, so end the notes with a checklist for `v3b`. The questions that only a season can
settle, as they stand today:

- **Can you tell, at a glance, whether a price is good?** The Price Range column is the entire bet §6.2
  makes. If a player has to open a second screen or remember last week, it has failed.
- **Did your dog's dinner ever feel like a decision?** §6.4's claim is that the best move in the game is
  catching your dog's dinner on sale — exotic food in the cheap weeks, Grey Mash in the weeks it is
  worth selling. Did that happen, or did you set a diet in week 1 and never think about it again?
- **Did the constraint change over the season?** Cash should bind early, the hold should bind later
  (§6.1). Did you feel yourself graduate up the ladder, or did one good stay obviously correct?
- **Did the empty hold ever hurt?** It is the only running cost in the game. If you never once ran out,
  it is not doing its job — try running out on purpose and see whether the Kennel warned you in time.
- **Was loading the hold to the roof visibly a trade?** You go last all season for it. Did the turn
  order screen make you feel that as a choice you made rather than a punishment you received?
- **Six goods — too many, or not enough?** §10.1 budgets "up to six market lines, realistically two"
  per weekend. Did you actually use two, or did you find yourself scrolling a table?
- **And the standing question**: did any week present a choice you had to think about?
