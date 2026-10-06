# V3 Phase P: pick up and play — clean up single player

> **⚠️ Corrected before commit, where the prompt was wrong or the build had to differ.** The record of
> what happened is `claude/V3_PHASE_P_NOTES.md`.
>
> 1. **"`hub-clicks` may move down"**: it did not. It reads 9.5, as at `v3n` and `v3l4`, because it
>    counts presses through `screenFor` and the venues, not screens or words. "Next: Race Office" is the
>    press the Race Office tab was. Pick for me is outside its count, which assumes a human who picks.
>    Used, it makes the opening draft one press instead of twelve.
> 2. **The "Quick start" is called Play.** It is the Title's default table (you against five Normal AIs,
>    one season) with the seed the Title rolled when it opened, so `screen-words` compares the same game
>    before and after. Custom game holds the rest, and a seed link opens it.
> 3. **The walks needed small script changes; the room needed none.** `hotseat-shots` and `browser-walk`
>    waited for "Start season" on a Title with no link, and a seed link now waits behind Custom game.
>    They also looked for "Head to the track" on a hub that can say "Next: Race Office", and found the
>    Race Office tab by a name the new button contains. All three are fixed in the scripts, nothing in
>    the room. `browser-walk`'s held-"Fly on" flake came up once in the re-baseline and passed alone.
> 4. **"the game end's pace-timer breakdown"** shows only when the clock ran. A Playwright game with a
>    pinned `Date.now` has no clock, so the "before" game-end shot has no such panel to cut. It is gone
>    from the screen anyway, and the report keeps it.
> 5. **The draft was not halved** (1,480 → 1,163 words). Its board is the decision. Pick for me (P1) is
>    what makes it quick for a new player.
> 6. Not foreseen: a bug, each Kennels dog card drawing its "resting" badge twice, and stale text, the
>    Title's length picker describing the pre-`v3n` off-season. Both are fixed. The README's v1 build
>    description is rewritten for v3.

> Draft, written after `v3l4` (7 October 2026) for the next session. The repo's copy, committed and
> corrected by that session, will supersede this one.

`v3l4` is pushed. Online works: Jesse played it on his phone and his computer at once. **Now the focus
is single player.** Jesse's words: the game *"feels a bit messy, a lot of info on the screen. I want to
clean it up, streamline / simplify things so it is more pick up and play for the new player… really
want to remove a lot of unnecessary text, make it more intuitive, streamlined."*

The test for this phase: **a new player opens the live site, presses one button, and is racing
dogs inside a minute without reading a paragraph.** Everything on screen either helps them choose
or gets out of the way.

**Jesse's scope call: anything goes.** Screens, flow, wording, and the rules themselves can be cut
or merged. **Ask him only on the big ones**: anything that removes or merges a mechanic, changes a
number a player feels, or moves a version. Small calls (wording, layout, what is hidden behind a
"?") are yours. Say what you did in the notes.

Phase O (the draft's two misses from Phase N) is still open and **not** this phase's. Neither are
the playtest evenings.

## ⚠️ First: the mechanics (as L4's)

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`, then
     `npm run server:install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and ask.
     - `npm test` is **207 green**; `npm run lint` is clean; `npm run build` passes
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws**
     - `npm run server:test` is **15 green**; `npm run online-walk` ends **"All 27 rows pass."**;
       `npm run online-table-walk` ends **"All 10 rows pass."**; `npm run browser-walk` ends **"All 8
       rows pass."** (each starts and stops `wrangler dev` itself; `nohup … &` and poll, **one at a
       time**). The held-"Fly on" row is a known timing flake: if only it fails, rerun alone.
  3. `npm run snapshot`. Save into `shots/before/`: `season-check`, `hub-clicks`, `race-view-check`,
     `npm run harness -- --seasons 50`, and `npm run hotseat-shots -- <dist> shots/before/png` from a
     build **without** `VITE_ROOMS_URL`.
- **Commits** `Claude` / `noreply@anthropic.com`, signed; **tag `v3p` (or `v3p1`, `v3p2` if it splits),
  annotated and signed.** Scratch in `shots/` (in `.git/info/exclude`); stage paths explicitly.
- **Jesse's folder** `C:\Users\jesse\Documents\CoWork\dog racing game` (`$HOME/mnt/dog racing game` in
  `device_bash`). Land as L4 did: delete permission once at the start (*so git can clear its own
  `.git/index.lock` when I fast-forward your repo*; ask again if a reconnect drops it), probe,
  `git ls-remote origin`, his tree (his `package-lock.json` change is the known one), bundle,
  `device_commit_files`, fetch, `--ff-only`, delete the bundle. **Never run `npm` in his folder. You
  cannot push.**
