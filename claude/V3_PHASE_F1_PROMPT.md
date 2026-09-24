# V3 Phase F1: the look — doors and faces

> *Corrected before commit, as `design/CANON.md` allows. The draft said 73 event-card stand-ins (there
> are **67**: 26 of the 93 cards were drawn on 23 September), and it told the builder to take
> `icon-docks` and `icon-saloon` out of `scripts/assets.ts` (they were **already out** of the contract
> since Phase A; only their two orphaned stand-ins were left). Both are fixed below. Everything else is
> as Jesse's session wrote it.*

Phase E is built (`v3e2`, pushed). Its four 🎲 rows are still open, waiting for Jesse's table. This
phase does not touch them. It is not in `BUILD_PLAN_V3.md` yet, so part of the job is adding it.

**F1 is art.** Every screen a player sees each weekend should look finished. The art contract
(`design/ASSET_LIST.md`) lists 285 files: 142 are finished and 143 are still stand-ins. What is left:

| Group | Stand-ins | Seen |
|---|---|---|
| **Explore doors** | **54** (all of them) | every weekend, by every player, before anything else |
| **Staff portraits** (`staff-<id>`) | **22** | on every trainer card, in the Bar's offers and in the off-season |
| **Human owners' faces** | not in the contract yet | the game-end winner and the podium show "OWNER PORTRAIT" for a human |
| Event cards | 67 | behind the doors. **Not this phase** |
| UI (`icon-docks`, `icon-saloon`) | 2 orphaned stand-ins, not in the contract | v2 venues that no longer exist. Delete, don't draw |

**Jesse's calls, asked before this prompt was written:**

- **Claude draws the art as SVG**, as it did for the 142 finished pieces on 23 September: backdrops,
  grounds, surfaces, dogs, UI furniture and the twelve AI owners. No image models, and no outside
  tools.
- **First the doors, then the portraits.** The event cards come in a later session.
- **The existing art is fine: fill the gaps.** Do not redraw finished pieces.
- **The pass-merge question is left alone** (Explore stays its own round).
- **Include the small CI tidy** (item 0 below).

## ⚠️ First: the mechanics. They are E2's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **47 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **142 finished, 143 still a stand-in, 0 missing**
- **Commits:**
  - Set `git config user.name "Claude"` and `user.email "noreply@anthropic.com"`.
  - Commits are signed. Check for a `gpgsig` header with `git cat-file -p HEAD | head -6`, and keep
    every commit signed.
- **Jesse's repo folder is connected:** `C:\Users\jesse\Documents\CoWork\dog racing game`, mounted in
  `device_bash` at `$HOME/mnt/dog racing game`. You land the work in it; Jesse only pushes.
  1. **At the start of the session**, call `device_request_delete_permission` once for that folder.
     Give this reason: *so git can clear its own `.git/index.lock` when I fast-forward your repo.*
     Delete nothing else there, ever.
  2. **Before landing**, run `git ls-remote origin` from the container. Then, in his folder, run
     `git --no-optional-locks status --porcelain` (expect nothing) and `git log --oneline -1`. Build
     the bundle to fast-forward from whatever his `main` actually is. If his tree is dirty or his
     `main` is not what you expect, stop and ask. Do not reset anything.
  3. **Land it:**
     1. `git bundle create` in the container.
     2. `device_commit_files` the bundle into his folder.
     3. In `device_bash`: `git fetch <bundle> main:refs/heads/work` plus the tag, then
        `git merge --ff-only work`, `git branch -d work`, and `rm <bundle>`.
     4. Check the tree is clean and no `index.lock` is left.
  4. **You cannot push.** Pushing deploys to Cloudflare Pages, and that is Jesse's call. End by
     giving him the two push commands. (A stop hook will say there are unpushed commits. That is
     expected: say so and do not push.)
  5. **Never run `npm` in his folder.** Its `node_modules` holds Windows builds. Build and test in the
     container.
- **Keep scratch out of the repo.** Put screenshots and probes in `shots/`, and add that to
  `.git/info/exclude`. Stage paths, not `-A`.
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then run `npm run snapshot`. **`v3e2` is the tag to fall back to** (`352c6b7`, pushed). **The golden
digests:**

- one season: **`8dc05e06…`**
- two seasons: **`dc357422…`**

**Nothing in this phase may move either one.** Art is data the engine never reads. If a golden moves,
something is wrong: stop and find it.

**CI is green.** Jesse checked the Actions tab after the `v3e2` push: 3/3 jobs passed on Node 20, 22
and 24. It showed two kinds of annotation:

- "Node.js 20 is deprecated … `actions/checkout@v4`, `actions/setup-node@v4`"
- "`ubuntu-latest` will migrate to Ubuntu 26 on October 19, 2026"

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. `design/ASSET_LIST.md`:
   - "How dropping art in works"
   - "The locked style" and the base palette
   - the **Explore doors** section (54 entries: 600×800, target 60 kB, cap 110 kB, a per-planet prompt
     and the negative prompt)
   - the **Character portraits** section (512×512 with alpha, target 50 kB, cap 90 kB)
