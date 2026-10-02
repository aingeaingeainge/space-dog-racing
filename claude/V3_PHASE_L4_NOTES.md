# V3 Phase L4 notes: online, live (2 October 2026)

Worked in Cowork from a clone in the container, landed in Jesse's folder **twice** (the code half before
his push, then the docs and the tag), and deployed from the Cloudflare dashboard in the built-in
browser while Jesse watched. Tag **`v3l4`**. The fallback is `v3n` (`42646bd`).

**In one line:** the room is live at **`https://sdr-rooms.aingeaingeainge.workers.dev`**, deployed by
Workers Builds from `main`; the live site has **Play online**; only the site's own pages may open a room;
`PROTOCOL_VERSION` 1 is frozen. Nothing in the game changed.

The prompt is `claude/V3_PHASE_L4_PROMPT.md`, with its corrections in a box at the top.

---

## ⚠️ Read this first: six things the record should know

1. **L4 went live ahead of the playtest evening, at Jesse's call** (GDD_V3 L4a). Nobody but Claude has
   played the live room. Every 🎲 row — hotseat and online — is still open.
2. **`PROTOCOL_VERSION` 1 is frozen from this deploy.** A change to any message, the view's shape or a
   rule is a bump from now on; and **`main` is never pushed while friends are playing** — a push
   redeploys the room, and a `STATE_VERSION` change ends every live room. Written into ONLINE_PLAN §7,
   CLAUDE.md, the server README and the checklist's online section.
3. **`live-smoke` could not run from the container**: its proxy refuses `*.workers.dev` and
   `*.pages.dev` (CONNECT 403). As the prompt said, nothing worked round it. The script is in the repo
   and passes all 10 rows against `wrangler dev`; its live checks were made by hand from the live
   site's own page in the browser pane (below), and the browser half was played in full.
4. **Workers Builds made a build API token on Jesse's account** ("sdr-rooms build token"). The prompt
   said Claude never creates one; the dashboard cannot deploy without it, so Jesse was asked before
   Deploy was pressed and said yes (GDD_V3 L4c). Cloudflare keeps it; nobody saw its value. It can be
   revoked under Account API tokens, which stops the room deploying, not running.
5. **`ALLOWED_ORIGINS` is in `wrangler.jsonc`, not the dashboard.** Workers Builds' variables are
   build-time only. The dashboard holds one build variable, `NODE_VERSION` = 22.
6. **The Durable Objects page shows 3 errors** for the session's 55 requests. Workers Logs, over the
   same hour, shows 68 events and **0 errors**, and every check passed. Not explained: a guess is
   sockets closed under the room (the hand probe opened and dropped four; the host refreshed once),
   which the Durable Object metrics may count as errors. Worth a look the first time friends play.

---

## What was built, commit by commit

| Commit | What |
|---|---|
| `5997b33` | **The room, ready for the public internet.** `src/guard.ts`: `originAllowed` (exact origins and one-label `https://*.` wildcards; under `wrangler dev`, by the request's own host, any localhost page and a client with no `Origin`), `frameTooBig` (16 KB of UTF-8), `seqOf` (a refused frame's `seq` without parsing it), `MAX_ACTIONS` (64, the cap `refuseAct` already had since `v3l2`). The Worker answers 403 to any other page, and CORS echoes the allowed origin, never `*`. The room refuses a big frame with `rejected` and carries on; it writes one log line per room event — `created`, `started`, `ended`, `wake`, `refused`, `error`, `expired` — with its code and never a name. `wrangler.jsonc`: `vars.ALLOWED_ORIGINS`, observability on. `server:test` 11 → 15. |
| `531a31e` | **`live-smoke` and the deploy settings.** `scripts/client.ts`: `online-walk`'s headless client moved out unchanged but for a settable endpoint and an `Origin` header (undici's `WebSocket` takes `headers`). `online-walk` gained two rows (27) and prints the largest act. `npm run live-smoke -- <roomsUrl> <siteUrl>`. The Workers Builds settings in the server README and ONLINE_PLAN §10. **Landed and pushed mid-session.** |
| (docs) | `wrangler.jsonc`: `workers_dev: true`, `preview_urls: false` (the first deploy warned about both). ONLINE_PLAN §2.1, §7, §10; GDD_V3 L4a–L4c; PLAYTEST_CHECKLIST's online section; README; CLAUDE.md; BUILD_PLAN_V3; CANON. |
| (this) | These notes and the prompt; tag `v3l4`. |

