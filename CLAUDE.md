# Space Dog Racing — builder notes

Read design/GDD.md and design/BUILD_PLAN.md before any change. The GDD is the source of truth for rules; the spreadsheet is the source of truth for numbers (packages/engine/src/content/balance.json is generated from it — never hand-edit).

## Non-negotiables
- packages/engine has no DOM, React, Date, or Math.random. All randomness via rng.ts. If you need a random number, thread the rng through.
- Every state change is an Action handled in reduce.ts. UI never mutates state directly.
- Same seed + same action log must reproduce the same season. test/golden.test.ts guards this; update the golden file only when a rule deliberately changes and say so in the commit.
- Races return a tick log; the renderer replays it and never re-simulates.
- Keep TypeScript strict; no `any` in engine.
- Run `npm test` and `npm run harness -- --seasons 50` before declaring a milestone done; paste the harness summary into the PR description.

## Conventions
- Currency is "Bones"; format with formatBones().
- Ratings, stats 0–99 integers in state (floats only inside a race).
- Content (planets/events/traits) is data, not code: add a row, not a branch.
- Commit small, message in imperative mood.
