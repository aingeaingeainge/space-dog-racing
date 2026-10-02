> **Corrected before commit, at `v3l4` (2 October 2026).** The prompt below is the draft written at
> `v3n`, kept as it was given. Where the session found it wrong or found something it did not foresee:
>
> 1. **"`src/room.ts` (no cap on … an `act`'s length)"** — there was one: `refuseAct` in `game.ts` has
>    refused more than 64 actions since `v3l2`. L4 kept it, named it `MAX_ACTIONS` (in `guard.ts`) and
>    gave it a `server:test` row. The 16 KB frame cap was new.
> 2. **"Environment: … `ALLOWED_ORIGINS` as above"** in the Workers Builds settings — a Workers Builds
>    build variable "will not be accessible at runtime". `ALLOWED_ORIGINS` is a runtime variable, so it
>    lives in `wrangler.jsonc`'s `vars` (a deploy would replace dashboard variables with the config's
>    anyway). Only `NODE_VERSION` went into the dashboard.
> 3. **"`NODE_VERSION=22` (wrangler needs it)"** — the build image's default is Node 24, which wrangler
>    also accepts. 22 was set anyway: every walk ran on it.
> 4. **"never creates an API token"** — pressing Deploy on a Workers Builds project makes Cloudflare
>    create a user API token for the builds ("sdr-rooms build token") and keep it; there is no way round
>    it. Jesse was asked before Deploy and said yes (GDD_V3 L4c). Nobody saw or copied its value.
> 5. **"the dev default allows `localhost` / `127.0.0.1`"** — built by the request's own host, not a
>    var: a Worker reached at a local host is `wrangler dev`, and only then are localhost pages (and a
>    client with no `Origin`, the headless walks) let in. No walk needed a `--var`.
> 6. **The container's proxy refuses `*.workers.dev` and `*.pages.dev`** (CONNECT 403), as the prompt
>    allowed for. The browser half was run, and `live-smoke`'s own checks were made by hand from the live
>    site's page in the browser pane. `live-smoke` passes all 10 rows against `wrangler dev`.
> 7. **"open the live site in two tabs"** — two tabs of one browser share `localStorage`, so the second
>    would have taken the first's seat. The guest used a preview deployment's URL
>    (`<hash>.space-dog-racing.pages.dev`): a second origin, so a second seat, which also exercised the
>    preview wildcard in `ALLOWED_ORIGINS`.
> 8. **"the two commands, and 'tell me when it's done'"** for the mid-session push — one command
>    (`git push origin main`); the tag is made at the end.
> 9. Not foreseen: `workers_dev: true` and `preview_urls: false` were added to `wrangler.jsonc` after the
>    first deploy warned about both, and **preview builds were switched off** in the dashboard (`main`
>    is the only branch).

---

> Draft, written at `v3n` (2 October 2026) for the next session. The repo's copy, committed and corrected by that session, will supersede this one.

# V3 Phase L4: online, live — the room on Jesse's Cloudflare account

Phase N is done and pushed (`v3n`): every game opens on the draft, and online has been built and green
since `v3l3`, but **only ever under `wrangler dev`**. This phase puts it live, so friends in different
houses can play from `space-dog-racing.pages.dev`. **Jesse's call: L4 goes ahead of the playtest
evening** (ONLINE_PLAN §10 planned it for after). He has no time to playtest this session, so the
evening's 🎲 rows stay open, and **this session's live smoke test is played by Claude**, not by
friends.