### The largest real act

Measured in `online-walk` (four games, 1,062 acts from the walk's plain line): **349 bytes, 5 actions**.
The caps are 16,384 bytes and 64 actions: about 47× and 13× headroom. Measured before any cap moved.

### What the dry run of Workers Builds showed

A fresh clone, `cd packages/server && npm ci && npx wrangler deploy --dry-run`: 50 packages, a 309 KiB
bundle (83 KiB gzipped), the `ROOM` binding and `ALLOWED_ORIGINS`. The real build matched it exactly:
Node 22.23.3, `npm clean-install` from the lock, `wrangler deploy`, startup 4 ms, ~50 s in all.

---

## The deploy, as done (Jesse watching the pane)

1. Jesse signed in to Cloudflare in the browser pane himself.
2. Workers & Pages → Create application → **Continue with GitHub** → `space-dog-racing`.
3. Project name **`sdr-rooms`**; build command **cleared** (the form pre-filled `npm run build`); deploy
   `npx wrangler deploy`; **Enable Preview builds off**; Advanced → Path **`/packages/server`**; build
   variable **`NODE_VERSION` = `22`**; API token "Create new token" (the dashboard's default; see item 4).
4. Deploy → build `78202e50` succeeded; URL `https://sdr-rooms.aingeaingeainge.workers.dev`.
5. Pages → `space-dog-racing` → Settings → Variables and secrets → **`VITE_ROOMS_URL`** (Text,
   Production) = that URL → Save. Previews were not set: the project has no preview branch.
6. Deployments → the latest (`531a31e`) → Manage deployment → **Retry deployment** → success in 36 s.
   The live site's Title shows **PLAY ONLINE**.

Nothing else on the account was opened or changed. No account id, token value or credential is in git,
these notes or the Project (the subdomain in the rooms URL is public: it is in the site's bundle).

---

## The live smoke test

### By hand, from the live site's page (the checks `live-smoke` makes)

Run as JavaScript in the browser pane on `https://space-dog-racing.pages.dev` (an allowed page) and on
`https://dash.cloudflare.com` (a page that is not):

| Check | Result |
|---|---|
| `POST /room` from the site | 201 in 665 ms, room **FGPBRP** |
| `hello` with `v: 0` | `reload`, `need: 1`, in 56 ms |
| `hello` with a name | `welcome` |
| A 17 KB `act` frame | `rejected` "That message is too big", `seq` echoed; the socket stayed open |
| The dev-only `debug` hook | `rejected` "No such message: debug" |
| `POST /room` from `dash.cloudflare.com` | blocked (403, no CORS header: the browser refuses to read it) |
| A socket from `dash.cloudflare.com` | refused |

Not made by hand: the spoofed `playerId` and the 65-action act (they need a started game and a second
socket on the seat); both are rows of `online-walk` (27/27) and `live-smoke` (10/10) under `wrangler
dev`, and the room's code is the deployed code.

### The browser half (two origins, one room)

Two tabs of one browser share `localStorage`, so the second would have taken the first's seat. The host,
**Aroha**, played on `space-dog-racing.pages.dev`; the guest, **Bex**, opened the link on the retried
deployment's own URL (`176e9a27.space-dog-racing.pages.dev`) — a second origin, and a test of the
`*.space-dog-racing.pages.dev` wildcard. Room **JBRJHX**, one Normal AI ("The Widow Cray"), length a
race to **1 Bone** (the lobby's "Race to a figure of your own…").

- The lobby: the code big, the link, both seats "here", the AI row; Start.
- **The draft**: 18 picks in snake order, the waiting tab reading "Waiting on Bex — the draft · 0:01 ·
  Nudge" while the other picked.
- Arrival → a door each (the hydro pool, the chemist), answered.
- Aroha's Market and Race Office sitting: her three declarations **landed live on Bex's board** while Bex
  read "Waiting on Aroha — Market and Race Office · 0:36 · Nudge". Bex's Nudge went (the button read
  "Nudged"); the notice on Aroha's tab was not caught by the read that followed.
- Bex's sitting, the Bookie (both done), race day (watched, then "Skip the rest of race day"), the
  results (Aroha 3,960 Bones from two seconds; Bex won the Bronze and the Silver).
- Aroha's "Fly on" **held** ("You have flown on — on to Vatgrown once the table has"), Bex's applied, and
  the game ended: "Target crossed: Aroha and Bex and The Widow Cray passed 1 Bones at week 1 of season 1.
  The Widow Cray wins with 35,326 Bones." The report's clock: 7 minutes.
- **A refresh at 375 px** (the pane's mobile preset): the host came straight back to the game's end, no
  horizontal scroll (scroll width 375).

Screenshots, in `shots/live/` (not in the repo): `00-title-play-online`, `01-lobby-host`,
`02-lobby-guest-preview-origin`, `03-lobby-host-ready`, `04-draft-waiting-host`,
`05-draft-on-the-clock`, `06-waiting-line-board-live`, `07-race-view`, `08-results`,
`09-game-over-guest`, `10-game-over-host-375-after-refresh`, `11-durable-objects-usage`.

**Rooms made on the live room:** FGPBRP (the hand probe, never started) and JBRJHX (the game). They
delete themselves 30 days after their last action.

### The cost, from the dashboard (Durable Objects, read after the game)

| | This session | A day's free allowance | Share |
|---|---|---|---|
| Requests | **55** | 100,000 | 0.06% |
| Duration | **0.22 GB-s** | 13,000 GB-s | 0.002% |
| SQL rows read / written | 635 / 100 | 5 M / 100,000 | 0.01% / 0.1% |
| SQL stored | 74 kB | 5 GB | — |
| Workers Logs events | under 100 | 200,000 | < 0.05% |

**An evening, scaled**: ONLINE_PLAN §9.2's evening is ~2,000 human actions; this game was ~45. Counted
one request a message, as the dashboard appears to show them, that is ~2,500 requests — **2.5% of a day**;
billed at the 20 : 1 WebSocket rate it is ~150 (0.15%). Duration ~10 GB-s (0.08%). **Under the 1% target
on everything Cloudflare bills, and about 2.5% of the raw request count.** Either way nothing is charged:
the account is on the free plan, which stops rather than bills.

---

## The rules that did not bend

- **No game change.** `git diff v3n --stat -- packages/engine packages/web` is empty. Goldens unmoved;
  `STATE_VERSION` 14, `SAVE_VERSION` 14, `PROTOCOL_VERSION` 1.
- **Hotseat byte for byte:** `season-check`, `hub-clicks` and `race-view-check` identical to
  `shots/before/`; the harness summary identical but for its elapsed time (3.1 s → 3.5 s).
- `npm test` **207 green**; lint clean; build passes; `asset-check` 288 / 0 / 0; `view-walk` **0 throws**;
  `server:test` **15 green**; `online-walk` **All 27 rows pass**; `online-table-walk` **All 10 rows
  pass**; `browser-walk` **All 8 rows pass** — on its second run: the first `after` run died with the container mid-walk, not on a row; the code-half run failed only the known held-"Fly on" flake and passed all 8 alone.
- **No dependency added** anywhere; the root `package-lock.json` untouched (the root `package.json`
  gained one script, `live-smoke`). Pages on Node 20: a fresh clone, Node v20.20.0, `npm ci && npm run build` passes (144 MB of `node_modules`, as at `v3n`).
- **Free plan only**; nothing was created on the account but `sdr-rooms`, its build token (item 4) and
  one Pages variable.

---

## Open questions

1. **The online evening** (PLAYTEST_CHECKLIST O.1–O.6): the wait without a timer, the stand-in, moving on
   alone, forty minutes, the lobby to a stranger, anything stuck.
2. **The hotseat evening** — unchanged, still the plan's next step for the rules.
3. **Phase O** (N's misses): draft position and the long-game comeback; the style-read trainer (§14 Q13).
4. The 3 Durable Object errors (item 6 above), if they recur with friends.
5. Small, seen in passing: at ~800 px the guest's board of declarations ran a few pixels past its panel
   on the right (`06-waiting-line-board-live`). Not measured; a look for whoever next touches the board.
6. The README's longer paragraphs still describe v1 ("no server", "Online multiplayer is M5"); only the
   Play online line was added, as asked.

---

## The `v3l4` checklist (for Jesse)

| | Question | Tick one |
|---|---|---|
| 1 | **What next?** | The hotseat evening (Recommended) · An online evening with friends · Phase O: the draft's two misses |
| 2 | Try the live room yourself first, with a friend or two browsers? | Yes, a quick game · No, the evening will be the first |
