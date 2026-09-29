# V3 Phase L1 notes: the engine's half of online play (29 September 2026)

Worked in Cowork from a clone in the container, handed back as a bundle and fast-forwarded into
Jesse's folder. Tag **`v3l1`**. The fallback is `v3k` (`346a0ae`).

**In one line:** the engine can now say what each seat may see (`viewFor`), the rumours live in the
engine, the off-season can be answered in any order, and there is a `PROTOCOL_VERSION`. No rule, golden
or save version moved, and every hotseat check reads byte for byte as it did at `v3k`.

**There is no `V3_PHASE_L1_PROMPT.md`.** This session was opened with Phase K's prompt, but K was
already done, landed and pushed. Asked what next, Jesse chose "Build L1 now", and then "build it here"
over writing a prompt for a separate build session. The spec was `design/ONLINE_PLAN.md` §4 and §10's L1.

---

## ⚠️ Read this first: three things the record should know

1. **The off-season's any-order needed more than relaxing a turn check.** Answers draw nothing (E5), but
   two things did depend on who answered first: a replacement dog takes the next id off the counter, and
   each answer appends to the event log. So four stables answering in different orders gave four
   different states. `fileInTurnOrder` (`phases/offSeason.ts`) re-files both as turn order would have
   them, the Bookie's `slipIndex` pattern: replacements are renumbered from where the counter stood when
   the off-season opened, and each stable's answer lines kept together, stables in turn order. To find
   the lines without tagging them (a tag would move the goldens), each notice counts its own in an
   optional `logLines`, which goes when the new season clears the off-season. In turn order both steps
   are no-ops, which is why no golden, AI table or hotseat game moved. GDD_V3 **L1a**.
2. **Phase K's secret list missed two things, and one leak stays on purpose.** Another stable's
   `stats` counters (`betIncome`, `dogOffers`, `tips`, `nobbles`, `boxes`, `staffOffers`, …) move the
   moment a slip, a card, a tip, a nobble or a box happens, so they would have said "Ruby just booked a
   nobble". And a lucky bone's `raceBonus` is a card's edge. Both are hidden from other seats now (twenty
   rows). **Cash stays public**: a nobble, a box, a tip and a stake all leave cash at once, and cash is
   the scoreboard. A view says Ruby spent 300 Bones, never on what. GDD_V3 **L1b**, ONLINE_PLAN §3.1.
3. **A hidden style shows as "stalker" in a view.** `Dog.style` is not optional, so a view has to put
   *something* there; `styleKnown` stays false and every screen already reads that first. Nothing drew
   the placeholder in the view walk. A later `PROTOCOL_VERSION` could make it `null` if L3 prefers.

---

## What was built

