> ⚠️ **Corrections, made by the session that built Phase Q, before this file was committed** (CANON:
> write-once starts when the file lands here):
>
> 1. **§11 has no AI rows.** "If Normal's win rate against Easy or Hard moves outside §11's AI rows" has
>    nothing to point at: Hard against Normal is *reported* (§11's `v3h` notes, BUILD_PLAN_V3's 63–68% band
>    is long missed and not tuned). Phase Q read the AI as the standing table, `npm run harness -- --seasons
>    800 --ai easy,normal,normal,hard,hard,normal`, before and after every change: Normal beats Easy 98.1%
>    → 98.0%, Hard beats Normal 57.9% → 57.8%.
> 2. **Draft position's miss is mostly the last pick's**, not the first's: at `v3p` the first pick wins
>    +2.5 to +3.8 points over fair and the last loses 4.4 to 5.2. The widest gap is what §11 measures.
> 3. **"`npm run test -- -u`" does not re-record the goldens**: the root `test` script is a typecheck
>    chained to the engine's tests, so a trailing `-u` does not reach vitest. The command is
>    `cd packages/engine && npx vitest run test/golden.test.ts -u`.
> 4. **"Run `npm run snapshot`" before anything else** was done on the clean `v3p` tree, after a
>    measurement script had been written: the uncommitted work was set aside for the snapshot.
> 5. **The sheet's upserter had no rename.** Q3 renames a staff-cut row where it stands, so
>    `add-phase-q-rows.ts` gained a `RENAME` list beside `REMOVE` and the rows.
> 6. **`screen-words` needs a built web**: `npm run screen-words -- packages/web/dist <out.json>`.
>
> The draft below is otherwise as written on 8 October 2026.

> Draft, written after `v3p` (8 October 2026) for the next session, which runs **unattended**. The
> repo's copy, committed and corrected by that session, will supersede this one.

# V3 Phase Q: make the game better, on your own judgement

`v3p` is pushed. The screens are clean. **This phase is about the rules.** Jesse's words: *"look at all
the mechanics and make adjustments on what you think will make the game better… work away improving
the game without my input."*

**Jesse is asleep and will not answer.** Do not ask him anything, and do not use AskUserQuestion. Every
call is yours. The price of that freedom: each change must be **measured, reasoned against the pillars,
recorded, and revertible on its own.** In the morning he reads one page and keeps or reverts each change.

The test for every change is GDD_V3 §0's test, unchanged: **can a new player learn this in one weekend
of play, and does it produce a story at the table?** Behind it are the six pillars (§1), the five
decisions (§1.1) and §11's balance targets. "Better" means one of these:

- a decision from §1.1 that is shallow becomes a real choice;
- a §11 row that is out of band comes back in;
- a system that cannot be said in a sentence gets simpler;
- something that does nothing measurable is cut or made to matter.

It never means more stuff. §15's list stays out.

## ⚠️ First: the mechanics (as P's)

- **Work in a clone in the container:** `git clone https://github.com/aingeaingeainge/space-dog-racing`,
  then `npm install`, then `npm run server:install`.
- **Check these on the fresh clone before touching anything.** If any fails, stop and write down why
  in the notes; do not build on a red baseline.
  - `npm test` is 207 green; `npm run lint` is clean; `npm run build` passes.
  - `npx tsx packages/web/scripts/season-check.ts` passes.
  - `npm run asset-check` reports 288 / 0 / 0.
  - `npm run view-walk` reports 0 throws.
  - `npm run server:test` is 15 green.
  - `online-walk` ends "All 27 rows pass.", `online-table-walk` "All 10 rows pass.", `browser-walk`
    "All 8 rows pass.". Run them one at a time with `nohup … &` and poll. If only the held-"Fly on" row
    fails, rerun `browser-walk` alone.
- **Take the baseline.** Run `npm run snapshot`. Then save into `shots/before/`: `season-check`,
  `hub-clicks`, `race-view-check`, `npm run harness -- --seasons 200`, `npm run harness -- --draft`,
  and `npm run screen-words`.
- **Commits:** author `Claude` / `noreply@anthropic.com`, signed. **Tag `v3q`**, annotated and signed.
  Scratch goes in `shots/` (add it to `.git/info/exclude`); stage paths explicitly.
- **Practicalities:** 2 cores and 10-minute tool calls, so run long jobs with `nohup … &` and poll. The
  harness at 200 seasons takes about 15 s; `--draft` and the long-game measures take minutes.
- `v3p` is the fallback tag.

## ⚠️ Rules will change, so the versions move, once

The room is live: a push to `main` redeploys it.

- Bump `STATE_VERSION` and `SAVE_VERSION` once, so old saves read as unplayable, loudly.
- Bump **`PROTOCOL_VERSION` to 2** (frozen at 1 since `v3l4`; see CLAUDE.md and ONLINE_PLAN §7).
- Move the goldens **once, in a commit of their own, after the last rule commit**.
- Tell Jesse in the notes' first line: **push only when nobody is playing online.**
- Online and hotseat must both still work: every walk green at the end.

