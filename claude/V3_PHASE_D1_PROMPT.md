# V3 Phase D1: Explore and the deck

> **Corrected before commit, per `design/CANON.md`.** This is the prompt Phase D1 was built from,
> committed alongside `V3_PHASE_D1_NOTES.md`. Where it turned out to be wrong it is corrected here,
> above the original, which is otherwise unchanged. Six corrections:
>
> 1. **"Explore replaces the arrival card's click" — the arrival card's click was never counted.**
>    `hub-clicks` did not include it, so its 10.5 was light by about a quarter of a click. Explore
>    counted honestly is 1.75 presses a weekend (a door, and a choice on ~75% of cards). A "Fly on"
>    button on Results saves 0.78. `hub-clicks` reads **11.3: missed** (D7).
> 2. **"A hidden style revealed to the tipped player" was not built.** C4 makes a style public or not,
>    and there is no private knowing. Every style reveal in D1 is public (D3).
> 3. **Mean end worth needed a dial the prompt did not name.** The Pound's offers centred on the dealt
>    50 lifted mean end worth out of its band by about 2,000. `dogOfferRatingMean` went to 42 (D5), a
>    sheet row. Normal's first door rule also missed the none-below-12% row, and was redone (D5).
> 4. **Two existing assertions in `properties.test.ts` were edited, not added to.** The phase is
>    `'explore'` now, not `'events'`, and the one-human walks have to open a door. No invariant
>    changed.
> 5. **Commit order.** Information (item 5) got its own commit after the tips. There are three more
>    commits: a tuning commit after `--explore` existed, a `race-view-check` fix, and a retune at 800
>    seasons (buzzing +8 → +5 → +3 speed, offers 44 → 42). Each says in its message whether the
>    snapshot moved.
> 6. **The deck is 86, not "at least 70".** 72 cards came before the offers, tips and shelf cards,
>    which are on top.

Phase D is two sessions, and this is the first. **D1 is the deck**: the Explore screen, the doors,
the events, dog offers, information, betting tips and the free local runner. **D2 is the people**:
staff on commission, sabotage and the bought trap draw, Hard reading the field, and the rest of
Phase D's acceptance table. D2's prompt is written after D1's notes. Do not build D2's systems here,
but leave the seams they will need.

## ⚠️ First: the mechanics. These changed after Phase C2, so read them.

- **Build in a clone in the container**, as every phase since v2 D has:
  `git clone https://github.com/aingeaingeainge/space-dog-racing`, `npm install`, then check before
  touching anything: `npm test` is **28 green**; `npm run lint` is clean; `npm run harness --
  --seasons 20` runs; `npx tsx packages/web/scripts/season-check.ts` passes. If any of those fails on
  a fresh clone, stop and say so.
- `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are signed; check
  for a `gpgsig` header with `git cat-file -p HEAD | head -6`, and keep every commit signed.
- **Jesse's repo folder is connected**: `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  the Cowork shell (`device_bash`) at `$HOME/mnt/dog racing game`. **From now on, you land the work
  in it yourself.** Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder.
     The reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.* Delete
     nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container, and in his folder run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle to fast-forward from what his `main` actually is. If his tree is dirty or his `main`
     is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** `git bundle create` in the container; `device_commit_files` it into his folder; in
     `device_bash`: `git fetch <bundle> main:refs/heads/work` plus the tag, then
     `git merge --ff-only work`, `git branch -d work`, and `rm <bundle>`; check the tree is clean and
     no `index.lock` is left.
  4. **You cannot push.** End by telling him the two commands: `git push origin main` and
     `git push origin v3d1`.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. Build and test in the
     container.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then `npm run snapshot`. **`v3c2` is the tag to fall back to.** `main` is ahead of it by 13 art
commits and one docs-sync commit. The engine has not changed since `v3c2`, and the golden snapshot is
`da2d00a2…`.

## What Jesse said after playing `v3c2`