**The first deploy freezes `PROTOCOL_VERSION` 1** (ONLINE_PLAN §7, `v3n`'s note). From the moment a
browser out there holds 1, anything that changes a message's shape, the view's shape or a rule must
bump it. Say so where a future builder will read it.

**Nothing in the game changes.** No rule, number, golden, `STATE_VERSION` or `SAVE_VERSION` moves.
Hotseat reads byte for byte as at `v3n`.

## ⚠️ First: the mechanics. They are N's, with one difference — this session waits for a push.

- **Work in a clone in the container:**
  1. `git clone https://github.com/aingeaingeainge/space-dog-racing`, then `npm install`, then
     `npm run server:install`.
  2. Check all of these before touching anything. If any fails on a fresh clone, stop and ask.
     - `npm test` is **207 green**; `npm run lint` is clean; `npm run build` passes
     - `npx tsx packages/web/scripts/season-check.ts` passes
     - `npm run asset-check` reports **288 finished, 0 still a stand-in, 0 missing**
     - `npm run view-walk` reports **0 throws**
     - `npm run server:test` is **11 green**; `npm run online-walk` ends **"All 25 rows pass."**;
       `npm run online-table-walk` ends **"All 10 rows pass."**; `npm run browser-walk` ends **"All 8
       rows pass."** (each starts and stops `wrangler dev` itself; run them with `nohup … &` and poll,
       **one at a time**). ⚠️ `browser-walk`'s held-"Fly on" row is a known timing flake (N's notes,
       item 4): if only that row fails, run it once more alone before calling it a failure.
  3. `npm run snapshot`, then save `season-check`, `hub-clicks`, `race-view-check` and `npm run harness
     -- --seasons 50` into `shots/before/` (they must read the same at the end).
- **Commits** as N: `Claude` / `noreply@anthropic.com`, signed (`gpgsig` in `git cat-file -p HEAD`).
  **Tag `v3l4`, annotated and signed.** Scratch in `shots/` (in `.git/info/exclude`); stage paths.
- **Jesse's folder** is `C:\Users\jesse\Documents\CoWork\dog racing game` (`$HOME/mnt/dog racing game`
  in `device_bash`). Land exactly as N did: ask for delete permission once at the start (reason: *so git
  can clear its own `.git/index.lock` when I fast-forward your repo*), probe it, `git ls-remote origin`,
  check his tree (his `package-lock.json` local change is the known one), bundle `<his main>..main v3l4`,
  `device_commit_files`, fetch to `work`, `--ff-only`, delete the bundle. **Never run `npm` in his
  folder. You cannot push.**
- **This phase has two halves around a push.** The code lands first; then **ask Jesse to push and wait
  for him** (one short message: the two commands, and "tell me when it's done"). The dashboard steps
  and the live smoke test come after, in the same session. If he is gone, stop at the landing, write
  the notes as far as they go, and leave the dashboard steps as a numbered list at the top of the notes.
- **Jesse is in Cowork. Ask one clear question at a time, multiple choice, recommendation first, and
  stop.** He has chosen the simple option every time.
- 2 cores, 10-minute tool calls: `nohup … &` and poll. Chromium at `/opt/pw-browsers`; never
  `playwright install`. Kill `wrangler dev` from a script file, matching `/proc/<pid>/comm`.

`v3n` is the tag to fall back to.

## Read, in this order

1. `CLAUDE.md`, `design/CANON.md`.
2. `design/ONLINE_PLAN.md` whole, closely: §2 (the shape, §2.1 the Worker only routes, §2.2 a room's 30
   days), §5, §7 (versions, and **deploy between evenings**), §9 (cost: the free plan), §10's L4.
