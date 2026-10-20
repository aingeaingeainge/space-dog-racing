# V3 Phase R notes: the feel, and the AI's race pricing (20 October 2026)

> ✅ **Pushing `v3r` does not end live rooms.** No rule moved, and `STATE_VERSION` / `SAVE_VERSION` (15) and
> `PROTOCOL_VERSION` (2) are where `v3q` left them. A room open at the push carries on; its AI seats play
> by R1 from their next sitting. Still: never push while friends are mid-game (CLAUDE.md).

Built **unattended**, in Cowork from a clone in the container, on Jesse's "make it better any way you can
think of, no need to ask me questions". Tag **`v3r`**. The fallback is `v3q` (`06c8301`). The prompt and
the reading the session took are `claude/V3_PHASE_R_PROMPT.md`.

**In one line:** the game had no sound and you could not find your own dog in a race, so it now has both;
three screen bugs are fixed; and **R1**, for Jesse to keep or revert, makes the AIs price a race the way the
book does, which turns the Race Office into a decision for Normal (GDD_V3 §14 Q15).

---

## The morning read

| | What it does | Why | What a player will notice | Revert |
|---|---|---|---|---|
| **R2 — sound** | Every sound synthesised with Web Audio (`lib/sound.ts`): traps and the hare at the off, the stands rising as the race gets late and close, an "ooh" for a bump, a cheer for a lead change, the shutter and a white flash at a photo, the judge's bell, coins for your purse; the Market's till, chips on a bet, a whoosh and a sting at the door, a tick on the big button, a fanfare at the season's end. **Sound on / off** in the top bar and on race day, key **V**. | The game was silent. | Noise, from the first press. Muted per browser if they want. | `git revert c9d66ec 3d73717` (clean, checked; the photo's flash is CSS in `8596219` and stays) |
| **R3 — the rings** | Your runner is ringed in your colour and tagged YOU (solo, online); at a hotseat table every human's runner is ringed and named. Out of shot, an arrow on the picture's edge: "YOU · 40 m back". The race canvas fills the screen; on an upright phone the camera comes in closer. | The camera follows the leaders, and the painted sprites look alike: on the first Silver Plate this session my dog was 103 m back and never once in shot. | Where their dog is, every race. | `git revert f8118f4 c310bd0` (clean, checked) |
| **Fixes** | Your own row's accent bar was drawn on every cell of every table; the leaderboard cut Net worth off at 1280; the map called week 10 "a Major, venue not yet announced" beside the line saying it is always Collar Prime; the map's rumour line still mentioned the Saloon. | Found playing it. | The leaderboard's most important column. | — |
| **R1 — the AI's race pricing** | `expectedPurse` prices places by Harville (it was p × 1.2 and p × 1.1 of the win chance) and adds `fitnessEdge` — the book's own rate since Q1 — to its runner and every declared rival. | §14 Q15: Normal's priced assignment did **worse** than "best-rated in the Gold" (+1,556 ± 483 for the ladder). | Normal AIs that put the fresh dog in the Gold. | **`git revert 811d252 29313a9 0376bb0`** — reverts clean; checked in a scratch clone, both goldens are then `v3q`'s byte for byte |

Every row is UI only except R1, which is AI only. **No rule moved**, so there is no sheet cell this time.

---

## What playing it found

A solo game at 1280 and 390, driven screen by screen in Chromium (draft → door → hub → Market → Kennels →
Race Office → Bookie → three races → results → map → leaderboard), and a hotseat seed link for the draft.
The art, the words and the flow are in good shape after Phase P; nothing threw. What was wrong:

1. **Silence.** BUILD_PLAN M4 listed "sound (optional)" and it was never built. → R2.
2. **"Where's my dog?"** The ticker highlights your line but the track does not, and the camera is on the
   leaders, so a dog of yours off the pace was invisible for the whole race. → R3.
3. **The leaderboard** clipped its Net worth column off the right edge at 1280 (seven columns in an 820 px
   modal). → wider modal, blurb wraps.
