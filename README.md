# space-dog-racing
Greyhound stable management on the grimy underground dog-racing circuit of a cartoon future. Browser game, 3-8 players.

## Status

**M0 — engine core.** The pure TypeScript engine (`packages/engine`) can create a season and play all 13 weeks headless with AI stables; `packages/web` is a Vite shell that only proves the engine bundles. The playable game arrives in M1. See `design/BUILD_PLAN.md` for the roadmap and `design/GDD.md` for the rules.

## Developing

```
npm install
npm test                          # typecheck + engine tests (golden seed, invariants, race calibration)
npm run harness -- --seasons 200  # balance instrument: end worth, win rates, income split …
npm run harness -- --calibrate    # race-sim win rates vs rating gap, bookie model fit
npm run balance                   # regenerate packages/engine/src/content/balance.json from the spreadsheet
npm run dev                       # Vite dev server for packages/web
npm run build                     # builds packages/web/dist (what Cloudflare Pages deploys)
npm run snapshot                  # dated local backup into backups/
```

Numbers live in `design/space_dog_racing_economy.xlsx` (Assumptions sheet). Constants the sheet does not carry yet live in `packages/engine/scripts/balance.extras.json`; both are merged into `balance.json`, which is generated and never hand-edited.
