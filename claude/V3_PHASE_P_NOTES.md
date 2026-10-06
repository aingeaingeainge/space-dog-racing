# V3 Phase P notes: pick up and play (7 October 2026)

Worked in Cowork from a clone in the container, landed in Jesse's folder as a bundle and fast-forwarded.
Tag **`v3p`**. The fallback is `v3l4` (`f1ce7f4`).

**In one line:** a new player's first weekend went from **4,392 visible words to 1,692 (−61%)**. The
Title is one **Play** button, the draft has **Pick for me**, the planet's big button names the next step,
and every explanation that left a screen is one press away behind a **"?"**. **No rule moved**, so no
version moved, and `main` can be pushed on any evening.

The prompt is `claude/V3_PHASE_P_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: five things the record should know

1. **No rule, no golden, no version.** Jesse's call (P3). `git diff v3l4 -- packages/engine
   packages/server/src packages/web/src/store package-lock.json` is empty. `STATE_VERSION` 14,
   `SAVE_VERSION` 14, `PROTOCOL_VERSION` 1. A push redeploys the room but ends no live room.
2. **Hotseat reads as at `v3l4`:** `season-check`, `hub-clicks` and `race-view-check` are byte for byte
   as `shots/before/`. The harness matches too, apart from its elapsed time. **`hub-clicks` did not move
   down** (9.5): it counts presses, not screens. "Next: Race Office" is the press the Race Office tab
   was, so nothing it counts changed. Pick for me is not in its count. Used, it makes the opening draft
   **one press instead of twelve**.
3. **The walks needed three script fixes, and the room needed none.** A Title without a seed link has no
   "Start season" until Custom game opens, so `hotseat-shots` and `browser-walk` now wait for **Play**.
   The hub's big button can read "Next: Race Office", so the walks accept either label. They also find
   the Race Office tab with `exact: true`, because it now sits beside a button that contains its name.
4. **`browser-walk` failed only the known held-"Fly on" row once** in the re-baseline, and passed all 8
   rows alone, as the prompt allows. The first run is in `shots/after/browser-walk-run1.txt`.
5. **The draft is still the wordiest screen** (1,480 → 1,163 words, 11.9 phone screens). Its board
   is 25 dogs and 18 trainers, and the cards are the decision. Pick for me is what makes it quick, not
   fewer words. If Jesse wants it shorter still, the next lever is the trainers' cards (blurb and
   bonus lines).

---

## Jesse's calls (GDD_V3 §13)

Asked one at a time, recommendation first, after the plan and three before/after mocks (title, hub, Race
Office: the real build with elements hidden in the browser).

| | The question | Picked | Not picked |
|---|---|---|---|
| **P1** | What should Play do about the opening draft? | **A "Pick for me" button** (Recommended) | Auto-draft on Play; keep the draft as is |
| **P2** | How guided should the weekend be? | **One "next" button** (Recommended) | A fixed sequence (door → Market → Race Office → Bookie); keep it as it is |
| **P3** | Should any rule change this phase? | **No rule changes** (Recommended) | Propose cuts with their harness cost, then ask |

---

## The ruler: `npm run screen-words`

`packages/server/scripts/screen-words.ts`, next to `hotseat-shots` and driven the same way: a static
server for a build, Playwright, `Math.random` and `Date.now` pinned. It plays a fresh browser's game,
which is the Title's default (one human against five Normal AIs, one season), through the first weekend
and into week 2's doors, then a second game (a race to 1 Bone) to its end. On each screen, at 1280 and
390, it counts:

- **visible words**: rendered text only; a closed `<select>` counts only its chosen option, and a tooltip
  counts nothing
- **controls**
- **panels**
- **screen heights**: page height in viewports, flagged `↔` when the page scrolls sideways

`--png <dir>` writes each screen as a full-page shot. Play keeps the seed the Title rolled when it
opened, so before and after are **the same game**.

### Before → after, screen by screen (1280; phone screens at 390)

| Screen | Words | Controls | Phone screens |
|---|---|---|---|
| Title | **262 → 29** | 32 → 2 | 2.2 → 1.0 |
| Draft | 1,480 → 1,163 | 45 → 48 | 14.6 → 11.9 |
| Explore | 150 → 109 | 8 → 7 | 1.2 → 1.0 |
| **Hub** | **858 → 172** | 17 → 15 | **3.3 → 1.6** |
| Market | 257 → 166 | 39 → 41 | 1.2 → 1.1 |
| Kennels | 464 → 294 | 13 → 14 | 3.3 → 2.9 |
| **Race Office** | 467 → 282 | 12 → 14 | **3.0 ↔ → 2.5** (no sideways scroll) |
| **Bookie** | **748 → 256** | 54 → 17 | **3.7 → 1.7** |
| Race | 87 → 87 | 4 → 4 | 1.0 → 1.0 |
| **Results** | **443 → 148** | 2 → 3 | **2.0 → 1.1** |
| Hub, after the races | 918 → 178 | 17 → 15 | 3.2 → 1.6 |
| Explore, week 2 | 154 → 99 | 8 → 6 | 1.3 → 1.0 |
| Game end | 759 → 632 | 4 → 6 | 4.8 → 4.4 |
| **The weekend** (Explore to the hub after) | **4,392 → 1,692 (−61%)** | 166 → 130 | **21.9 → 14.5** |

The after numbers include the first-game guide's lines, because a new player sees them. A returning
player sees about 20 fewer words a screen.

---

## What was cut, screen by screen

**Kept everywhere:** the jokes (the event cards, the door blurbs, the trainers' one-liners, the
patter), the keyboard shortcuts, and every number a choice turns on.

- **Title**: one big **Play** (you against five Normal AIs, one season), with **Resume season** and
  **Play online** beside it when they apply. Everything else is under **Custom game**: seed, length,
  the roster with faces, toggles and **Start season**. A seed link opens it with its notice. The "What
  is in this build" panel is now a footer line, `build v3p`. The toggles lost "GDD §13", and the length
  picker's stale off-season line ("one retirement, the staff notice") now says "an off-season draft".
- **Draft**: **Pick for me** (P1) makes the rest of this human's picks with `decideDraft(…, 'normal')`,
  through the same `DraftPick` a press makes. It skips the AIs' beat and locks the board ("Picking for
  you…"). It is held per human, so at a hotseat table one human's hand-over is not the next human's.
  The board's cards drop the fitness bar and form line (every dog on the board is 90 and 0), and the
  opening draft drops book value. The pick order shows the round being picked, not all six. The rules
  note is behind a "?".
- **Explore**: the row of door-name buttons under the doors went, since the doors are buttons and keys
  1–3 still work. The "everything comes through a door" note is behind a "?".
- **Hub**: the **Where to?** panel went. It repeated the hotspots and the tab strip, and carried "GDD §4.2
  phase 3 — what is actually in each one this week" and the phase chips. **Turn order** is one line,
  "You go 5th of 6". Behind its "?" are the table, its arithmetic ("20 − 7 crates ÷ 5 + 10 on the die"),
  the track, the food map, the trainers and **This week**'s log, which on week 1 was mostly the draft's
  30 picks. The **signpost** is up only when the rock has a rule or it is a Major, so "No special rules
  on this rock" no longer shows. **The food line** shows only when a dog will go hungry (D34). The
  trainer line went (it is on the Kennels).
- **Tab strip**: the "Keys: H planet hub · M market…" line is behind a "?" on the strip. The always-shut
  **Bookie** tab left the strip, but its hotspot stays. **The big button** (P2) reads "Next: Race
  Office" until every race the stable can fill has a runner, then "Head to the track". Enter does
  whatever the button says.
- **Race Office**: a paragraph and seven bullets became one line, the track in a sentence
  (`trackLine`: "480 m, tight bends: the draw matters.") plus a Major's purses. The rest is behind a "?".
  The ledger lost **If it rests** and **This week**. The run's cost and, once declared, the race now
  share a cell, and the ledger scrolls inside its own box on a phone. "Form" left the runner line, and
  the locals' line is shorter.
- **Bookie**: each race leads with **your own runner**, one line with its win and place prices as
  buttons. The field of eight is behind **Full book**. The three rules notes are behind a "?". One
  "the book does not see…" line a race stays (decision 5). Empty slips are no longer drawn.
- **Results**: by default each race shows the first three and every human's dogs, in four columns
  (place, dog with any injury, stable, how it ran, prize). **Full results** brings back traps, ratings,
  Δ, traits and odds. The trainers' cut is a bracket.
- **Kennels**: the two food-and-fitness paragraphs are behind a "?". Each dog card's **second "resting"
  badge** went (a bug: the week's status was drawn twice). Also gone: the Bar line about trainers and
  the subtitles that restated the panel names.
- **Market**: the table, the hold and **Next stop**. The rest is behind a "?".
- **Game end**: **The clock** panel went into **Copy the report**, which already carried it. The
  ledger's column notes and "Play again"'s paragraph are behind "?"s.
- **Everywhere**: the top bar lost the phase label ("Planet — before the races"), and on a phone the
  game's name. Ticket stubs lost "any dog may enter", which every race has said since v3 (D34);
  `criterionFor` still prints a real criterion. The leaderboard and the off-season panel lost their
  "(GDD §4.3)".
- **Hotseat's arrival**: the names in order on screen, each stable's sum behind a "?". The after-races
  roll-call's note is behind a "?" too.
- **Online**: the board's columns stay inside their panel at ~800 px (L4's open question 5).
- **The first-game guide** (`components/Guide.tsx`): one dashed line on the draft, the doors, the hub
  (before and after the races), the Market, the Race Office and the Bookie. It is stored as seen in
  `localStorage` once shown and left (`sdr.guide.v1`, try/catch, never game state), and **No more tips**
  turns them all off. The first human at a hotseat laptop sees them, and the second does not.
- **The "?"** (`components/More.tsx`): one press opens, one closes.

---

## The pictures

Pairs in the session (and in `shots/`, not in the repo):

- Single player, from `screen-words --png`: `P-title`, `P-hub`, `P-race-office`, `P-bookie`,
  `P-results`, `P-kennels` (1280) and `P-hub-phone` (390).
- Hotseat, from `hotseat-shots`: `01-arrival` (the order without its sums), `03-hub-after-door`,
  `05-game-over` (no clock panel) and `06-draft` (390), before and after. The pass screens, the waiting
  line and the online board read as they did, and the three online walks are green.

---

## The rules that did not bend

- **Determinism, rules, versions**: nothing under `packages/engine` or `packages/server/src` changed.
  Goldens unmoved. `PROTOCOL_VERSION` 1.
- `npm test` **207 green**. Lint clean. Build passes. `season-check` passes. `asset-check` 288 / 0 / 0.
  `view-walk` **0 throws**. `server:test` **15 green**. `online-walk` **All 27 rows pass**.
  `online-table-walk` **All 10 rows pass**. `browser-walk` **All 8 rows pass** (rerun alone; see item 4).
- **Hotseat byte for byte**: `season-check`, `hub-clicks` and `race-view-check` are identical to
  `shots/before/`. The harness matches but for elapsed time (4.5 s → 3.2 s). Harness summary (50 seasons,
  six Normal): end worth mean 55,249 (p10 40,440 · p90 71,159). Income per stable-season: prize 29,490,
  trade 3,100, betting −1,371, costs 8,537. Fitness at declaration 74.7, 13.3% under threshold, 6.3 races
  a dog. Food 25.2% of gross (band 20–35%: MET). Season decided by week 7.3. `hub-clicks` 9.5 a weekend
  (budget ≤ 10: MET).
- **No dependency added** to the web, the root or the server; the root `package-lock.json` is untouched.
  The root `package.json` and the server's gained one script each, `screen-words`.

---

## Open questions

1. **Does a newcomer get going without help?** That is PLAYTEST_CHECKLIST row 33 / question 1.13, the
   one thing this phase can only measure with a person.
2. **The draft's words** (item 5). Fine with Pick for me, or worth a second pass?
3. **Phase O** (N's two misses) is still open, as are the hotseat and online evenings.
4. Seen in passing, not changed: the "the book does not see…" line often names a *local* dog (75
   fitness against a field of 86), which is true but rarely the bet a new player wants. A rule-free
   tweak would be to prefer the player's own dog's line, or none.

---

## The `v3p` checklist (for Jesse)

| | Question | Tick one |
|---|---|---|
| 1 | **Play it on the live site after pushing.** Does it feel pick-up-and-play now? | Yes · Mostly (which screen still feels busy?) · No |
| 2 | **What next?** | The hotseat evening (Recommended) · An online evening · Phase O: the draft's two misses · Another pass at the screens (the draft first) |
