# V3 Phase J build notes: ready for the table (29 September 2026)

Built in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3j`**. The fallback is `v3i` (`bab2e08`).

**In one line:** nothing in the engine moved. The hotseat table got three small fixes (the next human's
face on the pass screen, faces in a seed link, a renamed AI's face by its name), the game's end got a
**Copy the report** button, and the playtest checklist is now **one evening of three games** that
answers every open 🎲 row.

---

## ⚠️ Read this first: four things the record should know

1. **A seed link from a table that named an AI never replayed that game, and still does not.** The
   prompt said a link replays exactly because colour touches no draw. That holds, but names do touch a
   draw: `createSeason` looks a listed AI's personality up by name, and draws one from the game's stream
   for an AI the table typed a name into (`state.ts`, the `rng.pick(AI_PERSONALITIES)` line). A link
   carries no names, so the AI comes back blank and the stream is different from the first stable on.
   Checked: seed 99, the same table with one AI named "Gravy Train" or left blank, gives a different log
   and a different winner. A human's name changes nothing. This was already true at `v3i`.
   - **Not fixed** (keep it simple, and it is a link change Jesse has not asked for). The report says so
     under the link when it applies (commit `a9bb859`), and the evening's sheet asks the table to leave
     AI names blank. Open question 2 is the fix, if wanted.
2. **The Title's "What is in this build" panel is stale**, and newcomers will read it on the evening. It
   says "v3 Phase E1 — the game's shape" and "Most of the pictures are still stand-ins … 11 of the 149
   files in the art library are real so far". At `v3f2` every file was finished. Not touched here: it is
   copy, not one of this phase's three items. Open question 1.
3. **The example report's clock is synthetic.** The report below is from a real game (seed 2026, played
   headless with `decide` in every seat), but a headless game has no wall-clock time, so its `pace` block
   was written by hand, ~4 minutes a weekend. Every other line is what the game printed. The clipboard
   copy itself was read back in Chromium (Playwright, clipboard permission granted): same text.
4. **The F2 checklist was already answered** (at `v3g`). The prompt listed it as open. The sheet lists it
   under "closed before the evening", with `v3f1` Q5 (the cards were drawn) and the E2 questions the
   clock and report now carry.

(The prompt's other small misses, fixed in its correction box: the pass screen is `components/PassTo.tsx`;
`owners.ts` needs Vite to load, so its pure half moved to `lib/faces.ts`.)

---

## Part 1: hotseat polish

### 1a. The pass screen shows who is next (`3b92b55`)

- `PassTo` shows `OwnerFace big` above "Pass to *name*". The pass screen gets its own size (`.pass-to`):
  144 px at 1280, 112 px on a phone, because it is read from across the table. Button text, reason line
  and click budget unchanged.
- Screenshots: **`j-pass-4h-1280/390`** (Jesse, Pink), **`j-pass-8h-1280/390`** (Aroha, Green).

### 1b. A seed link carries the faces (`7f9cda2`)

- **Writing:** a played setup carries an explicit colour on every row (the Title resolves them at Start),
  and nothing records which humans actually pressed a face. So `playersParam`:
  - if every row's colour is what `resolveColours` gives a table of **unpicked** humans, writes the short
    `v3i` spelling, `h` for every human. A table nobody touched keeps the link it always had.
  - otherwise writes **every** human as `h1`…`h8` (colour + 1). `resolveColours` places them first on
    the way back in, and the AIs then walk to the colours they had.
- **Reading:** an AI token is looked up first, so `hard` is Hard. Then `h`/`human`. Then `h` plus exactly
  one character is a human: `h1`…`h8` is a pick, and `h0`, `h9`, `hx` are a plain `h`, never a dropped
  seat. A second claim on a face already picked in the link reads as unpicked.
- **The Title** fills picks in as picks (`PlayerSetup.colour`), and its notice adds "faces and all".
- **The probe** (`shots/probe-link.ts`, scratch): for 1, 4 and 8 humans, with and without picks, 200
  random tables each (shuffled seats, random difficulties), `seasonLinkFor` → `parseSeasonLink` →
  `resolveColours` gives the table's colours; kinds and difficulties survive; an untouched table's link
  has no digits. Five `v3i` links (including a junk one) parse byte-identically to `v3i`'s own
  `seedLink.ts`, and the lenient cases parse as above. **3,006 checks, 0 failures.**
- The pure half of `owners.ts` (`resolveColours`, `HUMAN_FACES`, `humanFaceStem`) moved to
  **`lib/faces.ts`**, which imports no art; `owners.ts` re-exports it. `owners.ts` imports the art
  through Vite's `import.meta.glob` and cannot load in a Node probe.
- Screenshot: **`j-title-link-1280/390`**, from `?seed=42&players=h8,normal,h3,hard,h,normal`: Pink in
  seat 1, White in seat 3, and the plain `h` in seat 5 on its seat colour, Orange.

### 1c. A renamed AI keeps its face (`61aa4a0`)

- **`aiOwnerIndices(table, list)`** in `lib/faces.ts`, a pure function of the table:
  1. every AI on the list wears its own owner, by name, exactly as before;
  2. then each AI the table renamed, in seat order, starts at **`nameHash(name) % 12`** and walks to
     the next owner nobody at the table wears: never a listed AI's, never an earlier renamed AI's. A
     list name typed twice walks the same way from its own owner.
- `nameHash` is FNV-1a over the UTF-16 code units with `Math.imul`: exact integer arithmetic, the same
  in every browser. No `Math.random`, no `Date`.
- `ownerIndexFor(player, table)` takes the table; `OwnerFace` reads it from the store, so every screen
  (leaderboard, results, podium, game end) agrees. With no table it still gives the hashed face.
- **The probe** (`shots/probe-faces.ts`): 3, 6 and 8 stables × 300 seeds × 0–3 renamed AIs, through the
  real `createSeason`. No two AIs share an owner; every listed AI's owner equals `v3i`'s; a renamed AI
  never wears a listed AI's face; the function is repeatable; and **permuting every colour moves no
  AI's face**. **24,800 checks, 0 failures.**
- Screenshot: **`j-renamed-leaderboard-1280/390`**, seed 77: "Gravy Train" hashes to 8, which Fizz
  Molloy wears at that table, so it walks to 9; "Mutt Hutt" hashes to 2, free. Six different faces. At
  `v3i` Gravy Train would have worn `colour % 12` = 3.

`season-check`, `hub-clicks` (9.4) and the table walk (10.7 / 22.4) are unchanged: none of them reads a
face.

---

## Part 2: the report and the evening

### 2a. "Copy the report" (`9218a17`, `a9bb859`)

- A button beside "Copy a link to this season" on the game-end screen. `lib/report.ts` builds the text
  from the final state, the setup, the action log and the pace timer. **Nothing new is stored.**
- **The build:** `__SDR_BUILD__`, a Vite define from `git describe --tags --always --dirty` at build
  time (falls back to Pages' `CF_PAGES_COMMIT_SHA`, then "unknown"). The container's build read
  `v3i-3-g61aa4a0-dirty` mid-phase; the pushed `v3j` will read `v3j`.
- **The draft line** reads the archive: the stable last on a season's standings, for every season
  followed by an off-season (V23's rule, the one the season's end shows). Whether it took the pick is
  read from the log: a stable's *k*-th `Retire` is its answer at the off-season after season *k*.
- **The clock** is the panel's two sentences, word for word, plus a "By season" line of weekend minutes
  when the game had more than one, for game 2's per-season row.
- **Fails soft:** `buildReport` is wrapped; a missing `navigator.clipboard` or a rejected write opens a
  selectable, wrapping, monospace text box ("The clipboard said no…"). Checked with the clipboard
  stubbed to reject: **`j-gameend-fallback-1280/390`**. Copied for real and read back:
  **`j-gameend-copied-1280/390`**.
- `gameEndLine` and `gameLengthText` moved from `SeasonEnd.tsx` to `lib/report.ts`, unchanged, so the
  screen and the report say the same thing.

**The example** (seed 2026, 4 humans + a named Normal AI + a Hard AI, two seasons; ⚠️ the clock is
synthetic, see Read this first 3):

```
SPACE DOG RACING — GAME REPORT
Build: v3j
Link: https://space-dog-racing.pages.dev/?seed=2026&players=h8%2Ch2%2Ch6%2Ch4%2Cnormal%2Chard&len=2
Note: Gravy Train was an AI the table named. A link carries no names, so it opens a different game from this one.
Seed 2026 · 2 seasons · 6 stables, 4 human · toggles: none (the defaults)

