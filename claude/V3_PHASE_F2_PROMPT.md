# V3 Phase F2: the look — the event cards

Phase F1 is built (`v3f1`, pushed, CI green on the new actions and the pinned runner). It drew the 54
Explore doors, the 22 trainer portraits and eight faces for human stables. **F2 finishes the art: the
67 event cards that are still stand-ins.** After F2 the contract has no stand-ins left.

Phase E's four 🎲 rows and F1's checklist are still open and waiting for Jesse's table. This phase
does not touch them.

> **Corrected before commit** (CANON's write-once rule): four places where this prompt was wrong about
> the game are fixed below, each marked *(corrected)*. The notes (`claude/V3_PHASE_F2_NOTES.md`, "Read
> this first") say what the draft said. In short: the trainer offers show **no** card art in the modal;
> the "planet-locked" cards are planet-**weighted** and can turn up anywhere; the prune found six
> orphaned stand-ins as well as the 67; and the opening snapshot was taken at the end.

**Jesse's calls:**

- **Claude draws the cards as SVG**, the same way as the 26 finished cards and everything F1 drew. No
  image models, and no outside tools.
- **The existing art is fine: fill the gaps.** Do not redraw the 26 finished cards, the doors or
  anything else that is finished.
- **The order is door by door, biggest group first:** Bar (18), Back Alley (16), Pound (15), Track
  (10), Strip (8). One commit per door.
- **No rule changes.** Leave the pass-merge question and the human face picker alone.

## ⚠️ First: the mechanics. They are F1's, and they worked.

- **Build in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`.
  2. Check all four before touching anything. If any fails on a fresh clone, stop and say so.
     - `npm test` is **47 green**
     - `npm run lint` is clean
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **221 finished, 67 still a stand-in, 0 missing**
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
- **Keep scratch out of the repo.** Put screenshots, probes and any drawing script you write in
  `shots/`, and add that to `.git/info/exclude`. Stage paths, not `-A`. (F1's generator was scratch and
  was not kept. The finished files are the reference, not a script.)
- Jesse is in Cowork, not at a terminal. Ask one clear question at a time and stop.

Then run `npm run snapshot`. *(corrected: F2 took it at the end, on the notes commit; `v3f1` is the
fallback either way.)* **`v3f1` is the tag to fall back to** (`46aaf6a`, pushed). **The golden
digests, unchanged since `v3e2`:**

- one season: **`8dc05e06…`**
- two seasons: **`dc357422…`**

**Nothing in this phase may move either one.** Art is data the engine never reads. If a golden moves,
something is wrong: stop and find it.

## Read, in this order

1. `CLAUDE.md`, then `design/CANON.md`.
2. **`claude/V3_PHASE_F1_NOTES.md`**: how F1 drew and checked the art, and the doors' family rule.
3. `design/ASSET_LIST.md`:
   - "How dropping art in works" and "The locked style"
   - the **Event cards** section: 800×500, **target 70 kB, cap 130 kB**, one prompt per card, and the
     negative prompt (no text, no humans, no gore). Each prompt ends "Dark rather than cruel —
     nothing dies on screen."
4. `packages/engine/src/content/deck/*.ts` and `content/events.ts`. **Each card's `text` and `choices`
   are its brief.** The art shows the moment the card describes, not its outcome.
5. Where a card is seen, and at what size:
   - `components/EventModal.tsx`: the card with a choice, full panel width at 8:5, with the choices
     under it. This is the big one.
   - `screens/PlanetHub.tsx`, "Behind the door": **160 px wide**. The art has to read at that size.
   - the `.event-art` and `.behind-door` rules in `theme/app.css`
6. **Look at the finished art before drawing anything new.** Render these and look at them:
   - the **26 finished cards** in `src/assets/events/*.svg`. These are the model: `tipOff` (the bar
     counter), `pirates`, `kennelCough` (inside the kennels), `casinoComp`, `customsShakedown`,
     `dustStorm`, `monksBlessing`
   - **the doors**, `src/assets/doors/*.svg`: a card sits behind its door, so a Bar card should feel like
     the inside of that planet's bar
   - the trainer portraits, `portraits/staff-*.svg`. *(corrected: the modal for a trainer's offer
     shows **no card art at all**. `EventModal` skips the art when the card carries a `staffId`, and
     the offered trainer's StaffCard, with its portrait, is the picture. A trainer card's art is seen
     only on the hub's "Behind the door" panel, at 160 px.)*

## BUILD THIS SESSION

### The 67 cards, by door

Planet-weighted cards are marked with their planets. *(corrected: the draft called them
"planet-locked". They are not locked: `planets.boost` raises their weight on those planets, and they
can be dealt anywhere. `armWrestle` came up at Hushmarket, and `iceWork` and `monkRehome` at Old
Wembley.)* **Use those planets' two accents** (ASSET_LIST's table), and dress the card like the doors
on those planets. The other cards appear everywhere, so draw them in the house palette (acid green,
hot pink, hazard yellow, cyan over charcoal and rust), as the finished cards are.

**Bar (18)**: `rivalBrag`, `armWrestle` (rustgut), `oldTrainer`, `barFight`, `liarsDice` (neonSnout,
blackreach), `journalist`, `pilotShortcut`, `barTab`, `stableLad`, `offDutyVet` (collarPrime,
cosmodrome, oldWembley), `feedMerchant`, `freightClerk`, `dockers`, `commodityMan`,
`trainerBetweenYards`, `trainerWalkedOut`, `trainerOldHand` (oldWembley, ossuary, kibbleton),
`trainerAgent` (neonSnout, collarPrime, cosmodrome)

**Back Alley (16)**: `stolenFood`, `mugging`, `backstreetVet`, `chemistPill`, `counterfeitBones`,
`pickpocket`, `sealedCrate`, `alleySprint`, `protection`, `alleyCat`, `fence`, `kennelBoy`,
`bookiesRunner` (neonSnout, collarPrime, portSlobber), `syringeMan`, `kennelBoyBribe` (lagrangeLows,
drift, rustgut, hushmarket), `stewardBox`

**Pound (15)**: `vetLayoff`, `strayNight`, `kennelHand`, `breederEye`, `dogShow`, `escapedDog`,
`nutritionist`, `worms`, `shelterDay`, `strayOffer`, `runtOfTheLitter` (kibbleton, mudhaven),
`longCoatOffer` (drift, lagrangeLows, rustgut, sunbleach), `retiredRacer` (oldWembley), `monkRehome`
(holyBark, ossuary), `batchDog` (vatgrown, tinkertown)

**Track (10)**: `trialRun`, `hillGallops`, `privateMatch`, `gateSchool`, `hydroPool`, `schoolingRace`,
`sprintCoach`, `treadmill` (vatgrown, tinkertown), `bogGallops` (mudhaven, ossuary), `iceWork`
(glassfall)

**Strip (8)**: `threeCardMonte`, `zappSponsor`, `clamped`, `slotMachine` (neonSnout, collarPrime),
`calendarShoot`, `freeSamples`, `caterer`, `taxMan`

Check this list against `npm run asset-check -- --all` before starting. If it differs, the checker is
right: say so in the notes.

### The rules for a card

- One SVG per card at `src/assets/events/<id>.svg`, with `width="800" height="500"` on the root, and
  under the cap. Aim for the target.
- **One readable comic moment**, staged so it reads at 160 px wide: one big subject, a clear
  silhouette, and at most two supporting things. The finished cards put the subject in the middle
  third, in front of a simple setting.
- **The door's setting is the family rule.** Bar cards happen at a counter or a table, under bottles
  and lamps. Alley cards are dark, lit by one source. Pound cards happen among cages, runs and bowls.
  Track cards have a rail, sawdust or a gate. Strip cards have neon and money. A player who has just
  picked a door should recognise its inside.
- **No readable text**: no letters on signs, cheques, newspapers, price boards, tax forms, calendars
  or sponsor logos. Use pictures instead, the way F1 did: a bone for money, a paw for a brand, squiggles
  for writing. `journalist`, `commodityMan`, `taxMan`, `zappSponsor`, `calendarShoot` and
  `counterfeitBones` are the cards where this is hardest.
- **No humans** (aliens and dogs only), no real likeness, no gore. "Dark rather than cruel":
  `mugging`, `syringeMan`, `worms`, `barFight` and `escapedDog` should be funny and grimy, never
  hurtful. Nothing dies, bleeds or is injected on screen. Show the threat, not the harm.
- **The four trainer cards do not draw a trainer.** `trainerBetweenYards`, `trainerWalkedOut`,
  `trainerOldHand` and `trainerAgent` offer a trainer picked when the card is dealt. *(corrected: the
  modal shows that trainer's StaffCard **instead of** the art, not under it; the art shows on the hub
  after the door has been read.)* So the art is the scene from the card's text, with the figure
  unrecognisable: a whistle at the end of the bar, a thrown bucket, a corner table with a silhouette, a
  sharp little agent sliding a card across the bar (the agent is not the trainer, so the agent can be
  drawn). A card must never show a face that could disagree with the trainer it offered.
- **Dogs look like the game's dogs**: a greyhound bust or a running greyhound in the house hand, as in
  `kennelCough`, `pirates` and `casinoComp`.
- The same grain and vignette the finished cards and the doors use, so they sit together.

### Check them where they are seen

- After each door's batch, screenshot **the EventModal** for two or three of its cards and **the hub's
  "Behind the door" panel** for one, at 1280 and at 390 wide.
- Build the saves headlessly, as F1 did: `packages/web/scripts/table-walk.ts`'s `onScreen` hook gets the
  state and the log. Capture where `s.pendingEvent?.eventId` is the card you want, or where the hub is
  reading one back. F1's notes say how a save becomes a screenshot: the seed and the log go into
  `sdr.save.v1`, then Resume in `vite preview`. The walk always opens the same door. If a card never
  comes up in a reasonable seed search, screenshot the ones that do and render the rest on a sheet.
- If the modal or the hub panel crops the art badly, fix the CSS. That is UI, and it is in scope.

## RULES THAT DO NOT BEND

- **No engine change.** `packages/engine` is not touched, apart from reading it. Neither golden moves.
  `npm test` stays 47 green.
- **Art is data.** No code change is needed to drop a card in. The only code this phase may touch is
  the `.event-art` / `.behind-door` CSS, and only if the art needs it.
- **Each file:** SVG with `width`/`height` on the root; under its cap; no external references (no
  `<image href="http…">`, no web fonts, no `<script>`); no readable text. Escape `&` in any
  `aria-label` (F1 hit this with "Grub & Grub").
- **Format only what you edit.** `ASSET_LIST.md` is generated. It should not need regenerating: no
  contract entry changes.
- **Commit small: one commit per door**, each saying how many cards it adds and what `asset-check`
  reads.

## The commit discipline, in this order

1. Bar (18).
2. Back Alley (16).
3. Pound (15).
4. Track (10).
5. Strip (8). Then `npm run asset-check -- --prune` for the 67 stand-ins that now sit beside finished
   cards, in the same commit or one of its own. *(corrected: six more stand-ins were orphans that
   `--prune` does not see, for v2 events no longer in the deck: `engineTrouble`, `retirementOffer`,
   `talentScout`, `fatTonyFavour`, `dodgySteward`, `trainerPoached`. They go in the same commit.)*
6. Notes, prompt and design docs (below). Tag `v3f2` on it.

## DONE WHEN

| Measure | Target |
|---|---|
| Event cards finished | 93 / 93, each under its cap |
| `asset-check` | **288 finished, 0 stand-ins, 0 missing**, nothing over cap, no stand-ins left on disk |
| Neither golden moved; `npm test` 47 green; lint clean; `season-check` passes; `npm run build` → `packages/web/dist` | ✅ |
| Each card reads at 160 px, has no letters and no humans, and nothing is hurt on screen | ✅, checked on sheets and on screen |
| Screenshots: the EventModal for cards from each door, including a planet-weighted card and a trainer card's offer *(corrected: its StaffCards, no art)*; "Behind the door" on the hub, including a trainer card's art; at 1280 and 390 | ✅ |

## Then, in order

1. **Re-baseline:** `npm test`, `npm run lint`, `npm run build`, `season-check`, `hub-clicks`
   (unchanged: 9.4, and 10.7 / 22.4 passes at the table), `race-view-check`, and `npm run asset-check`
   with before → after for finished, stand-ins, files on disk, bundle, first paint, per weekend and the
   whole library.
2. `npm run snapshot`, then `git tag v3f2` on the notes commit.
3. **Write `claude/V3_PHASE_F2_NOTES.md`** in the style of the F1 notes: what was drawn, the family rule
   for the cards, how the hard ones were handled without text or harm, the asset-check before → after,
   anything pruned, and open questions. End with a **short** multiple-choice `v3f2` checklist for Jesse:
   - do the cards read at a glance, at the hub's small size
   - does a card feel like the inside of the door you picked
   - are the dark cards funny rather than nasty
   - is there anything that still looks unfinished anywhere in the game
   - what next: the playtest, the human face picker, or a rules phase
4. **Update the design docs:**
   - `design/BUILD_PLAN_V3.md`, Phase F: **F2 built**, the whole contract finished, and its acceptance
     row filled in. Phase F is done at `v3f2`.
   - `design/CANON.md`: the `v3f2` tag.
   - `design/GDD_V3.md`: no change unless a card's art revealed a rule that reads wrong. If one did, say
     so in the notes and do not change the rule.
5. Commit this prompt as `claude/V3_PHASE_F2_PROMPT.md`, corrected before commit where it was wrong.
6. **Land it** in Jesse's folder as described at the top, and give him the two push commands:
   `git push origin main` and `git push origin v3f2`. Sync the changed `design/*.md` and the new
   `claude/` notes and prompt to the claude.ai Project with `project_write`, and update each status
   header's `last synced`.
