# Space Dog Racing — builder notes

Read design/GDD.md and design/BUILD_PLAN.md before any change. The GDD is the source of truth for rules; the spreadsheet is the source of truth for numbers (packages/engine/src/content/balance.json is generated from it — never hand-edit).

## Non-negotiables
- packages/engine has no DOM, React, Date, or Math.random. All randomness via rng.ts. If you need a random number, thread the rng through.
- Every state change is an Action handled in reduce.ts. UI never mutates state directly.
- Same seed + same action log must reproduce the same season, **on any machine and any JS engine**. test/golden.test.ts guards the rules; test/determinism.test.ts guards the arithmetic. Update the golden file only when a rule deliberately changes, and say so in the commit.
- No `Math.pow` / `exp` / `log` / trig anywhere in packages/engine/src. ECMAScript leaves them implementation-defined and they really do differ — Node 22 vs Node 24 moved every stored odds value, and this project already spans Node 20 (Cloudflare Pages), 22 and 24. Use `pow10()` / `normalDeviate()` from determinism.ts, or wrap the call in `quantize()` and put it in that module. `+ - * /` and `Math.sqrt` are exact per IEEE 754 and always safe. eslint enforces this.
- Races return a tick log; the renderer replays it and never re-simulates.
- Keep TypeScript strict; no `any` in engine.
- Run `npm test` and `npm run harness -- --seasons 50` before declaring a milestone done; paste the harness summary into the PR description.

## Conventions
- Currency is "Bones"; format with formatBones().
- Ratings, stats 0–99 integers in state (floats only inside a race).
- Content (planets/events/traits) is data, not code: add a row, not a branch.
- Commit small, message in imperative mood.