THE TABLE (seat order)
1. Jesse — human, face Pink (glamorous old hand)
2. Mia — human, face Blue (grinning antennaed alien)
3. Tama — human, face Green (young hotshot)
4. Ruby — human, face Black (studded punk)
5. Gravy Train — AI, Normal, renamed, wearing Fizz Molloy's face
6. Countess Zibb — AI, Hard, its own painted owner

THE RESULT
Winner: Jesse, 83,289 Bones
How it ended: The seasons ran out: after 2, Jesse wins with 83,289 Bones.
Final standings:
1. Jesse (human) — 83,289 Bones · 2 Gold Cups · 8 races won · prize 73,014 Bones, trade 6,695 Bones, betting −8,041 Bones
2. Ruby (human) — 77,360 Bones · 6 Gold Cups · 12 races won · prize 63,400 Bones, trade 12,125 Bones, betting −9,859 Bones
3. Countess Zibb (Hard) — 71,472 Bones · 2 Gold Cups · 7 races won · prize 56,250 Bones, trade 11,173 Bones, betting −13,921 Bones
4. Tama (human) — 66,761 Bones · 1 Gold Cup · 6 races won · prize 50,625 Bones, trade 6,673 Bones, betting −8,314 Bones
5. Gravy Train (Normal) — 57,609 Bones · 0 Gold Cups · 7 races won · prize 48,264 Bones, trade 4,396 Bones, betting −8,380 Bones
6. Mia (human) — 52,413 Bones · 1 Gold Cup · 8 races won · prize 43,013 Bones, trade 4,733 Bones, betting −8,374 Bones