- **Jesse is in Cowork. One clear question at a time, multiple choice, recommendation first, then
  stop.** Show, don't describe: for anything visual, a before/after screenshot beats a paragraph.
- **The browser pane** on his desktop is available for looking at the live site; the container's
  proxy cannot reach `*.pages.dev`, so build and screenshot locally with Playwright
  (`/opt/pw-browsers`; never `playwright install`).
- 2 cores, 10-minute tool calls: `nohup … &` and poll.

`v3l4` is the fallback tag.

## ⚠️ The room is live

A push to `main` redeploys the online room. **If a rule changes:** bump `STATE_VERSION` and
`SAVE_VERSION` (a hotseat save from before reads as unplayable, loudly, as it always has), bump
**`PROTOCOL_VERSION` to 2** (frozen at 1 since `v3l4`: CLAUDE.md, ONLINE_PLAN §7), move the goldens
once in a commit of their own, and tell Jesse to push **between evenings**, because the push ends
every live room. If no rule changes, none of that moves. Either way, **online and hotseat must keep
working**: every walk green at the end.

## Read, in this order

1. `CLAUDE.md`, `design/CANON.md`.
2. `design/GDD_V3.md` §0–§1 (the pillars: **pillar 1, "Learnable in one weekend. Every system is
   explainable in a sentence and visible on one screen"**, is the one this phase is judged by; and
   pillar 6, forty minutes), §1.1 (the five decisions), §10 and §10.1 (the screens and the click
   budget, and D34: *a hotspot flags what CHANGES, not what is always there*), §15.
3. Skim the rest of GDD_V3 for what each system is *for*, so you know what a cut costs.
4. `claude/V3_PHASE_N_NOTES.md` and `claude/V3_PHASE_L4_NOTES.md` (the last two sessions).
5. `packages/web/src/screens/` and `components/`, the screens a single player sees, in play order:
   `Title` → `Draft` → `Explore` → `PlanetHub` → `Market` / `Stable` (Kennels) / `RaceOffice` →
   `Bookie` → `RaceView` → `Results` → … → `SeasonEnd`. Plus `TopBar`, `Nav`, `EventModal`.

## What to do

### 1. See it as a new player would, and measure it (before changing anything)

- **Play one single-player game yourself** (one human, Normal AIs, one season) in a built copy under
  Playwright at **1280 and 390**, as somebody who has never seen it. Screenshot every distinct screen.
- **Write `npm run screen-words`** (a small script beside `hotseat-shots`, reusing its seed-link
  driving): for each screen of a single-player weekend, at 1280 and 390, count **visible words**,
  **buttons and links**, **panels**, and **screen heights** (how many phone screens of scrolling). It
  is this phase's ruler; run it before and after.
- **Mark every piece of text** on each screen as one of: *needed to choose now*; *nice to know*
  (move behind a "?" or into a tooltip); *for the designer, not the player* (cut). Things already seen
  in play that look like the third kind, to check: the hub's keyboard line ("Keys: H planet hub · M
  market · K kennels…") on every screen; a "GDD §4.2 phase 3 — what is actually in each one this
  week" string reachable in the hub's page text; the turn-order arithmetic on arrival ("20 − 7 crates
  ÷ 5 + 7 on the die = 25.6"); the Race Office's paragraph and bullet list above the declarations; the
  Bookie's per-dog "the book does not see 90 fitness against a field averaging 81" lines; the game
  end's pace-timer breakdown ("40s on private screens · 44s on race day · 0s passing the laptop…",
  which exists for the playtest, and can live in **Copy the report** instead of on screen); the
  Title's long rows of options before the first Start. Verify each; don't take this list as given.

### 2. Bring Jesse a short plan, and ask the big ones one at a time

From the audit, **a one-page plan**: per screen, what goes, what moves behind a "?", what merges,
and the before/after word count you expect. Show it with 2–3 before/after mock screenshots for the
worst screens. Then ask Jesse only the big calls, **one question at a time**, each with your
recommendation first and what it costs (a rule, a 🎲 row, a balance target, the click budget).
Likely candidates — **examine them, don't assume them**:

- **The first-game path.** A "Quick start" on the Title: one press, you against Normal AIs, one
  season, sensible defaults, the rest of the Title's options folded away under "Custom game" (hotseat,
  online, seeds, toggles, targets).
- **A first-game guide** instead of explanation text: a few one-line prompts at the right moment
  ("Pick a door", "Put a dog in each race", "Back one to win") that a returning player never sees
  again. Not a tutorial mode; no separate rules.
- **The weekend's flow.** Can the hub stop being a place you navigate and become a short sequence
  (door → shop → declare → bet → race), with the hub only for going back? Fewer screens a weekend for
  one player is the target, without breaking hotseat's turn order or online's waiting.