## Read, in this order

1. `CLAUDE.md`, `design/CANON.md`.
2. `design/GDD_V3.md`, **all of it**: this phase can touch any system. Give special attention to §1–§1.1,
   §11 (the targets and which rows are out of band now), §13 (the decision log; **Jesse's calls are
   listed there**) and §14 (the open questions: several are exactly this phase's material).
3. `design/BUILD_PLAN.md` §7a (the harness method) and `design/BUILD_PLAN.md` §§1–5 (architecture).
4. `claude/V3_PHASE_N_NOTES.md` (the draft, and its two misses), then `claude/V3_PHASE_P_NOTES.md`.
5. The engine: `packages/engine/src/` (phases, `ai/`, `content/`), `scripts/harness.ts`, and how
   `balance.json` is made from the sheet (`npm run balance`; Phase N's `add-phase-n-rows.ts` is the
   pattern for adding sheet rows).

## What not to touch

- **Jesse's explicit calls stand.** Anything in §13 recorded as Jesse's call or pick (V-rows marked so,
  N1, L4a–c, M1, P1–P3) is not reversed. Tuning a number *inside* one of his calls is allowed only if
  the call was about the mechanism, not the number. When in doubt, leave it and list it as a question.
- The genre and the shape: 3–8 players, a ten-weekend season, three races a weekend, three styles,
  six foods, two trainers, four dogs, the doors, the draft, net worth wins. No new market, stat, style
  or food (§15).
- Online: no change to the room or the protocol's messages beyond what a rule change forces through
  the view. No new dependency anywhere. The root `package-lock.json` is not touched.
- `balance.json` is never hand-edited: change the sheet, regenerate.
- Pace: pillar 6. No change may add presses a weekend (`hub-clicks` must not go up) or race-day time.

## What to do

### 1. Audit (measure before changing anything)

Write `shots/audit.md`: every system in GDD_V3, a line each.

| Column | What it holds |
|---|---|
| The system | One line naming it |
| Its §1.1 decision | Which of the five decisions it serves, or none |
| Health | What the harness says about it: its §11 rows, in band or out, with the numbers |
| Verdict | One of: **fine** · **shallow** (one answer is always right) · **dead** (does nothing measurable) · **out of band** · **too complex** (cannot be said in a sentence) |

Where §11 has no row for a system, measure it (a new harness mode or flag, as `--draft` was added).
Known candidates — **verify, don't assume**:

- **Draft position** (§11, N's miss 1): the first pick wins 4–5 points over fair at 3/6/8 stables,
  against ±3.
- **The long-game comeback** (N's miss 2): the poorest at season 3 finishing top 3 is 27.0%, and the
  poorest at the last season's start having its biggest gain is 9.3%. V23's targets were 31% / 14%.
- **The style-read trainer** (§14 Q13): priced below zero since the draft made styles public.
- **The book doesn't price fitness** (§14 Q9): the only edge left for a player who reads the card.
  Is it a real edge in the harness, and is it the right size for decision 5?
- **Injuries barely cost anything** (§14 Q4): a trainer who halves them is worth nothing measurable.
- **Is any of the five decisions shallow?** For each one, does the Normal AI's choice differ from a
  naive rule (always the dearest food, always the best dog in the Gold, never bet) in a way that wins?
  If the naive rule does as well, that decision is not a decision.
- **Explore**: do the three door categories pay differently enough that the pick is a choice?

### 2. Choose at most five changes

Rank the audit's findings by **how much they matter to a table of friends**, not by how easy they are.
For each candidate, write in `shots/candidates.md`:

- the problem, with the number;
- the change, in one sentence a player would understand;
- which pillar or decision it serves;
- what it costs: a rule's words, a click, a version, a §11 row it might push out.

Take **at most five**. Prefer a change that removes or simplifies over one that adds. Prefer a number
moved in the sheet over new code. If two candidates fix the same thing, take the simpler.

### 3. Build each one: prototype, measure, keep or drop

For each change, in order:

1. **Prototype it** behind a sheet cell or a flag, so before and after can run side by side.
2. **Measure it.** Run `npm run harness -- --seasons 200`, plus `--draft` and the long-game measure if
   relevant, with **at least two settings** of its dial. Report every §11 row it moves, before → after,
   with the standard error where the harness gives one.
3. **Keep it only if** it moves its target in the right direction by more than noise, pushes no other
   §11 row out of band, adds no press a weekend, and still reads as one sentence. Otherwise **drop it
   and record why**: a measured "no" is a result.
4. **Kept:** one commit (the sheet row, the engine, the AI if it must learn the rule, the tests, and
   the screen's words if a rule a player reads changed), with the measurement in the message. Goldens
   are skipped until step 4.
5. **Record it** in GDD_V3 §13 as **`Q1`, `Q2`, …** with *"Claude's call at `v3q`, unattended;
   Jesse to keep or revert"*, plus the number that justified it. Amend the section that states the rule.

The AI must play the new rule as well as it played the old one. If Normal's win rate against Easy or
Hard moves outside §11's AI rows, fix the AI in the same commit or drop the change.

**If a change cannot land in its own commit** (a rule and its golden share nothing else, so this should
not happen), say so in the notes.

### 4. Then, in order

1. **Goldens**, once, in their own commit: the old and new hashes in the message. Version bumps go in
   the same commit or the one before.
2. **Re-baseline** into `shots/after/`: the same files as `shots/before/`. Every check and walk must be
   green.
3. **Notes**: `claude/V3_PHASE_Q_NOTES.md` in N's and P's style.
   - **First line:** push only when nobody is playing online; this push ends live rooms.
   - **The one-page morning read**, a table: one row per change kept (`Q1`…), each with: what it does
     in a sentence, the number that justified it, what a player will notice, and **how to revert it**
     (`git revert <hash>`, then `npm run test -- -u` for the goldens, or whichever command really
     regenerates them; name it after checking).
   - A second table of what was tried and dropped, with the number.
   - The audit's summary: what is fine, and what is still open.
   - A **short** multiple-choice checklist for Jesse: keep all · revert some (which) · and what next.
4. **This prompt** as `claude/V3_PHASE_Q_PROMPT.md`, corrected before commit, with the corrections in a
   box at the top. Tag `v3q` on that commit.
5. **Docs**: GDD_V3 (the amended sections, §11's rows, §13's Q rows, §14's questions answered or
   changed), BUILD_PLAN_V3 (a Phase Q line), PLAYTEST_CHECKLIST (a 🎲 row for each kept change: "did
   anyone notice Q*n*, and was it better?"), ONLINE_PLAN §7 (`PROTOCOL_VERSION` 2), CANON (`v3q`, last
   synced), and the README only if a sentence in it is now wrong.

## Landing, unattended

Jesse's folder is `C:\Users\jesse\Documents\CoWork\dog racing game` (`$HOME/mnt/dog racing game` in
`device_bash`).

- If the computer is reachable: probe, `git ls-remote origin`, then check his tree (his
  `package-lock.json` change is the known one). Bundle, `device_commit_files`, fetch the bundle's
  `main` **into a fresh ref name**, and fetch the tag. A stale `refs/remotes/bundle/main` from an
  earlier phase rejects the fetch, so P fast-forwarded from the tag instead. Then `--ff-only`.
- **Never run `npm` in his folder. You cannot push.**
- **Delete permission needs a person to answer.** If the request can't be granted while he sleeps, or
  `git` cannot clear `.git/index.lock` without it, do not force anything. Leave
  `phase-q.bundle` in his folder, and put in the notes the exact commands to fast-forward from it.
- If the computer is not reachable, leave the bundle in the session (`/mnt/user-data/outputs/`) and
  say so.
- **Sync the Project:** CANON, GDD_V3, BUILD_PLAN_V3, PLAYTEST_CHECKLIST, ONLINE_PLAN, and the new
  notes and prompt. Update each one's `last synced`.
- End the session with a `SendUserMessage` holding the morning read: the table of kept changes, the
  push commands, and the warning about live rooms. Nobody is watching the final reply.

## RULES THAT DO NOT BEND

- **Determinism**: the same seed and the same log give the same game on any engine. No `Math.random`,
  `Date`, DOM or `pow` / `exp` / `log` / trig in `packages/engine` (CLAUDE.md). Use `determinism.ts`.
- **Every change measured and revertible on its own.** No change without a harness number. No two
  changes in one commit.
- **Jesse's calls stand** (above).
- **At most five changes kept.** Restraint is the point: a morning read of twenty changes is a revert
  of twenty changes.
- **Pace never worse**: `hub-clicks` not up; race day not longer.
- Strict TypeScript, no `any` in the engine, lint clean, format only what you edit.
- Every check and walk green at the end. No dependency added, and the root lockfile untouched.

## DONE WHEN

| Measure | Target |
|---|---|
| The audit | Every GDD_V3 system with a verdict and a number, in the notes |
| Changes kept | 1–5, each its own commit, each a `Q` row in §13 with its number |
| Changes dropped | Each recorded with the number that dropped it |
| §11 rows | None newly out of band; each one a kept change aimed at is closer to its band |
| AI | Easy, Normal and Hard still in §11's bands |
| Pace | `hub-clicks` ≤ 9.5; race day not longer |
| Versions | `STATE_VERSION` / `SAVE_VERSION` +1, `PROTOCOL_VERSION` 2, goldens moved once, if any rule changed |
| Walks | All green; hotseat and online both play |
| Landed | Fast-forwarded in Jesse's folder, or the bundle left there with the commands |
| The morning read | In the notes and in a final `SendUserMessage` |

## If it is too big for one session

Split it. **Q1** is the audit, the candidates and the first one or two changes, landed and tagged
`v3q1`. **Q2** is the rest, and its prompt goes into Q1's notes. A session that runs out of time after
measuring but before landing must still leave its measurements in the notes. A night's measurements
are worth keeping even when nothing was built.