3. `packages/web/scripts/assets.ts`. It generates `ASSET_LIST.md`: edit it, never the markdown, then
   run `npm run asset-list`.
4. `packages/web/src/lib/assets.ts` (the resolver: `.webp`, then `.svg`, then the stand-in) and
   `lib/owners.ts`.
5. `packages/web/src/screens/Explore.tsx` and the `.door*` rules in `theme/app.css`. This is where a
   door is drawn, and at what size.
6. `packages/web/src/components/StaffCard.tsx` and `components/Owner.tsx` (`OwnerFace`).
7. `packages/engine/src/content/staff.ts` (each trainer's `looks` line is their brief) and
   `packages/engine/src/content/planets.ts` (each planet's `exploreDoors`, its names, blurbs and
   accents).
8. **Look at the finished art before drawing anything new.** Open a few in a browser and screenshot
   them:
   - backdrops: `planets/*/backdrop.svg`
   - owners: `portraits/owner-02…12.svg`
   - dogs: `dogs/bodies/*.svg`
   - UI: `ui/plate.svg`

   The new pieces must sit beside these as one set: chunky black outlines, flat cel shading, the
   planet's two accents, and 1990s PC-game grime. The commit messages from 23 September
   (`07d6488`, `849199a`, `54d8d81`) describe how those were drawn and checked.

## BUILD THIS SESSION

### 0. The CI tidy (one small commit, first)

- `.github/workflows/ci.yml`: bump `actions/checkout` and `actions/setup-node` to the current major
  version that runs on Node 24. Check which version that is. Leave the Node 20/22/24 test matrix
  alone.
- Pin the runner to `ubuntu-24.04` instead of `ubuntu-latest`, so the October migration cannot move
  CI underneath the game. Say in the commit that it is a pin, and how to undo it.
- In `design/BUILD_PLAN_V3.md`, Phase E's status table says CI was "**not checked**". Correct it to
  "3/3 green (Jesse checked the Actions tab after the `v3e2` push)". `claude/V3_PHASE_E2_NOTES.md` is
  write-once and stays as it is; this phase's notes record the correction.

### 1. The 54 Explore doors

- One SVG per entry, at exactly the path the contract gives (`src/assets/doors/<planet>-<category>.svg`),
  `width="600" height="800"` on the root, under the cap.
- **Each door is that planet's own Pound, Bar, Back Alley, Strip or Track**, named on the row: "The
  Imperial Paddock", not "a track". The planet's two accents and its vibe are in the brief. A player
  should be able to tell the five categories apart at a glance, on every planet:
  - the Pound: kennels, cages, a vet's cross
  - the Bar: a doorway with light and smoke
  - the Back Alley: dark, a single bulb, crates
  - the Strip: neon and money
  - the Track: a rail, a gate, a stand

  **Give each category one shared silhouette, and dress it per planet.** That is the family rule that
  keeps 54 pieces coherent, and it is how the backdrops share their six arrangements.
- **No readable text** in the art (the contract's negative prompt): the door's name is on the screen
  under it.
- **Check them where they are seen.** Screenshot the Explore screen on at least six planets, one of
  each backdrop arrangement, at 1280 wide and at 390 wide (a phone). The three doors of a planet must
  read as a set.
- If the Explore screen's layout fights the art (cropping, aspect, the hatched stand-in styling left
  behind), fix the CSS. That is UI, and it is in scope.

### 2. The 22 staff portraits

- `portraits/staff-<id>.svg`, 512×512 with alpha, one per trainer the engine can deal or offer. Each is
  briefed by its row's `looks` line in `content/staff.ts`. `trainer-01` and `trainer-02` are reused
  for two rows and are already drawn.
- They sit on the **StaffCard** (Kennels, the Bar's offer, the off-season's candidate and leavers).
  Check all three screens in a build.
- Same rules as the twelve owners: a bust on a transparent ground, readable at the card's size. Each
  should say what they do: a vet looks like a vet, a fixer-type looks like trouble.

### 3. Faces for human stables

**The gap:** a human stable has no face. `ownerIndexFor` returns null for a human, so the game-end
winner and the podium show a hatched "OWNER PORTRAIT" slot whenever a human places. At a hotseat
table that is every game.

- **Draw eight human-owner portraits**, `portraits/human-01.svg` … `human-08.svg`, one per saddle-cloth
  colour (`STABLE_COLOURS` has eight). They are the players' own avatars, so each should read as a
  person you would want to be, in the same style as the AI owners: grimy, quirky, not a villain.
  **Put a band or scarf in the saddle-cloth colour on each**, so the face and the swatch agree.
- **Add the eight to the contract** in `scripts/assets.ts`, briefed like the owners, and regenerate
  `ASSET_LIST.md`.
- **`lib/owners.ts`:** a human's face is `human-NN`, keyed by `player.colour` (UI only; nothing in
  the engine or the setup changes). Humans have no personality line, so `ownerLine` stays null for
  them.
- ❓ If a way for a human to **pick** their face on the Title screen seems worth it, do not build it:
  note it in the notes as a question for Jesse. Keying by colour is the whole of this phase.

