# V3 Phase F1 build notes: the look — doors and faces (25 September 2026)

**Status: Phase F1 is built and tagged `v3f1`.** It was built in a clone in the cloud and landed in
Jesse's repo folder as a fast-forward. **Nothing is pushed.** The two push commands are near the end
of these notes. Phase E's four 🎲 rows are untouched and still wait for Jesse's table.

F1 is art, drawn as SVG by Claude, the same way as the 142 pieces of 23 September:

- the **54 Explore doors**
- the **22 trainer portraits**
- **eight faces for human stables**, one per saddle-cloth colour
- the Explore screen's layout, fixed for 3:4 doors
- a **prune**: the v2 portraits, the orphaned v2 venue icons, and 203 stand-ins beside finished art
- a small **CI tidy**

No question went to Jesse mid-phase. **No engine change, and neither golden moved**: `packages/engine`
is byte-identical to `v3e2`. All commits are signed.

| | | golden |
|---|---|---|
| `d047918` | CI: `checkout@v7`, `setup-node@v7`, runner pinned to `ubuntu-24.04`; BUILD_PLAN_V3's CI row | unmoved |
| `93fa838` | Doors: Cosmodrome, Ossuary, Blackreach, Collar Prime, Kibbleton, Rustgut; the Explore CSS | unmoved |
| `6a10022` | Doors: Neon Snout, the Drift, Mudhaven, Glassfall, Port Slobber, Vatgrown | unmoved |
| `40b005d` | Doors: Old Wembley, Hushmarket, Sunbleach, Tinkertown, Holy Bark, Lagrange Lows | unmoved |
| `b5411f2` | The 22 trainer portraits | unmoved |
| `e499aa5` | Human stables' faces: eight SVGs, the contract entries, `lib/owners.ts` | unmoved |
| `d94bc3b` | The prune; `ASSET_LIST.md` regenerated | unmoved |
| *(this one)* | Notes, prompt, BUILD_PLAN_V3 Phase F, GDD_V3 §10, CANON | — |

**The goldens:** one season **`8dc05e06…`**, two seasons **`dc357422…`**, both as at `v3e2`.
`npm test` is **47 green**.

---

## ⚠️ Read this first: four things the record should know

1. **The Explore screen was hiding half of every door.** The door box was 3:4 but capped at 260 px, so
   on a desktop each 600×800 picture showed through a 3:2 letterbox and lost its top and bottom quarters.
   On a phone it was a 358×260 strip. The CSS now shows the whole 3:4 where there is room: the height is
   capped at `min(440px, 54vh)`, and where the cap bites it crops from the top, which the contract keeps
   plain. On a phone (≤ 720 px) each door is a row, with the picture on the left (112 px wide, full height)
   and its words beside it, so the three fit on about one screen instead of three tall cards. That is the
   only Explore change: no markup moved.
2. **The prompt's counts were a little off, and the prompt was corrected before commit.** There are
   **67** event-card stand-ins, not 73: 26 of the 93 cards were drawn on 23 September. And `icon-docks`
   and `icon-saloon` were **already out of the contract**: the hotspot list lost the Docks and the Saloon
   in Phase A, so only their two orphaned `.placeholder.svg` files were left. They are deleted.
3. **The five v2 portraits were finished art, and they are gone.** `vet-01`, `vet-02`, `fixer-01`,
   `fixer-02` and `fat-tony` were drawn on 23 September for v2's hireables and the loan shark. Nothing in
   v3 names them: there is no `portrait:` for them in `content/staff.ts`, no `portraitArt()` call for them
   in the web package, and no mention in the engine. So they left the contract and were deleted, as the
   prompt said. They are still in git at `v3e2` if a use turns up. The staff portraits' seed bands
   shifted down five places with them (they are index-based), which matters only to an image model.
4. **`asset-check`'s "Per weekend" does not count the doors.** Every weekend a player sees three doors,
   about 65 kB at their average of 22 kB, before anything else. The figure is `asset-check`'s own
   definition, and F1 was not asked to change that script, so it is left alone and noted here. First
   paint is unaffected: the doors load lazily on the Explore screen.

---