| Piece | Where |
|---|---|
| `viewFor(state, seat)`, `SEAT_SECRETS` (20 rows, each a field, the secret, who may see it, and the redaction) | `packages/engine/src/view.ts` |
| `rumoursFor(state)` and `mostNotable`, moved from the web, output unchanged | `packages/engine/src/rumours.ts` |
| `GameState.rumours?`: only ever set on a view; the web's `rumours(s)` reads it, else works it out as before | `types.ts`, `web/src/lib/rumours.ts` |
| The off-season in any order; `fileInTurnOrder`; `OffSeasonNotice.logLines?` | `phases/offSeason.ts`, `reduce.ts`, `types.ts` |
| `PROTOCOL_VERSION = 1` | `state.ts`, beside `STATE_VERSION` |
| 133 tests | `packages/engine/test/view.test.ts` |
| `npm run view-walk` | `packages/web/scripts/view-walk.tsx` (needs Vite for the art's `import.meta.glob`, so `vite-node`) |

The only web changes are the two `lib/` files: `rumours.ts` now calls the engine, and `market.ts`
re-exports `mostNotable` from it.

---

## The measurements

### `viewFor`'s tests

A **plant** per `SEAT_SECRETS` row gives one stable a secret by editing the state directly (so nothing
else moves, not its cash, not the rng), on a table at week 4 with the fields locked. For each row and
each of two tables (4 humans + 2 AIs; 8 humans): the plant is in the state; the view shows it to exactly
the seat allowed (or nobody); and every seat not allowed it gets a **byte-identical** view with and
without it. Where planting also makes something public (a card its owner can see, a style going back to
unknown, an off-season), the comparison is against a twin plant with a different secret. A test fails if
a row has no plant, so a new secret field is a row and a test. Also: `viewFor` never touches its input,
every seat hears the same rumours, and once the game is over the view is the whole state.

### The view walk

```
view walk: two seasons, 4 humans + 2 AIs (seed 42): 617 moments × 4 seats, 46892 renders from a view (45216 drew a screen) in 30.9 s
  rumours from the view equal the hotseat's: yes
  GalaxyMap reading a dark week's planet (L3's one-line move): 14 weekends
  ✓ 0 throws that the whole state does not
```

The humans are played by the stand-in (`decide(…, 'normal')`), so the game is full of doors, cards,
bets, nobbles and off-season offers. At every change of week, phase, seat on the clock or card, all 19
screens and components are server-rendered for every human seat from its view. A throw counts only if
the same screen renders from the whole state. The one expected failure, `GalaxyMap` calling `planetOf`
on a dark week, is counted apart: it is ONLINE_PLAN §6 item 4, a one-line move for L3.

### The off-season in any order

Four humans at seed 42 reach the off-season; three retire a dog and one keeps them all, and every
candidate is taken. **All 24 orders** of the four stables, and **40 random interleavings** of their
presses, give one state, byte for byte, equal to turn order. A stable that has finished cannot answer
again.

### The stand-in and the rumours

- `decide(state, seat, 'normal')` plays four human seats through a whole season, and the log replays.
- `rumoursFor`: the probe `shots/rumours-dump.mts` over 50 six-AI seasons gave **417 rumours, hash
  `ae11f511…`**, from the web at `v3k` and from the engine now. The test pins seeds 1–5 (50 rumours).

---

## The rules that did not bend

```
$ git diff v3k --stat -- packages
 packages/engine/src/index.ts            |   2 +
 packages/engine/src/phases/offSeason.ts |  82 ++++-
 packages/engine/src/reduce.ts           |   6 +-
 packages/engine/src/rumours.ts          | 124 ++++++++
 packages/engine/src/state.ts            |   8 +
 packages/engine/src/types.ts            |  12 +
 packages/engine/src/view.ts             | 269 +++++++++++++++++
 packages/engine/test/view.test.ts       | 514 ++++++++++++++++++++++++++++++++
 packages/web/scripts/view-walk.tsx      | 173 +++++++++++
 packages/web/src/lib/market.ts          |  17 +-
 packages/web/src/lib/rumours.ts         | 101 +------
 11 files changed, 1197 insertions(+), 111 deletions(-)
```

- **Goldens:** `41a8c8b5…` (one season) and `d4bb14c3…` (two seasons), unmoved. The golden files were not
  touched.
- **`SAVE_VERSION` 13, `STATE_VERSION` 13.** The two new fields are optional and appear in no finished
  state: `rumours` only on a view, `logLines` only mid-off-season. A `v3k` save taken mid-off-season still
  loads (a missing `logLines` reads as 0, and in turn order the re-filing is a no-op either way).
- `npm test` **184 green** (the 51 as before, and 133 new). `npm run lint` clean. `npm run build` ✅.
- **Hotseat, byte for byte against `v3k`:** `season-check`, `hub-clicks` (9.4 clicks; the table walk 10.7 /
  22.4 passes, 0 leaks) and `race-view-check`, run before and after on the same machine and diffed.
- `asset-check`: **288 finished, 0 still a stand-in, 0 missing.**
- No `packages/server`, no `wrangler` config, no deploy.

### `npm run harness -- --seasons 50`

```
End net worth (Bones) and win rate by agent
  agent      n     mean      p10      p50      p90   winRate
  normal    300   42,495   29,847   41,470   56,395    16.7%

Income split per stable-season (mean): prize / trade / betting / costs
  normal     22,001    3,526   -1,350    6,919

The kennel — fitness at declaration and races per dog (targets: fitness 60–80, under 60 10–25%, races/dog 5–7)
  agent     meanFit   <thresh   races/dog   dogs@wk10   distinct dogs owned
  normal      69.7     22.8%         6.6       3.00                  3.20

Purse pool: 240,860 posted a season, 47.6% of it reaching a player (v1 54%, Phase A 52%; the rest leaves the economy with the local dogs)
```

Identical to `v3j`'s and `v3k`'s.

### The acceptance table (ONLINE_PLAN §10, L1)

| Measure | Target | `v3l1` |
|---|---|---|
| Every §3.1 row hidden from every other seat, shown to its owner | a test per row | ✅ 20 rows × 2 tables |
| Indistinguishability | all rows, 4 and 8 seats | ✅ |
| Views render through the web, every seat, every screen | 0 throws | ✅ 46,892 renders, 0 |
| Off-season in any order | 24 orders | ✅ and 40 interleavings |
| `decide` plays a human seat through a season | ✅ | ✅ |
| `rumoursFor` unchanged | 50 seasons | ✅ 417, `ae11f511…` |
| Goldens, versions, tests, lint, `season-check`, harness | unmoved | ✅ |

## Commits

1. `fe633df` Add viewFor, rumoursFor, the any-order off-season and PROTOCOL_VERSION.
2. `abf1bde` Test every seat's view, the off-season's orders and the stand-in.
3. `f330312` Record L1 in ONLINE_PLAN, GDD_V3 (L1a, L1b), BUILD_PLAN_V3 and CANON.
4. These notes. Tagged **`v3l1`**.

---

## Open questions

1. ❓ **What next?** L2 (the room, local only, no deploy) is the plan's next step, and like L1 it
   touches nothing the evening plays. Or the evening first.
2. ❓ **`liesTold` at resolve** (K's open question 3) is now moot for the view, which takes the pending
   lie back off. It can stay as it is.
3. Carried, untouched: **the evening** (`design/PLAYTEST_CHECKLIST.md`, unplayed); the Title's stale
   "What is in this build" panel and a seed link that carries AI names; L4's deploy; §7.5 split view;
   §14 Q9; more human faces; the goldens cannot see betting or humans.

---

## ⚠️ The v3l1 checklist, multiple choice

1. **Next session?** *L2, the room, still before the evening · The evening first · The two small J fixes*
2. **A hidden style in a view:** *"stalker" with `styleKnown` false is fine · Make it `null` in L3*
