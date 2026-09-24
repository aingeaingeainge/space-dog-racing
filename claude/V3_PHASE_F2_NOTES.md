# V3 Phase F2 build notes: the look — the event cards (25 September 2026)

**Status: Phase F2 is built and tagged `v3f2`. Phase F is done: every file in the art contract is
finished.** It was built in a clone in the cloud and landed in Jesse's repo folder as a fast-forward.
**Nothing is pushed.** The two push commands are near the end of these notes. Phase E's four 🎲 rows
and F1's checklist are untouched and still wait for Jesse's table.

F2 is the **67 event cards** that were still stand-ins, drawn as SVG by Claude, the same way as the 26
cards of 23 September and everything F1 drew, door by door and biggest group first. Then a prune.

No question went to Jesse mid-phase. **No engine change, and neither golden moved**: `packages/engine`
is byte-identical to `v3f1`. **No code changed at all**: the `.event-art` / `.behind-door` CSS showed
every card whole at both widths and was left alone. All commits are signed.

| | | golden |
|---|---|---|
| `b3dcfeb` | Bar: 18 cards | unmoved |
| `d3876ed` | Back Alley: 16 cards | unmoved |
| `a8f8550` | Pound: 15 cards (and a redrawn hood on two Alley cards, see "Along the way") | unmoved |
| `cfc5c97` | Track: 10 cards | unmoved |
| `3494047` | Strip: 8 cards | unmoved |
| `efb16f4` | The prune: 67 stand-ins beside finished art, and 6 orphans | unmoved |
| *(this one)* | Notes, prompt, BUILD_PLAN_V3 Phase F, CANON | — |

**The goldens:** one season **`8dc05e06…`**, two seasons **`dc357422…`**, both as at `v3e2`.
`npm test` is **47 green**.

---

## ⚠️ Read this first: four things the record should know

