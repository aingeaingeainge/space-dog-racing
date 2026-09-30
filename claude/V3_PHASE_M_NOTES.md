# V3 Phase M notes: four small fixes before the evening (30 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3m`**. The fallback is `v3l3` (`e2922c5`).

**In one line:** the four things a newcomer would trip over on the evening are fixed, all in
`packages/web`. The Title's build panel is true and names the build. A seed link from a table that named
an AI replays that game. A door's art stays in its column on a phone. The final standings read at 390.
`npm run hotseat-shots` takes the comparison screenshots the same way every time. Nothing under
`packages/engine` or `packages/server/src` changed, and every hotseat difference against `v3l3` is one of
the four.

The prompt is `claude/V3_PHASE_M_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: three things the record should know

1. **`browser-walk` was flaky on a fresh clone of `v3l3`, and is fixed in its own commit.** It passed
   1 run in 4 (two of them alone on the machine). The fault was in the walk, not the game: it looked at a
   button, the room moved that browser's screen, and the click (or the waiting line's text) waited 30 s
   for something that had gone. Asked, Jesse chose to keep a fix and carry on. Inside the weekend loop
   a missed press now times out in 5 s and is looked at again; a real hang is still "the table stalled".
   After the fix: 4 of 4 runs in a row, and the re-baseline run, all "All 7 rows pass."
2. **A listed AI name typed in also rides in the link.** The prompt said a listed name needs no
   `names=` entry. It does: typed into seat 3, "Baroness Vex" takes Vex's personality, where a blank
   seat 3 would have been dealt a different name and personality from the shuffle. So `names=` is
   written whenever an AI row carries a name the table typed (a played setup holds `''` for a blank
   row). Human names stay out: they touch no draw, and keeping them out keeps people's names out of
   links they share.
3. **J's 3,006-check probe was scratch and is not in the repo**, so it was rebuilt to the same shape
   (1, 4 and 8 humans × picks or not × 200 random tables, plus hand links) and run against `v3l3`'s own
   `seedLink.ts` and `faces.ts`, read out of git. Every link from a table with no named AI is character
   for character `v3l3`'s, and every old link parses as `v3l3`'s parser does.

---

## What changed, fix by fix

Screenshots are `shots/before/png/` (the `v3l3` build) and `shots/after/png/` (this build), from
`npm run hotseat-shots`. Not in the repo.

### 0. `hotseat-shots` (`e85abf5`)

- `packages/server/scripts/hotseat-shots.ts`, run as `npm run hotseat-shots -- <dist> <outDir>` from
  the root (paths are read from where npm was run). It serves the build with Node's own `http`, installs
  a fixed `Math.random` (an init script) and pins `Date.now` (`page.clock.setFixedTime`, timers still
  run), and takes full-page PNGs at 1280 and 390 with animations off:
  `00-title`, `01-arrival` / `02-explore` / `03-hub-after-door` (seed 42, two humans, from a seed link;
  the hub reads the door back with its card up over it), `04-explore-wrap` (seed 4: Hushmarket), and
  `05-game-over` (seed 7, one human and one AI, a race to 1 Bone).
- **Deterministic:** run twice on the `v3l3` build, then twice on this one: identical bytes, all 12
  PNGs, both times.

### 1. The Title's panel (`599550d`)

- "What is in this build" now says: one to five ten-week seasons or a race to a target, Easy / Normal /
  Hard stables, three dealt dogs, Explore's three doors, the six-food market that is also training,
  trainers on commission, three purse tiers and the Bookie, an off-season between seasons, every planet
  painted. No art counts, no phase letters. Its sub-title is **`build <__SDR_BUILD__> — the game's
  shape`**, so it never needs editing for a version again (the pushed tag reads `build v3m`).
- Screenshots: **`00-title-1280/390`** (the only 1280 PNG that differs).

### 2. A seed link carries the AI names (`191f1ef`)

- `seasonLinkFor` appends `&names=` when an AI row has a typed name: one entry a stable, in seat order,
  each `encodeURIComponent`-ed and empty where none is needed, written by hand after the other
  parameters so a comma in a name cannot split it: `…&names=,Gravy%20Train,,`.
- `parseSeasonLink` reads it from the raw query (so `%2C` stays inside its name), matches entries by
  their place in `players=` (a dropped token does not shift them), and applies them to AI rows only. A
  `names=` that will not decode, has more than 8 entries, or holds a name over 100 characters is
  ignored whole. A link without it parses exactly as before.
- `lib/report.ts`: the "A link carries no names, so it opens a different game" note is gone; nothing
  else in the report moved.
- **The probe** (`shots/probe-names.ts`), **7,515 checks, 0 failures:**
  - **Seed 99, "Gravy Train"** (J's example; a human, Gravy Train Normal, a blank Normal, a blank
    Hard): played headless with `decide` in every seat, 481 actions, state hash `61c78952…`. The link
    (`?seed=99&players=h%2Cnormal%2Cnormal%2Chard&names=,Gravy%20Train,,`) parsed and started as the
    Title does, the same log replayed: `61c78952…`. A fresh headless game from the link plays the same
    481 actions. `v3l3`'s link for the same table replays differently.
  - **300 seeds × 0–3 named AIs** (1,200 tables of 2–8 stables, random kinds, difficulties, picks,
    lengths and toggles; names with commas, `%`, `+`, `#`, `’`, an emoji, 40 characters, list names):
    link → parse → Start gives the same `SeasonSetup`, the same `createSeason` state, and the same faces
    (`aiOwnerIndices`); `names=` appears exactly when an AI was named; with none named, the link is
    `v3l3`'s character for character.
  - **J's probe, rebuilt** (1,200 tables): every link identical to `v3l3`'s and parsed identically; ten
    hand links (the `v3i`/`v3j` ones, junk, `h0`/`h9`/`hx`, an empty, broken, over-long or over-full
    `names=`) parse as `v3l3`'s parser does.