- **The Market.** Six goods on 8× bands, also the training programme: is it explainable in a sentence
  on screen? If not, what is the smallest version that keeps decision 2?
- **The Bookie.** Odds tables for three races of eight. Could a single-player default be "back one of
  your dogs, or skip" with the full book one press away?
- **Numbers a new player cannot use**: form, Δ ratings, traits, trap draw, fitness-if-it-runs vs
  if-it-rests. Which belong on the card, which on a detail view?
- **Anything that is a rule, not a screen** (a venue, a stat, a system that cannot be said in one
  sentence): propose the cut with what the harness says it changes, and only then build it.

### 3. Build it, in small commits

- **Text first** (cuts and moves are cheap and safe), then layout, then flow, then any rule Jesse
  approved. A commit per screen or per idea, so any one can be reverted.
- **Keep the voice.** The grimy, funny one-liners are the game's character (pillar 3, GDD §1's tone).
  Cut explanation, not flavour: a joke that is one line can stay; a paragraph that explains a rule
  goes, or moves behind a "?".
- **Keep the keyboard** (the shortcuts stay; the line that lists them goes behind a "?").
- **Every screen at 390 px with no horizontal scroll** (L4 saw the online board run past its panel at
  ~800 px; fix it if you are there).
- Hotseat and online share these screens: whatever you change, the pass screens, the waiting line and
  the draft must still read right. The three online walks and `hub-clicks` are the check.

## RULES THAT DO NOT BEND

- **Determinism**: same seed + same log = same game, on any engine; no `Math.random`, `Date`, DOM or
  `pow`/`exp`/`log`/trig in `packages/engine` (CLAUDE.md). If a rule changes: one golden commit,
  versions bumped (above), the harness summary in the notes with every §11 row before and after.
- **No rule change without Jesse's yes**, asked with its measured cost.
- **No balance number moved** that Jesse did not approve; `balance.json` is generated from the sheet,
  never hand-edited.
- **No dependency added** to the web or the root; Pages builds on Node 20 from a clean
  `npm ci && npm run build`. The root `package-lock.json` untouched.
- All checks and walks green at the end; lint and strict TypeScript; format only what you edit.
- If no rule changed: `season-check`, `race-view-check` and the harness read exactly as
  `shots/before/` (hub-clicks may move **down**: say by how much).

## DONE WHEN

| Measure | Target |
|---|---|
| A new player from the Title to their first race | one press to start; no paragraph read on the way |
| Visible words a single-player weekend (`screen-words`, 1280) | **at least halved**, reported per screen before → after |
| Phone scrolling (390) on the hub, Race Office, Bookie, Results | reported per screen; down on each |
| Presses a weekend, one human (`hub-clicks`, 9.5 at `v3n`) | not up; reported |
| Every removed explanation | gone, or one press away behind a "?" |
| Jesse's big calls | each asked, answered, and in GDD_V3 §13 as `P1`, `P2`… |
| Hotseat and online still play | every walk green; `hotseat-shots` before/after pairs in the notes |
| Versions | unchanged if no rule changed; otherwise bumped as above, goldens moved once |

## Then, in order

1. Re-baseline into `shots/after/` (the same files, plus `screen-words` and `hotseat-shots`).
2. Notes `claude/V3_PHASE_P_NOTES.md` in N's and L4's style: what was cut, screen by screen, the
   before/after numbers and the screenshot pairs that tell it, Jesse's calls, and a **short**
   multiple-choice checklist (what next: the hotseat evening, an online evening, Phase O, or another
   pass at the screens). This prompt as `claude/V3_PHASE_P_PROMPT.md`, corrected before commit
   (corrections in a box at the top). Tag on that commit.
3. Docs: GDD_V3 §10 and §10.1 (the screens and clicks as they now are; §13's P rows), BUILD_PLAN_V3 (a
   Phase P line), PLAYTEST_CHECKLIST (any row the cleanup answered or changed, e.g. row 14, "too many
   clicks?"), CANON (`v3p`, last synced), README's "What is in this build" if it is now wrong, and
   ONLINE_PLAN only if the protocol moved.
4. Land it; give Jesse `git push origin main` and `git push origin <tag>` (and, if a rule changed,
   "push when nobody is playing online").
5. Sync the Project: CANON, GDD_V3, BUILD_PLAN_V3, PLAYTEST_CHECKLIST, ONLINE_PLAN if touched, and the
   new notes and prompt; update each `last synced`.

## If it is too big for one session

It probably is, if rules change. Split it: **P1** is the audit, the plan, Jesse's answers, and every
text and layout change (no rule moves, no versions move); **P2** is the flow and any approved rule
change. Tag `v3p1` at the end of P1 and write P2's prompt into the notes.