| Question | Answer |
|---|---|
| Did the finishes feel closer? | **A little** |
| Did you see a hot pace, and did the closer get there? | **Yes, the closer came through** |
| Did it change where you entered your closer? | **Yes, into the crowded race** |
| Do the last few metres look right? | **Didn't notice the run-in** |
| Does anything feel worse than `v3c`? | **No** |

And his calls for Phase D: **split** D1 the deck, D2 the people; **betting needs insider knowledge,
delivered as race-day tip events**; **sabotage is freely targetable** (D2); **delivery**: the builder
merges the work into his folder.

**Do not touch the race model**, `oddsScale`, or Phase B's market numbers.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: §9 in full, §8, §2.3, §4.4, §5.4, §7.4, §10 and §10.1, §12, and the decision
   log from C1 to C15.
3. `design/BUILD_PLAN_V3.md`: Phase D's deliverables and acceptance table, and §6's Prompt V3-D.
4. `claude/V3_PHASE_C2_NOTES.md` ("Carried forward") and `claude/V3_PHASE_C_NOTES.md` (C4 on
   `revealStyles`).
5. The code: `content/events.ts` (26 cards), `content/planets.ts` (18 planets), and
   `packages/web/scripts/assets.ts`.

## The baseline (`v3c2` plus the art, golden `da2d00a2…`)

| | |
|---|---|
| mean end worth, all-Normal (800) | 39,207 · entered 2.02 · races/dog 6.74 · p90/p10 1.89× |
| house margin / every stable dog (real fields) | −12.9% / +2.3% a Bone |
| betting, a stable-season | −1,038 |
| food share of gross | 30.9% |
| `autoplan%` | 27.6% (entries 27.6, states 99.1) |
| Hard beats Normal | 53.1% |
| `hub-clicks` | 10.5 a weekend (6.5 decisions, 4.0 navigation) |
| under 60 at declaration | 26.3% (band 10–25, carried) |

## BUILD THIS SESSION

1. **Explore replaces the arrival draw** (GDD_V3 §2.3 step 2, §9.1). Every stable picks one of three
   doors, privately and simultaneously; contention in turn order; the arrival draw goes and the 26
   cards are re-homed; new actions like `ChooseDoor`; the rng must not depend on which door a stable
   picks where that would shift other stables' draws — say which approach, and add a determinism
   test; the Casual toggle keeps excluding `swing` cards.
2. **Doors as data** (§9.1, §12): `Planet.exploreDoors`, three named, planet-flavoured doors per
   planet, 54 names, each category offered often enough that none-below-12% is possible.
3. **The deck: at least 70 events in D1** (≥ 80 after D2), each category ≥ 12, planet-specific rows
   on top; every card two or three choices or flavour, an AI choice, a log line, a story. Reuse the
   effects the engine already has. **If the session runs long, cut polish, not events.**
4. **Dog acquisition** (§9.2, V4): age, one revealed stat, a description that is sometimes a lie;
   accepting discards one of your own and pays nothing; an acquired dog arrives style-unknown; fix
   `revealStyles`; report lies told and caught; a stable that wants a dog gets ≥ 2 swings a season.
5. **Information** (§9.4): Bar cards give next planet's band position for some or all goods; report
   the Bar tip's worth to the AI's trading; Phase B's bands hold.
6. **Race-day tips.** Hidden conditions on stable dogs drawn at a fixed point at arrival (a knock,
   off its feed, buzzing, a hidden style revealed to the tipped player), applied on race day, never
   priced; Bar and Back Alley cards reveal one to the taker only, the owner included. Size it: a
   tipped buzzing dog +10–30% a Bone, untipped stable dogs ≤ +2%, house margin −12 to −15%. Normal
   takes and bets tips with its existing sizing. If the design cannot hit those rows sanely, stop and
   ask Jesse with the numbers.
7. **The free local runner** (§4.4): a stable with fewer than three fit, uninjured dogs is offered a
   local for the Bronze Dash; nobody's asset.