- The online walks never see `names=`: the room's AI rows are always unnamed (`room.ts`), so an online
  report's link is unchanged.

### 3. The door card on a phone (`6e377a2`)

- In the 720 px block the art held `aspect-ratio: 3 / 4` while stretching to the row, so a door whose
  words ran taller grew art wider than its 112 px column, over the words. It now has `aspect-ratio:
  auto`: the column sets the width, the row the height, and `object-fit: cover` crops.
- **Checked on every planet** (`shots/probe-doors.ts`): the 14 planets that can open a season on a real
  Explore (a seed each), and all 18 planets' door names and blurbs written into one, at 390, 360 and
  720. Art over the words or out of the card: **134 of 288 at `v3l3`, 0 now** (it was far more than the
  two doors named: at 360 nearly every door). At 1280 the 14 real Explores are **byte-identical PNGs**.
- Screenshots: **`02-explore-390`**, **`04-explore-wrap-390`** (The Fence's Parlour), and
  `shots/doors-before|after/real-<planet>-390.png`.

### 4. The final standings on a phone (`d2db1eb`)

- Why: at 390 the table (768 px) scrolls inside its panel, and its one wrapping cell, the trainers line,
  was squeezed to its longest word (86 px), so the rows stood **181 and 237 px** tall. Below 760 px that
  cell (`table.final-standings td.wrap`) now has a 260 px minimum: **68 and 86 px**. At 1280 the cell is
  366 px already and nothing moves.
- Screenshots: **`05-game-over-390`**.

---

## The rules that did not bend

```
$ git diff v3l3 --stat -- packages/engine packages/server/src
(empty)
```

- **Goldens** `41a8c8b5…` / `d4bb14c3…` unmoved; `npm test` **184 green**. `SAVE_VERSION` **13**,
  `STATE_VERSION` **13**, `PROTOCOL_VERSION` **1**.
- **Hotseat against `v3l3`:** `season-check`, `hub-clicks` (9.4; the table walk 10.7 / 22.4, 0 leaks)
  and `race-view-check`, saved to `shots/before/` before any change and compared with `cmp`:
  **identical**. `view-walk` differs only in its elapsed seconds.
- **The screenshots:** of the 12, the five that differ are `00-title-1280`, `00-title-390`,
  `02-explore-390`, `04-explore-wrap-390` and `05-game-over-390` — the Title's panel, door cards at a
  phone width, the standings at a phone width — and nothing else. **Every 1280 PNG but the Title's is
  byte-identical**, as are `01-arrival-390` and `03-hub-after-door-390`.
- **An old link still opens**, and a table with no named AI gets exactly the link it had (above).
- `view-walk` **0 throws**, GalaxyMap **0**. `asset-check` **288 / 0 / 0**. `server:test` **10 green**.
  `online-walk` **25 rows**, `online-table-walk` **10 rows**, `browser-walk` **7 rows**, all green.
- **Pages on Node 20:** a clean clone, `npm ci && npm run build` under Node 20.20.2: passes. No
  dependency added.
- Lint clean, strict TypeScript, no `any`, including `hotseat-shots.ts`. Formatted only what was edited.

### `npm run harness -- --seasons 50`

```
End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

Purse pool: 240,860 posted a season, 47.6% of it reaching a player (v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)
```

Identical to `v3l3`'s: every line of the full output but the elapsed time equals the `v3l3` snapshot
taken at the start.

## Commits

1. `Stop browser-walk failing when the room moves a screen mid-press` (Read this first 1).
2. `Add hotseat-shots, the hotseat screenshots taken the same way every time`.
3. `Rewrite the Title's "What is in this build" panel so it stays true`.
4. `Carry the names the table gave its AIs in a seed link` (the probe's numbers in the message).
5. `Keep a door's art inside its column on a phone`.
6. `Give the final standings' trainers line room on a phone`.
7. `Record Phase M in the checklist, CANON, BUILD_PLAN_V3 and GDD_V3 (M1)`.
8. These notes and the prompt. Tagged **`v3m`**.

---

## Open questions

1. ❓ **L4 or the evening?** Hotseat is ready for the evening on this build, named AIs included.
2. ❓ The Title's shared-link notice still says "faces and all" and not names. The names show in the
   rows; a word in the notice is a one-line change if wanted.
3. Carried, untouched: §5.2 hotseat inside an online room (V28: not yet); §7.5 / §14 Q5 split view;
   §14 Q9; more human faces; the goldens cannot see betting or humans.

---

## ⚠️ The v3m checklist, multiple choice

1. **Next session?** *The evening first (hotseat is ready, named AIs and all) · L4 now, live on
   Cloudflare · Something else*
2. **Did the four fixes look right on your phone?** *Yes · The doors still look off (which planet?) ·
   The standings still look off*
3. **The Title panel's wording:** *Fine as it is · Shorter · Say more about online*