THE CLOCK
This game took 86 minutes, 4m 07s a weekend, of which race day 1m 23s.
A weekend: 1m 50s on private screens · 1m 23s on race day · 25s passing the laptop · 30s on the table's own screens (arrival, board, after the races), over 20 weekends; 3m 10s between seasons.
By season: season 1 41 min · season 2 41 min (weekends only).

SEASON BY SEASON
Season 1 (10 weekends): top Ruby 54,158 Bones · the draft: Tama (last, 32,370 Bones), retired a dog and took the pick
Season 2 (10 weekends): top Jesse 83,289 Bones · no draft (no off-season after it)

Copied from the game's end, 29/09/2026, 9:41:07 pm.
```

(The link's commas come out as `%2C`: `URLSearchParams` has always encoded them, and the Title reads
them either way.)

### 2b. The evening (`862c1f2`)

`design/PLAYTEST_CHECKLIST.md`'s current section is now **"v3 Phase J — the evening"**. The E2 section
is below it, marked historical, then v1's.

- **A table of 27 rows** at the top: every 🎲 row and checklist question still open at `v3j`, where it
  came from, and which game (and question number) answers it. Merged where two phases ask the same
  thing: Hard (`v3d2`, `v3h`, `v3i`), betting and the cap (`v3g` Q1/Q4, `v3h` Q4), the doors and planets
  (`v3f1` Q1–2, `v3d1` Q1, §14 Q8), faces (`v3f1` Q4, `v3i` Q1), the retirement (`v3e1` Q2, `v3e2` Q5),
  clicks (`v3d1` Q5, `v3d2` Q5, §14 Q12). It also picks up the two oldest rows nobody could answer
  alone: Phase B's "a **new** player can read a price" and Phase C's "name a style after one race".
- **Three games:**
  1. **The opener**, 4 humans + 2 Normal, 1 season, races skipped (~25 min): row 1 by the clock, plus
     eight look-and-feel questions, and the price question asked of a newcomer before anyone explains.
  2. **The long one**, 4 humans + Normal + Hard, 2 seasons (3 if keen), races watched (~80 min): row 2
     by the clock's season-1 minutes, and eight questions on styles, finishes, sabotage, big bets, the
     retirement, the draft, Hard, and whether the best racer won.
  3. **If there is time**, one of: a race to 60,000 (row 4, §14 Q6) or eight humans (row 3).
  - Then five minutes for Jesse alone: six questions (second season, injuries, the cap, the small
    offers, the game-end screen, what next).
- **Why this order** (the prompt's shape, kept, with one argument added): the opener is the teaching
  game, so row 1 is measured pessimistically, but that is the honest number for a new table, and the
  long game then measures play rather than teaching. Swapping them would give row 2 a teaching penalty
  on 20 weekends instead of row 1's 10. Watching is in game 2 only, so the two games' race-day shares
  are also §7.5's split-view evidence (row 24) with no extra game. Eight humans is last and optional
  because it needs eight people and answers one row.
- **How it comes back:** press Copy the report before anything else at each game's end; paste each
  report and the ticked sheet (a photo is fine) into the next Cowork session with "the evening's
  results".

---

## The rules that did not bend

```
$ git diff v3i --stat -- packages/engine/src design/*.xlsx
(nothing)
```

- **Goldens:** `41a8c8b5…` (one season) and `d4bb14c3…` (two seasons), unmoved. `npm test` **51 green**.
- **`SAVE_VERSION` 13, `STATE_VERSION` 13.** A `v3i` save loads: the report reads what the save already
  held. No test was added: the web package has no runner, and the probes are scratch, per the prompt.

### The re-baseline

- `npm test` 51 green; `npm run lint` clean; `npm run build` ✅.
- `season-check`: all seasons played out clean (four humans, two seasons: 217 passes, 0 leaks).
- `hub-clicks`: **9.4** a weekend; the table at 4 humans **10.7** passes, at 8 **22.4**. Unchanged.
- `race-view-check`: 150 races replay clean.
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**

### `npm run harness -- --seasons 50` (per CLAUDE.md)

```
Space Dog Racing harness — 50 seasons, stables: normal, normal, normal, normal, normal, normal, seeds 1…50

End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

  all stables: decisions 7.53 a weekend · entered 2.12 of 3 (band 1.8–2.4: MET) · races/dog 6.64 (band 5–7: MET)
Purse pool: 240,860 posted a season, 47.6% of it reaching a player (v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)
```

Identical to `v3i`'s.

### The acceptance table

| Measure | Target | `v3j` |
|---|---|---|
| The pass screen shows the next human's face | ✅, 4 and 8 humans, 1280 and 390 | ✅ `j-pass-*` |
| A seed link carries picked faces and round-trips them; a `v3i` link parses as before; `hard` is Hard | ✅ | ✅ 3,006 checks |
| A renamed AI's face is keyed by its name, never shared; unrenamed AIs unchanged | ✅ | ✅ 24,800 checks, 6 and 8 stables included |
| "Copy the report": link, table, result, clock, each season's draft; plain text; fails soft | ✅ | ✅ read back from the clipboard; a refused clipboard opens a text box |
| The sheet's current section is one evening, ordered, every open 🎲 row mapped | ✅ | ✅ 27 rows, three games, ≤ 8 questions a game |
| No engine change; goldens; `SAVE_VERSION` 13; tests; lint; `season-check`; build; `asset-check` | ✅ | ✅ all, 288 / 0 / 0 |

## Commits

1. `3b92b55` Show the next human's face on the pass screen.
2. `7f9cda2` Carry the humans' faces in a seed link (and `lib/faces.ts`).
3. `61aa4a0` Key a renamed AI's face by its name, never shared at the table.
4. `9218a17` Add "Copy the report" to the game's end.
5. `862c1f2` Rewrite the playtest checklist as one evening.
6. `a9bb859` Say in the report when a named AI stops the link replaying (not in the prompt's list; see
   Read this first 1).
7. These notes, the prompt (with its correction box), GDD_V3 §10, BUILD_PLAN_V3 Phase J, CANON's `v3j`
   and the sheet's mirror header. Tagged **`v3j`**.

## Screenshots (in `shots/`, not committed)

`j-pass-4h`, `j-pass-8h`, `j-title-link`, `j-renamed-leaderboard`, `j-gameend-copied`,
`j-gameend-fallback`, each at `-1280` and `-390`. No page errors in any of them.

---

## Open questions

1. ❓ **The Title's "What is in this build" panel is stale** (Read this first 2). A two-line copy fix, or
   print `__SDR_BUILD__` there instead. Worth doing before the evening, because newcomers read it.
2. ❓ **Should a seed link carry names?** Only AI names matter (a named AI draws its personality), so a
   `names=` parameter, or dropping the draw so a named AI takes its seat's list personality, would make
   every link replay. The second is an engine change and moves the goldens only if a golden names an
   AI (neither does). Until then: leave AI names blank.
3. ❓ **More human faces**, carried from `v3i` Q1: still eight, one per colour.
4. Carried, untouched: §7.5 / §14 Q5 split view (the evening's clock is the evidence); §14 Q9, the book
   pricing fitness and form; the goldens cannot see betting or humans; online multiplayer.

---

## ⚠️ The v3j checklist, multiple choice

The evening's sheet carries the real questions. This is only about the evening itself.

1. **Did you play the evening?** *Yes, games 1 and 2 · Yes, all three · Only game 1 · Not yet*
2. **Did every game's report come back cleanly?** *Yes, pasted fine · The clipboard said no, the text
   box worked · Something was missing (what?)*
3. **Did the pass screen's face help?** *Yes, people knew it was them · Didn't notice · Too big*
4. **What next?** *Read the evening and decide · Fix the Title panel and the link names first ·
   Something else*