8. **The screen, and the click budget** (§10, §10.1): an Explore screen; every new card and door an
   entry in `packages/web/scripts/assets.ts`; `placeholders`, `asset-list`, `asset-check`; do not
   overwrite finished art; `hub-clicks` must not get worse than 10.5 — Explore replaces the arrival
   card's click, it does not add one. *(⚠️ Corrected: see 1 above.)*
9. **The AI**: Normal picks a door by a category weight that leans on what it lacks plus a hash;
   Hard gets no new behaviour beyond tips.
10. **The harness and the checks**: `--explore` (door choices, outcome spread, dog offers, lies, the
    tip rows, the Bar tip's worth); `season-check.ts` must fail on zero dog offers, zero tips or zero
    Explore picks.

## RULES THAT DO NOT BEND

- `packages/engine`: no DOM, React, `Date`, `Math.random`, `pow`/`exp`/`log`/trig; rng threaded.
- Every state change is an `Action`; the renderer replays the tick log.
- Content is data: a door, a card and a condition are rows.
- Numbers go in the spreadsheet through `add-phase-d-rows.ts`; never hand-edit `balance.json`.
- Scope: no staff, sabotage or trap draw; no race-model or `oddsScale` change; Phase B's market
  numbers stay; Hard gets no new behaviour beyond tips.
- The golden snapshot moves only in commits that say so; `properties.test.ts` and
  `determinism.test.ts` take additions, not edits. *(⚠️ Corrected: see 4 above.)*
- `STATE_VERSION` and `SAVE_VERSION` move.
- Format only what you edit.

## The commit discipline

1. Spreadsheet rows. 2. Explore replaces the arrival draw. 3. The deck to ≥ 70. 4. Dog acquisition
and `revealStyles`. 5. Conditions and tips. 6. The local runner. 7. The screen, the art contract and
the clicks. 8. Harness, `season-check`, property tests. 9. The version bump. *(⚠️ Corrected: see 5
above.)*

## DONE WHEN

| Measure | Target |
|---|---|
| Events in the deck | ≥ 70 (≥ 80 after D2), each category ≥ 12 |
| Share of doors chosen, per category, all-Normal | none below 12% |
| Dog offers a stable-season | ≥ 2 |
| Tipped "buzzing" bet / untipped stable dog / house margin | +10–30% / ≤ +2% / −12 to −15% |
| Two consecutive seasons share no more than a third of their events | ✅ |
| `hub-clicks` | ≤ 10.5 (the target is ≤ 10) |
| Phase B's market rows, races entered, races/dog, mean end worth | inside their bands |
| `npm test` green; `season-check` fails on zero dog offers, zero tips or zero Explore picks | ✅ |

Report `autoplan%`, p90/p10, Hard v Normal, under 60 at declaration, betting income. Tune toward
none of them.

## Then, in order

1. Full re-baseline (tests, lint, build, the three headless checks, 800 all-Normal, `--explore`,
   `--styles`, `--calibrate`, `--autoplan`, 3 Hard v 3 Normal).
2. Serve the build and screenshot: Explore on two planets, a dog offer with a lie, a tip and the bet
   it paid.
3. `npm run snapshot`, then `git tag v3d1` on the notes commit.
4. Write `claude/V3_PHASE_D1_NOTES.md` in the style of the C2 notes, ending with a short
   multiple-choice `v3d1` checklist.
5. Update the design docs: decision rows D1, D2, … in GDD_V3; inline notes in §9 and §14; Phase D's
   status in BUILD_PLAN_V3; the `v3d1` tag in CANON.
6. Commit this prompt as `claude/V3_PHASE_D1_PROMPT.md`, corrected before commit where it was wrong.
7. Land it in Jesse's folder, give him the two push commands, and sync the changed `design/*.md` and
   the new `claude/` notes and prompt to the claude.ai Project.
