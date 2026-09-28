# V3 Phase J: ready for the table

> ⚠️ **Corrected before commit, per CANON's write-once rule.** The prompt below is as given, except
> for this box. Five things it said turned out differently:
> 1. **"A seed link … the game still replays exactly (colour touches no draw)"** is true only when no
>    AI row was named. `createSeason` draws a personality from the game's stream for an AI the table
>    typed a name into (a listed AI's is looked up by name), and a link carries no names, so a link
>    from a table with a named AI opens a different game. This was already so at `v3i`. Phase J did
>    not change the link's names (keep it simple): the report says so under the link when it applies
>    (an extra commit, between 5 and 6 below), and the evening's sheet asks the table to leave AI names
>    blank. Open question 2 in the notes.
> 2. **The F2 checklist is not open.** Jesse answered it at `v3g` (the G notes: the cards are "great",
>    nothing unfinished). The evening's sheet lists it as closed.
> 3. **"The pass screen (`screens/`…)"** is `packages/web/src/components/PassTo.tsx`.
> 4. **`lib/owners.ts` cannot be loaded by a scratch probe under plain Node**: it imports the art
>    through Vite's `import.meta.glob`. Its pure half (`resolveColours`, `HUMAN_FACES`,
>    `humanFaceStem`, and the new `aiOwnerIndices`) moved to `lib/faces.ts`, which `owners.ts`
>    re-exports, so the round-trip and face probes could run.
> 5. **`v3e2` Q4, "did the game-end screen tell the story?"**, is a feel question the report cannot
>    carry. It is asked in the sheet's after-block, not closed.
>
> Everything else held: no engine change, neither golden moved, `SAVE_VERSION` 13, 51 green.
> See `claude/V3_PHASE_J_NOTES.md`.

Phase I is done (`v3i`, pushed). A human picks their face on the Title. **The draft** is in: at each
off-season, the stable last on the season's standings is offered a replacement dog 15 points above the
ordinary offer (GDD_V3 §2.2, V23). In five-season games, the poorest stable at season 3's start now
finishes top 3 in 31% of games, up from 12%.

**The design is now waiting on people, not code.** Every build phase since `v3e2` has closed with 🎲
rows that only a table of humans can answer:
- Phase E's four timed rows
- the F1, F2, `v3g`, `v3h` and `v3i` checklists
- §14's open questions that name a playtest (Q1 sabotage, Q3 reading a style, Q6 the Target ending,
  Q11 processional races)

Another balance phase would be tuning blind. **Phase J makes one evening with friends answer as many of
those rows as possible.** It has two parts, in this order:

1. **Hotseat polish.** Close the three small UI questions `v3i` left open. All three show up the moment
   four people share a laptop.
2. **The evening's sheet and the report.** Rewrite the playtest checklist as one ordered plan for one
   evening. Add a **"Copy the report"** button to the game's end, so each game comes back to the next
   Cowork session as text instead of from memory.

**Nothing in the engine changes.** No rule, no sheet row, no golden, no `SAVE_VERSION`. If anything
below seems to need one, stop and ask Jesse.

## ⚠️ First: the mechanics. They are I's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **51 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
  3. **Then run `npm run snapshot`, before any change.**
