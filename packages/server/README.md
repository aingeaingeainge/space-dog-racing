# @sdr/server — the online room

ONLINE_PLAN §2: a Worker that only routes (`POST /room`, `GET /room/:code`) and a SQLite-backed
Durable Object, `Room`, one per game, running `@sdr/engine`. Local only at `v3l2`: there is no
`account_id` and nothing here deploys.

**Not a root workspace.** `wrangler` needs Node 22 and brings `workerd`; the Pages build runs
`npm install` at the root on Node 20, so this package keeps its own `package.json` and lock and is
installed on its own:

```
npm run server:install     # once (from the root), or npm install in this folder
npm run server:test        # typecheck + the room's logic under Node (no workerd)
npm run online-walk        # starts wrangler dev and plays whole games with headless clients
npm run server:dev         # wrangler dev on :8787
```

- `src/protocol.ts` — the message types, type-only, for the web's online store (L3) to import.
- `src/index.ts` — the Worker. `src/room.ts` — the Durable Object. `src/game.ts` — the room's
  logic with no Durable Object in it (the queue, the stand-in, the view diff).
- `scripts/online-walk.ts` — the headless half of ONLINE_PLAN §8 item 3.