## The acceptance table (BUILD_PLAN_V3 Phase F, F1's rows)

| Measure | Target | `v3f1` |
|---|---|---|
| Explore doors finished | 54 / 54, each under its cap | **54 / 54**, 11–42 kB each (target 60, cap 110) ✅ |
| Staff portraits finished | 22 / 22 | **22 / 22**, 3–9 kB each (target 50, cap 90) ✅ |
| A human stable has a face on the podium and the game-end screen | ✅, keyed by saddle-cloth colour | ✅ `human-01`…`08` by `player.colour` |
| `asset-check` | 0 missing; only event cards left as stand-ins; nothing over cap | **221 finished, 67 stand-ins (all event cards), 0 missing**, nothing over cap ✅ |
| Neither golden moved; `npm test` 47 green; lint clean; `season-check` passes; `npm run build` | ✅ | ✅ |
| CI workflow on current actions, runner pinned | ✅ | ✅ (it runs when Jesse pushes) |
| Screenshots: doors on six planets at desktop and phone width, staff cards on three screens, a game-end with a human winner | ✅ | ✅ below |

### The re-baseline

| | `v3e2` | `v3f1` |
|---|---|---|
| `npm test` | 47 green | **47 green** |
| `npm run lint` | clean | **clean** |
| `season-check` | passes | **passes**: two four-human games, 0 leaks, identical figures (217 passes / 20 weekends; 135 / 12) |
| `hub-clicks` | 9.4 · 10.7 / 22.4 passes at the table | **9.4 · 10.7 / 22.4** (unchanged) |
| `race-view-check` | — | 150 races, each replays the same way twice |
| `npm run build` | ✅ | ✅ |

### `asset-check`, before → after

Both measured on a fresh build (`v3e2` was rebuilt in a worktree for its column).

| | `v3e2` | `v3f1` |
|---|---|---|
| Contract entries | 285 | **288** (+8 human faces, −5 v2 portraits) |
| Finished | 142 | **221** |
| Stand-ins still showing | 143 | **67** (every one an event card) |
| Stand-ins beside finished art | 132 | **0** |
| Files under `src/assets` | 432 | **301** |
| On disk under `src/assets` | 4.54 MB | **5.45 MB** |
| Bundle | 467.7 kB JS + 36.4 kB CSS (162.4 kB gz) | **453.3 kB JS + 36.8 kB CSS (160.2 kB gz)**: the glob maps list 215 fewer files |
| First paint | 700.0 kB | **686.0 kB** |
| Per weekend | 149.3 kB | 149.3 kB (doors not counted: see Read this first 4) |
| Whole library | 4.26 MB | **5.36 MB** |
| Whole site | 4.79 MB | **5.89 MB** |
| At the targets / at the caps | 19.84 / 36.22 MB | 19.98 / 36.48 MB |

---

## The build, item by item

### 0. The CI tidy

