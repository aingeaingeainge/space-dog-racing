# V3 Phase A — the cull

## ⚠️ Corrected 17 September 2026 — Phase A was built in Cowork, not in Claude Code

**The section that used to be here told you that you were Claude Code running in
`C:\Users\jesse\Documents\CoWork\dog racing game`, with the real `.git` in front of you, and that
you must not clone and must not produce a bundle. That is not what happened.** Jesse chose not to
switch to Claude Code, so Phase A was built the way Phases D and E were: by a Cowork session cloning
the public GitHub repo into a cloud container, working there, and handing back a git bundle. The
original text is in git history; it has been replaced rather than annotated because a build prompt
that misdescribes the mechanics is worse than no prompt at all.

**The route that actually works, until Cowork's shell into the folder is fixed.** Since 8 September a
Windows update has broken it — `device_bash` returns `sandbox-helper: no Plan9 drive shares mounted`.
So:

- **`git clone https://github.com/aingeaingeainge/space-dog-racing` into the container** and work
  there. `npm install`, then verify before touching anything: `npm test` green, `npm run lint` clean,
  `npm run harness -- --seasons 20` runs.
- **Check the clone actually has the documents you need.** Phase A found `design/CANON.md`,
  `GDD_V3.md` and `BUILD_PLAN_V3.md` missing from it entirely — they existed only on Jesse's disk and
  in the claude.ai Project. If a design document is not in the clone, stage it from his disk, verify
  the copy with `md5sum`, and **commit it before building anything on it**.
- **`git config user.name "Claude"` and `user.email "noreply@anthropic.com"`** in the clone: the
  container has no git identity, and a commit with no author fails.
- **You cannot push** — there are no credentials in the container. Finish with
  `git bundle create phase-<tag>.bundle v2e..HEAD --tags`, round-trip-verify it by cloning from the
  bundle into a scratch directory and re-running `npm test` there, then send it with `SendUserFile`
  and spell out the `git fetch` / `git merge --ff-only` commands for Jesse in PowerShell.
- **Jesse is in Cowork, not at a terminal.** He reads the conversation; he does not see your tool
  output. When you need a decision, ask one clear question and stop.

⚠️ **A bundle is a handoff, not a push.** Cloudflare Pages builds every push to `main` on Node 20 and
deploys to `space-dog-racing.pages.dev`, so pushing is Jesse's call and it is a deploy.

---

## ⚠️ Second: run the snapshot before you read any further than you have to

```
npm run snapshot
```

**This is the phase that deletes most, and it is the phase most likely to be rushed** (`BUILD_PLAN_V3`
Phase A says so in its own goal statement). `npm run snapshot` copies the repo into
`backups/YYYY-MM-DD_HHMM_<tag>/` with a `SNAPSHOT.md` recording the commit and harness summary.
`v2e` is the tag to fall back to. **Confirm the backup folder actually appeared before you delete a
line** — a snapshot you assume ran is not a rollback.

Then establish the baseline you are about to invalidate, and **write the numbers down in your notes
as you go**:

```
git describe --tags          # expect v2e
git status                   # expect clean
npm install
npm test                     # record the count; it must be green BEFORE you change anything
node -v                      # record it; determinism spans Node 20, 22 and 24
```

Also record the hash of `packages/engine/test/__snapshots__/golden.test.ts.snap`. You are going to
move it deliberately, more than once, and the only way anyone can audit that later is if the
starting value is written down.

⚠️ **Pre-flight one more thing, because item 9 needs it.** Check whether Python and `openpyxl` are
available on this machine (`python --version`, `python -c "import openpyxl"`). Every previous phase
edited the spreadsheet from a Linux container where they were a given; here they may simply not be
installed. **If they are not, read item 9 before installing anything** — there is a good chance you
should not be using openpyxl at all.

---

## The standing instruction

> **THIS PHASE IS SUBTRACTIVE. Every number below the race level is void, not inherited. A missed
> acceptance row is a measurement, not a failure — and there is exactly one row you are allowed to
> tune toward.**