- **Commits:** `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`. Commits are
  signed; check for a `gpgsig` header with `git cat-file -p HEAD | head -6`. **Tags are annotated and
  signed:** use `git tag -s v3j -m "…"`, and check the tag for an SSH signature.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder,
     with this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle from whatever his `main` actually is: `git bundle create <out> <his main>..main v3j`.
     If his tree is dirty or his `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:** write the bundle under `/mnt/user-data/outputs/` and `device_commit_files` it into
     his folder. Then, in `device_bash`:

     ```
     git fetch ./v3j.bundle main:refs/heads/work refs/tags/v3j:refs/tags/v3j
     git merge --ff-only work
     git branch -d work
     rm v3j.bundle
     ```

     Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Pushing deploys to Cloudflare Pages; that is Jesse's call. End by giving him
     `git push origin main` and `git push origin v3j`. A stop hook will say there are unpushed
     commits. That is expected: say so and do not push.
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds.
- **Keep scratch out of the repo.** Put probes and screenshots in `shots/`, and add that to
  `.git/info/exclude`. Stage paths, not `-A`.
- **Screenshots of in-game screens (I's method; the scripts were scratch, so rebuild them):**
  - Install Playwright into `shots/` (`npm i playwright@1.56`) and launch with
    `executablePath: '/opt/pw-browsers/chromium'`.
  - Build save blobs headless: `createSeason`, then step with `decide` for every seat, humans
    included, until the phase you want.
  - Write the blob as `{ v: 13, setup, log, ui }`, with the `ui` marks `screenFor` needs.
  - Load each blob in a **fresh browser context** through `storageState`, then press Resume. Don't use
    `setItem` + reload: the running app writes its own save on unload and clobbers yours.
  - A hotseat save lands on "Pass to …" first. Press "I am …".
- **The container has 2 cores**, and a tool call times out at 10 minutes. Run anything long with
  `nohup … &` and poll. Never `cat > file` without a heredoc: it waits on stdin and eats the timeout.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

**`v3i` is the tag to fall back to.** The golden digests since `v3i`:

- one season: **`41a8c8b5…`**
- two seasons: **`d4bb14c3…`**

**Neither moves in Phase J.** `SAVE_VERSION` stays **13**, and `STATE_VERSION` stays **13**.

## Jesse's standing calls: do not reach for these

- Food is the only running cost, at one crate a dog a week (V22). A table growing richer together is fine.
- The draft stays at +15 (V23). E7 stays as defined, with §11's three reported rows beside it.
- **Keep it simple.** He has chosen the simple option every time.
- Unchanged: purses, the calendar, game length, the off-season, feeding, the stake cap (1,000, ×2 on
  Neon Snout), Hard's logic, the race model, the odds, and every 🎲 row's target.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/GDD_V3.md`: §1 (the pillars, and pillar 6's forty minutes), §3 (hotseat), §7.5 (watching),
   §10 (the notes on faces), §14 (the open questions).
3. `design/BUILD_PLAN_V3.md`: Phase E's four 🎲 rows, and every phase's 🎲 row since.
4. **`claude/V3_PHASE_I_NOTES.md`**, the last session: "Read this first 5" and Open questions 1–4.
5. **`design/PLAYTEST_CHECKLIST.md`**, the current E2 section. Then every checklist still open, all
   multiple choice, at the end of each notes file:
   - `V3_PHASE_E1_NOTES.md`, carried into the E2 section
   - `V3_PHASE_F1_NOTES.md`
   - `V3_PHASE_F2_NOTES.md`
   - `V3_PHASE_G_NOTES.md`
   - `V3_PHASE_H_NOTES.md`
   - `V3_PHASE_I_NOTES.md`
6. The code:
   - `packages/web/src/lib/owners.ts` (`ownerIndexFor`, `humanFaceFor`, `resolveColours`, `HUMAN_FACES`)
   - `packages/web/src/lib/seedLink.ts` (`playersParam`, `parseSeasonLink`)
   - the pass screen (`screens/`, whatever renders `{ kind: 'pass' }` from `store/loop.ts`)
   - `packages/web/src/screens/SeasonEnd.tsx` (the game end, `ShareSeed`, "The clock") and `lib/pace.ts`

## PART 1: BUILD the hotseat polish

All three are UI only, with no golden and no save bump. Each is its own commit.

### 1a. The pass screen shows who is next

"Pass to Human 3" gains that human's face, `OwnerFace` big, above or beside the name. It is the one
screen four people read from across a table. The button text is unchanged, and so is the click budget.

### 1b. A seed link carries the faces

- Today `players=h,normal,hard` drops every colour. The game still replays exactly (colour touches no
  draw: `test/colour.test.ts`), but the humans come back on seat-index faces.
- **Spell a human who picked a face as `h` plus a colour number 1–8**, e.g. `h8` for Pink. A plain `h`
  still means "not picked".
  - Parse leniently, as the file already does: `h0`, `h9` or `hx` reads as a plain `h`, never as a
    dropped seat.
  - `hard` must still parse as Hard. It is the one real trap, and the file's own comment says so.
- The Title fills a shared table's picks back in as picks, so `resolveColours` gives the same colours.
- **Round-trip it:** for 1, 4 and 8 humans, with and without picks, `seasonLinkFor` → `parseSeasonLink`
  → `resolveColours` must give the colours the original table played with. Put the check in a
  scratch probe, or a web test if the web package has a runner (it had none at `v3i`; don't add one
  just for this).
- A `v3i` link, with no digits, must still parse to exactly what it did.

### 1c. A renamed AI keeps its face

- Today an AI row the table typed a name into falls back to `colour % 12` (`ownerIndexFor`). A human's
  pick that moves that AI's colour therefore changes its face (I notes, Read this first 5).
- Key a renamed AI's face by **its name** instead: a small stable string hash, mod 12. Add no
  `Math.random` and no `Date`, even in the web package.
- If two AIs at the table would wear the same painted owner, the later seat walks to the next owner
  nobody at the table wears.
  - This includes owners worn by AIs on the list: a renamed AI must never wear Baroness Vex's face at
    a table with Baroness Vex.
  - The walk must be a pure function of the table, so the face is the same on every screen and after
    a reload.
- Unrenamed AIs keep exactly the faces they have now. Check that at 6 and 8 stables.

**Screenshots for Part 1** go in `shots/`, at 1280 and 390:
- a pass screen at 4 and 8 humans
- a Title filled from a link with picks
- a table with two renamed AIs, one with a list name's colour

`season-check`, `hub-clicks` (9.4 a weekend) and the table walk (10.7 / 22.4 passes, printed by
`hub-clicks`) must be unchanged.

## PART 2: BUILD the evening's sheet and the report

### 2a. "Copy the report" on the game's end

A button on the game-end screen, next to the season link, copies a **plain-text report** to the
clipboard. It is what Jesse pastes into the next Cowork session. It holds:

- the seed link, including faces (1b), the game's length, and the toggles
- the table: each stable's name, human or AI (and difficulty), and face
- the result: the winner, how the game ended, and the final standings with net worth
- **The clock**, exactly as the panel reads it, including the four-way split
- a season-by-season line: each season's top stable, and who got the draft

Rules for the report:
- The build it was played on: the tag or the commit, if the web build exposes one. If not, add it at
  build time from `git describe`, in Vite's config, as a define. Don't hard-code it.
- Plain text, no markdown tables: it has to survive a phone's clipboard.
- A copy that fails (no clipboard permission) falls back to a selectable text box, and never throws.
- `Date` is fine here (web package), but the report must not *need* the date to make sense.

### 2b. The evening's sheet

**Rewrite the current section of `design/PLAYTEST_CHECKLIST.md`** as one plan for one evening. It
replaces the E2 section as the current one; move the E2 section down as history, the way the v1
section already is.

- **The order of play.** Choose the fewest games that cover the most rows. A suggested shape:
  1. **A short opener.** 4 humans + 2 AIs, 1 season, races **skipped**: Phase E row 1 (≤ 25 min), plus
     the F1 / F2 look-and-feel rows while everyone is fresh.
  2. **The long one.** 4 humans + 2 AIs (one of them Hard), 2 or 3 seasons, races **watched**: row 2's
     time, per season; the E1 carry-overs (the off-season, the retirement); `v3h` and `v3i` (the
     draft, and whether the back of the table still had something to play for); `v3g` (a big bet).
  3. **If there is time:** Race to 60,000 for row 4 (a Target finish worth watching), or 8 humans for
     row 3.

  If you think a different order covers more, argue it in the notes.
- **Every outstanding question, once.** Where two checklists ask the same thing (Hard's strength is
  asked in `v3h` and `v3i`), merge them and say which phases the answer closes. Keep them multiple
  choice. Keep each game's block short enough to fill in at the table: **no more than about eight
  questions a game.** Anything left over goes in a short "after everyone's gone" block.
- **Say how to send it back:** paste each game's "Copy the report" text, plus the ticked answers, into
  the next Cowork session.
- Add a small table at the top: every 🎲 row open at `v3j`, the phase it came from, and which game of
  the evening answers it. That table is the thing the next session reads first.

## RULES THAT DO NOT BEND

- **No engine change.** `packages/engine/src`, `balance.json` and the sheet are byte-identical to `v3i`.
  Prove it in the notes with `git diff v3i --stat -- packages/engine/src design/*.xlsx`.
- **Neither golden moves. `npm test` stays 51 green**, plus any tests you add.
- **`SAVE_VERSION` stays 13.** If the report needs something stored, it goes in the save's optional
  `ui` block, the way the pace timer does, and an old save still loads.
- **Format only what you edit.**

## The commit discipline, in this order

1. The pass screen's face (1a).
2. A seed link carries the faces (1b).
3. A renamed AI keeps its face (1c).
4. "Copy the report" (2a).
5. The evening's sheet (2b).
6. Notes, prompt and design docs. Tag **`v3j`** on it.

## DONE WHEN

| Measure | Target |
|---|---|
| The pass screen shows the next human's face | ✅, 4 and 8 humans, 1280 and 390 |
| A seed link carries picked faces and round-trips them; a `v3i` link parses as before; `hard` is Hard | ✅ |
| A renamed AI's face is keyed by its name, never shared at the table; unrenamed AIs unchanged | ✅ |
| "Copy the report" gives the link, the table, the result, the clock and each season's draft, as plain text; fails soft | ✅ |
| `PLAYTEST_CHECKLIST.md`'s current section is one evening, ordered, with every open 🎲 row mapped to a game | ✅ |
| No engine change; goldens unchanged; `SAVE_VERSION` 13; `npm test` green; lint; `season-check`; build; `asset-check` 288 / 0 / 0 | ✅ |

## Then, in order

1. **Re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - `season-check`
   - `hub-clicks` (9.4, and 10.7 / 22.4 passes)
   - `race-view-check`
   - `npm run harness -- --seasons 50` (paste the summary into the notes, per CLAUDE.md; it must equal
     `v3i`'s)
   - `asset-check`
2. `npm run snapshot`, then `git tag -s v3j` on the notes commit.
3. **Write `claude/V3_PHASE_J_NOTES.md`** in the style of the I notes, with a "Read this first" at the
   top, then:
   - the three polish items, with screenshots named
   - the report, with one real example pasted in
   - the evening's plan, and why that order
   - open questions

   End with a **short** multiple-choice `v3j` checklist. It will mostly be "did you play the evening,
   and did the report come back cleanly", because the evening's sheet carries the real questions.
4. **Update the design docs:**
   - `design/GDD_V3.md`: §10's faces note (the pass screen, links, renamed AIs). A §13 entry is only
     needed if a decision was made (the next V number is **V24**).
   - `design/BUILD_PLAN_V3.md`: a **Phase J** section in Phase I's style, whose 🎲 row points at the
     evening's sheet.
   - `design/CANON.md`: the `v3j` tag. Also say whether `PLAYTEST_CHECKLIST.md` should now be mirrored
     to the Project, so Jesse can read it on his phone at the table. If yes, mirror it.
5. Commit this prompt as `claude/V3_PHASE_J_PROMPT.md`, corrected before commit where it was wrong,
   with the corrections in a box at the top.
6. **Land it** in Jesse's folder and give him `git push origin main` and `git push origin v3j`.
7. **Sync the Project:** push the changed `design/*.md` and the new `claude/` notes and prompt with
   `project_write`, and update each status header's `last synced`.

## Still open, and not this phase's

- **Everything 🎲.** Phase J makes the evening possible; Jesse's table answers it. The session after the
  evening reads the reports and the ticked sheet, and decides the next build from them.
- §7.5 / §14 Q5, split view: wait for the clock's race-day share from a real table.
- §14 Q9, whether the book should price fitness and form.
- The goldens cannot see betting or humans. A Hard or human seat in a golden needs Jesse's say-so.
- Online multiplayer, the project's long-term goal. The engine is pure and action-driven, so it is the
  same job it always was, but it is a phase of its own.