### 4. Prune what v3 no longer uses

- `ui/icon-docks` and `ui/icon-saloon` are v2 venues, and the contract already dropped them in Phase A
  (the hotspot list lost the Docks and the Saloon). Delete their two orphaned stand-ins.
- **Check the portrait entries too.** `fat-tony`, `fixer-01/02` and `vet-01/02` were drawn for v2's
  hireables and the loan shark. Find out whether any v3 code or content row still names them (grep
  `portrait:` in `content/staff.ts`, and `portraitArt(` in the web package):
  - If nothing does, drop them from the contract and delete the files.
  - If something does, keep them and say which row uses them.
- Run `npm run asset-check -- --prune` for the stand-ins that sit beside finished art (132 at
  `v3e2`).
- The totals in `ASSET_LIST.md` regenerate. Report the before and after of the file count and the
  library weight.

## RULES THAT DO NOT BEND

- **No engine change.** `packages/engine` is not touched, apart from reading it. Neither golden moves.
  `npm test` stays 47 green.
- **Art is data:** no code change is needed to drop a file in (the glob resolver). The only code
  changes this phase makes are:
  - `lib/owners.ts` (the human faces)
  - Explore's CSS, if the art needs it
  - the contract script
- **Each file:**
  - SVG, with `width`/`height` on the root set to the entry's size
  - under its cap. Aim for the target, and run `npm run asset-check` after every batch
  - no external references: no `<image href="http…">`, no web fonts, no `<script>`
  - no readable text in the art
- **The locked style** (ASSET_LIST "The locked style") and **the planet's two accents**, which are in
  every brief. No real people's likeness, no gore.
- **Format only what you edit.** `design/*.md` is outside the format globs. `ASSET_LIST.md` is
  generated.
- **Commit small, in batches of one planet family or one group**, each saying how many files and what
  `asset-check` reads.

## The commit discipline, in this order

1. The CI tidy and the BUILD_PLAN_V3 CI row.
2. Doors: one commit per six planets (three commits), each checked on the Explore screen.
3. The staff portraits (one or two commits).
4. The human faces: the contract entries, the eight SVGs and `lib/owners.ts`.
5. The prune: contract entries, stand-ins and `ASSET_LIST.md` regenerated.
6. Notes, prompt and design docs (below). Tag `v3f1` on it.

## DONE WHEN

| Measure | Target |
|---|---|
| Explore doors finished | 54 / 54, each under its cap |
| Staff portraits finished | 22 / 22 |
| A human stable has a face on the podium and the game-end screen | ✅, keyed by saddle-cloth colour |
| `asset-check` | 0 missing; the only stand-ins left are event cards; nothing over cap |
| Neither golden moved; `npm test` 47 green; lint clean; `season-check` passes; `npm run build` → `packages/web/dist` | ✅ |
| CI workflow on current actions, runner pinned | ✅ (it runs when Jesse pushes) |
| Screenshots of the doors (six planets, desktop and phone), the staff cards on three screens, and a game-end with a human winner | ✅ |

## Then, in order

1. **Re-baseline:**
   - `npm test`, `npm run lint`, `npm run build`
   - `season-check`, `hub-clicks` (unchanged: 9.4, and 10.7 / 22.4 passes at the table)
   - `race-view-check`
   - `npm run asset-check`, with before → after of finished, stand-ins, first paint, per weekend and
     the whole library
2. **Serve the build and screenshot:**
   - Explore on six planets, one of each arrangement, at 1280 and at 390 wide
   - the Kennels with two trainers
   - the Bar's trainer offer, if a seed produces one (find one headlessly)
   - the off-season's candidate
   - a four-human game-end won by a human, and its podium

   Build the screenshots from saves generated headlessly: `packages/web/scripts/table-walk.ts`'s
   `onScreen` hook receives the log, and E2's notes say how the saves were made.
3. `npm run snapshot`, then `git tag v3f1` on the notes commit.
4. **Write `claude/V3_PHASE_F1_NOTES.md`** in the style of the E2 notes: what was drawn, the family
   rules for the doors, the asset-check before → after, the CI correction, anything pruned and why,
   and open questions. End with a **short** multiple-choice `v3f1` checklist for Jesse:
   - do the doors read as their category at a glance
   - does each planet's set feel like that planet
   - do the trainers look like what they do
   - do the human faces feel like yours
   - should the event cards be next, and in what order
5. **Update the design docs:**
   - `design/BUILD_PLAN_V3.md`: add **Phase F — the look** after Phase E, with F1's status (doors,
     staff and human faces done; the 67 event cards to come) and its acceptance rows
   - `design/GDD_V3.md` §10: a one-line inline note that human stables have faces keyed by
     saddle-cloth colour
   - `design/CANON.md`: the `v3f1` tag
6. Commit this prompt as `claude/V3_PHASE_F1_PROMPT.md`, corrected before commit where it was wrong.
7. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3f1`. Sync the changed `design/*.md` and the new
   `claude/` notes and prompt to the claude.ai Project with `project_write`, and update each status
   header's `last synced`.