4. **Every "you" row** in every table (Results, the leaderboard, the map's current week) drew its 3 px
   accent bar on *every* cell, so there was a bar between each column. → first cell only.
5. **The map's week 10** read "A Major, venue not yet announced", two lines below "the Grand Final always at
   Collar Prime in week 10". → "The Grand Final — at Collar Prime, as it always is". The rumour line said
   "Nobody in the Saloon…" (v3 deleted the Saloon) and "They are saying: They're paying…". Fixed both.
6. **The race on a phone** was a 360 px strip with the standings box over half of it, and the camera's
   minimum shot (metres across a 390 px picture) drew the field as specks. → full height, closer camera.
7. **Skipping race day** skipped the coins too. → the results sheet rings up the weekend's takings.

---

## R1 in numbers

`npm run harness -- --decisions --games 1200` (the full audit, every row; `v3q` from its notes):

| §1.1 decision | Naive rule | `v3q` | `v3r` | Verdict |
|---|---|---|---|---|
| 1 Which door? | a door at random | +303 (± 266) | +52 (± 278) | still **shallow in Bones** (§14 Q14) — the categories pay −580 (the Alley) to +778 (the Track) |
| 2 Buy, sell or feed? | never trades | −4,968 (± 486) | −4,455 (± 487) | fine |
| 2 | never touches the diet | −1,330 (± 472) | −1,726 (± 466) | fine |
| 3 Who runs, who rests? | the three best race every week | −15,379 (± 455) | −15,731 (± 461) | fine — still the deepest |
| 4 Which dog in which race? | Normal's runners, best in the Gold | **+1,556 (± 483)** | **−388 (± 477)** | **a decision for the AI now** (§14 Q15) |
| 5 The bookie | never bets | +887 (± 61) | +963 (± 71) | Normal's blind bets on favourites lose the margin, as blind bets should |

Built in two commits so either half can be judged: Harville alone took the ladder to **+633 (± 480)**;
fitness on top took it to −388.

800 mixed seasons (`--ai easy,normal,normal,hard,hard,normal`), `v3q` → `v3r`:

| Row | `v3q` | `v3r` |
|---|---|---|
| Normal beats Easy | 98.0% | 98.3% |
| Hard beats Normal | 57.8% | 56.8% |
| Hard beats Easy | 94.6% | 95.3% |
| Mean end worth, Normal / Hard | 56,937 / 63,205 | 57,793 / 64,260 |
| Races entered (all stables) | 2.29 of 3 | 2.32 of 3 (band 2.2–2.8 MET) |
| Purse reaching a player | 58.5% | 59.7% |

Hard's lead over Normal narrows by a point: R1 is shared, so Hard got it too, and Normal had more to gain.
The book's return by fitness is unchanged in shape (100: +11.7% → +12.5%, ± 2.1).

### Harness summary (`--seasons 50`, six Normal)

```
End net worth: mean 56,207 · p10 41,319 · p50 55,299 · p90 71,089
Income a stable-season: prize 29,943 · trade 3,047 · betting −964 · costs 8,547
Pace: decisions 8.60 a weekend · entered 2.70 of 3 (band 2.2–2.8: MET) · races/dog 6.34 (band 5–7: MET)
Kennel: fitness at declaration 74.9 · under 60 12.3% · dogs at week 10 4.00
Food sold, share of gross income 24.6% (band 20–35%: MET)
```

---

## What was built, commit by commit

| Commit | What |
|---|---|
| `b9bdd04` | The three screen bugs (rows, leaderboard, week 10) and the Saloon line. |
| `c310bd0` | **R3.** `RunnerMark` and `drawMarks` in `race-view/renderer.ts` (screen-space paint after the numbers); `marks` in `RaceView.tsx`; the canvas fills the screen. |
| `3d73717` | **R2.** `lib/sound.ts` (one-shots, the crowd, the switch), `lib/soundCues.ts` (the door's whoosh and sting, read off state), `components/SoundButton.tsx`; wired into the race loop, the Market, the Bookie, the primary button, the top bar (key V) and the season/game end. |
| `c9d66ec` | The results sheet rings up the weekend's takings (silent at a hotseat table, which reads it together). |
| `8596219` | Your dog's line lit on the race's result card (gold if it won); the photo's flash; "Overheard:". |
| `0376bb0` | **R1.** Harville places in `expectedPurse`. |
| `29313a9` | **R1b.** `fitnessEdge` in `expectedPurse` and `expectedField`. |
| `811d252` | **The goldens, alone.** One season `7dc1fedc…` → **`71d2ee0f…`**; two seasons `fb2e5a71…` → **`3a5e24c3…`**. |
| `f8118f4` | The phone: the race canvas full height, and the camera's minimum shot shrinking with the aspect when upright. |
| (docs) | GDD_V3 §7.5, §10, §11's decisions row, §13 (R1–R3), §14 Q15; BUILD_PLAN_V3's Phase R line; PLAYTEST_CHECKLIST rows 37–39 and questions 1.15, 2.10, A.8; CANON; README (the sound line, and its design paragraph now points at GDD_V3 rather than v2's GDD). ONLINE_PLAN only its header. |
| (this) | These notes and the prompt; tag `v3r`. |

---

## The rules that did not bend

- **No rule moved.** No sheet cell, no `balance.json` change, no `STATE_VERSION`, `SAVE_VERSION` or
  `PROTOCOL_VERSION`. R1 is the AI's play: a save is its log *with* the AI's actions in it (`drive` pushes
  them), so an old save replays exactly as it was played, and online the room's AI seats simply play
  better from their next sitting.
- **Determinism:** R1 uses `placeProbabilities` and `fitnessEdge`, both already in the engine's proved
  arithmetic (`strength` via `pow10`, whole-point fitness edges); no `pow` / `exp` / `log`; lint clean.
  The sound module uses `Math.random` for jitter, and lives in the web, where that is allowed: nothing in it
  reads or writes the game.
- **Every change revertible on its own**, one change a commit, the goldens once and alone.
- **Pace:** `hub-clicks` **9.3** (`v3q` 9.5: the human seat it drives races a little more against the new
  AI; no press added or removed); the table walk 10.6 / 22.4 passes a weekend at 4 / 8 humans, as before.
- `npm test` **212 green**; lint clean; build passes; no dependency added; `package-lock.json` untouched.
- `season-check` passes (0 leaks); `view-walk` **0 throws**; `asset-check` **288 / 0 / 0** (the sound is
  not an asset); `race-view-check` clean (150 races replay the engine's finish twice).
- `server:test` **15 green**; `online-walk` **All 27 rows pass**; `online-table-walk` **All 10 rows pass**;
  `browser-walk` **All 8 rows pass** alone. Run straight after the other two walks it failed only the known
  held-"Fly on" row, as at `v3n`, `v3p` and `v3q`.
- The sound was checked in Chromium with the source nodes counted (a draft press, a door, a card's sting,
  a race's crowd, bell and coins, the V key muting it and writing the choice to the browser's storage): no errors, and
  silent under the headless walks, which have no `AudioContext`.

---

## What I did not do, and why

- **Music.** A generated loop that is not good is worse than none, and good needs an ear at the table.
- **Teach Normal the hot pace.** R1 fixed the two things that made Normal's assignment worse than a ladder;
  reading the board's shape is Hard's edge, and giving it to Normal would close the difficulty gap that
  Phase D2 built on purpose.
- **Anything in §14 Q14 (the doors pay alike) or Q16 (the long game's comeback).** Both are Jesse's calls
  inside numbers he chose.

---

## For Jesse: the `v3r` checklist

| | Question | Tick one |
|---|---|---|
| 1 | **R1, the AIs price places and fitness** | Keep · Revert · Keep, but play it first |
| 2 | **The sound** | Keep as it is · Keep, but quieter / fewer (which?) · Off by default · Take it out |
| 3 | **The rings on the track** | Keep · Only solo, not at a hotseat table · Take them out |
| 4 | **What next?** | The playtest evening (rows 34–39) · Another unattended pass (on what?) · Music · Something else |

---

## Landing

Built in the container, handed back as `phase-r.bundle` (`main` and the tag `v3r`, on top of `v3q`), written
into Jesse's folder, and fast-forwarded there by the session (it had the folder's delete permission this
time, so git could clear its own locks). If the fast-forward did not land, in Jesse's folder:

```
git fetch phase-r.bundle main:refs/remotes/bundle/r-main
git fetch phase-r.bundle "refs/tags/v3r:refs/tags/v3r"
git merge --ff-only bundle/r-main        # main: 06c8301 (v3q) → v3r
git log --oneline -1                     # Write the Phase R notes and the phase prompt
```

His own `package-lock.json` change is untouched by every Phase R commit, so the fast-forward leaves it.

**Then** (any evening nobody is mid-game; this push does not end rooms):

```
git push origin main
git push origin v3r
```

Cloudflare Pages rebuilds the site and Workers Builds the room, as for every push to `main`.
