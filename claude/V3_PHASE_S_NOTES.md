# V3 Phase S notes: the look (22 October 2026)

> ✅ **Pushing `v3s` does not end live rooms.** No rule moved: no golden, no sheet cell, and
> `STATE_VERSION` / `SAVE_VERSION` (15) and `PROTOCOL_VERSION` (2) are where `v3r` left them. Still: never
> push while friends are mid-game (CLAUDE.md).

Built in Cowork from a clone, on Jesse's "can you improve the look of the game / graphics, tidy things
up". Tag **`v3s`**; the fallback is `v3r` (`07590c5`). The prompt and the reading the session took are
`claude/V3_PHASE_S_PROMPT.md`.

**In one line:** the screens a player looks at most — the Title, the hub, the race tickets, race day and
the results — were each a little rough in a way playing them showed, and are now tidy; on a phone the
race is drawn about twice the size.

---

## What playing it found, and what changed

| | Found | Now | Commit |
|---|---|---|---|
| **The hub** | Each venue was a tall dark box standing on the pad, stall board or plate the backdrop paints for it — two frames, one inside the other. | One low, wide lit sign: icon tile, the venue's name, what is in it this week. It sits on the painted board. Lit in the planet's accent when there is something there; dark and dashed with the reason when shut, as before. | `fdee6aa` |
| **The tickets** | Every ticket's first column (the trap numbers, "No runner declared", the 2nd/3rd money) sat on the stub's printed perforation. The Race Office's rivals were two narrow columns, so every name wrapped. | The writing starts clear of the perforation. A rival is its stable on the left and its runner on the right, dropping to its own line when it will not fit; your runner's face, style, traits and fitness share a line. | `ec81a8c` |
| **Race day** | The scenery went soft when the camera closed in (a 2048² vector ground was flattened at 1:1). On an upright phone the dogs were about 14 px long. | A vector ground is flattened at up to twice its size (4096 px a side at most). **S1:** a picture a third taller than wide is turned a quarter, so the track runs up the screen: dogs about 30 px long at 390 × 844. The ticker's paying places wear their metals; on a phone it is places, cloths and gaps, clear of the track. Floodlight and soot at the canvas edge. The sound switch is a speaker; on a phone the controls fit one row ("Skip day"). | `e69e0a4` |
| **The Title** | A nameplate, a button and an empty page. | **S2:** it opens on Collar Prime at night with six runners and the hare coming down the straight under the nameplate — the race view's own run cycles, in the first six stable colours, on sine waves. One still frame under reduced motion. Play sits straight under it. | `1cfbdf9` |
| **The chrome** | Results, leaderboard and season-end ranks were plain numbers; the short results pushed a dog and its stable to opposite ends of the panel; on a phone the venue strip was three rows with the next step last. | Gold, silver and bronze for the paying places; a dog beside its stable; the top bar's cash on a chip; on a phone the venue tabs scroll in one row and the next step is full width under them. | `a3dc97d` |
| **app.css** | The hotspot rules were in four places that overrode each other; the v2 ladder (`.tier`), `.venues`, `.venue-list` and `.flush-t` were styled and never used. | One hotspot block; the dead rules gone. | `fdee6aa` |

Every row is UI only. Revert any of them with `git revert <commit>`; each is one commit, and the docs are
the last.

---

## The rules that did not bend

- **No rule moved.** Nothing under `packages/engine` changed; both goldens are `v3r`'s.
- **Race day is still a replay.** S1 is the camera alone: the tick log, the finish, the rings and the
  out-of-shot arrows are the same (`race-view-check`: 150 races replay the engine's finish, unchanged).
- **The Title parade reads no game and rolls nothing.** Sine waves of the clock; `Math.random` is never
  called, so hotseat-shots' fixed generator is untouched. hotseat-shots now opens its pages with
  reduced motion, so the parade is one still frame and its PNGs stay identical run to run.
- **The walks press the same buttons.** "Skip the rest of race day" and "Sound on/off" keep those names
  for a screen reader and for the walks; on a phone the short label is shown and the long one is
  visually hidden, not removed. `nav.tabs` still holds every venue button.
- No dependency added; `package-lock.json` untouched; no asset added or changed (`asset-check` 288 / 0 / 0).

## Checks

- `npm test` **212 green**; lint clean; `npm run build` passes.
- `race-view-check` clean (150 races, five seeds); `season-check` passes (0 leaks); `view-walk`
  **0 throws**; `asset-check` **288 / 0 / 0**; `hub-clicks` 4 / 8 humans 10.6 / 22.4, as at `v3r`.
- `browser-walk` **All 8 rows pass** (three browsers online, a refresh, a held door, Play again).
- `hotseat-shots` runs clean; the screens were checked by eye at 1280 and 390 (Title, draft, Explore,
  hub on six planets, Market, Kennels, Race Office, the locked card, race day mid-race and late, results,
  leaderboard, game over).

### Harness summary (`--seasons 50`, six Normal) — unchanged from `v3r`, as it should be

```
End net worth: mean 56,207 · p10 41,319 · p50 55,299 · p90 71,089
Income a stable-season: prize 29,943 · trade 3,047 · betting −964 · costs 8,547
```

---

## What I did not do, and why

- **Redraw the race grounds' stands.** Close in, the crowds are big flat discs: that is the eighteen
  `ground.svg` files, which are art to regenerate against ASSET_LIST, not a tidy.
- **A new palette or typeface.** The art bible (GDD §16) is Jesse's, and the screens already read as one
  game; this pass works inside it.
- **Anything a rule touches.** Presentation only, so `main` can be pushed on any evening.

## For Jesse: the `v3s` checklist

| | Question | Tick one |
|---|---|---|
| 1 | The Title's opening (the pack under the nameplate) | Keep · Keep, but calmer · Take it out (`git revert 1cfbdf9`) |
| 2 | The hub's venue signs | Better · No different · Prefer the old boxes (`git revert fdee6aa`) |
| 3 | On a phone, the race running up the screen | Better · Prefer it across (`git revert e69e0a4`, which also takes the sharper ground and the ticker) |
| 4 | Anything that reads worse than at `v3r`? | No · Yes (what?) |