Both halves matter and they pull against each other, so be explicit about which one you are obeying
at any moment.

The first half is the scope guard. The six-food market, running styles, Explore and the hotseat loop
are Phases B–E. **Building any of them here is how this session overruns**, and Phase A's stated job
is to get the surface area down *before* anything is built on it. A system you delete now is a system
Phase B does not have to reason about; a system you leave behind a flag is one it does.

The second half is the measurement guard, and it is v2's hardest-won lesson. `BUILD_PLAN_V3` Phase A
is blunt: *everything below the race level was fitted to 13 weeks, four stats and a dog market; none
of those numbers survives this phase.* So when a row misses, the default is **report it, with the
arithmetic, and leave it alone** — not tune. v2 spent five phases chasing `races per dog` toward a
band that §20 Q14 eventually proved was simply the wrong number, and the whole of Phase E's opening
is about not doing that again.

**The one sanctioned exception** is *races entered per weekend per stable*, band **1.8–2.4 of 3**.
`BUILD_PLAN_V3` flags it as the row most likely to miss, because it is pure fitness arithmetic and
−20/+30 is an estimate. If it comes in under 1.8, **lower the Race cost**; over 2.4, **raise it**.
Move that one number, report what you changed and what it did, and **do not compensate by changing
the purses** — the purses are the thing the row is supposed to be independent of.

---

## Read, in this order

1. **`CLAUDE.md`** — the non-negotiables. The `Math.pow` rule still binds and eslint enforces it.
2. **`design/CANON.md`** — which documents are current, and which way the sync runs. It is short.
3. **`design/GDD_V3.md`** — the rules, in full. **§4.3** is item 7's specification (age bands:
   growth, rest recovery, injury multiplier) and you will be implementing it literally.
4. **`design/BUILD_PLAN_V3.md`** — **§1** (what is now being measured), **§2** in full (§2.1 is your
   delete list, §2.2 is what changes, §2.3 is what you must not touch), and **Phase A** with its
   acceptance table.
5. **`design/BUILD_PLAN.md` §§1–5** — architecture, tech stack, repo layout, the data model. **Still
   current**, not restated in V3. Also **§7a**, whose harness methodology and 800-season rule apply
   verbatim, and **§7b** for the snapshot/rollback contract.
6. **`claude/V2_PHASE_E_NOTES.md`** — the most recent session. This is where the `v2e` baseline
   actually lives; read the numbers there rather than trusting any figure quoted in an older prompt.
   Note what Phase E left open, then note that most of it is about to become irrelevant.
7. **`design/GDD.md`** — **v2, historical. Do not build from it.** Keep it open anyway: GDD_V3 cites
   its findings and its D1–D53 decision log by name throughout, and a builder who cannot follow those
   references will re-derive a decision that has already been paid for.

---

## BUILD THIS SESSION

Ten items. They are `BUILD_PLAN_V3` Phase A's deliverables; the commentary is about the traps.

### 1. Execute §2.1 in full — delete, do not disable

The table in `BUILD_PLAN_V3` §2.1 is the authority and it is written out in full there *because a
subtractive phase is easy to do half-way, and a half-deleted system is worse than either state*.
Work it row by row. It takes out the dog market, the staff ladder, ship and kennel upgrades, fuel,
upkeep, wages, loans and the bank, bankruptcy and the Bust screen, the Fixer, items, the Trap stat,
kibble and the stat feeds, the Rough/Proper/Prime tiers, the seven fact-gated race types,
championship points, dossiers and the Tipster, the Train state, and the Docks and Saloon screens.

⚠️ **A flag is not a deletion.** No `ENABLE_MARKET = false`, no commented-out reducer arms, no dead
`RaceType` rows left in content "for reference". The acceptance row is *nothing in §2.1 remains
referenced anywhere in `packages/`* and you should verify it with a grep sweep you paste into the
notes, not by feel.