3. `claude/V3_PHASE_L2_NOTES.md`, `claude/V3_PHASE_L3_NOTES.md`, `claude/V3_PHASE_N_NOTES.md`.
4. `packages/server/`: `README.md`, `wrangler.jsonc` (no `account_id`; observability off),
   `src/index.ts` (**CORS `*` and no Origin check**), `src/room.ts` (no cap on a message's size or an
   `act`'s length), `scripts/online-walk.ts`.
5. `packages/web/src/store/online.ts` (`VITE_ROOMS_URL`).

## What to build

### 1. Ready the room for the public internet (`packages/server`) — before any deploy

Small, and each with a `server:test` row:

- **Origins.** A var, `ALLOWED_ORIGINS` (comma-separated), read by the Worker: `POST /room` and the
  WebSocket upgrade are refused (403) from any other `Origin`; CORS answers with the request's origin
  when allowed, never `*`. Production: `https://space-dog-racing.pages.dev` and its preview deployments
  (`https://*.space-dog-racing.pages.dev`). The local walks pass `--var` for their own origins (or the
  dev default allows `localhost` / `127.0.0.1`), so all three walks stay green unchanged in spirit.
- **Size caps.** A frame over 16 KB, or an `act` with more than 64 actions, is refused with
  `rejected` (not a crash, not a close). Measure the largest real `act` in `online-walk` first and say
  what it was.
- **Room creation.** Leave it unlimited unless something cheap and free-plan-safe exists; if you find
  one, ask Jesse. Do not add an account, a key or a database.
- **Observability on** (Workers Logs, free-plan allowance) so a stalled room can be read afterwards;
  log nothing a player typed beyond what the room already stores (names).
- `wrangler.jsonc`: still **no `account_id` in the repo** (Workers Builds supplies the account). The
  Durable Object migration `v1` (`new_sqlite_classes: ["Room"]`) is what the first deploy runs: do not
  edit it.

### 2. How it deploys — **Workers Builds**, connected to the repo (recommended)

The Pages site already deploys from `main`. The room should too, so a push is the one deploy and
nobody runs `wrangler` on a laptop. Write the exact settings into ONLINE_PLAN §10 and the server
README before Jesse sees them:

- Workers & Pages → Create → **Import a repository** → `aingeaingeainge/space-dog-racing`.
- Project name **`sdr-rooms`** (it must match `wrangler.jsonc`'s `name`).
- **Root directory `packages/server`** (it is not a root workspace; its own lock; `@sdr/engine` is
  `file:../engine`, which a full clone has).
- Build command: none (or `npm ci` if the dashboard needs one); deploy command `npx wrangler deploy`.
- Environment: **`NODE_VERSION=22`** (wrangler needs it); `ALLOWED_ORIGINS` as above.
- Production branch `main`. The workers.dev URL it gets, `https://sdr-rooms.<subdomain>.workers.dev`,
  is the rooms URL.

Then **Pages**: project `space-dog-racing` → Settings → Variables → **`VITE_ROOMS_URL`** = the rooms URL
(production; previews too if that is one click), and **retry the latest deployment** so the build reads
it. Check the live bundle has "Play online".

**Who does the clicking — ask Jesse first, one question:**
1. **Claude drives the dashboard in the built-in browser while Jesse watches** (recommended): he signs
   in to Cloudflare in the browser pane if he is not already; every site is approved by him; Claude
   never changes anything on the account but these two projects, never touches billing, never creates
   an API token, and says each step in the chat as it goes.
2. **Jesse clicks**, from a short numbered list, one screen at a time, telling Claude what he sees.

If Workers Builds cannot build this layout (say so with the log), the fallback is `wrangler deploy`
from Jesse's machine — **ask before** suggesting it, because it means running `npm` outside his repo
folder and signing wrangler in.

### 3. The live smoke test (Claude plays it)

- **`npm run live-smoke -- <roomsUrl> <siteUrl>`** (new, in `packages/server/scripts/`, beside
  `online-walk`, reusing its client): headless clients against the **live** room — create a room, join
  by code, a stale `v` gets `reload`, a spoofed `playerId` is refused, a wrong Origin is refused, an
  oversized frame is refused; then two humans and an AI play **a race to 1 Bone through the draft** to
  the game's end, and the final state equals Node's replay of the room's `ended` log. It creates real
  rooms; they expire after 30 days on their own — note their codes.
- If the container's proxy will not reach `*.workers.dev`, do not work around it: say so, and run the
  browser half only.
- **The browser half:** in the **built-in browser** on Jesse's desktop, open the live site in two tabs,
  make a room in one, join by link in the other, draft, play the weekend to the end; screenshots of the
  lobby, the draft and the results. Also check a phone width if the pane allows.
- An evening's use against the free plan: read it off the dashboard (Durable Objects requests and
  duration) after the smoke test and write the figure down — the target is < 1% of a day's allowance.

### 4. The docs

- **ONLINE_PLAN:** §10's L4 — built, the settings as deployed, the rooms URL, the smoke test, and the
  🎲 rows **still open** (no evening yet). §7: **`PROTOCOL_VERSION` 1 is now frozen**, with the date and
  the rule for the next builder in one bold line. A note that L4 went ahead of the evening, Jesse's call.
- **GDD_V3 §13:** an `L4a` row for Jesse's ordering call and any choice he makes in this session.
- **PLAYTEST_CHECKLIST:** an **online section** below the evening's: how to start a room, what to tick
  (the four 🎲 rows of L4 in ONLINE_PLAN §10), and "deploy between evenings — never push during one".
- **README:** a line under the play link: "Play online with friends: press Play online".
- **CLAUDE.md:** one non-negotiable added: *the room is live — bump `PROTOCOL_VERSION` with any change
  to a message, the view or a rule, and never push `main` while friends are playing (a `STATE_VERSION`
  change ends live rooms).*
- **BUILD_PLAN_V3** (the L outline: L4 ✅), **CANON** (`v3l4`, last synced).
- `claude/V3_PHASE_L4_NOTES.md` in the style of N's, and this prompt as `claude/V3_PHASE_L4_PROMPT.md`,
  corrected before commit (corrections in a box at the top). Tag `v3l4` on that commit.

## RULES THAT DO NOT BEND

- **No game change.** `packages/engine` untouched; both goldens, `STATE_VERSION` 14, `SAVE_VERSION` 14,
  `PROTOCOL_VERSION` 1. Hotseat byte for byte: `season-check`, `hub-clicks`, `race-view-check` and the
  harness summary equal `shots/before/`.
- **No secrets in the repo**: no account id, API token or Cloudflare credential anywhere in git, the
  notes or the Project. Nothing is created on Jesse's account but `sdr-rooms` and one Pages variable.
- **No dependency added** to the web or the root; the Pages build on Node 20 from a clean
  `npm ci && npm run build` passes. `package-lock.json` at the root untouched.
- All local walks stay green; lint and strict TypeScript; format only what you edit.
- **Free plan only.** If anything would need the paid plan, stop and ask.

## DONE WHEN

| Measure | Target |
|---|---|
| Origins allowlisted; oversized frames and acts refused; observability on | ✅ `server:test` rows |
| `sdr-rooms` deployed from `main` by Workers Builds (or Jesse's chosen fallback) | ✅ the dashboard |
| `VITE_ROOMS_URL` set; the live site shows "Play online" | ✅ |
| `live-smoke` against the live room: all rows | ✅ (or, if the proxy blocks it, the browser half alone, said plainly) |
| Two browser tabs on the live site: a room, a draft, a weekend, the results | ✅ screenshots |
| An evening's cost from the dashboard | < 1% of a day's free allowance |
| `PROTOCOL_VERSION` 1 frozen, in ONLINE_PLAN §7 and CLAUDE.md | ✅ |
| Hotseat unchanged; every local check green; Pages on Node 20 | ✅ |

## Then, in order

1. Re-baseline into `shots/after/`; `npm run snapshot`.
2. Write the notes (with a **short** multiple-choice `v3l4` checklist: what next — the hotseat evening,
   an online evening, or Phase O: the draft's two misses from N), commit the prompt, tag `v3l4`.
3. Land it (the second landing of the session if the code half was landed first — say so), give Jesse
   `git push origin main` and `git push origin v3l4`.
4. Sync the Project: CANON, GDD_V3, BUILD_PLAN_V3, PLAYTEST_CHECKLIST, ONLINE_PLAN, and the new
   `claude/` notes and prompt; update each `last synced`.

## Still open, and not this phase's

- **The evening** (hotseat), and the first **online evening** — both playtests, when Jesse has time.
- **Phase O** — N's two misses: draft position (the scarce +10% prize-money trainers) and the long-game
  comeback; the style-read trainer (GDD_V3 §14 Q13).
- A custom domain for the rooms; accounts; matchmaking; a turn timer. Not asked for.