1. **A trainer's offer shows no card art in the modal.** The prompt said the modal shows the offered
   trainer's StaffCard *under* the four trainer cards' art. It does not: `EventModal` skips the art
   whenever the card carries a `staffId` (its comment: "A trainer's portrait is the art on a trainer's
   offer"), and shows three StaffCards instead: the one on offer and the two you would let go. So a
   trainer card's art is only ever seen on the hub's "Behind the door" panel, at 160 px, after the door
   has been read. The four cards were drawn to the brief anyway (no trainer's face), and they read at
   that size. Changing the modal would be a `.tsx` change, which this phase was not allowed; it is Open
   question 1. The prompt is corrected before commit.
2. **The "planet-locked" cards are planet-weighted.** `phases/explore.ts` multiplies a card's weight by
   `planetBoost` (default ×3) on its planets, and deals it anywhere else at its plain weight. The seed
   search met `armWrestle` (Rustgut's accents) at Hushmarket, and `iceWork` (Glassfall's) and
   `monkRehome` (Holy Bark's) at Old Wembley. The cards wear their home planets' accents as briefed, so
   away from home they look like a visitor, which suits them: an ice-work session at Old Wembley is
   Glassfall trainers showing off. The prompt's wording is corrected; nothing else changes. Open
   question 2 asks whether it matters.
3. **Six more stand-ins were orphans.** `asset-check -- --prune` deleted the 67 stand-ins beside
   finished cards. That left six `.placeholder.svg` files on disk for v2 events that are no longer in
   the deck or the contract (`engineTrouble`, `retirementOffer`, `talentScout`, `fatTonyFavour`,
   `dodgySteward`, `trainerPoached`). `--prune` only looks at contract entries, so it never saw them.
   Nothing names them, so they were deleted by hand in the same commit, as F1 did with `icon-docks`.
   The prompt's "no stand-ins left on disk" now holds.
4. **The opening snapshot was taken at the end.** The prompt asked for `npm run snapshot` before
   starting. It was missed, then taken on the notes commit. Nothing was lost: `v3f1` (`46aaf6a`) is
   pushed and was the fallback throughout, and no commit before the notes touched anything but art.

The list of 67 matched `asset-check -- --all` exactly, card for card.

---

## The acceptance table (BUILD_PLAN_V3 Phase F, F2's rows)

| Measure | Target | `v3f2` |
|---|---|---|
| Event cards finished | 93 / 93, each under its cap | **93 / 93**. The new 67 are 8–33 kB, 22 kB on average (target 70, cap 130) ✅ |
| `asset-check` | 288 finished, 0 stand-ins, 0 missing, nothing over cap, no stand-ins on disk | **288 finished, 0 stand-ins, 0 missing**, nothing over cap, **0 `.placeholder.svg` on disk** ✅ |
| Neither golden moved; `npm test` 47 green; lint clean; `season-check`; `npm run build` | ✅ | ✅ |
| Each card reads at 160 px; no letters, no humans; nothing hurt on screen | ✅ | ✅ on a 160 px sheet of all 67, on the hub panel, and in the modal. No `<text>` element in any file |
| Screenshots at 1280 and 390 | modal per door, a planet-weighted card, a trainer card; the hub | ✅ below |

### The re-baseline

| | `v3f1` | `v3f2` |
|---|---|---|
| `npm test` | 47 green | **47 green** |
| `npm run lint` | clean | **clean** |
| `season-check` | passes | **passes**: two four-human games, 0 leaks, identical figures (217 passes / 20 weekends; 135 / 12) |
| `hub-clicks` | 9.4 · 10.7 / 22.4 passes at the table | **9.4 · 10.7 / 22.4** (unchanged) |
| `race-view-check` | 150 races replay the same way twice | **the same** |
| `npm run build` | ✅ | ✅ |

### `asset-check`, before → after

Both measured on a fresh build (`v3f1` was rebuilt in a worktree for its column).

| | `v3f1` | `v3f2` |
|---|---|---|
| Finished | 221 | **288** |
| Stand-ins still showing | 67 (every one an event card) | **0** |
| `.placeholder.svg` on disk | 73 (67 + 6 orphans) | **0** |
| Files under `src/assets` | 301 | **295** |
| On disk under `src/assets` | 5.45 MB | **6.75 MB** (MiB, as F1 measured) |
| Bundle | 453.3 kB JS + 36.8 kB CSS (160.2 kB gz) | **451.1 kB JS + 36.8 kB CSS (159.9 kB gz)**: the glob maps name fewer stand-ins |
| First paint | 686.0 kB | **683.8 kB** |
| Per weekend | 149.3 kB | **163.8 kB**: a weekend's event card is now a drawn card, not a stand-in |
| Whole library | 5.36 MB | **6.67 MB** over 288 files |
| Whole site | 5.89 MB | **7.20 MB** |
| At the targets / at the caps | 19.98 / 36.48 MB | 19.98 / 36.48 MB (the contract did not change) |

The whole library is a third of the contract's target figure: the SVGs came in far under the WebP
targets the contract was written for.

---

## What was drawn

### The family rule: a card happens inside its door

A player who has just picked a door should recognise its inside. Each door has one setting, the same
on every card, and the card's moment is staged in front of it:

| Door | The inside (the same on every card) |
|---|---|
| **Bar** | plank walls, **two shelves of bottles**, a hanging lamp and its cone of light, a **counter** across the bottom. Drinkers sit on stools in front of it; the staff stand behind it |
| **Back Alley** | brick closing in, a gap at the far end with stars in it, a **single bulb** on a bracket and its cone, a wet floor with puddles, bins and crates. Everything else is dark |
| **Pound** | a row of **cages** with a paw plate on each, strays' eyes or heads in some of them, a hosed concrete floor with a puddle, bowls |
| **Track** | a night sky, a grandstand with a crowd and pennants, sand with sawdust flecks and a dashed line, and the **white rail** |
| **Strip** | a striped **awning**, a row of bulbs, dark shopfronts, **neon pictures** (a bone, a diamond), a wet street with coloured reflections and **money in the gutter** |

The characters are the finished cards' blob aliens (outlined, two or three eyes, a hat that says
their job) and the finished cards' greyhound, standing, running, sitting, lying or peering. Every
card uses the same grain filter and vignette as the 26 before it. Each is **one moment**: one big
subject in the middle third, and at most two supporting things.

**Planet-weighted cards** take their first planet's two accents and dress like that planet's doors:
Rustgut's orange and corrugated bar (`armWrestle`), Neon Snout's pink-and-green neon (`liarsDice`,
`trainerAgent`, `bookiesRunner`, `slotMachine`), Collar Prime's pink and cyan (`offDutyVet`), Old
Wembley's green and white (`trainerOldHand`, `retiredRacer`), Lagrange Lows' acid green
(`kennelBoyBribe`), Kibbleton's hay and yellow (`runtOfTheLitter`), the Drift's grey and yellow
(`longCoatOffer`), Holy Bark's white arch, candles and gold halo (`monkRehome`), Vatgrown's lab tiles
and jars (`batchDog`, `treadmill`), Mudhaven's swamp trees (`bogGallops`) and Glassfall's ice under the
aurora (`iceWork`).

### Door by door

- **Bar (18).** A rival owner three drinks in with a mug in the air and a bubble of a running dog and a
  lightning bolt; a miner the size of a cargo pod with his forearm planted on the bar and his hand
  open; an old trainer with a walrus moustache under a dusty trophy; a brawl cloud with limbs, stars
  and a stool in the air, and the barman peeking over the counter; three toothless spacers round a
  dice table with an empty stool in front; a reporter with a notebook, a press card with a paw and a
  flash going off; a one-eyed pilot's chart with a pink route through an asteroid gap; a tab that
  reaches the floor; a stable lad whose bubble pours out dogs, bones and paws; the track vet with three
  empty brandy glasses and a fourth coming; the feed merchant's gossip; the freight clerk's clipboard
  of arrows and crates; two dockers arguing up-arrow against down-arrow; a velvet-jacketed man's chalk
  board, mostly rubbed out. The four trainer cards: a silhouette at the end of the bar with one bright
  whistle; a dented bucket upside down on the bar and a row of glasses toasting it; the barman pointing
  across the room at a figure in shadow at a corner table with three little cups; a sharp little agent
  in shades sliding a card with a paw and two stars across the bar.
- **Back Alley (16).** A long coat flung open, lined with tins of dog food; two muggers, one with a
  slightly bent pipe, and a bubble of a wallet; a struck-off vet in a head torch with a wrench and a
  roll of tape over a dog with a bandaged leg on a crate table; a chemist holding up a glowing pill in
  front of a dog-shaped hole in the wall; a case of gold coins, one held up to the light and one in the
  gutter with the gold peeling off it; a blur, a purse on a tentacle and a hat left spinning; a sealed,
  chained, taped crate humming green with coins on top; the local's barrel-chested dog in a spiked
  collar at a chalk line, a bin for a finish; a heavy in a fedora with his hand on a kennel latch and a
  greyhound peeking out under the door; the biggest cat anyone has seen on a wall, and a greyhound
  looking straight back; the fence's scale, a crate against a bag of Bones; a kennel-boy in a rival's
  armband by the bins; the bookie's runner, all ears, with a satchel of slips; a man in shadow holding
  up a capped syringe beside a map of six yards with one circled; a sweating kennel-boy with empty
  pockets and a bowl of something green; a steward smoking under a no-smoking picture beside a drum of
  coloured balls.
- **Pound (15).** The pound vet with a clipboard beside a splinted dog on a steel table; a scruffy stray
  at the foot of the ship's ramp, scratching, with our dogs looking down; a volunteer with a fistful of
  leads fanning off the frame; an old breeder pointing her stick at one of your dogs; a greyhound with a
  rosette on a podium, a judge, and a stray measuring up the judge; our dog diving into a heap of happy
  strays while the dog-catcher waits with a net; a thin nutritionist with a giant spoon over a very long
  row of bowls; the vet snapping on a rubber glove while the dog's ears go flat; our dog wound up in
  five other dogs' leads; a lean, bright-eyed stray walked out of a back pen; a farmer in dungarees
  holding up the runt, a round little pup, over a basket of the rest; a coat opened on a grinning dog;
  an old racer grey round the muzzle in a faded jacket with a medal; a monk leading a calm dog out
  under the Almshouse arch; a clone stepping out of jar 12 with a barcode tag on its collar.
- **Track (10).** A dog alone along the rail, clockers with stopwatches and a big stopwatch; a hill with
  one dog on its third climb and one flat out at the bottom; two dogs nose to nose at the line and the
  other owner steaming; the starting gate with one dog still sitting in its box and the starter ringing
  a bell; a dog in the hydro pool up to its chin, unimpressed, and a duck; three young dogs running
  loose past an empty tote board; a sprint coach with whistle and stopwatch and a dog with speed lines;
  a dog on a sensor treadmill with the public board showing its trace; a dog knee-deep in bog under
  swamp trees with a large fly; one dog holding the bend on the ice and one with its legs in four
  directions.
- **Strip (8).** Three cards face down on a crate, and the "tourist" who won: same purple, same smirk,
  stuck-on moustache; a dog with its fur on end and its eyes spinning next to a can with a lightning
  bolt; a yellow wheel clamp on the ship's landing gear, a note under it and a warden walking briskly
  off; the Big Bone slot machine, bone-bone-cherry, a cobweb on the tray; a greyhound posing on a velvet
  cushion under hot lights while a stylist attacks its ears; a mascot in a giant tin costume tossing
  samples into the ship's hold; a caterer in a chef's hat holding out fistfuls of money beside a wedding
  cake; the tax man with an open ledger of ticks and a pie with a slice out, and a stack of coins sliding
  sideways.

### How the hard ones were handled without text

| Card | What stands in for words |
|---|---|
| `journalist` | a notebook of squiggles; a press card with a paw on it; the weekend edition is a grey headline bar, a dog picture and squiggle columns |
| `commodityMan` | a chalk board of three rows, each a sack, an up or down arrow and one to three circles for the price, with the rubbed-out rows as smears |
| `taxMan` | a ledger of lines and ticks and a pie chart with a slice cut out; the "cash discount" is a coin stack sliding sideways, and a bubble of coins with a minus stroke |
| `zappSponsor` | a can with a lightning bolt, and a flash going off: the brand is the bolt |
| `calendarShoot` | a calendar of twelve squares with a dog in every one, and no numbers |
| `counterfeitBones` | the fake is a coin whose gold is peeling to grey |
| `freightClerk`, `dockers` | price sheets and bubbles made of crates, sacks and up/down arrows |
| `clamped`, `barTab` | the note and the tab are squiggles, with a coin on the note |
| `stewardBox` | the no-smoking sign is a crossed-out cigarette; the trap draw is a drum of coloured balls, not numbers |

### How the dark ones stay funny

- **`syringeMan`:** the man is all shadow but his eyes, and the syringe is capped, held up like a pen,
  and nowhere near a dog. The threat is the map with one kennel circled. No dog is on the card.
- **`mugging`:** two of them, one small with a pipe that is already bent, and the ask is a bubble with a
  picture of a wallet. Nobody is hit.
- **`worms`:** the joke is the glove: the vet snapping on a very long rubber glove and grinning, the dog
  sitting with its ears flat and a bead of sweat. The tablets are a box with a squiggle on it.
- **`barFight`:** a cartoon brawl cloud with limbs, stars and a flying stool and hat. No one is hurt; the
  barman is peeking over the counter.
- **`escapedDog`:** our dog diving into a pile of delighted strays, tail wagging, the lead on the floor.
- **`backstreetVet`:** the struck-off vet's tools are a wrench and a roll of tape, not a needle, and the
  dog is lying calmly with a bandage.
- **`chemistPill`:** "some dogs try to run through the wall" is a dog-shaped hole in the brick and two
  puffs of dust, and no dog.

### Along the way

- **The pictogram dog was redrawn** after the first Bar sheet, where it read as a seal. It is now a
  greyhound built from an ellipse, a chest, a neck and four thin legs, used in bubbles, on boards and
  on the calendar.
- **The hood was redrawn** so a face shows through it. As first drawn it covered the monk's face
  (`monkRehome`); the fix changed two Alley cards drawn with it the day before (`sealedCrate`,
  `syringeMan`), which went into the Pound commit.
- **Three first drafts read as the wrong thing** and were redrawn before commit: the `clamped` clamp
  was a yellow cross with a red middle (a first-aid sign), so it is now a claw over the tyre with a
  padlock; the `zappSponsor` dog's standing fur was vertical lines across its body (ribs), so it is now
  a crest along its back; and the Strip's neon was a circle with a bar (a no-entry sign), so it is now
  a bone and a diamond.
- **Checked where it is seen.** After each door, three or four modals and one hub panel at 1280 and
  390, from saves built headlessly: a scratch copy of `table-walk.ts` that opens a different door each
  week, searched over seeds 1 to 80 with one human and three Normal AIs. 66 of the 67 came up; `caterer`
  never did (it wants Grey Mash in the hold), and it is checked on the sheets. The cards with nothing to
  choose resolve as the door opens (`pickpocket`, `alleyCat`, `freeSamples`), so they are seen on the hub
  only, which is where they were checked.
- **No CSS change.** The modal shows the card at full panel width at 8:5, and the hub's 160 px panel
  shows it whole, on both widths.

---

## Screenshots

From `vite preview` of the build, with saves generated headlessly (the seed and the log go into
`sdr.save.v1`, then Resume). The files are in the session outputs:

- **Bar:** `bar-modal-armWrestle` (Rustgut's accents, dealt at Hushmarket), `bar-modal-journalist`,
  `bar-modal-trainerAgent` (the offer: three StaffCards, no art, see Read this first 1),
  `bar-hub-trainerOldHand-panel` (a trainer card's art on the hub)
- **Back Alley:** `alley-modal-bookiesRunner`, `alley-modal-syringeMan`, `alley-modal-mugging`,
  `alley-hub-alleyCat-panel`
- **Pound:** `pound-modal-monkRehome`, `pound-modal-worms`, `pound-modal-escapedDog`,
  `pound-hub-runtOfTheLitter-panel`
- **Track:** `track-modal-iceWork`, `track-modal-hydroPool`, `track-modal-privateMatch`,
  `track-hub-bogGallops-panel`
- **Strip:** `strip-modal-slotMachine`, `strip-modal-threeCardMonte`, `strip-modal-taxMan`,
  `strip-hub-freeSamples-panel`
- each at **`-1280`** and **`-390`**, and **`f2-sheet-160.png`**: all 67 at the hub's 160 px

---

## To push

Landed in your folder as a fast-forward from `46aaf6a` (`v3f1`), the `main` that `git ls-remote origin`
reported. Your tree was clean before and after, and there is no `index.lock`. **`package-lock.json` is
untouched**, and so is the spreadsheet. A `v3f1` save still loads (no state or save version moved).

```
git push origin main
git push origin v3f2
```

- **The push redeploys the site** with every card drawn. CI runs as usual; no code changed.
- **Design documents changed** and are synced to the claude.ai Project:
  - `BUILD_PLAN_V3.md`: Phase F, F2 built and Phase F done
  - `CANON.md`: the `v3f2` tag
  - `GDD_V3.md`: no change. No card's art showed a rule that reads wrong.
  - `design/ASSET_LIST.md` (not mirrored): unchanged. No contract entry moved.

---

## ⚠️ The v3f2 checklist: the cards, multiple choice

Play a few weekends and open a few doors of each kind, on a laptop and on a phone.

1. **Do the cards read at a glance on the hub, at their small size?** *Yes · Most do (which don't?) ·
   No, I read the text first*
2. **Does a card feel like the inside of the door you picked?** *Yes, all five · Mostly, one door's
   cards feel off (which?) · Not really*
3. **Are the dark cards funny rather than nasty?** *Yes · One goes too far (which?) · They are too tame*
4. **Is there anything that still looks unfinished anywhere in the game?** *No · Yes (where?)*
5. **What next?** *The playtest (Phase E's 🎲 rows) · The human face picker · A rules phase · Something
   else*

---

## Open questions and carried forward

1. ❓ **Should a trainer's offer show its card art?** Today the modal shows the three StaffCards and no
   art, so `trainerBetweenYards`, `trainerWalkedOut`, `trainerOldHand` and `trainerAgent` are seen only
   on the hub at 160 px. Showing the art above the StaffCards would be a two-line change to
   `EventModal.tsx` and would make the modal taller on a phone. Not built: it was out of scope.
2. ❓ **Should a planet-weighted card look like home when it is dealt away?** Today `iceWork` at Old
   Wembley still has Glassfall's ice and aurora. That reads as visiting trainers, and it is how the card
   text reads too. Nothing to do unless it jars at the table.
3. **Phase E's four 🎲 rows and F1's checklist** are unchanged and still wait for the table.
4. Carried from F1, untouched: a human choosing their own face; "Per weekend" in `asset-check` not
   counting the three doors.
5. Carried from E2, untouched: merging each human's door into their market sitting; the long game
   widening; a table's last-weekend bet slips; Hard 49.9%; §7.5's split view.