- `actions/checkout@v4` → **`@v7`** and `actions/setup-node@v4` → **`@v7`**: the current majors (checked
  against both repositories' tags; both run on `node24`). v7 of each is an ESM migration and, for checkout,
  a refusal to check out fork code under `pull_request_target`, which this workflow does not use. The
  Node 20/22/24 test matrix is unchanged.
- **The runner is pinned** to `ubuntu-24.04`. `ubuntu-latest` moves to Ubuntu 26 on 19 October 2026, and
  the goldens should not move because an image did. The comment on the line says so. To undo it, put
  `ubuntu-latest` back.
- **The correction:** `BUILD_PLAN_V3.md`'s Phase E table said CI was "**not checked**". It now reads
  "3/3 green (Jesse checked the Actions tab after the `v3e2` push)". `V3_PHASE_E2_NOTES.md` is write-once
  and still says what it said. This paragraph is the record of the correction.

### 1. The 54 Explore doors

**The family rule: one silhouette per category, dressed per planet.** A player should tell the five apart
at a glance on any planet, and the three doors of a planet should read as one set.

| Category | The silhouette (the same on every planet) |
|---|---|
| **Pound** | a gabled kennel house with a **vet's cross** in a roundel over an arched half-door, a dog looking over it, **wire runs** either side with a dog in each, a **paw sign** on a bracket, bowls out front |
| **Bar** | a frontage with the **door propped open**, warm light pouring onto the street, a lit window of drinkers, **smoke** out of the door and the chimney, a picture sign over a canopy, a barrel |
| **Back Alley** | two walls closing in, **a single bulb** and its cone of light, **crates** and a bin, a steaming grate, eyes in the dark, a glimpse of the planet over the far wall |
| **Strip** | a **bulb-ringed marquee** with a neon picture, a striped awning, an open shopfront with a counter **piled with money**, a neon frame, a hustler either side, bills in the gutter |
| **Track** | a **grandstand** with a crowd and pennants, the far straight, a **white rail**, a chequered **gate** with its leaves swung open, a **stopwatch** clock on a pole |

**What each planet brings:** its sky and ground (the ground texture is the planet's: cobbles, bone
dust, deck plates, neon-wet asphalt, mud, snow, a dock with hazard tape, lab tiles, turf, sand, grating,
flagstones), its wall material (brick, bone-stone, hull panels, planks, corrugated iron, ice blocks,
adobe), **its two accents**, a skyline behind (brass domes, rib arches, the black hole, towers, silos and a
windmill, a pithead, casino blocks, drifting hulks, swamp trees, the aurora, cranes, specimen jars, the
twin towers under the dome, onion domes, twin suns, gears and smokestacks, a bell tower, stacked
shacks), and props in front (banners, candles, hay bales and kibble sacks, a mine cart, chips and cards,
glowbugs, icicles and snow, a bollard, lamp posts, spice heaps, a cactus, a robot, the Good Boy's
shrine, drips). The bar sign and the strip sign are the planet's own picture: a medal, a canary, an
anchor, a teacup, a drop; a bone and coins, an hourglass, dice, a marrow, a wrench, bottles, jars, a
lamp, a gear. **No letters anywhere.**

**How they were drawn and checked:** a scratch generator (in the build container, not the repo) writes
each door from its planet's palette and props; each file stands alone. Sheets of all 54 were read, then
each planet was read **on the Explore screen**: all 18 at 1280×800, and six (one per backdrop
arrangement) at 390 wide. Things fixed along the way: Blackreach's black hole was hidden behind the
buildings and moved up into the sky; Ossuary's rib arches were raised so they show over every door;
smoke puffs were redrawn as outlined clouds; the alley's far end was opened so each planet's skyline
shows through; Kibbleton's windmill and Rustgut's pithead were moved clear of the paw sign.

### 2. The 22 trainer portraits

Each is briefed by its row's `looks` line and says what the trainer does: the vets carry bags,
bandages, splints or a stained coat; the spies carry notebooks, cocktails and cards; the drillers carry
whistles and a megaphone; the money trainers carry a cheque, an abacus or a monocle. They are 512×512
busts on a transparent ground, in the owners' outline weight and palette. Readability was checked at
the card's 84 px on **the Kennels** (two trainers), **the Bar's offer** (seed 1: Dr Quillon, with Duchess
Vell and Doc Rumbold as the two you would let go) and **the off-season's candidate** (seed 1: Brother
Anselm, after Doc Rumbold's notice).

### 3. Faces for human stables

- **`human-01` … `human-08`**, one per saddle-cloth colour in `STABLE_COLOURS` order. Each wears its
  colour where it reads: a red bandana, a blue scarf, a white silk scarf, a black studded headband, an
  orange neckerchief, a lime headband, a yellow scarf, a pink headscarf. They are someone you would want
  to be: a goggled pilot, an antennaed grinner, an old captain, a punk, a lizard in a backwards cap, a
  hotshot, a one-eyed flat cap, a glamorous old hand. A black scarf on a charcoal ground is the hard
  case, so the colour bands carry a lighter stitched edge.
- **The contract:** eight entries in `scripts/assets.ts` (`HUMAN_BRIEFS`, seed band 9300–9699, clear of
  the UI's 9000–9219), briefed like the owners plus the colour. `ASSET_LIST.md` is regenerated.
- **`lib/owners.ts`:** `humanFaceFor()` maps a human to `human-NN` by `player.colour`, and
  `ownerArtFor()` uses it. `ownerIndexFor()` still returns null for a human, and `ownerLine()` stays null
  (a human has no personality line). Nothing in the engine or the setup changed.
- **A side effect worth knowing:** `OwnerFace` also draws the small chip in the leaderboard and results
  tables. A human now gets that chip there too, the same as an AI.
- Checked on a **four-human, one-season game-end** (seed 2): Human 2 (blue) wins on 66,465, Human 1
  (red) is second, and Captain Blort (AI) is third. Both the winner card and the podium show the faces.

### 4. The prune

- `vet-01`, `vet-02`, `fixer-01`, `fixer-02`, `fat-tony`: out of the contract, and their finished SVGs
  and stand-ins deleted. See Read this first 3.
- `ui/icon-docks`, `ui/icon-saloon`: two orphaned stand-ins deleted. See Read this first 2.
- `npm run asset-check -- --prune`: **203** stand-ins deleted (132 at `v3e2`, plus the 76 this phase
  finished, less the five v2 portraits whose stand-ins were deleted by hand).
- The portraits group's blurb now describes what is in it.

---

## Screenshots

From `vite preview` of the build, with saves generated headlessly by `table-walk` (the seed and the log
at the chosen screen go into `sdr.save.v1`, then Resume). The files are in the session outputs:

- **`v3f1-explore-<planet>-1280.png`** and **`-390.png`** for Cosmodrome (terraces), Ossuary (canyon),
  Blackreach (gantry), Collar Prime (strip), Kibbleton (arc) and the Drift (ring).
- **`v3f1-staff-kennels.png`**, **`v3f1-staff-bar-offer.png`**, **`v3f1-staff-offseason.png`**.
- **`v3f1-game-end-human-winner.png`** (the whole page) and **`v3f1-podium.png`** (its top).

---

## To push

Landed in your folder as a fast-forward from `352c6b7` (`v3e2`), the `main` that `git ls-remote origin`
reported. Your tree was clean before and after, and there is no `index.lock`. **`package-lock.json` is
untouched**, and so is the spreadsheet. A `v3e2` save still loads (no state or save version moved).

```
git push origin main
git push origin v3f1
```

- **The push runs CI on the new actions and the pinned runner** for the first time. If a leg fails, look
  at that before anything else.
- **Design documents changed** and are synced to the claude.ai Project:
  - `BUILD_PLAN_V3.md`: Phase F, and Phase E's CI row
  - `GDD_V3.md`: a note in §10
  - `CANON.md`: the `v3f1` tag
  - `design/ASSET_LIST.md` (not mirrored): regenerated

---

## ⚠️ The v3f1 checklist: the look, multiple choice

Play a weekend or two on a few planets, on a laptop and on a phone.

1. **Do the doors read as their category at a glance?** *Yes, all five · Mostly, but one category is
   hard to tell (which?) · No, I read the label first*
2. **Does each planet's set of three feel like that planet?** *Yes · Most do, a few feel generic (which?)
   · They all feel the same*
3. **Do the trainers look like what they do?** *Yes · Mostly (which one doesn't?) · Not really*
4. **Do the human faces feel like yours?** *Yes, I'd pick my colour for its face · They're fine · I'd
   rather choose my own face (see Open questions 1)*
5. **Should the event cards be next, and in what order?** *Yes, the cards players see most first · Yes,
   planet by planet · Yes, by door (Pound, Bar, Alley, Strip, Track) · Not yet, something else first*

---

## Open questions and carried forward

1. ❓ **Should a human pick their face on the Title screen?** Not built: keying by colour is the whole of
   F1. Picking would be a UI-only choice (eight faces, or all twenty), but it would have to live in the
   save's setup or `ui` block so a resumed game keeps it, and two humans could then pick the same face.
2. **The 67 event cards** are F2's.
3. **"Per weekend" in `asset-check`** could count the three doors a weekend shows (Read this first 4).
4. **Phase E's four 🎲 rows** are unchanged and still wait for the table.
5. Carried from E2, untouched: merging each human's door into their market sitting; the long game
   widening; a table's last-weekend bet slips; Hard 49.9%; §7.5's split view.
