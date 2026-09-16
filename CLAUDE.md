# Space Dog Racing — builder notes

**Read `design/CANON.md` first.** It says which design documents are current and which are
historical, and it is short.

As of v3 that means: read **`design/GDD_V3.md`** and **`design/BUILD_PLAN_V3.md`** before any
change, plus **§§1–5 of `design/BUILD_PLAN.md`** for architecture, tech stack, repo layout and the
data model, which V3 does not restate. **`design/GDD.md` is v2 and is historical — do not build
from it**, though V3 cites its findings by name and you will want it open.

The current GDD is the source of truth for rules; the spreadsheet is the source of truth for numbers
(packages/engine/src/content/balance.json is generated from it — never hand-edit).

**This repo is canonical.** Copies of the design documents in the claude.ai Project are mirrors. If
they disagree, the repo is right.

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