⚠️ **`packages/engine/scripts/add-phase-{c,d,e}-rows.ts` are a trap.** They are historical sheet
writers that reference tunables you are deleting, and `tsconfig.tools.json` puts scripts inside
`npm run build` — which is exactly the bug Phase A of v2 found the hard way (`season-check.ts` kept
emitting a deleted action because the tools weren't typechecked). Decide deliberately: prune them,
or retire them with a one-line note saying why. Do not let `npm run build` be the thing that tells
you.

### 2. Three stats

`Dog.trap` removed. Rating weights **0.40 speed / 0.35 accel / 0.25 stamina**. `bendCraft` and the
trap-draw edge both read **`accel`**. The trap draw itself stays — it is the draw's *edge* that
changes which stat it consults.

### 3. Race or Rest only

`Train` leaves `weekState`; `SetDogState` loses that arm. **Race −20, Rest +30.** The fitness curve
itself (`0.90 + 0.10 × fit/100`) is in §2.3 and does not change.

⚠️ v2's Phase A retired `SetTraining` and found that `reduce` **silently ignored the unknown action**
because its switch had no `default`. Check that it still throws. A stale action log must replay as an
error, not as a different season.

### 4. Three purse tiers replacing `RaceType`

**Gold Cup / Silver Plate / Bronze Dash.** Open entry — every eligibility predicate goes. One dog per
stable per race. Locals at **55 / 45 / 35** and fitness **75**. Three races per weekend, as now.

The seven types, the Handicap cap, the Invitational floor, the Consolation and `cardCoverage` all go
with this. Content is data: the three tiers are **rows**, not branches.

### 5. Ten weekends

Thirteen → ten. **Major at week 5 (×2 purse). Grand Final at week 10, at Collar Prime (×3).** The
calendar is a spreadsheet row, not a constant in code (item 9).

### 6. Three dogs, dealt at the start

Three dogs per stable, dealt on an **equal stat budget**, ages **2–4**. Kennel slots gone entirely.
No buying, no selling, no pups — the dog market is §2.1's first row.

### 7. Age bands per GDD_V3 §4.3

Growth, rest recovery and injury multiplier all band by age. Implement §4.3 as written; if it is
ambiguous anywhere, **ask rather than pick** — this is a rule, and rules come from the GDD.

### 8. A placeholder single-good market

Just enough that the trade loop still runs and the harness can measure a trade. **Phase B replaces it
wholesale with the six goods on 8× bands — do not build those now**, and do not build the empty-hold
penalty, the price-range UI or shelf depth either. One good, one price, a hold.

### 9. The spreadsheet — and read this before you reach for openpyxl

`design/space_dog_racing_economy.xlsx` is the source of truth for numbers;
`packages/engine/src/content/balance.json` is **generated** from it by
`packages/engine/scripts/balance-from-xlsx.ts` via `npm run balance`. **Never hand-edit the JSON.**

Prune the **Assumptions** sheet of every tunable §2.1 deletes, and add the new ones: **the fitness
costs (−20 / +30), the three purse tiers, the local ratings (55/45/35) and their fitness (75), the
age bands, and the 10-week calendar** with the week-5 ×2 and week-10 ×3 multipliers.

⚠️ **`BUILD_PLAN_V3`'s prompt says "use openpyxl", and the repo's own precedent disagrees with it.**
The existing sheet writers are TypeScript — `add-phase-c-rows.ts`, `add-phase-d-rows.ts`,
`add-phase-e-rows.ts`, upserting, taking `--set` — and `balance-from-xlsx.ts` is the TS reader that
has to parse whatever you produce. Python and openpyxl may not even be installed on this machine.
So: **follow the repo's pattern and write a TS row script unless deleting rows while keeping formulas
intact genuinely needs openpyxl.** If you do use openpyxl, say in the notes why the TS path wasn't
enough. Either way:

- **Keep the formulas intact.** A pruned sheet whose formulas now point at deleted cells is worse
  than an un-pruned one.
- **`balance-from-xlsx.ts` must still parse it.** Run `npm run balance` and diff `balance.json`.
- **Commit the `.xlsx` and the regenerated `balance.json` together**, per `BUILD_PLAN.md` §8.4.
- The engine reads numbers **only** from `balance.json`. If a new number ends up as a literal in
  `packages/engine/src`, that is a bug in this item.

### 10. Harness: cut it down, then add the pace measures

**Delete:** the path agents (`trainer` / `trader` / `crook` / `mixed`), `careless`, `bankruptRate`,
`cardCoverage`, the tier rows, and the staff/fuel/upkeep columns of the road split.

**Add three pace measures**, which are now the rows v3 is actually about (§1: *does four players take
forty minutes, and does anything memorable happen in it*):

- **decisions per weekend per player** — this is `hub-clicks.ts`, budget **≤ 10**
- **races entered per weekend per stable** — band **1.8–2.4 of 3**, the tunable row
- **races per dog per season** — band **5–7**

⚠️ **Losing `careless` costs you the bankruptcy instrument, and that is correct** — bankruptcy is
deleted, there is no debt and no upkeep, so there is nothing for it to measure. Say so in the notes
rather than leaving a reader wondering where the agent went.

---

## RULES THAT DO NOT BEND

From `CLAUDE.md` and `BUILD_PLAN_V3` §2.3, which survive this phase untouched:

- **`packages/engine` has no DOM, React, `Date` or `Math.random`.** All randomness through `rng.ts`,
  threaded.
- **No `Math.pow` / `exp` / `log` / trig anywhere in `packages/engine/src`.** Use `pow10()` /
  `normalDeviate()` from `determinism.ts`, or wrap in `quantize()` and put it in that module.
  ECMAScript leaves them implementation-defined and this project spans Node 20, 22 and 24 — Node 22
  vs 24 once moved every stored odds value. **eslint enforces this; do not disable the rule.**
- **Every state change is an Action handled in `reduce.ts`.** UI never mutates state. `store/loop.ts`
  stays the only place that applies actions and decides screens.
- **Same seed + same action log reproduces the same season on any machine and any JS engine.**
- **Races return a tick log; the renderer replays it and never re-simulates.**
- **TypeScript strict; no `any` in engine.** Ratings and stats are 0–99 integers in state.
- **Content is data, not code** — a race tier is a row, a planet is a row. If adding one needs a
  branch, stop.
- **Numbers live in the spreadsheet**, generated into `balance.json`. Never hand-edit the JSON.
- Currency is Bones; format with `formatBones()`.
- **Do not run `npx prettier --write` across the repo.** Format only what you edited. `design/*.md`
  has never been prettier-formatted and is outside the `format` script's globs — leave it that way.
- **Do not build M6.** No server, no lobby, no protocol.
- **Do not build Phases B–E.** If you find yourself designing a mechanic, you have taken a wrong
  turn — write it up as a question instead.

### The commit discipline

**Land the deletions and the rule changes separately.** `npm test` green at each commit. Small
commits, imperative mood.

**The golden snapshot moves only in commits whose message says that it does and why.**

⚠️ **Plan the split before you start deleting.** The golden season is six **Normal** AI stables, so
*any* change to Normal's decisions or to a shared balance number moves the digest — and in this phase
the deletions alone will, because a Normal stable with no market makes different decisions. That
caught v2's Phases C, D and E in turn. Expect **more than one** move, name each one in its commit
message, and keep the work that must *not* move it — harness, screens, docs, the spreadsheet plumbing
— in separate commits where it reviews properly.

`properties.test.ts` and `determinism.test.ts` should need **additions, not edits**. If an existing
assertion has to change, stop and work out whether you broke something. Phase D's cautionary tale:
the assertion was failing because the *test* was wrong, and the only way that got caught was by
refusing to move the band and going looking instead.

---

## DONE WHEN

`npm test` green. `npm run lint` clean. `npm run build` produces `packages/web/dist`. The golden
snapshot moved only in its named commits.

⚠️ **The three headless checks will all break, and cutting them down is part of the job.**
`season-check.ts`, `race-view-check.ts` and `hub-clicks.ts` walk screens you are deleting. They must
end this phase **exercising the new week** — three purse tiers, Race-or-Rest, the placeholder market
— not merely surviving it. A check that passes because it no longer checks anything is worse than a
red one.

Then the **full re-baseline**: `npm run harness -- --seasons 800`, all Normal, plus `--calibrate`,
`--stats` and the purse share. Paste **every row** of the table below into your final message with its
measured value, met or not:

| Measure | Target | Measured |
|---|---|---|
| `npm test` green, golden snapshot moved in named commits only | ✅ | |
| `npm run lint` clean, no `any` in engine, no `exp`/`log`/`pow` | ✅ | |
| A 10-week season completes headless with 6 AI stables | ✅ | |
| Stat leverage, +10 from a balanced rating-50 dog | speed > accel > stamina, all 14–26% | |
| Race calibration (rating 65 vs seven 50s) | 45–60% | |
| Races entered per weekend per stable | **1.8–2.4 of 3** | |
| Races per dog per season | **5–7** | |
| Mean end worth, all-Normal, one season | 25–40k | |
| Decisions per weekend per player (`hub-clicks`) | ≤ 10 | |
| Nothing in §2.1 remains referenced anywhere in `packages/` | ✅ | |

**A missed target reported honestly beats a met one you tuned toward at the expense of something
else — say which you traded.** And per the standing instruction: for every row that misses, say
whether you believe the *game* is wrong or the *number* is, and show the arithmetic. These bands were
written for a game nobody has run yet.

### Then, in order

1. `npm run snapshot`
2. `git tag v3a`
3. Write **`claude/V3_PHASE_A_NOTES.md`** in the style of the existing phase notes — look at
   `claude/V2_PHASE_E_NOTES.md` for the shape. **What was measured, what missed, and what the next
   phase inherits**, plus a decisions-taken section for anything you decided that the GDD does not
   cover. `claude/*_NOTES.md` is write-once; it is the build log and nothing edits it afterwards.
4. Add a decision-log row to `design/GDD_V3.md` for every such decision, and update any section of
   GDD_V3 that now describes what this prompt *hoped* rather than what the game *does*.
5. **Tell Jesse exactly what to run.** He is merging a bundle in PowerShell — spell every command
   out, and say what his `main` should be at before he starts.

⚠️ If you changed a design document, say so explicitly, because `design/CANON.md` requires the
claude.ai Project mirrors to be re-synced afterwards and that is a separate job in a Cowork session.

---

## And the acceptance test that is not a number

**Phase A is playable, and `BUILD_PLAN_V3` §5 says it should be played before Phase D adds more
dice.** No harness row substitutes for it, and every legibility finding in this project's history —
the supplement, the feed counter, the click budget — came from a season a human actually played.

So **end the notes with the playtest checklist for `v3a`**. The questions that only a season can
settle, as they stand today:

1. With Race or Rest the only choice, is *"run this one tired or rest it and lose the purse"* still a
   decision you have to think about — or has removing Train made the week thinner rather than
   sharper?
2. Three purse tiers, open entry: is there any reason to enter the Bronze Dash once you can win the
   Gold Cup, or has open entry collapsed the card into one race that matters?
3. Ten weeks instead of thirteen — does the season feel tight, or rushed?
4. Three dogs and no market: does a bad opening hand feel like a game you cannot win? **This is v3's
   biggest stated risk** (§5: every acquisition is a draw and nobody has felt the aggregate).
5. §7's three standing questions: *Did any week produce something you told someone about afterwards?
   Could you tell why a dog won? Did you ever wish you could buy something that does not exist?*

Number 5's last clause is the one to watch this phase, because you have just deleted four markets and
Phase B only brings one of them back.

**Ask before inventing any rule the GDD does not cover.**
