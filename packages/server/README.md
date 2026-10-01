# @sdr/server — the online room

ONLINE_PLAN §2: a Worker that only routes (`POST /room`, `GET /room/:code`) and a SQLite-backed
Durable Object, `Room`, one per game, running `@sdr/engine`. **Live from `v3l4`**, on Jesse's
Cloudflare account, deployed by Workers Builds from `main` (below). There is still no `account_id`
in this folder, on purpose.

**Not a root workspace.** `wrangler` needs Node 22 and brings `workerd`; the Pages build runs
`npm install` at the root on Node 20, so this package keeps its own `package.json` and lock and is
installed on its own:

```
npm run server:install     # once (from the root), or npm install in this folder
npm run server:test        # typecheck + the room's logic under Node (no workerd)
npm run online-walk        # starts wrangler dev and plays whole games with headless clients
npm run server:dev         # wrangler dev on :8787
npm run live-smoke -- <roomsUrl> <siteUrl>   # the same clients against the live room (v3l4)
```

- `src/protocol.ts` — the message types, type-only, for the web's online store (L3) to import.
- `src/index.ts` — the Worker. `src/room.ts` — the Durable Object. `src/game.ts` — the room's
  logic with no Durable Object in it (the queue, the stand-in, the view diff). `src/guard.ts`
  (`v3l4`) — which pages may open a room, and the 16 KB / 64-action caps.
- `scripts/client.ts` — the headless client, shared by `online-walk.ts` (the headless half of
  ONLINE_PLAN §8 item 3) and `live-smoke.ts` (`v3l4`).

## ⚠️ The room is live

- **`PROTOCOL_VERSION` 1 is frozen** (since the first deploy, `v3l4`). Any change to a message, the
  view or a rule bumps it, so an old browser is told to reload instead of misreading a new room.
- **Never push `main` while friends are playing.** A push deploys the room; a `STATE_VERSION` change
  ends every live room (it shows its last standings and plays no more, ONLINE_PLAN §7).
- **Never edit the `v1` migration** in `wrangler.jsonc`; a new Durable Object change is a new tag.
- **Who may open a room** is `ALLOWED_ORIGINS` in `wrangler.jsonc`'s `vars` (the live site and its
  preview deployments). It is a runtime variable, so it lives in the config, not in the dashboard's
  build variables, which a Worker cannot read. Under `wrangler dev` any `localhost` page may, by the
  request's own host, so the walks need nothing.

## How it deploys: Workers Builds (set up once, at `v3l4`)

Cloudflare dashboard → Workers & Pages → Create → **Import a repository**:

| Setting | Value |
|---|---|
| Repository | `aingeaingeainge/space-dog-racing` |
| Project (Worker) name | **`sdr-rooms`** — must match `wrangler.jsonc`'s `name` |
| Production branch | `main` |
| Root directory | **`packages/server`** (its own lock; `@sdr/engine` is `file:../engine`, which the clone has) |
| Build command | none (Workers Builds installs from the lock itself) |
| Deploy command | `npx wrangler deploy` |
| Preview (non-production branches) | left as the dashboard's default; `main` is the only branch |
| Build variable | **`NODE_VERSION` = `22`** (what every walk ran on) |

The Worker's URL, `https://sdr-rooms.<subdomain>.workers.dev`, is the rooms URL. The Pages project
`space-dog-racing` reads it at build time as **`VITE_ROOMS_URL`** (Settings → Variables and
Secrets), so "Play online" shows; a Pages build without it is the hotseat game.

A push to `main` now deploys both: Pages rebuilds the site, Workers Builds redeploys the room. They
finish a few minutes apart; an old page meeting a new room is the `reload` case.

Observability is on (Workers Logs): the room writes one line per room event — `created`, `started`,
`ended`, `wake`, `refused`, `error`, `expired` — with its code and never a player's name.
